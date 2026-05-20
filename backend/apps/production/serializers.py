from decimal import Decimal

from rest_framework import serializers
from django.conf import settings

from .models import HarvestRecord


class HarvestRecordSerializer(serializers.ModelSerializer):
    farmer_name = serializers.SerializerMethodField(read_only=True)
    farmer_rsbsa = serializers.SerializerMethodField(read_only=True)
    seed_source_label = serializers.SerializerMethodField(read_only=True)
    encoded_by_name = serializers.SerializerMethodField(read_only=True)
    harvest_kg = serializers.SerializerMethodField(read_only=True)
    harvest_mt = serializers.SerializerMethodField(read_only=True)
    yield_t_ha = serializers.SerializerMethodField(read_only=True)
    target_seed_bags = serializers.SerializerMethodField(read_only=True)
    utilization_pct = serializers.SerializerMethodField(read_only=True)
    utilization_status = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = HarvestRecord
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_rsbsa', 'barangay',
            'seed_source', 'seed_source_label', 'variety',
            'harvest_area_ha', 'harvest_bags', 'harvest_date',
            'seed_bags_received', 'notes',
            'encoded_by', 'encoded_by_name', 'created_at', 'updated_at',
            'harvest_kg', 'harvest_mt', 'yield_t_ha', 'target_seed_bags',
            'utilization_pct', 'utilization_status',
        ]
        read_only_fields = [
            'id', 'barangay', 'encoded_by', 'encoded_by_name',
            'created_at', 'updated_at', 'harvest_kg', 'harvest_mt',
            'yield_t_ha', 'target_seed_bags', 'utilization_pct',
            'utilization_status', 'farmer_name', 'farmer_rsbsa',
            'seed_source_label',
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
        from datetime import date
        if value and value > date.today():
            raise serializers.ValidationError('Harvest date cannot be in the future.')
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

    def get_harvest_kg(self, obj):
        return float(obj.harvest_kg)

    def get_harvest_mt(self, obj):
        return float(obj.harvest_mt)

    def get_yield_t_ha(self, obj):
        return float(obj.yield_t_ha) if obj.yield_t_ha is not None else None

    def get_target_seed_bags(self, obj):
        target = obj.target_seed_bags
        return float(target) if target is not None else None

    def get_utilization_pct(self, obj):
        pct = obj.utilization_pct
        return float(pct) if pct is not None else None

    def get_utilization_status(self, obj):
        return obj.utilization_status
