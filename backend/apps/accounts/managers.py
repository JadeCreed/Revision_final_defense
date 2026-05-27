# accounts/managers.py

from django.contrib.auth.base_user import BaseUserManager


class CustomUserManager(BaseUserManager):

    def create_user(self, contact_number, password=None, **extra_fields):
        # 🔴 REQUIRED FIELD CHECK
        if not contact_number:
            raise ValueError("Contact number is required")

        # 🟡 OPTIONAL: Normalize email if provided
        email = extra_fields.get('email')
        if email:
            extra_fields['email'] = self.normalize_email(email)

        # ✅ CREATE USER INSTANCE
        user = self.model(contact_number=contact_number, **extra_fields)

        # 🔐 HASH PASSWORD
        user.set_password(password)

        # 💾 SAVE USER
        user.save(using=self._db)

        return user

    def create_superuser(self, contact_number, password=None, **extra_fields):
        """
        Create and return a superuser (admin)
        """

        # ✅ FORCE REQUIRED ADMIN FIELDS
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')
        extra_fields.setdefault('is_verified', True)

        # 🔴 VALIDATION (VERY IMPORTANT)
        if extra_fields.get('is_staff') is not True:
            raise ValueError("Superuser must have is_staff=True")

        if extra_fields.get('is_superuser') is not True:
            raise ValueError("Superuser must have is_superuser=True")

        if extra_fields.get('is_verified') is not True:
            raise ValueError("Superuser must have is_verified=True")

        # ✅ CREATE SUPERUSER
        return self.create_user(contact_number, password, **extra_fields)