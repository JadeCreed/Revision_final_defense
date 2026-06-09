from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from collections import defaultdict
import logging

from apps.accounts.models import User
from apps.distribution.models import DistributionEntry
from apps.crop_monitoring.models import CropMonitoringRecord
from apps.production.models import HarvestRecord

logger = logging.getLogger(__name__)

PHASE_LABEL_MAP = {
    'DISTRIBUTION':  'Seed Distribution',
    'ESTABLISHMENT': 'Crop Establishment',
    'TILLERING':     'Tillering',
    'FLOWERING':     'Flowering',
    'RIPENING':      'Ripening',
    'HARVESTING':    'Harvesting',
}

SEED_SOURCE_LABEL = {
    'HYBRID':   'Hybrid Seeds (Gov.)',
    'INBRED':   'Inbred/Certified (Gov.)',
    'OWN_SEED': 'Farmer Saved Seeds',
}


class GISPlotsView(APIView):
    """
    GET /api/gis/plots/
    Returns one entry per farmer-seed_source combination.
    
    Real-world logic:
    - Farmer visibility = AT monitoring visit (not seed distribution)
    - A farmer can appear twice if they use both gov seed AND own seed
    - This correctly handles farmers who plant before seeds arrive
    - Matches the 4-column report: All = Hybrid + Inbred + Farmer Saved
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        barangay_filter = request.query_params.get('barangay', '')
        poll_id_param = request.query_params.get('poll_id', None)

        # ── SEASON/YEAR FILTER from selected poll ──
        from apps.seed_poll.models import Poll

        active_poll = Poll.objects.filter(id=poll_id_param).first() if poll_id_param else (
            Poll.objects.filter(status='OPEN').order_by('-created_at').first()
            or Poll.objects.order_by('-created_at').first()
        )
        poll_year = active_poll.year if active_poll else None
        poll_season = active_poll.season if active_poll else None

        # Get ALL monitoring records, ordered by farmer + seed_source + latest date
        records_qs = CropMonitoringRecord.objects.select_related(
            'farmer', 'encoded_by'
        ).order_by('farmer_id', 'seed_source', '-date_observed')

        if barangay_filter:
            records_qs = records_qs.filter(barangay__iexact=barangay_filter)

        if active_poll:
            records_qs = records_qs.filter(poll=active_poll)

        # Build one entry per farmer+seed_source combination (latest record per combo)
        seen = {}
        for rec in records_qs:
            farmer = rec.farmer
            if not farmer or not farmer.barangay:
                continue

            seed_src = ''
            try:
                seed_src = rec.seed_source or ''
            except AttributeError:
                seed_src = ''

            # Unique key = farmer + seed source
            # This allows Juan (HYBRID) and Juan (OWN_SEED) to both appear
            combo_key = f"{farmer.id}__{seed_src}"
            if combo_key in seen:
                continue  # Already have latest record for this combo

            area_ha = None
            try:
                if rec.area_monitored_ha:
                    area_ha = float(rec.area_monitored_ha)
            except (TypeError, ValueError):
                pass

            encoded_by_name = ''
            try:
                if rec.encoded_by:
                    encoded_by_name = rec.encoded_by.get_full_name()
            except Exception:
                pass

            created_at = None
            try:
                created_at = rec.encoded_at.isoformat()
            except AttributeError:
                try:
                    created_at = rec.created_at.isoformat()
                except AttributeError:
                    pass

            seen[combo_key] = {
                'id':               combo_key,
                'farmer':           farmer.id,
                'farmer_name':      farmer.get_full_name() or 'Unknown',
                'farmer_rsbsa':     farmer.rsbsa_number or '',
                'farmer_contact':   farmer.contact_number or '',
                'farmer_barangay':  farmer.barangay or '',
                'barangay':         farmer.barangay or '',
                'label':            'Main Farm',
                'latitude':         None,
                'longitude':        None,
                'area_ha':          area_ha,
                'land_type':        PHASE_LABEL_MAP.get(rec.crop_phase, rec.crop_phase),
                'crop_phase_key':   rec.crop_phase,
                'seed_source':      seed_src,
                'seed_source_label': SEED_SOURCE_LABEL.get(seed_src, 'Unspecified'),
                'encoded_by':       encoded_by_name,
                'date_observed':    str(rec.date_observed) if rec.date_observed else None,
                'created_at':       created_at,
                'has_distribution': False,
                'has_harvest':      False,
                'harvest_count':    0,
                'last_harvest_date': None,
                'harvest_variety':  None,
                'harvest_area_ha':  None,
                'harvest_bags':     None,
                'harvest_mt':       None,
                'total_approved_in_brgy': 0,
                'total_approved_area_ha_in_brgy': 0,
                'distributed_variety':   None,
                'distributed_seed_type': None,
                'distributed_area_ha':   None,
            }

        # Attach approved distribution info, even for farmers without monitoring data
        try:
            dist_entries = DistributionEntry.objects.filter(
                batch__status='APPROVED',
                qty_bags__isnull=False,
            )

            if poll_year and poll_season:
                dist_entries = dist_entries.filter(
                    batch__event__season=poll_season,
                    batch__event__year=poll_year,
                )
            if barangay_filter:
                dist_entries = dist_entries.filter(farmer__barangay__iexact=barangay_filter)

            dist_entries = dist_entries.select_related(
                'farmer', 'variety', 'batch__event__seed_type'
            ).order_by('farmer_id', '-batch__approved_at')

            distribution_seen = set()
            for entry in dist_entries:
                farmer = entry.farmer
                if not farmer or not farmer.barangay:
                    continue

                seed_type_name = None
                if entry.batch and entry.batch.event and entry.batch.event.seed_type:
                    seed_type_name = entry.batch.event.seed_type.name
                seed_src = ''
                if seed_type_name:
                    if 'HYBRID' in seed_type_name.upper() or seed_type_name.upper() in ['NRP', 'RFO']:
                        seed_src = 'HYBRID'
                    elif 'INBRED' in seed_type_name.upper() or seed_type_name.upper() == 'RCEF':
                        seed_src = 'INBRED'
                    else:
                        seed_src = 'OWN_SEED'
                else:
                    seed_src = 'OWN_SEED'

                combo_key = f"{farmer.id}__{seed_src}"
                data = seen.get(combo_key)
                if not data:
                    data = {
                        'id': combo_key,
                        'farmer': farmer.id,
                        'farmer_name': farmer.get_full_name() or 'Unknown',
                        'farmer_rsbsa': farmer.rsbsa_number or '',
                        'farmer_contact': farmer.contact_number or '',
                        'farmer_barangay': farmer.barangay or '',
                        'barangay': farmer.barangay or '',
                        'label': 'Seed distributed',
                        'latitude': None,
                        'longitude': None,
                        'area_ha': None,
                        'land_type': 'Seed Distribution',
                        'crop_phase_key': 'DISTRIBUTION',
                        'seed_source': seed_src,
                        'seed_source_label': SEED_SOURCE_LABEL.get(seed_src, 'Unspecified'),
                        'encoded_by': None,
                        'date_observed': None,
                        'created_at': None,
                        'has_distribution': False,
                        'has_harvest': False,
                        'harvest_count': 0,
                        'last_harvest_date': None,
                        'harvest_variety': None,
                        'harvest_area_ha': None,
                        'harvest_bags': None,
                        'harvest_mt': None,
                        'total_approved_in_brgy': 0,
                        'total_approved_area_ha_in_brgy': 0,
                        'distributed_variety': None,
                        'distributed_seed_type': None,
                        'distributed_area_ha': None,
                    }
                    seen[combo_key] = data

                data['has_distribution'] = True
                if combo_key not in distribution_seen:
                    distribution_seen.add(combo_key)
                    data['distributed_variety'] = entry.variety.name if entry.variety else None
                    data['distributed_seed_type'] = seed_type_name
                    data['distributed_area_ha'] = float(entry.farm_area_ha) if entry.farm_area_ha else None
                    if not data['area_ha'] and data['distributed_area_ha']:
                        data['area_ha'] = data['distributed_area_ha']
        except Exception as e:
            logger.warning(f'GIS plots: dist info error: {e}')

        # Attach harvest record indicators and latest harvest details
        try:
            harvest_qs = HarvestRecord.objects.select_related('farmer').order_by('farmer_id', 'seed_source', '-harvest_date', '-created_at')
            if barangay_filter:
                harvest_qs = harvest_qs.filter(barangay__iexact=barangay_filter)
            if active_poll:
                harvest_qs = harvest_qs.filter(poll=active_poll)

            harvest_seen = set()
            for rec in harvest_qs:
                farmer = rec.farmer
                if not farmer or not farmer.barangay:
                    continue

                seed_src = rec.seed_source or 'OWN_SEED'
                combo_key = f"{farmer.id}__{seed_src}"
                data = seen.get(combo_key)
                if not data:
                    data = {
                        'id': combo_key,
                        'farmer': farmer.id,
                        'farmer_name': farmer.get_full_name() or 'Unknown',
                        'farmer_rsbsa': farmer.rsbsa_number or '',
                        'farmer_contact': farmer.contact_number or '',
                        'farmer_barangay': farmer.barangay or '',
                        'barangay': farmer.barangay or '',
                        'label': 'Harvest only',
                        'latitude': None,
                        'longitude': None,
                        'area_ha': float(rec.harvest_area_ha) if rec.harvest_area_ha else None,
                        'land_type': 'No monitoring yet',
                        'crop_phase_key': None,
                        'seed_source': seed_src,
                        'seed_source_label': SEED_SOURCE_LABEL.get(seed_src, 'Unspecified'),
                        'encoded_by': None,
                        'date_observed': None,
                        'created_at': None,
                        'has_distribution': False,
                        'has_harvest': False,
                        'harvest_count': 0,
                        'last_harvest_date': None,
                        'harvest_variety': None,
                        'harvest_area_ha': None,
                        'harvest_bags': None,
                        'harvest_mt': None,
                        'total_approved_in_brgy': 0,
                        'total_approved_area_ha_in_brgy': 0,
                        'distributed_variety': None,
                        'distributed_seed_type': None,
                        'distributed_area_ha': None,
                    }
                    seen[combo_key] = data

                data['has_harvest'] = True
                data['harvest_count'] = data.get('harvest_count', 0) + 1
                if combo_key not in harvest_seen:
                    harvest_seen.add(combo_key)
                    data['last_harvest_date'] = str(rec.harvest_date) if rec.harvest_date else None
                    data['harvest_variety'] = rec.variety
                    data['harvest_area_ha'] = float(rec.harvest_area_ha) if rec.harvest_area_ha else None
                    data['harvest_bags'] = rec.harvest_bags
                    data['harvest_mt'] = float(rec.harvest_mt) if getattr(rec, 'harvest_mt', None) is not None else None
                    if not data['area_ha'] and data['harvest_area_ha']:
                        data['area_ha'] = data['harvest_area_ha']
        except Exception as e:
            logger.warning(f'GIS plots: harvest info error: {e}')

        # Get unique farmer IDs from our results
        farmer_ids = list(set(v['farmer'] for v in seen.values()))

        # Mark which farmers have approved distribution records
        try:
            dist_farmer_ids = set(
                DistributionEntry.objects.filter(
                    batch__status='APPROVED',
                    qty_bags__isnull=False,
                    farmer_id__in=farmer_ids,
                ).values_list('farmer_id', flat=True)
            )
            for data in seen.values():
                data['has_distribution'] = data['farmer'] in dist_farmer_ids
        except Exception as e:
            logger.warning(f'GIS plots: distribution flag error: {e}')

        # Total approved farmers per barangay (for percentage denominator)
        approved_per_brgy = {}
        try:
            approved_counts = (
                User.objects
                .filter(role='FARMER', status='APPROVED', is_active=True)
                .values('barangay')
                .annotate(total=Count('id'))
            )
            approved_per_brgy = {
                item['barangay']: item['total']
                for item in approved_counts
                if item['barangay']
            }
            for data in seen.values():
                data['total_approved_in_brgy'] = approved_per_brgy.get(data['barangay'], 0)
        except Exception as e:
            logger.warning(f'GIS plots: approved count error: {e}')

        # Total approved area per barangay
        area_by_brgy = {}
        try:
            seen_area_farmers = set()
            for entry in DistributionEntry.objects.filter(
                batch__status='APPROVED',
                qty_bags__isnull=False,
            ).select_related('farmer').order_by('farmer_id'):
                if not entry.farmer or not entry.farmer.barangay:
                    continue
                if entry.farmer_id in seen_area_farmers:
                    continue
                seen_area_farmers.add(entry.farmer_id)
                if entry.farm_area_ha:
                    brgy = entry.farmer.barangay
                    area_by_brgy[brgy] = area_by_brgy.get(brgy, 0) + float(entry.farm_area_ha)
            for data in seen.values():
                data['total_approved_area_ha_in_brgy'] = round(
                    area_by_brgy.get(data['barangay'], 0), 2
                )
        except Exception as e:
            logger.warning(f'GIS plots: area error: {e}')

        return Response({
            'plots': list(seen.values()),
            'approved_counts': approved_per_brgy,
            'area_by_brgy': area_by_brgy,
        })


class GISMapSummaryView(APIView):
    """
    GET /api/gis/summary/
    Overview panel stats. Computes on-the-fly from monitoring records.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        from apps.seed_poll.models import Poll
        poll_id_param = request.query_params.get('poll_id', None)
        from django.db.models import Q

        active_poll = Poll.objects.filter(id=poll_id_param).first() if poll_id_param else (
            Poll.objects.filter(status='OPEN').order_by('-created_at').first()
            or Poll.objects.order_by('-created_at').first()
        )
        poll_year = active_poll.year if active_poll else None
        poll_season = active_poll.season if active_poll else None

        def monitoring_season_filter(qs):
            if not active_poll:
                return qs
            return qs.filter(poll=active_poll)

        def distribution_season_filter(qs):
            if not poll_year or not poll_season:
                return qs
            return qs.filter(
                batch__event__season=poll_season,
                batch__event__year=poll_year,
            )

        try:
            # Unique farmers being monitored (regardless of seed source)
            monitored_farmer_ids = set(
                monitoring_season_filter(CropMonitoringRecord.objects)
                .values_list('farmer_id', flat=True)
                .distinct()
            )
            total_monitored = len(monitored_farmer_ids)
        except Exception as e:
            logger.error(f'GIS summary: monitored error: {e}')
            monitored_farmer_ids = set()
            total_monitored = 0

        try:
            distributed_farmer_ids = set(
                distribution_season_filter(
                    DistributionEntry.objects.filter(
                        batch__status='APPROVED',
                        qty_bags__isnull=False,
                    )
                ).values_list('farmer_id', flat=True)
                .distinct()
            )
        except Exception as e:
            logger.error(f'GIS summary: distribution error: {e}')
            distributed_farmer_ids = set()

        current_farmer_ids = monitored_farmer_ids | distributed_farmer_ids
        total_current = len(current_farmer_ids)

        try:
            total_approved = User.objects.filter(
                role='FARMER', status='APPROVED', is_active=True
            ).count()
        except Exception as e:
            logger.error(f'GIS summary: approved error: {e}')
            total_approved = 0

        try:
            active_barangays = list(
                monitoring_season_filter(CropMonitoringRecord.objects)
                .values_list('barangay', flat=True)
                .distinct().order_by('barangay')
            )
            active_barangays = [b for b in active_barangays if b]
        except Exception as e:
            logger.error(f'GIS summary: active brgy error: {e}')
            active_barangays = []

        try:
            dist_barangays = list(
                distribution_season_filter(
                    DistributionEntry.objects.filter(
                        batch__status='APPROVED'
                    )
                ).values_list('farmer__barangay', flat=True)
                .distinct().order_by('farmer__barangay')
            )
            dist_barangays = [b for b in dist_barangays if b]
            active_barangays = sorted(set(active_barangays) | set(dist_barangays))
        except Exception as e:
            logger.error(f'GIS summary: distribution brgy error: {e}')

        try:
            all_barangays = list(
                User.objects.filter(
                    role='FARMER', status='APPROVED', is_active=True
                ).values_list('barangay', flat=True)
                .distinct().order_by('barangay')
            )
            all_barangays = [b for b in all_barangays if b]
        except Exception as e:
            logger.error(f'GIS summary: all brgy error: {e}')
            all_barangays = []

        # Seed source breakdown for overview panel
        try:
            seed_breakdown = {}
            seen_combos = set()
            for rec in monitoring_season_filter(
                CropMonitoringRecord.objects
            ).order_by('farmer_id', 'seed_source', '-date_observed'):
                src = rec.seed_source or 'UNKNOWN'
                combo = f"{rec.farmer_id}__{src}"
                if combo in seen_combos:
                    continue
                seen_combos.add(combo)
                phase = PHASE_LABEL_MAP.get(rec.crop_phase, rec.crop_phase)
                if src not in seed_breakdown:
                    seed_breakdown[src] = {
                        'label': SEED_SOURCE_LABEL.get(src, src),
                        'total_farmers': 0,
                        'phases': {},
                    }
                seed_breakdown[src]['total_farmers'] += 1
                seed_breakdown[src]['phases'][phase] = seed_breakdown[src]['phases'].get(phase, 0) + 1

            for entry in distribution_season_filter(
                DistributionEntry.objects.filter(
                    batch__status='APPROVED',
                    qty_bags__isnull=False,
                )
            ).select_related('batch__event__seed_type').order_by('farmer_id', '-batch__approved_at'):
                src = 'OWN_SEED'
                seed_type_name = None
                if entry.batch and entry.batch.event and entry.batch.event.seed_type:
                    seed_type_name = entry.batch.event.seed_type.name
                if seed_type_name:
                    if 'HYBRID' in seed_type_name.upper() or seed_type_name.upper() in ['NRP', 'RFO']:
                        src = 'HYBRID'
                    elif 'INBRED' in seed_type_name.upper() or seed_type_name.upper() == 'RCEF':
                        src = 'INBRED'
                    else:
                        src = 'OWN_SEED'
                combo = f"{entry.farmer_id}__{src}"
                if combo in seen_combos:
                    continue
                seen_combos.add(combo)
                if src not in seed_breakdown:
                    seed_breakdown[src] = {
                        'label': SEED_SOURCE_LABEL.get(src, src),
                        'total_farmers': 0,
                        'phases': {},
                    }
                seed_breakdown[src]['total_farmers'] += 1
                seed_breakdown[src]['phases']['Seed Distribution'] = seed_breakdown[src]['phases'].get('Seed Distribution', 0) + 1
        except Exception as e:
            logger.error(f'GIS summary: seed breakdown error: {e}')
            seed_breakdown = {}

        return Response({
            'current_farmers':          total_current,
            'total_approved_farmers':   total_approved,
            'current_active_barangays': len(active_barangays),
            'total_active_barangays':   len(all_barangays),
            'total_farmers':            total_current,
            'total_plots':              total_current,
            'barangays':                active_barangays,
            'all_barangays':            all_barangays,
            'seed_breakdown':           seed_breakdown,
            'last_updated':             timezone.now().isoformat(),
        })


class GISBarangaysView(APIView):
    """
    GET /api/gis/barangays/
    Returns all 22 Lucban barangays for the filter dropdown.
    """
    permission_classes = [IsAuthenticated]

    LUCBAN_BARANGAYS = [
        'Abang', 'Aliliw', 'Atulinao', 'Ayuti', 'Igang', 'Kabatete',
        'Kakawit', 'Kalangay', 'Kalyaat', 'Kilib', 'Kulapi',
        'Mahabang Parang', 'Malupak', 'Manasa', 'May-It', 'Nagsinamo',
        'Nalunao', 'Palola', 'Piis', 'Samil', 'Tiawe', 'Tinamnan',
    ]

    def get(self, request):
        try:
            return Response(sorted(self.LUCBAN_BARANGAYS))
        except Exception as e:
            logger.error(f'GIS barangays error: {e}')
            return Response([])