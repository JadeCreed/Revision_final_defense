from rest_framework import serializers
from .models import User,FarmerProfile,AgriculturalTechnicianProfile,BrgyPresidentProfile

# -----------------------
# Farmer registration (mobile self-register)
class FarmerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

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
    

    def validate(self, data):
        # Password match
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match")

        # Contact number length check
        if len(data['contact_number']) != 11:
            raise serializers.ValidationError("Contact number must be 11 digits")

        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')

        user = User.objects.create_user(
            contact_number=validated_data['contact_number'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            barangay=validated_data['barangay'],
            rsbsa_number=validated_data['rsbsa_number'],
            email=validated_data.get('email'),
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
    assigned_barangay = serializers.CharField(write_only=True)  # AT-specific

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'contact_number', 'role', 'password', 'confirm_password', 'assigned_barangay']

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match")
        return data

    def create(self, validated_data):
        assigned_barangay = validated_data.pop('assigned_barangay')
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')

        user = User(**validated_data)
        user.set_password(password)
        user.is_verified = True
        user.save()

        # Create AT profile
        AgriculturalTechnicianProfile.objects.create(user=user, assigned_barangay=assigned_barangay)
        return user


class AdminCreateBPSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'contact_number', 'role', 'barangay', 'password', 'confirm_password']

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match")
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')

        user = User(**validated_data)
        user.set_password(password)
        user.is_verified = True
        user.save()

        # Create BP profile (empty for now, can add fields later)
        BrgyPresidentProfile.objects.create(user=user)
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
    class Meta:
        model = AgriculturalTechnicianProfile
        fields = '__all__'
        read_only_fields = ['user']

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