from rest_framework import serializers
from .models import CropMonitoring


class CropMonitoringSerializer(serializers.ModelSerializer):
    distribution_entry_id = serializers.IntegerField(source='distribution_entry.id', read_only=True)
    farmer_name = serializers.SerializerMethodField()
    farmer_rsbsa = serializers.SerializerMethodField()
    farmer_barangay = serializers.SerializerMethodField()
    event_name = serializers.SerializerMethodField()
    phase_display = serializers.CharField(source='get_phase_display', read_only=True)

    class Meta:
        model = CropMonitoring
        fields = [
            'id', 'distribution_entry_id', 'farmer_name', 'farmer_rsbsa', 'farmer_barangay',
            'event_name', 'barangay', 'phase', 'phase_display', 'date_observed',
            'area_monitored', 'notes', 'encoded_by', 'encoded_by', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'farmer_name', 'farmer_rsbsa', 'farmer_barangay', 'event_name',
            'phase_display', 'encoded_by', 'created_at', 'updated_at',
        ]

    def get_farmer_name(self, obj):
        farmer = getattr(obj.distribution_entry, 'farmer', None)
        if farmer:
            return f"{farmer.last_name}, {farmer.first_name}"
        return ''

    def get_farmer_rsbsa(self, obj):
        return getattr(obj.distribution_entry.farmer, 'rsbsa_number', '') if obj.distribution_entry else ''

    def get_farmer_barangay(self, obj):
        return obj.distribution_entry.batch.event.barangay if obj.distribution_entry else ''

    def get_event_name(self, obj):
        return str(obj.distribution_entry.batch.event) if obj.distribution_entry else ''


class CropMonitoringCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropMonitoring
        fields = ['distribution_entry', 'barangay', 'phase', 'date_observed', 'area_monitored', 'notes']

    def validate(self, attrs):
        entry = attrs.get('distribution_entry')
        if not entry:
            raise serializers.ValidationError({'distribution_entry': 'Distribution entry is required.'})

        phase = attrs.get('phase')
        if not phase:
            raise serializers.ValidationError({'phase': 'Phase is required.'})

        if attrs.get('area_monitored') is None:
            raise serializers.ValidationError({'area_monitored': 'Area monitored is required.'})

        return attrs