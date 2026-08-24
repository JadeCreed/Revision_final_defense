
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from .managers import CustomUserManager
from .choices import ROLE_CHOICES, BARANGAY_CHOICES
from django.core.exceptions import ValidationError
import random
from django.utils import timezone
from datetime import timedelta
import os

def farmer_id_upload_path(instance, filename):
    """
    Rename uploaded file to farmer_{user_id}_id.{ext}
    Stored in media/farmer_ids/
    Never trust the original filename.
    """
    ext = filename.rsplit('.', 1)[-1].lower()
    return f'farmer_ids/farmer_{instance.user_id}_id.{ext}'

def validate_id_card(file):
    """
    Security checks for uploaded ID card image.
    1. File size max 5MB
    2. Only jpg/jpeg/png allowed (by extension AND mimetype)
    """
    max_size = 5 * 1024 * 1024  # 5MB
    if file.size > max_size:
        raise ValidationError("File size must not exceed 5MB.")
    
    allowed_extensions = ['jpg', 'jpeg', 'png']
    ext = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''
    if ext not in allowed_extensions:
        raise ValidationError("Only JPG and PNG files are allowed.")


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User Model for AGRICE System
    """

    # 🔹 Basic Info
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    # 🔹 Unique Identifiers
    email = models.EmailField(unique=True,null=True, blank=True)  
    contact_number = models.CharField(max_length=11, unique=True)

    # 🔹 Role
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default='FARMER'
    )

    # 🔹 Location
    barangay = models.CharField(
        max_length=50,
        choices=BARANGAY_CHOICES,
        null=True,
        blank=True
    )

    # 🔹 Farmer-specific
    rsbsa_number = models.CharField(max_length=50, null=True, blank=True)

    # 🔹 Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # ✅ REQUIRED
    is_verified = models.BooleanField(default=False)

    STATUS_CHOICES = (
    ('PENDING', 'Pending'),
    ('APPROVED', 'Approved'),
    ('REJECTED', 'Rejected'),
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    password_reset_requested_at = models.DateTimeField(null=True, blank=True)
    
    # 🔹 Timestamps
    date_joined = models.DateTimeField(auto_now_add=True)

    # 🔹 Auth fields
    USERNAME_FIELD = 'contact_number'
    REQUIRED_FIELDS = ['first_name', 'last_name','email']

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.role}"

    def get_full_name(self):
        last_name = (self.last_name or '').strip()
        first_name = (self.first_name or '').strip()
        if last_name and first_name:
            return f"{last_name}, {first_name}"
        if last_name:
            return last_name
        if first_name:
            return first_name
        return self.contact_number
    
    def clean(self):
        # Require email for non-farmers
        if self.role in ['AT', 'BRGY', 'ADMIN'] and not self.email:
            raise ValidationError("Email is required")
    
        # Ensure contact number is 11 digits
        if self.contact_number and (len(self.contact_number) != 11 or not self.contact_number.isdigit()):
            raise ValidationError("Contact number must be 11 digits")
    
    def save(self, *args, **kwargs):
        self.full_clean()  # 👈 forces validation
        super().save(*args, **kwargs)
# -----------------------
# Farmer profile
class FarmerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')

    # 🔹 Name details
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    ext_name = models.CharField(max_length=50, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)

    # 🔹 Address / Location
    residency_municipality = models.CharField(max_length=100, blank=True, null=True)
    residency_barangay = models.CharField(max_length=100, blank=True, null=True)
    farm_municipality = models.CharField(max_length=100, blank=True, null=True)
    farm_barangay = models.CharField(max_length=100, blank=True, null=True)

    # 🔹 Demographics
    gender = models.CharField(max_length=10, blank=True, null=True)
    ip = models.BooleanField(default=False)  # Indigenous People
    senior_citizen = models.BooleanField(default=False)
    pwd = models.BooleanField(default=False)
    arbs = models.BooleanField(default=False)
    four_ps = models.BooleanField(default=False)
    hectares = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, help_text='Total farm hectares')  # Total farm hectares

    # 🔹 Deceased status 
    is_deceased = models.BooleanField(default=False, help_text='Marks farmer as deceased for record-keeping')
    date_deceased = models.DateField(blank=True, null=True, help_text='Date farmer was recorded as deceased')
    
    # 🔹 ID Card upload (NEW)
    id_card = models.ImageField(
        upload_to=farmer_id_upload_path,
        blank=True,
        null=True,
        validators=[validate_id_card]
    )

    # 🔹 Timestamp
    date_completed = models.DateTimeField(auto_now=True)

    def is_complete(self):
        """
        Returns True if farmer filled all required fields.
        Admin can only approve if this returns True.
        Required: dob, residency, farm location, gender, contact, hectares
        """
        return all([
            self.date_of_birth,
            self.residency_municipality,
            self.residency_barangay,
            self.farm_municipality,
            self.farm_barangay,
            self.gender,
            self.user.contact_number,
            self.hectares,  # Required: farmer must specify total hectares
        ])

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name} Profile"
    
# -----------------------
# Agricultural Technician profile
class AgriculturalTechnicianProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='at_profile')

    def get_assigned_barangays(self):
        """Returns list of barangay names assigned to this AT"""
        return list(self.barangays.values_list('name', flat=True))
    
    def __str__(self):
        brgy_list = ', '.join(self.get_assigned_barangays()) or 'None'
        return f"AT {self.user.first_name} {self.user.last_name} | Barangays: {brgy_list}"

class Barangay(models.Model):
    name = models.CharField(
        max_length=100,
        choices=BARANGAY_CHOICES,
        unique=True  # each barangay name only exists once in the DB
    )

    # ForeignKey to AT profile — SET_NULL if AT is deleted
    # null=True means barangay can be unassigned
    assigned_at = models.ForeignKey(
        AgriculturalTechnicianProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='barangays'  # access: at_profile.barangays.all()
    )

    class Meta:
        ordering = ['name']
        verbose_name = 'Barangay'
        verbose_name_plural = 'Barangays'

    def __str__(self):
        at_name = (
            f"{self.assigned_at.user.first_name} {self.assigned_at.user.last_name}"
            if self.assigned_at else "Unassigned"
        )
        return f"{self.name} → {at_name}"


# -----------------------
# Brgy President profile
class BrgyPresidentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='bp_profile')

    def __str__(self):
        return f"BP {self.user.first_name} {self.user.last_name} | {self.user.barangay or 'Unassigned'}"

# =========================
# 🔐 PASSWORD RESET OTP
# =========================
class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    # ✅ ADD THIS (fix error safely)
    is_used = models.BooleanField(default=False)

    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(minutes=5)
    

class FarmerMasterRecord(models.Model):
    """
    Pre-loaded MAO farmer registry.
    Admin uploads this data. Used to validate farmer registration.
    """
    rsbsa_number  = models.CharField(max_length=50, unique=True)
    first_name    = models.CharField(max_length=100)
    last_name     = models.CharField(max_length=100)
    middle_name   = models.CharField(max_length=100, blank=True, null=True)
    barangay      = models.CharField(max_length=50, choices=BARANGAY_CHOICES)
    date_of_birth = models.DateField(blank=True, null=True)
    contact_number = models.CharField(max_length=11, blank=True, null=True)
    hectares      = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    is_claimed    = models.BooleanField(default=False)  # True kapag nag-register na
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.rsbsa_number} — {self.last_name}, {self.first_name}"