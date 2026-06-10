from rest_framework import serializers
from django.db.models import Sum
from django.utils import timezone
from .models import (
    DistributionEvent,
    DistributionBatch,
    DistributionEntry,
    DistributionAudit,
)
from apps.accounts.models import User


class FarmerMinimalSerializer(serializers.ModelSerializer):
    """Minimal farmer info for distribution entry display."""

    class Meta:
        model  = User
        fields = [
            'id', 'first_name', 'last_name',
            'contact_number', 'barangay', 'rsbsa_number',
        ]


class DistributionEntrySerializer(serializers.ModelSerializer):
    """Full entry with farmer info."""
    farmer_detail = FarmerMinimalSerializer(source='farmer', read_only=True)
    farmer_name = serializers.SerializerMethodField()
    farmer_rsbsa = serializers.SerializerMethodField()
    farmer_contact = serializers.SerializerMethodField()
    farmer_barangay = serializers.SerializerMethodField()
    variety_name = serializers.SerializerMethodField()
    has_signature = serializers.SerializerMethodField()
    crop_establishment_display = serializers.CharField(
        source='get_crop_establishment_display', read_only=True
    )

    class Meta:
        model  = DistributionEntry
        fields = [
            'id', 'row_number', 'farmer', 'farmer_detail',
            'farmer_name', 'farmer_rsbsa', 'farmer_contact', 'farmer_barangay',
            'farm_area_ha', 'crop_establishment', 'crop_establishment_display',
            'variety', 'variety_name', 'data_sharing',
            'qty_bags', 'date_received', 'expected_sowing_date', 'authorized_representative',
            'area_planted', 'expected_yield',
            'signature', 'has_signature', 'signed_at',
            'encoded_at', 'updated_at',
        ]
        read_only_fields = ['id', 'encoded_at', 'updated_at', 'farmer_detail']

    def get_variety_name(self, obj):
        return obj.variety.name if obj.variety else ''

    def get_has_signature(self, obj):
        return bool(obj.signature)

    def get_farmer_name(self, obj):
        f = obj.farmer
        return f"{f.last_name}, {f.first_name}"

    def get_farmer_rsbsa(self, obj):
        return obj.farmer.rsbsa_number or ''

    def get_farmer_contact(self, obj):
        return obj.farmer.contact_number or ''

    def get_farmer_barangay(self, obj):
        return obj.farmer.barangay or ''


class DistributionEntryListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for table display.
    Does NOT include the base64 signature (too large for lists).
    """
    farmer_name    = serializers.SerializerMethodField()
    farmer_rsbsa   = serializers.SerializerMethodField()
    farmer_contact = serializers.SerializerMethodField()
    farmer_barangay = serializers.SerializerMethodField()
    variety_name   = serializers.SerializerMethodField()
    has_signature  = serializers.SerializerMethodField()
    crop_establishment_display = serializers.CharField(
        source='get_crop_establishment_display', read_only=True
    )

    class Meta:
        model  = DistributionEntry
        fields = [
            'id', 'row_number',
            'farmer', 'farmer_name', 'farmer_rsbsa',
            'farmer_contact', 'farmer_barangay',
            'farm_area_ha', 'crop_establishment', 'crop_establishment_display',
            'variety_name',
            'qty_bags', 'date_received', 'expected_sowing_date', 'authorized_representative',
            'has_signature', 'signed_at',
        ]

    def get_farmer_barangay(self, obj):
        return obj.farmer.barangay or ''

    def get_farmer_name(self, obj):
        f = obj.farmer
        return f"{f.last_name}, {f.first_name}"

    def get_farmer_rsbsa(self, obj):
        return obj.farmer.rsbsa_number or ''

    def get_farmer_contact(self, obj):
        return obj.farmer.contact_number or ''

    def get_has_signature(self, obj):
        return bool(obj.signature)


class DistributionBatchSerializer(serializers.ModelSerializer):
    """Batch with entry count and status info."""
    entries      = DistributionEntrySerializer(many=True, read_only=True)
    entry_count  = serializers.SerializerMethodField()
    is_full      = serializers.SerializerMethodField()
    encoded_by_name  = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    status_display   = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = DistributionBatch
        fields = [
            'id', 'batch_number', 'status', 'status_display',
            'entry_count', 'is_full',
            'submitted_at', 'approved_at',
            'distribution_status', 'distribution_submitted_at',
            'distribution_approved_at', 'distribution_rejected_reason',
            'encoded_by_name', 'approved_by_name',
            'rejected_reason',
            'entries',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'batch_number', 'created_at', 'updated_at',
            'entries', 'entry_count', 'is_full',
        ]

    def get_entry_count(self, obj):
        return obj.entries.count()

    def get_is_full(self, obj):
        return obj.is_full()

    def get_encoded_by_name(self, obj):
        if obj.encoded_by:
            return f"{obj.encoded_by.first_name} {obj.encoded_by.last_name}"
        return ''

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}"
        return ''


class DistributionBatchListSerializer(serializers.ModelSerializer):
    """Lightweight batch list — no entries included."""
    entry_count      = serializers.SerializerMethodField()
    status_display   = serializers.CharField(source='get_status_display', read_only=True)
    encoded_by_name  = serializers.SerializerMethodField()

    class Meta:
        model  = DistributionBatch
        fields = [
            'id', 'event', 'batch_number', 'status', 'status_display',
            'entry_count', 'submitted_at', 'approved_at',
            'distribution_status', 'distribution_submitted_at',
            'distribution_rejected_reason',
            'encoded_by_name', 'rejected_reason', 'created_at',
        ]

    def get_entry_count(self, obj):
        return obj.entries.count()

    def get_encoded_by_name(self, obj):
        if obj.encoded_by:
            return f"{obj.encoded_by.first_name} {obj.encoded_by.last_name}"
        return ''


class DistributionEventSerializer(serializers.ModelSerializer):
    """Full event with progress stats."""
    batches          = DistributionBatchListSerializer(many=True, read_only=True)
    total_encoded    = serializers.SerializerMethodField()
    total_approved   = serializers.SerializerMethodField()
    total_remaining  = serializers.SerializerMethodField()
    batch_count      = serializers.SerializerMethodField()
    created_by_name  = serializers.SerializerMethodField()
    status_display   = serializers.CharField(source='get_status_display', read_only=True)
    season_display   = serializers.SerializerMethodField()
    intervention_display = serializers.CharField(
        source='get_intervention_display', read_only=True
    )
    seed_type_name   = serializers.SerializerMethodField()
    variety_name     = serializers.SerializerMethodField()

    class Meta:
        model  = DistributionEvent
        fields = [
            'id', 'barangay', 'intervention', 'intervention_display',
            'seed_type', 'seed_type_name',
            'variety',   'variety_name',
            'season', 'season_display', 'year',
            'organization_name', 'total_members',
            'status', 'status_display',
            'seed_delivered', 'seed_delivered_at',
            'total_encoded', 'total_approved', 'total_remaining',
            'batch_count', 'batches',
            'created_by_name', 'created_at', 'updated_at',
            'delete_requested', 'delete_request_note', 'delete_requested_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'total_encoded', 'total_approved', 'total_remaining',
            'batch_count', 'batches',
        ]

    def get_seed_type_name(self, obj):
        return obj.seed_type.name if obj.seed_type else ''

    def get_variety_name(self, obj):
        return obj.variety.name if obj.variety else ''

    def get_total_encoded(self, obj):
        return obj.get_total_encoded()

    def get_total_approved(self, obj):
        return obj.get_total_approved()

    def get_total_remaining(self, obj):
        return max(0, obj.total_members - obj.get_total_encoded())

    def get_batch_count(self, obj):
        return obj.batches.count()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}"
        return ''

    def get_season_display(self, obj):
        return {'WET': 'Wet Season', 'DRY': 'Dry Season'}.get(obj.season, obj.season)


class DistributionEventListSerializer(serializers.ModelSerializer):
    """Lightweight list — no batches."""
    seed_type_name       = serializers.SerializerMethodField()
    total_encoded        = serializers.SerializerMethodField()
    total_approved       = serializers.SerializerMethodField()
    total_remaining      = serializers.SerializerMethodField()
    batch_count          = serializers.SerializerMethodField()
    approved_batch_count = serializers.SerializerMethodField()
    intervention_display = serializers.CharField(
        source='get_intervention_display', read_only=True
    )
    season_display = serializers.SerializerMethodField()
    variety_name   = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = DistributionEvent
        fields = [
            'id', 'barangay', 'intervention', 'intervention_display',
            'seed_type_name', 'variety_name', 'season', 'season_display', 'year',
            'organization_name', 'total_members',
            'status', 'status_display',
            'seed_delivered', 'seed_delivered_at',
            'total_encoded', 'total_approved', 'total_remaining',
            'batch_count', 'approved_batch_count', 'created_at',
            'delete_requested', 'delete_request_note', 'delete_requested_at',
        ]

    def get_seed_type_name(self, obj):
        return obj.seed_type.name if obj.seed_type else ''

    def get_total_encoded(self, obj):
        return obj.get_total_encoded()

    def get_total_approved(self, obj):
        return obj.get_total_approved()

    def get_total_remaining(self, obj):
        return max(0, obj.total_members - obj.get_total_encoded())

    def get_batch_count(self, obj):
        return obj.batches.count()

    def get_approved_batch_count(self, obj):
        return obj.batches.filter(status='APPROVED').count()

    def get_season_display(self, obj):
        return {'WET': 'Wet Season', 'DRY': 'Dry Season'}.get(obj.season, obj.season)

    def get_variety_name(self, obj):
        return obj.variety.name if obj.variety else ''


class DistributionAuditSerializer(serializers.ModelSerializer):
    user_name      = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model  = DistributionAudit
        fields = ['id', 'action', 'action_display', 'user_name', 'notes', 'timestamp']

    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return 'System'