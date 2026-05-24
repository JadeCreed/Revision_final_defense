# SYSTEM FLOW ANALYSIS & MENU REQUIREMENTS
**Generated: May 24, 2026**

---

## 1. CURRENT SYSTEM STATE OVERVIEW

### ✅ What's Already Implemented

**Backend (Production App):**
- ✅ HarvestRecord model (12 fields)
- ✅ API endpoints (CRUD: POST, GET, PATCH, DELETE)
- ✅ HarvestRecordSerializer (computed fields for metrics)
- ✅ Permission scoping (BRGY users see only their barangay data)
- ✅ Database migration applied

**Frontend (BRGY):**
- ✅ BrgyHarvest.jsx component (fully functional)
  - Searchable farmer picker
  - Seed source selection (HYBRID, INBRED, OWN_SEED)
  - Form validation
  - Live metric preview
  - Records list with edit/delete
  - Summary tab with breakdown by seed type
  
### ⚠️ What's Missing or Incomplete

| What | Status | Issue |
|------|--------|-------|
| **BRGY Harvest Menu Item** | ❌ MISSING | Page exists but NOT in MenuConfig.js |
| **Admin Production Page** | ⚠️ STUB | Just placeholder text, no actual features |
| **AT Harvest Menu** | ❌ NOT NEEDED YET | AT only monitors, doesn't encode harvest |
| **Farmer Harvest/Yield Page** | ⚠️ STUB | Page exists but empty (YieldEncode.jsx) |
| **Fresh/Dry Weight Toggle** | ⚠️ PENDING | Form needs update for new fields |
| **Model Updates** | ⚠️ PENDING | Need 6 new fields/properties |

---

## 2. CURRENT MENU STRUCTURE

### ADMIN Menu (/admin)
```
📊 Dashboard
🌱 Seed Poll
📢 Announcement
📦 Seed Inventory
👥 Beneficiaries
🚚 Distribution
🌾 Crop Phase
📈 Production          ← STUB (empty page)
🗺️ GIS Map
└─ User Management (submenu)
   ├─ Farmer Accounts
   ├─ Farmer Masterlist
   ├─ Officials
   ├─ Reset Requests
   └─ Archive
📋 Reports
⚙️ Settings
```

### BRGY Menu (/brgy)
```
📊 Dashboard
👨‍🌾 Farmers
👥 Beneficiaries
🚚 Distribution
🌾 Crop Phase
📢 Announcements
📋 Reports
```
❌ **MISSING:** Harvest/Yield Encode (should be after Distribution)
✅ **EXISTS but HIDDEN:** BrgyHarvest.jsx at `/brgy/harvest` (not in menu)

### AT Menu (/at)
```
📊 Dashboard
🌾 Crop Monitoring     ← AT records crop phases (not harvest)
👨‍🌾 Farmers
🗺️ GIS Map
📋 Reports
📢 Announcements
```

### FARMER Menu (/farmer)
```
📊 Dashboard
👤 My Profile
🌾 Crop Monitoring     ← STUB (empty YieldEncode.jsx)
📢 Announcements
🌱 Seed Poll
```

---

## 3. CORRECT SYSTEM FLOW - 5 PHASES

### Phase 1: Beneficiary Registration
- **Who:** Admin, BRGY
- **What:** Register farmers as program beneficiaries
- **Where:** Admin Beneficiaries, BRGY Beneficiaries
- **Data:** Farmer profile, farm location, area

### Phase 2: Seed Distribution  
- **Who:** Admin (approves), BRGY (encodes)
- **What:** Distribute seeds to farmers
- **Where:** Admin Distribution, BRGY Distribution
- **Data:** Variety, seed type, quantity (bags), farm area planned, signature

### Phase 3: Crop Monitoring
- **Who:** AT (field visits every 2 weeks)
- **What:** Monitor crop phases, document health
- **Where:** AT Crop Monitoring
- **Data:** Phase, establishment method, status (normal/delayed/damaged), area planted, observations

### Phase 4: Harvest Recording
- **Who:** BRGY President (meeting with farmers)
- **What:** Record harvest output BY SEED TYPE (multiple entries per farmer)
- **Where:** **BRGY Harvest** ← Currently missing from menu
- **Data:** Harvest amount, weight type (fresh/dry), variety, notes, date
- **System:** One farmer = multiple HarvestRecords (one per seed type)

### Phase 5: Production Analysis
- **Who:** Admin, MAO leadership
- **What:** View harvest data, generate reports, analytics
- **Where:** **Admin Production** ← Currently empty stub
- **Data:** Total production, yield metrics, utilization %, by barangay/seed type

---

## 4. DETAILED MENU REQUIREMENTS

### A. BRGY HARVEST MENU
**Status:** ❌ **NOT IN MENU** (page exists at `/brgy/harvest`)

**What it should show:**
```
┌─────────────────────────────────────────────────┐
│ HARVEST RECORDS                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ [+ Encode Harvest]                              │
│                                                 │
│ Summary Cards:                                  │
│ ├─ Total Farmers: X harvest records             │
│ ├─ Total Area: X.XX ha                          │
│ ├─ Total Production: XXX bags (XX MT)           │
│ └─ Average Yield: X.X t/ha                      │
│                                                 │
│ Tabs:                                           │
│ ├─ [Records] [Summary]                          │
│                                                 │
│ Records Tab:                                    │
│ ├─ Search field                                 │
│ ├─ Filter by seed type (All/HYBRID/INBRED)     │
│ ├─ Records list                                 │
│ │  ├─ Record 1: Juan - HYBRID - 3,000 kg      │
│ │  ├─ Record 2: Maria - INBRED - 2,700 kg     │
│ │  └─ Record 3: Pedro - OWN_SEED - 1,500 kg   │
│ │                                              │
│ Summary Tab:                                    │
│ └─ Breakdown by seed type:                      │
│    ├─ HYBRID: X farmers, Y ha, Z bags          │
│    ├─ INBRED: X farmers, Y ha, Z bags          │
│    └─ OWN_SEED: X farmers, Y ha, Z bags        │
│                                                 │
└─────────────────────────────────────────────────┘
```

**What BRGY needs to do:**
1. Click "+ Encode Harvest" button
2. Select farmer (searchable dropdown)
3. Select seed type (HYBRID/INBRED/OWN_SEED)
4. Enter variety (e.g., "NSIC Rc 222")
5. Enter harvest amount (kg in bags: 50kg/bag standard)
6. Select weight type (Fresh/Dried) ← NEW feature needed
7. Enter harvest date
8. Optional: seed bags received, notes
9. Click "Save Harvest Record"
10. System calculates metrics automatically:
    - Fresh → Dry conversion (if fresh selected)
    - Seed implied used (area × density)
    - Harvest utilization %
    - Productivity ratio

**Form Fields Needed in Backend:**
```python
# Already exist:
farmer, seed_source, variety, harvest_area_ha, 
harvest_bags, harvest_date, seed_bags_received, notes

# NEED TO ADD:
moisture_content_pct (default: 12%)
weight_type (choices: FRESH, DRIED)
```

---

### B. ADMIN PRODUCTION MENU
**Status:** ⚠️ **EMPTY STUB** (placeholder page only)

**What it should show:**
```
┌─────────────────────────────────────────────────┐
│ PRODUCTION DASHBOARD (Admin View)               │
├─────────────────────────────────────────────────┤
│                                                 │
│ Season: [Dry Season 2026] Filter               │
│                                                 │
│ Key Metrics (Top):                              │
│ ├─ Total Farmers Harvested: XXX                │
│ ├─ Total Area Harvested: XXX.X ha              │
│ ├─ Total Production: XXX MT (dry weight)       │
│ ├─ Average Yield: X.X t/ha                     │
│ └─ Overall Utilization: XX%                    │
│                                                 │
│ By Seed Type Breakdown:                         │
│ ├─ HYBRID:                                      │
│ │  ├─ Farmers: X                               │
│ │  ├─ Area: X.X ha                             │
│ │  ├─ Production: X MT                         │
│ │  ├─ Expected Yield: X.X t/ha (4,000 kg/ha)  │
│ │  ├─ Actual Yield: X.X t/ha                  │
│ │  └─ Utilization: XX%                        │
│ │                                              │
│ ├─ INBRED:                                      │
│ │  ├─ Farmers: X                               │
│ │  ├─ Area: X.X ha                             │
│ │  ├─ Production: X MT                         │
│ │  ├─ Expected Yield: X.X t/ha (1,500 kg/ha)  │
│ │  ├─ Actual Yield: X.X t/ha                  │
│ │  └─ Utilization: XX%                        │
│ │                                              │
│ └─ OWN_SEED:                                    │
│    ├─ Farmers: X                               │
│    ├─ Area: X.X ha                             │
│    ├─ Production: X MT                         │
│    ├─ Expected Yield: X.X t/ha (2,000 kg/ha)  │
│    ├─ Actual Yield: X.X t/ha                  │
│    └─ Utilization: XX%                        │
│                                                 │
│ By Barangay Table:                              │
│ ├─ Lucban: X farmers, X MT, XX% util           │
│ ├─ Tayabas: X farmers, X MT, XX% util          │
│ └─ [Other barangays...]                        │
│                                                 │
│ Charts:                                         │
│ ├─ Yield Distribution (histogram)              │
│ ├─ Utilization by Barangay (bar chart)         │
│ └─ Production by Seed Type (pie chart)         │
│                                                 │
│ Export Options:                                 │
│ └─ [Download PDF] [Download Excel]             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Admin needs to:**
1. View all harvest data from all barangays
2. See performance metrics by seed type
3. Identify underperforming barangays/farmers
4. Compare actual vs expected yields
5. Generate compliance reports
6. Track seed utilization efficiency
7. Export data for MAO reports

**Required Backend Endpoints:**
- `GET /api/production/summary/` → Overall metrics
- `GET /api/production/by-seed-type/` → Breakdown by seed
- `GET /api/production/by-barangay/` → Breakdown by barangay
- `GET /api/production/export/` → Export as PDF/Excel

---

### C. AT CROP MONITORING MENU
**Status:** ✅ **COMPLETE** (Crop Monitoring page fully functional)

**What AT does:**
```
AT's Role in the System:
├─ View assigned barangay farmers
├─ Record crop phases (5 phases: ESTABLISHMENT → HARVESTING)
├─ Document field observations
├─ Mark delays or damage
├─ Monitor area planted (vs planned)
├─ View farmer history
└─ Cannot encode harvest (that's BRGY's job)
```

**AT Flow:**
1. Opens "Crop Monitoring" menu
2. Sees all farmers in their assigned barangay
3. Selects a farmer to visit
4. Records crop phase (ESTABLISHMENT, TILLERING, FLOWERING, etc.)
5. Documents establishment method (Direct Seeding vs Transplanting)
6. Records area actually planted
7. Notes any delays or damage
8. Submits record

**AT Does NOT Do:**
- ❌ Record harvest amounts
- ❌ Encode yield data
- ❌ Calculate utilization metrics
- ❌ View harvest records

---

### D. FARMER YIELD/HARVEST PAGE
**Status:** ⚠️ **STUB** (YieldEncode.jsx is empty)

**What Farmer should see:**
```
┌─────────────────────────────────────────────────┐
│ MY CROP MONITORING                              │
├─────────────────────────────────────────────────┤
│                                                 │
│ Current Season: Dry Season 2026                │
│                                                 │
│ My Distribution:                                │
│ ├─ HYBRID: 15 kg received on Mar 15, 2026      │
│ ├─ INBRED: 40 kg received on Mar 18, 2026      │
│ └─ OWN_SEED: 15 kg (not from program)          │
│                                                 │
│ My Crop Status:                                 │
│ ├─ Latest Phase: FLOWERING (as of Jun 1)       │
│ ├─ Last Visited by AT: Jun 1, 2026             │
│ ├─ Farm Condition: Healthy ✓                   │
│ └─ Area Planted: 0.3 ha                        │
│                                                 │
│ Expected Harvest: ~90 days from establishment  │
│ Estimated Date: Mid-June 2026                  │
│                                                 │
│ Historical Data:                                │
│ └─ Previous season: HYBRID - 3,200 kg - 107%  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Farmer Does:**
- ✅ View their distributed seeds
- ✅ View crop monitoring records (by AT)
- ✅ See crop phase progress
- ✅ View harvest expectations
- ❌ NOT encode harvest (that's BRGY's role)

---

## 5. SYSTEM FLOW DIAGRAM

```
┌──────────────────────────────────────────────────────────────────┐
│                         5-PHASE HARVEST SYSTEM                   │
└──────────────────────────────────────────────────────────────────┘

PHASE 1: REGISTRATION          PHASE 2: DISTRIBUTION        PHASE 3: MONITORING
┌─────────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│      Admin/BRGY         │   │    Admin/BRGY        │   │        AT             │
│                         │   │                      │   │                      │
│ Register beneficiary    │   │ Approve & deliver    │   │ Record crop phases   │
│ farmer details          │   │ seeds by type        │   │ Monitor growth       │
│ ✓ Name                  │   │ ✓ Variety            │   │ ✓ Phase: EST→RIPENING│
│ ✓ Location              │   │ ✓ Seed type (3)      │   │ ✓ Area planted       │
│ ✓ Farm area             │   │ ✓ Quantity (bags)    │   │ ✓ Status: Normal/etc │
│ ✓ Contact               │   │ ✓ Signature          │   │ ✓ Observations       │
└────────────┬────────────┘   └──────────┬───────────┘   └──────────┬───────────┘
             │                           │                          │
             └───────────────────────────┴──────────────────────────┘
                                      │
                    ┌─────────────────▼──────────────┐
                    │    90 Days Later (Harvest)     │
                    └─────────────────┬──────────────┘
                                      │
                PHASE 4: HARVEST         │         PHASE 5: ANALYSIS
              ┌──────────────────────────▼─────────────────────────┐
              │         BRGY President (Elena)                     │
              │  Meeting with farmers at harvest time              │
              │                                                    │
              │  For EACH Seed Type:                              │
              │  ├─ Ask harvest amount (kg)                       │
              │  ├─ Select weight (Fresh/Dry)                     │
              │  ├─ Select seed type (HYBRID/INBRED/OWN_SEED)    │
              │  └─ System calculates:                            │
              │     ├─ Fresh→Dry conversion (if needed)           │
              │     ├─ Implied seed used (area × density)         │
              │     ├─ Expected yield (area × standard)           │
              │     ├─ Utilization % (harvest ÷ expected)         │
              │     └─ Productivity ratio (harvest ÷ seed)        │
              │                                                    │
              │  Result: Multiple HarvestRecords (1 per type)     │
              └──────────────────────────┬───────────────────────┘
                                         │
                        ┌────────────────▼────────────────┐
                        │       Admin Production          │
                        │                                 │
                        │ View & Analyze:                 │
                        │ ├─ Total production: X MT       │
                        │ ├─ By seed type breakdown       │
                        │ ├─ By barangay comparison       │
                        │ ├─ Yield metrics & trends       │
                        │ ├─ Utilization performance      │
                        │ └─ Export reports for MAO        │
                        │                                 │
                        │ → Used for:                      │
                        │   • Farmer performance reviews   │
                        │   • Compliance reports           │
                        │   • Planning next season         │
                        └─────────────────────────────────┘
```

---

## 6. MENU STRUCTURE - CORRECTED

### ADD TO BRGY MENU (MenuConfig.js)
```javascript
BRGY: [
  { label: 'Dashboard',     path: '/brgy',                icon: Home        },
  { label: 'Farmers',       path: '/brgy/farmers',        icon: Tractor     },
  { label: 'Beneficiaries', path: '/brgy/beneficiaries',  icon: Package     }, 
  { label: 'Distribution',  path: '/brgy/distribution',   icon: Truck       }, 
  { label: 'Crop Phase',    path: '/brgy/crop-phase',     icon: Wheat       },
  { label: 'Harvest',       path: '/brgy/harvest',        icon: BarChart3   }, // ← ADD THIS
  { label: 'Announcements', path: '/brgy/announcements',  icon: Megaphone   },
  { label: 'Reports',       path: '/brgy/reports',        icon: ClipboardList},
],
```

---

## 7. WHAT NEEDS TO BE DONE

### IMMEDIATE (Phase 1 - Frontend Menu Fix)
- [x] ✅ Update MenuConfig.js: Add "Harvest" to BRGY menu
- [ ] Test BrgyHarvest.jsx is working with current backend

### SHORT TERM (Phase 2 - Backend Model Updates)
- [ ] Add `moisture_content_pct` field to HarvestRecord
- [ ] Add `weight_type` field (FRESH/DRIED choices)
- [ ] Add new @property methods:
  - `harvest_kg_fresh`
  - `harvest_kg_dry`
  - `seed_implied_planted_kg`
  - `seed_efficiency_pct`
  - `productivity_ratio`
- [ ] Update utilization_pct calculation
- [ ] Create Django migration
- [ ] Update HarvestRecordSerializer

### SHORT TERM (Phase 3 - Frontend Form Update)
- [ ] Update BrgyHarvest.jsx form:
  - Add fresh/dry toggle
  - Add moisture content slider
  - Add metric preview per weight type
- [ ] Update harvest display to show:
  - Fresh vs dry weight conversion
  - Implied seed calculation
  - Unused seed balance

### MEDIUM TERM (Phase 4 - Admin Production Dashboard)
- [ ] Create AdminProduction.jsx component
- [ ] Add backend endpoints:
  - `/api/production/summary/`
  - `/api/production/by-seed-type/`
  - `/api/production/by-barangay/`
- [ ] Add metrics calculations
- [ ] Add charts & visualizations
- [ ] Add export functionality

### LONG TERM (Phase 5 - Farmer Yield Page)
- [ ] Update YieldEncode.jsx to show:
  - Current distribution
  - Crop monitoring history
  - Expected vs actual harvest
  - Performance metrics

---

## 8. KEY REMINDERS

### For BRGY Harvest Encoding:
- ⚠️ One farmer = MULTIPLE HarvestRecords (one per seed type)
- ⚠️ Area is from Distribution/CropMonitoring (not asked again)
- ⚠️ Seed source determines:
  - Seeding density (HYBRID: 15, INBRED: 40, OWN_SEED: 15)
  - Expected yield standard (HYBRID: 4000, INBRED: 1500, OWN_SEED: 2000)
- ⚠️ Fresh→Dry conversion: Multiply by 0.88 (removes 12% moisture)
- ⚠️ All calculations use DRY weight for comparisons (DA standard)

### For Admin Production:
- ⚠️ View only (no editing of harvest records)
- ⚠️ Must see data from all barangays
- ⚠️ Generate reports for MAO leadership
- ⚠️ Identify high/low performers

### For AT Crop Monitoring:
- ⚠️ AT records PHASES, not harvest
- ⚠️ AT documents area PLANTED (from field observation)
- ⚠️ AT does NOT see harvest data
- ⚠️ Purpose: Monitor crop health, not production

---

## 9. API ENDPOINTS SUMMARY

```
┌─ HARVEST (Production App) ──────────────────────────────────────┐
│                                                                  │
│ POST   /api/production/harvest/                                  │
│        → Create harvest record (BRGY user)                       │
│        Payload: {farmer, seed_source, variety, harvest_area_ha,  │
│                  harvest_bags, harvest_date, weight_type,        │
│                  moisture_content_pct, seed_bags_received, notes} │
│                                                                  │
│ GET    /api/production/harvest/                                  │
│        → List harvest records (scoped by barangay)               │
│                                                                  │
│ GET    /api/production/harvest/<id>/                             │
│        → Retrieve single record (with all computed metrics)      │
│                                                                  │
│ PATCH  /api/production/harvest/<id>/                             │
│        → Update record (BRGY user only)                          │
│                                                                  │
│ DELETE /api/production/harvest/<id>/                             │
│        → Delete record (BRGY user only)                          │
│                                                                  │
│ [NEW] GET /api/production/summary/                               │
│        → Get overall metrics (Admin only)                        │
│                                                                  │
│ [NEW] GET /api/production/by-seed-type/                          │
│        → Breakdown by seed type (Admin only)                     │
│                                                                  │
│ [NEW] GET /api/production/by-barangay/                           │
│        → Breakdown by barangay (Admin only)                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. COMPUTED METRICS REFERENCE

### Current (Already Working):
```
harvest_kg       = harvest_bags × 50 kg
harvest_mt       = harvest_kg ÷ 1,000
yield_t_ha       = harvest_mt ÷ harvest_area_ha
utilization_pct  = (harvest_bags / target_seed_bags) × 100
```

### New (To Be Added):
```
harvest_kg_fresh       = harvest_bags × 50 kg (if weight_type = FRESH)
harvest_kg_dry         = harvest_kg_fresh × (1 - moisture_content_pct/100)
seed_implied_planted   = harvest_area_ha × SEEDING_DENSITY[seed_source]
seed_efficiency_pct    = (seed_implied / seed_distributed) × 100
productivity_ratio     = harvest_kg_dry / seed_implied_planted

utilization_pct        = (harvest_kg_dry / (harvest_area_ha × STANDARD_YIELD)) × 100
```

---

## 11. CONFIGURATION CONSTANTS

### Seeding Densities (kg/ha)
```python
HYBRID:   15 kg/ha
INBRED:   40 kg/ha
OWN_SEED: 15 kg/ha
```

### Standard Yields (kg/ha at dry weight)
```python
HYBRID:   4,000 kg/ha
INBRED:   1,500 kg/ha
OWN_SEED: 2,000 kg/ha (PENDING CLIENT CONFIRMATION)
```

### Weight Standards
```python
Harvest Bag:        50 kg
Moisture Content:   12% (default for fresh weight)
Dry Weight Basis:   14% moisture (DA standard)
Fresh→Dry Factor:   0.88 (removes ~12% moisture)
```

---

**Document End**
