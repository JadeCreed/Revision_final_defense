from rest_framework import serializers
from django.db.models import Sum
from .models import DistributionEntry
from apps.accounts.models import User


class FarmerSearchSerializer(serializers.ModelSerializer):
    """
    Used when BRGY searches for farmers to add to a batch.
    Includes profile fields needed for the distribution form.
    """
    middle_name            = serializers.SerializerMethodField()
    ext_name               = serializers.SerializerMethodField()
    date_of_birth          = serializers.SerializerMethodField()
    gender                 = serializers.SerializerMethodField()
    residency_municipality = serializers.SerializerMethodField()
    residency_barangay     = serializers.SerializerMethodField()
    farm_municipality      = serializers.SerializerMethodField()
    farm_barangay          = serializers.SerializerMethodField()
    ip                     = serializers.SerializerMethodField()
    senior_citizen         = serializers.SerializerMethodField()
    pwd                    = serializers.SerializerMethodField()
    arbs                   = serializers.SerializerMethodField()
    four_ps                = serializers.SerializerMethodField()
    hectares               = serializers.SerializerMethodField()
    allocated_hectares     = serializers.SerializerMethodField()
    remaining_hectares     = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            'id', 'first_name', 'last_name', 'contact_number',
            'barangay', 'rsbsa_number',
            'middle_name', 'ext_name', 'date_of_birth', 'gender',
            'residency_municipality', 'residency_barangay',
            'farm_municipality', 'farm_barangay',
            'ip', 'senior_citizen', 'pwd', 'arbs', 'four_ps', 'hectares',
            'allocated_hectares', 'remaining_hectares',
        ]

    def _get_profile(self, obj):
        try:
            return obj.profile
        except Exception:
            return None

    def get_middle_name(self, obj):
        p = self._get_profile(obj); return p.middle_name if p else ''

    def get_ext_name(self, obj):
        p = self._get_profile(obj); return p.ext_name if p else ''

    def get_date_of_birth(self, obj):
        p = self._get_profile(obj); return p.date_of_birth if p else None

    def get_gender(self, obj):
        p = self._get_profile(obj); return p.gender if p else ''

    def get_residency_municipality(self, obj):
        p = self._get_profile(obj); return p.residency_municipality if p else ''

    def get_residency_barangay(self, obj):
        p = self._get_profile(obj); return p.residency_barangay if p else ''

    def get_farm_municipality(self, obj):
        p = self._get_profile(obj); return p.farm_municipality if p else ''

    def get_farm_barangay(self, obj):
        p = self._get_profile(obj); return p.farm_barangay if p else ''

    def get_ip(self, obj):
        p = self._get_profile(obj); return p.ip if p else False

    def get_senior_citizen(self, obj):
        p = self._get_profile(obj); return p.senior_citizen if p else False

    def get_pwd(self, obj):
        p = self._get_profile(obj); return p.pwd if p else False

    def get_arbs(self, obj):
        p = self._get_profile(obj); return p.arbs if p else False

    def get_four_ps(self, obj):
        p = self._get_profile(obj); return p.four_ps if p else False

    def get_hectares(self, obj):
        p = self._get_profile(obj)
        if not p:
            return 0.0
        hectares = getattr(p, 'hectares', None)
        return float(hectares) if hectares is not None else 0.0

    def get_allocated_hectares(self, obj):
        season = self.context.get('season')
        year   = self.context.get('year')

        entries = DistributionEntry.objects.filter(
            farmer=obj
        ).exclude(
            batch__status='REJECTED'
        )

        if season is not None:
            entries = entries.filter(batch__event__season=season)
        if year is not None:
            entries = entries.filter(batch__event__year=year)

        totals = entries.aggregate(
            hybrid_total=Sum('farm_area_ha'),
            inbred_total=Sum('area_planted'),
        )
        hybrid = float(totals.get('hybrid_total') or 0)
        inbred = float(totals.get('inbred_total') or 0)
        return round(hybrid + inbred, 2)

    def get_remaining_hectares(self, obj):
        total     = self.get_hectares(obj)
        allocated = self.get_allocated_hectares(obj)
        return round(max(0, total - allocated), 2)