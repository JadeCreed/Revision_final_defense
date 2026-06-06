from django.urls import path
from .views import CropPhaseAnalyticsView

urlpatterns = [
    path('analytics/', CropPhaseAnalyticsView.as_view(), name='crop-phase-analytics'),
]