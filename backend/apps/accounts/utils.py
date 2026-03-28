import random
from django.core.mail import send_mail
from django.conf import settings

# 🔢 Generate 6-digit OTP
def generate_otp():
    return str(random.randint(100000, 999999))


# 📧 Send OTP Email
def send_otp_email(user, otp):
    subject = "AGRICE Password Reset Code"

    message = f"""
    Hello {user.first_name},

    Your OTP code is: {otp}

    This will expire in 5 minutes.

    If you did not request this, ignore this message.
    """

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )