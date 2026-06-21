import math
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


def _auto_announce_schedule(delivery, user):
    """Tinatawag kapag may bagong SeedDelivery na na-save bilang SCHEDULED.
    Ito ang nagpapadala ng 'Seed Schedule —' notification sa mga Barangay President."""
    try:
        from apps.announcements.models import Announcement
        variety_label = f" ({delivery.variety.name})" if delivery.variety else ''
        Announcement.objects.create(
            title=f"Seed Schedule — {delivery.seed_type.name}{variety_label}",
            content=(
                f"Delivery on {delivery.delivery_date.strftime('%b %d, %Y')} · "
                f"{delivery.total_bags} bags · {delivery.season_display} {delivery.year}"
            ),
            target_role='BRGY',
            target_barangays='',
            posted_by=user,
            is_active=True,
        )
    except Exception:
        pass


def _compute_delivered_allocations_for_announcement(delivery):
    """Para sa isang DELIVERED na SeedDelivery, hinahanap ang lahat ng barangay na
    may approved beneficiary data para ma-compute ang kanya-kanyang bag allocation."""
    from apps.distribution.models import DistributionBatch

    seed_type = delivery.seed_type
    if not seed_type:
        return []

    seed_name = (seed_type.name or '').upper()
    is_hybrid = 'HYBRID' in seed_name or seed_name in ('NRP', 'RFO')

    batches_qs = DistributionBatch.objects.filter(
        status='APPROVED',
        event__season=delivery.season,
        event__year=delivery.year,
        event__seed_type=seed_type,
    ).prefetch_related('entries')

    if delivery.variety:
        batches_qs = batches_qs.filter(
            models.Q(event__variety=delivery.variety) |
            models.Q(entries__variety=delivery.variety)
        ).distinct()

    brgy_map = {}
    for batch in batches_qs:
        barangay = batch.event.barangay
        if not barangay:
            continue
        if barangay not in brgy_map:
            brgy_map[barangay] = {'total_ha': 0.0, 'farmer_count': 0}
        for entry in batch.entries.all():
            ha = float(entry.farm_area_ha or 0) if is_hybrid else float(entry.area_planted or 0)
            if ha <= 0:
                continue
            brgy_map[barangay]['total_ha'] += ha
            brgy_map[barangay]['farmer_count'] += 1

    results = []
    for barangay, data in brgy_map.items():
        if data['total_ha'] <= 0:
            continue
        if is_hybrid:
            allocated_bags = round(data['total_ha'] * 1.0, 2)
            allocated_kg   = round(allocated_bags * 15, 2)
        else:
            allocated_bags = round(data['total_ha'] * 2.0, 2)
            allocated_kg   = round(allocated_bags * 20, 2)
        results.append({
            'barangay':       barangay,
            'farmer_count':   data['farmer_count'],
            'total_ha':       round(data['total_ha'], 2),
            'allocated_bags': allocated_bags,
            'allocated_kg':   allocated_kg,
        })
    return results


def _auto_announce_delivered(delivery, user):
    """Gumagawa ng unread Announcement para sa mga barangay na may active allocations.
    Gagamitin natin ang deep-link key na 'confirm-allocation-id:' sa action_url."""
    try:
        from apps.announcements.models import Announcement
        variety_label = f" ({delivery.variety.name})" if delivery.variety else ''
        allocations = _compute_delivered_allocations_for_announcement(delivery)
        for alloc in allocations:
            Announcement.objects.create(
                title=f"Seed Allocation — {delivery.seed_type.name}{variety_label}",
                content=(
                    f"{alloc['allocated_bags']} bags ({alloc['allocated_kg']}kg) · "
                    f"{alloc['farmer_count']} farmer{'s' if alloc['farmer_count'] != 1 else ''} · "
                    f"{alloc['total_ha']} ha · {delivery.season_display} {delivery.year}"
                ),
                action_title="Confirm Received",
                action_url=f"confirm-allocation-id:{delivery.id}",
                target_role='BRGY',
                target_barangays=alloc['barangay'],
                posted_by=user,
                is_active=True,
            )
    except Exception:
        pass




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
        if delivery.status == 'SCHEDULED':
            _auto_announce_schedule(delivery, self.request.user)
        elif delivery.status == 'DELIVERED':
            _auto_announce_delivered(delivery, self.request.user)


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
        old_status = self.get_object().status
        delivery   = serializer.save()
        SeedDeliveryAudit.objects.create(
            delivery=delivery,
            action='UPDATED',
            performed_by=self.request.user,
            details=f"Updated delivery record. Total bags: {delivery.total_bags}."
        )
        if old_status != 'DELIVERED' and delivery.status == 'DELIVERED':
            _auto_announce_delivered(delivery, self.request.user)

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

        existing_alloc = BrgyAllocation.objects.filter(
            barangay=brgy['barangay'],
            delivery__seed_type_id=brgy['seed_type_id'],
            delivery__season=brgy['season'],
            delivery__year=brgy['year'],
        ).first()
        brgy['alloc_status'] = existing_alloc.status if existing_alloc else 'PENDING'
        brgy['alloc_id'] = existing_alloc.id if existing_alloc else None
        brgy['already_confirmed'] = existing_alloc.status == 'CONFIRMED' if existing_alloc else False

    return Response(list(brgy_map.values()))


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsBPUser])
def brgy_my_seed_allocation_view(request):
    """
    Auto-computes how many bags this barangay should receive based on
    approved beneficiary hectares for each DELIVERED seed variety.
    """
    from apps.distribution.models import DistributionBatch
    from apps.seed_poll.models import FinalSeed
    # Inimport ang iyong utils para sa Seasonal Data Partitioning
    from apps.seed_poll.utils import get_current_poll

    barangay = request.user.barangay
    if not barangay:
        return Response([])

    # Kinukuha ang aktibong poll scope para sa kasalukuyang cycle
    poll = get_current_poll()
    if not poll:
        return Response([])

    season = poll.season
    year = poll.year


    delivered_deliveries = SeedDelivery.objects.filter(
        season=season,
        year=year,
        status='DELIVERED',
    ).select_related('seed_type', 'variety')

    if not delivered_deliveries.exists():
        return Response([])

    result = []

    for delivery in delivered_deliveries:
        seed_type = delivery.seed_type
        if not seed_type:
            continue

        seed_name = (seed_type.name or '').upper()
        is_hybrid = 'HYBRID' in seed_name or seed_name in ('NRP', 'RFO')

        batches = DistributionBatch.objects.filter(
            status='APPROVED',
            event__barangay=barangay,
            event__season=season,
            event__year=year,
            event__seed_type=seed_type,
        ).prefetch_related('entries')

        if delivery.variety:
            batches = batches.filter(
                models.Q(event__variety=delivery.variety) |
                models.Q(entries__variety=delivery.variety)
            ).distinct()

        if not batches.exists():
            continue

        total_ha = 0.0
        farmer_count = 0

        for batch in batches:
            for entry in batch.entries.all():
                ha = float(entry.farm_area_ha or 0) if is_hybrid else float(entry.area_planted or 0)
                total_ha += ha
                farmer_count += 1

        if total_ha <= 0:
            continue

        # ── Seed bag computation with exact kg tracking ──
        # Hybrid:  1 bag = 15kg, 1 bag per ha
        #          0.5 ha = 0.5 bag = 7.5kg
        # Inbred:  1 bag = 20kg, 2 bags per ha
        #          0.5 ha = 1 bag = 20kg (minimum 1 bag, ceiling)
        if is_hybrid:
            # Exact decimal bags — no ceiling, preserve decimal accuracy
            allocated_bags_exact = round(total_ha * 1.0, 2)
            allocated_bags_kg    = round(allocated_bags_exact * 15, 2)
            allocated_bags       = allocated_bags_exact  # keep decimal, e.g. 0.5
        else:
            # Inbred: 2 bags per ha — keep decimal, no ceiling
            allocated_bags_exact = round(total_ha * 2.0, 2)
            allocated_bags_kg    = round(allocated_bags_exact * 20, 2)
            allocated_bags       = allocated_bags_exact  # e.g. 3.9 ha → 7.8 bags
        
        # Format display string: "1 bag (7.5kg)" or "2 bags (15kg)"
        bag_label = f"{allocated_bags} bag{'s' if allocated_bags != 1 else ''} ({allocated_bags_kg:g}kg)"

        existing_alloc = BrgyAllocation.objects.filter(
            barangay=barangay,
            delivery=delivery,
        ).first()

        result.append({
            'delivery_id':       delivery.id,
            'seed_type_id':      seed_type.id,
            'seed_type_name':    seed_type.name,
            'variety_id':        delivery.variety_id,
            'variety_name':      delivery.variety.name if delivery.variety else '',
            'is_hybrid':         is_hybrid,
            'season':            season,
            'season_display':    dict([('WET', 'Wet Season'), ('DRY', 'Dry Season')]).get(season, season),
            'year':              year,
            'delivery_date':     str(delivery.delivery_date),
            'total_hectares':    round(total_ha, 2),
            'farmer_count':      farmer_count,
            'allocated_bags':       allocated_bags,
            'allocated_bags_kg':    allocated_bags_kg,
            'bag_label':            bag_label,
            'allocated_bags_exact': allocated_bags_exact,
            'allocated_kg_exact':   allocated_bags_kg,
            'bag_weight_kg':     15 if is_hybrid else 20,
            'alloc_status':      existing_alloc.status if existing_alloc else 'PENDING',
            'alloc_id':          existing_alloc.id if existing_alloc else None,
            'already_confirmed': existing_alloc.status == 'CONFIRMED' if existing_alloc else False,
        })

    return Response(result)
from apps.accounts.permissions import IsAdminUserRole, IsBPUser

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsBPUser])
def brgy_confirm_allocation_view(request):
    """Create/update BRGY allocation confirmation using the auto-computed bag count."""
    barangay = request.user.barangay
    delivery_id = request.data.get('delivery_id')
    allocated_bags = request.data.get('allocated_bags')

    if not all([barangay, delivery_id, allocated_bags is not None]):
        return Response({'error': 'Missing required fields.'}, status=400)


    # Validate allocated_bags is a positive integer
    try:
        allocated_bags_val = float(allocated_bags)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid allocated bags value.'}, status=400)

    if allocated_bags_val <= 0:
        return Response({'error': 'Allocated bags must be greater than zero.'}, status=400)
    
    # Store as integer only for the allocation record (physical bags received)
    allocated_bags_int = allocated_bags_val

    delivery = get_object_or_404(SeedDelivery, pk=delivery_id)

    existing = BrgyAllocation.objects.filter(delivery=delivery, barangay=barangay).first()
    if existing:
        if existing.status == 'CONFIRMED':
            return Response({'error': 'Already confirmed.'}, status=400)
        existing.allocated_bags = allocated_bags_int
        existing.status = 'CONFIRMED'
        existing.confirmed_by = request.user
        existing.date_confirmed = timezone.now().date()
        existing.save()
        alloc = existing
    else:
        alloc = BrgyAllocation.objects.create(
            delivery=delivery,
            barangay=barangay,
            allocated_bags=round(allocated_bags_val),
            status='CONFIRMED',
            confirmed_by=request.user,
            date_confirmed=timezone.now().date(),
            notes=f"Auto-confirmed by {request.user.get_full_name()} based on {allocated_bags_int} bags computed from beneficiary hectares.",
        )

    SeedDeliveryAudit.objects.create(
        delivery=delivery,
        allocation=alloc,
        action='CONFIRMED',
        performed_by=request.user,
        details=(
            f"Brgy. {barangay} confirmed receipt of {alloc.allocated_bags} bags "
            f"({delivery.season} {delivery.year}) on {alloc.date_confirmed}."
        )
    )

    return Response({
        'id': alloc.id,
        'barangay': alloc.barangay,
        'allocated_bags': alloc.allocated_bags,
        'status': alloc.status,
        'date_confirmed': str(alloc.date_confirmed),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsBPUser])
def brgy_schedule_notification_view(request):
    """
    Returns DELIVERED SeedDelivery records for the current season.
    Triggered only after admin confirms delivery of a seed variety.
    Used for Notif 2 (Confirm Received / allocated bags).
    """
    from apps.seed_poll.models import FinalSeed
    # Inimport ang iyong utils para sa Seasonal Data Partitioning
    from apps.seed_poll.utils import get_current_poll

    barangay = request.user.barangay
    if not barangay:
        return Response([])

    # Kinukuha ang aktibong poll scope para sa kasalukuyang cycle
    poll = get_current_poll()
    if not poll:
        return Response([])

    season = poll.season
    year = poll.year



    deliveries = SeedDelivery.objects.filter(
        season=season,
        year=year,
        total_bags__gt=0,
    ).select_related('seed_type', 'variety').order_by('-delivery_date')

    result = []
    for d in deliveries:
        result.append({
            'id': d.id,
            'seed_type_id': d.seed_type_id,
            'seed_type_name': d.seed_type.name if d.seed_type else '',
            'variety_id': d.variety_id,
            'variety_name': d.variety.name if d.variety else '',
            'season': d.season,
            'season_display': dict([('WET', 'Wet Season'), ('DRY', 'Dry Season')]).get(d.season, d.season),
            'year': d.year,
            'delivery_date': str(d.delivery_date),
            'total_bags': d.total_bags,
            'status': getattr(d, 'status', 'SCHEDULED'),
        })

    return Response(result)



