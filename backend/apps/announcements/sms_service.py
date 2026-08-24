import requests
import time
from django.conf import settings
from django.db.models import Q


def normalize_phone(phone_number):
    """Same normalization logic as send_otp_sms() sa accounts/utils.py."""
    if not phone_number:
        return None
    if phone_number.startswith("09"):
        return "+63" + phone_number[1:]
    elif phone_number.startswith("639"):
        return "+" + phone_number
    return phone_number


def send_sms_batch(phone_numbers, message):
    """
    Reuses SMSGATE config mula sa base.py. Hindi ginagalaw ang send_otp_sms().
    Ipinapadala ISA-ISA na may delay sa pagitan (throttled), hindi bulk array,
    para maiwasan ang carrier spam-block. Tandaan: limitahan ang testing sa
    2-5 numero lang habang undergraduate capstone scope pa ito.
    """
    if not phone_numbers:
        return None

    results = {"sent": [], "failed": []}
    for i, number in enumerate(phone_numbers):
        payload = {
            "textMessage": {"text": message},
            "deviceId": settings.SMSGATE_DEVICE_ID,
            "phoneNumbers": [number],
        }
        try:
            response = requests.post(
                settings.SMSGATE_API_URL,
                auth=(settings.SMSGATE_USERNAME, settings.SMSGATE_PASSWORD),
                json=payload,
                timeout=15,
            )
            response.raise_for_status()
            results["sent"].append(number)
        except Exception as e:
            results["failed"].append({"number": number, "error": str(e)})

        # Huwag mag-sleep pagkatapos ng huling numero
        if i < len(phone_numbers) - 1:
            time.sleep(4)

    return results


def get_matching_farmers(delivery, barangay=None):
    """
    Reuses yung parehong query pattern sa _compute_delivered_allocations_for_announcement()
    at brgy_beneficiary_allocation_view() — pero nagre-return ng farmer objects
    (may contact_number), hindi lang aggregate counts.
    """
    from apps.distribution.models import DistributionBatch

    seed_type = delivery.seed_type
    if not seed_type:
        return []

    batches_qs = DistributionBatch.objects.filter(
        status='APPROVED',
        event__season=delivery.season,
        event__year=delivery.year,
        event__seed_type=seed_type,
    ).prefetch_related('entries__farmer')

    if barangay:
        batches_qs = batches_qs.filter(event__barangay=barangay)

    if delivery.variety:
        batches_qs = batches_qs.filter(
            Q(event__variety=delivery.variety) | Q(entries__variety=delivery.variety)
        ).distinct()

    farmers = {}
    for batch in batches_qs:
        for entry in batch.entries.all():
            if delivery.variety_id and entry.variety_id and str(entry.variety_id) != str(delivery.variety_id):
                continue
            farmer = entry.farmer
            if not farmer or not farmer.contact_number:
                continue
            farmers[farmer.id] = farmer

    return list(farmers.values())


def auto_sms_delivered(delivery, user):
    """Trigger 1 — tinatawag lang mula sa perform_update/perform_create ng SeedDeliveryDetailView/ListCreateView."""
    try:
        farmers = get_matching_farmers(delivery)
        numbers = [normalize_phone(f.contact_number) for f in farmers if f.contact_number]
        if not numbers:
            return
        variety_label = f" ({delivery.variety.name})" if delivery.variety else ''
        message = (
            f"AGRICE: Dumating na po ang {delivery.seed_type.name}{variety_label} sa Munisipyo. "
            f"Mangyaring maghintay ng schedule mula sa inyong Barangay President."
        )
        send_sms_batch(numbers, message)
    except Exception:
        pass