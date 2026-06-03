// src/pages/admin/GisMap.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MapPin, X, RefreshCw,
  CheckCircle, AlertCircle, ChevronLeft,
  Layers, Activity, TrendingUp, Clock,
  Database, Users, Target,
} from 'lucide-react';
import {
  getGisPlots,
  getMapSummary,
  getGisBarangays,
  getProductionGISSummary,
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
const PHASE_MAP = Object.fromEntries(PHASES.map(p => [p.key, p]));
const phaseColor = (key) => PHASE_MAP[key]?.color || '#64748B';

// ─── SEED TYPE CONFIG ─────────────────────────────────────────
const SEED_TYPES = [
  { key: 'OWN_SEED', label: 'Own Seed',    color: '#b45309', bg: '#fef3c7', border: '#fde68a', hasDistribution: false },
  { key: 'INBRED',   label: 'Inbred Seed', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', hasDistribution: true  },
  { key: 'HYBRID',   label: 'Hybrid Seed', color: '#1a4d1a', bg: '#f0fdf4', border: '#bbf7d0', hasDistribution: true  },
];
const SEED_TYPE_MAP = Object.fromEntries(SEED_TYPES.map(s => [s.key, s]));

// Phases available per seed type
const getPhasesForSeedType = (seedKey) => {
  const hasDistribution = SEED_TYPE_MAP[seedKey]?.hasDistribution ?? true;
  return PHASES.filter(p => hasDistribution || p.key !== 'Seed Distribution');
};

// ─── UTILIZATION TIER CONSTANTS ───────────────────────────────
const UTIL_TIERS = [
  { key: 'Master Farmer',  min: 200,  color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Master Farmer'  },
  { key: 'Exceptional',    min: 150,  color: '#16a34a', bg: '#dcfce7', border: '#86efac', label: 'Exceptional'    },
  { key: 'Excellent',      min: 100,  color: '#4ade80', bg: '#f0fdf4', border: '#bbf7d0', label: 'Excellent'      },
  { key: 'Good',           min: 75,   color: '#f59e0b', bg: '#fefce8', border: '#fde68a', label: 'Good'           },
  { key: 'Below target',   min: 50,   color: '#f97316', bg: '#fff7ed', border: '#fed7aa', label: 'Below target'   },
  { key: 'Needs attention',min: 0,    color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Needs attention'},
];
const NO_DATA_COLOR = '#1E293B';

const getUtilTier = (pct) => {
  if (pct === null || pct === undefined) return null;
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

// ─── COMPUTE SEED TYPE BREAKDOWN FROM PLOTS ───────────────────
// Returns: { OWN_SEED: { phases: { 'Crop Establishment': 2, ... }, total: 5 }, INBRED: {...}, HYBRID: {...} }
const buildSeedTypeBreakdown = (plots) => {
  const result = {};
  // Use a set to deduplicate: one farmer+seedType = one active state (latest record)
  const seen = new Set();

  plots.forEach(plot => {
    const seedKey = plot.seed_source || 'OWN_SEED';
    const phase   = normalizePhase(plot.land_type);
    const dedupeKey = `${plot.farmer}::${seedKey}`;

    // Since backend already returns latest record per farmer+seed_source combo,
    // we just deduplicate on the frontend too as safety net
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    if (!result[seedKey]) result[seedKey] = { phases: {}, total: 0 };
    result[seedKey].phases[phase] = (result[seedKey].phases[phase] || 0) + 1;
    result[seedKey].total += 1;
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

// ─── SEED TYPE BREAKDOWN CARD ─────────────────────────────────
// Used in both Overview and Barangay panels
const SeedTypeBreakdownCard = ({ seedKey, phaseCounts, totalFarmers }) => {
  const cfg = SEED_TYPE_MAP[seedKey] || { label: seedKey, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', hasDistribution: true };
  const allowedPhases = getPhasesForSeedType(seedKey);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(false);
    const t = window.setTimeout(() => setAnimated(true), 80);
    return () => window.clearTimeout(t);
  }, [phaseCounts]);

  // Build sorted phases with percentages
  const phaseList = allowedPhases
    .map(ph => ({
      ...ph,
      count:   phaseCounts[ph.key] || 0,
      percent: totalFarmers > 0 ? Math.round(((phaseCounts[ph.key] || 0) / totalFarmers) * 100) : 0,
    }))
    .filter(ph => ph.count > 0)
    .sort((a, b) => b.count - a.count);

  const dominant = phaseList[0] || null;
  const others   = phaseList.slice(1);

  if (phaseList.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem',
        border: `1px solid ${cfg.border}`,
        padding: '1rem 1.1rem', marginBottom: '0.75rem',
      }}>
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
    <div style={{
      backgroundColor: 'white', borderRadius: '1rem',
      border: `1px solid ${cfg.border}`,
      padding: '1rem 1.1rem', marginBottom: '0.75rem',
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{cfg.label}</span>
        </div>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Breakdown</span>
      </div>

      {/* DOMINANT — large font */}
      {dominant && (
        <div style={{
          backgroundColor: PHASE_MAP[dominant.key]?.bg || '#f9fafb',
          border: `1px solid ${PHASE_MAP[dominant.key]?.border || '#e5e7eb'}`,
          borderRadius: '0.75rem', padding: '0.75rem 0.875rem', marginBottom: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dominant.color, display: 'inline-block' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dominant</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: dominant.color }}>{dominant.label}</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: dominant.color }}>{dominant.percent}%</span>
          </div>
          <div style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: animated ? `${Math.max(2, dominant.percent)}%` : '0%',
              backgroundColor: dominant.color, borderRadius: '999px',
              transition: 'width 0.6s cubic-bezier(0.34,1,0.64,1)',
            }} />
          </div>
        </div>
      )}

      {/* OTHER PHASES — smaller */}
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
            <div style={{
              height: '100%',
              width: animated ? `${Math.max(2, ph.percent)}%` : '0%',
              backgroundColor: ph.color, borderRadius: '999px',
              transition: 'width 0.55s ease',
            }} />
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
    <div style={{ padding: '1rem 1.25rem', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', flexShrink: 0 }}>
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

// ─── OVERVIEW PANEL — MONITORING TAB ─────────────────────────
const MonitoringOverviewPanel = ({ plots, summary, animate }) => {
  const currentFarmers = summary?.current_farmers ?? new Set(plots.map(p => p.farmer)).size;
  const totalApproved  = summary?.total_approved_farmers ?? currentFarmers;
  const currentBrgys   = summary?.current_active_barangays ?? new Set(plots.map(p => p.barangay).filter(Boolean)).size;
  const totalBrgys     = summary?.total_active_barangays ?? currentBrgys;

  // Build seed type breakdown from all plots (all barangays aggregated)
  const seedBreakdown = useMemo(() => buildSeedTypeBreakdown(plots), [plots]);

  return (
    <>
      {/* ── FIXED HEADER ── */}
      <div style={{ padding: '0 1.25rem 1rem', flexShrink: 0 }}>
        <div style={{
          background: 'linear-gradient(135deg, #1a4d1a 0%, #166534 100%)',
          borderRadius: '1.25rem', padding: '1.25rem', color: 'white',
          animation: animate ? 'gis-fadeSlide 0.35s ease' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Activity size={15} color='rgba(255,255,255,0.8)' />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Lucban crop monitoring
            </span>
            <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.62rem', fontWeight: 700 }}>
              LIVE
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
                {currentFarmers}/{totalApproved}
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Total farmers</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
                {currentBrgys}/{totalBrgys}
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Active barangays</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE SEED TYPE BREAKDOWN ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.25rem 0.5rem' }} className='gis-panel-scroll'>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Seed type breakdown
        </p>
        {SEED_TYPES.map(st => (
          <SeedTypeBreakdownCard
            key={st.key}
            seedKey={st.key}
            phaseCounts={seedBreakdown[st.key]?.phases || {}}
            totalFarmers={seedBreakdown[st.key]?.total || 0}
            animate={animate}
          />
        ))}
        {plots.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
            <MapPin size={28} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.82rem' }}>No monitoring data yet.</p>
          </div>
        )}
      </div>
    </>
  );
};

// ─── OVERVIEW PANEL — UTILIZATION TAB ────────────────────────
const UtilizationOverviewPanel = ({ utilizationData, animate }) => {
  const brgyList  = Object.values(utilizationData);
  const haData    = brgyList.length > 0;

  const totalFarmers = brgyList.reduce((s, b) => s + b.farmer_count, 0);
  const totalMT      = brgyList.reduce((s, b) => s + b.total_production_mt, 0);
  const totalArea    = brgyList.reduce((s, b) => s + b.total_area_ha, 0);
  const avgYield     = totalArea > 0 ? totalMT / totalArea : 0;

  const utilVals    = brgyList.map(b => b.avg_utilization_pct).filter(v => v !== null);
  const overallUtil = utilVals.length > 0 ? utilVals.reduce((a, b) => a + b, 0) / utilVals.length : null;
  const overallTier = getUtilTier(overallUtil);

  const tierCounts = {};
  brgyList.forEach(b => {
    const tier = getUtilTier(b.avg_utilization_pct);
    const key  = tier ? tier.key : 'No data';
    tierCounts[key] = (tierCounts[key] || 0) + 1;
  });
  const totalBrgys = brgyList.length || 1;

  const alerts = brgyList
    .filter(b => b.avg_utilization_pct !== null && b.avg_utilization_pct < 100)
    .sort((a, b) => a.avg_utilization_pct - b.avg_utilization_pct);

  return (
    <div style={{ padding: '0 1.25rem 1.5rem', animation: animate ? 'gis-fadeSlide 0.35s ease' : 'none' }}>
      <div style={{ background: 'linear-gradient(135deg, #1a4d1a 0%, #166534 100%)', borderRadius: '1.25rem', padding: '1.25rem', marginBottom: '1rem', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <TrendingUp size={15} color='rgba(255,255,255,0.8)' />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Harvest utilization
          </span>
          {overallTier && (
            <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.62rem', fontWeight: 700 }}>
              {overallTier.label}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{haData ? totalFarmers : '—'}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Farmers</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{haData ? `${fmtNum(totalMT)} MT` : '—'}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Production</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: overallTier?.color || 'white', lineHeight: 1 }}>{overallUtil !== null ? `${fmtNum(overallUtil, 1)}%` : '—'}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Avg util</p>
          </div>
        </div>
      </div>

      {!haData ? (
        <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2.5rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <TrendingUp size={28} color='#d1d5db' style={{ display: 'block', margin: '0 auto 0.75rem' }} />
          <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.375rem', fontSize: '0.875rem' }}>No harvest data yet</p>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Utilization data will appear once BRGY presidents encode harvest records.</p>
        </div>
      ) : (
        <>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.1rem 1.15rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Barangay performance tiers
            </p>
            {UTIL_TIERS.map(tier => {
              const count = tierCounts[tier.key] || 0;
              if (count === 0) return null;
              const pct = Math.round((count / totalBrgys) * 100);
              return (
                <div key={tier.key} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: tier.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>{tier.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{count} brgy{count !== 1 ? 's' : ''}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, backgroundColor: tier.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1rem 1.15rem', border: '1px solid #e2e8f0', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg yield</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{fmtNum(avgYield)} t/ha</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total area</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{fmtNum(totalArea)} ha</p>
            </div>
          </div>

          {alerts.length > 0 && (
            <div style={{ backgroundColor: '#fef2f2', borderRadius: '1.25rem', padding: '1rem 1.15rem', border: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <AlertCircle size={15} color='#b91c1c' />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Below target ({alerts.length} brgy{alerts.length !== 1 ? 's' : ''})
                </span>
              </div>
              {alerts.map(b => {
                const tier = getUtilTier(b.avg_utilization_pct);
                return (
                  <div key={b.barangay} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #fee2e2' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{b.barangay}</span>
                    <span style={{ backgroundColor: tier?.bg, color: tier?.color, border: `1px solid ${tier?.border}`, borderRadius: '999px', padding: '0.1rem 0.55rem', fontSize: '0.65rem', fontWeight: 700 }}>
                      {fmtNum(b.avg_utilization_pct, 1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ backgroundColor: '#f8fafc', borderRadius: '1.25rem', padding: '1rem 1.15rem', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Utilization tier reference
            </p>
            {UTIL_TIERS.map(t => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: t.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', minWidth: 100 }}>{t.label}</span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  {t.min >= 200 ? '≥ 200%' : t.min >= 150 ? '150–199%' : t.min >= 100 ? '100–149%' : t.min >= 75 ? '75–99%' : t.min >= 50 ? '50–74%' : '< 50%'}
                </span>
              </div>
            ))}
            <p style={{ margin: '0.625rem 0 0', fontSize: '0.65rem', color: '#94a3b8', lineHeight: 1.5 }}>
              DA standards: Hybrid 4,000 kg/ha · Certified 1,500 kg/ha · Farmer saved 2,000 kg/ha
            </p>
          </div>
        </>
      )}
    </div>
  );
};

// ─── BARANGAY PANEL ───────────────────────────────────────────
const BarangayPanel = ({ barangayName, plots, approvedCounts, utilizationData, activeTab, onBack, animate }) => {
  const brgyPlots = useMemo(() => plots.filter(p => p.barangay === barangayName), [plots, barangayName]);
  const utilBrgy  = utilizationData[barangayName] || null;

  const uniqueFarmerIds = useMemo(() => [...new Set(brgyPlots.map(p => p.farmer))], [brgyPlots]);
  const farmerCount     = uniqueFarmerIds.length;
  const totalHa         = useMemo(() => {
    const areaPerFarmer = {};
    brgyPlots.forEach(p => {
      const ha = parseFloat(p.area_ha) || 0;
      if (!areaPerFarmer[p.farmer] || ha > areaPerFarmer[p.farmer]) {
        areaPerFarmer[p.farmer] = ha;
      }
    });
    return Object.values(areaPerFarmer).reduce((sum, ha) => sum + ha, 0);
  }, [brgyPlots]);
  const totalApproved   = approvedCounts?.[barangayName] ?? brgyPlots[0]?.total_approved_in_brgy ?? 0;

  // Seed type breakdown for this barangay only
  const seedBreakdown = useMemo(() => buildSeedTypeBreakdown(brgyPlots), [brgyPlots]);

  // Overall dominant phase (all seed types combined) for the badge
  const allPhaseCounts = useMemo(() => {
    const combined = {};
    Object.values(seedBreakdown).forEach(sd => {
      Object.entries(sd.phases).forEach(([phase, count]) => {
        combined[phase] = (combined[phase] || 0) + count;
      });
    });
    return combined;
  }, [seedBreakdown]);

  const dominantPhase = useMemo(() => {
    const sorted = Object.entries(allPhaseCounts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
  }, [allPhaseCounts]);

  const utilTier = utilBrgy ? getUtilTier(utilBrgy.avg_utilization_pct) : null;

  const headerBadgeColor = activeTab === 'utilization'
    ? (utilTier?.color || '#94a3b8')
    : (dominantPhase ? phaseColor(dominantPhase) : '#94a3b8');
  const headerBadgeLabel = activeTab === 'utilization'
    ? (utilTier ? `${fmtNum(utilBrgy?.avg_utilization_pct, 1)}% · ${utilTier.label}` : 'No harvest data')
    : (dominantPhase ? `Dominant: ${dominantPhase}` : 'No phase data yet');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: animate ? 'gis-fadeSlide 0.35s ease' : 'none' }}>
      {/* ── FIXED HEADER ── */}
      <div style={{
        padding: '1.25rem',
        background: 'linear-gradient(135deg, #1a4d1a 0%, #166534 100%)',
        color: 'white', flexShrink: 0,
      }}>
        {/* Back + Dominant badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
          <button onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.5rem', color: 'white', padding: '0.35rem 0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
            <ChevronLeft size={14} /> Back
          </button>
          <span style={{ marginLeft: 'auto', backgroundColor: headerBadgeColor + '33', border: `1px solid ${headerBadgeColor}66`, borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
            {headerBadgeLabel}
          </span>
        </div>

        {/* Brgy name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin size={20} color='white' />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Brgy. {barangayName}</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Lucban, Quezon</p>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'monitoring' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '0.6rem' }}>
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
                { label: 'Farmers',    value: utilBrgy?.farmer_count ?? '—' },
                { label: 'Production', value: utilBrgy ? `${fmtNum(utilBrgy.total_production_mt)} MT` : '—' },
                { label: 'Avg yield',  value: utilBrgy ? `${fmtNum(utilBrgy.avg_yield_t_ha)} t/ha` : '—' },
              ].map(item => (
                <div key={item.label} style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{item.value}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{item.label}</p>
                </div>
              ))
          }
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.15rem 1.25rem 0.5rem' }} className='gis-panel-scroll'>
        {activeTab === 'monitoring' ? (
          <>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Seed type breakdown
            </p>
            {SEED_TYPES.map(st => (
              <SeedTypeBreakdownCard
                key={st.key}
                seedKey={st.key}
                phaseCounts={seedBreakdown[st.key]?.phases || {}}
                totalFarmers={seedBreakdown[st.key]?.total || 0}
                animate={animate}
              />
            ))}
            {brgyPlots.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                <MapPin size={26} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No monitoring data yet.</p>
              </div>
            )}
          </>
        ) : (
          /* UTILIZATION TAB body */
          !utilBrgy ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
              <TrendingUp size={26} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.82rem' }}>No harvest data for this barangay yet.</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem' }}>Data appears once BRGY encodes harvest records.</p>
            </div>
          ) : (
            <>
              <p style={{ margin: '0 0 0.875rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Harvest utilization
              </p>
              {utilTier && (
                <div style={{ backgroundColor: utilTier.bg, borderRadius: '1rem', padding: '1rem 1.15rem', border: `1px solid ${utilTier.border}`, marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Average utilization</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 800, color: utilTier.color, lineHeight: 1 }}>
                        {fmtNum(utilBrgy.avg_utilization_pct, 1)}%
                      </p>
                    </div>
                    <span style={{ backgroundColor: utilTier.color + '20', color: utilTier.color, border: `1px solid ${utilTier.border}`, borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.68rem', fontWeight: 700 }}>
                      {utilTier.label}
                    </span>
                  </div>
                  <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, utilBrgy.avg_utilization_pct / 2.5)}%`, backgroundColor: utilTier.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    <span>0%</span><span>DA standard (100%)</span><span>250%+</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Total production',  value: `${fmtNum(utilBrgy.total_production_mt)} MT` },
                  { label: 'Area harvested',     value: `${fmtNum(utilBrgy.total_area_ha)} ha` },
                  { label: 'Avg yield',          value: `${fmtNum(utilBrgy.avg_yield_t_ha)} t/ha` },
                  { label: 'Farmers harvested',  value: utilBrgy.farmer_count },
                ].map(m => (
                  <div key={m.label} style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{m.value}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{m.label}</p>
                  </div>
                ))}
              </div>
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '0.875rem', padding: '0.875rem 1rem', border: '1px solid #e2e8f0', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 0.25rem', fontWeight: 700, color: '#374151', fontSize: '0.72rem' }}>DA standard reference</p>
                <p style={{ margin: 0 }}>Hybrid: <strong style={{ color: '#1a4d1a' }}>4,000 kg/ha</strong></p>
                <p style={{ margin: 0 }}>Certified seeds: <strong style={{ color: '#2563eb' }}>1,500 kg/ha</strong></p>
                <p style={{ margin: 0 }}>Farmer saved: <strong style={{ color: '#b45309' }}>2,000 kg/ha</strong></p>
              </div>
            </>
          )
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
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0',
      borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
      padding: '0 0.875rem', flexShrink: 0,
    }}>
      {items.map((item, idx) => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '0 0.5rem',
          borderRight: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none',
        }}>
          <span style={{ width: 9, height: 9, borderRadius: '2px', backgroundColor: item.color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.68rem', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
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
        const [activeRes, allRes] = await Promise.allSettled([
          getGisActivePoll(),
          getGisAllPolls(),
        ]);
        if (!mounted) return;
        if (activeRes.status === 'fulfilled' && activeRes.value?.data) {
          setActivePoll(activeRes.value.data);
        }
        if (allRes.status === 'fulfilled') {
          const list = Array.isArray(allRes.value?.data) ? allRes.value.data : [];
          setPolls(list);
        }
      } catch {
        // Silent fail: GIS still works without poll metadata.
      }
    };

    fetchPoll();
    const interval = window.setInterval(fetchPoll, 60000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
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

  const [plots,           setPlots]           = useState([]);
  const [summary,         setSummary]         = useState(null);
  const [barangays,       setBarangays]       = useState([]);
  const [approvedCounts,  setApprovedCounts]  = useState({});
  const [utilizationData, setUtilizationData] = useState({});
  const [loading,         setLoading]         = useState(true);

  const [activeBarangay,  setActiveBarangay]  = useState(null);
  const [panelAnimate,    setPanelAnimate]    = useState(false);
  const [isMobile,        setIsMobile]        = useState(false);
  const [mobileSheet,     setMobileSheet]     = useState(false);
  const [lastClickedBrgy, setLastClickedBrgy] = useState(null);

  const [filterBrgy, setFilterBrgy] = useState('');
  const [activeTab,  setActiveTab]  = useState('monitoring');

  const [toast, setToast] = useState(null);
  const toastRef          = useRef(null);

  const { activePoll, polls } = useActiveSeedPoll();
  const [selectedPollId, setSelectedPollId] = useState(null);
  const selectedPoll = useMemo(
    () => polls.find(p => p.poll_id === selectedPollId) || activePoll || polls[0] || null,
    [polls, selectedPollId, activePoll]
  );
  const prevPollKeyRef    = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, type });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { loadLeaflet().then(setL); }, []);

  // ── LOAD ALL DATA ──
  const loadAll = useCallback(async () => {
    const pollId = selectedPoll?.poll_id || activePoll?.poll_id;
    setLoading(true);
    try {
      const [plotsRes, sumRes, brgyRes, utilRes] = await Promise.allSettled([
        getGisPlots({ poll_id: pollId }),
        getMapSummary({ poll_id: pollId }),
        getGisBarangays(),
        getProductionGISSummary(),
      ]);
      if (plotsRes.status === 'fulfilled') {
        const d = plotsRes.value.data;
        if (Array.isArray(d)) { setPlots(d); setApprovedCounts({}); }
        else if (d && typeof d === 'object') { setPlots(d.plots || []); setApprovedCounts(d.approved_counts || {}); }
      }
      if (sumRes.status === 'fulfilled')  setSummary(sumRes.value.data);
      if (brgyRes.status === 'fulfilled') setBarangays(brgyRes.value.data || []);
      if (utilRes.status === 'fulfilled') {
        const lookup = {};
        (utilRes.value.data || []).forEach(b => { if (b.barangay) lookup[b.barangay] = b; });
        setUtilizationData(lookup);
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
      setPlots([]);
      setSummary(null);
      setApprovedCounts({});
      setUtilizationData({});
      setActiveBarangay(null);
      setLastClickedBrgy(null);
      setMobileSheet(false);
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
      const [plotsRes, sumRes, brgyRes, utilRes] = await Promise.allSettled([
        getGisPlots({ poll_id: pollId }),
        getMapSummary({ poll_id: pollId }),
        getGisBarangays(),
        getProductionGISSummary(),
      ]);
      if (plotsRes.status === 'fulfilled') {
        const d = plotsRes.value.data;
        if (Array.isArray(d)) setPlots(d);
        else if (d && typeof d === 'object') { setPlots(d.plots || []); setApprovedCounts(d.approved_counts || {}); }
      }
      if (sumRes.status === 'fulfilled')  setSummary(sumRes.value.data);
      if (brgyRes.status === 'fulfilled') setBarangays(brgyRes.value.data || []);
      if (utilRes.status === 'fulfilled') {
        const lookup = {};
        (utilRes.value.data || []).forEach(b => { if (b.barangay) lookup[b.barangay] = b; });
        setUtilizationData(lookup);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadAll, selectedPoll, activePoll]);

  // ── INIT MAP ──
  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [14.1167, 121.5833], zoom: 13, minZoom: 12,
      zoomControl: false, attributionControl: true,
    });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);
    const allLayer = L.geoJSON(BRGY_FEATURES);
    const bounds   = allLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20], animate: false });
      map.setMinZoom(map.getZoom());
    }
    leafletMap.current = map;
    setL(L);
  }, [L]);

  // ── DRAW POLYGONS ──
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;

    if (polygonRef.current) map.removeLayer(polygonRef.current);
    if (outlineRef.current)  map.removeLayer(outlineRef.current);

    // Build overall dominant phase per barangay (all seed types combined)
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
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return phaseColor(dominant?.[0]) || NO_DATA_COLOR;
    };

    const getPolygonColor = (name) => {
      if (activeTab === 'utilization') {
        const utilBrgy = utilizationData[name];
        return utilBrgy?.avg_utilization_pct != null ? getUtilColor(utilBrgy.avg_utilization_pct) : NO_DATA_COLOR;
      }
      return getDominantPhaseColor(name);
    };

    const getTooltipContent = (name) => {
      if (activeTab === 'utilization') {
        const utilBrgy = utilizationData[name];
        if (!utilBrgy || utilBrgy.avg_utilization_pct == null) {
          return `<div style="font-size:0.82rem;font-weight:800;color:#0f172a;">${name}</div><div style="font-size:0.72rem;color:#94a3b8;margin-top:0.2rem;">No harvest data yet</div>`;
        }
        const tier  = getUtilTier(utilBrgy.avg_utilization_pct);
        const color = tier?.color || '#64748b';
        return `
          <div style="font-size:0.82rem;font-weight:800;color:#0f172a;margin-bottom:0.25rem;">${name}</div>
          <div style="display:flex;align-items:center;gap:0.35rem;margin-bottom:0.2rem;">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
            <span style="font-size:0.72rem;font-weight:700;color:${color};">${fmtNum(utilBrgy.avg_utilization_pct, 1)}% · ${tier?.label}</span>
          </div>
          <div style="font-size:0.68rem;color:#64748b;">${fmtNum(utilBrgy.total_production_mt)} MT · ${fmtNum(utilBrgy.avg_yield_t_ha)} t/ha</div>
        `;
      } else {
        const counts = brgyAllPhaseCounts[name];
        if (!counts) return `<div style="font-size:0.82rem;font-weight:800;color:#0f172a;">${name}</div><div style="font-size:0.72rem;color:#94a3b8;">No data yet</div>`;
        const sorted   = Object.entries(counts).sort((a, b) => b[1] - a[1]);
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
        return {
          color:       isActive ? 'white' : 'rgba(255,255,255,0.55)',
          fillColor:   color,
          fillOpacity: isActive ? 0.88 : 0.68,
          weight:      isActive ? 2.5  : 1.2,
          opacity:     1,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.ADM4_EN;
        layer.bindTooltip(
          `<div style="font-family:inherit;padding:0.15rem 0.1rem;">${getTooltipContent(name)}</div>`,
          { permanent: false, direction: 'top', className: 'gis-tooltip', offset: [0, -6] }
        );
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
        layer.on('mouseover', () => {
          layer.setStyle({ fillOpacity: name === activeBarangay ? 0.92 : 0.82, weight: name === activeBarangay ? 2.5 : 2 });
        });
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
        icon: L.divIcon({
          html: `<div class="brgy-label" style="font-size:0.95rem;font-weight:800;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.95),0 0 10px rgba(0,0,0,0.8);white-space:nowrap;pointer-events:none;text-align:center;">${name}</div>`,
          className: '', iconAnchor: [40, 8],
        }),
        interactive: false,
      }).addTo(map);
    });

    if (activeTab === 'utilization') {
      BRGY_FEATURES.forEach(feature => {
        const name     = feature.properties.ADM4_EN;
        const utilBrgy = utilizationData[name];
        if (!utilBrgy?.avg_utilization_pct) return;
        const center = L.geoJSON(feature).getBounds().getCenter();
        L.marker([center.lat - 0.005, center.lng], {
          icon: L.divIcon({
            html: `<div style="font-size:0.78rem;font-weight:800;color:white;text-shadow:0 1px 6px rgba(0,0,0,0.9);white-space:nowrap;pointer-events:none;text-align:center;">${Math.round(utilBrgy.avg_utilization_pct)}%</div>`,
            className: '', iconAnchor: [20, 4],
          }),
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

  }, [L, plots, activeBarangay, isMobile, activeTab, utilizationData, lastClickedBrgy]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L || !activeBarangay) return;
    const feature = BRGY_FEATURES.find(f => f.properties.ADM4_EN === activeBarangay);
    if (!feature) return;
    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true, duration: 0.6 });
  }, [L, activeBarangay]);

  const filteredPlots = useMemo(() => plots.filter(p => {
    const nb = normalizeBrgy(p.barangay);
    if (filterBrgy && nb !== normalizeBrgy(filterBrgy)) return false;
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

  // ── PANEL BODY ──
  // Note: MonitoringOverviewPanel manages its own internal scroll + fixed header
  // BarangayPanel manages its own internal scroll + fixed header
  // We pass panelRef only for non-monitoring overview (utilization overview scrolls via outer div)
  const PanelBody = () => {
    if (!activeBarangay) {
      return activeTab === 'utilization'
        ? <UtilizationOverviewPanel utilizationData={utilizationData} animate={panelAnimate} />
        : <MonitoringOverviewPanel plots={filteredPlots} summary={summary} animate={panelAnimate} />;
    }
    return (
      <BarangayPanel
        barangayName={activeBarangay}
        plots={filteredPlots}
        approvedCounts={approvedCounts}
        utilizationData={utilizationData}
        activeTab={activeTab}
        onBack={handleBack}
        animate={panelAnimate}
      />
    );
  };

  // ── RENDER ──
  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      <style>{`
        @keyframes gis-pop { 0%{opacity:0;transform:translateX(-50%) scale(0.88)} 70%{transform:translateX(-50%) scale(1.03)} 100%{opacity:1;transform:translateX(-50%) scale(1)} }
        @keyframes gis-fadeSlide { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gis-spin { to{transform:rotate(360deg)} }
        @keyframes gis-sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes gis-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .leaflet-tooltip { border-radius:0.75rem !important; border:none !important; box-shadow:0 4px 20px rgba(0,0,0,0.18) !important; }
        .gis-panel-scroll::-webkit-scrollbar { width:4px; }
        .gis-panel-scroll::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:99px; }
        .leaflet-container { font-family: inherit !important; }
        .gis-toolbar-row { display:flex; align-items:center; gap:0.5rem; flex-wrap:nowrap; min-width:0; overflow:hidden; }
        @media (max-width: 1100px) {
          .gis-season-label { display: none !important; }
          .gis-tab-text { display: none !important; }
        }
        @media (max-width: 960px) {
          .gis-panel-side { width: 280px !important; }
        }
      `}</style>

      <Toast toast={toast} />

      {!isMobile && (
        <div style={{ padding: '1rem 1.25rem 0.5rem', flexShrink: 0 }}>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16a34a' }}>
              GIS map overview
            </p>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1.15 }}>
              Lucban crop monitoring & utilization
            </h1>
            <p style={{ margin: '0.35rem 0 0', color: '#475569', fontSize: '0.92rem' }}>
              Switch seasons to compare active and historical poll data without leaving the map view.
            </p>
          </div>
        </div>
      )}

      {/* ── DESKTOP ── */}
      {!isMobile && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '0.5rem 0.875rem 0.875rem', gap: '0.75rem', minHeight: 0 }}>
          {/* Map side */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(15,23,42,0.08)', overflow: 'hidden', minHeight: 0 }}>
            {/* Toolbar */}
            <div style={{ padding: '0.55rem 0.875rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.35rem', alignItems: 'center', overflowX: 'auto', flexShrink: 0 }} className='gis-toolbar-row'>
              <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.625rem', padding: '0.175rem', gap: '0.175rem', flexShrink: 0 }}>
                <button onClick={() => handleTabChange('monitoring')}
                  style={{ padding: '0.32rem 0.7rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'monitoring' ? 'white' : 'transparent', color: activeTab === 'monitoring' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'monitoring' ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: activeTab === 'monitoring' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  <Activity size={12} /> <span className='gis-tab-text'>Crop monitoring</span>
                </button>
                <button onClick={() => handleTabChange('utilization')}
                  style={{ padding: '0.32rem 0.7rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'utilization' ? 'white' : 'transparent', color: activeTab === 'utilization' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'utilization' ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: activeTab === 'utilization' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  <TrendingUp size={12} /> <span className='gis-tab-text'>Crop utilization</span>
                </button>
              </div>
              <ToolbarLegend activeTab={activeTab} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontSize: '0.72rem', fontWeight: 600 }}>
                  <span className='gis-season-label' style={{ color: '#16a34a' }}>Season</span>
                  <select
                    value={selectedPoll?.poll_id || ''}
                    onChange={e => setSelectedPollId(Number(e.target.value) || null)}
                    style={{ padding: '0.3rem 0.55rem', border: '1px solid #dbe3ec', borderRadius: '0.5rem', backgroundColor: 'white', color: '#111827', fontSize: '0.73rem', fontWeight: 600, minWidth: 120, maxWidth: 130 }}
                  >
                    {polls.length > 0 ? polls.map(item => (
                      <option key={item.poll_id} value={item.poll_id}>{item.label}</option>
                    )) : <option value=''>Latest season</option>}
                  </select>
                </label>
                <select
                  value={filterBrgy}
                  onChange={e => {
                    setFilterBrgy(e.target.value);
                    if (e.target.value) handleBrgyClick(e.target.value);
                    else {
                      setActiveBarangay(null);
                      setLastClickedBrgy(null);
                      if (leafletMap.current && L) {
                        const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
                        if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [20, 20], animate: true });
                      }
                    }
                  }}
                  style={{ padding: '0.3rem 0.55rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.73rem', outline: 'none', backgroundColor: 'white', color: filterBrgy ? '#0f172a' : '#64748b', maxWidth: 144, fontWeight: filterBrgy ? 600 : 400 }}>
                  <option value=''>All barangays</option>
                  {(barangays.length > 0 ? barangays : ALLOWED_BRGYS).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <button onClick={loadAll}
                  style={{ padding: '0.32rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <RefreshCw size={13} color='#64748b' style={{ animation: loading ? 'gis-spin 0.8s linear infinite' : 'none' }} />
                </button>
              </div>
            </div>

            {/* Map */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              {loading && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' }}>
                  <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'gis-spin 0.8s linear infinite', margin: '0 auto 0.75rem' }} />
                    Loading map...
                  </div>
                </div>
              )}
              <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            </div>

            <div style={{ padding: '0.6rem 1.1rem', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={12} color='#94a3b8' />
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                {activeTab === 'utilization'
                  ? 'Utilization data from BRGY harvest records. Dry weight basis vs DA standard yield.'
                  : 'Crop phase data from AT monitoring visits. Updates in real-time.'}
              </span>
            </div>
          </div>

          {/* ── PANEL SIDE ── Fixed header + scrollable middle + fixed footer */}
          <div className='gis-panel-side' style={{
            width: 'clamp(280px, 22vw, 330px)', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            backgroundColor: 'white',
            borderRadius: '1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
            overflow: 'hidden', minHeight: 0,
          }}>
            {/* Panel title bar */}
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {activeTab === 'utilization' ? <TrendingUp size={15} color='#1a4d1a' /> : <Activity size={15} color='#1a4d1a' />}
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                {activeBarangay ? `Brgy. ${activeBarangay}` : activeTab === 'utilization' ? 'Utilization overview' : 'Monitoring overview'}
              </span>
              {activeBarangay && (
                <button onClick={handleBack}
                  style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <X size={13} /> Clear
                </button>
              )}
            </div>

            {/* Panel content — flex column, inner scroll handled per panel */}
            <div
              ref={panelRef}
              className='gis-panel-scroll'
              style={{
                flex: 1,
                overflowY: activeBarangay || activeTab === 'utilization' ? 'auto' : 'hidden',
                display: 'flex',
                flexDirection: 'column',
                paddingTop: activeBarangay ? 0 : activeTab === 'monitoring' ? '1.25rem' : 0,
                minHeight: 0,
              }}
            >
              <PanelBody />
            </div>

            <PanelFooter activeTab={activeTab} />
          </div>
        </div>
      )}

      {/* ── MOBILE ── */}
      {isMobile && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {!mobileSheet && (
            <div style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500, display: 'flex', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '999px', padding: '0.2rem', gap: '0.2rem', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
              <button onClick={() => handleTabChange('monitoring')}
                style={{ padding: '0.4rem 0.875rem', borderRadius: '999px', border: 'none', backgroundColor: activeTab === 'monitoring' ? '#1a4d1a' : 'transparent', color: activeTab === 'monitoring' ? 'white' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' }}>
                <Activity size={13} /> Monitoring
              </button>
              <button onClick={() => handleTabChange('utilization')}
                style={{ padding: '0.4rem 0.875rem', borderRadius: '999px', border: 'none', backgroundColor: activeTab === 'utilization' ? '#1a4d1a' : 'transparent', color: activeTab === 'utilization' ? 'white' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' }}>
                <TrendingUp size={13} /> Utilization
              </button>
            </div>
          )}

          {mobileSheet && (
            <>
              <div onClick={() => setMobileSheet(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 700 }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 800, backgroundColor: 'white', borderRadius: '1.5rem 1.5rem 0 0', maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)', animation: 'gis-sheetUp 0.35s cubic-bezier(0.34,1.1,0.64,1)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div style={{ width: 44, height: 4, backgroundColor: '#e2e8f0', borderRadius: '999px', margin: '0.875rem auto', flexShrink: 0 }} />
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: activeBarangay ? 0 : '0.5rem' }} className='gis-panel-scroll'>
                  <PanelBody />
                </div>
                <PanelFooter activeTab={activeTab} />
              </div>
            </>
          )}

          {!mobileSheet && (
            <button onClick={() => setMobileSheet(true)}
              style={{ position: 'absolute', bottom: '1.5rem', right: '1rem', zIndex: 600, backgroundColor: '#1a4d1a', color: 'white', border: 'none', borderRadius: '999px', padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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