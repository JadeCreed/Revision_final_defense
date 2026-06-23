import datetime
from collections import Counter, defaultdict

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q

from apps.accounts.permissions import IsAdminUserRole
from apps.crop_monitoring.models import CropMonitoringRecord
from apps.production.models import HarvestRecord
from apps.distribution.models import DistributionEntry
from apps.seed_poll.models import Poll
from apps.accounts.models import User ,FarmerProfile  


PHASE_ORDER = ['DISTRIBUTION', 'ESTABLISHMENT', 'TILLERING', 'FLOWERING', 'RIPENING', 'HARVESTING']
PHASE_DISPLAY = {
    'DISTRIBUTION':  'Seed Distribution',
    'ESTABLISHMENT': 'Crop Establishment',
    'TILLERING':     'Tillering',
    'FLOWERING':     'Flowering',
    'RIPENING':      'Ripening',
    'HARVESTING':    'Harvesting',
}
SEED_LABELS = {
    'HYBRID':   'Hybrid',
    'INBRED':   'Inbred',
    'OWN_SEED': 'Own Seed',
}

try:
    from django.conf import settings
    STANDARD_YIELDS = settings.STANDARD_YIELDS
except Exception:
    STANDARD_YIELDS = {'HYBRID': 5000, 'INBRED': 3500, 'OWN_SEED': 2000}


def get_active_poll(poll_id=None):
    if poll_id:
        try:
            return Poll.objects.get(id=poll_id)
        except Poll.DoesNotExist:
            pass
    from apps.seed_poll.utils import get_current_poll
    return get_current_poll()


def dry_weight_kg(record):
    """Simple: 1 bag = 50 kg. No moisture adjustment. Consistent with production/views.py."""
    return float(record.harvest_bags or 0) * 50


def utilization_pct(record):
    area     = float(record.harvest_area_ha or 0)
    src      = record.seed_source or 'OWN_SEED'
    standard = STANDARD_YIELDS.get(src, 2000)
    expected = area * standard
    if expected == 0:
        return None
    return (dry_weight_kg(record) / expected) * 100


def get_tier_label(pct):
    if pct is None:
        return 'N/A'
    if pct > 100: return 'Exceeded Target'
    if pct >= 80:  return 'Achieved Target'
    if pct >= 70:  return 'Near Target'
    if pct >= 50:  return 'Below Target'
    return 'Critical'


def get_latest_per_farmer(qs):
    seen = {}
    for rec in qs.order_by('farmer_id', 'seed_source', '-date_observed', '-encoded_at'):
        key = (rec.farmer_id, rec.seed_source)
        if key not in seen:
            seen[key] = rec
    return seen


class AdminDashboardAnalyticsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        poll_id     = request.query_params.get('poll_id')
        seed_filter = request.query_params.get('seed_type', '').upper()

        poll   = get_active_poll(poll_id)
        season = poll.season if poll else 'WET'
        yr     = poll.year   if poll else datetime.date.today().year

        # ── Monitoring queryset (latest per farmer) ───────────
        monitoring_qs = CropMonitoringRecord.objects.select_related('farmer').all()
        if poll:
            monitoring_qs = monitoring_qs.filter(poll=poll)
        if seed_filter and seed_filter in SEED_LABELS:
            monitoring_qs = monitoring_qs.filter(seed_source=seed_filter)

        latest_map     = get_latest_per_farmer(monitoring_qs)
        latest_records = list(latest_map.values())

        # ── ALL monitoring records (for historical delay analytics) ──
        # Using ALL records (not latest) so we capture every delay event per phase
        all_monitoring_qs = CropMonitoringRecord.objects.select_related('farmer').all()
        if poll:
            all_monitoring_qs = all_monitoring_qs.filter(poll=poll)
        if seed_filter and seed_filter in SEED_LABELS:
            all_monitoring_qs = all_monitoring_qs.filter(seed_source=seed_filter)
        all_records = list(all_monitoring_qs)

        # ── Harvest queryset ──────────────────────────────────
        harvest_qs = HarvestRecord.objects.select_related('farmer').all()
        if poll:
            harvest_qs = harvest_qs.filter(poll=poll)
        if seed_filter and seed_filter in SEED_LABELS:
            harvest_qs = harvest_qs.filter(seed_source=seed_filter)
        harvest_list = list(harvest_qs)

        # ── Distribution base ─────────────────────────────────
        dist_qs = DistributionEntry.objects.filter(
            batch__status='APPROVED',
            date_received__isnull=False,
        )
        if poll:
            dist_qs = dist_qs.filter(batch__event__season=poll.season, batch__event__year=poll.year)
        if seed_filter == 'HYBRID':
            dist_qs = dist_qs.filter(batch__event__seed_type__name__icontains='hybrid')
        elif seed_filter == 'INBRED':
            dist_qs = dist_qs.filter(batch__event__seed_type__name__icontains='inbred')

        distributed_ids = set(dist_qs.values_list('farmer_id', flat=True))
        monitored_ids   = set(r.farmer_id for r in latest_records)
        harvested_ids   = set(r.farmer_id for r in harvest_list)
        total_farmers   = User.objects.filter(role='FARMER', status='APPROVED', is_active=True).count()

        
        # Kunin ang lahat ng approved at active farmers sa system
        approved_farmers = User.objects.filter(
            role='FARMER',
            status='APPROVED',
            is_active=True
        )

        # Kwentahin ang kabuuang hektarya mula sa profiles ng mga approved farmers
        total_hectares_all = FarmerProfile.objects.filter(
            user__in=approved_farmers
        ).aggregate(total=Sum('hectares'))['total'] or 0
        total_area = float(total_hectares_all)

        # Bilangin ang mga natatanging barangay ng mga approved farmers
        barangays_covered = approved_farmers.exclude(
            Q(barangay='') | Q(barangay__isnull=True)
        ).values_list('barangay', flat=True).distinct().count()


        # ── KPI — production ──────────────────────────────────
        total_dry_kg = sum(dry_weight_kg(r) for r in harvest_list)
        total_mt     = total_dry_kg / 1000
        util_values  = [utilization_pct(r) for r in harvest_list]
        util_values  = [v for v in util_values if v is not None]
        avg_util     = (sum(util_values) / len(util_values)) if util_values else None

        harvest_completion_pct = round(
            len(harvested_ids) / total_farmers * 100, 1
        ) if total_farmers > 0 else 0

        delayed_farmer_ids  = set(r.farmer_id for r in latest_records if r.phase_status == 'DELAYED')
        damaged_farmer_ids  = set(r.farmer_id for r in latest_records if r.phase_status == 'DAMAGED')
        critical_farmer_ids = set(r.farmer_id for r in harvest_list if (utilization_pct(r) or 0) < 50)
        attention_ids       = delayed_farmer_ids | damaged_farmer_ids | critical_farmer_ids

        kpi = {
            'total_farmers':               total_farmers,
            'area_covered_ha':             round(total_area, 2),
            'barangays_covered':           barangays_covered,
            'total_production_mt':         round(total_mt, 2),
            'avg_utilization_pct':         round(avg_util, 1) if avg_util is not None else None,
            'utilization_tier':            get_tier_label(avg_util),
            'total_harvest_records':       len(harvest_list),
            'harvest_completion_pct':      harvest_completion_pct,
            'farmers_requiring_attention': len(attention_ids),
        }

        # ── Farm Health Summary (normal/delayed/damaged) ──────
        # normal_count  = len(set(r.farmer_id for r in latest_records if r.phase_status == 'NORMAL'))
        # delayed_count = len(delayed_farmer_ids)
        # damaged_count = len(damaged_farmer_ids)
        # farm_health   = {
        #     'normal':             normal_count,
        #     'delayed':            delayed_count,
        #     'damaged':            damaged_count,
        #     'monitoring_records': normal_count + delayed_count + damaged_count,
        #     'registered_farmers': total_farmers,
        # }


        # ── Farm Health Summary (normal/delayed/damaged) ──────
        # I-grupo ang status kada farmer gamit ang Worst-Case Priority (DAMAGED > DELAYED > NORMAL)
        farmer_status = {}
        for r in latest_records:
            fid = r.farmer_id
            st  = r.phase_status or 'NORMAL'
            if fid not in farmer_status:
                farmer_status[fid] = st
            else:
                prev = farmer_status[fid]
                if st == 'DAMAGED' or prev == 'DAMAGED':
                    farmer_status[fid] = 'DAMAGED'
                elif st == 'DELAYED' or prev == 'DELAYED':
                    farmer_status[fid] = 'DELAYED'

        normal_count  = sum(1 for status in farmer_status.values() if status == 'NORMAL')
        delayed_count = sum(1 for status in farmer_status.values() if status == 'DELAYED')
        damaged_count = sum(1 for status in farmer_status.values() if status == 'DAMAGED')

        # Ang kabuuang natatanging magsasaka na may monitoring record ngayong season (eksaktong 9)
        unique_monitored_farmers = len(farmer_status)

        farm_health   = {
            'normal':             normal_count,
            'delayed':            delayed_count,
            'damaged':            damaged_count,
            'monitoring_records': unique_monitored_farmers,
            'registered_farmers': total_farmers,
        }


        # ── Top Damage Causes ─────────────────────────────────
        damaged_records = [r for r in latest_records if r.phase_status == 'DAMAGED' and r.damage_cause]
        cause_counts    = Counter(r.damage_cause.strip().title() for r in damaged_records)
        total_damage    = sum(cause_counts.values())
        cause_of_damage = sorted([
            {'cause': k, 'count': v, 'pct': round(v / total_damage * 100, 1) if total_damage > 0 else 0}
            for k, v in cause_counts.items()
        ], key=lambda x: -x['count'])[:10]

        # ── Production by Barangay ────────────────────────────
        brgy_harvest_groups = defaultdict(list)
        for r in harvest_list:
            brgy = getattr(r.farmer, 'barangay', None) or r.barangay or 'Unknown'
            brgy_harvest_groups[brgy].append(r)

        production_by_barangay = []
        for brgy, records in sorted(brgy_harvest_groups.items()):
            total_prod = sum(dry_weight_kg(r) for r in records) / 1000
            u_vals = [utilization_pct(r) for r in records]
            u_vals = [v for v in u_vals if v is not None]
            avg_u  = (sum(u_vals) / len(u_vals)) if u_vals else None
            production_by_barangay.append({
                'barangay':        brgy,
                'farmer_count':    len(records),
                'production_mt':   round(total_prod, 2),
                'utilization_pct': round(avg_u, 1) if avg_u is not None else None,
                'tier':            get_tier_label(avg_u),
            })
        production_by_barangay.sort(key=lambda x: x['production_mt'], reverse=True)

        # ── DELAY ANALYTICS BY PHASE (historical — all records) ──
        # Uses ALL records so we capture every delay event per phase,
        # even if the farmer has since moved to a later phase with normal status
        delay_by_phase = []
        for ph in PHASE_ORDER:
            # All records for this phase (historical)
            ph_all_records = [r for r in all_records if r.crop_phase == ph]
            # Unique farmers in this phase (historical)
            ph_farmer_ids  = set(r.farmer_id for r in ph_all_records)
            # Farmers who experienced delay in this phase (may have recovered)
            ph_delayed_ids = set(r.farmer_id for r in ph_all_records if r.phase_status == 'DELAYED')

            # Per-farmer names for detailed list
            delayed_details = []
            seen_delayed = set()
            for r in sorted(ph_all_records, key=lambda x: x.date_observed, reverse=True):
                if r.phase_status == 'DELAYED' and r.farmer_id not in seen_delayed:
                    seen_delayed.add(r.farmer_id)
                    delayed_details.append({
                        'farmer_name':   r.farmer.get_full_name(),
                        'barangay':      r.barangay or '',
                        'seed_source':   r.seed_source,
                        'delay_days':    r.delay_days or 0,
                        'date_observed': r.date_observed.isoformat(),
                    })

            delay_by_phase.append({
                'phase':           ph,
                'label':           PHASE_DISPLAY[ph],
                'total_farmers':   len(ph_farmer_ids),
                'delayed_farmers': len(ph_delayed_ids),
                'delayed_details': delayed_details[:10],  # top 10 for display
                'delay_rate_pct':  round(len(ph_delayed_ids) / len(ph_farmer_ids) * 100, 1) if ph_farmer_ids else 0,
            })

        delay_analytics = {
            'delayed_farmers': delayed_count,
            'delay_rate_pct':  round(delayed_count / total_farmers * 100, 1) if total_farmers > 0 else 0,
            'by_phase':        delay_by_phase,
        }

        # ── Alerts ────────────────────────────────────────────
        seen_att       = set()
        attention_list = []
        for r in sorted(latest_records, key=lambda x: x.date_observed, reverse=True):
            if r.phase_status not in ('DELAYED', 'DAMAGED'):
                continue
            key = (r.farmer_id, r.seed_source)
            if key in seen_att:
                continue
            seen_att.add(key)
            attention_list.append({
                'farmer_name':  r.farmer.get_full_name(),
                'barangay':     r.barangay,
                'seed_label':   SEED_LABELS.get(r.seed_source, r.seed_source),
                'phase':        PHASE_DISPLAY.get(r.crop_phase, r.crop_phase),
                'status':       r.phase_status,
                'damage_cause': r.damage_cause or '',
                'delay_days':   r.delay_days or 0,
            })

        # Isama ang critical yield farmers sa listahan bago ibigay ang response
        for r in harvest_list:
            if r.farmer_id in critical_farmer_ids:
                attention_list.append({
                    'farmer_name':  r.farmer.get_full_name(),
                    'barangay':     getattr(r.farmer, 'barangay', '') or r.barangay or '',
                    'seed_label':   SEED_LABELS.get(r.seed_source, r.seed_source),
                    'phase':        'Harvesting (Yield)',
                    'status':       'CRITICAL',
                    'damage_cause': 'Critical Yield (<50%)',
                    'delay_days':   0,
                })

        alerts = {
            'critical_yield_count': len(critical_farmer_ids),
            'delayed_count':        delayed_count,
            'damaged_count':        damaged_count,
            'attention_required':   len(attention_ids),
            'attention_list':       attention_list[:10],
        }


        # ── Executive Insights ────────────────────────────────
        phase_counts   = Counter(r.crop_phase for r in latest_records)
        dominant_phase = phase_counts.most_common(1)[0][0] if phase_counts else None
        top_brgy_prod  = production_by_barangay[0] if production_by_barangay else None
        top_damage     = cause_of_damage[0] if cause_of_damage else None

        insights = []
        if total_farmers > 0:
            if dominant_phase:
                insights.append(
                    f"{PHASE_DISPLAY[dominant_phase]} is currently the most active crop phase "
                    f"with {phase_counts[dominant_phase]} farmers."
                )
            if len(harvested_ids) > 0:
                insights.append(
                    f"Harvest completion rate is at {harvest_completion_pct}% "
                    f"({len(harvested_ids)} of {total_farmers} farmers)."
                )
            if top_damage:
                insights.append(
                    f"{top_damage['cause']} accounts for {top_damage['pct']}% "
                    f"of all reported damage incidents."
                )
            if len(critical_farmer_ids) > 0:
                insights.append(
                    f"{len(critical_farmer_ids)} farmers are operating below 50% yield utilization."
                )
            if top_brgy_prod and top_brgy_prod['production_mt'] > 0:
                insights.append(
                    f"{top_brgy_prod['barangay']} ranks first in production "
                    f"with {top_brgy_prod['production_mt']} MT."
                )
            if delayed_count > 0:
                insights.append(
                    f"{delayed_count} farmers currently have delayed crop phase status."
                )
            if avg_util is not None:
                insights.append(
                    f"Overall production achievement is at {round(avg_util, 1)}% — "
                    f"{get_tier_label(avg_util)}."
                )
            if len(monitored_ids) > 0 and len(distributed_ids) > 0:
                monitoring_pct = round(len(monitored_ids) / len(distributed_ids) * 100, 1)
                insights.append(
                    f"Monitoring coverage is at {monitoring_pct}% of distributed farmers "
                    f"({len(monitored_ids)} of {len(distributed_ids)})."
                )

        poll_list = [
            {
                'id':     p['id'],
                'label':  f"{'Wet' if p['season'] == 'WET' else 'Dry'} Season {p['year']}",
                'season': p['season'],
                'year':   p['year'],
                'status': p['status'],
            }
            for p in Poll.objects.order_by('-created_at').values('id', 'season', 'year', 'status')
        ]

        return Response({
            'poll': {
                'id':     poll.id if poll else None,
                'season': season,
                'year':   yr,
                'status': poll.status if poll else None,
                'label':  f"{'Wet' if season == 'WET' else 'Dry'} Season {yr}" if poll else '—',
            },
            'poll_list':              poll_list,
            'kpi':                    kpi,
            'farm_health':            farm_health,
            'cause_of_damage':        cause_of_damage,
            'production_by_barangay': production_by_barangay,
            'delay_analytics':        delay_analytics,
            'alerts':                 alerts,
            'insights':               insights,
        })