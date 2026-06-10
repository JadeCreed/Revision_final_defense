# views.py
# ─────────────────────────────────────────────────────────────
# This file is kept for backward compatibility only.
# Logic is split into:
#   views_beneficiaries.py  — beneficiary encoding/approval
#   views_distribution.py   — seed distribution encoding
# ─────────────────────────────────────────────────────────────

from .views_beneficiaries import (
    log_action,
    StandardPagination,
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
    DistributionAuditView,
)

from .views_distribution import (
    get_barangay_gis_data,
    FarmerSearchView,
    FarmerDistributionDetailView,
    DistributionBatchSubmitDistributionView,
    DistributionBatchApproveDistributionView,
    DistributionBatchRejectDistributionView,
    DistributionEntryEncodeView,
    AdminDistributionPendingView,
    AdminDistributionStatsView,
    AdminConfirmSeedDeliveryView,
    FarmerHarvestContextView,
)