# apps/production/urls.py
from django.urls import path

# Core views (statistics at general CRUD mula sa views.py)
from .views import (
    HarvestRecordListCreateView,
    HarvestRecordDetailView,
    ProductionSummaryView,
    ProductionBySeedTypeView,
    ProductionByBarangayView,
    ProductionLowPerformersView,
    ProductionGISSummaryView,
    SeedProductivityView,
)

# Barangay President reporting & PDF views mula sa views_brgy_report.py
from .views_brgy_report import (
    BrgyHarvestingFarmersView,
    BrgyHarvestHistoryView,
    BrgyReportDataView,
    BrgyReportPDFView,
)

urlpatterns = [
    # ── HARVEST RECORD CRUD (views.py) ──
    path('harvest/',            HarvestRecordListCreateView.as_view(), name='harvest-list-create'),
    path('harvest/<int:pk>/',   HarvestRecordDetailView.as_view(),     name='harvest-detail'),
    
    # ── BRGY SPECIFIC ENCODING & HISTORY (views_brgy_report.py) ──
    path('harvesting-farmers/', BrgyHarvestingFarmersView.as_view(),   name='harvesting-farmers'),
    path('harvest-history/',    BrgyHarvestHistoryView.as_view(),      name='harvest-history'),

    # ── GENERAL PRODUCTION ANALYTICS (views.py) ──
    path('summary/',            ProductionSummaryView.as_view(),       name='production-summary'),
    path('by-seed-type/',       ProductionBySeedTypeView.as_view(),    name='production-by-seed-type'),
    path('by-barangay/',        ProductionByBarangayView.as_view(),    name='production-by-barangay'),
    path('low-performers/',     ProductionLowPerformersView.as_view(), name='production-low-performers'),
    path('gis-summary/',        ProductionGISSummaryView.as_view(),    name='production-gis-summary'),
    path('seed-productivity/',  SeedProductivityView.as_view(),        name='seed-productivity'),
    
    # ── BRGY PRESIDENT DYNAMIC REPORTING (views_brgy_report.py) ──
    path('brgy-report/',        BrgyReportDataView.as_view(),          name='brgy-report'),
    path('brgy-report/pdf/',    BrgyReportPDFView.as_view(),           name='brgy-report-pdf'),
]