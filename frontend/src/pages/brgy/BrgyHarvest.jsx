// src/pages/brgy/BrgyHarvest.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, Plus, Edit3, Trash2, BarChart3,
  Users, Layers, ShieldCheck, CheckCircle2,
  AlertTriangle, Sun, X, Trophy, ChevronRight,
  History, ChevronLeft, ChevronDown,
} from 'lucide-react';
import API from '../../api/axios';

// ─── CONSTANTS ────────────────────────────────────────────────
const GREEN = {
  primary: '#1a4d1a',
  light:   '#f0fdf4',
  border:  '#bbf7d0',
  accent:  '#166534',
  soft:    '#dcfce7',
};

const SEED_SOURCES = [
  {
    key: 'HYBRID',
    label: 'Hybrid seeds',
    sublabel: 'Gov. program (NRP/RFO)',
    color: '#1a4d1a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    density_kg_ha: 15,
    target_yield_kg_ha: 5000,
    bags_per_ha: 1,
  },
  {
    key: 'INBRED',
    label: 'Certified seeds',
    sublabel: 'Gov. program (PhilRice)',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    density_kg_ha: 40,
    target_yield_kg_ha: 4000,
    bags_per_ha: 2,
  },
  {
    key: 'OWN_SEED',
    label: 'Farmer saved seeds',
    sublabel: "Farmer's own stock",
    color: '#b45309',
    bg: '#fefce8',
    border: '#fde68a',
    density_kg_ha: 50,
    target_yield_kg_ha: 3000,
    bags_per_ha: null,
  },
];

const getSeedCfg = (key) => SEED_SOURCES.find(s => s.key === key) || SEED_SOURCES[2];

const getSeedIcon = (key) => {
  if (key === 'HYBRID') return Layers;
  if (key === 'INBRED') return ShieldCheck;
  return Sun;
};

const getUtilTier = (pct) => {
  if (pct === null || pct === undefined)
    return { label: 'N/A', color: '#94a3b8', bg: '#f9fafb', border: '#e5e7eb', icon: null };
  if (pct > 100)
    return { label: 'Exceeded Target', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', icon: <Trophy size={12} /> };
  if (pct >= 80)
    return { label: 'Achieved Target', color: '#15803d', bg: '#dcfce7', border: '#86efac', icon: <CheckCircle2 size={12} /> };
  if (pct >= 70)
    return { label: 'Near Target', color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe', icon: <AlertTriangle size={12} /> };
  if (pct >= 50)
    return { label: 'Below Target', color: '#b45309', bg: '#fefce8', border: '#fde68a', icon: <AlertTriangle size={12} /> };
  return { label: 'Critical', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', icon: <X size={12} /> };
};

const computeMetrics = (rec) => {
  const bags        = parseFloat(rec.harvest_bags) || 0;
  const area        = parseFloat(rec.harvest_area_ha) || 0;
  const harvest_kg  = bags * 50;
  const harvest_mt  = harvest_kg / 1000;
  const yield_t_ha  = area > 0 ? harvest_mt / area : 0;
  const cfg         = getSeedCfg(rec.seed_source);
  const expected_kg = area * cfg.target_yield_kg_ha;
  const utilization_pct = expected_kg > 0 ? (harvest_kg / expected_kg) * 100 : null;
  return { harvest_kg, harvest_mt, yield_t_ha, expected_kg, utilization_pct };
};

const fmtNum = (n, d = 2) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : '—';

const today = () => new Date().toISOString().split('T')[0];

// ─── TOAST SYSTEM ─────────────────────────────────────────────
const Toast = ({ toasts }) => (
  <div style={{
    position: 'fixed', bottom: '5.5rem', left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999, display: 'flex', flexDirection: 'column',
    gap: '0.5rem', alignItems: 'center', pointerEvents: 'none',
  }}>
    {toasts.map(t => {
      const Icon = t.type === 'success' ? CheckCircle2 : AlertTriangle;
      const bg   = t.type === 'success' ? GREEN.primary
                 : t.type === 'warning' ? '#92400e' : '#991b1b';
      return (
        <div key={t.id} style={{
          backgroundColor: bg, color: 'white',
          padding: '0.75rem 1.25rem', borderRadius: '999px',
          fontSize: '0.85rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '0.55rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
          animation: 'toastPop 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          maxWidth: 'calc(100vw - 2rem)',
        }}>
          <Icon size={16} />
          {t.msg}
        </div>
      );
    })}
  </div>
);

// ─── METRIC CARD ─────────────────────────────────────────────
const MetricCard = ({ icon: Icon, label, value, sub, color }) => (
  <div style={{
    backgroundColor: 'white', borderRadius: '1rem',
    padding: '1rem 1.1rem', border: '1px solid #e2e8f0',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.375rem' }}>
      <Icon size={14} color={color || '#94a3b8'} />
      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
    </div>
    <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: color || '#0f172a', lineHeight: 1 }}>
      {value}
    </p>
    {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.68rem', color: '#64748b' }}>{sub}</p>}
  </div>
);

// ─── HARVEST FORM ─────────────────────────────────────────────
const EMPTY_TAB_FORM = () => ({
  variety: '',
  harvest_area_ha: '',
  harvest_bags: '',
  harvest_date: today(),
  seed_bags_received: '',
  notes: '',
});

const HarvestForm = ({
  harvestingFarmers,   // array from new API — farmers with HARVESTING phase
  onSave,
  onClose,
  saving,
  editData,
  finalSeeds,
  beneficiaryData,
}) => {
  const [farmerId, setFarmerId]             = useState(editData?.farmer_id || '');
  const [farmerSearch, setFarmerSearch]     = useState('');
  const [showFarmerList, setShowFarmerList] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    if (editData?.seed_source) return editData.seed_source;
    // Auto-select first harvesting seed type if available
    if (harvestingFarmers.length === 0) return 'HYBRID';
    return 'HYBRID'; // will be overridden when farmer is selected
  });

  const [tabForms, setTabForms] = useState(() => {
    const base = {
      HYBRID:   EMPTY_TAB_FORM(),
      INBRED:   EMPTY_TAB_FORM(),
      OWN_SEED: EMPTY_TAB_FORM(),
    };
    if (editData) {
      base[editData.seed_source] = {
        variety:            editData.variety            || '',
        harvest_area_ha:    editData.harvest_area_ha    || '',
        harvest_bags:       editData.harvest_bags        || '',
        harvest_date:       editData.harvest_date        || today(),
        seed_bags_received: editData.seed_bags_received || '',
        notes:              editData.notes               || '',
      };
    }
    return base;
  });

  const [encodedTabs, setEncodedTabs] = useState(
    editData ? { [editData.seed_source]: editData.id } : {}
  );
  const [tabErrors, setTabErrors] = useState({ HYBRID: {}, INBRED: {}, OWN_SEED: {} });
  const [showHighUtilConfirm, setShowHighUtilConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit]             = useState(null);

  // Selected farmer object from harvestingFarmers
  const selectedFarmer = farmerId
    ? harvestingFarmers.find(f => String(f.id) === String(farmerId))
    : null;

  // Which seed types are in HARVESTING for selected farmer
  const harvestingSeedTypes = selectedFarmer?.harvesting_seed_types || [];
  const areaBySeeedType     = selectedFarmer?.area_by_seed_type || {};

  // Auto-fill farmer search text
  useEffect(() => {
    if (selectedFarmer) {
      setFarmerSearch(
        `${selectedFarmer.last_name}, ${selectedFarmer.first_name} · ${selectedFarmer.rsbsa_number || 'No RSBSA'}`
      );
    }
  }, [selectedFarmer]);

  // Auto-fill area from AT's area_monitored_ha when farmer or tab changes
  useEffect(() => {
    if (!farmerId || !selectedFarmer) return;

    SEED_SOURCES.forEach(s => {
      const atArea = areaBySeeedType[s.key];
      if (!atArea) return;
      setTabForms(prev => {
        const current = prev[s.key];
        if (current.harvest_area_ha) return prev; // don't overwrite if already typed
        return {
          ...prev,
          [s.key]: { ...current, harvest_area_ha: String(atArea) },
        };
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmerId]);

  // Also auto-fill seed_bags_received from beneficiary data
  useEffect(() => {
    if (!farmerId || !beneficiaryData) return;
    const farmerBenefData = beneficiaryData[farmerId];
    if (!farmerBenefData) return;
    SEED_SOURCES.forEach(s => {
      if (s.key === 'OWN_SEED') return;
      const entry = farmerBenefData[s.key];
      if (!entry) return;
      setTabForms(prev => {
        const current = prev[s.key];
        if (current.seed_bags_received) return prev;
        return {
          ...prev,
          [s.key]: { ...current, seed_bags_received: entry.seed_bags != null ? String(entry.seed_bags) : '' },
        };
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmerId, beneficiaryData]);

  const getVarietiesForTab = (tabKey) => {
    if (tabKey === 'OWN_SEED') return [];
    const typeNameMap = { HYBRID: 'hybrid', INBRED: 'inbred' };
    const needle = typeNameMap[tabKey];
    const found = finalSeeds.find(fs =>
      fs.seed_type?.name?.toLowerCase().includes(needle)
    );
    return found?.varieties || [];
  };

  const filteredFarmers = useMemo(() => {
    const q = farmerSearch.trim().toLowerCase();
    if (!q) return harvestingFarmers;

    // Split query into tokens — handles "Rivera, Christine",
    // "Christine Rivera", "rivera christine", etc.
    const tokens = q.replace(/,/g, ' ').split(/\s+/).filter(Boolean);

    return harvestingFarmers.filter(f => {
      const haystack = [f.first_name, f.last_name, f.rsbsa_number]
        .join(' ').toLowerCase();
      return tokens.every(t => haystack.includes(t));
    });
  }, [harvestingFarmers, farmerSearch]);

  const selectFarmer = (farmer) => {
    setFarmerId(String(farmer.id));
    setFarmerSearch(`${farmer.last_name}, ${farmer.first_name} · ${farmer.rsbsa_number || 'No RSBSA'}`);
    setShowFarmerList(false);
    // Auto-switch to first available harvesting seed type
    const firstAllowed = farmer.harvesting_seed_types?.[0];
    if (firstAllowed) {
      setActiveTab(firstAllowed);
    }
  };

  const setField = (field, val) => {
    setTabForms(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: val },
    }));
    setTabErrors(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: '' },
    }));
  };

  const form      = tabForms[activeTab];
  const errors    = tabErrors[activeTab];
  const cfg       = getSeedCfg(activeTab);
  const varieties = getVarietiesForTab(activeTab);

  const bags        = parseFloat(form.harvest_bags) || 0;
  const area        = parseFloat(form.harvest_area_ha) || 0;
  const harvest_kg  = bags * 50;
  const harvest_mt  = harvest_kg / 1000;
  const yield_t_ha  = area > 0 ? harvest_mt / area : 0;
  const expected_kg = area > 0 ? area * cfg.target_yield_kg_ha : 0;
  const util_pct    = expected_kg > 0 ? (harvest_kg / expected_kg) * 100 : null;
  const tier        = getUtilTier(util_pct);

  // Check if a seed type tab is allowed (farmer has HARVESTING for it)
  const isTabAllowed = (tabKey) => {
    if (!farmerId) return true; // before farmer selected, all tabs are visually accessible
    return harvestingSeedTypes.includes(tabKey);
  };

  const inp = (err) => ({
    padding: '0.625rem 0.875rem',
    border: `1.5px solid ${err ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem',
    width: '100%', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    backgroundColor: 'white',
  });

  const validateTab = (tabKey) => {
    const f = tabForms[tabKey];
    const e = {};
    if (!farmerId) e.farmer_id = 'Please select a farmer';
    if (!isTabAllowed(tabKey)) e.seed_source = 'Farmer has no HARVESTING phase for this seed type';
    if (!f.variety?.trim()) e.variety = 'Variety name is required';
    if (!f.harvest_area_ha || parseFloat(f.harvest_area_ha) <= 0)
      e.harvest_area_ha = 'Area harvested must be greater than 0';
    if (parseFloat(f.harvest_area_ha) > 50)
      e.harvest_area_ha = 'Area seems too large (max 50 ha)';
    if (!f.harvest_bags || parseFloat(f.harvest_bags) <= 0)
      e.harvest_bags = 'Number of bags must be greater than 0';
    if (parseFloat(f.harvest_bags) > 5000)
      e.harvest_bags = 'Bag count seems too large';
    if (!f.harvest_date) e.harvest_date = 'Harvest date is required';
    return e;
  };

  const tabHasData = (tabKey) => {
    const f = tabForms[tabKey];
    return !!(f.harvest_bags || f.variety || f.harvest_area_ha);
  };

  const handleSaveCurrentTab = () => {
    const e = validateTab(activeTab);
    if (Object.keys(e).length) {
      setTabErrors(prev => ({ ...prev, [activeTab]: e }));
      return;
    }
    const f      = tabForms[activeTab];
    const bags_n = parseFloat(f.harvest_bags) || 0;
    const area_n = parseFloat(f.harvest_area_ha) || 0;
    const hkg    = bags_n * 50;
    const expKg  = area_n * cfg.target_yield_kg_ha;
    const upct   = expKg > 0 ? (hkg / expKg) * 100 : null;
    if (upct !== null && upct > 300) {
      setPendingSubmit({ tabKey: activeTab, form: f });
      setShowHighUtilConfirm(true);
      return;
    }
    doSave(activeTab, f);
  };

  const doSave = (tabKey, f) => {
    const payload = {
      farmer_id:          farmerId,
      seed_source:        tabKey,
      variety:            f.variety,
      harvest_area_ha:    f.harvest_area_ha,
      harvest_bags:       f.harvest_bags,
      harvest_date:       f.harvest_date,
      seed_bags_received: tabKey === 'OWN_SEED' ? '' : f.seed_bags_received,
      notes:              f.notes,
      _tab:               tabKey,
      _existing_id:       encodedTabs[tabKey] || null,
    };
    onSave(payload, (savedId) => {
      setEncodedTabs(prev => ({ ...prev, [tabKey]: savedId }));
    });
  };

  const confirmHighUtil = () => {
    setShowHighUtilConfirm(false);
    doSave(pendingSubmit.tabKey, pendingSubmit.form);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '1rem' }}>

      {/* ── FARMER SEARCH ── */}
      <div style={{ position: 'relative' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
          Farmer <span style={{ color: '#dc2626' }}>*</span>
        </label>
        {/* Helper note */}
        <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <AlertTriangle size={11} color='#f59e0b' />
          Only farmers with <strong style={{ color: GREEN.accent }}>Harvesting</strong> phase (encoded by AT) appear here.
        </p>
        <div style={{ position: 'relative' }}>
          <Search size={15} color='#9ca3af'
            style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type='text'
            value={farmerSearch}
            onChange={e => { setFarmerSearch(e.target.value); setFarmerId(''); setShowFarmerList(true); setActiveTab('HYBRID'); }}
            onFocus={() => setShowFarmerList(true)}
            onBlur={() => setTimeout(() => setShowFarmerList(false), 130)}
            placeholder='Search by name or RSBSA'
            style={{ ...inp(!!tabErrors.HYBRID?.farmer_id), paddingLeft: '2.5rem' }}
          />
        </div>

        {/* Farmer dropdown */}
        {showFarmerList && filteredFarmers.length > 0 && (
          <div style={{
            position: 'absolute', zIndex: 50, width: '100%', maxHeight: 210,
            overflowY: 'auto', marginTop: 6, backgroundColor: 'white',
            border: '1px solid #e5e7eb', borderRadius: '0.875rem',
            boxShadow: '0 12px 28px rgba(15,23,42,0.1)',
          }}>
            {filteredFarmers.slice(0, 10).map(farmer => (
              <button key={farmer.id} type='button' onClick={() => selectFarmer(farmer)}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
                  border: 'none', borderBottom: '1px solid #f3f4f6',
                  backgroundColor: 'transparent', cursor: 'pointer',
                }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                  {farmer.last_name}, {farmer.first_name}
                </p>
                <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                  {farmer.rsbsa_number || 'No RSBSA'} · {farmer.barangay}
                </p>
                {/* Show which seed types are in HARVESTING */}
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {farmer.harvesting_seed_types.map(key => {
                    const s = getSeedCfg(key);
                    return (
                      <span key={key} style={{
                        fontSize: '0.6rem', fontWeight: 700,
                        backgroundColor: s.bg, color: s.color,
                        border: `1px solid ${s.border}`,
                        borderRadius: '999px', padding: '0.1rem 0.4rem',
                      }}>
                        {s.label}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty state — no harvesting farmers */}
        {showFarmerList && farmerSearch.trim() && filteredFarmers.length === 0 && (
          <div style={{
            position: 'absolute', zIndex: 50, width: '100%', marginTop: 6,
            backgroundColor: 'white', border: '1px solid #e5e7eb',
            borderRadius: '0.875rem', padding: '1rem',
            boxShadow: '0 12px 28px rgba(15,23,42,0.1)',
          }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
              No farmer found with HARVESTING phase.
            </p>
          </div>
        )}

        {tabErrors.HYBRID?.farmer_id && (
          <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.375rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={12} /> {tabErrors.HYBRID.farmer_id}
          </p>
        )}
      </div>

      {/* ── SEED SOURCE TABS ── */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.625rem' }}>
          Seed source / program <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {SEED_SOURCES.map(s => {
            const isActive   = activeTab === s.key;
            const isEncoded  = !!encodedTabs[s.key];
            const hasData    = tabHasData(s.key);
            const isAllowed  = isTabAllowed(s.key);
            const isDisabled = farmerId && !isAllowed; // disabled only after farmer is selected

            return (
              <button key={s.key} type='button'
                onClick={() => {
                  if (isDisabled) return;
                  setActiveTab(s.key);
                }}
                disabled={isDisabled}
                title={isDisabled ? `${selectedFarmer?.first_name} has no HARVESTING phase for ${s.label}` : ''}
                style={{
                  border: `2px solid ${
                    isDisabled  ? '#e2e8f0'
                    : isActive  ? s.color
                    : isEncoded ? s.color + '80'
                    : '#e2e8f0'
                  }`,
                  borderRadius: '0.875rem',
                  backgroundColor: isDisabled
                    ? '#f9fafb'
                    : isActive
                    ? s.bg
                    : isEncoded
                    ? s.bg + '60'
                    : 'white',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  padding: '0.75rem 0.4rem',
                  textAlign: 'center',
                  transition: 'all 0.18s',
                  position: 'relative',
                  opacity: isDisabled ? 0.45 : 1,
                }}>
                {isEncoded && (
                  <div style={{
                    position: 'absolute', top: -8, right: -8,
                    backgroundColor: s.color, borderRadius: '999px',
                    width: 18, height: 18, display: 'grid', placeItems: 'center',
                    border: '2px solid white',
                  }}>
                    <CheckCircle2 size={10} color='white' />
                  </div>
                )}
                {!isEncoded && hasData && !isDisabled && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    backgroundColor: '#f59e0b', borderRadius: '999px',
                    width: 12, height: 12, border: '2px solid white',
                  }} />
                )}
                <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: isDisabled ? '#9ca3af' : isActive ? s.color : '#374151' }}>
                  {s.label}
                </p>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.6rem', color: isDisabled ? '#d1d5db' : isActive ? s.color : '#94a3b8', fontWeight: 600 }}>
                  {isDisabled ? 'Not harvesting' : s.sublabel}
                </p>
                {isEncoded && (
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.58rem', color: s.color, fontWeight: 700 }}>
                    ✓ Saved
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB CONTENT PANEL ── */}
      <div style={{
        border: `1.5px solid ${cfg.border}`,
        borderRadius: '1rem', padding: '1rem',
        backgroundColor: cfg.bg + '40',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          {(() => { const Icon = getSeedIcon(activeTab); return <Icon size={16} color={cfg.color} />; })()}
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: cfg.color }}>
            {cfg.label} — {cfg.sublabel}
          </span>
          {encodedTabs[activeTab] && (
            <span style={{
              backgroundColor: cfg.color, color: 'white',
              fontSize: '0.6rem', fontWeight: 700,
              padding: '0.1rem 0.5rem', borderRadius: '999px',
            }}>
              Already saved — editing will update
            </span>
          )}
        </div>

        {/* Rice Variety */}
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Rice variety <span style={{ color: '#dc2626' }}>*</span>
          </label>
          {activeTab !== 'OWN_SEED' && varieties.length > 0 ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {varieties.map(v => {
                const sel = form.variety === v.name;
                return (
                  <button key={v.id} type='button'
                    onClick={() => setField('variety', v.name)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: `2px solid ${sel ? cfg.color : '#e2e8f0'}`,
                      borderRadius: '0.75rem',
                      backgroundColor: sel ? cfg.bg : 'white',
                      color: sel ? cfg.color : '#374151',
                      fontWeight: sel ? 700 : 500,
                      fontSize: '0.82rem', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                    {sel && <CheckCircle2 size={11} style={{ display: 'inline', marginRight: '0.25rem' }} />}
                    {v.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <input type='text'
              placeholder={activeTab === 'OWN_SEED' ? 'Enter rice variety name' : 'e.g. NSIC Rc 222, PSB Rc 22'}
              value={form.variety}
              onChange={e => setField('variety', e.target.value)}
              style={inp(!!errors.variety)} />
          )}
          {errors.variety && (
            <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={12} /> {errors.variety}
            </p>
          )}
        </div>

        {/* Area Harvested */}
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Area harvested (ha) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type='number' step='0.01' min='0.01' max='50'
            placeholder='e.g. 0.50'
            value={form.harvest_area_ha}
            onChange={e => setField('harvest_area_ha', e.target.value)}
            style={inp(!!errors.harvest_area_ha)} />
          {/* Auto-fill hint from AT monitoring */}
          {farmerId && areaBySeeedType[activeTab] && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.68rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ChevronRight size={11} color='#64748b' />
              Auto-filled from AT monitoring ({areaBySeeedType[activeTab]} ha)
            </p>
          )}
          {errors.harvest_area_ha && (
            <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={12} /> {errors.harvest_area_ha}
            </p>
          )}
        </div>

        {/* Harvest Bags */}
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Harvest bags <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8' }}>(50 kg/bag)</span>{' '}
            <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type='number' step='1' min='1'
            placeholder='e.g. 80'
            value={form.harvest_bags}
            onChange={e => setField('harvest_bags', e.target.value)}
            style={inp(!!errors.harvest_bags)} />
          {bags > 0 && (
            <div style={{
              marginTop: '0.5rem', padding: '0.5rem 0.75rem',
              backgroundColor: 'white', border: `1px solid ${cfg.border}`,
              borderRadius: '0.625rem', fontSize: '0.78rem', color: '#475569',
              display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap',
            }}>
              <span style={{ fontWeight: 700, color: cfg.color }}>{fmtNum(harvest_kg, 0)} kg</span>
              <span style={{ color: '#94a3b8' }}>= {bags} bags × 50 kg/bag</span>
              <span style={{ color: '#94a3b8' }}>·</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmtNum(harvest_mt)} MT</span>
            </div>
          )}
          {errors.harvest_bags && (
            <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={12} /> {errors.harvest_bags}
            </p>
          )}
        </div>

        {/* Live Metrics Preview */}
        {bags > 0 && (
          <div style={{
            backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`,
            borderRadius: '1rem', padding: '1rem', marginBottom: '0.875rem',
          }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Live harvest metrics preview
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: area > 0 ? '0.75rem' : 0 }}>
              {[
                { label: 'Harvest weight', value: `${fmtNum(harvest_kg, 0)} kg` },
                { label: 'Production',     value: `${fmtNum(harvest_mt)} MT`   },
                { label: 'Avg. yield',     value: area > 0 ? `${fmtNum(yield_t_ha)} t/ha` : '—' },
              ].map(m => (
                <div key={m.label} style={{
                  backgroundColor: 'white', borderRadius: '0.5rem',
                  padding: '0.5rem 0.625rem', textAlign: 'center',
                  border: `1px solid ${GREEN.border}`,
                }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: GREEN.accent }}>{m.value}</p>
                  <p style={{ margin: 0, fontSize: '0.6rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</p>
                </div>
              ))}
            </div>
            {area > 0 && (() => {
              const tierLocal = getUtilTier(util_pct);
              return (
                <div style={{
                  backgroundColor: 'white', borderRadius: '0.625rem',
                  padding: '0.75rem 0.875rem', border: `1px solid ${tierLocal.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.6 }}>
                      <p style={{ margin: 0 }}>Target yield: <strong style={{ color: '#0f172a' }}>{fmtNum(cfg.target_yield_kg_ha, 0)} kg/ha</strong></p>
                      <p style={{ margin: 0 }}>Expected: <strong style={{ color: '#0f172a' }}>{fmtNum(expected_kg, 0)} kg</strong></p>
                      <p style={{ margin: 0 }}>Actual: <strong style={{ color: '#0f172a' }}>{fmtNum(harvest_kg, 0)} kg</strong></p>
                    </div>
                    {util_pct !== null && (
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: tierLocal.color, lineHeight: 1 }}>
                          {fmtNum(util_pct, 1)}%
                        </p>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          marginTop: '0.25rem', backgroundColor: tierLocal.bg, color: tierLocal.color,
                          border: `1px solid ${tierLocal.border}`, borderRadius: '999px',
                          padding: '0.15rem 0.625rem', fontSize: '0.65rem', fontWeight: 700,
                        }}>
                          {tierLocal.icon} {tierLocal.label}
                        </span>
                      </div>
                    )}
                  </div>
                  {util_pct !== null && (
                    <div>
                      <div style={{ height: 7, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, util_pct)}%`, backgroundColor: tierLocal.color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        <span>0%</span><span>Target (100%)</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Harvest Date + Seed Bags Received */}
        <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'OWN_SEED' ? '1fr' : '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
              Harvest date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            {/* NO max= restriction — para sa demo */}
            <input type='date' value={form.harvest_date}
              onChange={e => setField('harvest_date', e.target.value)}
              style={inp(!!errors.harvest_date)} />
            {errors.harvest_date && (
              <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertTriangle size={12} /> {errors.harvest_date}
              </p>
            )}
          </div>
          {activeTab !== 'OWN_SEED' && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
                Seed bags received{' '}
                <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8' }}>(from distribution)</span>
              </label>
              <input type='number' step='1' min='0'
                placeholder='bags received'
                value={form.seed_bags_received}
                onChange={e => setField('seed_bags_received', e.target.value)}
                style={inp(false)} />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Notes / remarks{' '}
            <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
          </label>
          <textarea rows={3} value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            placeholder='Field observations, pest issues, weather conditions...'
            style={{ ...inp(false), resize: 'vertical', minHeight: 70 }} />
        </div>
      </div>

      {/* Save Button */}
      <button onClick={handleSaveCurrentTab} disabled={saving}
        style={{
          width: '100%', padding: '1rem',
          backgroundColor: saving ? '#d1d5db' : cfg.color,
          color: 'white', border: 'none', borderRadius: '1rem',
          fontWeight: 800, fontSize: '1rem',
          cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          boxShadow: saving ? 'none' : `0 8px 24px ${cfg.color}40`,
          transition: 'all 0.2s',
        }}>
        <CheckCircle2 size={18} />
        {saving ? 'Saving...' : encodedTabs[activeTab] ? `Update ${cfg.label} record` : `Save ${cfg.label} record`}
      </button>

      {/* Saved tabs summary */}
      {Object.keys(encodedTabs).length > 0 && (
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '0.875rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Saved records this session
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {Object.entries(encodedTabs).map(([key]) => {
              const s = getSeedCfg(key);
              return (
                <span key={key} style={{
                  backgroundColor: s.bg, color: s.color,
                  border: `1px solid ${s.border}`, borderRadius: '999px',
                  padding: '0.2rem 0.625rem', fontSize: '0.68rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                }}>
                  <CheckCircle2 size={10} /> {s.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* High util confirm dialog */}
      {showHighUtilConfirm && pendingSubmit && (() => {
        const f      = pendingSubmit.form;
        const pCfg   = getSeedCfg(pendingSubmit.tabKey);
        const pBags  = parseFloat(f.harvest_bags) || 0;
        const pArea  = parseFloat(f.harvest_area_ha) || 0;
        const pHkg   = pBags * 50;
        const pExpKg = pArea * pCfg.target_yield_kg_ha;
        const pUpct  = pExpKg > 0 ? (pHkg / pExpKg) * 100 : null;
        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.5rem', maxWidth: 360, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: '#fef9c3', display: 'grid', placeItems: 'center', margin: '0 auto 0.875rem' }}>
                <AlertTriangle size={26} color='#b45309' />
              </div>
              <h3 style={{ margin: '0 0 0.5rem', fontWeight: 800, fontSize: '1rem', color: '#111827', textAlign: 'center' }}>
                Very high yield detected
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#64748b', textAlign: 'center', lineHeight: 1.6 }}>
                This harvest shows <strong>{fmtNum(pUpct, 1)}%</strong> of target — significantly above expected yield. Please confirm data is correct.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setShowHighUtilConfirm(false)}
                  style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', backgroundColor: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
                  Review
                </button>
                <button onClick={confirmHighUtil}
                  style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '0.875rem', backgroundColor: GREEN.primary, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
                  Yes, correct
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── HARVEST RECORD ROW ────────────────────────────────────────
const HarvestRow = ({ rec, idx, total, onEdit, onDelete }) => {
  const m       = computeMetrics(rec);
  const seedCfg = getSeedCfg(rec.seed_source);
  const tier    = getUtilTier(m.utilization_pct);
  const SeedIcon = getSeedIcon(rec.seed_source);
  return (
    <div style={{
      padding: '0.875rem 1.25rem',
      borderBottom: idx < total - 1 ? '1px solid #f1f5f9' : 'none',
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        backgroundColor: `${seedCfg.color}15`, border: `1.5px solid ${seedCfg.color}`,
        display: 'grid', placeItems: 'center', color: seedCfg.color,
      }}>
        <SeedIcon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{rec.farmer_name}</p>
          <span style={{ backgroundColor: seedCfg.bg, color: seedCfg.color, border: `1px solid ${seedCfg.border}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700 }}>
            {seedCfg.label}
          </span>
          {m.utilization_pct !== null && (
            <span style={{ backgroundColor: tier.bg, color: tier.color, border: `1px solid ${tier.border}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              {tier.icon} {fmtNum(m.utilization_pct, 1)}% · {tier.label}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569' }}>{rec.variety} · {rec.harvest_date}</p>
        <div style={{ display: 'flex', gap: '0.875rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Area',   value: `${fmtNum(rec.harvest_area_ha)} ha` },
            { label: 'Bags',   value: fmtNum(rec.harvest_bags, 0)         },
            { label: 'Weight', value: `${fmtNum(m.harvest_kg, 0)} kg`     },
            { label: 'MT',     value: fmtNum(m.harvest_mt)                },
            { label: 't/ha',   value: fmtNum(m.yield_t_ha)                },
          ].map(s => (
            <span key={s.label} style={{ fontSize: '0.72rem', color: '#64748b' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{s.value}</span> {s.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
        <button onClick={() => onEdit(rec)}
          style={{ padding: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.625rem', cursor: 'pointer', color: '#475569' }}>
          <Edit3 size={14} />
        </button>
        <button onClick={() => onDelete(rec.id)}
          style={{ padding: '0.5rem', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '0.625rem', cursor: 'pointer', color: '#dc2626' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── HISTORY VIEW ──────────────────────────────────────────────
const HarvestHistory = ({ onBack, pushToast }) => {
  const [polls,           setPolls]           = useState([]);
  const [selectedPoll,    setSelectedPoll]    = useState('');
  const [seasonFilter,    setSeasonFilter]    = useState('');
  const [seasonYearFilter, setSeasonYearFilter] = useState('');
  const [records,         setRecords]         = useState([]);
  const [pollInfo,        setPollInfo]        = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [histLoading,     setHistLoading]     = useState(false);
  const [search,          setSearch]          = useState('');
  const [filterSeed,      setFilterSeed]      = useState('');

  // Load polls list on mount
  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const res = await API.get('/production/harvest-history/');
        setPolls(res.data.polls || []);
      } catch {
        pushToast('Failed to load season list.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchPolls();
  }, [pushToast]);

  // Load records when poll selected
  useEffect(() => {
    if (!selectedPoll) { setRecords([]); setPollInfo(null); return; }
    const fetchRecords = async () => {
      setHistLoading(true);
      try {
        const params = { poll_id: selectedPoll };
        if (search)      params.search      = search;
        if (filterSeed)  params.seed_source = filterSeed;
        const res = await API.get('/production/harvest-history/', { params });
        setRecords(res.data.records || []);
        setPollInfo(res.data.poll_info || null);
      } catch {
        pushToast('Failed to load history records.', 'error');
      } finally {
        setHistLoading(false);
      }
    };
    fetchRecords();
  }, [selectedPoll, search, filterSeed, pushToast]);

  const activePoll = polls.find(p => p.is_active);

  // Summary metrics for history
  const total_area = records.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
  const total_mt   = records.reduce((s, r) => s + computeMetrics(r).harvest_mt, 0);
  const avg_yield  = total_area > 0 ? total_mt / total_area : 0;

  return (
    <div style={{ paddingBottom: '6rem' }}>
      {/* Back nav */}
      <div style={{ padding: '1.25rem 1.25rem 0' }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <ChevronLeft size={15} /> Back to Harvest Records
        </button>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.25rem' }}>
          Harvest History
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 1.25rem' }}>
          View past harvest records by season and year
        </p>

        {/* Filter bar */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid #f3f4f6', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.875rem' }}>
            Filter records
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Season pills */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.25rem' }}>
                Season:
              </span>
              {['', 'WET', 'DRY'].map(s => {
                const isActive = seasonFilter === s;
                return (
                  <button key={s} type='button'
                    onClick={() => {
                      setSeasonFilter(s);
                      if (!s) {
                        setSelectedPoll('');
                      } else if (seasonYearFilter) {
                        const found = polls.find(p => p.season === s && String(p.year) === String(seasonYearFilter));
                        setSelectedPoll(found ? String(found.id) : '');
                      }
                    }}
                    style={{
                      padding: '0.35rem 0.875rem',
                      border: `1.5px solid ${isActive ? (s === 'WET' ? '#0369a1' : s === 'DRY' ? '#b45309' : GREEN.primary) : '#e5e7eb'}`,
                      borderRadius: '999px',
                      backgroundColor: isActive ? (s === 'WET' ? '#e0f2fe' : s === 'DRY' ? '#fef3c7' : GREEN.light) : 'white',
                      color: isActive ? (s === 'WET' ? '#0369a1' : s === 'DRY' ? '#b45309' : GREEN.primary) : '#6b7280',
                      fontWeight: isActive ? 700 : 400,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}>
                    {s === '' ? 'All' : s === 'WET' ? 'Wet Season' : 'Dry Season'}
                  </button>
                );
              })}
            </div>

            {/* Year dropdown */}
            <div style={{ flex: '1 1 140px', minWidth: 140 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Year
              </label>
              <div style={{ position: 'relative' }}>
                <select value={seasonYearFilter} onChange={e => {
                    setSeasonYearFilter(e.target.value);
                    if (e.target.value && seasonFilter) {
                      const found = polls.find(p => p.season === seasonFilter && String(p.year) === String(e.target.value));
                      setSelectedPoll(found ? String(found.id) : '');
                    } else if (!e.target.value && !seasonFilter) {
                      setSelectedPoll('');
                    }
                  }}
                  disabled={loading}
                  style={{ width: '100%', padding: '0.625rem 2rem 0.625rem 0.875rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.85rem', color: '#111827', outline: 'none', backgroundColor: 'white', appearance: 'none', cursor: 'pointer' }}>
                  <option value=''>All years</option>
                  {[...new Set(polls.map(p => p.year))].sort((a, b) => b - a).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown size={14} color='#9ca3af' style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Seed type filter */}
            <div style={{ flex: '1 1 160px', minWidth: 160 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Seed type
              </label>
              <div style={{ position: 'relative' }}>
                <select value={filterSeed} onChange={e => setFilterSeed(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 2rem 0.625rem 0.875rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.85rem', color: '#111827', outline: 'none', backgroundColor: 'white', appearance: 'none', cursor: 'pointer' }}>
                  <option value=''>All types</option>
                  {SEED_SOURCES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} color='#9ca3af' style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Search */}
            <div style={{ flex: '2 1 200px', minWidth: 200 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Search farmer
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={14} color='#9ca3af' style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder='Name, RSBSA, or variety...'
                  style={{ width: '100%', padding: '0.625rem 0.875rem 0.625rem 2.25rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }} />
              </div>
            </div>

            {/* Clear */}
            {(selectedPoll || seasonFilter || seasonYearFilter || filterSeed || search) && (
              <button onClick={() => { setSelectedPoll(''); setSeasonFilter(''); setSeasonYearFilter(''); setFilterSeed(''); setSearch(''); }}
                style={{ padding: '0.625rem 1rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', backgroundColor: 'white', color: '#6b7280', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>

          {/* Active season notice */}
          {selectedPoll && activePoll && String(selectedPoll) === String(activePoll.id) && (
            <div style={{ marginTop: '0.875rem', padding: '0.5rem 0.75rem', backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.5rem', fontSize: '0.72rem', color: GREEN.accent, fontWeight: 600 }}>
              ⚡ You are viewing the <strong>current active season</strong>. These are your live harvest records.
            </div>
          )}
        </div>

        {/* Summary cards — shown when poll selected and has records */}
        {selectedPoll && records.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { label: 'Records',       value: records.length,          color: '#0f172a'    },
              { label: 'Total area',    value: `${fmtNum(total_area)} ha`, color: GREEN.accent },
              { label: 'Production',    value: `${fmtNum(total_mt)} MT`,   color: '#2563eb'    },
              { label: 'Avg yield',     value: `${fmtNum(avg_yield)} t/ha`, color: '#7c3aed'   },
            ].map(m => (
              <div key={m.label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: m.color }}>{m.value}</p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Records table */}
      <div style={{ padding: '0 1.25rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #f3f4f6', overflow: 'hidden' }}>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 0.8fr 0.8fr 0.7fr', gap: 0, padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f3f4f6' }}>
            {['Farmer', 'Seed Type', 'Variety', 'Date', 'Area', 'MT', 'Util %'].map(col => (
              <span key={col} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col}</span>
            ))}
          </div>

          {/* States */}
          {histLoading ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
              <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>Loading records...</p>
            </div>
          ) : !selectedPoll ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: GREEN.light, border: `2px solid ${GREEN.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <History size={24} color={GREEN.accent} />
              </div>
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>Select a season to view records</p>
              <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>Use the season dropdown above to browse harvest history.</p>
            </div>
          ) : records.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <History size={28} color='#d1d5db' style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No records found</p>
              <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>No harvest records for this season and filter combination.</p>
            </div>
          ) : (
            records.map((rec, idx) => {
              const m    = computeMetrics(rec);
              const s    = getSeedCfg(rec.seed_source);
              const tier = getUtilTier(m.utilization_pct);
              return (
                <div key={rec.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 0.8fr 0.8fr 0.7fr', gap: 0, padding: '0.75rem 1.25rem', borderBottom: idx < records.length - 1 ? '1px solid #f9fafb' : 'none', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>{rec.farmer_name}</p>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.68rem', color: '#9ca3af' }}>{rec.barangay || ''}</p>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: s.color, backgroundColor: s.bg, padding: '0.15rem 0.5rem', borderRadius: '999px', border: `1px solid ${s.border}`, display: 'inline-block' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#374151' }}>{rec.variety || '—'}</span>
                  <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    {rec.harvest_date ? new Date(rec.harvest_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#374151' }}>{fmtNum(rec.harvest_area_ha)} ha</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#2563eb' }}>{fmtNum(m.harvest_mt)} MT</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: tier.color }}>
                    {m.utilization_pct !== null ? `${fmtNum(m.utilization_pct, 1)}%` : '—'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────
const BrgyHarvest = () => {
  const [records,          setRecords]          = useState([]);
  const [harvestingFarmers, setHarvestingFarmers] = useState([]); // farmers with HARVESTING phase
  const [finalSeeds,       setFinalSeeds]       = useState([]);
  const [beneficiaryData,  setBeneficiaryData]  = useState({});
  const [loading,          setLoading]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [deleting,         setDeleting]         = useState(null);

  const [showForm,    setShowForm]    = useState(false);
  const [editData,    setEditData]    = useState(null);
  const [confirmDel,  setConfirmDel]  = useState(null);
  const [showHistory, setShowHistory] = useState(false); // View History page

  const [search,     setSearch]     = useState('');
  const [filterSeed, setFilterSeed] = useState('');
  const [activeTab,  setActiveTab]  = useState('records');

  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const pushToast = useCallback((msg, type = 'success') => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [recordsRes, harvestingRes, finalSeedsRes, benefRes] = await Promise.allSettled([
        API.get('/production/harvest/'),
        API.get('/production/harvesting-farmers/'),      // NEW
        API.get('/seed-poll/final-seeds/'),
        API.get('/distribution/entries/farmer-harvest-context/'),
      ]);

      if (recordsRes.status === 'fulfilled') {
        const d = recordsRes.value.data;
        setRecords(Array.isArray(d) ? d : (d?.results || []));
      }
      if (harvestingRes.status === 'fulfilled') {
        const hData = harvestingRes.value.data;
        setHarvestingFarmers(hData?.farmers || []);
        // Debug: tanggalin mo ito kapag okay na
        console.log('[HarvestingFarmers] poll:', hData?.poll_id, '| count:', hData?.farmers?.length);
      }
      if (finalSeedsRes.status === 'fulfilled') {
        setFinalSeeds(finalSeedsRes.value.data || []);
      }
      if (benefRes.status === 'fulfilled') {
        setBeneficiaryData(benefRes.value.data || {});
      }
    } catch {
      pushToast('Failed to load data. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (formData, onSuccessCallback) => {
    setSaving(true);
    try {
      const payload = {
        farmer:          Number(formData.farmer_id),
        seed_source:     formData.seed_source,
        variety:         formData.variety,
        harvest_area_ha: parseFloat(formData.harvest_area_ha),
        harvest_bags:    parseInt(formData.harvest_bags, 10),
        harvest_date:    formData.harvest_date,
        notes:           formData.notes || '',
      };
      if (formData.seed_source !== 'OWN_SEED' && formData.seed_bags_received) {
        payload.seed_bags_received = parseInt(formData.seed_bags_received, 10) || null;
      }
      let savedId;
      if (formData._existing_id) {
        const res = await API.patch(`/production/harvest/${formData._existing_id}/`, payload);
        savedId = res.data.id;
        pushToast(`${getSeedCfg(formData.seed_source).label} record updated.`);
      } else {
        const res = await API.post('/production/harvest/', payload);
        savedId = res.data.id;
        pushToast(`${getSeedCfg(formData.seed_source).label} record saved.`);
      }
      if (onSuccessCallback) onSuccessCallback(savedId);
      await loadData();
    } catch (err) {
      const detail = err.response?.data;
      if (detail && typeof detail === 'object' && !detail.detail) {
        const [field, msg] = Object.entries(detail)[0];
        pushToast(`${field}: ${Array.isArray(msg) ? msg[0] : msg}`, 'error');
      } else {
        pushToast(detail?.detail || detail?.error || 'Failed to save. Please try again.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await API.delete(`/production/harvest/${id}/`);
      pushToast('Record deleted.');
      setConfirmDel(null);
      setRecords(p => p.filter(r => r.id !== id));
    } catch {
      pushToast('Failed to delete record.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = records.filter(r => {
    const q = search.trim().toLowerCase();
    if (q && !(r.farmer_name?.toLowerCase().includes(q) || r.variety?.toLowerCase().includes(q))) return false;
    if (filterSeed && r.seed_source !== filterSeed) return false;
    return true;
  });

  const total_area = records.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
  const total_bags = records.reduce((s, r) => s + (parseFloat(r.harvest_bags) || 0), 0);
  const total_mt   = records.reduce((s, r) => s + computeMetrics(r).harvest_mt, 0);
  const avg_yield  = total_area > 0 ? total_mt / total_area : 0;

  const seed_breakdown = SEED_SOURCES.map(s => {
    const group    = records.filter(r => r.seed_source === s.key);
    const area     = group.reduce((sum, r) => sum + (parseFloat(r.harvest_area_ha) || 0), 0);
    const mt       = group.reduce((sum, r) => sum + computeMetrics(r).harvest_mt, 0);
    const util_vals = group.map(r => computeMetrics(r).utilization_pct).filter(v => v !== null);
    const avg_util  = util_vals.length > 0 ? util_vals.reduce((a, b) => a + b, 0) / util_vals.length : null;
    return { ...s, count: group.length, area, mt, avg_util };
  });

  const openNew  = () => { setEditData(null); setShowForm(true); };
  const openEdit = (rec) => {
    setEditData({
      id:                 rec.id,
      farmer_id:          rec.farmer,
      seed_source:        rec.seed_source,
      variety:            rec.variety,
      harvest_area_ha:    rec.harvest_area_ha,
      harvest_bags:       rec.harvest_bags,
      harvest_date:       rec.harvest_date,
      seed_bags_received: rec.seed_bags_received || '',
      notes:              rec.notes || '',
    });
    setShowForm(true);
  };

  // ── HISTORY VIEW ──
  if (showHistory) {
    return (
      <div style={{ paddingBottom: '6rem' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes toastPop { 0%{opacity:0;transform:scale(0.88)} 70%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
          @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        `}</style>
        <Toast toasts={toasts} />
        <HarvestHistory onBack={() => setShowHistory(false)} pushToast={pushToast} />
      </div>
    );
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastPop { 0%{opacity:0;transform:scale(0.88)} 70%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideInBottom { 0%{transform:translateY(100%);opacity:0} 70%{transform:translateY(-6px);opacity:1} 100%{transform:translateY(0);opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      `}</style>
      <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading harvest records...</span>
    </div>
  );

  return (
    <div style={{ paddingBottom: '6rem' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastPop { 0%{opacity:0;transform:scale(0.88)} 70%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideInBottom { 0%{transform:translateY(100%);opacity:0} 70%{transform:translateY(-6px);opacity:1} 100%{transform:translateY(0);opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .hvrow:hover { background-color: #f0fdf4 !important; }
      `}</style>

      <Toast toasts={toasts} />

      {/* HEADER */}
      <div style={{ padding: '1.25rem 1.25rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Harvest records</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Encode and track barangay harvest data
            </p>
          </div>
          <button onClick={openNew}
            style={{ padding: '0.625rem 1.25rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.45rem', boxShadow: `0 4px 16px ${GREEN.primary}40` }}>
            <Plus size={16} /> Encode harvest
          </button>
        </div>

        {/* Summary metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <MetricCard icon={Users}       label='Total farmers'    value={records.length}             sub='harvest records encoded'         color='#0f172a' />
          <MetricCard icon={Layers}      label='Total area'       value={`${fmtNum(total_area)} ha`}  sub='harvested area'                  color={GREEN.accent} />
          <MetricCard icon={BarChart3}   label='Total production' value={`${fmtNum(total_mt)} MT`}    sub={`${fmtNum(total_bags, 0)} bags`} color='#2563eb' />
          <MetricCard icon={ShieldCheck} label='Avg. yield'       value={`${fmtNum(avg_yield)} t/ha`} sub='across all records'              color='#7c3aed' />
        </div>

        {/* Records / Summary tabs + View History button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.75rem', padding: '0.2rem', gap: '0.2rem', width: 'fit-content' }}>
            {[{ key: 'records', label: 'Records' }, { key: 'summary', label: 'Summary' }].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '0.4rem 1rem', borderRadius: '0.55rem', border: 'none',
                  backgroundColor: activeTab === t.key ? 'white' : 'transparent',
                  color: activeTab === t.key ? GREEN.primary : '#64748b',
                  fontWeight: activeTab === t.key ? 700 : 500,
                  fontSize: '0.82rem', cursor: 'pointer',
                  boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* View History button */}
          <button onClick={() => setShowHistory(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', backgroundColor: 'white', border: `1.5px solid ${GREEN.border}`, borderRadius: '0.75rem', color: GREEN.accent, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <History size={14} /> View History
          </button>
        </div>

        {/* Search + seed filter */}
        {activeTab === 'records' && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '0.875rem 1rem', border: '1px solid #f3f4f6', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} color='#9ca3af' style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder='Search farmer or variety...'
                style={{ padding: '0.5rem 0.875rem 0.5rem 2.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.82rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              <button onClick={() => setFilterSeed('')}
                style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${!filterSeed ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: !filterSeed ? GREEN.light : 'white', color: !filterSeed ? GREEN.primary : '#6b7280', fontWeight: !filterSeed ? 700 : 400, fontSize: '0.72rem', cursor: 'pointer' }}>
                All ({records.length})
              </button>
              {SEED_SOURCES.map(s => (
                <button key={s.key} onClick={() => setFilterSeed(s.key)}
                  style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${filterSeed === s.key ? s.color : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: filterSeed === s.key ? s.bg : 'white', color: filterSeed === s.key ? s.color : '#6b7280', fontWeight: filterSeed === s.key ? 700 : 400, fontSize: '0.72rem', cursor: 'pointer' }}>
                  {s.label} ({records.filter(r => r.seed_source === s.key).length})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RECORDS TAB */}
      {activeTab === 'records' && (
        <div style={{ padding: '0 1.25rem' }}>
          {filtered.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6', animation: 'slideUp 0.3s ease' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#f8fafc', display: 'grid', placeItems: 'center', margin: '0 auto 0.75rem' }}>
                <Layers size={28} color='#94a3b8' />
              </div>
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.375rem' }}>
                {records.length === 0 ? 'No harvest records yet' : 'No matching records'}
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: '0 0 1.25rem' }}>
                {records.length === 0 ? 'Start encoding harvest data for farmers in your barangay.' : 'Try adjusting your search or filters.'}
              </p>
              {records.length === 0 && (
                <button onClick={openNew}
                  style={{ padding: '0.625rem 1.25rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0 auto' }}>
                  <Plus size={15} /> Encode first record
                </button>
              )}
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #f3f4f6', overflow: 'hidden', animation: 'slideUp 0.3s ease' }}>
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a' }}>
                  {filtered.length} record{filtered.length !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>50 kg/bag fixed</span>
              </div>
              {filtered.map((rec, idx) => (
                <div key={rec.id} className='hvrow' style={{ backgroundColor: 'white', transition: 'background 0.15s' }}>
                  <HarvestRow rec={rec} idx={idx} total={filtered.length} onEdit={openEdit} onDelete={id => setConfirmDel(id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUMMARY TAB */}
      {activeTab === 'summary' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'slideUp 0.3s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Harvest by seed program
              </p>
            </div>
            {seed_breakdown.map(s => {
              const maxMt  = Math.max(...seed_breakdown.map(x => x.mt), 0.01);
              const barPct = Math.round((s.mt / maxMt) * 100);
              const aTier  = getUtilTier(s.avg_util);
              return (
                <div key={s.key} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s.color, display: 'inline-block' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{s.label}</span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{s.sublabel}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                      {[
                        { label: 'Farmers',    value: s.count },
                        { label: 'Area',       value: `${fmtNum(s.area)} ha` },
                        { label: 'Production', value: `${fmtNum(s.mt)} MT` },
                      ].map(m => (
                        <div key={m.label} style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{m.value}</p>
                          <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8' }}>{m.label}</p>
                        </div>
                      ))}
                      {s.avg_util !== null && (
                        <span style={{ backgroundColor: aTier.bg, color: aTier.color, border: `1px solid ${aTier.border}`, borderRadius: '999px', padding: '0.15rem 0.625rem', fontSize: '0.65rem', fontWeight: 700 }}>
                          {fmtNum(s.avg_util, 1)}% avg
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(2, barPct)}%`, backgroundColor: s.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall totals */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overall totals</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Farmers',   value: records.length,     color: '#0f172a'    },
                { label: 'Area (ha)', value: fmtNum(total_area), color: GREEN.accent  },
                { label: 'Total (MT)',value: fmtNum(total_mt),   color: '#2563eb'     },
                { label: 'Avg (t/ha)',value: fmtNum(avg_yield),  color: '#7c3aed'     },
              ].map(m => (
                <div key={m.label} style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', padding: '0.875rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: m.color }}>{m.value}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tier legend */}
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1rem 1.25rem' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Performance tier reference
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {[
                { range: '> 100%',      label: 'Exceeded Target', icon: <Trophy size={12} />,       color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
                { range: '80% to 100%', label: 'Achieved Target', icon: <CheckCircle2 size={12} />, color: '#15803d', bg: '#dcfce7', border: '#86efac' },
                { range: '70% to 79%',  label: 'Near Target',     icon: <AlertTriangle size={12} />, color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe' },
                { range: '50% to 69%',  label: 'Below Target',    icon: <AlertTriangle size={12} />, color: '#b45309', bg: '#fefce8', border: '#fde68a' },
                { range: '< 50%',       label: 'Critical',         icon: <X size={12} />,             color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
              ].map(t => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ backgroundColor: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: '999px', padding: '0.15rem 0.625rem', fontSize: '0.65rem', fontWeight: 700, minWidth: 130, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                    {t.icon} {t.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{t.range} of target yield</span>
                </div>
              ))}
            </div>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Targets: Hybrid 5,000 kg/ha · Certified seeds 4,000 kg/ha · Farmer saved seeds 3,000 kg/ha · All paddy bags = 50 kg fixed
            </p>
          </div>
        </div>
      )}

      {/* ENCODE FORM BOTTOM SHEET */}
      {showForm && (
        <>
          <div onClick={() => { setShowForm(false); setEditData(null); }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 700, animation: 'fadeIn 0.2s ease' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: 'white', borderRadius: '1.5rem 1.5rem 0 0',
            padding: '1.5rem', zIndex: 800,
            maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
            animation: 'slideInBottom 0.3s cubic-bezier(0.34,1.1,0.64,1)',
            width: 'min(100%, 720px)', margin: '0 auto',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{ width: 44, height: 4, backgroundColor: '#e5e7eb', borderRadius: '999px', margin: '0 auto 1.25rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>
                  {editData ? 'Edit harvest record' : 'Encode harvest record'}
                </h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Fields marked <span style={{ color: '#dc2626' }}>*</span> are required
                </p>
              </div>
              <button onClick={() => { setShowForm(false); setEditData(null); }}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '999px', width: 36, height: 36, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#374151', flexShrink: 0 }}>
                <X size={17} />
              </button>
            </div>
            <HarvestForm
              harvestingFarmers={harvestingFarmers}
              editData={editData}
              onSave={handleSave}
              onClose={() => { setShowForm(false); setEditData(null); }}
              saving={saving}
              finalSeeds={finalSeeds}
              beneficiaryData={beneficiaryData}
            />
          </div>
        </>
      )}

      {/* DELETE CONFIRM */}
      {confirmDel && (
        <>
          <div onClick={() => setConfirmDel(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 800, animation: 'fadeIn 0.2s ease' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.5rem', zIndex: 900,
            width: 'min(92vw, 360px)', boxShadow: '0 24px 80px rgba(15,23,42,0.25)',
            animation: 'slideUp 0.25s ease',
          }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: '#fef2f2', display: 'grid', placeItems: 'center', margin: '0 auto 0.875rem' }}>
              <AlertTriangle size={26} color='#b91c1c' />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontWeight: 800, fontSize: '1rem', color: '#111827', textAlign: 'center' }}>Delete this harvest record?</h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmDel(null)}
                style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', backgroundColor: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDel)} disabled={!!deleting}
                style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '0.875rem', backgroundColor: deleting ? '#fca5a5' : '#dc2626', color: 'white', fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BrgyHarvest;