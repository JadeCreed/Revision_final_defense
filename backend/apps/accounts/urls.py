from django.urls import path
from .views_dashboard import ATDashboardStatsView, BRGYDashboardStatsView, FarmerDashboardStatsView
from .views import (
    ATProfileView,
    ATProfileUpdateView,
    ChangePasswordView,
    AdminFarmerMasterRecordView,
    AdminFarmerMasterRecordDetailView,
    AdminFarmerRegistryBulkUploadView,
    BPProfileView,
    FarmerRegisterView,
    LoginView,
    LogoutView,
    VerifyTokenView,
    AdminCreateUserView,
    FarmerProfileView,
    AdminVerifyFarmerView,
    FarmerListView,
    FarmerDetailView,
    FarmerDeactivateView,
    AdminDeactivateView,
    ForgotPasswordView,
    VerifyOTPView,
    ResetPasswordView,
    AdminResetRequestView,
    AdminBadgeCountView,
    AdminFarmerRequestsView,
    AdminApproveFarmerView,
    AdminFarmerMasterlistView,
    AdminFarmerFullProfileView,
    AdminOfficialsListView,
    AdminCreateOfficialView,
    AdminUpdateATAssignedBarangaysView,
    AdminDeactivateUserView,
    AdminReactivateUserView,
    AdminResetRequestsListView,
    AdminResetUserPasswordView,
    AdminArchiveListView,
    AvailableBarangaysView,
    AdminCancelResetRequestView,
    BPProfileUpdateView,
    AdminProfileUpdateView,
    MeView,
    PublicStatsView,
    PublicSeasonView,
    FarmerRegistryValidateView,
    DeceasedFarmerSearchView,
    SubmitSuccessionClaimView,
    AdminReviewSuccessionView,
    

)

urlpatterns = [
    path('register/farmer/', FarmerRegisterView.as_view(), name='farmer-register'),
    path('register/validate-step1/', FarmerRegistryValidateView.as_view(), name='farmer-validate-step1'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('verify-token/', VerifyTokenView.as_view(), name='verify-token'),

    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('verify-otp/', VerifyOTPView.as_view(), name= 'verify-otp'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),

    path('admin/users/badge-count/', AdminBadgeCountView.as_view(), name='badge-count'),
    path('admin/users/farmer-requests/',AdminFarmerRequestsView.as_view(),name='farmer-requests'),
    path('admin/users/farmers/<int:user_id>/approve/', AdminApproveFarmerView.as_view(),name='approve-farmer'),
    
    path('admin/users/farmer-masterlist/',AdminFarmerMasterlistView.as_view(),name='farmer-masterlist'),
    path('admin/users/farmers/<int:user_id>/full-profile/',AdminFarmerFullProfileView.as_view(),name='farmer-full-profile'),

    path('admin/users/officials/',AdminOfficialsListView.as_view(),name='officials-list'),
    path('admin/users/officials/create/',AdminCreateOfficialView.as_view(), name='create-official'),
    path('admin/users/<int:user_id>/assigned-barangays/', AdminUpdateATAssignedBarangaysView.as_view(), name='update-at-barangays'),
    path('admin/users/<int:user_id>/deactivate/', AdminDeactivateUserView.as_view(), name='deactivate-user'),

    path('admin/users/reset-requests/',AdminResetRequestsListView.as_view(), name='reset-requests'),
    path('admin/users/<int:user_id>/reset-password/',AdminResetUserPasswordView.as_view(),  name='admin-reset-password'),

    path('admin/users/archive/',AdminArchiveListView.as_view(), name='archive'),
    path('admin/farmer-registry/', AdminFarmerMasterRecordView.as_view(), name='farmer-registry'),
    path('admin/farmer-registry/<int:pk>/', AdminFarmerMasterRecordDetailView.as_view(), name='farmer-registry-detail'),
    path('admin/farmer-registry/bulk-upload/', AdminFarmerRegistryBulkUploadView.as_view(), name='farmer-registry-bulk'),
    path('admin/users/<int:user_id>/reactivate/',AdminReactivateUserView.as_view(), name='reactivate-user'),

    path('barangays/available/', AvailableBarangaysView.as_view(), name='available-barangays'),

    path('brgy/profile/', BPProfileUpdateView.as_view(), name='brgy-profile-update'),
    path('admin/profile/', AdminProfileUpdateView.as_view(), name='admin-profile'),
    
    path('me/', MeView.as_view(), name='accounts-me'),
    path('public-stats/', PublicStatsView.as_view()),
    path('public-season/', PublicSeasonView.as_view()),
    
    path('admin-reset-request/', AdminResetRequestView.as_view(), name='admin-reset-request'),
    path('admin/users/<int:user_id>/cancel-reset-request/', AdminCancelResetRequestView.as_view(), name='cancel-reset-request'),
    path('admin-create-user/', AdminCreateUserView.as_view()),
    path('admin-verify-farmer/<int:user_id>/', AdminVerifyFarmerView.as_view(),name='verify-farmer'),
    path('farmer-profile/', FarmerProfileView.as_view(), name='farmer-profile'),
    path('farmers/', FarmerListView.as_view(), name='farmer-list'),  # GET all farmers
    path('farmers/<int:id>/', FarmerDetailView.as_view(), name='farmer-detail'),  # GET/PUT/DELETE
    path('profile/at/', ATProfileView.as_view(), name='at-profile'),
    path('at/profile/', ATProfileUpdateView.as_view(), name='at-profile-update'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('profile/bp/', BPProfileView.as_view(), name='bp-profile'),
    path('farmer/deactivate/', FarmerDeactivateView.as_view(), name='farmer-deactivate'),
    path('admin/deactivate-user/<int:user_id>/', AdminDeactivateView.as_view(), name='admin-deactivate-user'),

    # ── DASHBOARD STATS ENDPOINTS (for charts and summary cards) ──
    path('at/dashboard-stats/', ATDashboardStatsView.as_view(), name='at-dashboard-stats'),
    path('brgy/dashboard-stats/', BRGYDashboardStatsView.as_view(), name='brgy-dashboard-stats'),
    path('farmer/dashboard-stats/', FarmerDashboardStatsView.as_view(), name='farmer-dashboard-stats'),

    # ── SUCCESSION ──
    path('succession/deceased-farmers/', DeceasedFarmerSearchView.as_view(), name='succession-deceased-farmers'),
    path('succession/claim/', SubmitSuccessionClaimView.as_view(), name='succession-claim'),
    path('succession/<int:user_id>/review/', AdminReviewSuccessionView.as_view(), name='succession-review'),
]