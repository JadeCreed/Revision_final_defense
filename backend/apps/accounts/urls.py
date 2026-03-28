from django.urls import path
from .views import (
    ATProfileView,
    BPProfileView,
    FarmerRegisterView,
    LoginView,
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
)

urlpatterns = [
    path('register/farmer/', FarmerRegisterView.as_view(), name='farmer-register'),
    path('login/', LoginView.as_view(), name='login'),

    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('verify-otp/', VerifyOTPView.as_view(), name= 'verify-otp'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),

    path('admin-reset-request/', AdminResetRequestView.as_view(), name='admin-reset-request'),
    path('admin-create-user/', AdminCreateUserView.as_view()),
    path('admin-verify-farmer/<int:user_id>/', AdminVerifyFarmerView.as_view(),name='verify-farmer'),
    path('farmer-profile/', FarmerProfileView.as_view(), name='farmer-profile'),
    path('farmers/', FarmerListView.as_view(), name='farmer-list'),  # GET all farmers
    path('farmers/<int:id>/', FarmerDetailView.as_view(), name='farmer-detail'),  # GET/PUT/DELETE
    path('profile/at/', ATProfileView.as_view(), name='at-profile'),
    path('profile/bp/', BPProfileView.as_view(), name='bp-profile'),
    path('farmer/deactivate/', FarmerDeactivateView.as_view(), name='farmer-deactivate'),
    path('admin/deactivate-user/<int:user_id>/', AdminDeactivateView.as_view(), name='admin-deactivate-user'),
]