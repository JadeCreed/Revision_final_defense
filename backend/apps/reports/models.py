# apps/reports/models.py
# No custom models needed — reports are generated on-the-fly
# from existing Distribution, Accounts, and SeedPoll data.
# This file is kept minimal intentionally.

from django.db import models


class ReportLog(models.Model):
    """
    Tracks every report generated for audit purposes.
    """
    REPORT_TYPE_CHOICES = [
        ('HYBRID_MASTERLIST',   'Hybrid Masterlist'),
        ('PHILRICE_MASTERLIST', 'PhilRice Masterlist'),
        ('SEED_DISTRIBUTION',    'Seed Distribution'),
        ('FARMER_REGISTRATION',   'Farmer Registration'),
        ('PLANTING_ACCOMPLISHMENT',   'Planting Accomplishment'),
        ('HARVESTING_ACCOMPLISHMENT', 'Harvesting Accomplishment'),
    ]

    report_type  = models.CharField(max_length=40, choices=REPORT_TYPE_CHOICES)
    generated_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='generated_reports'
    )
    # Filters used when the report was generated
    season       = models.CharField(max_length=10, null=True, blank=True)
    year         = models.PositiveIntegerField(null=True, blank=True)
    barangay     = models.CharField(max_length=100, null=True, blank=True)

    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-generated_at']
        verbose_name = 'Report Log'

    def __str__(self):
        return f"{self.report_type} — {self.generated_at:%Y-%m-%d %H:%M}"