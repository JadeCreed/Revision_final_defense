from django.urls import path
from .views import AdminDashboardAnalyticsView
from .views_monthly import AdminMonthlyAnalyticsView, AdminMonthlyAnalyticsPDFView


urlpatterns = [
    path('dashboard/', AdminDashboardAnalyticsView.as_view(), name='admin-dashboard-analytics'),


    path('monthly/', AdminMonthlyAnalyticsView.as_view(), name='admin-monthly-analytics'),
    path('monthly/pdf/', AdminMonthlyAnalyticsPDFView.as_view(), name='admin-monthly-analytics-pdf'),
]