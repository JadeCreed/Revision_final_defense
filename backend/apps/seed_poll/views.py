from django.shortcuts import render

# Create your views here.
from rest_framework.views       import APIView
from rest_framework.response    import Response
from rest_framework             import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts           import get_object_or_404
from django.utils               import timezone

from apps.accounts.permissions  import IsAdminUserRole, IsBPUser, IsFarmer
from .models      import SeedType, SeedVariety, Poll, PollVote, FinalSeed
from .serializers import (
    SeedTypeSerializer,
    SeedVarietySerializer,
    PollSerializer,
    PollListSerializer,
    VoteSerializer,
    PollResultsSerializer,
    BrgyPollResultsSerializer,
    SeedTypeCreateSerializer
)

from rest_framework.decorators import api_view


# ═══════════════════════════════════════════════════════════
# ADMIN — SEED VARIETY MANAGEMENT
# ═══════════════════════════════════════════════════════════
class AdminSeedTypeListCreateView(APIView):
    """
    GET  /api/seed-poll/admin/types/
         List all seed types (so admin can see what exists)

    POST /api/seed-poll/admin/types/
         Admin creates a new seed type (e.g. "Own Seed", "Certified")
         Body: { "name": "Own Seed" }
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        # Return ALL types (including inactive) so admin can manage them
        seed_types = SeedType.objects.all().order_by('name')
        serializer = SeedTypeSerializer(seed_types, many=True)
        return Response(serializer.data)

    def post(self, request):
        from .serializers import SeedTypeCreateSerializer
        serializer = SeedTypeCreateSerializer(data=request.data)
        if serializer.is_valid():
            seed_type = serializer.save()
            # Return using SeedTypeSerializer (includes varieties)
            return Response(
                SeedTypeSerializer(seed_type).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminSeedTypeDetailView(APIView):
    """
    PUT    /api/seed-poll/admin/types/<id>/   Rename a seed type
    DELETE /api/seed-poll/admin/types/<id>/   Soft deactivate or hard delete
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get_object(self, pk):
        return get_object_or_404(SeedType, pk=pk)

    def put(self, request, pk):
        from .serializers import SeedTypeCreateSerializer
        seed_type  = self.get_object(pk)
        serializer = SeedTypeCreateSerializer(seed_type, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(SeedTypeSerializer(seed_type).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        seed_type = self.get_object(pk)

        # Check if any votes use varieties under this type
        has_votes = PollVote.objects.filter(
            hybrid_choice__seed_type=seed_type
        ).exists() or PollVote.objects.filter(
            inbred_choice__seed_type=seed_type
        ).exists()

        if has_votes:
            # Soft deactivate — cannot delete if votes exist
            seed_type.is_active = False
            seed_type.save()
            return Response({
                "message": f"'{seed_type.name}' deactivated (has votes, cannot delete)"
            })

        # No votes — safe to hard delete
        seed_type.delete()
        return Response({"message": f"'{seed_type.name}' deleted"})
    
class AdminSeedVarietyListCreateView(APIView):
    """
    GET  /api/seed-poll/admin/varieties/
         List all varieties grouped by type

    POST /api/seed-poll/admin/varieties/
         Add a new variety to a seed type
         Body: { "seed_type": 1, "name": "New Variety" }
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        # Return varieties grouped by seed type
        seed_types = SeedType.objects.filter(is_active=True)
        serializer = SeedTypeSerializer(seed_types, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = SeedVarietySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminSeedVarietyDetailView(APIView):
    """
    PUT    /api/seed-poll/admin/varieties/<id>/   Edit variety name
    DELETE /api/seed-poll/admin/varieties/<id>/   Soft deactivate
                                                  (cannot delete if has votes)
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get_object(self, pk):
        return get_object_or_404(SeedVariety, pk=pk)

    def put(self, request, pk):
        variety    = self.get_object(pk)
        serializer = SeedVarietySerializer(variety, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        variety = self.get_object(pk)
        # Check if this variety has any votes — cannot delete if it does
        has_votes = (
            PollVote.objects.filter(hybrid_choice=variety).exists() or
            PollVote.objects.filter(inbred_choice=variety).exists()
        )
        if has_votes:
            # Soft deactivate instead of hard delete
            variety.is_active = False
            variety.save()
            return Response({
                "message": f"'{variety.name}' deactivated "
                           f"(cannot delete — has existing votes)"
            })
        variety.delete()
        return Response({"message": f"'{variety.name}' deleted"})


# ═══════════════════════════════════════════════════════════
# ADMIN — POLL MANAGEMENT
# ═══════════════════════════════════════════════════════════

class AdminPollListCreateView(APIView):
    """
    GET  /api/seed-poll/admin/polls/
         List all polls (all statuses) for admin management

    POST /api/seed-poll/admin/polls/
         Create a new poll
         Cannot create if an OPEN poll already exists
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        polls      = Poll.objects.all().order_by('-created_at')
        serializer = PollSerializer(polls, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        # ── CHECK: only one OPEN poll at a time ──
        open_poll = Poll.objects.filter(status='OPEN').first()
        if open_poll:
            return Response({
                "error": f"A poll is already active: '{open_poll.title}'. "
                         f"Please lock or close it before creating a new one."
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = PollSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(created_by=request.user, status='OPEN')
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminPollDetailView(APIView):
    """
    GET /api/seed-poll/admin/polls/<id>/   Get poll details
    PUT /api/seed-poll/admin/polls/<id>/   Edit poll (title, end_date only)
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get_object(self, pk):
        return get_object_or_404(Poll, pk=pk)

    def get(self, request, pk):
        poll       = self.get_object(pk)
        serializer = PollSerializer(poll, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        poll       = self.get_object(pk)
        # Only allow editing title and end_date — not status or season
        allowed_fields = {'title', 'end_date'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = PollSerializer(poll, data=data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminLockPollView(APIView):
    """
    POST /api/seed-poll/admin/polls/<id>/lock/
    Admin manually locks a poll — no more voting allowed.
    Farmers can now see results.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        poll = get_object_or_404(Poll, pk=pk)
        if poll.status != 'OPEN':
            return Response({
                "error": f"Poll is already {poll.get_status_display()}."
            }, status=status.HTTP_400_BAD_REQUEST)
        poll.status = 'LOCKED'
        poll.save()
        return Response({
            "message": f"Poll '{poll.title}' has been locked. "
                       f"Farmers can now see results.",
            "status":  "LOCKED"
        })


class AdminClosePollView(APIView):
    """
    POST /api/seed-poll/admin/polls/<id>/close/
    Permanently close a poll (cannot reopen).
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        poll = get_object_or_404(Poll, pk=pk)
        if poll.status == 'CLOSED':
            return Response(
                {"error": "Poll is already closed."},
                status=status.HTTP_400_BAD_REQUEST
            )
        poll.status = 'CLOSED'
        poll.save()
        return Response({
            "message": f"Poll '{poll.title}' has been closed.",
            "status":  "CLOSED"
        })


class AdminPollResultsView(APIView):
    """
    GET /api/seed-poll/admin/polls/<id>/results/
    Full results with barangay breakdown — admin only.
    Available for any poll status (admin sees results anytime).
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request, pk):
        poll       = get_object_or_404(Poll, pk=pk)
        serializer = PollResultsSerializer(poll, context={'request': request})
        return Response(serializer.data)


# ═══════════════════════════════════════════════════════════
# FARMER VIEWS
# ═══════════════════════════════════════════════════════════

class FarmerActivePollView(APIView):
    """
    GET /api/seed-poll/active/
    Returns the currently active (OPEN) poll for the farmer.
    Also returns LOCKED/CLOSED polls so farmer can see results.
    Only APPROVED farmers can access.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Block non-farmers
        # Allow FARMER and BRGY — block everyone else
        if request.user.role not in ('FARMER', 'BRGY'):
            return Response(
                {"error": "Access denied."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Block non-approved farmers
        if request.user.role == 'FARMER' and request.user.status != 'APPROVED':
            return Response(
                {"error": "Only approved farmers can participate in polls."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Auto-close polls whose end_date has passed
        # This handles the automatic closure without a scheduled task
        Poll.objects.filter(
            status='OPEN',
            end_date__lte=timezone.now()
        ).update(status='CLOSED')

        # Get most recent poll (open, locked, or recently closed)
        poll = Poll.objects.order_by('-created_at').first()
        if not poll:
            return Response({"poll": None, "message": "No polls available."})

        serializer = PollListSerializer(poll, context={'request': request})
        return Response(serializer.data)


class FarmerVoteView(APIView):
    """
    POST /api/seed-poll/<id>/vote/
    Farmer submits or updates their vote.
    Uses get_or_create so same endpoint handles both submit and update.
    Blocked if poll is LOCKED or CLOSED or end_date passed.
    """
    permission_classes = [IsAuthenticated, IsFarmer]

    def post(self, request, pk):
        # Approval check
        if request.user.status != 'APPROVED':
            return Response(
                {"error": "Only approved farmers can vote."},
                status=status.HTTP_403_FORBIDDEN
            )

        poll = get_object_or_404(Poll, pk=pk)

        # Check poll is accepting votes
        if not poll.is_accepting_votes():
            return Response(
                {"error": "This poll is no longer accepting votes."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate vote data
        serializer = VoteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        hybrid_choice = serializer.validated_data['hybrid_choice']
        inbred_choice = serializer.validated_data['inbred_choice']

        # get_or_create: creates new vote or updates existing one
        vote, created = PollVote.objects.get_or_create(
            poll=poll,
            farmer=request.user,
            defaults={
                'hybrid_choice': hybrid_choice,
                'inbred_choice': inbred_choice,
            }
        )

        if not created:
            # Vote already exists — update it
            vote.hybrid_choice = hybrid_choice
            vote.inbred_choice = inbred_choice
            vote.save()

        return Response({
            "message":       "Vote submitted successfully!" if created else "Vote updated successfully!",
            "hybrid_choice": hybrid_choice.name,
            "inbred_choice": inbred_choice.name,
            "voted_at":      vote.voted_at,
            "updated_at":    vote.updated_at,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


# ═══════════════════════════════════════════════════════════
# BRGY VIEWS
# ═══════════════════════════════════════════════════════════

class BrgyPollResultsView(APIView):
    """
    GET /api/seed-poll/<id>/brgy-results/
    BRGY president sees results for their barangay only.
    Shows how many of their farmers voted and what they chose.
    """
    permission_classes = [IsAuthenticated, IsBPUser]

    def get(self, request, pk):
        poll       = get_object_or_404(Poll, pk=pk)
        serializer = BrgyPollResultsSerializer(poll, context={'request': request})
        return Response(serializer.data)


class SeedVarietyListView(APIView):
    """
    GET /api/seed-poll/varieties/
    Public (authenticated) — returns active varieties for the vote form.
    Used by farmer vote form to populate dropdown options.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        seed_types = SeedType.objects.filter(is_active=True)
        serializer = SeedTypeSerializer(seed_types, many=True)
        return Response(serializer.data)
    

class DeletePollView(APIView):
    """
    DELETE /api/seed-poll/polls/<id>/delete/
    Permanently deletes a past poll.
    Cannot delete OPEN polls.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def delete(self, request, pk):
        from .models import Poll
        poll = get_object_or_404(Poll, pk=pk)
        if poll.status == 'OPEN':
            return Response(
                {"error": "Cannot delete an active/open poll. Close it first."},
                status=400
            )
        poll.delete()
        return Response({"message": "Poll deleted permanently."}, status=200)


class FinalSeedListCreateView(APIView):
    """
    GET  /api/seed-poll/final-seeds/
         Returns the current final seeds (latest season/year).
         Used by BrgyDistribution to show intervention choices.
         Used by home pages to show final seed announcement.

    POST /api/seed-poll/final-seeds/
         Admin saves/updates the finalized seed types and varieties.
         Body: [
           { "seed_type_id": 1, "variety_ids": [2, 3], "source": "REGION" },
           { "seed_type_id": 2, "variety_ids": [5],    "source": "PHILRICE" },
         ]
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Always get from latest closed/locked poll unless specific params given
        season = request.query_params.get('season')
        year   = request.query_params.get('year')
        all_seasons = request.query_params.get('all')

        qs = FinalSeed.objects.select_related('seed_type', 'confirmed_by').prefetch_related('varieties')

        if all_seasons:
            # Return all finalized season/year records so clients can build season filters.
            qs = qs.order_by('-year', '-season', 'seed_type__name')
        elif season and year:
            qs = qs.filter(season=season, year=int(year))
        else:
            # Get season/year from latest closed poll
            latest_poll = Poll.objects.filter(
                status__in=['CLOSED', 'LOCKED']
            ).order_by('-year', '-created_at').first()

            if latest_poll:
                qs = qs.filter(season=latest_poll.season, year=latest_poll.year)
            else:
                # Fallback: latest year
                from django.db.models import Max
                latest_year = qs.aggregate(Max('year'))['year__max']
                if latest_year:
                    qs = qs.filter(year=latest_year)

        result = []
        for fs in qs:
            result.append({
                'id':           fs.id,
                'season':       fs.season,
                'season_display': fs.get_season_display(),
                'year':         fs.year,
                'source':       fs.source,
                'seed_type': {
                    'id':   fs.seed_type.id,
                    'name': fs.seed_type.name,
                },
                'varieties': [
                    {'id': v.id, 'name': v.name}
                    for v in fs.varieties.all()
                ],
                'confirmed_at': fs.confirmed_at,
                'confirmed_by': f"{fs.confirmed_by.first_name} {fs.confirmed_by.last_name}" if fs.confirmed_by else '',
            })
        return Response(result)

    def post(self, request):
        if request.user.role != 'ADMIN':
            return Response({"error": "Access denied."}, status=403)

        from .models import Poll, SeedType, SeedVariety
        # Get season/year from latest closed/locked poll
        latest_poll = Poll.objects.filter(
            status__in=['CLOSED', 'LOCKED']
        ).order_by('-year', '-created_at').first()

        if not latest_poll:
            return Response(
                {"error": "No closed poll found. Close a poll before finalizing seeds."},
                status=400
            )

        entries = request.data  # list of { seed_type_id, variety_ids, source }
        if not isinstance(entries, list) or len(entries) == 0:
            return Response({"error": "Expected a list of seed type entries."}, status=400)

        # ── DELETE ALL EXISTING FINAL SEEDS for this season/year before saving new ones ──
        # This ensures overwrite behavior, not accumulation
        FinalSeed.objects.filter(season=latest_poll.season, year=latest_poll.year).delete()

        saved = []
        for entry in entries:
            seed_type_id = entry.get('seed_type_id')
            variety_ids  = entry.get('variety_ids', [])
            source       = entry.get('source', 'REGION')

            try:
                seed_type = SeedType.objects.get(id=seed_type_id)
            except SeedType.DoesNotExist:
                return Response({"error": f"SeedType {seed_type_id} not found."}, status=404)

            # Auto-assign source based on seed type name (fixed relationship)
            # HYBRID → REGION, INBRED → PHILRICE
            type_name_upper = seed_type.name.upper()
            if type_name_upper == 'INBRED':
                auto_source = 'PHILRICE'
            elif type_name_upper == 'HYBRID':
                auto_source = 'REGION'
            else:
                auto_source = source  # fallback for custom types

            final_seed = FinalSeed.objects.create(
                season=latest_poll.season,
                year=latest_poll.year,
                seed_type=seed_type,
                source=auto_source,
                confirmed_by=request.user,
            )
            varieties = SeedVariety.objects.filter(id__in=variety_ids, seed_type=seed_type)
            final_seed.varieties.set(varieties)
            saved.append(final_seed)

        return Response({
            "message": f"Final seeds saved for {latest_poll.get_season_display()} {latest_poll.year}.",
            "count": len(saved),
            "season": latest_poll.season,
            "year": latest_poll.year,
        }, status=201)
    