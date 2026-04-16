from rest_framework import serializers
from .models import FarmPlot
from apps.accounts.models import User


class FarmPlotSerializer(serializers.ModelSerializer):
    farmer_name    = serializers.SerializerMethodField()
    farmer_rsbsa   = serializers.SerializerMethodField()
    farmer_contact = serializers.SerializerMethodField()
    farmer_barangay = serializers.SerializerMethodField()

    class Meta:
        model  = FarmPlot
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_rsbsa',
            'farmer_contact', 'farmer_barangay',
            'barangay', 'label', 'latitude', 'longitude',
            'area_ha', 'land_type', 'boundary_points',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_farmer_name(self, obj):
        return obj.farmer.get_full_name() if obj.farmer else None

    def get_farmer_rsbsa(self, obj):
        return getattr(obj.farmer, 'rsbsa_number', None)

    def get_farmer_contact(self, obj):
        return getattr(obj.farmer, 'contact_number', None)

    def get_farmer_barangay(self, obj):
        return getattr(obj.farmer, 'barangay', None)


class FarmPlotWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FarmPlot
        fields = [
            'farmer', 'barangay', 'label',
            'latitude', 'longitude',
            'area_ha', 'land_type', 'boundary_points',
        ]

    def validate_farmer(self, value):
        if value.role != 'FARMER':
            raise serializers.ValidationError("Selected user is not a farmer.")
        return value


class MapSummarySerializer(serializers.Serializer):
    """Summary stats for the map header."""
    total_plots    = serializers.IntegerField()
    total_farmers  = serializers.IntegerField()
    total_area_ha  = serializers.DecimalField(max_digits=10, decimal_places=2)
    barangays      = serializers.ListField(child=serializers.CharField())