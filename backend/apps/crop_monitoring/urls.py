# apps/crop_monitoring/urls.py

from django.urls import path
from .views import (
    ATFarmerListView,
    ATFarmerDetailView,
    ATCropMonitoringCreateView,
    ATFarmerHistoryView,
    ATCropMonitoringUpdateView,
    ATDashboardStatsView,
    AdminCropMonitoringListView,
    GISBarangaySummaryView,
)

urlpatterns = [
    # AT — farmer list for encoding
    path('at/farmers/',          ATFarmerListView.as_view(),          name='at-farmer-list'),
    path('at/stats/',            ATDashboardStatsView.as_view(),      name='at-stats'),

    # AT — encode + update records
    path('records/',             ATCropMonitoringCreateView.as_view(), name='record-create'),
    path('records/<int:pk>/',    ATCropMonitoringUpdateView.as_view(), name='record-update'),

    # AT — farmer history
    path('farmers/<int:farmer_id>/history/', ATFarmerHistoryView.as_view(), name='farmer-history'),
    path('at/farmers/<int:farmer_id>/detail/', ATFarmerDetailView.as_view(), name='at-farmer-detail'),

    # Admin
    path('admin/records/',       AdminCropMonitoringListView.as_view(), name='admin-records'),

    # GIS (shared — admin + AT)
    path('gis/summaries/',       GISBarangaySummaryView.as_view(),    name='gis-summaries'),
]