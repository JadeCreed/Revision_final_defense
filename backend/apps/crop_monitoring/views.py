from django.shortcuts import get_object_or_404
from django.db.models import Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import IsAdminUserRole, IsATUser
from apps.distribution.models import DistributionEntry
from .models import CropMonitoring
from .serializers import CropMonitoringSerializer, CropMonitoringCreateSerializer


class CropMonitoringEntriesView(APIView):
    """GET /api/crop-monitoring/entries/"""
    permission_classes = [IsAuthenticated, IsATUser]

    def get(self, request):
        try:
            assigned_barangays = list(
                request.user.at_profile.barangays.values_list('name', flat=True)
            )
        except Exception:
            return Response({'error': 'Unable to determine assigned barangays.'}, status=400)

        entries = DistributionEntry.objects.filter(
            batch__event__barangay__in=assigned_barangays
        ).select_related('farmer', 'batch__event').order_by('farmer__last_name', 'farmer__first_name')

        monitoring = CropMonitoring.objects.filter(
            distribution_entry__in=entries
        ).order_by('distribution_entry_id', '-created_at')

        latest_map = {}
        for record in monitoring:
            if record.distribution_entry_id not in latest_map:
                latest_map[record.distribution_entry_id] = record

        data = []
        for entry in entries:
            latest = latest_map.get(entry.id)
            current_phase = 'Awaiting distribution'
            phase_display = 'Awaiting distribution'
            if latest:
                current_phase = latest.phase
                phase_display = latest.get_phase_display()
            elif entry.qty_bags:
                current_phase = 'DISTRIBUTED'
                phase_display = 'Seed Distributed'

            data.append({
                'id': entry.id,
                'farmer_id': entry.farmer.id,
                'farmer_name': f"{entry.farmer.last_name}, {entry.farmer.first_name}",
                'farmer_rsbsa': entry.farmer.rsbsa_number or '',
                'farm_area_ha': entry.farm_area_ha,
                'current_phase': current_phase,
                'phase_display': phase_display,
                'last_monitored_at': latest.date_observed if latest else None,
                'barangay': entry.batch.event.barangay,
                'event_name': str(entry.batch.event),
            })

        return Response(data)


class CropMonitoringListCreateView(APIView):
    """GET/POST /api/crop-monitoring/"""
    permission_classes = [IsAuthenticated, IsATUser]

    def get(self, request):
        try:
            assigned_barangays = list(
                request.user.at_profile.barangays.values_list('name', flat=True)
            )
        except Exception:
            return Response({'error': 'Unable to determine assigned barangays.'}, status=400)

        qs = CropMonitoring.objects.filter(barangay__in=assigned_barangays).select_related('distribution_entry__farmer')
        serializer = CropMonitoringSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CropMonitoringCreateSerializer(data=request.data)
        if serializer.is_valid():
            entry = serializer.validated_data['distribution_entry']
            if entry.batch.event.barangay not in [
                *request.user.at_profile.barangays.values_list('name', flat=True)
            ]:
                return Response({'error': 'Cannot record crop monitoring for this barangay.'}, status=403)

            record = serializer.save(encoded_by=request.user)
            return Response(CropMonitoringSerializer(record).data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CropMonitoringSummaryView(APIView):
    """GET /api/crop-monitoring/summary/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'ADMIN':
            qs = CropMonitoring.objects.all()
        elif request.user.role == 'AT':
            try:
                assigned_barangays = list(
                    request.user.at_profile.barangays.values_list('name', flat=True)
                )
            except Exception:
                return Response({'error': 'Unable to determine assigned barangays.'}, status=400)
            qs = CropMonitoring.objects.filter(barangay__in=assigned_barangays)
        else:
            return Response({'error': 'Access denied.'}, status=403)

        total = qs.count()
        phase_counts = qs.values('phase').annotate(count=Count('id'))
        phase_counts_map = {item['phase']: item['count'] for item in phase_counts}

        return Response({
            'total_records': total,
            'phase_counts': phase_counts_map,
        })


class CropMonitoringBarangaySummaryView(APIView):
    """GET /api/crop-monitoring/barangays/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'ADMIN':
            qs = CropMonitoring.objects.all()
        elif request.user.role == 'AT':
            try:
                assigned_barangays = list(
                    request.user.at_profile.barangays.values_list('name', flat=True)
                )
            except Exception:
                return Response({'error': 'Unable to determine assigned barangays.'}, status=400)
            qs = CropMonitoring.objects.filter(barangay__in=assigned_barangays)
        else:
            return Response({'error': 'Access denied.'}, status=403)

        latest_by_entry = {}
        for record in qs.order_by('distribution_entry_id', '-created_at'):
            if record.distribution_entry_id not in latest_by_entry:
                latest_by_entry[record.distribution_entry_id] = record

        barangay_data = {}
        for record in latest_by_entry.values():
            summary = barangay_data.setdefault(record.barangay, {
                'barangay': record.barangay,
                'total': 0,
                'phase_counts': {},
                'dominant_phase': '',
            })
            summary['total'] += 1
            summary['phase_counts'][record.phase] = summary['phase_counts'].get(record.phase, 0) + 1

        for summary in barangay_data.values():
            if summary['total'] > 0:
                dominant = max(summary['phase_counts'].items(), key=lambda item: item[1])
                summary['dominant_phase'] = dominant[0]

        return Response(list(barangay_data.values()))
