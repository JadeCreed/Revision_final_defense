from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count
from collections import defaultdict
import logging

from apps.accounts.models import User
from apps.distribution.models import DistributionEntry
from apps.crop_monitoring.models import CropMonitoringRecord

logger = logging.getLogger(__name__)

PHASE_LABEL_MAP = {
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

        # Get ALL monitoring records, ordered by farmer + seed_source + latest date
        records_qs = CropMonitoringRecord.objects.select_related(
            'farmer', 'encoded_by'
        ).order_by('farmer_id', 'seed_source', '-date_observed')

        if barangay_filter:
            records_qs = records_qs.filter(barangay__iexact=barangay_filter)

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
                'total_approved_in_brgy': 0,
                'total_approved_area_ha_in_brgy': 0,
                'distributed_variety':   None,
                'distributed_seed_type': None,
            }

        if not seen:
            return Response([])

        # Get unique farmer IDs from our results
        farmer_ids = list(set(v['farmer'] for v in seen.values()))

        # Mark which farmers have approved distribution records
        try:
            dist_farmer_ids = set(
                DistributionEntry.objects.filter(
                    batch__status='APPROVED',
                    farmer_id__in=farmer_ids,
                ).values_list('farmer_id', flat=True)
            )
            for data in seen.values():
                data['has_distribution'] = data['farmer'] in dist_farmer_ids
        except Exception as e:
            logger.warning(f'GIS plots: distribution flag error: {e}')

        # Attach distribution variety info (latest approved per farmer)
        try:
            dist_entries = DistributionEntry.objects.filter(
                farmer_id__in=farmer_ids,
                batch__status='APPROVED',
            ).select_related(
                'variety', 'batch__event__seed_type'
            ).order_by('farmer_id', '-batch__approved_at')

            dist_info_by_farmer = {}
            for entry in dist_entries:
                fid = entry.farmer_id
                if fid in dist_info_by_farmer:
                    continue
                try:
                    variety_name = entry.variety.name if entry.variety else None
                    seed_type_name = None
                    if entry.batch and entry.batch.event and entry.batch.event.seed_type:
                        seed_type_name = entry.batch.event.seed_type.name
                    dist_info_by_farmer[fid] = {
                        'variety': variety_name,
                        'seed_type': seed_type_name,
                        'farm_area_ha': float(entry.farm_area_ha) if entry.farm_area_ha else None,
                    }
                except Exception as e:
                    logger.warning(f'GIS: dist entry error farmer {fid}: {e}')

            for data in seen.values():
                fid = data['farmer']
                info = dist_info_by_farmer.get(fid)
                if info:
                    data['distributed_variety'] = info['variety']
                    data['distributed_seed_type'] = info['seed_type']
                    if not data['area_ha'] and info['farm_area_ha']:
                        data['area_ha'] = info['farm_area_ha']
        except Exception as e:
            logger.warning(f'GIS plots: dist info error: {e}')

        # Total approved farmers per barangay (for percentage denominator)
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
        try:
            area_by_brgy = {}
            seen_area_farmers = set()
            for entry in DistributionEntry.objects.filter(
                batch__status='APPROVED'
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

        try:
            # Unique farmers being monitored (regardless of seed source)
            monitored_farmer_ids = set(
                CropMonitoringRecord.objects
                .values_list('farmer_id', flat=True)
                .distinct()
            )
            total_monitored = len(monitored_farmer_ids)
        except Exception as e:
            logger.error(f'GIS summary: monitored error: {e}')
            monitored_farmer_ids = set()
            total_monitored = 0

        try:
            total_approved = User.objects.filter(
                role='FARMER', status='APPROVED', is_active=True
            ).count()
        except Exception as e:
            logger.error(f'GIS summary: approved error: {e}')
            total_approved = 0

        try:
            active_barangays = list(
                CropMonitoringRecord.objects
                .values_list('barangay', flat=True)
                .distinct().order_by('barangay')
            )
            active_barangays = [b for b in active_barangays if b]
        except Exception as e:
            logger.error(f'GIS summary: active brgy error: {e}')
            active_barangays = []

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
            for rec in CropMonitoringRecord.objects.order_by(
                'farmer_id', 'seed_source', '-date_observed'
            ):
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
        except Exception as e:
            logger.error(f'GIS summary: seed breakdown error: {e}')
            seed_breakdown = {}

        return Response({
            'current_farmers':          total_monitored,
            'total_approved_farmers':   total_approved,
            'current_active_barangays': len(active_barangays),
            'total_active_barangays':   len(all_barangays),
            'total_farmers':            total_monitored,
            'total_plots':              total_monitored,
            'barangays':                active_barangays,
            'all_barangays':            all_barangays,
            'seed_breakdown':           seed_breakdown,
            'last_updated':             timezone.now().isoformat(),
        })


class GISBarangaysView(APIView):
    """
    GET /api/gis/barangays/
    All barangays with approved farmers for the filter dropdown.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            barangays = list(
                User.objects.filter(
                    role='FARMER', status='APPROVED', is_active=True
                ).values_list('barangay', flat=True)
                .distinct().order_by('barangay')
            )
            return Response([b for b in barangays if b])
        except Exception as e:
            logger.error(f'GIS barangays error: {e}')
            return Response([])