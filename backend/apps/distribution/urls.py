
from django.urls import path
from .views import (
    FarmerSearchView,
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
    AdminDistributionStatsView,
    DistributionAuditView,
    BrgyDistributionContextView,
    AdminConfirmSeedDeliveryView,
    BrgyRequestDeleteEventView,
    AdminConfirmDeleteEventView,
)

urlpatterns = [

    # ── FARMER SEARCH ──
    path('farmers/search/',
         FarmerSearchView.as_view(),
         name='farmer-search'),

    # ── EVENTS ──
    path('events/',
         DistributionEventListCreateView.as_view(),
         name='event-list'),
    path('events/<int:pk>/',
         DistributionEventDetailView.as_view(),
         name='event-detail'),

    # ── BATCHES ──
    path('events/<int:event_id>/batches/',
         DistributionBatchListCreateView.as_view(),
         name='batch-list'),
    path('batches/<int:pk>/',
         DistributionBatchDetailView.as_view(),
         name='batch-detail'),
    path('batches/<int:pk>/submit/',
         DistributionBatchSubmitView.as_view(),
         name='batch-submit'),
    path('batches/<int:pk>/approve/',
         DistributionBatchApproveView.as_view(),
         name='batch-approve'),
    path('batches/<int:pk>/reject/',
         DistributionBatchRejectView.as_view(),
         name='batch-reject'),
    path('batches/<int:pk>/reopen/',
         DistributionBatchReopenView.as_view(),
         name='batch-reopen'),
    path('batches/<int:pk>/unlock/',
         DistributionBatchUnlockView.as_view(),
         name='batch-unlock'),
    path('batches/<int:batch_id>/audit/',
         DistributionAuditView.as_view(),
         name='batch-audit'),

    # ── ENTRIES ──
    path('batches/<int:batch_id>/entries/',
         DistributionEntryCreateView.as_view(),
         name='entry-create'),
    path('entries/<int:pk>/',
         DistributionEntryDetailView.as_view(),
         name='entry-detail'),
    path('entries/<int:pk>/signature/',
         DistributionEntrySignatureView.as_view(),
         name='entry-signature'),

     # ── BRGY CONTEXT ──
     path('brgy-context/',
     BrgyDistributionContextView.as_view(),
     name='brgy-context'),

    # ── ADMIN ──
    path('admin/pending/',
         AdminPendingBatchesView.as_view(),
         name='admin-pending'),
    path('admin/stats/',
         AdminDistributionStatsView.as_view(),
         name='admin-stats'),
     path('events/<int:pk>/confirm-delivery/',
     AdminConfirmSeedDeliveryView.as_view(),
     name='confirm-delivery'),

     path('events/<int:pk>/request-delete/',
     BrgyRequestDeleteEventView.as_view(),
     name='event-request-delete'),
     path('events/<int:pk>/confirm-delete/',
     AdminConfirmDeleteEventView.as_view(),
     name='event-confirm-delete'),
]