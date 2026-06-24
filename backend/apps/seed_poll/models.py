# apps/seed_poll/models.py
# ============================================================
# MODELS:
# 1. SeedType     — Admin-managed categories (Hybrid, Inbred, etc.)
# 2. SeedVariety  — Specific varieties under each type
# 3. Poll         — One active poll at a time, has season/year
# 4. PollVote     — One vote per farmer per poll (hybrid + inbred)
#
# CONNECTIONS TO ACCOUNTS:
#   Poll.created_by    → accounts.User (admin)
#   PollVote.farmer    → accounts.User (approved farmer only)
#
# KEY FIX:
#   SeedType.__str__   — was wrongly calling self.seed_type.name (doesn't exist)
#   SeedVariety.__str__ — was calling get_name_display() (choices= was removed)
#   Both now use .name directly
# ============================================================

from django.db import models
from django.conf import settings
from django.utils import timezone


class SeedType(models.Model):
    """
    Seed type categories — admin creates freely.
    Examples: Hybrid, Inbred, Own Seed, Certified, Traditional
    No choices= restriction — admin controls entirely via the UI.

    Pre-seeded via: python manage.py seed_seed_types
    Default entries: HYBRID, INBRED
    """
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text='e.g. Hybrid, Inbred, Own Seed, Certified'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        # ✅ FIXED: SeedType only has .name — no seed_type FK on this model
        return self.name


class SeedVariety(models.Model):
    """
    Specific seed varieties under each type.
    Admin can add/remove varieties per type via the UI.

    Pre-seeded defaults:
      HYBRID: Bigante Plus, Long Pin, TH 82
      INBRED: RC 216, RC 218, RC 480
    """
    seed_type = models.ForeignKey(
        SeedType,
        on_delete=models.CASCADE,
        related_name='varieties'
    )
    name      = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering            = ['seed_type', 'name']
        unique_together     = ('seed_type', 'name')
        verbose_name_plural = 'Seed Varieties'

    def __str__(self):
        # ✅ FIXED: use seed_type.name directly — get_name_display() was removed
        # when choices= was removed from SeedType
        return f"{self.seed_type.name} — {self.name}"


class Poll(models.Model):
    """
    One poll per active season.
    Only ONE poll can have status=OPEN at a time.
    Admin enforces this in the view.

    Season info:
      season: WET or DRY
      year:   e.g. 2026
    """

    SEASON_CHOICES = (
        ('WET', 'Wet Season'),
        ('DRY', 'Dry Season'),
    )

    STATUS_CHOICES = (
        ('OPEN',   'Open'),    # farmers can vote and change vote
        ('LOCKED', 'Locked'),  # admin manually locked — no more voting
        ('CLOSED', 'Closed'),  # end_date passed — automatically closed
    )

    title  = models.CharField(
        max_length=200,
        help_text='e.g. "Wet Season 2026 Seed Preference Poll"'
    )
    season = models.CharField(max_length=3, choices=SEASON_CHOICES)
    year   = models.PositiveIntegerField(help_text='e.g. 2026')

    end_date = models.DateTimeField(
        help_text='Poll automatically closes after this date and time'
    )

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='OPEN'
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='polls_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_season_display()} {self.year} — {self.status}"

    def is_accepting_votes(self):
        """
        Returns True if poll is currently accepting votes.
        For current-year polls: checks status AND end_date.
        For past-year polls (demo/historical): only checks status.
        """
        if self.status != 'OPEN':
            return False
        current_year = timezone.now().year
        if self.year == current_year and timezone.now() > self.end_date:
            return False
        return True

    def get_total_votes(self):
        """Total number of farmers who voted in this poll."""
        return self.votes.count()


class PollVote(models.Model):
    """
    One vote record per farmer per poll.
    Farmer votes for BOTH hybrid and inbred variety.
    Can be updated while poll is OPEN.
    Locked once poll status changes to LOCKED or CLOSED.
    """
    poll   = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='votes')
    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='poll_votes'
    )

    # First seed type choice (traditionally Hybrid)
    hybrid_choice = models.ForeignKey(
        SeedVariety,
        on_delete=models.PROTECT,
        related_name='hybrid_votes',
    )
    # Second seed type choice (traditionally Inbred)
    inbred_choice = models.ForeignKey(
        SeedVariety,
        on_delete=models.PROTECT,
        related_name='inbred_votes',
    )

    voted_at   = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('poll', 'farmer')
        ordering        = ['-voted_at']

    def __str__(self):
        return (
            f"{self.farmer.first_name} {self.farmer.last_name} "
            f"voted in {self.poll}"
        )
    
class FinalSeed(models.Model):
    """
    Admin-confirmed final seed varieties for the current season.
    Created after poll closes. One record per season/year.
    Replaces previous record when admin updates.
    """
    season        = models.CharField(max_length=10, choices=[('WET','Wet Season'),('DRY','Dry Season')])
    year          = models.IntegerField()
    seed_type     = models.ForeignKey('SeedType', on_delete=models.CASCADE, related_name='final_seeds')
    varieties     = models.ManyToManyField('SeedVariety', related_name='final_selections', blank=True)
    source        = models.CharField(
        max_length=20,
        choices=[('REGION', 'Region'), ('PHILRICE', 'PhilRice')],
        default='REGION'
    )
    confirmed_by  = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='confirmed_seeds'
    )
    confirmed_at  = models.DateTimeField(auto_now=True)
    notes         = models.TextField(blank=True, default='')

    class Meta:
        unique_together = ('season', 'year', 'seed_type')
        ordering = ['-year', 'seed_type__name']

    def __str__(self):
        return f"{self.seed_type.name} — {self.get_season_display()} {self.year}"