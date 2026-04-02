# apps/announcements/serializers.py
# ============================================================
# THREE serializers:
# 1. AnnouncementAdminSerializer   — admin creates/edits
# 2. AnnouncementReadSerializer    — marks as read (all roles)
# 3. AnnouncementListSerializer    — what farmer/AT/BRGY sees
#                                    includes is_read, is_new
# ============================================================

from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import Announcement, AnnouncementRead


# ─────────────────────────────────────────────────────────────
# 1. ADMIN SERIALIZER
# Used when admin creates or edits an announcement.
# posted_by is set automatically from request.user in the view.
# target_barangays is a list on the frontend but stored as
# comma-separated string in the DB.
# ─────────────────────────────────────────────────────────────
class AnnouncementAdminSerializer(serializers.ModelSerializer):
    """
    Used by admin to create and edit announcements.
    - posted_by set automatically in the view (not from frontend)
    - target_barangays_list: frontend sends a list, we store as string
    - target_barangays_display: frontend reads as list
    """

    # Read-only — who posted it
    posted_by_name = serializers.SerializerMethodField()

    # WRITE field — frontend sends: ["Abang", "Aliliw"]
    # required=False so admin can post to ALL barangays (empty list)
    target_barangays_list = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
        write_only=True,   # ✅ write only — reading uses display field below
    )

    # READ field — frontend receives: ["Abang", "Aliliw"]
    # SerializerMethodField is always read-only
    target_barangays_display = serializers.SerializerMethodField()

    class Meta:
        model  = Announcement
        fields = [
            'id',
            'title',
            'content',
            'target_role',
            'target_barangays_list',    # write: frontend sends list
            'target_barangays_display', # read: frontend receives list
            # ✅ removed raw 'target_barangays' — frontend doesn't need it
            'is_active',
            'created_at',
            'updated_at',
            'posted_by_name',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'posted_by_name',
            'target_barangays_display',
        ]

    def get_posted_by_name(self, obj):
        if obj.posted_by:
            return f"{obj.posted_by.first_name} {obj.posted_by.last_name}"
        return "Admin"

    def get_target_barangays_display(self, obj):
        # Converts stored "Abang,Aliliw" → ["Abang", "Aliliw"]
        return obj.get_target_barangays()

    def create(self, validated_data):
        # ✅ correct key — 'target_barangays_list' matches the field name
        barangay_list = validated_data.pop('target_barangays_list', [])
        # Convert ["Abang", "Aliliw"] → "Abang,Aliliw" for DB storage
        validated_data['target_barangays'] = ','.join(barangay_list)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # ✅ correct key
        barangay_list = validated_data.pop('target_barangays_list', None)
        if barangay_list is not None:
            validated_data['target_barangays'] = ','.join(barangay_list)
        return super().update(instance, validated_data)


# ─────────────────────────────────────────────────────────────
# 2. MARK AS READ SERIALIZER
# Used when farmer/AT/BRGY clicks an announcement.
# Just needs the announcement ID — user comes from request.
# ─────────────────────────────────────────────────────────────
class AnnouncementReadSerializer(serializers.ModelSerializer):
    """
    Kept for future use — e.g. if you want an explicit
    POST /announcements/<id>/read/ endpoint later.
    Currently reading is triggered automatically when
    UserAnnouncementDetailView is called.
    """
    class Meta:
        model  = AnnouncementRead
        fields = ['id', 'announcement', 'read_at']
        read_only_fields = ['id', 'read_at']

# ─────────────────────────────────────────────────────────────
# 3. LIST SERIALIZER (what users see)
# Used for farmer/AT/BRGY announcement list and detail.
# Adds two computed fields:
#   is_read — did THIS user read it?
#   is_new  — is it unread AND posted within last 24 hours?
# ─────────────────────────────────────────────────────────────
class AnnouncementListSerializer(serializers.ModelSerializer):

    posted_by_name       = serializers.SerializerMethodField()
    target_barangays_list = serializers.SerializerMethodField()
    is_read              = serializers.SerializerMethodField()
    is_new               = serializers.SerializerMethodField()
    # Human-readable relative time: "2 mins ago", "3 days ago"
    time_ago             = serializers.SerializerMethodField()
    # Day number only: 25 (from Jan 25)
    day_number           = serializers.SerializerMethodField()
    # Formatted: "Jan 25, 2026"
    formatted_date       = serializers.SerializerMethodField()

    class Meta:
        model  = Announcement
        fields = [
            'id',
            'title',
            'content',
            'target_role',
            'target_barangays_list',
            'posted_by_name',
            'created_at',
            'is_active',
            # Computed fields
            'is_read',
            'is_new',
            'time_ago',
            'day_number',
            'formatted_date',
        ]

    def get_posted_by_name(self, obj):
        if obj.posted_by:
            return f"{obj.posted_by.first_name} {obj.posted_by.last_name}"
        return "Admin"

    def get_target_barangays_list(self, obj):
        return obj.get_target_barangays()

    def get_is_read(self, obj):
        # Primary: use read_ids from context (no DB query)
        read_ids = self.context.get('read_ids', None)
        if read_ids is not None:
            return obj.id in read_ids  #  no DB query

        # Fallback: if view forgot to pass read_ids, query DB directly
        # This should not happen in normal flow but prevents crashes
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return AnnouncementRead.objects.filter(
            user=request.user,
            announcement=obj
        ).exists()

    def get_is_new(self, obj):
        # Primary: use read_ids from context (no DB query)
        read_ids = self.context.get('read_ids', None)
        if read_ids is not None:
            if obj.id in read_ids:
                return False
        else:
            # Fallback: query DB if context missing
            request = self.context.get('request')
            if not request or not request.user.is_authenticated:
                return False
            already_read = AnnouncementRead.objects.filter(
                user=request.user,
                announcement=obj
            ).exists()
            if already_read:
                return False

        # Check within 24 hours — no DB query either way
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        return obj.created_at >= twenty_four_hours_ago

    def get_time_ago(self, obj):
        # Returns human-readable relative time
        # "just now", "5 mins ago", "2 hrs ago", "3 days ago"
        now   = timezone.now()
        diff  = now - obj.created_at
        total_seconds = int(diff.total_seconds())

        if total_seconds < 60:
            return "just now"
        elif total_seconds < 3600:
            mins = total_seconds // 60
            return f"{mins} min{'s' if mins > 1 else ''} ago"
        elif total_seconds < 86400:
            hrs = total_seconds // 3600
            return f"{hrs} hr{'s' if hrs > 1 else ''} ago"
        elif total_seconds < 2592000:  # 30 days
            days = total_seconds // 86400
            return f"{days} day{'s' if days > 1 else ''} ago"
        else:
            months = total_seconds // 2592000
            return f"{months} month{'s' if months > 1 else ''} ago"

    def get_day_number(self, obj):
        return obj.created_at.strftime('%d').lstrip('0')  # "25" not "05"

    def get_formatted_date(self, obj):
        return obj.created_at.strftime('%b %d, %Y')