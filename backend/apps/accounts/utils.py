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
import logging
import random
import requests
from django.core.mail import send_mail
from django.conf import settings
from apps.seed_poll.utils import is_encoding_allowed


logger = logging.getLogger(__name__)


def log_action(
    actor,
    action,
    module,
    status='SUCCESS',
    activity_type='SYSTEM_ACTIVITY',
    target=None,
    target_repr='',
    description='',
    metadata=None,
    request=None,
):
    """
    Create a centralized audit trail record.

    Additive only — does not change the behavior of the
    business operation that calls it.

    If the audit write itself fails for any reason, the failure is
    logged and swallowed here rather than raised, so a broken audit
    record can never break the calling operation (e.g. registration,
    login, admin actions). Returns the created AuditLog instance on
    success, or None if the write failed.
    """
    try:
        from .models import AuditLog

        actor_name = ''
        actor_role = ''
        actor_role = ''

        if actor is not None:
            first_name = getattr(actor, 'first_name', '') or ''
            last_name = getattr(actor, 'last_name', '') or ''
            actor_name = f'{first_name} {last_name}'.strip()

            if not actor_name:
                actor_name = getattr(actor, 'contact_number', '') or ''

            actor_role = getattr(actor, 'role', '') or ''

        target_type = ''
        target_id = None

        if target is not None:
            target_type = target.__class__.__name__
            target_id = getattr(target, 'id', None)

        ip_address = None

        if request is not None:
            forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')

            if forwarded_for:
                ip_address = forwarded_for.split(',')[0].strip()
            else:
                ip_address = request.META.get('REMOTE_ADDR')

        return AuditLog.objects.create(
            actor=actor,
            actor_name=actor_name,
            actor_role=actor_role,
            action=action,
            module=module,
            activity_type=activity_type,
            status=status,
            target_type=target_type,
            target_id=target_id,
            target_repr=target_repr,
            description=description,
            metadata=metadata if metadata is not None else {},
            ip_address=ip_address,
        )
    except Exception:
        logger.exception(
            "log_action failed: action=%s module=%s activity_type=%s",
            action, module, activity_type,
        )
        return None

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

def is_official_management_allowed():
    """
    Returns True when Admin is allowed to manage
    AT/BRGY official accounts and their barangay assignments.

    Official management is blocked once the latest seed poll
    is CLOSED and FinalSeed has been finalized.
    """
    return not is_encoding_allowed()

