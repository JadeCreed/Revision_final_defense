from django.urls import path
from .views_distribution import (
    FarmerSearchView,
    FarmerDistributionDetailView,
    DistributionEntryEncodeView,
    DistributionBatchSubmitDistributionView,
    DistributionBatchApproveDistributionView,
    DistributionBatchRejectDistributionView,
    AdminDistributionPendingView,
    AdminDistributionStatsView,
    AdminConfirmSeedDeliveryView,
    FarmerHarvestContextView,
)
from .views_history import (
    FarmerSeedHistoryView,
    AdminSeedHistoryListView,
    MyFarmerSeedHistoryView,
    HistoryFilterOptionsView, 
)

urlpatterns = [
    # Farmer search — distribution-scoped
    path('farmers/search/', FarmerSearchView.as_view()),
    path('farmers/<int:farmer_id>/distribution-detail/', FarmerDistributionDetailView.as_view()),
    
    # Encoding
    path('entries/<int:pk>/encode-distribution/', DistributionEntryEncodeView.as_view()),
    
    # Distribution batch workflow
    path('batches/<int:pk>/submit-distribution/', DistributionBatchSubmitDistributionView.as_view()),
    path('batches/<int:pk>/distribution-approve/', DistributionBatchApproveDistributionView.as_view()),
    path('batches/<int:pk>/distribution-reject/', DistributionBatchRejectDistributionView.as_view()),
    
    # Admin distribution
    path('admin/distribution-pending/', AdminDistributionPendingView.as_view()),
    path('admin/stats/', AdminDistributionStatsView.as_view()),
    
    # Seed delivery
    path('events/<int:pk>/confirm-delivery/', AdminConfirmSeedDeliveryView.as_view()),
    
    # Harvest context
    path('entries/farmer-harvest-context/', FarmerHarvestContextView.as_view()),

    # Seed distribution history — read-only, all-time (NEW, Revision #6)
    path('farmers/my-seed-history/', MyFarmerSeedHistoryView.as_view()),
    path('farmers/<int:farmer_id>/seed-history/', FarmerSeedHistoryView.as_view()),
    path('admin/seed-history/', AdminSeedHistoryListView.as_view()),
    path('history/filter-options/', HistoryFilterOptionsView.as_view()),
]