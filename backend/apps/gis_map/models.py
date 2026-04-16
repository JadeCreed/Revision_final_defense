from django.db import models


class FarmPlot(models.Model):
    """GPS coordinates of individual farm plots linked to farmers."""
    farmer = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='farm_plots',
        limit_choices_to={'role': 'FARMER'},
    )
    # Barangay (mirrors farmer.barangay for quick filtering)
    barangay        = models.CharField(max_length=100, db_index=True)
    label           = models.CharField(max_length=100, blank=True, default='Main Farm')
    latitude        = models.DecimalField(max_digits=9,  decimal_places=6)
    longitude       = models.DecimalField(max_digits=10, decimal_places=6)
    area_ha         = models.DecimalField(max_digits=8,  decimal_places=4, null=True, blank=True)
    land_type       = models.CharField(max_length=50, blank=True, default='Irrigated')
    # Optional polygon boundary (JSON array of [lat,lng] pairs)
    boundary_points = models.JSONField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['barangay', 'farmer__last_name']

    def __str__(self):
        return f"{self.farmer.get_full_name()} – {self.barangay} ({self.label})"