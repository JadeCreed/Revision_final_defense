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
    AdminUpdateATAssignedBarangaysSerializer,
    AgriculturalTechnicianProfileSerializer,
    BrgyPresidentProfileSerializer,
    AdminUserSimpleSerializer
)

from django.contrib.auth import get_user_model

ALLOWED_ORDERING = ['date_joined', '-date_joined', 'last_name', '-last_name', 'first_name', '-first_name']


def normalize_contact_number(value):
    if not value:
        return ''
    digits = ''.join(ch for ch in str(value) if ch.isdigit())
    if len(digits) == 12 and digits.startswith('63'):
        digits = '0' + digits[2:]
    return digits


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

            if user is None or not user.check_password(password):
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
            access_token = str(refresh.access_token)

            response = Response({
                "access_token": access_token,
                "role": user.role,
                "is_verified": user.is_verified,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "message": "Login successful"
            })
            
            # 🍪 Set httpOnly cookie (secure token storage)
            response.set_cookie(
                key='access_token',
                value=access_token,
                httponly=True,
                secure=False,  # Set to True in production (HTTPS only)
                samesite='None',  # Required for cross-origin localhost dev
                max_age=3600  # 1 hour (matches JWT_ACCESS_TOKEN_LIFETIME)
            )

            return response

        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# 🔓 Logout View — Clears the httpOnly cookie
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        response = Response({
            "message": "Logged out successfully"
        })
        
        # 🍪 Clear the httpOnly cookie
        response.delete_cookie('access_token')
        
        return response


# ✅ Verify Token View — Check if user is authenticated
class VerifyTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET /api/accounts/verify-token/
        Returns user info if token is valid.
        Used by frontend on app load to restore auth state.
        """
        user = request.user
        return Response({
            "role": user.role,
            "is_verified": user.is_verified,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "user_id": user.id,
            "message": "Token is valid"
        }, status=200)

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
    permission_classes = [IsAuthenticated, IsFarmer]

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
                "status":        request.user.status,
            },
            "profile": serializer.data
        })


    def put(self, request):

        profile, _ = FarmerProfile.objects.get_or_create(user=request.user)
        user = request.user
        user_data = request.data.get("user", {})

        # ── UPDATE USER FIELDS ──
        # Use queryset.update() to bypass full_clean() / save() validation issues
        # full_clean() was causing silent failures on contact number uniqueness check
        user_update_fields = {}
        allowed_user_fields = ['first_name', 'last_name', 'email', 'contact_number', 'barangay', 'rsbsa_number']
        for field in allowed_user_fields:
            if field in user_data:
                user_update_fields[field] = user_data[field]

        if user_update_fields:
            User.objects.filter(pk=user.pk).update(**user_update_fields)
            # Refresh user object so status check below is accurate
            user.refresh_from_db()

        # ── UPDATE FARMER PROFILE ──
        profile_data = request.data.get("profile", {})
        serializer = FarmerProfileSerializer(profile, data=profile_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Reload profile to check completeness
            profile.refresh_from_db()

            # ── STATUS UPGRADE ──
            # If profile is now complete AND status is PENDING → set to COMPLETE
            # COMPLETE = admin can now review and approve
            user.refresh_from_db()
            if profile.is_complete():
                if user.status in ('PENDING', 'REJECTED'):
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
        email = request.data.get("email", "").strip()
        contact_number = normalize_contact_number(request.data.get("contact_number", ""))

        if not email and not contact_number:
            return Response({"error": "Please provide your registered email or contact number."}, status=400)

        user = None
        if email:
            user = User.objects.filter(email__iexact=email).first()
        if not user and contact_number:
            user = User.objects.filter(contact_number=contact_number).first()

        if user is None:
            return Response({"error": "Email or contact number not found."}, status=404)

        if not user.email:
            return Response({
                "error": "This account has no email on file. Please use the contact number reset option."
            }, status=400)

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
        identifier = request.data.get("email", "").strip()
        otp = request.data.get("otp")

        if not identifier or not otp:
            return Response({"error": "Invalid OTP"}, status=400)

        user = None
        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        if user is None:
            normalized_number = normalize_contact_number(identifier)
            if normalized_number:
                user = User.objects.filter(contact_number=normalized_number).first()

        if user is None:
            return Response({"error": "Invalid OTP"}, status=400)

        try:
            otp_obj = PasswordResetOTP.objects.filter(
                user=user,
                otp=otp,
                is_used=False  # ✅ prevent reuse
            ).latest('created_at')
        except Exception:
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
        identifier = request.data.get("email", "").strip()
        otp = request.data.get("otp")           # re-verify OTP for security
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        # ── Validate all fields present ──
        if not all([identifier, otp, new_password, confirm_password]):
            return Response({"error": "All fields are required"}, status=400)

        if new_password != confirm_password:
            return Response({"error": "Passwords do not match"}, status=400)

        if len(new_password) < 6:
            return Response({"error": "Password must be at least 6 characters"}, status=400)

        # ── Find user ──
        user = None
        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        if user is None:
            normalized_number = normalize_contact_number(identifier)
            if normalized_number:
                user = User.objects.filter(contact_number=normalized_number).first()

        if user is None:
            return Response({"error": "Invalid Credentials"}, status=404)

        # ── Re-verify OTP before allowing reset ─
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
        contact_number = normalize_contact_number(request.data.get("contact_number", ""))

        if not contact_number:
            return Response({"error": "Contact number is required"}, status=400)

        if len(contact_number) != 11:
            return Response({"error": "Enter a valid 11-digit contact number."}, status=400)

        user = User.objects.filter(contact_number=contact_number).first()

        if user is None:
            return Response({
                "error": "Contact number not found in our records. Please check and try again."
            }, status=404)

        User.objects.filter(pk=user.pk).update(password_reset_requested_at=timezone.now())

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
            password_reset_requested_at__isnull=False,
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

class AdminUpdateATAssignedBarangaysView(APIView):
    """
    PUT /admin/users/{id}/assigned-barangays/
    Update the barangays assigned to an AT account.
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def put(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role='AT')
        except User.DoesNotExist:
            return Response({"error": "AT user not found"}, status=404)

        try:
            at_profile = user.at_profile
        except AgriculturalTechnicianProfile.DoesNotExist:
            return Response({"error": "AT profile not found"}, status=404)

        serializer = AdminUpdateATAssignedBarangaysSerializer(data=request.data, context={'user': user})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        desired_barangays = serializer.validated_data['assigned_barangays']
        current_names = set(at_profile.barangays.values_list('name', flat=True))
        desired_names = set(desired_barangays)

        to_unassign = current_names - desired_names
        to_assign = desired_names - current_names

        if to_unassign:
            Barangay.objects.filter(name__in=list(to_unassign), assigned_at=at_profile).update(assigned_at=None)

        for name in desired_barangays:
            barangay_obj, _ = Barangay.objects.get_or_create(name=name)
            if barangay_obj.assigned_at_id != at_profile.id:
                barangay_obj.assigned_at = at_profile
                barangay_obj.save()

        at_profile.assigned_barangay = desired_barangays[0]
        at_profile.save()

        return Response({
            "message": "Assigned barangays updated",
            "assigned_barangays": desired_barangays
        })

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
            password_reset_requested_at__isnull=False,
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

        ordering = self.request.query_params.get('ordering', '-password_reset_requested_at')
        allowed  = [
            'password_reset_requested_at', '-password_reset_requested_at',
            'date_joined', '-date_joined',
            'last_name', '-last_name',
        ]
        if ordering not in allowed:
            ordering = '-password_reset_requested_at'
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
        user.password_reset_requested_at = None
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
        User.objects.filter(pk=user.pk).update(password_reset_requested=False,password_reset_requested_at=None)
        return Response({"message": f"Reset request for {user.first_name} {user.last_name} cancelled"})