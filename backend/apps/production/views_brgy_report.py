# apps/production/views_brgy_report.py
from io import BytesIO
import base64
import os
import datetime
from decimal import Decimal
from django.conf import settings
from django.http import HttpResponse
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from xhtml2pdf import pisa

from apps.accounts.permissions import IsBPUser
from .models import HarvestRecord
from .serializers import HarvestRecordSerializer
from apps.seed_poll.utils import get_current_poll, get_encoding_poll
from apps.crop_monitoring.models import CropMonitoringRecord
from apps.seed_poll.models import Poll, FinalSeed

# DA official constants
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


def _build_brgy_report_data(user, poll_id=None):
    barangay = getattr(user, 'barangay', None)
    if not barangay:
        return {'error': 'No barangay assigned.'}

    try:
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

    # Harvest Records
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

    # Distribution scoped to poll
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

    total_beneficiaries = len(set(e.farmer_id for e in dist_entries))

    hybrid_bags = inbred_bags = 0
    hybrid_kg_total = inbred_kg_total = 0
    for e in dist_entries:
        seed_name = (getattr(e.batch.event.seed_type, 'name', '') or '').upper()
        bags = float(e.qty_bags or 0)
        if 'HYBRID' in seed_name:
            hybrid_bags      += bags
            hybrid_kg_total  += round(bags * 15, 2)
        elif 'INBRED' in seed_name:
            inbred_bags      += bags
            inbred_kg_total  += round(bags * 20, 2)

    total_dist_bags = round(hybrid_bags + inbred_bags, 2)
    total_dist_kg   = round(hybrid_kg_total + inbred_kg_total, 2)

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

    # Crop phase summary scoped to poll
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

    # Seed productivity list
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

    # Harvest performance list
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
            'total_dist_bags':     round(total_dist_bags, 2),
            'total_dist_kg':       round(total_dist_kg, 2),
            'hybrid_bags':         round(hybrid_bags, 2),
            'hybrid_kg':           round(hybrid_kg_total, 2),
            'inbred_bags':         round(inbred_bags, 2),
            'inbred_kg':           round(inbred_kg_total, 2),
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
        
        brgy_president_name = f"{request.user.first_name} {request.user.last_name}".strip() or 'Barangay President'
        brgy_president_role = f"Barangay President, Brgy. {barangay}"

        # ── Pre-calculate variables bago pumasok sa html_content f-string ──
        today_date_str = datetime.date.today().strftime('%B %d, %Y')
        
        # Safe Logo loading
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

        if logo_b64:
            logo_html = f'<img src="data:image/png;base64,{logo_b64}" style="width:110px;height:110px;border-radius:50%;" />'
        else:
            logo_html = '<div style="font-weight:bold;font-size:24pt;color:#15803d;border:3px solid #15803d;width:110px;height:110px;border-radius:50%;line-height:110px;margin:0 auto;text-align:center;">MAO</div>'

        # Seed Distribution variables
        hybrid_kg_total = summary.get('hybrid_kg', 0)
        inbred_kg_total = summary.get('inbred_kg', 0)
        total_dist_kg = summary.get('total_dist_kg', 0)

        # dynamic percentage strings
        if total_dist_kg > 0:
            hybrid_pct_str = f"{(hybrid_kg_total / total_dist_kg * 100):.1f}%"
            inbred_pct_str = f"{(inbred_kg_total / total_dist_kg * 100):.1f}%"
        else:
            hybrid_pct_str = "0.0%"
            inbred_pct_str = "0.0%"

        # Yield Achievement KPI styles and colors
        avg_util_pct_val = summary.get('avg_util_pct')
        if avg_util_pct_val is not None:
            avg_util_color = '#166534' if avg_util_pct_val >= 80 else '#b45309'
            avg_util_val_str = f"{avg_util_pct_val:.1f}%"
        else:
            avg_util_color = '#64748b'
            avg_util_val_str = '—'

        # Expected vs Actual totals
        total_expected_kg = sum(s['expected_kg'] for s in by_seed if s['farmer_count'] > 0)
        total_actual_kg   = sum(s['actual_kg']   for s in by_seed if s['farmer_count'] > 0)
        harvest_gap_kg    = max(0, total_expected_kg - total_actual_kg)
        
        gap_color = '#b91c1c' if harvest_gap_kg > 0 else '#166534'
        gap_pct_str = f"{(harvest_gap_kg / total_expected_kg * 100):.1f}%" if total_expected_kg > 0 else "0.0%"

        # Dynamic Section Insights
        dist_insight = ''
        if total_dist_kg > 0:
            hybrid_pct = round((hybrid_kg_total / total_dist_kg * 100), 1) if total_dist_kg > 0 else 0
            inbred_pct = round((inbred_kg_total / total_dist_kg * 100), 1) if total_dist_kg > 0 else 0
            dist_parts = []
            if hybrid_kg_total > 0:
                dist_parts.append(f"Hybrid seeds accounted for {hybrid_pct}% of total seed assistance ({hybrid_kg_total:,.0f} kg).")
            if inbred_kg_total > 0:
                dist_parts.append(f"Certified (Inbred) seeds comprised {inbred_pct}% of total distribution ({inbred_kg_total:,.0f} kg).")
            dist_insight = ' '.join(dist_parts) or 'No seed distribution data available for this season.'
        else:
            dist_insight = 'No seed distribution data recorded for this season.'

        prod_top = max(by_seed, key=lambda s: s['total_mt'] if s['farmer_count'] > 0 else 0, default=None)
        if avg_util_pct_val is not None:
            u = avg_util_pct_val
            if u >= 100:
                prod_insight = f"The barangay achieved target requirements with an overall achievement rate of {u}%. Total production reached {summary.get('total_production_mt', 0)} MT from {summary.get('total_area_ha', 0)} ha."
            elif u >= 80:
                prod_insight = f"The barangay reached steady alignment with the DA target at {u}% overall. Total production was {summary.get('total_production_mt', 0)} MT, indicating stable performance with minor gaps."
            else:
                prod_insight = f"Overall yield achievement is {u}% — below the DA target. Total production reached {summary.get('total_production_mt', 0)} MT from {summary.get('total_area_ha', 0)} ha. Technical intervention and closer monitoring are recommended."
            if prod_top and prod_top['farmer_count'] > 0:
                prod_insight += f" {prod_top['label']} recorded the highest output at {prod_top['total_mt']} MT."
        else:
            prod_insight = 'No harvest production data available for this season.'

        if total_expected_kg > 0:
            gap_pct = round(harvest_gap_kg / total_expected_kg * 100, 1)
            if harvest_gap_kg <= 0:
                harvest_insight = f"Actual harvest of {total_actual_kg:,.0f} kg met or exceeded the projected target of {total_expected_kg:,.0f} kg. Steady production performance this season."
            else:
                harvest_insight = f"Actual harvest reached {total_actual_kg:,.0f} kg compared with the projected {total_expected_kg:,.0f} kg, resulting in a shortfall of {harvest_gap_kg:,.0f} kg ({gap_pct}% production deficit). Additional monitoring and extension services are recommended."
        else:
            harvest_insight = 'No expected vs actual data available.'

        critical_farmers  = [p for p in harvest_perf if p['tier'] == 'Critical']
        achieved_farmers  = [p for p in harvest_perf if p['tier'] in ('Achieved Target', 'Exceeded Target')]
        perf_insight_parts = []
        if achieved_farmers:
            names = ', '.join(p['farmer_name'] for p in achieved_farmers[:3])
            perf_insight_parts.append(f"{names} met or exceeded the DA target yield.")
        if critical_farmers:
            cnames = ', '.join(p['farmer_name'] for p in critical_farmers[:3])
            perf_insight_parts.append(f"{cnames} was classified as Critical and require immediate technical assistance.")
        if not perf_insight_parts:
            perf_insight_parts.append('No farmer performance data available for this season.')
        farmer_insight = ' '.join(perf_insight_parts)

        total_monitored = crop_phase.get('total_monitored', 0)
        delayed_c  = crop_phase.get('delayed_count', 0)
        damaged_c  = crop_phase.get('damaged_count', 0)
        phase_parts = []
        if total_monitored > 0:
            top_phases = sorted(crop_phase.get('phase_counts', {}).items(), key=lambda x: x[1], reverse=True)[:2]
            phase_display_map = {
                'DISTRIBUTION': 'Seed Distribution', 'ESTABLISHMENT': 'Crop Establishment',
                'TILLERING': 'Tillering', 'FLOWERING': 'Flowering',
                'RIPENING': 'Ripening', 'HARVESTING': 'Harvesting',
            }
            if top_phases:
                top_names = ' and '.join(phase_display_map.get(ph, ph) for ph, _ in top_phases)
                phase_parts.append(f"{top_names} stages account for the majority of {total_monitored} monitored farms.")
        if delayed_c > 0:
            phase_parts.append(f"{delayed_c} monitoring records flagged as delayed — immediate field validation recommended.")
        if damaged_c > 0:
            phase_parts.append(f"{damaged_c} records reported as damaged — conduct immediate assessment and intervention.")
        if not phase_parts:
            phase_parts.append('No crop monitoring data recorded for this season.')
        phase_insight = ' '.join(phase_parts)

        # Recommendations list generator (Pre-calculated clean string variables para iwas nested f-string quotes)
        reco_production = []
        reco_seed       = []
        reco_monitoring = []
        reco_capacity   = []

        u = summary.get('avg_util_pct') or 0
        if u < 80:
            reco_production.append('Strengthen field monitoring and technical assistance for low-performing farms.')
            reco_production.append('Conduct root cause analysis for farms below 80% yield achievement.')
        if u < 100:
            reco_production.append('Increase farm visit frequency during critical crop growth stages.')
        if damaged_c > 0:
            reco_monitoring.append('Conduct immediate field validation for all damaged crop reports.')
        if delayed_c > 0:
            reco_monitoring.append('Investigate causes of delayed crop monitoring records and fast-track assessments.')
        if inbred_kg_total > 0 or hybrid_kg_total > 0:
            reco_seed.append('Evaluate seed utilization efficiency and compare performance per seed program.')
        reco_seed.append('Ensure timely seed distribution aligned with planting calendar.')
        reco_capacity.append('Conduct training on climate-resilient rice production practices.')
        reco_capacity.append('Organize workshops on pest and disease management for registered farmers.')

        def reco_html(items):
            return ''.join(f'<li style="margin-bottom:4px;font-size:8.5pt;color:#334155;line-height:1.5">{i}</li>' for i in items)

        # Pre-calculated HTML lists para maiwasan ang SyntaxError sa python interpolator
        reco_production_html = reco_html(reco_production) if reco_production else '<li>No adjustments flagged for production lines.</li>'
        reco_seed_html       = reco_html(reco_seed) if reco_seed else '<li>Allocation parameters are standard.</li>'
        reco_monitoring_html = reco_html(reco_monitoring) if reco_monitoring else '<li>No critical delays flagged this season.</li>'
        reco_capacity_html   = reco_html(reco_capacity) if reco_capacity else '<li>Standard workshops recommended.</li>'







        def chart_img_tag(key, width='100%'):
            img_data = charts.get(key, '')
            if not img_data:
                return '<div style="background:#f8fafc;border:1px dashed #cbd5e1;padding:30px;text-align:center;color:#94a3b8;font-size:8.5pt;border-radius:6px;">Chart representation rendered from system dashboard</div>'
            return f'<img src="data:image/png;base64,{img_data}" style="width:{width};display:block;margin:0 auto;border-radius:6px;" />'

        # def chart_img_tag(key):
        #     img_data = charts.get(key, '')
        #     if not img_data:
        #         return '<div style="background:#f8fafc;border:1px dashed #cbd5e1;padding:30px;text-align:center;color:#94a3b8;font-size:8.5pt;border-radius:6px;">Chart representation rendered from system dashboard</div>'
        #     return f'<img src="data:image/png;base64,{img_data}" style="width:100%;height:auto;display:block;margin:0 auto;border-radius:6px;" />'









        # Seed rows
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
              <td style="text-align:left;font-weight:bold;color:#0f172a;">{s['label']}</td>
              <td>{s['farmer_count']}</td>
              <td>{s['seed_bags_received']:,}</td>
              <td>{s['seed_kg_received']:,} kg</td>
              <td>{s['total_area_ha']} ha</td>
              <td>{s['expected_kg']:,.0f} kg</td>
              <td style="font-weight:bold;">{s['actual_kg']:,.0f} kg</td>
              <td style="font-weight:bold;color:{tier_color}">{util_str}</td>
              <td style="color:{tier_color};font-weight:bold;">{s['tier']}</td>
            </tr>"""

        # Harvest Performance
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
              <td style="text-align:left;font-weight:bold;color:#0f172a;">{p['farmer_name']}</td>
              <td>{p['seed_label']}</td>
              <td>{p['area_ha']} ha</td>
              <td>{p['expected_kg']:,.0f} kg</td>
              <td style="font-weight:bold;">{p['actual_kg']:,.0f} kg</td>
              <td style="font-weight:bold;color:{tier_color}">{util_str}</td>
              <td style="color:{tier_color};font-weight:bold;">{p['tier']}</td>
            </tr>"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page {{
    size: A4;
    margin: 18mm 16mm 20mm 16mm;
   }}


  
  body {{
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    color: #1e293b;
    margin: 0;
    padding: 0;
    line-height: 1.5;
  }}

  /* Utilities */
  .page-break {{ page-break-before: always; }}
  .text-center {{ text-align: center; }}
  .text-right {{ text-align: right; }}

  /* Cover Page Styling */
  .cover-container {{ text-align: center; padding-top: 15mm; }}
  .cover-govt {{ font-size: 11pt; font-weight: bold; letter-spacing: 0.12em; color: #334155; margin-bottom: 2px; }}
  .cover-lgu {{ font-size: 10pt; font-weight: bold; color: #475569; margin-bottom: 12px; }}
  .cover-logo-wrapper {{ margin: 25mm 0 15mm; text-align: center; }}
  .cover-title {{ font-size: 20pt; font-weight: bold; color: #14532d; line-height: 1.3; margin-bottom: 6px; }}
  .cover-subtitle {{ font-size: 12pt; color: #475569; font-weight: bold; text-transform: uppercase; margin-bottom: 24mm; }}
  .cover-meta {{ width: 100%; border-collapse: collapse; margin-top: 20mm; }}
  .cover-meta td {{ width: 50%; padding: 10px; vertical-align: top; }}
  .meta-label {{ font-size: 8pt; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 3px; display: block; }}
  .meta-val {{ font-size: 10.5pt; color: #0f172a; font-weight: bold; }}

  /* General Government Header (every other page) */
  .gov-header {{ border-bottom: 2px solid #15803d; padding-bottom: 8px; margin-bottom: 15px; width: 100%; }}
  .gov-header-title {{ font-size: 7.5pt; color: #15803d; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; }}
  .gov-header-desc {{ font-size: 10pt; color: #1e293b; font-weight: bold; }}

  /* Page Structural Headers */
  .section-header {{ font-size: 15pt; font-weight: bold; color: #14532d; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 12px; }}
  .section-subheader {{ font-size: 8.5pt; color: #64748b; margin-top: -8px; margin-bottom: 15px; font-style: italic; }}

  /* KPI Tiles Table */
  .kpi-table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
  .kpi-cell {{ border: 1.5px solid #e2e8f0; padding: 12px 6px; width: 16.6%; text-align: center; background: #f8fafc; }}
  .kpi-lbl {{ font-size: 7.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; display: block; }}
  .kpi-val {{ font-size: 15pt; font-weight: 800; color: #14532d; display: block; margin-top: 4px; }}

  /* Content Cards */
  .card {{ border: 1.5px solid #e2e8f0; border-radius: 6px; background: white; margin-bottom: 15px; padding: 12px 16px; }}
  .card-title {{ font-size: 10.5pt; font-weight: bold; color: #0f172a; margin: 0 0 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }}

  /* Standard Report Tables */
  .data-table {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 10px; }}
  .data-table th {{ background: #14532d; color: white; padding: 6px 8px; font-weight: bold; font-size: 8pt; text-align: center; border: 1px solid #14532d; }}
  .data-table td {{ padding: 7px 8px; border: 1px solid #e2e8f0; text-align: center; color: #334155; }}
  .data-table tr:nth-child(even) td {{ background: #f8fafc; }}

  /* Recommendations Layout */
  .rec-block {{ border-left: 3px solid #15803d; padding-left: 12px; margin-bottom: 14px; }}
  .rec-title {{ font-size: 10pt; font-weight: bold; color: #14532d; margin-bottom: 3px; }}
  .rec-text {{ font-size: 9pt; color: #475569; }}

  /* Interpretation Boxes */
  .interp-box {{ background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 4px; margin-top: 10px; }}
  .interp-title {{ font-size: 8pt; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
  .interp-text {{ font-size: 9pt; color: #334155; line-height: 1.5; }}

  /* Signatories */
  .sig-table {{ width: 100%; border-collapse: collapse; margin-top: 30px; }}
  .sig-table td {{ width: 33.3%; vertical-align: bottom; text-align: center; font-size: 8.5pt; }}
  .sig-space {{ height: 40px; display: block; }}
  .sig-name {{ font-weight: bold; text-decoration: underline; text-transform: uppercase; display: block; }}
  .sig-title {{ color: #64748b; font-size: 7.5pt; margin-top: 2px; display: block; }}
</style>
</head>
<body>

<!-- ══════════════════════════════════════════════════════════
     PAGE 1 — COVER PAGE
     ══════════════════════════════════════════════════════════ -->
<div class="cover-container">
  <div class="cover-govt">REPUBLIC OF THE PHILIPPINES</div>
  <div class="cover-govt">PROVINCE OF QUEZON</div>
  <div class="cover-lgu">MUNICIPALITY OF LUCBAN</div>
  
  <div class="cover-logo-wrapper">
    {logo_html}
  </div>
  
  <div class="cover-title">AGRICULTURAL SEASON ANALYTICS REPORT</div>
  <div class="cover-subtitle" style="font-size:14pt;color:#15803d;margin-top:5px;margin-bottom:10px;">Barangay {barangay}</div>
  <div class="cover-subtitle">{season_label}</div>
  
  <div style="font-size: 10pt; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 15px;">
      Rice Program Management System (AGRICE)
  </div>

  <table class="cover-meta" style="margin-top: 35mm;">
    <tr>
      <td class="text-left">
        <span class="meta-label">Prepared By</span>
        <span class="meta-val">{brgy_president_name}</span><br />
        <span style="font-size:8.5pt;color:#64748b;">{brgy_president_role}</span>
      </td>
      <td class="text-right">
        <span class="meta-label">Date Generated</span>
        <span class="meta-val">{today_date_str}</span><br />
        <span style="font-size:8.5pt;color:#64748b;">AGRICE Core Reports Engine</span>
      </td>
    </tr>
  </table>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 2 — EXECUTIVE SUMMARY
     ══════════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<table class="gov-header">
  <tr>
    <td style="text-align:left;"><span class="gov-header-title">AGRICE Season Analytics Report</span></td>
    <td style="text-align:right;"><span class="gov-header-desc">Barangay {barangay} &bull; {season_label}</span></td>
  </tr>
</table>

<div class="section-header">Executive Summary</div>
<div class="section-subheader">Performance summary overview of the current season cycle</div>

<!-- KPI Tiles -->
<table class="kpi-table">
  <tr>
    <td class="kpi-cell">
      <span class="kpi-lbl">Farmers Harvested</span>
      <span class="kpi-val">{summary.get('total_farmers', 0)}</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-lbl">Beneficiaries</span>
      <span class="kpi-val">{summary.get('total_beneficiaries', 0)}</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-lbl">Area Harvested</span>
      <span class="kpi-val">{summary.get('total_area_ha', 0):,.2f} ha</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-lbl">Total Production</span>
      <span class="kpi-val">{summary.get('total_production_mt', 0):,.2f} MT</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-lbl">Average Yield</span>
      <span class="kpi-val">{summary.get('avg_yield_t_ha', 0):,.2f} t/ha</span>
    </td>
    <td class="kpi-cell">
      <span class="kpi-lbl">Yield Achievement</span>
      <span class="kpi-val" style="color:{avg_util_color};">{avg_util_val_str}</span>
    </td>
  </tr>
</table>

<div class="card" style="margin-top: 15px;">
  <div class="card-title">Executive Insights</div>
  <table style="width: 100%; border-collapse: collapse;">
    {''.join(f'<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 25px; padding: 10px 0; vertical-align: top; color: #166534; font-size: 11pt;">&nbsp;&bull;&nbsp;</td><td style="padding: 10px 0; font-size: 9.5pt; color: #334155; line-height: 1.5;">{ins}</td></tr>' for ins in insights) if insights else "<tr><td style='padding:20px; text-align:center; color:#94a3b8;'>No seasonal insights generated.</td></tr>"}
  </table>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 3 — SEED DISTRIBUTION ANALYSIS
     ══════════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<table class="gov-header">
  <tr>
    <td style="text-align:left;"><span class="gov-header-title">AGRICE Season Analytics Report</span></td>
    <td style="text-align:right;"><span class="gov-header-desc">Barangay {barangay} &bull; {season_label}</span></td>
  </tr>
</table>

<div class="section-header">Seed Distribution Analysis</div>
<div class="section-subheader">Evaluation of seed assistance allocation in the barangay</div>

<div class="card" style="padding: 20px;">
  <div class="card-title" style="font-size:11pt; text-align:center;">Seed Assistance Overview</div>
  <div style="margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
          <th style="padding: 10px; text-align: left; font-weight: bold; color: #1e293b;">Seed Program Type</th>
          <th style="padding: 10px; text-align: center; font-weight: bold; color: #1e293b;">Bags Received</th>
          <th style="padding: 10px; text-align: center; font-weight: bold; color: #1e293b;">Total Weight (kg)</th>
          <th style="padding: 10px; text-align: right; font-weight: bold; color: #1e293b;">Allocation Share</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; text-align: left; font-weight: bold; color: #166534;">Hybrid Seeds (15kg/bag)</td>
          <td style="padding: 10px; text-align: center;">{summary.get('hybrid_bags', 0):,.0f}</td>
          <td style="padding: 10px; text-align: center;">{summary.get('hybrid_kg', 0):,.1f} kg</td>
          <td style="padding: 10px; text-align: right; font-weight: bold;">
            {hybrid_pct_str}
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; text-align: left; font-weight: bold; color: #2563eb;">Certified Seeds (20kg/bag)</td>
          <td style="padding: 10px; text-align: center;">{summary.get('inbred_bags', 0):,.0f}</td>
          <td style="padding: 10px; text-align: center;">{summary.get('inbred_kg', 0):,.1f} kg</td>
          <td style="padding: 10px; text-align: right; font-weight: bold;">
            {inbred_pct_str}
          </td>
        </tr>
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td style="padding: 12px 10px; text-align: left;">Total Seed Distribution</td>
          <td style="padding: 12px 10px; text-align: center;">{summary.get('total_dist_bags', 0):,.0f}</td>
          <td style="padding: 12px 10px; text-align: center;">{summary.get('total_dist_kg', 0):,.1f} kg</td>
          <td style="padding: 12px 10px; text-align: right;">100.0%</td>
        </tr>
      </tbody>
    </tbody>
    </table>
  </div>

  <div class="interp-box" style="margin-top: 25px;">
    <div class="interp-title">Seed Program Allocation Statement</div>
    <div class="interp-text">
      {dist_insight} Under the municipal rice initiative, premium seed types are strategically prioritized and delivered directly to validated local farmers to assure higher germination stability in Barangay {barangay}.
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 4 — PRODUCTION ANALYTICS
     ══════════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<table class="gov-header">
  <tr>
    <td style="text-align:left;"><span class="gov-header-title">AGRICE Season Analytics Report</span></td>
    <td style="text-align:right;"><span class="gov-header-desc">Barangay {barangay} &bull; {season_label}</span></td>
  </tr>
</table>

<div class="section-header">Production Analytics</div>
<div class="section-subheader">Total harvest output analyzed by corresponding seed programs</div>

<div class="card">
  <div class="card-title">Production Output by Seed Type (MT)</div>
  <div style="padding: 10px 0; text-align: center; width: 450px; margin: 0 auto;">
    {chart_img_tag('production')}
  </div>
  <div class="interp-box">
    <div class="interp-title">Interpretation</div>
    <div class="interp-text">
      The bar chart reflects the cumulative metric tons (MT) yielded from each primary seed program category. Total recorded yield produced by the farmers of Barangay {barangay} reached a volume of <strong>{summary.get('total_production_mt', 0):,.2f} MT</strong> this season. This performance maps the localized yield output and serves as the baseline for evaluating program productivity.
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 5 — YIELD ACHIEVEMENT ANALYTICS
     ══════════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<table class="gov-header">
  <tr>
    <td style="text-align:left;"><span class="gov-header-title">AGRICE Season Analytics Report</span></td>
    <td style="text-align:right;"><span class="gov-header-desc">Barangay {barangay} &bull; {season_label}</span></td>
  </tr>
</table>

<div class="section-header">Yield Achievement Analytics</div>
<div class="section-subheader">Calculated average yields and achievement scores relative to DA standards</div>

<div class="card">
  <div class="card-title">Achievement Rate vs DA Target Yield (%)</div>
  <div style="padding: 10px 0; text-align: center; width: 450px; margin: 0 auto;">
    {chart_img_tag('yield_achieve')}
  </div>
  <div class="interp-box">
    <div class="interp-title">Performance Interpretation</div>
    <div class="interp-text">
      {prod_insight} These ratings reflect the overall efficiency of local farms under Department of Agriculture standards, identifying critical yield bottlenecks and outlining where resources should be funneled next season.
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 6 — EXPECTED VS ACTUAL HARVEST
     ══════════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<table class="gov-header">
  <tr>
    <td style="text-align:left;"><span class="gov-header-title">AGRICE Season Analytics Report</span></td>
    <td style="text-align:right;"><span class="gov-header-desc">Barangay {barangay} &bull; {season_label}</span></td>
  </tr>
</table>

<div class="section-header">Expected vs Actual Harvest</div>
<div class="section-subheader">Variance assessment comparing projected crop targets and actual weight totals</div>



<div class="card" style="text-align: center; height: 210px; padding: 12px 16px;">
  <div class="card-title" style="text-align: left; margin-bottom: 5px;">Harvest Target Variance</div>
  <div style="padding: 5px 0; text-align: center;">
    {chart_img_tag('harvest_donut', width='340px')}
  </div>
</div>


<div class="card" style="padding: 12px 14px;">
  <div class="card-title">Variance Indicators</div>
  <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
    <thead>
      <tr style="background-color: #f1f5f9; border-bottom: 2.5px solid #cbd5e1;">
        <th style="padding: 8px; font-weight: bold; text-align: center; color: #1e293b;">Target Projected Volume</th>
        <th style="padding: 8px; font-weight: bold; text-align: center; color: #1e293b;">Actual Harvest Volume</th>
        <th style="padding: 8px; font-weight: bold; text-align: center; color: #1e293b;">Net Production Gap</th>
        <th style="padding: 8px; font-weight: bold; text-align: center; color: #1e293b;">Target Deficit Percentage</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0;">{total_expected_kg:,.0f} kg</td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: #166534; border-bottom: 1px solid #e2e8f0;">{total_actual_kg:,.0f} kg</td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: {gap_color}; border-bottom: 1px solid #e2e8f0;">{harvest_gap_kg:,.0f} kg</td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: {gap_color}; border-bottom: 1px solid #e2e8f0;">{gap_pct_str}</td>
      </tr>
    </tbody>
  </table>
</div>

<div style="font-size: 7.5pt; color: #64748b; line-height: 1.4; font-style: italic; margin-top: -5px; margin-bottom: 15px; padding-left: 5px;">
  * Note: Target projections are strictly computed by multiplying the harvested area with Department of Agriculture yield standards.
</div>

<div class="card">
  <div class="card-title">Key Target Insights</div>
  <div class="interp-text">
    {harvest_insight} Strategic steps to minimize this variance include introducing robust agricultural practices and ensuring immediate field technician engagement.
  </div>
</div>






















<!-- ══════════════════════════════════════════════════════════
     PAGE 7 — CROP MONITORING ANALYTICS
     ══════════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<table class="gov-header">
  <tr>
    <td style="text-align:left;"><span class="gov-header-title">AGRICE Season Analytics Report</span></td>
    <td style="text-align:right;"><span class="gov-header-desc">Barangay {barangay} &bull; {season_label}</span></td>
  </tr>
</table>

<div class="section-header">Crop Monitoring Analytics</div>
<div class="section-subheader">Monitoring distribution across critical crop growing phases</div>


<table style="width:100%; border-collapse:collapse;">
  <tr>
    <td style="width:50%; vertical-align:top; padding-right:10px;">
      <div class="card" style="height:235px; padding: 12px 14px;">
        <div class="card-title" style="margin-bottom: 5px;">Active Stage Distribution</div>
        <div style="padding: 5px 0; text-align: center;">
          {chart_img_tag('phase_donut', width='250px')}
        </div>
      </div>
    </td>
    <td style="width:50%; vertical-align:top; padding-left:10px;">
      <div class="card" style="height:235px; padding: 12px 14px;">
        <div class="card-title" style="margin-bottom: 5px;">Phase Breakdown Table</div>
        <div style="padding: 5px 0; text-align: center;">
          {chart_img_tag('phase_break', width='250px')}
        </div>
      </div>
    </td>
  </tr>
</table>



<!-- Horizontal Status Panels -->
<table style="width:100%; border-collapse:collapse; margin-top:10px;">
  <tr>
    <td style="width:33.3%; padding-right:8px;">
      <div style="background:#fefce8; border:1px solid #fde68a; border-radius:6px; padding:10px; text-align:center;">
        <span style="font-size:16pt; font-weight:800; color:#b45309; display:block; line-height:1;">{crop_phase.get('delayed_count', 0)}</span>
        <span style="font-size:7pt; font-weight:bold; color:#b45309; text-transform:uppercase; margin-top:3px; display:block;">Farms Delayed</span>
      </div>
    </td>
    <td style="width:33.3%; padding:0 4px;">
      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:10px; text-align:center;">
        <span style="font-size:16pt; font-weight:800; color:#b91c1c; display:block; line-height:1;">{crop_phase.get('damaged_count', 0)}</span>
        <span style="font-size:7pt; font-weight:bold; color:#b91c1c; text-transform:uppercase; margin-top:3px; display:block;">Farms Damaged</span>
      </div>
    </td>
    <td style="width:33.3%; padding-left:8px;">
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:10px; text-align:center;">
        <span style="font-size:16pt; font-weight:800; color:#166534">{crop_phase.get('total_monitored', 0)}</span>
        <span style="font-size:7pt; font-weight:bold; color:#166534; text-transform:uppercase; margin-top:3px; display:block;">Total Monitored</span>
      </div>
    </td>
  </tr>
</table>

<div class="card" style="margin-top: 15px;">
  <div class="card-title">Monitoring Phase Analysis</div>
  <div class="interp-text">
    {phase_insight}
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 8 — FARMER PERFORMANCE ANALYSIS
     ══════════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<table class="gov-header">
  <tr>
    <td style="text-align:left;"><span class="gov-header-title">AGRICE Season Analytics Report</span></td>
    <td style="text-align:right;"><span class="gov-header-desc">Barangay {barangay} &bull; {season_label}</span></td>
  </tr>
</table>

<div class="section-header">Farmer Performance Analysis</div>
<div class="section-subheader">Individual farmer efficiency rankings and yield targets comparison</div>

<table class="data-table">
  <thead>
    <tr>
      <th style="text-align:left;">Farmer Name</th>
      <th>Seed Program</th>
      <th>Planted Area</th>
      <th>DA Target</th>
      <th>Actual Harvest</th>
      <th>Achievement</th>
      <th>Efficiency Status</th>
    </tr>
  </thead>
  <tbody>
    {perf_rows_html if perf_rows_html else '<tr><td colspan="7" style="padding:15px;color:#94a3b8;">No harvest records encoded.</td></tr>'}
  </tbody>
</table>

<div class="card" style="margin-top: 15px;">
  <div class="card-title">Performance Insights</div>
  <div class="interp-text" style="font-size:9.5pt;">
    {farmer_insight}
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 9 — RECOMMENDATIONS & SIGNATORIES
     ══════════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<table class="gov-header">
  <tr>
    <td style="text-align:left;"><span class="gov-header-title">AGRICE Season Analytics Report</span></td>
    <td style="text-align:right;"><span class="gov-header-desc">Barangay {barangay} &bull; {season_label}</span></td>
  </tr>
</table>

<div class="section-header">Recommendations</div>
<div class="section-subheader">Data-driven advisory based on seasonal crop cycles</div>

<table style="width: 100%; border-collapse: collapse;">
  <tr>
    <td style="width: 50%; padding-right: 10px; vertical-align: top;">
      <div class="rec-block">
        <div class="rec-title">Production Management</div>
        <ul style="margin:0; padding-left: 15px; font-size: 8.5pt; color: #475569;">
          {reco_production_html}
        </ul>
      </div>
    </td>
    <td style="width: 50%; padding-left: 10px; vertical-align: top;">
      <div class="rec-block">
        <div class="rec-title">Seed Program Allocation</div>
        <ul style="margin:0; padding-left: 15px; font-size: 8.5pt; color: #475569;">
          {reco_seed_html}
        </ul>
      </div>
    </td>
  </tr>
  <tr style="height: 15px;"><td colspan="2"></td></tr>
  <tr>
    <td style="width: 50%; padding-right: 10px; vertical-align: top;">
      <div class="rec-block">
        <div class="rec-title">Crop Monitoring Schedule</div>
        <ul style="margin:0; padding-left: 15px; font-size: 8.5pt; color: #475569;">
          {reco_monitoring_html}
        </ul>
      </div>
    </td>
    <td style="width: 50%; padding-left: 10px; vertical-align: top;">
      <div class="rec-block">
        <div class="rec-title">Capacity Building Workshops</div>
        <ul style="margin:0; padding-left: 15px; font-size: 8.5pt; color: #475569;">
          {reco_capacity_html}
        </ul>
      </div>
    </td>
  </tr>
</table>

<!-- Signatories section -->

<div style="margin-top: 25mm; border-top: 1.5px solid 
#14532d; padding-top: 20px;">
  <table class="sig-table">
    <tr>
      <td style="text-align:left;">
        <span class="sig-space"></span>
        <span class="sig-name">RANDY F. LEONIDO</span>
        <span class="sig-title">Agricultural Technician</span>
      </td>
      <td style="text-align:center;">
        <span class="sig-space"></span>
        <span class="sig-name">{brgy_president_name}</span>
        <span class="sig-title">Noted by &nbsp;&bull;&nbsp; {brgy_president_role}</span>
      </td>
      <td style="text-align:right;">
        <span class="sig-space"></span>
        <span class="sig-name">JOANNA LYNN P. GONZALES</span>
        <span class="sig-title">OIC Municipal Agriculturist</span>
      </td>
    </tr>
  </table>
</div>

<div style="text-align: center; font-size: 7.5pt; color: #94a3b8; margin-top: 15px;">
  Page <pdf:pagenumber /> of <pdf:pagecount />
</div>



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
            
            
            if seed_key:
                        # STRICTLY FROM AT: Hanapin ang kaukulang Crop Establishment record na in-encode ng AT User
                        est_rec = CropMonitoringRecord.objects.filter(
                            farmer_id=fid,
                            crop_phase='ESTABLISHMENT',
                            seed_source=seed_key,
                            poll=active_poll
                        ).first()

                        if not est_rec:
                            # Fallback: same season+year but poll field may be null or mismatched
                            est_rec = CropMonitoringRecord.objects.filter(
                                farmer_id=fid,
                                crop_phase='ESTABLISHMENT',
                                seed_source=seed_key,
                            ).order_by('-id').first()

                        if est_rec and est_rec.area_monitored_ha:
                            farmer_map[fid]['area_by_seed_type'][seed_key] = float(est_rec.area_monitored_ha)




                            
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
