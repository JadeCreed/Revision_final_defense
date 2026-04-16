from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Sum, Count
from django.shortcuts import get_object_or_404

from apps.accounts.permissions import IsAdminUserRole
from .models import FarmPlot
from .serializers import FarmPlotSerializer, FarmPlotWriteSerializer, MapSummarySerializer


class FarmPlotListCreateView(APIView):
    """
    GET  /api/gis/plots/          — list all plots (admin) or own barangay (BRGY)
    POST /api/gis/plots/          — create a new plot (admin only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = FarmPlot.objects.select_related('farmer').all()
        # Filter by barangay
        barangay = request.query_params.get('barangay')
        if barangay:
            qs = qs.filter(barangay__iexact=barangay)
        elif request.user.role == 'BRGY':
            qs = qs.filter(barangay__iexact=getattr(request.user, 'barangay', ''))
        # Filter by farmer
        farmer_id = request.query_params.get('farmer')
        if farmer_id:
            qs = qs.filter(farmer_id=farmer_id)

        serializer = FarmPlotSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin only.'}, status=403)
        serializer = FarmPlotWriteSerializer(data=request.data)
        if serializer.is_valid():
            # Auto-set barangay from farmer profile if not provided
            plot = serializer.save()
            if not plot.barangay:
                plot.barangay = getattr(plot.farmer, 'barangay', '') or ''
                plot.save()
            return Response(FarmPlotSerializer(plot).data, status=201)
        return Response(serializer.errors, status=400)


class FarmPlotDetailView(APIView):
    """
    GET    /api/gis/plots/<id>/   — retrieve a plot
    PATCH  /api/gis/plots/<id>/   — update a plot (admin)
    DELETE /api/gis/plots/<id>/   — delete a plot (admin)
    """
    permission_classes = [IsAuthenticated]

    def _get_plot(self, pk):
        return get_object_or_404(FarmPlot, pk=pk)

    def get(self, request, pk):
        plot = self._get_plot(pk)
        return Response(FarmPlotSerializer(plot).data)

    def patch(self, request, pk):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin only.'}, status=403)
        plot = self._get_plot(pk)
        serializer = FarmPlotWriteSerializer(plot, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(FarmPlotSerializer(plot).data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin only.'}, status=403)
        plot = self._get_plot(pk)
        plot.delete()
        return Response(status=204)


class MapSummaryView(APIView):
    """
    GET /api/gis/summary/
    Returns counts and aggregates for the map header.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = FarmPlot.objects.all()
        if request.user.role == 'BRGY':
            qs = qs.filter(barangay__iexact=getattr(request.user, 'barangay', ''))

        agg = qs.aggregate(
            total_plots=Count('id'),
            total_farmers=Count('farmer', distinct=True),
            total_area=Sum('area_ha'),
        )
        barangays = list(qs.values_list('barangay', flat=True).distinct().order_by('barangay'))

        return Response({
            'total_plots':   agg['total_plots']   or 0,
            'total_farmers': agg['total_farmers'] or 0,
            'total_area_ha': float(agg['total_area'] or 0),
            'barangays':     barangays,
        })


class BarangayListView(APIView):
    """
    GET /api/gis/barangays/
    Returns distinct barangay names that have farm plots.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        barangays = (
            FarmPlot.objects
            .values_list('barangay', flat=True)
            .distinct()
            .order_by('barangay')
        )
        return Response(list(barangays))