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

    WEIGHT_TYPE_FRESH = 'FRESH'
    WEIGHT_TYPE_DRIED = 'DRIED'
    WEIGHT_TYPE_CHOICES = [
        (WEIGHT_TYPE_FRESH, 'Fresh / Wet'),
        (WEIGHT_TYPE_DRIED, 'Dried'),
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
    weight_type = models.CharField(
        max_length=10,
        choices=WEIGHT_TYPE_CHOICES,
        default=WEIGHT_TYPE_FRESH,
    )
    moisture_content_pct = models.PositiveSmallIntegerField(default=12)
    notes = models.TextField(blank=True)
    encoded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='harvest_records_encoded',
    )
    poll = models.ForeignKey(
        'seed_poll.Poll',
        on_delete=models.PROTECT,
        related_name='harvest_records',
        null=True,
        blank=True,
        help_text='The season poll this harvest record belongs to.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-harvest_date', '-created_at']

    def __str__(self):
        farmer_name = self.farmer.get_full_name() if self.farmer else 'Unknown'
        return f'Harvest #{self.id} — {farmer_name}'

    # ── HARVEST WEIGHT CALCULATIONS ──
    @property
    def harvest_kg_fresh(self):
        """Fresh/wet weight: harvest_bags × 50 kg/bag"""
        return Decimal(self.harvest_bags or 0) * Decimal(50)

    @property
    def harvest_kg_dry(self):
        """Dry weight: fresh × (1 - moisture%) [DA standard: 12% moisture]"""
        fresh = self.harvest_kg_fresh
        moisture_factor = Decimal(1) - (Decimal(self.moisture_content_pct or 12) / Decimal(100))
        return fresh * moisture_factor

    @property
    def harvest_kg(self):
        """Legacy: returns fresh weight for backward compatibility"""
        return self.harvest_kg_fresh

    @property
    def harvest_mt(self):
        """MT in dry weight (for comparisons with standard yields)"""
        return self.harvest_kg_dry / Decimal(1000)

    @property
    def yield_t_ha(self):
        """Yield in t/ha using dry weight"""
        if self.harvest_area_ha and self.harvest_area_ha > 0:
            return self.harvest_kg_dry / Decimal(self.harvest_area_ha) / Decimal(1000)
        return Decimal('0')

    # ── SEED-BASED CALCULATIONS ──
    @property
    def seeding_density_kg_ha(self):
        """DA standard seeding density for this seed type"""
        from django.conf import settings
        densities = settings.SEEDING_DENSITY
        return Decimal(densities.get(self.seed_source, 15))

    @property
    def seed_implied_planted_kg(self):
        """Implied seed planted: area × seeding density (NOT from distributed seed)"""
        if self.harvest_area_ha and self.harvest_area_ha > 0:
            return Decimal(self.harvest_area_ha) * self.seeding_density_kg_ha
        return Decimal(0)

    @property
    def seed_efficiency_pct(self):
        """Seed efficiency: (implied planted / distributed) × 100"""
        if self.seed_bags_received and self.seed_bags_received > 0:
            distributed_kg = Decimal(self.seed_bags_received * 50) if self.seed_source == 'OWN_SEED' else Decimal(self.seed_bags_received)
            implied = self.seed_implied_planted_kg
            if distributed_kg > 0:
                return (implied / distributed_kg) * Decimal(100)
        return None

    @property
    def productivity_ratio(self):
        """Productivity: kg of paddy produced per 1 kg of seed implied"""
        if self.seed_implied_planted_kg and self.seed_implied_planted_kg > 0:
            return self.harvest_kg_dry / self.seed_implied_planted_kg
        return Decimal(0)

    # ── YIELD-BASED UTILIZATION (MAIN METRIC) ──
    @property
    def standard_yield_kg_ha(self):
        """DA standard yield for this seed type (dry weight)"""
        from django.conf import settings
        yields = settings.STANDARD_YIELDS
        return Decimal(yields.get(self.seed_source, 2000))

    @property
    def expected_harvest_kg(self):
        """Expected harvest: area × standard yield"""
        if self.harvest_area_ha and self.harvest_area_ha > 0:
            return Decimal(self.harvest_area_ha) * self.standard_yield_kg_ha
        return Decimal(0)

    @property
    def utilization_pct(self):
        """MAIN METRIC: Utilization = (actual dry weight / expected yield) × 100"""
        expected = self.expected_harvest_kg
        if expected and expected > 0:
            return (self.harvest_kg_dry / expected) * Decimal(100)
        return None

    @property
    def utilization_status(self):
        """Status based on utilization percentage"""
        pct = self.utilization_pct
        if pct is None:
            return 'N/A'
        if pct >= 150:
            return 'EXCEPTIONAL'
        if pct >= 100:
            return 'EXCELLENT'
        if pct >= 75:
            return 'GOOD'
        return 'NEEDS_ATTENTION'
