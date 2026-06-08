from django.urls import path
from .views import AdminDashboardAnalyticsView

urlpatterns = [
    path('dashboard/', AdminDashboardAnalyticsView.as_view(), name='admin-dashboard-analytics'),
]