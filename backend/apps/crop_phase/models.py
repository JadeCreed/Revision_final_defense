from django.db import models
from django.conf import settings


class CropPhaseRecord(models.Model):
    """
    Official crop phase status per farmer per season (poll).
    Used by Admin/Brgy Phase menu.
    One record per farmer per poll — updates in place as season progresses.
    """
    PHASE_CHOICES = [
        ('DISTRIBUTION',  'Seed Distribution'),
        ('ESTABLISHMENT', 'Crop Establishment'),
        ('TILLERING',     'Tillering'),
        ('FLOWERING',     'Flowering'),
        ('RIPENING',      'Ripening'),
        ('HARVESTING',    'Harvesting'),
    ]

    poll = models.ForeignKey(
        'seed_poll.Poll',
        on_delete=models.CASCADE,
        related_name='crop_phase_records',
        help_text='The season this record belongs to.'
    )
    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='crop_phase_records'
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='crop_phases_recorded'
    )
    barangay      = models.CharField(max_length=100)
    crop_phase    = models.CharField(max_length=20, choices=PHASE_CHOICES)
    date_recorded = models.DateField()
    encoded_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)
    notes         = models.TextField(blank=True)

    class Meta:
        unique_together = ('poll', 'farmer')
        ordering = ['-encoded_at']
        verbose_name = 'Crop Phase Record'

    def __str__(self):
        return (
            f"{self.farmer.get_full_name()} — "
            f"{self.get_crop_phase_display()} — "
            f"{self.poll}"
        )
