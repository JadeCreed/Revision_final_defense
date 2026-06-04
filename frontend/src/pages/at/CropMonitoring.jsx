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
  { key: 'ESTABLISHMENT', label: 'Crop Establishment', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'TILLERING',     label: 'Tillering',          color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'FLOWERING',     label: 'Flowering',          color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff' },
  { key: 'RIPENING',      label: 'Ripening',           color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
  { key: 'HARVESTING',    label: 'Harvesting',         color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
];

const DEFAULT_PHASE_CFG = { key: 'NONE', label: 'Not monitored', color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' };
const getPhaseCfg = (key) => PHASES.find(p => p.key === key) || DEFAULT_PHASE_CFG;

const STATUS_OPTIONS = [
  { key: 'NORMAL',  label: 'Normal' },
  { key: 'DELAYED', label: 'Delayed' },
  { key: 'DAMAGED', label: 'Damaged' },
];

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
    seed_source:       editRecord?.seed_source || '',
    crop_establishment:editRecord?.crop_establishment || '',
    phase_status:      editRecord?.phase_status || 'NORMAL',
    delay_days:        editRecord?.delay_days ?? '',
    damage_cause:      editRecord?.damage_cause || '',
    area_monitored_ha: editRecord?.area_monitored_ha || '',
    sowing_date:       editRecord?.sowing_date || '',
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
    if (!form.phase_status)  errs.phase_status = 'Status is required';
    if (form.crop_phase === 'ESTABLISHMENT' && !form.crop_establishment)
      errs.crop_establishment = 'Required for Establishment phase';
    if (!form.seed_source)   errs.seed_source = 'Seed source is required';
    if (form.phase_status === 'DELAYED' && !form.delay_days)
      errs.delay_days = 'Delay duration is required';
    if (form.phase_status === 'DAMAGED' && !form.damage_cause.trim())
      errs.damage_cause = 'Damage cause is required';
    if (!form.date_observed) errs.date_observed = 'Date observed is required';
    return errs;
  };

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const payload = {
      ...form,
      farmer_id: farmer.id,
    };
    onSave(payload);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '1rem' }}>
      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1rem 1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: GREEN.primary, display: 'grid', placeItems: 'center', color: 'white', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
            {farmer.last_name?.[0]?.toUpperCase()}{farmer.first_name?.[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#111827' }}>{farmer.full_name}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#475569' }}>
              Farmer ID: {farmer.rsbsa_number || 'N/A'} · Brgy. {farmer.barangay}
            </p>
          </div>
        </div>
        <div style={{ marginTop: '0.9rem', color: '#475569', fontSize: '0.82rem' }}>
          {farmer.distributed_variety || farmer.distributed_seed_type ? (
            `Distributed: ${farmer.distributed_seed_type ? `${farmer.distributed_seed_type}${farmer.distributed_variety ? ' — ' : ''}` : ''}${farmer.distributed_variety || ''}`
          ) : 'Distributed variety not confirmed yet.'}
        </div>
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.75rem' }}>
          Crop Phase <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.75rem' }}>
          {PHASES.map(phase => {
            const sel = form.crop_phase === phase.key;
            return (
              <button key={phase.key} type="button"
                onClick={() => {
                  setForm(p => ({
                    ...p,
                    crop_phase: phase.key,
                    sowing_date: phase.key === 'ESTABLISHMENT' ? p.sowing_date : '',
                    crop_establishment: phase.key === 'ESTABLISHMENT' ? p.crop_establishment : '',
                  }));
                  setErrors(p => ({ ...p, crop_phase: '', crop_establishment: '' }));
                }}
                style={{
                  minHeight: 72,
                  border: `2px solid ${sel ? phase.color : '#e2e8f0'}`,
                  borderRadius: '1rem',
                  backgroundColor: sel ? phase.bg : 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.9rem',
                  transition: 'all 0.2s',
                  boxShadow: sel ? '0 10px 22px rgba(37,99,235,0.08)' : 'none',
                }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: phase.color, flexShrink: 0 }} />
                <span style={{ fontWeight: sel ? 700 : 600, fontSize: '0.92rem', color: sel ? '#0f172a' : '#334155' }}>{phase.label}</span>
                {sel && <CheckCircle size={16} color={phase.color} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </div>
        {errors.crop_phase && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.5rem 0 0' }}>{errors.crop_phase}</p>}
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.75rem' }}>
          Seed Source <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {[
            { key: 'HYBRID', label: 'Hybrid' },
            { key: 'INBRED', label: 'Inbred' },
            { key: 'OWN_SEED', label: 'Own Seed' },
          ].map(opt => {
            const sel = form.seed_source === opt.key;
            return (
              <button key={opt.key} type="button"
                onClick={() => {
                  setForm(p => ({ ...p, seed_source: opt.key }));
                  setErrors(p => ({ ...p, seed_source: '' }));
                }}
                style={{
                  border: `2px solid ${sel ? '#16a34a' : '#e2e8f0'}`,
                  borderRadius: '1rem',
                  backgroundColor: sel ? '#ecfdf5' : 'white',
                  color: sel ? '#166534' : '#334155',
                  fontWeight: 700,
                  padding: '0.95rem 0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
        {errors.seed_source && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.seed_source}</p>}
      </div>

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.75rem' }}>
          Observation Status <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
          {STATUS_OPTIONS.map(opt => {
            const sel = form.phase_status === opt.key;
            return (
              <button key={opt.key} type="button"
                onClick={() => {
                  setForm(p => ({
                    ...p,
                    phase_status: opt.key,
                    delay_days: opt.key === 'DELAYED' ? p.delay_days : '',
                    damage_cause: opt.key === 'DAMAGED' ? p.damage_cause : '',
                    ...(opt.key === 'NORMAL' ? { delay_days: '', damage_cause: '' } : {}),
                  }));
                  setErrors(p => ({ ...p, phase_status: '', delay_days: '', damage_cause: '' }));
                }}
                style={{
                  border: `2px solid ${sel ? '#16a34a' : '#e2e8f0'}`,
                  borderRadius: '1rem',
                  backgroundColor: sel ? '#ecfdf5' : 'white',
                  color: sel ? '#166534' : '#334155',
                  fontWeight: 700,
                  padding: '0.95rem 0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
        {errors.phase_status && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.5rem 0 0' }}>{errors.phase_status}</p>}
      </div>

      {form.phase_status === 'DELAYED' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Delay Duration (days) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type="number" step="1" min="0" value={form.delay_days}
            onChange={e => setForm(p => ({ ...p, delay_days: e.target.value }))}
            placeholder="e.g. 5" style={inp(!!errors.delay_days)} />
          {errors.delay_days && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.delay_days}</p>}
        </div>
      )}

      {form.phase_status === 'DAMAGED' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Cause of Damage <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type="text" value={form.damage_cause}
            onChange={e => setForm(p => ({ ...p, damage_cause: e.target.value }))}
            placeholder="Pests, Typhoon, Flooding..." style={inp(!!errors.damage_cause)} />
          {errors.damage_cause && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.damage_cause}</p>}
        </div>
      )}

      {form.crop_phase === 'ESTABLISHMENT' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Crop Establishment Method <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {[{ key: 'DS', label: 'Direct Seeding (D)' }, { key: 'TP', label: 'Transplanting (T)' }].map(opt => {
              const sel = form.crop_establishment === opt.key;
              return (
                <button key={opt.key} type="button"
                  onClick={() => { setForm(p => ({ ...p, crop_establishment: opt.key })); setErrors(p => ({ ...p, crop_establishment: '' })); }}
                  style={{
                    border: `2px solid ${sel ? '#2563eb' : '#e2e8f0'}`,
                    borderRadius: '1rem',
                    backgroundColor: sel ? '#eff6ff' : 'white',
                    color: sel ? '#1d4ed8' : '#334155',
                    fontWeight: 700,
                    padding: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errors.crop_establishment && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.crop_establishment}</p>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Date Observed <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type="date" value={form.date_observed}
            onChange={e => { setForm(p => ({ ...p, date_observed: e.target.value })); setErrors(p => ({ ...p, date_observed: '' })); }}
            max={new Date().toISOString().split('T')[0]}
            style={inp(!!errors.date_observed)} />
          {errors.date_observed && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.date_observed}</p>}
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Area Monitored (ha)
          </label>
          <input type="number" step="0.01" min="0.01" value={form.area_monitored_ha}
            onChange={e => setForm(p => ({ ...p, area_monitored_ha: e.target.value }))}
            placeholder="e.g. 0.50" style={inp(false)} />
        </div>
      </div>

      {form.crop_phase === 'ESTABLISHMENT' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Sowing Date
          </label>
          <input type="date" value={form.sowing_date}
            onChange={e => setForm(p => ({ ...p, sowing_date: e.target.value }))}
            style={inp(false)} />
        </div>
      )}

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
          Remarks / Field Notes (optional)
        </label>
        <textarea value={form.remarks}
          onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
          placeholder="Any observations, issues, or notes..."
          rows={4}
          style={{ ...inp(false), resize: 'vertical', minHeight: 120 }} />
      </div>

      <button onClick={handleSubmit} disabled={saving}
        style={{ width: '100%', padding: '1rem', backgroundColor: saving ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '1rem', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: saving ? 'none' : `0 10px 24px ${GREEN.primary}40`, transition: 'all 0.2s' }}>
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
  const [searching,    setSearching]    = useState(false);

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
  const toastTimer = useRef(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ── LOAD ──
  const loadData = useCallback(async (searchTerm, barangay, mode = 'load') => {
    try {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'search') setSearching(true);
      else setLoading(true);

      const [farmersRes, statsRes] = await Promise.all([
        getATFarmers({ search: searchTerm, barangay }),
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
      setSearching(false);
    }
  }, [showToast]);

  // Debounced search
  const searchTimer = useRef(null);

  useEffect(() => {
    loadData(search, brgyFilter, 'load');
    return () => { clearTimeout(searchTimer.current); };
  }, [brgyFilter, loadData]);

  const handleSearch = (q) => {
    setSearch(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadData(q, brgyFilter, 'search'), 400);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);


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
      if (formData.existingRecordId) {
        const { existingRecordId, ...payload } = formData;
        await updateCropRecord(existingRecordId, payload);
        showToast('success', 'Phase record updated successfully.');
      } else if (editRecord) {
        await updateCropRecord(editRecord.id, formData);
        showToast('success', 'Record updated successfully.');
      } else {
        try {
          await createCropRecord(formData);
          showToast('success', `${selectedFarmer.full_name} — phase recorded.`);
        } catch (err) {
          const existingId = err.response?.data?.existing_record_id;
          if (existingId) {
            await updateCropRecord(existingId, formData);
            showToast('success', 'Phase updated for this seed type.');
          } else {
            throw err;
          }
        }
      }
      setShowPanel(false);
      setSelectedFarmer(null);
      setEditRecord(null);
      await loadData(search, brgyFilter, 'load');
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

  const FarmerRow = ({ farmer, idx, openEncode, openHistory }) => {
    const seedRecords = farmer.seed_records || {};
    const avatarCfg = getPhaseCfg(farmer.latest_phase || 'NONE');

    return (
      <div key={farmer.id} className="farmer-row"
        style={{ padding: '0.875rem 1.25rem', borderBottom: idx < filteredFarmers.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', backgroundColor: 'white', transition: 'background 0.15s', cursor: 'pointer' }}
        onClick={() => openEncode(farmer)}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: avatarCfg.color, color: 'white', display: 'grid', placeItems: 'center', fontSize: '0.82rem', fontWeight: 800, flexShrink: 0 }}>
            {farmer.last_name?.[0]?.toUpperCase()}{farmer.first_name?.[0]?.toUpperCase()}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <p style={{ fontWeight: 800, fontSize: '0.92rem', color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {farmer.full_name}
              </p>
              {farmer.latest_observed && (
                <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
                  {new Date(farmer.latest_observed).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem' }}>
              {[
                { key: 'HYBRID', label: 'HY' },
                { key: 'INBRED', label: 'IN' },
                { key: 'OWN_SEED', label: 'OW' },
              ].map(({ key, label }) => {
                const rec = seedRecords[key];
                if (!rec) {
                  return (
                    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.22rem 0.45rem', borderRadius: '999px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.68rem', fontWeight: 700 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#cbd5e1', display: 'inline-block' }} />
                      {label} · No data
                    </span>
                  );
                }

                const cfg = getPhaseCfg(rec.phase || rec.crop_phase);
                return (
                  <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.22rem 0.45rem', borderRadius: '999px', backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: '0.68rem', fontWeight: 700 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
                    {label} · {rec.phase_display || rec.phase || 'Unknown'}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); openEncode(farmer); }}
            style={{ padding: '0.375rem 0.75rem', backgroundColor: GREEN.primary, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Plus size={11} /> Encode
          </button>
          {farmer.latest_record_id && (
            <button
              onClick={e => { e.stopPropagation(); openHistory(farmer); }}
              style={{ padding: '0.3rem 0.625rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600, color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={11} /> History
            </button>
          )}
        </div>
      </div>
    );
  };

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
          @keyframes slideInBottom {
            0% { transform: translateX(-50%) translateY(120%); opacity: 0; }
            70% { transform: translateX(-50%) translateY(-8px); opacity: 1; }
            100% { transform: translateX(-50%) translateY(0); opacity: 1; }
          }
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
    <div style={{ paddingBottom: '5rem', position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideInBottom {
          0% { transform: translateY(120%); opacity: 0; }
          70% { transform: translateY(-8px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
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
        </div>

        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Assigned Barangays', value: stats.total_barangays, color: GREEN.primary },
              { label: 'Total Farmers', value: stats.total_farmers, color: '#374151' },
              { label: 'Monitored', value: stats.monitored_farmers, color: '#16a34a' },
              { label: 'Not Yet Monitored', value: stats.unmonitored_farmers, color: '#dc2626' },
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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

            <div style={{ minWidth: 220, flex: '0 0 auto' }}>
              <label style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.45rem' }}>
                Phase filter
              </label>
              <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 0.9rem', borderRadius: '0.85rem', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#111827', fontSize: '0.875rem', outline: 'none' }}>
                <option value="">All ({farmers.length})</option>
                <option value="NONE">Not Monitored ({phaseCounts.NONE || 0})</option>
                {PHASES.map(p => {
                  const count = phaseCounts[p.key] || 0;
                  if (count === 0) return null;
                  return (
                    <option key={p.key} value={p.key}>{p.label} ({count})</option>
                  );
                })}
              </select>
            </div>
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
              <FarmerRow
                key={farmer.id}
                farmer={farmer}
                idx={idx}
                openEncode={openEncode}
                openHistory={openHistory}
              />
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
            backgroundColor: 'white', borderRadius: '1.5rem 1.5rem 0 0',
            padding: '1.5rem', zIndex: 800,
            maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
            animation: 'slideInBottom 0.3s cubic-bezier(0.34,1.1,0.64,1)',
            width: 'min(100%, 720px)', margin: '0 auto',
            boxShadow: '0 32px 80px rgba(15,23,42,0.14)',
          }}>
            {/* Handle */}
            <div style={{ width: 44, height: 4, backgroundColor: '#e5e7eb', borderRadius: '999px', margin: '0 auto 1.25rem' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.6rem', margin: '0.35rem 0 0', color: '#111827', lineHeight: 1.05 }}>
                  {editRecord ? 'Update observation details' : 'Record Crop Phase'}
                </h2>
              </div>
              <button onClick={() => { setShowPanel(false); setSelectedFarmer(null); setEditRecord(null); }}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '999px', width: 38, height: 38, cursor: 'pointer', color: '#374151', display: 'grid', placeItems: 'center' }}>
                <X size={18} />
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
                      {rec.seed_source && (
                        <p style={{ fontSize: '0.78rem', color: '#374151', margin: '0 0 0.25rem' }}>
                          Seed source: {rec.seed_source.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                      )}
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