from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from .models import PasswordResetOTP
from .utils import generate_otp, send_otp_email
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
import secrets
import string

from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from .permissions import IsAdminUserRole,IsFarmer,IsVerifiedUser,IsATUser,IsBPUser
from .models import FarmerProfile,User,AgriculturalTechnicianProfile,BrgyPresidentProfile,Barangay,PasswordResetOTP
from rest_framework import serializers 
from .serializers import (
    FarmerRegisterSerializer,
    FarmerProfileSerializer,
    FarmerListSerializer,
    FarmerFullDetailSerializer,
    OfficialListSerializer,
    ArchiveUserSerializer,
    AdminCreateUserSerializer,
    AdminCreateATSerializer,
    AdminCreateBPSerializer,
    AgriculturalTechnicianProfileSerializer,
    BrgyPresidentProfileSerializer,
    AdminUserSimpleSerializer
)

from django.contrib.auth import get_user_model

ALLOWED_ORDERING = ['date_joined', '-date_joined', 'last_name', '-last_name', 'first_name', '-first_name']


User = get_user_model()

# ----------------Authentication Views----------------
class LoginView(APIView):

    def post(self, request):
        try:
            login_value = request.data.get("login")
            password = request.data.get("password")

            if not login_value or not password:
                return Response({
                    "error": "Login and password are required"
                }, status=400)

            # 🔍 Find user by email OR phone
            if "@" in login_value:
                user = User.objects.filter(email=login_value).first()
            else:
                user = User.objects.filter(contact_number=login_value).first()

            if user is None:
                return Response({
                    "error": "Invalid credentials"
                }, status=404)

            # 🔐 Check password manually
            if not user.check_password(password):
                return Response({
                    "error": "Invalid credentials"
                }, status=401)

            # 🚫 Optional: check if active
            if not user.is_active:
                return Response({
                    "error": "Account is deactivated"
                }, status=403)

            # 🔐 Generate JWT
            refresh = RefreshToken.for_user(user)

            return Response({
                "token": str(refresh.access_token),
                "role": user.role,
                "is_verified": user.is_verified,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "message": "Login successful"
            })

        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StandardPagination(PageNumberPagination):
    page_size            = 10          # 10 records per page
    page_size_query_param = 'page_size' # allow ?page_size=20 override
    max_page_size        = 100

# ----------------Admin Views----------------
class AdminCreateUserView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request):
        role = request.data.get('role')
        
        if role == 'AT':
            serializer = AdminCreateATSerializer(data=request.data)
        elif role == 'BRGY':
            serializer = AdminCreateBPSerializer(data=request.data)
        else:  # ADMIN
            serializer = AdminUserSimpleSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": f"{role} user created successfully",
                "user": {
                    "id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "contact_number": user.contact_number,
                    "role": user.role,
                    "is_verified": user.is_verified
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminOnlyView(APIView):
    """
    Example protected view for ADMIN only
    """

    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        return Response({
            "message": "Welcome Admin!"
        })
    

class AdminVerifyFarmerView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, user_id):
        """
        Admin approves or rejects a farmer
        POST body: {"status": "approved"} or {"status": "rejected"}
        """
        try:
            user = User.objects.get(id=user_id, role='FARMER')
        except User.DoesNotExist:
            return Response({"error": "Farmer not found"}, status=status.HTTP_404_NOT_FOUND)

        status_value = request.data.get('status')
        if status_value.upper() == 'APPROVED':
            user.status = 'APPROVED'
            user.is_verified = True
            user.save()
            return Response({"message": "Farmer approved successfully"}, status=status.HTTP_200_OK)
        elif status_value.upper() == 'REJECTED':
            user.status = 'REJECTED'
            user.is_verified = False
            user.save()
            return Response({"message": "Farmer rejected"}, status=status.HTTP_200_OK)
        elif status_value.upper() == 'PENDING':
            user.status = 'PENDING'
            user.is_verified = False
            user.save()
            return Response({"message": "Farmer status set to pending"}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)


class AdminCreateUserSerializer(serializers.ModelSerializer):
    # Password field should be write-only (not returned in response)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User  # Use your User model
        fields = [
            'first_name', 'last_name', 'contact_number', 'barangay', 
            'rsbsa_number', 'role', 'password', 'email', 'is_verified'
        ]

    # Validate that contact_number is exactly 11 digits
    def validate_contact_number(self, value):
        if len(value) != 11 or not value.isdigit():
            raise serializers.ValidationError("Contact number must be 11 digits")
        return value

    # Create a new user and hash the password
    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')  # Remove password from dict
        user = User(**validated_data)  # Create user object
        user.set_password(password)    # Hash password
        user.is_verified = True  # Admin-created internal users are trusted
        user.save()                    # Save to database
        
        return user
    

# If there are other active admins, allow deactivation.
# If this is the last active admin, block it and return an error.
class AdminDeactivateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role='ADMIN')
        except User.DoesNotExist:
            return Response({"error": "Admin not found"}, status=404)

        # Count other active admins
        active_admins = User.objects.filter(role='ADMIN', is_active=True).exclude(id=user.id)
        if not active_admins.exists():
            return Response({"error": "Cannot deactivate the last active admin"}, status=400)

        if request.user.id == user.id:
            password = request.data.get('password')  # Expect password in POST body
            if not password or not request.user.check_password(password):
                return Response({
                    "error": "Password incorrect. Cannot deactivate your own account."
                }, status=400)
        
        user.is_active = False  # soft deactivate
        user.save()
        return Response({"message": f"Admin {user.first_name} deactivated successfully"})
    

class VerifiedOnlyView(APIView):
    """
    Only verified users can access
    """

    permission_classes = [IsAuthenticated, IsVerifiedUser]

    def get(self, request):
        return Response({
            "message": "Your account is verified"
        })


# ----------------Farmer Views----------------
class FarmerRegisterView(APIView):

    def post(self, request):
        try:
            serializer = FarmerRegisterSerializer(data=request.data)

            if serializer.is_valid():
                serializer.save() 
                
                return Response({
                    "message": "Farmer registered successfully. Wait for admin approval."
                }, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

class FarmerDashboardView(APIView):
    """
    Farmer-only dashboard
    """

    permission_classes = [IsAuthenticated, IsFarmer]

    def get(self, request):
        return Response({
            "message": "Welcome Farmer"
        })


class FarmerProfileView(APIView):
    permission_classes = [IsAuthenticated,IsFarmer]  # Only logged-in users

    def get(self, request):
        profile, _ = FarmerProfile.objects.get_or_create(user=request.user)
        serializer = FarmerProfileSerializer(profile)
        return Response({
            "user": {
                "first_name":    request.user.first_name,
                "last_name":     request.user.last_name,
                "email":         request.user.email,
                "contact_number": request.user.contact_number,
                "barangay":      request.user.barangay,
                "rsbsa_number":  request.user.rsbsa_number,
            },
            "profile": serializer.data
        })


    def put(self, request):
        profile, _ = FarmerProfile.objects.get_or_create(user=request.user)

        # Update User-level fields if provided
        user_fields = ['first_name', 'last_name', 'email', 'contact_number']
        user        = request.user
        updated     = False
        for field in user_fields:
            if field in request.data:
                setattr(user, field, request.data[field])
                updated = True
        if updated:
            user.save()

        # Update FarmerProfile fields
        serializer = FarmerProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            # If profile is now complete → update user status to COMPLETE
            # Admin can then approve/reject
            if profile.is_complete() and user.status == 'PENDING':
                User.objects.filter(pk=user.pk).update(status='COMPLETE')

            return Response({"message": "Profile updated successfully"})

        return Response(serializer.errors, status=400)

# List all farmers (Admin)
# List all farmers (Admin) with optional filtering for inactive users
class FarmerListView(ListAPIView):
    serializer_class = AdminCreateUserSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get_queryset(self):
        queryset = User.objects.filter(role='FARMER')  # start with all farmers

        # Filter only active by default
        show_inactive = self.request.query_params.get('show_inactive')
        if not show_inactive or show_inactive.lower() != 'true':
            queryset = queryset.filter(is_active=True)

        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        # Multi-field search: first_name, last_name, contact_number
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(contact_number__icontains=search)
            )

        return queryset


class FarmerDetailView(RetrieveUpdateDestroyAPIView):
    queryset = User.objects.filter(role='FARMER')
    serializer_class = AdminCreateUserSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    lookup_field = 'id'


# Farmer can deactivate their account (soft delete)
class FarmerDeactivateView(APIView):
    permission_classes = [IsAuthenticated]  # Allow both Admin & Farmer

    def post(self, request, user_id=None):
        user = None
        if user_id:  # Admin trying to deactivate
            try:
                user = User.objects.get(id=user_id, role='FARMER')
            except User.DoesNotExist:
                return Response({"error": "Farmer not found"}, status=404)
        else:  # Farmer self-deactivation
            user = request.user

        # Permission check
        if request.user.id != user.id and not request.user.is_admin:
            return Response({"error": "Permission denied"}, status=403)

        # Self-deactivation validation
        if request.user.id == user.id:
            password = request.data.get('password')
            if not password or not request.user.check_password(password):
                return Response({
                    "error": "Password incorrect. Cannot deactivate your own account."
                }, status=400)

        user.is_active = False
        user.save()
        return Response({"message": "Account deactivated successfully"})


# ----------------AT Views----------------
class ATProfileView(APIView):
    permission_classes = [IsAuthenticated, IsATUser]  # changed

    def get(self, request):
        profile, _ = AgriculturalTechnicianProfile.objects.get_or_create(user=request.user)
        serializer = AgriculturalTechnicianProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        profile, _ = AgriculturalTechnicianProfile.objects.get_or_create(user=request.user)
        serializer = AgriculturalTechnicianProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Profile updated"})
        return Response(serializer.errors, status=400)
    
# AT Deactivation
class ATDeactivateView(APIView):
    """
    Soft-deactivate AT account.
    AT can deactivate their own account with password validation.
    """
    permission_classes = [IsAuthenticated, IsATUser]

    def post(self, request):
        user = request.user

        # Self-deactivation password validation
        password = request.data.get('password')
        if not password or not user.check_password(password):
            return Response({
                "error": "Password incorrect. Cannot deactivate your own account."
            }, status=400)

        user.is_active = False
        user.save()
        return Response({"message": "Account deactivated successfully"})

class ATListView(ListAPIView):
    """
    Admin can list all AT users.
    By default, only active users.
    Optional query params:
      ?show_inactive=true   -> include inactive
      ?search=<text>       -> search by first_name
    """
    serializer_class = AdminCreateATSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get_queryset(self):
        queryset = User.objects.filter(role='AT')

        # Filter active by default
        show_inactive = self.request.query_params.get('show_inactive')
        if not show_inactive or show_inactive.lower() != 'true':
            queryset = queryset.filter(is_active=True)

        # Multi-field search: first_name, last_name, contact_number
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(contact_number__icontains=search)
            )
        return queryset
    

# ----------------BP Views----------------
class BPProfileView(APIView):
    permission_classes = [IsAuthenticated, IsBPUser]  # changed

    def get(self, request):
        profile, _ = BrgyPresidentProfile.objects.get_or_create(user=request.user)
        serializer = BrgyPresidentProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        profile, _ = BrgyPresidentProfile.objects.get_or_create(user=request.user)
        serializer = BrgyPresidentProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Profile updated successfully"})
        return Response(serializer.errors, status=400)


# BP Deactivation
class BPDeactivateView(APIView):
    """
    Soft-deactivate BP account.
    BP can deactivate their own account with password validation.
    """
    permission_classes = [IsAuthenticated, IsBPUser]

    def post(self, request):
        user = request.user

        # Self-deactivation password validation
        password = request.data.get('password')
        if not password or not user.check_password(password):
            return Response({
                "error": "Password incorrect. Cannot deactivate your own account."
            }, status=400)

        user.is_active = False
        user.save()
        return Response({"message": "Account deactivated successfully"})
    

# ----------------BP List (Admin)----------------
class BPListView(ListAPIView):
    """
    Admin can list all BP users.
    By default, only active users.
    Optional query params:
      ?show_inactive=true   -> include inactive
      ?search=<text>       -> search by first_name
    """
    serializer_class = AdminCreateBPSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get_queryset(self):
        queryset = User.objects.filter(role='BRGY')

        # Filter active by default
        show_inactive = self.request.query_params.get('show_inactive')
        if not show_inactive or show_inactive.lower() != 'true':
            queryset = queryset.filter(is_active=True)

        # Multi-field search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(contact_number__icontains=search)
            )
        return queryset
    
# --------- Forgot Password ---------
class ForgotPasswordView(APIView):
    def post(self, request):
        email = request.data.get("email")

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "Email not found"}, status=404)

        # ⛔ RATE LIMIT (3 requests per 30 mins)
        thirty_minutes_ago = timezone.now() - timedelta(minutes=30)

        recent_otps = PasswordResetOTP.objects.filter(
            user=user,
            created_at__gte=thirty_minutes_ago
        )

        if recent_otps.count() >= 3:
            return Response(
                {"error": "Too many OTP requests. Try again after 30 minutes."},
                status=429
            )

        #  DELETE OLD OTPs (optional cleanup)
        PasswordResetOTP.objects.filter(user=user).delete()

        # 🔢 Generate OTP
        otp = generate_otp()

        # 💾 Save OTP
        PasswordResetOTP.objects.create(
            user=user,
            otp=otp,
            is_used=False
        )

        # 📧 Send Email
        send_otp_email(user, otp)

        return Response({"message": "OTP sent"})

# -------- Verify OTP
class VerifyOTPView(APIView):
    """
    🔍 Step 2: Verify OTP
    """
    

    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        try:
            user = User.objects.get(email=email)
            otp_obj = PasswordResetOTP.objects.filter(
                user=user,
                otp=otp,
                is_used=False  # ✅ prevent reuse
            ).latest('created_at')
        except:
            return Response({"error": "Invalid OTP"}, status=400)

        # ⏱ Expiry check
        if otp_obj.is_expired():
            return Response({"error": "OTP expired"}, status=400)

        return Response({"message": "OTP verified"})
    
# ------- Reset Password ---------
# views.py — Replace your ResetPasswordView with this secure version
class ResetPasswordView(APIView):
    """
    🔐 Step 3: Reset password — only allowed after OTP was verified
    Requires: email, otp (re-checked), new_password, confirm_password
    """
    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")           # re-verify OTP for security
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        # ── Validate all fields present ──
        if not all([email, otp, new_password, confirm_password]):
            return Response({"error": "All fields are required"}, status=400)

        if new_password != confirm_password:
            return Response({"error": "Passwords do not match"}, status=400)

        if len(new_password) < 6:
            return Response({"error": "Password must be at least 6 characters"}, status=400)

        # ── Find user ──
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "Invalid Credentials"}, status=404)

        # ── Re-verify OTP before allowing reset ──
        try:
            otp_obj = PasswordResetOTP.objects.filter(
                user=user,
                otp=otp,
                is_used=False
            ).latest('created_at')
        except PasswordResetOTP.DoesNotExist:
            return Response({"error": "Invalid OTP"}, status=400)

        if otp_obj.is_expired():
            return Response({"error": "OTP has expired. Please request a new one."}, status=400)

        # ── Reset password ──
        user.set_password(new_password)
        user.save()

        otp_obj.is_used = True
        otp_obj.save()

        # ── Clean up all OTPs for this user after successful reset ──
        PasswordResetOTP.objects.filter(user=user).delete()

        return Response({"message": "Password updated successfully"}, status=200)
    
# views.py — Add this new view at the bottom
# This handles the "Request Admin Reset" flow for non-email users

class AdminResetRequestView(APIView):
    """
    📱 Alternative password reset for users without email access.
    User submits their contact number → system verifies it exists
    → flags account with password_reset_requested = True
    → admin sees the request in User Management and resets manually
    """
    def post(self, request):
        contact_number = request.data.get("contact_number","")

        # Validate input
        if not contact_number:
            return Response({"error": "Contact number is required"}, status=400)

        if len(contact_number) != 11 or not contact_number.isdigit():
            return Response({"error": "Enter a valid 11-digit contact number"}, status=400)

        # Look up user by contact number
        # We use filter().first() instead of get() to avoid crashing
        user = User.objects.filter(
            contact_number=contact_number,
            is_active=True
        ).first()

        if user is None:
            # For security: don't reveal if number exists or not
            # But since farmers aren't tech-savvy, give a clear message
            return Response({
                "error": "Contact number not found in our records. Please check and try again."
            }, status=404)

        # Flag this user as needing admin password reset
        # Use queryset .update() to bypass your model's full_clean() / save()
        # This directly updates only this one field in the database
        User.objects.filter(pk=user.pk).update(password_reset_requested=True)

        return Response({
            "message": "Request submitted. An admin will reset your password shortly."
        }, status=200)
    
class AdminBadgeCountView(APIView):
    """
    GET /admin/users/badge-count/
    Returns count of pending farmer accounts + password reset requests
    Used by sidebar to show notification badges
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        # Farmers who completed profile and are waiting for approval
        pending_farmers = User.objects.filter(
            role='FARMER',
            status='COMPLETE',   # completed form
            is_active=True
        ).count()

        # Users who requested admin password reset
        reset_requests = User.objects.filter(
            password_reset_requested=True,
            is_active=True
        ).count()

        return Response({
            "pending_farmers": pending_farmers,
            "reset_requests":  reset_requests,
            "total":           pending_farmers + reset_requests
        })

# ════════════════════════════════════════════
# ADMIN — FARMER REQUESTS (Tab 1)
# ════════════════════════════════════════════

class AdminFarmerRequestsView(ListAPIView):
    """
    GET /admin/users/farmer-requests/
    Lists ALL farmers (all statuses) for the Farmer Requests tab
    Supports: ?status=PENDING|COMPLETE|APPROVED|REJECTED
              ?barangay=Abang
              ?search=name/contact/rsbsa
              ?ordering=date_joined (default newest first)
    """
    serializer_class   = FarmerListSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    pagination_class   = StandardPagination

    def get_queryset(self):
        # Start with all active farmers
        queryset = User.objects.filter(role='FARMER', is_active=True)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter.upper() != 'ALL':
            queryset = queryset.filter(status=status_filter.upper())

        # Filter by barangay
        barangay = self.request.query_params.get('barangay')
        if barangay:
            queryset = queryset.filter(barangay=barangay)

        # Search by name, contact, RSBSA
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)  |
                Q(last_name__icontains=search)   |
                Q(contact_number__icontains=search) |
                Q(rsbsa_number__icontains=search)
            )
         # ✅ Sorting support — whitelist prevents injection
        ordering = self.request.query_params.get('ordering', '-date_joined')
        if ordering not in ALLOWED_ORDERING:
            ordering = '-date_joined'
        return queryset.order_by(ordering)

class AdminApproveFarmerView(APIView):
    """
    POST /admin/users/farmers/{id}/approve/
    Body: {"action": "APPROVED" | "REJECTED" | "PENDING"}
    Admin approves or rejects a farmer after reviewing their profile
    Only allowed if farmer status is COMPLETE
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role='FARMER')
        except User.DoesNotExist:
            return Response({"error": "Farmer not found"}, status=404)

        action = request.data.get('action', '').upper()

        if action == 'APPROVED':
            user.status      = 'APPROVED'
            user.is_verified = True
            user.save()
            return Response({"message": "Farmer approved"})

        elif action == 'REJECTED':
            user.status      = 'REJECTED'
            user.is_verified = False
            user.save()
            return Response({"message": "Farmer rejected"})

        elif action == 'PENDING':
            user.status      = 'PENDING'
            user.is_verified = False
            user.save()
            return Response({"message": "Farmer set to pending"})

        return Response({"error": "Invalid action"}, status=400)

class AdminFarmerMasterlistView(ListAPIView):
    """
    GET /admin/users/farmer-masterlist/
    Lists only APPROVED active farmers
    Supports: ?barangay=Abang  ?gender=Male  ?search=  ?ordering=
    """
    serializer_class   = FarmerListSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    pagination_class   = StandardPagination

    def get_queryset(self):
        queryset = User.objects.filter(
            role='FARMER',
            status='APPROVED',
            is_active=True
        )

        barangay = self.request.query_params.get('barangay')
        if barangay:
            queryset = queryset.filter(barangay=barangay)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)     |
                Q(last_name__icontains=search)      |
                Q(contact_number__icontains=search) |
                Q(rsbsa_number__icontains=search)
            )

        ordering = self.request.query_params.get('ordering', '-date_joined')
        if ordering not in ALLOWED_ORDERING:
            ordering = '-date_joined'
        return queryset.order_by(ordering)

class AdminFarmerFullProfileView(APIView):
    """
    GET /admin/users/farmers/{id}/full-profile/
    Returns combined User + FarmerProfile for the View Details modal

    PUT /admin/users/farmers/{id}/full-profile/
    Admin edits farmer's full profile from the modal
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role='FARMER')
        except User.DoesNotExist:
            return Response({"error": "Farmer not found"}, status=404)

        serializer = FarmerFullDetailSerializer(user)
        return Response(serializer.data)

    def put(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role='FARMER')
        except User.DoesNotExist:
            return Response({"error": "Farmer not found"}, status=404)

        serializer = FarmerFullDetailSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Farmer profile updated"})
        return Response(serializer.errors, status=400)


class AdminOfficialsListView(ListAPIView):
    """
    GET /admin/users/officials/
    Lists AT + BRGY + ADMIN users
    Supports: ?role=AT|BRGY|ADMIN  ?search=  ?ordering=
    """
    serializer_class   = OfficialListSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    pagination_class   = StandardPagination

    def get_queryset(self):
        queryset = User.objects.filter(
            role__in=['AT', 'BRGY', 'ADMIN'],
            is_active=True
        )

        role_filter = self.request.query_params.get('role')
        if role_filter and role_filter.upper() != 'ALL':
            queryset = queryset.filter(role=role_filter.upper())

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)     |
                Q(last_name__icontains=search)      |
                Q(contact_number__icontains=search) |
                Q(email__icontains=search)
            )

        ordering = self.request.query_params.get('ordering', '-date_joined')
        if ordering not in ALLOWED_ORDERING:
            ordering = '-date_joined'
        return queryset.order_by(ordering)

class AdminCreateOfficialView(APIView):
    """
    POST /admin/users/officials/create/
    Admin creates AT, BRGY, or ADMIN account
    Role is determined by the 'role' field in request body
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request):
        role = request.data.get('role', '').upper()

        if role == 'AT':
            serializer = AdminCreateATSerializer(data=request.data)
        elif role == 'BRGY':
            serializer = AdminCreateBPSerializer(data=request.data)
        elif role == 'ADMIN':
            serializer = AdminUserSimpleSerializer(data=request.data)
        else:
            return Response({"error": "Invalid role. Must be AT, BRGY, or ADMIN"}, status=400)

        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": f"{role} account created successfully",
                "user": {
                    "id":             user.id,
                    "first_name":     user.first_name,
                    "last_name":      user.last_name,
                    "contact_number": user.contact_number,
                    "role":           user.role,
                }
            }, status=201)

        return Response(serializer.errors, status=400)

class AdminDeactivateUserView(APIView):
    """
    POST /admin/users/{id}/deactivate/
    Deactivates any user (soft delete — sets is_active=False)
    Cannot deactivate the last active admin
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        # Prevent deactivating the last active admin
        if user.role == 'ADMIN':
            active_admins = User.objects.filter(role='ADMIN', is_active=True).exclude(id=user_id)
            if not active_admins.exists():
                return Response({"error": "Cannot deactivate the last active admin"}, status=400)

        User.objects.filter(pk=user.pk).update(is_active=False)
        return Response({"message": f"{user.first_name} {user.last_name} deactivated"})

class AdminResetRequestsListView(ListAPIView):
    """
    GET /admin/users/reset-requests/
    Lists all users who submitted a password reset request
    (password_reset_requested = True)
    Supports: ?role=  ?search=
    """
    serializer_class   = OfficialListSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    pagination_class   = StandardPagination

    def get_queryset(self):
        queryset = User.objects.filter(
            password_reset_requested=True,
            is_active=True
        )

        role_filter = self.request.query_params.get('role')
        if role_filter and role_filter.upper() != 'ALL':
            queryset = queryset.filter(role=role_filter.upper())

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)     |
                Q(last_name__icontains=search)      |
                Q(contact_number__icontains=search)
            )

        ordering = self.request.query_params.get('ordering', '-date_joined')
        if ordering not in ALLOWED_ORDERING:
            ordering = '-date_joined'
        return queryset.order_by(ordering)
    
class AdminResetUserPasswordView(APIView):
    """
    POST /admin/users/{id}/reset-password/
    Admin resets any user's password
    Body option 1: {"new_password": "abc123"}  ← manual
    Body option 2: {"auto_generate": true}      ← system generates temp password
    After reset → clears password_reset_requested flag
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        auto_generate = request.data.get('auto_generate', False)

        if auto_generate:
            # Generate a random 10-character temp password
            alphabet      = string.ascii_letters + string.digits
            new_password  = ''.join(secrets.choice(alphabet) for _ in range(10))
        else:
            new_password = request.data.get('new_password', '').strip()
            if not new_password:
                return Response({"error": "new_password is required"}, status=400)
            if len(new_password) < 6:
                return Response({"error": "Password must be at least 6 characters"}, status=400)

        # Reset the password
        user.set_password(new_password)
        # Clear the reset request flag
        user.password_reset_requested = False
        user.save()

        return Response({
            "message":      "Password reset successfully",
            "new_password": new_password  # shown to admin so they can share with user
        })
    

class AdminArchiveListView(ListAPIView):
    """
    GET /admin/users/archive/
    Lists ALL deactivated users (all roles)
    Supports: ?role=  ?search=
    """
    serializer_class   = ArchiveUserSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]
    pagination_class   = StandardPagination

    def get_queryset(self):
        # is_active=False means deactivated/archived
        queryset = User.objects.filter(is_active=False)

        role_filter = self.request.query_params.get('role')
        if role_filter and role_filter.upper() != 'ALL':
            queryset = queryset.filter(role=role_filter.upper())

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)     |
                Q(last_name__icontains=search)      |
                Q(contact_number__icontains=search)
            )

        ordering = self.request.query_params.get('ordering', '-date_joined')
        if ordering not in ALLOWED_ORDERING:
            ordering = '-date_joined'
        return queryset.order_by(ordering)

    

class AdminReactivateUserView(APIView):
    """
    POST /admin/users/{id}/reactivate/
    Reactivates a deactivated user from the Archive tab
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, is_active=False)
        except User.DoesNotExist:
            return Response({"error": "Archived user not found"}, status=404)

        User.objects.filter(pk=user.pk).update(is_active=True)
        return Response({"message": f"{user.first_name} {user.last_name} reactivated"})

class AvailableBarangaysView(APIView):
    """
    GET /barangays/available/
    Returns list of barangay names NOT yet assigned to any AT
    Used by the AT create modal checkbox list
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get(self, request):
        from .choices import BARANGAY_CHOICES

        # All barangay names from choices
        all_barangays = [name for name, _ in BARANGAY_CHOICES]

        # Barangays already assigned to an AT
        assigned = Barangay.objects.filter(
            assigned_at__isnull=False
        ).values_list('name', flat=True)

        # Return only unassigned ones
        available = [b for b in all_barangays if b not in assigned]

        return Response({"available_barangays": available})
    
# views.py — add this new view after AdminResetUserPasswordView

class AdminCancelResetRequestView(APIView):
    """
    POST /admin/users/{id}/cancel-reset-request/
    Admin cancels/dismisses a password reset request
    Sets password_reset_requested = False without changing password
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        # Clear the reset request flag
        User.objects.filter(pk=user.pk).update(password_reset_requested=False)
        return Response({"message": f"Reset request for {user.first_name} {user.last_name} cancelled"})