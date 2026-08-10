# apps/production/views.py  — add these views to your existing file

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.conf import settings
from django.db.models import Avg, Sum, Count, Q, F
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from decimal import Decimal

from apps.accounts.permissions import IsAdminUserRole, IsBPUser
from .models import HarvestRecord
from .serializers import HarvestRecordSerializer
from apps.seed_poll.utils import get_current_poll, get_encoding_poll

# DA official constants — kept in shared settings for consistency
SEEDING_DENSITY    = settings.SEEDING_DENSITY
STANDARD_YIELD_KG  = settings.STANDARD_YIELDS
SEED_LABELS        = {
    'HYBRID':   'Hybrid seeds',
    'INBRED':   'Certified seeds',
    'OWN_SEED': 'Farmer saved seeds',
}


def harvest_kg(record):
    """Simple: 1 bag = 50 kg. No moisture adjustment."""
    return float(record.harvest_bags or 0) * 50


def utilization_pct(record):
    """Utilization = (actual kg / expected kg) × 100."""
    area     = float(record.harvest_area_ha or 0)
    src      = record.seed_source or 'OWN_SEED'
    standard = STANDARD_YIELD_KG.get(src, 2000)
    expected = area * standard
    if expected == 0:
        return None
    return (harvest_kg(record) / expected) * 100


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


class ProductionSummaryView(APIView):
    """
    GET /api/production/summary/
    Overall metrics across all barangays and seed types.
    Admin only.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        records = HarvestRecord.objects.filter(is_deleted=False) \
            if hasattr(HarvestRecord, 'is_deleted') \
            else HarvestRecord.objects.all()

        total_farmers = records.count()
        total_area    = float(records.aggregate(s=Sum('harvest_area_ha'))['s'] or 0)

        total_kg      = sum(harvest_kg(r) for r in records)
        total_mt      = total_kg / 1000
        avg_yield     = (total_mt / total_area) if total_area > 0 else 0

        util_values   = [utilization_pct(r) for r in records]
        util_values   = [v for v in util_values if v is not None]
        overall_util  = (sum(util_values) / len(util_values)) if util_values else None

        return Response({
            'total_farmers':          total_farmers,
            'total_area_ha':          round(total_area, 2),
            'total_production_mt':    round(total_mt, 2),
            'avg_yield_t_ha':         round(avg_yield, 2),
            'overall_utilization_pct': round(overall_util, 1) if overall_util else None,
            'overall_tier':           get_tier_label(overall_util),
        })


class ProductionBySeedTypeView(APIView):
    """
    GET /api/production/by-seed-type/
    Metrics grouped by seed source with top 3 performers each.
    Admin only.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        all_records = HarvestRecord.objects.select_related('farmer').all()
        result      = []

        for src in ['HYBRID', 'INBRED', 'OWN_SEED']:
            group   = [r for r in all_records if r.seed_source == src]
            if not group:
                result.append({
                    'seed_source': src,
                    'label': SEED_LABELS[src],
                    'farmer_count': 0,
                    'total_area_ha': 0,
                    'total_production_mt': 0,
                    'avg_yield_t_ha': 0,
                    'avg_utilization_pct': None,
                    'top_performers': [],
                })
                continue

            total_area = sum(float(r.harvest_area_ha or 0) for r in group)
            total_kg   = sum(harvest_kg(r) for r in group)
            total_mt   = total_kg / 1000
            avg_yield  = (total_mt / total_area) if total_area > 0 else 0

            util_vals  = [utilization_pct(r) for r in group]
            util_vals  = [v for v in util_vals if v is not None]
            avg_util   = (sum(util_vals) / len(util_vals)) if util_vals else None

            # Top 3 performers by utilization
            performers = sorted(
                [{'record': r, 'util': utilization_pct(r)} for r in group if utilization_pct(r) is not None],
                key=lambda x: x['util'], reverse=True
            )[:3]

            top = []
            for p in performers:
                r = p['record']
                name = f"{r.farmer.last_name}, {r.farmer.first_name}" \
                    if hasattr(r, 'farmer') and r.farmer else str(r.farmer_id)
                top.append({
                    'farmer_name':     name,
                    'barangay':        getattr(r.farmer, 'barangay', '') if hasattr(r, 'farmer') else '',
                    'variety':         r.variety or '',
                    'utilization_pct': round(p['util'], 1),
                    'tier':            get_tier_label(p['util']),
                })

            result.append({
                'seed_source':         src,
                'label':               SEED_LABELS[src],
                'farmer_count':        len(group),
                'total_area_ha':       round(total_area, 2),
                'total_production_mt': round(total_mt, 2),
                'avg_yield_t_ha':      round(avg_yield, 2),
                'avg_utilization_pct': round(avg_util, 1) if avg_util is not None else None,
                'avg_tier':            get_tier_label(avg_util),
                'top_performers':      top,
            })

        return Response(result)


class ProductionByBarangayView(APIView):
    """
    GET /api/production/by-barangay/
    Metrics grouped by barangay (from farmer.barangay).
    Admin only.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        all_records = HarvestRecord.objects.select_related('farmer').all()

        # Group by barangay
        groups = {}
        for r in all_records:
            brgy = getattr(r.farmer, 'barangay', None) or 'Unknown'
            if brgy not in groups:
                groups[brgy] = []
            groups[brgy].append(r)

        result = []
        for brgy, records in sorted(groups.items()):
            total_area = sum(float(r.harvest_area_ha or 0) for r in records)
            total_kg   = sum(harvest_kg(r) for r in records)
            total_mt   = total_kg / 1000
            avg_yield  = (total_mt / total_area) if total_area > 0 else 0

            util_vals = [utilization_pct(r) for r in records]
            util_vals = [v for v in util_vals if v is not None]
            avg_util  = (sum(util_vals) / len(util_vals)) if util_vals else None

            result.append({
                'barangay':            brgy,
                'farmer_count':        len(records),
                'total_area_ha':       round(total_area, 2),
                'total_production_mt': round(total_mt, 2),
                'avg_yield_t_ha':      round(avg_yield, 2),
                'avg_utilization_pct': round(avg_util, 1) if avg_util is not None else None,
                'tier':                get_tier_label(avg_util),
            })

        return Response(result)


class ProductionLowPerformersView(APIView):
    """
    GET /api/production/low-performers/?threshold=100
    Farmers whose utilization is below the given threshold.
    Admin only.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        threshold = float(request.query_params.get('threshold', 100))
        all_records = HarvestRecord.objects.select_related('farmer').all()

        result = []
        for r in all_records:
            util = utilization_pct(r)
            if util is None or util >= threshold:
                continue

            area     = float(r.harvest_area_ha or 0)
            src      = r.seed_source or 'OWN_SEED'
            standard = STANDARD_YIELD_KG.get(src, 2000)
            expected = area * standard
            actual   = harvest_kg(r)
            gap      = expected - actual

            farmer = r.farmer
            name   = f"{farmer.last_name}, {farmer.first_name}" \
                if farmer else str(r.farmer_id)

            result.append({
                'farmer_name':     name,
                'barangay':        getattr(farmer, 'barangay', '') if farmer else '',
                'seed_source':     src,
                'variety':         r.variety or '',
                'utilization_pct': round(util, 1),
                'tier':            get_tier_label(util),
                'expected_kg':     round(expected, 0),
                'actual_kg':       round(actual, 0),
                'gap_kg':          round(gap, 0),
                'harvest_date':    str(r.harvest_date) if r.harvest_date else None,
            })

        # Sort by worst performing first
        result.sort(key=lambda x: x['utilization_pct'])
        return Response(result)


class ProductionGISSummaryView(APIView):
    """
    GET /api/production/gis-summary/
    Per-barangay data structured for the GIS utilization map.
    Returns polygon color, tier, and key metrics per barangay.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    GIS_COLORS = {
        'Exceeded Target': '#166534',
        'Achieved Target': '#15803d',
        'Near Target':     '#0369a1',
        'Below Target':    '#b45309',
        'Critical':        '#b91c1c',
        'N/A':             '#1E293B',
    }

    def get(self, request):
        all_records = HarvestRecord.objects.select_related('farmer').all()

        groups = {}
        for r in all_records:
            brgy = getattr(r.farmer, 'barangay', None) or 'Unknown'
            if brgy not in groups:
                groups[brgy] = []
            groups[brgy].append(r)

        result = []
        for brgy, records in groups.items():
            total_area = sum(float(r.harvest_area_ha or 0) for r in records)
            total_kg   = sum(harvest_kg(r) for r in records)
            total_mt   = total_kg / 1000
            avg_yield  = (total_mt / total_area) if total_area > 0 else 0

            util_vals = [utilization_pct(r) for r in records]
            util_vals = [v for v in util_vals if v is not None]
            avg_util  = (sum(util_vals) / len(util_vals)) if util_vals else None
            tier      = get_tier_label(avg_util)

            result.append({
                'barangay':            brgy,
                'farmer_count':        len(records),
                'total_area_ha':       round(total_area, 2),
                'total_production_mt': round(total_mt, 2),
                'avg_yield_t_ha':      round(avg_yield, 2),
                'avg_utilization_pct': round(avg_util, 1) if avg_util is not None else None,
                'tier':                tier,
                'color':               self.GIS_COLORS.get(tier, '#1E293B'),
            })

        return Response(result)


class SeedProductivityView(APIView):
    """
    GET /api/production/seed-productivity/
    Per-farmer seed productivity analytics.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    SEED_BAG_KG = {
        'HYBRID': 15,
        'INBRED': 20,
    }

    def get(self, request):
        poll_id = request.query_params.get('poll_id')
        qs = HarvestRecord.objects.select_related('farmer').exclude(seed_source='OWN_SEED')

        if poll_id:
            try:
                poll = Poll.objects.get(id=poll_id)
                if poll.season == 'WET':
                    qs = qs.filter(
                        harvest_date__year=poll.year,
                        harvest_date__month__gte=6,
                        harvest_date__month__lte=10,
                    )
                elif poll.season == 'DRY':
                    qs = qs.filter(
                        Q(harvest_date__year=poll.year - 1, harvest_date__month__gte=11) |
                        Q(harvest_date__year=poll.year, harvest_date__month__lte=5)
                    )
            except Poll.DoesNotExist:
                pass

        result = []
        for r in qs:
            util = utilization_pct(r)
            if util is None:
                continue

            # Actual seed received from Distribution menu
            bags_received = float(r.seed_bags_received or 0)
            kg_per_bag = self.SEED_BAG_KG.get(r.seed_source, 0)
            seed_distributed = bags_received * kg_per_bag

            # Skip if there is no actual distribution data
            if seed_distributed == 0:
                continue

            productive_equiv = seed_distributed * (util / 100)
            yield_gap_equiv = max(0, seed_distributed - productive_equiv)

            area = float(r.harvest_area_ha or 0)

            farmer = r.farmer
            name = f"{farmer.last_name}, {farmer.first_name}" if farmer else str(r.farmer_id)

            result.append({
                'harvest_id': r.id,
                'farmer_name': name,
                'barangay': getattr(farmer, 'barangay', '') if farmer else '',
                'seed_source': r.seed_source,
                'seed_label': SEED_LABELS.get(r.seed_source, r.seed_source),
                'area_ha': round(area, 2),
                'seed_distributed_kg': round(seed_distributed, 2),
                'productive_equiv_kg': round(productive_equiv, 2),
                'yield_gap_equiv_kg': round(yield_gap_equiv, 2),
                'utilization_pct': round(util, 1),
                'tier': get_tier_label(util),
            })

        result.sort(key=lambda x: x['yield_gap_equiv_kg'], reverse=True)
        return Response(result)

 


# ═══════════════════════════════════════════════════════════════════════════
# ── report menu of brgy president  ──
# ═══════════════════════════════════════════════════════════════════════════
def _build_brgy_report_data(user, poll_id=None):
    barangay = getattr(user, 'barangay', None)
    if not barangay:
        return {'error': 'No barangay assigned.'}

    try:
        from apps.seed_poll.models import Poll
        if poll_id:
            poll = Poll.objects.get(id=poll_id)
        else:
            poll = get_current_poll()
    except Exception:
        poll = None

    poll_info = None
    if poll:
        poll_info = {
            'id': poll.id,
            'season': poll.season,
            'season_display': poll.get_season_display(),
            'year': poll.year,
            'status': poll.status,
        }

    # ── HARVEST RECORDS scoped to barangay + poll ──────────────────
    qs = HarvestRecord.objects.filter(barangay=barangay).select_related('farmer')
    if poll:
        qs = qs.filter(poll=poll)

    harvest_records = list(qs)

    total_farmers = len(set(r.farmer_id for r in harvest_records))
    total_area    = sum(float(r.harvest_area_ha or 0) for r in harvest_records)
    total_bags    = sum(float(r.harvest_bags or 0) for r in harvest_records)
    total_kg      = total_bags * 50
    total_mt      = total_kg / 1000
    avg_yield     = (total_mt / total_area) if total_area > 0 else 0

    util_vals = [utilization_pct(r) for r in harvest_records]
    util_vals = [v for v in util_vals if v is not None]
    avg_util  = sum(util_vals) / len(util_vals) if util_vals else None

    # ── DISTRIBUTION: beneficiaries & bags scoped to poll ──────────
    from apps.distribution.models import DistributionEntry
    dist_filter = dict(
        batch__status='APPROVED',
        farmer__barangay=barangay,
    )
    if poll:
        dist_filter['batch__event__season'] = poll.season
        dist_filter['batch__event__year']   = poll.year

    dist_entries = DistributionEntry.objects.filter(**dist_filter).select_related(
        'farmer', 'batch__event__seed_type'
    )

    # Unique beneficiaries
    total_beneficiaries = len(set(e.farmer_id for e in dist_entries))

    # Bags received per seed type
    hybrid_bags = inbred_bags = 0
    hybrid_kg_total = inbred_kg_total = 0
    for e in dist_entries:
        seed_name = (getattr(e.batch.event.seed_type, 'name', '') or '').upper()
        bags = int(e.qty_bags or 0)
        if 'HYBRID' in seed_name:
            hybrid_bags      += bags
            hybrid_kg_total  += bags * 15
        elif 'INBRED' in seed_name:
            inbred_bags      += bags
            inbred_kg_total  += bags * 20

    total_dist_bags = hybrid_bags + inbred_bags
    total_dist_kg   = hybrid_kg_total + inbred_kg_total

    # ── BY SEED TYPE ───────────────────────────────────────────────
    by_seed_type = []
    for src in ['HYBRID', 'INBRED', 'OWN_SEED']:
        group  = [r for r in harvest_records if r.seed_source == src]
        area   = sum(float(r.harvest_area_ha or 0) for r in group)
        mt     = sum((float(r.harvest_bags or 0) * 50) / 1000 for r in group)
        u_vals = [utilization_pct(r) for r in group]
        u_vals = [v for v in u_vals if v is not None]
        avg_u  = sum(u_vals) / len(u_vals) if u_vals else None

        # expected vs actual kg for this seed type
        exp_kg_total = sum(
            float(r.harvest_area_ha or 0) * STANDARD_YIELD_KG.get(src, 2000)
            for r in group
        )
        act_kg_total = sum(harvest_kg(r) for r in group)

        # seed distribution for this group (from dist_entries)
        if src == 'HYBRID':
            s_bags = hybrid_bags; s_kg = hybrid_kg_total
        elif src == 'INBRED':
            s_bags = inbred_bags; s_kg = inbred_kg_total
        else:
            s_bags = 0; s_kg = 0

        prod_equiv = s_kg * ((avg_u or 0) / 100) if s_kg > 0 else 0
        yield_gap  = max(0, s_kg - prod_equiv)

        by_seed_type.append({
            'seed_source':         src,
            'label':               SEED_LABELS.get(src, src),
            'farmer_count':        len(set(r.farmer_id for r in group)),
            'total_area_ha':       round(area, 2),
            'total_mt':            round(mt, 2),
            'avg_yield_t_ha':      round(mt / area, 2) if area > 0 else 0,
            'avg_util_pct':        round(avg_u, 1) if avg_u is not None else None,
            'tier':                get_tier_label(avg_u),
            'expected_kg':         round(exp_kg_total, 0),
            'actual_kg':           round(act_kg_total, 0),
            'seed_bags_received':  s_bags,
            'seed_kg_received':    s_kg,
            'prod_seed_equiv_kg':  round(prod_equiv, 2),
            'yield_gap_equiv_kg':  round(yield_gap, 2),
        })

    # ── CROP PHASE (poll-scoped) ───────────────────────────────────
    from apps.crop_monitoring.models import CropMonitoringRecord
    phase_qs = CropMonitoringRecord.objects.filter(barangay=barangay)
    if poll:
        phase_qs = phase_qs.filter(poll=poll)

    phase_counts  = {}
    delayed_count = damaged_count = 0
    for rec in phase_qs:
        phase = rec.crop_phase or 'Unknown'
        phase_counts[phase] = phase_counts.get(phase, 0) + 1
        st = (getattr(rec, 'phase_status', '') or '').upper()
        if st == 'DELAYED':  delayed_count += 1
        if st == 'DAMAGED':  damaged_count += 1

    # ── SEED PRODUCTIVITY (per farmer) ────────────────────────────
    seed_productivity = []
    for r in harvest_records:
        if r.seed_source == 'OWN_SEED':
            continue
        util = utilization_pct(r)
        if util is None:
            continue
        bags_recv = float(r.seed_bags_received or 0)
        kg_per_bag = {'HYBRID': 15, 'INBRED': 20}.get(r.seed_source, 0)
        s_dist = bags_recv * kg_per_bag
        if s_dist == 0:
            continue
        prod_eq  = s_dist * (util / 100)
        yield_gap = max(0, s_dist - prod_eq)
        farmer   = r.farmer
        name     = f"{farmer.last_name}, {farmer.first_name}" if farmer else str(r.farmer_id)
        seed_productivity.append({
            'farmer_name':         name,
            'seed_source':         r.seed_source,
            'seed_label':          SEED_LABELS.get(r.seed_source, r.seed_source),
            'seed_distributed_kg': round(s_dist, 2),
            'prod_seed_equiv_kg':  round(prod_eq, 2),
            'yield_gap_equiv_kg':  round(yield_gap, 2),
            'utilization_pct':     round(util, 1),
            'tier':                get_tier_label(util),
        })
    seed_productivity.sort(key=lambda x: x['yield_gap_equiv_kg'], reverse=True)

    # ── HARVEST PERFORMANCE: expected vs actual per farmer ─────────
    harvest_performance = []
    for r in harvest_records:
        area     = float(r.harvest_area_ha or 0)
        src      = r.seed_source or 'OWN_SEED'
        standard = STANDARD_YIELD_KG.get(src, 2000)
        exp_kg   = area * standard
        act_kg   = harvest_kg(r)
        util     = utilization_pct(r)
        farmer   = r.farmer
        name     = f"{farmer.last_name}, {farmer.first_name}" if farmer else str(r.farmer_id)
        harvest_performance.append({
            'farmer_name':     name,
            'seed_source':     src,
            'seed_label':      SEED_LABELS.get(src, src),
            'area_ha':         round(area, 2),
            'expected_kg':     round(exp_kg, 0),
            'actual_kg':       round(act_kg, 0),
            'utilization_pct': round(util, 1) if util is not None else None,
            'tier':            get_tier_label(util),
        })

    # ── INSIGHTS ──────────────────────────────────────────────────
    insights = []
    if total_farmers > 0:
        insights.append(f"{total_farmers} farmer{'s' if total_farmers != 1 else ''} have harvest data in Barangay {barangay}.")
    if total_beneficiaries > 0:
        insights.append(f"{total_beneficiaries} farmer{'s' if total_beneficiaries != 1 else ''} received seed distribution — {total_dist_bags} bags ({total_dist_kg:,} kg total).")
    if avg_util is not None:
        insights.append(f"Overall yield achievement is {round(avg_util, 1)}% — {get_tier_label(avg_util)}.")
    if total_mt > 0:
        insights.append(f"Total production reached {round(total_mt, 2)} MT with an average yield of {round(avg_yield, 2)} t/ha.")
    best_seed = max(by_seed_type, key=lambda x: x['avg_yield_t_ha'] or 0, default=None)
    if best_seed and best_seed['avg_yield_t_ha'] > 0:
        insights.append(f"{best_seed['label']} recorded the highest average yield at {best_seed['avg_yield_t_ha']} t/ha.")
    total_gap = sum(s['yield_gap_equiv_kg'] for s in by_seed_type)
    if total_gap > 0:
        insights.append(f"Potential unrealized productivity equivalent: {round(total_gap, 1)} kg.")
    if delayed_count > 0:
        insights.append(f"{delayed_count} crop monitoring record{'s' if delayed_count != 1 else ''} flagged as delayed.")
    if damaged_count > 0:
        insights.append(f"{damaged_count} crop monitoring record{'s' if damaged_count != 1 else ''} flagged as damaged.")

    return {
        'poll_info':    poll_info,
        'barangay':     barangay,
        'summary': {
            'total_farmers':       total_farmers,
            'total_beneficiaries': total_beneficiaries,
            'total_dist_bags':     total_dist_bags,
            'total_dist_kg':       total_dist_kg,
            'hybrid_bags':         hybrid_bags,
            'hybrid_kg':           hybrid_kg_total,
            'inbred_bags':         inbred_bags,
            'inbred_kg':           inbred_kg_total,
            'total_area_ha':       round(total_area, 2),
            'total_production_mt': round(total_mt, 2),
            'avg_yield_t_ha':      round(avg_yield, 2),
            'avg_util_pct':        round(avg_util, 1) if avg_util is not None else None,
            'overall_tier':        get_tier_label(avg_util),
        },
        'by_seed_type':        by_seed_type,
        'seed_productivity':   seed_productivity,
        'harvest_performance': harvest_performance,
        'crop_phase_summary': {
            'phase_counts':    phase_counts,
            'delayed_count':   delayed_count,
            'damaged_count':   damaged_count,
            'total_monitored': sum(phase_counts.values()),
        },
        'insights': insights,
    }

class BrgyReportDataView(APIView):
    """
    GET /api/production/brgy-report/
    Returns report analytics for BRGY users.
    """
    permission_classes = [IsAuthenticated, IsBPUser]

    def get(self, request):
        data = _build_brgy_report_data(request.user, request.query_params.get('poll_id'))
        if 'error' in data:
            return Response({'error': data['error']}, status=400)
        return Response(data)


class BrgyReportPDFView(APIView):
    permission_classes = [IsAuthenticated, IsBPUser]

    def post(self, request):
        try:
            from xhtml2pdf import pisa
        except ImportError:
            return Response({'error': 'xhtml2pdf is not installed.'}, status=500)

        from io import BytesIO
        import base64, os
        from django.conf import settings

        poll_id     = request.data.get('poll_id')
        charts      = request.data.get('charts', {}) or {}
        report_data = _build_brgy_report_data(request.user, poll_id)
        if 'error' in report_data:
            return Response({'error': report_data['error']}, status=400)

        poll_info    = report_data.get('poll_info', {})
        summary      = report_data.get('summary', {})
        by_seed      = report_data.get('by_seed_type', [])
        harvest_perf = report_data.get('harvest_performance', [])
        crop_phase   = report_data.get('crop_phase_summary', {})
        insights     = report_data.get('insights', [])
        barangay     = report_data.get('barangay', '')
        season_label = (
            f"{poll_info.get('season_display', '')} {poll_info.get('year', '')}"
            if poll_info else 'All Seasons'
        )
        
        brgy_president_name = f"{request.user.first_name} {request.user.last_name}".strip() or 'Barangay President'  # noqa
        brgy_president_role = f"Barangay President, Brgy. {barangay}"  # noqa

        logo_b64 = ''
        logo_paths = [
            os.path.join(settings.BASE_DIR, '..', 'frontend', 'src', 'assets', 'logo.png'),
            os.path.join(settings.BASE_DIR, 'static', 'logo.png'),
        ]
        for lp in logo_paths:
            try:
                with open(os.path.abspath(lp), 'rb') as f:
                    logo_b64 = base64.b64encode(f.read()).decode('utf-8')
                break
            except Exception:
                pass

        # ── Seed type rows (split bags/kg into separate columns) ──
        seed_rows_html = ''
        for s in by_seed:
            if s['farmer_count'] == 0:
                continue
            tier_color = {
                'Exceeded Target': '#166534', 'Achieved Target': '#15803d',
                'Near Target': '#0369a1',     'Below Target': '#b45309',
                'Critical': '#b91c1c',
            }.get(s['tier'], '#64748b')
            util_str = f"{s['avg_util_pct']}%" if s['avg_util_pct'] is not None else '—'
            seed_rows_html += f"""
            <tr>
              <td class="left">{s['label']}</td>
              <td>{s['farmer_count']}</td>
              <td>{s['seed_bags_received']:,}</td>
              <td>{s['seed_kg_received']:,} kg</td>
              <td>{s['total_area_ha']} ha</td>
              <td>{s['expected_kg']:,.0f}</td>
              <td style="font-weight:bold">{s['actual_kg']:,.0f}</td>
              <td style="font-weight:bold;color:{tier_color}">{util_str}</td>
              <td style="color:{tier_color};font-weight:bold">{s['tier']}</td>
            </tr>"""

        # ── Chart images ──────────────────────────────────────────
        def chart_img(key):
            data = charts.get(key, '')
            if not data:
                return ''
            return f'<img src="data:image/png;base64,{data}" style="width:100%;height:auto;" />'

        # ── Harvest performance rows (top 15) ─────────────────────
        perf_rows_html = ''
        for i, p in enumerate(harvest_perf[:15]):
            bg = '#f8fafc' if i % 2 == 0 else 'white'
            tier_color = {
                'Exceeded Target': '#166534', 'Achieved Target': '#15803d',
                'Near Target': '#0369a1',     'Below Target': '#b45309',
                'Critical': '#b91c1c',
            }.get(p['tier'], '#64748b')
            util_str = f"{p['utilization_pct']}%" if p['utilization_pct'] is not None else '—'
            perf_rows_html += f"""
            <tr style="background:{bg}">
              <td>{p['farmer_name']}</td>
              <td style="text-align:center">{p['seed_label']}</td>
              <td style="text-align:center">{p['area_ha']} ha</td>
              <td style="text-align:center">{p['expected_kg']:,.0f} kg</td>
              <td style="text-align:center;font-weight:bold">{p['actual_kg']:,.0f} kg</td>
              <td style="text-align:center;font-weight:bold;color:{tier_color}">{util_str}</td>
              <td style="text-align:center;color:{tier_color};font-size:7pt;font-weight:bold">{p['tier']}</td>
            </tr>"""

        # ── Crop phase rows ────────────────────────────────────────
        phase_display = {
            'DISTRIBUTION': 'Seed Distribution', 'ESTABLISHMENT': 'Crop Establishment',
            'TILLERING': 'Tillering',             'FLOWERING': 'Flowering',
            'RIPENING': 'Ripening',               'HARVESTING': 'Harvesting',
        }
        phase_rows_html = ''
        for ph, cnt in crop_phase.get('phase_counts', {}).items():
            phase_rows_html += f"""
            <tr>
              <td>{phase_display.get(ph, ph)}</td>
              <td style="text-align:center">{cnt}</td>
            </tr>"""

        # ── Insights ──────────────────────────────────────────────
        insights_html = ''.join(
            f'<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px;">'
            f'<span style="min-width:6px;height:6px;width:6px;border-radius:50%;background:#166534;display:inline-block;margin-top:4px;"></span>'
            f'<span style="font-size:8.5pt;color:#374151">{ins}</span></div>'
            for ins in insights
        )

        # ── Bar chart HTML (production by seed type — inline, no canvas needed) ──
        seed_chart_bars = ''
        max_mt = max((s['total_mt'] for s in by_seed if s['farmer_count'] > 0), default=1) or 1
        seed_colors = {'HYBRID': '#1a4d1a', 'INBRED': '#2563eb', 'OWN_SEED': '#b45309'}
        for s in by_seed:
            if s['farmer_count'] == 0:
                continue
            bar_w = max(2, round(s['total_mt'] / max_mt * 100))
            color = seed_colors.get(s['seed_source'], '#64748b')
            seed_chart_bars += f"""
            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="font-size:8pt;font-weight:600;color:#374151">{s['label']}</span>
                <span style="font-size:8pt;font-weight:700;color:#0f172a">{s['total_mt']} MT</span>
              </div>
              <div style="height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
                <div style="height:100%;width:{bar_w}%;background:{color};border-radius:99px;"></div>
              </div>
              <div style="font-size:7pt;color:#94a3b8;margin-top:2px">{s['farmer_count']} farmers · {s['tier']}</div>
            </div>"""

        # ── Achievement bar chart ──────────────────────────────────
        achieve_bars = ''
        for s in by_seed:
            if s['farmer_count'] == 0 or s['avg_util_pct'] is None:
                continue
            bar_w   = min(100, max(2, round(s['avg_util_pct'])))
            color   = seed_colors.get(s['seed_source'], '#64748b')
            achieve_bars += f"""
            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="font-size:8pt;font-weight:600;color:#374151">{s['label']}</span>
                <span style="font-size:8pt;font-weight:700;color:{color}">{s['avg_util_pct']}%</span>
              </div>
              <div style="height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
                <div style="height:100%;width:{bar_w}%;background:{color};border-radius:99px;"></div>
              </div>
            </div>"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page {{ size: A4; margin: 15mm 14mm; }}
  body {{ font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #111827; margin:0; padding:0; }}

  /* ── HEADER (centered) ── */
  .header {{ text-align:center; padding-bottom:12px; border-bottom:2.5px solid #166534; margin-bottom:12px; }}
  .header-logo {{ margin-bottom:6px; }}
  .header-agency {{ font-size:7.5pt; color:#166534; font-weight:bold; text-transform:uppercase; margin-top:4px; }}
  .header-title  {{ font-size:14pt; font-weight:bold; color:#0f172a; line-height:1.3; margin:4px 0; }}
  .header-sub    {{ font-size:8pt; color:#475569; margin-top:3px; line-height:1.6; }}
  .season-badge  {{ display:inline-block; padding:3px 12px; border-radius:999px; background:#f0fdf4; border:1.5px solid #86efac; color:#166534; font-size:8pt; font-weight:bold; margin-top:6px; }}

  /* ── SECTION TITLES ── */
  .sec-title {{ font-size:8pt; font-weight:bold; color:#166534; text-transform:uppercase; margin:14px 0 6px; padding-bottom:3px; border-bottom:1.5px solid #166534; }}

  /* ── KPI GRID (horizontal tiles using table) ── */
  .kpi-table {{ width:100%; border-collapse:collapse; margin-bottom:12px; }}
  .kpi-table td {{ width:16.6%; padding:8px 4px; border:1px solid #e2e8f0; background:#f8fafc; text-align:center; vertical-align:middle; }}
  .kpi-label {{ font-size:6pt; color:#94a3b8; text-transform:uppercase; font-weight:bold; display:block; }}
  .kpi-value {{ font-size:14pt; font-weight:800; color:#14532d; display:block; line-height:1.1; margin-top:2px; }}
  .kpi-sub   {{ font-size:6pt; color:#64748b; display:block; margin-top:1px; }}

  /* ── PRODUCTION ANALYTICS (side by side bars) ── */
  .analytics-row {{ width:100%; border-collapse:collapse; margin-bottom:12px; }}
  .analytics-cell {{ width:50%; padding:10px 12px; border:1px solid #e2e8f0; background:white; vertical-align:top; }}
  .chart-title {{ font-size:8pt; font-weight:bold; color:#0f172a; margin-bottom:3px; }}
  .chart-sub   {{ font-size:6.5pt; color:#94a3b8; margin-bottom:8px; display:block; }}

  /* bar chart rows */
  .bar-label {{ font-size:7.5pt; font-weight:600; color:#374151; }}
  .bar-value {{ font-size:7.5pt; font-weight:700; color:#0f172a; }}
  .bar-track {{ height:9px; background:#f1f5f9; border-radius:99px; overflow:hidden; margin:3px 0 1px; }}
  .bar-fill  {{ height:100%; border-radius:99px; }}
  .bar-sub   {{ font-size:6.5pt; color:#94a3b8; }}

  /* ── TABLES ── */
  table.data-table {{ width:100%; border-collapse:collapse; font-size:7.5pt; margin-bottom:10px; }}
  table.data-table th {{ background:#14532d; color:white; padding:5px 6px; font-size:7pt; text-transform:uppercase; text-align:center; white-space:nowrap; }}
  table.data-table td {{ padding:5px 6px; border-bottom:1px solid #f1f5f9; color:#374151; vertical-align:middle; text-align:center; }}
  table.data-table td.left {{ text-align:left; }}
  table.data-table tr:nth-child(even) td {{ background:#f8fafc; }}

  /* ── REMARKS TILES (horizontal) ── */
  .remarks-row {{ width:100%; border-collapse:collapse; margin-bottom:10px; }}
  .remarks-cell {{ width:33.3%; padding:10px 8px; text-align:center; vertical-align:middle; }}
  .remarks-val {{ font-size:22pt; font-weight:800; line-height:1; display:block; }}
  .remarks-lbl {{ font-size:6.5pt; font-weight:bold; text-transform:uppercase; display:block; margin-top:3px; }}

  /* ── INSIGHTS ── */
  .insights-box {{ background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; margin-top:8px; }}
  .insights-title {{ font-size:7.5pt; font-weight:bold; color:#475569; text-transform:uppercase; margin-bottom:7px; }}
  .insight-row {{ display:block; margin-bottom:4px; font-size:8.5pt; color:#374151; line-height:1.5; }}

  /* ── SIGNATORIES (3-column table) ── */
  .sig-table {{ width:100%; border-collapse:collapse; margin-top:20px; padding-top:10px; border-top:1px solid #e2e8f0; }}
  .sig-table td {{ width:33.3%; text-align:center; vertical-align:bottom; padding:0 8px; }}
  .sig-space {{ height:32px; display:block; }}
  .sig-name  {{ font-size:8.5pt; font-weight:bold; text-decoration:underline; display:block; }}
  .sig-role  {{ font-size:7pt; color:#64748b; display:block; margin-top:2px; }}
</style>
</head>
<body>

<!-- ══ HEADER (CENTERED) ══════════════════════════════════════ -->
<div class="header">
  <div class="header-logo">
    {f'<img src="data:image/png;base64,{logo_b64}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;" />' if logo_b64 else 'MAO'}
  </div>
  <div class="header-agency">Municipal Agriculture Office &mdash; Lucban, Quezon</div>
  <div class="header-title">Barangay {barangay} &mdash; Agricultural Season Report</div>
  <div class="header-sub">Rice Program Management System (AGRICE)</div>
  <div class="header-sub">Prepared by: <strong>{brgy_president_name}</strong></div>
  <div class="header-sub">{brgy_president_role}</div>
  <span class="season-badge">{season_label}</span>
</div>

<!-- ══ KPI TILES (HORIZONTAL) ══════════════════════════════════ -->
<div class="sec-title">Summary Overview</div>
<table class="kpi-table">
  <tr>
    <td>
      <span class="kpi-label">Farmers Harvested</span>
      <span class="kpi-value">{summary.get('total_farmers', 0)}</span>
      <span class="kpi-sub">With harvest records</span>
    </td>
    <td>
      <span class="kpi-label">Beneficiaries</span>
      <span class="kpi-value">{summary.get('total_beneficiaries', 0)}</span>
      <span class="kpi-sub">Seed recipients</span>
    </td>
    <td>
      <span class="kpi-label">Bags Received</span>
      <span class="kpi-value">{summary.get('total_dist_bags', 0)}</span>
      <span class="kpi-sub">{summary.get('total_dist_kg', 0):,} kg total</span>
    </td>
    <td>
      <span class="kpi-label">Total Production</span>
      <span class="kpi-value">{summary.get('total_production_mt', 0)} MT</span>
      <span class="kpi-sub">All seed types</span>
    </td>
    <td>
      <span class="kpi-label">Avg Yield</span>
      <span class="kpi-value">{summary.get('avg_yield_t_ha', 0)} t/ha</span>
      <span class="kpi-sub">Per hectare</span>
    </td>
    <td>
      <span class="kpi-label">Achievement</span>
      <span class="kpi-value" style="color:{'#166534' if (summary.get('avg_util_pct') or 0) >= 80 else '#b45309'}">{summary.get('avg_util_pct', '—')}{'%' if summary.get('avg_util_pct') is not None else ''}</span>
      <span class="kpi-sub">{summary.get('overall_tier', 'N/A')}</span>
    </td>
  </tr>
</table>

<!-- ══ PRODUCTION ANALYTICS (SIDE BY SIDE) ══════════════════════ -->
<div class="sec-title">Production Analytics</div>
<table class="analytics-row">
  <tr>
    <td class="analytics-cell">
      <div class="chart-title">Production by Seed Type (MT)</div>
      <span class="chart-sub">Total harvest output per seed program</span>
      {seed_chart_bars if seed_chart_bars else '<p style="color:#94a3b8;font-size:8pt;text-align:center">No harvest data yet.</p>'}
    </td>
    <td class="analytics-cell">
      <div class="chart-title">Yield Achievement by Seed Type (%)</div>
      <span class="chart-sub">Achievement rate vs DA target yield</span>
      {achieve_bars if achieve_bars else '<p style="color:#94a3b8;font-size:8pt;text-align:center">No harvest data yet.</p>'}
    </td>
  </tr>
</table>

<!-- ══ SEED PROGRAM ANALYTICS TABLE ══════════════════════════════ -->
<div class="sec-title">Seed Program Analytics</div>
<table class="data-table">
  <thead>
    <tr>
      <th style="text-align:left">Seed Type</th>
      <th>Farmers</th>
      <th>Bags Received</th>
      <th>Kg Received</th>
      <th>Area (ha)</th>
      <th>Expected (kg)</th>
      <th>Actual (kg)</th>
      <th>Achievement</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {seed_rows_html if seed_rows_html else '<tr><td colspan="9" style="text-align:center;color:#94a3b8">No data available.</td></tr>'}
  </tbody>
</table>

<!-- ══ HARVEST PERFORMANCE TABLE ═════════════════════════════════ -->
<div class="sec-title">Harvest Performance (Expected vs Actual)</div>
<table class="data-table">
  <thead>
    <tr>
      <th style="text-align:left">Farmer</th>
      <th>Seed Type</th>
      <th>Area (ha)</th>
      <th>Expected (kg)</th>
      <th>Actual (kg)</th>
      <th>Achievement</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {perf_rows_html if perf_rows_html else '<tr><td colspan="7" style="text-align:center;color:#94a3b8">No harvest records yet.</td></tr>'}
  </tbody>
</table>

<!-- ══ CROP PHASE MONITORING ═════════════════════════════════════ -->
<div class="sec-title">Crop Phase Monitoring</div>
<table class="data-table" style="margin-top:6px;margin-bottom:0; width:100%;">
  <thead>
    <tr>
      <th style="text-align:left">Crop Phase</th>
      <th>Farmers</th>
    </tr>
  </thead>
  <tbody>
    {phase_rows_html if phase_rows_html else '<tr><td colspan="2" style="color:#94a3b8;text-align:center">No monitoring data.</td></tr>'}
  </tbody>
</table>
<div style="margin-top:12px;">
  <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center;margin-bottom:8px;">
    <div style="font-size:22pt;font-weight:800;color:#b45309">{crop_phase.get('delayed_count', 0)}</div>
    <div style="font-size:7pt;font-weight:bold;color:#b45309;">Delayed</div>
  </div>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center;margin-bottom:8px;">
    <div style="font-size:22pt;font-weight:800;color:#b91c1c">{crop_phase.get('damaged_count', 0)}</div>
    <div style="font-size:7pt;font-weight:bold;color:#b91c1c;">Damaged</div>
  </div>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
    <div style="font-size:22pt;font-weight:800;color:#166534">{crop_phase.get('total_monitored', 0)}</div>
    <div style="font-size:7pt;font-weight:bold;color:#166534;">Total Monitored</div>
  </div>
</div>

<!-- ══ KEY INSIGHTS ══════════════════════════════════════════════ -->
<div class="insights-box">
  <div class="insights-title">Key Insights</div>
  {insights_html if insights_html else '<p style="color:#94a3b8;font-size:8pt">No insights yet.</p>'}
</div>

<!-- ══ SIGNATORIES (LEFT · CENTER · RIGHT) ═══════════════════════ -->
<table class="sig-table">
  <tr>
    <td style="text-align:left">
      <span class="sig-space"></span>
      <span class="sig-name">RANDY F. LEONIDO</span>
      <span class="sig-role">Agricultural Technician</span>
    </td>
    <td style="text-align:center">
      <span class="sig-space"></span>
      <span class="sig-name">{brgy_president_name}</span>
      <span class="sig-role">Noted by &nbsp;&middot;&nbsp; Barangay President, Brgy. {barangay}</span>
    </td>
    <td style="text-align:right">
      <span class="sig-space"></span>
      <span class="sig-name">JOANNA LYNN P. GONZALES</span>
      <span class="sig-role">OIC Municipal Agriculturist</span>
    </td>
  </tr>
</table>

</body>
</html>"""

        buffer = BytesIO()
        error_buffer = BytesIO()
        try:
            pisa_status = pisa.CreatePDF(
                html_content, dest=buffer, err=error_buffer
            )
        except Exception as exc:
            import traceback
            return Response({
                'error': 'PDF generation failed.',
                'detail': str(exc),
                'traceback': traceback.format_exc(),
            }, status=500)

        if pisa_status.err:
            error_buffer.seek(0)
            return Response({
                'error': 'PDF generation failed.',
                'pisa_errors': pisa_status.err,
                'pisa_log': error_buffer.read().decode('utf-8', errors='ignore'),
            }, status=500)

        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        safe_brgy = barangay.replace(' ', '_')
        season_slug = (poll_info.get('season_display') or 'Season').replace(' ', '')
        year_slug   = poll_info.get('year', '')
        response['Content-Disposition'] = (
            f'attachment; filename="BrgyReport_{safe_brgy}_{season_slug}{year_slug}.pdf"'
        )
        return response

# ═══════════════════════════════════════════════════════════════════════════
# ── HARVEST RECORD CRUD VIEWS ──
# ═══════════════════════════════════════════════════════════════════════════

class HarvestRecordListCreateView(ListCreateAPIView):
    """
    GET  /api/production/harvest/ — List harvest records (BRGY sees only their records)
    POST /api/production/harvest/ — Create new harvest record
    """
    serializer_class = HarvestRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = HarvestRecord.objects.none()

        if user.role == 'BRGY':
            qs = HarvestRecord.objects.filter(barangay=user.barangay).select_related('farmer', 'encoded_by')
        elif user.role == 'ADMIN':
            qs = HarvestRecord.objects.all().select_related('farmer', 'encoded_by')
        else:
            return qs

        poll_id = self.request.query_params.get('poll_id')
        if poll_id:
            try:
                from apps.seed_poll.models import Poll
                poll = Poll.objects.get(id=poll_id)
                qs = qs.filter(poll=poll)
            except Poll.DoesNotExist:
                pass
        else:
            # Default: active poll only
            active_poll = get_current_poll()
            if active_poll:
                qs = qs.filter(poll=active_poll)

        return qs

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError

        user = self.request.user
        barangay = getattr(user, 'barangay', 'Unknown')

        farmer_id = serializer.validated_data.get('farmer').id
        seed_source = serializer.validated_data.get('seed_source')

        # Get encoding-enabled poll (encoding gate)
        active_poll = get_encoding_poll()
        if not active_poll:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'encoding_blocked': True,
                'detail': 'Encoding is not allowed at this time. Admin must finalize seeds before encoding.'
            })

        # Duplicate check — poll-scoped (simple and accurate)
        dup_qs = HarvestRecord.objects.filter(
            farmer_id=farmer_id,
            seed_source=seed_source,
            barangay=barangay,
        )
        if active_poll:
            dup_qs = dup_qs.filter(poll=active_poll)

        if dup_qs.exists():
            existing = dup_qs.first()
            seed_labels = {
                'HYBRID':   'Hybrid seeds',
                'INBRED':   'Certified seeds',
                'OWN_SEED': 'Farmer saved seeds',
            }
            raise ValidationError({
                'duplicate':    True,
                'existing_id':  existing.id,
                'detail': (
                    f"A {seed_labels.get(seed_source, seed_source)} harvest record for this farmer "
                    f"already exists this season (encoded {existing.harvest_date})."
                )
            })

        serializer.save(encoded_by=user, barangay=barangay, poll=active_poll)


class HarvestRecordDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET    /api/production/harvest/<id>/ — Get harvest record detail
    PUT    /api/production/harvest/<id>/ — Update harvest record
    DELETE /api/production/harvest/<id>/ — Delete harvest record
    """
    serializer_class = HarvestRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'BRGY':
            return HarvestRecord.objects.filter(barangay=user.barangay).select_related('farmer', 'encoded_by')
        elif user.role == 'ADMIN':
            return HarvestRecord.objects.all().select_related('farmer', 'encoded_by')
        return HarvestRecord.objects.none()
    

from apps.crop_monitoring.models import CropMonitoringRecord
from apps.seed_poll.models import Poll, FinalSeed


class BrgyHarvestingFarmersView(APIView):
    """
    GET /api/production/harvesting-farmers/
    Returns farmers in the BRGY president's barangay
    who have at least one HARVESTING crop phase record
    in the current active poll/season.
    Groups by farmer with which seed types are in HARVESTING.
    """
    permission_classes = [IsAuthenticated, IsBPUser]

    def get(self, request):
        user = request.user
        barangay = getattr(user, 'barangay', None)
        if not barangay:
            return Response({'farmers': []})

        # Allow optional poll_id override for historical views
        poll_id = request.query_params.get('poll_id')

        # If a specific poll_id is requested, resolve it for historical view
        if poll_id:
            active_poll = get_current_poll(poll_id=int(poll_id))
            encoding_poll = get_encoding_poll()
            encoding_allowed = bool(encoding_poll)
        else:
            # For live encoding flows, use the encoding poll (must be CLOSED+finalized)
            active_poll = get_encoding_poll()
            encoding_poll = active_poll
            encoding_allowed = bool(encoding_poll)

        if not active_poll:
            # If no encoding poll and this is a live encoding request, surface block
            if not poll_id:
                latest = Poll.objects.order_by('-created_at').first()
                if not latest:
                    reason = 'No poll configured.'
                elif latest.status != 'CLOSED':
                    reason = 'Latest poll is not closed yet.'
                else:
                    from apps.seed_poll.models import FinalSeed
                    if not FinalSeed.objects.filter(season=latest.season, year=latest.year).exists():
                        reason = 'Final seeds not finalized for latest poll.'
                    else:
                        reason = 'Encoding not allowed for current poll.'
                return Response({'farmers': [], 'encoding_allowed': False, 'encoding_blocked_reason': reason})
            # historical view with poll_id provided but poll not found
            return Response({'farmers': []})

        # Get all HARVESTING records for this barangay in active poll
        harvesting_records = CropMonitoringRecord.objects.filter(
            barangay=barangay,
            crop_phase='HARVESTING',
            poll=active_poll,
        ).select_related('farmer')

        # Group by farmer
        farmer_map = {}
        for rec in harvesting_records:
            fid = rec.farmer_id
            if fid not in farmer_map:
                farmer_map[fid] = {
                    'id': rec.farmer.id,
                    'first_name': rec.farmer.first_name,
                    'last_name': rec.farmer.last_name,
                    'rsbsa_number': rec.farmer.rsbsa_number or '',
                    'barangay': rec.farmer.barangay or '',
                    'harvesting_seed_types': [],
                    'area_by_seed_type': {},
                }
            seed_key = rec.seed_source  # HYBRID, INBRED, OWN_SEED
            if seed_key and seed_key not in farmer_map[fid]['harvesting_seed_types']:
                farmer_map[fid]['harvesting_seed_types'].append(seed_key)
            if seed_key and rec.area_monitored_ha:
                farmer_map[fid]['area_by_seed_type'][seed_key] = float(rec.area_monitored_ha)

        resp = {
            'farmers': list(farmer_map.values()),
            'poll_id': active_poll.id,
            'season': active_poll.season,
            'year': active_poll.year,
        }
        # Include encoding metadata so frontend can decide encode vs report mode
        resp['encoding_allowed'] = encoding_allowed
        if not encoding_allowed:
            resp['encoding_blocked_reason'] = (
                'Encoding is currently disabled for this season.'
            )
        return Response(resp)


class BrgyHarvestHistoryView(APIView):
    """
    GET /api/production/harvest-history/
    Returns past harvest records for the BRGY president's barangay,
    filtered by poll_id (season + year).
    Supports: ?poll_id=  ?search=  ?seed_source=
    """
    permission_classes = [IsAuthenticated, IsBPUser]

    def get(self, request):
        user = request.user
        barangay = getattr(user, 'barangay', None)
        if not barangay:
            return Response({'records': [], 'polls': []})

        # All polls for the dropdown (excluding current active)
        active_poll = get_current_poll()
        all_polls = Poll.objects.order_by('-created_at')
        polls_data = []
        for p in all_polls:
            polls_data.append({
                'id': p.id,
                'season': p.season,
                'season_display': p.get_season_display(),
                'year': p.year,
                'status': p.status,
                'is_active': active_poll and p.id == active_poll.id,
            })

        poll_id = request.query_params.get('poll_id', '')
        search = request.query_params.get('search', '')
        seed_source = request.query_params.get('seed_source', '')

        if not poll_id:
            return Response({'records': [], 'polls': polls_data})

        try:
            poll = Poll.objects.get(id=poll_id)
        except Poll.DoesNotExist:
            return Response({'records': [], 'polls': polls_data})

        # Filter harvest records by barangay + season/year of poll
        qs = HarvestRecord.objects.filter(
            barangay=barangay
        ).select_related('farmer', 'encoded_by')

        qs = qs.filter(poll=poll)

        if search:
            qs = qs.filter(
                Q(farmer__first_name__icontains=search) |
                Q(farmer__last_name__icontains=search) |
                Q(farmer__rsbsa_number__icontains=search) |
                Q(variety__icontains=search)
            )

        if seed_source:
            qs = qs.filter(seed_source=seed_source)

        serializer = HarvestRecordSerializer(qs.order_by('-harvest_date', '-created_at'), many=True)

        return Response({
            'records': serializer.data,
            'polls': polls_data,
            'poll_info': {
                'id': poll.id,
                'season': poll.season,
                'season_display': poll.get_season_display(),
                'year': poll.year,
            }
        })