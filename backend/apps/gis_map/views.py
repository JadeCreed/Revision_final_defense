from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count
from collections import Counter

from apps.accounts.models import User
from apps.distribution.models import DistributionEntry
from apps.crop_monitoring.models import CropMonitoringRecord


PHASE_LABEL_MAP = {
    'DISTRIBUTION':  'Seed Distribution',
    'ESTABLISHMENT': 'Crop Establishment',
    'TILLERING':     'Tillering',
    'FLOWERING':     'Flowering',
    'RIPENING':      'Ripening',
    'HARVESTING':    'Harvesting',
}

PHASE_COLOR_MAP = {
    'DISTRIBUTION':  '#9CA3AF',
    'ESTABLISHMENT': '#3B82F6',
    'TILLERING':     '#22C55E',
    'FLOWERING':     '#A855F7',
    'RIPENING':      '#FACC15',
    'HARVESTING':    '#F97316',
}


class GISPlotsView(APIView):
    """
    GET /api/gis/plots/
    Returns one entry per farmer who has received seeds (approved distribution).
    Each entry includes their latest crop phase from CropMonitoringRecord.
    This is what the GIS map uses to color barangay polygons.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        barangay = request.query_params.get('barangay', '')

        # Get all farmers with approved distribution entries
        entries = DistributionEntry.objects.filter(
            batch__status='APPROVED'
        ).select_related('farmer', 'variety', 'batch__event__seed_type')

        if barangay:
            entries = entries.filter(farmer__barangay__iexact=barangay)

        # Build one record per farmer (deduplicate)
        seen_farmers = {}
        for entry in entries:
            farmer = entry.farmer
            if not farmer or not farmer.barangay:
                continue
            fid = farmer.id
            if fid not in seen_farmers:
                seen_farmers[fid] = {
                    'id':             fid,
                    'farmer':         fid,
                    'farmer_name':    farmer.get_full_name(),
                    'farmer_rsbsa':   farmer.rsbsa_number or '',
                    'farmer_contact': farmer.contact_number or '',
                    'farmer_barangay': farmer.barangay or '',
                    'barangay':       farmer.barangay or '',
                    'label':          'Main Farm',
                    'latitude':       None,
                    'longitude':      None,
                    'area_ha':        entry.farm_area_ha,
                    'land_type':      'Seed Distribution',  # default, updated below
                    'created_at':     entry.batch.event.created_at.isoformat() if entry.batch.event.created_at else None,
                }

        # Now enrich with latest crop phase from CropMonitoringRecord
        farmer_ids = list(seen_farmers.keys())
        monitoring_records = CropMonitoringRecord.objects.filter(
            farmer_id__in=farmer_ids
        ).order_by('farmer_id', '-date_observed', '-encoded_at')

        latest_phase = {}
        latest_date = {}
        for rec in monitoring_records:
            fid = rec.farmer_id
            if fid not in latest_phase:
                latest_phase[fid] = rec.crop_phase
                latest_date[fid] = rec.date_observed

        for fid, data in seen_farmers.items():
            if fid in latest_phase:
                phase_key = latest_phase[fid]
                data['land_type'] = PHASE_LABEL_MAP.get(phase_key, 'Seed Distribution')
            else:
                data['land_type'] = 'Seed Distribution'

        approved_counts = (
            User.objects
            .filter(role='FARMER', status='APPROVED', is_active=True)
            .values('barangay')
            .annotate(total=Count('id'))
        )
        approved_per_brgy = {item['barangay']: item['total'] for item in approved_counts if item['barangay']}

        plots_list = list(seen_farmers.values())
        for plot in plots_list:
            plot['total_approved_in_brgy'] = approved_per_brgy.get(plot['barangay'], 0)

        return Response(plots_list)


class GISMapSummaryView(APIView):
    """
    GET /api/gis/summary/
    Returns overall summary: total farmers, barangays, last updated.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Total farmers with approved distribution
        farmer_ids = DistributionEntry.objects.filter(
            batch__status='APPROVED'
        ).values_list('farmer_id', flat=True).distinct()

        total_farmers = len(set(farmer_ids))

        barangays = list(
            User.objects.filter(
                id__in=farmer_ids,
                role='FARMER',
            ).values_list('barangay', flat=True).distinct().order_by('barangay')
        )
        barangays = [b for b in barangays if b]

        from django.utils import timezone
        return Response({
            'total_farmers': total_farmers,
            'total_plots':   total_farmers,
            'total_area_ha': 0,
            'barangays':     barangays,
            'last_updated':  timezone.now().isoformat(),
        })


class GISBarangaysView(APIView):
    """
    GET /api/gis/barangays/
    Returns list of barangay names that have farmers with approved distribution.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        farmer_ids = DistributionEntry.objects.filter(
            batch__status='APPROVED'
        ).values_list('farmer_id', flat=True).distinct()

        barangays = list(
            User.objects.filter(
                id__in=farmer_ids,
                role='FARMER',
            ).values_list('barangay', flat=True).distinct().order_by('barangay')
        )
        barangays = [b for b in barangays if b]

        return Response(barangays)