# apps/crop_monitoring/serializers.py

from rest_framework import serializers
from .models import CropMonitoringRecord, BarangayCropSummary
from apps.accounts.models import User


class CropMonitoringRecordSerializer(serializers.ModelSerializer):
    """Full record with farmer + AT info — used for detail views and lists."""

    farmer_name    = serializers.SerializerMethodField()
    farmer_rsbsa   = serializers.SerializerMethodField()
    farmer_contact = serializers.SerializerMethodField()
    encoded_by_name = serializers.SerializerMethodField()
    crop_phase_display       = serializers.CharField(
        source='get_crop_phase_display', read_only=True
    )
    crop_establishment_display = serializers.CharField(
        source='get_crop_establishment_display', read_only=True
    )
    phase_status_display = serializers.CharField(
        source='get_phase_status_display', read_only=True
    )

    class Meta:
        model  = CropMonitoringRecord
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_rsbsa', 'farmer_contact',
            'encoded_by', 'encoded_by_name',
            'barangay',
            'crop_phase', 'crop_phase_display',
            'phase_status', 'phase_status_display',
            'crop_establishment', 'crop_establishment_display',
            'delay_days', 'damage_cause',
            'area_monitored_ha', 'sowing_date', 'variety_name',
            'remarks', 'date_observed', 'encoded_at', 'updated_at',
        ]
        read_only_fields = ['id', 'encoded_at', 'updated_at', 'encoded_by']

    def get_farmer_name(self, obj):
        return obj.farmer.get_full_name()

    def get_farmer_rsbsa(self, obj):
        return obj.farmer.rsbsa_number or ''

    def get_farmer_contact(self, obj):
        return obj.farmer.contact_number or ''

    def get_encoded_by_name(self, obj):
        if obj.encoded_by:
            return obj.encoded_by.get_full_name()
        return ''


class BarangayCropSummarySerializer(serializers.ModelSerializer):
    """
    Used by GIS map — returns phase counts + percentages per barangay.
    """
    phase_percentages      = serializers.SerializerMethodField()
    dominant_phase_display = serializers.SerializerMethodField()
    last_reported_by_name  = serializers.SerializerMethodField()

    class Meta:
        model  = BarangayCropSummary
        fields = [
            'barangay', 'dominant_phase', 'dominant_phase_display',
            'total_farmers',
            'distribution_count', 'establishment_count', 'tillering_count',
            'flowering_count', 'ripening_count', 'harvesting_count',
            'phase_percentages',
            'last_updated', 'last_reported_by_name',
        ]

    def get_phase_percentages(self, obj):
        return obj.get_phase_percentages()

    def get_dominant_phase_display(self, obj):
        return obj.get_dominant_phase_display()

    def get_last_reported_by_name(self, obj):
        if obj.last_reported_by:
            return obj.last_reported_by.get_full_name()
        return '—'