# accounts/admin.py

from django.contrib import admin
from .models import User, FarmerProfile


class FarmerProfileInline(admin.StackedInline):
    model = FarmerProfile
    can_delete = False
    verbose_name_plural = 'Farmer profile'
    fk_name = 'user'
    # Build inline fields dynamically so admin doesn't crash if the model
    # (or its migrations) don't include a given field at runtime.
    inline_fields = [
        'middle_name', 'ext_name', 'date_of_birth',
        'residency_municipality', 'residency_barangay',
        'farm_municipality', 'farm_barangay',
        'gender', 'ip', 'senior_citizen', 'pwd', 'arbs', 'four_ps',
        'hectares',
    ]

    # Only include fields that actually exist on the model
    fields = tuple(f for f in inline_fields if hasattr(FarmerProfile, f))


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'first_name', 'last_name', 'contact_number', 'role', 'barangay', 'status', 'is_active')
    list_filter = ('role', 'status', 'barangay')
    search_fields = ('first_name', 'last_name', 'contact_number', 'rsbsa_number')
    inlines = [FarmerProfileInline]


