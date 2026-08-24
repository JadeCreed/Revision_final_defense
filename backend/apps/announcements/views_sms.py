from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from apps.accounts.permissions import IsBPUser
from .sms_service import get_matching_farmers, normalize_phone, send_sms_batch


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsBPUser])
def send_distribution_schedule_sms_view(request):
    """Trigger 2 — tinatawag ng AnnouncementDetail.jsx pagkatapos ng successful createAnnouncement()."""
    from apps.seed_inventory.models import SeedDelivery

    delivery_id = request.data.get('delivery_id')
    distribution_date = request.data.get('distribution_date', '')
    distribution_time = request.data.get('distribution_time', '')
    distribution_venue = request.data.get('distribution_venue', '')

    if not delivery_id:
        return Response({'error': 'delivery_id is required.'}, status=400)

    delivery = get_object_or_404(SeedDelivery, pk=delivery_id)
    barangay = request.user.barangay

    farmers = get_matching_farmers(delivery, barangay=barangay)
    numbers = [normalize_phone(f.contact_number) for f in farmers if f.contact_number]

    if not numbers:
        return Response({'message': 'No matching farmers with contact numbers found.'}, status=200)

    variety_label = f" ({delivery.variety.name})" if delivery.variety else ''
    message = (
        f"AGRICE: Naka-schedule na po ang pamamahagi ng {delivery.seed_type.name}{variety_label} "
        f"sa {distribution_date} {distribution_time}. Lugar: {distribution_venue}. "
        f"Mangyaring dumalo at magdala ng Valid ID o RSBSA Stub."
    )

    try:
        send_sms_batch(numbers, message)
        return Response({'message': f'SMS sent to {len(numbers)} farmers.'})
    except Exception as e:
        return Response({'error': str(e)}, status=500)