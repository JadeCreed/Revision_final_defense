from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import models

from apps.distribution.models import DistributionBatch

from .models import SeedDelivery, BrgyAllocation, SeedDeliveryAudit
from .serializers import (
    SeedDeliverySerializer, SeedDeliveryCreateSerializer,
    BrgyAllocationSerializer, SeedDeliveryAuditSerializer,
)
from apps.accounts.permissions import IsAdminUserRole, IsBPUser


# ─────────────────────────────────────────
# ADMIN VIEWS
# ─────────────────────────────────────────

class SeedDeliveryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SeedDeliveryCreateSerializer
        return SeedDeliverySerializer

    def get_queryset(self):
        qs = SeedDelivery.objects.select_related(
            'seed_type', 'variety', 'encoded_by'
        ).prefetch_related('allocations__confirmed_by')
        season = self.request.query_params.get('season')
        year   = self.request.query_params.get('year')
        if season:
            qs = qs.filter(season=season)
        if year:
            qs = qs.filter(year=year)
        return qs

    def perform_create(self, serializer):
        delivery = serializer.save(encoded_by=self.request.user)
        SeedDeliveryAudit.objects.create(
            delivery=delivery,
            action='CREATED',
            performed_by=self.request.user,
            details=f"Recorded {delivery.total_bags} bags of {delivery.seed_type.name} "
                    f"delivered on {delivery.delivery_date}."
        )


class SeedDeliveryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    queryset = SeedDelivery.objects.select_related(
        'seed_type', 'variety', 'encoded_by'
    ).prefetch_related('allocations__confirmed_by', 'audits__performed_by')

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return SeedDeliveryCreateSerializer
        return SeedDeliverySerializer

    def perform_update(self, serializer):
        delivery = serializer.save()
        SeedDeliveryAudit.objects.create(
            delivery=delivery,
            action='UPDATED',
            performed_by=self.request.user,
            details=f"Updated delivery record. Total bags: {delivery.total_bags}."
        )

    def perform_destroy(self, instance):
        SeedDeliveryAudit.objects.create(
            delivery=None,
            action='DELETED',
            performed_by=self.request.user,
            details=f"Deleted delivery of {instance.seed_type.name} "
                    f"({instance.season} {instance.year})."
        )
        instance.delete()


class BrgyAllocationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    serializer_class   = BrgyAllocationSerializer

    def get_queryset(self):
        return BrgyAllocation.objects.filter(
            delivery_id=self.kwargs['delivery_id']
        ).select_related('confirmed_by', 'delivery__seed_type', 'delivery__variety')

    def perform_create(self, serializer):
        delivery = get_object_or_404(SeedDelivery, pk=self.kwargs['delivery_id'])
        requested = serializer.validated_data['allocated_bags']
        if requested > delivery.remaining_bags:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'allocated_bags': f'Only {delivery.remaining_bags} bags remaining in this delivery.'
            })
        allocation = serializer.save(delivery=delivery)
        SeedDeliveryAudit.objects.create(
            delivery=delivery,
            allocation=allocation,
            action='ALLOCATED',
            performed_by=self.request.user,
            details=f"Allocated {allocation.allocated_bags} bags to Brgy. {allocation.barangay}."
        )


class SeedDeliveryAuditListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    serializer_class   = SeedDeliveryAuditSerializer

    def get_queryset(self):
        return SeedDeliveryAudit.objects.filter(
            delivery_id=self.kwargs['delivery_id']
        ).select_related('performed_by')


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUserRole])
def inventory_summary_view(request):
    """Dashboard stats for admin."""
    deliveries   = SeedDelivery.objects.select_related('seed_type').prefetch_related('allocations')
    total_bags   = sum(d.total_bags    for d in deliveries)
    allocated    = sum(d.allocated_bags for d in deliveries)
    remaining    = sum(d.remaining_bags for d in deliveries)
    pending_conf = BrgyAllocation.objects.filter(status='PENDING').count()
    confirmed    = BrgyAllocation.objects.filter(status='CONFIRMED').count()

    return Response({
        'total_deliveries':        deliveries.count(),
        'total_bags_received':     total_bags,
        'total_bags_allocated':    allocated,
        'total_bags_remaining':    remaining,
        'pending_confirmations':   pending_conf,
        'confirmed_pickups':       confirmed,
    })


# ─────────────────────────────────────────
# BRGY VIEWS
# ─────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsBPUser])
def brgy_allocation_view(request):
    """All allocations for the BRGY — split pending and confirmed."""
    allocations = BrgyAllocation.objects.filter(
        barangay=request.user.barangay
    ).select_related(
        'delivery__seed_type', 'delivery__variety', 'confirmed_by'
    ).order_by('status', '-delivery__delivery_date')

    serializer = BrgyAllocationSerializer(allocations, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsBPUser])
def confirm_pickup_view(request, allocation_id):
    """BRGY confirms they physically received the seeds."""
    allocation = get_object_or_404(
        BrgyAllocation,
        pk=allocation_id,
        barangay=request.user.barangay,
    )
    if allocation.status == 'CONFIRMED':
        return Response(
            {'error': 'Already confirmed.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allocation.status         = 'CONFIRMED'
    allocation.confirmed_by   = request.user
    allocation.date_confirmed = timezone.now().date()
    allocation.save()

    SeedDeliveryAudit.objects.create(
        delivery=allocation.delivery,
        allocation=allocation,
        action='CONFIRMED',
        performed_by=request.user,
        details=f"Brgy. {allocation.barangay} confirmed receipt of "
                f"{allocation.allocated_bags} bags on {allocation.date_confirmed}."
    )

    return Response(BrgyAllocationSerializer(allocation).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsBPUser])
def brgy_pending_count_view(request):
    """Used by BRGY dashboard to show notification badge."""
    count = BrgyAllocation.objects.filter(
        barangay=request.user.barangay,
        status='PENDING',
    ).count()
    return Response({'pending_count': count})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUserRole])
def brgy_beneficiary_allocation_view(request):
    """
    Fetches approved BENEFICIARY batches (status='APPROVED') from
    the distribution app. These are batches that the BRGY President
    encoded and the admin approved in the Beneficiaries menu.

    We read farm_area_ha (Hybrid) and area_planted (Inbred) which
    are filled during beneficiary encoding — NOT distribution fields
    like qty_bags or date_received.
    """
    seed_type_id = request.query_params.get('seed_type_id')
    variety_id = request.query_params.get('variety_id')
    season = request.query_params.get('season')
    year = request.query_params.get('year')

    batches_qs = DistributionBatch.objects.filter(
        status='APPROVED'
    ).select_related(
        'event__seed_type',
        'event__variety',
    ).prefetch_related(
        'entries__farmer',
        'entries__variety',
    )

    if seed_type_id:
        batches_qs = batches_qs.filter(event__seed_type_id=seed_type_id)

    if variety_id:
        batches_qs = batches_qs.filter(
            models.Q(event__variety_id=variety_id) |
            models.Q(entries__variety_id=variety_id)
        ).distinct()

    if season:
        batches_qs = batches_qs.filter(event__season=season.upper())

    if year:
        batches_qs = batches_qs.filter(event__year=year)

    brgy_map = {}

    for batch in batches_qs:
        event = batch.event
        barangay = event.barangay
        if not barangay:
            continue

        seed_type_name = (event.seed_type.name or '').upper() if event.seed_type else ''
        is_hybrid = 'HYBRID' in seed_type_name or seed_type_name in ('NRP', 'RFO')
        season_display = dict([
            ('WET', 'Wet Season'),
            ('DRY', 'Dry Season'),
        ]).get(event.season, event.season)

        if barangay not in brgy_map:
            brgy_map[barangay] = {
                'barangay': barangay,
                'season': event.season,
                'season_display': season_display,
                'year': event.year,
                'seed_type_id': event.seed_type_id,
                'seed_type_name': event.seed_type.name if event.seed_type else '',
                'total_farmers': 0,
                'total_hectares': 0.0,
                'farmers': [],
            }

        for entry in batch.entries.all():
            farmer = entry.farmer
            if not farmer:
                continue

            if is_hybrid:
                hectares = float(entry.farm_area_ha or 0)
                seed_type_label = 'Hybrid'
            else:
                hectares = float(entry.area_planted or 0)
                seed_type_label = 'Inbred'

            variety_name = ''
            if entry.variety:
                variety_name = entry.variety.name
            elif event.variety:
                variety_name = event.variety.name

            brgy_map[barangay]['total_farmers'] += 1
            brgy_map[barangay]['total_hectares'] += hectares
            brgy_map[barangay]['farmers'].append({
                'farmer_id': farmer.id,
                'farmer_name': farmer.get_full_name(),
                'rsbsa_number': farmer.rsbsa_number or '',
                'hectares': hectares,
                'variety_name': variety_name,
                'seed_type_label': seed_type_label,
                'batch_number': batch.batch_number,
            })

    for brgy in brgy_map.values():
        brgy['total_hectares'] = round(brgy['total_hectares'], 2)

    return Response(list(brgy_map.values()))



