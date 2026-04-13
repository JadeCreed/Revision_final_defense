from rest_framework import serializers
from .models import SeedDelivery, BrgyAllocation, SeedDeliveryAudit


class BrgyAllocationSerializer(serializers.ModelSerializer):
    confirmed_by_name = serializers.SerializerMethodField()
    delivery_info     = serializers.SerializerMethodField()

    class Meta:
        model  = BrgyAllocation
        fields = [
            'id', 'barangay', 'allocated_bags', 'status',
            'date_allocated', 'confirmed_by', 'confirmed_by_name',
            'date_confirmed', 'notes', 'delivery_info',
        ]
        read_only_fields = ['date_allocated', 'confirmed_by', 'date_confirmed']

    def get_confirmed_by_name(self, obj):
        if obj.confirmed_by:
            return obj.confirmed_by.get_full_name()
        return None

    def get_delivery_info(self, obj):
        d = obj.delivery
        return {
            'id':            d.id,
            'seed_type':     d.seed_type.name,
            'variety':       d.variety.name if d.variety else None,
            'season':        d.season,
            'season_display': d.season_display,
            'year':          d.year,
            'source':        d.source,
            'delivery_date': d.delivery_date,
        }


class SeedDeliverySerializer(serializers.ModelSerializer):
    seed_type_name  = serializers.SerializerMethodField()
    variety_name    = serializers.SerializerMethodField()
    season_display  = serializers.SerializerMethodField()
    encoded_by_name = serializers.SerializerMethodField()
    allocations     = BrgyAllocationSerializer(many=True, read_only=True)
    allocated_bags  = serializers.ReadOnlyField()
    remaining_bags  = serializers.ReadOnlyField()

    class Meta:
        model  = SeedDelivery
        fields = [
            'id', 'seed_type', 'seed_type_name',
            'variety', 'variety_name',
            'season', 'season_display', 'year', 'source',
            'total_bags', 'allocated_bags', 'remaining_bags',
            'delivery_date', 'lot_number', 'remarks',
            'encoded_by', 'encoded_by_name',
            'created_at', 'updated_at', 'allocations',
        ]
        read_only_fields = ['encoded_by', 'created_at', 'updated_at']

    def get_seed_type_name(self, obj):
        return obj.seed_type.name if obj.seed_type else None

    def get_variety_name(self, obj):
        return obj.variety.name if obj.variety else None

    def get_season_display(self, obj):
        return obj.season_display

    def get_encoded_by_name(self, obj):
        if obj.encoded_by:
            return obj.encoded_by.get_full_name()
        return None


class SeedDeliveryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SeedDelivery
        fields = [
            'seed_type', 'variety', 'season', 'year',
            'total_bags', 'delivery_date', 'lot_number', 'remarks',
        ]

    def validate(self, data):
        name = data['seed_type'].name.upper()
        if 'HYBRID' in name or name in ('NRP', 'RFO'):
            data['source'] = 'REGION'
        else:
            data['source'] = 'PHILRICE'
        return data


class SeedDeliveryAuditSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()
    action_display    = serializers.SerializerMethodField()

    class Meta:
        model  = SeedDeliveryAudit
        fields = [
            'id', 'action', 'action_display', 'details',
            'performed_by', 'performed_by_name', 'timestamp',
        ]

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return obj.performed_by.get_full_name()
        return None

    def get_action_display(self, obj):
        return dict(SeedDeliveryAudit.ACTION_CHOICES).get(obj.action, obj.action)