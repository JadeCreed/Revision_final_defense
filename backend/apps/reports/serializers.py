# apps/reports/serializers.py

from rest_framework import serializers
from .models import ReportLog


class ReportLogSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ReportLog
        fields = [
            'id', 'report_type', 'generated_by_name',
            'season', 'year', 'barangay', 'generated_at',
        ]

    def get_generated_by_name(self, obj):
        if obj.generated_by:
            return obj.generated_by.get_full_name()
        return None