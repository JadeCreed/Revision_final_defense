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

def get_display_poll():
    """
    Determine which poll data to show on the landing page.
    Priority:
    1. Most recent CLOSED+finalized poll that HAS harvest data → show current
    2. Any past poll with harvest data → show past (with note)
    3. Latest finalized poll even with zero harvest → show zeros
    """
    closed_polls = Poll.objects.filter(status='CLOSED').order_by('-year', '-created_at')
    finalized = [p for p in closed_polls if FinalSeed.objects.filter(season=p.season, year=p.year).exists()]

    for poll in finalized:
        if HarvestRecord.objects.filter(poll=poll).exists():
            # Check if this is the latest finalized poll
            is_latest = (finalized[0].id == poll.id) if finalized else False
            return poll, is_latest

    # No harvest data anywhere — return latest finalized for display with zeros
    if finalized:
        return finalized[0], False

    return Poll.objects.order_by('-created_at').first(), False


class PublicGisStatsView(APIView):
    """
    GET /api/gis/public/stats/
    City-wide stat tiles for the landing page.
    No authentication required.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        poll, is_current = get_display_poll()

        # Total registered farmers — from FarmerRegistry if exists, else approved accounts
        total_registered = 0
        total_area_ha = 0.0
        try:
            from apps.accounts.models import FarmerRegistry
            from django.db.models import Sum
            total_registered = FarmerRegistry.objects.count()
            area_agg = FarmerRegistry.objects.aggregate(total=Sum('farm_area_ha'))
            total_area_ha = float(area_agg['total'] or 0)
        except Exception:
            try:
                from apps.accounts.models import User
                total_registered = User.objects.filter(
                    role='FARMER', status='APPROVED', is_active=True
                ).count()
            except Exception:
                pass

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
            'data_note': data_note,
            'poll_id': poll.id if poll else None,
            'poll_season': poll.season if poll else None,
            'poll_year': poll.year if poll else None,
        })


class PublicGisBrgyView(APIView):
    """
    GET /api/gis/public/barangays/
    Per-barangay data for the landing page map polygons.
    No authentication required.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        poll, is_current = get_display_poll()

        # Registry: farmer count per barangay
        registry_by_brgy = defaultdict(lambda: {'count': 0, 'area': 0.0})
        total_registry = 0
        try:
            from apps.accounts.models import FarmerRegistry
            from django.db.models import Count, Sum
            for row in FarmerRegistry.objects.values('barangay').annotate(count=Count('id'), area=Sum('farm_area_ha')):
                canonical = get_canonical_brgy(row['barangay'])
                if canonical:
                    registry_by_brgy[canonical]['count'] += row['count']
                    registry_by_brgy[canonical]['area'] += float(row['area'] or 0)
                    total_registry += row['count']
        except Exception:
            # Fallback: approved farmer accounts
            try:
                from apps.accounts.models import User
                from django.db.models import Count
                for row in User.objects.filter(role='FARMER', status='APPROVED', is_active=True).values('barangay').annotate(count=Count('id')):
                    canonical = get_canonical_brgy(row['barangay'])
                    if canonical:
                        registry_by_brgy[canonical]['count'] = row['count']
                        total_registry += row['count']
            except Exception:
                pass

        # Harvest data per barangay scoped to display poll
        harvest_by_brgy = defaultdict(lambda: {'bags': 0.0, 'area': 0.0})
        try:
            from django.db.models import Sum
            qs = HarvestRecord.objects.all()
            if poll:
                qs = qs.filter(poll=poll)
            for row in qs.values('barangay').annotate(total_bags=Sum('harvest_bags'), total_area=Sum('harvest_area_ha')):
                canonical = get_canonical_brgy(row['barangay'])
                if canonical:
                    harvest_by_brgy[canonical]['bags'] += float(row['total_bags'] or 0)
                    harvest_by_brgy[canonical]['area'] += float(row['total_area'] or 0)
        except Exception as e:
            logger.warning(f'PublicGisBrgy harvest error: {e}')

        result = []
        for brgy in LUCBAN_BARANGAYS:
            reg = registry_by_brgy.get(brgy, {'count': 0, 'area': 0.0})
            harv = harvest_by_brgy.get(brgy, {'bags': 0.0, 'area': 0.0})
            prod_mt = round((harv['bags'] * 50) / 1000, 3)
            harv_area = harv['area']
            avg_yield = round(prod_mt / harv_area, 3) if harv_area > 0 else 0.0
            farmer_share = round((reg['count'] / total_registry * 100), 1) if total_registry > 0 else 0.0
            result.append({
                'name': brgy,
                'registered_farmers': reg['count'],
                'area_ha': round(reg['area'], 2),
                'production_mt': prod_mt,
                'avg_yield_t_ha': avg_yield,
                'farmer_share_pct': farmer_share,
                'has_harvest_data': prod_mt > 0,
            })

        result.sort(key=lambda x: x['registered_farmers'], reverse=True)

        return Response({
            'barangays': result,
            'season_label': f"{poll.get_season_display()} {poll.year}" if poll else None,
            'is_current_season': is_current,
            'total_registered': total_registry,
        })