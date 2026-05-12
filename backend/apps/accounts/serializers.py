from rest_framework import serializers
from .models import User,FarmerProfile,AgriculturalTechnicianProfile,BrgyPresidentProfile,Barangay,BARANGAY_CHOICES
from rest_framework.validators import UniqueValidator
# -----------------------
# Farmer registration (mobile self-register)
class FarmerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    # 🔹 Unique validator on contact number
    contact_number = serializers.CharField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="Contact number already exists"
            )
        ]
    )

    # 🔹 Optional email with unique validator
    email = serializers.EmailField(
        required=False,
        allow_blank=True,  # allows empty string
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="Email already exists"
            )
        ]
    )


    class Meta:
        model = User
        fields = [
            'first_name',
            'last_name',
            'contact_number',
            'barangay',
            'rsbsa_number',
            'email',
            'password',
            'confirm_password'
        ]
    
     # 🔐 Validate passwords
    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({
                "confirm_password": "Passwords do not match"
            })
        return data

    # 📱 Contact number validation
    def validate_contact_number(self, value):
        if not value.isdigit() or len(value) != 11:
            raise serializers.ValidationError("Contact number must be 11 digits")
        return value

    def create(self, validated_data):
        validated_data.pop('confirm_password')

        email = validated_data.get('email') or None

        user = User.objects.create_user(
            contact_number=validated_data['contact_number'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            barangay=validated_data['barangay'],
            rsbsa_number=validated_data['rsbsa_number'],
            email=email,
            role='FARMER',
            is_verified=False
        )
        FarmerProfile.objects.get_or_create(user=user)
        return user
    
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
    
class AdminCreateATSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    assigned_barangays = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=True
    )
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'contact_number', 'role', 'password', 'confirm_password', 'assigned_barangays']

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match")
        return data

    def validate_assigned_barangays(self, value):
        if not value:
            raise serializers.ValidationError("At least one barangay must be assigned")
        already_taken = Barangay.objects.filter(
            name__in=value,
            assigned_at__isnull=False
        ).values_list('name', flat=True)
        if already_taken:
            raise serializers.ValidationError(
                f"Already assigned to another AT: {', '.join(already_taken)}"
            )
        return value
    
    def create(self, validated_data):
        barangay_names = validated_data.pop('assigned_barangays')
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')

        user = User(**validated_data)
        user.set_password(password)
        user.is_verified = True
        user.role        = 'AT'
        user.save()

        at_profile = AgriculturalTechnicianProfile.objects.create(
            user=user,
            assigned_barangay=barangay_names[0] if barangay_names else ''
        )

        for name in barangay_names:
            barangay_obj, _ = Barangay.objects.get_or_create(name=name)
            barangay_obj.assigned_at = at_profile
            barangay_obj.save()

        return user


class AdminUpdateATAssignedBarangaysSerializer(serializers.Serializer):
    assigned_barangays = serializers.ListField(
        child=serializers.CharField(),
        required=True
    )

    def validate_assigned_barangays(self, value):
        if not value:
            raise serializers.ValidationError("At least one barangay must be assigned")
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Duplicate barangay names are not allowed")

        valid_names = [name for name, _ in BARANGAY_CHOICES]
        invalid = [name for name in value if name not in valid_names]
        if invalid:
            raise serializers.ValidationError(f"Invalid barangay name(s): {', '.join(invalid)}")
        return value

    def validate(self, data):
        user = self.context.get('user')
        if not user:
            raise serializers.ValidationError("AT user context is required")

        try:
            at_profile = user.at_profile
        except AgriculturalTechnicianProfile.DoesNotExist:
            raise serializers.ValidationError("AT profile not found")

        already_taken = Barangay.objects.filter(
            name__in=data['assigned_barangays'],
            assigned_at__isnull=False
        ).exclude(assigned_at=at_profile).values_list('name', flat=True)

        if already_taken:
            raise serializers.ValidationError({
                'assigned_barangays': f"Already assigned to another AT: {', '.join(already_taken)}"
            })

        return data


class AdminCreateBPSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'contact_number', 'role', 'barangay', 'password', 'confirm_password']

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match")
        if not data.get('barangay'):
            raise serializers.ValidationError({"barangay": "Barangay is required for BRGY role"})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')

        user = User(**validated_data)
        user.set_password(password)
        user.is_verified = True
        user.role        = 'BRGY'
        user.save()

        # Create BP profile (empty for now, can add fields later)
        BrgyPresidentProfile.objects.create(user=user, barangay=user.barangay)
        return user

class FarmerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmerProfile
        fields = '__all__'
        read_only_fields = ['user']  # link automatically to request.user

    def create(self, validated_data):
        # Pre-fill profile from User data if creating
        user = validated_data.get('user')
        if user:
            validated_data.setdefault('contact_number', user.contact_number)
            validated_data.setdefault('email', user.email)
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Allow partial update
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
    

class AgriculturalTechnicianProfileSerializer(serializers.ModelSerializer):
    assigned_barangays = serializers.SerializerMethodField()

    class Meta:
        model  = AgriculturalTechnicianProfile
        fields = ['id', 'user', 'assigned_barangays']
        read_only_fields = ['user']

    def get_assigned_barangays(self, obj):
        return list(obj.barangays.values_list('name', flat=True))

# -----------------------
# NEW: Barangay President Profile Serializer
class BrgyPresidentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrgyPresidentProfile
        fields = '__all__'
        read_only_fields = ['user']

class AdminUserSimpleSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'contact_number', 'email', 
            'role', 'password', 'confirm_password'
        ]

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match"})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user     = User(**validated_data)
        user.set_password(password)
        user.is_verified = True
        user.save()
        return user

class FarmerFullDetailSerializer(serializers.ModelSerializer):
    # Nested profile data — read/write
    profile = FarmerProfileSerializer(required=False)

    class Meta:
        model  = User
        fields = [
            'id', 'first_name', 'last_name', 'email',
            'contact_number', 'barangay', 'rsbsa_number',
            'status', 'is_verified', 'is_active', 'date_joined',
            'profile'  # nested FarmerProfile fields
        ]
        read_only_fields = ['id', 'date_joined']

    def update(self, instance, validated_data):
        # Extract nested profile data if provided
        profile_data = validated_data.pop('profile', {})

        # Update User fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update FarmerProfile fields
        if profile_data:
            profile, _ = FarmerProfile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return instance
    
class FarmerListSerializer(serializers.ModelSerializer):
    # Shows profile completion status
    profile_complete = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            'id', 'first_name', 'last_name', 'contact_number',
            'barangay', 'rsbsa_number', 'status',
            'is_verified', 'is_active', 'date_joined',
            'profile_complete'
        ]

    def get_profile_complete(self, obj):
        # Check if farmer has completed their full profile form
        try:
            return obj.profile.is_complete()
        except FarmerProfile.DoesNotExist:
            return False

class OfficialListSerializer(serializers.ModelSerializer):
    # For AT: show their assigned barangays as a list
    assigned_barangays = serializers.SerializerMethodField()
    # For BRGY: show their single barangay
    brgy_barangay = serializers.SerializerMethodField()
    password_reset_requested_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model  = User
        fields = [
            'id', 'first_name', 'last_name', 'email',
            'contact_number', 'role', 'is_active',
            'date_joined', 'assigned_barangays', 'brgy_barangay','password_reset_requested_at',
        ]

    def get_assigned_barangays(self, obj):
        # Only AT users have assigned barangays
        if obj.role == 'AT':
            try:
                return list(
                    obj.at_profile.barangays.values_list('name', flat=True)
                )
            except AgriculturalTechnicianProfile.DoesNotExist:
                return []
        return []

    def get_brgy_barangay(self, obj):
        # Only BRGY users have a single barangay
        if obj.role == 'BRGY':
            try:
                return obj.bp_profile.barangay
            except BrgyPresidentProfile.DoesNotExist:
                return None
        return None

class ArchiveUserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = [
            'id', 'first_name', 'last_name', 'contact_number',
            'email', 'role', 'barangay', 'date_joined', 'is_active'
        ]