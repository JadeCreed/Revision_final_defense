# apps/crop_monitoring/models.py
# CropMonitoring tracks each AT visit to a farmer's field.
# Each record = one phase observation for one farmer.
# The GIS map reads the LATEST record per barangay to get dominant phase.

from django.db import models
from django.conf import settings


class CropMonitoringRecord(models.Model):
    """
    One field visit = one record.
    AT encodes the current crop phase for a specific farmer
    after physically visiting their farm.
    """

    PHASE_CHOICES = [
        ('DISTRIBUTION',  'Seed Distribution'),
        ('ESTABLISHMENT', 'Crop Establishment'),
        ('TILLERING',     'Tillering'),
        ('FLOWERING',     'Flowering'),
        ('RIPENING',      'Ripening'),
        ('HARVESTING',    'Harvesting'),
    ]

    ESTABLISHMENT_CHOICES = [
        ('DS', 'Direct Seeding (D)'),
        ('TP', 'Transplanting (T)'),
    ]

    # ── WHO ──
    # The farmer being monitored
    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='crop_monitoring_records'
    )
    # The AT who visited and encoded
    encoded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='monitoring_encoded'
    )

    # ── WHERE ──
    barangay = models.CharField(max_length=100)

    # ── PHASE DATA ──
    crop_phase = models.CharField(max_length=20, choices=PHASE_CHOICES)
    crop_establishment = models.CharField(
        max_length=2, choices=ESTABLISHMENT_CHOICES,
        null=True, blank=True,
        help_text='Only required if phase is ESTABLISHMENT'
    )

    STATUS_CHOICES = [
        ('NORMAL',  'Normal'),
        ('DELAYED', 'Delayed'),
        ('DAMAGED', 'Damaged'),
    ]

    phase_status = models.CharField(
        max_length=10, choices=STATUS_CHOICES,
        default='NORMAL',
        help_text='Quick status summary for this crop observation'
    )
    delay_days = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Days delayed if status is delayed'
    )
    damage_cause = models.CharField(
        max_length=100, blank=True,
        help_text='Cause of damage if status is damaged'
    )

    # ── FARM DATA ──
    area_monitored_ha = models.DecimalField(
        max_digits=6, decimal_places=2,
        null=True, blank=True,
        help_text='Area actually monitored in hectares'
    )
    sowing_date = models.DateField(
        null=True, blank=True,
        help_text='Date when planting/sowing started'
    )
    variety_name = models.CharField(
        max_length=100, blank=True,
        help_text='Crop variety observed in the field'
    )

    SEED_SOURCE_CHOICES = [
        ('HYBRID', 'Hybrid Seed'),
        ('INBRED', 'Inbred Seed'),
        ('OWN_SEED', 'Own Seed'),
    ]
    seed_source = models.CharField(
        max_length=10,
        choices=SEED_SOURCE_CHOICES,
        null=True,
        blank=True,
        help_text='Source of seed used by the farmer for this observation'
    )

    # ── NOTES ──
    remarks = models.TextField(
        blank=True,
        help_text='AT field observations, issues, or notes'
    )

    # ── TIMESTAMPS ──
    date_observed  = models.DateField()
    encoded_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_observed', '-encoded_at']
        verbose_name = 'Crop Monitoring Record'

    def __str__(self):
        return (
            f"{self.farmer.get_full_name()} — "
            f"{self.get_crop_phase_display()} — "
            f"{self.date_observed}"
        )


class BarangayCropSummary(models.Model):
    """
    Cached summary per barangay for GIS map performance.
    Updated every time a new CropMonitoringRecord is saved
    via Django signal (see signals.py).
    Avoids expensive real-time aggregation on GIS map load.
    """

    barangay       = models.CharField(max_length=100, unique=True)
    dominant_phase = models.CharField(
        max_length=20,
        choices=CropMonitoringRecord.PHASE_CHOICES,
        default='DISTRIBUTION'
    )
    total_farmers        = models.PositiveIntegerField(default=0)
    distribution_count   = models.PositiveIntegerField(default=0)
    establishment_count  = models.PositiveIntegerField(default=0)
    tillering_count      = models.PositiveIntegerField(default=0)
    flowering_count      = models.PositiveIntegerField(default=0)
    ripening_count       = models.PositiveIntegerField(default=0)
    harvesting_count     = models.PositiveIntegerField(default=0)
    last_updated         = models.DateTimeField(auto_now=True)
    last_reported_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )

    class Meta:
        ordering = ['barangay']
        verbose_name = 'Barangay Crop Summary'
        verbose_name_plural = 'Barangay Crop Summaries'

    def __str__(self):
        return f"{self.barangay} — {self.get_dominant_phase_display()}"

    def get_dominant_phase_display(self):
        phase_map = dict(CropMonitoringRecord.PHASE_CHOICES)
        return phase_map.get(self.dominant_phase, self.dominant_phase)

    def get_phase_percentages(self):
        """Returns dict of phase: percentage for GIS chart display."""
        total = (
            self.distribution_count + self.establishment_count +
            self.tillering_count + self.flowering_count +
            self.ripening_count + self.harvesting_count
        )
        if total == 0:
            return {}
        return {
            'DISTRIBUTION':  round((self.distribution_count  / total) * 100),
            'ESTABLISHMENT': round((self.establishment_count / total) * 100),
            'TILLERING':     round((self.tillering_count     / total) * 100),
            'FLOWERING':     round((self.flowering_count     / total) * 100),
            'RIPENING':      round((self.ripening_count      / total) * 100),
            'HARVESTING':    round((self.harvesting_count    / total) * 100),
        }