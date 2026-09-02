# backend/backend/apps/distribution/views_history.py
#
# Seed Distribution History — READ-ONLY feature (Revision #6)
#
# Ito ay bagong, hiwalay na file. HINDI nito ginagalaw o binabago ang
# kahit anong existing model, view, serializer, o URL. Bumabasa lang
# ito ng existing DistributionEntry/DistributionBatch/DistributionEvent
# data gamit ang sarili nitong stricter criteria (Rule B).
#
# Rule B — isang entry ay kasama lang sa History kung KUMPLETO:
#   - batch.status == 'APPROVED'
#   - qty_bags may laman
#   - date_received may laman (laging required — kahit Hybrid)
#   - seed_type may laman
#   - variety may laman
#
# Ito ay sadyang mas mahigpit kaysa sa existing
# get_total_distribution_encoded() sa models.py (na Inbred/RCEF-conditional
# lang ang date_received requirement). HINDI natin binabago ang existing
# function na iyon — ginagamit pa rin ito ng current Distribution progress
# tiles at hindi natin dapat apektuhan.
#
# Walang get_current_poll() / get_encoding_poll() dito — sadyang all-time
# ang History, hindi season/poll-scoped.


from rest_framework.views       import APIView
from rest_framework.response    import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models           import Q

from rest_framework.pagination import PageNumberPagination

from apps.accounts.models import User
from .models import DistributionEntry
from .views_beneficiaries import StandardPagination


class SeedHistoryPagination(PageNumberPagination):
    """
    Hiwalay na pagination class, specific lang sa Admin Seed History list.
    HINDI ito ang shared StandardPagination (na ginagamit pa rin ng ibang
    existing views tulad ng AdminPendingBatchesView) — kung babaguhin
    natin ang page_size doon, maaapektuhan ang ibang bahagi ng system na
    hindi dapat nagbabago para sa Revision #6 na ito.
    """
    page_size             = 10
    page_size_query_param = 'page_size'
    max_page_size         = 100

def _received_entries_qs(
    farmer=None,
    barangay=None,
    seed_type=None,
    variety=None,
    year=None,
    season=None,
):
    """
    Base queryset para sa History — sinusunod ang Rule B (complete records
    only). Hiwalay ito sa existing get_total_distribution_encoded() logic
    sa models.py, na Inbred/RCEF-conditional lang. Dito, laging required
    ang date_received, seed_type, at variety, anuman ang seed type.

    Lahat ng completeness checks ay ginagawa DIREKTA sa database query
    (hindi na Python-side loop) — mas efficient kapag lumaki na ang
    dataset, dahil isang query lang ang tumatakbo sa halip na i-load
    muna lahat sa memory bago i-filter.
    """
    qs = DistributionEntry.objects.filter(
        batch__status='APPROVED',
        qty_bags__isnull=False,
        date_received__isnull=False,
        variety__isnull=False,
        batch__event__seed_type__isnull=False,
    ).select_related(
        'batch__event__seed_type', 'batch__event', 'variety', 'farmer', 'encoded_by'
    )

    if farmer is not None:
        qs = qs.filter(farmer=farmer)
    if barangay is not None:
        qs = qs.filter(farmer__barangay=barangay)
    if seed_type is not None:
        qs = qs.filter(batch__event__seed_type_id=seed_type)
    if variety is not None:
        qs = qs.filter(variety_id=variety)
    if year is not None:
        qs = qs.filter(batch__event__year=year)
    if season is not None:
        qs = qs.filter(batch__event__season=season)

    return qs


def _build_summary(entries):
    """
    Ginagamit ng parehong FarmerSeedHistoryView at AdminSeedHistoryListView
    para sa consistent na summary shape.
    """
    total_bags = 0.0
    bags_by_seed_type = {}
    total_count = 0
    last_received = None

    for entry in entries:
        bags = float(entry.qty_bags) if entry.qty_bags is not None else 0.0
        total_bags += bags
        total_count += 1

        seed_type_name = entry.batch.event.seed_type.name if entry.batch.event.seed_type else 'Unknown'
        bags_by_seed_type[seed_type_name] = bags_by_seed_type.get(seed_type_name, 0.0) + bags

        iso = entry.date_received.isoformat()
        if last_received is None or iso > last_received:
            last_received = iso

    return {
        'total_times_received': total_count,
        'total_bags':            round(total_bags, 2),
        'bags_by_seed_type':      {k: round(v, 2) for k, v in bags_by_seed_type.items()},
        'last_received':          last_received,
    }


def _serialize_entry(entry):
    event = entry.batch.event
    return {
        'entry_id':        entry.id,
        'seed_type':       event.seed_type.name if event.seed_type else '',
        'variety':         entry.variety.name if entry.variety else '',
        'bags':            entry.qty_bags,
        'date_received':   entry.date_received.isoformat(),
        'event_name':      event.organization_name,
        'season':          event.season,
        'year':            event.year,
        'encoded_by_name': (
            f"{entry.encoded_by.first_name} {entry.encoded_by.last_name}"
            if entry.encoded_by else ''
        ),
    }

def _farmer_history_response(
    farmer,
    seed_type=None,
    variety=None,
    year=None,
    season=None,
):
    """
    Reusable response builder — kinukuha ang lahat ng history entries ng
    isang farmer, ginu-group by event.year, at binubuo ang response shape.
    Ginagamit ng parehong FarmerSeedHistoryView (admin/BRGY drill-down via
    farmer_id) at MyFarmerSeedHistoryView (farmer's own self-service view
    via request.user) — iisang source of truth, walang duplicated logic.
    Walang bagong access rule dito, walang binago sa Rule B.
    """
    entries = _received_entries_qs(
        farmer=farmer,
        seed_type=seed_type,
        variety=variety,
        year=year,
        season=season,
    ).order_by(
        '-batch__event__year', '-date_received', '-batch__approved_at'
    )


    grouped_by_year = {}
    for entry in entries:
        entry_year = entry.batch.event.year
        entry_season = entry.batch.event.season
        grouped_by_year.setdefault(entry_year, {}).setdefault(entry_season, []).append(_serialize_entry(entry))

    history_by_year = []
    for entry_year in sorted(grouped_by_year.keys(), reverse=True):
        seasons_dict = grouped_by_year[entry_year]
        seasons_list = [
            {
                'season':       season_val,
                'season_label': _SEASON_LABELS.get(season_val, season_val),
                'records':      seasons_dict[season_val],
            }
            for season_val in ('WET', 'DRY') if season_val in seasons_dict
        ]
        history_by_year.append({'year': entry_year, 'seasons': seasons_list})

    return Response({
        'farmer': {
            'id':           farmer.id,
            'first_name':   farmer.first_name,
            'last_name':    farmer.last_name,
            'barangay':     farmer.barangay,
            'rsbsa_number': farmer.rsbsa_number,
        },
        'summary':          _build_summary(entries),
        'history_by_year':  history_by_year,
    })

_SEASON_LABELS = {'WET': 'Wet Season', 'DRY': 'Dry Season'}



def _history_filter_options_response(farmer=None, barangay=None):
    """
    Kinukuha ang mga aktwal na ginamit na filter values MULA SA
    HISTORICAL DISTRIBUTION RECORDS mismo (Rule B-compliant entries),
    HINDI mula sa kasalukuyang Seed Poll configuration (SeedType.objects.
    filter(is_active=True), atbp). Sadyang ganito, dahil ang Seed Poll
    ay nagre-reset/nagbabago bawat season/year (bagong seed types/
    varieties, may pwedeng ma-deactivate) — kung gagamitin natin iyon
    bilang source, mawawala sa dropdown ang mga historical na value na
    may record pa rin sa History kahit wala na sa kasalukuyang Poll.

    Optional na sinasakop ng farmer (Farmer self-service) o barangay
    (Admin barangay-scoped o BRGY forced) — kapag pareho itong None,
    global/all-time ang saklaw (Admin walang filter).
    """
    qs = _received_entries_qs(farmer=farmer, barangay=barangay)

    seed_type_rows = (
        qs.values('batch__event__seed_type_id', 'batch__event__seed_type__name')
          .distinct()
          .order_by('batch__event__seed_type__name')
    )
    seed_types = [
        {'id': row['batch__event__seed_type_id'], 'name': row['batch__event__seed_type__name']}
        for row in seed_type_rows
    ]

    variety_rows = (
        qs.values('variety_id', 'variety__name', 'batch__event__seed_type_id')
          .distinct()
          .order_by('variety__name')
    )
    varieties = [
        {
            'id':           row['variety_id'],
            'name':         row['variety__name'],
            'seed_type_id': row['batch__event__seed_type_id'],
        }
        for row in variety_rows
    ]

    years = list(
        qs.values_list('batch__event__year', flat=True)
          .distinct()
          .order_by('-batch__event__year')
    )

    # Defined order (hindi basta DB-order) para consistent at predictable
    # ang pagkakasunod-sunod sa dropdown UI — sinusunod ang parehong order
    # ng SEASON_CHOICES sa DistributionEvent model.
    season_values = set(qs.values_list('batch__event__season', flat=True).distinct())
    seasons = [
        {'value': val, 'label': _SEASON_LABELS.get(val, val)}
        for val in ('WET', 'DRY') if val in season_values
    ]

    return Response({
        'seed_types': seed_types,
        'varieties':  varieties,
        'years':      years,
        'seasons':    seasons,
    })

# ═══════════════════════════════════════════════════════════
# FARMER-SIDE — sariling history, reused din para sa admin drill-down
# ═══════════════════════════════════════════════════════════

class FarmerSeedHistoryView(APIView):
    """
    GET /distribution/farmers/<farmer_id>/seed-history/
    Buong all-time history ng isang farmer, grouped by event.year.
    Read-only. Ginagamit din ito ng AdminSeedHistoryListView drill-down
    (parehong endpoint, iisang source of truth — walang duplicate logic).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, farmer_id):
        try:
            farmer = User.objects.get(id=farmer_id, role='FARMER', is_active=True)
        except User.DoesNotExist:
            return Response({"error": "Farmer not found."}, status=404)

        if request.user.role == 'FARMER' and request.user.id != farmer.id:
            return Response({"error": "Access denied."}, status=403)

        if request.user.role == 'BRGY':
            brgy = getattr(request.user, 'barangay', None)
            if farmer.barangay != brgy:
                return Response({"error": "Access denied."}, status=403)

        return _farmer_history_response(
            farmer,
            seed_type=request.query_params.get('seed_type') or None,
            variety=request.query_params.get('variety') or None,
            year=request.query_params.get('year') or None,
            season=request.query_params.get('season') or None,
        )

class MyFarmerSeedHistoryView(APIView):
    """
    GET /distribution/farmers/my-seed-history/
    Self-service na bersyon ng FarmerSeedHistoryView — sariling history
    ng naka-login na farmer, gamit ang request.user (walang farmer_id sa
    URL, sinusunod ang parehong pattern ng getActivePoll()/
    BrgyDistributionContextView na "self" endpoints).
    Read-only. Iisang source of truth pa rin ang _farmer_history_response()
    — walang duplicate na logic, walang binago sa Rule B o sa existing
    FarmerSeedHistoryView.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'FARMER':
            return Response({"error": "Access denied."}, status=403)

        return _farmer_history_response(
            request.user,
            seed_type=request.query_params.get('seed_type') or None,
            variety=request.query_params.get('variety') or None,
            year=request.query_params.get('year') or None,
            season=request.query_params.get('season') or None,
        )


class HistoryFilterOptionsView(APIView):
    """
    GET /distribution/history/filter-options/?barangay=
    Ibinabalik ang mga aktwal na ginamit na Seed Type, Variety, Year, at
    Season MULA SA HISTORICAL DISTRIBUTION RECORDS (Rule B), hindi mula
    sa kasalukuyang Seed Poll configuration.

    Role-aware scope:
      - FARMER: laging naka-scope sa sariling records (self-service,
        walang barangay param na kailangan).
      - BRGY: laging naka-scope sa sariling barangay.
      - ADMIN: global by default; opsyonal na i-scope via ?barangay=
        (hal. kapag active na ang Barangay filter sa Admin UI, mas
        makatuwiran na ang ibang dropdown ay sumunod na rin dito).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'FARMER':
            return _history_filter_options_response(farmer=request.user)

        if request.user.role == 'BRGY':
            barangay = getattr(request.user, 'barangay', None)
            if not barangay:
                return Response({"error": "No barangay assigned."}, status=400)
            return _history_filter_options_response(barangay=barangay)

        if request.user.role == 'ADMIN':
            barangay_param = request.query_params.get('barangay') or None
            return _history_filter_options_response(barangay=barangay_param)

        return Response({"error": "Access denied."}, status=403)



# ═══════════════════════════════════════════════════════════
# ADMIN-SIDE — listahan ng farmers na may history, grouped by barangay
# ═══════════════════════════════════════════════════════════

class AdminSeedHistoryListView(APIView):
    """
    GET /distribution/admin/seed-history/?search=&barangay=&page=&page_size=
    Listahan ng farmers na may kahit isang kumpletong (Rule B) record, may
    summary counts, sorted by barangay then last name. Gumagamit ng
    existing StandardPagination class (parehong ginagamit ng ibang list
    views sa app na ito) — walang bagong pagination logic na ginawa.
    Pag-click sa isang farmer sa frontend → gagamitin ang
    FarmerSeedHistoryView (parehong endpoint sa itaas) para sa buong
    history niya.
    """
    permission_classes = [IsAuthenticated]
    pagination_class    = SeedHistoryPagination

    def get(self, request):
        filter_kwargs = {
            'seed_type':    request.query_params.get('seed_type') or None,
            'variety':      request.query_params.get('variety') or None,
            'year':         request.query_params.get('year') or None,
            'season':       request.query_params.get('season') or None,
        }

        if request.user.role == 'BRGY':
            barangay = getattr(request.user, 'barangay', None)
            if not barangay:
                return Response({"error": "No barangay assigned."}, status=400)
            entries = _received_entries_qs(barangay=barangay, **filter_kwargs)
        elif request.user.role == 'ADMIN':
            barangay_param = request.query_params.get('barangay')
            entries = _received_entries_qs(barangay=barangay_param, **filter_kwargs)
        else:
            return Response({"error": "Access denied."}, status=403)

    
        search = request.query_params.get('search', '').strip()
        if search:
            terms = search.replace(',', ' ').split()
            for term in terms:
                entries = entries.filter(
                    Q(farmer__first_name__icontains=term) |
                    Q(farmer__last_name__icontains=term) |
                    Q(farmer__rsbsa_number__icontains=term)
                )

        per_farmer_entries = {}
        farmer_info = {}
        for entry in entries:
            f = entry.farmer
            per_farmer_entries.setdefault(f.id, []).append(entry)
            farmer_info[f.id] = f

        farmers = []
        for farmer_id, farmer_entries in per_farmer_entries.items():
            f = farmer_info[farmer_id]
            summary = _build_summary(farmer_entries)
            farmers.append({
                'farmer_id':    f.id,
                'first_name':   f.first_name,
                'last_name':    f.last_name,
                'barangay':     f.barangay,
                'rsbsa_number': f.rsbsa_number,
                **summary,
            })

        farmers.sort(key=lambda x: (x['barangay'] or '', x['last_name'] or ''))

        paginator = self.pagination_class()
        page      = paginator.paginate_queryset(farmers, request)
        return paginator.get_paginated_response(page)