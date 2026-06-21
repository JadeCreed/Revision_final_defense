# apps/announcements/views.py
# ============================================================
# VIEWS:
# AdminAnnouncementListCreateView   GET list / POST create
# AdminAnnouncementDetailView       GET one / PUT edit / DELETE
# UserAnnouncementListView          GET list for farmer/AT/BRGY
# UserAnnouncementDetailView        GET one announcement (marks read)
# MarkAnnouncementReadView          POST mark as read
# UserUnreadCountView               GET unread count (for bell badge)
# ============================================================

from rest_framework.views      import APIView
from rest_framework.response   import Response
from rest_framework            import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from django.shortcuts          import get_object_or_404
from django.db.models          import Q

from apps.accounts.permissions import IsAdminUserRole  # reuse from accounts ✅
from .models      import Announcement, AnnouncementRead
from .serializers import (
    AnnouncementAdminSerializer,
    AnnouncementListSerializer,
)


# ─────────────────────────────────────────────────────────────
# PAGINATION
# ─────────────────────────────────────────────────────────────
class StandardPagination(PageNumberPagination):
    page_size             = 10
    page_size_query_param = 'page_size'
    max_page_size         = 50


# ─────────────────────────────────────────────────────────────
# HELPER — filter announcements visible to a specific user
# Reused in both list and detail views
# ─────────────────────────────────────────────────────────────
def get_visible_announcements(user):
    """
    Returns queryset of active announcements visible to this user.
    Filters by:
      1. is_active = True
      2. target_role matches user's role OR is ALL
      3. target_barangays matches user's barangay OR is empty (all)
      4. For FARMER: If announcement is posted by a BRGY President, only show
         if they have approved beneficiary data (DistributionBatch status='APPROVED')
         for the current active poll season/year.
    """
    # Start with all active announcements
    qs = Announcement.objects.filter(is_active=True)

    # Filter by role
    qs = qs.filter(
        Q(target_role='ALL') | Q(target_role=user.role)
    )

    if user.role == 'AT':
        try:
            user_barangays = [b.lower().strip() for b in user.at_profile.barangays.values_list('name', flat=True)]
        except Exception:
            user_barangays = []
    else:
        single = getattr(user, 'barangay', '') or ''
        user_barangays = [single.lower().strip()] if single else []

    visible_ids = []
    for ann in qs:
        # Case-insensitive comparison para sa barangay names
        target_list = [b.lower().strip() for b in ann.get_target_barangays()]
        is_visible = False

        if not target_list:
            is_visible = True
        elif user_barangays:
            if any(brgy in target_list for brgy in user_barangays):
                is_visible = True

        # ── FARMER LEVEL BENEFICIARY SCOPING CONSTRAINT ──
        # Kung Farmer ang tinitingnan, at ang announcement ay local (mula sa BRGY President):
        # Sisiguraduhin natin na ipapakita lamang ito kung ang Farmer ay nakatala sa approved list ng variety na ito.
        if is_visible and user.role == 'FARMER' and ann.posted_by and ann.posted_by.role == 'BRGY' and ann.target_role == 'FARMER':
            is_visible = False # Default sa hindi muna makikita hangga't hindi natutukoy ang valid variety entry
            url = ann.action_url or ''
            
            if url.startswith('distribution-delivery-id:'):
                try:
                    delivery_id = int(url.split(':')[1])
                    from apps.seed_inventory.models import SeedDelivery
                    from apps.distribution.models import DistributionBatch
                    
                    delivery = SeedDelivery.objects.filter(pk=delivery_id).first()
                    if delivery:
                        # I-filter ang distribution batches batay sa exact seed variety at delivery ng barangay
                        batches_qs = DistributionBatch.objects.filter(
                            status='APPROVED',
                            event__season=delivery.season,
                            event__year=delivery.year,
                            event__seed_type=delivery.seed_type,
                            entries__farmer=user,
                            event__barangay=user.barangay
                        )
                        
                        if delivery.variety:
                            batches_qs = batches_qs.filter(
                                Q(event__variety=delivery.variety) |
                                Q(entries__variety=delivery.variety)
                            ).distinct()
                            
                        if batches_qs.exists():
                            is_visible = True
                except Exception:
                    pass
            else:
                # Fallback kapag walang delivery target na nakalagay sa action_url ng announcement
                from apps.seed_poll.utils import get_current_poll
                from apps.distribution.models import DistributionBatch
                poll = get_current_poll()
                if poll:
                    has_approved_record = DistributionBatch.objects.filter(
                        status='APPROVED',
                        event__season=poll.season,
                        event__year=poll.year,
                        entries__farmer=user,
                        event__barangay=user.barangay
                    ).exists()
                    if has_approved_record:
                        is_visible = True

        if is_visible:
            visible_ids.append(ann.id)

    return Announcement.objects.filter(id__in=visible_ids).order_by('-created_at')



#  def get_visible_announcements(user):
#     """
#     Returns queryset of active announcements visible to this user.
#     Filters by:
#       1. is_active = True
#       2. target_role matches user's role OR is ALL
#       3. target_barangays matches user's barangay OR is empty (all)
#     """
#     # Start with all active announcements
#     qs = Announcement.objects.filter(is_active=True)

#     # Filter by role
#     # Shows announcements targeted at this user's role OR targeted at ALL
#     qs = qs.filter(
#         Q(target_role='ALL') | Q(target_role=user.role)
#     )

#     if user.role == 'AT':
#         try:
#             # Get all barangay names assigned to this AT
#             user_barangays = list(
#                 user.at_profile.barangays.values_list('name', flat=True)
#             )
#         except Exception:
#             user_barangays = []
#     else:
#         # FARMER and BRGY — single barangay on User model
#         single = getattr(user, 'barangay', '') or ''
#         user_barangays = [single] if single else []

#     # Filter by barangay
#     # An announcement is visible if:
#     #   - target_barangays is empty (means ALL barangays) OR
#     #   - user's barangay is in the target_barangays list

#     visible_ids = []
#     for ann in qs.only('id', 'target_barangays'):
#         target_list = ann.get_target_barangays()

#         if not target_list:
#             # Empty target = ALL barangays → always visible
#             visible_ids.append(ann.id)
#         elif user_barangays:
#             # Check if ANY of user's barangays match the target list
#             if any(brgy in target_list for brgy in user_barangays):
#                 visible_ids.append(ann.id)
#         # If user has no barangay at all → only sees ALL-barangay announcements

#     return Announcement.objects.filter(id__in=visible_ids).order_by('-created_at')

# ═══════════════════════════════════════════════════════════
# ADMIN VIEWS
# ═══════════════════════════════════════════════════════════

class AdminAnnouncementListCreateView(APIView):
    """
    GET  /api/announcements/admin/
         Returns all announcements (active + inactive) for admin management.
         Supports: ?search=  ?role=  ?is_active=

    POST /api/announcements/admin/
         Admin creates a new announcement.
         posted_by is automatically set to request.user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'ADMIN':
            qs = Announcement.objects.all()
        elif request.user.role == 'BRGY':
            qs = Announcement.objects.filter(posted_by=request.user)
        else:
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        is_active = request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')

        role = request.query_params.get('role')
        if role and role.upper() != 'ALL':
            qs = qs.filter(Q(target_role=role.upper()) | Q(target_role='ALL'))

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(content__icontains=search))

        qs = qs.order_by('-created_at')
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = AnnouncementAdminSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        if request.user.role not in ('ADMIN', 'BRGY'):
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            data = request.data.copy()
            # Kung BRGY President, awtomatikong i-restrict sa kanyang Barangay at Farmers lamang
            if request.user.role == 'BRGY':
                data['target_role'] = 'FARMER'
                data['target_barangays_list'] = [request.user.barangay]
            
            serializer = AnnouncementAdminSerializer(data=data, context={'request': request})
            if serializer.is_valid():
                serializer.save(posted_by=request.user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class AdminAnnouncementDetailView(APIView):
    """
    GET    /api/announcements/admin/<id>/   Get one announcement
    PUT    /api/announcements/admin/<id>/   Edit announcement
    DELETE /api/announcements/admin/<id>/   Soft delete (sets is_active=False)
    """
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    def get_object(self, pk):
        return get_object_or_404(Announcement, pk=pk)

    def get(self, request, pk):
        ann        = self.get_object(pk)
        serializer = AnnouncementAdminSerializer(
            ann, context={'request': request}
        )
        return Response(serializer.data)

    def put(self, request, pk):
        ann        = self.get_object(pk)
        serializer = AnnouncementAdminSerializer(
            ann, data=request.data,
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        # Soft delete — keeps data, just hides from users
        ann           = self.get_object(pk)
        ann.is_active = False
        ann.save()
        return Response({"message": "Announcement deactivated"})


# ═══════════════════════════════════════════════════════════
# USER VIEWS (Farmer / AT / BRGY)
# ═══════════════════════════════════════════════════════════

class UserAnnouncementListView(APIView):
    """
    GET /api/announcements/
    Returns announcements visible to the current user.
    Filtered by role + barangay automatically.

    Query params:
      ?limit=3   → for dashboard preview (only latest 3)
      ?search=   → search by title
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'ADMIN':
            return Response(
                {"error": "Admins use /announcements/admin/ routes"},status=status.HTTP_403_FORBIDDEN)
        
        qs = get_visible_announcements(request.user)

        # Search
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search)
            )

        # Limit — used by dashboard to show only latest 3
        limit = request.query_params.get('limit')
        if limit:
            try:
                qs = qs[:int(limit)]
            except ValueError:
                pass
        
        read_ids = set(
        AnnouncementRead.objects.filter(
            user=request.user,
            announcement__in=qs).values_list('announcement_id', flat=True))
        
        serializer = AnnouncementListSerializer(
        qs,
        many=True,
        context={
            'request':  request,
            'read_ids': read_ids,})
        
        return Response(serializer.data)


class UserAnnouncementDetailView(APIView):
    """
    GET /api/announcements/<id>/
    Returns one announcement detail.
    AUTOMATICALLY marks as read when the user opens it.
    This is what triggers the NEW → READ badge change.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        # I-filter batay sa visible announcements ng user para sa parehong panuntunan ng listahan
        visible_qs = get_visible_announcements(request.user)
        ann = get_object_or_404(visible_qs, pk=pk)
        


        # ── AUTO MARK AS READ ──
        # get_or_create: if already read → does nothing (no duplicate)
        #                if not read yet → creates the read record
        AnnouncementRead.objects.get_or_create(
            user=request.user,
            announcement=ann,
        )

        #  pass read_ids for this single announcement
        read_ids = set(
            AnnouncementRead.objects.filter(
                user=request.user,
                announcement=ann
            ).values_list('announcement_id', flat=True)
        )

        serializer = AnnouncementListSerializer(
            ann,
            context={
                'request':  request,
                'read_ids': read_ids,
            }
        )
        return Response(serializer.data)


class UserUnreadCountView(APIView):
    """
    GET /api/announcements/unread-count/
    Returns count of unread announcements for this user.
    Used for the notification bell badge in UserLayout.
    Only counts announcements posted within last 24 hours
    (same logic as NEW badge).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta

        # Get all announcements visible to this user
        visible = get_visible_announcements(request.user)

        # Only count ones posted within last 24 hours
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        recent = visible.filter(created_at__gte=twenty_four_hours_ago)

        # Count how many the user has NOT read
        read_ids = AnnouncementRead.objects.filter(
            user=request.user,
            announcement__in=recent
        ).values_list('announcement_id', flat=True)

        unread_count = recent.exclude(id__in=read_ids).count()

        return Response({"unread_count": unread_count})
    
    