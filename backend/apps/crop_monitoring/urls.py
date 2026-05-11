from django.urls import path
from .views import (
    CropMonitoringEntriesView,
    CropMonitoringListCreateView,
    CropMonitoringSummaryView,
    CropMonitoringBarangaySummaryView,
)

urlpatterns = [
    path('', CropMonitoringListCreateView.as_view(), name='crop-monitoring-list'),
    path('entries/', CropMonitoringEntriesView.as_view(), name='crop-monitoring-entries'),
    path('summary/', CropMonitoringSummaryView.as_view(), name='crop-monitoring-summary'),
    path('barangays/', CropMonitoringBarangaySummaryView.as_view(), name='crop-monitoring-barangay-summary'),
]
