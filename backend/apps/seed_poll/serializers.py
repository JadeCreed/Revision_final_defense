# SERIALIZERS:
# 1. SeedTypeSerializer         — list seed types
# 2. SeedVarietySerializer      — list/create/update varieties
# 3. PollSerializer             — admin creates/edits polls
# 4. PollListSerializer         — what farmer/brgy sees (no results)
# 5. VoteSerializer             — farmer submits/updates vote
# 6. PollResultsSerializer      — admin sees full results
# 7. BrgyPollResultsSerializer  — brgy sees their barangay results
# ============================================================

from rest_framework import serializers
from django.utils   import timezone
from django.db.models import Count
from .models import SeedType, SeedVariety, Poll, PollVote
from django.utils import timezone as tz

class SeedVarietySerializer(serializers.ModelSerializer):
    """
    Used for listing varieties and admin create/update.
    Includes seed_type_name for display.
    """
    seed_type_name = serializers.CharField(
        source='seed_type.name',
        read_only=True
    )

    class Meta:
        model  = SeedVariety
        fields = ['id', 'name', 'seed_type', 'seed_type_name', 'is_active']

class SeedTypeSerializer(serializers.ModelSerializer):
    """
    Lists seed types with their active varieties nested.
    Used by farmer vote form to show options.
    """
    varieties = serializers.SerializerMethodField()

    class Meta:
        model  = SeedType
        fields = ['id', 'name', 'is_active', 'varieties']

    def get_varieties(self, obj):
        # Only return active varieties
        active = obj.varieties.filter(is_active=True)
        return SeedVarietySerializer(active, many=True).data

class SeedTypeCreateSerializer(serializers.ModelSerializer):
    """
    Admin creates or renames a seed type.
    """
    class Meta:
        model  = SeedType
        fields = ['id', 'name', 'is_active']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Seed type name cannot be empty.')
        return value
    
class PollSerializer(serializers.ModelSerializer):
    """
    Admin creates and edits polls.
    created_by is set automatically in the view.
    """
    created_by_name  = serializers.SerializerMethodField()
    total_votes      = serializers.SerializerMethodField()
    is_accepting     = serializers.SerializerMethodField()
    season_display   = serializers.CharField(
        source='get_season_display', read_only=True
    )
    status_display   = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model  = Poll
        fields = [
            'id', 'title', 'season', 'season_display',
            'year', 'end_date', 'status', 'status_display',
            'created_by_name', 'created_at', 'updated_at',
            'total_votes', 'is_accepting',
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'created_by_name', 'total_votes',
            'is_accepting', 'season_display', 'status_display',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}"
        return "Admin"

    def get_total_votes(self, obj):
        return obj.get_total_votes()

    def get_is_accepting(self, obj):
        return obj.is_accepting_votes()

    def validate_end_date(self, value):
        
        if self.instance is None:
            # Make value timezone-aware if browser sent a naive datetime
            if tz.is_naive(value):
                value = tz.make_aware(value)
            if value <= tz.now():
                raise serializers.ValidationError("End date must be in the future.")
        return value

    def validate_year(self, value):
        current_year = timezone.now().year
        if value < current_year - 10 or value > current_year + 10:
            raise serializers.ValidationError(
                f"Year must be between {current_year} and {current_year + 5}."
            )
        return value


class PollListSerializer(serializers.ModelSerializer):
    """
    What farmers and BRGY see when viewing a poll.
    Does NOT include vote results (only shown after LOCKED/CLOSED).
    Includes farmer's own vote if they already voted.
    """
    season_display  = serializers.CharField(source='get_season_display', read_only=True)
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    is_accepting    = serializers.SerializerMethodField()
    has_voted       = serializers.SerializerMethodField()
    my_vote         = serializers.SerializerMethodField()
    total_votes     = serializers.SerializerMethodField()
    # Results — only included after poll is locked/closed
    results         = serializers.SerializerMethodField()

    class Meta:
        model  = Poll
        fields = [
            'id', 'title', 'season', 'season_display',
            'year', 'end_date', 'status', 'status_display',
            'is_accepting', 'has_voted', 'my_vote',
            'total_votes', 'results',
        ]

    def get_is_accepting(self, obj):
        return obj.is_accepting_votes()

    def get_has_voted(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return PollVote.objects.filter(
            poll=obj, farmer=request.user
        ).exists()

    def get_my_vote(self, obj):
        """Returns farmer's current vote choices — shown after voting."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        try:
            vote = PollVote.objects.get(poll=obj, farmer=request.user)
            return {
                'hybrid_choice_id':   vote.hybrid_choice.id,
                'hybrid_choice_name': vote.hybrid_choice.name,
                'inbred_choice_id':   vote.inbred_choice.id,
                'inbred_choice_name': vote.inbred_choice.name,
                'voted_at':           vote.voted_at,
                'updated_at':         vote.updated_at,
            }
        except PollVote.DoesNotExist:
            return None

    def get_total_votes(self, obj):
        # Only show total count to farmers when poll is locked/closed
        if obj.status in ('LOCKED', 'CLOSED'):
            return obj.get_total_votes()
        return None  # Hidden while poll is open

    def get_results(self, obj):
        """
        Returns results ONLY when poll is LOCKED or CLOSED.
        Shows overall totals — farmer sees who won.
        """
        if obj.status not in ('LOCKED', 'CLOSED'):
            return None

        # ── HYBRID RESULTS ──
        hybrid_results = (
            PollVote.objects
            .filter(poll=obj)
            .values('hybrid_choice__name')
            .annotate(votes=Count('id'))
            .order_by('-votes')
        )

        # ── INBRED RESULTS ──
        inbred_results = (
            PollVote.objects
            .filter(poll=obj)
            .values('inbred_choice__name')
            .annotate(votes=Count('id'))
            .order_by('-votes')
        )

        total = obj.get_total_votes()

        return {
            'total_votes': total,
            'hybrid': [
                {
                    'variety': r['hybrid_choice__name'],
                    'votes':   r['votes'],
                    'percent': round((r['votes'] / total * 100), 1) if total > 0 else 0,
                }
                for r in hybrid_results
            ],
            'inbred': [
                {
                    'variety': r['inbred_choice__name'],
                    'votes':   r['votes'],
                    'percent': round((r['votes'] / total * 100), 1) if total > 0 else 0,
                }
                for r in inbred_results
            ],
        }


class VoteSerializer(serializers.Serializer):
    """
    Used when farmer submits or updates their vote.
    Validates that:
      - hybrid_choice belongs to a Hybrid SeedType
      - inbred_choice belongs to an Inbred SeedType
      - both varieties are active
    """
    hybrid_choice = serializers.PrimaryKeyRelatedField(
        queryset=SeedVariety.objects.filter(is_active=True)
    )
    inbred_choice = serializers.PrimaryKeyRelatedField(
        queryset=SeedVariety.objects.filter(is_active=True)
    )


class PollResultsSerializer(serializers.ModelSerializer):
    """
    ADMIN ONLY — full results with barangay breakdown.
    Shows both overall totals AND per-barangay breakdown.
    """
    season_display = serializers.CharField(source='get_season_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_votes    = serializers.SerializerMethodField()
    hybrid_results = serializers.SerializerMethodField()
    inbred_results = serializers.SerializerMethodField()
    barangay_breakdown = serializers.SerializerMethodField()

    class Meta:
        model  = Poll
        fields = [
            'id', 'title', 'season', 'season_display',
            'year', 'end_date', 'status', 'status_display',
            'total_votes', 'hybrid_results',
            'inbred_results', 'barangay_breakdown',
        ]

    def get_total_votes(self, obj):
        return obj.get_total_votes()

    def get_hybrid_results(self, obj):
        """Overall hybrid variety totals with ranking."""
        results = (
            PollVote.objects
            .filter(poll=obj)
            .values('hybrid_choice__name')
            .annotate(votes=Count('id'))
            .order_by('-votes')
        )
        total = obj.get_total_votes()
        return [
            {
                'rank':    idx + 1,
                'variety': r['hybrid_choice__name'],
                'votes':   r['votes'],
                'percent': round((r['votes'] / total * 100), 1) if total > 0 else 0,
            }
            for idx, r in enumerate(results)
        ]

    def get_inbred_results(self, obj):
        """Overall inbred variety totals with ranking."""
        results = (
            PollVote.objects
            .filter(poll=obj)
            .values('inbred_choice__name')
            .annotate(votes=Count('id'))
            .order_by('-votes')
        )
        total = obj.get_total_votes()
        return [
            {
                'rank':    idx + 1,
                'variety': r['inbred_choice__name'],
                'votes':   r['votes'],
                'percent': round((r['votes'] / total * 100), 1) if total > 0 else 0,
            }
            for idx, r in enumerate(results)
        ]

    def get_barangay_breakdown(self, obj):
        """
        Per-barangay breakdown showing:
        - total farmers voted
        - top hybrid choice in that barangay
        - top inbred choice in that barangay
        Sorted by total votes descending (most active barangay first).
        """
        # Get all votes with farmer's barangay
        votes = PollVote.objects.filter(poll=obj).select_related(
            'farmer', 'hybrid_choice', 'inbred_choice'
        )

        # Group by barangay
        barangay_data = {}
        for vote in votes:
            brgy = vote.farmer.barangay or 'Unknown'
            if brgy not in barangay_data:
                barangay_data[brgy] = {
                    'barangay':      brgy,
                    'total_votes':   0,
                    'hybrid_votes':  {},
                    'inbred_votes':  {},
                }
            data = barangay_data[brgy]
            data['total_votes'] += 1

            # Count hybrid votes per variety
            hname = vote.hybrid_choice.name
            data['hybrid_votes'][hname] = data['hybrid_votes'].get(hname, 0) + 1

            # Count inbred votes per variety
            iname = vote.inbred_choice.name
            data['inbred_votes'][iname] = data['inbred_votes'].get(iname, 0) + 1

        # Format and sort by total votes
        result = []
        for brgy, data in barangay_data.items():
            # Find top hybrid choice
            top_hybrid = max(data['hybrid_votes'], key=data['hybrid_votes'].get) \
                if data['hybrid_votes'] else '—'
            # Find top inbred choice
            top_inbred = max(data['inbred_votes'], key=data['inbred_votes'].get) \
                if data['inbred_votes'] else '—'

            result.append({
                'barangay':        brgy,
                'total_votes':     data['total_votes'],
                'top_hybrid':      top_hybrid,
                'hybrid_breakdown': [
                    {'variety': k, 'votes': v}
                    for k, v in sorted(
                        data['hybrid_votes'].items(),
                        key=lambda x: x[1], reverse=True
                    )
                ],
                'top_inbred':      top_inbred,
                'inbred_breakdown': [
                    {'variety': k, 'votes': v}
                    for k, v in sorted(
                        data['inbred_votes'].items(),
                        key=lambda x: x[1], reverse=True
                    )
                ],
            })

        return sorted(result, key=lambda x: x['total_votes'], reverse=True)


class BrgyPollResultsSerializer(serializers.ModelSerializer):
    """
    BRGY PRESIDENT ONLY — shows results for their barangay only.
    Visible regardless of poll status (they can always see their barangay).
    """
    season_display  = serializers.CharField(source='get_season_display', read_only=True)
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    brgy_results    = serializers.SerializerMethodField()

    class Meta:
        model  = Poll
        fields = [
            'id', 'title', 'season', 'season_display',
            'year', 'status', 'status_display', 'brgy_results',
        ]

    def get_brgy_results(self, obj):
        """Results filtered to this BRGY president's barangay."""
        request = self.context.get('request')
        if not request:
            return None

        brgy = getattr(request.user, 'barangay', None)
        if not brgy:
            return None

        votes = PollVote.objects.filter(
            poll=obj,
            farmer__barangay=brgy
        ).select_related('hybrid_choice', 'inbred_choice')

        total = votes.count()

        # Count hybrid votes
        hybrid_counts = {}
        inbred_counts = {}
        for vote in votes:
            h = vote.hybrid_choice.name
            i = vote.inbred_choice.name
            hybrid_counts[h] = hybrid_counts.get(h, 0) + 1
            inbred_counts[i] = inbred_counts.get(i, 0) + 1

        return {
            'barangay':    brgy,
            'total_votes': total,
            'hybrid': [
                {
                    'variety': k,
                    'votes':   v,
                    'percent': round(v / total * 100, 1) if total > 0 else 0,
                }
                for k, v in sorted(
                    hybrid_counts.items(), key=lambda x: x[1], reverse=True
                )
            ],
            'inbred': [
                {
                    'variety': k,
                    'votes':   v,
                    'percent': round(v / total * 100, 1) if total > 0 else 0,
                }
                for k, v in sorted(
                    inbred_counts.items(), key=lambda x: x[1], reverse=True
                )
            ],
        }