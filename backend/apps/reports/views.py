# apps/reports/views.py
# ─────────────────────────────────────────────────────────────
# Report generation for AGRICE — MAO Lucban Rice Program
#
# REPORT TYPES:
#   REGION_MASTERLIST    — Beneficiaries masterlist for Hybrid/Region seeds
#   PHILRICE_MASTERLIST  — Beneficiaries masterlist for Inbred/PhilRice seeds
#   DISTRIBUTION_REGION  — Distribution data for Hybrid/Region seeds
#   DISTRIBUTION_PHILRICE— Distribution data for Inbred/PhilRice seeds
#   PLANTING_REPORT      — Planting accomplishment summary per barangay
#   HARVESTING_REPORT    — Harvesting accomplishment summary (placeholder)
#
# DATA SOURCE:
#   All data comes from DistributionEntry filtered by batch__status='APPROVED'
#   Beneficiaries reports use signing-phase fields (farm_area_ha, signature, etc.)
#   Distribution reports use distribution-phase fields (qty_bags, date_received, etc.)
# ─────────────────────────────────────────────────────────────

import io
from collections import defaultdict

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string

from apps.distribution.models import DistributionEvent, DistributionEntry
from apps.seed_poll.models import FinalSeed
from apps.accounts.permissions import IsAdminUserRole

from .models import ReportLog
from .serializers import ReportLogSerializer
from django.db.models import Q


# ─────────────────────────────────────────────────────────────
# EXCEL STYLE HELPERS
# ─────────────────────────────────────────────────────────────

def _thin_border():
    """Returns a uniform thin border on all 4 sides."""
    thin = Side(style='thin')
    return Border(left=thin, right=thin, top=thin, bottom=thin)


def _bold_font(size=9, color='000000'):
    return Font(bold=True, size=size, name='Arial', color=color)


def _normal_font(size=9, color='000000', italic=False):
    return Font(bold=False, size=size, name='Arial', color=color, italic=italic)


def _center(wrap=True):
    return Alignment(horizontal='center', vertical='center', wrap_text=wrap)


def _left(wrap=True):
    return Alignment(horizontal='left', vertical='center', wrap_text=wrap)


def _header_cell(ws, cell_ref, value, font_size=9, bg_color='1A4D1A',
                 font_color='FFFFFF'):
    """Write a styled dark-green header cell."""
    cell = ws[cell_ref]
    cell.value     = value
    cell.font      = Font(bold=True, size=font_size, name='Arial',
                          color=font_color)
    cell.fill      = PatternFill('solid', start_color=bg_color)
    cell.alignment = _center()
    cell.border    = _thin_border()
    return cell


def _write_row(ws, row_num, values, font_size=8, alt_row=False):
    """Write a data row with alternating background."""
    fill = PatternFill('solid', start_color='F0FDF4') if alt_row else None
    for col_idx, value in enumerate(values, start=1):
        cell = ws.cell(row=row_num, column=col_idx, value=value)
        cell.font      = _normal_font(font_size)
        cell.alignment = _center(False)
        cell.border    = _thin_border()
        if fill:
            cell.fill = fill


def _set_border_range(ws, start_coord, end_coord, border):
    """Apply a border to every cell in a merged range."""
    start_col, start_row = coordinate_from_string(start_coord)
    end_col, end_row = coordinate_from_string(end_coord)
    for col_idx in range(column_index_from_string(start_col), column_index_from_string(end_col) + 1):
        for row_idx in range(start_row, end_row + 1):
            ws.cell(row=row_idx, column=col_idx).border = border


def _dob_str(profile):
    """Format date of birth from farmer profile."""
    if profile and profile.date_of_birth:
        return profile.date_of_birth.strftime('%m/%d/%y')
    return '—'


def _yn(profile, field):
    """Return Y/N for a boolean profile field."""
    if profile and getattr(profile, field, False):
        return 'Y'
    return 'N'


def _embed_signature(ws, entry, row_num, col_letter, cell_width_px=110, cell_height_px=30):
    """
    Decodes entry.signature (base64 data URL: "data:image/png;base64,...")
    and embeds it as an actual image into the given cell, matching
    what the admin sees when clicking "View" in the Batch Detail modal.

    Leaves the cell blank if there is no signature — does not write any
    placeholder text. Silently skips on decode failure so a single bad
    signature can't break the whole report generation.
    """
    if not entry.signature:
        return

    try:
        import base64
        import io
        from PIL import Image as PILImage
        from openpyxl.drawing.image import Image as XLImage

        raw = entry.signature
        if ',' in raw and raw.strip().lower().startswith('data:'):
            raw = raw.split(',', 1)[1]

        img_bytes = base64.b64decode(raw)
        pil_img = PILImage.open(io.BytesIO(img_bytes)).convert('RGBA')

        # Resize to fit inside the signature cell while keeping aspect ratio
        pil_img.thumbnail((cell_width_px, cell_height_px), PILImage.LANCZOS)

        buf = io.BytesIO()
        pil_img.save(buf, format='PNG')
        buf.seek(0)

        xl_img = XLImage(buf)
        xl_img.width  = pil_img.width
        xl_img.height = pil_img.height

        cell_ref = f'{col_letter}{row_num}'
        ws.add_image(xl_img, cell_ref)
    except Exception:
        # If the signature data is malformed, don't crash report generation —
        # just leave that cell without an image.
        pass


# ─────────────────────────────────────────────────────────────
# SEED TYPE HELPERS
# Used to identify if an event is Hybrid (Region) or Inbred (PhilRice)
# ─────────────────────────────────────────────────────────────

def _is_region(event):
    """True if the event is a Hybrid / NRP / RFO (Region) program."""
    name = (event.seed_type.name if event.seed_type else '').upper()
    inter = (event.intervention or '').upper()
    return ('HYBRID' in name or 'HYBRID' in inter
            or inter in ('NRP', 'RFO'))


def _is_philrice(event):
    """True if the event is an Inbred / RCEF / PhilRice program."""
    name = (event.seed_type.name if event.seed_type else '').upper()
    inter = (event.intervention or '').upper()
    return ('INBRED' in name or 'INBRED' in inter
            or inter in ('RCEF', 'PHILRICE'))


# ─────────────────────────────────────────────────────────────
# REGION (HYBRID) MASTERLIST — Beneficiaries format
# DA RFO IV-A template — columns A–U
# ─────────────────────────────────────────────────────────────

def generate_region_masterlist(entries_qs, event):
    """
    Generates the DA Region IV-A Lists of Farmer-Beneficiaries
    for Hybrid/Region seeds. Matches the physical document format.

    Fields used: signing-phase data (farm_area_ha, qty_bags optional,
    farmer demographics, signature).
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Region Masterlist'

    # ── Column widths matching DA template ──
    widths = {
        'A': 4,  'B': 18, 'C': 14, 'D': 12, 'E': 12,
        'F': 7,  'G': 10, 'H': 12, 'I': 12, 'J': 12,
        'K': 12, 'L': 7,  'M': 5,  'N': 7,  'O': 5,
        'P': 5,  'Q': 5,  'R': 8,  'S': 7,  'T': 13,
        'U': 18,
    }
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    # ── Row 1: DA government header ──
    ws.merge_cells('H1:K1')
    ws['H1'] = (
        'Republic of the Philippines\n'
        'Department of Agriculture\n'
        'Regional Field Office No. IV-A\n'
        'LISTS OF FARMER-BENEFICIARIES'
    )
    ws['H1'].font      = _bold_font(9)
    ws['H1'].alignment = _center()
    ws.row_dimensions[1].height = 54

    # ── Rows 3–6: Event metadata ──
    meta = [
        ('A3', 'PROVINCE: QUEZON'),
        ('A4', 'MUNICIPALITY: LUCBAN'),
        ('A5', 'INTERVENTION: Hybrid Inbred Rice Seed (HIRS) — Region/NRP'),
    ]
    for ref, val in meta:
        ws.merge_cells(f'{ref[0]}3:{ref[0]}3') if '3' in ref else None
        ws[ref] = val
        ws[ref].font      = _bold_font()
        ws[ref].alignment = _left(False)

    # Variety on row 6
    variety_names = ', '.join(
        set(e.variety.name for e in entries_qs if e.variety)
    ) or '—'
    ws.merge_cells('A6:C6')
    ws['A6'] = f'Variety: {variety_names}'
    ws['A6'].font      = _bold_font()
    ws['A6'].alignment = _left(False)

    # Right-side meta
    ws.merge_cells('K3:P3')
    ws['K3'] = f'Name of Association/Organization: {event.organization_name}'
    ws['K3'].font      = _bold_font()
    ws['K3'].alignment = _left(False)

    ws.merge_cells('K4:P4')
    ws['K4'] = f'Total No. of Members: {event.total_members}'
    ws['K4'].font      = _bold_font()
    ws['K4'].alignment = _left(False)

    # ── Rows 8–10: Column headers ──
    ws.row_dimensions[8].height  = 28
    ws.row_dimensions[9].height  = 14
    ws.row_dimensions[10].height = 14

    # Merged main headers
    merged_headers = [
        ('A8', 'A10',  'No.'),
        ('B8', 'B10',  'SYSTEM GENERATED\nRSBSA NO:'),
        ('C8', 'F8',   'NAME OF BENEFICIARY (for individual)'),
        ('G8', 'G10',  'Date of Birth\n(MM/DD/YY)'),
        ('H8', 'I8',   'BENEFICIARY ADDRESS\n(RESIDENCY)'),
        ('J8', 'K8',   'FARM LOCATION'),
        ('L8', 'L10',  'Gender\n(M/F)'),
        ('M8', 'M10',  'IP\n(Y/N)'),
        ('N8', 'N10',  'Senior\nCitizen\n(Y/N)'),
        ('O8', 'O10',  'PWD\n(Y/N)'),
        ('P8', 'P10',  'ARBs\n(Y/N)'),
        ('Q8', 'Q10',  '4Ps\n(Y/N)'),
        ('R8', 'R10',  'Farm Area\n(ha)'),
        ('S8', 'S10',  'QTY.\n(bags)'),
        ('T8', 'T10',  'Contact no.'),
        ('U8', 'U10',  'SIGNATURE/\nTHUMBMARK'),
    ]
    for start, end, label in merged_headers:
        ws.merge_cells(f'{start}:{end}')
        ws[start] = label
        ws[start].font      = _bold_font(8, 'B91C1C' if 'BENEFICIARY ADDRESS' in label or 'FARM LOCATION' in label else '000000')
        ws[start].alignment = _center()
        _set_border_range(ws, start, end, _thin_border())

    # Name sub-headers
    sub_headers = [
        ('C9', 'C10', 'Last Name'),
        ('D9', 'D10', 'First Name'),
        ('E9', 'E10', 'Middle Name'),
        ('F9', 'F10', 'Ext.\nName'),
        ('H9', 'H10', 'Municipality'),
        ('I9', 'I10', 'Barangay'),
        ('J9', 'J10', 'Municipality'),
        ('K9', 'K10', 'Barangay'),
    ]
    for start, end, label in sub_headers:
        ws.merge_cells(f'{start}:{end}')
        ws[start] = label
        ws[start].font      = _bold_font(8)
        ws[start].alignment = _center()
        ws[start].border    = _thin_border()

    # ── Data rows starting at row 11 ──
    entries = list(entries_qs.select_related(
        'farmer', 'farmer__profile', 'variety', 'batch'
    ))
    current_row = 11

    for idx, entry in enumerate(entries):
        farmer  = entry.farmer
        profile = getattr(farmer, 'profile', None)

        row_values = [
            entry.row_number or (idx + 1),
            farmer.rsbsa_number or '—',
            farmer.last_name or '—',
            farmer.first_name or '—',
            (profile.middle_name if profile else '') or '—',
            (profile.ext_name    if profile else '') or '—',
            _dob_str(profile),
            (profile.residency_municipality if profile else '') or '—',
            (profile.residency_barangay     if profile else '') or '—',
            (profile.farm_municipality      if profile else '') or '—',
            (profile.farm_barangay          if profile else '') or '—',
            (profile.gender[0].upper() if profile and profile.gender else '—'),
            _yn(profile, 'ip'),
            _yn(profile, 'senior_citizen'),
            _yn(profile, 'pwd'),
            _yn(profile, 'arbs'),
            _yn(profile, 'four_ps'),
            entry.farm_area_ha or '—',
            entry.qty_bags or '—',
            farmer.contact_number or '—',
            '',
        ]


        ws.row_dimensions[current_row].height = 30
        _write_row(ws, current_row, row_values, alt_row=(idx % 2 == 1))
        # Embed the actual signature image (column U = Signature/Thumbmark)
        _embed_signature(ws, entry, current_row, 'U')
        current_row += 1

    # ── Signatories footer ──
    _write_signatories(ws, current_row + 2)

    return wb


# ─────────────────────────────────────────────────────────────
# PHILRICE (INBRED) MASTERLIST — Beneficiaries format
# FAR V8.0 format
# ─────────────────────────────────────────────────────────────

def generate_philrice_masterlist(entries_qs, event):
    """
    Generates the PhilRice / RCEF FAR V8.0 Farmer Acknowledgement
    format for Inbred seeds.

    Fields used: area_planted, data_sharing, and demographic data
    from the beneficiaries encoding phase.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'PhilRice Masterlist'

    widths = {
        'A': 4,  'B': 18, 'C': 16, 'D': 12, 'E': 12,
        'F': 10, 'G': 14, 'H': 12, 'I': 14, 'J': 10,
        'K': 18, 'L': 10, 'M': 12, 'N': 14, 'O': 18,
    }
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    # Title
    ws.merge_cells('A1:O1')
    ws['A1'] = 'FARMER ACKNOWLEDGEMENT RECEIPT — PhilRice / RCEF'
    ws['A1'].font      = _bold_font(12)
    ws['A1'].alignment = _center()
    ws.row_dimensions[1].height = 22

    # Meta row 2
    ws.merge_cells('A2:D2')
    ws['A2'] = f'Year/Season: {event.year} {event.get_season_display()}'
    ws['A2'].font      = _bold_font()
    ws['A2'].alignment = _left(False)

    ws.merge_cells('E2:H2')
    ws['E2'] = 'Drop-off Point: LUCBAN, QUEZON'
    ws['E2'].font      = _bold_font()
    ws['E2'].alignment = _left(False)

    ws.merge_cells('I2:O2')
    ws['I2'] = f'Organization: {event.organization_name}'
    ws['I2'].font      = _bold_font()
    ws['I2'].alignment = _left(False)

    # Column headers row 4
    headers = [
        'No.', 'RSBSA No.\n(FFRS System\nGenerated)',
        'Farmer Name\n(Last, First, Middle)',
        'Reg.\nMun.\nRice Area',
        'Area to be\nPlanted (ha)',
        'Number of\nBags\n(20kg)',
        'Rice Variety\nReceived',
        'Crop\nEstab\n(D/T)',
        'Expected\nSowing Date\n(Month/Week)',
        'Data\nSharing\n(✓/X)',
        '2025 DS YIELD\n(To be encoded\nin Yield menu)',
        'No. of\nKP Kits',
        'Authorized\nRep.',
        'Date\nReceived\n(MM/DD/YY)',
        'Signature of\nClaimant',
    ]
    ws.row_dimensions[4].height = 46
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col_idx, value=header)
        cell.font      = _bold_font(8, 'FFFFFF')
        cell.fill      = PatternFill('solid', start_color='1A4D1A')
        cell.alignment = _center()
        cell.border    = _thin_border()

    # Data rows starting at row 5
    entries = list(entries_qs.select_related('farmer', 'farmer__profile', 'variety'))
    current_row = 5

    for idx, entry in enumerate(entries):
        farmer  = entry.farmer
        profile = getattr(farmer, 'profile', None)

        row_values = [
            idx + 1,
            farmer.rsbsa_number or '—',
            farmer.get_full_name(),
            '—',   # Registered Mun Rice Area — from FFRS (not in our system)
            entry.area_planted or '—',
            entry.qty_bags or '—',
            entry.variety.name if entry.variety else '—',
            entry.crop_establishment or '—',
            getattr(entry, 'expected_sowing_date', '—') or '—',
            '✓' if entry.data_sharing else 'X',
            'To be encoded in Yield',
            '—',   # KP Kits — not in our system
            entry.authorized_representative or '—',
            entry.date_received.strftime('%m/%d/%y') if entry.date_received else '—',
            ''
        ]

        ws.row_dimensions[current_row].height = 30
        _write_row(ws, current_row, row_values, alt_row=(idx % 2 == 1))

        # Mark the placeholder yield column gray
        placeholder_cell = ws.cell(row=current_row, column=11)
        placeholder_cell.fill = PatternFill('solid', start_color='F3F4F6')
        placeholder_cell.font = _normal_font(8, '9CA3AF', italic=True)
        
        _embed_signature(ws, entry, current_row, 'O')

        current_row += 1

    # Footer signatories
    _write_signatories(ws, current_row + 2)

    return wb


# ─────────────────────────────────────────────────────────────
# DISTRIBUTION MASTERLIST — Region (Hybrid)
# Same structure as Region Beneficiaries but with updated
# distribution-phase data (qty_bags confirmed, date_received, etc.)
# ─────────────────────────────────────────────────────────────

def generate_distribution_region(entries_qs, event):
    """
    Distribution masterlist for Region/Hybrid seeds.
    Uses the same column structure as Region Masterlist but
    qty_bags here is the CONFIRMED distribution quantity,
    not the optional one from beneficiaries signing.

    Only entries that have qty_bags filled are considered
    'distributed'. Rows without qty_bags show as 'Pending'.
    """
    # Reuse the same generator — the data is the same table,
    # the difference is that the BRGY has now confirmed qty_bags
    # through the Distribution menu before admin approved.
    return generate_region_masterlist(entries_qs, event)


def generate_distribution_philrice(entries_qs, event):
    """
    Distribution masterlist for PhilRice/Inbred seeds.
    Same structure as PhilRice Masterlist but all distribution
    fields (qty_bags, date_received, crop_establishment, etc.)
    should now be fully filled since the BRGY encoded them
    in the Distribution menu before admin approved.
    """
    return generate_philrice_masterlist(entries_qs, event)


# ─────────────────────────────────────────────────────────────
# PLANTING ACCOMPLISHMENT REPORT
# Summary per barangay — not per farmer
# ─────────────────────────────────────────────────────────────

def generate_planting_report(entries_qs, season, year):
    """
    Generates the Planting Accomplishment Report.
    Groups data by barangay → program → variety.
    Shows: number of beneficiaries, total area, variety,
    crop establishment method, expected sowing date, bags.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Planting Accomplishment'

    widths = {
        'A': 5, 'B': 22, 'C': 18, 'D': 12, 'E': 12,
        'F': 14, 'G': 14, 'H': 16, 'I': 10,
    }
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    # Title
    ws.merge_cells('A1:I1')
    ws['A1'] = 'PLANTING ACCOMPLISHMENT REPORT'
    ws['A1'].font      = _bold_font(13)
    ws['A1'].alignment = _center(False)
    ws.row_dimensions[1].height = 22

    ws.merge_cells('A2:I2')
    ws['A2'] = (
        f'Municipal Agriculture Office — Lucban, Quezon  |  '
        f'{season} Season {year}'
    )
    ws['A2'].font      = _normal_font(10)
    ws['A2'].alignment = _center(False)
    ws.row_dimensions[2].height = 16

    # Column headers
    headers = [
        'No.', 'Barangay', 'Program',
        'No. of\nBeneficiaries', 'Total Area\nPlanted (ha)',
        'Variety', 'Crop\nEstab.', 'Expected\nSowing Date',
        'No. of\nBags',
    ]
    ws.row_dimensions[4].height = 32
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col_idx, value=header)
        cell.font      = _bold_font(9, 'FFFFFF')
        cell.fill      = PatternFill('solid', start_color='1A4D1A')
        cell.alignment = _center()
        cell.border    = _thin_border()

    # Group by barangay → event
    brgy_groups = defaultdict(list)
    for entry in entries_qs.select_related('batch__event', 'farmer', 'variety'):
        brgy_groups[entry.batch.event.barangay].append(entry)

    current_row = 5
    row_num = 1
    total_farmers = total_area = total_bags = 0

    for brgy in sorted(brgy_groups.keys()):
        brgy_entries = brgy_groups[brgy]
        # Sub-group by event (program) within barangay
        event_groups = defaultdict(list)
        for e in brgy_entries:
            event_groups[e.batch.event.id].append(e)

        for ev_entries in event_groups.values():
            ev = ev_entries[0].batch.event
            program = (
                'Hybrid (Region)'
                if _is_region(ev) else 'Inbred (PhilRice)'
            )
            area = sum(
                float(e.area_planted or e.farm_area_ha or 0)
                for e in ev_entries
            )
            bags = sum(int(e.qty_bags or 0) for e in ev_entries)
            varieties = ', '.join(
                set(e.variety.name for e in ev_entries if e.variety)
            ) or '—'
            estab = ', '.join(
                set(e.crop_establishment or '' for e in ev_entries
                    if e.crop_establishment)
            ) or '—'
            sowing = ', '.join(
                set(getattr(e, 'expected_sowing_date', '') or '' for e in ev_entries
                    if getattr(e, 'expected_sowing_date', ''))
            ) or '—'

            row_values = [
                row_num, brgy, program,
                len(ev_entries), round(area, 4),
                varieties, estab, sowing, bags,
            ]
            ws.row_dimensions[current_row].height = 15
            _write_row(ws, current_row, row_values,
                       alt_row=(current_row % 2 == 0))

            total_farmers += len(ev_entries)
            total_area    += area
            total_bags    += bags
            current_row   += 1
            row_num       += 1

    # Totals row
    ws.row_dimensions[current_row].height = 16
    totals = [
        '', 'TOTAL', '',
        total_farmers, round(total_area, 4),
        '', '', '', total_bags,
    ]
    for col_idx, value in enumerate(totals, start=1):
        cell = ws.cell(row=current_row, column=col_idx, value=value)
        cell.font      = _bold_font(9)
        cell.alignment = _center(False)
        cell.border    = _thin_border()
        cell.fill      = PatternFill('solid', start_color='DCFCE7')

    return wb


# ─────────────────────────────────────────────────────────────
# HARVESTING ACCOMPLISHMENT REPORT — Placeholder
# Harvest data comes from YieldEncode (not yet built)
# ─────────────────────────────────────────────────────────────

def generate_harvesting_report(entries_qs, season, year):
    """
    Generates the Harvesting Accomplishment Report structure.
    Harvest columns are placeholders — they will be populated
    once the Yield Encode feature is completed.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Harvest Accomplishment'

    widths = {
        'A': 5, 'B': 22, 'C': 18, 'D': 12, 'E': 12,
        'F': 14, 'G': 16, 'H': 16, 'I': 16, 'J': 14,
    }
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    # Title
    ws.merge_cells('A1:J1')
    ws['A1'] = 'HARVESTING ACCOMPLISHMENT REPORT'
    ws['A1'].font      = _bold_font(13)
    ws['A1'].alignment = _center(False)
    ws.row_dimensions[1].height = 22

    ws.merge_cells('A2:J2')
    ws['A2'] = (
        f'Municipal Agriculture Office — Lucban, Quezon  |  '
        f'{season} Season {year}'
    )
    ws['A2'].font      = _normal_font(10)
    ws['A2'].alignment = _center(False)
    ws.row_dimensions[2].height = 16

    # Notice banner
    ws.merge_cells('A3:J3')
    ws['A3'] = (
        'NOTE: Harvest data will be populated from the Yield Encode menu '
        'after the harvest season.'
    )
    ws['A3'].font      = _normal_font(9, '854D0E', italic=True)
    ws['A3'].fill      = PatternFill('solid', start_color='FEF9C3')
    ws['A3'].alignment = _left()
    ws.row_dimensions[3].height = 28

    # Headers
    headers = [
        'No.', 'Barangay', 'Program',
        'No. of\nBeneficiaries', 'Area\nPlanted (ha)',
        'Variety',
        'Area\nHarvested (ha)', 'Total\nProduction\n(bags)',
        'Ave. Yield\n(bags/ha)', 'Remarks',
    ]
    ws.row_dimensions[5].height = 36
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=5, column=col_idx, value=header)
        cell.font      = _bold_font(9, 'FFFFFF')
        cell.fill      = PatternFill('solid', start_color='1A4D1A')
        cell.alignment = _center()
        cell.border    = _thin_border()

    brgy_groups = defaultdict(list)
    for entry in entries_qs.select_related('batch__event', 'farmer', 'variety'):
        brgy_groups[entry.batch.event.barangay].append(entry)

    current_row = 6
    row_num = 1

    for brgy in sorted(brgy_groups.keys()):
        brgy_entries = brgy_groups[brgy]
        event_groups = defaultdict(list)
        for e in brgy_entries:
            event_groups[e.batch.event.id].append(e)

        for ev_entries in event_groups.values():
            ev = ev_entries[0].batch.event
            program = (
                'Hybrid (Region)' if _is_region(ev) else 'Inbred (PhilRice)'
            )
            area = sum(
                float(e.area_planted or e.farm_area_ha or 0)
                for e in ev_entries
            )
            varieties = ', '.join(
                set(e.variety.name for e in ev_entries if e.variety)
            ) or '—'

            row_values = [
                row_num, brgy, program,
                len(ev_entries), round(area, 4),
                varieties,
                '—', '—', '—',
                'Pending harvest data',
            ]
            ws.row_dimensions[current_row].height = 15

            for col_idx, value in enumerate(row_values, start=1):
                cell = ws.cell(row=current_row, column=col_idx, value=value)
                cell.font      = _normal_font(9)
                cell.alignment = _center(False)
                cell.border    = _thin_border()
                # Gray out the pending harvest columns
                if col_idx in [7, 8, 9, 10]:
                    cell.fill = PatternFill('solid', start_color='F9FAFB')
                    cell.font = _normal_font(9, '9CA3AF', italic=True)
                elif current_row % 2 == 0:
                    cell.fill = PatternFill('solid', start_color='F0FDF4')

            current_row += 1
            row_num     += 1

    return wb


# ─────────────────────────────────────────────────────────────
# SHARED FOOTER HELPER
# ─────────────────────────────────────────────────────────────

def _write_signatories(ws, start_row):
    """
    Writes the Prepared by / Approved by / Noted by signatory footer.
    Adjust names as needed per actual MAO staff.
    """
    r = start_row
    ws.row_dimensions[r].height   = 12
    ws.row_dimensions[r+2].height = 12
    ws.row_dimensions[r+3].height = 12

    ws.merge_cells(f'B{r}:D{r}')
    ws[f'B{r}'] = 'Prepared by:'
    ws[f'B{r}'].font = _bold_font()

    ws.merge_cells(f'G{r}:H{r}')
    ws[f'G{r}'] = 'Approved by:'
    ws[f'G{r}'].font = _bold_font()

    ws.merge_cells(f'M{r}:O{r}')
    ws[f'M{r}'] = 'Noted by:'
    ws[f'M{r}'].font = _bold_font()

    ws.merge_cells(f'B{r+2}:D{r+2}')
    ws[f'B{r+2}'] = 'RANDY F. LEONIDO'
    ws[f'B{r+2}'].font = Font(bold=True, size=9,
                               underline='single', name='Arial')

    ws.merge_cells(f'G{r+2}:H{r+2}')
    ws[f'G{r+2}'] = 'JOANNA LYNN P. GONZALES'
    ws[f'G{r+2}'].font = Font(bold=True, size=9,
                               underline='single', name='Arial')

    ws.merge_cells(f'B{r+3}:D{r+3}')
    ws[f'B{r+3}'] = 'Agricultural Technician'
    ws[f'B{r+3}'].font = _normal_font()

    ws.merge_cells(f'G{r+3}:H{r+3}')
    ws[f'G{r+3}'] = 'OIC Municipal Agriculturist'
    ws[f'G{r+3}'].font = _normal_font()


# ─────────────────────────────────────────────────────────────
# HELPER: Build filtered entry queryset
# ─────────────────────────────────────────────────────────────

def _build_entry_qs(report_type, season, year, barangay, seed_type_filter=None):
    """
    Builds the base DistributionEntry queryset filtered by:
    - Only APPROVED batches
    - Season, year, barangay (optional)
    - Seed type (Hybrid/Region or Inbred/PhilRice based on report type)

    For Beneficiaries reports: uses all approved entries.
    For Distribution reports: only entries that have qty_bags filled
    (meaning distribution was encoded and approved).
    """
    qs = DistributionEntry.objects.filter(
        batch__status='APPROVED'
    ).select_related(
        'farmer', 'farmer__profile', 'variety',
        'batch', 'batch__event', 'batch__event__seed_type'
    )

    if season:
        season = season.strip().upper()
        qs = qs.filter(batch__event__season=season)
    if year:
        try:
            year_int = int(str(year).strip())
            qs = qs.filter(batch__event__year=year_int)
        except (ValueError, TypeError):
            pass
    if barangay:
        qs = qs.filter(batch__event__barangay__iexact=barangay.strip())

    # Filter by seed type based on report type
    if report_type in ('REGION_MASTERLIST', 'DISTRIBUTION_REGION'):
        # Hybrid / Region seeds — check event intervention or seed type name
        qs = qs.filter(
            Q(batch__event__intervention__in=['NRP', 'RFO']) |
            Q(batch__event__intervention__icontains='HYBRID') |
            Q(batch__event__seed_type__name__icontains='HYBRID') |
            Q(batch__event__seed_type__name__icontains='REGION')
        )
    elif report_type in ('PHILRICE_MASTERLIST', 'DISTRIBUTION_PHILRICE'):
        # Inbred / PhilRice seeds — check event intervention or seed type name
        qs = qs.filter(
            Q(batch__event__intervention__in=['RCEF']) |
            Q(batch__event__intervention__icontains='INBRED') |
            Q(batch__event__intervention__icontains='PHILRICE') |
            Q(batch__event__seed_type__name__icontains='INBRED') |
            Q(batch__event__seed_type__name__icontains='PHILRICE')
        )

    # Keep beneficiaries and distribution data separate
    if report_type in ('REGION_MASTERLIST', 'PHILRICE_MASTERLIST'):
        qs = qs.filter(qty_bags__isnull=True)
    elif report_type in ('DISTRIBUTION_REGION', 'DISTRIBUTION_PHILRICE'):
        qs = qs.filter(qty_bags__isnull=False)

    return qs.order_by('batch__id', 'row_number')


# ─────────────────────────────────────────────────────────────
# API: Filter Options
# Returns available seasons, years, barangays + current final seed
# ─────────────────────────────────────────────────────────────

class ReportFilterOptionsView(APIView):
    """
    GET /api/reports/filter-options/

    Returns:
    - seasons: list of available seasons from approved batches
    - years: list of available years (newest first)
    - barangays: list of barangays with approved batches
    - current_season: the season/year from the latest FinalSeed
      (used to pre-fill filters with the current active season)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get all approved distribution events
        events = DistributionEvent.objects.filter(
            batches__status='APPROVED'
        ).distinct()

        seasons   = sorted(set(ev.season    for ev in events))
        years     = sorted(set(ev.year      for ev in events), reverse=True)
        barangays = sorted(set(ev.barangay  for ev in events))

        # Get the current/latest FinalSeed to pre-fill the default filter
        # FinalSeed is the model storing the admin's finalized seed choices
        current_season = None
        current_year   = None
        try:
            from apps.seed_poll.models import FinalSeed as FS
            latest = FS.objects.order_by('-created_at').first()
            if latest:
                current_season = latest.season
                current_year   = latest.year
        except Exception:
            pass

        return Response({
            'seasons':        seasons,
            'years':          years,
            'barangays':      barangays,
            'current_season': current_season,
            'current_year':   current_year,
        })


# ─────────────────────────────────────────────────────────────
# API: Preview
# Returns JSON data for frontend table preview
# ─────────────────────────────────────────────────────────────

class ReportPreviewView(APIView):
    """
    GET /api/reports/preview/
    Query params: report_type, season, year, barangay, seed_type

    Returns JSON rows for the frontend to display in a preview
    table before the admin confirms the Excel download.
    Does NOT generate Excel — just serializes the data.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get('report_type', '')
        season      = request.query_params.get('season', '')
        year        = request.query_params.get('year', '')
        barangay    = request.query_params.get('barangay', '')

        if not report_type:
            return Response(
                {'error': 'report_type is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        qs = _build_entry_qs(report_type, season, year, barangay)

        rows = []
        for entry in qs:
            farmer  = entry.farmer
            profile = getattr(farmer, 'profile', None)
            rows.append({
                'id':              entry.id,
                'row_number':      entry.row_number,
                'rsbsa':           farmer.rsbsa_number or '—',
                'last_name':       farmer.last_name or '—',
                'first_name':      farmer.first_name or '—',
                'middle_name':     (profile.middle_name if profile else '') or '—',
                'date_of_birth':   _dob_str(profile),
                'res_municipality':(profile.residency_municipality if profile else '') or '—',
                'res_barangay':    (profile.residency_barangay     if profile else '') or '—',
                'farm_municipality':(profile.farm_municipality     if profile else '') or '—',
                'farm_barangay':   (profile.farm_barangay          if profile else '') or '—',
                'gender':          (profile.gender[0].upper() if profile and profile.gender else '—'),
                'ip':              _yn(profile, 'ip'),
                'senior_citizen':  _yn(profile, 'senior_citizen'),
                'pwd':             _yn(profile, 'pwd'),
                'arbs':            _yn(profile, 'arbs'),
                'four_ps':         _yn(profile, 'four_ps'),
                'farm_area_ha':    str(entry.farm_area_ha)  if entry.farm_area_ha  else '—',
                'area_planted':    str(entry.area_planted)  if entry.area_planted  else '—',
                'qty_bags':        entry.qty_bags or '—',
                'variety_name':    entry.variety.name if entry.variety else '—',
                'crop_establishment':   entry.crop_establishment or '—',
                'data_sharing':    entry.data_sharing,
                'date_received':   (
                    entry.date_received.strftime('%m/%d/%y')
                    if entry.date_received else '—'
                ),
                'authorized_representative': entry.authorized_representative or '—',
                'contact':         farmer.contact_number or '—',
                'has_signature':   bool(entry.signature),
                'barangay':        entry.batch.event.barangay,
                'organization':    entry.batch.event.organization_name,
                'season':          entry.batch.event.season,
                'year':            entry.batch.event.year,
                'intervention':    entry.batch.event.intervention,
            })

        return Response({
            'count': len(rows),
            'rows':  rows,
        })
    
    


# ─────────────────────────────────────────────────────────────
# API: Download
# Generates and streams the Excel file
# ─────────────────────────────────────────────────────────────

class ReportDownloadView(APIView):
    """
    GET /api/reports/download/
    Query params: report_type, season, year, barangay

    Generates the Excel workbook and streams it as a file download.
    Also records the generation in ReportLog.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get('report_type', '')
        season      = request.query_params.get('season', '')
        year        = request.query_params.get('year', '')
        barangay    = request.query_params.get('barangay', '')

        if not report_type:
            return Response(
                {'error': 'report_type is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        qs = _build_entry_qs(report_type, season, year, barangay)

        if not qs.exists():
            return Response(
                {'error': 'No approved data found for the selected filters.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get a representative event for header metadata
        first_event = qs.first().batch.event

        # ── Route to the correct generator ──
        if report_type == 'REGION_MASTERLIST':
            wb       = generate_region_masterlist(qs, first_event)
            filename = f'Region_Masterlist_{season}_{year}'
        elif report_type == 'PHILRICE_MASTERLIST':
            wb       = generate_philrice_masterlist(qs, first_event)
            filename = f'PhilRice_Masterlist_{season}_{year}'
        elif report_type == 'DISTRIBUTION_REGION':
            wb       = generate_distribution_region(qs, first_event)
            filename = f'Distribution_Region_{season}_{year}'
        elif report_type == 'DISTRIBUTION_PHILRICE':
            wb       = generate_distribution_philrice(qs, first_event)
            filename = f'Distribution_PhilRice_{season}_{year}'
        elif report_type == 'PLANTING_REPORT':
            wb       = generate_planting_report(qs, season, year)
            filename = f'Planting_Report_{season}_{year}'
        elif report_type == 'HARVESTING_REPORT':
            wb       = generate_harvesting_report(qs, season, year)
            filename = f'Harvesting_Report_{season}_{year}'
        else:
            return Response(
                {'error': f'Unknown report type: {report_type}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if barangay:
            filename += f'_{barangay}'

        # ── Log the generation ──
        ReportLog.objects.create(
            report_type  = report_type,
            generated_by = request.user,
            season       = season or None,
            year         = int(year) if year else None,
            barangay     = barangay or None,
        )

        # ── Stream Excel to browser ──
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type=(
                'application/vnd.openxmlformats-officedocument'
                '.spreadsheetml.sheet'
            )
        )
        response['Content-Disposition'] = (
            f'attachment; filename="{filename}.xlsx"'
        )
        return response


# ─────────────────────────────────────────────────────────────
# API: Report Logs
# ─────────────────────────────────────────────────────────────

class ReportLogListView(APIView):
    """
    GET /api/reports/logs/
    Returns the last 50 generated reports for the history log.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = ReportLog.objects.select_related(
            'generated_by'
        ).all()[:50]
        return Response(ReportLogSerializer(logs, many=True).data)