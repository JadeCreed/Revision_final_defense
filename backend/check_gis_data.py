#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.crop_monitoring.models import CropMonitoringRecord
from apps.distribution.models import DistributionEntry

print("=" * 60)
print("DISTRIBUTION ENTRIES (seed distribution)")
print("=" * 60)
dist_count = DistributionEntry.objects.count()
print(f"Total distribution entries: {dist_count}")

if dist_count > 0:
    latest = DistributionEntry.objects.select_related('farmer', 'batch').order_by('-id')[:3]
    for entry in latest:
        print(f"  - {entry.farmer.get_full_name()} | Batch: {entry.batch.id}")

print("\n" + "=" * 60)
print("CROP MONITORING RECORDS (field visits)")
print("=" * 60)
monitoring_count = CropMonitoringRecord.objects.count()
print(f"Total monitoring records: {monitoring_count}")

if monitoring_count > 0:
    latest = CropMonitoringRecord.objects.order_by('-id')[:3]
    for rec in latest:
        print(f"  - {rec.farmer.get_full_name()} | Phase: {rec.crop_phase}")
else:
    print("❌ NO MONITORING RECORDS - This is why GIS map is empty!")
    print("\n🔧 TO FIX:")
    print("   1. Agricultural Technicians (ATs) must visit farms")
    print("   2. ATs create Crop Monitoring records via their interface")
    print("   3. Each record captures current crop phase + conditions")
    print("   4. GIS map automatically shows the monitoring data")

print("\n" + "=" * 60)
