# apps/crop_monitoring/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Q

from apps.accounts.models import User
from apps.accounts.permissions import IsATUser, IsAdminUserRole
from .models import CropMonitoringRecord, BarangayCropSummary
from .serializers import (
    CropMonitoringRecordSerializer,
    BarangayCropSummarySerializer,
)


# ─────────────────────────────────────────────────────────────
# AT — List farmers assigned to this AT (for encoding)
# ─────────────────────────────────────────────────────────────

class ATFarmerListView(APIView):
    """
    GET /api/crop-monitoring/at/farmers/
    Returns APPROVED farmers in the AT's assigned barangays.
    Includes their latest crop monitoring record if any.
    Supports: ?search=  ?barangay=  ?phase=
    """
    permission_classes = [IsAuthenticated, IsATUser]

    def get(self, request):
        at_profile = getattr(request.user, 'at_profile', None)
        if not at_profile:
            return Response({'error': 'AT profile not found.'}, status=400)

        assigned_barangays = at_profile.get_assigned_barangays()
        if not assigned_barangays:
            return Response({'farmers': [], 'barangays': []})

        qs = User.objects.filter(
            role='FARMER',
            status='APPROVED',
            is_active=True,
            barangay__in=assigned_barangays,
        )

        # Search by name or RSBSA
        search = request.query_params.get('search', '')
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)  |
                Q(rsbsa_number__icontains=search)
            )

        # Filter by barangay
        brgy = request.query_params.get('barangay', '')
        if brgy:
            qs = qs.filter(barangay=brgy)

        qs = qs.order_by('barangay', 'last_name', 'first_name')

        # For each farmer, get their latest monitoring record
        results = []
        for farmer in qs:
            latest = CropMonitoringRecord.objects.filter(
                farmer=farmer
            ).order_by('-date_observed', '-encoded_at').first()

            results.append({
                'id':           farmer.id,
                'full_name':    farmer.get_full_name(),
                'first_name':   farmer.first_name,
                'last_name':    farmer.last_name,
                'rsbsa_number': farmer.rsbsa_number or '',
                'contact':      farmer.contact_number or '',
                'barangay':     farmer.barangay or '',
                'latest_phase': latest.crop_phase if latest else None,
                'latest_phase_display': (
                    latest.get_crop_phase_display() if latest else 'Not yet monitored'
                ),
                'latest_observed': (
                    str(latest.date_observed) if latest else None
                ),
                'latest_record_id': latest.id if latest else None,
            })

        # Filter by phase after enrichment
        phase_filter = request.query_params.get('phase', '')
        if phase_filter:
            results = [r for r in results if r.get('latest_phase') == phase_filter]

        return Response({
            'farmers':    results,
            'barangays':  assigned_barangays,
            'total':      len(results),
        })


# ─────────────────────────────────────────────────────────────
# AT — Encode crop monitoring record
# ─────────────────────────────────────────────────────────────

class ATCropMonitoringCreateView(APIView):
    """
    POST /api/crop-monitoring/records/
    AT encodes a crop monitoring observation for a farmer.
    """
    permission_classes = [IsAuthenticated, IsATUser]

    def post(self, request):
        at_profile = getattr(request.user, 'at_profile', None)
        if not at_profile:
            return Response({'error': 'AT profile not found.'}, status=400)

        assigned_barangays = at_profile.get_assigned_barangays()

        # Validate farmer
        farmer_id = request.data.get('farmer_id')
        try:
            farmer = User.objects.get(
                id=farmer_id, role='FARMER',
                status='APPROVED', is_active=True
            )
        except User.DoesNotExist:
            return Response({'error': 'Farmer not found or not approved.'}, status=404)

        # AT can only encode farmers in their assigned barangays
        if farmer.barangay not in assigned_barangays:
            return Response({
                'error': f'Farmer is in Brgy. {farmer.barangay}, '
                         f'which is not in your assigned barangays.'
            }, status=403)

        # Validate required fields
        crop_phase = request.data.get('crop_phase', '').strip()
        if not crop_phase:
            return Response({'error': 'Crop phase is required.'}, status=400)

        valid_phases = [p[0] for p in CropMonitoringRecord.PHASE_CHOICES]
        if crop_phase not in valid_phases:
            return Response({'error': f'Invalid crop phase: {crop_phase}'}, status=400)

        date_observed = request.data.get('date_observed', '')
        if not date_observed:
            return Response({'error': 'Date observed is required.'}, status=400)

        # Build record
        record = CropMonitoringRecord.objects.create(
            farmer=farmer,
            encoded_by=request.user,
            barangay=farmer.barangay,
            crop_phase=crop_phase,
            crop_establishment=request.data.get('crop_establishment') or None,
            area_monitored_ha=request.data.get('area_monitored_ha') or None,
            sowing_date=request.data.get('sowing_date') or None,
            variety_name=request.data.get('variety_name', '').strip(),
            remarks=request.data.get('remarks', '').strip(),
            date_observed=date_observed,
        )

        serializer = CropMonitoringRecordSerializer(record)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────
# AT — History for a specific farmer
# ─────────────────────────────────────────────────────────────

class ATFarmerHistoryView(APIView):
    """
    GET /api/crop-monitoring/farmers/<farmer_id>/history/
    Returns all monitoring records for a farmer, newest first.
    Used by AT to view history before encoding a new observation.
    """
    permission_classes = [IsAuthenticated, IsATUser]

    def get(self, request, farmer_id):
        at_profile = getattr(request.user, 'at_profile', None)
        if not at_profile:
            return Response({'error': 'AT profile not found.'}, status=400)

        farmer = get_object_or_404(
            User, id=farmer_id, role='FARMER', status='APPROVED'
        )

        # Verify this farmer is in AT's assigned barangays
        if farmer.barangay not in at_profile.get_assigned_barangays():
            return Response({'error': 'Access denied.'}, status=403)

        records = CropMonitoringRecord.objects.filter(
            farmer=farmer
        ).order_by('-date_observed', '-encoded_at')

        serializer = CropMonitoringRecordSerializer(records, many=True)
        return Response({
            'farmer_name': farmer.get_full_name(),
            'barangay':    farmer.barangay,
            'rsbsa':       farmer.rsbsa_number or '',
            'records':     serializer.data,
        })


# ─────────────────────────────────────────────────────────────
# AT — Update a record (only within 24 hours, own records only)
# ─────────────────────────────────────────────────────────────

class ATCropMonitoringUpdateView(APIView):
    """
    PUT /api/crop-monitoring/records/<id>/
    AT can edit their own records within 24 hours of encoding.
    """
    permission_classes = [IsAuthenticated, IsATUser]

    def put(self, request, pk):
        record = get_object_or_404(CropMonitoringRecord, pk=pk)

        # Only the AT who encoded can edit
        if record.encoded_by != request.user:
            return Response({'error': 'You can only edit your own records.'}, status=403)

        # Within 24 hours only
        from django.utils import timezone
        from datetime import timedelta
        if timezone.now() - record.encoded_at > timedelta(hours=24):
            return Response({
                'error': 'Records can only be edited within 24 hours of encoding.'
            }, status=403)

        allowed = [
            'crop_phase', 'crop_establishment', 'area_monitored_ha',
            'sowing_date', 'variety_name', 'remarks', 'date_observed',
        ]
        for field in allowed:
            if field in request.data:
                setattr(record, field, request.data[field] or None if field != 'remarks' else request.data[field])
        record.save()

        serializer = CropMonitoringRecordSerializer(record)
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────
# AT — Stats for their assigned barangays
# ─────────────────────────────────────────────────────────────

class ATDashboardStatsView(APIView):
    """
    GET /api/crop-monitoring/at/stats/
    Returns summary stats for the AT's assigned barangays.
    Used by AT Dashboard and CropMonitoring page header.
    """
    permission_classes = [IsAuthenticated, IsATUser]

    def get(self, request):
        at_profile = getattr(request.user, 'at_profile', None)
        if not at_profile:
            return Response({'error': 'AT profile not found.'}, status=400)

        assigned_barangays = at_profile.get_assigned_barangays()

        total_farmers = User.objects.filter(
            role='FARMER', status='APPROVED', is_active=True,
            barangay__in=assigned_barangays
        ).count()

        monitored_farmers = CropMonitoringRecord.objects.filter(
            barangay__in=assigned_barangays
        ).values('farmer').distinct().count()

        # Records encoded by this AT
        my_records = CropMonitoringRecord.objects.filter(
            encoded_by=request.user
        ).count()

        # Phase distribution across assigned barangays
        summaries = BarangayCropSummary.objects.filter(
            barangay__in=assigned_barangays
        )

        phase_counts = {
            'DISTRIBUTION': 0, 'ESTABLISHMENT': 0, 'TILLERING': 0,
            'FLOWERING': 0, 'RIPENING': 0, 'HARVESTING': 0,
        }
        for s in summaries:
            for phase in phase_counts:
                phase_counts[phase] += getattr(s, f'{phase.lower()}_count', 0)

        return Response({
            'assigned_barangays': assigned_barangays,
            'total_barangays':    len(assigned_barangays),
            'total_farmers':      total_farmers,
            'monitored_farmers':  monitored_farmers,
            'unmonitored_farmers': total_farmers - monitored_farmers,
            'my_records_encoded': my_records,
            'phase_counts':       phase_counts,
        })


# ─────────────────────────────────────────────────────────────
# ADMIN — All monitoring records
# ─────────────────────────────────────────────────────────────

class AdminCropMonitoringListView(APIView):
    """
    GET /api/crop-monitoring/admin/records/
    Admin views all monitoring records.
    Supports: ?barangay=  ?phase=  ?search=
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        qs = CropMonitoringRecord.objects.select_related(
            'farmer', 'encoded_by'
        )

        brgy = request.query_params.get('barangay', '')
        if brgy:
            qs = qs.filter(barangay=brgy)

        phase = request.query_params.get('phase', '')
        if phase:
            qs = qs.filter(crop_phase=phase)

        search = request.query_params.get('search', '')
        if search:
            qs = qs.filter(
                Q(farmer__first_name__icontains=search) |
                Q(farmer__last_name__icontains=search)  |
                Q(farmer__rsbsa_number__icontains=search)
            )

        serializer = CropMonitoringRecordSerializer(qs[:200], many=True)
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────
# GIS MAP — Barangay summaries
# ─────────────────────────────────────────────────────────────

class GISBarangaySummaryView(APIView):
    """
    GET /api/crop-monitoring/gis/summaries/
    Returns crop phase summaries for ALL barangays.
    Used by Admin GIS Map and AT GIS Map.
    Accessible to both ADMIN and AT.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        summaries = BarangayCropSummary.objects.all()
        serializer = BarangayCropSummarySerializer(summaries, many=True)

        # Also return overall totals for the default panel
        total_farmers = sum(s.total_farmers for s in summaries)
        phase_totals  = {
            'DISTRIBUTION':  sum(s.distribution_count  for s in summaries),
            'ESTABLISHMENT': sum(s.establishment_count for s in summaries),
            'TILLERING':     sum(s.tillering_count     for s in summaries),
            'FLOWERING':     sum(s.flowering_count     for s in summaries),
            'RIPENING':      sum(s.ripening_count      for s in summaries),
            'HARVESTING':    sum(s.harvesting_count    for s in summaries),
        }
        total_monitored = sum(phase_totals.values())
        dominant = max(phase_totals, key=phase_totals.get) if total_monitored > 0 else 'DISTRIBUTION'

        from django.utils import timezone
        return Response({
            'barangays':       serializer.data,
            'total_farmers':   total_farmers,
            'total_barangays': summaries.count(),
            'phase_totals':    phase_totals,
            'total_monitored': total_monitored,
            'dominant_phase':  dominant,
            'last_updated':    timezone.now().isoformat(),
        })