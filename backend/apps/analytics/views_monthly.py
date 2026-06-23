# apps/analytics/views_monthly.py
import datetime
from io import BytesIO
import base64
import os
from django.conf import settings
from django.http import HttpResponse
from django.db.models import Sum, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from xhtml2pdf import pisa

from apps.accounts.permissions import IsAdminUserRole
from apps.crop_monitoring.models import CropMonitoringRecord
from apps.production.models import HarvestRecord
from apps.distribution.models import DistributionEntry
from apps.seed_poll.models import Poll

STANDARD_YIELDS = getattr(settings, 'STANDARD_YIELDS', {'HYBRID': 5000, 'INBRED': 3500, 'OWN_SEED': 2000})

def dry_weight_kg(record):
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
    if pct is None: return 'N/A'
    if pct > 100: return 'Exceeded Target'
    if pct >= 80:  return 'Achieved Target'
    if pct >= 70:  return 'Near Target'
    if pct >= 50:  return 'Below Target'
    return 'Critical'

def _build_monthly_data(season, year, month_num=None, barangay=None):
    # Base filter criteria
    dist_filter = Q(batch__status='APPROVED', batch__event__season=season, batch__event__year=year)
    mon_filter  = Q(poll__season=season, poll__year=year)
    har_filter  = Q(poll__season=season, poll__year=year)

    if barangay:
        dist_filter &= Q(farmer__barangay=barangay)
        mon_filter  &= Q(barangay=barangay)
        har_filter  &= Q(barangay=barangay)

    if month_num:
        dist_filter &= Q(date_received__month=month_num)
        mon_filter  &= Q(date_observed__month=month_num)
        har_filter  &= Q(harvest_date__month=month_num)

    dist_qs = DistributionEntry.objects.filter(dist_filter).select_related('farmer', 'variety', 'batch__event__seed_type')
    mon_qs  = CropMonitoringRecord.objects.filter(mon_filter).select_related('farmer')
    har_qs  = HarvestRecord.objects.filter(har_filter).select_related('farmer')

    # Distribution calculations
    total_dist_bags = sum(float(e.qty_bags or 0) for e in dist_qs)
    total_dist_kg = sum(float(e.qty_bags or 0) * (15 if 'HYBRID' in (getattr(e.batch.event.seed_type, 'name', '') or '').upper() else 20) for e in dist_qs)

    # Hybrid vs Inbred detailed calculations
    hybrid_bags = inbred_bags = 0
    hybrid_kg_total = inbred_kg_total = 0
    for e in dist_qs:
        seed_name = (getattr(e.batch.event.seed_type, 'name', '') or '').upper()
        bags = float(e.qty_bags or 0)
        if 'HYBRID' in seed_name:
            hybrid_bags      += bags
            hybrid_kg_total  += round(bags * 15, 2)
        elif 'INBRED' in seed_name:
            inbred_bags      += bags
            inbred_kg_total  += round(bags * 20, 2)

    # Crop Phase counts
    phase_counts = {}
    delayed_count = 0
    damaged_count = 0
    for rec in mon_qs:
        phase = rec.get_crop_phase_display()
        phase_counts[phase] = phase_counts.get(phase, 0) + 1
        st = (getattr(rec, 'phase_status', '') or '').upper()
        if st == 'DELAYED': delayed_count += 1
        elif st == 'DAMAGED': damaged_count += 1

    # Harvest Production calculations
    total_area = sum(float(h.harvest_area_ha or 0) for h in har_qs)
    total_bags = sum(float(h.harvest_bags or 0) for h in har_qs)
    total_mt = (total_bags * 50) / 1000
    avg_yield = (total_mt / total_area) if total_area > 0 else 0

    util_vals = [utilization_pct(h) for h in har_qs if utilization_pct(h) is not None]
    avg_util = sum(util_vals) / len(util_vals) if util_vals else None

    # Consolidated Transaction Registry
    records = []
    for entry in dist_qs:
        records.append({
            'date': entry.date_received.isoformat() if entry.date_received else '',
            'farmer_name': entry.farmer.get_full_name(),
            'barangay': entry.farmer.barangay or 'Unknown',
            'type': 'Seed Distribution',
            'details': f"Received {entry.qty_bags} bags of {entry.variety.name if entry.variety else 'variety seeds'}"
        })

    for rec in mon_qs:
        records.append({
            'date': rec.date_observed.isoformat() if rec.date_observed else '',
            'farmer_name': rec.farmer.get_full_name(),
            'barangay': rec.barangay or 'Unknown',
            'type': f"Crop Phase ({rec.get_crop_phase_display()})",
            'details': f"Status: {rec.get_phase_status_display()} - Area: {rec.area_monitored_ha or 0:.2f} ha"
        })

    for h in har_qs:
        records.append({
            'date': h.harvest_date.isoformat() if h.harvest_date else '',
            'farmer_name': h.farmer.get_full_name(),
            'barangay': h.barangay or 'Unknown',
            'type': 'Harvest Recorded',
            'details': f"Harvested {h.harvest_bags} bags ({dry_weight_kg(h)/1000:.2f} MT) over {h.harvest_area_ha} ha"
        })

    records.sort(key=lambda x: x['date'], reverse=True)

    by_seed_type = []
    for src in ['HYBRID', 'INBRED', 'OWN_SEED']:
        group = [h for h in har_qs if h.seed_source == src]
        area = sum(float(h.harvest_area_ha or 0) for h in group)
        mt = sum(dry_weight_kg(h) for h in group) / 1000
        by_seed_type.append({
            'seed_source': src,
            'label': 'Hybrid' if src == 'HYBRID' else 'Inbred' if src == 'INBRED' else 'Own Seed',
            'farmer_count': len(group),
            'total_area_ha': round(area, 2),
            'total_mt': round(mt, 2),
        })

    insights = []
    if total_dist_kg > 0:
        insights.append(f"Completed seed logistics with {total_dist_bags:.0f} bags ({total_dist_kg:,.1f} kg) distributed.")
    if mon_qs.count() > 0:
        insights.append(f"Logged {mon_qs.count()} crop monitoring evaluations. {delayed_count} delayed evaluations flagged.")
    if total_mt > 0:
        insights.append(f"Harvest production reached {total_mt:.2f} MT with average yield of {avg_yield:.2f} t/ha.")

    return {
        'summary': {
            'total_dist_bags':     total_dist_bags,
            'total_dist_kg':       total_dist_kg,
            'total_monitored':     mon_qs.count(),
            'total_production_mt': round(total_mt, 2),
            'total_area_ha':       round(total_area, 2),
            'avg_yield_t_ha':      round(avg_yield, 2),
            'avg_util_pct':        round(avg_util, 1) if avg_util is not None else '—',
            'overall_tier':        get_tier_label(avg_util),
            'hybrid_bags':         round(hybrid_bags, 2),
            'hybrid_kg':           round(hybrid_kg_total, 2),
            'inbred_bags':         round(inbred_bags, 2),
            'inbred_kg':           round(inbred_kg_total, 2),
        },
        'by_seed_type': by_seed_type,
        'crop_phase_summary': {
            'phase_counts': phase_counts,
            'total_monitored': mon_qs.count(),
            'delayed_count': delayed_count,
            'damaged_count': damaged_count,
        },
        'records': records,
        'insights': insights,
    }

class AdminMonthlyAnalyticsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        season      = request.query_params.get('season', '').upper()
        year        = request.query_params.get('year')
        month       = request.query_params.get('month')
        barangay    = request.query_params.get('barangay')

        if not season or not year:
            return Response({'error': 'Season and year are required parameters.'}, status=400)

        month_num = int(month) if month and month.isdigit() else None
        data = _build_monthly_data(season, int(year), month_num, barangay)
        return Response(data)

class AdminMonthlyAnalyticsPDFView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request):
        try:
            from xhtml2pdf import pisa
        except ImportError:
            return Response({'error': 'xhtml2pdf is not installed.'}, status=500)

        season      = request.data.get('season', '').upper()
        year        = request.data.get('year')
        month       = request.data.get('month')
        barangay    = request.data.get('barangay')
        charts      = request.data.get('charts', {}) or {}

        if not season or not year:
            return Response({'error': 'Missing season or year'}, status=400)

        month_num = int(month) if month and month.isdigit() else None
        data = _build_monthly_data(season, int(year), month_num, barangay)

        months_names = {1:'January', 2:'February', 3:'March', 4:'April', 5:'May', 6:'June', 7:'July', 8:'August', 9:'September', 10:'October', 11:'November', 12:'December'}
        month_label = months_names.get(month_num, 'All Months')
        today_date_str = datetime.date.today().strftime('%B %d, %Y')

        # Show harvest section dynamically ONLY if actual harvest data exists in the DB for this monthly filter
        show_harvest = data['summary']['total_production_mt'] > 0

        # Load Logo
        logo_b64 = ''
        logo_path = os.path.join(settings.BASE_DIR, 'static', 'logo.png')
        try:
            with open(logo_path, 'rb') as f:
                logo_b64 = base64.b64encode(f.read()).decode('utf-8')
        except Exception:
            pass

        logo_html = f'<img src="data:image/png;base64,{logo_b64}" style="width:75px;height:75px;" />' if logo_b64 else ''

        # Dynamic Section Statements
        dist_pct_str = "0.0%"
        total_dist_kg = data['summary']['total_dist_kg']
        if total_dist_kg > 0:
            dist_pct_str = "100.0%"

        # Charts parsing
        dist_chart_html = ''
        if charts.get('dist_chart'):
            dist_chart_html = f'<img src="data:image/png;base64,{charts["dist_chart"]}" style="width:100%;height:auto;border-radius:6px;" />'
        else:
            dist_chart_html = '<div style="background:#f8fafc;border:1px dashed #cbd5e1;padding:25px;text-align:center;color:#94a3b8;font-size:8pt;">Chart will render from system dashboard</div>'

        phase_chart_html = ''
        if charts.get('phase_donut'):
            phase_chart_html = f'<img src="data:image/png;base64,{charts["phase_donut"]}" style="width:100%;height:auto;border-radius:6px;" />'
        else:
            phase_chart_html = '<div style="background:#f8fafc;border:1px dashed #cbd5e1;padding:25px;text-align:center;color:#94a3b8;font-size:8pt;">Chart will render from system dashboard</div>'

        harvest_chart_html = ''
        if charts.get('harvest_yield'):
            harvest_chart_html = f'<img src="data:image/png;base64,{charts["harvest_yield"]}" style="width:100%;height:auto;border-radius:6px;" />'
        else:
            harvest_chart_html = '<div style="background:#f8fafc;border:1px dashed #cbd5e1;padding:25px;text-align:center;color:#94a3b8;font-size:8pt;">Chart will render from system dashboard</div>'

        # ── CRISP DATE FORMATTING (Nakatipid sa width ng Table at iwas overlap) ──
        records_html = ''
        for r in data['records'][:35]:
            try:
                date_part = r['date'].split('T')[0] if 'T' in r['date'] else r['date']
                dt = datetime.datetime.strptime(date_part, '%Y-%m-%d')
                date_str = dt.strftime('%b %d, %Y') # Gagawing "Oct 20, 2025" imbes na "2025-10-20"
            except Exception:
                date_str = r['date'][:10] if r.get('date') else '—'

            records_html += f"""
            <tr>
              <td style="text-align:left;padding-left:8px;white-space:nowrap;">{date_str}</td>
              <td style="font-weight:bold;color:#1e293b;text-align:left;">{r['farmer_name']}</td>
              <td>{r['barangay']}</td>
              <td>{r['type']}</td>
              <td style="text-align:left;">{r['details']}</td>
            </tr>"""

        # Dynamic Delay Analytics statement based on month
        delayed_count = data['crop_phase_summary']['delayed_count']
        delay_insight_str = "No active crop monitoring delays reported this month."
        if delayed_count > 0:
            delay_insight_str = f"A total of {delayed_count} farm monitoring records were flagged with active delays. Prompt field inspections and technical support are recommended to address growth bottlenecks."

        # Harvest Yield Page
        harvest_page_html = ""
        if show_harvest:
            harvest_page_html = f"""
            <div class="page-break"></div>
            <table class="gov-header">
              <tr>
                <td style="text-align:left;"><span class="gov-header-title">AGRICE Monthly Analytics Report</span></td>
                <td style="text-align:right;"><span class="gov-header-desc">{month_label} &bull; {season} {year}</span></td>
              </tr>
            </table>
            <div class="section-header">Graphical Performance Indicators (Harvest & Yield)</div>
            <div class="section-subheader">Data-driven visualizations of harvest outcomes and program-specific MT volumes</div>

            <div class="card" style="padding:15px; text-align:center;">
              <div style="font-weight:bold;font-size:11pt;color:#14532d;margin-bottom:10px;text-align:left;">Harvest Yield Analysis</div>
              <div style="width:360px;margin:0 auto;">
                {harvest_chart_html}
              </div>
              <div class="interp-box" style="margin-top:15px;text-align:left;">
                <div class="interp-title">Yield Analysis & Variance</div>
                <div class="interp-text" style="font-size:8.5pt;line-height:1.5;color:#374151">
                  Overall production reached {data['summary']['total_production_mt']} MT with an average yield of {data['summary']['avg_yield_t_ha']} t/ha. Performance indicator maps crop efficiency rating as {data['summary']['overall_tier']} ({data['summary']['avg_util_pct']}%).
                </div>
              </div>
            </div>
            """

        # Generate HTML report
        html_content = f"""
        <html>
        <head>
          <style>
            @page {{ size: A4; margin: 15mm 14mm; }}
            body {{ font-family: Arial, sans-serif; font-size: 9.5pt; color: #1e293b; line-height: 1.5; }}
            
            /* Anti-Overlap Page Breaks (Surgical Fix) */
            table {{ page-break-inside: auto; margin-top: 10px; }}
            .data-table tr {{ page-break-inside: avoid; }}
            
            /* Prevent Headings from being orphaned at the bottom of the page */
            h1, h2, h3, h4 {{ -pdf-keep-with-next: true; }}


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
            
            .page-break {{ page-break-before: always; }}
            .gov-header {{ border-bottom: 2px solid #166534; padding-bottom: 8px; margin-bottom: 15px; width: 100%; }}
            .gov-header-title {{ font-size: 7.5pt; color: #166534; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; }}
            .gov-header-desc {{ font-size: 10pt; color: #1e293b; font-weight: bold; }}
            
            .section-header {{ font-size: 13pt; font-weight: bold; color: #14532d; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px; }}
            .section-subheader {{ font-size: 8pt; color: #64748b; margin-top: -6px; margin-bottom: 8px; font-style: italic; }}

            .kpi-table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
            .kpi-cell {{ border: 1px solid #e2e8f0; padding: 12px 6px; width: 25%; text-align: center; background: #f8fafc; }}
            .kpi-lbl {{ font-size: 7.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; display: block; }}
            .kpi-val {{ font-size: 14pt; font-weight: 800; color: #14532d; display: block; margin-top: 4px; }}
            
            .card {{ border: 1.5px solid #e2e8f0; border-radius: 6px; background: white; margin-bottom: 15px; padding: 12px 16px; }}
            .card-title {{ font-size: 10.5pt; font-weight: bold; color: #0f172a; margin: 0 0 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }}
            
            .analytics-row {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; }}
            .analytics-cell {{ width: 50%; padding: 10px 12px; border: 1px solid #e2e8f0; background: white; vertical-align: top; }}
            
            .data-table {{ width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 15px; }}
            .data-table th {{ background: #14532d; color: white; padding: 8px 10px; font-weight: bold; font-size: 8pt; text-align: center; }}
            .data-table td {{ padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center; color: #334155; line-height: 1.4; vertical-align: middle; }}
            .data-table tr:nth-child(even) td {{ background: #f8fafc; }}
            
            .interp-box {{ background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 4px; margin-top: 10px; }}
            .interp-title {{ font-size: 8pt; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
            .interp-text {{ font-size: 9pt; color: #334155; line-height: 1.5; }}
            
            .sig-table {{ width: 100%; border-collapse: collapse; margin-top: 30px; }}
            .sig-table td {{ width: 50%; vertical-align: bottom; text-align: center; font-size: 8.5pt; }}
            .sig-space {{ height: 40px; display: block; }}
            .sig-name {{ font-weight: bold; text-decoration: underline; text-transform: uppercase; display: block; }}
            .sig-title {{ color: #64748b; font-size: 7.5pt; margin-top: 2px; display: block; }}
          </style>
        </head>
        <body>

        <!-- PAGE 1 — COVER PAGE -->
        <div class="cover-container">
          <div class="cover-govt">REPUBLIC OF THE PHILIPPINES</div>
          <div class="cover-govt">PROVINCE OF QUEZON</div>
          <div class="cover-lgu">MUNICIPALITY OF LUCBAN</div>
          
          <div class="cover-logo-wrapper">
            {logo_html}
          </div>
          
          <div class="cover-title" style="margin-top:20px;">MONTHLY AGRICULTURAL ANALYTICS REPORT</div>
          <div class="cover-subtitle" style="font-size:14pt;color:#15803d;margin-top:5px;margin-bottom:10px;">Barangay: {barangay or 'All Barangays'}</div>
          <div class="cover-subtitle">{month_label} &bull; {season} Season {year}</div>

          <table class="cover-meta" style="margin-top: 30mm;">
            <tr>
              <td style="text-align:left;">
                <span class="meta-label">Prepared For</span>
                <span class="meta-val">Municipal Agriculture Office</span><br />
                <span style="font-size:8.5pt;color:#64748b;">Lucban, Quezon</span>
              </td>
              <td style="text-align:right;">
                <span class="meta-label">Date Generated</span>
                <span class="meta-val">{today_date_str}</span><br />
                <span style="font-size:8.5pt;color:#64748b;">AGRICE Core Reports Engine</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- PAGE 2 — EXECUTIVE SUMMARY -->
        <div class="page-break"></div>
        <table class="gov-header">
          <tr>
            <td style="text-align:left;"><span class="gov-header-title">AGRICE Monthly Analytics Report</span></td>
            <td style="text-align:right;"><span class="gov-header-desc">{month_label} &bull; {season} Season {year}</span></td>
          </tr>
        </table>
        
        <div class="section-header">Executive Summary</div>
        <div class="section-subheader">Performance summary overview of the current season cycle</div>

        <table class="kpi-table">
          <tr>
            <td class="kpi-cell">
              <span class="kpi-lbl">Bags Distributed</span>
              <span class="kpi-val">{data['summary']['total_dist_bags']} bags</span>
            </td>
            <td class="kpi-cell">
              <span class="kpi-lbl">Farms Monitored</span>
              <span class="kpi-val">{data['summary']['total_monitored']} logs</span>
            </td>
            <td class="kpi-cell">
              <span class="kpi-lbl">Total Production</span>
              <span class="kpi-val">{data['summary']['total_production_mt']} MT</span>
            </td>
            <td class="kpi-cell">
              <span class="kpi-lbl">Average Yield</span>
              <span class="kpi-val">{data['summary']['avg_yield_t_ha']} t/ha</span>
            </td>
          </tr>
        </table>

        <div class="card" style="margin-top: 15px;">
          <div class="card-title">Seasonal & Monthly Insights</div>
          <table style="width: 100%; border-collapse: collapse;">
            {''.join(f'<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 25px; padding: 8px 0; vertical-align: top; color: #166534; font-size: 11pt;">&nbsp;&bull;&nbsp;</td><td style="padding: 8px 0; font-size: 9.5pt; color: #334155; line-height: 1.5;">{ins}</td></tr>' for ins in data['insights']) if data['insights'] else "<tr><td style='padding:20px; text-align:center; color:#94a3b8;'>No seasonal insights generated.</td></tr>"}
          </table>
        </div>

        <!-- PAGE 3 — GRAPHICAL REPRESENTATIONS (CHART 1 & 2) -->
        <div class="page-break"></div>
        <table class="gov-header">
          <tr>
            <td style="text-align:left;"><span class="gov-header-title">AGRICE Monthly Analytics Report</span></td>
            <td style="text-align:right;"><span class="gov-header-desc">{month_label} &bull; {season} {year}</span></td>
          </tr>
        </table>
        <div class="section-header">Graphical Performance Indicators (Seed Logistics & Crop Progress)</div>
        <div class="section-subheader">Data-driven visualizations of seed distribution outputs and active crop stage progress</div>

        <table class="analytics-row" style="width:100%;">
          <tr>
            <td class="analytics-cell" style="width:50%; padding:10px; border:1px solid #e2e8f0; vertical-align:top;">
              <div class="chart-title" style="font-weight:bold;margin-bottom:8px;">Seed Distribution by Program</div>
              {dist_chart_html}
              <div class="interp-box" style="margin-top:8px;">
                <div class="interp-title">Seed Logistics Statement</div>
                <div class="interp-text" style="font-size:7.5pt;line-height:1.4;color:#374151">
                  Completed day 1-5 seed logistics with {data['summary']['total_dist_bags']} bags ({data['summary']['total_dist_kg']:,} kg) allocated. Program ratio reached {dist_pct_str} total delivery target.
                </div>
              </div>
            </td>
            <td class="analytics-cell" style="width:50%; padding:10px; border:1px solid #e2e8f0; vertical-align:top;">
              <div class="chart-title" style="font-weight:bold;margin-bottom:8px;">Crop Phase Stage Breakdown</div>
              {phase_chart_html}
              <div class="interp-box" style="margin-top:8px;">
                <div class="interp-title">Delay & Damage Analytics</div>
                <div class="interp-text" style="font-size:7.5pt;line-height:1.4;color:#374151">
                  {delay_insight_str} Recorded {data['crop_phase_summary']['total_monitored']} active evaluations by field ATs this month.
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- PAGE 4 — DYNAMIC HARVEST CHART (Lilitaw lang kapag hindi early months) -->
        {harvest_page_html}

        <!-- PAGE 5 — MONTHLY ACTION LOGS -->
        <div class="page-break"></div>
        <table class="gov-header">
          <tr>
            <td style="text-align:left;"><span class="gov-header-title">AGRICE Monthly Analytics Report</span></td>
            <td style="text-align:right;"><span class="gov-header-desc">{month_label} &bull; {season} {year}</span></td>
          </tr>
        </table>
        <div class="section-header">Monthly Action Logs</div>
        <div class="section-subheader">Comprehensive transaction logs of all agricultural events executed this month</div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width:16%; text-align:center;">Date</th>
              <th style="width:24%; text-align:left;">Farmer Name</th>
              <th style="width:16%; text-align:center;">Barangay</th>
              <th style="width:20%; text-align:center;">Activity Type</th>
              <th style="width:24%; text-align:left;">Details</th>
            </tr>
          </thead>
          <tbody>
            {records_html if records_html else '<tr><td colspan="5" style="text-align:center;">No activity records for this period.</td></tr>'}
          </tbody>
        </table>

        <!-- SIGNATORIES -->
        <div style="margin-top: 25mm; border-top: 1.5px solid #14532d; padding-top: 20px;">
          <table class="sig-table">
            <tr>
              <td style="text-align:left;">
                <span class="sig-space"></span>
                <span class="sig-name">RANDY F. LEONIDO</span>
                <span class="sig-title">Agricultural Technician</span>
              </td>
              <td style="text-align:right;">
                <span class="sig-space"></span>
                <span class="sig-name">JOANNA LYNN P. GONZALES</span>
                <span class="sig-title">OIC Municipal Agriculturist</span>
              </td>
            </tr>
          </table>
        </div>

        </body>
        </html>"""

        buffer = BytesIO()
        pisa_status = pisa.CreatePDF(html_content, dest=buffer)
        
        if pisa_status.err:
            return Response({'error': 'PDF generation failed.'}, status=500)

        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Monthly_Report_{season}_{year}_{month_label}.pdf"'
        return response