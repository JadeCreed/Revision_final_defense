# apps/accounts/views_dashboard.py
# Dashboard stats endpoints para sa AT, BRGY, at Farmer tiles

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from apps.accounts.permissions import IsATUser, IsBPUser, IsFarmer
from apps.accounts.models import User
from apps.crop_monitoring.models import CropMonitoringRecord
from apps.distribution.models import DistributionEntry, DistributionBatch
from apps.announcements.models import Announcement, AnnouncementRead
from apps.seed_poll.utils import get_current_poll
from django.utils import timezone
from datetime import timedelta


# ═══════════════════════════════════════════════════
# AT DASHBOARD STATS
# GET /api/accounts/at/dashboard-stats/
# ═══════════════════════════════════════════════════
class ATDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsATUser]

    def get(self, request):
        user = request.user

        try:
            at_profile = user.at_profile
            assigned_barangays = list(
                at_profile.barangays.values_list('name', flat=True)
            )
        except Exception:
            assigned_barangays = []

        current_poll = get_current_poll()

        # ── Tile 1: Total distinct APPROVED farmers in assigned barangays ──
        total_farmers = User.objects.filter(
            role='FARMER',
            status='APPROVED',
            is_active=True,
            barangay__in=assigned_barangays,
        ).count()

        # ── Tile 2: Distinct farmers na may kahit 1 crop record na in-encode
        #    ng THIS AT sa current poll (counted as 1 per farmer) ──
        monitored_filter = dict(encoded_by=user)
        if current_poll:
            monitored_filter['poll'] = current_poll
        monitored_farmers = (
            CropMonitoringRecord.objects
            .filter(**monitored_filter)
            .values('farmer')
            .distinct()
            .count()
        )

        # ── Tile 3: Last monitoring encoded — date + barangay ──
        last_filter = dict(encoded_by=user)
        if current_poll:
            last_filter['poll'] = current_poll
        last_record = (
            CropMonitoringRecord.objects
            .filter(**last_filter)
            .order_by('-date_observed', '-encoded_at')
            .first()
        )
        last_monitoring = None
        if last_record:
            last_monitoring = {
                'date': last_record.date_observed.strftime('%b %d, %Y'),
                'barangay': last_record.barangay,
            }

        # ── Tile 4: Coverage — monitored / total (percentage) ──
        coverage_pct = 0
        if total_farmers > 0:
            coverage_pct = round((monitored_farmers / total_farmers) * 100)

        return Response({
            'total_farmers': total_farmers,
            'monitored_farmers': monitored_farmers,
            'last_monitoring': last_monitoring,
            'coverage_pct': coverage_pct,
            'assigned_barangays': assigned_barangays,
        })


# ═══════════════════════════════════════════════════
# BRGY DASHBOARD STATS
# GET /api/accounts/brgy/dashboard-stats/
# ═══════════════════════════════════════════════════
class BRGYDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsBPUser]

    def get(self, request):
        user = request.user
        barangay = getattr(user, 'barangay', None)

        if not barangay:
            return Response({
                'total_farmers': 0,
                'beneficiaries': 0,
                'distributed_kg': 0,
                'harvest_submitted': 0,
            })

        current_poll = get_current_poll()

        # ── Tile 1: Total distinct APPROVED farmers sa barangay ──
        total_farmers = User.objects.filter(
            role='FARMER',
            status='APPROVED',
            is_active=True,
            barangay=barangay,
        ).count()

        # ── Tile 2: Distinct farmers na may approved beneficiary record
        #    (kahit inbred+hybrid, count as 1 farmer) ──
        entry_filter = dict(
            batch__status='APPROVED',
            farmer__barangay=barangay,
        )
        if current_poll:
            entry_filter['batch__event__season'] = current_poll.season
            entry_filter['batch__event__year'] = current_poll.year

        beneficiary_farmer_ids = (
            DistributionEntry.objects
            .filter(**entry_filter)
            .values('farmer')
            .distinct()
        )
        beneficiaries = beneficiary_farmer_ids.count()

        # ── Tile 3: Total kg distributed
        #    Hybrid: farm_area_ha × 15 kg/ha
        #    Inbred: area_planted × 40 kg/ha (2 bags × 20kg)
        #    NOTE: ginagamit natin qty_bags × kg_per_bag para exact
        #    Hybrid bag = 15kg, Inbred bag = 20kg ──
        dist_filter = dict(
            batch__status='APPROVED',
            farmer__barangay=barangay,
            qty_bags__isnull=False,
            qty_bags__gt=0,
        )
        if current_poll:
            dist_filter['batch__event__season'] = current_poll.season
            dist_filter['batch__event__year'] = current_poll.year

        distributed_entries = DistributionEntry.objects.filter(
            **dist_filter
        ).select_related('batch__event__seed_type')

        total_kg = 0
        for entry in distributed_entries:
            seed_type_name = ''
            try:
                seed_type_name = (entry.batch.event.seed_type.name or '').upper()
            except Exception:
                pass

            bags = entry.qty_bags or 0
            if 'HYBRID' in seed_type_name:
                total_kg += bags * 15   # 15 kg per bag
            elif 'INBRED' in seed_type_name or 'CERTIFIED' in seed_type_name:
                total_kg += bags * 20   # 20 kg per bag (2 bags/ha × 20kg)
            else:
                total_kg += bags * 15   # default fallback

        # ── Tile 4: Distinct farmers na may harvest record
        #    (counted as 1 kahit multi-seed type) ──
        try:
            from apps.crop_monitoring.models import CropMonitoringRecord
            harvest_filter = dict(
                crop_phase='HARVESTING',
                barangay=barangay,
            )
            if current_poll:
                harvest_filter['poll'] = current_poll
            harvest_submitted = (
                CropMonitoringRecord.objects
                .filter(**harvest_filter)
                .values('farmer')
                .distinct()
                .count()
            )
        except Exception:
            harvest_submitted = 0

        return Response({
            'total_farmers': total_farmers,
            'beneficiaries': beneficiaries,
            'distributed_kg': total_kg,
            'harvest_submitted': harvest_submitted,
        })


# ═══════════════════════════════════════════════════
# FARMER DASHBOARD STATS
# GET /api/accounts/farmer/dashboard-stats/
# ═══════════════════════════════════════════════════
class FarmerDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsFarmer]

    def get(self, request):
        user = request.user
        current_poll = get_current_poll()

        # ── Tile 1: Selected seed types (approved beneficiary) ──
        # Kapag wala pang approved batch → 'PENDING'
        seed_filter = dict(
            farmer=user,
            batch__status='APPROVED',
        )
        if current_poll:
            seed_filter['batch__event__season'] = current_poll.season
            seed_filter['batch__event__year'] = current_poll.year

        approved_entries = DistributionEntry.objects.filter(
            **seed_filter
        ).select_related('batch__event__seed_type')

        selected_seeds = []
        seen_seed_types = set()
        for entry in approved_entries:
            try:
                seed_name = (entry.batch.event.seed_type.name or '').upper()
                if seed_name and seed_name not in seen_seed_types:
                    seen_seed_types.add(seed_name)
                    if 'HYBRID' in seed_name:
                        selected_seeds.append('Hybrid')
                    elif 'INBRED' in seed_name or 'CERTIFIED' in seed_name:
                        selected_seeds.append('Inbred')
                    else:
                        selected_seeds.append(seed_name.title())
            except Exception:
                pass

        seed_display = ', '.join(selected_seeds) if selected_seeds else 'Pending'

        # ── Tile 2: Total farm hectares (from FarmerProfile) ──
        total_hectares = 0
        try:
            profile = user.profile
            if profile.hectares is not None:
                total_hectares = float(profile.hectares)
        except Exception:
            total_hectares = 0

        # ── Tile 3: Total crop monitoring records na na-encode SA KANYA
        #    (pwedeng >1 per visit kasi per seed type)
        #    Walang distinct — lahat ng records counted ──
        monitoring_filter = dict(farmer=user)
        if current_poll:
            monitoring_filter['poll'] = current_poll
        monitoring_records = CropMonitoringRecord.objects.filter(
            **monitoring_filter
        ).count()

        # ── Tile 4: Unread announcements (last 24 hours only) ──
        from apps.announcements.views import get_visible_announcements
        visible = get_visible_announcements(user)
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        recent = visible.filter(created_at__gte=twenty_four_hours_ago)
        read_ids = AnnouncementRead.objects.filter(
            user=user,
            announcement__in=recent,
        ).values_list('announcement_id', flat=True)
        unread_count = recent.exclude(id__in=read_ids).count()

        # ── Extra: Latest crop monitoring per seed type (for status card) ──
        crop_status = []
        if current_poll:
            for seed_key in ['HYBRID', 'INBRED', 'OWN_SEED']:
                latest = (
                    CropMonitoringRecord.objects
                    .filter(farmer=user, poll=current_poll, seed_source=seed_key)
                    .order_by('-date_observed', '-encoded_at')
                    .first()
                )
                if latest:
                    crop_status.append({
                        'seed_source': seed_key,
                        'seed_label': {
                            'HYBRID': 'Hybrid',
                            'INBRED': 'Inbred',
                            'OWN_SEED': 'Own Seed',
                        }.get(seed_key, seed_key),
                        'phase': latest.crop_phase,
                        'phase_display': latest.get_crop_phase_display(),
                        'date_observed': latest.date_observed.strftime('%B %d'),
                        'phase_status': latest.phase_status,
                    })
                else:
                    # Check kung may approved entry para sa seed type na ito
                    # (para malaman kung dapat ba itong ipakita bilang "No monitoring yet")
                    has_entry = False
                    if selected_seeds:
                        if seed_key == 'HYBRID' and 'Hybrid' in selected_seeds:
                            has_entry = True
                        elif seed_key == 'INBRED' and 'Inbred' in selected_seeds:
                            has_entry = True
                    if has_entry:
                        crop_status.append({
                            'seed_source': seed_key,
                            'seed_label': {
                                'HYBRID': 'Hybrid',
                                'INBRED': 'Inbred',
                                'OWN_SEED': 'Own Seed',
                            }.get(seed_key, seed_key),
                            'phase': None,
                            'phase_display': 'No monitoring yet',
                            'date_observed': None,
                            'phase_status': None,
                        })

        return Response({
            'seed_display': seed_display,
            'selected_seeds': selected_seeds,
            'total_hectares': total_hectares,
            'monitoring_records': monitoring_records,
            'unread_count': unread_count,
            'crop_status': crop_status,
        })