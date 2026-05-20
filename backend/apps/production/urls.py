from django.urls import path

from .views import HarvestRecordListCreateView, HarvestRecordDetailView

urlpatterns = [
    path('harvest/', HarvestRecordListCreateView.as_view(), name='harvest-list-create'),
    path('harvest/<int:pk>/', HarvestRecordDetailView.as_view(), name='harvest-detail'),
]
