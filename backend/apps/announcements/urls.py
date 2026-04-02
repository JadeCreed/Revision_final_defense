
# ============================================================
# URL PATTERNS:
#
# ADMIN routes (require IsAdminUserRole):
#   GET/POST   /api/announcements/admin/
#   GET/PUT/DELETE /api/announcements/admin/<id>/
#
# USER routes (require IsAuthenticated — any role):
#   GET        /api/announcements/               list for current user
#   GET        /api/announcements/<id>/          detail + auto mark read
#   GET        /api/announcements/unread-count/  bell badge count
# ============================================================

from django.urls import path
from .views import (
    AdminAnnouncementListCreateView,
    AdminAnnouncementDetailView,
    UserAnnouncementListView,
    UserAnnouncementDetailView,
    UserUnreadCountView,
)

urlpatterns = [
    path('admin/',AdminAnnouncementListCreateView.as_view(),name='admin-announcement-list'),
    path('admin/<int:pk>/',AdminAnnouncementDetailView.as_view(),name='admin-announcement-detail'),

    path('unread-count/',UserUnreadCountView.as_view(),name='unread-count'),

    path('<int:pk>/',UserAnnouncementDetailView.as_view(),name='announcement-detail'),

    path('',UserAnnouncementListView.as_view(),name='announcement-list'),
    
    
]