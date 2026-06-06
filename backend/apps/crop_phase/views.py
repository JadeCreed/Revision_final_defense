import datetime
from collections import Counter, defaultdict
from django.db.models import Count, Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdminUserRole
from apps.crop_monitoring.models import CropMonitoringRecord
from apps.seed_poll.models import Poll
from apps.distribution.models import DistributionEntry

PHASE_DISPLAY = {
    'DISTRIBUTION':  'Seed Distribution',
    'ESTABLISHMENT': 'Crop Establishment',
    'TILLERING':     'Tillering',
    'FLOWERING':     'Flowering',
    'RIPENING':      'Ripening',
    'HARVESTING':    'Harvesting',
}
PHASE_ORDER = [
    'DISTRIBUTION','ESTABLISHMENT','TILLERING',
    'FLOWERING','RIPENING','HARVESTING',
]
SEED_LABELS = {
    'HYBRID':   'Hybrid',
    'INBRED':   'Inbred',
    'OWN_SEED': 'Own Seed',
}
SEED_PHASES = {
    'HYBRID':   ['DISTRIBUTION','ESTABLISHMENT','TILLERING','FLOWERING','RIPENING','HARVESTING'],
    'INBRED':   ['DISTRIBUTION','ESTABLISHMENT','TILLERING','FLOWERING','RIPENING','HARVESTING'],
    'OWN_SEED': ['ESTABLISHMENT','TILLERING','FLOWERING','RIPENING','HARVESTING'],
}
STD_DAYS = {
    'WET': {
        'DISTRIBUTION':3,'ESTABLISHMENT':20,'TILLERING':45,
        'FLOWERING':20,'RIPENING':40,'HARVESTING':5,
    },
    'DRY': {
        'DISTRIBUTION':3,'ESTABLISHMENT':20,'TILLERING':45,
        'FLOWERING':20,'RIPENING':50,'HARVESTING':5,
    },
}


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


def get_latest_per_farmer(qs):
    seen = {}
    for rec in qs.order_by('farmer_id', 'seed_source', '-date_observed', '-encoded_at'):
        key = (rec.farmer_id, rec.seed_source)
        if key not in seen:
            seen[key] = rec
    return seen


class CropPhaseAnalyticsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        poll_id     = request.query_params.get('poll_id')
        seed_filter = request.query_params.get('seed_type', '').upper()
        poll        = get_active_poll(poll_id)
        season      = poll.season if poll else 'WET'
        yr          = poll.year   if poll else datetime.date.today().year
        std         = STD_DAYS.get(season, STD_DAYS['WET'])

        base = CropMonitoringRecord.objects.all()
        if poll:
            base = base.filter(poll=poll)
        if seed_filter and seed_filter in SEED_LABELS:
            base = base.filter(seed_source=seed_filter)

        latest_map     = get_latest_per_farmer(base)
        latest_records = list(latest_map.values())

        # ── KPIs ──────────────────────────────────────────────
        total_farmers = len(set(rec.farmer_id for rec in latest_records))
        total_area    = sum(
            float(rec.area_monitored_ha or 0)
            for rec in latest_records
            if rec.area_monitored_ha
        )
        phase_counts   = Counter(rec.crop_phase for rec in latest_records)
        dominant_phase = phase_counts.most_common(1)[0][0] if phase_counts else None

        delayed_records = [r for r in latest_records if r.phase_status == 'DELAYED']
        delayed_farmers = len(set(r.farmer_id for r in delayed_records))
        avg_delay = (
            sum(r.delay_days or 0 for r in delayed_records) / len(delayed_records)
            if delayed_records else 0
        )
        damaged_records = [r for r in latest_records if r.phase_status == 'DAMAGED']
        damaged_farmers = len(set(r.farmer_id for r in damaged_records))

        # ── GANTT ─────────────────────────────────────────────
        gantt_data = {}
        seeds_to_process = (
            [seed_filter] if seed_filter and seed_filter in SEED_LABELS
            else ['HYBRID', 'INBRED', 'OWN_SEED']
        )

        if season == 'WET':
            season_start = datetime.date(yr, 6, 1)
        else:
            season_start = datetime.date(yr, 11, 1)

        def build_std_windows(seed_key):
            phases  = SEED_PHASES.get(seed_key, [])
            windows = {}
            cursor  = 0
            for ph in phases:
                d        = std.get(ph, 0)
                ph_start = season_start + datetime.timedelta(days=cursor)
                ph_end   = season_start + datetime.timedelta(days=cursor + d - 1)
                windows[ph] = {
                    'start':   ph_start,
                    'end':     ph_end,
                    'days':    d,
                }
                cursor += d
            return windows

        for seed_key in seeds_to_process:
            gantt_data[seed_key] = {}

            seed_all        = base.filter(seed_source=seed_key)
            # Latest record per farmer for this seed type
            seed_latest_map = get_latest_per_farmer(seed_all)
            seed_latest     = list(seed_latest_map.values())
            total_seed_farmers = len(set(r.farmer_id for r in seed_latest))

            std_windows = build_std_windows(seed_key)

            for phase_key in SEED_PHASES.get(seed_key, []):
                win = std_windows.get(phase_key)
                if not win:
                    continue

                std_start_iso = win['start'].isoformat()
                std_end_iso   = win['end'].isoformat()
                std_days_val  = win['days']

                # Use LATEST record per farmer only (not all historical)
                # A farmer's current phase = their latest record
                phase_latest = [r for r in seed_latest if r.crop_phase == phase_key]
                total_in_phase = len(phase_latest)

                # FIX: always include phase even with 0 farmers
                # so frontend can still render the gray standard bar
                if total_in_phase == 0:
                    gantt_data[seed_key][phase_key] = {
                        'farmers':         0,
                        'valid_farmers':   0,
                        'delayed_farmers': 0,
                        'early_farmers':   0,
                        'total_farmers':   total_seed_farmers,
                        'completion_pct':  None,
                        'mode_date':       None,
                        'mode_count':      0,
                        'all_delayed':     False,
                        'std_start':       std_start_iso,
                        'std_end':         std_end_iso,
                        'std_days':        std_days_val,
                    }
                    continue

                # Categorize by date vs standard window
                valid_recs   = [r for r in phase_latest if win['start'] <= r.date_observed <= win['end']]
                delayed_recs = [r for r in phase_latest if r.date_observed > win['end']]
                early_recs   = [r for r in phase_latest if r.date_observed < win['start']]

                valid_count   = len(valid_recs)
                delayed_count = len(delayed_recs)
                early_count   = len(early_recs)
                all_delayed   = (valid_count == 0 and delayed_count > 0)

                # completion_pct = valid farmers / total in this phase
                completion_pct = (
                    round((valid_count / total_in_phase) * 100)
                    if total_in_phase > 0 else None
                )

                # Mode date — from VALID records first
                mode_date  = None
                mode_count = 0

                if valid_recs:
                    # Most common date within standard window
                    date_counter = Counter(r.date_observed for r in valid_recs)
                    mode_date, mode_count = date_counter.most_common(1)[0]
                elif all_delayed:
                    # Fallback: most common delayed date
                    date_counter = Counter(r.date_observed for r in delayed_recs)
                    if date_counter:
                        mode_date, mode_count = date_counter.most_common(1)[0]

                gantt_data[seed_key][phase_key] = {
                    'farmers':         total_in_phase,
                    'valid_farmers':   valid_count,
                    'delayed_farmers': delayed_count,
                    'early_farmers':   early_count,
                    'total_farmers':   total_seed_farmers,
                    'completion_pct':  completion_pct,
                    'mode_date':       mode_date.isoformat() if mode_date else None,
                    'mode_count':      mode_count,
                    'all_delayed':     all_delayed,
                    'std_start':       std_start_iso,
                    'std_end':         std_end_iso,
                    'std_days':        std_days_val,
                }

        if season == 'WET':
            timeline_months = [
                {'month': 6, 'label': 'Jun', 'year': yr},
                {'month': 7, 'label': 'Jul', 'year': yr},
                {'month': 8, 'label': 'Aug', 'year': yr},
                {'month': 9, 'label': 'Sep', 'year': yr},
                {'month': 10, 'label': 'Oct', 'year': yr},
            ]
        else:
            timeline_months = [
                {'month': 11, 'label': 'Nov', 'year': yr},
                {'month': 12, 'label': 'Dec', 'year': yr},
                {'month': 1, 'label': 'Jan', 'year': yr + 1},
                {'month': 2, 'label': 'Feb', 'year': yr + 1},
                {'month': 3, 'label': 'Mar', 'year': yr + 1},
                {'month': 4, 'label': 'Apr', 'year': yr + 1},
            ]

        # ── DISTRIBUTION DATES ────────────────────────────────
        dist_dates = {}
        for seed_key in ['HYBRID','INBRED']:
            dist_qs = DistributionEntry.objects.filter(
                batch__status='APPROVED',
                date_received__isnull=False,
            )
            if seed_key == 'HYBRID':
                dist_qs = dist_qs.filter(batch__event__seed_type__name__icontains='hybrid')
            else:
                dist_qs = dist_qs.filter(batch__event__seed_type__name__icontains='inbred')
            if poll:
                dist_qs = dist_qs.filter(
                    batch__event__season=poll.season,
                    batch__event__year=poll.year,
                )
            date_groups = (
                dist_qs
                .values('date_received')
                .annotate(cnt=Count('farmer', distinct=True))
                .order_by('-cnt','date_received')
            )
            if date_groups.exists():
                d = date_groups.first()
                dist_dates[seed_key] = {
                    'date':  d['date_received'].isoformat(),
                    'count': d['cnt'],
                    'total': dist_qs.values('farmer').distinct().count(),
                }

        # ── PHASE DISTRIBUTION ────────────────────────────────
        phase_distribution = [
            {
                'phase':   ph,
                'label':   PHASE_DISPLAY[ph],
                'farmers': sum(1 for r in latest_records if r.crop_phase == ph),
            }
            for ph in PHASE_ORDER
        ]

        # ── AREA MONITORING ───────────────────────────────────
        area_data = {}
        for seed_key in ['HYBRID','INBRED']:
            actual = sum(
                float(r.area_monitored_ha or 0)
                for r in latest_records
                if r.seed_source == seed_key and r.area_monitored_ha
            )
            if seed_key == 'HYBRID':
                dist_q = DistributionEntry.objects.filter(
                    batch__status='APPROVED',
                    batch__event__seed_type__name__icontains='hybrid',
                    farm_area_ha__isnull=False,
                )
            else:
                dist_q = DistributionEntry.objects.filter(
                    batch__status='APPROVED',
                    batch__event__seed_type__name__icontains='inbred',
                    farm_area_ha__isnull=False,
                )
            # FIX: always filter by poll season/year
            if poll:
                dist_q = dist_q.filter(
                    batch__event__season=poll.season,
                    batch__event__year=poll.year,
                )
            planned = float(dist_q.aggregate(s=Sum('farm_area_ha'))['s'] or 0)
            pct     = round((actual / planned * 100), 1) if planned > 0 else None
            area_data[seed_key] = {
                'label':   SEED_LABELS[seed_key],
                'planned': planned,
                'actual':  actual,
                'pct':     pct,
                'met':     actual >= planned and planned > 0,
            }
        # Own Seed — no planned area from distribution
        own_actual = sum(
            float(r.area_monitored_ha or 0)
            for r in latest_records
            if r.seed_source == 'OWN_SEED' and r.area_monitored_ha
        )
        area_data['OWN_SEED'] = {
            'label':   'Own Seed',
            'planned': None,
            'actual':  own_actual,
            'pct':     None,
            'met':     False,
        }

        # ── COMPLIANCE — per seed type level (not just total area) ──
        farmer_seed_planned = defaultdict(float)
        farmer_seed_actual = defaultdict(float)

        dist_compliance = DistributionEntry.objects.filter(
            batch__status='APPROVED',
            farm_area_ha__isnull=False,
        ).select_related('batch__event__seed_type')
        if poll:
            dist_compliance = dist_compliance.filter(
                batch__event__season=poll.season,
                batch__event__year=poll.year,
            )
        for entry in dist_compliance:
            stype = entry.batch.event.seed_type
            if not stype:
                continue
            sname = stype.name.upper()
            if 'HYBRID' in sname:
                sk = 'HYBRID'
            elif 'INBRED' in sname:
                sk = 'INBRED'
            else:
                continue
            farmer_seed_planned[(entry.farmer_id, sk)] += float(entry.farm_area_ha or 0)

        for rec in latest_records:
            if rec.seed_source not in ('HYBRID', 'INBRED'):
                continue
            if rec.area_monitored_ha:
                farmer_seed_actual[(rec.farmer_id, rec.seed_source)] += float(rec.area_monitored_ha or 0)

        farmer_ids_with_plan = set(fid for (fid, _) in farmer_seed_planned)
        met = 0
        not_met = 0
        partial = 0

        for fid in farmer_ids_with_plan:
            seed_results = {}
            farmer_fully_met = True
            farmer_any_met = False
            for (f, sk), planned_ha in farmer_seed_planned.items():
                if f != fid or planned_ha <= 0:
                    continue
                actual_ha = farmer_seed_actual.get((fid, sk), 0)
                is_met = actual_ha >= planned_ha
                seed_results[sk] = {
                    'planned': planned_ha,
                    'actual': actual_ha,
                    'met': is_met,
                }
                if is_met:
                    farmer_any_met = True
                else:
                    farmer_fully_met = False

            if farmer_fully_met and seed_results:
                met += 1
            elif farmer_any_met:
                partial += 1
                not_met += 1
            else:
                not_met += 1

        comp_total = met + not_met
        comp_pct = round((met / comp_total * 100), 1) if comp_total > 0 else 0

        compliance = {
            'met': met,
            'not_met': not_met,
            'partial': partial,
            'total': comp_total,
            'pct': comp_pct,
        }

        # ── DELAY ANALYTICS ───────────────────────────────────
        delay_by_seed = {}
        for seed_key in ['HYBRID','INBRED','OWN_SEED']:
            seed_latest = [r for r in latest_records if r.seed_source == seed_key]
            total_s     = len(set(r.farmer_id for r in seed_latest))
            delayed_s   = len(set(r.farmer_id for r in seed_latest if r.phase_status == 'DELAYED'))
            delay_by_seed[seed_key] = {
                'label':   SEED_LABELS[seed_key],
                'on_time': total_s - delayed_s,
                'delayed': delayed_s,
                'total':   total_s,
                'rate':    round((delayed_s / total_s * 100), 1) if total_s > 0 else 0,
            }

        # ── DAMAGE ANALYTICS ──────────────────────────────────
        damage_sources = [r for r in latest_records if r.phase_status == 'DAMAGED' and r.damage_cause]
        if seed_filter and seed_filter in SEED_LABELS:
            damage_sources = [r for r in damage_sources if r.seed_source == seed_filter]
        cause_counts = Counter(r.damage_cause.strip().title() for r in damage_sources)
        total_damage = sum(cause_counts.values())
        cause_of_damage = sorted([
            {'cause': k, 'count': v, 'pct': round(v / total_damage * 100, 1) if total_damage > 0 else 0}
            for k, v in cause_counts.items()
        ], key=lambda x: -x['count'])

        # ── GANTT ALERT ───────────────────────────────────────
        gantt_alert = None
        best_delayed = 0
        for ph in PHASE_ORDER:
            d = sum(1 for r in latest_records if r.crop_phase == ph and r.phase_status == 'DELAYED')
            t = sum(1 for r in latest_records if r.crop_phase == ph)
            if d > best_delayed:
                best_delayed = d
                gantt_alert  = {
                    'phase':   ph,
                    'label':   PHASE_DISPLAY[ph],
                    'delayed': d,
                    'total':   t,
                    'pct':     round(d / t * 100, 1) if t > 0 else 0,
                }

        # ── ATTENTION LIST ────────────────────────────────────
        seen_att      = set()
        attention_list = []
        for r in sorted(latest_records, key=lambda x: x.date_observed, reverse=True):
            if r.phase_status not in ('DELAYED','DAMAGED'):
                continue
            key = (r.farmer_id, r.seed_source)
            if key in seen_att:
                continue
            seen_att.add(key)
            attention_list.append({
                'farmer_id':    r.farmer_id,
                'farmer_name':  r.farmer.get_full_name(),
                'barangay':     r.barangay,
                'seed_type':    r.seed_source,
                'seed_label':   SEED_LABELS.get(r.seed_source, r.seed_source),
                'phase':        PHASE_DISPLAY.get(r.crop_phase, r.crop_phase),
                'status':       r.phase_status,
                'delay_days':   r.delay_days,
                'damage_cause': r.damage_cause or '',
                'date_observed': r.date_observed.isoformat(),
            })

        # ── INSIGHTS ──────────────────────────────────────────
        total_in_dist     = sum(phase_counts.values()) or 1
        total_planned_all = sum(v['planned'] or 0 for v in area_data.values())
        total_actual_all  = sum(v['actual']  for v in area_data.values())
        area_pct_overall  = round((total_actual_all / total_planned_all * 100), 1) if total_planned_all > 0 else None
        highest_delay_seed = max(delay_by_seed.items(), key=lambda x: x[1]['delayed']) if delay_by_seed else None
        top_damage = cause_of_damage[0] if cause_of_damage else None

        insights = {
            'most_active_phase': {
                'phase': dominant_phase,
                'label': PHASE_DISPLAY.get(dominant_phase,'—') if dominant_phase else '—',
                'count': phase_counts.get(dominant_phase, 0) if dominant_phase else 0,
                'pct':   round(phase_counts.get(dominant_phase,0) / total_in_dist * 100) if dominant_phase else 0,
            },
            'area_performance': {
                'planned':   round(total_planned_all, 2),
                'actual':    round(total_actual_all,  2),
                'pct':       area_pct_overall,
                'remaining': round(max(0, total_planned_all - total_actual_all), 2),
            },
            'planting_compliance': {'pct': comp_pct, 'met': met, 'not_met': not_met},
            'delay_alert': {
                'seed_type':     highest_delay_seed[0] if highest_delay_seed else None,
                'seed_label':    SEED_LABELS.get(highest_delay_seed[0],'—') if highest_delay_seed else '—',
                'count':         highest_delay_seed[1]['delayed'] if highest_delay_seed else 0,
                'total_delayed': delayed_farmers,
            },
            'risk_alert': {
                'cause': top_damage['cause'] if top_damage else None,
                'count': top_damage['count'] if top_damage else 0,
                'pct':   top_damage['pct']   if top_damage else 0,
            },
            'attention_required': len(attention_list),
            'gantt_alert':        gantt_alert,
        }

        poll_list = [
            {
                'id':     p['id'],
                'label':  f"{'Wet' if p['season']=='WET' else 'Dry'} Season {p['year']}",
                'season': p['season'],
                'year':   p['year'],
                'status': p['status'],
            }
            for p in Poll.objects.order_by('-created_at').values('id','season','year','status')
        ]

        return Response({
            'poll':             {'id': poll.id if poll else None, 'season': season, 'year': yr, 'status': poll.status if poll else None, 'label': f"{'Wet' if season=='WET' else 'Dry'} Season {yr}" if poll else '—'},
            'kpi':              {'total_farmers': total_farmers, 'total_area_ha': round(total_area,2), 'delayed_farmers': delayed_farmers, 'damaged_farmers': damaged_farmers, 'avg_delay_days': round(float(avg_delay),1), 'dominant_phase': dominant_phase, 'dominant_label': PHASE_DISPLAY.get(dominant_phase,'—') if dominant_phase else '—', 'dominant_count': phase_counts.get(dominant_phase,0) if dominant_phase else 0},
            'gantt':            gantt_data,
            'dist_dates':       dist_dates,
            'phase_distribution': phase_distribution,
            'area_data':        area_data,
            'compliance':       compliance,
            'delay_by_seed':    delay_by_seed,
            'cause_of_damage':  cause_of_damage,
            'attention_list':   attention_list,
            'insights':         insights,
            'poll_list':        poll_list,
            'std_days':         STD_DAYS,
            'timeline_months':  timeline_months,
        })