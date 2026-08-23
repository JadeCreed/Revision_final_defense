# import random
# from django.core.mail import send_mail
# from django.conf import settings

# # 🔢 Generate 6-digit OTP
# def generate_otp():
#     return str(random.randint(100000, 999999))


# # 📧 Send OTP Email
# def send_otp_email(user, otp):
#     subject = "AGRICE Password Reset Code"

#     message = f"""
#     Hello {user.first_name},

#     Your OTP code is: {otp}

#     This will expire in 5 minutes.

#     If you did not request this, ignore this message.
#     """

#     send_mail(
#         subject,
#         message,
#         settings.DEFAULT_FROM_EMAIL,
#         [user.email],
#         fail_silently=False,
#     )

import random
import requests
from django.core.mail import send_mail
from django.conf import settings

def generate_otp():
    return str(random.randint(100000, 999999))


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


def send_otp_sms(user, otp):
    phone_number = user.contact_number

    if not phone_number:
        raise ValueError("User does not have a contact number.")

    if phone_number.startswith("09"):
        phone_number = "+63" + phone_number[1:]
    elif phone_number.startswith("639"):
        phone_number = "+" + phone_number

    payload = {
        "textMessage": {
            "text": (
                f"AGRICE Password Reset Code: {otp}\n\n"
                "This code will expire in 5 minutes."
            )
        },
        "deviceId": settings.SMSGATE_DEVICE_ID,
        "phoneNumbers": [phone_number],
    }

    response = requests.post(
        settings.SMSGATE_API_URL,
        auth=(settings.SMSGATE_USERNAME, settings.SMSGATE_PASSWORD),
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()