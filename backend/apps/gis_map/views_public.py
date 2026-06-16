# apps/gis_map/views_public.py
import logging
from collections import defaultdict
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from apps.production.models import HarvestRecord
from apps.seed_poll.models import Poll, FinalSeed

logger = logging.getLogger(__name__)

LUCBAN_BARANGAYS = [
    'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
    'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
    'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
    'Tiawe','Tinamnan',
]

TARGET_YIELD_KG_HA = {'HYBRID': 5000, 'INBRED': 4000, 'OWN_SEED': 3000}

UTIL_TIERS = [
    {'key': 'Exceeded Target', 'min': 100.01, 'color': '#166534'},
    {'key': 'Achieved Target', 'min': 80,     'color': '#15803d'},
    {'key': 'Near Target',     'min': 70,     'color': '#0369a1'},
    {'key': 'Below Target',    'min': 50,     'color': '#b45309'},
    {'key': 'Critical',        'min': 0,      'color': '#b91c1c'},
]
UTIL_TIER_PRIORITY = ['Exceeded Target', 'Achieved Target', 'Near Target', 'Below Target', 'Critical']
NO_DATA_COLOR = '#1E293B'


def normalize_brgy(name):
    if not name:
        return ''
    return name.strip().replace('-', ' ').replace('_', ' ').lower()


def get_canonical_brgy(raw):
    n = normalize_brgy(raw)
    for b in LUCBAN_BARANGAYS:
        if normalize_brgy(b) == n:
            return b
    return raw.strip() if raw else None


def compute_util_pct(bags, area_ha, seed_source):
    bags = float(bags or 0)
    area = float(area_ha or 0)
    target = TARGET_YIELD_KG_HA.get(seed_source or 'OWN_SEED', 3000)
    exp_kg = area * target
    if exp_kg <= 0:
        return None
    return (bags * 50 / exp_kg) * 100


def get_util_tier(pct):
    if pct is None:
        return None
    if pct > 100:
        return UTIL_TIERS[0]
    for t in UTIL_TIERS:
        if pct >= t['min']:
            return t
    return UTIL_TIERS[-1]


def get_display_poll():
    """
    Returns the poll to display on the landing page.
    Logic:
    1. If current active (OPEN) poll has harvest data → show it
    2. Most recent CLOSED+finalized poll with harvest data → show it
    3. Any poll with harvest data → show it (past data)
    4. Latest finalized poll → show zeros
    """
    # Check OPEN polls first (current active season)
    open_polls = Poll.objects.filter(status='OPEN').order_by('-year', '-created_at')
    for poll in open_polls:
        if HarvestRecord.objects.filter(poll=poll).exists():
            return poll, True

    # Closed + finalized polls with harvest data
    closed_polls = Poll.objects.filter(status='CLOSED').order_by('-year', '-created_at')
    finalized = [p for p in closed_polls if FinalSeed.objects.filter(season=p.season, year=p.year).exists()]

    for poll in finalized:
        if HarvestRecord.objects.filter(poll=poll).exists():
            is_latest = (finalized[0].id == poll.id) if finalized else False
            return poll, is_latest

    # Fallback: any poll with harvest data
    for poll in Poll.objects.order_by('-year', '-created_at'):
        if HarvestRecord.objects.filter(poll=poll).exists():
            return poll, False

    # No harvest data — return latest finalized/any poll for display with zeros
    if finalized:
        return finalized[0], False

    latest = Poll.objects.order_by('-created_at').first()
    return latest, False


class PublicGisStatsView(APIView):
    """
    GET /api/gis/public/stats/
    City-wide stat tiles for the landing page.
    No authentication required.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        poll, is_current = get_display_poll()

        # Total registered farmers — from approved farmer accounts
        total_registered = 0
        try:
            from apps.accounts.models import User
            total_registered = User.objects.filter(
                role='FARMER', status='APPROVED', is_active=True
            ).count()
        except Exception as e:
            logger.warning(f'PublicGisStats farmer count error: {e}')

        # Total area — from FarmerProfile hectares of all approved farmers
        total_area_ha = 0.0
        try:
            from apps.accounts.models import User, FarmerProfile
            from django.db.models import Sum
            approved_farmer_ids = User.objects.filter(
                role='FARMER', status='APPROVED', is_active=True
            ).values_list('id', flat=True)
            area_agg = FarmerProfile.objects.filter(
                user_id__in=approved_farmer_ids
            ).aggregate(total=Sum('hectares'))
            total_area_ha = float(area_agg['total'] or 0)
        except Exception as e:
            logger.warning(f'PublicGisStats area error: {e}')

        # Production from HarvestRecord scoped to display poll
        total_production_mt = 0.0
        active_barangays = 0
        try:
            from django.db.models import Sum
            qs = HarvestRecord.objects.all()
            if poll:
                qs = qs.filter(poll=poll)
            agg = qs.aggregate(total_bags=Sum('harvest_bags'))
            bags = float(agg['total_bags'] or 0)
            total_production_mt = round((bags * 50) / 1000, 2)
            active_barangays = qs.values('barangay').distinct().count()
        except Exception as e:
            logger.warning(f'PublicGisStats production error: {e}')

        season_label = f"{poll.get_season_display()} {poll.year}" if poll else 'No data yet'
        data_note = (
            f"Showing {season_label} data" if is_current
            else f"Showing past data — {season_label}"
        ) if poll else "No season data available"

        return Response({
            'total_registered_farmers': total_registered,
            'total_production_mt': total_production_mt,
            'total_area_ha': round(total_area_ha, 2),
            'active_barangays': active_barangays or len(LUCBAN_BARANGAYS),
            'season_label': season_label,
            'is_current_season': is_current,
            'is_past_data': not is_current,
            'data_note': data_note,
            'poll_id': poll.id if poll else None,
            'poll_season': poll.season if poll else None,
            'poll_year': poll.year if poll else None,
        })


class PublicGisBrgyView(APIView):
    """
    GET /api/gis/public/barangays/
    Per-barangay data for the landing page map polygons.
    Returns utilization tier color matching admin GisMap exactly.
    No authentication required.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        poll, is_current = get_display_poll()

        # Registered farmers per barangay — from approved accounts
        registry_by_brgy = defaultdict(int)
        total_registry = 0
        try:
            from apps.accounts.models import User
            from django.db.models import Count
            for row in User.objects.filter(
                role='FARMER', status='APPROVED', is_active=True
            ).values('barangay').annotate(count=Count('id')):
                canonical = get_canonical_brgy(row['barangay'])
                if canonical:
                    registry_by_brgy[canonical] += row['count']
                    total_registry += row['count']
        except Exception as e:
            logger.warning(f'PublicGisBrgy registry error: {e}')

        # FarmerProfile hectares per barangay
        area_by_brgy = defaultdict(float)
        try:
            from apps.accounts.models import User, FarmerProfile
            from django.db.models import Sum
            approved_farmers = User.objects.filter(
                role='FARMER', status='APPROVED', is_active=True
            ).select_related('profile')
            for farmer in approved_farmers:
                brgy = get_canonical_brgy(farmer.barangay)
                if not brgy:
                    continue
                try:
                    ha = float(farmer.profile.hectares or 0)
                    area_by_brgy[brgy] += ha
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f'PublicGisBrgy area error: {e}')

        # Harvest records per barangay per farmer (for utilization tier computation)
        # Matches admin GisMap logic exactly: compute util pct per record,
        # get tier per record, find dominant tier per brgy
        harvest_by_brgy = defaultdict(list)
        try:
            qs = HarvestRecord.objects.select_related('farmer').all()
            if poll:
                qs = qs.filter(poll=poll)
            for rec in qs:
                canonical = get_canonical_brgy(rec.barangay)
                if canonical:
                    harvest_by_brgy[canonical].append(rec)
        except Exception as e:
            logger.warning(f'PublicGisBrgy harvest error: {e}')

        result = []
        for brgy in LUCBAN_BARANGAYS:
            reg_count = registry_by_brgy.get(brgy, 0)
            reg_area = area_by_brgy.get(brgy, 0.0)
            recs = harvest_by_brgy.get(brgy, [])

            # Compute production totals
            total_bags = sum(float(r.harvest_bags or 0) for r in recs)
            total_harv_area = sum(float(r.harvest_area_ha or 0) for r in recs)
            prod_mt = round((total_bags * 50) / 1000, 3)
            avg_yield = round(prod_mt / total_harv_area, 3) if total_harv_area > 0 else 0.0

            # Compute dominant utilization tier — matches admin buildBrgyUtilData logic
            # Count farmers per tier (unique farmer per seed_source)
            tier_farmer_sets = {t['key']: set() for t in UTIL_TIERS}
            unique_farmers = set()
            for rec in recs:
                farmer_id = rec.farmer_id
                unique_farmers.add(farmer_id)
                util = compute_util_pct(rec.harvest_bags, rec.harvest_area_ha, rec.seed_source)
                tier = get_util_tier(util)
                if tier:
                    tier_farmer_sets[tier['key']].add(farmer_id)

            total_unique = len(unique_farmers)
            dominant_tier = None
            dominant_color = NO_DATA_COLOR

            if total_unique > 0:
                # Compute sumPct per tier (matching admin logic)
                tier_sum_pct = {}
                for t in UTIL_TIERS:
                    count = len(tier_farmer_sets[t['key']])
                    if count > 0:
                        tier_sum_pct[t['key']] = (count / total_unique) * 100

                # Find dominant by highest pct, tiebreak by priority
                max_pct = -1
                for tier_key in UTIL_TIER_PRIORITY:
                    pct = tier_sum_pct.get(tier_key, 0)
                    if pct > max_pct:
                        max_pct = pct
                        dominant_tier = tier_key

                if dominant_tier:
                    tier_obj = next((t for t in UTIL_TIERS if t['key'] == dominant_tier), None)
                    dominant_color = tier_obj['color'] if tier_obj else NO_DATA_COLOR

            farmer_share = round((reg_count / total_registry * 100), 1) if total_registry > 0 else 0.0

            result.append({
                'name': brgy,
                'registered_farmers': reg_count,
                'area_ha': round(reg_area, 2),
                'production_mt': prod_mt,
                'harvest_area_ha': round(total_harv_area, 2),
                'avg_yield_t_ha': avg_yield,
                'farmer_share_pct': farmer_share,
                'has_harvest_data': prod_mt > 0,
                'encoded_farmers': total_unique,
                'dominant_tier': dominant_tier,
                'dominant_color': dominant_color,
            })

        result.sort(key=lambda x: x['production_mt'], reverse=True)

        return Response({
            'barangays': result,
            'season_label': f"{poll.get_season_display()} {poll.year}" if poll else None,
            'is_current_season': is_current,
            'total_registered': total_registry,
        })