# Dry/Wet Season Implementation Summary

## Overview
The Agrice system implements a dual-season agricultural management framework distinguishing between **Wet Season (WET)** and **Dry Season (DRY)**. Seasons are tracked across seed inventory, distribution, crop monitoring, production, polling, and reporting.

---

## 1. Season Fields in Models

### Season Choices Definition
Standardized across the system:
```python
SEASON_CHOICES = [('WET', 'Wet Season'), ('DRY', 'Dry Season')]
```

### Models with Season Fields

#### **seed_inventory.models.SeedDelivery**
- **Field**: `season` (CharField, max_length=10, choices=SEASON_CHOICES)
- **Related fields**: `year` (PositiveIntegerField)
- **Purpose**: Records seed deliveries by season/year
- **Used to**: Filter deliveries by season in `SeedDeliveryListCreateView`
- **Display method**: `season_display` property returns "Wet Season" or "Dry Season"

```python
# Query filtering example
qs = qs.filter(season=season)  # seed_inventory/views.py line 35
```

#### **distribution.models.DistributionEvent**
- **Field**: `season` (CharField with inline choices)
- **Related fields**: `year`, `barangay`, `intervention` (program type), `organization_name`
- **Purpose**: Tracks seed distribution events per season/program/barangay
- **Business use**: 
  - Separates farmer groups by planting season
  - Links to barangay-level distribution campaigns
  - Used in report generation with `get_season_display()`

```python
season = models.CharField(max_length=3, choices=(('WET', 'Wet Season'), ('DRY', 'Dry Season')))
```

#### **seed_poll.models.Poll**
- **Field**: `season` (CharField, max_length=3, choices=SEASON_CHOICES)
- **Related fields**: `year`, `end_date`, `status` (OPEN/LOCKED/CLOSED)
- **Purpose**: One seed preference poll per active season (WET or DRY)
- **Constraint**: Only ONE poll can be OPEN at a time per season
- **Business logic**: 
  - Farmers vote on preferred seed varieties for upcoming season
  - Results inform `FinalSeed` selection

```python
# Poll auto-closes when end_date passes
if timezone.now() > self.end_date:
    return False  # Not accepting votes
```

#### **reports.models.ReportLog**
- **Field**: `season` (CharField, max_length=10, null=True, blank=True)
- **Purpose**: Audit trail for report generation; stores which season was filtered
- **Usage**: Historical record of when reports were generated

#### **seed_poll.models.FinalSeed**
- **Field**: `season` (CharField with inline choices)
- **Purpose**: Stores finalized seed choices AFTER poll closes
- **Uniqueness**: Unique constraint on (season, year)
- **Business use**: Determines which varieties BrgyDistribution will use

```python
season = models.CharField(max_length=10, choices=[('WET','Wet Season'),('DRY','Dry Season')])
```

---

## 2. Seed Inventory Management by Season

### SeedDelivery Model Structure
```python
class SeedDelivery(models.Model):
    SEASON_CHOICES = [('WET', 'Wet Season'), ('DRY', 'Dry Season')]
    
    seed_type      # FK to SeedType (Hybrid, Inbred, etc.)
    variety        # FK to SeedVariety
    season         # WET or DRY
    year           # e.g., 2026
    source         # REGION (NRP/RFO) or PHILRICE (RCEF)
    total_bags     # Total seed bags delivered
    delivery_date  # When seeds arrived
    
    @property
    def allocated_bags      # Sum of allocations
    @property
    def remaining_bags      # total_bags - allocated_bags
    @property
    def season_display      # Returns "Wet Season" or "Dry Season"
```

### Allocation Flow
1. **Admin creates SeedDelivery** with season/year info
2. **BrgyAllocation records** divide delivery by barangay
3. **Status tracking**: PENDING → CONFIRMED RECEIVED
4. **Audit trail**: `SeedDeliveryAudit` logs all changes

### View Filtering
[seed_inventory/views.py](backend/apps/seed_inventory/views.py#L32-L35):
```python
season = self.request.query_params.get('season')
if season:
    qs = qs.filter(season=season)  # Filter deliveries by season
```

---

## 3. Distribution Events and Season-Based Programs

### DistributionEvent Links Season to Programs
```python
class DistributionEvent(models.Model):
    barangay              # Where distribution happens
    intervention          # RCEF, NRP, RFO, OTHER
    season                # WET or DRY
    year                  # Planting year
    organization_name     # Farmer association
    total_members         # Expected farmers
    status                # ACTIVE or CLOSED
    seed_delivered        # Boolean confirmation
```

### Business Logic
- **One event per season/barangay/program combination**
- Each event contains multiple `DistributionBatch` (max 10 farmers/batch)
- Each batch contains `DistributionEntry` (one farmer row)
- Season determines **when seeds are distributed** for upcoming planting

### Season Used in Reports
[reports/views.py](backend/apps/reports/views.py#L762):
```python
qs = qs.filter(batch__event__season=season)  # Filter entries by distribution season
```

**Report types by season**:
- Beneficiaries Masterlist (Region/PhilRice) — lists who received seeds
- Distribution Masterlist — confirms distribution
- **Planting Accomplishment Report** — grouped by season/variety
- **Harvesting Accomplishment Report** — grouped by season (placeholder for harvest data)

---

## 4. Seed Polling and Season-Specific Votes

### Poll Lifecycle per Season

#### 1. **Admin Creates Poll**
- Title: e.g., "Wet Season 2026 Seed Preference Poll"
- Season: WET or DRY
- Year: 2026
- Status: OPEN (accepting votes)
- Auto-closes when `end_date` passes

#### 2. **Farmers Vote**
[seed_poll/views.py](backend/apps/seed_poll/views.py#L530):
```python
vote, created = PollVote.objects.get_or_create(
    poll=poll,
    farmer=request.user,
    defaults={'hybrid_choice': hybrid_choice, 'inbred_choice': inbred_choice}
)
```
- Each farmer votes ONCE per poll for hybrid + inbred varieties
- Farmers can update their vote before poll closes
- **Auto-close logic**: 
  ```python
  Poll.objects.filter(status='OPEN', end_date__lte=timezone.now()).update(status='CLOSED')
  ```

#### 3. **Admin Locks/Closes Poll**
- OPEN → LOCKED (admin manually stops voting) → Results visible
- OPEN → CLOSED (auto-closed when end_date passed)
- Cannot reopen poll once locked/closed

#### 4. **FinalSeed Selection**
[seed_poll/views.py](backend/apps/seed_poll/views.py#L529):
```python
FinalSeed.objects.filter(season=latest_poll.season, year=latest_poll.year).delete()
# Then recreate with tallied results
FinalSeed.objects.create(
    season=latest_poll.season,
    year=latest_poll.year,
    hybrid_variety=...,
    inbred_variety=...
)
```
- Finalized seed varieties stored per season/year
- Used by BrgyDistribution to set default seed types

---

## 5. Crop Monitoring and Season Context

### CropMonitoringRecord Model
```python
class CropMonitoringRecord(models.Model):
    farmer            # Who is being monitored
    encoded_by        # AT who visited
    barangay          # Where the farm is
    
    crop_phase        # DISTRIBUTION, ESTABLISHMENT, TILLERING, FLOWERING, RIPENING, HARVESTING
    crop_establishment  # DS (Direct Seeding) or TP (Transplanting)
    phase_status      # NORMAL, DELAYED, DAMAGED
    delay_days        # If delayed
    
    sowing_date       # When farmer planted
    variety_name      # Crop variety observed
    seed_source       # HYBRID, INBRED, OWN_SEED
    
    date_observed     # When AT visited
```

### Season Context (Implicit)
- **No explicit season field** in CropMonitoringRecord
- Season inferred from **sowing_date** (WET vs DRY planting dates)
- Used to track progress through planting phases in correct season
- GIS map aggregates by `BarangayCropSummary` showing dominant phase per barangay

---

## 6. Production Analytics and Harvest Data

### HarvestRecord Model (No Direct Season Field)
```python
class HarvestRecord(models.Model):
    farmer              # Which farmer
    barangay            # Which barangay
    seed_source         # HYBRID, INBRED, OWN_SEED
    variety             # Crop variety harvested
    harvest_area_ha     # Area harvested
    harvest_bags        # Total bags harvested
    seed_bags_received  # How many distributed seed bags used
    harvest_date        # When harvested
    weight_type         # FRESH or DRIED
    moisture_content_pct # For dry weight calculation (default 12%)
```

### Dry Weight Calculations
[production/views.py](backend/apps/production/views.py#L25-L29):
```python
def dry_weight_kg(record):
    """Convert harvest to dry weight kg based on weight_type and moisture."""
    bags = float(record.harvest_bags or 0)
    raw_kg = bags * 50  # 50 kg per bag standard
    if record.weight_type == 'DRIED':
        return raw_kg
    moisture = float(record.moisture_content_pct or 12)
    return raw_kg * (1 - moisture / 100)  # DA standard: 12% moisture
```

### Production Metrics (Season-Independent)
```python
def utilization_pct(record):
    """Utilization = (actual dry kg / expected kg) × 100"""
    area = float(record.harvest_area_ha or 0)
    src = record.seed_source or 'OWN_SEED'
    standard = STANDARD_YIELD_KG.get(src, 2000)  # kg/ha
    expected = area * standard
    if expected == 0:
        return None
    return (dry_weight_kg(record) / expected) * 100
```

**Yield-Based Production Tiers** (not season-specific):
- ≥200%: Master Farmer
- ≥150%: Exceptional
- ≥100%: Excellent
- ≥75%: Good
- ≥50%: Below target
- <50%: Needs attention

### Production Views (Season Aggregation via Query Params)
[production/views.py](backend/apps/production/views.py#L60-L130):
- **ProductionSummaryView**: Overall metrics across all farmers
- **ProductionBySeedTypeView**: Grouped by HYBRID/INBRED/OWN_SEED
- **ProductionByBarangayView**: Grouped by barangay
- **ProductionLowPerformersView**: Farmers below threshold
- Top performers identified by utilization percentage

---

## 7. DA Constants and Configuration

### Settings (backend/config/settings.py)
```python
# Seeding density (kg/ha) per seed type - DA standard
SEEDING_DENSITY = {
    'HYBRID': 15,       # kg/ha
    'INBRED': 40,       # kg/ha
    'OWN_SEED': 15,     # kg/ha
}

# Standard yield (kg/ha dry weight) per seed type
STANDARD_YIELDS = {
    'HYBRID': 4000,     # kg/ha
    'INBRED': 1500,     # kg/ha
    'OWN_SEED': 2000,   # kg/ha
}
```

These are **season-independent** — same standards apply to both WET and DRY seasons.

---

## 8. Report Generation with Season Filtering

### Report Types Filtered by Season

#### [reports/views.py](backend/apps/reports/views.py#L742-L762)
```python
def _build_entry_qs(report_type, season, year, barangay, seed_type_filter=None):
    """
    Builds the base DistributionEntry queryset filtered by:
    - Season, year, barangay
    - Seed type (Hybrid/Region or Inbred/PhilRice based on report type)
    """
    season = season.strip().upper()
    qs = qs.filter(batch__event__season=season)
```

#### Report Structure by Season
1. **Beneficiaries Masterlist** (Region/PhilRice formats)
   - Shows: Farmer demographics, farm area, seed varieties
   - Season appears in metadata
   
2. **Distribution Masterlist**
   - Shows: Confirmed qty_bags, date_received per farmer
   - Season filtered from DistributionEvent

3. **Planting Accomplishment Report**
   - **Year/Season header**: "{season} Season {year}"
   - Grouped by: Barangay → Program → Variety
   - Shows: Beneficiaries, area, crop establishment method, bags

4. **Harvesting Accomplishment Report**
   - **Year/Season header**: "{season} Season {year}"
   - Shows: Area planted, area harvested, production (placeholder)
   - Pending harvest data from YieldEncode

---

## 9. Key Business Logic Summary

### Wet Season vs Dry Season Workflow

| Phase | Wet Season | Dry Season | Notes |
|-------|-----------|-----------|-------|
| **Poll** | Vote on WET varieties | Vote on DRY varieties | Admin creates one poll per season |
| **Finalization** | FinalSeed selected for WET | FinalSeed selected for DRY | Results stored by season/year |
| **Delivery** | Seeds arrive for WET | Seeds arrive for DRY | SeedDelivery recorded by season |
| **Distribution** | BRGY distributes WET seeds | BRGY distributes DRY seeds | DistributionEvent per season |
| **Planting** | Farmers sow WET season crop | Farmers sow DRY season crop | CropMonitoringRecord tracks phases |
| **Monitoring** | AT monitors WET crop growth | AT monitors DRY crop growth | Phases: DISTRIBUTION → HARVESTING |
| **Harvest** | Farmers harvest WET season | Farmers harvest DRY season | HarvestRecord; dry weight calculated |
| **Reporting** | Reports filtered to WET | Reports filtered to DRY | All metrics aggregated by season |

### Season as Organizational Principle
- **Unique constraint**: (season, year) on FinalSeed and Poll
- **Filter key**: All major queries use season + year to isolate data
- **Report metadata**: Season/year displayed in all output documents
- **Audit trail**: ReportLog records which season was filtered

---

## 10. Code Snippets

### Filtering by Season in Views

**Seed Inventory** [seed_inventory/views.py#L32-L35](backend/apps/seed_inventory/views.py#L32-L35):
```python
season = self.request.query_params.get('season')
if season:
    qs = qs.filter(season=season)
```

**Distribution** [reports/views.py#L761-L762](backend/apps/reports/views.py#L761-L762):
```python
season = season.strip().upper()
qs = qs.filter(batch__event__season=season)
```

**Seed Poll** [seed_poll/views.py#L470](backend/apps/seed_poll/views.py#L470):
```python
qs = qs.filter(season=season, year=int(year))
```

### Display Methods

**SeedDelivery** [seed_inventory/models.py#L46](backend/apps/seed_inventory/models.py#L46):
```python
@property
def season_display(self):
    return dict(self.SEASON_CHOICES).get(self.season, self.season)
```

**Report Metadata** [reports/views.py](backend/apps/reports/views.py):
```python
f'Year/Season: {event.year} {event.get_season_display()}'
f'{season} Season {year}'
```

---

## 11. Related Models and ForeignKeys

```
Season Relationships:
├── seed_inventory
│   └── SeedDelivery (season + year) → BrgyAllocation
├── distribution  
│   └── DistributionEvent (season + year) → DistributionBatch → DistributionEntry
├── seed_poll
│   ├── Poll (season + year) → PollVote
│   └── FinalSeed (season + year) 
├── crop_monitoring
│   └── CropMonitoringRecord (implicit season via sowing_date)
├── production
│   └── HarvestRecord (implicit season via harvest_date)
└── reports
    ├── ReportLog (season + year filters)
    └── Generated reports filtered by DistributionEvent.season
```

---

## 12. Summary Insights

1. **Season is a core organizational principle** — not just metadata
2. **Two-tier filtering**: Season + Year uniquely identifies a cycle
3. **Poll-driven**: Seed varieties selected per season via farmer voting
4. **Delivery-driven**: Physical seed inventory tracked by season
5. **Monitoring-driven**: Crop growth tracked through phases within season
6. **Production-driven**: Harvest and utilization metrics per season
7. **Reporting-driven**: All formal documents filtered/grouped by season
8. **DA Standards apply uniformly** — yield/seeding density independent of season
9. **Dry weight calculations standardized** — 12% moisture default regardless of season
10. **Audit trail preserved** — Season recorded in ReportLog and DistributionAudit
