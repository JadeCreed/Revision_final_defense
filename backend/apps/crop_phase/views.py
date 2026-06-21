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
# Gantt shows 5 phases only — no DISTRIBUTION row
GANTT_PHASES = ['ESTABLISHMENT', 'TILLERING', 'FLOWERING', 'RIPENING', 'HARVESTING']
PHASE_ORDER  = ['DISTRIBUTION', 'ESTABLISHMENT', 'TILLERING', 'FLOWERING', 'RIPENING', 'HARVESTING']

SEED_LABELS = {
    'HYBRID':   'Hybrid',
    'INBRED':   'Inbred',
    'OWN_SEED': 'Own Seed',
}
# Gantt phases per seed — all 3 start at Establishment (no DISTRIBUTION row)
SEED_PHASES = {
    'HYBRID':   ['ESTABLISHMENT', 'TILLERING', 'FLOWERING', 'RIPENING', 'HARVESTING'],
    'INBRED':   ['ESTABLISHMENT', 'TILLERING', 'FLOWERING', 'RIPENING', 'HARVESTING'],
    'OWN_SEED': ['ESTABLISHMENT', 'TILLERING', 'FLOWERING', 'RIPENING', 'HARVESTING'],
}
STD_DAYS = {
    'WET': {
        'DISTRIBUTION': 3, 'ESTABLISHMENT': 20, 'TILLERING': 45,
        'FLOWERING': 20, 'RIPENING': 40, 'HARVESTING': 5,
    },
    'DRY': {
        'DISTRIBUTION': 3, 'ESTABLISHMENT': 20, 'TILLERING': 45,
        'FLOWERING': 20, 'RIPENING': 50, 'HARVESTING': 5,
    },
}


def get_active_poll(poll_id=None):
    if poll_id:
        try:
            return Poll.objects.get(id=poll_id)
        except Poll.DoesNotExist:
            pass
    from apps.seed_poll.utils import get_current_poll
    return get_current_poll()


def get_latest_per_farmer(qs):
    """Latest record per (farmer, seed_source) combo."""
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

        # Base monitoring queryset — scoped to poll
        base = CropMonitoringRecord.objects.all()
        if poll:
            base = base.filter(poll=poll)
        if seed_filter and seed_filter in SEED_LABELS:
            base = base.filter(seed_source=seed_filter)

        latest_map     = get_latest_per_farmer(base)
        latest_records = list(latest_map.values())

        # ── KPIs ──────────────────────────────────────────────
        # Farmers monitored = AT-encoded only (no distribution-only)
        monitored_farmer_ids = set(rec.farmer_id for rec in latest_records)
        total_farmers        = len(monitored_farmer_ids)

        # Area monitored: SUM of latest area per (farmer, seed_source) — avoid double counting
        total_area = sum(
            float(rec.area_monitored_ha or 0)
            for rec in latest_records
            if rec.area_monitored_ha
        )

        phase_counts   = Counter(rec.crop_phase for rec in latest_records)
        dominant_phase = phase_counts.most_common(1)[0][0] if phase_counts else None

        delayed_records = [r for r in latest_records if r.phase_status == 'DELAYED']
        delayed_farmers = len(set(r.farmer_id for r in delayed_records))
        # avg_delay = total delay_days / count of delayed RECORDS
        avg_delay = (
            sum(r.delay_days or 0 for r in delayed_records) / len(delayed_records)
            if delayed_records else 0
        )
        damaged_records = [r for r in latest_records if r.phase_status == 'DAMAGED']
        damaged_farmers = len(set(r.farmer_id for r in damaged_records))

        # ── SEASON START for Gantt timeline ───────────────────
        if season == 'WET':
            season_start = datetime.date(yr, 6, 1)
        else:
            season_start = datetime.date(yr - 1, 11, 1)

        dist_days = std.get('DISTRIBUTION', 3)

        def build_std_windows(seed_key):
            """Standard time windows per phase (offset after distribution window)."""
            phases  = SEED_PHASES.get(seed_key, [])
            windows = {}
            cursor  = dist_days  # start after distribution period
            for ph in phases:
                d = std.get(ph, 0)
                ph_start = season_start + datetime.timedelta(days=cursor)
                ph_end   = season_start + datetime.timedelta(days=cursor + d - 1)
                windows[ph] = {'start': ph_start, 'end': ph_end, 'days': d}
                cursor += d
            return windows

        # ── GANTT DATA (5 phases, AT-encoded only) ─────────────
        gantt_data        = {}
        seeds_to_process  = (
            [seed_filter] if seed_filter and seed_filter in SEED_LABELS
            else ['HYBRID', 'INBRED', 'OWN_SEED']
        )

        for seed_key in seeds_to_process:
            gantt_data[seed_key] = {}
            seed_all = base.filter(seed_source=seed_key)

            # total unique farmers = ALL farmers who ever had a monitoring record
            # for this seed type this season (not just latest phase)
            total_seed_farmers = len(set(r.farmer_id for r in seed_all))

            std_windows = build_std_windows(seed_key)

            for phase_key in SEED_PHASES.get(seed_key, []):
                win = std_windows.get(phase_key)
                if not win:
                    continue

                std_start_iso = win['start'].isoformat()
                std_end_iso   = win['end'].isoformat()
                std_days_val  = win['days']

                # ALL historical records for this phase — keep LATEST per farmer
                # This ensures Farmer A still appears in Crop Establishment
                # even after moving to Tillering
                all_phase_qs       = seed_all.filter(crop_phase=phase_key)
                farmer_phase_dates = {}
                for rec in all_phase_qs.order_by('farmer_id', '-date_observed'):
                    # Keep LATEST observation per farmer within this phase.
                    # seed_all is already filtered to one seed_source,
                    # so farmer_id alone is a sufficient key here.
                    if rec.farmer_id not in farmer_phase_dates:
                        farmer_phase_dates[rec.farmer_id] = rec.date_observed

                total_in_phase = len(farmer_phase_dates)

                if total_in_phase == 0:
                    gantt_data[seed_key][phase_key] = {
                        'farmers': 0, 'valid_farmers': 0, 'delayed_farmers': 0,
                        'early_farmers': 0, 'total_farmers': total_seed_farmers,
                        'completion_pct': None, 'timeline_progress': None,
                        'done_pct': None,
                        'mode_date': None, 'mode_count': 0, 'all_delayed': False,
                        'std_start': std_start_iso, 'std_end': std_end_iso, 'std_days': std_days_val,
                    }
                    continue

                valid_set   = {fid for fid, d in farmer_phase_dates.items() if win['start'] <= d <= win['end']}
                delayed_set = {fid for fid, d in farmer_phase_dates.items() if d > win['end']}
                early_set   = {fid for fid, d in farmer_phase_dates.items() if d < win['start']}

                valid_count   = len(valid_set)
                delayed_count = len(delayed_set)
                all_delayed   = (valid_count == 0 and delayed_count > 0)

                # % DONE = how many farmers encoded this phase / total seed farmers
                # This is the "completion" of the phase across all farmers
                completion_pct = (
                    round((total_in_phase / total_seed_farmers) * 100)
                    if total_seed_farmers > 0 else None
                )

                # Mode date — use ALL farmers in phase (valid + delayed + early)
                # so bar position reflects the actual dominant date across everyone
                mode_date  = None
                mode_count = 0
                all_dates  = list(farmer_phase_dates.values())
                if all_dates:
                    date_counter          = Counter(all_dates)
                    mode_date, mode_count = date_counter.most_common(1)[0]

                # done_pct — how far the mode date is into the standard window
                # This is what shows on the RIGHT side of the Gantt row
                # Formula: elapsed_days / standard_days * 100, capped at 100
                done_pct = None
                if mode_date:
                    total_days = max((win['end'] - win['start']).days, 1)
                    elapsed    = (mode_date - win['start']).days
                    done_pct   = round(min(max(elapsed, 0), total_days) / total_days * 100)

                # timeline_progress = done_pct (same formula)
                timeline_progress = None
                if mode_date:
                    total_days        = max((win['end'] - win['start']).days, 1)
                    elapsed           = max(0, (mode_date - win['start']).days)
                    timeline_progress = round(min(elapsed, total_days) / total_days * 100)

                gantt_data[seed_key][phase_key] = {
                    'farmers':           total_in_phase,
                    'valid_farmers':     valid_count,
                    'delayed_farmers':   delayed_count,
                    'early_farmers':     len(early_set),
                    'total_farmers':     total_seed_farmers,
                    'completion_pct':    completion_pct,
                    'timeline_progress': timeline_progress,
                    'done_pct':          done_pct,
                    'mode_date':         mode_date.isoformat() if mode_date else None,
                    'mode_count':        mode_count,
                    'all_delayed':       all_delayed,
                    'std_start':         std_start_iso,
                    'std_end':           std_end_iso,
                    'std_days':          std_days_val,
                }

        # ── SEED DISTRIBUTION ANALYTICS (separate vertical bar chart) ────────
        # Count UNIQUE farmers per seed type — a farmer with both Hybrid+Inbred
        # counts once per seed type, NOT doubled in the total.
        dist_summary = {
            'hybrid_beneficiaries':   0,
            'inbred_beneficiaries':   0,
            'total_beneficiaries':    0,   # unique farmers (union)
            'hybrid_kg':              0,
            'inbred_kg':              0,
            'total_kg':               0,
            'by_seed': [],
        }

        for seed_key, seed_name_fragment in [('HYBRID', 'hybrid'), ('INBRED', 'inbred')]:
            dist_qs = DistributionEntry.objects.filter(
                batch__status='APPROVED',
                date_received__isnull=False,
            )
            dist_qs = dist_qs.filter(
                batch__event__seed_type__name__icontains=seed_name_fragment
            )
            if poll:
                dist_qs = dist_qs.filter(
                    batch__event__season=poll.season,
                    batch__event__year=poll.year,
                )

            # Unique farmers for this seed type
            unique_farmers = set(dist_qs.values_list('farmer_id', flat=True))
            farmer_count   = len(unique_farmers)

            # Total qty_bags for this seed type (all distributed)
            # Total qty_bags for this seed type (all distributed)
            # Exclude entries where qty_bags is None, 0, or effectively 0
            total_bags = sum(
                float(entry.qty_bags)
                for entry in dist_qs.select_related()
                if entry.qty_bags is not None and float(entry.qty_bags) > 0
            )
            
            # kg per bag: Hybrid = 15 kg, Inbred = 20 kg
            kg_per_bag = 15 if seed_key == 'HYBRID' else 20
            total_kg   = round(total_bags * kg_per_bag, 2)

            dist_summary['by_seed'].append({
                'seed_key':     seed_key,
                'label':        'Hybrid' if seed_key == 'HYBRID' else 'Certified',
                'beneficiaries': farmer_count,
                'total_bags':   total_bags,
                'total_kg':     total_kg,
            })

            if seed_key == 'HYBRID':
                dist_summary['hybrid_beneficiaries'] = farmer_count
                dist_summary['hybrid_kg']            = total_kg
            else:
                dist_summary['inbred_beneficiaries'] = farmer_count
                dist_summary['inbred_kg']            = total_kg

        # Total unique beneficiaries = union of hybrid + inbred farmer IDs
        hybrid_ids = set()
        inbred_ids = set()
        for item in dist_summary['by_seed']:
            if item['seed_key'] == 'HYBRID':
                hybrid_qs = DistributionEntry.objects.filter(
                    batch__status='APPROVED',
                    date_received__isnull=False,
                    batch__event__seed_type__name__icontains='hybrid',
                )
                if poll:
                    hybrid_qs = hybrid_qs.filter(batch__event__season=poll.season, batch__event__year=poll.year)
                hybrid_ids = set(hybrid_qs.values_list('farmer_id', flat=True))
            else:
                inbred_qs = DistributionEntry.objects.filter(
                    batch__status='APPROVED',
                    date_received__isnull=False,
                    batch__event__seed_type__name__icontains='inbred',
                )
                if poll:
                    inbred_qs = inbred_qs.filter(batch__event__season=poll.season, batch__event__year=poll.year)
                inbred_ids = set(inbred_qs.values_list('farmer_id', flat=True))

        dist_summary['total_beneficiaries'] = len(hybrid_ids | inbred_ids)
        dist_summary['total_kg']            = dist_summary['hybrid_kg'] + dist_summary['inbred_kg']

        # ── AREA BY SEED TYPE (for separate analytics, not KPI tile) ──────────
        area_by_seed = []
        for seed_key in ['HYBRID', 'INBRED', 'OWN_SEED']:
            seed_recs    = [r for r in latest_records if r.seed_source == seed_key]
            area         = sum(float(r.area_monitored_ha or 0) for r in seed_recs if r.area_monitored_ha)
            farmer_count = len(set(r.farmer_id for r in seed_recs))
            area_by_seed.append({
                'seed_source':  seed_key,
                'label':        SEED_LABELS[seed_key],
                'area_ha':      round(area, 2),
                'farmer_count': farmer_count,
            })

        # ── TIMELINE MONTHS ────────────────────────────────────
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
                {'month': 11, 'label': 'Nov', 'year': yr - 1},
                {'month': 12, 'label': 'Dec', 'year': yr - 1},
                {'month': 1,  'label': 'Jan', 'year': yr},
                {'month': 2,  'label': 'Feb', 'year': yr},
                {'month': 3,  'label': 'Mar', 'year': yr},
                {'month': 4,  'label': 'Apr', 'year': yr},
            ]

        # ── DELAY ANALYTICS ───────────────────────────────────
        delay_by_seed = {}
        for seed_key in ['HYBRID', 'INBRED', 'OWN_SEED']:
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
        gantt_alert  = None
        best_delayed = 0
        for ph in GANTT_PHASES:
            d = sum(1 for r in latest_records if r.crop_phase == ph and r.phase_status == 'DELAYED')
            t = sum(1 for r in latest_records if r.crop_phase == ph)
            if d > best_delayed:
                best_delayed = d
                gantt_alert  = {
                    'phase': ph, 'label': PHASE_DISPLAY[ph],
                    'delayed': d, 'total': t,
                    'pct': round(d / t * 100, 1) if t > 0 else 0,
                }

        # ── ATTENTION LIST ────────────────────────────────────
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
                'farmer_id':     r.farmer_id,
                'farmer_name':   r.farmer.get_full_name(),
                'barangay':      r.barangay,
                'seed_type':     r.seed_source,
                'seed_label':    SEED_LABELS.get(r.seed_source, r.seed_source),
                'phase':         PHASE_DISPLAY.get(r.crop_phase, r.crop_phase),
                'status':        r.phase_status,
                'delay_days':    r.delay_days,
                'damage_cause':  r.damage_cause or '',
                'date_observed': r.date_observed.isoformat(),
            })

        # ── INSIGHTS ──────────────────────────────────────────
        total_in_dist      = sum(phase_counts.values()) or 1
        highest_delay_seed = max(delay_by_seed.items(), key=lambda x: x[1]['delayed']) if delay_by_seed else None
        top_damage         = cause_of_damage[0] if cause_of_damage else None

        insights = {
            'most_active_phase': {
                'phase': dominant_phase,
                'label': PHASE_DISPLAY.get(dominant_phase, '—') if dominant_phase else '—',
                'count': phase_counts.get(dominant_phase, 0) if dominant_phase else 0,
                'pct':   round(phase_counts.get(dominant_phase, 0) / total_in_dist * 100) if dominant_phase else 0,
            },
            'delay_alert': {
                'seed_type':     highest_delay_seed[0] if highest_delay_seed else None,
                'seed_label':    SEED_LABELS.get(highest_delay_seed[0], '—') if highest_delay_seed else '—',
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
            'kpi': {
                'total_farmers':   total_farmers,
                'total_area_ha':   round(total_area, 2),
                'delayed_farmers': delayed_farmers,
                'damaged_farmers': damaged_farmers,
                'avg_delay_days':  round(float(avg_delay), 1),
                'dominant_phase':  dominant_phase,
                'dominant_label':  PHASE_DISPLAY.get(dominant_phase, '—') if dominant_phase else '—',
                'dominant_count':  phase_counts.get(dominant_phase, 0) if dominant_phase else 0,
            },
            'gantt':          gantt_data,
            'dist_summary':   dist_summary,     # <-- new: seed distribution chart data
            'area_by_seed':   area_by_seed,
            'delay_by_seed':  delay_by_seed,
            'cause_of_damage': cause_of_damage,
            'attention_list': attention_list,
            'insights':       insights,
            'poll_list':      poll_list,
            'std_days':       STD_DAYS,
            'timeline_months': timeline_months,
        })