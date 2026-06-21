# MODELS:
# 1. DistributionEvent  — header per program per barangay
# 2. DistributionBatch  — max 10 farmers per batch
# 3. DistributionEntry  — one farmer row in a batch
# 4. DistributionAudit  — audit trail
#
# CONNECTIONS:
#   DistributionEvent.created_by    → accounts.User (BRGY)
#   DistributionBatch.approved_by   → accounts.User (admin)
#   DistributionEntry.farmer        → accounts.User (FARMER)
# ============================================================

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError


class DistributionEvent(models.Model):
    """
    One distribution event = one program delivery to one barangay.
    A barangay can have multiple events (RCEF, NRP, RFO, etc.)
    A farmer can appear in multiple events across different programs.
    """

    INTERVENTION_CHOICES = (
        ('RCEF',   'RCEF (Rice Competitiveness Enhancement Fund)'),
        ('NRP',    'NRP (National Rice Program)'),
        ('RFO',    'RFO (Regional Field Office)'),
        ('OTHER',  'Other'),
    )

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),    # BRGY can still add batches
        ('CLOSED', 'Closed'),    # Distribution complete
    )

    # ── WHERE and WHAT ──
    barangay     = models.CharField(max_length=100)
    intervention = models.CharField(max_length=10, choices=INTERVENTION_CHOICES)

    # Seed info — FK to seed_poll app
    seed_type    = models.ForeignKey(
        'seed_poll.SeedType',
        on_delete=models.PROTECT,
        related_name='distribution_events',
        null=True, blank=True
    )
    variety      = models.ForeignKey(
        'seed_poll.SeedVariety',
        on_delete=models.PROTECT,
        related_name='distribution_events',
        null=True, blank=True
    )

    # Optional link to the finalized season selection (auditability)
    final_seed = models.ForeignKey(
        'seed_poll.FinalSeed',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='events'
    )

    # ── SEASON / PROGRAM INFO ──
    season = models.CharField(
        max_length=3,
        choices=(('WET', 'Wet Season'), ('DRY', 'Dry Season'))
    )
    year   = models.PositiveIntegerField()

    # ── ORGANIZATION ──
    organization_name = models.CharField(
        max_length=200,
        help_text='Name of farmer association or organization'
    )
    total_members = models.PositiveIntegerField(
        help_text='Expected total number of farmers in this event'
    )

    # ── STATUS ──
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ACTIVE')

    # ── SEED DELIVERY ──
    seed_delivered    = models.BooleanField(default=False)
    seed_delivered_at = models.DateTimeField(null=True, blank=True)
    seed_delivered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='seed_deliveries_confirmed'
    )
    
    # ── WHO created it ──
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='distribution_events_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

        # ADD these fields to the DistributionEvent model
    delete_requested         = models.BooleanField(default=False)
    delete_requested_at      = models.DateTimeField(null=True, blank=True)
    delete_requested_by      = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='delete_requests'
    )
    delete_request_note      = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.barangay} — {self.intervention} {self.season} {self.year}"

    def get_total_encoded(self):
        """Total farmers encoded across all batches."""
        return DistributionEntry.objects.filter(batch__event=self).count()

    def get_total_approved(self):
        """Total farmers in approved batches."""
        return DistributionEntry.objects.filter(
            batch__event=self,
            batch__status='APPROVED'
        ).count()
    
    def get_total_distribution_encoded(self):
        """
        Total farmers sa APPROVED batches na may COMPLETE distribution
        encoding na (may qty_bags, at kung Inbred — may date_received din).
        Ginagamit lang ito sa Distribution menu progress tiles —
        HIWALAY ito sa get_total_encoded() na ginagamit ng Beneficiaries menu.
        """
        seed_type_name = (self.seed_type.name or '').upper() if self.seed_type else ''
        is_inbred = 'INBRED' in seed_type_name or seed_type_name == 'RCEF'

        qs = DistributionEntry.objects.filter(
            batch__event=self,
            batch__status='APPROVED',
            qty_bags__isnull=False,
        )
        if is_inbred:
            qs = qs.filter(date_received__isnull=False)

        return qs.count()

    def get_batch_count(self):
        return self.batches.count()

    def clean(self):
        """
        Validate that when `final_seed` is set it matches the event's season/year and seed_type.
        Validation only runs when `final_seed` is not None.
        """
        super().clean()
        if self.final_seed:
            # seed_type may be None on older rows — compare IDs when possible
            final_type = getattr(self.final_seed, 'seed_type', None)
            if final_type and self.seed_type and final_type.id != self.seed_type.id:
                raise ValidationError('final_seed.seed_type must match event.seed_type')
            if getattr(self.final_seed, 'season', None) and getattr(self.final_seed, 'year', None):
                if self.final_seed.season != self.season or self.final_seed.year != self.year:
                    raise ValidationError('final_seed season/year must match event season/year')

    def save(self, *args, **kwargs):
        # run validation to prevent mismatches being saved
        try:
            self.full_clean(validate_unique=False)
        except ValidationError:
            # re-raise so callers (views/serializers) can see validation errors
            raise
        return super().save(*args, **kwargs)


class DistributionBatch(models.Model):
    """
    Max 10 farmers per batch.
    Workflow: DRAFT → SUBMITTED → APPROVED or REJECTED
    BRGY creates, submits. Admin approves or rejects.
    Once approved → locked.
    Admin can edit (emergency) then re-lock.
    """

    DISTRIBUTION_STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('SUBMITTED', 'Submitted'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    STATUS_CHOICES = (
        ('DRAFT',     'Draft'),      # BRGY is still encoding
        ('SUBMITTED', 'Submitted'),  # Sent to admin for review
        ('APPROVED',  'Approved'),   # Admin verified — locked for report
        ('REJECTED',  'Rejected'),   # Admin rejected — BRGY must fix
    )

    MAX_FARMERS = 10  # max entries per batch

    event        = models.ForeignKey(
        DistributionEvent,
        on_delete=models.CASCADE,
        related_name='batches'
    )
    batch_number = models.PositiveIntegerField(
        help_text='Auto-incremented per event: 1, 2, 3...'
    )
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES, default='DRAFT')

    # ── TIMESTAMPS ──
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at  = models.DateTimeField(null=True, blank=True)

    distribution_status = models.CharField(
        max_length=10,
        choices=DISTRIBUTION_STATUS_CHOICES,
        default='PENDING',
        blank=True,
    )
    distribution_submitted_at = models.DateTimeField(null=True, blank=True)
    distribution_approved_at = models.DateTimeField(null=True, blank=True)
    distribution_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='distribution_batches_approved'
    )
    distribution_rejected_reason = models.TextField(blank=True, default='')

    # ── WHO ──
    encoded_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='batches_encoded'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='batches_approved'
    )

    # ── REJECTION ──
    rejected_reason = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering            = ['batch_number']
        unique_together     = ('event', 'batch_number')

    def __str__(self):
        return f"Batch {self.batch_number} — {self.event} [{self.status}]"

    def get_entry_count(self):
        return self.entries.count()

    def is_full(self):
        return self.entries.count() >= self.MAX_FARMERS

    def can_add_entry(self):
        """Check if batch can accept more farmers."""
        if self.status != 'DRAFT':
            return False
        if self.is_full():
            return False
        return True


class DistributionEntry(models.Model):
    """
    One row = one farmer in one batch.
    Farm area and signature are encoded by BRGY.
    QTY/bags is encoded when seeds arrive.
    Signature stored as base64 PNG string.
    """

    CROP_ESTABLISHMENT_CHOICES = (
        ('DS', 'Direct Seeding'),
        ('TP', 'Transplanting'),
    )

    batch      = models.ForeignKey(
        DistributionBatch,
        on_delete=models.CASCADE,
        related_name='entries'
    )
    farmer     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='distribution_entries'
    )
    variety    = models.ForeignKey(
        'seed_poll.SeedVariety',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='distribution_entries'
    )
    row_number = models.PositiveIntegerField(
        help_text='Position in the batch: 1 to 10'
    )

    # ── FARMING INFO ──
    # These fields are encoded by BRGY when facilitating signing
    farm_area_ha       = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True, blank=True,
        help_text='Farm area in hectares'
    )
    crop_establishment = models.CharField(
        max_length=2,
        choices=CROP_ESTABLISHMENT_CHOICES,
        null=True, blank=True
    )

    # ── DISTRIBUTION INFO ──
    # Filled when seeds arrive
    qty_bags       = models.DecimalField(
        max_digits=6, decimal_places=2,
        null=True, blank=True,
        help_text='Number of seed bags received (decimal allowed, e.g. 0.50)'
    )

    date_received  = models.DateField(
        null=True, blank=True,
        help_text='Date when farmer received seeds'
    )
    expected_sowing_date = models.CharField(
        max_length=120,
        blank=True,
        default='',
        help_text='Expected sowing date (e.g. June/2nd Week)'
    )
    authorized_representative = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Authorized representative name'
    )

    # ── PHILRICE / RCEF SPECIFIC ──
    # From image 3 — saved for future RCEF report generation
    area_planted   = models.DecimalField(
        max_digits=6, decimal_places=2,
        null=True, blank=True
    )
    expected_yield = models.DecimalField(
        max_digits=8, decimal_places=2,
        null=True, blank=True
    )
    data_sharing = models.BooleanField(
        default=False,
        help_text='Farmer agreed to data sharing with PhilRice'
    )

    # ── E-SIGNATURE ──
    # Stored as base64 PNG data URL
    # "data:image/png;base64,iVBORw0K..."
    signature      = models.TextField(
        blank=True, default='',
        help_text='Base64 PNG of farmer e-signature/thumbmark'
    )
    signed_at      = models.DateTimeField(null=True, blank=True)

    # ── AUDIT ──
    encoded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='entries_encoded'
    )
    encoded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['row_number']
        constraints = [
        models.UniqueConstraint(fields=['batch', 'farmer'],     name='unique_farmer_per_batch'),
        models.UniqueConstraint(fields=['batch', 'row_number'], name='unique_row_per_batch'),
    ]

    def __str__(self):
        return f"Row {self.row_number} — {self.farmer.first_name} {self.farmer.last_name}"

    def has_signature(self):
        return bool(self.signature)


class DistributionAudit(models.Model):
    """
    Audit trail — every important action is logged here.
    Tracks who did what and when.
    """

    ACTION_CHOICES = (
        ('CREATED',   'Event Created'),
        ('ENCODED',   'Farmer Encoded'),
        ('SIGNED',    'Signature Captured'),
        ('SUBMITTED', 'Batch Submitted'),
        ('APPROVED',  'Batch Approved'),
        ('REJECTED',  'Batch Rejected'),
        ('EDITED',    'Entry Edited'),
        ('LOCKED',    'Batch Re-locked after Edit'),
    )

    batch     = models.ForeignKey(
        DistributionBatch,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        null=True, blank=True
    )
    event     = models.ForeignKey(
        DistributionEvent,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        null=True, blank=True
    )
    action    = models.CharField(max_length=15, choices=ACTION_CHOICES)
    user      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='distribution_audit_logs'
    )
    notes     = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} by {self.user} at {self.timestamp}"