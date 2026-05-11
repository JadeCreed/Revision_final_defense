from django.db import models
from django.conf import settings
from apps.accounts.choices import BARANGAY_CHOICES


class CropMonitoring(models.Model):
    """
    Tracks crop phase progression for each distributed farmer.
    Each phase update creates a new record for audit trail.
    Latest record per distribution_entry determines current phase.
    """

    PHASE_CHOICES = (
        ('DISTRIBUTED', 'Seed Distributed'),
        ('ESTABLISHED', 'Crop Established'),
        ('TILLERING',   'Tillering'),
        ('FLOWERING',   'Flowering'),
        ('RIPENING',    'Ripening'),
        ('HARVESTING',  'Harvesting'),
    )

    # Links to the farmer who received seed
    distribution_entry = models.ForeignKey(
        'distribution.DistributionEntry',
        on_delete=models.CASCADE,
        related_name='crop_monitoring_records'
    )

    # Who encoded this (AT user)
    encoded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='crop_monitoring_encoded'
    )

    # Location
    barangay = models.CharField(
        max_length=50,
        choices=BARANGAY_CHOICES
    )

    # Monitoring data
    phase = models.CharField(
        max_length=15,
        choices=PHASE_CHOICES
    )
    date_observed = models.DateField()
    notes = models.TextField(blank=True, default='')
    area_monitored = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        help_text='Area monitored in hectares'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Crop Monitoring Record'
        verbose_name_plural = 'Crop Monitoring Records'

    def __str__(self):
        farmer_name = f"{self.distribution_entry.farmer.first_name} {self.distribution_entry.farmer.last_name}"
        return f"{self.barangay} - {farmer_name} - {self.phase} ({self.date_observed})"
