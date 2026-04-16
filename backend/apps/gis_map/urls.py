from django.urls import path
from .views import FarmPlotListCreateView, FarmPlotDetailView, MapSummaryView, BarangayListView

urlpatterns = [
    path('plots/',          FarmPlotListCreateView.as_view(), name='farmplot-list'),
    path('plots/<int:pk>/', FarmPlotDetailView.as_view(),     name='farmplot-detail'),
    path('summary/',        MapSummaryView.as_view(),          name='map-summary'),
    path('barangays/',      BarangayListView.as_view(),        name='gis-barangays'),
]