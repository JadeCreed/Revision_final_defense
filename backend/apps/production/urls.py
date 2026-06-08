# apps/production/urls.py — add these to your existing urlpatterns

from django.urls import path
from .views import (
    HarvestRecordListCreateView,
    HarvestRecordDetailView,
    ProductionSummaryView,
    ProductionBySeedTypeView,
    ProductionByBarangayView,
    ProductionLowPerformersView,
    ProductionGISSummaryView,
    BrgyHarvestingFarmersView,
    BrgyHarvestHistoryView,
    SeedProductivityView,
    BrgyReportDataView,
    BrgyReportPDFView,
)

urlpatterns = [
    # ── HARVEST RECORD CRUD ──
    path('harvest/',      HarvestRecordListCreateView.as_view(),  name='harvest-list-create'),
    path('harvest/<int:pk>/', HarvestRecordDetailView.as_view(),  name='harvest-detail'),
    
    # ── BRGY SPECIFIC ──
    path('harvesting-farmers/', BrgyHarvestingFarmersView.as_view(), name='harvesting-farmers'),
    path('harvest-history/',    BrgyHarvestHistoryView.as_view(),    name='harvest-history'),


    # ── PRODUCTION ANALYTICS ──
    path('summary/',          ProductionSummaryView.as_view(),        name='production-summary'),
    path('by-seed-type/',     ProductionBySeedTypeView.as_view(),     name='production-by-seed-type'),
    path('by-barangay/',      ProductionByBarangayView.as_view(),     name='production-by-barangay'),
    path('low-performers/',   ProductionLowPerformersView.as_view(),  name='production-low-performers'),
    path('gis-summary/',      ProductionGISSummaryView.as_view(),     name='production-gis-summary'),
    path('seed-productivity/', SeedProductivityView.as_view(),         name='seed-productivity'),
    path('brgy-report/',      BrgyReportDataView.as_view(),           name='brgy-report'),
    path('brgy-report/pdf/',  BrgyReportPDFView.as_view(),            name='brgy-report-pdf'),
]