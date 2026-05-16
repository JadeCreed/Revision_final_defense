#!/usr/bin/env python
"""
Test script to verify GIS API works correctly
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

django.setup()

from apps.crop_monitoring.models import CropMonitoringRecord
from apps.accounts.models import User
from apps.distribution.models import DistributionEntry

print("=" * 60)
print("GIS API DATA TEST")
print("=" * 60)

# Check for monitoring records
monitoring_count = CropMonitoringRecord.objects.count()
print(f"\n✓ Total Crop Monitoring Records: {monitoring_count}")

if monitoring_count > 0:
    # Get latest records
    latest_records = CropMonitoringRecord.objects.select_related('farmer').order_by('-encoded_at')[:5]
    print(f"\nLatest 5 monitoring records:")
    for rec in latest_records:
        farmer_name = rec.farmer.get_full_name() if rec.farmer else "No Farmer"
        print(f"  - {farmer_name} ({rec.barangay}) - Phase: {rec.get_crop_phase_display()}")
        print(f"    Area: {rec.area_monitored_ha} ha, Seed: {rec.seed_source}, Date: {rec.date_observed}")
else:
    print("⚠ NO monitoring records found! This is why GIS map is empty.")

# Check for approved farmers
approved_farmers = User.objects.filter(role='FARMER', status='APPROVED', is_active=True).count()
print(f"\n✓ Total Approved Farmers: {approved_farmers}")

# Check for approved distribution entries
approved_entries = DistributionEntry.objects.filter(batch__status='APPROVED').count()
print(f"\n✓ Total Approved Distribution Entries: {approved_entries}")

if approved_entries > 0:
    # Sample distribution entry
    sample_entry = DistributionEntry.objects.filter(batch__status='APPROVED').select_related(
        'farmer', 'variety', 'batch', 'batch__event', 'batch__event__seed_type'
    ).first()
    
    if sample_entry:
        print(f"\nSample Distribution Entry:")
        print(f"  - Farmer: {sample_entry.farmer.get_full_name() if sample_entry.farmer else 'None'}")
        print(f"  - Area: {sample_entry.farm_area_ha} ha")
        print(f"  - Variety: {sample_entry.variety.name if sample_entry.variety else 'None'}")
        if sample_entry.batch and sample_entry.batch.event:
            print(f"  - Seed Type: {sample_entry.batch.event.seed_type.name if sample_entry.batch.event.seed_type else 'None'}")

# Now test the GIS view
print("\n" + "=" * 60)
print("TESTING GIS PLOTS VIEW")
print("=" * 60 + "\n")

try:
    from apps.gis_map.views import GISPlotsView
    from django.contrib.auth.models import AnonymousUser
    from django.test import RequestFactory
    
    factory = RequestFactory()
    request = factory.get('/api/gis/plots/')
    request.user = User.objects.filter(is_staff=True).first() or AnonymousUser()
    
    if isinstance(request.user, AnonymousUser):
        print("⚠ No authenticated staff user found for testing")
        # Try to create a test user
        from django.contrib.auth.models import User as DjangoUser
        from apps.accounts.models import User as AppUser
        print("Note: Please ensure you're logged in as a staff user")
    else:
        view = GISPlotsView()
        response = view.get(request)
        plots = response.data if hasattr(response, 'data') else response.content
        
        if isinstance(plots, list):
            print(f"✓ GIS Plots returned successfully!")
            print(f"  Total plots: {len(plots)}")
            if plots:
                print(f"\n  First plot:")
                first_plot = plots[0]
                for key, value in first_plot.items():
                    if key not in ['latitude', 'longitude']:  # Skip coords
                        print(f"    - {key}: {value}")
        else:
            print(f"✗ Error in response: {plots}")
            
except Exception as e:
    print(f"✗ Error testing GIS view: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)
