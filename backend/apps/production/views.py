# apps/production/views.py  — add these views to your existing file

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.conf import settings
from django.db.models import Avg, Sum, Count, Q, F
from django.db.models.functions import Coalesce
from decimal import Decimal

from apps.accounts.permissions import IsAdminUserRole, IsBPUser
from .models import HarvestRecord
from .serializers import HarvestRecordSerializer

# DA official constants — kept in shared settings for consistency
SEEDING_DENSITY    = settings.SEEDING_DENSITY
STANDARD_YIELD_KG  = settings.STANDARD_YIELDS
SEED_LABELS        = {
    'HYBRID':   'Hybrid seeds',
    'INBRED':   'Certified seeds',
    'OWN_SEED': 'Farmer saved seeds',
}


def dry_weight_kg(record):
    """Convert harvest to dry weight kg based on weight_type and moisture."""
    bags     = float(record.harvest_bags or 0)
    raw_kg   = bags * 50
    if getattr(record, 'weight_type', 'FRESH') == 'DRIED':
        return raw_kg
    moisture = float(getattr(record, 'moisture_content_pct', 12) or 12)
    return raw_kg * (1 - moisture / 100)


def utilization_pct(record):
    """Utilization = (actual dry kg / expected kg) × 100."""
    area     = float(record.harvest_area_ha or 0)
    src      = record.seed_source or 'OWN_SEED'
    standard = STANDARD_YIELD_KG.get(src, 2000)
    expected = area * standard
    if expected == 0:
        return None
    return (dry_weight_kg(record) / expected) * 100


def get_tier_label(pct):
    if pct is None:       return 'N/A'
    if pct >= 200:        return 'Master Farmer'
    if pct >= 150:        return 'Exceptional'
    if pct >= 100:        return 'Excellent'
    if pct >= 75:         return 'Good'
    if pct >= 50:         return 'Below target'
    return 'Needs attention'


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

        total_dry_kg  = sum(dry_weight_kg(r) for r in records)
        total_mt      = total_dry_kg / 1000
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
            total_dry  = sum(dry_weight_kg(r) for r in group)
            total_mt   = total_dry / 1000
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
            total_dry  = sum(dry_weight_kg(r) for r in records)
            total_mt   = total_dry / 1000
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
            actual   = dry_weight_kg(r)
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
        'Master Farmer':  '#15803d',
        'Exceptional':    '#22c55e',
        'Excellent':      '#4ade80',
        'Good':           '#f59e0b',
        'Below target':   '#f97316',
        'Needs attention':'#dc2626',
        'N/A':            '#1E293B',
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
            total_dry  = sum(dry_weight_kg(r) for r in records)
            total_mt   = total_dry / 1000
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
        if user.role == 'BRGY':
            # BRGY can only see their own barangay's records
            return HarvestRecord.objects.filter(barangay=user.barangay).select_related('farmer', 'encoded_by')
        elif user.role == 'ADMIN':
            # Admin can see all
            return HarvestRecord.objects.all().select_related('farmer', 'encoded_by')
        return HarvestRecord.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        barangay = getattr(user, 'barangay', 'Unknown')
        serializer.save(encoded_by=user, barangay=barangay)


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