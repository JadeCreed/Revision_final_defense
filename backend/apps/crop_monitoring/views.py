# apps/crop_monitoring/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Q

from apps.accounts.models import User
from apps.accounts.permissions import IsATUser, IsAdminUserRole
from apps.distribution.models import DistributionEntry
from apps.seed_poll.models import FinalSeed
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
        phase_filter = request.query_params.get('phase', '')

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

            dist_entry = DistributionEntry.objects.filter(
                farmer=farmer,
                batch__status='APPROVED'
            ).select_related(
                'variety', 'batch__event__variety', 'batch__event__seed_type'
            ).order_by('-batch__approved_at').first()

            distributed_variety = ''
            distributed_seed_type = ''
            if dist_entry:
                distributed_variety = dist_entry.variety.name if dist_entry.variety else (
                    dist_entry.batch.event.variety.name if dist_entry.batch.event.variety else ''
                )
                distributed_seed_type = dist_entry.batch.event.seed_type.name if dist_entry.batch.event.seed_type else ''

            results[-1].update({
                'distributed_variety': distributed_variety,
                'distributed_seed_type': distributed_seed_type,
            })

        if phase_filter:
            results = [r for r in results if r.get('latest_phase') == phase_filter]

        return Response({
            'farmers':    results,
            'barangays':  assigned_barangays,
            'total':      len(results),
        })


class ATFarmerDetailView(APIView):
    """
    GET /api/crop-monitoring/at/farmers/{farmer_id}/detail/
    Returns farm profile and approved distribution records for an AT-assigned farmer.
    """
    permission_classes = [IsAuthenticated, IsATUser]

    def get(self, request, farmer_id):
        at_profile = getattr(request.user, 'at_profile', None)
        if not at_profile:
            return Response({'error': 'AT profile not found.'}, status=400)

        assigned_barangays = at_profile.get_assigned_barangays()
        if not assigned_barangays:
            return Response({'error': 'No assigned barangays found.'}, status=400)

        try:
            farmer = User.objects.get(
                id=farmer_id,
                role='FARMER',
                status='APPROVED',
                is_active=True,
                barangay__in=assigned_barangays,
            )
        except User.DoesNotExist:
            return Response({'error': 'Farmer not found or not assigned to you.'}, status=404)

        profile = getattr(farmer, 'profile', None)
        distribution_entries = []
        for entry in DistributionEntry.objects.filter(
            farmer=farmer,
            batch__status='APPROVED'
        ).select_related('variety', 'batch__event__seed_type').order_by('-batch__approved_at'):
            distribution_entries.append({
                'seed_type': entry.batch.event.seed_type.name if entry.batch.event.seed_type else '',
                'variety_name': entry.variety.name if entry.variety else '',
                'farm_area_ha': entry.farm_area_ha,
                'qty_bags': entry.qty_bags,
                'date_received': entry.date_received.isoformat() if entry.date_received else None,
                'is_distributed': bool(entry.qty_bags or entry.date_received),
            })

        return Response({
            'id': farmer.id,
            'first_name': farmer.first_name,
            'last_name': farmer.last_name,
            'full_name': farmer.get_full_name(),
            'contact_number': farmer.contact_number,
            'rsbsa_number': farmer.rsbsa_number,
            'barangay': farmer.barangay,
            'profile': {
                'gender': profile.gender if profile else None,
                'date_of_birth': profile.date_of_birth.isoformat() if profile and profile.date_of_birth else None,
                'residency_municipality': profile.residency_municipality if profile else None,
                'residency_barangay': profile.residency_barangay if profile else None,
                'farm_municipality': profile.farm_municipality if profile else None,
                'farm_barangay': profile.farm_barangay if profile else None,
                'ip': profile.ip if profile else False,
                'senior_citizen': profile.senior_citizen if profile else False,
                'pwd': profile.pwd if profile else False,
                'arbs': profile.arbs if profile else False,
                'four_ps': profile.four_ps if profile else False,
            },
            'distribution_entries': distribution_entries,
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

        phase_status = request.data.get('phase_status', '').strip()
        valid_statuses = [s[0] for s in CropMonitoringRecord.STATUS_CHOICES]
        if not phase_status:
            return Response({'error': 'Phase status is required.'}, status=400)
        if phase_status not in valid_statuses:
            return Response({'error': f'Invalid phase status: {phase_status}'}, status=400)

        delay_days = None
        damage_cause = ''
        if phase_status == 'DELAYED':
            delay_days_raw = request.data.get('delay_days')
            if delay_days_raw in [None, '']:
                return Response({'error': 'Delay days are required for delayed status.'}, status=400)
            try:
                delay_days = int(delay_days_raw)
            except (TypeError, ValueError):
                return Response({'error': 'Delay days must be a whole number.'}, status=400)
            if delay_days < 0:
                return Response({'error': 'Delay days must be 0 or more.'}, status=400)
        elif phase_status == 'DAMAGED':
            damage_cause = request.data.get('damage_cause', '').strip()
            if not damage_cause:
                return Response({'error': 'Damage cause is required for damaged status.'}, status=400)

        date_observed = request.data.get('date_observed', '')
        if not date_observed:
            return Response({'error': 'Date observed is required.'}, status=400)

        # Build record
        record = CropMonitoringRecord.objects.create(
            farmer=farmer,
            encoded_by=request.user,
            barangay=farmer.barangay,
            crop_phase=crop_phase,
            phase_status=phase_status,
            delay_days=delay_days,
            damage_cause=damage_cause,
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
    Returns monitoring records for a farmer. Default is the current season.
    Supports optional ?season= & ?year= to select a specific season/year.
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

        season = request.query_params.get('season')
        year = request.query_params.get('year')

        records = CropMonitoringRecord.objects.filter(
            farmer=farmer
        )

        def season_months(value):
            if value == 'WET':
                return [5, 6, 7, 8, 9, 10, 11]
            if value == 'DRY':
                return [12, 1, 2, 3, 4]
            return None

        def season_display(value):
            return {
                'WET': 'Wet Season',
                'DRY': 'Dry Season',
            }.get(value, value or '')

        selected_season = None
        if year or season:
            if year:
                try:
                    year_int = int(year)
                    records = records.filter(date_observed__year=year_int)
                except (TypeError, ValueError):
                    pass
            if season:
                season = season.upper()
                months = season_months(season)
                if months:
                    records = records.filter(date_observed__month__in=months)
            selected_season = {
                'season': season,
                'season_display': season_display(season),
                'year': int(year) if year and year.isdigit() else None,
            }
        else:
            latest_final_seed = FinalSeed.objects.order_by('-year', '-id').first()
            if latest_final_seed:
                year = latest_final_seed.year
                season = latest_final_seed.season
                months = season_months(season)
                records = records.filter(date_observed__year=year)
                if months:
                    records = records.filter(date_observed__month__in=months)
                selected_season = {
                    'season': season,
                    'season_display': latest_final_seed.get_season_display(),
                    'year': year,
                }

        records = records.order_by('-date_observed', '-encoded_at')
        serializer = CropMonitoringRecordSerializer(records, many=True)

        response = {
            'farmer_name': farmer.get_full_name(),
            'barangay':    farmer.barangay,
            'rsbsa':       farmer.rsbsa_number or '',
            'records':     serializer.data,
        }
        if selected_season:
            response['selected_season'] = selected_season
        return Response(response)


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
            'phase_status', 'delay_days', 'damage_cause',
        ]

        if 'phase_status' in request.data:
            phase_status = request.data.get('phase_status', '').strip()
            valid_statuses = [s[0] for s in CropMonitoringRecord.STATUS_CHOICES]
            if not phase_status:
                return Response({'error': 'Phase status is required.'}, status=400)
            if phase_status not in valid_statuses:
                return Response({'error': f'Invalid phase status: {phase_status}'}, status=400)
            record.phase_status = phase_status
            if phase_status == 'NORMAL':
                record.delay_days = None
                record.damage_cause = ''
            elif phase_status == 'DELAYED':
                delay_days_raw = request.data.get('delay_days')
                if delay_days_raw in [None, '']:
                    return Response({'error': 'Delay days are required for delayed status.'}, status=400)
                try:
                    record.delay_days = int(delay_days_raw)
                except (TypeError, ValueError):
                    return Response({'error': 'Delay days must be a whole number.'}, status=400)
                record.damage_cause = ''
            elif phase_status == 'DAMAGED':
                damage_cause = request.data.get('damage_cause', '').strip()
                if not damage_cause:
                    return Response({'error': 'Damage cause is required for damaged status.'}, status=400)
                record.damage_cause = damage_cause
                record.delay_days = None

        for field in allowed:
            if field in request.data and field != 'phase_status':
                if field == 'delay_days':
                    if request.data.get('delay_days') in [None, '']:
                        record.delay_days = None
                    else:
                        try:
                            record.delay_days = int(request.data.get('delay_days'))
                        except (TypeError, ValueError):
                            return Response({'error': 'Delay days must be a whole number.'}, status=400)
                elif field == 'damage_cause':
                    record.damage_cause = request.data.get('damage_cause', '').strip()
                else:
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