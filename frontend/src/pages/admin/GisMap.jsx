// src/pages/admin/GisMap.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MapPin, X, RefreshCw,
  CheckCircle, AlertCircle, ChevronLeft,
  Layers, Activity, TrendingUp, Clock,
  Database, Users, Target,
} from 'lucide-react';
import API, {
  getGisPlots,
  getMapSummary,
  getGisBarangays,
  getProductionGISSummary,
  getHarvestRecords,
  getGisActivePoll,
  getGisAllPolls,
} from '../../api/axios';
import LucbanGIS from '../../data/LucbanGIS.json';

// ─── CROP PHASE CONSTANTS ─────────────────────────────────────
const PHASES = [
  { key: 'Seed Distribution',  color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB', label: 'Seed Distribution'  },
  { key: 'Crop Establishment', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', label: 'Crop Establishment' },
  { key: 'Tillering',          color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', label: 'Tillering'          },
  { key: 'Flowering',          color: '#A855F7', bg: '#FAF5FF', border: '#E9D5FF', label: 'Flowering'          },
  { key: 'Ripening',           color: '#FACC15', bg: '#FEFCE8', border: '#FDE68A', label: 'Ripening'           },
  { key: 'Harvesting',         color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', label: 'Harvesting'         },
];
const PHASE_ORDER = [
  'Seed Distribution',
  'Crop Establishment',
  'Tillering',
  'Flowering',
  'Ripening',
  'Harvesting',
];
const PHASE_MAP = Object.fromEntries(PHASES.map(p => [p.key, p]));
const phaseColor = (key) => PHASE_MAP[key]?.color || '#64748B';

// ─── SEED TYPE CONFIG ─────────────────────────────────────────
const SEED_TYPES = [
  { key: 'HYBRID',   label: 'Hybrid seeds',        color: '#1a4d1a', bg: '#f0fdf4', border: '#bbf7d0', hasDistribution: true  },
  { key: 'INBRED',   label: 'Certified seeds',      color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', hasDistribution: true  },
  { key: 'OWN_SEED', label: 'Farmer saved seeds',   color: '#b45309', bg: '#fef3c7', border: '#fde68a', hasDistribution: false },
];
const SEED_TYPE_MAP = Object.fromEntries(SEED_TYPES.map(s => [s.key, s]));

// Target yields per seed type — must match BrgyHarvest exactly
const TARGET_YIELD_KG_HA = {
  HYBRID:   5000,
  INBRED:   4000,
  OWN_SEED: 3000,
};

// Phases available per seed type
const getPhasesForSeedType = (seedKey) => {
  const hasDistribution = SEED_TYPE_MAP[seedKey]?.hasDistribution ?? true;
  return PHASES.filter(p => hasDistribution || p.key !== 'Seed Distribution');
};

// ─── UTILIZATION HELPERS ──────────────────────────────────────
// Must match BrgyHarvest.jsx computeMetrics exactly:
// harvest_kg = harvest_bags * 50  (all bags are 50kg fixed)
// expected_kg = area * target_yield_kg_ha
// util_pct = (harvest_kg / expected_kg) * 100
const computeUtilPct = (rec) => {
  const bags     = parseFloat(rec.harvest_bags) || 0;
  const area     = parseFloat(rec.harvest_area_ha) || 0;
  const seed     = rec.seed_source || 'OWN_SEED';
  const target   = TARGET_YIELD_KG_HA[seed] || 3000;
  const harv_kg  = bags * 50;
  const exp_kg   = area * target;
  if (exp_kg <= 0) return null;
  return (harv_kg / exp_kg) * 100;
};

// ─── UTILIZATION TIER CONSTANTS — matches BrgyHarvest exactly ─
const UTIL_TIERS = [
  { key: 'Exceeded Target', min: 100.01, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', label: 'Exceeded Target' },
  { key: 'Achieved Target', min: 80,     color: '#15803d', bg: '#dcfce7', border: '#86efac', label: 'Achieved Target' },
  { key: 'Near Target',     min: 70,     color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe', label: 'Near Target'     },
  { key: 'Below Target',    min: 50,     color: '#b45309', bg: '#fefce8', border: '#fde68a', label: 'Below Target'    },
  { key: 'Critical',        min: 0,      color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', label: 'Critical'        },
];
const NO_DATA_COLOR = '#1E293B';

const getUtilTier = (pct) => {
  if (pct === null || pct === undefined) return null;
  if (pct > 100) return UTIL_TIERS[0];
  return UTIL_TIERS.find(t => pct >= t.min) || UTIL_TIERS[UTIL_TIERS.length - 1];
};
const getUtilColor = (pct) => {
  const tier = getUtilTier(pct);
  return tier ? tier.color : NO_DATA_COLOR;
};

// ─── BARANGAY HELPERS ─────────────────────────────────────────
const ALLOWED_BRGYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan',
];
const normalizeBrgy = (v) =>
  v?.toString().trim().replace(/[-_]+/g,' ').replace(/\s+/g,' ').toLowerCase();

const BRGY_FEATURES = LucbanGIS.features.filter(f =>
  ALLOWED_BRGYS.some(b => normalizeBrgy(f.properties?.ADM4_EN) === normalizeBrgy(b))
);

const normalizePhase = (value) => {
  const phase = (value || '').toString().trim();
  if (!phase) return 'Seed Distribution';
  if (/^seed[\s_-]*distribution$/i.test(phase)) return 'Seed Distribution';
  if (/^distribution$/i.test(phase)) return 'Seed Distribution';
  if (/^crop[\s_-]*establishment$/i.test(phase)) return 'Crop Establishment';
  if (/^no[\s_-]*monitoring[\s_-]*yet$/i.test(phase)) return 'Seed Distribution';
  if (/^distribution[\s_-]*only$/i.test(phase)) return 'Seed Distribution';
  return Object.keys(PHASE_MAP).find(k => k.toLowerCase() === phase.toLowerCase()) || phase;
};

const fmtNum = (n, d = 2) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

// ─── COMPUTE SEED TYPE BREAKDOWN FROM PLOTS (CROP MONITORING) ─
const buildSeedTypeBreakdown = (plots) => {
  const result = {};
  const seen = new Set();
  plots.forEach(plot => {
    const rawSeed = plot.seed_source;
    const seedKey = (rawSeed && rawSeed.trim()) ? rawSeed.trim() : 'OWN_SEED';
    const phase   = normalizePhase(plot.land_type);
    const dedupeKey = `${plot.farmer}::${seedKey}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    if (!result[seedKey]) result[seedKey] = { phases: {}, total: 0 };
    result[seedKey].phases[phase] = (result[seedKey].phases[phase] || 0) + 1;
    result[seedKey].total += 1;
  });
  return result;
};

// ─── BUILD PER-BARANGAY UTILIZATION FROM HARVEST RECORDS ──────
// This computes everything client-side using the same formula as BrgyHarvest
// so the map colors and panel data are always consistent
const buildBrgyUtilFromHarvest = (harvestRecords) => {
  const result = {};
  harvestRecords.forEach(rec => {
    const rawBrgy = rec.barangay;
    if (!rawBrgy) return;

    const canonicalBrgy = ALLOWED_BRGYS.find(
      b => normalizeBrgy(b) === normalizeBrgy(rawBrgy)
    ) || rawBrgy;

    const util = computeUtilPct(rec);
    const area = parseFloat(rec.harvest_area_ha) || 0;
    const bags = parseFloat(rec.harvest_bags) || 0;
    const mt   = (bags * 50) / 1000;

    if (!result[canonicalBrgy]) {
      result[canonicalBrgy] = {
        barangay: canonicalBrgy,
        farmer_ids: new Set(),
        util_vals: [],
        total_area_ha: 0,
        total_production_mt: 0,
        avg_utilization_pct: null,
        avg_yield_t_ha: 0,
        farmer_count: 0,
      };
    }

    result[canonicalBrgy].farmer_ids.add(rec.farmer);
    result[canonicalBrgy].total_area_ha += area;
    result[canonicalBrgy].total_production_mt += mt;
    if (util !== null) result[canonicalBrgy].util_vals.push(util);
  });

  Object.values(result).forEach(b => {
    b.farmer_count = b.farmer_ids.size;
    if (b.util_vals.length > 0) {
      b.avg_utilization_pct = b.util_vals.reduce((a, v) => a + v, 0) / b.util_vals.length;
    }
    if (b.total_area_ha > 0) {
      b.avg_yield_t_ha = b.total_production_mt / b.total_area_ha;
    }
    delete b.farmer_ids;
    delete b.util_vals;
  });

  return result;
};

// ─── LEAFLET LOADER ───────────────────────────────────────────
let _leafletReady = false;
const loadLeaflet = () =>
  new Promise(resolve => {
    if (window.L) { resolve(window.L); return; }
    if (_leafletReady) {
      const t = setInterval(() => { if (window.L) { clearInterval(t); resolve(window.L); } }, 40);
      return;
    }
    _leafletReady = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = () => resolve(window.L);
    document.head.appendChild(js);
  });

// ─── TOAST ────────────────────────────────────────────────────
const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 9999,
      backgroundColor: toast.type === 'error' ? '#991b1b' : '#1a4d1a',
      color: 'white', padding: '0.7rem 1.4rem',
      borderRadius: '999px', fontSize: '0.84rem', fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: '0.45rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
      animation: 'gis-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      maxWidth: 'calc(100vw - 2rem)',
    }}>
      {toast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
      {toast.msg}
    </div>
  );
};

// ─── SEED TYPE BREAKDOWN CARD (CROP MONITORING) ───────────────
const SeedTypeBreakdownCard = ({ seedKey, phaseCounts, totalFarmers, totalApprovedFarmers }) => {
  const cfg = SEED_TYPE_MAP[seedKey] || { label: seedKey, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', hasDistribution: true };
  const allowedPhases = getPhasesForSeedType(seedKey);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(false);
    const t = window.setTimeout(() => setAnimated(true), 80);
    return () => window.clearTimeout(t);
  }, [phaseCounts]);

  const denominator = totalApprovedFarmers > 0 ? totalApprovedFarmers : totalFarmers;

  const phaseList = allowedPhases
    .map(ph => ({
      ...ph,
      count:   phaseCounts[ph.key] || 0,
      percent: denominator > 0 ? Math.round(((phaseCounts[ph.key] || 0) / denominator) * 100) : 0,
    }))
    .filter(ph => ph.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return PHASE_ORDER.indexOf(b.key) - PHASE_ORDER.indexOf(a.key);
    });

  const dominant = phaseList[0] || null;
  const others   = phaseList.slice(1);

  if (phaseList.length === 0) {
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: `1px solid ${cfg.border}`, padding: '1rem 1.1rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{cfg.label}</span>
          </div>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Breakdown</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '0.5rem 0' }}>No data yet</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: `1px solid ${cfg.border}`, padding: '1rem 1.1rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{cfg.label}</span>
        </div>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Breakdown</span>
      </div>
      {dominant && (
        <div style={{ backgroundColor: PHASE_MAP[dominant.key]?.bg || '#f9fafb', border: `1px solid ${PHASE_MAP[dominant.key]?.border || '#e5e7eb'}`, borderRadius: '0.75rem', padding: '0.75rem 0.875rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dominant.color, display: 'inline-block' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dominant</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: dominant.color }}>{dominant.label}</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: dominant.color }}>{dominant.percent}%</span>
          </div>
          <div style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: animated ? `${Math.max(2, dominant.percent)}%` : '0%', backgroundColor: dominant.color, borderRadius: '999px', transition: 'width 0.6s cubic-bezier(0.34,1,0.64,1)' }} />
          </div>
        </div>
      )}
      {others.map(ph => (
        <div key={ph.key} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: ph.color, display: 'inline-block' }} />
              <span style={{ fontSize: '0.73rem', fontWeight: 600, color: '#374151' }}>{ph.label}</span>
            </div>
            <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#0f172a' }}>{ph.percent}%</span>
          </div>
          <div style={{ height: 5, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: animated ? `${Math.max(2, ph.percent)}%` : '0%', backgroundColor: ph.color, borderRadius: '999px', transition: 'width 0.55s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── UTIL SEED TYPE CARD (CROP UTILIZATION) ───────────────────
// Shows tier breakdown (Master Farmer / Exceptional / Normal etc)
// for one seed type in one barangay (or all brgys for overview)
const UtilSeedTypeCard = ({ seedKey, tierCounts, total, animate, encodedFarmers, totalApprovedFarmers }) => {
  const cfg = SEED_TYPE_MAP[seedKey] || { label: seedKey, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  const [animated, setAnimated] = useState(false);
  const displayDenominator = totalApprovedFarmers > 0 ? totalApprovedFarmers : total;

  useEffect(() => {
    setAnimated(false);
    const t = window.setTimeout(() => setAnimated(true), 80);
    return () => window.clearTimeout(t);
  }, [tierCounts]);

  const tierList = UTIL_TIERS
    .map(tier => ({
      ...tier,
      count:   tierCounts[tier.key] || 0,
      percent: displayDenominator > 0 ? Math.round(((tierCounts[tier.key] || 0) / displayDenominator) * 100) : 0,
    }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const dominant = tierList[0] || null;
  const others   = tierList.slice(1);

  if (tierList.length === 0) {
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: `1px solid ${cfg.border}`, padding: '1rem 1.1rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{cfg.label}</span>
          </div>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Harvest breakdown</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '0.5rem 0' }}>No harvest data yet</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: `1px solid ${cfg.border}`, padding: '1rem 1.1rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{cfg.label}</span>
        </div>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Harvest breakdown</span>
      </div>

      {/* DOMINANT — big font */}
      {dominant && (
        <div style={{ backgroundColor: dominant.bg, border: `1px solid ${dominant.border}`, borderRadius: '0.75rem', padding: '0.75rem 0.875rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dominant.color, display: 'inline-block' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dominant</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: dominant.color }}>{dominant.label}</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: dominant.color }}>
              {totalApprovedFarmers > 0
                ? `${Math.round((encodedFarmers / totalApprovedFarmers) * 100)}%`
                : `${dominant.percent}%`}
            </span>
          </div>
          <div style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: animated ? `${totalApprovedFarmers > 0
                  ? Math.max(2, Math.round((encodedFarmers / totalApprovedFarmers) * 100))
                  : Math.max(2, dominant.percent)}%` : '0%',
                backgroundColor: dominant.color,
                borderRadius: '999px',
                transition: 'width 0.6s cubic-bezier(0.34,1,0.64,1)',
              }}
            />
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.65rem', color: '#64748b' }}>
            {totalApprovedFarmers > 0
              ? `${encodedFarmers} of ${totalApprovedFarmers} approved farmers encoded`
              : `${dominant.count} of ${total} farmer${total !== 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* OTHER TIERS — smaller */}
      {others.map(tier => (
        <div key={tier.key} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: tier.color, display: 'inline-block' }} />
              <span style={{ fontSize: '0.73rem', fontWeight: 600, color: '#374151' }}>{tier.label}</span>
            </div>
            <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#0f172a' }}>{tier.percent}%</span>
          </div>
          <div style={{ height: 5, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: animated ? `${Math.max(2, tier.percent)}%` : '0%', backgroundColor: tier.color, borderRadius: '999px', transition: 'width 0.55s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── PANEL FOOTER ─────────────────────────────────────────────
const PanelFooter = ({ activeTab }) => {
  const now = new Date();
  const ts  = `${now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · ${now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
  return (
    <div style={{ padding: '0.75rem 0.875rem', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', flexShrink: 0 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '0.875rem', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <Clock size={13} color='#64748b' />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last updated</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.4 }}>{ts}</p>
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '0.875rem', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <Database size={13} color='#64748b' />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data source</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', lineHeight: 1.4 }}>
          {activeTab === 'utilization' ? 'Harvest records' : 'AT monitoring'}
          <br />
          <span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 400 }}>
            {activeTab === 'utilization' ? '(BRGY encoded)' : '(Latest visit)'}
          </span>
        </p>
      </div>
    </div>
  );
};

// ─── MONITORING OVERVIEW PANEL ────────────────────────────────
const MonitoringOverviewPanel = ({ plots, summary, animate, monitoringTab, setMonitoringTab }) => {
  const currentFarmers = summary?.current_farmers ?? new Set(plots.map(p => p.farmer)).size;
  const totalApproved  = summary?.total_approved_farmers ?? currentFarmers;
  const currentBrgys   = summary?.current_active_barangays ?? new Set(plots.map(p => p.barangay).filter(Boolean)).size;
  const totalBrgys     = summary?.total_active_barangays ?? currentBrgys;
  const seedBreakdown  = useMemo(() => buildSeedTypeBreakdown(plots), [plots]);

  return (
    <>
      <div style={{ padding: '0 1.25rem 1rem', flexShrink: 0 }}>
        <div style={{ background: 'linear-gradient(135deg, #1a4d1a 0%, #166534 100%)', borderRadius: '1.25rem', padding: '1.25rem', color: 'white', animation: animate ? 'gis-fadeSlide 0.35s ease' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Activity size={15} color='rgba(255,255,255,0.8)' />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Lucban crop monitoring</span>
            <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.62rem', fontWeight: 700 }}>LIVE</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{currentFarmers}/{totalApproved}</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Total farmers</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{currentBrgys}/{totalBrgys}</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Active barangays</p>
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9', padding: '0 1.25rem', flexShrink: 0 }}>
          {SEED_TYPES.map((st) => {
            const isActive = (monitoringTab || 'HYBRID') === st.key;
            return (
              <button key={st.key} onClick={() => setMonitoringTab(st.key)} style={{
                padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: isActive ? 700 : 500,
                color: isActive ? st.color : '#94a3b8',
                borderBottom: isActive ? `2px solid ${st.color}` : '2px solid transparent',
                marginBottom: '-1px', transition: 'all .15s', whiteSpace: 'nowrap',
              }}>
                {st.key === 'OWN_SEED' ? 'Own Seed' : st.key === 'HYBRID' ? 'Hybrid' : 'Inbred'}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem 0.5rem' }} className='gis-panel-scroll'>
          {(() => {
            const activeKey = monitoringTab || 'HYBRID';
            return (
              <SeedTypeBreakdownCard
                key={activeKey}
                seedKey={activeKey}
                phaseCounts={seedBreakdown[activeKey]?.phases || {}}
                totalFarmers={seedBreakdown[activeKey]?.total || 0}
                totalApprovedFarmers={summary?.total_approved_farmers ?? 0}
                animate={animate}
              />
            );
          })()}
          {plots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
              <MapPin size={28} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.82rem' }}>No monitoring data yet.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── UTILIZATION OVERVIEW PANEL ───────────────────────────────
const UtilizationOverviewPanel = ({ harvestRecords, summary, animate, utilizationTab, setUtilizationTab }) => {
  // Compute everything from harvestRecords using our formula (same as BrgyHarvest)
  const brgyUtil = useMemo(() => buildBrgyUtilFromHarvest(harvestRecords), [harvestRecords]);
  const haData   = harvestRecords.length > 0;

  const totalFarmers  = useMemo(() => [...new Set(harvestRecords.map(r => r.farmer))].length, [harvestRecords]);
  const totalMT       = useMemo(() => harvestRecords.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0), [harvestRecords]);
  const totalArea     = useMemo(() => harvestRecords.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0), [harvestRecords]);

  // Global seed type tier breakdown (all brgys combined)
  const globalSeedTierCounts = useMemo(() => {
    const result = {};
    SEED_TYPES.forEach(st => { result[st.key] = { tierCounts: {}, total: 0 }; });
    harvestRecords.forEach(rec => {
      const seed = rec.seed_source || 'OWN_SEED';
      const util = computeUtilPct(rec);
      const tier = getUtilTier(util);
      const key  = tier ? tier.key : 'Needs attention';
      if (!result[seed]) result[seed] = { tierCounts: {}, total: 0 };
      result[seed].tierCounts[key] = (result[seed].tierCounts[key] || 0) + 1;
      result[seed].total += 1;
    });
    return result;
  }, [harvestRecords]);

  return (
    <>
      {/* FIXED HEADER */}
      <div style={{ padding: '0 1.25rem 1rem', flexShrink: 0 }}>
        <div style={{ background: 'linear-gradient(135deg, #1a4d1a 0%, #166534 100%)', borderRadius: '1.25rem', padding: '1.25rem', color: 'white', animation: animate ? 'gis-fadeSlide 0.35s ease' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <TrendingUp size={15} color='rgba(255,255,255,0.8)' />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Harvest utilization</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{haData ? totalFarmers : '—'}</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Farmers</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{haData ? `${fmtNum(totalMT)} MT` : '—'}</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Production</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{haData ? `${fmtNum(totalArea)} ha` : '—'}</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Area harvested</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9', padding: '0 1.25rem', flexShrink: 0 }}>
          {SEED_TYPES.map((st) => {
            const isActive = (utilizationTab || 'HYBRID') === st.key;
            return (
              <button key={st.key} onClick={() => setUtilizationTab(st.key)} style={{
                padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: isActive ? 700 : 500,
                color: isActive ? st.color : '#94a3b8',
                borderBottom: isActive ? `2px solid ${st.color}` : '2px solid transparent',
                marginBottom: '-1px', transition: 'all .15s', whiteSpace: 'nowrap',
              }}>
                {st.key === 'OWN_SEED' ? 'Own Seed' : st.key === 'HYBRID' ? 'Hybrid' : 'Inbred'}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem 0.5rem' }} className='gis-panel-scroll'>
          {!haData ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2.5rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <TrendingUp size={28} color='#d1d5db' style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.375rem', fontSize: '0.875rem' }}>No harvest data yet</p>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Utilization data will appear once BRGY presidents encode harvest records.</p>
            </div>
          ) : (
            (() => {
              const activeKey = utilizationTab || 'HYBRID';
              return (
                <UtilSeedTypeCard
                  key={activeKey}
                  seedKey={activeKey}
                  tierCounts={globalSeedTierCounts[activeKey]?.tierCounts || {}}
                  total={globalSeedTierCounts[activeKey]?.total || 0}
                  animate={animate}
                  encodedFarmers={harvestRecords ? [...new Set(harvestRecords.map(r => r.farmer))].length : 0}
                  totalApprovedFarmers={summary?.total_approved_farmers ?? 0}
                />
              );
            })()
          )}
        </div>
      </div>
    </>
  );
};

// ─── BARANGAY PANEL ───────────────────────────────────────────
const BarangayPanel = ({ barangayName, plots, approvedCounts, harvestRecords, activeTab, onBack, animate }) => {
  const [seedTab, setSeedTab] = useState('HYBRID');

  const brgyPlots = useMemo(() => plots.filter(p => p.barangay === barangayName), [plots, barangayName]);

  const uniqueFarmerIds = useMemo(() => [...new Set(brgyPlots.map(p => p.farmer))], [brgyPlots]);
  const farmerCount     = uniqueFarmerIds.length;
  const totalApproved   = approvedCounts?.[barangayName] ?? brgyPlots[0]?.total_approved_in_brgy ?? 0;
  const totalHa         = useMemo(() => {
    const areaPerFarmer = {};
    brgyPlots.forEach(p => {
      const ha = parseFloat(p.area_ha) || 0;
      if (!areaPerFarmer[p.farmer] || ha > areaPerFarmer[p.farmer]) areaPerFarmer[p.farmer] = ha;
    });
    return Object.values(areaPerFarmer).reduce((sum, ha) => sum + ha, 0);
  }, [brgyPlots]);
  const seedBreakdown   = useMemo(() => buildSeedTypeBreakdown(brgyPlots), [brgyPlots]);

  const brgyHarvest = useMemo(() => (harvestRecords || []).filter(r => r.barangay === barangayName), [harvestRecords, barangayName]);
  const encodedCount = useMemo(() => [...new Set(brgyHarvest.map(r => r.farmer))].length, [brgyHarvest]);
  const harvestArea  = useMemo(() => brgyHarvest.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0), [brgyHarvest]);
  const harvestMT    = useMemo(() => brgyHarvest.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0), [brgyHarvest]);

  const brgyUtilVals = useMemo(() => brgyHarvest.map(r => computeUtilPct(r)).filter(v => v !== null), [brgyHarvest]);
  const brgyAvgUtil  = brgyUtilVals.length > 0 ? brgyUtilVals.reduce((a, v) => a + v, 0) / brgyUtilVals.length : null;
  const utilTier     = getUtilTier(brgyAvgUtil);

  const brgySeedTierCounts = useMemo(() => {
    const result = {};
    SEED_TYPES.forEach(st => { result[st.key] = { tierCounts: {}, total: 0 }; });
    brgyHarvest.forEach(rec => {
      const seed = rec.seed_source || 'OWN_SEED';
      const util = computeUtilPct(rec);
      const tier = getUtilTier(util);
      const key  = tier ? tier.key : 'Critical';
      if (!result[seed]) result[seed] = { tierCounts: {}, total: 0 };
      result[seed].tierCounts[key] = (result[seed].tierCounts[key] || 0) + 1;
      result[seed].total += 1;
    });
    return result;
  }, [brgyHarvest]);

  const totalApprovedInBrgy = approvedCounts?.[barangayName] || 0;
  const encodingProgressPct = totalApprovedInBrgy > 0 ? Math.round((encodedCount / totalApprovedInBrgy) * 100) : 0;

  const headerBadgeColor = activeTab === 'utilization'
    ? (utilTier?.color || '#94a3b8')
    : '#94a3b8';

  const headerBadgeLabel = activeTab === 'utilization'
    ? (totalApprovedInBrgy > 0
        ? `${encodedCount}/${totalApprovedInBrgy} farmers · ${encodingProgressPct}% encoded`
        : encodedCount > 0 ? `${encodedCount} farmers encoded` : 'No harvest data')
    : `${farmerCount}${totalApproved ? `/${totalApproved}` : ''} farmers`;

  const activeSeedKey = seedTab || 'HYBRID';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: animate ? 'gis-fadeSlide 0.35s ease' : 'none' }}>
      {/* FIXED HEADER */}
      <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #1a4d1a 0%, #166534 100%)', color: 'white', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.5rem', color: 'white', padding: '0.35rem 0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
            <ChevronLeft size={14} /> Back
          </button>
          <span style={{ marginLeft: 'auto', backgroundColor: headerBadgeColor + '33', border: `1px solid ${headerBadgeColor}66`, borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
            {headerBadgeLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin size={20} color='white' />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Brgy. {barangayName}</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Lucban, Quezon</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'monitoring' ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: '0.6rem' }}>
          {activeTab === 'monitoring'
            ? [
                { label: 'Farmers', value: totalApproved ? `${farmerCount}/${totalApproved}` : `${farmerCount}` },
                { label: 'Area',    value: totalHa > 0 ? `${totalHa.toFixed(1)} ha` : '—' },
              ].map(item => (
                <div key={item.label} style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{item.value}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{item.label}</p>
                </div>
              ))
            : [
                { label: 'Farmers encoded', value: totalApprovedInBrgy > 0 ? `${encodedCount}/${totalApprovedInBrgy}` : `${encodedCount}` },
                { label: 'Production',      value: harvestMT > 0 ? `${fmtNum(harvestMT)} MT` : '—' },
                { label: 'Area harvested',  value: harvestArea > 0 ? `${fmtNum(harvestArea)} ha` : '—' },
              ].map(item => (
                <div key={item.label} style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{item.value}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{item.label}</p>
                </div>
              ))
          }
        </div>
      </div>

      {/* SEED TYPE TABS — same style as overview panels */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9', padding: '0 1.25rem', flexShrink: 0 }}>
        {SEED_TYPES.map((st) => {
          const isActive = activeSeedKey === st.key;
          return (
            <button key={st.key} onClick={() => setSeedTab(st.key)} style={{
              padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.72rem', fontWeight: isActive ? 700 : 500,
              color: isActive ? st.color : '#94a3b8',
              borderBottom: isActive ? `2px solid ${st.color}` : '2px solid transparent',
              marginBottom: '-1px', transition: 'all .15s', whiteSpace: 'nowrap',
            }}>
              {st.key === 'OWN_SEED' ? 'Own Seed' : st.key === 'HYBRID' ? 'Hybrid' : 'Inbred'}
            </button>
          );
        })}
      </div>

      {/* SCROLLABLE BODY */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.15rem 1.25rem 0.5rem' }} className='gis-panel-scroll'>
        {activeTab === 'monitoring' ? (
          <>
            {brgyPlots.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                <MapPin size={26} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No monitoring data yet.</p>
              </div>
            )}

            {brgyPlots.length > 0 && (
              <SeedTypeBreakdownCard
                key={activeSeedKey}
                seedKey={activeSeedKey}
                phaseCounts={seedBreakdown[activeSeedKey]?.phases || {}}
                totalFarmers={seedBreakdown[activeSeedKey]?.total || 0}
                totalApprovedFarmers={totalApprovedInBrgy}
                animate={animate}
              />
            )}
          </>
        ) : brgyHarvest.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
            <TrendingUp size={26} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.82rem' }}>No harvest data for this barangay yet.</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem' }}>Data appears once BRGY encodes harvest records.</p>
          </div>
        ) : (
          <UtilSeedTypeCard
            key={activeSeedKey}
            seedKey={activeSeedKey}
            tierCounts={brgySeedTierCounts[activeSeedKey]?.tierCounts || {}}
            total={brgySeedTierCounts[activeSeedKey]?.total || 0}
            animate={animate}
            encodedFarmers={encodedCount}
            totalApprovedFarmers={totalApprovedInBrgy}
          />
        )}
      </div>
    </div>
  );
};

// ─── INLINE TOOLBAR LEGEND ────────────────────────────────────
const ToolbarLegend = ({ activeTab }) => {
  const items = activeTab === 'utilization'
    ? UTIL_TIERS.map(t => ({ color: t.color, label: t.label }))
    : PHASES.map(p => ({ color: p.color, label: p.label }));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0 0.875rem', flexShrink: 0 }}>
      {items.map((item, idx) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0 0.5rem', borderRight: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
          <span style={{ width: 9, height: 9, borderRadius: '2px', backgroundColor: item.color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.68rem', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const useActiveSeedPoll = () => {
  const [activePoll, setActivePoll] = useState(null);
  const [polls, setPolls] = useState([]);
  useEffect(() => {
    let mounted = true;
    const fetchPoll = async () => {
      try {
        const [activeRes, allRes] = await Promise.allSettled([getGisActivePoll(), getGisAllPolls()]);
        if (!mounted) return;
        if (activeRes.status === 'fulfilled' && activeRes.value?.data) setActivePoll(activeRes.value.data);
        if (allRes.status === 'fulfilled') {
          const list = Array.isArray(allRes.value?.data) ? allRes.value.data : [];
          setPolls(list);
        }
      } catch { /* silent */ }
    };
    fetchPoll();
    const interval = window.setInterval(fetchPoll, 60000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, []);
  return { activePoll, polls };
};

// ─── MAIN COMPONENT ───────────────────────────────────────────
const GisMap = () => {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const polygonRef = useRef(null);
  const outlineRef = useRef(null);
  const panelRef   = useRef(null);
  const [L, setL]  = useState(null);

  const [plots,          setPlots]          = useState([]);
  const [summary,        setSummary]        = useState(null);
  const [barangays,      setBarangays]      = useState([]);
  const [approvedCounts, setApprovedCounts] = useState({});
  const [harvestRecords, setHarvestRecords] = useState([]);
  const [loading,        setLoading]        = useState(true);

  const [activeBarangay,  setActiveBarangay]  = useState(null);
  const [panelAnimate,    setPanelAnimate]    = useState(false);
  const [isMobile,        setIsMobile]        = useState(false);
  const [mobileSheet,     setMobileSheet]     = useState(false);
  const [lastClickedBrgy, setLastClickedBrgy] = useState(null);

  const [filterBrgy, setFilterBrgy] = useState('');
  const [activeTab,  setActiveTab]  = useState('monitoring');
  const [monitoringTab, setMonitoringTab] = useState('HYBRID');
  const [utilizationTab, setUtilizationTab] = useState('HYBRID');

  const [toast,    setToast]    = useState(null);
  const toastRef                 = useRef(null);

  const { activePoll, polls } = useActiveSeedPoll();
  const [selectedPollId, setSelectedPollId] = useState(null);
  const selectedPoll = useMemo(
    () => polls.find(p => p.poll_id === selectedPollId) || activePoll || polls[0] || null,
    [polls, selectedPollId, activePoll]
  );
  const prevPollKeyRef = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, type });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Compute per-brgy utilization from harvest records using our formula
  const brgyUtilData = useMemo(() => buildBrgyUtilFromHarvest(harvestRecords), [harvestRecords]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { loadLeaflet().then(setL); }, []);

  const loadAll = useCallback(async () => {
    const pollId = selectedPoll?.poll_id || activePoll?.poll_id;
    setLoading(true);
    try {
      const [plotsRes, sumRes, brgyRes, harvestRes] = await Promise.allSettled([
        getGisPlots({ poll_id: pollId }),
        getMapSummary({ poll_id: pollId }),
        getGisBarangays(),
        getHarvestRecords({ poll_id: pollId }),
      ]);
      if (plotsRes.status === 'fulfilled') {
        const d = plotsRes.value.data;
        if (Array.isArray(d)) { setPlots(d); setApprovedCounts({}); }
        else if (d && typeof d === 'object') { setPlots(d.plots || []); setApprovedCounts(d.approved_counts || {}); }
      }
      if (sumRes.status === 'fulfilled')  setSummary(sumRes.value.data);
      if (brgyRes.status === 'fulfilled') setBarangays(brgyRes.value.data || []);
      if (harvestRes.status === 'fulfilled') {
        const d = harvestRes.value.data;
        setHarvestRecords(Array.isArray(d) ? d : (d?.results || []));
      }
      const allFailed = [plotsRes, sumRes, brgyRes].every(r => r.status === 'rejected');
      if (allFailed) showToast('Failed to load GIS data.', 'error');
    } catch {
      showToast('Failed to load map data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedPoll, activePoll]);

  useEffect(() => {
    if (!activePoll?.poll_id && !selectedPollId) return;
    if (!selectedPollId && activePoll?.poll_id) setSelectedPollId(activePoll.poll_id);
  }, [activePoll, selectedPollId]);

  useEffect(() => {
    if (!selectedPoll?.poll_key) return;
    if (prevPollKeyRef.current && prevPollKeyRef.current !== selectedPoll.poll_key) {
      setPlots([]); setSummary(null); setApprovedCounts({});
      setHarvestRecords([]); setActiveBarangay(null);
      setLastClickedBrgy(null); setMobileSheet(false);
      if (panelRef.current) panelRef.current.scrollTop = 0;
      if (leafletMap.current && L) {
        const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
        if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [20, 20], animate: true });
      }
      setTimeout(() => loadAll(), 100);
    }
    prevPollKeyRef.current = selectedPoll.poll_key;
  }, [selectedPoll?.poll_key, L, loadAll]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(async () => {
      const pollId = selectedPoll?.poll_id || activePoll?.poll_id;
      const [plotsRes, sumRes, brgyRes, harvestRes] = await Promise.allSettled([
        getGisPlots({ poll_id: pollId }),
        getMapSummary({ poll_id: pollId }),
        getGisBarangays(),
        getHarvestRecords({ poll_id: pollId }),
      ]);
      if (plotsRes.status === 'fulfilled') {
        const d = plotsRes.value.data;
        if (Array.isArray(d)) setPlots(d);
        else if (d && typeof d === 'object') { setPlots(d.plots || []); setApprovedCounts(d.approved_counts || {}); }
      }
      if (sumRes.status === 'fulfilled')  setSummary(sumRes.value.data);
      if (brgyRes.status === 'fulfilled') setBarangays(brgyRes.value.data || []);
      if (harvestRes.status === 'fulfilled') {
        const d = harvestRes.value.data;
        setHarvestRecords(Array.isArray(d) ? d : (d?.results || []));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadAll, selectedPoll, activePoll]);

  // ── INIT MAP ──
  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, { center: [14.1167, 121.5833], zoom: 13, minZoom: 12, zoomControl: false, attributionControl: true });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri', maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);
    const allLayer = L.geoJSON(BRGY_FEATURES);
    const bounds   = allLayer.getBounds();
    if (bounds.isValid()) { map.fitBounds(bounds, { padding: [20, 20], animate: false }); map.setMinZoom(map.getZoom()); }
    leafletMap.current = map;
    setL(L);
  }, [L]);

  // ── DRAW POLYGONS ──
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;
    if (polygonRef.current) map.removeLayer(polygonRef.current);
    if (outlineRef.current)  map.removeLayer(outlineRef.current);

    // Build dominant phase per brgy (for monitoring tab)
    const brgyAllPhaseCounts = {};
    plots.forEach(p => {
      if (!p.barangay) return;
      const k = normalizePhase(p.land_type);
      if (!brgyAllPhaseCounts[p.barangay]) brgyAllPhaseCounts[p.barangay] = {};
      brgyAllPhaseCounts[p.barangay][k] = (brgyAllPhaseCounts[p.barangay][k] || 0) + 1;
    });

    const getDominantPhaseColor = (name) => {
      const counts = brgyAllPhaseCounts[name];
      if (!counts) return NO_DATA_COLOR;
      const sorted = Object.entries(counts).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return PHASE_ORDER.indexOf(b[0]) - PHASE_ORDER.indexOf(a[0]);
      });
      return phaseColor(sorted[0]?.[0]) || NO_DATA_COLOR;
    };

    // For utilization: color comes from our client-computed brgyUtilData
    const getPolygonColor = (name) => {
      if (activeTab === 'utilization') {
        const util = brgyUtilData[name];
        return util?.avg_utilization_pct != null ? getUtilColor(util.avg_utilization_pct) : NO_DATA_COLOR;
      }
      return getDominantPhaseColor(name);
    };

    const getTooltipContent = (name) => {
      if (activeTab === 'utilization') {
        const util = brgyUtilData[name];
        if (!util || util.avg_utilization_pct == null) {
          return `<div style="font-size:0.82rem;font-weight:800;color:#0f172a;">${name}</div><div style="font-size:0.72rem;color:#94a3b8;margin-top:0.2rem;">No harvest data yet</div>`;
        }
        const tier  = getUtilTier(util.avg_utilization_pct);
        const color = tier?.color || '#64748b';
        return `
          <div style="font-size:0.82rem;font-weight:800;color:#0f172a;margin-bottom:0.25rem;">${name}</div>
          <div style="display:flex;align-items:center;gap:0.35rem;margin-bottom:0.2rem;">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
            <span style="font-size:0.72rem;font-weight:700;color:${color};">${fmtNum(util.avg_utilization_pct, 1)}% · ${tier?.label}</span>
          </div>
          <div style="font-size:0.68rem;color:#64748b;">${fmtNum(util.total_production_mt)} MT · ${fmtNum(util.farmer_count)} farmer${util.farmer_count !== 1 ? 's' : ''}</div>
        `;
      } else {
        const counts = brgyAllPhaseCounts[name];
        if (!counts) return `<div style="font-size:0.82rem;font-weight:800;color:#0f172a;">${name}</div><div style="font-size:0.72rem;color:#94a3b8;">No data yet</div>`;
        const sorted = Object.entries(counts).sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return PHASE_ORDER.indexOf(b[0]) - PHASE_ORDER.indexOf(a[0]);
        });
        const dominant = sorted[0]?.[0];
        const total    = Object.values(counts).reduce((a, b) => a + b, 0);
        const pct      = Math.round((sorted[0]?.[1] / total) * 100);
        const phCfg    = PHASE_MAP[dominant];
        return `
          <div style="font-size:0.82rem;font-weight:800;color:#0f172a;margin-bottom:0.2rem;">${name}</div>
          <div style="display:flex;align-items:center;gap:0.35rem;">
            <span style="width:8px;height:8px;border-radius:50%;background:${phCfg?.color || '#9ca3af'};display:inline-block;flex-shrink:0;"></span>
            <span style="font-size:0.72rem;font-weight:700;color:${phCfg?.color || '#9ca3af'};">${dominant}</span>
            <span style="font-size:0.72rem;color:#64748b;font-weight:600;">${pct}%</span>
          </div>
        `;
      }
    };

    polygonRef.current = L.geoJSON(BRGY_FEATURES, {
      style: feature => {
        const name    = feature.properties.ADM4_EN;
        const isActive= name === activeBarangay;
        const color   = getPolygonColor(name);
        return { color: isActive ? 'white' : 'rgba(255,255,255,0.55)', fillColor: color, fillOpacity: isActive ? 0.88 : 0.68, weight: isActive ? 2.5 : 1.2, opacity: 1 };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.ADM4_EN;
        layer.bindTooltip(`<div style="font-family:inherit;padding:0.15rem 0.1rem;">${getTooltipContent(name)}</div>`, { permanent: false, direction: 'top', className: 'gis-tooltip', offset: [0, -6] });
        layer.on('click', () => {
          if (lastClickedBrgy === name) {
            setActiveBarangay(null); setLastClickedBrgy(null);
            const fb = L.geoJSON(BRGY_FEATURES).getBounds();
            if (fb.isValid()) map.fitBounds(fb, { padding: [20, 20], animate: true });
          } else {
            setActiveBarangay(name); setLastClickedBrgy(name);
            setPanelAnimate(true); if (isMobile) setMobileSheet(true);
            setTimeout(() => setPanelAnimate(false), 400);
            if (panelRef.current) panelRef.current.scrollTop = 0;
          }
        });
        layer.on('mouseover', () => { layer.setStyle({ fillOpacity: name === activeBarangay ? 0.92 : 0.82, weight: name === activeBarangay ? 2.5 : 2 }); });
        layer.on('mouseout', () => { polygonRef.current?.resetStyle(layer); });
      },
    }).addTo(map);

    outlineRef.current = L.geoJSON(BRGY_FEATURES, {
      style: { color: 'white', fillOpacity: 0, weight: 2.5, opacity: 0.9, interactive: false },
    }).addTo(map);

    BRGY_FEATURES.forEach(feature => {
      const name   = feature.properties.ADM4_EN;
      const center = L.geoJSON(feature).getBounds().getCenter();
      L.marker(center, {
        icon: L.divIcon({ html: `<div class="brgy-label" style="font-size:0.95rem;font-weight:800;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.95),0 0 10px rgba(0,0,0,0.8);white-space:nowrap;pointer-events:none;text-align:center;">${name}</div>`, className: '', iconAnchor: [40, 8] }),
        interactive: false,
      }).addTo(map);
    });

    // Show utilization % labels on polygons when in utilization tab
    if (activeTab === 'utilization') {
      BRGY_FEATURES.forEach(feature => {
        const name = feature.properties.ADM4_EN;
        const util = brgyUtilData[name];
        if (!util?.avg_utilization_pct) return;
        const center = L.geoJSON(feature).getBounds().getCenter();
        L.marker([center.lat - 0.005, center.lng], {
          icon: L.divIcon({ html: `<div style="font-size:0.78rem;font-weight:800;color:white;text-shadow:0 1px 6px rgba(0,0,0,0.9);white-space:nowrap;pointer-events:none;text-align:center;">${Math.round(util.avg_utilization_pct)}%</div>`, className: '', iconAnchor: [20, 4] }),
          interactive: false,
        }).addTo(map);
      });
    }

    const updateLabelSizes = () => {
      const zoom = map.getZoom();
      const size = zoom <= 11 ? '1.1rem' : zoom === 12 ? '1rem' : zoom === 13 ? '0.95rem' : zoom === 14 ? '0.8rem' : '0.7rem';
      document.querySelectorAll('.brgy-label').forEach(el => { el.style.fontSize = size; });
    };
    map.on('zoomend', updateLabelSizes);
    updateLabelSizes();

  }, [L, plots, activeBarangay, isMobile, activeTab, brgyUtilData, lastClickedBrgy]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L || !activeBarangay) return;
    const feature = BRGY_FEATURES.find(f => f.properties.ADM4_EN === activeBarangay);
    if (!feature) return;
    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true, duration: 0.6 });
  }, [L, activeBarangay]);

  const filteredPlots = useMemo(() => plots.filter(p => {
    if (filterBrgy && normalizeBrgy(p.barangay) !== normalizeBrgy(filterBrgy)) return false;
    return true;
  }), [plots, filterBrgy]);

  const handleBrgyClick = (name) => {
    setActiveBarangay(name); setLastClickedBrgy(name);
    setPanelAnimate(true);
    setTimeout(() => setPanelAnimate(false), 400);
    if (panelRef.current) panelRef.current.scrollTop = 0;
    const map = leafletMap.current;
    if (map && L) {
      const feature = BRGY_FEATURES.find(f => f.properties.ADM4_EN === name);
      if (feature) {
        const bounds = L.geoJSON(feature).getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
      }
    }
  };

  const handleBack = () => {
    setPanelAnimate(true); setActiveBarangay(null); setLastClickedBrgy(null); setMobileSheet(false);
    setTimeout(() => setPanelAnimate(false), 400);
    if (panelRef.current) panelRef.current.scrollTop = 0;
    if (leafletMap.current && L) {
      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
      if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [20, 20], animate: true });
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setActiveBarangay(null); setLastClickedBrgy(null); setMobileSheet(false);
    if (leafletMap.current && L) {
      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
      if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [20, 20], animate: true });
    }
  };

  const PanelBody = () => {
    if (!activeBarangay) {
      return activeTab === 'utilization'
        ? <UtilizationOverviewPanel harvestRecords={harvestRecords} summary={summary} animate={panelAnimate} utilizationTab={utilizationTab} setUtilizationTab={setUtilizationTab} />
        : <MonitoringOverviewPanel plots={filteredPlots} summary={summary} animate={panelAnimate} monitoringTab={monitoringTab} setMonitoringTab={setMonitoringTab} />;
    }
    return (
      <BarangayPanel
        barangayName={activeBarangay}
        plots={filteredPlots}
        approvedCounts={approvedCounts}
        harvestRecords={harvestRecords}
        activeTab={activeTab}
        onBack={handleBack}
        animate={panelAnimate}
      />
    );
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
      <style>{`
        @keyframes gis-pop { 0%{opacity:0;transform:translateX(-50%) scale(0.88)} 70%{transform:translateX(-50%) scale(1.03)} 100%{opacity:1;transform:translateX(-50%) scale(1)} }
        @keyframes gis-fadeSlide { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gis-spin { to{transform:rotate(360deg)} }
        @keyframes gis-sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        html, body { overflow: hidden; height: 100%; }
        .leaflet-tooltip { border-radius:0.75rem !important; border:none !important; box-shadow:0 4px 20px rgba(0,0,0,0.18) !important; }
        .gis-panel-scroll::-webkit-scrollbar { width:4px; }
        .gis-panel-scroll::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:99px; }
        .leaflet-container { font-family: inherit !important; height: 100% !important; }
        .gis-toolbar-row { display:flex; align-items:center; gap:0.5rem; flex-wrap:nowrap; min-width:0; overflow:hidden; }
        @media (max-width: 1100px) { .gis-season-label { display:none !important; } .gis-tab-text { display:none !important; } }
        @media (max-width: 960px) { .gis-panel-side { width:280px !important; } }
      `}</style>

      <Toast toast={toast} />

      {!isMobile && (
        <div style={{ padding: '0.5rem 1rem 0', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16a34a' }}>GIS map overview · Lucban crop monitoring & utilization</p>
        </div>
      )}

      {!isMobile && (
        <div className='gis-map-wrap' style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', padding: '0.4rem 0.75rem 1.5rem', gap: '0.65rem', position: 'relative' }}>
          {/* MAP */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(15,23,42,0.08)', overflow: 'hidden', minHeight: 0, marginRight: 'clamp(300px, 24vw, 350px)' }}>
            {/* Toolbar */}
            <div style={{ padding: '0.55rem 0.875rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.35rem', alignItems: 'center', overflowX: 'auto', flexShrink: 0 }} className='gis-toolbar-row'>
              <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.625rem', padding: '0.175rem', gap: '0.175rem', flexShrink: 0 }}>
                <button onClick={() => handleTabChange('monitoring')} style={{ padding: '0.32rem 0.7rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'monitoring' ? 'white' : 'transparent', color: activeTab === 'monitoring' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'monitoring' ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: activeTab === 'monitoring' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  <Activity size={12} /> <span className='gis-tab-text'>Crop monitoring</span>
                </button>
                <button onClick={() => handleTabChange('utilization')} style={{ padding: '0.32rem 0.7rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'utilization' ? 'white' : 'transparent', color: activeTab === 'utilization' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'utilization' ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: activeTab === 'utilization' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  <TrendingUp size={12} /> <span className='gis-tab-text'>Crop utilization</span>
                </button>
              </div>
              <ToolbarLegend activeTab={activeTab} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontSize: '0.72rem', fontWeight: 600 }}>
                  <span className='gis-season-label' style={{ color: '#16a34a' }}>Season</span>
                  <select
                    value={selectedPoll?.season || ''}
                    onChange={e => {
                      const matched = polls.find(p => p.season === e.target.value);
                      if (matched) setSelectedPollId(matched.poll_id);
                    }}
                    style={{ padding: '0.3rem 0.55rem', border: '1px solid #dbe3ec', borderRadius: '0.5rem', backgroundColor: 'white', color: '#111827', fontSize: '0.73rem', fontWeight: 600, minWidth: 90, maxWidth: 115 }}
                  >
                    {[...new Set(polls.map(p => p.season))].map(s => (
                      <option key={s} value={s}>{s === 'WET' ? 'Wet Season' : 'Dry Season'}</option>
                    ))}
                    {polls.length === 0 && <option value=''>Season</option>}
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontSize: '0.72rem', fontWeight: 600 }}>
                  <span className='gis-season-label' style={{ color: '#16a34a' }}>Year</span>
                  <select
                    value={selectedPoll?.year || ''}
                    onChange={e => {
                      const matched = polls.find(p => p.season === selectedPoll?.season && p.year === Number(e.target.value));
                      if (matched) setSelectedPollId(matched.poll_id);
                    }}
                    style={{ padding: '0.3rem 0.55rem', border: '1px solid #dbe3ec', borderRadius: '0.5rem', backgroundColor: 'white', color: '#111827', fontSize: '0.73rem', fontWeight: 600, minWidth: 70, maxWidth: 85 }}
                  >
                    {[...new Set(polls.filter(p => p.season === selectedPoll?.season).map(p => p.year))].sort((a, b) => b - a).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                    {polls.length === 0 && <option value=''>Year</option>}
                  </select>
                </label>
                <select value={filterBrgy} onChange={e => {
                  setFilterBrgy(e.target.value);
                  if (e.target.value) handleBrgyClick(e.target.value);
                  else {
                    setActiveBarangay(null); setLastClickedBrgy(null);
                    if (leafletMap.current && L) {
                      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
                      if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [20, 20], animate: true });
                    }
                  }
                }} style={{ padding: '0.3rem 0.55rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.73rem', outline: 'none', backgroundColor: 'white', color: filterBrgy ? '#0f172a' : '#64748b', maxWidth: 144, fontWeight: filterBrgy ? 600 : 400 }}>
                  <option value=''>All barangays</option>
                  {(barangays.length > 0 ? barangays : ALLOWED_BRGYS).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <button onClick={loadAll} style={{ padding: '0.32rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <RefreshCw size={13} color='#64748b' style={{ animation: loading ? 'gis-spin 0.8s linear infinite' : 'none' }} />
                </button>
              </div>
            </div>

            {/* Map container */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              {loading && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' }}>
                  <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'gis-spin 0.8s linear infinite', margin: '0 auto 0.75rem' }} />
                    Loading map...
                  </div>
                </div>
              )}
              <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 0 }} />
            </div>

            <div style={{ padding: '0.6rem 1.1rem', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={12} color='#94a3b8' />
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                {activeTab === 'utilization'
                  ? 'Utilization data from BRGY harvest records. Targets: Hybrid 5,000 kg/ha · Certified 4,000 kg/ha · Farmer saved 3,000 kg/ha'
                  : 'Crop phase data from AT monitoring visits. Updates in real-time.'}
              </span>
            </div>
          </div>

          {/* PANEL SIDE */}
          <div className='gis-panel-side' style={{ position: 'absolute', top: 0, right: 0, bottom: '1.5rem', width: 'clamp(280px, 22vw, 330px)', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(15,23,42,0.08)', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {activeTab === 'utilization' ? <TrendingUp size={15} color='#1a4d1a' /> : <Activity size={15} color='#1a4d1a' />}
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                {activeBarangay ? `Brgy. ${activeBarangay}` : activeTab === 'utilization' ? 'Utilization overview' : 'Monitoring overview'}
              </span>
              {activeBarangay && (
                <button onClick={handleBack} style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <X size={13} /> Clear
                </button>
              )}
            </div>
            <div ref={panelRef} className='gis-panel-scroll' style={{ flex: 1, overflowY: activeBarangay || activeTab === 'utilization' ? 'auto' : 'hidden', display: 'flex', flexDirection: 'column', paddingTop: activeBarangay ? 0 : activeTab === 'monitoring' ? '1.25rem' : 0, minHeight: 0 }}>
              <PanelBody />
            </div>
            <PanelFooter activeTab={activeTab} />
          </div>
        </div>
      )}

      {/* MOBILE */}
      {isMobile && (
        <div className='gis-mobile-map' style={{ flex: 1, minHeight: 0, height: '100dvh', maxHeight: '100dvh', position: 'relative', overflow: 'hidden', borderRadius: '1rem 1rem 0 0', paddingBottom: '0.25rem' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          {!mobileSheet && (
            <div style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500, display: 'flex', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '999px', padding: '0.2rem', gap: '0.2rem', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
              <button onClick={() => handleTabChange('monitoring')} style={{ padding: '0.4rem 0.875rem', borderRadius: '999px', border: 'none', backgroundColor: activeTab === 'monitoring' ? '#1a4d1a' : 'transparent', color: activeTab === 'monitoring' ? 'white' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' }}>
                <Activity size={13} /> Monitoring
              </button>
              <button onClick={() => handleTabChange('utilization')} style={{ padding: '0.4rem 0.875rem', borderRadius: '999px', border: 'none', backgroundColor: activeTab === 'utilization' ? '#1a4d1a' : 'transparent', color: activeTab === 'utilization' ? 'white' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' }}>
                <TrendingUp size={13} /> Utilization
              </button>
            </div>
          )}
          {mobileSheet && (
            <>
              <div onClick={() => setMobileSheet(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 700 }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 800, backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0', maxHeight: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.14)', animation: 'gis-sheetUp 0.35s cubic-bezier(0.34,1.1,0.64,1)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div style={{ width: 44, height: 4, backgroundColor: '#e2e8f0', borderRadius: '999px', margin: '0.875rem auto', flexShrink: 0 }} />
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: activeBarangay ? 0 : '0.5rem' }} className='gis-panel-scroll'>
                  <PanelBody />
                </div>
                <PanelFooter activeTab={activeTab} />
              </div>
            </>
          )}
          {!mobileSheet && (
            <button onClick={() => setMobileSheet(true)} style={{ position: 'absolute', bottom: '1.5rem', right: '1rem', zIndex: 600, backgroundColor: '#1a4d1a', color: 'white', border: 'none', borderRadius: '999px', padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {activeTab === 'utilization' ? <TrendingUp size={16} /> : <Activity size={16} />}
              Overview
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GisMap;