// src/pages/at/ATGisMap.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Activity, TrendingUp, RefreshCw, AlertCircle,
  ChevronLeft, X, MapPin, Clock, Database,
} from 'lucide-react';
import API, {
  getGisPlots, getMapSummary, getHarvestRecords, getGisActivePoll,
} from '../../api/axios';
import LucbanGIS from '../../data/LucbanGIS.json';

// ── Same constants as admin GisMap ──────────────────────────────
const PHASES = [
  { key: 'Seed Distribution',  color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB', label: 'Seed Distribution'  },
  { key: 'Crop Establishment', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', label: 'Crop Establishment' },
  { key: 'Tillering',          color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', label: 'Tillering'          },
  { key: 'Flowering',          color: '#A855F7', bg: '#FAF5FF', border: '#E9D5FF', label: 'Flowering'          },
  { key: 'Ripening',           color: '#FACC15', bg: '#FEFCE8', border: '#FDE68A', label: 'Ripening'           },
  { key: 'Harvesting',         color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', label: 'Harvesting'         },
];
const PHASE_ORDER = PHASES.map(p => p.key);
const PHASE_MAP   = Object.fromEntries(PHASES.map(p => [p.key, p]));

const SEED_TYPES = [
  { key: 'HYBRID',   label: 'Hybrid seeds',      color: '#1a4d1a', bg: '#f0fdf4', border: '#bbf7d0', hasDistribution: true  },
  { key: 'INBRED',   label: 'Certified seeds',    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', hasDistribution: true  },
  { key: 'OWN_SEED', label: 'Farmer saved seeds', color: '#b45309', bg: '#fef3c7', border: '#fde68a', hasDistribution: false },
];
const SEED_TYPE_MAP = Object.fromEntries(SEED_TYPES.map(s => [s.key, s]));

const UTIL_TIERS = [
  { key: 'Exceeded Target', min: 100.01, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', label: 'Exceeded Target' },
  { key: 'Achieved Target', min: 80,     color: '#15803d', bg: '#dcfce7', border: '#86efac', label: 'Achieved Target' },
  { key: 'Near Target',     min: 70,     color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe', label: 'Near Target'     },
  { key: 'Below Target',    min: 50,     color: '#b45309', bg: '#fefce8', border: '#fde68a', label: 'Below Target'    },
  { key: 'Critical',        min: 0,      color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', label: 'Critical'        },
];
const NO_DATA_COLOR = '#1E293B';
const TARGET_YIELD_KG_HA = { HYBRID: 5000, INBRED: 4000, OWN_SEED: 3000 };

const computeUtilPct = (rec) => {
  const bags = parseFloat(rec.harvest_bags) || 0;
  const area = parseFloat(rec.harvest_area_ha) || 0;
  const seed = rec.seed_source || 'OWN_SEED';
  const exp_kg = area * (TARGET_YIELD_KG_HA[seed] || 3000);
  if (exp_kg <= 0) return null;
  return (bags * 50 / exp_kg) * 100;
};
const getUtilTier  = (pct) => {
  if (pct == null) return null;
  if (pct > 100) return UTIL_TIERS[0];
  return UTIL_TIERS.find(t => pct >= t.min) || UTIL_TIERS[UTIL_TIERS.length - 1];
};
const getUtilColor = (pct) => getUtilTier(pct)?.color || NO_DATA_COLOR;

const ALLOWED_BRGYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan',
];
const normBrgy = v => v?.toString().trim().replace(/[-_]+/g,' ').replace(/\s+/g,' ').toLowerCase();
const fmtNum = (n, d = 2) => n != null && !isNaN(n)
  ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

const normalizePhase = (value) => {
  const p = (value || '').toString().trim();
  if (!p) return 'Seed Distribution';
  if (/^seed[\s_-]*distribution$/i.test(p) || /^distribution$/i.test(p)) return 'Seed Distribution';
  if (/^crop[\s_-]*establishment$/i.test(p)) return 'Crop Establishment';
  if (/^no[\s_-]*monitoring[\s_-]*yet$/i.test(p)) return 'Seed Distribution';
  return Object.keys(PHASE_MAP).find(k => k.toLowerCase() === p.toLowerCase()) || p;
};

// Same as admin buildSeedTypeBreakdown
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

// Priority order for tiebreaking
const UTIL_TIER_PRIORITY = ['Exceeded Target', 'Achieved Target', 'Near Target', 'Below Target', 'Critical'];

const buildBrgyUtil = (harvestRecords, plots = []) => {
  // Build harvesting-phase farmer set per brgy from plots (AT monitoring data)
  const brgyHarvestingFarmers = {};
  plots.forEach(p => {
    const phase = normalizePhase(p.land_type);
    if (phase === 'Harvesting') {
      const brgy = ALLOWED_BRGYS.find(b => normBrgy(b) === normBrgy(p.barangay)) || p.barangay;
      if (!brgy) return;
      if (!brgyHarvestingFarmers[brgy]) brgyHarvestingFarmers[brgy] = new Set();
      brgyHarvestingFarmers[brgy].add(p.farmer);
    }
  });

  const brgyEncodedFarmers = {};
  harvestRecords.forEach(rec => {
    const rawBrgy = rec.barangay;
    if (!rawBrgy) return;
    const brgy = ALLOWED_BRGYS.find(b => normBrgy(b) === normBrgy(rawBrgy)) || rawBrgy;
    if (!brgyEncodedFarmers[brgy]) brgyEncodedFarmers[brgy] = new Set();
    brgyEncodedFarmers[brgy].add(rec.farmer);
    if (!brgyHarvestingFarmers[brgy]) brgyHarvestingFarmers[brgy] = new Set();
    brgyHarvestingFarmers[brgy].add(rec.farmer);
  });

  const result = {};
  const allBrgys = new Set([
    ...Object.keys(brgyHarvestingFarmers),
    ...harvestRecords.map(r => {
      const rawBrgy = r.barangay;
      return ALLOWED_BRGYS.find(b => normBrgy(b) === normBrgy(rawBrgy)) || rawBrgy;
    }).filter(Boolean),
  ]);

  allBrgys.forEach(brgy => {
    const totalUnique = brgyHarvestingFarmers[brgy]?.size || 0;
    const encodedCount = brgyEncodedFarmers[brgy]?.size || 0;

    const brgyRecs = harvestRecords.filter(r => {
      const b = ALLOWED_BRGYS.find(b2 => normBrgy(b2) === normBrgy(r.barangay)) || r.barangay;
      return b === brgy;
    });

    const seedTierFarmerSets = {};
    SEED_TYPES.forEach(st => {
      seedTierFarmerSets[st.key] = {};
      UTIL_TIERS.forEach(t => { seedTierFarmerSets[st.key][t.key] = new Set(); });
    });

    brgyRecs.forEach(rec => {
      const seed = rec.seed_source || 'OWN_SEED';
      const util = computeUtilPct(rec);
      const tier = getUtilTier(util);
      if (!tier) return;
      if (!seedTierFarmerSets[seed]) {
        seedTierFarmerSets[seed] = {};
        UTIL_TIERS.forEach(t => { seedTierFarmerSets[seed][t.key] = new Set(); });
      }
      seedTierFarmerSets[seed][tier.key].add(rec.farmer);
    });

    const seedTierCounts = {};
    SEED_TYPES.forEach(st => {
      seedTierCounts[st.key] = { tierCounts: {}, total: 0 };
      UTIL_TIERS.forEach(t => {
        const count = seedTierFarmerSets[st.key][t.key]?.size || 0;
        if (count > 0) {
          seedTierCounts[st.key].tierCounts[t.key] = count;
          seedTierCounts[st.key].total += count;
        }
      });
    });

    const tierSumPct = {};
    if (totalUnique > 0) {
      SEED_TYPES.forEach(st => {
        UTIL_TIERS.forEach(t => {
          const count = seedTierFarmerSets[st.key]?.[t.key]?.size || 0;
          if (count > 0) {
            const pct = (count / totalUnique) * 100;
            tierSumPct[t.key] = (tierSumPct[t.key] || 0) + pct;
          }
        });
      });
    }

    let dominantTierKey = null;
    let maxPct = -1;
    UTIL_TIER_PRIORITY.forEach(tierKey => {
      const pct = tierSumPct[tierKey] || 0;
      if (pct > maxPct) { maxPct = pct; dominantTierKey = tierKey; }
    });
    const dominantTier = dominantTierKey
      ? UTIL_TIERS.find(t => t.key === dominantTierKey) || null : null;

    const totalAreaHa = brgyRecs.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
    const totalProductionMt = brgyRecs.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0);

    result[brgy] = {
      barangay: brgy,
      totalUniqueHarvestingFarmers: totalUnique,
      encodedFarmerCount: encodedCount,
      seedTierCounts,
      tierSumPct,
      dominantTier,
      total_area_ha: totalAreaHa,
      total_production_mt: totalProductionMt,
      farmer_count: encodedCount,
      // legacy compat
      avg_util: dominantTier ? (tierSumPct[dominantTier.key] || 0) : null,
    };
  });

  return result;
};

let _leafletReady = false;
const loadLeaflet = () => new Promise(resolve => {
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

// ── Seed Type Breakdown Card — same as admin ──────────────────
const SeedTypeBreakdownCard = ({ seedKey, phaseCounts, totalFarmers, totalApprovedFarmers }) => {
  const cfg = SEED_TYPE_MAP[seedKey] || { label: seedKey, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(false);
    const t = window.setTimeout(() => setAnimated(true), 80);
    return () => window.clearTimeout(t);
  }, [phaseCounts]);

  const denominator = totalApprovedFarmers > 0 ? totalApprovedFarmers : totalFarmers;
  const hasDistrib  = SEED_TYPE_MAP[seedKey]?.hasDistribution ?? true;
  const allowedPhaseKeys = hasDistrib ? PHASE_ORDER : PHASE_ORDER.filter(k => k !== 'Seed Distribution');

  const phaseList = allowedPhaseKeys
    .map(k => ({
      key: k, ...PHASE_MAP[k],
      count:   phaseCounts[k] || 0,
      percent: denominator > 0 ? Math.round(((phaseCounts[k] || 0) / denominator) * 100) : 0,
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

// ── Util Seed Type Card — same as admin ───────────────────────
const UtilSeedTypeCard = ({ seedKey, tierCounts, totalUniqueFarmers, total, encodedFarmers, totalApprovedFarmers }) => {
  const cfg = SEED_TYPE_MAP[seedKey] || { label: seedKey, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  const [animated, setAnimated] = useState(false);

  // Support both new (totalUniqueFarmers) and legacy (totalApprovedFarmers/total) props
  const denominator = totalUniqueFarmers > 0 ? totalUniqueFarmers
    : (totalApprovedFarmers > 0 ? totalApprovedFarmers : total);

  useEffect(() => {
    setAnimated(false);
    const t = window.setTimeout(() => setAnimated(true), 80);
    return () => window.clearTimeout(t);
  }, [tierCounts]);

  const tierList = UTIL_TIERS
    .map(tier => ({
      ...tier,
      count:   tierCounts[tier.key] || 0,
      percent: denominator > 0
        ? Math.round(((tierCounts[tier.key] || 0) / denominator) * 100) : 0,
    }))
    .filter(t => t.count > 0)
    .sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      const priority = ['Exceeded Target','Achieved Target','Near Target','Below Target','Critical'];
      return priority.indexOf(a.key) - priority.indexOf(b.key);
    });

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
      {dominant && (
        <div style={{ backgroundColor: dominant.bg, border: `1px solid ${dominant.border}`, borderRadius: '0.75rem', padding: '0.75rem 0.875rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dominant.color, display: 'inline-block' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dominant</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: dominant.color }}>{dominant.label}</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: dominant.color }}>{dominant.percent}%</span>
          </div>
          <div style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: animated ? `${Math.max(2, dominant.percent)}%` : '0%', backgroundColor: dominant.color, borderRadius: '999px', transition: 'width 0.6s cubic-bezier(0.34,1,0.64,1)' }} />
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.65rem', color: '#64748b' }}>
            {dominant.count} of {denominator} farmer{denominator !== 1 ? 's' : ''}
          </p>
        </div>
      )}
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

// ── Panel Footer — same as admin ──────────────────────────────
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

// ── Main shared GIS component ─────────────────────────────────
export const RoleGisMap = ({ assignedBarangays = [], roleLabel = '', pollId = null }) => {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const polygonRef = useRef(null);
  const outlineRef = useRef(null);
  const panelRef   = useRef(null);
  const [L, setL]  = useState(null);

  const [plots,          setPlots]          = useState([]);
  const [summary,        setSummary]        = useState(null);
  const [harvestRecords, setHarvestRecords] = useState([]);
  const [approvedCounts, setApprovedCounts] = useState({});
  const [loading,        setLoading]        = useState(true);

  const [activeBarangay,  setActiveBarangay]  = useState(null);
  const [lastClickedBrgy, setLastClickedBrgy] = useState(null);
  const [panelAnimate,    setPanelAnimate]    = useState(false);
  const [activeTab,       setActiveTab]       = useState('monitoring');
  const [monitoringTab,   setMonitoringTab]   = useState('HYBRID');
  const [utilizationTab,  setUtilizationTab]  = useState('HYBRID');
  const [isMobile,        setIsMobile]        = useState(window.innerWidth < 900);
  const [mobileSheet,     setMobileSheet]     = useState(false);

  // Strict isolation: only assigned barangays
  const BRGY_FEATURES = useMemo(() => {
    if (assignedBarangays.length === 0) return [];
    const assignedSet = new Set(assignedBarangays.map(normBrgy));
    return LucbanGIS.features.filter(f => assignedSet.has(normBrgy(f.properties?.ADM4_EN)));
  }, [assignedBarangays]);

  const brgyUtilData = useMemo(() => buildBrgyUtil(harvestRecords, plots), [harvestRecords, plots]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { loadLeaflet().then(setL); }, []);

  const loadAll = useCallback(async () => {
    if (assignedBarangays.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = {};
      if (pollId) params.poll_id = pollId;
      const assignedSet = new Set(assignedBarangays.map(normBrgy));

      const [plotsRes, sumRes, harvestRes] = await Promise.allSettled([
        getGisPlots(params),
        getMapSummary(params),
        getHarvestRecords(params),
      ]);

      if (plotsRes.status === 'fulfilled') {
        const d = plotsRes.value.data;
        const rawPlots = Array.isArray(d) ? d : (d?.plots || []);
        setPlots(rawPlots.filter(p => p.barangay && assignedSet.has(normBrgy(p.barangay))));
        if (d?.approved_counts) setApprovedCounts(d.approved_counts);
      }
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
      if (harvestRes.status === 'fulfilled') {
        const d = harvestRes.value.data;
        const rawH = Array.isArray(d) ? d : (d?.results || []);
        setHarvestRecords(rawH.filter(r => r.barangay && assignedSet.has(normBrgy(r.barangay))));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [pollId, assignedBarangays]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Init map
  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [14.1167, 121.5833], zoom: 13,
      minZoom: 9, zoomControl: false, attributionControl: true,
    });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);
    if (BRGY_FEATURES.length > 0) {
      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], animate: false });
    }
    leafletMap.current = map;
    setL(L);
  }, [L, BRGY_FEATURES]);

  // Draw polygons
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;
    if (polygonRef.current) { map.removeLayer(polygonRef.current); polygonRef.current = null; }
    if (outlineRef.current)  { map.removeLayer(outlineRef.current); outlineRef.current = null; }
    if (BRGY_FEATURES.length === 0) return;

    const brgyPhaseCounts = {};
    plots.forEach(p => {
      if (!p.barangay) return;
      const k = normalizePhase(p.land_type);
      if (!brgyPhaseCounts[p.barangay]) brgyPhaseCounts[p.barangay] = {};
      brgyPhaseCounts[p.barangay][k] = (brgyPhaseCounts[p.barangay][k] || 0) + 1;
    });

    const getDominantPhaseColor = (name) => {
      const counts = brgyPhaseCounts[name];
      if (!counts) return NO_DATA_COLOR;
      const sorted = Object.entries(counts).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return PHASE_ORDER.indexOf(b[0]) - PHASE_ORDER.indexOf(a[0]);
      });
      return PHASE_MAP[sorted[0]?.[0]]?.color || NO_DATA_COLOR;
    };

    const getPolygonColor = (name) => {
      if (activeTab === 'utilization') {
        const util = brgyUtilData[name];
        if (!util || !util.dominantTier) return NO_DATA_COLOR;
        return util.dominantTier.color;
      }
      return getDominantPhaseColor(name);
    };

    polygonRef.current = L.geoJSON(BRGY_FEATURES, {
      style: feature => {
        const name    = feature.properties.ADM4_EN;
        const isActive = name === activeBarangay;
        return {
          color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
          fillColor: getPolygonColor(name),
          fillOpacity: isActive ? 0.88 : 0.68,
          weight: isActive ? 2.5 : 1.2, opacity: 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.ADM4_EN;
        layer.bindTooltip(
          `<div style="font-family:inherit;padding:.1rem .15rem;"><div style="font-size:.82rem;font-weight:800;color:#0f172a;">${name}</div></div>`,
          { permanent: false, direction: 'top', className: 'gis-tooltip', offset: [0, -6] }
        );
        layer.on('click', () => {
          if (lastClickedBrgy === name) {
            setActiveBarangay(null); setLastClickedBrgy(null);
            const fb = L.geoJSON(BRGY_FEATURES).getBounds();
            if (fb.isValid()) map.fitBounds(fb, { padding: [30, 30], animate: true });
          } else {
            setActiveBarangay(name); setLastClickedBrgy(name);
            setPanelAnimate(true);
            if (isMobile) setMobileSheet(true);
            setTimeout(() => setPanelAnimate(false), 400);
            if (panelRef.current) panelRef.current.scrollTop = 0;
          }
        });
        layer.on('mouseover', () => layer.setStyle({ fillOpacity: name === activeBarangay ? 0.92 : 0.82, weight: 2 }));
        layer.on('mouseout',  () => polygonRef.current?.resetStyle(layer));
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
          html: `<div style="font-size:.9rem;font-weight:800;color:white;text-shadow:0 1px 4px rgba(0,0,0,.95),0 0 10px rgba(0,0,0,.8);white-space:nowrap;pointer-events:none;">${name}</div>`,
          className: '', iconAnchor: [40, 8],
        }),
        interactive: false,
      }).addTo(map);
    });
  }, [L, plots, activeBarangay, isMobile, activeTab, brgyUtilData, lastClickedBrgy, BRGY_FEATURES]);

  // Zoom to selected brgy
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L || !activeBarangay) return;
    const feature = BRGY_FEATURES.find(f => f.properties.ADM4_EN === activeBarangay);
    if (!feature) return;
    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
  }, [L, activeBarangay, BRGY_FEATURES]);

  const handleBack = useCallback(() => {
    setActiveBarangay(null); setLastClickedBrgy(null); setMobileSheet(false);
    setPanelAnimate(true); setTimeout(() => setPanelAnimate(false), 400);
    if (panelRef.current) panelRef.current.scrollTop = 0;
    if (leafletMap.current && L && BRGY_FEATURES.length > 0) {
      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
      if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [30, 30], animate: true });
    }
  }, [L, BRGY_FEATURES]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab); setActiveBarangay(null); setLastClickedBrgy(null); setMobileSheet(false);
    if (leafletMap.current && L && BRGY_FEATURES.length > 0) {
      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
      if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [30, 30], animate: true });
    }
  }, [L, BRGY_FEATURES]);

  // ── Computed data for panels ──────────────────────────────────
  const brgyPlots = useMemo(() =>
    activeBarangay ? plots.filter(p => p.barangay === activeBarangay) : plots,
    [plots, activeBarangay]
  );
  const brgyHarvest = useMemo(() =>
    activeBarangay ? harvestRecords.filter(r => r.barangay === activeBarangay) : harvestRecords,
    [harvestRecords, activeBarangay]
  );
  const seedBreakdown  = useMemo(() => buildSeedTypeBreakdown(brgyPlots), [brgyPlots]);
  const uniqueFarmers  = useMemo(() => [...new Set(brgyPlots.map(p => p.farmer))].length, [brgyPlots]);
  const encodedCount   = useMemo(() => [...new Set(brgyHarvest.map(r => r.farmer))].length, [brgyHarvest]);
  const harvestMT      = useMemo(() => brgyHarvest.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0), [brgyHarvest]);
  const harvestArea    = useMemo(() => brgyHarvest.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0), [brgyHarvest]);
  const totalApproved  = activeBarangay
    ? (approvedCounts?.[activeBarangay] || brgyPlots[0]?.total_approved_in_brgy || 0)
    : (summary?.total_approved_farmers ?? 0);
  const totalApprovedInBrgy = activeBarangay ? (approvedCounts?.[activeBarangay] || 0) : 0;

  // Harvest tier breakdown per seed type
  const seedTierCounts = useMemo(() => {
    const result = {};
    SEED_TYPES.forEach(st => { result[st.key] = { tierCounts: {}, total: 0 }; });
    brgyHarvest.forEach(rec => {
      const seed = rec.seed_source || 'OWN_SEED';
      const util = computeUtilPct(rec);
      const tier = getUtilTier(util);
      const key  = tier?.key || 'Critical';
      if (!result[seed]) result[seed] = { tierCounts: {}, total: 0 };
      result[seed].tierCounts[key] = (result[seed].tierCounts[key] || 0) + 1;
      result[seed].total += 1;
    });
    return result;
  }, [brgyHarvest]);

  // ── Panel content — same structure as admin ───────────────────
  const PanelBody = () => {
    // OVERVIEW (no barangay selected)
    if (!activeBarangay) {
      return (
        <>
          {/* Green overview card */}
          <div style={{ padding: '0 1.25rem 1rem', flexShrink: 0 }}>
            <div style={{ background: 'linear-gradient(135deg,#1a4d1a,#166534)', borderRadius: '1.25rem', padding: '1.25rem', color: 'white', animation: panelAnimate ? 'gis-fadeSlide 0.35s ease' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {activeTab === 'utilization'
                  ? <TrendingUp size={15} color='rgba(255,255,255,0.8)' />
                  : <Activity   size={15} color='rgba(255,255,255,0.8)' />}
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {roleLabel.replace('Agricultural Technician', 'AT').replace('Barangay President', 'Brgy. Pres.')} overview
                </span>
                {(() => {
                  const seen = new Set();
                  const phaseCounts = {};
                  plots.forEach(p => {
                    const phase = normalizePhase(p.land_type);
                    const key = `${p.farmer}::${p.seed_source}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
                  });
                  const sorted = Object.entries(phaseCounts).sort((a, b) => {
                    if (b[1] !== a[1]) return b[1] - a[1];
                    return PHASE_ORDER.indexOf(b[0]) - PHASE_ORDER.indexOf(a[0]);
                  });
                  const dominant = sorted[0]?.[0];
                  const phCfg = dominant ? PHASE_MAP[dominant] : null;
                  if (!phCfg) return <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.62rem', fontWeight: 700 }}>LIVE</span>;
                  return (
                    <span style={{ marginLeft: 'auto', backgroundColor: phCfg.color + '33', border: `1px solid ${phCfg.color}88`, borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.62rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: phCfg.color, display: 'inline-block', flexShrink: 0 }} />
                      {dominant}
                    </span>
                  );
                })()}
              </div>
              {activeTab === 'monitoring' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
                      {uniqueFarmers}{totalApproved ? `/${totalApproved}` : ''}
                    </p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Total farmers</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
                      {assignedBarangays.length}
                    </p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Barangays</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{encodedCount || '—'}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Farmers</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{harvestMT > 0 ? `${fmtNum(harvestMT)}` : '—'}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>MT</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{harvestArea > 0 ? `${fmtNum(harvestArea)}` : '—'}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Area ha</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Seed type tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9', padding: '0 1.25rem', flexShrink: 0 }}>
            {SEED_TYPES.map(st => {
              const isActive = (activeTab === 'monitoring' ? monitoringTab : utilizationTab) === st.key;
              return (
                <button key={st.key} onClick={() => activeTab === 'monitoring' ? setMonitoringTab(st.key) : setUtilizationTab(st.key)} style={{
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

          {/* Tab content */}
          <div ref={panelRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem 0.5rem' }} className='gis-panel-scroll'>
            {activeTab === 'monitoring' ? (
              <SeedTypeBreakdownCard
                key={monitoringTab}
                seedKey={monitoringTab}
                phaseCounts={seedBreakdown[monitoringTab]?.phases || {}}
                totalFarmers={seedBreakdown[monitoringTab]?.total || 0}
                totalApprovedFarmers={summary?.total_approved_farmers ?? 0}
              />
            ) : brgyHarvest.length === 0 ? (
              <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2.5rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <TrendingUp size={28} color='#d1d5db' style={{ display: 'block', margin: '0 auto 0.75rem' }} />
                <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.375rem', fontSize: '0.875rem' }}>No harvest data yet</p>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Utilization data will appear once harvest records are encoded.</p>
              </div>
            ) : (
              <UtilSeedTypeCard
                key={utilizationTab}
                seedKey={utilizationTab}
                tierCounts={seedTierCounts[utilizationTab]?.tierCounts || {}}
                totalUniqueFarmers={[...new Set(harvestRecords.map(r => r.farmer))].length}
                total={seedTierCounts[utilizationTab]?.total || 0}
                encodedFarmers={encodedCount}
                totalApprovedFarmers={summary?.total_approved_farmers ?? 0}
              />
            )}
          </div>
        </>
      );
    }

    // BARANGAY DETAIL
    const activeSeedTab = activeTab === 'monitoring' ? monitoringTab : utilizationTab;
    return (
      <>
        {/* Brgy header — same as admin BarangayPanel */}
        <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg,#1a4d1a,#166534)', color: 'white', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
            <button onClick={handleBack} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.5rem', color: 'white', padding: '0.35rem 0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
              <ChevronLeft size={14} /> Back
            </button>
            {(() => {
              if (activeTab === 'utilization') {
                const util = brgyUtilData[activeBarangay];
                const label = util?.totalUniqueHarvestingFarmers > 0
                  ? `${encodedCount}/${util.totalUniqueHarvestingFarmers} encoded`
                  : encodedCount > 0 ? `${encodedCount} encoded` : 'No harvest data';
                const color = util?.dominantTier?.color || '#94a3b8';
                return (
                  <span style={{ marginLeft: 'auto', backgroundColor: color + '33', border: `1px solid ${color}66`, borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                );
              }
              // Monitoring: show dominant phase
              const brgyPhaseCounts = {};
              brgyPlots.forEach(p => {
                const phase = normalizePhase(p.land_type);
                brgyPhaseCounts[phase] = (brgyPhaseCounts[phase] || 0) + 1;
              });
              const sorted = Object.entries(brgyPhaseCounts).sort((a, b) => {
                if (b[1] !== a[1]) return b[1] - a[1];
                return PHASE_ORDER.indexOf(b[0]) - PHASE_ORDER.indexOf(a[0]);
              });
              const dominant = sorted[0]?.[0];
              const phCfg = dominant ? PHASE_MAP[dominant] : null;
              if (!phCfg) return (
                <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
                  {uniqueFarmers}{totalApproved ? `/${totalApproved}` : ''} farmers
                </span>
              );
              return (
                <span style={{ marginLeft: 'auto', backgroundColor: phCfg.color + '33', border: `1px solid ${phCfg.color}66`, borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: phCfg.color, display: 'inline-block', flexShrink: 0 }} />
                  Dominant: {dominant}
                </span>
              );
            })()}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={20} color='white' />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Brgy. {activeBarangay}</h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Lucban, Quezon</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'monitoring' ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: '0.6rem' }}>
            {activeTab === 'monitoring' ? (
              <>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{totalApprovedInBrgy ? `${uniqueFarmers}/${totalApprovedInBrgy}` : uniqueFarmers}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 700 }}>Farmers</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{(() => {
                    // Sum area per farmer+seed_source combo at ESTABLISHMENT phase only
                    // A farmer with 0.5ha OWN_SEED + 0.5ha INBRED = 1.0ha total
                    const seen = new Set();
                    let total = 0;
                    brgyPlots.forEach(p => {
                      if (p.crop_phase_key !== 'ESTABLISHMENT') return;
                      const ha = parseFloat(p.area_ha) || 0;
                      if (ha <= 0) return;
                      const key = `${p.farmer}::${p.seed_source}`;
                      if (seen.has(key)) return;
                      seen.add(key);
                      total += ha;
                    });
                    return total > 0 ? `${total.toFixed(1)} ha` : '—';
                  })()}</p>
                  
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 700 }}>Area</p>
                </div>
              </>
            ) : (
              <>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{(() => { const uniqueH = brgyUtilData[activeBarangay]?.totalUniqueHarvestingFarmers || 0; return uniqueH > 0 ? `${encodedCount}/${uniqueH}` : `${encodedCount}`; })()}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 700 }}>Encoded</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{harvestMT > 0 ? `${fmtNum(harvestMT)} MT` : '—'}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 700 }}>Production</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>{harvestArea > 0 ? `${fmtNum(harvestArea)} ha` : '—'}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 700 }}>Area</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Seed type tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9', padding: '0 1.25rem', flexShrink: 0 }}>
          {SEED_TYPES.map(st => {
            const isActive = activeSeedTab === st.key;
            return (
              <button key={st.key} onClick={() => activeTab === 'monitoring' ? setMonitoringTab(st.key) : setUtilizationTab(st.key)} style={{
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

        {/* Scrollable body */}
        <div ref={panelRef} style={{ flex: 1, overflowY: 'auto', padding: '1.15rem 1.25rem 0.5rem' }} className='gis-panel-scroll'>
          {activeTab === 'monitoring' ? (
            brgyPlots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                <MapPin size={26} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No monitoring data yet.</p>
              </div>
            ) : (
              <SeedTypeBreakdownCard
                key={monitoringTab}
                seedKey={monitoringTab}
                phaseCounts={seedBreakdown[monitoringTab]?.phases || {}}
                totalFarmers={seedBreakdown[monitoringTab]?.total || 0}
                totalApprovedFarmers={totalApprovedInBrgy}
              />
            )
          ) : brgyHarvest.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
              <TrendingUp size={26} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.82rem' }}>No harvest data for this barangay yet.</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem' }}>Data appears once harvest records are encoded.</p>
            </div>
          ) : (
            <UtilSeedTypeCard
              key={utilizationTab}
              seedKey={utilizationTab}
              tierCounts={seedTierCounts[utilizationTab]?.tierCounts || {}}
              totalUniqueFarmers={brgyUtilData[activeBarangay]?.totalUniqueHarvestingFarmers || encodedCount}
              total={seedTierCounts[utilizationTab]?.total || 0}
              encodedFarmers={encodedCount}
              totalApprovedFarmers={totalApprovedInBrgy}
            />
          )}
        </div>
      </>
    );
  };

  // ── Legend ────────────────────────────────────────────────────
  const legendItems = activeTab === 'utilization'
    ? UTIL_TIERS.map(t => ({ color: t.color, label: t.label }))
    : PHASES.map(p => ({ color: p.color, label: p.label }));

  // ── Height calculation ────────────────────────────────────────
  // UserLayout header = 60px (desktop) or ~60px (mobile)
  // Mobile bottom nav = 72px
  const HEADER_H = 61;
  const BOTTOM_NAV_H = 72;
  const containerHeight = isMobile
    ? `calc(100dvh - ${HEADER_H}px - ${BOTTOM_NAV_H}px - env(safe-area-inset-bottom))`
    : `calc(100vh - ${HEADER_H}px)`;

  if (assignedBarangays.length === 0 && !loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem', height: containerHeight, color: '#94a3b8' }}>
      <MapPin size={32} color='#cbd5e1' />
      <p style={{ margin: 0, fontWeight: 700, color: '#374151' }}>No barangay assigned</p>
      <p style={{ margin: 0, fontSize: '0.8rem' }}>Contact your administrator to assign a barangay.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: containerHeight, overflow: 'hidden', padding: isMobile ? 0 : '1rem', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes gis-spin     { to { transform: rotate(360deg); } }
        @keyframes gis-fadeSlide { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes gis-sheetUp  { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .leaflet-tooltip { border-radius:.75rem !important; border:none !important; box-shadow:0 4px 20px rgba(0,0,0,.18) !important; }
        .gis-panel-scroll::-webkit-scrollbar { width:4px; }
        .gis-panel-scroll::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:99px; }
        .leaflet-container { font-family:inherit !important; height:100% !important; }
      `}</style>

      {/* Title — desktop only */}
      {!isMobile && (
        <div style={{ paddingBottom: '0.5rem', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16a34a' }}>
            GIS Map · {roleLabel}
            {assignedBarangays.length > 0 && (
              <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '0.5rem' }}>
                — {assignedBarangays.join(', ')}
              </span>
            )}
          </p>
        </div>
      )}

      {/* ── DESKTOP: map + panel side by side (same as admin) ── */}
      {!isMobile && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', gap: '0.65rem' }}>
          {/* LEFT — Map */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(15,23,42,.08)', overflow: 'hidden', minHeight: 0 }}>
            {/* Toolbar */}
            <div style={{ padding: '0.55rem 0.875rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0, overflowX: 'auto' }}>
              <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.625rem', padding: '0.175rem', gap: '0.175rem', flexShrink: 0 }}>
                <button onClick={() => handleTabChange('monitoring')} style={{ padding: '0.32rem 0.7rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'monitoring' ? 'white' : 'transparent', color: activeTab === 'monitoring' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'monitoring' ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: activeTab === 'monitoring' ? '0 1px 4px rgba(0,0,0,.1)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  <Activity size={12} /> Crop monitoring
                </button>
                <button onClick={() => handleTabChange('utilization')} style={{ padding: '0.32rem 0.7rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'utilization' ? 'white' : 'transparent', color: activeTab === 'utilization' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'utilization' ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: activeTab === 'utilization' ? '0 1px 4px rgba(0,0,0,.1)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  <TrendingUp size={12} /> Crop utilization
                </button>
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0 0.875rem', flexShrink: 0, overflowX: 'auto' }}>
                {legendItems.map((item, idx) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0 0.5rem', borderRight: idx < legendItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '2px', backgroundColor: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.68rem', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>{item.label}</span>
                  </div>
                ))}
              </div>
              <button onClick={loadAll} style={{ marginLeft: 'auto', padding: '0.32rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', flexShrink: 0 }}>
                <RefreshCw size={13} color='#64748b' style={{ animation: loading ? 'gis-spin 0.8s linear infinite' : 'none' }} />
              </button>
            </div>

            {/* Map area */}
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
                  ? 'Utilization from harvest records. Targets: Hybrid 5,000 · Certified 4,000 · Farmer saved 3,000 kg/ha'
                  : 'Crop phase data from AT monitoring visits. Updates in real-time.'}
              </span>
            </div>
          </div>

          {/* RIGHT — Panel (same as admin) */}
          <div style={{ width: 'clamp(280px, 22vw, 330px)', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(15,23,42,.08)', overflow: 'hidden', minHeight: 0, height: '100%' }}>
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
            <div style={{ flex: 1, overflowY: activeBarangay || activeTab === 'utilization' ? 'auto' : 'hidden', display: 'flex', flexDirection: 'column', paddingTop: activeBarangay ? 0 : activeTab === 'monitoring' ? '1.25rem' : 0, minHeight: 0 }} className='gis-panel-scroll'>
              <PanelBody />
            </div>
            <PanelFooter activeTab={activeTab} />
          </div>
        </div>
      )}

      {/* ── MOBILE: full-screen map + bottom sheet (same as admin) ── */}
      {isMobile && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Tab switcher pill */}
          {!mobileSheet && (
            <div style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500, display: 'flex', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '999px', padding: '0.2rem', gap: '0.2rem', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
              <button onClick={() => handleTabChange('monitoring')} style={{ padding: '0.4rem 0.875rem', borderRadius: '999px', border: 'none', backgroundColor: activeTab === 'monitoring' ? '#1a4d1a' : 'transparent', color: activeTab === 'monitoring' ? 'white' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' }}>
                <Activity size={13} /> Monitoring
              </button>
              <button onClick={() => handleTabChange('utilization')} style={{ padding: '0.4rem 0.875rem', borderRadius: '999px', border: 'none', backgroundColor: activeTab === 'utilization' ? '#1a4d1a' : 'transparent', color: activeTab === 'utilization' ? 'white' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' }}>
                <TrendingUp size={13} /> Utilization
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.85)' }}>
              <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'gis-spin 0.8s linear infinite' }} />
            </div>
          )}

          {/* Bottom sheet */}
          {mobileSheet && (
            <>
              <div onClick={() => setMobileSheet(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 700 }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 800, backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0', maxHeight: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,.14)', animation: 'gis-sheetUp 0.35s cubic-bezier(0.34,1.1,0.64,1)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div style={{ width: 44, height: 4, backgroundColor: '#e2e8f0', borderRadius: '999px', margin: '0.875rem auto', flexShrink: 0 }} />
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: activeBarangay ? 0 : '0.5rem' }} className='gis-panel-scroll'>
                  <PanelBody />
                </div>
                <PanelFooter activeTab={activeTab} />
              </div>
            </>
          )}

          {/* FAB */}
          {!mobileSheet && (
            <button onClick={() => setMobileSheet(true)} style={{ position: 'absolute', bottom: '1.5rem', right: '1rem', zIndex: 600, backgroundColor: '#1a4d1a', color: 'white', border: 'none', borderRadius: '999px', padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {activeTab === 'utilization' ? <TrendingUp size={16} /> : <Activity size={16} />}
              Overview
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── ATGisMap wrapper ──────────────────────────────────────────
const ATGisMap = () => {
  const [assignedBarangays, setAssignedBarangays] = useState(null);
  const [activePoll,        setActivePoll]        = useState(null);

  useEffect(() => {
    Promise.allSettled([
      API.get('/accounts/me/'),
      getGisActivePoll(),
    ]).then(([meRes, pollRes]) => {
      if (meRes.status === 'fulfilled') {
        const data = meRes.value.data;
        const raw  = data?.assigned_barangays || (data?.barangay ? [data.barangay] : []);
        setAssignedBarangays(Array.isArray(raw) ? raw.filter(Boolean) : [raw].filter(Boolean));
      } else {
        setAssignedBarangays([]);
      }
      if (pollRes.status === 'fulfilled') setActivePoll(pollRes.value.data);
    });
  }, []);

  if (assignedBarangays === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 24, height: 24, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return <RoleGisMap assignedBarangays={assignedBarangays} roleLabel="Agricultural Technician" pollId={activePoll?.poll_id || null} />;
};

export default ATGisMap;