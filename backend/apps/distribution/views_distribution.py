# views_distribution.py
from rest_framework.views       import APIView
from rest_framework.response    import Response
from rest_framework             import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts           import get_object_or_404
from django.utils               import timezone
from django.db.models           import Q
from django.http                import JsonResponse
from collections                import Counter

from apps.accounts.permissions  import IsAdminUserRole
from apps.accounts.models       import User
from apps.seed_poll.utils         import get_current_poll, get_encoding_poll

from .models import (
    DistributionEvent,
    DistributionBatch,
    DistributionEntry,
    DistributionAudit,
)
from .serializers_distribution import (
    FarmerSearchSerializer,
)

from .serializers_beneficiaries import (
    DistributionEntrySerializer,
    DistributionBatchListSerializer,
)
from .views_beneficiaries import log_action


# ═══════════════════════════════════════════════════════════
# GIS DATA
# ═══════════════════════════════════════════════════════════

PHASE_COLOR = {
    "DISTRIBUTION":  "#E5E7EB",
    "ESTABLISHMENT": "#3B82F6",
    "TILLERING":     "#22C55E",
    "FLOWERING":     "#A855F7",
    "RIPENING":      "#FACC15",
    "HARVESTING":    "#F97316",
}

def get_barangay_gis_data(request):
    entries = DistributionEntry.objects.filter(
        date_received__isnull=False
    ).select_related('farmer')

    barangay_data = {}
    for entry in entries:
        brgy = entry.farmer.barangay
        if not brgy:
            continue
        if brgy not in barangay_data:
            barangay_data[brgy] = {"total_farmers": set(), "phases": []}
        barangay_data[brgy]["total_farmers"].add(entry.farmer.id)
        barangay_data[brgy]["phases"].append("DISTRIBUTION")

    result = []
    overall_phases = []

    for brgy, data in barangay_data.items():
        total_farmers = len(data["total_farmers"])
        counter = Counter(data["phases"])
        total_entries = sum(counter.values())
        dominant = counter.most_common(1)[0][0] if counter else "DISTRIBUTION"
        breakdown = [
            {"phase": phase, "percent": round((count / total_entries) * 100)}
            for phase, count in counter.items()
        ]
        result.append({
            "barangay": brgy,
            "total_farmers": total_farmers,
            "dominant_phase": dominant,
            "color": PHASE_COLOR.get(dominant, "#E5E7EB"),
            "breakdown": breakdown
        })
        overall_phases.extend(data["phases"])

    overall_counter = Counter(overall_phases)
    overall_total = sum(overall_counter.values())
    overall_breakdown = [
        {"phase": p, "percent": round((c / overall_total) * 100)}
        for p, c in overall_counter.items()
    ] if overall_total > 0 else []

    return JsonResponse({
        "barangays": result,
        "overview": {
            "total_farmers":    len(set(e.farmer.id for e in entries)),
            "total_barangays":  len(result),
            "phases":           overall_breakdown,
            "dominant":         overall_counter.most_common(1)[0][0] if overall_counter else "DISTRIBUTION"
        }
    })


# ═══════════════════════════════════════════════════════════
# FARMER SEARCH — BUG FIXED DITO
# ═══════════════════════════════════════════════════════════

class FarmerSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search   = request.query_params.get('search', '')
        event_id = request.query_params.get('event_id', None)

        if request.user.role == 'BRGY':
            barangay = getattr(request.user, 'barangay', None)
        else:
            barangay = request.query_params.get('barangay', '')

        if not barangay:
            return Response({"error": "No barangay assigned to this account."}, status=400)

        qs = User.objects.filter(
            role='FARMER',
            is_active=True,
            status='APPROVED',
            barangay=barangay,
        ).select_related('profile')

        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)  |
                Q(rsbsa_number__icontains=search)
            )

        season = None
        year   = None
        if event_id:
            try:
                event  = DistributionEvent.objects.get(id=event_id)
                season = event.season
                year   = event.year
            except DistributionEvent.DoesNotExist:
                pass

        approved_batch_only = request.query_params.get(
            'approved_batch_only', ''
        ).lower() in ('1', 'true', 'yes')
        batch_id = request.query_params.get('batch_id', None)

        if approved_batch_only:
            entry_qs = DistributionEntry.objects.filter(batch__status='APPROVED')

            if batch_id:
                entry_qs = entry_qs.filter(batch_id=batch_id)
            elif event_id:
                entry_qs = entry_qs.filter(batch__event_id=event_id)
            else:
                # Use the encoding poll (only allow approved listings for the
                # season that is currently open for encoding). This ensures
                # distribution menus match the encoding gate.
                active_poll = get_encoding_poll()

                if not active_poll:
                    return Response([])

                entry_qs = entry_qs.filter(
                    batch__event__season=active_poll.season,
                    batch__event__year=active_poll.year,
                    batch__event__barangay=barangay,
                )

            approved_farmer_ids = entry_qs.values_list(
                'farmer_id', flat=True
            ).distinct()
            qs = qs.filter(id__in=approved_farmer_ids)

        elif event_id:
            already_enrolled = DistributionEntry.objects.filter(
                batch__event_id=event_id
            ).values_list('farmer_id', flat=True)
            qs = qs.exclude(id__in=already_enrolled)

        qs = qs.order_by('last_name', 'first_name')[:50]
        serializer = FarmerSearchSerializer(
            qs, many=True,
            context={'season': season, 'year': year}
        )
        return Response(serializer.data)


# ═══════════════════════════════════════════════════════════
# FARMER DISTRIBUTION DETAIL
# ═══════════════════════════════════════════════════════════

class FarmerDistributionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, farmer_id):
        try:
            farmer = User.objects.get(id=farmer_id, role='FARMER', is_active=True)
        except User.DoesNotExist:
            return Response({"error": "Farmer not found."}, status=404)

        if request.user.role == 'BRGY':
            barangay = getattr(request.user, 'barangay', None)
            if farmer.barangay != barangay:
                return Response({"error": "Access denied."}, status=403)

        active_poll = get_encoding_poll()

        entries_filter = dict(farmer=farmer, batch__status='APPROVED')
        if active_poll:
            entries_filter['batch__event__season'] = active_poll.season
            entries_filter['batch__event__year'] = active_poll.year

        entries = DistributionEntry.objects.filter(
            **entries_filter
        ).select_related(
            'batch__event__seed_type',
            'batch__event',
            'variety',
        ).order_by('batch__event__seed_type__name', '-batch__approved_at')

        grouped = {}
        for entry in entries:
            seed_type = entry.batch.event.seed_type
            if not seed_type:
                continue
            key = seed_type.id
            if key in grouped:
                continue

            seed_type_name = seed_type.name or ''
            is_inbred_type = self._is_inbred(seed_type_name)
            grouped[key] = {
                'seed_type_id':   seed_type.id,
                'seed_type_name': seed_type_name,
                'event_id':       entry.batch.event.id,
                'event_name':     entry.batch.event.organization_name,
                'batch_id':       entry.batch.id,
                'batch_number':   entry.batch.batch_number,
                'entry_id':       entry.id,
                'row_number':     entry.row_number,
                'farm_area_ha':   str(entry.farm_area_ha) if entry.farm_area_ha is not None else None,
                'area_planted':   str(entry.area_planted) if entry.area_planted is not None else None,
                'data_sharing':   entry.data_sharing,
                'variety_name':   entry.variety.name if entry.variety else '',
                'qty_bags':       entry.qty_bags,
                'date_received':  entry.date_received.isoformat() if entry.date_received else None,
                'crop_establishment':     entry.crop_establishment,
                'expected_sowing_date':   entry.expected_sowing_date,
                'authorized_representative': entry.authorized_representative,
                'is_distribution_encoded': bool(entry.qty_bags) and (
                    bool(entry.date_received) if is_inbred_type else True
                ),
            }

        try:
            profile  = farmer.profile
            hectares = float(profile.hectares) if getattr(profile, 'hectares', None) is not None else 0
        except Exception:
            hectares = 0

        return Response({
            'farmer': {
                'id':             farmer.id,
                'first_name':     farmer.first_name,
                'last_name':      farmer.last_name,
                'contact_number': farmer.contact_number,
                'barangay':       farmer.barangay,
                'rsbsa_number':   farmer.rsbsa_number,
                'hectares':       hectares,
            },
            'seed_entries': list(grouped.values()),
        })

    def _is_inbred(self, seed_type_name):
        n = (seed_type_name or '').upper()
        return 'INBRED' in n or n == 'RCEF'


# ═══════════════════════════════════════════════════════════
# DISTRIBUTION BATCH WORKFLOW
# ═══════════════════════════════════════════════════════════

class DistributionBatchSubmitDistributionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)
        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if batch.event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        if batch.status != 'APPROVED':
            return Response({
                "error": "Only beneficiary-approved batches can be submitted for distribution review."
            }, status=400)

        if batch.distribution_status not in ('PENDING', 'REJECTED', None, ''):
            return Response({
                "error": f"Distribution batch is already {batch.distribution_status}."
            }, status=400)

        if batch.entries.count() == 0:
            return Response({"error": "Cannot submit empty batch."}, status=400)

        batch.distribution_status       = 'SUBMITTED'
        batch.distribution_submitted_at = timezone.now()
        batch.save()

        log_action(
            event=batch.event, batch=batch, user=request.user, action='SUBMITTED',
            notes=f"Distribution batch {batch.batch_number} submitted for admin review"
        )
        return Response({
            "message": f"Distribution batch {batch.batch_number} submitted for admin review.",
            "distribution_status": "SUBMITTED"
        })


class DistributionBatchApproveDistributionView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)
        if batch.status != 'APPROVED':
            return Response({
                "error": "Only beneficiary-approved batches can be distribution-approved."
            }, status=400)

        if batch.distribution_status != 'SUBMITTED':
            return Response({
                "error": f"Distribution status is {batch.distribution_status}, not SUBMITTED."
            }, status=400)

        batch.distribution_status       = 'APPROVED'
        batch.distribution_approved_at  = timezone.now()
        batch.distribution_approved_by  = request.user
        batch.save()

        log_action(
            event=batch.event, batch=batch, user=request.user, action='APPROVED',
            notes=f"Distribution approval recorded for batch {batch.batch_number}"
        )
        return Response({
            "message": f"Distribution batch {batch.batch_number} approved.",
            "distribution_status": "APPROVED"
        })


class DistributionBatchRejectDistributionView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        batch = get_object_or_404(DistributionBatch, pk=pk)
        if batch.status != 'APPROVED':
            return Response({
                "error": "Only beneficiary-approved batches can be distribution-rejected."
            }, status=400)

        if batch.distribution_status != 'SUBMITTED':
            return Response({
                "error": f"Distribution status is {batch.distribution_status}, not SUBMITTED."
            }, status=400)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({"error": "Rejection reason is required."}, status=400)

        batch.distribution_status            = 'REJECTED'
        batch.distribution_rejected_reason   = reason
        batch.save()

        log_action(
            event=batch.event, batch=batch, user=request.user, action='REJECTED',
            notes=f"Distribution rejection for batch {batch.batch_number}: {reason}"
        )
        return Response({
            "message": f"Distribution batch {batch.batch_number} rejected.",
            "distribution_status": "REJECTED"
        })


# ═══════════════════════════════════════════════════════════
# DISTRIBUTION ENTRY ENCODE
# ═══════════════════════════════════════════════════════════

class DistributionEntryEncodeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        entry = get_object_or_404(DistributionEntry, pk=pk)

        if entry.batch.status != 'APPROVED':
            return Response({
                "error": "Distribution data can only be encoded for approved beneficiary batches."
            }, status=400)

        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if entry.batch.event.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        allowed = [
            'qty_bags', 'crop_establishment', 'date_received',
            'expected_sowing_date', 'authorized_representative',
            'area_planted', 'data_sharing',
        ]
        data = {k: v for k, v in request.data.items() if k in allowed}

        if 'qty_bags' in data and data['qty_bags'] not in ('', None):
            try:
                data['qty_bags'] = int(round(float(str(data['qty_bags']))))
            except (ValueError, TypeError, OverflowError):
                data['qty_bags'] = None
        else:
            data['qty_bags'] = None

        if 'date_received' in data and data['date_received'] in ('', None):
            data['date_received'] = None
        if 'area_planted' in data and data['area_planted'] in ('', None):
            data['area_planted'] = None

        serializer = DistributionEntrySerializer(entry, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            log_action(
                event=entry.batch.event,
                batch=entry.batch,
                user=request.user,
                action='EDITED',
                notes=f"Distribution data encoded for row {entry.row_number}: {list(data.keys())}"
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


# ═══════════════════════════════════════════════════════════
# ADMIN DISTRIBUTION VIEWS
# ═══════════════════════════════════════════════════════════

class AdminDistributionPendingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if not brgy:
                return Response({"error": "No barangay assigned."}, status=400)
            batches = DistributionBatch.objects.filter(
                distribution_status__in=['SUBMITTED', 'APPROVED'],
                event__barangay=brgy,
            ).select_related('event', 'encoded_by').order_by(
                '-distribution_submitted_at', '-distribution_approved_at'
            )
        elif request.user.role == 'ADMIN':
            batches = DistributionBatch.objects.filter(
                distribution_status__in=['SUBMITTED', 'APPROVED']
            ).select_related('event', 'encoded_by').order_by(
                '-distribution_submitted_at', '-distribution_approved_at'
            )
        else:
            return Response({"error": "Access denied."}, status=403)

        serializer = DistributionBatchListSerializer(batches, many=True)
        return Response(serializer.data)


class AdminDistributionStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        active_poll = get_current_poll()

        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if not brgy:
                return Response({"error": "No barangay assigned."}, status=400)
            events_qs  = DistributionEvent.objects.filter(barangay=brgy)
            batches_qs = DistributionBatch.objects.filter(event__barangay=brgy)
            entries_qs = DistributionEntry.objects.filter(batch__event__barangay=brgy)
        elif request.user.role == 'ADMIN':
            events_qs  = DistributionEvent.objects.all()
            batches_qs = DistributionBatch.objects.all()
            entries_qs = DistributionEntry.objects.all()
        else:
            return Response({"error": "Access denied."}, status=403)

        if active_poll:
            events_qs  = events_qs.filter(season=active_poll.season,  year=active_poll.year)
            batches_qs = batches_qs.filter(event__season=active_poll.season, event__year=active_poll.year)
            entries_qs = entries_qs.filter(batch__event__season=active_poll.season, batch__event__year=active_poll.year)

        return Response({
            "total_events":        events_qs.count(),
            "pending_batches":     batches_qs.filter(status='SUBMITTED').count(),
            "approved_batches":    batches_qs.filter(status='APPROVED').count(),
            "total_farmers_served": entries_qs.filter(batch__status='APPROVED').count(),
        })


class AdminConfirmSeedDeliveryView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        event = get_object_or_404(DistributionEvent, pk=pk)
        event.seed_delivered    = True
        event.seed_delivered_at = timezone.now()
        event.seed_delivered_by = request.user
        event.save()

        log_action(
            event=event, user=request.user, action='CREATED',
            notes=f"Seed delivery confirmed for {event.barangay} by admin"
        )
        return Response({
            "message":      f"Seed delivery confirmed for {event.barangay}.",
            "delivered_at": event.seed_delivered_at,
        })


class FarmerHarvestContextView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ('BRGY', 'ADMIN'):
            return Response({}, status=200)

        barangay = getattr(user, 'barangay', None)
        if not barangay and user.role == 'ADMIN':
            barangay = request.query_params.get('barangay', '').strip() or None

        if not barangay:
            return Response({}, status=200)

        # Poll-scoped — current season lang para hindi mag-bleed
        # ang past season distribution data sa harvest context
        active_poll = get_encoding_poll()
        if not active_poll:
            active_poll = get_current_poll()

        entries_filter = dict(batch__status='APPROVED', farmer__barangay=barangay)
        if active_poll:
            entries_filter['batch__event__season'] = active_poll.season
            entries_filter['batch__event__year'] = active_poll.year

        entries = (
            DistributionEntry.objects
            .filter(**entries_filter)
            .select_related('farmer', 'batch__event__seed_type')
            .order_by('-encoded_at')
        )

        result = {}
        for entry in entries:
            farmer_id      = str(entry.farmer_id)
            seed_type_name = (
                getattr(entry.batch.event.seed_type, 'name', '') or ''
            ).upper()

            if 'HYBRID' in seed_type_name:
                key     = 'HYBRID'
                area_ha = float(entry.farm_area_ha) if entry.farm_area_ha not in (None, '') else None
            elif 'INBRED' in seed_type_name or 'CERTIFIED' in seed_type_name:
                key     = 'INBRED'
                area_ha = float(entry.area_planted) if entry.area_planted not in (None, '') else None
            else:
                continue

            result.setdefault(farmer_id, {})
            if key not in result[farmer_id]:
                result[farmer_id][key] = {
                    'area_ha':   area_ha,
                    'seed_bags': entry.qty_bags,
                }

        return Response(result)