// src/pages/brgy/BrgyHarvest.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, Plus, Edit3, Trash2, BarChart3,
  Users, Layers, ShieldCheck, CheckCircle2,
  AlertTriangle, Droplets, Sun, X,
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

// DA official seed type config
// Standard yield in kg/ha (dry weight basis) — DA standard
// Seeding density in kg/ha
const SEED_SOURCES = [
  {
    key: 'HYBRID',
    label: 'Hybrid seeds',
    sublabel: 'Gov. program (NRP/RFO)',
    color: '#1a4d1a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    density_kg_ha: 15,
    standard_yield_kg_ha: 4000,
  },
  {
    key: 'INBRED',
    label: 'Certified seeds',
    sublabel: 'Gov. program (PhilRice)',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    density_kg_ha: 40,
    standard_yield_kg_ha: 1500,
  },
  {
    key: 'OWN_SEED',
    label: 'Farmer saved seeds',
    sublabel: 'Farmer\'s own stock',
    color: '#b45309',
    bg: '#fefce8',
    border: '#fde68a',
    density_kg_ha: 15,
    standard_yield_kg_ha: 2000,
  },
];

const getSeedCfg = (key) =>
  SEED_SOURCES.find(s => s.key === key) || SEED_SOURCES[2];

// Utilization tier system based on real Lucban data
// Standard stays at DA constants, but tiers reflect actual performance range
const getUtilTier = (pct) => {
  if (pct === null || pct === undefined)
    return { label: 'N/A', color: '#94a3b8', bg: '#f9fafb', border: '#e5e7eb', icon: '—' };
  if (pct >= 200)
    return { label: 'Master Farmer', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', icon: '🏆' };
  if (pct >= 150)
    return { label: 'Exceptional', color: '#1a4d1a', bg: '#dcfce7', border: '#86efac', icon: '✅' };
  if (pct >= 100)
    return { label: 'Excellent', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' };
  if (pct >= 75)
    return { label: 'Good', color: '#b45309', bg: '#fefce8', border: '#fde68a', icon: '⚠️' };
  if (pct >= 50)
    return { label: 'Below target', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', icon: '⚠️' };
  return { label: 'Needs attention', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', icon: '❌' };
};

// Dry weight conversion: Fresh × (1 - moisture/100)
const toDryKg = (freshKg, moisturePct) =>
  freshKg * (1 - moisturePct / 100);

// Core computation — all metrics from a single harvest record
const computeMetrics = (rec) => {
  const bags    = parseFloat(rec.harvest_bags) || 0;
  const area    = parseFloat(rec.harvest_area_ha) || 0;
  const moisture = parseFloat(rec.moisture_content_pct) || 12;
  const isDry   = rec.weight_type === 'DRIED';

  const harvest_kg_raw = bags * 50;
  const harvest_kg_dry = isDry
    ? harvest_kg_raw
    : toDryKg(harvest_kg_raw, moisture);
  const harvest_mt_dry = harvest_kg_dry / 1000;
  const yield_t_ha     = area > 0 ? harvest_mt_dry / area : 0;

  const cfg = getSeedCfg(rec.seed_source);
  const seed_implied_kg     = area * cfg.density_kg_ha;
  const expected_yield_kg   = area * cfg.standard_yield_kg_ha;
  const utilization_pct     = expected_yield_kg > 0
    ? (harvest_kg_dry / expected_yield_kg) * 100
    : null;
  const productivity_ratio  = seed_implied_kg > 0
    ? harvest_kg_dry / seed_implied_kg
    : null;

  const seed_distributed_kg = rec.seed_bags_received
    ? parseFloat(rec.seed_bags_received) * 50
    : null;
  const seed_efficiency_pct = seed_distributed_kg && seed_implied_kg
    ? (seed_implied_kg / seed_distributed_kg) * 100
    : null;

  return {
    harvest_kg_raw,
    harvest_kg_dry,
    harvest_mt_dry,
    yield_t_ha,
    seed_implied_kg,
    expected_yield_kg,
    utilization_pct,
    productivity_ratio,
    seed_efficiency_pct,
  };
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
      const bg = t.type === 'success' ? GREEN.primary
               : t.type === 'warning' ? '#92400e'
               : '#991b1b';
      return (
        <div key={t.id} style={{
          backgroundColor: bg, color: 'white',
          padding: '0.75rem 1.25rem', borderRadius: '999px',
          fontSize: '0.85rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '0.55rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
          animation: 'toastPop 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          maxWidth: 'calc(100vw - 2rem)', whiteSpace: 'nowrap',
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
const HarvestForm = ({ farmers, onSave, onClose, saving, editData }) => {
  const [form, setForm] = useState({
    farmer_id:           editData?.farmer_id        || '',
    seed_source:         editData?.seed_source       || '',
    variety:             editData?.variety           || '',
    harvest_area_ha:     editData?.harvest_area_ha   || '',
    harvest_bags:        editData?.harvest_bags      || '',
    weight_type:         editData?.weight_type       || 'FRESH',
    moisture_content_pct: editData?.moisture_content_pct || 12,
    harvest_date:        editData?.harvest_date      || today(),
    seed_bags_received:  editData?.seed_bags_received || '',
    notes:               editData?.notes             || '',
  });
  const [errors, setErrors]         = useState({});
  const [farmerSearch, setFarmerSearch] = useState('');
  const [showFarmerList, setShowFarmerList] = useState(false);
  // High utilization confirmation
  const [showHighUtilConfirm, setShowHighUtilConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(null);

  const selectedFarmer = farmers.find(f => String(f.id) === String(form.farmer_id));

  useEffect(() => {
    if (selectedFarmer) {
      setFarmerSearch(
        `${selectedFarmer.last_name}, ${selectedFarmer.first_name} · ${selectedFarmer.rsbsa_number || 'No RSBSA'}`
      );
    }
  }, [selectedFarmer]);

  const filteredFarmers = useMemo(() => {
    const q = farmerSearch.trim().toLowerCase();
    return farmers.filter(f =>
      !q || [f.first_name, f.last_name, f.rsbsa_number]
        .join(' ').toLowerCase().includes(q)
    );
  }, [farmers, farmerSearch]);

  const selectFarmer = (farmer) => {
    setForm(p => ({ ...p, farmer_id: farmer.id }));
    setFarmerSearch(`${farmer.last_name}, ${farmer.first_name} · ${farmer.rsbsa_number || 'No RSBSA'}`);
    setShowFarmerList(false);
    setErrors(p => ({ ...p, farmer_id: '' }));
  };

  const set = (field, val) => {
    setForm(p => ({ ...p, [field]: val }));
    setErrors(p => ({ ...p, [field]: '' }));
  };

  // Live computation
  const bags     = parseFloat(form.harvest_bags) || 0;
  const area     = parseFloat(form.harvest_area_ha) || 0;
  const moisture = parseFloat(form.moisture_content_pct) || 12;
  const isDry    = form.weight_type === 'DRIED';
  const cfg      = getSeedCfg(form.seed_source);

  const harvest_kg_raw  = bags * 50;
  const harvest_kg_dry  = isDry ? harvest_kg_raw : toDryKg(harvest_kg_raw, moisture);
  const harvest_mt_dry  = harvest_kg_dry / 1000;
  const yield_t_ha      = area > 0 ? harvest_mt_dry / area : 0;
  const expected_kg     = area > 0 && form.seed_source ? area * cfg.standard_yield_kg_ha : 0;
  const util_pct        = expected_kg > 0 ? (harvest_kg_dry / expected_kg) * 100 : null;
  const seed_implied    = area > 0 && form.seed_source ? area * cfg.density_kg_ha : 0;
  const tier            = getUtilTier(util_pct);

  const inp = (err) => ({
    padding: '0.625rem 0.875rem',
    border: `1.5px solid ${err ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem',
    width: '100%', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    backgroundColor: 'white',
  });

  const validate = () => {
    const e = {};
    if (!form.farmer_id)      e.farmer_id      = 'Please select a farmer';
    if (!form.seed_source)    e.seed_source    = 'Seed source is required';
    if (!form.variety.trim()) e.variety        = 'Variety name is required';
    if (!form.harvest_area_ha || parseFloat(form.harvest_area_ha) <= 0)
      e.harvest_area_ha = 'Area harvested must be greater than 0';
    if (form.harvest_area_ha && parseFloat(form.harvest_area_ha) > 50)
      e.harvest_area_ha = 'Area seems too large — please verify (max 50 ha)';
    if (!form.harvest_bags || parseFloat(form.harvest_bags) <= 0)
      e.harvest_bags = 'Number of bags must be greater than 0';
    if (form.harvest_bags && parseFloat(form.harvest_bags) > 5000)
      e.harvest_bags = 'Bag count seems too large — please verify';
    if (!form.harvest_date)   e.harvest_date   = 'Harvest date is required';
    if (form.harvest_date > today())
      e.harvest_date = 'Harvest date cannot be in the future';
    if (form.weight_type === 'FRESH') {
      const m = parseFloat(form.moisture_content_pct);
      if (isNaN(m) || m < 8 || m > 30)
        e.moisture_content_pct = 'Moisture must be between 8% and 30%';
    }
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    // Warn if utilization is extremely high (data quality check)
    if (util_pct !== null && util_pct > 300) {
      setPendingSubmit({ ...form });
      setShowHighUtilConfirm(true);
      return;
    }
    onSave({ ...form });
  };

  const confirmHighUtil = () => {
    setShowHighUtilConfirm(false);
    onSave(pendingSubmit);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '1rem' }}>

      {/* SECTION 1 — Farmer */}
      <div style={{ position: 'relative' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
          Farmer <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <Search size={15} color='#9ca3af'
            style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type='text'
            value={farmerSearch}
            onChange={e => { setFarmerSearch(e.target.value); set('farmer_id', ''); setShowFarmerList(true); }}
            onFocus={() => setShowFarmerList(true)}
            onBlur={() => setTimeout(() => setShowFarmerList(false), 130)}
            placeholder='Search by name or RSBSA'
            style={{ ...inp(!!errors.farmer_id), paddingLeft: '2.5rem' }}
          />
        </div>
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
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                  {farmer.rsbsa_number || 'No RSBSA'} · {farmer.barangay}
                </p>
              </button>
            ))}
          </div>
        )}
        {errors.farmer_id && (
          <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.375rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={12} /> {errors.farmer_id}
          </p>
        )}
      </div>

      {/* SECTION 2 — Seed Source */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.625rem' }}>
          Seed source / program <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
          {SEED_SOURCES.map(s => {
            const sel = form.seed_source === s.key;
            return (
              <button key={s.key} type='button' onClick={() => set('seed_source', s.key)}
                style={{
                  border: `2px solid ${sel ? s.color : '#e2e8f0'}`,
                  borderRadius: '0.875rem', backgroundColor: sel ? s.bg : 'white',
                  cursor: 'pointer', padding: '0.875rem 0.5rem',
                  textAlign: 'center', transition: 'all 0.18s',
                }}>
                <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: sel ? s.color : '#374151' }}>
                  {s.label}
                </p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.62rem', color: sel ? s.color : '#94a3b8', fontWeight: 600 }}>
                  {s.sublabel}
                </p>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.6rem', color: sel ? s.color : '#cbd5e1' }}>
                  {s.density_kg_ha} kg/ha · std {(s.standard_yield_kg_ha / 1000).toFixed(1)} t/ha
                </p>
              </button>
            );
          })}
        </div>
        {errors.seed_source && (
          <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.375rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={12} /> {errors.seed_source}
          </p>
        )}
      </div>

      {/* SECTION 3 — Variety */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
          Rice variety <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input type='text' placeholder='e.g. NSIC Rc 222, PSB Rc 22, Mestizo 7'
          value={form.variety} onChange={e => set('variety', e.target.value)}
          style={inp(!!errors.variety)} />
        {errors.variety && (
          <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.375rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={12} /> {errors.variety}
          </p>
        )}
      </div>

      {/* SECTION 4 — Area + Bags */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Area harvested (ha) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type='number' step='0.01' min='0.01' max='50'
            placeholder='e.g. 0.50'
            value={form.harvest_area_ha} onChange={e => set('harvest_area_ha', e.target.value)}
            style={inp(!!errors.harvest_area_ha)} />
          {errors.harvest_area_ha && (
            <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={12} /> {errors.harvest_area_ha}
            </p>
          )}
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Harvest bags <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8' }}>(50 kg/bag)</span> <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type='number' step='1' min='1'
            placeholder='e.g. 80'
            value={form.harvest_bags} onChange={e => set('harvest_bags', e.target.value)}
            style={inp(!!errors.harvest_bags)} />
          {errors.harvest_bags && (
            <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={12} /> {errors.harvest_bags}
            </p>
          )}
        </div>
      </div>

      {/* SECTION 5 — Weight Type + Moisture (NEW) */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.625rem' }}>
          Weight type <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.75rem' }}>
          {[
            {
              key: 'FRESH',
              label: 'Fresh / Wet',
              sub: 'Just harvested (~25% moisture)',
              Icon: Droplets,
              color: '#2563eb',
              bg: '#eff6ff',
              border: '#bfdbfe',
            },
            {
              key: 'DRIED',
              label: 'Dried',
              sub: 'Already dried (~12% moisture)',
              Icon: Sun,
              color: '#b45309',
              bg: '#fefce8',
              border: '#fde68a',
            },
          ].map(opt => {
            const sel = form.weight_type === opt.key;
            return (
              <button key={opt.key} type='button' onClick={() => set('weight_type', opt.key)}
                style={{
                  border: `2px solid ${sel ? opt.color : '#e2e8f0'}`,
                  borderRadius: '0.875rem', backgroundColor: sel ? opt.bg : 'white',
                  cursor: 'pointer', padding: '0.875rem',
                  textAlign: 'left', transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                }}>
                <opt.Icon size={18} color={sel ? opt.color : '#94a3b8'} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: sel ? opt.color : '#374151' }}>
                    {opt.label}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.62rem', color: sel ? opt.color : '#94a3b8' }}>
                    {opt.sub}
                  </p>
                </div>
                {sel && (
                  <CheckCircle2 size={16} color={opt.color} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Moisture input — only for FRESH */}
        {form.weight_type === 'FRESH' && (
          <div style={{
            backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: '0.75rem', padding: '0.875rem 1rem',
          }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: '0.5rem' }}>
              Moisture content (%)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type='range' min='8' max='30' step='1'
                value={form.moisture_content_pct}
                onChange={e => set('moisture_content_pct', Number(e.target.value))}
                style={{ flex: 1, accentColor: '#2563eb' }}
              />
              <span style={{
                minWidth: 42, padding: '0.25rem 0.625rem',
                backgroundColor: 'white', border: '1px solid #bfdbfe',
                borderRadius: '0.375rem', fontSize: '0.82rem',
                fontWeight: 700, color: '#1e40af', textAlign: 'center',
              }}>
                {form.moisture_content_pct}%
              </span>
            </div>
            <p style={{ margin: '0.375rem 0 0', fontSize: '0.65rem', color: '#3b82f6' }}>
              Default 12% · Standard harvest moisture · Adjust if known
            </p>
            {errors.moisture_content_pct && (
              <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertTriangle size={12} /> {errors.moisture_content_pct}
              </p>
            )}
          </div>
        )}
      </div>

      {/* SECTION 6 — Live Metrics Preview (NEW COMPUTATION) */}
      {(bags > 0 || area > 0) && form.seed_source && (
        <div style={{
          backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`,
          borderRadius: '1rem', padding: '1rem',
        }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Live harvest metrics preview
          </p>

          {/* Weight conversion */}
          {bags > 0 && form.weight_type === 'FRESH' && (
            <div style={{
              backgroundColor: 'white', borderRadius: '0.625rem',
              padding: '0.625rem 0.875rem', marginBottom: '0.75rem',
              border: '1px solid #bfdbfe',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              flexWrap: 'wrap', fontSize: '0.78rem',
            }}>
              <span style={{ color: '#64748b' }}>Fresh weight:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmtNum(harvest_kg_raw, 0)} kg</span>
              <span style={{ color: '#94a3b8' }}>→</span>
              <span style={{ color: '#64748b' }}>Dry weight:</span>
              <span style={{ fontWeight: 700, color: '#166534' }}>{fmtNum(harvest_kg_dry, 0)} kg</span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                (−{form.moisture_content_pct}% moisture = −{fmtNum(harvest_kg_raw - harvest_kg_dry, 0)} kg water)
              </span>
            </div>
          )}

          {/* Key metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[
              { label: 'Dry weight', value: bags > 0 ? `${fmtNum(harvest_kg_dry, 0)} kg` : '—' },
              { label: 'Production', value: bags > 0 ? `${fmtNum(harvest_mt_dry)} MT` : '—' },
              { label: 'Avg. yield', value: (bags > 0 && area > 0) ? `${fmtNum(yield_t_ha)} t/ha` : '—' },
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

          {/* Utilization breakdown */}
          {area > 0 && bags > 0 && (
            <div style={{
              backgroundColor: 'white', borderRadius: '0.625rem',
              padding: '0.75rem 0.875rem', border: `1px solid ${tier.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.6 }}>
                  <p style={{ margin: 0 }}>
                    DA standard: <strong style={{ color: '#0f172a' }}>{fmtNum(cfg.standard_yield_kg_ha, 0)} kg/ha</strong>
                  </p>
                  <p style={{ margin: 0 }}>
                    Expected yield: <strong style={{ color: '#0f172a' }}>{fmtNum(expected_kg, 0)} kg</strong>
                    <span style={{ color: '#94a3b8' }}> ({fmtNum(area)} ha × {fmtNum(cfg.standard_yield_kg_ha, 0)} kg/ha)</span>
                  </p>
                  <p style={{ margin: 0 }}>
                    Actual (dry): <strong style={{ color: '#0f172a' }}>{fmtNum(harvest_kg_dry, 0)} kg</strong>
                  </p>
                  {seed_implied > 0 && (
                    <p style={{ margin: 0 }}>
                      Seed implied: <strong style={{ color: '#0f172a' }}>{fmtNum(seed_implied, 1)} kg</strong>
                      <span style={{ color: '#94a3b8' }}> ({fmtNum(area)} ha × {cfg.density_kg_ha} kg/ha)</span>
                    </p>
                  )}
                </div>
                {util_pct !== null && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: tier.color, lineHeight: 1 }}>
                      {fmtNum(util_pct, 1)}%
                    </p>
                    <span style={{
                      display: 'inline-block', marginTop: '0.25rem',
                      backgroundColor: tier.bg, color: tier.color,
                      border: `1px solid ${tier.border}`,
                      borderRadius: '999px', padding: '0.15rem 0.625rem',
                      fontSize: '0.65rem', fontWeight: 700,
                    }}>
                      {tier.icon} {tier.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Utilization bar */}
              {util_pct !== null && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ height: 7, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, util_pct)}%`,
                      backgroundColor: tier.color,
                      borderRadius: '999px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    <span>0%</span>
                    <span>DA standard (100%)</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 7 — Harvest Date + Seed Bags */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Harvest date <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type='date' value={form.harvest_date} max={today()}
            onChange={e => set('harvest_date', e.target.value)}
            style={inp(!!errors.harvest_date)} />
          {errors.harvest_date && (
            <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={12} /> {errors.harvest_date}
            </p>
          )}
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Seed bags received <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
          </label>
          <input type='number' step='1' min='0'
            placeholder='bags from distribution'
            value={form.seed_bags_received}
            onChange={e => set('seed_bags_received', e.target.value)}
            style={inp(false)} />
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.62rem', color: '#94a3b8' }}>
            For seed efficiency calculation
          </p>
        </div>
      </div>

      {/* SECTION 8 — Notes */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
          Notes / remarks <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
        </label>
        <textarea rows={3} value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder='Field observations, pest issues, weather conditions...'
          style={{ ...inp(false), resize: 'vertical', minHeight: 80 }} />
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={saving}
        style={{
          width: '100%', padding: '1rem',
          backgroundColor: saving ? '#d1d5db' : GREEN.primary,
          color: 'white', border: 'none', borderRadius: '1rem',
          fontWeight: 800, fontSize: '1rem',
          cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          boxShadow: saving ? 'none' : `0 8px 24px ${GREEN.primary}40`,
          transition: 'all 0.2s',
        }}>
        <CheckCircle2 size={18} />
        {saving ? 'Saving...' : editData ? 'Update harvest record' : 'Save harvest record'}
      </button>

      {/* High utilization confirmation dialog */}
      {showHighUtilConfirm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '1.25rem',
            padding: '1.5rem', maxWidth: 360, width: '100%',
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              backgroundColor: '#fef9c3', display: 'grid',
              placeItems: 'center', margin: '0 auto 0.875rem',
            }}>
              <AlertTriangle size={26} color='#b45309' />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontWeight: 800, fontSize: '1rem', color: '#111827', textAlign: 'center' }}>
              Very high yield detected
            </h3>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#64748b', textAlign: 'center', lineHeight: 1.6 }}>
              This harvest shows <strong>{fmtNum(util_pct, 1)}%</strong> utilization — significantly above the DA standard. Please confirm the harvest amount is correct before saving.
            </p>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>
              Expected: {fmtNum(expected_kg, 0)} kg · Recorded: {fmtNum(harvest_kg_dry, 0)} kg (dry)
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowHighUtilConfirm(false)}
                style={{
                  flex: 1, padding: '0.75rem', border: '1.5px solid #e5e7eb',
                  borderRadius: '0.875rem', backgroundColor: 'white',
                  color: '#374151', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
                }}>
                Review
              </button>
              <button onClick={confirmHighUtil}
                style={{
                  flex: 1, padding: '0.75rem', border: 'none',
                  borderRadius: '0.875rem', backgroundColor: GREEN.primary,
                  color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
                }}>
                Yes, it's correct
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── HARVEST RECORD ROW ────────────────────────────────────────
const HarvestRow = ({ rec, idx, total, onEdit, onDelete }) => {
  const m       = computeMetrics(rec);
  const seedCfg = getSeedCfg(rec.seed_source);
  const tier    = getUtilTier(m.utilization_pct);

  return (
    <div style={{
      padding: '0.875rem 1.25rem',
      borderBottom: idx < total - 1 ? '1px solid #f1f5f9' : 'none',
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    }}>
      {/* Seed type avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        backgroundColor: `${seedCfg.color}15`,
        border: `1.5px solid ${seedCfg.color}`,
        display: 'grid', placeItems: 'center',
        fontSize: '0.68rem', fontWeight: 800, color: seedCfg.color,
      }}>
        {rec.seed_source === 'HYBRID' ? 'HYB'
          : rec.seed_source === 'INBRED' ? 'CRT' : 'FSS'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
            {rec.farmer_name}
          </p>
          <span style={{
            backgroundColor: seedCfg.bg, color: seedCfg.color,
            border: `1px solid ${seedCfg.border}`,
            borderRadius: '999px', padding: '0.1rem 0.5rem',
            fontSize: '0.62rem', fontWeight: 700,
          }}>
            {seedCfg.label}
          </span>
          {m.utilization_pct !== null && (
            <span style={{
              backgroundColor: tier.bg, color: tier.color,
              border: `1px solid ${tier.border}`,
              borderRadius: '999px', padding: '0.1rem 0.5rem',
              fontSize: '0.62rem', fontWeight: 700,
            }}>
              {tier.icon} {fmtNum(m.utilization_pct, 1)}% · {tier.label}
            </span>
          )}
          {/* Weight type badge */}
          <span style={{
            backgroundColor: rec.weight_type === 'FRESH' ? '#eff6ff' : '#fefce8',
            color: rec.weight_type === 'FRESH' ? '#1e40af' : '#92400e',
            borderRadius: '999px', padding: '0.1rem 0.45rem',
            fontSize: '0.6rem', fontWeight: 600,
            border: rec.weight_type === 'FRESH' ? '1px solid #bfdbfe' : '1px solid #fde68a',
          }}>
            {rec.weight_type === 'FRESH' ? `Fresh (${rec.moisture_content_pct || 12}% H₂O)` : 'Dried'}
          </span>
        </div>

        {/* Variety + date */}
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569' }}>
          {rec.variety} · {rec.harvest_date}
        </p>

        {/* Key stats */}
        <div style={{ display: 'flex', gap: '0.875rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Area', value: `${fmtNum(rec.harvest_area_ha)} ha` },
            { label: 'Bags', value: fmtNum(rec.harvest_bags, 0) },
            { label: 'Dry wt', value: `${fmtNum(m.harvest_kg_dry, 0)} kg` },
            { label: 'MT', value: fmtNum(m.harvest_mt_dry) },
            { label: 't/ha', value: fmtNum(m.yield_t_ha) },
          ].map(s => (
            <span key={s.label} style={{ fontSize: '0.72rem', color: '#64748b' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{s.value}</span> {s.label}
            </span>
          ))}
        </div>

        {/* Comparison row — standard vs actual */}
        {rec.seed_source && parseFloat(rec.harvest_area_ha) > 0 && (
          <div style={{
            marginTop: '0.5rem', fontSize: '0.68rem', color: '#64748b',
            display: 'flex', gap: '0.625rem', flexWrap: 'wrap',
          }}>
            <span>DA std: <strong style={{ color: '#0f172a' }}>{fmtNum(getSeedCfg(rec.seed_source).standard_yield_kg_ha, 0)} kg/ha</strong></span>
            <span>·</span>
            <span>Expected: <strong style={{ color: '#0f172a' }}>{fmtNum(m.expected_yield_kg, 0)} kg</strong></span>
            {m.productivity_ratio && (
              <>
                <span>·</span>
                <span>Productivity: <strong style={{ color: '#0f172a' }}>{fmtNum(m.productivity_ratio, 0)} kg/kg seed</strong></span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
        <button onClick={() => onEdit(rec)}
          style={{
            padding: '0.5rem', backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: '0.625rem',
            cursor: 'pointer', color: '#475569',
          }}>
          <Edit3 size={14} />
        </button>
        <button onClick={() => onDelete(rec.id)}
          style={{
            padding: '0.5rem', backgroundColor: '#fff1f2',
            border: '1px solid #fecdd3', borderRadius: '0.625rem',
            cursor: 'pointer', color: '#dc2626',
          }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────
const BrgyHarvest = () => {
  const [records,  setRecords]  = useState([]);
  const [farmers,  setFarmers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);

  const [showForm,   setShowForm]   = useState(false);
  const [editData,   setEditData]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

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

  // ── LOAD DATA ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [farmersRes, recordsRes] = await Promise.allSettled([
        API.get('/distribution/farmers/search/?barangay=&search='),
        API.get('/production/harvest/'),
      ]);
      if (farmersRes.status === 'fulfilled')
        setFarmers(farmersRes.value.data || []);
      if (recordsRes.status === 'fulfilled') {
        const d = recordsRes.value.data;
        setRecords(Array.isArray(d) ? d : (d?.results || []));
      }
    } catch {
      pushToast('Failed to load data. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── SAVE ──
  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editData?.id) {
        await API.patch(`/production/harvest/${editData.id}/`, formData);
        pushToast('Harvest record updated successfully.');
      } else {
        await API.post('/production/harvest/', formData);
        pushToast('Harvest record saved.');
      }
      setShowForm(false);
      setEditData(null);
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

  // ── DELETE ──
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

  // ── FILTERED RECORDS ──
  const filtered = records.filter(r => {
    const q = search.trim().toLowerCase();
    if (q && !(r.farmer_name?.toLowerCase().includes(q) || r.variety?.toLowerCase().includes(q))) return false;
    if (filterSeed && r.seed_source !== filterSeed) return false;
    return true;
  });

  // ── SUMMARY METRICS ──
  const total_area = records.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
  const total_bags = records.reduce((s, r) => s + (parseFloat(r.harvest_bags) || 0), 0);
  const total_mt   = records.reduce((s, r) => s + computeMetrics(r).harvest_mt_dry, 0);
  const avg_yield  = total_area > 0 ? total_mt / total_area : 0;

  const seed_breakdown = SEED_SOURCES.map(s => {
    const group = records.filter(r => r.seed_source === s.key);
    const area  = group.reduce((sum, r) => sum + (parseFloat(r.harvest_area_ha) || 0), 0);
    const mt    = group.reduce((sum, r) => sum + computeMetrics(r).harvest_mt_dry, 0);
    const util_vals = group.map(r => computeMetrics(r).utilization_pct).filter(v => v !== null);
    const avg_util  = util_vals.length > 0 ? util_vals.reduce((a, b) => a + b, 0) / util_vals.length : null;
    return { ...s, count: group.length, area, mt, avg_util };
  });

  const openNew  = () => { setEditData(null); setShowForm(true); };
  const openEdit = (rec) => {
    setEditData({
      id: rec.id,
      farmer_id:           rec.farmer,
      seed_source:         rec.seed_source,
      variety:             rec.variety,
      harvest_area_ha:     rec.harvest_area_ha,
      harvest_bags:        rec.harvest_bags,
      weight_type:         rec.weight_type || 'FRESH',
      moisture_content_pct: rec.moisture_content_pct || 12,
      harvest_date:        rec.harvest_date,
      seed_bags_received:  rec.seed_bags_received || '',
      notes:               rec.notes || '',
    });
    setShowForm(true);
  };

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
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
              Harvest records
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Encode and track barangay harvest data
            </p>
          </div>
          <button onClick={openNew}
            style={{
              padding: '0.625rem 1.25rem', backgroundColor: GREEN.primary,
              color: 'white', border: 'none', borderRadius: '0.875rem',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              boxShadow: `0 4px 16px ${GREEN.primary}40`,
            }}>
            <Plus size={16} /> Encode harvest
          </button>
        </div>

        {/* Summary metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <MetricCard icon={Users}    label='Total farmers'   value={records.length}            sub='harvest records encoded'  color='#0f172a' />
          <MetricCard icon={Layers}   label='Total area'      value={`${fmtNum(total_area)} ha`} sub='harvested area'           color={GREEN.accent} />
          <MetricCard icon={BarChart3} label='Total production' value={`${fmtNum(total_mt)} MT`}  sub={`${fmtNum(total_bags, 0)} bags (dry wt)`} color='#2563eb' />
          <MetricCard icon={ShieldCheck} label='Avg. yield'  value={`${fmtNum(avg_yield)} t/ha`} sub='across all records'      color='#7c3aed' />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.75rem', padding: '0.2rem', gap: '0.2rem', marginBottom: '1.25rem', width: 'fit-content' }}>
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

        {/* Search + filters (Records tab only) */}
        {activeTab === 'records' && (
          <div style={{
            backgroundColor: 'white', borderRadius: '1rem', padding: '0.875rem 1rem',
            border: '1px solid #f3f4f6', marginBottom: '1rem',
            display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center',
          }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} color='#9ca3af'
                style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
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
                {records.length === 0
                  ? 'Start encoding harvest data for farmers in your barangay.'
                  : 'Try adjusting your search or filters.'}
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
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                  All weights shown as dry weight
                </span>
              </div>
              {filtered.map((rec, idx) => (
                <div key={rec.id} className='hvrow' style={{ backgroundColor: 'white', transition: 'background 0.15s' }}>
                  <HarvestRow
                    rec={rec} idx={idx} total={filtered.length}
                    onEdit={openEdit}
                    onDelete={id => setConfirmDel(id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUMMARY TAB */}
      {activeTab === 'summary' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'slideUp 0.3s ease' }}>

          {/* Seed type breakdown */}
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
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{s.label}</span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{s.sublabel}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                      {[
                        { label: 'Farmers', value: s.count },
                        { label: 'Area', value: `${fmtNum(s.area)} ha` },
                        { label: 'Production', value: `${fmtNum(s.mt)} MT` },
                      ].map(m => (
                        <div key={m.label} style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{m.value}</p>
                          <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8' }}>{m.label}</p>
                        </div>
                      ))}
                      {s.avg_util !== null && (
                        <span style={{ backgroundColor: aTier.bg, color: aTier.color, border: `1px solid ${aTier.border}`, borderRadius: '999px', padding: '0.15rem 0.625rem', fontSize: '0.65rem', fontWeight: 700 }}>
                          {fmtNum(s.avg_util, 1)}% avg util
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
            <p style={{ margin: '0 0 1rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Overall totals (dry weight basis)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Farmers', value: records.length, color: '#0f172a' },
                { label: 'Area (ha)', value: fmtNum(total_area), color: GREEN.accent },
                { label: 'Total (MT)', value: fmtNum(total_mt), color: '#2563eb' },
                { label: 'Avg yield (t/ha)', value: fmtNum(avg_yield), color: '#7c3aed' },
              ].map(m => (
                <div key={m.label} style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', padding: '0.875rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: m.color }}>{m.value}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tier legend */}
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1rem 1.25rem' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Utilization tier reference
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {[
                { range: '≥ 200%', label: 'Master Farmer', icon: '🏆', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
                { range: '150–199%', label: 'Exceptional', icon: '✅', color: '#1a4d1a', bg: '#dcfce7', border: '#86efac' },
                { range: '100–149%', label: 'Excellent', icon: '✅', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                { range: '75–99%', label: 'Good', icon: '⚠️', color: '#b45309', bg: '#fefce8', border: '#fde68a' },
                { range: '50–74%', label: 'Below target', icon: '⚠️', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
                { range: '< 50%', label: 'Needs attention', icon: '❌', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
              ].map(t => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ backgroundColor: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: '999px', padding: '0.15rem 0.625rem', fontSize: '0.65rem', fontWeight: 700, minWidth: 130, textAlign: 'center' }}>
                    {t.icon} {t.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{t.range} of DA standard yield</span>
                </div>
              ))}
            </div>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.5 }}>
              DA standards: Hybrid 4,000 kg/ha · Certified seeds 1,500 kg/ha · Farmer saved seeds 2,000 kg/ha · All compared at dry weight (moisture removed)
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
              farmers={farmers}
              editData={editData}
              onSave={handleSave}
              onClose={() => { setShowForm(false); setEditData(null); }}
              saving={saving}
            />
          </div>
        </>
      )}

      {/* DELETE CONFIRM DIALOG */}
      {confirmDel && (
        <>
          <div onClick={() => setConfirmDel(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 800, animation: 'fadeIn 0.2s ease' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white', borderRadius: '1.25rem',
            padding: '1.5rem', zIndex: 900,
            width: 'min(92vw, 360px)',
            boxShadow: '0 24px 80px rgba(15,23,42,0.25)',
            animation: 'slideUp 0.25s ease',
          }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: '#fef2f2', display: 'grid', placeItems: 'center', margin: '0 auto 0.875rem' }}>
              <AlertTriangle size={26} color='#b91c1c' />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontWeight: 800, fontSize: '1rem', color: '#111827', textAlign: 'center' }}>
              Delete this harvest record?
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>
              This action cannot be undone. The record will be permanently removed from the system.
            </p>
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