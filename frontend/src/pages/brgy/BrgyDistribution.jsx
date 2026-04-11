
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_COLORS } from '../../components/navigation/UserNavConfig';
import {
  Plus, Search, ChevronRight, ChevronLeft,
  Users, ClipboardList, CheckCircle, Clock,
  XCircle, Send, Pen, Trash2, AlertCircle,
  Wheat, Package, UserCheck, FileCheck,
  FileText, Layers, Leaf, MapPin, Info,
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
  getBrgyDistributionContext,
  getFinalSeeds,
  requestDeleteEvent,
} from '../../api/axios';

// ─────────────────────────────────────────
// PURE COMPONENTS
// ─────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = {
    DRAFT:     { bg: '#f3f4f6', color: '#6b7280', label: 'Draft'     },
    SUBMITTED: { bg: '#dbeafe', color: '#1e40af', label: 'Submitted' },
    APPROVED:  { bg: '#dcfce7', color: '#166534', label: 'Approved'  },
    REJECTED:  { bg: '#fee2e2', color: '#991b1b', label: 'Rejected'  },
  }[status] || { bg: '#f3f4f6', color: '#6b7280', label: status };
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
};

const ProgressBar = ({ value, max, color = '#2d4d1a' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: '100%', height: '5px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '999px', transition: 'width 0.5s ease' }} />
    </div>
  );
};

const yn = (val) => val ? 'Y' : 'N';

const getSeedCategoryLabel = (seedTypeName, intervention) => {
  if (isHybrid(seedTypeName) || isHybrid(intervention)) return 'Hybrid';
  if (isInbred(seedTypeName) || isInbred(intervention)) return 'Inbred';
  return 'Hybrid';
};

// Determine seed type category from intervention or type name
const isHybrid  = (s) => {
  const value = (s || '').toUpperCase();
  return value.includes('HYBRID') || value === 'NRP' || value === 'RFO';
};
const isInbred  = (s) => {
  const value = (s || '').toUpperCase();
  return value.includes('INBRED') || value === 'RCEF';
};
const getInterventionForSeedType = (seedTypeName) => isHybrid(seedTypeName) ? 'NRP' : 'RCEF';

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────

const BrgyDistribution = () => {
  const { role } = useAuth();
  const colors = ROLE_COLORS[role] || ROLE_COLORS.BRGY;

  // ── VIEW STATE ──
  const [view, setView] = useState('programs');
  const [currentEvent,  setCurrentEvent]  = useState(null);
  const [currentBatch,  setCurrentBatch]  = useState(null);
  const [currentFarmer, setCurrentFarmer] = useState(null);

  // ── BRGY CONTEXT ──
  const [myBarangay,    setMyBarangay]    = useState('');
  const [totalFarmers,  setTotalFarmers]  = useState(0);
  const [currentSeason, setCurrentSeason] = useState(null);

  // ── FINAL SEEDS ──
  const [finalSeeds, setFinalSeeds] = useState([]);

  // ── DATA ──
  const [events,    setEvents]    = useState([]);
  const [batches,   setBatches]   = useState([]);
  const [batchData, setBatchData] = useState(null);
  const [loading,   setLoading]   = useState(true);

  // ── FILTER ──
  const [programSearch, setProgramSearch] = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [filterSeason,  setFilterSeason]  = useState('');

  // ── FARMER SEARCH ──
  const [farmerSearch,    setFarmerSearch]    = useState('');
  const [farmerResults,   setFarmerResults]   = useState([]);
  const [farmerSearching, setFarmerSearching] = useState(false);

  // ── ENCODE FORM ──
  const [encodeForm, setEncodeForm] = useState({
    farm_area_ha: '',
    qty_bags: '',
    area_planted: '',
    expected_yield: '',
    data_sharing: false,
    selected_variety_id: null,
  });
  const [encodeErrors, setEncodeErrors] = useState({});
  const [saving,        setSaving]       = useState(false);
  const sigRef = useRef(null);

  // ── SNACKBAR (confirm/toast) ──
  const [snackbar, setSnackbar] = useState(null);

  // ── CREATE PROGRAM MODAL ──
  const [createModal,     setCreateModal]     = useState(false);
  const [eventForm,       setEventForm]       = useState({ final_seed_id: '', organization_name: '' });
  const [eventFormErrors, setEventFormErrors] = useState({});
  const [creating,        setCreating]        = useState(false);

  // ── DELETE PROGRAM ──
  const [deleteModal,  setDeleteModal]  = useState(null); // eventId
  const [deleting,     setDeleting]     = useState(false);

  // ── REPORT ──
  const [reportBatchId,   setReportBatchId]   = useState(null);
  const [reportBatchData, setReportBatchData] = useState(null);
  const [reportLoading,   setReportLoading]   = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [submitConfirm,   setSubmitConfirm]   = useState(false);

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
  // LOAD
  // ─────────────────────────

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [ctxRes, evRes, fsRes] = await Promise.all([
        getBrgyDistributionContext(),
        getDistributionEvents(),
        getFinalSeeds(),
      ]);
      const ctx = ctxRes.data;
      setMyBarangay(ctx.barangay || '');
      setTotalFarmers(ctx.total_approved_farmers || 0);
      setCurrentSeason(ctx.current_season);
      setEvents(evRes.data || []);
      setFinalSeeds(fsRes.data || []);
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

  // season/year from final seeds (linked to last closed poll)
  const finalSeason = finalSeeds[0] ? `${finalSeeds[0].season_display} ${finalSeeds[0].year}` : null;

  // Filter options from final seeds
  const typeFilterOptions = finalSeeds.map(fs => ({
    value: fs.seed_type.name.toUpperCase(),
    label: fs.seed_type.name,
  }));

  const filteredEvents = events.filter(ev => {
    const q = programSearch.toLowerCase();
    const matchSearch = !q ||
      ev.organization_name?.toLowerCase().includes(q) ||
      ev.intervention?.toLowerCase().includes(q) ||
      ev.seed_type_name?.toLowerCase().includes(q);
    const matchType   = !filterType || (ev.seed_type_name || '').toUpperCase() === filterType;
    const matchSeason = !filterSeason || ev.season === filterSeason;
    return matchSearch && matchType && matchSeason;
  });

  const signedCount       = batchData?.entries?.filter(e => e.has_signature).length || 0;
  const eventSeedTypeName = currentEvent?.seed_type_name || '';
  const eventIsHybrid     = isHybrid(eventSeedTypeName) || isHybrid(currentEvent?.intervention);
  const eventIsInbred     = isInbred(eventSeedTypeName) || isInbred(currentEvent?.intervention);

  // Final varieties for current event's seed type
  const eventFinalVarieties = (() => {
    if (!currentEvent || !finalSeeds.length) return [];
    const matchedFS = finalSeeds.find(fs => {
      const typeName = fs.seed_type.name;
      if (eventIsHybrid && isHybrid(typeName)) return true;
      if (eventIsInbred && isInbred(typeName)) return true;
      return false;
    });
    return matchedFS?.varieties || [];
  })();

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
      const draftBatch = allBatches.find(b => b.status === 'DRAFT');
      if (draftBatch) {
        setCurrentBatch(draftBatch);
        const det = await getBatchDetail(draftBatch.id);
        setBatchData(det.data);
      } else if (allBatches.length === 0) {
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

  const searchTimer = useRef(null);

  const handleFarmerSearch = (q) => {
    setFarmerSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setFarmerResults([]);
      setFarmerSearching(false);
      return;
    }
    setFarmerSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchFarmers({ search: q, event_id: currentEvent?.id });
        setFarmerResults(res.data || []);
      } catch {
        setFarmerResults([]);
      } finally {
        setFarmerSearching(false);
      }
    }, 250);
  };

  // ─────────────────────────────────
  // OPEN ENCODE PAGE
  // ─────────────────────────────────

  const openEncode = (farmer) => {
    setCurrentFarmer(farmer);
    setEncodeForm({
      farm_area_ha: '',
      qty_bags: '',
      area_planted: '',
      expected_yield: '',
      data_sharing: false,
      selected_variety_id: eventFinalVarieties.length === 1 ? eventFinalVarieties[0].id : null,
    });
    setEncodeErrors({});
    setSaving(false);
    setView('encode');
    setTimeout(() => sigRef.current?.clear(), 100);
  };

  // ─────────────────────────────────
  // VALIDATE
  // ─────────────────────────────────

  const validateEncode = () => {
    const errs = {};
    if (eventIsHybrid && !encodeForm.farm_area_ha) {
      errs.farm_area_ha = 'Farm area is required';
    }
    if (!encodeForm.qty_bags) {
      errs.qty_bags = 'Bag quantity is required';
    } else if (Number(encodeForm.qty_bags) <= 0) {
      errs.qty_bags = 'Enter a valid bag quantity';
    }
    if (eventFinalVarieties.length > 1 && !encodeForm.selected_variety_id) {
      errs.variety = 'Please select a variety';
    }
    if (eventIsInbred) {
      if (!encodeForm.area_planted) errs.area_planted = 'Area to be planted is required';
      else if (Number(encodeForm.area_planted) <= 0) errs.area_planted = 'Enter a valid planting area';
      if (!encodeForm.expected_yield) errs.expected_yield = 'Expected yield is required';
      else if (Number(encodeForm.expected_yield) <= 0) errs.expected_yield = 'Enter a valid expected yield';
      if (!encodeForm.data_sharing) errs.data_sharing = 'Farmer consent is required for inbred programs';
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      errs.signature = 'Signature is required';
    }
    return errs;
  };

  // ─────────────────────────────────
  // CONFIRM SAVE
  // ─────────────────────────────────

  const handleConfirmSave = async () => {
    setSnackbar(null);
    setSaving(true);
    try {
      let activeBatch = currentBatch;
      if (!activeBatch || activeBatch.status !== 'DRAFT' || batchData?.is_full) {
        const nb = await createBatch(currentEvent.id);
        activeBatch = nb.data;
        setCurrentBatch(activeBatch);
      }
      const entryRes = await addEntryToBatch(activeBatch.id, {
        farmer_id:            currentFarmer.id,
        farm_area_ha:         eventIsHybrid ? Number(encodeForm.farm_area_ha) : null,
        qty_bags:             Number(encodeForm.qty_bags),
        area_planted:         eventIsInbred ? Number(encodeForm.area_planted) : null,
        expected_yield:       eventIsInbred ? Number(encodeForm.expected_yield) : null,
        data_sharing:         eventIsInbred ? encodeForm.data_sharing : false,
        variety_id:           encodeForm.selected_variety_id || null,
      });
      const entryId = entryRes.data.id;
      const sigData = sigRef.current.toDataURL('image/png');
      await saveSignature(entryId, { signature: sigData });
      const det = await getBatchDetail(activeBatch.id);
      setBatchData(det.data);
      showSnack('success', `${currentFarmer.first_name} ${currentFarmer.last_name} encoded successfully.`);
      setTimeout(async () => {
        setView('detail');
        setCurrentFarmer(null);
        setFarmerSearch('');
        setFarmerResults([]);
        await refreshDetail();
      }, 1200);
    } catch (err) {
      const serverError = err.response?.data?.error || err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message;
      showSnack('error', serverError || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEntry = () => {
    const errs = validateEncode();
    if (Object.keys(errs).length > 0) {
      setEncodeErrors(errs);
      showSnack('error', errs.signature ? 'Signature is required.' : 'Please fill all required fields.');
      return;
    }
    showSnack('confirm',
      `Encode ${currentFarmer?.first_name} ${currentFarmer?.last_name} as beneficiary?`,
      { onConfirm: handleConfirmSave, onCancel: () => setSnackbar(null) }
    );
  };

  // ─────────────────────────────────
  // SUBMIT BATCH
  // ─────────────────────────────────

  const handleSubmitBatch = async (batchId) => {
    setSubmitConfirm(false);
    setSubmitting(true);
    try {
      await submitBatch(batchId);
      await refreshDetail();
      if (view === 'report') await loadReportBatch(batchId);
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

  // Group entries by variety
  const entriesByVariety = (() => {
    if (!reportBatchData?.entries) return [];
    if (!eventIsHybrid) {
      // Inbred — no variety grouping, all in one table
      if (reportBatchData.entries.length === 0) return [];
      return [{ name: null, entries: reportBatchData.entries }];
    }
    // Hybrid — group by variety
    const groups = {};
    reportBatchData.entries.forEach(entry => {
      const varName = entry.variety_name || currentEvent?.variety_name || 'Unspecified';
      const varId   = entry.variety_id   || 'default';
      if (!groups[varId]) groups[varId] = { name: varName, entries: [] };
      groups[varId].entries.push(entry);
    });
    if (Object.keys(groups).length === 0 && reportBatchData.entries.length > 0) {
      return [{ name: currentEvent?.variety_name || '—', entries: reportBatchData.entries }];
    }
    return Object.values(groups);
  })();

  // ─────────────────────────────────
  // CREATE PROGRAM
  // ─────────────────────────────────

  const selectedFinalSeed = finalSeeds.find(fs => fs.id?.toString() === eventForm.final_seed_id?.toString());

  const handleCreateEvent = async () => {
    const errs = {};
    if (!eventForm.final_seed_id)             errs.final_seed_id     = 'Please select a seed type';
    if (!eventForm.organization_name?.trim()) errs.organization_name = 'Required';
    if (Object.keys(errs).length > 0) { setEventFormErrors(errs); return; }
    if (!selectedFinalSeed) { setEventFormErrors({ general: 'Invalid selection.' }); return; }

    setCreating(true);
    try {
      const season = finalSeeds[0]?.season || currentSeason?.season || 'WET';
      const year   = finalSeeds[0]?.year   || currentSeason?.year   || new Date().getFullYear();
      await createDistributionEvent({
        barangay:          myBarangay,
        intervention:      getInterventionForSeedType(selectedFinalSeed.seed_type.name),
        seed_type:         selectedFinalSeed.seed_type.id,
        variety:           selectedFinalSeed.varieties.length === 1 ? selectedFinalSeed.varieties[0].id : null,
        season,
        year,
        organization_name: eventForm.organization_name,
        total_members:     totalFarmers,
      });
      setCreateModal(false);
      setEventForm({ final_seed_id: '', organization_name: '' });
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
  // DELETE PROGRAM (request)
  // ─────────────────────────────────

  const handleRequestDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await requestDeleteEvent(deleteModal, { note: 'BRGY President requested deletion.' });
      setDeleteModal(null);
      showSnack('success', 'Deletion request sent to admin for approval.');
      await loadAll();
    } catch (err) {
      showSnack('error', err.response?.data?.error || 'Failed to send deletion request.');
    } finally {
      setDeleting(false);
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
          @keyframes successPop { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
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
        @keyframes successPop { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        .prog-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .prog-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important; }
        .prog-card:active { transform: scale(0.98); }
        .farmer-row:hover { background-color: #f0fdf4 !important; }
        .btn-tap:active   { transform: scale(0.97); }
      `}</style>

      {/* ─────────── TOAST / SNACKBAR ─────────── */}
      {snackbar && (
        <div style={{
          position: 'fixed', zIndex: 500,
          animation: 'slideUp 0.25s ease',
          ...(snackbar.type === 'confirm'
            ? { bottom: '1.25rem', left: '50%', transform: 'translateX(-50%)', maxWidth: '420px', width: 'calc(100vw - 2rem)' }
            : { bottom: '1.25rem', left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 2rem)' }
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
              backgroundColor: snackbar.type === 'success' ? '#166534' : '#991b1b',
              color: 'white', padding: '0.75rem 1.25rem', borderRadius: '999px',
              fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              animation: snackbar.type === 'success' ? 'successPop 0.4s ease' : 'slideUp 0.25s ease',
            }}>
              {snackbar.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {snackbar.message}
            </div>
          )}
        </div>
      )}

      {/* ─────────── SUBMIT CONFIRM SNACKBAR ─────────── */}
      {submitConfirm && (
        <div style={{ position: 'fixed', zIndex: 500, bottom: '50%', left: '50%', transform: 'translate(-50%, 50%)', maxWidth: '380px', width: 'calc(100vw - 2rem)', animation: 'slideUp 0.25s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.5rem', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Send size={20} color="#1e40af" />
              </div>
              <div>
                <p style={{ fontWeight: 800, color: '#1a1a1a', margin: 0, fontSize: '0.95rem' }}>Submit Batch?</p>
                <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>Once submitted, admin will review this batch.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setSubmitConfirm(false)} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Cancel</button>
              <button
                onClick={() => handleSubmitBatch(reportBatchData?.id || batchData?.id)}
                disabled={submitting}
                style={{ flex: 2, padding: '0.75rem', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', boxShadow: '0 4px 12px rgba(30,64,175,0.4)' }}>
                <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Batch'}
              </button>
            </div>
          </div>
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <ChevronLeft size={15} />
            {view === 'detail' ? 'Programs' : currentEvent?.organization_name || 'Program'}
          </button>
          {currentEvent && view !== 'detail' && (
            <>
              <ChevronRight size={12} color="#9ca3af" />
              <span style={{ color: '#374151', fontWeight: 700 }}>
                {view === 'encode' ? 'Register Farmer' : eventIsHybrid ? 'Report' : 'Masterlist'}
              </span>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: PROGRAMS
      ══════════════════════════════════════════ */}
      {view === 'programs' && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Beneficiaries</h1>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                {myBarangay} · {finalSeason || 'No active season'}
              </p>
            </div>
            <button
              onClick={() => {
                if (finalSeeds.length === 0) {
                  showSnack('error', 'No finalized seed types yet. Admin must finalize seeds in Seed Poll first.');
                  return;
                }
                setCreateModal(true);
              }}
              className="btn-tap"
              style={{ padding: '0.625rem 1.125rem', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', boxShadow: `0 4px 12px ${colors.primary}35` }}>
              <Plus size={16} /> New Program
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Approved Farmers', value: totalFarmers, sub: `in ${myBarangay}`, Icon: Users,         color: colors.primary, bg: '#f0fdf4', border: '#bbf7d0' },
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
              <input value={programSearch} onChange={e => setProgramSearch(e.target.value)} placeholder="Search by organization or seed type..." style={{ ...inputStyle(false), paddingLeft: '2.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Type filter — from finalSeeds */}
              <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '0.375rem 0.625rem', border: `1.5px solid ${filterType ? colors.primary : '#e5e7eb'}`, borderRadius: '0.5rem', fontSize: '0.78rem', cursor: 'pointer', backgroundColor: filterType ? '#f0fdf4' : 'white', color: filterType ? colors.primary : '#6b7280', fontWeight: filterType ? 700 : 400, outline: 'none' }}>
                <option value="">All Programs</option>
                {typeFilterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              {/* Season filter */}
              <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)} style={{ padding: '0.375rem 0.625rem', border: `1.5px solid ${filterSeason ? colors.primary : '#e5e7eb'}`, borderRadius: '0.5rem', fontSize: '0.78rem', cursor: 'pointer', backgroundColor: filterSeason ? '#f0fdf4' : 'white', color: filterSeason ? colors.primary : '#6b7280', fontWeight: filterSeason ? 700 : 400, outline: 'none' }}>
                <option value="">All Seasons</option>
                <option value="WET">Wet Season</option>
                <option value="DRY">Dry Season</option>
              </select>
              {(filterType || filterSeason || programSearch) && (
                <button onClick={() => { setProgramSearch(''); setFilterType(''); setFilterSeason(''); }} style={{ padding: '0.375rem 0.625rem', border: '1.5px solid #fca5a5', borderRadius: '0.5rem', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filteredEvents.map((event, idx) => {
                const evIsHybrid = isHybrid(event.seed_type_name) || isHybrid(event.intervention);
                const cardColor  = evIsHybrid ? '#1e40af' : '#166534';
                const cardBg     = evIsHybrid ? '#1e40af' : '#166534';
                return (
                  <div key={event.id} style={{ backgroundColor: cardBg, borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', animation: `slideUp ${0.3 + idx * 0.06}s ease', position: 'relative` }}>
                    {/* Card main content — clickable */}
                    <div
                      className="prog-card"
                      onClick={() => !event.delete_requested && openProgram(event)}
                      style={{ padding: '1.25rem', cursor: event.delete_requested ? 'default' : 'pointer', color: 'white', position: 'relative', overflow: 'hidden' }}
                    >
                      <div style={{ position: 'absolute', right: '-15px', top: '-15px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />

                      {/* Delete pending banner */}
                      {event.delete_requested && (
                        <div style={{ backgroundColor: 'rgba(220,38,38,0.25)', border: '1px solid rgba(220,38,38,0.5)', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Clock size={12} /> Deletion pending admin approval
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Show seed type name (Hybrid/Inbred), not RCEF/NRP */}
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.22)', padding: '0.15rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                              {event.seed_type_name || (evIsHybrid ? 'Hybrid' : 'Inbred')}
                            </span>
                            {event.variety_name && (
                              <span style={{ fontSize: '0.7rem', opacity: 0.8, backgroundColor: 'rgba(255,255,255,0.12)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>{event.variety_name}</span>
                            )}
                          </div>
                          <h3 style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, lineHeight: 1.3 }}>{event.organization_name}</h3>
                          <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '0.25rem 0 0' }}>
                            {event.season_display} {event.year}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, lineHeight: 1 }}>
                            {event.total_encoded}<span style={{ fontSize: '0.875rem', opacity: 0.7 }}>/{event.total_members}</span>
                          </p>
                          <p style={{ fontSize: '0.68rem', opacity: 0.65, margin: '0.125rem 0 0' }}>encoded</p>
                        </div>
                      </div>

                      <ProgressBar value={event.total_encoded} max={event.total_members} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.625rem', fontSize: '0.7rem', opacity: 0.7 }}>
                        <span>Approved: {event.total_approved}</span>
                        <span>Remaining: {event.total_remaining}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          {event.batch_count} batch{event.batch_count !== 1 ? 'es' : ''} <ChevronRight size={11} />
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: PROGRAM DETAIL
      ══════════════════════════════════════════ */}
      {view === 'detail' && currentEvent && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          {/* Program header */}
          <div style={{ backgroundColor: eventIsHybrid ? '#1e40af' : colors.primary, borderRadius: '1rem', padding: '1.25rem', color: 'white', marginBottom: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                  <span style={{ backgroundColor: 'rgba(255,255,255,0.22)', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                    {currentEvent.seed_type_name || (eventIsHybrid ? 'Hybrid' : 'Inbred')}
                  </span>
                  {currentEvent.variety_name && (
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem' }}>
                      {currentEvent.variety_name}
                    </span>
                  )}
                </div>
                <h2 style={{ fontWeight: 800, fontSize: '1rem', margin: 0, lineHeight: 1.3 }}>{currentEvent.organization_name}</h2>
                <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '0.25rem 0 0' }}>
                  {finalSeason || `${currentEvent.season_display} ${currentEvent.year}`} · {currentEvent.barangay}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={openReport}
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.5rem 0.875rem', borderRadius: '0.625rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  <FileText size={14} /> {eventIsHybrid ? 'Report' : 'Masterlist'}
                </button>
                {!currentEvent.delete_requested && currentEvent.status === 'ACTIVE' && (
                  <button
                    onClick={() => setDeleteModal(currentEvent.id)}
                    style={{ backgroundColor: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.35)', color: 'white', padding: '0.5rem 0.875rem', borderRadius: '0.625rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    <Trash2 size={14} /> Request Delete
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.72rem', opacity: 0.8 }}>
              <span>{currentEvent.total_encoded} of {currentEvent.total_members} farmers</span>
              <span>{currentEvent.total_members > 0 ? Math.round((currentEvent.total_encoded / currentEvent.total_members) * 100) : 0}%</span>
            </div>
            <ProgressBar value={currentEvent.total_encoded} max={currentEvent.total_members} />
            {currentEvent.delete_requested && (
              <div style={{ marginTop: '1rem', padding: '0.9rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', color: '#991b1b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} /> Deletion request sent. Waiting for admin approval.
              </div>
            )}
          </div>

          {/* Batch status */}
          {batchData && (
            <div style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1.25rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.625rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <StatusBadge status={batchData.status} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Batch {batchData.batch_number}</span>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{batchData.entry_count}/10 · {signedCount} signed</span>
              </div>
              {batchData.status === 'DRAFT' && batchData.entry_count > 0 && (
                <button onClick={() => setSubmitConfirm(true)} style={{ padding: '0.375rem 0.875rem', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Send size={13} /> Submit to Admin
                </button>
              )}
              {batchData.status === 'REJECTED' && (
                <button onClick={() => setSubmitConfirm(true)} style={{ padding: '0.375rem 0.875rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Send size={13} /> Resubmit
                </button>
              )}
            </div>
          )}

          {/* Rejection note */}
          {batchData?.rejected_reason && batchData.status === 'REJECTED' && (
            <div style={{ backgroundColor: '#fee2e2', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <p style={{ color: '#991b1b', fontWeight: 700, margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <AlertCircle size={14} /> Admin Rejection Notes:
              </p>
              <p style={{ color: '#991b1b', margin: '0 0 0.75rem' }}>{batchData.rejected_reason}</p>
              <button onClick={() => showSnack('success', 'Noted. Fix the issues and resubmit.')}
                style={{ padding: '0.375rem 0.875rem', backgroundColor: '#991b1b', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle size={13} /> I Understand — Ready to Fix
              </button>
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
                <input
                  value={farmerSearch}
                  onChange={e => handleFarmerSearch(e.target.value)}
                  placeholder="Search farmer by name or RSBSA..."
                  style={{ ...inputStyle(false), paddingLeft: '2.25rem' }}
                />
              </div>
              {farmerSearching && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0', color: '#9ca3af', fontSize: '0.78rem' }}>
                  <div style={{ width: '14px', height: '14px', border: '2px solid #e5e7eb', borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Searching...
                </div>
              )}
              {!farmerSearching && farmerSearch.length >= 2 && farmerResults.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.625rem 0 0', textAlign: 'center', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  No eligible farmers found. They may already be enrolled in this program.
                </p>
              )}
              {!farmerSearching && farmerResults.length > 0 && (
                <div style={{ marginTop: '0.625rem', border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                  {farmerResults.map((farmer, idx) => (
                    <div
                      key={farmer.id}
                      className="farmer-row"
                      onClick={() => openEncode(farmer)}
                      style={{ padding: '0.875rem 1rem', borderBottom: idx < farmerResults.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s', backgroundColor: 'white' }}
                    >
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>
                          {farmer.last_name}, {farmer.first_name} {farmer.middle_name ? farmer.middle_name[0] + '.' : ''}
                        </p>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                          {farmer.rsbsa_number || 'No RSBSA'} · {farmer.barangay}
                          {/* Show if already enrolled in another program */}
                          {farmer.enrolled_in && (
                            <span style={{ marginLeft: '0.5rem', backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.1rem 0.375rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700 }}>
                              Also in {farmer.enrolled_in} · {farmer.enrolled_area ? `${farmer.enrolled_area} ha` : ''}
                            </span>
                          )}
                        </p>
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
              Batch is full (10/10). Submit this batch first, then you can add more.
            </div>
          )}

          {/* Encoded farmers list */}
          {batchData?.entries?.length > 0 && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0, color: '#374151' }}>Registered Farmers</h3>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{batchData.entry_count}/10 · {signedCount} signed</span>
              </div>
              {batchData.entries.map((entry, idx) => (
                <div key={entry.id} style={{ padding: '0.875rem 1.25rem', borderBottom: idx < batchData.entries.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>{entry.row_number}</div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>{entry.farmer_name}</p>
                      <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                        {entry.farmer_rsbsa || '—'} · {entry.farm_area_ha ? `${entry.farm_area_ha} ha` : '—'}
                        {entry.variety_name && <span style={{ marginLeft: '0.375rem', color: colors.primary, fontWeight: 600 }}>· {entry.variety_name}</span>}
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
                        onClick={() => showSnack('confirm', `Remove ${entry.farmer_name}?`, {
                          onConfirm: async () => {
                            setSnackbar(null);
                            try { await deleteEntry(entry.id); refreshDetail(); showSnack('success', `${entry.farmer_name} removed.`); }
                            catch (err) { showSnack('error', err.response?.data?.error || 'Failed.'); }
                          },
                          onCancel: () => setSnackbar(null),
                        })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.25rem' }}>
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

      {/* ══════════════════════════════════════════
          VIEW: ENCODE FARMER
      ══════════════════════════════════════════ */}
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
                  <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>{label}</p>
                  <p style={{ fontSize: '0.72rem', color: '#374151', margin: '0.125rem 0 0', fontWeight: 600, wordBreak: 'break-word' }}>{value}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {currentFarmer.ip             && <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>IP</span>}
              {currentFarmer.senior_citizen && <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>Senior Citizen</span>}
              {currentFarmer.pwd            && <span style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>PWD</span>}
              {currentFarmer.arbs           && <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>ARB</span>}
              {currentFarmer.four_ps        && <span style={{ backgroundColor: '#fce7f3', color: '#9d174d', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>4Ps</span>}
            </div>
          </div>

          {/* Program type banner */}
          <div style={{ backgroundColor: eventIsHybrid ? '#eff6ff' : '#f0fdf4', border: `1px solid ${eventIsHybrid ? '#bfdbfe' : '#bbf7d0'}`, borderRadius: '0.875rem', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Leaf size={14} color={eventIsHybrid ? '#1e40af' : '#166534'} />
            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: eventIsHybrid ? '#1e40af' : '#166534', margin: 0 }}>
              {eventIsHybrid ? 'Hybrid' : 'Inbred'} Program — {currentEvent?.organization_name}
              {eventFinalVarieties.length === 1 && (
                <span style={{ fontWeight: 400, marginLeft: '0.5rem', opacity: 0.8 }}>· {eventFinalVarieties[0].name}</span>
              )}
            </p>
          </div>

          {/* Input fields */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wheat size={15} color={colors.primary} />
              {eventIsHybrid ? 'Region Masterlist Fields' : 'PhilRice / Inbred Fields'}
            </p>

            {/* Hybrid only: farm area */}
            {eventIsHybrid && (
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                  Farm Area (ha) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input type="number" step="0.01" min="0.01" value={encodeForm.farm_area_ha}
                  onChange={e => { setEncodeForm(p => ({ ...p, farm_area_ha: e.target.value })); setEncodeErrors(p => ({ ...p, farm_area_ha: '' })); }}
                  placeholder="e.g. 0.50" style={inputStyle(!!encodeErrors.farm_area_ha)} />
                {encodeErrors.farm_area_ha && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{encodeErrors.farm_area_ha}</p>}
              </div>
            )}

            {/* Hybrid and Inbred: bag quantity */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Qty (bags) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input type="number" min="1" step="1" value={encodeForm.qty_bags}
                onChange={e => { setEncodeForm(p => ({ ...p, qty_bags: e.target.value })); setEncodeErrors(p => ({ ...p, qty_bags: '' })); }}
                placeholder="e.g. 1" style={inputStyle(!!encodeErrors.qty_bags)} />
              {encodeErrors.qty_bags && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{encodeErrors.qty_bags}</p>}
            </div>

            {/* Inbred only: area planted */}
            {eventIsInbred && (
              <>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Area to be Planted (ha) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="number" step="0.01" min="0.01" value={encodeForm.area_planted} onChange={e => { setEncodeForm(p => ({ ...p, area_planted: e.target.value })); setEncodeErrors(p => ({ ...p, area_planted: '' })); }} placeholder="e.g. 0.50" style={inputStyle(!!encodeErrors.area_planted)} />
                  {encodeErrors.area_planted && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{encodeErrors.area_planted}</p>}
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Expected Yield (kg) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="number" step="0.1" min="0" value={encodeForm.expected_yield} onChange={e => { setEncodeForm(p => ({ ...p, expected_yield: e.target.value })); setEncodeErrors(p => ({ ...p, expected_yield: '' })); }} style={inputStyle(!!encodeErrors.expected_yield)} placeholder="e.g. 500" />
                  {encodeErrors.expected_yield && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{encodeErrors.expected_yield}</p>}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '0.625rem', border: `1px solid ${encodeErrors.data_sharing ? '#dc2626' : '#bfdbfe'}`, marginBottom: '0.875rem' }}>
                  <input type="checkbox" checked={encodeForm.data_sharing} onChange={e => { setEncodeForm(p => ({ ...p, data_sharing: e.target.checked })); setEncodeErrors(p => ({ ...p, data_sharing: '' })); }} style={{ width: '16px', height: '16px', accentColor: '#1e40af' }} />
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af', margin: 0 }}>Data Sharing Consent</p>
                    <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: '0.125rem 0 0' }}>Farmer agrees to share data with DA PhilRice</p>
                  </div>
                </label>
                {encodeErrors.data_sharing && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '-0.75rem 0 0 2.25rem' }}>{encodeErrors.data_sharing}</p>}
              </>
            )}
          </div>

          {/* Variety selector — if more than 1 final variety */}
          {eventFinalVarieties.length > 1 && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: encodeErrors.variety ? '2px solid #dc2626' : '1px solid #f3f4f6', animation: 'reveal 0.3s ease' }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wheat size={15} color={colors.primary} />
                Select Variety <span style={{ color: '#dc2626' }}>*</span>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {eventFinalVarieties.map(v => {
                  const sel = encodeForm.selected_variety_id === v.id;
                  return (
                    <button key={v.id} type="button"
                      onClick={() => { setEncodeForm(p => ({ ...p, selected_variety_id: v.id })); setEncodeErrors(p => ({ ...p, variety: '' })); }}
                      style={{ padding: '0.625rem 1.25rem', border: `2px solid ${sel ? colors.primary : '#e5e7eb'}`, borderRadius: '0.75rem', backgroundColor: sel ? '#f0fdf4' : 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', color: sel ? colors.primary : '#374151', transition: 'all 0.2s', boxShadow: sel ? `0 4px 12px ${colors.primary}25` : 'none', transform: sel ? 'scale(1.02)' : 'scale(1)' }}>
                      {sel ? <CheckCircle size={12} style={{ display: 'inline', marginRight: '0.25rem' }} /> : null}{v.name}
                    </button>
                  );
                })}
              </div>
              {encodeErrors.variety && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.5rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={12} /> {encodeErrors.variety}</p>}
            </div>
          )}
          {eventFinalVarieties.length === 1 && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.625rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={13} /> Variety auto-selected: <strong>{eventFinalVarieties[0].name}</strong>
            </div>
          )}

          {/* Signature */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem', border: encodeErrors.signature ? '2px solid #dc2626' : '1px solid #f3f4f6' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pen size={15} color={colors.primary} />
              Signature / Thumbmark <span style={{ color: '#dc2626', marginLeft: '0.25rem' }}>*</span>
            </p>
            <div style={{ border: `2px dashed ${encodeErrors.signature ? '#dc2626' : '#d1d5db'}`, borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#fafafa', marginBottom: '0.75rem', position: 'relative' }}>
              <SignatureCanvas ref={sigRef} penColor="#1a1a1a"
                canvasProps={{ width: Math.min(window.innerWidth - 80, 420), height: 160, style: { display: 'block', width: '100%', touchAction: 'none' } }}
                onBegin={() => setEncodeErrors(p => ({ ...p, signature: '' }))} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', opacity: 0.12, textAlign: 'center' }}>
                <Pen size={40} color="#9ca3af" />
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0', whiteSpace: 'nowrap' }}>Farmer signs here</p>
              </div>
            </div>
            {encodeErrors.signature && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0 0 0.625rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={12} /> {encodeErrors.signature}</p>}
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', margin: '0 0 0.75rem' }}>Farmer places signature or thumbmark in the box</p>
            <button onClick={() => { sigRef.current?.clear(); setEncodeErrors(p => ({ ...p, signature: '' })); }} style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#6b7280' }}>
              Clear Signature
            </button>
          </div>

          {/* Confirm button */}
          <button onClick={handleSaveEntry} disabled={saving} className="btn-tap" style={{ width: '100%', padding: '0.9375rem', backgroundColor: saving ? '#d1d5db' : colors.primary, color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: saving ? 'none' : `0 4px 16px ${colors.primary}40`, transition: 'all 0.2s' }}>
            <FileCheck size={20} /> {saving ? 'Saving...' : 'Confirm Registration'}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: REPORT / MASTERLIST
      ══════════════════════════════════════════ */}
      {view === 'report' && currentEvent && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>

          {/* Document header */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #e5e7eb' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: 0 }}>Republic of the Philippines · Department of Agriculture</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1a1a1a', margin: '0.375rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Lists of Farmer-Beneficiaries
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.78rem', color: '#374151' }}>
              <span><strong>Province:</strong> Quezon</span>
              <span><strong>Municipality:</strong> Lucban</span>
              <span><strong>Intervention:</strong> {eventIsHybrid ? 'Hybrid' : 'Inbred'}</span>
              <span><strong>Season:</strong> {finalSeason || `${currentEvent.season_display} ${currentEvent.year}`}</span>
              <span><strong>Barangay:</strong> {currentEvent.barangay}</span>
              <span><strong>Total Members:</strong> {currentEvent.total_members}</span>
              <span style={{ gridColumn: '1/-1' }}><strong>Organization:</strong> {currentEvent.organization_name}</span>
            </div>
          </div>

          {/* Batch selector */}
          {batches.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {batches.map(b => (
                <button key={b.id} onClick={() => loadReportBatch(b.id)}
                  style={{ padding: '0.375rem 0.875rem', borderRadius: '999px', cursor: 'pointer', border: `1.5px solid ${reportBatchId === b.id ? colors.primary : '#e5e7eb'}`, backgroundColor: reportBatchId === b.id ? '#f0fdf4' : 'white', color: reportBatchId === b.id ? colors.primary : '#374151', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.15s' }}>
                  Batch {b.batch_number} <StatusBadge status={b.status} />
                </button>
              ))}
            </div>
          )}

          {reportLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ width: '32px', height: '32px', border: `3px solid ${colors.primary}22`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
              Loading...
            </div>
          ) : entriesByVariety.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {entriesByVariety.map((group, gIdx) => (
                <div key={gIdx} style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', animation: `slideUp ${0.3 + gIdx * 0.07}s ease` }}>
                  {/* Table header with variety (hybrid only) and submit button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                      {reportBatchData?.status && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>
                          Batch {reportBatchData.batch_number}
                        </span>
                      )}
                      {/* Only show variety label for hybrid */}
                      {eventIsHybrid && group.name && (
                        <>
                          <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>·</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <Wheat size={14} color={colors.primary} />
                            <span style={{ fontWeight: 800, fontSize: '0.875rem', color: colors.primary }}>
                              Variety: {group.name}
                            </span>
                          </div>
                        </>
                      )}
                      <span style={{ backgroundColor: '#f3f4f6', color: '#6b7280', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>
                        {group.entries.length} farmer{group.entries.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {/* Submit/status button per table */}
                    {reportBatchData?.status === 'DRAFT' && (
                      <button
                        onClick={() => setSubmitConfirm(true)}
                        disabled={submitting}
                        style={{ padding: '0.5rem 1.125rem', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem', boxShadow: `0 2px 8px ${colors.primary}35` }}>
                        <Send size={13} /> Submit
                      </button>
                    )}
                    {reportBatchData?.status === 'SUBMITTED' && (
                      <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.375rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} /> Awaiting Admin
                      </span>
                    )}
                    {reportBatchData?.status === 'APPROVED' && (
                      <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.375rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle size={12} /> Approved
                      </span>
                    )}
                    {reportBatchData?.status === 'REJECTED' && (
                      <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.375rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <XCircle size={12} /> Rejected
                      </span>
                    )}
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1100px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          {[
                            ['No.', false], ['RSBSA No.', false],
                            ['Last Name', false], ['First Name', false], ['Middle Name', false], ['Ext.', false],
                            ['Date of Birth', false], ['Res. Municipality', true], ['Res. Barangay', true],
                            ['Farm Municipality', true], ['Farm Barangay', true],
                            ['Gender', false], ['IP', true], ['Senior Citizen', true],
                            ['PWD', true], ['ARBs', true], ['4Ps', true],
                            ['Farm Area (ha)', false], ['QTY (bags)', false],
                            ['Contact No.', false], ['Signature', false], ['Action', false],
                          ].map(([col, red], i) => (
                            <th key={i} style={{ padding: '0.5rem 0.375rem', textAlign: 'center', fontWeight: 700, color: red ? '#dc2626' : '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.entries.map((entry, idx) => {
                          const fd  = entry.farmer_detail || {};
                          const tdS = { padding: '0.4375rem 0.375rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
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
                                  ? <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.15rem 0.375rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>Signed</span>
                                  : <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.15rem 0.375rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>Unsigned</span>
                                }
                              </td>
                              {/* Remove button (only in DRAFT) */}
                              <td style={{ ...tdS, textAlign: 'center' }}>
                                {reportBatchData?.status === 'DRAFT' || reportBatchData?.status === 'REJECTED' ? (
                                  <button
                                    onClick={() => showSnack('confirm', `Remove ${entry.farmer_name} from this batch?`, {
                                      onConfirm: async () => {
                                        setSnackbar(null);
                                        try {
                                          await deleteEntry(entry.id);
                                          await loadReportBatch(reportBatchId);
                                          showSnack('success', `${entry.farmer_name} removed. Search them again to re-encode.`);
                                        } catch (err) {
                                          showSnack('error', err.response?.data?.error || 'Failed to remove.');
                                        }
                                      },
                                      onCancel: () => setSnackbar(null),
                                    })}
                                    style={{ padding: '0.15rem 0.375rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.15rem', whiteSpace: 'nowrap' }}>
                                    <XCircle size={9} /> Remove
                                  </button>
                                ) : <span style={{ color: '#d1d5db', fontSize: '0.6rem' }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Rejection notes below all tables */}
              {reportBatchData?.status === 'REJECTED' && reportBatchData?.rejected_reason && (
                <div style={{ backgroundColor: '#fee2e2', borderRadius: '0.875rem', padding: '1rem 1.25rem', border: '1px solid #fca5a5', animation: 'slideUp 0.3s ease' }}>
                  <p style={{ fontWeight: 700, color: '#991b1b', margin: '0 0 0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={15} /> Admin Rejection Notes
                  </p>
                  <p style={{ color: '#991b1b', fontSize: '0.8rem', margin: '0 0 1rem' }}>{reportBatchData.rejected_reason}</p>
                  <button
                    onClick={() => setSubmitConfirm(true)}
                    disabled={submitting}
                    style={{ padding: '0.625rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Send size={14} /> {submitting ? 'Submitting...' : 'Acknowledge & Resubmit'}
                  </button>
                </div>
              )}
            </div>
          ) : !reportLoading && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
              <FileText size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              No farmers encoded in this batch yet.
            </div>
          )}
        </div>
      )}


      {/* ══════════════════════════════════════════
          CREATE PROGRAM MODAL
      ══════════════════════════════════════════ */}
      {createModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))', animation: 'slideUp 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>New Distribution Program</h2>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                  {myBarangay} · {finalSeason || '—'}
                </p>
              </div>
              <button onClick={() => { setCreateModal(false); setEventFormErrors({}); setEventForm({ final_seed_id: '', organization_name: '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.25rem' }}>
                <XCircle size={22} />
              </button>
            </div>

            {/* Auto-filled info */}
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#166534' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span><strong>Barangay:</strong> {myBarangay}</span>
                <span><strong>Season:</strong> {finalSeason || '—'}</span>
              </div>
              <p style={{ margin: '0.375rem 0 0' }}><strong>Total Members:</strong> {totalFarmers} approved farmers (auto-detected)</p>
            </div>

            {eventFormErrors.general && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem' }}>{eventFormErrors.general}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Seed Type selection — only from finalSeeds, show type name (Hybrid/Inbred) */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                  Seed Type <span style={{ color: '#dc2626' }}>*</span>
                  <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.68rem' }}>based on finalized seed poll</span>
                </label>
                {finalSeeds.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#dc2626', margin: 0 }}>No finalized seed types. Admin must finalize seeds in Seed Poll first.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: finalSeeds.length === 1 ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
                    {finalSeeds.map(fs => {
                      const isH     = isHybrid(fs.seed_type.name);
                      const color   = isH ? '#1e40af' : '#166534';
                      const bg      = isH ? '#eff6ff' : '#f0fdf4';
                      const border  = isH ? '#bfdbfe' : '#bbf7d0';
                      const selected = eventForm.final_seed_id?.toString() === fs.id?.toString();
                      return (
                        <button key={fs.id} type="button"
                          onClick={() => setEventForm(p => ({ ...p, final_seed_id: fs.id }))}
                          style={{ padding: '0.875rem', textAlign: 'left', border: `2px solid ${selected ? color : '#e5e7eb'}`, borderRadius: '0.875rem', backgroundColor: selected ? bg : 'white', cursor: 'pointer', transition: 'all 0.15s', boxShadow: selected ? `0 4px 12px ${color}20` : 'none' }}>
                          <p style={{ fontWeight: 800, fontSize: '1rem', color: selected ? color : '#374151', margin: 0 }}>
                            {fs.seed_type.name}
                          </p>
                          <p style={{ fontSize: '0.68rem', color: selected ? color : '#9ca3af', margin: '0.125rem 0 0.375rem', opacity: 0.9 }}>
                            {isH ? 'Region' : 'PhilRice'}
                          </p>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {fs.varieties.map(v => (
                              <span key={v.id} style={{ backgroundColor: selected ? `${color}15` : '#f3f4f6', color: selected ? color : '#6b7280', padding: '0.1rem 0.375rem', borderRadius: '999px', fontSize: '0.63rem', fontWeight: 600 }}>
                                {v.name}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {eventFormErrors.final_seed_id && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{eventFormErrors.final_seed_id}</p>}
              </div>

              {/* Organization */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                  Organization / Association <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  value={eventForm.organization_name}
                  onChange={e => setEventForm(p => ({ ...p, organization_name: e.target.value }))}
                  placeholder="e.g. Samahan ng Magpapalay sa Brgy. May-It"
                  style={inputStyle(!!eventFormErrors.organization_name)}
                />
                {eventFormErrors.organization_name && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{eventFormErrors.organization_name}</p>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => { setCreateModal(false); setEventFormErrors({}); setEventForm({ final_seed_id: '', organization_name: '' }); }} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={handleCreateEvent} disabled={creating} className="btn-tap" style={{ flex: 2, padding: '0.875rem', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.95rem', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={18} /> {creating ? 'Creating...' : 'Create Program'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════
          DELETE REQUEST MODAL
      ══════════════════════════════════════════ */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', backgroundColor: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Trash2 size={26} color="#dc2626" />
              </div>
              <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Request Program Deletion?</h2>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                This will send a deletion request to the admin. The program will only be deleted after admin approves it.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeleteModal(null)} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button
                onClick={handleRequestDelete}
                disabled={deleting}
                style={{ flex: 2, padding: '0.875rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.9rem', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} /> {deleting ? 'Sending...' : 'Send Delete Request'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BrgyDistribution;