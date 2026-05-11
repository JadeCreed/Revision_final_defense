// src/pages/at/CropMonitoring.jsx
// AT encodes crop phase observations per farmer.
// Shows all assigned farmers with their latest phase, search + filter,
// and a bottom-sheet encode form on mobile / side panel on desktop.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Filter, ChevronRight, ChevronDown,
  CheckCircle, AlertCircle, Clock, Leaf,
  Edit2, Plus, X, MapPin, Users,
  BarChart2, RefreshCw,
} from 'lucide-react';
import {
  getATFarmers,
  getATDashboardStats,
  createCropRecord,
  updateCropRecord,
  getFarmerCropHistory,
} from '../../api/axios';

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const GREEN = {
  primary: '#1a4d1a',
  light:   '#f0fdf4',
  border:  '#bbf7d0',
  accent:  '#166534',
  soft:    '#dcfce7',
};

// Each phase has a color, label, and icon char for the map
const PHASES = [
  { key: 'DISTRIBUTION',  label: 'Seed Distribution',  color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { key: 'ESTABLISHMENT', label: 'Crop Establishment', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'TILLERING',     label: 'Tillering',          color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'FLOWERING',     label: 'Flowering',          color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff' },
  { key: 'RIPENING',      label: 'Ripening',           color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
  { key: 'HARVESTING',    label: 'Harvesting',         color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
];

const getPhaseCfg = (key) => PHASES.find(p => p.key === key) || PHASES[0];

// ─────────────────────────────────────────
// SHARED SMALL COMPONENTS
// ─────────────────────────────────────────

const PhaseBadge = ({ phase, size = 'md' }) => {
  if (!phase) return (
    <span style={{ backgroundColor: '#f9fafb', color: '#9ca3af', padding: size === 'sm' ? '0.1rem 0.5rem' : '0.2rem 0.625rem', borderRadius: '999px', fontSize: size === 'sm' ? '0.65rem' : '0.72rem', fontWeight: 700, border: '1px solid #e5e7eb' }}>
      Not monitored
    </span>
  );
  const cfg = getPhaseCfg(phase);
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, padding: size === 'sm' ? '0.1rem 0.5rem' : '0.2rem 0.625rem', borderRadius: '999px', fontSize: size === 'sm' ? '0.65rem' : '0.72rem', fontWeight: 700, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
};

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 800,
      backgroundColor: toast.type === 'success' ? GREEN.primary : '#991b1b',
      color: 'white', padding: '0.75rem 1.5rem',
      borderRadius: '0.875rem', fontWeight: 600, fontSize: '0.875rem',
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      maxWidth: 'calc(100vw - 2rem)',
      zIndex: 900,
    }}>
      {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {toast.message}
    </div>
  );
};

// ─────────────────────────────────────────
// ENCODE FORM (bottom sheet / modal)
// ─────────────────────────────────────────
const EncodeForm = ({ farmer, editRecord, onSave, onClose, saving }) => {
  const [form, setForm] = useState({
    crop_phase:        editRecord?.crop_phase || '',
    crop_establishment:editRecord?.crop_establishment || '',
    area_monitored_ha: editRecord?.area_monitored_ha || '',
    sowing_date:       editRecord?.sowing_date || '',
    variety_name:      editRecord?.variety_name || '',
    remarks:           editRecord?.remarks || '',
    date_observed:     editRecord?.date_observed || new Date().toISOString().split('T')[0],
  });
  const [errors, setErrors] = useState({});

  const inp = (hasErr) => ({
    padding: '0.625rem 0.875rem',
    border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem',
    width: '100%', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', backgroundColor: 'white',
  });

  const validate = () => {
    const errs = {};
    if (!form.crop_phase)    errs.crop_phase = 'Phase is required';
    if (!form.date_observed) errs.date_observed = 'Date observed is required';
    if (form.crop_phase === 'ESTABLISHMENT' && !form.crop_establishment)
      errs.crop_establishment = 'Required for Establishment phase';
    return errs;
  };

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({ ...form, farmer_id: farmer.id });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>
      {/* Farmer info */}
      <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.75rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: GREEN.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
          {farmer.last_name?.[0]?.toUpperCase()}{farmer.first_name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a1a', margin: 0 }}>{farmer.full_name}</p>
          <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.125rem 0 0' }}>
            {farmer.rsbsa_number || 'No RSBSA'} · Brgy. {farmer.barangay}
          </p>
        </div>
      </div>

      {/* Phase selector */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
          Crop Phase <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {PHASES.map(phase => {
            const sel = form.crop_phase === phase.key;
            return (
              <button key={phase.key} type="button"
                onClick={() => { setForm(p => ({ ...p, crop_phase: phase.key })); setErrors(p => ({ ...p, crop_phase: '' })); }}
                style={{ padding: '0.625rem 1rem', border: `2px solid ${sel ? phase.color : '#e5e7eb'}`, borderRadius: '0.625rem', backgroundColor: sel ? phase.bg : 'white', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.625rem', transition: 'all 0.15s' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: phase.color, flexShrink: 0 }} />
                <span style={{ fontWeight: sel ? 700 : 400, fontSize: '0.875rem', color: sel ? phase.color : '#374151' }}>
                  {phase.label}
                </span>
                {sel && <CheckCircle size={14} color={phase.color} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </div>
        {errors.crop_phase && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.crop_phase}</p>}
      </div>

      {/* Crop establishment — required when phase is ESTABLISHMENT */}
      {form.crop_phase === 'ESTABLISHMENT' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
            Crop Establishment Method <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[{ key: 'DS', label: 'Direct Seeding (D)' }, { key: 'TP', label: 'Transplanting (T)' }].map(opt => {
              const sel = form.crop_establishment === opt.key;
              return (
                <button key={opt.key} type="button"
                  onClick={() => { setForm(p => ({ ...p, crop_establishment: opt.key })); setErrors(p => ({ ...p, crop_establishment: '' })); }}
                  style={{ flex: 1, padding: '0.5rem', border: `2px solid ${sel ? '#2563eb' : '#e5e7eb'}`, borderRadius: '0.5rem', backgroundColor: sel ? '#eff6ff' : 'white', cursor: 'pointer', fontWeight: sel ? 700 : 400, fontSize: '0.8rem', color: sel ? '#2563eb' : '#374151', transition: 'all 0.15s' }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errors.crop_establishment && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.crop_establishment}</p>}
        </div>
      )}

      {/* Date observed */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
          Date Observed <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input type="date" value={form.date_observed}
          onChange={e => { setForm(p => ({ ...p, date_observed: e.target.value })); setErrors(p => ({ ...p, date_observed: '' })); }}
          max={new Date().toISOString().split('T')[0]}
          style={inp(!!errors.date_observed)} />
        {errors.date_observed && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.date_observed}</p>}
      </div>

      {/* Optional fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Area Monitored (ha)</label>
          <input type="number" step="0.01" min="0.01" value={form.area_monitored_ha}
            onChange={e => setForm(p => ({ ...p, area_monitored_ha: e.target.value }))}
            placeholder="e.g. 0.50" style={inp(false)} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Sowing Date</label>
          <input type="date" value={form.sowing_date}
            onChange={e => setForm(p => ({ ...p, sowing_date: e.target.value }))}
            style={inp(false)} />
        </div>
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Variety Name</label>
        <input type="text" value={form.variety_name}
          onChange={e => setForm(p => ({ ...p, variety_name: e.target.value }))}
          placeholder="e.g. TH 82, RC 216" style={inp(false)} />
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Remarks / Field Notes</label>
        <textarea value={form.remarks}
          onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
          placeholder="Any observations, issues, or notes..."
          rows={3}
          style={{ ...inp(false), resize: 'vertical' }} />
      </div>

      <button onClick={handleSubmit} disabled={saving}
        style={{ width: '100%', padding: '0.9375rem', backgroundColor: saving ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: saving ? 'none' : `0 4px 16px ${GREEN.primary}40`, transition: 'all 0.2s' }}>
        {saving ? 'Saving...' : <><CheckCircle size={18} /> {editRecord ? 'Update Record' : 'Save Observation'}</>}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────
const CropMonitoring = () => {
  const [farmers,      setFarmers]      = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  // Filters
  const [search,       setSearch]       = useState('');
  const [phaseFilter,  setPhaseFilter]  = useState('');
  const [brgyFilter,   setBrgyFilter]   = useState('');
  const [barangays,    setBarangays]    = useState([]);

  // Encode panel
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [editRecord,     setEditRecord]     = useState(null);
  const [showPanel,      setShowPanel]      = useState(false);
  const [saving,         setSaving]         = useState(false);

  // History panel
  const [showHistory,    setShowHistory]    = useState(false);
  const [historyData,    setHistoryData]    = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── LOAD ──
  const loadData = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const [farmersRes, statsRes] = await Promise.all([
        getATFarmers({ search, barangay: brgyFilter }),
        getATDashboardStats(),
      ]);
      const farmersData = farmersRes.data?.farmers || [];
      setFarmers(farmersData);
      setBarangays(farmersRes.data?.barangays || []);
      setStats(statsRes.data);
    } catch {
      showToast('error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, brgyFilter, showToast]);

  useEffect(() => { loadData(); }, [brgyFilter]);

  // Debounced search
  const searchTimer = useRef(null);
  const handleSearch = (q) => {
    setSearch(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadData(), 400);
  };

  // ── FILTERED FARMERS ──
  const filteredFarmers = farmers.filter(f => {
    if (!phaseFilter) return true;
    if (phaseFilter === 'NONE') return !f.latest_phase;
    return f.latest_phase === phaseFilter;
  });

  // ── OPEN ENCODE FORM ──
  const openEncode = (farmer, record = null) => {
    setSelectedFarmer(farmer);
    setEditRecord(record);
    setShowPanel(true);
    setShowHistory(false);
  };

  // ── OPEN HISTORY ──
  const openHistory = async (farmer) => {
    setSelectedFarmer(farmer);
    setShowHistory(true);
    setShowPanel(false);
    setHistoryLoading(true);
    try {
      const res = await getFarmerCropHistory(farmer.id);
      setHistoryData(res.data);
    } catch {
      showToast('error', 'Failed to load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── SAVE RECORD ──
  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editRecord) {
        await updateCropRecord(editRecord.id, formData);
        showToast('success', 'Record updated successfully.');
      } else {
        await createCropRecord(formData);
        showToast('success', `${selectedFarmer.full_name} — phase recorded.`);
      }
      setShowPanel(false);
      setSelectedFarmer(null);
      setEditRecord(null);
      await loadData(true);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  // Phase count for filter badges
  const phaseCounts = farmers.reduce((acc, f) => {
    const key = f.latest_phase || 'NONE';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // ─────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#9ca3af' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes slideInBottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>
        <div style={{ width: 36, height: 36, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading crop monitoring...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <div style={{ paddingBottom: '5rem', position: 'relative' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideInBottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .farmer-row:hover { background-color: ${GREEN.light} !important; }
      `}</style>

      <Toast toast={toast} />

      {/* ── HEADER ── */}
      <div style={{ padding: '1.25rem', paddingBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Crop Monitoring</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Record field observations for your assigned barangays
            </p>
          </div>
          <button onClick={() => loadData(true)} disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', backgroundColor: GREEN.light, color: GREEN.accent, border: `1px solid ${GREEN.border}`, borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Assigned Barangays', value: stats.total_barangays, color: GREEN.primary },
              { label: 'Total Farmers',       value: stats.total_farmers,   color: '#374151' },
              { label: 'Monitored',           value: stats.monitored_farmers, color: '#16a34a' },
              { label: 'Not Yet Monitored',   value: stats.unmonitored_farmers, color: '#dc2626' },
            ].map(({ label, value, color }, i) => (
              <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: `slideUp ${0.3 + i * 0.05}s ease` }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: '0 0 0.125rem', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.3 }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + Filters */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem', border: '1px solid #f3f4f6' }}>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search farmer by name or RSBSA..."
              style={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Barangay filter */}
          {barangays.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
              <button onClick={() => setBrgyFilter('')}
                style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${!brgyFilter ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: !brgyFilter ? GREEN.light : 'white', color: !brgyFilter ? GREEN.primary : '#6b7280', fontWeight: !brgyFilter ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer' }}>
                All
              </button>
              {barangays.map(b => (
                <button key={b} onClick={() => setBrgyFilter(b)}
                  style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${brgyFilter === b ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: brgyFilter === b ? GREEN.light : 'white', color: brgyFilter === b ? GREEN.primary : '#6b7280', fontWeight: brgyFilter === b ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer' }}>
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* Phase filter */}
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            <button onClick={() => setPhaseFilter('')}
              style={{ padding: '0.25rem 0.625rem', border: `1.5px solid ${!phaseFilter ? '#374151' : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: !phaseFilter ? '#1a1a1a' : 'white', color: !phaseFilter ? 'white' : '#6b7280', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
              All ({farmers.length})
            </button>
            {[{ key: 'NONE', label: 'Not Monitored', color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' }, ...PHASES].map(p => {
              const count = phaseCounts[p.key] || 0;
              if (count === 0) return null;
              return (
                <button key={p.key} onClick={() => setPhaseFilter(phaseFilter === p.key ? '' : p.key)}
                  style={{ padding: '0.25rem 0.625rem', border: `1.5px solid ${phaseFilter === p.key ? p.color : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: phaseFilter === p.key ? p.bg || '#f9fafb' : 'white', color: phaseFilter === p.key ? p.color : '#6b7280', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                  {p.key === 'NONE' ? 'Not Monitored' : p.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── FARMER LIST ── */}
      <div style={{ padding: '0 1.25rem' }}>
        {filteredFarmers.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
            <Leaf size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
            <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>
              {farmers.length === 0 ? 'No farmers assigned' : 'No results found'}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              {farmers.length === 0 ? 'Contact admin to assign barangays to your account.' : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>
                Farmers ({filteredFarmers.length})
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                Tap a farmer to encode
              </span>
            </div>

            {filteredFarmers.map((farmer, idx) => (
              <div key={farmer.id} className="farmer-row"
                style={{ padding: '0.875rem 1.25rem', borderBottom: idx < filteredFarmers.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', backgroundColor: 'white', transition: 'background 0.15s', cursor: 'pointer' }}
                onClick={() => openEncode(farmer)}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  {/* Phase color dot */}
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: getPhaseCfg(farmer.latest_phase).color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {farmer.full_name}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <PhaseBadge phase={farmer.latest_phase} size="sm" />
                      {farmer.latest_observed && (
                        <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                          {new Date(farmer.latest_observed).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  {farmer.latest_record_id && (
                    <button
                      onClick={e => { e.stopPropagation(); openHistory(farmer); }}
                      style={{ padding: '0.375rem 0.625rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={11} /> History
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); openEncode(farmer); }}
                    style={{ padding: '0.375rem 0.625rem', backgroundColor: GREEN.primary, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Plus size={11} /> Encode
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ENCODE BOTTOM SHEET ── */}
      {showPanel && selectedFarmer && (
        <>
          {/* Backdrop */}
          <div onClick={() => { setShowPanel(false); setSelectedFarmer(null); setEditRecord(null); }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 700, animation: 'fadeIn 0.2s ease' }} />
          {/* Sheet */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0',
            padding: '1.5rem', zIndex: 800,
            maxHeight: '92vh', overflowY: 'auto',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
            animation: 'slideInBottom 0.3s cubic-bezier(0.34,1.1,0.64,1)',
            maxWidth: '640px', margin: '0 auto',
          }}>
            {/* Handle */}
            <div style={{ width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: '999px', margin: '0 auto 1.25rem' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                {editRecord ? 'Edit Observation' : 'Record Crop Phase'}
              </h2>
              <button onClick={() => { setShowPanel(false); setSelectedFarmer(null); setEditRecord(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>

            <EncodeForm
              farmer={selectedFarmer}
              editRecord={editRecord}
              onSave={handleSave}
              onClose={() => { setShowPanel(false); setSelectedFarmer(null); setEditRecord(null); }}
              saving={saving}
            />
          </div>
        </>
      )}

      {/* ── HISTORY BOTTOM SHEET ── */}
      {showHistory && selectedFarmer && (
        <>
          <div onClick={() => { setShowHistory(false); setSelectedFarmer(null); setHistoryData(null); }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 700, animation: 'fadeIn 0.2s ease' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0',
            padding: '1.5rem', zIndex: 800,
            maxHeight: '85vh', overflowY: 'auto',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
            animation: 'slideInBottom 0.3s cubic-bezier(0.34,1.1,0.64,1)',
            maxWidth: '640px', margin: '0 auto',
          }}>
            <div style={{ width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: '999px', margin: '0 auto 1.25rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Monitoring History</h2>
                {historyData && (
                  <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                    {historyData.farmer_name} · Brgy. {historyData.barangay}
                  </p>
                )}
              </div>
              <button onClick={() => { setShowHistory(false); setSelectedFarmer(null); setHistoryData(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
                Loading history...
              </div>
            ) : historyData?.records?.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>No monitoring records yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {historyData?.records?.map((rec, idx) => {
                  const cfg = getPhaseCfg(rec.crop_phase);
                  return (
                    <div key={rec.id} style={{ backgroundColor: cfg.bg, borderRadius: '0.875rem', padding: '0.875rem 1rem', border: `1px solid ${cfg.border}`, animation: `slideUp ${0.2 + idx * 0.04}s ease` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <PhaseBadge phase={rec.crop_phase} />
                        <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                          {new Date(rec.date_observed).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {rec.area_monitored_ha && (
                        <p style={{ fontSize: '0.78rem', color: '#374151', margin: '0 0 0.25rem' }}>
                          Area: {rec.area_monitored_ha} ha
                          {rec.crop_establishment && ` · ${rec.crop_establishment === 'DS' ? 'Direct Seeding' : 'Transplanting'}`}
                        </p>
                      )}
                      {rec.sowing_date && (
                        <p style={{ fontSize: '0.78rem', color: '#374151', margin: '0 0 0.25rem' }}>
                          Sowing Date: {new Date(rec.sowing_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                      {rec.remarks && (
                        <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.375rem 0 0', fontStyle: 'italic' }}>
                          "{rec.remarks}"
                        </p>
                      )}
                      <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.5rem 0 0' }}>
                        Reported by {rec.encoded_by_name}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => { setShowHistory(false); openEncode(selectedFarmer); }}
              style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Plus size={16} /> Encode New Observation
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CropMonitoring;