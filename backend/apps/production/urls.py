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
)

urlpatterns = [
    # ── HARVEST RECORD CRUD ──
    path('harvest/',      HarvestRecordListCreateView.as_view(),  name='harvest-list-create'),
    path('harvest/<int:pk>/', HarvestRecordDetailView.as_view(),  name='harvest-detail'),
    
    # ── PRODUCTION ANALYTICS ──
    path('summary/',          ProductionSummaryView.as_view(),        name='production-summary'),
    path('by-seed-type/',     ProductionBySeedTypeView.as_view(),     name='production-by-seed-type'),
    path('by-barangay/',      ProductionByBarangayView.as_view(),     name='production-by-barangay'),
    path('low-performers/',   ProductionLowPerformersView.as_view(),  name='production-low-performers'),
    path('gis-summary/',      ProductionGISSummaryView.as_view(),     name='production-gis-summary'),
]