import datetime
from collections import Counter, defaultdict
from decimal import Decimal

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, Count, Q

from apps.accounts.permissions import IsAdminUserRole
from apps.crop_monitoring.models import CropMonitoringRecord
from apps.production.models import HarvestRecord
from apps.distribution.models import DistributionEntry
from apps.seed_poll.models import Poll
from apps.accounts.models import User

# ── Constants ────────────────────────────────────────────────────────────────

PHASE_ORDER = [
    'DISTRIBUTION', 'ESTABLISHMENT', 'TILLERING',
    'FLOWERING', 'RIPENING', 'HARVESTING',
]
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
    SEEDING_DENSITY = settings.SEEDING_DENSITY
except Exception:
    STANDARD_YIELDS = {'HYBRID': 5000, 'INBRED': 3500, 'OWN_SEED': 2000}
    SEEDING_DENSITY = {'HYBRID': 15,   'INBRED': 20,   'OWN_SEED': 80}


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_active_poll(poll_id=None):
    if poll_id:
        try:
            return Poll.objects.get(id=poll_id)
        except Poll.DoesNotExist:
            pass
    return (
        Poll.objects.filter(status='OPEN').order_by('-created_at').first()
        or Poll.objects.order_by('-created_at').first()
    )


def dry_weight_kg(record):
    bags    = float(record.harvest_bags or 0)
    raw_kg  = bags * 50
    if getattr(record, 'weight_type', 'FRESH') == 'DRIED':
        return raw_kg
    moisture = float(getattr(record, 'moisture_content_pct', 12) or 12)
    return raw_kg * (1 - moisture / 100)


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
    if pct > 100:
        return 'Exceeded Target'
    if pct >= 80:
        return 'Achieved Target'
    if pct >= 70:
        return 'Near Target'
    if pct >= 50:
        return 'Below Target'
    return 'Critical'


def get_latest_per_farmer(qs):
    seen = {}
    for rec in qs.order_by('farmer_id', 'seed_source', '-date_observed', '-encoded_at'):
        key = (rec.farmer_id, rec.seed_source)
        if key not in seen:
            seen[key] = rec
    return seen


def filter_harvest_by_poll(qs, poll, distributed_farmer_ids=None):
    """Poll-direct filter. Mas accurate kaysa date-range."""
    if not poll:
        return qs
    qs = qs.filter(poll=poll)
    if distributed_farmer_ids is not None:
        qs = qs.filter(farmer_id__in=distributed_farmer_ids)
    return qs


# ── Main View ─────────────────────────────────────────────────────────────────

class AdminDashboardAnalyticsView(APIView):
    """
    GET /api/analytics/dashboard/?poll_id=&seed_type=
    Single endpoint for Admin Dashboard analytics.
    Pulls from crop_monitoring + production apps.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        poll_id     = request.query_params.get('poll_id')
        seed_filter = request.query_params.get('seed_type', '').upper()

        poll   = get_active_poll(poll_id)
        season = poll.season if poll else 'WET'
        yr     = poll.year   if poll else datetime.date.today().year

        # ── Base querysets ────────────────────────────────────
        monitoring_qs = CropMonitoringRecord.objects.select_related('farmer').all()
        if poll:
            monitoring_qs = monitoring_qs.filter(poll=poll)
        if seed_filter and seed_filter in SEED_LABELS:
            monitoring_qs = monitoring_qs.filter(seed_source=seed_filter)

        harvest_qs = HarvestRecord.objects.select_related('farmer').all()
        harvest_qs = filter_harvest_by_poll(harvest_qs, poll)
        if seed_filter and seed_filter in SEED_LABELS:
            harvest_qs = harvest_qs.filter(seed_source=seed_filter)

        latest_map     = get_latest_per_farmer(monitoring_qs)
        latest_records = list(latest_map.values())
        harvest_list   = list(harvest_qs)

        # ── SECTION 1: KPI Cards ──────────────────────────────
        dist_qs = DistributionEntry.objects.filter(batch__status='APPROVED', date_received__isnull=False)
        if poll:
            dist_qs = dist_qs.filter(batch__event__season=poll.season, batch__event__year=poll.year)
        if seed_filter == 'HYBRID':
            dist_qs = dist_qs.filter(batch__event__seed_type__name__icontains='hybrid')
        elif seed_filter == 'INBRED':
            dist_qs = dist_qs.filter(batch__event__seed_type__name__icontains='inbred')

        distributed_ids  = set(dist_qs.values_list('farmer_id', flat=True))
        monitored_ids    = set(r.farmer_id for r in latest_records)
        all_farmer_ids   = monitored_ids | distributed_ids
        total_farmers    = len(all_farmer_ids)

        total_area = float(
            dist_qs.aggregate(s=Sum('farm_area_ha'))['s'] or 0
        )
        barangays_covered = dist_qs.values('farmer__barangay').distinct().count()

        # ── Scoped pipeline counts — filtered by current poll only ──
        pipeline_dist_qs = DistributionEntry.objects.filter(
            batch__status='APPROVED',
            date_received__isnull=False,
        )
        if poll:
            pipeline_dist_qs = pipeline_dist_qs.filter(
                batch__event__season=poll.season,
                batch__event__year=poll.year,
            )
        pipeline_distributed_ids = set(pipeline_dist_qs.values_list('farmer_id', flat=True))
        pipeline_monitored_ids   = set(r.farmer_id for r in latest_records)
        pipeline_harvested_ids   = set(r.farmer_id for r in harvest_list)

        pipeline_total_dist    = len(pipeline_distributed_ids)
        pipeline_total_monitor = len(pipeline_monitored_ids)
        pipeline_total_harvest = len(pipeline_harvested_ids)

        total_dry_kg   = sum(dry_weight_kg(r) for r in harvest_list)
        total_mt       = total_dry_kg / 1000
        total_harvest_area = sum(float(r.harvest_area_ha or 0) for r in harvest_list)

        util_values = [utilization_pct(r) for r in harvest_list]
        util_values = [v for v in util_values if v is not None]
        avg_util    = (sum(util_values) / len(util_values)) if util_values else None

        kpi = {
            'total_farmers':         total_farmers,
            'area_covered_ha':       round(total_area, 2),
            'barangays_covered':     barangays_covered,
            'total_production_mt':   round(total_mt, 2),
            'avg_utilization_pct':   round(avg_util, 1) if avg_util is not None else None,
            'utilization_tier':      get_tier_label(avg_util),
            'total_harvest_records': len(harvest_list),
        }

        # ── SECTION 2: Utilization by Barangay ───────────────
        brgy_harvest_groups = defaultdict(list)
        for r in harvest_list:
            brgy = getattr(r.farmer, 'barangay', None) or r.barangay or 'Unknown'
            brgy_harvest_groups[brgy].append(r)

        utilization_by_barangay = []
        for brgy, records in sorted(brgy_harvest_groups.items()):
            u_vals = [utilization_pct(r) for r in records]
            u_vals = [v for v in u_vals if v is not None]
            avg_u  = (sum(u_vals) / len(u_vals)) if u_vals else None
            total_prod = sum(dry_weight_kg(r) for r in records) / 1000
            utilization_by_barangay.append({
                'barangay':        brgy,
                'farmer_count':    len(records),
                'utilization_pct': round(avg_u, 1) if avg_u is not None else None,
                'tier':            get_tier_label(avg_u),
                'production_mt':   round(total_prod, 2),
            })
        utilization_by_barangay.sort(key=lambda x: x['utilization_pct'] or 0, reverse=True)

        # ── SECTION 3: Farmers by Seed Type (Donut) ──────────
        seed_farmer_counts = {}
        for src in ['HYBRID', 'INBRED', 'OWN_SEED']:
            if seed_filter and seed_filter != src:
                seed_farmer_counts[src] = 0
                continue
            src_ids = set(r.farmer_id for r in latest_records if r.seed_source == src)
            # also count from distribution
            dist_src = dist_qs
            if src == 'HYBRID':
                dist_src = DistributionEntry.objects.filter(
                    batch__status='APPROVED', date_received__isnull=False,
                    batch__event__seed_type__name__icontains='hybrid'
                )
            elif src == 'INBRED':
                dist_src = DistributionEntry.objects.filter(
                    batch__status='APPROVED', date_received__isnull=False,
                    batch__event__seed_type__name__icontains='inbred'
                )
            else:
                dist_src = DistributionEntry.objects.none()
            if poll and src != 'OWN_SEED':
                dist_src = dist_src.filter(batch__event__season=poll.season, batch__event__year=poll.year)
            dist_src_ids = set(dist_src.values_list('farmer_id', flat=True))
            seed_farmer_counts[src] = len(src_ids | dist_src_ids)

        farmers_by_seed = [
            {'seed_source': src, 'label': SEED_LABELS[src], 'count': seed_farmer_counts[src]}
            for src in ['HYBRID', 'INBRED', 'OWN_SEED']
        ]

        # ── SECTION 4: Yield by Seed Type ────────────────────
        yield_by_seed = []
        for src in ['HYBRID', 'INBRED', 'OWN_SEED']:
            group = [r for r in harvest_list if r.seed_source == src]
            if not group:
                yield_by_seed.append({
                    'seed_source': src, 'label': SEED_LABELS[src],
                    'actual_yield_t_ha': 0, 'target_yield_t_ha': STANDARD_YIELDS.get(src, 2000) / 1000,
                    'farmer_count': 0, 'total_mt': 0,
                })
                continue
            area     = sum(float(r.harvest_area_ha or 0) for r in group)
            dry_kg   = sum(dry_weight_kg(r) for r in group)
            total_mt_src = dry_kg / 1000
            avg_yield_tha = (total_mt_src / area) if area > 0 else 0
            yield_by_seed.append({
                'seed_source':      src,
                'label':            SEED_LABELS[src],
                'actual_yield_t_ha': round(avg_yield_tha, 2),
                'target_yield_t_ha': round(STANDARD_YIELDS.get(src, 2000) / 1000, 2),
                'farmer_count':     len(group),
                'total_mt':         round(total_mt_src, 2),
            })

        # ── SECTION 5: Crop Phase Distribution ───────────────
        phase_counts = Counter(r.crop_phase for r in latest_records)

        # Farmers na naka-distribute pero wala pang CropMonitoringRecord
        # ay considered nasa DISTRIBUTION phase pa rin
        monitored_farmer_ids = set(r.farmer_id for r in latest_records)
        distribution_only_count = len(distributed_ids - monitored_farmer_ids)

        phase_distribution = []
        for ph in PHASE_ORDER:
            if ph == 'DISTRIBUTION':
                # CropMonitoring DISTRIBUTION records + distribution-only farmers
                farmers = phase_counts.get('DISTRIBUTION', 0) + distribution_only_count
            else:
                farmers = phase_counts.get(ph, 0)
            phase_distribution.append({
                'phase':   ph,
                'label':   PHASE_DISPLAY[ph],
                'farmers': farmers,
            })

        # ── SECTION 6: Delay Analytics ────────────────────────
        delayed_records = [r for r in latest_records if r.phase_status == 'DELAYED']
        delayed_farmers = len(set(r.farmer_id for r in delayed_records))
        delay_rate      = round((delayed_farmers / total_farmers * 100), 1) if total_farmers > 0 else 0

        delay_by_phase = []
        for ph in PHASE_ORDER:
            ph_records  = [r for r in latest_records if r.crop_phase == ph]
            ph_delayed  = [r for r in ph_records  if r.phase_status == 'DELAYED']
            delay_by_phase.append({
                'phase':   ph,
                'label':   PHASE_DISPLAY[ph],
                'total':   len(set(r.farmer_id for r in ph_records)),
                'delayed': len(set(r.farmer_id for r in ph_delayed)),
            })

        delay_analytics = {
            'delayed_farmers': delayed_farmers,
            'delay_rate_pct':  delay_rate,
            'by_phase':        delay_by_phase,
        }

        # ── SECTION 7: Damage Analytics ───────────────────────
        damaged_records = [r for r in latest_records if r.phase_status == 'DAMAGED' and r.damage_cause]
        cause_counts    = Counter(r.damage_cause.strip().title() for r in damaged_records)
        total_damage    = sum(cause_counts.values())
        cause_of_damage = sorted([
            {'cause': k, 'count': v, 'pct': round(v / total_damage * 100, 1) if total_damage > 0 else 0}
            for k, v in cause_counts.items()
        ], key=lambda x: -x['count'])

        # ── SECTION 8: Production Ranking by Barangay ─────────
        production_ranking = sorted(
            utilization_by_barangay,
            key=lambda x: x['production_mt'],
            reverse=True
        )

        # ── SECTION 9: Data Pipeline Status ───────────────────
        total_beneficiaries = len(distributed_ids)
        total_monitored     = len(monitored_ids)
        total_harvested     = len(set(r.farmer_id for r in harvest_list))

        pipeline = {
            'beneficiaries': {
                'count': pipeline_total_dist,
                'label': 'Distributed',
            },
            'monitored': {
                'count': pipeline_total_monitor,
                'total': pipeline_total_dist,
                'pct':   round(pipeline_total_monitor / pipeline_total_dist * 100, 1) if pipeline_total_dist > 0 else 0,
                'label': 'Monitored',
            },
            'harvested': {
                'count': pipeline_total_harvest,
                'total': pipeline_total_monitor,
                'pct':   round(pipeline_total_harvest / pipeline_total_monitor * 100, 1) if pipeline_total_monitor > 0 else 0,
                'label': 'Harvest Encoded',
            },
        }

        # ── SECTION 10: Alerts ─────────────────────────────────
        critical_farmers = [r for r in harvest_list if (utilization_pct(r) or 0) < 50]
        attention_list   = []
        seen_att         = set()
        for r in sorted(latest_records, key=lambda x: x.date_observed, reverse=True):
            if r.phase_status not in ('DELAYED', 'DAMAGED'):
                continue
            key = (r.farmer_id, r.seed_source)
            if key in seen_att:
                continue
            seen_att.add(key)
            attention_list.append({
                'farmer_name':   r.farmer.get_full_name(),
                'barangay':      r.barangay,
                'seed_label':    SEED_LABELS.get(r.seed_source, r.seed_source),
                'phase':         PHASE_DISPLAY.get(r.crop_phase, r.crop_phase),
                'status':        r.phase_status,
                'damage_cause':  r.damage_cause or '',
                'delay_days':    r.delay_days or 0,
            })

        alerts = {
            'critical_yield_count': len(critical_farmers),
            'delayed_count':        delayed_farmers,
            'damaged_count':        len(set(r.farmer_id for r in damaged_records)),
            'attention_list':       attention_list[:10],
        }

        # ── SECTION 11: Executive Insights ────────────────────
        dominant_phase = phase_counts.most_common(1)[0][0] if phase_counts else None
        top_brgy_prod  = production_ranking[0] if production_ranking else None
        top_damage     = cause_of_damage[0]    if cause_of_damage    else None
        best_seed      = max(yield_by_seed, key=lambda x: x['actual_yield_t_ha']) if yield_by_seed else None

        insights = []
        if dominant_phase:
            insights.append(f"{PHASE_DISPLAY[dominant_phase]} is currently the most active crop phase with {phase_counts[dominant_phase]} farmers.")
        if best_seed and best_seed['actual_yield_t_ha'] > 0:
            insights.append(f"{best_seed['label']} seeds lead in average yield at {best_seed['actual_yield_t_ha']} t/ha.")
        if top_damage:
            insights.append(f"{top_damage['cause']} accounts for {top_damage['pct']}% of all reported damage incidents.")
        if alerts['critical_yield_count'] > 0:
            insights.append(f"{alerts['critical_yield_count']} farmers are operating below 50% yield utilization.")
        if total_mt > 0:
            completion_pct = round(total_mt / ((total_area * STANDARD_YIELDS.get('HYBRID', 5000) / 1000) or 1) * 100, 1)
            insights.append(f"Production achievement stands at {round(avg_util, 1) if avg_util else 0}% of seasonal target.")
        if top_brgy_prod:
            insights.append(f"{top_brgy_prod['barangay']} ranks first in production with {top_brgy_prod['production_mt']} MT.")
        if pipeline['monitored']['pct'] < 100:
            insights.append(f"Monitoring coverage is at {pipeline['monitored']['pct']}% of distributed farmers.")

        # ── Poll list for dropdown ─────────────────────────────
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
                'id':     poll.id     if poll else None,
                'season': season,
                'year':   yr,
                'status': poll.status if poll else None,
                'label':  f"{'Wet' if season == 'WET' else 'Dry'} Season {yr}" if poll else '—',
            },
            'poll_list':               poll_list,
            'kpi':                     kpi,
            'utilization_by_barangay': utilization_by_barangay,
            'farmers_by_seed':         farmers_by_seed,
            'yield_by_seed':           yield_by_seed,
            'phase_distribution':      phase_distribution,
            'delay_analytics':         delay_analytics,
            'cause_of_damage':         cause_of_damage,
            'production_ranking':      production_ranking,
            'pipeline':                pipeline,
            'alerts':                  alerts,
            'insights':                insights,
        })