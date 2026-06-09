from decimal import Decimal

from rest_framework import serializers
from django.conf import settings

from .models import HarvestRecord


class HarvestRecordSerializer(serializers.ModelSerializer):
    farmer_name = serializers.SerializerMethodField(read_only=True)
    farmer_rsbsa = serializers.SerializerMethodField(read_only=True)
    seed_source_label = serializers.SerializerMethodField(read_only=True)
    encoded_by_name = serializers.SerializerMethodField(read_only=True)
    
    # Weight calculations
    harvest_kg_fresh = serializers.SerializerMethodField(read_only=True)
    harvest_kg_dry = serializers.SerializerMethodField(read_only=True)
    harvest_kg = serializers.SerializerMethodField(read_only=True)
    harvest_mt = serializers.SerializerMethodField(read_only=True)
    yield_t_ha = serializers.SerializerMethodField(read_only=True)
    
    # Seed-based metrics
    seeding_density_kg_ha = serializers.SerializerMethodField(read_only=True)
    seed_implied_planted_kg = serializers.SerializerMethodField(read_only=True)
    seed_efficiency_pct = serializers.SerializerMethodField(read_only=True)
    productivity_ratio = serializers.SerializerMethodField(read_only=True)
    
    # Yield-based metrics (main)
    standard_yield_kg_ha = serializers.SerializerMethodField(read_only=True)
    expected_harvest_kg = serializers.SerializerMethodField(read_only=True)
    utilization_pct = serializers.SerializerMethodField(read_only=True)
    utilization_status = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = HarvestRecord
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_rsbsa', 'barangay',
            'seed_source', 'seed_source_label', 'variety',
            'harvest_area_ha', 'harvest_bags', 'harvest_date',
            'weight_type', 'moisture_content_pct',
            'seed_bags_received', 'notes',
            'encoded_by', 'encoded_by_name', 'created_at', 'updated_at',
            # Weight calculations
            'harvest_kg_fresh', 'harvest_kg_dry', 'harvest_kg', 'harvest_mt', 'yield_t_ha',
            # Seed-based metrics
            'seeding_density_kg_ha', 'seed_implied_planted_kg', 'seed_efficiency_pct', 'productivity_ratio',
            # Yield-based metrics
            'standard_yield_kg_ha', 'expected_harvest_kg', 'utilization_pct', 'utilization_status',
        ]
        read_only_fields = [
            'id', 'barangay', 'encoded_by', 'encoded_by_name',
            'created_at', 'updated_at',
            # Computed fields
            'harvest_kg_fresh', 'harvest_kg_dry', 'harvest_kg', 'harvest_mt', 'yield_t_ha',
            'seeding_density_kg_ha', 'seed_implied_planted_kg', 'seed_efficiency_pct', 'productivity_ratio',
            'standard_yield_kg_ha', 'expected_harvest_kg', 'utilization_pct', 'utilization_status',
            'farmer_name', 'farmer_rsbsa', 'seed_source_label',
        ]

    def validate_harvest_area_ha(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError('Area harvested must be greater than zero.')
        return value

    def validate_harvest_bags(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError('Harvest bags must be greater than zero.')
        return value

    def validate_harvest_date(self, value):
        return value

    def validate_seed_bags_received(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Seed bags received cannot be negative.')
        return value

    def validate(self, attrs):
        seed_source = attrs.get('seed_source')
        area = attrs.get('harvest_area_ha')
        if seed_source in ['HYBRID', 'INBRED'] and area and area > 0:
            received = attrs.get('seed_bags_received')
            if received is not None and received < 0:
                raise serializers.ValidationError({'seed_bags_received': 'Seed bags received cannot be negative.'})
        return attrs

    def get_farmer_name(self, obj):
        if obj.farmer:
            return f"{obj.farmer.last_name}, {obj.farmer.first_name}"
        return ''

    def get_farmer_rsbsa(self, obj):
        return getattr(obj.farmer, 'rsbsa_number', '') or ''

    def get_seed_source_label(self, obj):
        return obj.get_seed_source_display() if getattr(obj, 'seed_source', None) else ''

    def get_encoded_by_name(self, obj):
        if obj.encoded_by:
            return f"{obj.encoded_by.first_name} {obj.encoded_by.last_name}"
        return ''

    def get_harvest_kg_fresh(self, obj):
        return float(obj.harvest_kg_fresh) if obj.harvest_kg_fresh else None

    def get_harvest_kg_dry(self, obj):
        return float(obj.harvest_kg_dry) if obj.harvest_kg_dry else None

    def get_harvest_kg(self, obj):
        return float(obj.harvest_kg) if obj.harvest_kg else None

    def get_harvest_mt(self, obj):
        return float(obj.harvest_mt) if obj.harvest_mt else None

    def get_yield_t_ha(self, obj):
        return float(obj.yield_t_ha) if obj.yield_t_ha is not None else None

    def get_seeding_density_kg_ha(self, obj):
        return float(obj.seeding_density_kg_ha) if obj.seeding_density_kg_ha else None

    def get_seed_implied_planted_kg(self, obj):
        return float(obj.seed_implied_planted_kg) if obj.seed_implied_planted_kg else None

    def get_seed_efficiency_pct(self, obj):
        pct = obj.seed_efficiency_pct
        return float(pct) if pct is not None else None

    def get_productivity_ratio(self, obj):
        ratio = obj.productivity_ratio
        return float(ratio) if ratio and ratio > 0 else None

    def get_standard_yield_kg_ha(self, obj):
        return float(obj.standard_yield_kg_ha) if obj.standard_yield_kg_ha else None

    def get_expected_harvest_kg(self, obj):
        return float(obj.expected_harvest_kg) if obj.expected_harvest_kg else None

    def get_utilization_pct(self, obj):
        pct = obj.utilization_pct
        return float(pct) if pct is not None else None

    def get_utilization_status(self, obj):
        return obj.utilization_status
