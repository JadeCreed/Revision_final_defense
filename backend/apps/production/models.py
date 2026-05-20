from decimal import Decimal

from django.conf import settings
from django.db import models


class HarvestRecord(models.Model):
    SEED_SOURCE_HYBRID = 'HYBRID'
    SEED_SOURCE_INBRED = 'INBRED'
    SEED_SOURCE_OWN_SEED = 'OWN_SEED'

    SEED_SOURCE_CHOICES = [
        (SEED_SOURCE_HYBRID, 'Hybrid'),
        (SEED_SOURCE_INBRED, 'Inbred'),
        (SEED_SOURCE_OWN_SEED, 'Own Seed'),
    ]

    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='harvest_records',
    )
    barangay = models.CharField(max_length=100, blank=True, null=True)
    seed_source = models.CharField(max_length=20, choices=SEED_SOURCE_CHOICES)
    variety = models.CharField(max_length=200)
    harvest_area_ha = models.DecimalField(max_digits=8, decimal_places=2)
    harvest_bags = models.PositiveIntegerField()
    seed_bags_received = models.PositiveIntegerField(blank=True, null=True)
    harvest_date = models.DateField()
    notes = models.TextField(blank=True)
    encoded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='harvest_records_encoded',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-harvest_date', '-created_at']

    def __str__(self):
        farmer_name = self.farmer.get_full_name() if self.farmer else 'Unknown'
        return f'Harvest #{self.id} — {farmer_name}'

    @property
    def harvest_kg(self):
        return Decimal(self.harvest_bags or 0) * Decimal(50)

    @property
    def harvest_mt(self):
        return self.harvest_kg / Decimal(1000)

    @property
    def yield_t_ha(self):
        if self.harvest_area_ha and self.harvest_area_ha > 0:
            return self.harvest_mt / Decimal(self.harvest_area_ha)
        return Decimal('0')

    @property
    def seed_rate(self):
        if self.seed_source == self.SEED_SOURCE_HYBRID:
            return Decimal('10')
        if self.seed_source == self.SEED_SOURCE_INBRED:
            return Decimal('6')
        return None

    @property
    def target_seed_bags(self):
        rate = self.seed_rate
        if rate and self.harvest_area_ha and self.harvest_area_ha > 0:
            return Decimal(self.harvest_area_ha) * rate
        return None

    @property
    def utilization_pct(self):
        target = self.target_seed_bags
        if target and self.seed_bags_received is not None and target > 0:
            return (Decimal(self.seed_bags_received) / target) * Decimal(100)
        return None

    @property
    def utilization_status(self):
        pct = self.utilization_pct
        if pct is None:
            return 'N/A'
        if pct >= 90:
            return 'Optimal'
        if pct >= 70:
            return 'Moderate'
        return 'Low'
