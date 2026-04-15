# apps/reports/urls.py
from django.urls import path
from .views import (
    ReportFilterOptionsView,
    ReportPreviewView,
    ReportDownloadView,
    ReportLogListView,
)

urlpatterns = [
    path('filter-options/', ReportFilterOptionsView.as_view()),
    path('preview/',        ReportPreviewView.as_view()),
    path('download/',       ReportDownloadView.as_view()),
    path('logs/',           ReportLogListView.as_view()),
]