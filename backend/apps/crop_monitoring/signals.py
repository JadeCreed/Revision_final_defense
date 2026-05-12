# apps/crop_monitoring/signals.py
# After every CropMonitoringRecord save, recalculate the
# BarangayCropSummary for that barangay so the GIS map
# always has fresh aggregated data without heavy queries.

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Count, OuterRef, Subquery
from .models import CropMonitoringRecord, BarangayCropSummary


def _refresh_summary(barangay: str, reporter=None):
    """
    Recompute the BarangayCropSummary for a given barangay.
    Uses the LATEST record per farmer (their current phase).
    """
    latest_record = (
        CropMonitoringRecord.objects
        .filter(barangay=barangay, farmer_id=OuterRef('farmer_id'))
        .order_by('-date_observed', '-encoded_at')
        .values('pk')[:1]
    )

    latest_ids = (
        CropMonitoringRecord.objects
        .filter(barangay=barangay)
        .values('farmer_id')
        .annotate(latest_id=Subquery(latest_record))
        .values_list('latest_id', flat=True)
    )

    records = CropMonitoringRecord.objects.filter(id__in=latest_ids)

    counts = {
        'DISTRIBUTION': 0, 'ESTABLISHMENT': 0, 'TILLERING': 0,
        'FLOWERING': 0, 'RIPENING': 0, 'HARVESTING': 0,
    }
    for rec in records:
        if rec.crop_phase in counts:
            counts[rec.crop_phase] += 1

    total = sum(counts.values())

    # Dominant phase = the one with highest count
    dominant = max(counts, key=counts.get) if total > 0 else 'DISTRIBUTION'

    summary, _ = BarangayCropSummary.objects.get_or_create(barangay=barangay)
    summary.dominant_phase       = dominant
    summary.total_farmers        = total
    summary.distribution_count   = counts['DISTRIBUTION']
    summary.establishment_count  = counts['ESTABLISHMENT']
    summary.tillering_count      = counts['TILLERING']
    summary.flowering_count      = counts['FLOWERING']
    summary.ripening_count       = counts['RIPENING']
    summary.harvesting_count     = counts['HARVESTING']
    if reporter:
        summary.last_reported_by = reporter
    summary.save()


@receiver(post_save, sender=CropMonitoringRecord)
def on_record_saved(sender, instance, **kwargs):
    _refresh_summary(instance.barangay, reporter=instance.encoded_by)


@receiver(post_delete, sender=CropMonitoringRecord)
def on_record_deleted(sender, instance, **kwargs):
    _refresh_summary(instance.barangay)