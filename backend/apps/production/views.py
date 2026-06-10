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

    qs = HarvestRecord.objects.filter(barangay=barangay).select_related('farmer')
    if poll:
        if poll.season == 'WET':
            qs = qs.filter(harvest_date__year=poll.year, harvest_date__month__gte=6, harvest_date__month__lte=10)
        elif poll.season == 'DRY':
            qs = qs.filter(
                Q(harvest_date__year=poll.year - 1, harvest_date__month__gte=11) |
                Q(harvest_date__year=poll.year, harvest_date__month__lte=5)
            )

    harvest_records = list(qs)

    total_farmers = len(set(r.farmer_id for r in harvest_records))
    total_area = sum(float(r.harvest_area_ha or 0) for r in harvest_records)
    total_bags = sum(float(r.harvest_bags or 0) for r in harvest_records)
    total_kg = total_bags * 50
    total_mt = total_kg / 1000
    avg_yield = (total_mt / total_area) if total_area > 0 else 0

    util_vals = [utilization_pct(r) for r in harvest_records]
    util_vals = [v for v in util_vals if v is not None]
    avg_util = sum(util_vals) / len(util_vals) if util_vals else None

    by_seed_type = []
    for src in ['HYBRID', 'INBRED', 'OWN_SEED']:
        group = [r for r in harvest_records if r.seed_source == src]
        area = sum(float(r.harvest_area_ha or 0) for r in group)
        mt = sum((float(r.harvest_bags or 0) * 50) / 1000 for r in group)
        u_vals = [utilization_pct(r) for r in group]
        u_vals = [v for v in u_vals if v is not None]
        avg_u = sum(u_vals) / len(u_vals) if u_vals else None
        seed_dist = sum(float(r.seed_bags_received or 0) * {'HYBRID': 15, 'INBRED': 20, 'OWN_SEED': 0}.get(src, 0) for r in group)
        prod_equiv = seed_dist * ((avg_u or 0) / 100) if seed_dist > 0 else 0
        yield_gap = max(0, seed_dist - prod_equiv)

        by_seed_type.append({
            'seed_source': src,
            'label': SEED_LABELS.get(src, src),
            'farmer_count': len(set(r.farmer_id for r in group)),
            'total_area_ha': round(area, 2),
            'total_mt': round(mt, 2),
            'avg_yield_t_ha': round(mt / area, 2) if area > 0 else 0,
            'avg_util_pct': round(avg_u, 1) if avg_u is not None else None,
            'tier': get_tier_label(avg_u),
            'seed_distributed_kg': round(seed_dist, 2),
            'prod_seed_equiv_kg': round(prod_equiv, 2),
            'yield_gap_equiv_kg': round(yield_gap, 2),
        })

    seed_productivity = []
    for r in harvest_records:
        if r.seed_source == 'OWN_SEED':
            continue
        util = utilization_pct(r)
        if util is None:
            continue
        bags_recv = float(r.seed_bags_received or 0)
        kg_per_bag = {'HYBRID': 15, 'INBRED': 20, 'OWN_SEED': 0}.get(r.seed_source, 0)
        seed_dist = bags_recv * kg_per_bag
        if seed_dist == 0:
            continue
        prod_equiv = seed_dist * (util / 100)
        yield_gap = max(0, seed_dist - prod_equiv)
        farmer = r.farmer
        name = f"{farmer.last_name}, {farmer.first_name}" if farmer else str(r.farmer_id)
        seed_productivity.append({
            'farmer_name': name,
            'seed_source': r.seed_source,
            'seed_label': SEED_LABELS.get(r.seed_source, r.seed_source),
            'seed_distributed_kg': round(seed_dist, 2),
            'prod_seed_equiv_kg': round(prod_equiv, 2),
            'yield_gap_equiv_kg': round(yield_gap, 2),
            'utilization_pct': round(util, 1),
            'tier': get_tier_label(util),
        })
    seed_productivity.sort(key=lambda x: x['yield_gap_equiv_kg'], reverse=True)

    from apps.distribution.models import DistributionEntry
    beneficiary_qs = DistributionEntry.objects.filter(farmer__barangay=barangay).select_related('farmer')
    if poll:
        if poll.season == 'WET':
            beneficiary_qs = beneficiary_qs.filter(
                batch__event__season=poll.season,
                batch__event__year=poll.year,
            )
        elif poll.season == 'DRY':
            beneficiary_qs = beneficiary_qs.filter(
                batch__event__season=poll.season,
                batch__event__year=poll.year,
            )
    total_beneficiaries = beneficiary_qs.values('farmer').distinct().count()

    phase_qs = CropMonitoringRecord.objects.filter(barangay=barangay)
    if poll:
        phase_qs = phase_qs.filter(poll=poll)

    phase_counts = {}
    delayed_count = 0
    damaged_count = 0
    for rec in phase_qs:
        phase = rec.crop_phase or 'Unknown'
        phase_counts[phase] = phase_counts.get(phase, 0) + 1
        status = (getattr(rec, 'phase_status', '') or '').upper()
        if status == 'DELAYED':
            delayed_count += 1
        if status == 'DAMAGED':
            damaged_count += 1

    insights = []
    if total_farmers > 0:
        insights.append(f"{total_farmers} farmer{'s' if total_farmers != 1 else ''} have harvest data in Barangay {barangay}.")
    if total_beneficiaries > 0:
        insights.append(f"{total_beneficiaries} farmer{'s' if total_beneficiaries != 1 else ''} received seed distribution in this season.")
    if avg_util is not None:
        insights.append(f"Overall yield achievement is {round(avg_util, 1)}% — {get_tier_label(avg_util)}.")
    if total_mt > 0:
        insights.append(f"Total production reached {round(total_mt, 2)} MT with an average yield of {round(avg_yield, 2)} t/ha.")

    best_seed = max(by_seed_type, key=lambda x: x['avg_yield_t_ha'] or 0, default=None)
    if best_seed and best_seed['avg_yield_t_ha'] > 0:
        insights.append(f"{best_seed['label']} recorded the highest average yield at {best_seed['avg_yield_t_ha']} t/ha.")

    total_gap = sum(s['yield_gap_equiv_kg'] for s in by_seed_type)
    if total_gap > 0:
        insights.append(f"Potential unrealized productivity equivalent reached {round(total_gap, 1)} kg.")

    if delayed_count > 0:
        insights.append(f"{delayed_count} crop monitoring record{'s' if delayed_count != 1 else ''} were flagged as delayed.")

    return {
        'poll_info': poll_info,
        'barangay': barangay,
        'summary': {
            'total_farmers': total_farmers,
            'total_beneficiaries': total_beneficiaries,
            'total_area_ha': round(total_area, 2),
            'total_production_mt': round(total_mt, 2),
            'avg_yield_t_ha': round(avg_yield, 2),
            'avg_util_pct': round(avg_util, 1) if avg_util is not None else None,
            'overall_tier': get_tier_label(avg_util),
        },
        'by_seed_type': by_seed_type,
        'seed_productivity': seed_productivity,
        'crop_phase_summary': {
            'phase_counts': phase_counts,
            'delayed_count': delayed_count,
            'damaged_count': damaged_count,
            'total_monitored': sum(phase_counts.values()),
        },
        'insights': insights,
    }


class BrgyReportDataView(APIView):
    """
    GET /api/production/brgy-report/?poll_id=
    Returns report analytics for BRGY users.
    """
    permission_classes = [IsAuthenticated, IsBPUser]

    def get(self, request):
        data = _build_brgy_report_data(request.user, request.query_params.get('poll_id'))
        if 'error' in data:
            return Response({'error': data['error']}, status=400)
        return Response(data)


class BrgyReportPDFView(APIView):
    """
    POST /api/production/brgy-report/pdf/
    Generates a PDF report for the BRGY dashboard.
    """
    permission_classes = [IsAuthenticated, IsBPUser]

    def post(self, request):
        try:
            from xhtml2pdf import pisa
        except ImportError:
            return Response({'error': 'xhtml2pdf is not installed. Run: pip install xhtml2pdf'}, status=500)

        from io import BytesIO

        poll_id = request.data.get('poll_id')
        charts = request.data.get('charts', {}) or {}
        report_data = _build_brgy_report_data(request.user, poll_id)
        if 'error' in report_data:
            return Response({'error': report_data['error']}, status=400)

        poll_info = report_data.get('poll_info', {})
        summary = report_data.get('summary', {})
        season_label = f"{poll_info.get('season_display', '')} {poll_info.get('year', '')}" if poll_info else 'All Seasons'
        chart_row = f'''<div class="chart-row"><div class="chart-box"><img src="data:image/png;base64,{charts.get('production_chart', '')}" /></div><div class="chart-box"><img src="data:image/png;base64,{charts.get('yield_chart', '')}" /></div></div>''' if charts.get('production_chart') and charts.get('yield_chart') else ''
        gap_chart_html = f'''<div class="chart-box" style="margin-bottom:10px;"><img src="data:image/png;base64,{charts.get('gap_chart', '')}" /></div>''' if charts.get('gap_chart') else ''
        insights_html = ''.join(f'<div class="insight"><div class="dot"></div><div>{item}</div></div>' for item in report_data.get('insights', []))

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset=\"UTF-8\" />
<style>
  @page {{ size: A4; margin: 15mm 12mm; }}
  body {{ font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111827; }}
  .header {{ text-align: center; border-bottom: 2px solid #166534; padding-bottom: 8px; margin-bottom: 10px; }}
  .title {{ font-size: 13pt; font-weight: bold; color: #166534; }}
  .subtitle {{ font-size: 9pt; color: #374151; margin-top: 2px; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 999px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 8pt; font-weight: bold; margin-top: 4px; }}
  .metric-table {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; }}
  .metric-table td {{ width: 33.33%; padding: 6px; border: 1px solid #e2e8f0; background: #f8fafc; vertical-align: top; }}
  .metric-label {{ font-size: 7pt; text-transform: uppercase; color: #64748b; }}
  .metric-value {{ font-size: 11pt; font-weight: bold; color: #14532d; margin-top: 2px; }}
  .chart-table {{ width: 100%; border-collapse: collapse; margin-bottom: 10px; }}
  .chart-table td {{ width: 50%; padding: 6px; border: 1px solid #e2e8f0; vertical-align: top; }}
  .chart-box img {{ width: 100%; height: auto; border-radius: 6px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 10px; }}
  th {{ text-align: left; background: #14532d; color: white; padding: 5px; font-size: 7.5pt; text-transform: uppercase; }}
  td {{ padding: 5px; border-bottom: 1px solid #e5e7eb; color: #374151; }}
  .insight {{ margin-bottom: 4px; font-size: 8.5pt; color: #374151; }}
</style>
</head>
<body>
<div class=\"header\">
  <div class=\"title\">LUCBAN MUNICIPAL AGRICULTURE OFFICE</div>
  <div class=\"subtitle\">Barangay {report_data['barangay']} — Report</div>
  <div class=\"badge\">{season_label}</div>
</div>
<table class=\"metric-table\">
  <tr>
    <td><div class=\"metric-label\">Farmers Harvested</div><div class=\"metric-value\">{summary.get('total_farmers', 0)}</div></td>
    <td><div class=\"metric-label\">Beneficiaries</div><div class=\"metric-value\">{summary.get('total_beneficiaries', 0)}</div></td>
    <td><div class=\"metric-label\">Area Harvested</div><div class=\"metric-value\">{summary.get('total_area_ha', 0)} ha</div></td>
  </tr>
  <tr>
    <td><div class=\"metric-label\">Total Production</div><div class=\"metric-value\">{summary.get('total_production_mt', 0)} MT</div></td>
    <td><div class=\"metric-label\">Avg Yield</div><div class=\"metric-value\">{summary.get('avg_yield_t_ha', 0)} t/ha</div></td>
    <td><div class=\"metric-label\">Achievement</div><div class=\"metric-value\">{summary.get('avg_util_pct', 0)}%</div></td>
  </tr>
</table>
<table class=\"chart-table\">
  <tr>
    <td class=\"chart-box\">{chart_row}</td>
    <td class=\"chart-box\">{gap_chart_html}</td>
  </tr>
</table>
<div style=\"margin-top: 8px;\"><strong>Key Insights</strong></div>
{insights_html}
</body>
</html>
"""

        buffer = BytesIO()
        try:
            pisa_status = pisa.CreatePDF(html_content, dest=buffer)
        except Exception as exc:
            return Response({'error': 'Failed to generate PDF report.', 'detail': str(exc)}, status=500)

        if pisa_status.err:
            return Response({'error': 'Failed to generate PDF report.'}, status=500)

        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="BrgyReport_{report_data["barangay"].replace(" ", "_")}.pdf"'
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