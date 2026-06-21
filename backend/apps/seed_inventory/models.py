from django.db import models
from django.db.models import Sum
from django.core.exceptions import ValidationError
from apps.accounts.models import User
from apps.seed_poll.models import SeedType, SeedVariety


class SeedDelivery(models.Model):
    SEASON_CHOICES = [('WET', 'Wet Season'), ('DRY', 'Dry Season')]
    SOURCE_CHOICES = [
        ('REGION',   'Region (NRP/RFO)'),
        ('PHILRICE', 'PhilRice (RCEF)'),
    ]
    STATUS_CHOICES = [
        ('SCHEDULED', 'Scheduled'),
        ('DELIVERED', 'Delivered'),
    ]

    seed_type     = models.ForeignKey(SeedType, on_delete=models.PROTECT, related_name='deliveries')
    variety       = models.ForeignKey(SeedVariety, on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries')
    season        = models.CharField(max_length=10, choices=SEASON_CHOICES)
    year          = models.PositiveIntegerField()
    source        = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    total_bags    = models.PositiveIntegerField()
    delivery_date = models.DateField()
    lot_number    = models.CharField(max_length=100, blank=True)
    remarks       = models.TextField(blank=True)
    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SCHEDULED')
    encoded_by    = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='seed_deliveries'
    )
    # Optional link to the finalized season selection used for this delivery
    final_seed = models.ForeignKey(
        'seed_poll.FinalSeed', on_delete=models.PROTECT,
        null=True, blank=True, related_name='deliveries'
    )
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-delivery_date', '-created_at']

    def __str__(self):
        return f"{self.seed_type} {self.season} {self.year} — {self.total_bags} bags"

    @property
    def allocated_bags(self):
        return self.allocations.aggregate(t=Sum('allocated_bags'))['t'] or 0

    @property
    def remaining_bags(self):
        return self.total_bags - self.allocated_bags

    @property
    def season_display(self):
        return dict(self.SEASON_CHOICES).get(self.season, self.season)

    def clean(self):
        """Ensure final_seed (if set) matches this delivery's seed_type, season and year."""
        super().clean()
        if self.final_seed:
            final_type = getattr(self.final_seed, 'seed_type', None)
            if final_type and self.seed_type and final_type.id != self.seed_type.id:
                raise ValidationError('final_seed.seed_type must match delivery.seed_type')
            if getattr(self.final_seed, 'season', None) and getattr(self.final_seed, 'year', None):
                if self.final_seed.season != self.season or self.final_seed.year != self.year:
                    raise ValidationError('final_seed season/year must match delivery season/year')

    def save(self, *args, **kwargs):
        try:
            self.full_clean(validate_unique=False)
        except ValidationError:
            raise
        return super().save(*args, **kwargs)


class BrgyAllocation(models.Model):
    STATUS_CHOICES = [
        ('PENDING',   'Pending Pickup'),
        ('CONFIRMED', 'Confirmed Received'),
    ]

    delivery       = models.ForeignKey(SeedDelivery, on_delete=models.CASCADE, related_name='allocations')
    barangay       = models.CharField(max_length=100)
    allocated_bags = models.DecimalField(max_digits=10, decimal_places=2)
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    date_allocated = models.DateField(auto_now_add=True)
    confirmed_by   = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='confirmed_allocations'
    )
    date_confirmed = models.DateField(null=True, blank=True)
    notes          = models.TextField(blank=True)

    class Meta:
        ordering = ['barangay']
        unique_together = [['delivery', 'barangay']]

    def __str__(self):
        return f"Brgy. {self.barangay} — {self.allocated_bags} bags ({self.status})"


class SeedDeliveryAudit(models.Model):
    ACTION_CHOICES = [
        ('CREATED',   'Delivery Created'),
        ('UPDATED',   'Delivery Updated'),
        ('ALLOCATED', 'Bags Allocated to Barangay'),
        ('CONFIRMED', 'Pickup Confirmed by BRGY'),
        ('DELETED',   'Delivery Deleted'),
    ]

    delivery    = models.ForeignKey(
        SeedDelivery, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audits'
    )
    allocation  = models.ForeignKey(
        BrgyAllocation, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audits'
    )
    action      = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='inventory_audits'
    )
    details     = models.TextField(blank=True)
    timestamp   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']