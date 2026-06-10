from django.urls import path
from .views_beneficiaries import (
    DistributionEventListCreateView,
    DistributionEventDetailView,
    DistributionBatchListCreateView,
    DistributionBatchDetailView,
    DistributionBatchSubmitView,
    DistributionBatchApproveView,
    DistributionBatchRejectView,
    DistributionBatchReopenView,
    DistributionBatchUnlockView,
    DistributionEntryCreateView,
    DistributionEntryDetailView,
    DistributionEntrySignatureView,
    AdminPendingBatchesView,
    BrgyDistributionContextView,
    BrgyRequestDeleteEventView,
    AdminConfirmDeleteEventView,
)

urlpatterns = [
    # Events
    path('events/', DistributionEventListCreateView.as_view()),
    path('events/<int:pk>/', DistributionEventDetailView.as_view()),
    path('events/<int:pk>/request-delete/', BrgyRequestDeleteEventView.as_view()),
    path('events/<int:pk>/confirm-delete/', AdminConfirmDeleteEventView.as_view()),
    
    # Batches
    path('events/<int:event_id>/batches/', DistributionBatchListCreateView.as_view()),
    path('batches/<int:pk>/', DistributionBatchDetailView.as_view()),
    path('batches/<int:pk>/submit/', DistributionBatchSubmitView.as_view()),
    path('batches/<int:pk>/approve/', DistributionBatchApproveView.as_view()),
    path('batches/<int:pk>/reject/', DistributionBatchRejectView.as_view()),
    path('batches/<int:pk>/reopen/', DistributionBatchReopenView.as_view()),
    path('batches/<int:pk>/unlock/', DistributionBatchUnlockView.as_view()),
    
    # Entries
    path('batches/<int:batch_id>/entries/', DistributionEntryCreateView.as_view()),
    path('entries/<int:pk>/', DistributionEntryDetailView.as_view()),
    path('entries/<int:pk>/signature/', DistributionEntrySignatureView.as_view()),
    
    # Admin
    path('admin/pending/', AdminPendingBatchesView.as_view()),
    
    # Context
    path('brgy-context/', BrgyDistributionContextView.as_view()),
]