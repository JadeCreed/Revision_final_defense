# COMPLETE UI/UX INTERFACE SPECIFICATIONS
## For BRGY President, AT, and Admin Production
**Document Date:** May 24, 2026

---

# TABLE OF CONTENTS
1. BRGY President (Harvest Encoding)
2. Agricultural Technician (Crop Monitoring)
3. Admin Production Dashboard
4. Integration & Data Flow

---

# PART 1: BRGY PRESIDENT - HARVEST ENCODING INTERFACE

## 1.1 CURRENT STATUS
✅ **Already Implemented:**
- Page exists: `/brgy/harvest`
- Backend API: `/api/production/harvest/` (POST, GET, PATCH, DELETE)
- Form component: HarvestForm.jsx
- Search & filter functionality
- Records list with edit/delete buttons
- Summary tab with breakdown by seed type
- Permission scoping (BRGY sees only their barangay)

⚠️ **Missing:**
- Menu item (not in MenuConfig.js)
- Fresh/Dry weight toggle
- Moisture content input
- Multiple entries per farmer per form submission
- Updated calculations for dry weight

## 1.2 BRGY HARVEST MENU - COMPLETE UI STRUCTURE

```
┌────────────────────────────────────────────────────────────────────┐
│ BRGY HARVEST RECORDS                                               │
│ Encode and track barangay harvest data for your area               │
└────────────────────────────────────────────────────────────────────┘

┌─ TOP SECTION ────────────────────────────────────────────────────┐
│                                                                   │
│  [+ Encode Harvest]  [🔄 Refresh]                               │
│                                                                   │
│  ┌─ Summary Cards Row ────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  ┌──────────────────┐  ┌──────────────────────────────┐  │ │
│  │  │ 👥 Total Farmers │  │ 📍 Total Area Harvested     │  │ │
│  │  │ 45 records       │  │ 23.5 ha                      │  │ │
│  │  │ encoded          │  │ area harvested               │  │ │
│  │  └──────────────────┘  └──────────────────────────────┘  │ │
│  │                                                            │ │
│  │  ┌──────────────────────────┐  ┌──────────────────────┐  │ │
│  │  │ 🏭 Total Production      │  │ 📊 Average Yield     │  │ │
│  │  │ 1,175 bags (58.75 MT)    │  │ 2.5 t/ha             │  │ │
│  │  │ total across all records │  │ avg across all       │  │ │
│  │  └──────────────────────────┘  └──────────────────────┘  │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─ TAB SECTION ─────────────────────────────────────────────────────┐
│                                                                   │
│  [ Records ]  [ Summary ]                                         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─ RECORDS TAB (Default) ────────────────────────────────────────────┐
│                                                                    │
│  Search & Filter Bar:                                             │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search farmer or variety...                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│  ┌─ Filter ─────────────────────────────────────────────┐         │
│  │ [All (45)]  [• HYBRID]  [• INBRED]  [• OWN_SEED]      │        │
│  └──────────────────────────────────────────────────────┘         │
│                                                                    │
│  Records List:                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │ Record 1                                                │    │
│  │ ┌────────────────────────────────────────────────────┐  │    │
│  │ │ Juan Dela Cruz                      🌾 HYBRID     │  │    │
│  │ │ Variety: NSIC Rc 222                              │  │    │
│  │ │ Harvest: 3,000 kg (60 bags) | Yield: 3.0 t/ha   │  │    │
│  │ │ Date: Jun 10, 2026                                │  │    │
│  │ │ Utilization: 220% ✅ EXCEPTIONAL                 │  │    │
│  │ │                                                   │  │    │
│  │ │ [✎ Edit]  [🗑 Delete]                            │  │    │
│  │ └────────────────────────────────────────────────────┘  │    │
│  │                                                          │    │
│  │ Record 2                                                │    │
│  │ ┌────────────────────────────────────────────────────┐  │    │
│  │ │ Maria Santos                       🌾 INBRED      │  │    │
│  │ │ Variety: PSB Rc 22                                │  │    │
│  │ │ Harvest: 2,700 kg (54 bags) | Yield: 1.8 t/ha   │  │    │
│  │ │ Date: Jun 11, 2026                                │  │    │
│  │ │ Utilization: 528% ✅ EXCEPTIONAL                 │  │    │
│  │ │                                                   │  │    │
│  │ │ [✎ Edit]  [🗑 Delete]                            │  │    │
│  │ └────────────────────────────────────────────────────┘  │    │
│  │                                                          │    │
│  │ [Load more records...]                                  │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ SUMMARY TAB ─────────────────────────────────────────────────────┐
│                                                                   │
│  Breakdown by Seed Type Program:                                 │
│                                                                   │
│  ┌─ HYBRID (Government Program) ──────────────────────────────┐  │
│  │                                                            │  │
│  │ 🌾 HYBRID           ■ (blue color)                        │  │
│  │                                                            │  │
│  │ Farmers: 15    |   Area: 8.5 ha    |   Bags: 425   │    │  │
│  │ Production: 21.25 MT                                      │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ INBRED (Government Program) ──────────────────────────────┐  │
│  │                                                            │  │
│  │ 🌾 INBRED           ■ (green color)                       │  │
│  │                                                            │  │
│  │ Farmers: 20    |   Area: 10.2 ha   |   Bags: 510  │    │  │
│  │ Production: 25.5 MT                                       │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ OWN_SEED (Farmer's Own Stock) ───────────────────────────┐  │
│  │                                                            │  │
│  │ 🌾 OWN_SEED         ■ (purple color)                      │  │
│  │                                                            │  │
│  │ Farmers: 10    |   Area: 4.8 ha    |   Bags: 240   │    │  │
│  │ Production: 12.0 MT                                       │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└────────────────────────────────────────────────────────────────────┘
```

## 1.3 BRGY ENCODE HARVEST FORM - BOTTOM SHEET

**Triggered by:** Click "[+ Encode Harvest]" button

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│ ═══════════════════════════════════════════════════════════════    │  [Drag handle]
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Encode Harvest Record          [Fields marked * required]   │  │
│ │ [✕ Close]                                                   │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ SECTION 1: SELECT FARMER & SEED TYPE                             │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│  Farmer * [Search or select]                                      │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ 🔍 Search by name or RSBSA...                           │     │
│  │                                                          │     │
│  │ [Dropdown appears on focus with:]                        │     │
│  │   • Juan Dela Cruz (RSBSA: 001-2026)                    │     │
│  │   • Maria Santos (RSBSA: 002-2026)                      │     │
│  │   • Pedro Reyes (RSBSA: 003-2026)                       │     │
│  │   • [... more farmers]                                  │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  Seed Source / Program *                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │ ■ HYBRID        │  │ □ INBRED        │  │ □ OWN_SEED       │ │
│  │ 15 kg/ha        │  │ 40 kg/ha        │  │ 15 kg/ha         │ │
│  │ 4,000 kg/ha std │  │ 1,500 kg/ha std │  │ 2,000 kg/ha std  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘ │
│                                                                    │
│ SECTION 2: HARVEST DETAILS                                       │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│  Rice Variety *                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ e.g. NSIC Rc 222, Mestizo 7, PSB Rc 22                  │     │
│  │ [text input]                                             │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  Area Harvested (ha) *                                            │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ 0.30                                                     │     │
│  │ [auto-populated from distribution, can adjust]          │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  Harvest Bags (50 kg/bag) *                                       │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ 60  [bags entered]                                       │     │
│  │ = 3,000 kg total                                         │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│ SECTION 3: WEIGHT TYPE & MOISTURE [NEW]                          │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│  Weight Type *                                                     │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐  │
│  │ ⭕ Fresh/Wet               │  │ ⭕ Dried                 │  │
│  │ (just harvested)           │  │ (already dried)          │  │
│  │ ~25% moisture              │  │ ~12% moisture            │  │
│  └─────────────────────────────┘  └──────────────────────────┘  │
│                                                                    │
│  Moisture Content (%) [Only if Fresh selected]                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 12%  [Slider: 8% ─────●──── 20%]                         │    │
│  │ Default: 12% (standard for fresh harvest)                │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│ SECTION 4: LIVE METRICS PREVIEW                                  │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│  📊 HARVEST METRICS (Auto-calculated)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │  Fresh Weight: 3,000 kg (60 bags × 50)               │    │
│  │  ↓ Converts to (at 12% moisture)                      │    │
│  │  Dry Weight: 2,640 kg (removes ~360 kg water)        │    │
│  │                                                         │    │
│  │  Expected Yield: 0.3 ha × 4,000 kg/ha = 1,200 kg    │    │
│  │  Actual Yield: 2,640 kg (dry weight)                │    │
│  │                                                         │    │
│  │  ✅ Utilization: 220% (120% ABOVE TARGET)            │    │
│  │  Status: EXCEPTIONAL FARMER                           │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                    │
│ SECTION 5: OPTIONAL DETAILS                                      │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│  Harvest Date *                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ [📅 Jun 10, 2026]  [max today]                           │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  Seed Bags Received (optional)                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ 15  [bags distributed]                                  │     │
│  │ Used for seed efficiency calculation                    │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  Notes / Remarks (optional)                                       │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ Any field observations, issues, or additional notes...  │     │
│  │                                                          │     │
│  │ [Text area - 3 rows]                                   │     │
│  │                                                          │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│ ACTION BUTTONS                                                    │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ [✓ Save Harvest Record]  [Cancel]                       │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 1.4 BRGY HARVEST - RECORD ROW DETAIL

**Each record in the list shows:**

```
┌─ INDIVIDUAL HARVEST RECORD ROW ────────────────────────────────┐
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │                                                          │  │
│ │ Juan Dela Cruz                           🌾 HYBRID      │  │
│ │ PSB Rc 22 · Jun 10, 2026                                │  │
│ │                                                          │  │
│ │ ┌─ Weight Information ──────────────────────────────┐  │  │
│ │ │ Fresh: 3,000 kg (60 bags) → Dry: 2,640 kg      │  │  │
│ │ │ Harvest Date: Jun 10, 2026                      │  │  │
│ │ └──────────────────────────────────────────────────┘  │  │
│ │                                                          │  │
│ │ ┌─ Performance Metrics ───────────────────────────────┐ │  │
│ │ │                                                    │ │  │
│ │ │ Area: 0.3 ha    │    Yield: 8.8 t/ha              │ │  │
│ │ │                                                    │ │  │
│ │ │ Seed Implied: 4.5 kg   │   Seed Distributed: 15 kg│ │  │
│ │ │ Seed Efficiency: 30%   │   Productivity: 587 kg/kg│ │  │
│ │ │                                                    │ │  │
│ │ │ Expected: 1,200 kg (dry)                         │ │  │
│ │ │ Actual: 2,640 kg (dry)                           │ │  │
│ │ │ ✅ Utilization: 220% EXCEPTIONAL                │ │  │
│ │ │                                                    │ │  │
│ │ └────────────────────────────────────────────────────┘ │  │
│ │                                                          │  │
│ │ [✎ Edit]  [🗑 Delete]                                 │  │
│ │                                                          │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.5 BRGY WORKFLOW - STEP BY STEP

**BRGY President's Task Workflow:**

```
DAY: Harvest Encoding Day (Village Meeting)

Step 1: OPEN HARVEST MENU
────────────────────────
1. Click BRGY menu
2. Select "Harvest" (NEW - after Distribution)
3. See page: "Harvest Records - Encode and track barangay data"
4. See 4 metric cards: Farmers, Area, Production, Avg Yield
5. See two tabs: Records | Summary

Step 2: ENCODE FIRST FARMER
────────────────────────
1. Click "+ Encode Harvest" button
2. Bottom sheet appears
3. Search for farmer name "Juan Dela Cruz"
4. Select him from dropdown
5. System auto-fills: Previous area (0.3 ha), seed type he got
6. Elena says: "Juan, for your HYBRID seeds, how many bags did you harvest?"
7. Juan answers: "60 bags" (or ~3,000 kg)
8. Elena enters 60 bags
9. Elena asks: "Is this fresh weight or already dried?"
10. Elena selects: "Fresh/Wet (just harvested)"
11. System shows:
    - Fresh: 3,000 kg
    - Converts to: 2,640 kg (dry, at 12% moisture)
    - Expected: 1,200 kg
    - Status: ✅ 220% EXCEPTIONAL

Step 3: OPTIONAL - ADD NOTES
────────────────────────
1. Elena can add: "Good harvest, no pest damage"
2. Or leave empty if no special notes

Step 4: SAVE RECORD
────────────────────
1. Click "✓ Save Harvest Record"
2. System creates HarvestRecord #1 for Juan (HYBRID)
3. Success toast: "Harvest record saved successfully"
4. Bottom sheet closes
5. Record appears in list

Step 5: ENCODE NEXT FARMER - DIFFERENT SEED TYPE
────────────────────────────────────────────────
1. Click "+ Encode Harvest" again
2. Search for "Maria Santos"
3. Select her
4. System shows her latest seed type (INBRED)
5. Maria says: "I harvested 54 bags of INBRED"
6. Elena enters 54 bags
7. System shows:
    - Fresh: 2,700 kg
    - Dry: 2,376 kg
    - Expected (INBRED): 450 kg (different standard!)
    - Status: ✅ 528% EXCEPTIONAL
8. Save record
9. Creates HarvestRecord #2 for Maria (INBRED)

Step 6: CONTINUE FOR ALL FARMERS
─────────────────────────────────
1. Repeat steps 2-5 for each farmer
2. One farmer might appear multiple times:
   - Juan's first entry: HYBRID 60 bags
   - Juan's second entry: INBRED 54 bags
   - Juan's third entry: OWN_SEED 60 bags
   = 3 separate HarvestRecords for Juan

Step 7: VIEW SUMMARY
──────────────────
1. Click "Summary" tab
2. See breakdown by seed type:
   - HYBRID: 15 farmers, 8.5 ha, 425 bags, 21.25 MT
   - INBRED: 20 farmers, 10.2 ha, 510 bags, 25.5 MT
   - OWN_SEED: 10 farmers, 4.8 ha, 240 bags, 12.0 MT
3. Total: 45 farmers, 23.5 ha, 1,175 bags, 58.75 MT

Step 8: END OF DAY - REVIEW
───────────────────────────
1. See summary metrics updated
2. Total Farmers: 45 records
3. Total Area: 23.5 ha
4. Total Production: 58.75 MT
5. Avg Yield: 2.5 t/ha
6. All data ready for Admin review tomorrow
```

## 1.6 FORM VALIDATION RULES (BRGY)

**Client-side validation (shows error before submit):**

```
Field                    | Validation Rule
──────────────────────────────────────────────────
Farmer *                 | Must select from dropdown
Seed Source *            | Must select one: HYBRID, INBRED, or OWN_SEED
Variety *                | Cannot be empty
Area Harvested *         | Must be > 0, decimal (0.01 to 50 ha)
Harvest Bags *           | Must be > 0, positive integer
Weight Type *            | Must select: Fresh or Dried
Harvest Date *           | Cannot be future date, must have date
Moisture Content         | If Fresh: 8% to 20% (default 12%)
Seed Bags Received       | If entered: must be ≥ 0
Notes                    | Optional, any text
──────────────────────────────────────────────────
```

---

# PART 2: AGRICULTURAL TECHNICIAN (AT) - CROP MONITORING

## 2.1 CURRENT STATUS

✅ **Already Fully Implemented:**
- Crop Monitoring page: `/at/crop-monitoring`
- Backend API: `/api/crop_monitoring/` (POST, GET, PATCH)
- Search by barangay
- Filter by crop phase (ESTABLISHMENT, TILLERING, FLOWERING, RIPENING, HARVESTING)
- Encode form with all fields
- Phase conflict detection (can't record same phase twice)
- Field history viewer

⚠️ **Status:** 100% Complete - No changes needed

## 2.2 AT MENU STRUCTURE (Current - Complete)

```
┌────────────────────────────────────────────────────────────────────┐
│ AT AGRICULTURAL TECHNICIAN MENU                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ 📊 Dashboard          ← Quick view of task status                 │
│ 🌾 Crop Monitoring    ← Main work: encode crop phases             │
│ 👨‍🌾 Farmers            ← View full farmer information              │
│ 🗺️ GIS Map            ← Map view of farms                          │
│ 📋 Reports            ← View submitted reports                     │
│ 📢 Announcements      ← Read program announcements                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 2.3 AT CROP MONITORING PAGE - COMPLETE UI

```
┌────────────────────────────────────────────────────────────────────┐
│ CROP MONITORING                                                    │
│ Record and update crop phases per barangay                        │
└────────────────────────────────────────────────────────────────────┘

┌─ TOP ACTION SECTION ──────────────────────────────────────────────┐
│                                                                    │
│  Assigned Barangay: [Lucban ▼]  [🔄 Refresh Data]                │
│                                                                    │
│  Quick Stats:                                                      │
│  ├─ Total Farmers: 87                                             │
│  ├─ Not Yet Monitored: 15 (17%)                                   │
│  └─ Last Updated: Jun 10, 2026 10:30 AM                          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ SEARCH & FILTER SECTION ─────────────────────────────────────────┐
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ 🔍 Search farmer by name or RSBSA...                    │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  Filter by Phase:                                                 │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ All (87) | NONE (15) | ESTABLISHMENT (10) |          │        │
│  │ TILLERING (22) | FLOWERING (18) | RIPENING (12)      │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                    │
│  Phase Distribution Chart:                                        │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ ■ Not Yet Monitored ███████████ 15 (17%)             │      │
│  │ ■ ESTABLISHMENT    ████████████████ 10 (12%)         │      │
│  │ ■ TILLERING        ████████████████████ 22 (25%)     │      │
│  │ ■ FLOWERING        ███████████████████ 18 (21%)       │      │
│  │ ■ RIPENING         ███████████████ 12 (14%)          │      │
│  │ ■ HARVESTING       ███████ 10 (11%)                   │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ FARMER LIST ─────────────────────────────────────────────────────┐
│                                                                    │
│  Showing 87 Farmers                                               │
│                                                                    │
│  ┌─ FARMER ROW 1 ────────────────────────────────────────────┐   │
│  │                                                            │   │
│  │ Juan Dela Cruz                        [Not yet monitored] │   │
│  │ RSBSA: 001-2026 · Location: Lucban                        │   │
│  │                                                            │   │
│  │ Latest Phase: None   │   Last Visited: Never             │   │
│  │ Distributed: HYBRID (Mar 15) | Area Planned: 0.5 ha     │   │
│  │                                                            │   │
│  │ [Tap to open detail & encode]                            │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─ FARMER ROW 2 ────────────────────────────────────────────┐   │
│  │                                                            │   │
│  │ Maria Santos                          [🟢 FLOWERING]     │   │
│  │ RSBSA: 002-2026 · Location: Lucban                        │   │
│  │                                                            │   │
│  │ Latest Phase: FLOWERING   │   Last Visited: Jun 5       │   │
│  │ Distributed: INBRED (Mar 18) | Area Planted: 0.3 ha     │   │
│  │                                                            │   │
│  │ [Tap to update record]                                    │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─ FARMER ROW 3 ────────────────────────────────────────────┐   │
│  │                                                            │   │
│  │ Pedro Reyes                           [🟡 TILLERING]    │   │
│  │ RSBSA: 003-2026 · Location: Lucban                        │   │
│  │                                                            │   │
│  │ Latest Phase: TILLERING   │   Last Visited: Jun 8       │   │
│  │ Distributed: HYBRID (Mar 15) | Area Planted: 0.5 ha     │   │
│  │                                                            │   │
│  │ [Tap to update record]                                    │   │
│  │                                                            │   │
│  │ [✏️ Edit] [Previous Records]                             │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  [Load more farmers...]                                          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 2.4 AT ENCODE FORM - DETAILED

**Appears when AT clicks on a farmer:**

```
┌────────────────────────────────────────────────────────────────────┐
│ ═══════════════════════════════════════════════════════════════    │  [Handle]
│                                                                    │
│ Encode Crop Monitoring Record                                     │
│                                                                    │
│ Farmer: Maria Santos (RSBSA: 002-2026)                           │
│ Barangay: Lucban                                                  │
│ [✕ Close]                                                         │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ SECTION 1: CURRENT DISTRIBUTION                                  │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│ Distribution Information (Linked from Phase 2):                   │
│ ├─ Distributed Date: Mar 18, 2026                                │
│ ├─ Seed Type: INBRED (PSB Rc 22)                                │
│ ├─ Area Planned: 0.3 hectares                                    │
│ ├─ Seed Received: 40 kg (1 bag @ 40 kg/ha)                      │
│ └─ Status: ✓ Approved by Admin                                  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ SECTION 2: SELECT CROP PHASE                                     │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│ Crop Phase *                                                      │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  ┌───────────────────────────────────────────────────┐    │   │
│ │  │ ■ ESTABLISHMENT (0-15 days)                      │    │   │
│ │  │ From planting to seedling formation              │    │   │
│ │  └───────────────────────────────────────────────────┘    │   │
│ │                                                            │   │
│ │  ┌───────────────────────────────────────────────────┐    │   │
│ │  │ ■ TILLERING (15-30 days)                         │    │   │
│ │  │ Growth of tillers/shoots                         │    │   │
│ │  └───────────────────────────────────────────────────┘    │   │
│ │                                                            │   │
│ │  ┌───────────────────────────────────────────────────┐    │   │
│ │  │ ■ FLOWERING (30-50 days)  ← Selected           │    │   │
│ │  │ Flower formation and pollen maturation           │    │   │
│ │  │ ✓ Checked                                        │    │   │
│ │  └───────────────────────────────────────────────────┘    │   │
│ │                                                            │   │
│ │  ┌───────────────────────────────────────────────────┐    │   │
│ │  │ ■ RIPENING (50-70 days)                          │    │   │
│ │  │ Grain filling and maturation                     │    │   │
│ │  └───────────────────────────────────────────────────┘    │   │
│ │                                                            │   │
│ │  ┌───────────────────────────────────────────────────┐    │   │
│ │  │ ■ HARVESTING (70-90+ days)                       │    │   │
│ │  │ Ready for harvest                                │    │   │
│ │  └───────────────────────────────────────────────────┘    │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ SECTION 3: CROP ESTABLISHMENT METHOD (If ESTABLISHMENT selected)  │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│ Crop Establishment Method *                                       │
│                                                                    │
│ ┌──────────────────────────┐  ┌──────────────────────────┐       │
│ │ □ DS (Direct Seeding)    │  │ □ TP (Transplanting)     │       │
│ │ Seeds sown directly      │  │ Young plants replanted   │       │
│ └──────────────────────────┘  └──────────────────────────┘       │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ SECTION 4: CROP HEALTH STATUS                                    │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│ Crop Status *                                                      │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│
│ │ ✓ NORMAL         │  │ □ DELAYED        │  │ □ DAMAGED        ││
│ │ No issues        │  │ Phase is late    │  │ Affected by      ││
│ │ Expected growth  │  │ Record reason    │  │ pests/disease    ││
│ └──────────────────┘  └──────────────────┘  └──────────────────┘│
│                                                                    │
│ Seed Source (for this observation) *                              │
│ ┌──────────────────────────────────────────────────────────┐     │
│ │ ⭕ HYBRID  ⭕ INBRED  ⭕ OWN_SEED  ⭕ Not Confirmed     │     │
│ │ (auto-filled from distribution, can change if updated)  │     │
│ └──────────────────────────────────────────────────────────┘     │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ SECTION 5: IF STATUS = DELAYED (Conditional)                     │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│ Delay Duration (days) *                                           │
│ ┌──────────────────────────────────────────────────────────┐     │
│ │ 5  [days behind expected schedule]                       │     │
│ │ e.g. 5 means 5 days late                                │     │
│ └──────────────────────────────────────────────────────────┘     │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ SECTION 6: IF STATUS = DAMAGED (Conditional)                     │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│ Cause of Damage *                                                  │
│ ┌──────────────────────────────────────────────────────────┐     │
│ │ e.g. Pests, Typhoon, Flooding, Drought, Disease         │     │
│ │ [text input: "Army worms in tillering stage"]            │     │
│ └──────────────────────────────────────────────────────────┘     │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ SECTION 7: FIELD OBSERVATIONS                                    │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│ Area Monitored (ha)                                               │
│ ┌──────────────────────────────────────────────────────────┐     │
│ │ 0.30  [actual area observed in field]                    │     │
│ │ (auto-filled from distribution)                         │     │
│ └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│ Sowing Date (for ESTABLISHMENT phase)                             │
│ ┌──────────────────────────────────────────────────────────┐     │
│ │ [📅 Mar 20, 2026]  [auto-calculated from distribution]   │     │
│ └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│ Date Observed *                                                    │
│ ┌──────────────────────────────────────────────────────────┐     │
│ │ [📅 Jun 5, 2026]  [today's date, can't change]          │     │
│ └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│ Remarks / Observations (optional)                                 │
│ ┌──────────────────────────────────────────────────────────┐     │
│ │ Healthy crop, excellent tiller formation,               │     │
│ │ no visible pests or disease symptoms                     │     │
│ │                                                          │     │
│ │ [Text area - 3 rows]                                    │     │
│ └──────────────────────────────────────────────────────────┘     │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ ACTION BUTTONS                                                    │
│ ────────────────────────────────────────────────────────────────  │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────┐     │
│ │ [✓ Save Monitoring Record]  [Cancel]                    │     │
│ └──────────────────────────────────────────────────────────┘     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 2.5 AT WORKFLOW - STEP BY STEP

```
DAY: Field Visit Schedule

Step 1: AT OPENS APP
──────────────────
1. AT (Remy) opens app
2. Goes to Dashboard
3. Sees: "You have 87 farmers to monitor in Lucban"
4. Sees 4 quick actions:
   - View Farmers (currently monitoring)
   - Crop Monitoring (encode data)
   - Fill Masterlist (compliance)
   - Submit Report (end of season)

Step 2: VISIT FIRST FARMER
──────────────────────────
1. Clicks "Crop Monitoring" menu
2. Sees list of 87 farmers
3. Filters by: "Not Yet Monitored" (15 farmers)
4. First farmer: Juan Dela Cruz
5. AT clicks on Juan's record
6. Detail panel opens showing:
   - Juan's info: RSBSA, location, contact
   - Distribution: HYBRID, Mar 15, 0.5 ha planned, 15 kg
   - Status: Not yet monitored
7. AT clicks "Tap to encode"

Step 3: PHYSICAL FIELD VISIT
─────────────────────────────
1. AT goes to Juan's farm
2. Observes the crop:
   - What phase is it in?
   - How does it look?
   - Any problems?
3. Measures the planted area (if different from planned)
4. Takes photos (optional - in full app)
5. Records observations

Step 4: ENCODE OBSERVATION IN APP
──────────────────────────────────
1. Back at office or field (with phone/tablet)
2. Encode form opens
3. Selects crop phase: "ESTABLISHMENT" (20 days old)
4. Selects establishment method: "Direct Seeding (DS)"
5. Selects status: "NORMAL"
6. No delays or damage, so those fields don't appear
7. Confirms area monitored: 0.5 ha (matches planned)
8. Confirms sowing date: Mar 15, 2026 (auto-filled)
9. Date observed: Jun 5, 2026 (today)
10. Adds remark: "Excellent seedling establishment, no visible pests"
11. Clicks "✓ Save Monitoring Record"
12. Success: "Crop monitoring record saved"

Step 5: VISIT SECOND FARMER - DIFFERENT STATUS
───────────────────────────────────────────────
1. Goes to next farmer: Maria Santos
2. Observes her field
3. Crop is in FLOWERING phase but seems delayed
4. Encode form opens
5. Selects phase: "FLOWERING"
6. Selects status: "DELAYED" (looks ~3 days behind)
7. NEW: "Delay Duration (days)" field appears
8. Enters: 3 days
9. Comments: "Drought stress during tillering caused delay"
10. Saves record

Step 6: VISIT THIRD FARMER - DAMAGED CROP
──────────────────────────────────────────
1. Goes to next farmer: Pedro Reyes
2. Observes significant crop damage
3. Encode form opens
4. Selects phase: "TILLERING"
5. Selects status: "DAMAGED"
6. NEW: "Cause of Damage" field appears
7. Enters: "Army worms, pest outbreak"
8. Comments: "Applied pesticide, monitoring recovery"
9. Saves record

Step 7: CONTINUE FIELD VISITS
──────────────────────────────
1. Repeats steps 2-6 for remaining farmers
2. Over several days/weeks, monitors all 87 farmers
3. Documents phase progression: ESTABLISHMENT → TILLERING → FLOWERING

Step 8: REVIEW AT FARMERS PAGE
──────────────────────────────
1. Clicks "AT Farmers" menu (different from Crop Monitoring)
2. Sees full farmer detail view (not for encoding)
3. Can see:
   - Farmer profile info
   - Distribution history
   - Crop monitoring history (all visits)
   - Performance trends
   - Latest phase for each farmer
4. Used for CHECK/REVIEW, not ENCODING

Step 9: GENERATE AT REPORT
──────────────────────────
1. End of season, clicks "Reports" menu
2. System generates report showing:
   - Total farmers monitored: 87
   - Phase progression timeline
   - Any delayed or damaged crops
   - Averages and trends
3. Report ready for submission to MAO
```

## 2.6 AT VALIDATION RULES

```
Field                        | Validation Rule
──────────────────────────────────────────────────
Crop Phase *                 | Must select one phase
Crop Establishment *         | Required if phase = ESTABLISHMENT
Crop Status *                | Must select: NORMAL, DELAYED, DAMAGED
Seed Source *                | Must select (auto-filled from dist.)
Delay Duration *             | If status = DELAYED, must be > 0
Cause of Damage *            | If status = DAMAGED, cannot be empty
Area Monitored               | If entered: must be > 0, ≤ planned area
Date Observed *              | Must be today or past date
Remarks                      | Optional, any text
──────────────────────────────────────────────────
```

---

# PART 3: ADMIN - PRODUCTION DASHBOARD

## 3.1 CURRENT STATUS

❌ **Currently:** Just empty placeholder page
```jsx
const Production = () => (
  <div>
    <h1>Production</h1>
    <p>View and manage production data here.</p>
  </div>
);
```

🔴 **NEEDS TO BE BUILT:** Complete analytics dashboard

## 3.2 ADMIN PRODUCTION MENU - COMPLETE SPEC

```
┌────────────────────────────────────────────────────────────────────┐
│ PRODUCTION DASHBOARD (Admin View)                                  │
│ View and analyze harvest performance across all barangays          │
└────────────────────────────────────────────────────────────────────┘

┌─ TOP FILTER SECTION ──────────────────────────────────────────────┐
│                                                                    │
│  Season: [Dry Season 2026 ▼]                                      │
│  Show Data: [All Barangays ▼]                                     │
│  [🔄 Refresh] [📊 Export PDF] [📋 Export Excel]                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ KEY METRICS SECTION ──────────────────────────────────────────────┐
│                                                                    │
│  Top Row - Overall Performance:                                   │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐        │
│  │ 👥 Total       │ │ 📍 Total Area  │ │ 🏭 Total       │        │
│  │ Farmers        │ │ Harvested      │ │ Production     │        │
│  │ 45             │ │ 23.5 ha        │ │ 58.75 MT       │        │
│  │ Encoded        │ │ (all records)  │ │ (dry weight)   │        │
│  └────────────────┘ └────────────────┘ └────────────────┘        │
│                                                                    │
│  Second Row - Performance Metrics:                                 │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐        │
│  │ 📊 Avg Yield   │ │ 📈 Utilization │ │ 🎯 Productivity│        │
│  │ 2.5 t/ha       │ │ 184%           │ │ 234 kg/kg      │        │
│  │ (across all)   │ │ (vs expected)  │ │ (seed to yield)│        │
│  └────────────────┘ └────────────────┘ └────────────────┘        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ BREAKDOWN BY SEED TYPE ──────────────────────────────────────────┐
│                                                                    │
│  ┌─ HYBRID (Government Program) ────────────────────────────────┐│
│  │                                                              ││
│  │ 🌾 HYBRID           ■ Blue (color indicator)               ││
│  │ Standard: 4,000 kg/ha (dry) | Seeding Density: 15 kg/ha   ││
│  │                                                              ││
│  │ ┌─ Statistics Row ──────────────────────────────────────┐ ││
│  │ │                                                       │ ││
│  │ │ Farmers: 15        │ Area: 8.5 ha       │ Bags: 425  │ ││
│  │ │ Production: 21.25 MT (dry)                            │ ││
│  │ │                                                       │ ││
│  │ │ Expected Total: 0.3 ha × 4,000 = 1,200 kg × 15 = 18 MT
│  │ │ Actual Total: 21.25 MT                                │ ││
│  │ │ Utilization: 118% ✅ EXCELLENT                       │ ││
│  │ │                                                       │ ││
│  │ │ Avg Yield: 2.5 t/ha  │  Avg Utilization: 118%       │ ││
│  │ │                                                       │ ││
│  │ └───────────────────────────────────────────────────────┘ ││
│  │                                                              ││
│  │ Top Performers (HYBRID):                                   ││
│  │ 1. Juan Dela Cruz: 220% utilization                        ││
│  │ 2. Rosa Flores: 145% utilization                           ││
│  │ 3. Miguel Reyes: 132% utilization                          ││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                    │
│  ┌─ INBRED (Government Program) ─────────────────────────────────┐│
│  │                                                              ││
│  │ 🌾 INBRED           ■ Green (color indicator)              ││
│  │ Standard: 1,500 kg/ha (dry) | Seeding Density: 40 kg/ha   ││
│  │                                                              ││
│  │ ┌─ Statistics Row ──────────────────────────────────────┐ ││
│  │ │                                                       │ ││
│  │ │ Farmers: 20        │ Area: 10.2 ha      │ Bags: 510  │ ││
│  │ │ Production: 25.5 MT (dry)                             │ ││
│  │ │                                                       │ ││
│  │ │ Expected Total: 10.2 × 1,500 = 15.3 MT             │ ││
│  │ │ Actual Total: 25.5 MT                                │ ││
│  │ │ Utilization: 166% ✅ EXCEPTIONAL                    │ ││
│  │ │                                                       │ ││
│  │ │ Avg Yield: 2.5 t/ha  │  Avg Utilization: 166%       │ ││
│  │ │                                                       │ ││
│  │ └───────────────────────────────────────────────────────┘ ││
│  │                                                              ││
│  │ Top Performers (INBRED):                                    ││
│  │ 1. Maria Santos: 528% utilization (exceptional!)            ││
│  │ 2. Pedro Reyes: 220% utilization                            ││
│  │ 3. Anna Cruz: 187% utilization                              ││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                    │
│  ┌─ OWN_SEED (Farmer's Own Stock) ───────────────────────────────┐│
│  │                                                              ││
│  │ 🌾 OWN_SEED         ■ Purple (color indicator)              ││
│  │ Standard: 2,000 kg/ha (dry) | Seeding Density: 15 kg/ha    ││
│  │                                                              ││
│  │ ┌─ Statistics Row ──────────────────────────────────────┐ ││
│  │ │                                                       │ ││
│  │ │ Farmers: 10        │ Area: 4.8 ha       │ Bags: 240  │ ││
│  │ │ Production: 12.0 MT (dry)                             │ ││
│  │ │                                                       │ ││
│  │ │ Expected Total: 4.8 × 2,000 = 9.6 MT                │ ││
│  │ │ Actual Total: 12.0 MT                                │ ││
│  │ │ Utilization: 125% ✅ EXCELLENT                       │ ││
│  │ │                                                       │ ││
│  │ │ Avg Yield: 2.5 t/ha  │  Avg Utilization: 125%        │ ││
│  │ │                                                       │ ││
│  │ └───────────────────────────────────────────────────────┘ ││
│  │                                                              ││
│  │ Note: OWN_SEED data includes farmer's informal stock        ││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ BREAKDOWN BY BARANGAY ────────────────────────────────────────────┐
│                                                                    │
│  Table: Harvest Performance per Barangay                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Barangay    │ Farmers │ Area (ha) │ Production │ Avg Yield │ │
│  │             │ Encoded │           │ (MT dry)   │ (t/ha)    │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ Lucban      │ 45      │ 23.5      │ 58.75      │ 2.5       │ │
│  │ Tayabas     │ 32      │ 18.2      │ 42.3       │ 2.3       │ │
│  │ Sariaya     │ 28      │ 15.6      │ 38.5       │ 2.5       │ │
│  │ Candelaria  │ 22      │ 12.1      │ 28.2       │ 2.3       │ │
│  │ Polilio     │ 18      │ 9.8       │ 24.5       │ 2.5       │ │
│  │             │ ───     │ ───       │ ───        │           │ │
│  │ TOTAL       │ 145     │ 79.2      │ 192.2      │ 2.4       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Status Indicators:                                               │
│  ✅ EXCELLENT (>150%)  ⚠️ GOOD (100-150%)  ⚠️ FAIR (75-100%)    │
│  ❌ NEEDS ATTENTION (<75%)                                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ CHARTS & VISUALIZATIONS ──────────────────────────────────────────┐
│                                                                    │
│  ┌─ Chart 1: Yield Distribution (Histogram) ────────────────────┐ │
│  │                                                              │ │
│  │ Frequency                                                   │ │
│  │ │                                                           │ │
│  │ 20│      ╱╲                                               │ │
│  │ 15│     ╱  ╲      ╱╲                                       │ │
│  │ 10│    ╱    ╲    ╱  ╲                                      │ │
│  │  5│   ╱      ╲  ╱    ╲                                     │ │
│  │  0└──┴──┴──┴──┴──┴──┴──┴──┴──┴──────────────────────────  │ │
│  │    1.0 1.5 2.0 2.5 3.0 3.5 4.0 4.5 5.0    t/ha            │ │
│  │                                                              │ │
│  │ Shows distribution of yields across all farmers            │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─ Chart 2: Production by Seed Type (Pie Chart) ─────────────┐  │
│  │                                                              │  │
│  │        HYBRID                                               │  │
│  │       ╱    ╲                                               │  │
│  │      ╱  36%  ╲        58.75 MT Distribution               │  │
│  │     │ (21.25  │      ├─ HYBRID: 21.25 MT (36%)           │  │
│  │     │   MT)   │      ├─ INBRED: 25.5 MT (43%)            │  │
│  │      ╲ INBRED╱       └─ OWN_SEED: 12.0 MT (21%)          │  │
│  │       ╲ 43%  ╱                                            │  │
│  │        ╲   ╱   OWN_SEED                                   │  │
│  │         ╱╲    21%                                         │  │
│  │        ╱  ╲   (12 MT)                                     │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ Chart 3: Utilization % by Barangay (Bar Chart) ─────────────┐ │
│  │                                                              │ │
│  │ Utilization %                                              │ │
│  │ │ 250%                                                     │ │
│  │ │                                                          │ │
│  │ │ 200│         ┌──┐                                        │ │
│  │ │    │         │  │  ┌──┐          ┌──┐                   │ │
│  │ │ 150│ ┌──┐    │  │  │  │  ┌──┐    │  │                   │ │
│  │ │    │ │  │    │  │  │  │  │  │    │  │                   │ │
│  │ │ 100│ │  │ ┌──┤  │  │  │  │  │ ┌──┤  │                   │ │
│  │ │    │ │  │ │  │  │  │  │  │  │ │  │  │                   │ │
│  │ │  50│ │  │ │  │  │  │  │  │  │ │  │  │                   │ │
│  │ │    └─┴──┴─┴──┴──┴──┴──┴──┴──┴─┴──┴──┴───────────────── │ │
│  │      L  T  S  C  P   (Barangays)                           │ │
│  │                                                              │ │
│  │ L=Lucban, T=Tayabas, S=Sariaya, C=Candelaria, P=Polilio  │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ LOW PERFORMERS / ALERTS ──────────────────────────────────────────┐
│                                                                    │
│  ⚠️ Farmers Below Target (< 100% Utilization):                  │
│                                                                    │
│  1. Carlos Mendoza (HYBRID)                                       │
│     Utilization: 72% (below 100%)                                │
│     Status: ❌ Needs intervention                                │
│     Expected: 1,200 kg | Actual: 864 kg | Missing: 336 kg       │
│     Possible Issues: Pest damage, water shortage                 │
│     Recommendation: Field visit by AT                             │
│                                                                    │
│  2. Rosa Navarro (INBRED)                                         │
│     Utilization: 85% (below 100%)                                │
│     Status: ⚠️ Below target                                      │
│     Expected: 450 kg | Actual: 382.5 kg | Missing: 67.5 kg      │
│     Possible Issues: Transplanting delay                         │
│     Recommendation: Monitor next observation                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ EXPORT & REPORTING ──────────────────────────────────────────────┐
│                                                                    │
│  Export Options:                                                  │
│                                                                    │
│  [📊 Download PDF Report]                                        │
│  └─ Includes: Summary, all charts, detailed tables              │
│             Suitable for printing/presentations                  │
│                                                                    │
│  [📋 Download Excel Spreadsheet]                                │
│  └─ All data in table format for further analysis               │
│             By barangay, farmer, seed type                       │
│                                                                    │
│  [📧 Email Report to MAO]                                        │
│  └─ Send directly to Municipal Agriculture Office                │
│             With summary and key findings                        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 3.3 ADMIN WORKFLOW - STEP BY STEP

```
SCENARIO: Admin Reviews Month-End Production Report

Step 1: OPEN PRODUCTION MENU
──────────────────────────────
1. Admin logs in
2. Clicks main menu → Production
3. Page loads: "Production Dashboard - Dry Season 2026"
4. Sees all key metrics at top:
   - Total Farmers: 145 encoded
   - Total Area: 79.2 ha
   - Total Production: 192.2 MT (dry)
   - Overall Utilization: 185%

Step 2: ANALYZE BY SEED TYPE
──────────────────────────────
1. Scrolls to "Breakdown by Seed Type" section
2. Sees three boxes: HYBRID, INBRED, OWN_SEED
3. Analyzes HYBRID:
   - 15 farmers, 8.5 ha, 21.25 MT
   - Utilization: 118% (EXCELLENT)
   - Avg yield: 2.5 t/ha (expected: 4.0 t/ha dry)
   - Status: ✅ Good performance
4. Analyzes INBRED:
   - 20 farmers, 10.2 ha, 25.5 MT
   - Utilization: 166% (EXCEPTIONAL)
   - Avg yield: 2.5 t/ha (expected: 1.5 t/ha dry)
   - Status: ✅ Outstanding performance
5. Analyzes OWN_SEED:
   - 10 farmers, 4.8 ha, 12.0 MT
   - Utilization: 125% (EXCELLENT)
   - Status: ✅ Good self-seed farmers

Step 3: COMPARE BY BARANGAY
─────────────────────────────
1. Scrolls to "Breakdown by Barangay" table
2. Sees all 5 barangays ranked:
   Rank 1: Lucban - 45 farmers, 23.5 ha, 58.75 MT, 2.5 t/ha
   Rank 2: Tayabas - 32 farmers, 18.2 ha, 42.3 MT, 2.3 t/ha
   Rank 3: Sariaya - 28 farmers, 15.6 ha, 38.5 MT, 2.5 t/ha
   Rank 4: Candelaria - 22 farmers, 12.1 ha, 28.2 MT, 2.3 t/ha
   Rank 5: Polilio - 18 farmers, 9.8 ha, 24.5 MT, 2.5 t/ha
3. Notes: Lucban leading, but Sariaya & Polilio have best avg yield
4. Tayabas & Candelaria slightly below average (2.3 vs 2.4)

Step 4: VIEW VISUALIZATIONS
────────────────────────────
1. Scrolls to Charts section
2. Chart 1: Yield Distribution
   - Sees normal distribution curve centered at 2.4 t/ha
   - Most farmers 2.0-2.8 t/ha range
   - Few outliers at 1.0 t/ha (poor) or 4.0+ t/ha (excellent)
3. Chart 2: Production by Seed Type (Pie)
   - HYBRID: 36% (21.25 MT)
   - INBRED: 43% (25.5 MT) ← Best performer!
   - OWN_SEED: 21% (12.0 MT)
4. Chart 3: Utilization by Barangay (Bar)
   - Lucban, Sariaya, Polilio near 200% utilization
   - Tayabas, Candelaria around 160-170%
   - All above minimum 100%

Step 5: IDENTIFY PROBLEM CASES
────────────────────────────────
1. Scrolls to "Low Performers / Alerts"
2. Sees 2 farmers below 100%:
   - Carlos Mendoza (HYBRID): 72% utilization
     Explanation: Expected 1,200 kg, got only 864 kg
     Missing: 336 kg (28% shortfall)
     Possible cause: Pest damage or water shortage
     Action: Flag for AT follow-up visit
   - Rosa Navarro (INBRED): 85% utilization
     Explanation: Expected 450 kg, got 382.5 kg
     Missing: 67.5 kg (15% shortfall)
     Possible cause: Transplanting delay
     Action: Monitor in next observation

Step 6: PREPARE REPORT FOR MAO
───────────────────────────────
1. Clicks "Export PDF Report"
2. System generates document with:
   - Cover page: Season, date, total summary
   - Section 1: Key findings
   - Section 2: Seed type breakdown
   - Section 3: Barangay comparison
   - Section 4: Charts & visualizations
   - Section 5: Problem farmers
   - Section 6: Recommendations
3. PDF ready for printing/sharing

Step 7: OPTIONAL - EMAIL TO OFFICIALS
──────────────────────────────────────
1. Clicks "Email Report to MAO"
2. Selects recipients:
   - MAO Director
   - Municipal Mayor
   - Barangay Presidents
3. Email sent with PDF attached
4. Summary in email body

Step 8: DRILL-DOWN TO SPECIFIC FARMER
─────────────────────────────────────
1. Admin wants to check Maria Santos in detail
2. Clicks on her record in the barangay table (if expandable)
3. Sees her individual record:
   - INBRED: 54 bags (2,700 kg fresh = 2,376 kg dry)
   - Area: 0.3 ha
   - Yield: 7.92 t/ha (exceptional!)
   - Utilization: 528% (far above 100%)
   - Status: ✅ MASTER FARMER badge
   - Distribution: 40 kg INBRED received
   - Seed Implied: 12 kg (30% of 40)
   - Seed Efficiency: 30%
   - Productivity: 198 kg paddy per 1 kg seed
4. Admin makes note: "Excellent farmer, can be featured as success story"
```

## 3.4 ADMIN API ENDPOINTS NEEDED

```
┌─ NEW ENDPOINTS TO CREATE ────────────────────────────────────────┐
│                                                                  │
│ GET /api/production/summary/                                     │
│     Returns: Overall metrics                                     │
│     Fields: total_farmers, total_area_ha, total_production_mt,   │
│             avg_yield_t_ha, overall_utilization_pct              │
│                                                                  │
│ GET /api/production/by-seed-type/                                │
│     Returns: Metrics broken down by HYBRID, INBRED, OWN_SEED    │
│     Fields per seed: count, area, production, avg_yield,        │
│                     utilization, top_performers                  │
│                                                                  │
│ GET /api/production/by-barangay/                                 │
│     Returns: Metrics for each barangay                           │
│     Fields: barangay, farmer_count, area, production,           │
│             avg_yield, utilization                               │
│                                                                  │
│ GET /api/production/low-performers/?threshold=100               │
│     Returns: Farmers below threshold utilization %               │
│     Fields: farmer_name, utilization, expected, actual,         │
│             gap_kg, notes                                        │
│                                                                  │
│ GET /api/production/export-pdf/                                  │
│     Returns: PDF file for download                               │
│     Content: All sections of production report                   │
│                                                                  │
│ POST /api/production/send-email/                                 │
│     Payload: recipients[], subject, message                      │
│     Action: Email report to MAO officials                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

# PART 4: INTEGRATION & DATA FLOW

## 4.1 COMPLETE SYSTEM FLOW

```
PHASE 1: REGISTRATION (Admin/BRGY)
┌─────────────────────────────────┐
│ Admin or BRGY President          │
│ registers farmer as beneficiary  │
│ ✓ Name, location, farm area     │
│ ✓ Contact info                  │
└────────────┬────────────────────┘
             │
             ▼
PHASE 2: DISTRIBUTION (Admin/BRGY)
┌─────────────────────────────────┐
│ Admin approves distribution      │
│ BRGY encodes delivery           │
│ ✓ Variety (NSIC Rc 222, etc.)   │
│ ✓ Seed type: HYBRID (15kg/ha)   │
│   or INBRED (40kg/ha)           │
│   or OWN_SEED (15kg/ha)         │
│ ✓ Quantity in bags              │
│ ✓ Farmer signature              │
│ Area Planned: 0.5 ha            │
└────────────┬────────────────────┘
             │
             ▼
PHASE 3: CROP MONITORING (AT - Field Visits)
┌─────────────────────────────────┐
│ AT visits farm ~every 2 weeks   │
│ Records crop phase              │
│ ✓ ESTABLISHMENT (0-15 days)    │
│ ✓ TILLERING (15-30 days)       │
│ ✓ FLOWERING (30-50 days)       │
│ ✓ RIPENING (50-70 days)        │
│ ✓ HARVESTING (70-90+ days)     │
│                                 │
│ Also records:                   │
│ ✓ Area Actually Planted (from field)
│ ✓ Status (Normal/Delayed/Damaged)
│ ✓ Observations & remarks        │
└────────────┬────────────────────┘
             │
         ~90 Days
             │
             ▼
PHASE 4: HARVEST ENCODING (BRGY President)
┌─────────────────────────────────┐
│ BRGY President (Elena) meets     │
│ with farmers at harvest time     │
│ FOR EACH SEED TYPE:              │
│                                 │
│ 1. Select Farmer & Seed Type   │
│    Juan Dela Cruz - HYBRID      │
│                                 │
│ 2. Enter Harvest Data:          │
│    Variety: NSIC Rc 222         │
│    Harvest: 60 bags (3,000 kg)  │
│    Weight Type: Fresh           │
│    Moisture: 12%                │
│    Area (from crop monitoring)  │
│                                 │
│ 3. System Calculates:           │
│    Fresh: 3,000 kg              │
│    ▼ Converts (12% moisture)    │
│    Dry: 2,640 kg                │
│                                 │
│    Seed Implied: 0.3 × 15 = 4.5 kg
│    Expected Yield: 0.3 × 4000 = 1,200 kg
│    Actual Yield: 2,640 kg       │
│    ✅ Utilization: 220%         │
│    Status: EXCEPTIONAL          │
│                                 │
│ 4. Creates HarvestRecord #1:    │
│    Juan - HYBRID - 220%         │
│                                 │
│ 5. Repeat for INBRED:           │
│    Juan - INBRED - 54 bags      │
│    ▼ System calculates 528%     │
│    Creates HarvestRecord #2     │
│                                 │
│ Result: One farmer = Multiple   │
│         HarvestRecords (1 per   │
│         seed type)              │
└────────────┬────────────────────┘
             │
             ▼
PHASE 5: PRODUCTION ANALYSIS (Admin)
┌─────────────────────────────────┐
│ Admin opens Production Dashboard │
│ Sees:                           │
│ ✓ Total Production: 192.2 MT    │
│ ✓ By Seed Type:                 │
│   • HYBRID: 21.25 MT (36%)      │
│   • INBRED: 25.5 MT (43%)       │
│   • OWN_SEED: 12.0 MT (21%)     │
│                                 │
│ ✓ By Barangay: Lucban leading   │
│                                 │
│ ✓ Performance:                  │
│   • Avg Yield: 2.5 t/ha         │
│   • Utilization: 185% (excellent)
│   • Top Farmers: Maria 528%,    │
│     Juan 220%                   │
│                                 │
│ ✓ Alerts: Carlos 72%, Rosa 85%  │
│   (below target)                │
│                                 │
│ Generates Report & Exports      │
│ Sends to MAO officials          │
└─────────────────────────────────┘

DATA STORAGE:
├─ User (farmer): John Dela Cruz
├─ Distribution: HYBRID (15kg/ha) + INBRED (40kg/ha) + OWN_SEED
├─ CropMonitoring: Phase progression ESTABLISHMENT → HARVESTING
├─ HarvestRecord #1: HYBRID - 3,000 kg fresh → 2,640 kg dry - 220% util
├─ HarvestRecord #2: INBRED - 2,700 kg fresh → 2,376 kg dry - 528% util
├─ HarvestRecord #3: OWN_SEED - 3,000 kg fresh → 2,640 kg dry - 440% util
└─ Admin Dashboard: Aggregates all HarvestRecords for analysis
```

## 4.2 DATA RELATIONSHIPS

```
┌─ RELATIONSHIPS ───────────────────────────────────────────────────┐
│                                                                   │
│ User (Farmer)                                                     │
│  ├─ Beneficiary Entries (program enrollment)                     │
│  ├─ Distribution Entries (seeds distributed)                     │
│  │  ├─ seed_type: HYBRID (15 kg/ha) / INBRED (40 kg/ha) / OWN  │
│  │  ├─ farm_area_ha: 0.5 hectares                               │
│  │  └─ Links to: Crop Phase monitoring, Harvest records         │
│  │                                                               │
│  ├─ Crop Phase Records (AT visits)                              │
│  │  ├─ crop_phase: ESTABLISHMENT, TILLERING, FLOWERING, etc   │
│  │  ├─ area_monitored_ha: 0.3 (less than planned 0.5)         │
│  │  ├─ phase_status: NORMAL / DELAYED / DAMAGED                │
│  │  └─ date_observed: Jun 5, 2026                              │
│  │                                                               │
│  └─ Harvest Records (BRGY encoding) ← MULTIPLE per farmer       │
│     ├─ Record 1: HYBRID seed type                               │
│     │  ├─ harvest_bags: 60 (= 3,000 kg fresh)                 │
│     │  ├─ weight_type: FRESH                                   │
│     │  ├─ moisture_content: 12%                                │
│     │  ├─ harvest_area_ha: 0.3 (from crop phase)               │
│     │  ├─ seed_source: HYBRID                                  │
│     │  └─ Calculated metrics:                                  │
│     │     • harvest_kg_dry: 2,640 kg                           │
│     │     • seed_implied_planted: 4.5 kg                       │
│     │     • utilization_pct: 220% ✅                           │
│     │                                                           │
│     ├─ Record 2: INBRED seed type                              │
│     │  ├─ harvest_bags: 54 (= 2,700 kg fresh)                 │
│     │  ├─ weight_type: FRESH                                   │
│     │  ├─ moisture_content: 12%                                │
│     │  ├─ harvest_area_ha: 0.3 (from crop phase)               │
│     │  ├─ seed_source: INBRED                                  │
│     │  └─ Calculated metrics:                                  │
│     │     • harvest_kg_dry: 2,376 kg                           │
│     │     • seed_implied_planted: 12 kg (40 kg/ha!)           │
│     │     • utilization_pct: 528% ✅                           │
│     │                                                           │
│     └─ Record 3: OWN_SEED seed type                            │
│        └─ Similar structure per seed type                      │
│                                                                 │
│ Admin Production Dashboard (Aggregates all records)             │
│  ├─ Total production across all farmers                         │
│  ├─ Breakdown by seed type (HYBRID/INBRED/OWN_SEED)           │
│  ├─ Breakdown by barangay                                       │
│  ├─ Performance metrics (utilization, yield)                    │
│  ├─ Visualizations (charts, graphs)                            │
│  └─ Alert system (farmers below targets)                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# SUMMARY TABLE

## What Each Role Does & Sees

```
┌──────────────────────────────────────────────────────────────────┐
│                          ROLE COMPARISON                         │
├──────────────────────────────────────────────────────────────────┤
│ ROLE     │ WHAT THEY ENCODE          │ WHERE         │ STATUS    │
├──────────────────────────────────────────────────────────────────┤
│ BRGY     │ Harvest data by           │ /brgy/        │ ✅ Ready  │
│ Pres     │ seed type per farmer      │ harvest       │ (needs    │
│          │ • Harvest amount          │               │ menu+form │
│          │ • Weight type (Fresh/Dry) │               │ update)   │
│          │ • Moisture content        │               │           │
│          │ Creates: Multiple         │               │           │
│          │ HarvestRecords            │               │           │
├──────────────────────────────────────────────────────────────────┤
│ AT       │ Crop phase observations   │ /at/crop-     │ ✅ Ready  │
│          │ per farmer visit          │ monitoring    │ (100%     │
│          │ • Phase: ESTABLISHMENT    │               │ complete) │
│          │   to HARVESTING           │               │           │
│          │ • Status: Normal/Delayed  │               │           │
│          │   /Damaged                │               │           │
│          │ • Area planted (from      │               │           │
│          │   field observation)      │               │           │
│          │ Creates: 1 record per     │               │           │
│          │ visit (multiple visits    │               │           │
│          │ over season)              │               │           │
├──────────────────────────────────────────────────────────────────┤
│ Admin    │ Analyzes & Reports        │ /admin/       │ ❌ NEEDS  │
│          │ • Views harvest data      │ production    │ BUILD     │
│          │ • Aggregates by:          │               │           │
│          │   - Seed type             │               │           │
│          │   - Barangay              │               │           │
│          │   - Performance metrics   │               │           │
│          │ • Generates reports       │               │           │
│          │ • Exports PDF/Excel       │               │           │
│          │ Does NOT encode data      │               │           │
│          │ (views only)              │               │           │
├──────────────────────────────────────────────────────────────────┤
│ Farmer   │ Views (No encoding)       │ /farmer/      │ ⚠️ Stub   │
│          │ • Distribution status     │ (YieldEncode) │ (empty)   │
│          │ • Crop monitoring         │               │           │
│          │   records (from AT)       │               │           │
│          │ • Expected harvest        │               │           │
│          │ • Performance trends      │               │           │
└──────────────────────────────────────────────────────────────────┘
```

---

**END OF COMPREHENSIVE UI/UX SPECIFICATIONS**

Document prepared for AGRICE Lucban Production System
All interfaces aligned with Department of Agriculture standards
Fresh/Dry weight conversions: 0.88 factor (12% moisture reduction)
