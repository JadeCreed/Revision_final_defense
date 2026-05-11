from rest_framework.views       import APIView
from rest_framework.response    import Response
from rest_framework             import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination  import PageNumberPagination
from django.shortcuts           import get_object_or_404
from django.utils               import timezone
from django.db.models           import Q

from apps.accounts.permissions  import IsAdminUserRole, IsBPUser
from apps.accounts.models       import User
from apps.crop_monitoring.models import CropMonitoring
from .models import (
    DistributionEvent,
    DistributionBatch,
    DistributionEntry,
    DistributionAudit,
)
from .serializers import (
    DistributionEventSerializer,
    DistributionEventListSerializer,
    DistributionBatchSerializer,
    DistributionBatchListSerializer,
    DistributionEntrySerializer,
    DistributionEntryListSerializer,
    FarmerSearchSerializer,
    DistributionAuditSerializer,
)


def log_action(event=None, batch=None, user=None, action='', notes=''):
    """Helper to create audit log entries."""
    DistributionAudit.objects.create(
        event=event,
        batch=batch,
        user=user,
        action=action,
        notes=notes,
    )


class StandardPagination(PageNumberPagination):
    page_size             = 20
    page_size_query_param = 'page_size'
    max_page_size         = 100


# ═══════════════════════════════════════════════════════════
# SHARED — FARMER SEARCH
# Used by BRGY to find approved farmers to add to a batch
# ═══════════════════════════════════════════════════════════

class FarmerSearchView(APIView):
    """
    GET /api/distribution/farmers/search/?barangay=Abang&search=juan
    Returns APPROVED farmers in a given barangay.
    Used by BRGY to search farmers when encoding a batch.
    Optional: exclude farmers already in a specific batch.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search   = request.query_params.get('search', '')
        event_id = request.query_params.get('event_id', None)

        # ── AUTO-DETECT BARANGAY from the logged-in user ──
        if request.user.role == 'BRGY':
            barangay = getattr(request.user, 'barangay', None)
        else:
            # Admin can pass barangay as param
            barangay = request.query_params.get('barangay', '')

        if not barangay:
            return Response({"error": "No barangay assigned to this account."}, status=400)

        # APPROVED farmers in the BRGY's barangay only
        qs = User.objects.filter(
            role='FARMER',
            status='APPROVED',
            is_active=True,
            barangay=barangay,
        )

        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)  |
                Q(rsbsa_number__icontains=search)
            )

        # Exclude farmers already enrolled in this event (any batch)
        if event_id:
            already_enrolled = DistributionEntry.objects.filter(
                batch__event_id=event_id
            ).values_list('farmer_id', flat=True)
            qs = qs.exclude(id__in=already_enrolled)

        qs = qs.order_by('last_name', 'first_name')[:50]
        serializer = FarmerSearchSerializer(qs, many=True)
        return Response(serializer.data)



# ═══════════════════════════════════════════════════════════
# DISTRIBUTION EVENTS
# ═══════════════════════════════════════════════════════════

class DistributionEventListCreateView(APIView):
    """
    GET  /api/distribution/events/
         List events. Admin sees all. BRGY sees their barangay only.

    POST /api/distribution/events/
         BRGY creates a new distribution event.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'ADMIN':
            qs = DistributionEvent.objects.all()
        elif request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            qs   = DistributionEvent.objects.filter(barangay=brgy)
        else:
            return Response({"error": "Access denied."}, status=403)

        # Filters
        barangay = request.query_params.get('barangay')
        if barangay:
            qs = qs.filter(barangay=barangay)

        intervention = request.query_params.get('intervention')
        if intervention:
            qs = qs.filter(intervention=intervention.upper())

        season = request.query_params.get('season')
        if season:
            qs = qs.filter(season=season.upper())

        year = request.query_params.get('year')
        if year:
            qs = qs.filter(year=year)

        qs = qs.order_by('-created_at')
        serializer = DistributionEventListSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        # Only BRGY and ADMIN can create events
        if request.user.role not in ('BRGY', 'ADMIN'):
            return Response({"error": "Access denied."}, status=403)

        serializer = DistributionEventSerializer(data=request.data)
        if serializer.is_valid():
            event = serializer.save(created_by=request.user)
            log_action(event=event, user=request.user, action='CREATED',
                       notes=f"Created {event.intervention} event for {event.barangay}")
            return Response(
                DistributionEventListSerializer(event).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DistributionEventDetailView(APIView):
    """
    GET /api/distribution/events/<id>/
    Full event detail with batches.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        event = get_object_or_404(DistributionEvent, pk=pk)

        # BRGY can only see their own barangay
        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        serializer = DistributionEventSerializer(event)
        return Response(serializer.data)

    def put(self, request, pk):
        """Admin or BRGY can edit event header (if still ACTIVE)."""
        event = get_object_or_404(DistributionEvent, pk=pk)

        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        serializer = DistributionEventSerializer(event, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


# ═══════════════════════════════════════════════════════════
# DISTRIBUTION BATCHES
# ═══════════════════════════════════════════════════════════

class DistributionBatchListCreateView(APIView):
    """
    GET  /api/distribution/events/<event_id>/batches/
         List all batches in an event.

    POST /api/distribution/events/<event_id>/batches/
         BRGY creates a new batch (auto-numbers it).
         Cannot create if last batch is still DRAFT and not full.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, event_id):
        event = get_object_or_404(DistributionEvent, pk=event_id)
        batches = event.batches.all().order_by('batch_number')
        serializer = DistributionBatchListSerializer(batches, many=True)
        return Response(serializer.data)

    def post(self, request, event_id):
        event = get_object_or_404(DistributionEvent, pk=event_id)

        # Check access
        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        # Check if total_members limit would be exceeded
        current_total = event.get_total_encoded()
        if current_total >= event.total_members:
            return Response({
                "error": f"Cannot create new batch. All {event.total_members} farmers already encoded."
            }, status=400)

        # Check if last batch is still a draft (force them to use it first)
        last_batch = event.batches.order_by('-batch_number').first()
        if last_batch and last_batch.status == 'DRAFT' and not last_batch.is_full():
            return Response({
                "error": f"Batch {last_batch.batch_number} is still incomplete. "
                         f"Please finish encoding before creating a new batch."
            }, status=400)

        # Auto-number the batch
        next_number = (last_batch.batch_number + 1) if last_batch else 1

        batch = DistributionBatch.objects.create(
            event=event,
            batch_number=next_number,
            status='DRAFT',
            encoded_by=request.user,
        )
        log_action(event=event, batch=batch, user=request.user, action='ENCODED',
                   notes=f"Created Batch {next_number}")
        serializer = DistributionBatchSerializer(batch)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DistributionBatchDetailView(APIView):
    """
    GET /api/distribution/batches/<id>/
    Full batch detail with all entries.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)
        serializer = DistributionBatchSerializer(batch)
        return Response(serializer.data)


class DistributionBatchSubmitView(APIView):
    """
    POST /api/distribution/batches/<id>/submit/
    BRGY submits a batch to admin for review.
    Batch must be DRAFT and have at least 1 entry.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)

        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if batch.event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        if batch.status not in ('DRAFT', 'REJECTED'):
            return Response({
                "error": f"Batch is already {batch.get_status_display()}. Cannot resubmit."
            }, status=400)

        if batch.entries.count() == 0:
            return Response({
                "error": "Cannot submit empty batch. Please add at least one farmer."
            }, status=400)

        batch.status       = 'SUBMITTED'
        batch.submitted_at = timezone.now()
        batch.save()

        log_action(event=batch.event, batch=batch, user=request.user, action='SUBMITTED',
                   notes=f"Batch {batch.batch_number} submitted with {batch.entries.count()} entries")

        return Response({
            "message": f"Batch {batch.batch_number} submitted for admin review.",
            "status":  "SUBMITTED"
        })


class DistributionBatchApproveView(APIView):
    """
    POST /api/distribution/batches/<id>/approve/
    Admin approves a SUBMITTED batch.
    Once approved → locked for report generation.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)

        if batch.status != 'SUBMITTED':
            return Response({
                "error": f"Batch is {batch.get_status_display()}. Only SUBMITTED batches can be approved."
            }, status=400)

        if batch.entries.count() == 0:
            return Response({"error": "Cannot approve an empty batch."}, status=400)

        batch.status      = 'APPROVED'
        batch.approved_at = timezone.now()
        batch.approved_by = request.user
        batch.save()

        log_action(event=batch.event, batch=batch, user=request.user, action='APPROVED',
                   notes=f"Batch {batch.batch_number} approved by admin")

        return Response({
            "message": f"Batch {batch.batch_number} approved and locked.",
            "status":  "APPROVED"
        })


class DistributionBatchRejectView(APIView):
    """
    POST /api/distribution/batches/<id>/reject/
    Admin rejects a batch with a reason.
    BRGY can fix and resubmit.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)

        if batch.status not in ('SUBMITTED',):
            return Response({
                "error": "Only SUBMITTED batches can be rejected."
            }, status=400)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({"error": "Rejection reason is required."}, status=400)

        # Keep status as REJECTED so the rejection is visible in reports.
        # BRGY must explicitly reopen the batch to continue editing.
        batch.status = 'REJECTED'
        batch.rejected_reason = reason
        batch.save()

        log_action(event=batch.event, batch=batch, user=request.user, action='REJECTED',
                   notes=f"Rejected: {reason}")

        return Response({
            "message": "Batch rejected. BRGY has been notified.",
            "status":  "REJECTED"
        })


class DistributionBatchReopenView(APIView):
    """
    POST /api/distribution/batches/<id>/reopen/
    BRGY reopens a REJECTED batch for editing:
      - status becomes DRAFT
      - rejection reason is cleared (so the banner disappears while fixing)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)

        # Only BRGY who owns the event can reopen
        if request.user.role != 'BRGY':
            return Response({"error": "Access denied."}, status=403)
        brgy = getattr(request.user, 'barangay', None)
        if batch.event.barangay != brgy:
            return Response({"error": "Access denied."}, status=403)

        if batch.status != 'REJECTED':
            return Response({"error": "Only REJECTED batches can be reopened."}, status=400)

        batch.status = 'DRAFT'
        batch.rejected_reason = ''
        batch.submitted_at = None
        batch.save()

        log_action(
            event=batch.event,
            batch=batch,
            user=request.user,
            action='EDITED',
            notes=f"BRGY reopened Batch {batch.batch_number} for fixes and resubmission",
        )

        return Response({
            "message": "Batch reopened. You can now edit entries and resubmit.",
            "status": "DRAFT",
        })


class DistributionBatchUnlockView(APIView):
    """
    POST /api/distribution/batches/<id>/unlock/
    Admin unlocks an APPROVED batch for emergency editing.
    Must re-lock after editing.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        batch  = get_object_or_404(DistributionBatch, pk=pk)
        reason = request.data.get('reason', '').strip()

        if batch.status != 'APPROVED':
            return Response({"error": "Only APPROVED batches can be unlocked."}, status=400)

        batch.status = 'SUBMITTED'
        batch.save()

        log_action(event=batch.event, batch=batch, user=request.user, action='EDITED',
                   notes=f"Unlocked for emergency edit. Reason: {reason}")

        return Response({
            "message": "Batch unlocked. Edit and re-approve when done.",
            "status": "SUBMITTED",
            "reason": reason,
        })


# ═══════════════════════════════════════════════════════════
# DISTRIBUTION ENTRIES
# ═══════════════════════════════════════════════════════════

class DistributionEntryCreateView(APIView):
    """
    POST /api/distribution/batches/<batch_id>/entries/
    Add a farmer to a batch.
    Validates:
      - Batch is DRAFT
      - Batch is not full
      - Farmer is APPROVED and in correct barangay
      - Farmer not already in this batch
      - Total members limit not exceeded
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, batch_id):
        batch = get_object_or_404(DistributionBatch, pk=batch_id)
        event = batch.event

        # Access check
        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        # Status check
        if batch.status != 'DRAFT':
            return Response({"error": "Cannot add entries to a non-DRAFT batch."}, status=400)

        # Capacity check
        if batch.is_full():
            return Response({"error": "Batch is full (10 farmers max). Create a new batch."}, status=400)

        # Total members check
        current_total = event.get_total_encoded()
        if current_total >= event.total_members:
            return Response({
                "error": f"Event is at capacity ({event.total_members} farmers)."
            }, status=400)

        # Get farmer
        farmer_id = request.data.get('farmer_id')
        try:
            farmer = User.objects.get(
                id=farmer_id,
                role='FARMER',
                status='APPROVED',
                is_active=True
            )
        except User.DoesNotExist:
            return Response({"error": "Farmer not found or not approved."}, status=404)

        # Farmer must be in the event's barangay
        if farmer.barangay != event.barangay:
            return Response({
                "error": f"Farmer is from {farmer.barangay}, not {event.barangay}."
            }, status=400)

        # Duplicate check in this batch
        if DistributionEntry.objects.filter(batch=batch, farmer=farmer).exists():
            return Response({
                "error": f"{farmer.first_name} {farmer.last_name} is already in this batch."
            }, status=400)

        # Validate variety selection
        variety_id = request.data.get('variety_id')
        variety = None
        if variety_id:
            from apps.seed_poll.models import SeedVariety
            try:
                variety = SeedVariety.objects.get(id=variety_id, seed_type=event.seed_type)
            except SeedVariety.DoesNotExist:
                return Response({"error": "Selected variety is invalid for this program."}, status=400)
            if event.variety and variety.id != event.variety.id:
                return Response({"error": "Selected variety must match the program variety."}, status=400)
        elif event.variety:
            variety = event.variety
        else:
            return Response({"error": "Variety selection is required for this program."}, status=400)

        data_sharing = request.data.get('data_sharing', False)
        if data_sharing is None:
            data_sharing = False
        if isinstance(data_sharing, str):
            data_sharing = data_sharing.lower() in ('true', '1', 'yes', 'y')

        def normalize_nullable(field_name):
            value = request.data.get(field_name)
            return None if value in ('', None) else value

        def normalize_text(field_name):
            value = request.data.get(field_name, '')
            return '' if value is None else value

        # Auto row number
        row_number = batch.entries.count() + 1

        entry = DistributionEntry.objects.create(
            batch=batch,
            farmer=farmer,
            row_number=row_number,
            farm_area_ha=normalize_nullable('farm_area_ha'),
            crop_establishment=request.data.get('crop_establishment'),
            qty_bags=normalize_nullable('qty_bags'),
            date_received=normalize_nullable('date_received'),
            expected_sowing_date=normalize_text('expected_sowing_date'),
            authorized_representative=normalize_text('authorized_representative'),
            area_planted=normalize_nullable('area_planted'),
            expected_yield=normalize_nullable('expected_yield'),
            variety=variety,
            data_sharing=data_sharing,
            encoded_by=request.user,
        )

        log_action(event=event, batch=batch, user=request.user, action='ENCODED',
                   notes=f"Added {farmer.first_name} {farmer.last_name} as row {row_number}")

        serializer = DistributionEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DistributionEntryDetailView(APIView):
    """
    PUT    /api/distribution/entries/<id>/   Update farm area, qty, crop establishment
    DELETE /api/distribution/entries/<id>/   Remove entry from batch (DRAFT only)
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        return get_object_or_404(DistributionEntry, pk=pk)

    def put(self, request, pk):
        entry = self.get_object(pk)

        # Allow editing in DRAFT batches.
        # If a batch was unlocked for emergency editing, ADMIN may also edit SUBMITTED entries.
        if entry.batch.status == 'SUBMITTED' and request.user.role != 'ADMIN':
            return Response({"error": "Cannot edit entries in a SUBMITTED batch."}, status=400)

        allowed = ['farm_area_ha', 'crop_establishment', 'qty_bags', 'date_received',
                   'expected_sowing_date', 'authorized_representative',
                   'area_planted', 'expected_yield', 'variety', 'data_sharing']
        data = {k: v for k, v in request.data.items() if k in allowed}

        serializer = DistributionEntrySerializer(entry, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            log_action(
                event=entry.batch.event,
                batch=entry.batch,
                user=request.user,
                action='EDITED',
                notes=f"Updated row {entry.row_number}: {list(data.keys())}"
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        entry = self.get_object(pk)

        if entry.batch.status != 'DRAFT':
            return Response({
                "error": "Cannot remove entries from a non-DRAFT batch."
            }, status=400)

        batch      = entry.batch
        row_number = entry.row_number
        name       = f"{entry.farmer.first_name} {entry.farmer.last_name}"
        entry.delete()

        # Re-number remaining entries
        for i, e in enumerate(batch.entries.order_by('row_number'), start=1):
            if e.row_number != i:
                e.row_number = i
                e.save()

        log_action(event=batch.event, batch=batch, user=request.user, action='EDITED',
                   notes=f"Removed {name} from row {row_number}")

        return Response({"message": f"{name} removed from batch."})


class DistributionEntrySignatureView(APIView):
    """
    POST /api/distribution/entries/<id>/signature/
    Save e-signature for a farmer entry.
    Body: { "signature": "data:image/png;base64,..." }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        entry = get_object_or_404(DistributionEntry, pk=pk)

        # Only editable in DRAFT (or SUBMITTED if admin)
        if entry.batch.status not in ('DRAFT', 'SUBMITTED'):
            if request.user.role != 'ADMIN':
                return Response({"error": "Cannot update signature for this batch status."}, status=400)

        signature = request.data.get('signature', '').strip()
        if not signature:
            return Response({"error": "Signature data is required."}, status=400)

        if not signature.startswith('data:image/'):
            return Response({"error": "Invalid signature format. Must be base64 image."}, status=400)

        entry.signature = signature
        entry.signed_at = timezone.now()
        entry.save()

        log_action(
            event=entry.batch.event,
            batch=entry.batch,
            user=request.user,
            action='SIGNED',
            notes=f"Signature captured for {entry.farmer.first_name} {entry.farmer.last_name}"
        )

        return Response({
            "message": "Signature saved.",
            "signed_at": entry.signed_at,
            "has_signature": True,
        })


# ═══════════════════════════════════════════════════════════
# ADMIN — PENDING APPROVALS
# ═══════════════════════════════════════════════════════════

class AdminPendingBatchesView(APIView):
    """
    GET /api/distribution/admin/pending/
    Returns all SUBMITTED batches waiting for approval.
    Sorted by submission date — oldest first.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        batches = DistributionBatch.objects.filter(
            status='SUBMITTED'
        ).select_related('event', 'encoded_by').order_by('submitted_at')

        serializer = DistributionBatchListSerializer(batches, many=True)
        return Response(serializer.data)


class AdminDistributionStatsView(APIView):
    """
    GET /api/distribution/admin/stats/
    Summary stats for admin dashboard.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        total_events   = DistributionEvent.objects.count()
        pending_batches = DistributionBatch.objects.filter(status='SUBMITTED').count()
        approved_batches = DistributionBatch.objects.filter(status='APPROVED').count()
        total_entries  = DistributionEntry.objects.filter(
            batch__status='APPROVED'
        ).count()

        return Response({
            "total_events":    total_events,
            "pending_batches": pending_batches,
            "approved_batches": approved_batches,
            "total_farmers_served": total_entries,
        })


class BrgyDistributionContextView(APIView):
    """
    GET /api/distribution/brgy-context/
    Returns:
      - barangay: auto-detected from BRGY account
      - total_approved_farmers: count of APPROVED farmers in that barangay
      - current_season: from the active seed poll
      - seed_types: available seed types and varieties
    Used by BrgyDistribution.jsx to pre-fill the create event form.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ('BRGY', 'ADMIN'):
            return Response({"error": "Access denied."}, status=403)

        barangay = getattr(request.user, 'barangay', None)
        if not barangay:
            return Response({"error": "No barangay assigned."}, status=400)

        # Count approved farmers in this barangay
        total_farmers = User.objects.filter(
            role='FARMER',
            status='APPROVED',
            is_active=True,
            barangay=barangay,
        ).count()

        # Get current season from seed poll
        from apps.seed_poll.models import Poll
        from django.utils import timezone as tz
        # Auto-close expired polls
        Poll.objects.filter(status='OPEN', end_date__lte=tz.now()).update(status='CLOSED')
        current_poll = Poll.objects.filter(
            status__in=['OPEN', 'LOCKED', 'CLOSED']
        ).order_by('-created_at').first()

        current_season = None
        if current_poll:
            current_season = {
                'season':         current_poll.season,
                'season_display': current_poll.get_season_display(),
                'year':           current_poll.year,
            }

        return Response({
            'barangay':              barangay,
            'total_approved_farmers': total_farmers,
            'current_season':        current_season,
        })

class AdminConfirmSeedDeliveryView(APIView):
    """
    POST /api/distribution/events/<id>/confirm-delivery/
    Admin confirms that seeds have been delivered to the BRGY.
    Body: { "seed_type_id": 1 }  (which seed type arrived)
    Single verification — admin is physically present at delivery.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        event = get_object_or_404(DistributionEvent, pk=pk)

        event.seed_delivered    = True
        event.seed_delivered_at = timezone.now()
        event.seed_delivered_by = request.user
        event.save()

        log_action(
            event=event,
            user=request.user,
            action='CREATED',
            notes=f"Seed delivery confirmed for {event.barangay} by admin"
        )

        return Response({
            "message": f"Seed delivery confirmed for {event.barangay}.",
            "delivered_at": event.seed_delivered_at,
        })


# ═══════════════════════════════════════════════════════════
# AUDIT LOG
# ═══════════════════════════════════════════════════════════

class DistributionAuditView(APIView):
    """
    GET /api/distribution/batches/<batch_id>/audit/
    Returns audit trail for a specific batch.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        batch = get_object_or_404(DistributionBatch, pk=batch_id)
        logs  = batch.audit_logs.all().order_by('-timestamp')
        serializer = DistributionAuditSerializer(logs, many=True)
        return Response(serializer.data)
    
class BrgyRequestDeleteEventView(APIView):
    """
    POST /api/distribution/events/<id>/request-delete/
    BRGY requests deletion of a program. Goes to admin for approval.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        event = get_object_or_404(DistributionEvent, pk=pk)

        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        event.delete_requested    = True
        event.delete_requested_at = timezone.now()
        event.delete_requested_by = request.user
        event.delete_request_note = request.data.get('note', '')
        event.save()

        return Response({
            "message": "Deletion request submitted. Admin will review.",
        })


class AdminConfirmDeleteEventView(APIView):
    """
    DELETE /api/distribution/events/<id>/confirm-delete/
    Admin permanently deletes a program that a BRGY requested to delete.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def delete(self, request, pk):
        event = get_object_or_404(DistributionEvent, pk=pk)

        if not event.delete_requested:
            return Response({"error": "No deletion request for this event."}, status=400)

        event.delete()
        return Response({"message": "Program permanently deleted."})
    

