// src/pages/at/CropMonitoring.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, ChevronRight, ChevronLeft, ChevronDown,
  CheckCircle, AlertCircle, Clock, Leaf,
  Plus, X, History, Snowflake, Sun,
  BarChart2,
} from 'lucide-react';
import {
  getATFarmers,
  getATDashboardStats,
  createCropRecord,
  updateCropRecord,
  getFarmerCropHistory,
  getFinalSeeds,
  getATMonitoringHistory,
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

const PHASES = [
  { key: 'ESTABLISHMENT', label: 'Crop Establishment', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'TILLERING',     label: 'Tillering',          color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'FLOWERING',     label: 'Flowering',          color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff' },
  { key: 'RIPENING',      label: 'Ripening',           color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
  { key: 'HARVESTING',    label: 'Harvesting',         color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
];

const PHASE_ORDER = ['ESTABLISHMENT', 'TILLERING', 'FLOWERING', 'RIPENING', 'HARVESTING'];
const DEFAULT_PHASE_CFG = { key: 'NONE', label: 'Not monitored', color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' };
const getPhaseCfg = (key) => PHASES.find(p => p.key === key) || DEFAULT_PHASE_CFG;

const STATUS_OPTIONS = [
  { key: 'NORMAL',  label: 'Normal' },
  { key: 'DELAYED', label: 'Delayed' },
  { key: 'DAMAGED', label: 'Damaged' },
];

const SEED_SOURCES = [
  { key: 'HYBRID',   label: 'Hybrid',    short: 'HY' },
  { key: 'INBRED',   label: 'Inbred',    short: 'IN' },
  { key: 'OWN_SEED', label: 'Own Seed',  short: 'OW' },
];

const ITEMS_PER_PAGE = 10;

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
const getNextAllowedPhase = (seedRecords, seedSource) => {
  if (!seedSource) return null;
  const rec = seedRecords?.[seedSource];
  if (!rec) return 'ESTABLISHMENT';
  const currentIndex = PHASE_ORDER.indexOf(rec.phase || rec.crop_phase);
  if (currentIndex === -1) return 'ESTABLISHMENT';
  if (currentIndex >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[currentIndex + 1];
};

const getCurrentPhase = (seedRecords, seedSource) => {
  if (!seedSource) return null;
  const rec = seedRecords?.[seedSource];
  if (!rec) return null;
  return rec.phase || rec.crop_phase;
};

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
    <div style={{ position: 'fixed', bottom: '5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 800, backgroundColor: toast.type === 'success' ? GREEN.primary : '#991b1b', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.875rem', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)', maxWidth: 'calc(100vw - 2rem)' }}>
      {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {toast.message}
    </div>
  );
};

// ─────────────────────────────────────────
// ENCODE FORM — HINDI BINAGO, BUO PA RIN
// ─────────────────────────────────────────
const EncodeForm = ({ farmer, editRecord, onSave, onClose, saving, showToast }) => {
  const [form, setForm] = useState({
    seed_source:       editRecord?.seed_source || '',
    crop_phase:        editRecord?.crop_phase || '',
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
  const [modalToast, setModalToast] = useState(null);
  const modalToastTimer = useRef(null);

  const showModalToast = (type, message) => {
    setModalToast({ type, message });
    if (modalToastTimer.current) clearTimeout(modalToastTimer.current);
    modalToastTimer.current = setTimeout(() => setModalToast(null), 3500);
  };

  // Auto-fill area_monitored_ha from crop establishment record when phase is not ESTABLISHMENT
  useEffect(() => {
    if (
      form.seed_source &&
      form.crop_phase &&
      form.crop_phase !== 'ESTABLISHMENT'
    ) {
      const establishmentArea = farmer.seed_records?.[form.seed_source]?.area_monitored_ha;
      if (establishmentArea && !form.area_monitored_ha) {
        setForm(p => ({ ...p, area_monitored_ha: String(establishmentArea) }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.seed_source, form.crop_phase]);

  const seedRecords = farmer.seed_records || {};
  const currentPhaseForSeed = getCurrentPhase(seedRecords, form.seed_source);
  const nextAllowedPhase = getNextAllowedPhase(seedRecords, form.seed_source);

  const inp = (hasErr) => ({
    padding: '0.625rem 0.875rem',
    border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem',
    width: '100%', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', backgroundColor: 'white',
  });

  const validate = () => {
    const errs = {};
    if (!form.seed_source)   errs.seed_source = 'Seed source is required';
    if (!form.crop_phase)    errs.crop_phase = 'Select a crop phase';
    if (!form.phase_status)  errs.phase_status = 'Status is required';
    if (form.crop_phase === 'ESTABLISHMENT' && !form.crop_establishment)
      errs.crop_establishment = 'Required for Establishment phase';
    if (form.phase_status === 'DELAYED' && !form.delay_days)
      errs.delay_days = 'Delay duration is required';
    if (form.phase_status === 'DAMAGED' && !form.damage_cause.trim())
      errs.damage_cause = 'Damage cause is required';
    if (!form.date_observed) errs.date_observed = 'Date observed is required';

    if (form.seed_source && form.crop_phase) {
      const submittedIndex = PHASE_ORDER.indexOf(form.crop_phase);
      const currentIndex   = PHASE_ORDER.indexOf(currentPhaseForSeed);
      const allowed = !currentPhaseForSeed
        ? form.crop_phase === 'ESTABLISHMENT'
        : submittedIndex === currentIndex || submittedIndex === currentIndex + 1;
      if (!allowed) {
        const expectedLabel = !currentPhaseForSeed
          ? 'Crop Establishment'
          : getPhaseCfg(PHASE_ORDER[currentIndex + 1])?.label || '';
        errs.crop_phase = `Cannot skip phases. Please encode "${expectedLabel}" next.`;
      }
    }
    return errs;
  };

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({ ...form, farmer_id: farmer.id });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '1rem' }}>
      {/* Farmer info card */}
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
          {(() => {
            if (!form.seed_source) {
              return 'Select a seed type to view distribution info.';
            }
            if (form.seed_source === 'OWN_SEED') {
              return 'Own Seed — no distribution record needed.';
            }
            // For HYBRID or INBRED — look up distribution data per seed type
            const distInfo = farmer.distribution_by_seed_type?.[form.seed_source];
            if (distInfo) {
              return `Distributed: ${distInfo.seed_type_name} — ${distInfo.variety_name}`;
            }
            return `No seed distribution record found for ${form.seed_source === 'HYBRID' ? 'Hybrid' : 'Inbred'}.`;
          })()}
        </div>
      </div>

      {/* SEED SOURCE */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.75rem' }}>
          Seed Type <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {SEED_SOURCES.map(opt => {
            const sel = form.seed_source === opt.key;
            // Own Seed is always enabled
            // Hybrid/Inbred — disabled if farmer has no distribution data for that seed type
            const isOwnSeed = opt.key === 'OWN_SEED';
            const hasDistData = isOwnSeed
              ? true
              : !!(farmer.distribution_by_seed_type?.[opt.key]);
            const isDisabled = !isOwnSeed && !hasDistData;

            return (
              <button key={opt.key} type="button"
                onClick={() => {
                  if (isDisabled) {
                    showModalToast('error', `No seed distribution record for ${opt.label}. Cannot encode crop phase.`);
                    return;
                  }
                  setForm(p => ({ ...p, seed_source: opt.key, crop_phase: '' }));
                  setErrors(p => ({ ...p, seed_source: '', crop_phase: '' }));
                }}
                title={isDisabled ? `No distribution data for ${opt.label}` : ''}
                style={{
                  border: `2px solid ${sel ? '#16a34a' : isDisabled ? '#f3f4f6' : '#e2e8f0'}`,
                  borderRadius: '1rem',
                  backgroundColor: sel ? '#ecfdf5' : isDisabled ? '#f9fafb' : 'white',
                  color: sel ? '#166534' : isDisabled ? '#d1d5db' : '#334155',
                  fontWeight: 700,
                  padding: '0.95rem 0.85rem',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: isDisabled ? 0.6 : 1,
                  position: 'relative',
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
        {errors.seed_source && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.seed_source}</p>}
      </div>

      {/* CROP PHASE — sequential */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
          Crop Phase <span style={{ color: '#dc2626' }}>*</span>
        </label>
        {form.seed_source && currentPhaseForSeed && (
          <div style={{ fontSize: '0.72rem', color: '#475569', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle size={13} color="#16a34a" />
            Current phase: <strong>{getPhaseCfg(currentPhaseForSeed).label}</strong>
            {nextAllowedPhase
              ? <> · Next: <strong>{getPhaseCfg(nextAllowedPhase).label}</strong></>
              : <> · <strong>All phases completed!</strong></>}
          </div>
        )}
        {form.seed_source && !currentPhaseForSeed && (
          <div style={{ fontSize: '0.72rem', color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', marginBottom: '0.75rem' }}>
            No phase recorded yet — start with <strong>Crop Establishment</strong>.
          </div>
        )}
        {!form.seed_source && (
          <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: '0.75rem' }}>Select a seed source above to enable phase selection.</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.75rem' }}>
          {PHASES.map((phase) => {
            const phaseKey = phase.key;
            const sel = form.crop_phase === phaseKey;
            const phaseIndex = PHASE_ORDER.indexOf(phaseKey);
            const currentIndex = PHASE_ORDER.indexOf(currentPhaseForSeed);
            const isCompleted = currentPhaseForSeed && phaseIndex < currentIndex;
            const isCurrent   = currentPhaseForSeed && phaseKey === currentPhaseForSeed;
            const isNext      = nextAllowedPhase === phaseKey;
            const isFuture    = currentPhaseForSeed ? phaseIndex > currentIndex + 1 : phaseKey !== 'ESTABLISHMENT';
            const isClickable = isNext || (!currentPhaseForSeed && phaseKey === 'ESTABLISHMENT');

            const handleLockedClick = () => {
              if (!form.seed_source) return;
              if (isCompleted) showToast('error', `"${phase.label}" is already completed for this seed type.`);
              else if (isCurrent) showToast('error', `Already in "${phase.label}" phase. Encode the next phase to progress.`);
              else if (isFuture) {
                const nextLabel = nextAllowedPhase ? getPhaseCfg(nextAllowedPhase).label : '';
                showToast('error', `Please complete "${nextLabel}" first before skipping to "${phase.label}".`);
              }
            };

            return (
              <button key={phaseKey} type="button"
                onClick={() => {
                  if (!isClickable) { handleLockedClick(); return; }
                  setForm(p => {
                    const existingArea = farmer.seed_records?.[p.seed_source]?.area_monitored_ha || '';
                    return {
                      ...p,
                      crop_phase: phaseKey,
                      sowing_date: phaseKey === 'ESTABLISHMENT' ? p.sowing_date : '',
                      crop_establishment: phaseKey === 'ESTABLISHMENT' ? p.crop_establishment : '',
                      area_monitored_ha: p.area_monitored_ha || (phaseKey !== 'ESTABLISHMENT' ? existingArea : ''),
                    };
                  });
                  setErrors(p => ({ ...p, crop_phase: '', crop_establishment: '' }));
                }}
                style={{ minHeight: 68, border: `2px solid ${sel ? phase.color : isCurrent ? phase.color : isCompleted ? '#e5e7eb' : isNext ? '#16a34a' : !form.seed_source ? '#e5e7eb' : '#e5e7eb'}`, borderRadius: '1rem', backgroundColor: sel ? phase.bg : isCurrent ? phase.bg : isCompleted ? '#f9fafb' : isNext ? '#f0fdf4' : !form.seed_source ? '#f9fafb' : '#f9fafb', cursor: isClickable ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem', transition: 'all 0.2s', opacity: isFuture ? 0.45 : 1, boxShadow: sel ? '0 10px 22px rgba(37,99,235,0.08)' : 'none' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: isCompleted ? '#d1d5db' : isCurrent ? phase.color : isNext ? '#16a34a' : isFuture ? '#e5e7eb' : !form.seed_source ? '#d1d5db' : phase.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: '0.92rem', flex: 1, textAlign: 'left', color: isCompleted ? '#9ca3af' : isCurrent ? phase.color : isNext ? '#166534' : isFuture ? '#d1d5db' : !form.seed_source ? '#9ca3af' : '#334155' }}>
                  {phase.label}
                </span>
                {isCompleted && !sel && <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, color: '#9ca3af', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '999px', padding: '0.1rem 0.4rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}><CheckCircle size={10} /> Done</span>}
                {isCurrent && !sel && <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, color: phase.color, backgroundColor: phase.bg, border: `1px solid ${phase.border}`, borderRadius: '999px', padding: '0.1rem 0.4rem', flexShrink: 0 }}>Current</span>}
                {isNext && !sel && <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, color: '#166534', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '999px', padding: '0.1rem 0.4rem', flexShrink: 0 }}>Next</span>}
                {sel && <CheckCircle size={16} color={phase.color} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
        {errors.crop_phase && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.5rem 0 0' }}>{errors.crop_phase}</p>}
      </div>

      {/* OBSERVATION STATUS */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.75rem' }}>
          Observation Status <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
          {STATUS_OPTIONS.map(opt => {
            const sel = form.phase_status === opt.key;
            return (
              <button key={opt.key} type="button"
                onClick={() => { setForm(p => ({ ...p, phase_status: opt.key, delay_days: opt.key === 'DELAYED' ? p.delay_days : '', damage_cause: opt.key === 'DAMAGED' ? p.damage_cause : '', ...(opt.key === 'NORMAL' ? { delay_days: '', damage_cause: '' } : {}) })); setErrors(p => ({ ...p, phase_status: '', delay_days: '', damage_cause: '' })); }}
                style={{ border: `2px solid ${sel ? '#16a34a' : '#e2e8f0'}`, borderRadius: '1rem', backgroundColor: sel ? '#ecfdf5' : 'white', color: sel ? '#166534' : '#334155', fontWeight: 700, padding: '0.95rem 0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                {opt.label}
              </button>
            );
          })}
        </div>
        {errors.phase_status && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.5rem 0 0' }}>{errors.phase_status}</p>}
      </div>

      {form.phase_status === 'DELAYED' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>Delay Duration (days) <span style={{ color: '#dc2626' }}>*</span></label>
          <input type="number" step="1" min="0" value={form.delay_days} onChange={e => setForm(p => ({ ...p, delay_days: e.target.value }))} placeholder="e.g. 5" style={inp(!!errors.delay_days)} />
          {errors.delay_days && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.delay_days}</p>}
        </div>
      )}

      {form.phase_status === 'DAMAGED' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>Cause of Damage <span style={{ color: '#dc2626' }}>*</span></label>
          <input type="text" value={form.damage_cause} onChange={e => setForm(p => ({ ...p, damage_cause: e.target.value }))} placeholder="Pests, Typhoon, Flooding..." style={inp(!!errors.damage_cause)} />
          {errors.damage_cause && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.damage_cause}</p>}
        </div>
      )}

      {form.crop_phase === 'ESTABLISHMENT' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>Crop Establishment Method <span style={{ color: '#dc2626' }}>*</span></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {[{ key: 'DS', label: 'Direct Seeding (D)' }, { key: 'TP', label: 'Transplanting (T)' }].map(opt => {
              const sel = form.crop_establishment === opt.key;
              return (
                <button key={opt.key} type="button"
                  onClick={() => { setForm(p => ({ ...p, crop_establishment: opt.key })); setErrors(p => ({ ...p, crop_establishment: '' })); }}
                  style={{ border: `2px solid ${sel ? '#2563eb' : '#e2e8f0'}`, borderRadius: '1rem', backgroundColor: sel ? '#eff6ff' : 'white', color: sel ? '#1d4ed8' : '#334155', fontWeight: 700, padding: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errors.crop_establishment && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.crop_establishment}</p>}
        </div>
      )}

      {/* DATE + AREA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>Date Observed <span style={{ color: '#dc2626' }}>*</span></label>
          <input type="date" value={form.date_observed} onChange={e => { setForm(p => ({ ...p, date_observed: e.target.value })); setErrors(p => ({ ...p, date_observed: '' })); }} style={inp(!!errors.date_observed)} />
          {form.date_observed > new Date().toISOString().split('T')[0] && (
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#b45309', margin: '0.35rem 0 0' }}>
              <AlertCircle size={14} /> Future date — make sure this is intentional.
            </p>
          )}
          {errors.date_observed && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.date_observed}</p>}
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>
            Area Monitored (ha)
            {form.crop_phase && form.crop_phase !== 'ESTABLISHMENT' && farmer.seed_records?.[form.seed_source]?.area_monitored_ha && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', fontWeight: 600, color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '999px', padding: '0.1rem 0.45rem' }}>
                auto-filled
              </span>
            )}
          </label>
          <input type="number" step="0.01" min="0.01" value={form.area_monitored_ha}
            onChange={e => setForm(p => ({ ...p, area_monitored_ha: e.target.value }))}
            placeholder="e.g. 0.50" style={inp(false)} />
          {form.crop_phase && form.crop_phase !== 'ESTABLISHMENT' && farmer.seed_records?.[form.seed_source]?.area_monitored_ha && (
            <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
              Carried over from Crop Establishment. You can still edit if needed.
            </p>
          )}
        </div>
      </div>

      {form.crop_phase === 'ESTABLISHMENT' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>Sowing Date</label>
          <input type="date" value={form.sowing_date} onChange={e => setForm(p => ({ ...p, sowing_date: e.target.value }))} style={inp(false)} />
        </div>
      )}

      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.375rem' }}>Remarks / Field Notes (optional)</label>
        <textarea value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Any observations, issues, or notes..." rows={4} style={{ ...inp(false), resize: 'vertical', minHeight: 120 }} />
      </div>

      <button onClick={handleSubmit} disabled={saving}
        style={{ width: '100%', padding: '1rem', backgroundColor: saving ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '1rem', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: saving ? 'none' : `0 10px 24px ${GREEN.primary}40`, transition: 'all 0.2s' }}>
        {saving ? 'Saving...' : <><CheckCircle size={18} /> {editRecord ? 'Update Record' : 'Save Observation'}</>}
      </button>

      {/* In-modal toast — center bottom, fixed sa loob ng modal */}
      {modalToast && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 900, backgroundColor: modalToast.type === 'success' ? GREEN.primary : '#991b1b', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.875rem', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: 'modalToastIn 0.25s ease-out forwards' }}>
          {modalToast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {modalToast.message}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────
const CropMonitoring = () => {
  const [farmers,      setFarmers]      = useState([]);
  const [stats,        setStats]        = useState(null);
  const [activeSeason, setActiveSeason] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [searching,    setSearching]    = useState(false);

  // Filters
  const [search,       setSearch]       = useState('');
  const [phaseFilter,  setPhaseFilter]  = useState('');
  const [brgyFilter,   setBrgyFilter]   = useState('');
  const [barangays,    setBarangays]    = useState([]);

  // Pagination
  const [currentPage,  setCurrentPage]  = useState(1);

  // Encode panel
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [editRecord,     setEditRecord]     = useState(null);
  const [showPanel,      setShowPanel]      = useState(false);
  const [saving,         setSaving]         = useState(false);

  // History view
  const [showHistory,      setShowHistory]      = useState(false);
  const [histSeasonFilter, setHistSeasonFilter] = useState('');
  const [histYearFilter,   setHistYearFilter]   = useState('');
  const [histSearchTerm,   setHistSearchTerm]   = useState('');
  const [histRecords,      setHistRecords]      = useState([]);
  const [histLoading,      setHistLoading]      = useState(false);
  const [availablePolls,   setAvailablePolls]   = useState([]);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const searchTimer = useRef(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadHistory = useCallback(async (season, year, search) => {
    setHistLoading(true);
    try {
      const res = await getATMonitoringHistory({ season, year, search });
      setHistRecords(res.data?.records || []);
      if (res.data?.available_polls) {
        setAvailablePolls(res.data.available_polls);
      }
    } catch {
      showToast('error', 'Failed to load history.');
      setHistRecords([]);
    } finally {
      setHistLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (showHistory) {
      loadHistory(histSeasonFilter, histYearFilter, histSearchTerm);
    }
  }, [showHistory, histSeasonFilter, histYearFilter, histSearchTerm, loadHistory]);

  useEffect(() => {
    if (showHistory && availablePolls.length === 0) {
      loadHistory('', '', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory]);

  // ── LOAD DATA ──
  const loadData = useCallback(async (searchTerm, barangay, mode = 'load') => {
    try {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'search') setSearching(true);
      else setLoading(true);

      const [farmersRes, statsRes, seedRes] = await Promise.all([
        getATFarmers({ search: searchTerm, barangay }),
        getATDashboardStats(),
        getFinalSeeds().catch(() => ({ data: [] })),
      ]);

      setFarmers(farmersRes.data?.farmers || []);
      setBarangays(farmersRes.data?.barangays || []);
      setStats(statsRes.data);

      const seeds = seedRes.data || [];
      if (seeds.length > 0) {
        setActiveSeason({
          season: seeds[0].season,
          season_display: seeds[0].season_display,
          year: seeds[0].year,
        });
      }
      // Reset to page 1 on any data reload
      setCurrentPage(1);
    } catch {
      showToast('error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSearching(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData(search, brgyFilter, 'load');
    return () => { clearTimeout(searchTimer.current); };
  }, [brgyFilter, loadData]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const handleSearch = (q) => {
    setSearch(q);
    setCurrentPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadData(q, brgyFilter, 'search'), 400);
  };

  // ── FILTERED + PAGINATED FARMERS ──
  const filteredFarmers = farmers.filter(f => {
    if (!phaseFilter) return true;
    if (phaseFilter === 'NONE') return !f.latest_phase;
    return f.latest_phase === phaseFilter;
  });

  const totalPages  = Math.ceil(filteredFarmers.length / ITEMS_PER_PAGE);
  const pageStart   = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageEnd     = pageStart + ITEMS_PER_PAGE;
  const pageFarmers = filteredFarmers.slice(pageStart, pageEnd);

  // Reset page when phase filter changes
  const handlePhaseFilter = (val) => { setPhaseFilter(val); setCurrentPage(1); };
  const handleBrgyFilter  = (val) => { setBrgyFilter(val);  setCurrentPage(1); };

  // ── ENCODE ──
  const openEncode = (farmer, record = null) => {
    setSelectedFarmer(farmer);
    setEditRecord(record);
    setShowPanel(true);
  };

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

  // ── SEASON BADGE ──
  const seasonLabel = activeSeason
    ? `${activeSeason.season_display} ${activeSeason.year}`
    : stats?.assigned_barangays
    ? 'Active Season'
    : null;

  const seasonIsWet = activeSeason?.season === 'WET';

  // ─────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#9ca3af' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes slideInBottom { 0% { transform: translateY(120%); opacity: 0; } 70% { transform: translateY(-8px); opacity: 1; } 100% { transform: translateY(0); opacity: 1; } }
        `}</style>
        <div style={{ width: 36, height: 36, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading crop monitoring...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // HISTORY VIEW — UI placeholder
  // ─────────────────────────────────────────
  if (showHistory) {
    const pollYears = [...new Set(availablePolls.map(p => p.year))].sort((a, b) => b - a);
    const pollSeasons = [...new Set(availablePolls.map(p => p.season))];

    return (
      <div style={{ paddingBottom: '5rem' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `}</style>
        <Toast toast={toast} />

        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.2s ease' }}>
          {/* Back nav */}
          <button onClick={() => setShowHistory(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <ChevronLeft size={15} /> Back to Monitoring
          </button>

          {/* Header */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Monitoring History</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              View past crop monitoring records by season and year
            </p>
          </div>

          {/* Filter bar */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.875rem' }}>
              Filter records
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>

              {/* Season dropdown */}
              <div style={{ flex: '1 1 140px', minWidth: 140 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Season
                </label>
                <div style={{ position: 'relative' }}>
                  <select value={histSeasonFilter} onChange={e => setHistSeasonFilter(e.target.value)}
                    style={{ width: '100%', padding: '0.625rem 2rem 0.625rem 0.875rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.85rem', color: '#111827', outline: 'none', backgroundColor: 'white', appearance: 'none', cursor: 'pointer' }}>
                    <option value="">All seasons</option>
                    {pollSeasons.length > 0 ? pollSeasons.map(s => (
                      <option key={s} value={s}>{s === 'WET' ? 'Wet Season' : s === 'DRY' ? 'Dry Season' : s}</option>
                    )) : (
                      <>
                        <option value="WET"> Wet Season</option>
                        <option value="DRY"> Dry Season</option>
                      </>
                    )}
                  </select>
                  <ChevronDown size={14} color="#9ca3af" style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Year dropdown */}
              <div style={{ flex: '1 1 110px', minWidth: 110 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Year
                </label>
                <div style={{ position: 'relative' }}>
                  <select value={histYearFilter} onChange={e => setHistYearFilter(e.target.value)}
                    style={{ width: '100%', padding: '0.625rem 2rem 0.625rem 0.875rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.85rem', color: '#111827', outline: 'none', backgroundColor: 'white', appearance: 'none', cursor: 'pointer' }}>
                    <option value="">All years</option>
                    {pollYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="#9ca3af" style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Search */}
              <div style={{ flex: '2 1 200px', minWidth: 200 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Search farmer
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input value={histSearchTerm} onChange={e => setHistSearchTerm(e.target.value)}
                    placeholder="Name or RSBSA..."
                    style={{ width: '100%', padding: '0.625rem 0.875rem 0.625rem 2.25rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }} />
                </div>
              </div>

              {/* Clear filters */}
              {(histSeasonFilter || histYearFilter || histSearchTerm) && (
                <button onClick={() => { setHistSeasonFilter(''); setHistYearFilter(''); setHistSearchTerm(''); }}
                  style={{ padding: '0.625rem 1rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', backgroundColor: 'white', color: '#6b7280', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                  <X size={13} /> Clear
                </button>
              )}
            </div>

            {/* Active filter summary */}
            {(histSeasonFilter || histYearFilter) && (
              <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>Showing:</span>
                {histSeasonFilter && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: histSeasonFilter === 'WET' ? '#0369a1' : '#92400e', backgroundColor: histSeasonFilter === 'WET' ? '#e0f2fe' : '#fef3c7', border: `1px solid ${histSeasonFilter === 'WET' ? '#bae6fd' : '#fde68a'}`, borderRadius: '999px', padding: '0.15rem 0.5rem' }}>
                    {histSeasonFilter === 'WET' ? ' Wet Season' : ' Dry Season'}
                  </span>
                )}
                {histYearFilter && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: GREEN.accent, backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '999px', padding: '0.15rem 0.5rem' }}>
                    {histYearFilter}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Table area */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 0.8fr 0.8fr', gap: 0, padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f3f4f6' }}>
              {['Farmer', 'Seed Type', 'Phase', 'Date', 'Area', 'Status'].map(col => (
                <span key={col} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col}</span>
              ))}
            </div>

            {histLoading ? (
              <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
                <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>Loading records...</p>
              </div>
            ) : histRecords.length === 0 ? (
              <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                <History size={28} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
                <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No records found</p>
                <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>Try adjusting your filters.</p>
              </div>
            ) : (
              (() => {
                const grouped = {};
                histRecords.forEach(rec => {
                  const key = `${rec.farmer}__${rec.seed_source || 'NONE'}`;
                  if (!grouped[key]) {
                    grouped[key] = {
                      farmer_name: rec.farmer_name,
                      farmer_id: rec.farmer,
                      barangay: rec.barangay,
                      seed_source: rec.seed_source,
                      records: [],
                    };
                  }
                  grouped[key].records.push(rec);
                });

                const SEED_LABEL = { HYBRID: 'Hybrid', INBRED: 'Inbred', OWN_SEED: 'Own Seed' };
                const SEED_COLOR = { HYBRID: '#1e40af', INBRED: GREEN.primary, OWN_SEED: '#b45309' };
                const SEED_BG = { HYBRID: '#eff6ff', INBRED: GREEN.light, OWN_SEED: '#fefce8' };
                const SEED_BDR = { HYBRID: '#bfdbfe', INBRED: GREEN.border, OWN_SEED: '#fde68a' };

                return Object.values(grouped).map((group, gIdx, arr) => (
                  <div key={`${group.farmer_id}-${group.seed_source}`} style={{ borderBottom: gIdx < arr.length - 1 ? '2px solid #f3f4f6' : 'none' }}>
                    <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#111827' }}>{group.farmer_name}</p>
                        <p style={{ margin: '0.1rem 0 0', fontSize: '0.68rem', color: '#9ca3af' }}>{group.barangay}</p>
                      </div>
                      <span style={{
                        backgroundColor: SEED_BG[group.seed_source] || '#f3f4f6',
                        color: SEED_COLOR[group.seed_source] || '#374151',
                        border: `1px solid ${SEED_BDR[group.seed_source] || '#e5e7eb'}`,
                        borderRadius: '999px', padding: '0.15rem 0.625rem',
                        fontSize: '0.68rem', fontWeight: 700,
                      }}>
                        {SEED_LABEL[group.seed_source] || group.seed_source || 'Unknown'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#9ca3af', marginLeft: 'auto' }}>
                        {group.records.length} observation{group.records.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {group.records.map((rec, rIdx) => {
                      const phaseCfg = getPhaseCfg(rec.crop_phase);
                      return (
                        <div key={rec.id} style={{
                          display: 'grid',
                          gridTemplateColumns: '1.5fr 1fr 0.8fr 0.8fr',
                          gap: 0,
                          padding: '0.625rem 1.25rem 0.625rem 2.5rem',
                          borderBottom: rIdx < group.records.length - 1 ? '1px solid #f9fafb' : 'none',
                          alignItems: 'center',
                          backgroundColor: 'white',
                        }}>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700,
                            color: phaseCfg.color,
                            backgroundColor: phaseCfg.bg,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            border: `1px solid ${phaseCfg.border}`,
                            display: 'inline-block',
                            width: 'fit-content',
                          }}>
                            {phaseCfg.label}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                            {rec.date_observed
                              ? new Date(rec.date_observed + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#374151' }}>
                            {rec.area_monitored_ha ? `${rec.area_monitored_ha} ha` : '—'}
                          </span>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 700,
                            color: rec.phase_status === 'NORMAL' ? '#16a34a'
                              : rec.phase_status === 'DELAYED' ? '#ca8a04'
                              : '#dc2626',
                          }}>
                            {rec.phase_status || '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // MAIN MONITORING VIEW
  // ─────────────────────────────────────────
  return (
    <div style={{ paddingBottom: '5rem', position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideInBottom { 0% { transform: translateY(120%); opacity: 0; } 70% { transform: translateY(-8px); opacity: 1; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes modalToastIn { 0% { transform: translateX(-50%) translateY(20px); opacity: 0; } 70% { transform: translateX(-50%) translateY(-4px); opacity: 1; } 100% { transform: translateX(-50%) translateY(0); opacity: 1; } }
        .farmer-row:hover { background-color: ${GREEN.light} !important; }
      `}</style>

      <Toast toast={toast} />

      <div style={{ padding: '1.25rem', paddingBottom: 0 }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Crop Monitoring</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Record field observations for your assigned barangays
            </p>
          </div>

          {/* Active season badge — readonly */}
          {seasonLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: seasonIsWet ? '#e0f2fe' : '#fef3c7', border: `1px solid ${seasonIsWet ? '#bae6fd' : '#fde68a'}`, borderRadius: '999px', padding: '0.4rem 0.875rem' }}>
              {seasonIsWet
                ? <span style={{ fontSize: '0.78rem' }}></span>
                : <span style={{ fontSize: '0.78rem' }}></span>}
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: seasonIsWet ? '#0369a1' : '#92400e' }}>
                {seasonLabel}
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: seasonIsWet ? '#0284c7' : '#b45309', backgroundColor: seasonIsWet ? '#bae6fd' : '#fde68a', borderRadius: '999px', padding: '0.1rem 0.4rem' }}>
                Active
              </span>
            </div>
          )}
        </div>

        {/* ── STATS CARDS ── */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Assigned Barangays', value: stats.total_barangays,     color: GREEN.primary },
              { label: 'Total Farmers',      value: stats.total_farmers,       color: '#374151'     },
              { label: 'Monitored',          value: stats.monitored_farmers,   color: '#16a34a'     },
              { label: 'Not Yet Monitored',  value: stats.unmonitored_farmers, color: '#dc2626'     },
            ].map(({ label, value, color }, i) => (
              <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: `slideUp ${0.3 + i * 0.05}s ease` }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: '0 0 0.125rem', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.3 }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── SEARCH + FILTERS ── */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem', border: '1px solid #f3f4f6' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search farmer by name or RSBSA..."
              style={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Brgy filter + Phase filter + View History */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            {/* Brgy pills */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
              <button onClick={() => handleBrgyFilter('')}
                style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${!brgyFilter ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: !brgyFilter ? GREEN.light : 'white', color: !brgyFilter ? GREEN.primary : '#6b7280', fontWeight: !brgyFilter ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer' }}>
                All
              </button>
              {barangays.map(b => (
                <button key={b} onClick={() => handleBrgyFilter(b)}
                  style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${brgyFilter === b ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: brgyFilter === b ? GREEN.light : 'white', color: brgyFilter === b ? GREEN.primary : '#6b7280', fontWeight: brgyFilter === b ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer' }}>
                  {b}
                </button>
              ))}
            </div>

            {/* Phase filter + View History button */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 180 }}>
                <label style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
                  Phase filter
                </label>
                <select value={phaseFilter} onChange={e => handlePhaseFilter(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', backgroundColor: 'white', color: '#111827', fontSize: '0.82rem', outline: 'none', cursor: 'pointer' }}>
                  <option value="">All ({farmers.length})</option>
                  <option value="NONE">Not Monitored ({phaseCounts.NONE || 0})</option>
                  {PHASES.map(p => {
                    const count = phaseCounts[p.key] || 0;
                    if (count === 0) return null;
                    return <option key={p.key} value={p.key}>{p.label} ({count})</option>;
                  })}
                </select>
              </div>

              {/* View History button */}
              <div>
                <label style={{ fontSize: '0.68rem', color: 'transparent', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>·</label>
                <button onClick={() => setShowHistory(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.625rem 1rem', backgroundColor: 'white', border: `1.5px solid ${GREEN.border}`, borderRadius: '0.625rem', color: GREEN.accent, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <History size={14} /> View History
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FARMER LIST WITH PAGINATION ── */}
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

            {/* List header */}
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0, color: '#374151' }}>
                Farmers ({filteredFarmers.length})
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                Showing {pageStart + 1}–{Math.min(pageEnd, filteredFarmers.length)} of {filteredFarmers.length}
              </span>
            </div>

            {/* Farmer rows — paginated */}
            {pageFarmers.map((farmer, idx) => {
              const seedRecords = farmer.seed_records || {};
              const avatarCfg  = getPhaseCfg(farmer.latest_phase || 'NONE');
              return (
                <div key={farmer.id} className="farmer-row"
                  style={{ padding: '0.875rem 1.25rem', borderBottom: idx < pageFarmers.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', backgroundColor: 'white', transition: 'background 0.15s', cursor: 'pointer' }}
                  onClick={() => openEncode(farmer)}>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    {/* Avatar */}
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
                      <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.1rem 0 0.45rem' }}>
                        {farmer.barangay}
                      </p>

                      {/* Seed source phase pills */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {SEED_SOURCES.map(({ key, short }) => {
                          const rec = seedRecords[key];
                          if (!rec) {
                            return (
                              <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.22rem 0.45rem', borderRadius: '999px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', color: '#9ca3af', fontSize: '0.68rem', fontWeight: 700 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#cbd5e1', display: 'inline-block' }} />
                                {short}: —
                              </span>
                            );
                          }
                          const cfg = getPhaseCfg(rec.phase || rec.crop_phase);
                          return (
                            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.22rem 0.45rem', borderRadius: '999px', backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: '0.68rem', fontWeight: 700 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
                              {short}: {rec.phase_display || rec.phase || '—'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Encode button */}
                  <button onClick={e => { e.stopPropagation(); openEncode(farmer); }}
                    style={{ padding: '0.375rem 0.75rem', backgroundColor: GREEN.primary, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0, marginTop: '0.25rem' }}>
                    <Plus size={11} /> Encode
                  </button>
                </div>
              );
            })}

            {/* ── PAGINATION CONTROLS ── */}
            {totalPages > 1 && (
              <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem', border: `1.5px solid ${currentPage === 1 ? '#e5e7eb' : GREEN.border}`, borderRadius: '0.5rem', backgroundColor: currentPage === 1 ? '#f9fafb' : GREEN.light, color: currentPage === 1 ? '#d1d5db' : GREEN.accent, fontSize: '0.78rem', fontWeight: 700, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
                    <ChevronLeft size={14} /> Prev
                  </button>

                  {/* Page number pills */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '...'
                        ? <span key={`ellipsis-${idx}`} style={{ padding: '0.375rem 0.25rem', fontSize: '0.78rem', color: '#9ca3af' }}>…</span>
                        : <button key={p} onClick={() => setCurrentPage(p)}
                            style={{ padding: '0.375rem 0.625rem', border: `1.5px solid ${currentPage === p ? GREEN.primary : '#e5e7eb'}`, borderRadius: '0.5rem', backgroundColor: currentPage === p ? GREEN.primary : 'white', color: currentPage === p ? 'white' : '#374151', fontSize: '0.78rem', fontWeight: currentPage === p ? 700 : 400, cursor: 'pointer', minWidth: 34 }}>
                            {p}
                          </button>
                    )}

                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.375rem 0.75rem', border: `1.5px solid ${currentPage === totalPages ? '#e5e7eb' : GREEN.border}`, borderRadius: '0.5rem', backgroundColor: currentPage === totalPages ? '#f9fafb' : GREEN.light, color: currentPage === totalPages ? '#d1d5db' : GREEN.accent, fontSize: '0.78rem', fontWeight: 700, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ENCODE BOTTOM SHEET — HINDI BINAGO ── */}
      {showPanel && selectedFarmer && (
        <>
          <div onClick={() => { setShowPanel(false); setSelectedFarmer(null); setEditRecord(null); }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 700, animation: 'fadeIn 0.2s ease' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', zIndex: 800, maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', animation: 'slideInBottom 0.3s cubic-bezier(0.34,1.1,0.64,1)', width: 'min(100%, 720px)', margin: '0 auto', boxShadow: '0 32px 80px rgba(15,23,42,0.14)' }}>
            <div style={{ width: 44, height: 4, backgroundColor: '#e5e7eb', borderRadius: '999px', margin: '0 auto 1.25rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.6rem', margin: 0, color: '#111827', lineHeight: 1.05 }}>
                {editRecord ? 'Update observation details' : 'Record Crop Phase'}
              </h2>
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
              showToast={showToast}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default CropMonitoring;
