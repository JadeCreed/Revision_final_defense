from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework import status

from .models import PasswordResetOTP
from .utils import generate_otp, send_otp_email
from django.db.models import Q


from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from .permissions import IsAdminUserRole,IsFarmer,IsVerifiedUser,IsATUser,IsBPUser
from .models import FarmerProfile,User,AgriculturalTechnicianProfile,BrgyPresidentProfile
from rest_framework import serializers 
from .serializers import (
    FarmerRegisterSerializer,
    FarmerProfileSerializer,
    AdminCreateUserSerializer,
    AdminCreateATSerializer,
    AdminCreateBPSerializer,
    AgriculturalTechnicianProfileSerializer,
    BrgyPresidentProfileSerializer,
    AdminUserSimpleSerializer
)

from django.contrib.auth import get_user_model

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
                    "error": "User not found"
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
                user = serializer.save() 
                
                return Response({
                    "message": "Farmer registered successfully. Wait for admin approval."
                }, status=status.HTTP_201_CREATED)

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
        profile, created = FarmerProfile.objects.get_or_create(user=request.user)
        serializer = FarmerProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        profile, created = FarmerProfile.objects.get_or_create(user=request.user)
        serializer = FarmerProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
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
            return Response({"message": "Profile updated successfully"})
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
    """
    📧 Step 1: Send OTP to email
    """
    

    def post(self, request):
        email = request.data.get("email")

        # 🔴 Check user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "Email not found"}, status=404)

        # 🔢 Generate OTP
        otp = generate_otp()

        # 💾 Save OTP
        PasswordResetOTP.objects.create(user=user, otp=otp)

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
                user=user, otp=otp
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
            return Response({"error": "User not found"}, status=404)

        # ── Re-verify OTP before allowing reset ──
        try:
            otp_obj = PasswordResetOTP.objects.filter(
                user=user, otp=otp
            ).latest('created_at')
        except PasswordResetOTP.DoesNotExist:
            return Response({"error": "Invalid OTP"}, status=400)

        if otp_obj.is_expired():
            return Response({"error": "OTP has expired. Please request a new one."}, status=400)

        # ── Reset password ──
        user.set_password(new_password)
        user.save()

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
        contact_number = request.data.get("contact_number")

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