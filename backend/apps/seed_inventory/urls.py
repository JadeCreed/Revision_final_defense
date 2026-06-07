from django.urls import path
from .views import (
    SeedDeliveryListCreateView,
    SeedDeliveryDetailView,
    BrgyAllocationListCreateView,
    SeedDeliveryAuditListView,
    inventory_summary_view,
    brgy_allocation_view,
    confirm_pickup_view,
    brgy_pending_count_view,
    brgy_beneficiary_allocation_view,
)

urlpatterns = [
    # Admin
    path('summary/',                                    inventory_summary_view),
    path('deliveries/',                                 SeedDeliveryListCreateView.as_view()),
    path('deliveries/<int:pk>/',                        SeedDeliveryDetailView.as_view()),
    path('deliveries/<int:delivery_id>/allocations/',   BrgyAllocationListCreateView.as_view()),
    path('deliveries/<int:delivery_id>/audit/',         SeedDeliveryAuditListView.as_view()),

    # BRGY
    path('my-allocations/',                             brgy_allocation_view),
    path('my-allocations/pending-count/',               brgy_pending_count_view),
    path('allocations/<int:allocation_id>/confirm/',    confirm_pickup_view),

    # Beneficiary allocation cards
    path('beneficiary-allocations/',                    brgy_beneficiary_allocation_view),
]