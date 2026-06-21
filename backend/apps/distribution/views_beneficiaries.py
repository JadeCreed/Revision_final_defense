# views_beneficiaries.py
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
from collections                import Counter

from .models import (
    DistributionEvent,
    DistributionBatch,
    DistributionEntry,
    DistributionAudit,
)
from .serializers_beneficiaries import (
    DistributionEventSerializer,
    DistributionEventListSerializer,
    DistributionBatchSerializer,
    DistributionBatchListSerializer,
    DistributionEntrySerializer,
    DistributionEntryListSerializer,
    DistributionAuditSerializer,
)


def log_action(event=None, batch=None, user=None, action='', notes=''):
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
# EVENTS
# ═══════════════════════════════════════════════════════════

class DistributionEventListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'ADMIN':
            qs = DistributionEvent.objects.all()
        elif request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            qs   = DistributionEvent.objects.filter(barangay=brgy)
        else:
            return Response({"error": "Access denied."}, status=403)

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
        if request.user.role not in ('BRGY', 'ADMIN'):
            return Response({"error": "Access denied."}, status=403)

        serializer = DistributionEventSerializer(data=request.data)
        if serializer.is_valid():
            total_members_value = serializer.validated_data.pop('total_members', None)
            event = serializer.save(
                created_by=request.user,
                total_members=total_members_value if total_members_value is not None else 0,
            )
            log_action(
                event=event, user=request.user, action='CREATED',
                notes=f"Created {event.intervention} event for {event.barangay}"
            )
            return Response(
                DistributionEventListSerializer(event).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DistributionEventDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        event = get_object_or_404(DistributionEvent, pk=pk)
        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)
        serializer = DistributionEventSerializer(event)
        return Response(serializer.data)

    def put(self, request, pk):
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
# BATCHES
# ═══════════════════════════════════════════════════════════

class DistributionBatchListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, event_id):
        event = get_object_or_404(DistributionEvent, pk=event_id)
        batches = event.batches.all().order_by('batch_number')
        serializer = DistributionBatchListSerializer(batches, many=True)
        return Response(serializer.data)

    def post(self, request, event_id):
        event = get_object_or_404(DistributionEvent, pk=event_id)
        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        last_batch = event.batches.order_by('-batch_number').first()
        requested_variety_id = request.data.get('variety_id')

        if last_batch and last_batch.status == 'DRAFT' and not last_batch.is_full():
            # Pinapayagan ang parallel draft batches para sa Hybrid program kung magkaiba ang seed variety.
            # Haharangin lamang kapag pareho ang variety ng bagong entry sa kasalukuyang hindi pa punong draft batch.
            last_batch_variety_id = last_batch.entries.values_list('variety_id', flat=True).first()
            same_variety = (
                requested_variety_id is None
                or last_batch_variety_id is None
                or str(last_batch_variety_id) == str(requested_variety_id)
            )
            if same_variety:
                return Response({
                    "error": f"Batch {last_batch.batch_number} is still incomplete. "
                             f"Please finish encoding before creating a new batch."
                }, status=400)

        next_number = (last_batch.batch_number + 1) if last_batch else 1

        batch = DistributionBatch.objects.create(
            event=event,
            batch_number=next_number,
            status='DRAFT',
            encoded_by=request.user,
        )
        log_action(
            event=event, batch=batch, user=request.user, action='ENCODED',
            notes=f"Created Batch {next_number}"
        )
        serializer = DistributionBatchSerializer(batch)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DistributionBatchDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)
        serializer = DistributionBatchSerializer(batch)
        return Response(serializer.data)


class DistributionBatchSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)
        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if batch.event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        if batch.status not in ('DRAFT', 'REJECTED'):
            return Response({
                "error": f"Batch is already {batch.get_status_display()}. "
                         f"Only DRAFT or REJECTED batches can be submitted."
            }, status=400)

        if batch.entries.count() == 0:
            return Response({"error": "Cannot submit empty batch."}, status=400)

        batch.status = 'SUBMITTED'
        batch.submitted_at = timezone.now()
        batch.rejected_reason = ''
        batch.distribution_status = 'PENDING'
        batch.save()

        log_action(
            event=batch.event, batch=batch, user=request.user, action='SUBMITTED',
            notes=f"Batch {batch.batch_number} submitted with {batch.entries.count()} entries"
        )
        return Response({
            "message": f"Batch {batch.batch_number} submitted for admin review.",
            "status": "SUBMITTED"
        })


class DistributionBatchApproveView(APIView):
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
        batch.distribution_status = 'PENDING'
        batch.save()

        log_action(
            event=batch.event, batch=batch, user=request.user, action='APPROVED',
            notes=f"Batch {batch.batch_number} approved by admin"
        )
        return Response({
            "message": f"Batch {batch.batch_number} approved and locked.",
            "status":  "APPROVED"
        })


class DistributionBatchRejectView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)
        if batch.status not in ('SUBMITTED',):
            return Response({"error": "Only SUBMITTED batches can be rejected."}, status=400)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({"error": "Rejection reason is required."}, status=400)

        batch.status = 'REJECTED'
        batch.rejected_reason = reason
        batch.save()

        log_action(
            event=batch.event, batch=batch, user=request.user, action='REJECTED',
            notes=f"Rejected: {reason}"
        )
        return Response({
            "message": "Batch rejected. BRGY has been notified.",
            "status":  "REJECTED"
        })


class DistributionBatchReopenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)
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
            event=batch.event, batch=batch, user=request.user, action='EDITED',
            notes=f"BRGY reopened Batch {batch.batch_number} for fixes and resubmission",
        )
        return Response({
            "message": "Batch reopened. You can now edit entries and resubmit.",
            "status": "DRAFT",
        })


class DistributionBatchUnlockView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        batch  = get_object_or_404(DistributionBatch, pk=pk)
        reason = request.data.get('reason', '').strip()
        if batch.status != 'APPROVED':
            return Response({"error": "Only APPROVED batches can be unlocked."}, status=400)

        batch.status = 'SUBMITTED'
        batch.save()

        log_action(
            event=batch.event, batch=batch, user=request.user, action='EDITED',
            notes=f"Unlocked for emergency edit. Reason: {reason}"
        )
        return Response({
            "message": "Batch unlocked. Edit and re-approve when done.",
            "status": "SUBMITTED",
            "reason": reason,
        })


# ═══════════════════════════════════════════════════════════
# ENTRIES
# ═══════════════════════════════════════════════════════════

class DistributionEntryCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, batch_id):
        batch = get_object_or_404(DistributionBatch, pk=batch_id)
        event = batch.event

        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        if batch.status != 'DRAFT':
            return Response({"error": "Cannot add entries to a non-DRAFT batch."}, status=400)

        if batch.is_full():
            return Response({"error": "Batch is full (10 farmers max). Create a new batch."}, status=400)

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

        if farmer.barangay != event.barangay:
            return Response({
                "error": f"Farmer is from {farmer.barangay}, not {event.barangay}."
            }, status=400)

        if DistributionEntry.objects.filter(batch=batch, farmer=farmer).exists():
            return Response({
                "error": f"{farmer.first_name} {farmer.last_name} is already in this batch."
            }, status=400)

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

        log_action(
            event=event, batch=batch, user=request.user, action='ENCODED',
            notes=f"Added {farmer.first_name} {farmer.last_name} as row {row_number}"
        )

        serializer = DistributionEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DistributionEntryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        return get_object_or_404(DistributionEntry, pk=pk)

    def put(self, request, pk):
        entry = self.get_object(pk)
        # Tinanggal ang 'APPROVED' para harangan ang pag-edit sa non-DRAFT/non-REJECTED batches
        editable_statuses = ('DRAFT', 'REJECTED')
        if entry.batch.status not in editable_statuses:
            if not (request.user.role == 'ADMIN' and entry.batch.status == 'SUBMITTED'):
                return Response(
                    {"error": "Cannot edit entries from a non-DRAFT batch."},
                    status=400
                )

        allowed = [
            'farm_area_ha', 'crop_establishment', 'qty_bags', 'date_received',
            'expected_sowing_date', 'authorized_representative',
            'area_planted', 'expected_yield', 'variety', 'data_sharing'
        ]
        data = {k: v for k, v in request.data.items() if k in allowed}

        # Ang expected_sowing_date at authorized_representative ay non-nullable CharFields.
        # I-normalize ang None/null sa empty string '' para hindi mag-fail ang validation kapag nakasara ang optional fields sa UI.
        for text_field in ('expected_sowing_date', 'authorized_representative'):
            if text_field in data and data[text_field] is None:
                data[text_field] = ''

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

        for i, e in enumerate(batch.entries.order_by('row_number'), start=1):
            if e.row_number != i:
                e.row_number = i
                e.save()

        log_action(
            event=batch.event, batch=batch, user=request.user, action='EDITED',
            notes=f"Removed {name} from row {row_number}"
        )
        return Response({"message": f"{name} removed from batch."})


class DistributionEntrySignatureView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        entry = get_object_or_404(DistributionEntry, pk=pk)
        if entry.batch.status not in ('DRAFT', 'SUBMITTED', 'APPROVED'):
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
# ADMIN — BENEFICIARY APPROVALS
# ═══════════════════════════════════════════════════════════

class AdminPendingBatchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if not brgy:
                return Response({"error": "No barangay assigned."}, status=400)
            batches = DistributionBatch.objects.filter(
                status='SUBMITTED', event__barangay=brgy
            ).select_related('event', 'encoded_by').order_by('submitted_at')
        elif request.user.role == 'ADMIN':
            batches = DistributionBatch.objects.filter(
                status='SUBMITTED'
            ).select_related('event', 'encoded_by').order_by('submitted_at')
        else:
            return Response({"error": "Access denied."}, status=403)

        serializer = DistributionBatchListSerializer(batches, many=True)
        return Response(serializer.data)


# ═══════════════════════════════════════════════════════════
# AUDIT LOG
# ═══════════════════════════════════════════════════════════

class DistributionAuditView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        batch = get_object_or_404(DistributionBatch, pk=batch_id)
        logs  = batch.audit_logs.all().order_by('-timestamp')
        serializer = DistributionAuditSerializer(logs, many=True)
        return Response(serializer.data)


# ═══════════════════════════════════════════════════════════
# BRGY CONTEXT + DELETE
# ═══════════════════════════════════════════════════════════

class BrgyDistributionContextView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ('BRGY', 'ADMIN'):
            return Response({"error": "Access denied."}, status=403)

        barangay = getattr(request.user, 'barangay', None)
        if not barangay:
            return Response({"error": "No barangay assigned."}, status=400)

        total_farmers = User.objects.filter(
            role='FARMER',
            status='APPROVED',
            is_active=True,
            barangay=barangay,
        ).count()

        from apps.seed_poll.models import Poll
        from apps.seed_poll.utils import get_current_poll, get_encoding_poll
        from django.utils import timezone as tz
        Poll.objects.filter(status='OPEN', end_date__lte=tz.now()).update(status='CLOSED')
        current_poll = get_current_poll()
        encoding_poll = get_encoding_poll()

        current_season = None
        if current_poll:
            current_season = {
                'season':         current_poll.season,
                'season_display': current_poll.get_season_display(),
                'year':           current_poll.year,
            }

        encoding_allowed = bool(encoding_poll)
        encoding_season = None
        encoding_blocked_reason = None
        if encoding_allowed:
            encoding_season = {
                'season':         encoding_poll.season,
                'season_display': encoding_poll.get_season_display(),
                'year':           encoding_poll.year,
            }
        else:
            # Determine why encoding is blocked for clearer frontend messaging
            latest = Poll.objects.order_by('-created_at').first()
            if not latest:
                encoding_blocked_reason = 'No poll configured.'
            elif latest.status != 'CLOSED':
                encoding_blocked_reason = 'Latest poll is not closed yet.'
            else:
                from apps.seed_poll.models import FinalSeed
                if not FinalSeed.objects.filter(season=latest.season, year=latest.year).exists():
                    encoding_blocked_reason = 'Final seeds not finalized for latest poll.'
                else:
                    encoding_blocked_reason = 'Encoding not allowed for current poll.'

        return Response({
            'barangay':               barangay,
            'total_approved_farmers': total_farmers,
            'current_season':         current_season,
            'encoding_allowed':       encoding_allowed,
            'encoding_season':        encoding_season,
            'encoding_blocked_reason': encoding_blocked_reason,
        })


class BrgyRequestDeleteEventView(APIView):
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

        return Response({"message": "Deletion request submitted. Admin will review."})


class AdminConfirmDeleteEventView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def delete(self, request, pk):
        event = get_object_or_404(DistributionEvent, pk=pk)
        if not event.delete_requested:
            return Response({"error": "No deletion request for this event."}, status=400)
        event.delete()
        return Response({"message": "Program permanently deleted."})