from django.urls import path
from .views import (
    AdminSeedTypeListCreateView,
    AdminSeedTypeDetailView,
    AdminSeedVarietyListCreateView,
    AdminSeedVarietyDetailView,
    AdminPollListCreateView,
    AdminPollDetailView,
    AdminLockPollView,
    AdminClosePollView,
    AdminPollResultsView,
    FarmerActivePollView,
    FarmerVoteView,
    BrgyPollResultsView,
    SeedVarietyListView,
    test_view
)

urlpatterns = [
    # ADMIN
    path('admin/types/', AdminSeedTypeListCreateView.as_view(), name='admin-type-list'),
    path('admin/types/<int:pk>/', AdminSeedTypeDetailView.as_view(), name='admin-type-detail'),

    # VARIETIES
    path('admin/varieties/', AdminSeedVarietyListCreateView.as_view(), name='admin-variety-list'),
    path('admin/varieties/<int:pk>/', AdminSeedVarietyDetailView.as_view(), name='admin-variety-detail'),

    # POLLS
    path('admin/polls/', AdminPollListCreateView.as_view(), name='admin-poll-list'),
    path('admin/polls/<int:pk>/', AdminPollDetailView.as_view(), name='admin-poll-detail'),
    path('admin/polls/<int:pk>/lock/', AdminLockPollView.as_view(), name='admin-poll-lock'),
    path('admin/polls/<int:pk>/close/', AdminClosePollView.as_view(), name='admin-poll-close'),
    path('admin/polls/<int:pk>/results/', AdminPollResultsView.as_view(), name='admin-poll-results'),

    # SHARED
    path('varieties/', SeedVarietyListView.as_view(), name='variety-list'),

    # FARMER
    path('active/', FarmerActivePollView.as_view(), name='farmer-active-poll'),
    path('<int:pk>/vote/', FarmerVoteView.as_view(), name='farmer-vote'),

    # BRGY
    path('<int:pk>/brgy-results/', BrgyPollResultsView.as_view(), name='brgy-poll-results'),

    # TEST
    path('test/', test_view, name='test-view'),
]