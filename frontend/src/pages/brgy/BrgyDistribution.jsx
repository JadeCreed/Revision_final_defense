import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  Search, ChevronRight, ChevronLeft, CheckCircle,
  AlertCircle, Package, Clock, FileText,
  Edit2, Eye, Send, Users, XCircle, Lock,
} from 'lucide-react';
import {
  getDistributionEvents,
  getDistributionEvent,
  getEventBatches,
  getBatchDetail,
  encodeDistributionEntry,
  submitDistributionBatch,
  searchFarmers,
  getBrgyDistributionContext,
  getFinalSeeds,
  getFarmerDistributionDetail,
} from '../../api/axios';

// ── Constants ──
const GREEN = { primary: '#1a4d1a', light: '#f0fdf4', border: '#bbf7d0', accent: '#166534', soft: '#dcfce7' };

const isHybrid = (s = '') => { const n = s.toUpperCase(); return n.includes('HYBRID') || n === 'NRP' || n === 'RFO'; };
const isInbred = (s = '') => { const n = s.toUpperCase(); return n.includes('INBRED') || n === 'RCEF'; };

// ── Sub-components ──
const StatusBadge = ({ status }) => {
  const cfg = {
    DRAFT:     { bg: '#f9fafb', color: '#6b7280', label: 'Draft' },
    SUBMITTED: { bg: '#fef9c3', color: '#854d0e', label: 'Submitted' },
    APPROVED:  { bg: '#dcfce7', color: '#166534', label: 'Approved' },
    REJECTED:  { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
    PENDING:   { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
  }[status] || { bg: '#f9fafb', color: '#6b7280', label: status };
  return <span style={{ backgroundColor: cfg.bg, color: cfg.color, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{cfg.label}</span>;
};

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 600, backgroundColor: toast.type === 'success' ? GREEN.primary : '#991b1b', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.875rem', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', maxWidth: 'calc(100vw - 2rem)' }}>
      {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {toast.message}
    </div>
  );
};

const ConfirmSnack = ({ data, onConfirm, onCancel }) => {
  if (!data) return null;
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 600, width: 'min(100%, 420px)' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: `1px solid ${GREEN.border}` }}>
        <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 0.375rem' }}>{data.title}</p>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>{data.message}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 2, padding: '0.625rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700 }}>{data.confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
};

const SignatureModal = ({ sig, onClose }) => {
  if (!sig) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', maxWidth: '420px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, margin: 0 }}>Farmer Signature</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}>×</button>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
          <img src={sig} alt="signature" style={{ width: '100%', display: 'block' }} />
        </div>
      </div>
    </div>
  );
};

// ── Inbred Form Panel ──
const InbredPanel = ({ entry, form, setForm, errors, setErrors, saving, onSave, onCancel, inp }) => {
  const isEncoded = entry?.is_distribution_encoded;
  const isLocked = !entry;
  const areaPlanted   = parseFloat(entry?.area_planted || 0);
  const maxBags       = areaPlanted > 0 ? parseFloat((areaPlanted * 2).toFixed(2)) : null;
  const kgPerBag      = 20;
  const suggestedBags = maxBags;
  const suggestedKg   = suggestedBags !== null ? parseFloat((suggestedBags * kgPerBag).toFixed(2)) : null;
  const enteredBags   = parseFloat(form.number_of_bags || 0);
  const liveKg        = enteredBags > 0 ? parseFloat((enteredBags * kgPerBag).toFixed(2)) : null;
  const exceedsMax    = maxBags !== null && enteredBags > maxBags;

  const didAutoFill = useRef(false);
  useEffect(() => {
    if (!didAutoFill.current && suggestedBags !== null && !form.number_of_bags && !isEncoded && !isLocked) {
      setForm(prev => ({ ...prev, number_of_bags: String(suggestedBags) }));
      didAutoFill.current = true;
    }
  }, [form.number_of_bags, isEncoded, isLocked, setForm, suggestedBags]);

  if (isLocked) {
    return (
      <div style={{ flex: 1, minWidth: 0, backgroundColor: '#f9fafb', borderRadius: '1rem', padding: '1.5rem', border: '2px dashed #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '0.75rem' }}>
        <Lock size={32} color="#d1d5db" />
        <p style={{ fontWeight: 700, color: '#9ca3af', margin: 0, textAlign: 'center' }}>Inbred (PhilRice)</p>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>Farmer not in this batch</p>
      </div>
    );
  }

  if (isEncoded) {
    return (
      <div style={{ flex: 1, minWidth: 0, backgroundColor: GREEN.light, borderRadius: '1rem', padding: '1.5rem', border: `2px solid ${GREEN.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <CheckCircle size={20} color={GREEN.accent} />
          <span style={{ fontWeight: 700, color: GREEN.accent, fontSize: '0.95rem' }}>Inbred — Complete</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
          {[
            ['Area Planted', entry.area_planted ? `${entry.area_planted} ha` : '—'],
            ['No. of Bags', entry.qty_bags ?? '—'],
            ['Rice Variety', entry.variety_name || '—'],
            ['Crop Estab.', entry.crop_establishment || '—'],
            ['Sowing Date', entry.expected_sowing_date || '—'],
            ['Date Received', entry.date_received || '—'],
            ['Auth. Rep.', entry.authorized_representative || '—'],
            ['Data Sharing', entry.data_sharing ? 'Agreed' : 'No'],
          ].map(([label, value]) => (
            <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
              <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>{label}</p>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', border: '2px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '0.875rem', borderBottom: '1px solid #f3f4f6' }}>
        <FileText size={18} color="#1e40af" />
        <span style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.95rem' }}>Inbred (PhilRice)</span>
      </div>

      {/* Pre-filled from beneficiaries */}
      <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1.25rem' }}>
        <p style={{ fontWeight: 700, fontSize: '0.75rem', color: GREEN.accent, margin: '0 0 0.625rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <CheckCircle size={13} /> From Beneficiaries
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.375rem', padding: '0.375rem 0.625rem' }}>
            <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.1rem', fontWeight: 600, textTransform: 'uppercase' }}>Area Planted</p>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{entry.area_planted ? `${entry.area_planted} ha` : '—'}</p>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '0.375rem', padding: '0.375rem 0.625rem' }}>
            <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.1rem', fontWeight: 600, textTransform: 'uppercase' }}>Data Sharing</p>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: entry.data_sharing ? GREEN.accent : '#9ca3af', margin: 0 }}>{entry.data_sharing ? 'Agreed' : 'No'}</p>
          </div>
        </div>
      </div>

      {/* Distribution fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
            Number of Bags (20kg/bag) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          {suggestedBags !== null && (
            <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: '0 0 0.35rem' }}>
              Suggested: {suggestedBags} bag{suggestedBags !== 1 ? 's' : ''} ({suggestedKg}kg) · {areaPlanted}ha
            </p>
          )}
          <input type="number" min="1" value={form.number_of_bags || ''} onChange={e => { setForm(p => ({ ...p, number_of_bags: e.target.value })); setErrors(p => ({ ...p, number_of_bags: '' })); }} placeholder={suggestedBags !== null ? `e.g. ${suggestedBags}` : 'e.g. 1'} style={{ ...inp(!!errors.number_of_bags || exceedsMax), paddingRight: liveKg !== null ? '5.5rem' : '0.875rem' }} />
          {liveKg !== null && <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: '0.25rem 0 0' }}>{liveKg}kg</p>}
          {errors.number_of_bags && !exceedsMax && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.number_of_bags}</p>}
          {exceedsMax && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>Exceeds limit. Max {maxBags} bags ({maxBags * kgPerBag}kg) for {areaPlanted}ha.</p>}
        </div>
        {[
          { key: 'rice_variety_received', label: 'Rice Variety Received', type: 'text', placeholder: 'e.g. RC 216', required: true },
          { key: 'expected_sowing_date', label: 'Expected Sowing Date (Month/Week)', type: 'text', placeholder: 'e.g. June/2nd Week', required: true },
          { key: 'date_received', label: 'Date Received', type: 'date', placeholder: '', required: true },
          { key: 'authorized_representative', label: 'Authorized Representative', type: 'text', placeholder: 'Last Name, First Name, MI', required: false },
        ].map(({ key, label, type, placeholder, required }) => (
          <div key={key}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
              {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <input type={type} value={form[key] || ''} onChange={e => { setForm(p => ({ ...p, [key]: e.target.value })); setErrors(p => ({ ...p, [key]: '' })); }} placeholder={placeholder} style={inp(!!errors[key])} />
            {errors[key] && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors[key]}</p>}
          </div>
        ))}

        {/* Crop establishment */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
            Crop Establishment (D/T) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select value={form.crop_establishment || ''} onChange={e => { setForm(p => ({ ...p, crop_establishment: e.target.value })); setErrors(p => ({ ...p, crop_establishment: '' })); }} style={inp(!!errors.crop_establishment)}>
            <option value="">Select</option>
            <option value="DS">Direct Seeding (D)</option>
            <option value="TP">Transplanting (T)</option>
          </select>
          {errors.crop_establishment && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.crop_establishment}</p>}
        </div>

        {/* 2025 DS Yield placeholder */}
        <div style={{ backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '0.625rem', padding: '0.75rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 0.125rem' }}>2025 DS YIELD</p>
          <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>Harvest data will be encoded in Yield Encode after harvest.</p>
        </div>

        <button onClick={onSave} disabled={saving} style={{ width: '100%', padding: '0.75rem', backgroundColor: saving ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <CheckCircle size={16} /> {saving ? 'Saving...' : 'Confirm Seed Distributed'}
        </button>
      </div>
    </div>
  );
};

// ── Hybrid Form Panel ──
const HybridPanel = ({ entry, form, setForm, errors, setErrors, saving, onSave, inp }) => {
  const isEncoded = entry?.is_distribution_encoded;
  const isLocked = !entry;
  const farmArea      = parseFloat(entry?.farm_area_ha || 0);
  const maxBags       = farmArea > 0 ? parseFloat((farmArea * 1).toFixed(2)) : null;
  const kgPerBag      = 15;
  const suggestedBags = maxBags;
  const suggestedKg   = suggestedBags !== null ? parseFloat((suggestedBags * kgPerBag).toFixed(2)) : null;
  const enteredBags   = parseFloat(form.qty_bags || 0);
  const liveKg        = enteredBags > 0 ? parseFloat((enteredBags * kgPerBag).toFixed(2)) : null;
  const exceedsMax    = maxBags !== null && enteredBags > maxBags;

  const didAutoFill = useRef(false);
  useEffect(() => {
    if (!didAutoFill.current && suggestedBags !== null && !form.qty_bags && !isEncoded && !isLocked) {
      setForm(prev => ({ ...prev, qty_bags: String(suggestedBags) }));
      didAutoFill.current = true;
    }
  }, [form.qty_bags, isEncoded, isLocked, setForm, suggestedBags]);

  if (isLocked) {
    return (
      <div style={{ flex: 1, minWidth: 0, backgroundColor: '#f9fafb', borderRadius: '1rem', padding: '1.5rem', border: '2px dashed #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '0.75rem' }}>
        <Lock size={32} color="#d1d5db" />
        <p style={{ fontWeight: 700, color: '#9ca3af', margin: 0, textAlign: 'center' }}>Hybrid (Region)</p>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>Farmer not in this batch</p>
      </div>
    );
  }

  if (isEncoded) {
    return (
      <div style={{ flex: 1, minWidth: 0, backgroundColor: GREEN.light, borderRadius: '1rem', padding: '1.5rem', border: `2px solid ${GREEN.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <CheckCircle size={20} color={GREEN.accent} />
          <span style={{ fontWeight: 700, color: GREEN.accent, fontSize: '0.95rem' }}>Hybrid — Complete</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
          {[
            ['Farm Area', entry.farm_area_ha ? `${entry.farm_area_ha} ha` : '—'],
            ['QTY (bags)', entry.qty_bags ?? '—'],
            ['Variety', entry.variety_name || '—'],
            ['Date Received', entry.date_received || '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
              <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>{label}</p>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', border: '2px solid #bfdbfe', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '0.875rem', borderBottom: '1px solid #f3f4f6' }}>
        <FileText size={18} color="#1e40af" />
        <span style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.95rem' }}>Hybrid (Region)</span>
      </div>
      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1.25rem' }}>
        <p style={{ fontWeight: 700, fontSize: '0.75rem', color: '#1e40af', margin: '0 0 0.625rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <CheckCircle size={13} /> From Beneficiaries
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.375rem', padding: '0.375rem 0.625rem' }}>
            <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.1rem', fontWeight: 600, textTransform: 'uppercase' }}>Farm Area</p>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{entry.farm_area_ha ? `${entry.farm_area_ha} ha` : '—'}</p>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '0.375rem', padding: '0.375rem 0.625rem' }}>
            <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.1rem', fontWeight: 600, textTransform: 'uppercase' }}>Variety</p>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{entry.variety_name || '—'}</p>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
            QTY (bags) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          {suggestedBags !== null && (
            <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: '0 0 0.35rem' }}>
              Suggested: {suggestedBags} bag{suggestedBags !== 1 ? 's' : ''} ({suggestedKg}kg) · {farmArea}ha
            </p>
          )}
          <input type="number" min="1" value={form.qty_bags || ''} onChange={e => { setForm(p => ({ ...p, qty_bags: e.target.value })); setErrors(p => ({ ...p, qty_bags: '' })); }} placeholder={suggestedBags !== null ? `e.g. ${suggestedBags}` : 'Number of seed bags received'} style={{ ...inp(!!errors.qty_bags || exceedsMax), paddingRight: liveKg !== null ? '5.5rem' : '0.875rem' }} />
          {liveKg !== null && <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: '0.25rem 0 0' }}>{liveKg}kg</p>}
          {errors.qty_bags && !exceedsMax && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.qty_bags}</p>}
          {exceedsMax && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>Exceeds limit. Max {maxBags} bags ({maxBags * kgPerBag}kg) for {farmArea}ha.</p>}
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
            Date Received <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input type="date" value={form.date_received || ''} onChange={e => { setForm(p => ({ ...p, date_received: e.target.value })); setErrors(p => ({ ...p, date_received: '' })); }} style={inp(!!errors.date_received)} />
          {errors.date_received && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errors.date_received}</p>}
        </div>
        <div style={{ backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '0.625rem', padding: '0.75rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 0.125rem' }}>2025 DS YIELD</p>
          <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>Harvest data will be encoded in Yield Encode after harvest.</p>
        </div>
        <button onClick={onSave} disabled={saving} style={{ width: '100%', padding: '0.75rem', backgroundColor: saving ? '#d1d5db' : '#1e40af', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <CheckCircle size={16} /> {saving ? 'Saving...' : 'Confirm Seed Distributed'}
        </button>
      </div>
    </div>
  );
};

// ── Main Component ──
const BrgyDistribution = () => {
  const [view, setView] = useState('landing');
  const [myBarangay, setMyBarangay] = useState('');
  const [finalSeeds, setFinalSeeds] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalToDistribute, setTotalToDistribute] = useState(0);
  const [totalDistributed, setTotalDistributed] = useState(0);
  const [totalApprovedBoth, setTotalApprovedBoth] = useState(0);

  // Search
  const [landingSearch, setLandingSearch] = useState('');
  const [landingResults, setLandingResults] = useState([]);
  const [landingSearching, setLandingSearching] = useState(false);

  // Program filter
  const [programSearch, setProgramSearch] = useState('');

  // Selected farmer detail
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [farmerDetail, setFarmerDetail] = useState(null);
  const [farmerDetailLoading, setFarmerDetailLoading] = useState(false);

  // Forms per seed type
  const [inbredForm, setInbredForm] = useState({});
  const [hybridForm, setHybridForm] = useState({});
  const [inbredErrors, setInbredErrors] = useState({});
  const [hybridErrors, setHybridErrors] = useState({});
  const [inbredSaving, setInbredSaving] = useState(false);
  const [hybridSaving, setHybridSaving] = useState(false);
  const [activeDistTab, setActiveDistTab] = useState('inbred');
  const [confirmSnack, setConfirmSnack] = useState(null);
  const [pendingSave, setPendingSave] = useState(null);

  // Report view
  const [reportView, setReportView] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [currentBatches, setCurrentBatches] = useState([]);
  const [reportBatchId, setReportBatchId] = useState(null);
  const [reportBatchData, setReportBatchData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [viewSig, setViewSig] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const inp = (hasErr) => ({
    padding: '0.625rem 0.875rem',
    border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem',
    width: '100%', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', backgroundColor: 'white',
  });

  // ── Load ──
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [ctxRes, evRes, fsRes] = await Promise.all([
        getBrgyDistributionContext(),
        getDistributionEvents(),
        getFinalSeeds(),
      ]);
      setMyBarangay(ctxRes.data.barangay || '');
      setFinalSeeds(fsRes.data || []);
      const evData = evRes.data || [];
      setEvents(evData);

      // Calculate stats from event summaries
      // Calculate stats mula sa event summaries (Naka-filter para sa Kasalukuyang Aktibong Season lamang)
      const activeSeason = ctxRes.data.current_season;
      let totalApproved = 0;
      let totalEncoded = 0;
      for (const ev of evData) {
        if (
          activeSeason &&
          ev.season === activeSeason.season &&
          String(ev.year) === String(activeSeason.year)
        ) {
          totalApproved += Number(ev.total_approved || 0);
          totalEncoded += Number(ev.total_distribution_encoded || 0);
        }
      }
      setTotalToDistribute(totalApproved);
      setTotalApprovedBoth(totalApproved);
      setTotalDistributed(totalEncoded);
    } catch {
      showToast('error', 'Failed to load distribution data.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const finalSeason = finalSeeds[0] ? `${finalSeeds[0].season_display} ${finalSeeds[0].year}` : null;

  // ── Search ──
  const searchTimer = useRef(null);
  const handleLandingSearch = (q) => {
    setLandingSearch(q);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setLandingResults([]); return; }
    setLandingSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchFarmers({ search: q, approved_batch_only: true });
        setLandingResults(res.data || []);
      } catch { setLandingResults([]); }
      finally { setLandingSearching(false); }
    }, 300);
  };

  // ── Open Farmer Detail ──
  const openFarmerDetail = async (farmer) => {
    setSelectedFarmer(farmer);
    setFarmerDetailLoading(true);
    setView('farmer_detail');
    setActiveDistTab('inbred');
    setInbredForm({});
    setHybridForm({});
    setInbredErrors({});
    setHybridErrors({});
    try {
      const res = await getFarmerDistributionDetail(farmer.id);
      setFarmerDetail(res.data);
      // Pre-fill forms
      const inbred = res.data.seed_entries?.find(e => isInbred(e.seed_type_name));
      const hybrid = res.data.seed_entries?.find(e => isHybrid(e.seed_type_name));
      if (inbred) {
        setInbredForm({
          number_of_bags: inbred.qty_bags || '',
          rice_variety_received: inbred.variety_name || '',
          crop_establishment: inbred.crop_establishment || '',
          expected_sowing_date: inbred.expected_sowing_date || '',
          date_received: inbred.date_received || '',
          authorized_representative: inbred.authorized_representative || '',
        });
      }
      if (hybrid) {
        setHybridForm({
          qty_bags: hybrid.qty_bags || '',
          date_received: hybrid.date_received || '',
        });
      }
    } catch {
      showToast('error', 'Failed to load farmer distribution data.');
    } finally {
      setFarmerDetailLoading(false);
    }
  };

  // ── Validate + Save ──
  const validateInbred = () => {
    const errs = {};
    if (!inbredForm.number_of_bags)        errs.number_of_bags        = 'Required';
    if (!inbredForm.rice_variety_received)  errs.rice_variety_received  = 'Required';
    if (!inbredForm.crop_establishment)     errs.crop_establishment     = 'Required';
    if (!inbredForm.expected_sowing_date)   errs.expected_sowing_date   = 'Required';
    if (!inbredForm.date_received)          errs.date_received          = 'Required';
    return errs;
  };

  const validateHybrid = () => {
    const errs = {};
    if (!hybridForm.qty_bags) errs.qty_bags = 'Required';
    if (!hybridForm.date_received) errs.date_received = 'Required';
    return errs;
  };

  const handleSaveInbred = () => {
    const errs = validateInbred();
    if (Object.keys(errs).length > 0) { setInbredErrors(errs); showToast('error', 'Please fill all required fields.'); return; }
    setConfirmSnack({
      title: `Confirm Inbred distribution for ${farmerDetail?.farmer?.last_name}, ${farmerDetail?.farmer?.first_name}?`,
      message: 'This will save the seed distribution record.',
      confirmLabel: 'Confirm',
    });
    setPendingSave('inbred');
  };

  const handleSaveHybrid = () => {
    const errs = validateHybrid();
    if (Object.keys(errs).length > 0) { setHybridErrors(errs); showToast('error', 'Please fill QTY bags.'); return; }
    setConfirmSnack({
      title: `Confirm Hybrid distribution for ${farmerDetail?.farmer?.last_name}, ${farmerDetail?.farmer?.first_name}?`,
      message: 'This will save the seed distribution record.',
      confirmLabel: 'Confirm',
    });
    setPendingSave('hybrid');
  };

  const getDistributionStatus = (batch) => {
    if (batch?.distribution_status) return batch.distribution_status;
    if (Array.isArray(batch?.entries) && batch.entries.length > 0) {
      return batch.entries.every(entry => Number(entry.qty_bags || 0) > 0) ? 'APPROVED' : 'PENDING';
    }
    return 'PENDING';
  };

  const doSave = async () => {
    setConfirmSnack(null);
    const type = pendingSave;
    setPendingSave(null);

    if (type === 'inbred') {
      const entry = farmerDetail?.seed_entries?.find(e => isInbred(e.seed_type_name));
      if (!entry) return;
      setInbredSaving(true);
      try {
        await encodeDistributionEntry(entry.entry_id, {
          qty_bags: parseFloat(parseFloat(inbredForm.number_of_bags).toFixed(2)),
          crop_establishment: inbredForm.crop_establishment,
          expected_sowing_date: inbredForm.expected_sowing_date,
          date_received: inbredForm.date_received,
          authorized_representative: inbredForm.authorized_representative,
        });
        showToast('success', 'Inbred distribution data saved.');
        // ── Notify AT na nag-start na ng distribution ──
        try {
          const atPayload = {
            barangay: myBarangay,
            season_display: finalSeeds[0]?.season_display || '',
            year: finalSeeds[0]?.year || new Date().getFullYear(),
          };
          localStorage.setItem('at_masterlist_notif', JSON.stringify(atPayload));
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'at_masterlist_notif',
            newValue: JSON.stringify(atPayload),
            storageArea: localStorage,
          }));
        } catch {}
        await openFarmerDetail(selectedFarmer);
        await loadAll();
      } catch (err) {
        showToast('error', err.response?.data?.error || 'Failed to save.');
      } finally { setInbredSaving(false); }
    }

    if (type === 'hybrid') {
      const entry = farmerDetail?.seed_entries?.find(e => isHybrid(e.seed_type_name));
      if (!entry) return;
      setHybridSaving(true);
      try {
        await encodeDistributionEntry(entry.entry_id, {
          qty_bags: parseFloat(parseFloat(hybridForm.qty_bags).toFixed(2)),
          date_received: hybridForm.date_received || null,
        });
        showToast('success', 'Hybrid distribution data saved.');
        // ── Notify AT na nag-start na ng distribution ──
        try {
          const atPayload = {
            barangay: myBarangay,
            season_display: finalSeeds[0]?.season_display || '',
            year: finalSeeds[0]?.year || new Date().getFullYear(),
          };
          localStorage.setItem('at_masterlist_notif', JSON.stringify(atPayload));
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'at_masterlist_notif',
            newValue: JSON.stringify(atPayload),
            storageArea: localStorage,
          }));
        } catch {}
        await openFarmerDetail(selectedFarmer);
        await loadAll();
      } catch (err) {
        showToast('error', err.response?.data?.error || 'Failed to save.');
      } finally { setHybridSaving(false); }
    }
  };

  // ── Report ──
  const openReport = async (event) => {
    setCurrentEvent(event);
    setReportView(true);
    setView('report');
    try {
      const bRes = await getEventBatches(event.id);
      const approved = (bRes.data || []).filter(b => b.status === 'APPROVED');
      setCurrentBatches(approved);
      if (approved.length > 0) {
        setReportBatchId(approved[0].id);
        await loadReportBatch(approved[0].id);
      }
    } catch { showToast('error', 'Failed to load report.'); }
  };

  const loadReportBatch = async (batchId) => {
    setReportBatchId(batchId);
    setReportLoading(true);
    try {
      const res = await getBatchDetail(batchId);
      setReportBatchData(res.data);
    } catch { setReportBatchData(null); }
    finally { setReportLoading(false); }
  };

  const handleSubmitBatch = async (batchId) => {
    setSubmitConfirm(false);
    setSubmitting(true);
    try {
      await submitDistributionBatch(batchId);
      await loadReportBatch(batchId);
      showToast('success', 'Distribution batch submitted for admin review.');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to submit.');
    } finally { setSubmitting(false); }
  };

  const eventIsHybrid = isHybrid(currentEvent?.seed_type_name || currentEvent?.intervention || '');
  const eventIsInbred = isInbred(currentEvent?.seed_type_name || currentEvent?.intervention || '');

  const filteredEvents = events.filter(ev => {
    const q = programSearch.toLowerCase();
    return !q || ev.organization_name?.toLowerCase().includes(q) || ev.seed_type_name?.toLowerCase().includes(q);
  });

  // ── Program card stats ──
  const getProgramStats = (event) => {
    const total = event.total_approved || 0;
    return { total, encoded: 0 };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#9ca3af' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div style={{ width: 36, height: 36, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading distribution...</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .prog-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.12) !important; transform: translateY(-2px); transition: all 0.2s; }
        .row-hover:hover { background-color: ${GREEN.light} !important; }
      `}</style>

      <Toast toast={toast} />
      <ConfirmSnack data={confirmSnack} onConfirm={doSave} onCancel={() => { setConfirmSnack(null); setPendingSave(null); }} />
      <SignatureModal sig={viewSig} onClose={() => setViewSig(null)} />

      {/* Submit confirm */}
      {submitConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', maxWidth: '380px', width: '100%' }}>
            <p style={{ fontWeight: 800, margin: '0 0 0.5rem' }}>Submit Batch?</p>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1.25rem' }}>Admin will review this distribution batch.</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setSubmitConfirm(false)} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleSubmitBatch(reportBatchData?.id)} disabled={submitting} style={{ flex: 2, padding: '0.75rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      {view !== 'landing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '1.25rem 1.25rem 0', fontSize: '0.8rem', flexWrap: 'wrap' }}>
          <button onClick={() => { setView('landing'); setSelectedFarmer(null); setFarmerDetail(null); loadAll(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <ChevronLeft size={15} /> Distribution
          </button>
          <ChevronRight size={12} color="#9ca3af" />
          <span style={{ color: '#374151', fontWeight: 700 }}>
            {view === 'farmer_detail'
              ? `${farmerDetail?.farmer?.last_name || selectedFarmer?.last_name}, ${farmerDetail?.farmer?.first_name || selectedFarmer?.first_name}`
              : currentEvent?.organization_name || 'Report'}
          </span>
        </div>
      )}

      {/* ══ LANDING ══ */}
      {view === 'landing' && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Distribution</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{myBarangay} · {finalSeason || 'No active season'}</p>
          </div>

          {/* Instructions */}
          <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '1rem', padding: '1rem 1.125rem', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 700, color: GREEN.accent, margin: '0 0 0.25rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={15} /> Seed Distribution Phase
            </p>
            <p style={{ color: GREEN.accent, opacity: 0.85, margin: 0, fontSize: '0.78rem', lineHeight: 1.5 }}>
              Once seeds arrive, encode missing distribution data here. Search a farmer or select a program below to get started.
            </p>
          </div>

          {/* Stats tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: `1px solid ${GREEN.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <Users size={16} color={GREEN.accent} />
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Total to Distribute</p>
              </div>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, color: GREEN.primary, margin: 0, lineHeight: 1 }}>{totalToDistribute}</p>
              <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>approved farmers (both programs)</p>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: `1px solid ${GREEN.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <CheckCircle size={16} color={GREEN.accent} />
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Successfully Distributed</p>
              </div>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, color: GREEN.primary, margin: 0, lineHeight: 1 }}>
                {totalDistributed}<span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: 400 }}>/{totalApprovedBoth}</span>
              </p>
              <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>encoded / total approved both seed types</p>
            </div>
          </div>

          {/* Search */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={15} color={GREEN.primary} /> Search Farmer
            </p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.75rem' }}>
              Search farmers who have been approved in Beneficiaries batches.
            </p>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={landingSearch} onChange={e => handleLandingSearch(e.target.value)} placeholder="Search farmer by name or RSBSA..." style={{ padding: '0.625rem 0.875rem 0.625rem 2.25rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {landingSearching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0', color: '#9ca3af', fontSize: '0.78rem' }}>
                <div style={{ width: 14, height: 14, border: '2px solid #e5e7eb', borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Searching...
              </div>
            )}
            {!landingSearching && landingSearch.length >= 2 && landingResults.length === 0 && (
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.5rem 0 0', textAlign: 'center', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                No farmers found in approved batches.
              </p>
            )}
            {landingResults.length > 0 && (
              <div style={{ marginTop: '0.625rem', border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden' }}>
                {landingResults.slice(0, 8).map((farmer, idx) => (
                  <div key={farmer.id} className="row-hover"
                    onClick={() => { setLandingSearch(''); setLandingResults([]); openFarmerDetail(farmer); }}
                    style={{ padding: '0.875rem 1rem', borderBottom: idx < Math.min(landingResults.length, 8) - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>{farmer.last_name}, {farmer.first_name}</p>
                      <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>{farmer.rsbsa_number || 'No RSBSA'} · {farmer.barangay}</p>
                    </div>
                    <ChevronRight size={14} color="#9ca3af" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Programs */}
          <div style={{ marginBottom: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#374151', margin: 0 }}>Programs</p>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={programSearch} onChange={e => setProgramSearch(e.target.value)} placeholder="Filter..." style={{ padding: '0.4rem 0.75rem 0.4rem 2rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.78rem', outline: 'none', width: '160px' }} />
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
              <Package size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.375rem' }}>No programs yet</p>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Programs are created in Beneficiaries.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filteredEvents.map((event, idx) => {
                const evH = isHybrid(event.seed_type_name || event.intervention || '');
                const tagColor = evH ? '#1e40af' : GREEN.primary;
                const tagBg    = evH ? '#eff6ff' : GREEN.light;
                const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                const approvedBatchCount = event.approved_batch_count ?? event.batch_count ?? 0;
                const total = event.total_approved || 0;
                const encoded = event.total_distribution_encoded || 0;

                return (
                  <div key={event.id} className="prog-card"
                    onClick={() => openReport(event)}
                    style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${tagBorder}`, cursor: 'pointer', animation: `slideUp ${0.3 + idx * 0.06}s ease` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                          <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.15rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                            {event.seed_type_name || (evH ? 'Hybrid' : 'Inbred')}
                          </span>
                          {event.variety_name && (
                            <span style={{ fontSize: '0.7rem', color: '#6b7280', backgroundColor: '#f9fafb', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid #e5e7eb' }}>{event.variety_name}</span>
                          )}
                        </div>
                        <h3 style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: '#111827' }}>{event.organization_name}</h3>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>{event.season_display} {event.year} · {event.barangay}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: tagColor, margin: 0, lineHeight: 1 }}>
                          {encoded}<span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>/{total}</span>
                        </p>
                        <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>encoded</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af', alignItems: 'center' }}>
                      <span>{approvedBatchCount} approved batch{approvedBatchCount !== 1 ? 'es' : ''}</span>
                      <span style={{ color: tagColor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        View Masterlist <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ FARMER DETAIL — Two panels ══ */}
      {view === 'farmer_detail' && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          {farmerDetailLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: '1rem', color: '#9ca3af' }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading farmer data...</p>
            </div>
          ) : farmerDetail ? (
            <>
              {/* Farmer info card */}
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem', border: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: GREEN.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
                    {(farmerDetail.farmer.last_name?.[0] || '').toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a1a', margin: 0 }}>
                      {farmerDetail.farmer.last_name}, {farmerDetail.farmer.first_name}
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>
                      {farmerDetail.farmer.rsbsa_number || 'No RSBSA'} · {farmerDetail.farmer.barangay}
                    </p>
                    {farmerDetail.farmer.hectares > 0 && (
                      <p style={{ color: GREEN.accent, fontSize: '0.75rem', margin: '0.125rem 0 0', fontWeight: 600 }}>
                        Total Farm: {Number(farmerDetail.farmer.hectares).toFixed(2)} ha
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tab UI — Inbred | Hybrid */}
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.25rem', border: '1px solid #e5e7eb', marginBottom: '1rem', gap: '0.25rem' }}>
                  {(() => {
                    const inbredEntry = farmerDetail.seed_entries?.find(e => isInbred(e.seed_type_name));
                    const hybridEntry = farmerDetail.seed_entries?.find(e => isHybrid(e.seed_type_name));
                    const tabs = [];
                    if (inbredEntry) tabs.push({ key: 'inbred', label: 'Inbred', color: GREEN.primary, encoded: inbredEntry?.is_distribution_encoded });
                    if (hybridEntry) tabs.push({ key: 'hybrid', label: 'Hybrid', color: '#1e40af', encoded: hybridEntry?.is_distribution_encoded });
                    if (tabs.length === 0) return null;
                    return tabs.map(tab => (
                      <button key={tab.key} onClick={() => setActiveDistTab(tab.key)}
                        style={{
                          flex: 1, padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
                          border: tab.encoded ? 'none' : '1.5px dashed #dc2626',
                          backgroundColor: activeDistTab === tab.key ? 'white' : 'transparent',
                          color: activeDistTab === tab.key ? tab.color : '#6b7280',
                          fontWeight: activeDistTab === tab.key ? 700 : 400,
                          cursor: 'pointer', fontSize: '0.85rem',
                          boxShadow: activeDistTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                        }}>
                        {tab.label}
                        {tab.encoded && <CheckCircle size={13} color={GREEN.accent} />}
                      </button>
                    ));
                  })()}
                </div>
                {activeDistTab === 'inbred' && (
                  <InbredPanel
                    entry={farmerDetail.seed_entries?.find(e => isInbred(e.seed_type_name))}
                    form={inbredForm}
                    setForm={setInbredForm}
                    errors={inbredErrors}
                    setErrors={setInbredErrors}
                    saving={inbredSaving}
                    onSave={handleSaveInbred}
                    inp={inp}
                  />
                )}
                {activeDistTab === 'hybrid' && (
                  <HybridPanel
                    entry={farmerDetail.seed_entries?.find(e => isHybrid(e.seed_type_name))}
                    form={hybridForm}
                    setForm={setHybridForm}
                    errors={hybridErrors}
                    setErrors={setHybridErrors}
                    saving={hybridSaving}
                    onSave={handleSaveHybrid}
                    inp={inp}
                  />
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <AlertCircle size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              <p>Failed to load farmer data.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ REPORT VIEW ══ */}
      {view === 'report' && currentEvent && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          {/* Document header */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.875rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.875rem' }}>
              <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>Republic of the Philippines · Department of Agriculture</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1a1a1a', margin: '0.375rem 0 0', textTransform: 'uppercase' }}>Distribution Masterlist</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.75rem', color: '#374151' }}>
              <span><strong>Province:</strong> Quezon</span>
              <span><strong>Municipality:</strong> Lucban</span>
              <span><strong>Program:</strong> {eventIsHybrid ? 'Hybrid (Region)' : 'Inbred (PhilRice)'}</span>
              <span><strong>Season:</strong> {`${currentEvent.season_display} ${currentEvent.year}`}</span>
              <span><strong>Barangay:</strong> {currentEvent.barangay}</span>
              <span><strong>Organization:</strong> {currentEvent.organization_name}</span>
            </div>
          </div>

          {/* Batch selector — only APPROVED batches */}
          {currentBatches.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {currentBatches.map(b => (
                <button key={b.id} onClick={() => loadReportBatch(b.id)}
                  style={{ padding: '0.375rem 0.875rem', borderRadius: '999px', cursor: 'pointer', border: `1.5px solid ${reportBatchId === b.id ? GREEN.primary : '#e5e7eb'}`, backgroundColor: reportBatchId === b.id ? GREEN.light : 'white', color: reportBatchId === b.id ? GREEN.primary : '#374151', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  Batch {b.batch_number} <StatusBadge status={getDistributionStatus(b)} />
                </button>
              ))}
            </div>
          )}

          {reportLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
              Loading...
            </div>
          ) : reportBatchData?.entries?.length > 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '2px solid #e5e7eb', backgroundColor: GREEN.light, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: GREEN.accent }}>
                  Batch {reportBatchData?.batch_number} <StatusBadge status={getDistributionStatus(reportBatchData)} />
                </span>
                {reportBatchData?.status === 'APPROVED' && getDistributionStatus(reportBatchData) !== 'APPROVED' && (
                  <button onClick={() => setSubmitConfirm(true)}
                    style={{ padding: '0.5rem 1.125rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Send size={13} /> Submit to Admin
                  </button>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                {eventIsHybrid ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1500px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        {[
                          'No.','RSBSA No.','Last Name','First Name','Middle Name','Ext.',
                          'Date of Birth','Res. Municipality','Res. Barangay',
                          'Farm Municipality','Farm Barangay',
                          'Gender','IP','Senior Citizen','PWD','ARBs','4Ps',
                          'Farm Area (ha)','QTY (bags)','Contact No.','Signature'
                        ].map((col, i) => (
                          <th key={i} style={{ padding: '0.5rem 0.375rem', textAlign: 'center', fontWeight: 700, color: ['Res. Municipality','Res. Barangay','Farm Municipality','Farm Barangay','IP','Senior Citizen','PWD','ARBs','4Ps'].includes(col) ? '#dc2626' : (col === 'QTY (bags)' ? '#854d0e' : '#374151'), whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportBatchData.entries.map((entry, idx) => {
                        const fd = entry.farmer_detail || {};
                        const td = { padding: '0.4375rem 0.375rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                        return (
                          <tr key={entry.id} style={{ backgroundColor: !entry.qty_bags ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ ...td, textAlign: 'center' }}>{entry.row_number}</td>
                            <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                            <td style={{ ...td, fontWeight: 700 }}>{(entry.farmer_name || '').split(',')[0]?.trim()}</td>
                            <td style={td}>{(entry.farmer_name || '').split(',')[1]?.trim() || '—'}</td>
                            <td style={td}>{fd.middle_name || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{fd.ext_name || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{fd.date_of_birth ? new Date(fd.date_of_birth + 'T00:00:00').toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '—'}</td>
                            <td style={td}>{fd.residency_municipality || '—'}</td>
                            <td style={td}>{fd.residency_barangay || '—'}</td>
                            <td style={td}>{fd.farm_municipality || '—'}</td>
                            <td style={td}>{fd.farm_barangay || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{fd.gender ? fd.gender[0] : '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{fd.ip ? 'Y' : 'N'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{fd.senior_citizen ? 'Y' : 'N'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{fd.pwd ? 'Y' : 'N'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{fd.arbs ? 'Y' : 'N'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{fd.four_ps ? 'Y' : 'N'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{entry.farm_area_ha || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              {entry.qty_bags != null && entry.qty_bags !== '' ? (
                                <span>
                                  {parseFloat(entry.qty_bags).toFixed(2)}
                                  <span style={{ fontSize: '0.6rem', color: '#6b7280', marginLeft: '0.2rem' }}>
                                    ({parseFloat((parseFloat(entry.qty_bags) * 15)).toFixed(1)}kg)
                                  </span>
                                </span>
                              ) : (
                                <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>Pending</span>
                              )}
                            </td>
                            <td style={td}>{entry.farmer_contact || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              {entry.has_signature ? (
                                <button onClick={() => getBatchDetail(reportBatchData.id).then(res => { const full = res.data.entries?.find(e => e.id === entry.id); if (full?.signature) setViewSig(full.signature); })}
                                  style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, border: `1px solid ${GREEN.border}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                  <Eye size={9} /> View
                                </button>
                              ) : <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1100px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        {['No.','RSBSA No.','Name','Area Planted','No. of Bags','Rice Variety','Crop Estab.','Sowing Date','Date Received','Auth. Rep.','Data Sharing','Signature'].map((col, i) => (
                          <th key={i} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: ['No. of Bags','Rice Variety','Crop Estab.','Sowing Date','Date Received'].includes(col) ? '#854d0e' : '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportBatchData.entries.map((entry, idx) => {
                        const missing = !entry.qty_bags || !entry.date_received;
                        const td = { padding: '0.4375rem 0.5rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                        return (
                          <tr key={entry.id} style={{ backgroundColor: missing ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ ...td, textAlign: 'center' }}>{entry.row_number}</td>
                            <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{entry.farmer_name}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{entry.area_planted || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              {entry.qty_bags != null && entry.qty_bags !== '' ? (
                                <span>
                                  {parseFloat(entry.qty_bags).toFixed(2)}
                                  <span style={{ fontSize: '0.6rem', color: '#6b7280', marginLeft: '0.2rem' }}>
                                    ({parseFloat((parseFloat(entry.qty_bags) * 20)).toFixed(1)}kg)
                                  </span>
                                </span>
                              ) : (
                                <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>Pending</span>
                              )}
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>{entry.variety_name || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{entry.crop_establishment || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{entry.expected_sowing_date || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{entry.date_received ? new Date(entry.date_received + 'T00:00:00').toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '—'}</td>
                            <td style={td}>{entry.authorized_representative || '—'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>{entry.data_sharing ? '✓' : '✗'}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              {entry.has_signature ? (
                                <button onClick={() => getBatchDetail(reportBatchData.id).then(res => { const full = res.data.entries?.find(e => e.id === entry.id); if (full?.signature) setViewSig(full.signature); })}
                                  style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, border: `1px solid ${GREEN.border}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                  <Eye size={9} /> View
                                </button>
                              ) : <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : !reportLoading && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af', border: '1px solid #f3f4f6' }}>
              <FileText size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              No farmers in this batch.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BrgyDistribution;