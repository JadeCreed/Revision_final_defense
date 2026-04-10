// src/pages/brgy/BrgyDistribution.jsx
// ============================================================
// BRGY BENEFICIARIES — Redesigned Flow
//
// PAGE FLOW:
//   'programs'        → Main: search programs + filter + program cards
//   'program_detail'  → Inside a program: info + farmer search + list
//   'farmer_encode'   → Encoding page for one farmer (seed-type fields + e-sig)
//   'report_view'     → Full masterlist table for a program
//
// KEY RULES:
//   - Barangay auto-detected from BRGY profile (no input)
//   - Season/year auto-filled from active seed poll
//   - Total members = count of approved farmers in that barangay
//   - Seed type auto-selected by intervention (RCEF→Inbred, NRP/RFO→Hybrid)
//   - Registered farmers disappear from search bar
//   - Snackbar after encoding: Cancel (edit) or Confirm (save + go back)
//   - All transitions have smooth animations
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_COLORS } from '../../components/navigation/UserNavConfig';
import {
  Plus, Search, ChevronRight, ChevronLeft,
  Users, ClipboardList, CheckCircle, Clock,
  XCircle, Send, Pen, Trash2, AlertCircle,
  Wheat, Package, UserCheck, FileCheck,
  FileText,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import {
  getDistributionEvents,
  createDistributionEvent,
  getDistributionEvent,
  getEventBatches,
  createBatch,
  getBatchDetail,
  submitBatch,
  addEntryToBatch,
  deleteEntry,
  saveSignature,
  searchFarmers,
  getSeedVarieties,
  getBrgyDistributionContext,
} from '../../api/axios';

// ─────────────────────────────────────────
// OUTSIDE COMPONENTS — prevent re-render/focus loss
// ─────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = {
    DRAFT:     { bg: '#f3f4f6', color: '#6b7280', label: 'Draft'     },
    SUBMITTED: { bg: '#dbeafe', color: '#1e40af', label: 'Submitted' },
    APPROVED:  { bg: '#dcfce7', color: '#166534', label: 'Approved'  },
    REJECTED:  { bg: '#fee2e2', color: '#991b1b', label: 'Rejected'  },
  }[status] || { bg: '#f3f4f6', color: '#6b7280', label: status };
  return (
    <span style={{
      backgroundColor: cfg.bg, color: cfg.color,
      padding: '0.2rem 0.625rem', borderRadius: '999px',
      fontSize: '0.7rem', fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  );
};

const ProgressBar = ({ value, max, light = false, color = '#2d4d1a' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{
      width: '100%', height: '6px',
      backgroundColor: light ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
      borderRadius: '999px', overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        backgroundColor: light ? 'white' : color,
        borderRadius: '999px', transition: 'width 0.5s ease',
      }} />
    </div>
  );
};

const INTERVENTION_SEED_MAP = {
  RCEF:  'INBRED',
  NRP:   'HYBRID',
  RFO:   'HYBRID',
  OTHER: null,
};

// Region = we generate masterlist report
// PhilRice = we save data but no masterlist report
const INTERVENTION_SOURCE = {
  RCEF:  'PHILRICE',
  NRP:   'REGION',
  RFO:   'REGION',
  OTHER: 'REGION',
};

const CROP_EST = [
  { value: 'DS', label: 'Direct Seeding' },
  { value: 'TP', label: 'Transplanting'  },
];

const yn = (val) => val ? 'Y' : 'N';

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────

const BrgyDistribution = () => {
  const { role } = useAuth();
  const colors = ROLE_COLORS[role] || ROLE_COLORS.BRGY;

  // ── VIEW STATE ──
  // 'programs' → main list
  // 'detail'   → inside a program
  // 'encode'   → encoding a single farmer
  // 'report'   → masterlist table
  const [view, setView] = useState('programs');
  const [currentEvent,  setCurrentEvent]  = useState(null);
  const [currentBatch,  setCurrentBatch]  = useState(null);
  const [currentFarmer, setCurrentFarmer] = useState(null);

  // ── BRGY CONTEXT ──
  const [myBarangay,    setMyBarangay]    = useState('');
  const [totalFarmers,  setTotalFarmers]  = useState(0);
  const [currentSeason, setCurrentSeason] = useState(null);

  // ── DATA ──
  const [events,    setEvents]    = useState([]);
  const [batches,   setBatches]   = useState([]);
  const [batchData, setBatchData] = useState(null);
  const [seedTypes, setSeedTypes] = useState([]);
  const [loading,   setLoading]   = useState(true);

  // ── PROGRAM SEARCH / FILTERS ──
  const [programSearch, setProgramSearch] = useState('');
  const [filterIntv,    setFilterIntv]    = useState('');
  const [filterSeason,  setFilterSeason]  = useState('');

  // ── FARMER SEARCH (detail page) ──
  const [farmerSearch,    setFarmerSearch]    = useState('');
  const [farmerResults,   setFarmerResults]   = useState([]);
  const [farmerSearching, setFarmerSearching] = useState(false);

  // ── ENCODE FORM ──
  const [encodeSource,   setEncodeSource]   = useState('');
  const [fieldsRevealed, setFieldsRevealed] = useState(false);
  const [encodeForm, setEncodeForm] = useState({
    farm_area_ha: '', crop_establishment: 'DS',
    qty_bags: '', date_received: '',
    area_planted: '', expected_yield: '', data_sharing: false,
  });
  const [encodeErrors, setEncodeErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // ── SIGNATURE — required before confirm ──
  const sigRef = useRef(null);

  // ── CREATE PROGRAM MODAL ──
  const [createModal,     setCreateModal]     = useState(false);
  const [eventForm,       setEventForm]       = useState({ intervention: '', seed_type: '', variety: '', organization_name: '' });
  const [eventFormErrors, setEventFormErrors] = useState({});
  const [creating,        setCreating]        = useState(false);

  // ── SNACKBAR ──
  const [snackbar, setSnackbar] = useState(null);

  // ── REPORT ──
  const [reportBatchId,   setReportBatchId]   = useState(null);
  const [reportBatchData, setReportBatchData] = useState(null);
  const [reportLoading,   setReportLoading]   = useState(false);

  // ── SUBMIT ──
  const [submitting, setSubmitting] = useState(false);

  // ─────────────────────────
  // HELPERS
  // ─────────────────────────

  const showSnack = useCallback((type, message, opts = {}) => {
    setSnackbar({ type, message, ...opts });
    if (type !== 'confirm') setTimeout(() => setSnackbar(null), 3500);
  }, []);

  const inputStyle = (hasErr) => ({
    padding: '0.625rem 0.875rem',
    border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem',
    width: '100%', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    backgroundColor: 'white',
  });

  // ─────────────────────────
  // LOAD DATA
  // ─────────────────────────

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [ctxRes, evRes, varRes] = await Promise.all([
        getBrgyDistributionContext(),
        getDistributionEvents(),
        getSeedVarieties(),
      ]);
      const ctx = ctxRes.data;
      setMyBarangay(ctx.barangay || '');
      setTotalFarmers(ctx.total_approved_farmers || 0);
      setCurrentSeason(ctx.current_season);
      setEvents(evRes.data || []);
      setSeedTypes(varRes.data || []);
    } catch {
      showSnack('error', 'Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [showSnack]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─────────────────────────
  // COMPUTED
  // ─────────────────────────

  const filteredEvents = events.filter(ev => {
    const q = programSearch.toLowerCase();
    const matchSearch = !q ||
      ev.organization_name?.toLowerCase().includes(q) ||
      ev.intervention?.toLowerCase().includes(q);
    const matchIntv   = !filterIntv   || ev.intervention === filterIntv;
    const matchSeason = !filterSeason || ev.season       === filterSeason;
    return matchSearch && matchIntv && matchSeason;
  });

  const selectedSeedType   = seedTypes.find(st => st.id.toString() === eventForm.seed_type.toString());
  const availableVarieties = selectedSeedType?.varieties?.filter(v => v.is_active) || [];
  const signedCount        = batchData?.entries?.filter(e => e.has_signature).length || 0;
  const eventSource        = currentEvent ? INTERVENTION_SOURCE[currentEvent.intervention] || 'REGION' : 'REGION';

  // ─────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────

  const openProgram = async (event) => {
    setCurrentEvent(event);
    setFarmerSearch('');
    setFarmerResults([]);
    setView('detail');
    try {
      const [evRes, bRes] = await Promise.all([
        getDistributionEvent(event.id),
        getEventBatches(event.id),
      ]);
      setCurrentEvent(evRes.data);
      const allBatches = bRes.data || [];
      setBatches(allBatches);

      // Find a DRAFT batch to work with
      const draftBatch = allBatches.find(b => b.status === 'DRAFT');
      if (draftBatch) {
        setCurrentBatch(draftBatch);
        const det = await getBatchDetail(draftBatch.id);
        setBatchData(det.data);
      } else if (allBatches.length === 0) {
        // Auto-create first batch
        const nb = await createBatch(evRes.data.id);
        setBatches([nb.data]);
        setCurrentBatch(nb.data);
        const det = await getBatchDetail(nb.data.id);
        setBatchData(det.data);
      } else {
        const latest = allBatches[allBatches.length - 1];
        setCurrentBatch(latest);
        const det = await getBatchDetail(latest.id);
        setBatchData(det.data);
      }
    } catch {
      showSnack('error', 'Failed to load program details.');
    }
  };

  const refreshDetail = useCallback(async () => {
    if (!currentEvent?.id) return;
    try {
      const [evRes, bRes] = await Promise.all([
        getDistributionEvent(currentEvent.id),
        getEventBatches(currentEvent.id),
      ]);
      setCurrentEvent(evRes.data);
      setBatches(bRes.data || []);
      if (currentBatch?.id) {
        const det = await getBatchDetail(currentBatch.id);
        setBatchData(det.data);
      }
    } catch {}
  }, [currentEvent?.id, currentBatch?.id]);

  // ─────────────────────────────────
  // FARMER SEARCH
  // ─────────────────────────────────

  const handleFarmerSearch = useCallback(async (q) => {
    setFarmerSearch(q);
    if (q.trim().length < 2) { setFarmerResults([]); return; }
    setFarmerSearching(true);
    try {
      const res = await searchFarmers({ search: q, event_id: currentEvent?.id });
      setFarmerResults(res.data || []);
    } catch { setFarmerResults([]); }
    finally { setFarmerSearching(false); }
  }, [currentEvent?.id]);

  // ─────────────────────────────────
  // OPEN ENCODE PAGE
  // ─────────────────────────────────

  const openEncode = (farmer) => {
    setCurrentFarmer(farmer);
    setEncodeSource('');
    setFieldsRevealed(false);
    setEncodeForm({
      farm_area_ha: '', crop_establishment: 'DS',
      qty_bags: '', date_received: '',
      area_planted: '', expected_yield: '', data_sharing: false,
    });
    setEncodeErrors({});
    setSaving(false);
    setView('encode');
    setTimeout(() => sigRef.current?.clear(), 100);
  };

  // ─────────────────────────────────
  // SEED SOURCE SELECTION
  // ─────────────────────────────────

  const handleSourceSelect = (source) => {
    setEncodeSource(source);
    setFieldsRevealed(false);
    setTimeout(() => setFieldsRevealed(true), 80);
  };

  // ─────────────────────────────────
  // VALIDATE
  // ─────────────────────────────────

  const validateEncode = () => {
    const errs = {};
    if (!encodeSource)             errs.source       = 'Please select a seed program';
    if (!encodeForm.farm_area_ha)  errs.farm_area_ha = 'Farm area is required';
    // Signature is REQUIRED — check canvas
    if (!sigRef.current || sigRef.current.isEmpty()) {
      errs.signature = 'Farmer signature is required';
    }
    return errs;
  };

  // ─────────────────────────────────
  // CONFIRM SAVE — called after snackbar confirm
  // ─────────────────────────────────

  const handleConfirmSave = async () => {
    setSnackbar(null);
    setSaving(true);
    try {
      // Get or create a DRAFT batch with space
      let activeBatch = currentBatch;
      const needNewBatch = !activeBatch
        || activeBatch.status !== 'DRAFT'
        || batchData?.is_full;

      if (needNewBatch) {
        const nb = await createBatch(currentEvent.id);
        activeBatch = nb.data;
        setCurrentBatch(activeBatch);
      }

      // Add the farmer entry
      const entryRes = await addEntryToBatch(activeBatch.id, {
        farmer_id:          currentFarmer.id,
        farm_area_ha:       encodeForm.farm_area_ha       || null,
        crop_establishment: encodeForm.crop_establishment || null,
        qty_bags:           encodeForm.qty_bags           || null,
        date_received:      encodeForm.date_received      || null,
        area_planted:       encodeForm.area_planted       || null,
        expected_yield:     encodeForm.expected_yield     || null,
      });

      const entryId = entryRes.data.id;

      // Save signature — this ALWAYS runs because we validated it above
      const sigData = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
      await saveSignature(entryId, { signature: sigData });

      // Refresh the batch
      const det = await getBatchDetail(activeBatch.id);
      setBatchData(det.data);

      showSnack('success', `${currentFarmer.first_name} ${currentFarmer.last_name} registered successfully.`);

      // Return to detail after delay
      setTimeout(async () => {
        setView('detail');
        setCurrentFarmer(null);
        setFarmerSearch('');
        setFarmerResults([]);
        await refreshDetail();
      }, 1800);

    } catch (err) {
      showSnack('error', err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────
  // SAVE ENTRY — validate then show confirm snackbar
  // ─────────────────────────────────

  const handleSaveEntry = () => {
    const errs = validateEncode();
    if (Object.keys(errs).length > 0) {
      setEncodeErrors(errs);
      // Show specific error message
      if (errs.signature) {
        showSnack('error', 'Farmer signature is required before saving.');
      } else {
        showSnack('error', 'Please fill all required fields.');
      }
      return;
    }

    // All valid — show confirm snackbar
    showSnack('confirm',
      `Register ${currentFarmer?.first_name} ${currentFarmer?.last_name} as beneficiary?`,
      {
        onConfirm: handleConfirmSave,
        onCancel:  () => setSnackbar(null),
      }
    );
  };

  // ─────────────────────────────────
  // SUBMIT BATCH TO ADMIN
  // ─────────────────────────────────

  const handleSubmitBatch = async (batchId) => {
    setSubmitting(true);
    try {
      await submitBatch(batchId);
      await refreshDetail();
      showSnack('success', 'Batch submitted to admin for review.');
    } catch (err) {
      showSnack('error', err.response?.data?.error || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────
  // REPORT
  // ─────────────────────────────────

  const openReport = async () => {
    setView('report');
    if (batches.length > 0) {
      const first = batches[0];
      setReportBatchId(first.id);
      setReportLoading(true);
      try {
        const det = await getBatchDetail(first.id);
        setReportBatchData(det.data);
      } catch { setReportBatchData(null); }
      finally { setReportLoading(false); }
    }
  };

  const loadReportBatch = async (batchId) => {
    setReportBatchId(batchId);
    setReportLoading(true);
    try {
      const det = await getBatchDetail(batchId);
      setReportBatchData(det.data);
    } catch { setReportBatchData(null); }
    finally { setReportLoading(false); }
  };

  // ─────────────────────────────────
  // CREATE PROGRAM
  // ─────────────────────────────────

  const handleInterventionChange = (val) => {
    const targetName = INTERVENTION_SEED_MAP[val];
    let autoType = '', autoVariety = '';
    if (targetName) {
      const found = seedTypes.find(st => st.name.toUpperCase() === targetName.toUpperCase());
      if (found) {
        autoType = found.id.toString();
        const vars = found.varieties?.filter(v => v.is_active) || [];
        if (vars.length === 1) autoVariety = vars[0].id.toString();
      }
    }
    setEventForm(prev => ({ ...prev, intervention: val, seed_type: autoType, variety: autoVariety }));
  };

  const handleCreateEvent = async () => {
    const errs = {};
    if (!eventForm.intervention)             errs.intervention      = 'Required';
    if (!eventForm.seed_type)                errs.seed_type         = 'Required';
    if (!eventForm.organization_name?.trim()) errs.organization_name = 'Required';
    if (Object.keys(errs).length > 0) { setEventFormErrors(errs); return; }

    setCreating(true);
    try {
      await createDistributionEvent({
        barangay:          myBarangay,
        intervention:      eventForm.intervention,
        seed_type:         eventForm.seed_type  || null,
        variety:           eventForm.variety    || null,
        season:            currentSeason?.season || 'WET',
        year:              currentSeason?.year   || new Date().getFullYear(),
        organization_name: eventForm.organization_name,
        total_members:     totalFarmers,
      });
      setCreateModal(false);
      setEventForm({ intervention: '', seed_type: '', variety: '', organization_name: '' });
      setEventFormErrors({});
      loadAll();
      showSnack('success', 'Distribution program created.');
    } catch (err) {
      setEventFormErrors({ general: err.response?.data?.error || 'Failed.' });
    } finally {
      setCreating(false);
    }
  };

  // ─────────────────────────────────
  // LOADING
  // ─────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#9ca3af' }}>
        <style>{`
          @keyframes spin    { to { transform: rotate(360deg); } }
          @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
          @keyframes reveal  { from { max-height: 0; opacity: 0; transform: translateY(-8px); } to { max-height: 1200px; opacity: 1; transform: translateY(0); } }
        `}</style>
        <div style={{ width: '36px', height: '36px', border: `3px solid ${colors.primary}22`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading beneficiaries...</p>
      </div>
    );
  }

  // ─────────────────────────────────
  // RENDER
  // ─────────────────────────────────

  return (
    <div style={{ paddingBottom: '5rem' }}>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes reveal  { from { max-height: 0; opacity: 0; transform: translateY(-8px); } to { max-height: 1200px; opacity: 1; transform: translateY(0); } }
        .prog-card:active  { transform: scale(0.98); }
        .farmer-row:hover  { background-color: #f9fafb !important; }
        .btn-tap:active    { transform: scale(0.97); }
      `}</style>

      {/* ─────────── SNACKBAR ─────────── */}
      {snackbar && (
        <div style={{
          position: 'fixed', zIndex: 500,
          animation: 'slideUp 0.25s ease',
          ...(snackbar.type === 'confirm'
            ? { bottom: '50%', left: '50%', transform: 'translate(-50%, 50%)', maxWidth: '380px', width: 'calc(100vw - 2rem)' }
            : { bottom: '90px', left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 2rem)' }
          ),
        }}>
          {snackbar.type === 'confirm' ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.5rem', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ width: '40px', height: '40px', backgroundColor: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileCheck size={20} color={colors.primary} />
                </div>
                <div>
                  <p style={{ fontWeight: 800, color: '#1a1a1a', margin: 0, fontSize: '0.95rem' }}>Confirm Registration</p>
                  <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>{snackbar.message}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={snackbar.onCancel} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  Cancel — Edit
                </button>
                <button onClick={snackbar.onConfirm} style={{ flex: 2, padding: '0.75rem', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', boxShadow: `0 4px 12px ${colors.primary}40` }}>
                  <CheckCircle size={16} /> Confirm & Save
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: snackbar.type === 'error' ? '#991b1b' : '#166534',
              color: 'white', padding: '0.75rem 1.25rem', borderRadius: '999px',
              fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>
              {snackbar.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {snackbar.message}
            </div>
          )}
        </div>
      )}

      {/* ─────────── BREADCRUMB ─────────── */}
      {view !== 'programs' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '1.25rem 1.25rem 0', fontSize: '0.8rem', animation: 'fadeIn 0.2s ease', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (view === 'detail') { setView('programs'); loadAll(); }
              if (view === 'encode') setView('detail');
              if (view === 'report') setView('detail');
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
          >
            <ChevronLeft size={15} />
            {view === 'detail' ? 'Programs' : currentEvent?.organization_name || 'Program'}
          </button>
          {currentEvent && view !== 'detail' && (
            <>
              <ChevronRight size={12} color="#9ca3af" />
              <span style={{ color: '#374151', fontWeight: 700 }}>
                {view === 'encode' ? 'Register Farmer' : 'Report'}
              </span>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════
          VIEW: PROGRAMS
      ═══════════════════════════════════ */}
      {view === 'programs' && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Beneficiaries</h1>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                {myBarangay} · {currentSeason ? `${currentSeason.season_display} ${currentSeason.year}` : 'No active season'}
              </p>
            </div>
            <button
              onClick={() => setCreateModal(true)}
              className="btn-tap"
              style={{ padding: '0.625rem 1.125rem', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', boxShadow: `0 4px 12px ${colors.primary}35` }}
            >
              <Plus size={16} /> New Program
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Approved Farmers', value: totalFarmers, sub: `in ${myBarangay}`, Icon: Users, color: colors.primary, bg: '#f0fdf4', border: '#bbf7d0' },
              { label: 'Active Programs',  value: events.filter(e => e.status === 'ACTIVE').length, sub: `${events.length} total`, Icon: ClipboardList, color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
            ].map(({ label, value, sub, Icon: I, color, bg, border }, idx) => (
              <div key={label} style={{ backgroundColor: bg, borderRadius: '1rem', padding: '1rem', border: `1px solid ${border}`, animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>
                <I size={18} color={color} />
                <p style={{ fontSize: '1.75rem', fontWeight: 800, color, margin: '0.375rem 0 0.125rem', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '0.72rem', color, opacity: 0.8, margin: 0, fontWeight: 700 }}>{label}</p>
                <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Search + Filters */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={programSearch} onChange={e => setProgramSearch(e.target.value)} placeholder="Search by organization or program..." style={{ ...inputStyle(false), paddingLeft: '2.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={filterIntv} onChange={e => setFilterIntv(e.target.value)} style={{ padding: '0.375rem 0.625rem', border: `1.5px solid ${filterIntv ? colors.primary : '#e5e7eb'}`, borderRadius: '0.5rem', fontSize: '0.78rem', cursor: 'pointer', backgroundColor: filterIntv ? '#f0fdf4' : 'white', color: filterIntv ? colors.primary : '#6b7280', fontWeight: filterIntv ? 700 : 400, outline: 'none' }}>
                <option value="">All Programs</option>
                <option value="RCEF">RCEF</option>
                <option value="NRP">NRP</option>
                <option value="RFO">RFO</option>
              </select>
              <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)} style={{ padding: '0.375rem 0.625rem', border: `1.5px solid ${filterSeason ? colors.primary : '#e5e7eb'}`, borderRadius: '0.5rem', fontSize: '0.78rem', cursor: 'pointer', backgroundColor: filterSeason ? '#f0fdf4' : 'white', color: filterSeason ? colors.primary : '#6b7280', fontWeight: filterSeason ? 700 : 400, outline: 'none' }}>
                <option value="">All Seasons</option>
                <option value="WET">Wet Season</option>
                <option value="DRY">Dry Season</option>
              </select>
              {(filterIntv || filterSeason || programSearch) && (
                <button onClick={() => { setProgramSearch(''); setFilterIntv(''); setFilterSeason(''); }} style={{ padding: '0.375rem 0.625rem', border: '1.5px solid #fca5a5', borderRadius: '0.5rem', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <XCircle size={11} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Program cards */}
          {filteredEvents.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem 1.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Package size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>{events.length === 0 ? 'No programs yet' : 'No results found'}</p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
                {events.length === 0 ? 'Tap "New Program" to start registering beneficiaries.' : 'Try adjusting your search or filters.'}
              </p>
              {events.length === 0 && (
                <button onClick={() => setCreateModal(true)} style={{ padding: '0.625rem 1.5rem', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Plus size={16} /> Create First Program
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredEvents.map((event, idx) => (
                <div
                  key={event.id}
                  className="prog-card"
                  onClick={() => openProgram(event)}
                  style={{
                    backgroundColor: colors.primary, borderRadius: '1rem', padding: '1.25rem',
                    cursor: 'pointer', color: 'white', position: 'relative', overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    animation: `slideUp ${0.3 + idx * 0.06}s ease`,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  <div style={{ position: 'absolute', right: '-15px', top: '-15px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>
                          {event.intervention}
                        </span>
                        <span style={{ backgroundColor: INTERVENTION_SOURCE[event.intervention] === 'REGION' ? 'rgba(34,197,94,0.25)' : 'rgba(96,165,250,0.25)', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600 }}>
                          {INTERVENTION_SOURCE[event.intervention] === 'REGION' ? 'Region' : 'PhilRice'}
                        </span>
                        {event.variety_name && <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{event.variety_name}</span>}
                      </div>
                      <h3 style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, lineHeight: 1.3 }}>{event.organization_name}</h3>
                      <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '0.25rem 0 0' }}>{event.season_display} {event.year}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, lineHeight: 1 }}>
                        {event.total_encoded}<span style={{ fontSize: '0.875rem', opacity: 0.7 }}>/{event.total_members}</span>
                      </p>
                      <p style={{ fontSize: '0.68rem', opacity: 0.65, margin: '0.125rem 0 0' }}>encoded</p>
                    </div>
                  </div>
                  <ProgressBar value={event.total_encoded} max={event.total_members} light />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.625rem', fontSize: '0.7rem', opacity: 0.7 }}>
                    <span>Approved: {event.total_approved}</span>
                    <span>Remaining: {event.total_remaining}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      {event.batch_count} batch{event.batch_count !== 1 ? 'es' : ''} <ChevronRight size={11} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════
          VIEW: PROGRAM DETAIL
      ═══════════════════════════════════ */}
      {view === 'detail' && currentEvent && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>

          {/* Program header */}
          <div style={{ backgroundColor: colors.primary, borderRadius: '1rem', padding: '1.25rem', color: 'white', marginBottom: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                  <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{currentEvent.intervention}</span>
                  <span style={{ backgroundColor: eventSource === 'REGION' ? 'rgba(34,197,94,0.3)' : 'rgba(96,165,250,0.3)', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>
                    {eventSource === 'REGION' ? 'Region' : 'PhilRice'}
                  </span>
                  {currentEvent.variety_name && (
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem' }}>{currentEvent.variety_name}</span>
                  )}
                </div>
                <h2 style={{ fontWeight: 800, fontSize: '1rem', margin: 0, lineHeight: 1.3 }}>{currentEvent.organization_name}</h2>
                <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '0.25rem 0 0' }}>{currentEvent.season_display} {currentEvent.year} · {currentEvent.barangay}</p>
              </div>
              {/* Report button — REGION only */}
              {eventSource === 'REGION' && (
                <button onClick={openReport} style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 0.875rem', borderRadius: '0.625rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  <FileText size={14} /> Report
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.72rem', opacity: 0.8 }}>
              <span>{currentEvent.total_encoded} of {currentEvent.total_members} farmers</span>
              <span>{currentEvent.total_members > 0 ? Math.round((currentEvent.total_encoded / currentEvent.total_members) * 100) : 0}%</span>
            </div>
            <ProgressBar value={currentEvent.total_encoded} max={currentEvent.total_members} light />
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.625rem', fontSize: '0.7rem', opacity: 0.7 }}>
              <span>Approved: {currentEvent.total_approved}</span>
              <span>Remaining: {currentEvent.total_remaining}</span>
            </div>
          </div>

          {/* Current batch status */}
          {batchData && (
            <div style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1.25rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.625rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <StatusBadge status={batchData.status} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Batch {batchData.batch_number}</span>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{batchData.entry_count}/10 · {signedCount} signed</span>
              </div>
              {batchData.status === 'DRAFT' && batchData.entry_count > 0 && (
                <button onClick={() => handleSubmitBatch(batchData.id)} disabled={submitting} style={{ padding: '0.375rem 0.875rem', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Send size={13} /> {submitting ? 'Submitting...' : 'Submit to Admin'}
                </button>
              )}
              {batchData.status === 'REJECTED' && (
                <button onClick={() => handleSubmitBatch(batchData.id)} disabled={submitting} style={{ padding: '0.375rem 0.875rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Send size={13} /> Resubmit
                </button>
              )}
            </div>
          )}

          {/* Rejection notice */}
          {batchData?.rejected_reason && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', display: 'flex', gap: '0.5rem' }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span><strong>Rejected:</strong> {batchData.rejected_reason}</span>
            </div>
          )}

          {/* Farmer search */}
          {currentEvent.status === 'ACTIVE' && (!batchData || (batchData.status === 'DRAFT' && !batchData.is_full)) && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={16} color={colors.primary} /> Add Beneficiary
              </p>
              <div style={{ position: 'relative' }}>
                <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input value={farmerSearch} onChange={e => handleFarmerSearch(e.target.value)} placeholder="Search farmer by name or RSBSA..." style={{ ...inputStyle(false), paddingLeft: '2.25rem' }} />
              </div>
              {farmerSearching && <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.625rem 0 0', textAlign: 'center' }}>Searching...</p>}
              {!farmerSearching && farmerSearch.length >= 2 && farmerResults.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.625rem 0 0', textAlign: 'center' }}>No eligible farmers found. They may already be enrolled.</p>
              )}
              {!farmerSearching && farmerResults.length > 0 && (
                <div style={{ marginTop: '0.625rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', animation: 'slideUp 0.2s ease' }}>
                  {farmerResults.map((farmer, idx) => (
                    <div
                      key={farmer.id}
                      className="farmer-row"
                      onClick={() => openEncode(farmer)}
                      style={{ padding: '0.875rem 1rem', borderBottom: idx < farmerResults.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
                    >
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>{farmer.last_name}, {farmer.first_name}</p>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>{farmer.rsbsa_number || 'No RSBSA'} · {farmer.barangay}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>Approved</span>
                        <ChevronRight size={14} color="#9ca3af" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Batch full */}
          {batchData?.is_full && batchData.status === 'DRAFT' && (
            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              Batch is full (10/10). Submit this batch to admin first, then you can add more farmers.
            </div>
          )}

          {/* Encoded farmers */}
          {batchData?.entries?.length > 0 && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0, color: '#374151' }}>Registered Farmers</h3>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{batchData.entry_count}/10 · {signedCount} signed</span>
              </div>
              {batchData.entries.map((entry, idx) => (
                <div key={entry.id} style={{ padding: '0.875rem 1.25rem', borderBottom: idx < batchData.entries.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', animation: 'slideUp 0.25s ease' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>
                      {entry.row_number}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>{entry.farmer_name}</p>
                      <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                        {entry.farmer_rsbsa || '—'} · {entry.farm_area_ha ? `${entry.farm_area_ha} ha` : 'No area'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {entry.has_signature
                      ? <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}><CheckCircle size={10} /> Signed</span>
                      : <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>Unsigned</span>
                    }
                    {batchData.status === 'DRAFT' && (
                      <button
                        onClick={async () => {
                          try {
                            await deleteEntry(entry.id);
                            refreshDetail();
                            showSnack('success', `${entry.farmer_name} removed.`);
                          } catch (err) {
                            showSnack('error', err.response?.data?.error || 'Failed.');
                          }
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.25rem' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════
          VIEW: ENCODE FARMER
      ═══════════════════════════════════ */}
      {view === 'encode' && currentFarmer && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>

          {/* Farmer profile card */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
                {(currentFarmer.first_name?.[0] || '').toUpperCase()}{(currentFarmer.last_name?.[0] || '').toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a1a', margin: 0 }}>
                  {currentFarmer.last_name}, {currentFarmer.first_name} {currentFarmer.middle_name || ''}
                </h2>
                <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>
                  {currentFarmer.rsbsa_number || 'No RSBSA'} · {currentFarmer.barangay}
                </p>
              </div>
            </div>

            {/* Pre-filled profile data (from farmer registration) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.875rem' }}>
              {[
                { label: 'Sex',        value: currentFarmer.gender || '—' },
                { label: 'DOB',        value: currentFarmer.date_of_birth || '—' },
                { label: 'Contact',    value: currentFarmer.contact_number || '—' },
                { label: 'Res. Mun.',  value: currentFarmer.residency_municipality || '—' },
                { label: 'Res. Brgy.', value: currentFarmer.residency_barangay || '—' },
                { label: 'Farm Mun.',  value: currentFarmer.farm_municipality || '—' },
                { label: 'Farm Brgy.', value: currentFarmer.farm_barangay || '—' },
                { label: 'RSBSA',      value: currentFarmer.rsbsa_number || '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ backgroundColor: '#f9fafb', borderRadius: '0.5rem', padding: '0.5rem 0.625rem' }}>
                  <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</p>
                  <p style={{ fontSize: '0.72rem', color: '#374151', margin: '0.125rem 0 0', fontWeight: 600, wordBreak: 'break-word' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Demographic badges */}
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {currentFarmer.ip            && <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>IP</span>}
              {currentFarmer.senior_citizen && <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>Senior Citizen</span>}
              {currentFarmer.pwd            && <span style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>PWD</span>}
              {currentFarmer.arbs           && <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>ARB</span>}
              {currentFarmer.four_ps        && <span style={{ backgroundColor: '#fce7f3', color: '#9d174d', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>4Ps</span>}
            </div>
          </div>

          {/* Seed source selector */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.875rem' }}>
              Seed Program Source
              {encodeSource && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#9ca3af', fontWeight: 400 }}>· tap to change</span>}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
              {[
                { value: 'REGION',   label: 'Region',   sub: 'NRP / RFO — Hybrid', note: 'Masterlist report generated', color: '#166534', bg: '#f0fdf4' },
                { value: 'PHILRICE', label: 'PhilRice', sub: 'RCEF — Inbred',       note: 'Data saved, no report',       color: '#1e40af', bg: '#eff6ff' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSourceSelect(opt.value)}
                  style={{
                    padding: '0.875rem', textAlign: 'left', cursor: 'pointer',
                    border: `2px solid ${encodeSource === opt.value ? opt.color : '#e5e7eb'}`,
                    borderRadius: '0.875rem',
                    backgroundColor: encodeSource === opt.value ? opt.bg : 'white',
                    transition: 'all 0.2s ease',
                    transform: encodeSource === opt.value ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: encodeSource === opt.value ? `0 4px 16px ${opt.color}20` : 'none',
                  }}
                >
                  <p style={{ fontWeight: 800, fontSize: '0.9rem', color: encodeSource === opt.value ? opt.color : '#374151', margin: 0 }}>{opt.label}</p>
                  <p style={{ fontSize: '0.68rem', color: encodeSource === opt.value ? opt.color : '#9ca3af', margin: '0.125rem 0 0.25rem', opacity: 0.85 }}>{opt.sub}</p>
                  <p style={{ fontSize: '0.65rem', color: encodeSource === opt.value ? opt.color : '#9ca3af', margin: 0, opacity: 0.7, fontStyle: 'italic' }}>{opt.note}</p>
                </button>
              ))}
            </div>
            {encodeErrors.source && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.375rem 0 0' }}>{encodeErrors.source}</p>}
          </div>

          {/* Animated field reveal after source selected */}
          {encodeSource && fieldsRevealed && (
            <div style={{ animation: 'reveal 0.35s ease', overflow: 'hidden' }}>

              {/* Input fields */}
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wheat size={15} color={colors.primary} />
                  {encodeSource === 'REGION' ? 'Region Masterlist Fields' : 'PhilRice / RCEF Fields'}
                </p>

                {/* Farm area — required for both */}
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Farm Area (ha) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={encodeForm.farm_area_ha}
                    onChange={e => { setEncodeForm(p => ({ ...p, farm_area_ha: e.target.value })); setEncodeErrors(p => ({ ...p, farm_area_ha: '' })); }}
                    placeholder="e.g. 0.50"
                    style={inputStyle(!!encodeErrors.farm_area_ha)}
                  />
                  {encodeErrors.farm_area_ha && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{encodeErrors.farm_area_ha}</p>}
                </div>

                {/* Crop establishment — both */}
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Crop Establishment</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {CROP_EST.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setEncodeForm(p => ({ ...p, crop_establishment: opt.value }))}
                        style={{ flex: 1, padding: '0.625rem', border: `2px solid ${encodeForm.crop_establishment === opt.value ? colors.primary : '#e5e7eb'}`, borderRadius: '0.5rem', backgroundColor: encodeForm.crop_establishment === opt.value ? '#f0fdf4' : 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', color: encodeForm.crop_establishment === opt.value ? colors.primary : '#374151', transition: 'all 0.15s' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* QTY */}
                <div style={{ marginBottom: encodeSource === 'PHILRICE' ? '0.875rem' : 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    QTY (bags) <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.68rem' }}>— fill when seeds arrive</span>
                  </label>
                  <input type="number" min="0" value={encodeForm.qty_bags} onChange={e => setEncodeForm(p => ({ ...p, qty_bags: e.target.value }))} placeholder="e.g. 2" style={inputStyle(false)} />
                </div>

                {/* PhilRice-only fields */}
                {encodeSource === 'PHILRICE' && (
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem', marginTop: '0.125rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', animation: 'slideUp 0.25s ease' }}>
                    <p style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 800, textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>PhilRice Additional Fields</p>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Area Planted (ha)</label>
                      <input type="number" step="0.01" value={encodeForm.area_planted} onChange={e => setEncodeForm(p => ({ ...p, area_planted: e.target.value }))} placeholder="e.g. 0.50" style={inputStyle(false)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Expected Yield (kg)</label>
                      <input type="number" step="0.01" value={encodeForm.expected_yield} onChange={e => setEncodeForm(p => ({ ...p, expected_yield: e.target.value }))} placeholder="e.g. 150" style={inputStyle(false)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Date Received</label>
                      <input type="date" value={encodeForm.date_received} onChange={e => setEncodeForm(p => ({ ...p, date_received: e.target.value }))} style={inputStyle(false)} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '0.625rem', border: '1px solid #bfdbfe' }}>
                      <input type="checkbox" checked={encodeForm.data_sharing} onChange={e => setEncodeForm(p => ({ ...p, data_sharing: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: '#1e40af', cursor: 'pointer' }} />
                      <div>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af', margin: 0 }}>Data Sharing Consent</p>
                        <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: '0.125rem 0 0' }}>Farmer agrees to share data with DA PhilRice</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* ─── E-SIGNATURE — REQUIRED ─── */}
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem', border: encodeErrors.signature ? '2px solid #dc2626' : '1px solid #f3f4f6' }}>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Pen size={15} color={colors.primary} />
                  Signature / Thumbmark <span style={{ color: '#dc2626', marginLeft: '0.25rem' }}>*</span>
                </p>

                <div style={{ border: `2px dashed ${encodeErrors.signature ? '#dc2626' : '#d1d5db'}`, borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#fafafa', marginBottom: '0.75rem', position: 'relative' }}>
                  <SignatureCanvas
                    ref={sigRef}
                    penColor="#1a1a1a"
                    canvasProps={{
                      width:  Math.min(window.innerWidth - 80, 420),
                      height: 160,
                      style:  { display: 'block', width: '100%', touchAction: 'none' },
                    }}
                    onBegin={() => setEncodeErrors(p => ({ ...p, signature: '' }))}
                  />
                  {/* Watermark */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', opacity: 0.18, textAlign: 'center' }}>
                    <Pen size={36} color="#9ca3af" />
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0', whiteSpace: 'nowrap' }}>Farmer signs here</p>
                  </div>
                </div>

                {encodeErrors.signature && (
                  <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0 0 0.625rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} /> {encodeErrors.signature}
                  </p>
                )}

                <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', margin: '0 0 0.75rem' }}>
                  Farmer places signature or thumbmark in the box above
                </p>

                <button
                  onClick={() => { sigRef.current?.clear(); setEncodeErrors(p => ({ ...p, signature: '' })); }}
                  style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#6b7280' }}
                >
                  Clear Signature
                </button>
              </div>

              {/* Confirm Registration button */}
              <button
                onClick={handleSaveEntry}
                disabled={saving}
                className="btn-tap"
                style={{
                  width: '100%', padding: '0.9375rem',
                  backgroundColor: saving ? '#d1d5db' : colors.primary,
                  color: 'white', border: 'none', borderRadius: '0.875rem',
                  fontWeight: 800, fontSize: '1rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  boxShadow: saving ? 'none' : `0 4px 16px ${colors.primary}40`,
                  transition: 'all 0.2s ease',
                }}
              >
                <FileCheck size={20} />
                {saving ? 'Saving...' : 'Confirm Registration'}
              </button>

            </div>
          )}

          {/* Placeholder if no source selected */}
          {!encodeSource && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2.5rem 1.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', color: '#9ca3af' }}>
              <Wheat size={32} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Select a seed program above to show the input fields</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════
          VIEW: REPORT (Region masterlist)
      ═══════════════════════════════════ */}
      {view === 'report' && currentEvent && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>

          {/* Document header */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #e5e7eb' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: 0 }}>Republic of the Philippines</p>
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: 0 }}>Department of Agriculture</p>
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: 0 }}>Regional Field Office No. IV-A</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1a1a1a', margin: '0.375rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Lists of Farmer-Beneficiaries
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.78rem', color: '#374151' }}>
              <span><strong>Province:</strong> Quezon</span>
              <span><strong>Municipality:</strong> Lucban</span>
              <span><strong>Intervention:</strong> {currentEvent.intervention}</span>
              <span><strong>Variety:</strong> {currentEvent.variety_name || '—'}</span>
              <span><strong>Season:</strong> {currentEvent.season_display} {currentEvent.year}</span>
              <span><strong>Barangay:</strong> {currentEvent.barangay}</span>
              <span style={{ gridColumn: '1/-1' }}><strong>Organization:</strong> {currentEvent.organization_name}</span>
              <span style={{ gridColumn: '1/-1' }}><strong>Total No. of Members:</strong> {currentEvent.total_members}</span>
            </div>
          </div>

          {/* Batch selector */}
          {batches.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {batches.map(b => (
                <button key={b.id} onClick={() => loadReportBatch(b.id)} style={{
                  padding: '0.375rem 0.875rem', borderRadius: '999px', cursor: 'pointer',
                  border: `1.5px solid ${reportBatchId === b.id ? colors.primary : '#e5e7eb'}`,
                  backgroundColor: reportBatchId === b.id ? '#f0fdf4' : 'white',
                  color: reportBatchId === b.id ? colors.primary : '#374151',
                  fontWeight: 700, fontSize: '0.78rem',
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  transition: 'all 0.15s',
                }}>
                  Batch {b.batch_number} <StatusBadge status={b.status} />
                </button>
              ))}
            </div>
          )}

          {/* Masterlist table — matches physical Region document (Image 2 & 3) */}
          {reportLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ width: '32px', height: '32px', border: `3px solid ${colors.primary}22`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
              Loading...
            </div>
          ) : reportBatchData?.entries?.length > 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1100px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      {[
                        ['No.', false],
                        ['RSBSA No.\n(System\nGenerated)', false],
                        ['Last Name', false],
                        ['First Name', false],
                        ['Middle\nName', false],
                        ['Ext.\n(Suffix)', false],
                        ['Date of Birth\n(MM/DD/YY)', false],
                        ['Res.\nMunicipality', true],
                        ['Res.\nBarangay', true],
                        ['Farm\nMunicipality', true],
                        ['Farm\nBarangay', true],
                        ['Gender\n(M/F)', false],
                        ['IP\n(Y/N)', true],
                        ['Senior\nCitizen', true],
                        ['PWD\n(Y/N)', true],
                        ['ARBs\n(Y/N)', true],
                        ['4Ps\n(Y/N)', true],
                        ['Farm Area\n(ha)', false],
                        ['QTY.\n(bags)', false],
                        ['Contact\nNo.', false],
                        ['Signature/\nThumbmark', false],
                      ].map(([col, red], i) => (
                        <th key={i} style={{
                          padding: '0.5rem 0.375rem', textAlign: 'center',
                          fontWeight: 700, color: red ? '#dc2626' : '#374151',
                          whiteSpace: 'pre-line', fontSize: '0.6rem',
                          textTransform: 'uppercase',
                          borderBottom: '2px solid #d1d5db',
                          borderRight: '1px solid #e5e7eb',
                          letterSpacing: '0.02em', backgroundColor: '#f9fafb',
                        }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportBatchData.entries.map((entry, idx) => {
                      const fd = entry.farmer_detail || {};
                      const tdS = {
                        padding: '0.4375rem 0.375rem', color: '#374151',
                        whiteSpace: 'nowrap', fontSize: '0.68rem',
                        borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb',
                      };
                      return (
                        <tr key={entry.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ ...tdS, textAlign: 'center' }}>{entry.row_number}</td>
                          <td style={{ ...tdS, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                          <td style={{ ...tdS, fontWeight: 700 }}>{(entry.farmer_name || '').split(',')[0]?.trim()}</td>
                          <td style={tdS}>{(entry.farmer_name || '').split(',')[1]?.trim() || '—'}</td>
                          <td style={tdS}>{fd.middle_name || '—'}</td>
                          <td style={{ ...tdS, textAlign: 'center' }}>{fd.ext_name || '—'}</td>
                          <td style={{ ...tdS, textAlign: 'center' }}>{fd.date_of_birth ? new Date(fd.date_of_birth).toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '—'}</td>
                          <td style={tdS}>{fd.residency_municipality || '—'}</td>
                          <td style={tdS}>{fd.residency_barangay || entry.farmer_barangay || '—'}</td>
                          <td style={tdS}>{fd.farm_municipality || '—'}</td>
                          <td style={tdS}>{fd.farm_barangay || '—'}</td>
                          <td style={{ ...tdS, textAlign: 'center' }}>{fd.gender ? fd.gender[0] : '—'}</td>
                          <td style={{ ...tdS, textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{yn(fd.ip)}</td>
                          <td style={{ ...tdS, textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{yn(fd.senior_citizen)}</td>
                          <td style={{ ...tdS, textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{yn(fd.pwd)}</td>
                          <td style={{ ...tdS, textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{yn(fd.arbs)}</td>
                          <td style={{ ...tdS, textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{yn(fd.four_ps)}</td>
                          <td style={{ ...tdS, textAlign: 'center' }}>{entry.farm_area_ha || '—'}</td>
                          <td style={{ ...tdS, textAlign: 'center' }}>{entry.qty_bags ?? '—'}</td>
                          <td style={tdS}>{entry.farmer_contact || '—'}</td>
                          <td style={{ ...tdS, textAlign: 'center' }}>
                            {entry.has_signature
                              ? <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.15rem 0.375rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>✓ Signed</span>
                              : <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.15rem 0.375rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>Unsigned</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{ padding: '1.25rem', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.25rem' }}>
                  <div>
                    <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0 0 0.375rem', fontWeight: 700, textTransform: 'uppercase' }}>Prepared by:</p>
                    <div style={{ borderBottom: '1px solid #374151', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1a1a1a', margin: 0, textTransform: 'uppercase' }}>RANDY F. LEONIDO</p>
                    </div>
                    <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: 0, fontStyle: 'italic' }}>Agricultural Technician</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0 0 0.375rem', fontWeight: 700, textTransform: 'uppercase' }}>Approved by:</p>
                    <div style={{ borderBottom: '1px solid #374151', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1a1a1a', margin: 0, textTransform: 'uppercase' }}>JOANNA LYNN P. GONZALES</p>
                    </div>
                    <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: 0, fontStyle: 'italic' }}>OIC Municipal Agriculturist</p>
                  </div>
                </div>

                {/* Submit / status */}
                {reportBatchData.status === 'DRAFT' && (
                  <button onClick={() => handleSubmitBatch(reportBatchData.id)} disabled={submitting} className="btn-tap" style={{ width: '100%', padding: '0.75rem', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                    <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Batch to Admin'}
                  </button>
                )}
                {reportBatchData.status === 'SUBMITTED' && (
                  <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#dbeafe', borderRadius: '0.625rem', fontSize: '0.8rem', color: '#1e40af', fontWeight: 700 }}>
                    <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
                    Submitted — awaiting admin approval
                  </div>
                )}
                {reportBatchData.status === 'APPROVED' && (
                  <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#dcfce7', borderRadius: '0.625rem', fontSize: '0.8rem', color: '#166534', fontWeight: 700 }}>
                    <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
                    Approved &amp; Locked by Admin
                  </div>
                )}
                {reportBatchData.status === 'REJECTED' && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', borderRadius: '0.625rem', fontSize: '0.8rem', color: '#991b1b' }}>
                    <strong>Rejected:</strong> {reportBatchData.rejected_reason}
                    <button onClick={() => handleSubmitBatch(reportBatchData.id)} style={{ display: 'block', marginTop: '0.625rem', padding: '0.5rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                      Resubmit
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : !reportLoading && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
              <FileText size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              No farmers encoded in this batch yet.
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════
          CREATE PROGRAM MODAL
      ═══════════════════════════════════ */}
      {createModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))', animation: 'slideUp 0.3s ease' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>New Program</h2>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                  {myBarangay} · {currentSeason ? `${currentSeason.season_display} ${currentSeason.year}` : 'No active season'}
                </p>
              </div>
              <button onClick={() => { setCreateModal(false); setEventFormErrors({}); setEventForm({ intervention: '', seed_type: '', variety: '', organization_name: '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.25rem' }}>
                <XCircle size={22} />
              </button>
            </div>

            {/* Auto-filled info */}
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#166534' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span><strong>Barangay:</strong> {myBarangay}</span>
                <span><strong>Season:</strong> {currentSeason ? `${currentSeason.season_display} ${currentSeason.year}` : '—'}</span>
              </div>
              <p style={{ margin: '0.375rem 0 0' }}><strong>Total Members:</strong> {totalFarmers} approved farmers (auto-detected)</p>
            </div>

            {eventFormErrors.general && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem' }}>{eventFormErrors.general}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Intervention */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Intervention <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {[
                    { value: 'RCEF',  label: 'RCEF',  sub: 'PhilRice — Inbred', color: '#1e40af', bg: '#eff6ff' },
                    { value: 'NRP',   label: 'NRP',   sub: 'Region — Hybrid',   color: '#166534', bg: '#f0fdf4' },
                    { value: 'RFO',   label: 'RFO',   sub: 'Region — Hybrid',   color: '#854d0e', bg: '#fef9c3' },
                    { value: 'OTHER', label: 'Other', sub: 'Custom',            color: '#6b7280', bg: '#f9fafb' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => handleInterventionChange(opt.value)}
                      style={{ padding: '0.75rem', textAlign: 'left', border: `2px solid ${eventForm.intervention === opt.value ? opt.color : '#e5e7eb'}`, borderRadius: '0.75rem', backgroundColor: eventForm.intervention === opt.value ? opt.bg : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <p style={{ fontWeight: 800, fontSize: '0.875rem', color: eventForm.intervention === opt.value ? opt.color : '#374151', margin: 0 }}>{opt.label}</p>
                      <p style={{ fontSize: '0.68rem', color: eventForm.intervention === opt.value ? opt.color : '#9ca3af', margin: '0.125rem 0 0', opacity: 0.85 }}>{opt.sub}</p>
                    </button>
                  ))}
                </div>
                {eventFormErrors.intervention && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{eventFormErrors.intervention}</p>}
              </div>

              {/* Seed type */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                  Seed Type <span style={{ color: '#dc2626' }}>*</span>
                  {INTERVENTION_SEED_MAP[eventForm.intervention] && <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.68rem' }}>auto-selected</span>}
                </label>
                <select value={eventForm.seed_type} onChange={e => setEventForm(p => ({ ...p, seed_type: e.target.value, variety: '' }))} style={inputStyle(!!eventFormErrors.seed_type)}>
                  <option value="">Select seed type</option>
                  {seedTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
                {eventFormErrors.seed_type && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{eventFormErrors.seed_type}</p>}
              </div>

              {/* Variety */}
              {availableVarieties.length > 0 && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Variety</label>
                  <select value={eventForm.variety} onChange={e => setEventForm(p => ({ ...p, variety: e.target.value }))} style={inputStyle(false)}>
                    <option value="">Select variety</option>
                    {availableVarieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              )}

              {/* Organization */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                  Organization / Association <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  value={eventForm.organization_name}
                  onChange={e => setEventForm(p => ({ ...p, organization_name: e.target.value }))}
                  placeholder="e.g. Samahan ng Magpapalay sa Brgy. Abang"
                  style={inputStyle(!!eventFormErrors.organization_name)}
                />
                {eventFormErrors.organization_name && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{eventFormErrors.organization_name}</p>}
              </div>

            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => { setCreateModal(false); setEventFormErrors({}); setEventForm({ intervention: '', seed_type: '', variety: '', organization_name: '' }); }} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={handleCreateEvent} disabled={creating} className="btn-tap" style={{ flex: 2, padding: '0.875rem', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.95rem', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={18} /> {creating ? 'Creating...' : 'Create Program'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BrgyDistribution;