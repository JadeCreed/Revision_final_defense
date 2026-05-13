from django.urls import path
from .views import GISPlotsView, GISMapSummaryView, GISBarangaysView

urlpatterns = [
    path('plots/',     GISPlotsView.as_view(),      name='gis-plots'),
    path('summary/',   GISMapSummaryView.as_view(),  name='gis-summary'),
    path('barangays/', GISBarangaysView.as_view(),   name='gis-barangays'),
]