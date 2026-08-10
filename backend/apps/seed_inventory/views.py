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
                # Ligtas na salain ang entry na hindi tumutugma sa variety ng delivery
                if delivery.variety_id and entry.variety_id and str(entry.variety_id) != str(delivery.variety_id):
                    continue
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
        # Laktawan ang view cached instance upang basahin ang lumang status direkta mula sa DB bago i-save
        try:
            old_status = SeedDelivery.objects.get(pk=serializer.instance.pk).status
        except SeedDelivery.DoesNotExist:
            old_status = None
            
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
    from apps.seed_poll.utils import get_current_poll
    from .models import SeedDelivery, BrgyAllocation, DeliveryScheduleEntry
    from apps.distribution.models import DistributionBatch
    
    poll = get_current_poll()
    
    if poll:
        # --- LOGIC PARA SA LANDING PAGE TILES (Poll-Scoped) ---
        
        # 1. Total Deliveries Tile (e.g., 0/1)
        current_entries = DeliveryScheduleEntry.objects.filter(
            season=poll.season,
            year=poll.year
        )
        total_scheduled = current_entries.count()
        delivered_count = current_entries.filter(status='DELIVERED').count()
        total_del_label = f"{delivered_count}/{total_scheduled}" if total_scheduled > 0 else "0"
        
        # 2. Bags Received Tile
        bags_received = sum(e.total_bags for e in current_entries.filter(status='DELIVERED'))

        # 3. Bags Allocated Tile (History/Approved Beneficiaries)
        # Ito yung magpapakita ng 1.5 kung may approved beneficiary data na para sa 2025
        batches = DistributionBatch.objects.filter(
            status='APPROVED',
            event__season=poll.season,
            event__year=poll.year
        )
        allocated = 0
        for b in batches:
            for entry in b.entries.all():
                # Logic base sa hectares multiplier mo
                multiplier = 1.0 if 'HYBRID' in b.event.seed_type.name.upper() else 2.0
                ha = float(entry.farm_area_ha or 0) if multiplier == 1.0 else float(entry.area_planted or 0)
                allocated += (ha * multiplier)

        # 4 & 5. Pending at Confirmed Pickups Tiles
        # Naka-filter lang sa deliveries ng CURRENT season
        deliveries = SeedDelivery.objects.filter(season=poll.season, year=poll.year)
        pending_conf = BrgyAllocation.objects.filter(status='PENDING', delivery__in=deliveries).count()
        confirmed_pick = BrgyAllocation.objects.filter(status='CONFIRMED', delivery__in=deliveries).count()

        return Response({
            'total_deliveries':      total_del_label,
            'total_bags_received':   bags_received,
            'total_bags_allocated':  allocated, 
            'pending_confirmations': pending_conf,
            'confirmed_pickups':     confirmed_pick,
            'current_season':        poll.season,
            'current_year':          poll.year,
        })
    
    return Response({'error': 'No active poll found'}, status=404)











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

            # Ligtas na laktawan ang entry kung may variety_id filter at hindi tumutugma
            if variety_id and entry.variety_id and str(entry.variety_id) != str(variety_id):
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
                # Ligtas na laktawan ang entry na hindi tumutugma sa variety ng delivery
                if delivery.variety_id and entry.variety_id and str(entry.variety_id) != str(delivery.variety_id):
                    continue
                ha = float(entry.farm_area_ha or 0) if is_hybrid else float(entry.area_planted or 0)
                total_ha += ha
                farmer_count += 1


        if total_ha <= 0:
            continue

        # ── Seed bag computation with exact kg tracking ──
        if is_hybrid:
            allocated_bags_exact = round(total_ha * 1.0, 2)
            allocated_bags_kg    = round(allocated_bags_exact * 15, 2)
            allocated_bags       = allocated_bags_exact  
        else:
            allocated_bags_exact = round(total_ha * 2.0, 2)
            allocated_bags_kg    = round(allocated_bags_exact * 20, 2)
            allocated_bags       = allocated_bags_exact  
        
        bag_label = f"{allocated_bags} bag{'s' if allocated_bags != 1 else ''} ({allocated_bags_kg:g}kg)"

        # Hinahanap ang ID ng kaakibat na Announcement record sa database
        from apps.announcements.models import Announcement
        ann = Announcement.objects.filter(
            target_role='BRGY',
            target_barangays=barangay,
            action_url=f"confirm-allocation-id:{delivery.id}",
            is_active=True
        ).first()

        # ── SELF-HEALING TRIGGER: Kung walang announcement sa database, gumawa tayo on-the-fly! ──
        # ── SELF-HEALING TRIGGER: Kung walang announcement sa database, gumawa tayo on-the-fly! ──
        if not ann:
            try:
                from apps.accounts.models import User
                variety_label = f" ({delivery.variety.name})" if delivery.variety else ''
                # Ligtas na pag-assign ng posted_by gamit ang fallback user upang hindi mag-silently fail ang model save
                posted_user = delivery.encoded_by or User.objects.filter(role='ADMIN').first()
                ann = Announcement.objects.create(
                    title=f"Seed Allocation — {delivery.seed_type.name}{variety_label}",
                    content=(
                        f"{allocated_bags} bags ({allocated_bags_kg:g}kg) · "
                        f"{farmer_count} farmer{'s' if farmer_count != 1 else ''} · "
                        f"{total_ha} ha · {delivery.season_display} {delivery.year}"
                    ),
                    action_title="Confirm Received",
                    action_url=f"confirm-allocation-id:{delivery.id}",
                    target_role='BRGY',
                    target_barangays=barangay,
                    posted_by=posted_user,
                    is_active=True,
                )
            except Exception:
                pass



        ann_id = ann.id if ann else None

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
            'announcement_id':   ann_id, # Ibinabalik ang dynamic announcement ID
        })

    return Response(result)

# ─────────────────────────────────────────
# DELIVERY SCHEDULE VIEWS (replaces localStorage)
# ─────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminUserRole])
def delivery_schedule_list_create(request):
    from .models import DeliverySchedule, DeliveryScheduleEntry
    from apps.announcements.models import Announcement # <--- I-import ang model dito

    if request.method == 'GET':
        schedules = DeliverySchedule.objects.prefetch_related('entries').order_by('-id')
        result = []
        total_count = schedules.count()
        for idx, s in enumerate(schedules):
            display_number = total_count - idx 
            result.append({
                'id': s.id,
                'display_number': display_number, 
                'createdAt': s.created_at.isoformat(),
                'updatedAt': s.updated_at.isoformat(),
                'entries': [
                    {
                        'id':            e.id,
                        'seedTypeId':    str(e.seed_type_db_id) if e.seed_type_db_id else str(e.id),
                        'seedTypeDbId':  e.seed_type_db_id,
                        'seedTypeName':  e.seed_type_name,
                        'varietyId':     e.variety_id,
                        'varietyName':   e.variety_name,
                        'source':        e.source,
                        'season':        e.season,
                        'year':          e.year,
                        'total_bags':    e.total_bags,
                        'delivery_date': str(e.delivery_date),
                        'status':        e.status,
                        'lot_number':    e.lot_number,
                        'remarks':       e.remarks,
                    }
                    for e in s.entries.all()
                ],
            })
        return Response(result)

    # POST — create new schedule
    entries_data = request.data.get('entries', [])
    if not entries_data:
        return Response({'error': 'No entries provided.'}, status=400)

    from apps.announcements.models import Announcement # Import model

    schedule = DeliverySchedule.objects.create()
    for e in entries_data:
        import datetime
        entry = DeliveryScheduleEntry.objects.create(
            schedule=schedule,
            seed_type_db_id=e.get('seedTypeDbId'),
            seed_type_name=e.get('seedTypeName', ''),
            variety_id=e.get('varietyId'),
            variety_name=e.get('varietyName', ''),
            source=e.get('source', ''),
            season=e.get('season', 'WET'),
            year=int(e.get('year', datetime.date.today().year)),
            total_bags=int(e.get('total_bags', 0)),
            delivery_date=e.get('delivery_date'),
            lot_number=e.get('lot_number', ''),
            remarks=e.get('remarks', ''),
            status=e.get('status', 'SCHEDULED'),
        )

        # ── AUTOMATED NOTIFICATION TRIGGER ──
        try:
            variety_label = f" ({entry.variety_name})" if entry.variety_name else ''
            Announcement.objects.create(
                title=f"Seed Schedule — {entry.seed_type_name}{variety_label}",
                content=(
                    f"Delivery on {entry.delivery_date} · "
                    f"{entry.total_bags} bags · {entry.get_season_display()} {entry.year}"
                ),
                target_role='BRGY',
                posted_by=request.user,
                is_active=True,
            )
        except Exception: pass

    return Response({'id': schedule.id, 'message': 'Schedule created and notification sent.'}, status=201)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdminUserRole])
def delivery_schedule_detail(request, schedule_id):
    from .models import DeliverySchedule, DeliveryScheduleEntry
    try:
        schedule = DeliverySchedule.objects.get(pk=schedule_id)
    except DeliverySchedule.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'DELETE':
        schedule.delete()
        return Response({'message': 'Deleted.'})

    entries_data = request.data.get('entries', [])
    schedule.entries.all().delete()
    for e in entries_data:
        import datetime
        DeliveryScheduleEntry.objects.create(
            schedule=schedule,
            seed_type_db_id=e.get('seedTypeDbId'),
            seed_type_name=e.get('seedTypeName', ''),
            variety_id=e.get('varietyId'),
            variety_name=e.get('varietyName', ''),
            source=e.get('source', ''),
            season=e.get('season', 'WET'),
            year=int(e.get('year', datetime.date.today().year)),
            total_bags=int(e.get('total_bags', 0)),
            delivery_date=e.get('delivery_date'),
            lot_number=e.get('lot_number', ''),
            remarks=e.get('remarks', ''),
            status=e.get('status', 'SCHEDULED'),
        )
    schedule.save()
    return Response({'message': 'Updated.'})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminUserRole])
def delivery_schedule_entry_update(request, entry_id):
    from .models import DeliveryScheduleEntry
    from apps.announcements.models import Announcement
    try:
        entry = DeliveryScheduleEntry.objects.get(pk=entry_id)
    except DeliveryScheduleEntry.DoesNotExist:
        return Response({'error': 'Entry not found.'}, status=404)

    old_status = entry.status
    for field in ['total_bags', 'delivery_date', 'lot_number', 'remarks', 'season', 'year', 'status']:
        if field in request.data:
            setattr(entry, field, request.data[field])
    entry.save()
    entry.schedule.save()

    # ── KAPAG PININDOT ANG DELIVERED BUTTON ──
    if old_status != 'DELIVERED' and entry.status == 'DELIVERED':
        try:
            variety_label = f" ({entry.variety_name})" if entry.variety_name else ''
            
            # A. Notif para sa BRGY (Lalabas sa Home Widget nila para sa Allocation)
            Announcement.objects.create(
                title=f"Seed Allocation — {entry.seed_type_name}{variety_label}",
                content=f"{entry.total_bags} bags are ready for allocation. Check your inventory.",
                action_title="Confirm Received",
                action_url=f"confirm-allocation-id:{entry.id}",
                target_role='BRGY',
                posted_by=request.user,
                is_active=True
            )

            # B. Notif para sa FARMER (Lalabas sa Dashboard at Bell nila)
            Announcement.objects.create(
                title=f"Seed Distribution — {entry.variety_name}",
                content=f"Seeds for {entry.variety_name} are arriving soon ({entry.get_season_display()} {entry.year}). Wait for schedule.",
                target_role='FARMER',
                posted_by=request.user,
                is_active=True
            )
        except Exception:
            pass

    return Response({'message': 'Entry updated and notifications triggered.'})


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

    # I-convert gamit ang Decimal precision para hindi mag-truncate sa 0 ang fractional bags (tulad ng 0.5)
    from decimal import Decimal, InvalidOperation
    try:
        allocated_bags_val = Decimal(str(allocated_bags))
    except (TypeError, ValueError, InvalidOperation):
        return Response({'error': 'Invalid allocated bags value.'}, status=400)

    if allocated_bags_val <= Decimal('0'):
        return Response({'error': 'Allocated bags must be greater than zero.'}, status=400)
    
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
            allocated_bags=allocated_bags_val,
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



