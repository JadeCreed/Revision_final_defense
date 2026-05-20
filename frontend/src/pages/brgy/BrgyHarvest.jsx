// src/pages/brgy/BrgyHarvest.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Plus, Edit3, Trash2, BarChart3, Users, Layers, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  { key: 'HYBRID', label: 'Hybrid', sublabel: 'Hybrid (Region)', color: '#1a4d1a', bg: '#f0fdf4', border: '#bbf7d0', rate: 10 },
  { key: 'INBRED', label: 'Certified Inbred', sublabel: 'Inbred (PhilRice)', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', rate: 6 },
  { key: 'OWN_SEED', label: 'Own/Saved Seed', sublabel: 'Farmer Saved', color: '#b45309', bg: '#fefce8', border: '#fde68a', rate: null },
];

const getSeedCfg = (key) => SEED_SOURCES.find(s => s.key === key) || SEED_SOURCES[2];

const UTIL_STATUS = (pct) => {
  if (pct === null) return { label: 'N/A', color: '#94a3b8', bg: '#f9fafb' };
  if (pct >= 90)   return { label: 'Optimal', color: '#166534', bg: '#f0fdf4' };
  if (pct >= 70)   return { label: 'Moderate', color: '#b45309', bg: '#fefce8' };
  return { label: 'Low', color: '#dc2626', bg: '#fff1f2' };
};

const computeMetrics = (rec) => {
  const bags = parseFloat(rec.harvest_bags) || 0;
  const area = parseFloat(rec.harvest_area_ha) || 0;
  const harvest_kg = bags * 50;
  const harvest_mt = harvest_kg / 1000;
  const yield_t_ha = area > 0 ? harvest_mt / area : 0;
  const cfg = getSeedCfg(rec.seed_source);
  let utilization_pct = null;
  let target_seed_bags = null;
  if (cfg.rate && area > 0 && rec.seed_bags_received) {
    target_seed_bags = area * cfg.rate;
    utilization_pct = Math.min(200, (parseFloat(rec.seed_bags_received) / target_seed_bags) * 100);
  }
  return { harvest_kg, harvest_mt, yield_t_ha, utilization_pct, target_seed_bags };
};

const fmtNum = (n, d = 2) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

const today = () => new Date().toISOString().split('T')[0];

// ─── TOAST ────────────────────────────────────────────────────
const Toast = ({ toasts }) => (
  <div style={{
    position: 'fixed', bottom: '1.5rem', left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem',
    alignItems: 'center', pointerEvents: 'none',
  }}>
    {toasts.map((t) => {
      const Icon = t.type === 'success' ? CheckCircle2 : AlertTriangle;
      return (
        <div key={t.id} style={{
          backgroundColor: t.type === 'success' ? GREEN.primary : t.type === 'warning' ? '#92400e' : '#991b1b',
          color: 'white', padding: '0.75rem 1.25rem',
          borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '0.55rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          animation: 'toastPop 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          maxWidth: 'calc(100vw - 2rem)',
          whiteSpace: 'nowrap',
        }}>
          <Icon size={16} />
          {t.msg}
        </div>
      );
    })}
  </div>
);

// ─── METRIC CARD ─────────────────────────────────────────────
const MetricCard = ({ icon, label, value, sub, color }) => (
  <div style={{
    backgroundColor: 'white', borderRadius: '1rem',
    padding: '1rem 1.1rem', border: '1px solid #e2e8f0',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
    <p style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: color || '#0f172a', lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>{sub}</p>}
  </div>
);

// ─── HARVEST FORM ────────────────────────────────────────────
const HarvestForm = ({ farmers, onSave, onClose, saving, editData }) => {
  const [form, setForm] = useState({
    farmer_id:        editData?.farmer_id || '',
    seed_source:      editData?.seed_source || '',
    variety:          editData?.variety || '',
    harvest_area_ha:  editData?.harvest_area_ha || '',
    harvest_bags:     editData?.harvest_bags || '',
    harvest_date:     editData?.harvest_date || today(),
    seed_bags_received: editData?.seed_bags_received || '',
    notes:            editData?.notes || '',
  });
  const [errors, setErrors] = useState({});
  const [farmerSearch, setFarmerSearch] = useState('');
  const [showFarmerList, setShowFarmerList] = useState(false);

  const selectedFarmer = farmers.find((f) => String(f.id) === String(form.farmer_id));

  useEffect(() => {
    if (selectedFarmer) {
      setFarmerSearch(`${selectedFarmer.last_name}, ${selectedFarmer.first_name} · ${selectedFarmer.rsbsa_number || 'No RSBSA'}`);
    }
  }, [selectedFarmer]);

  const filteredFarmers = useMemo(() => {
    const query = farmerSearch.trim().toLowerCase();
    return farmers.filter((f) => {
      if (!query) return true;
      return [f.first_name, f.last_name, f.rsbsa_number].join(' ').toLowerCase().includes(query);
    });
  }, [farmers, farmerSearch]);

  const selectFarmer = (farmer) => {
    setForm((prev) => ({ ...prev, farmer_id: farmer.id }));
    setFarmerSearch(`${farmer.last_name}, ${farmer.first_name} · ${farmer.rsbsa_number || 'No RSBSA'}`);
    setShowFarmerList(false);
    setErrors((prev) => ({ ...prev, farmer_id: '' }));
  };

  const seedCfg = getSeedCfg(form.seed_source);
  const area    = parseFloat(form.harvest_area_ha) || 0;
  const bags    = parseFloat(form.harvest_bags) || 0;
  const harvest_kg = bags * 50;
  const harvest_mt = harvest_kg / 1000;
  const yield_t_ha = area > 0 ? harvest_mt / area : 0;
  const target_seed = seedCfg.rate && area > 0 ? area * seedCfg.rate : null;
  const received = parseFloat(form.seed_bags_received) || 0;
  const util_pct = (target_seed && received > 0) ? Math.min(200, (received / target_seed) * 100) : null;
  const utilStatus = UTIL_STATUS(util_pct);

  const inp = (err) => ({
    padding: '0.625rem 0.875rem',
    border: `1.5px solid ${err ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    backgroundColor: 'white',
  });

  const validate = () => {
    const e = {};
    if (!form.farmer_id)       e.farmer_id       = 'Please select a farmer';
    if (!form.seed_source)     e.seed_source     = 'Seed source is required';
    if (!form.variety.trim())  e.variety         = 'Variety name is required';
    if (!form.harvest_area_ha || parseFloat(form.harvest_area_ha) <= 0)
      e.harvest_area_ha = 'Area harvested must be greater than 0';
    if (!form.harvest_bags || parseFloat(form.harvest_bags) <= 0)
      e.harvest_bags = 'Number of bags must be greater than 0';
    if (!form.harvest_date)    e.harvest_date    = 'Harvest date is required';
    if (form.harvest_area_ha && parseFloat(form.harvest_area_ha) > 50)
      e.harvest_area_ha = 'Area seems too large — please verify (max 50 ha)';
    if (form.harvest_bags && parseFloat(form.harvest_bags) > 5000)
      e.harvest_bags = 'Bag count seems too large — please verify';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ ...form });
  };

  const set = (field, val) => {
    setForm(p => ({ ...p, [field]: val }));
    setErrors(p => ({ ...p, [field]: '' }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '1rem' }}>

      <div style={{ position: 'relative' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
          Farmer <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <Search size={16} color='#9ca3af' style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type='text'
            value={farmerSearch}
            onChange={(e) => { setFarmerSearch(e.target.value); set('farmer_id', ''); setShowFarmerList(true); }}
            onFocus={() => setShowFarmerList(true)}
            onBlur={() => setTimeout(() => setShowFarmerList(false), 120)}
            placeholder='Search farmer by name or RSBSA'
            style={{ ...inp(!!errors.farmer_id), paddingLeft: '3rem' }}
          />
        </div>
        {showFarmerList && (
          <div style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 220, overflowY: 'auto', marginTop: 8, backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', boxShadow: '0 12px 28px rgba(15,23,42,0.08)' }}>
            {filteredFarmers.length > 0 ? filteredFarmers.map((farmer) => (
              <button
                key={farmer.id}
                type='button'
                onClick={() => selectFarmer(farmer)}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.85rem 1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#0f172a', fontSize: '0.9rem', borderBottom: '1px solid #f3f4f6',
                }}
              >
                <div style={{ fontWeight: 700 }}>{farmer.last_name}, {farmer.first_name}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{farmer.rsbsa_number || 'No RSBSA'}</div>
              </button>
            )) : (
              <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>No farmers match that search.</div>
            )}
          </div>
        )}
        {errors.farmer_id && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.5rem 0 0' }}>{errors.farmer_id}</p>}
      </div>

      {/* Seed source */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.75rem' }}>
          Seed Source / Program <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
          {SEED_SOURCES.map(s => {
            const sel = form.seed_source === s.key;
            return (
              <button key={s.key} type='button'
                onClick={() => set('seed_source', s.key)}
                style={{
                  border: `2px solid ${sel ? s.color : '#e2e8f0'}`,
                  borderRadius: '0.875rem',
                  backgroundColor: sel ? s.bg : 'white',
                  cursor: 'pointer',
                  padding: '0.875rem 0.5rem',
                  textAlign: 'center',
                  transition: 'all 0.18s',
                }}>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: sel ? s.color : '#374151' }}>{s.label}</p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.65rem', color: sel ? s.color : '#94a3b8', fontWeight: 600 }}>{s.sublabel}</p>
                {s.rate && (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.62rem', color: sel ? s.color : '#94a3b8' }}>{s.rate} bags/ha</p>
                )}
              </button>
            );
          })}
        </div>
        {errors.seed_source && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.5rem 0 0' }}>{errors.seed_source}</p>}
      </div>

      {/* Variety */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
          Rice Variety <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input type='text' placeholder='e.g. NSIC Rc 222, Mestizo 7, etc.'
          value={form.variety} onChange={e => set('variety', e.target.value)}
          style={inp(!!errors.variety)} />
        {errors.variety && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.variety}</p>}
      </div>

      {/* Area + Bags */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Area Harvested (ha) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type='number' step='0.01' min='0.01' max='50'
            placeholder='e.g. 0.50'
            value={form.harvest_area_ha} onChange={e => set('harvest_area_ha', e.target.value)}
            style={inp(!!errors.harvest_area_ha)} />
          {errors.harvest_area_ha && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.harvest_area_ha}</p>}
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Harvest Bags (50 kg/bag) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type='number' step='1' min='1'
            placeholder='e.g. 80'
            value={form.harvest_bags} onChange={e => set('harvest_bags', e.target.value)}
            style={inp(!!errors.harvest_bags)} />
          {errors.harvest_bags && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.harvest_bags}</p>}
        </div>
      </div>

      {/* Live compute preview */}
      {(bags > 0 || area > 0) && (
        <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.875rem', padding: '0.875rem 1rem' }}>
          <p style={{ margin: '0 0 0.625rem', fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Live Computation Preview
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {[
              { label: 'Total (kg)',  value: bags > 0 ? fmtNum(harvest_kg, 0) : '—' },
              { label: 'Total (MT)',  value: bags > 0 ? fmtNum(harvest_mt) : '—' },
              { label: 'Yield (t/ha)', value: (bags > 0 && area > 0) ? fmtNum(yield_t_ha) : '—' },
            ].map(m => (
              <div key={m.label} style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.625rem', textAlign: 'center', border: `1px solid ${GREEN.border}` }}>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: GREEN.accent }}>{m.value}</p>
                <p style={{ margin: 0, fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>{m.label}</p>
              </div>
            ))}
          </div>
          {target_seed && (
            <div style={{ marginTop: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#166534' }}>
                Target seed bags: <strong>{fmtNum(target_seed, 0)}</strong> ({seedCfg.rate} bags/ha × {fmtNum(area)} ha)
              </p>
              {util_pct !== null && (
                <span style={{ backgroundColor: utilStatus.bg, color: utilStatus.color, borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.65rem', fontWeight: 700 }}>
                  {fmtNum(util_pct, 1)}% utilization — {utilStatus.label}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Harvest date + seed bags */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Harvest Date <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type='date' value={form.harvest_date}
            max={today()}
            onChange={e => set('harvest_date', e.target.value)}
            style={inp(!!errors.harvest_date)} />
          {errors.harvest_date && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.harvest_date}</p>}
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Seed Bags Received (optional)
          </label>
          <input type='number' step='1' min='0'
            placeholder={target_seed ? `Target: ${Math.round(target_seed)}` : 'bags received'}
            value={form.seed_bags_received} onChange={e => set('seed_bags_received', e.target.value)}
            style={inp(false)} />
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.65rem', color: '#94a3b8' }}>Used for utilization calculation</p>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
          Notes / Remarks (optional)
        </label>
        <textarea rows={3} value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder='Any field observations, issues, or additional notes...'
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
          transition: 'all 0.2s',
          boxShadow: saving ? 'none' : `0 8px 24px ${GREEN.primary}40`,
        }}>
        {saving ? '⏳ Saving...' : `✓ ${editData ? 'Update Record' : 'Save Harvest Record'}`}
      </button>
    </div>
  );
};

// ─── HARVEST ROW ─────────────────────────────────────────────
const HarvestRow = ({ rec, idx, total, onEdit, onDelete }) => {
  const m = computeMetrics(rec);
  const seedCfg = getSeedCfg(rec.seed_source);
  const utilStatus = UTIL_STATUS(m.utilization_pct);

  return (
    <div style={{
      padding: '0.875rem 1.25rem',
      borderBottom: idx < total - 1 ? '1px solid #f1f5f9' : 'none',
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        backgroundColor: `${seedCfg.color}18`,
        border: `1.5px solid ${seedCfg.color}`,
        display: 'grid', placeItems: 'center',
        fontSize: '0.72rem', fontWeight: 800, color: seedCfg.color,
      }}>
        {rec.seed_source === 'HYBRID' ? 'H' : rec.seed_source === 'INBRED' ? 'I' : 'O'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{rec.farmer_name}</p>
          <span style={{ backgroundColor: seedCfg.bg, color: seedCfg.color, border: `1px solid ${seedCfg.border}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.65rem', fontWeight: 700 }}>
            {seedCfg.label}
          </span>
          <span style={{ backgroundColor: utilStatus.bg, color: utilStatus.color, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.65rem', fontWeight: 700 }}>
            {m.utilization_pct !== null ? `${fmtNum(m.utilization_pct, 1)}% util` : utilStatus.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569' }}>
          {rec.variety} · {rec.harvest_date}
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Area', value: `${fmtNum(rec.harvest_area_ha)} ha` },
            { label: 'Bags', value: fmtNum(rec.harvest_bags, 0) },
            { label: 'MT', value: fmtNum(m.harvest_mt) },
            { label: 't/ha', value: fmtNum(m.yield_t_ha) },
          ].map(s => (
            <span key={s.label} style={{ fontSize: '0.72rem', color: '#64748b' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{s.value}</span> {s.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
        <button onClick={() => onEdit(rec)}
          style={{ padding: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem', cursor: 'pointer', color: '#475569' }}>
          <Edit3 size={14} />
        </button>
        <button onClick={() => onDelete(rec.id)}
          style={{ padding: '0.5rem', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '0.65rem', cursor: 'pointer', color: '#dc2626' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────
const BrgyHarvest = () => {
  const [records,  setRecords]  = useState([]);
  const [farmers,  setFarmers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);

  const [showForm,   setShowForm]   = useState(false);
  const [editData,   setEditData]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const [search,      setSearch]      = useState('');
  const [filterSeed,  setFilterSeed]  = useState('');
  const [activeTab,   setActiveTab]   = useState('records'); // 'records' | 'summary'

  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const pushToast = useCallback((msg, type = 'success') => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── LOAD ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Load farmers assigned to this BRGY's barangay
      const [farmersRes, recordsRes] = await Promise.allSettled([
        API.get('/distribution/farmers/search/?barangay=&search='),
        API.get('/production/harvest/').catch(() => ({ data: [] })),
      ]);

      if (farmersRes.status === 'fulfilled') {
        setFarmers(farmersRes.value.data || []);
      }
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
        pushToast('Harvest record saved successfully.');
      }
      setShowForm(false);
      setEditData(null);
      await loadData();
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object' && !detail.detail) {
        const first = Object.entries(detail)[0];
        pushToast(`${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}`, 'error');
      } else {
        pushToast(detail?.detail || detail?.error || 'Failed to save record. Please try again.', 'error');
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

  // ── FILTERED ──
  const filtered = records.filter(r => {
    const q = search.trim().toLowerCase();
    if (q && !(
      r.farmer_name?.toLowerCase().includes(q) ||
      r.variety?.toLowerCase().includes(q)
    )) return false;
    if (filterSeed && r.seed_source !== filterSeed) return false;
    return true;
  });

  // ── SUMMARY METRICS ──
  const total_area  = records.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
  const total_bags  = records.reduce((s, r) => s + (parseFloat(r.harvest_bags) || 0), 0);
  const total_mt    = total_bags * 50 / 1000;
  const avg_yield   = total_area > 0 ? total_mt / total_area : 0;
  const seed_breakdown = SEED_SOURCES.map(s => {
    const group = records.filter(r => r.seed_source === s.key);
    const a = group.reduce((sum, r) => sum + (parseFloat(r.harvest_area_ha) || 0), 0);
    const b = group.reduce((sum, r) => sum + (parseFloat(r.harvest_bags) || 0), 0);
    return { ...s, count: group.length, area: a, bags: b, mt: b * 50 / 1000 };
  });

  // ── OPEN ENCODE ──
  const openNew = () => { setEditData(null); setShowForm(true); };
  const openEdit = (rec) => {
    setEditData({
      id:               rec.id,
      farmer_id:        rec.farmer,
      seed_source:      rec.seed_source,
      variety:          rec.variety,
      harvest_area_ha:  rec.harvest_area_ha,
      harvest_bags:     rec.harvest_bags,
      harvest_date:     rec.harvest_date,
      seed_bags_received: rec.seed_bags_received || '',
      notes:            rec.notes || '',
    });
    setShowForm(true);
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes toastPop{0%{opacity:0;transform:translateX(-50%) scale(0.88)}70%{transform:translateX(-50%) scale(1.03)}100%{opacity:1;transform:translateX(-50%) scale(1)}}`}</style>
      <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading harvest records...</span>
    </div>
  );

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes toastPop{0%{opacity:0;transform:translateX(-50%) scale(0.88)}70%{transform:translateX(-50%) scale(1.03)}100%{opacity:1;transform:translateX(-50%) scale(1)}}
        @keyframes slideInBottom{0%{transform:translateY(100%);opacity:0}70%{transform:translateY(-6px);opacity:1}100%{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .harvest-row:hover{background-color:${GREEN.light}!important;}
        .tab-btn{transition:all 0.15s;}
        input:focus,select:focus,textarea:focus{border-color:${GREEN.primary}!important;box-shadow:0 0 0 3px ${GREEN.primary}18;}
      `}</style>

      <Toast toasts={toasts} />

      {/* ── HEADER ── */}
      <div style={{ padding: '1.25rem', paddingBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Harvest Records</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Encode and track barangay harvest data for your area
            </p>
          </div>
          <button onClick={openNew}
            style={{ padding: '0.625rem 1.25rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.45rem', boxShadow: `0 4px 16px ${GREEN.primary}40` }}>
            <Plus size={16} />
            Encode Harvest
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <MetricCard icon={<Users size={18} />} label='Total Farmers' value={records.length} sub='harvest records encoded' />
          <MetricCard icon={<Layers size={18} />} label='Total Area' value={`${fmtNum(total_area)} ha`} sub='harvested area' color={GREEN.accent} />
          <MetricCard icon={<BarChart3 size={18} />} label='Total Production' value={`${fmtNum(total_bags, 0)} bags`} sub={`${fmtNum(total_mt)} MT`} color='#2563eb' />
          <MetricCard icon={<ShieldCheck size={18} />} label='Avg. Yield' value={`${fmtNum(avg_yield)} t/ha`} sub='average across all records' color='#9333ea' />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.75rem', padding: '0.2rem', gap: '0.2rem', marginBottom: '1.25rem', width: 'fit-content' }}>
          {[
            { key: 'records', label: 'Records' },
            { key: 'summary', label: 'Summary' },
          ].map(t => (
            <button key={t.key} className='tab-btn'
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '0.4rem 1rem', borderRadius: '0.55rem', border: 'none',
                backgroundColor: activeTab === t.key ? 'white' : 'transparent',
                color: activeTab === t.key ? GREEN.primary : '#64748b',
                fontWeight: activeTab === t.key ? 700 : 500,
                fontSize: '0.82rem', cursor: 'pointer',
                boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search + filter */}
        {activeTab === 'records' && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '0.875rem 1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={16} color='#9ca3af' style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder='Search farmer or variety...'
                style={{ padding: '0.5rem 0.875rem 0.5rem 3rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.82rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {records.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={() => setFilterSeed('')}
                  style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${!filterSeed ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: !filterSeed ? GREEN.light : 'white', color: !filterSeed ? GREEN.primary : '#6b7280', fontWeight: !filterSeed ? 700 : 400, fontSize: '0.72rem', cursor: 'pointer' }}>
                  All ({records.length})
                </button>
                {SEED_SOURCES.map(s => {
                  const cnt = records.filter(r => r.seed_source === s.key).length;
                  return (
                    <button key={s.key} onClick={() => setFilterSeed(s.key)}
                      style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${filterSeed === s.key ? s.color : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: filterSeed === s.key ? s.bg : 'white', color: filterSeed === s.key ? s.color : '#6b7280', fontWeight: filterSeed === s.key ? 700 : 400, fontSize: '0.72rem', cursor: 'pointer' }}>
                      {s.label} ({cnt})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RECORDS TAB ── */}
      {activeTab === 'records' && (
        <div style={{ padding: '0 1.25rem' }}>
          {filtered.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6', animation: 'slideUp 0.3s ease' }}>
              <div style={{ display: 'grid', placeItems: 'center', width: 72, height: 72, borderRadius: '50%', backgroundColor: '#f8fafc', margin: '0 auto 0.75rem' }}>
                <Layers size={32} color='#94a3af' />
              </div>
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>
                {records.length === 0 ? 'No harvest records yet' : 'No matching records'}
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
                {records.length === 0
                  ? 'Start encoding harvest data for farmers in your barangay.'
                  : 'Try adjusting your search or filters.'}
              </p>
              {records.length === 0 && (
                <button onClick={openNew}
                  style={{ padding: '0.625rem 1.25rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                  + Encode First Record
                </button>
              )}
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6', overflow: 'hidden', animation: 'slideUp 0.3s ease' }}>
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a' }}>
                  {filtered.length} record{filtered.length !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Use the edit and delete buttons to update or remove records.</span>
              </div>
              {filtered.map((rec, idx) => (
                <div key={rec.id} className='harvest-row'
                  style={{ backgroundColor: 'white', transition: 'background 0.15s' }}>
                  <HarvestRow
                    rec={rec} idx={idx} total={filtered.length}
                    onEdit={openEdit}
                    onDelete={(id) => setConfirmDel(id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY TAB ── */}
      {activeTab === 'summary' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'slideUp 0.3s ease' }}>

          {/* Per-program breakdown */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Harvest by Seed Program
              </p>
            </div>
            {seed_breakdown.map(s => {
              const maxBags = Math.max(...seed_breakdown.map(x => x.bags), 1);
              const pct = Math.round((s.bags / maxBags) * 100);
              return (
                <div key={s.key} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s.color, display: 'inline-block' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{s.label}</span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{s.sublabel}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      {[
                        { label: 'Farmers', value: s.count },
                        { label: 'Area', value: `${fmtNum(s.area)} ha` },
                        { label: 'Bags', value: fmtNum(s.bags, 0) },
                        { label: 'MT', value: fmtNum(s.mt) },
                      ].map(m => (
                        <div key={m.label} style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{m.value}</p>
                          <p style={{ margin: 0, fontSize: '0.62rem', color: '#94a3b8' }}>{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, backgroundColor: s.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Overall Totals
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Farmers', value: records.length, color: '#0f172a' },
                { label: 'Area (ha)', value: fmtNum(total_area), color: GREEN.accent },
                { label: 'Total Bags', value: fmtNum(total_bags, 0), color: '#2563eb' },
                { label: 'Total (MT)', value: fmtNum(total_mt), color: '#7c3aed' },
                { label: 'Avg Yield (t/ha)', value: fmtNum(avg_yield), color: '#9333ea' },
              ].map(m => (
                <div key={m.label} style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', padding: '0.875rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: m.color }}>{m.value}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Utilization note */}
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ️</span>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '0.82rem', color: '#92400e' }}>Utilization Rate Computation</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#78350f', lineHeight: 1.6 }}>
                Hybrid: <strong>10 bags/ha</strong> · Certified Inbred: <strong>6 bags/ha</strong> · Farmer Saved Seed: not computed (no standard rate). Formula: <em>Seed Bags Received ÷ (Area × Rate) × 100%</em>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── ENCODE FORM BOTTOM SHEET ── */}
      {showForm && (
        <>
          <div onClick={() => { setShowForm(false); setEditData(null); }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 700, animation: 'fadeIn 0.2s ease' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: 'white',
            borderRadius: '1.5rem 1.5rem 0 0',
            padding: '1.5rem',
            zIndex: 800,
            maxHeight: 'calc(100vh - 2rem)',
            overflowY: 'auto',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
            animation: 'slideInBottom 0.3s cubic-bezier(0.34,1.1,0.64,1)',
            width: 'min(100%, 720px)',
            margin: '0 auto',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{ width: 44, height: 4, backgroundColor: '#e5e7eb', borderRadius: '999px', margin: '0 auto 1.25rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#111827' }}>
                  {editData ? 'Edit Harvest Record' : 'Encode Harvest Record'}
                </h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
                  All fields marked <span style={{ color: '#dc2626' }}>*</span> are required
                </p>
              </div>
              <button onClick={() => { setShowForm(false); setEditData(null); }}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '999px', width: 38, height: 38, cursor: 'pointer', fontSize: '1.1rem', display: 'grid', placeItems: 'center', color: '#374151', flexShrink: 0 }}>
                ✕
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

      {/* ── CONFIRM DELETE DIALOG ── */}
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
            <div style={{ display: 'grid', placeItems: 'center', width: 54, height: 54, borderRadius: '50%', backgroundColor: '#fef2f2', margin: '0 auto 0.75rem' }}>
              <AlertTriangle size={26} color='#b91c1c' />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontWeight: 800, fontSize: '1rem', color: '#111827', textAlign: 'center' }}>
              Delete this harvest record?
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>
              This action cannot be undone. The data will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmDel(null)}
                style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', backgroundColor: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDel)} disabled={!!deleting}
                style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '0.875rem', backgroundColor: deleting ? '#fca5a5' : '#dc2626', color: 'white', fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BrgyHarvest;