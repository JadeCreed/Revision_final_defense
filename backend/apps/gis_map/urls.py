from django.urls import path
from .views import GISPlotsView, GISMapSummaryView, GISBarangaysView
from .views_public import PublicGisStatsView, PublicGisBrgyView

urlpatterns = [
    path('plots/',     GISPlotsView.as_view(),      name='gis-plots'),
    path('summary/',   GISMapSummaryView.as_view(),  name='gis-summary'),
    path('barangays/', GISBarangaysView.as_view(),   name='gis-barangays'),

    # Idagdag sa urlpatterns list (sa dulo, bago ang closing bracket)
    path('public/stats/',     PublicGisStatsView.as_view(),  name='gis-public-stats'),
    path('public/barangays/', PublicGisBrgyView.as_view(),   name='gis-public-barangays'),

]