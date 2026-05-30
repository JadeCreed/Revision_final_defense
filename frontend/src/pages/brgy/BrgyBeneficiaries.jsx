// src/pages/brgy/BrgyBeneficiaries.jsx
// ============================================================
// BRGY Beneficiaries — Masterlist encoding for Hybrid & Inbred
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import SignatureCanvas from 'react-signature-canvas';
import {
  Plus, Search, ChevronRight, ChevronLeft,
  CheckCircle, Clock, XCircle, Send, Pen,
  Trash2, AlertCircle, FileText, ChevronDown,
  ChevronUp, Eye, Edit2, Package, Download
} from 'lucide-react';
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
  reopenBatch,
  searchFarmers,
  getBrgyDistributionContext,
  getFinalSeeds,
  requestDeleteEvent,
  updateEntry,
} from '../../api/axios';

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const GREEN = {
  primary:   '#1a4d1a',
  light:     '#f0fdf4',
  border:    '#bbf7d0',
  accent:    '#166534',
  soft:      '#dcfce7',
};

const STATUS_CFG = {
  DRAFT:     { bg: '#f9fafb', color: '#6b7280',  label: 'Draft'     },
  SUBMITTED: { bg: '#fef9c3', color: '#854d0e',  label: 'Submitted' },
  APPROVED:  { bg: '#dcfce7', color: '#166534',  label: 'Approved'  },
  REJECTED:  { bg: '#fee2e2', color: '#991b1b',  label: 'Rejected'  },
};

const isHybrid = (name = '') => {
  const n = name.toUpperCase();
  return n.includes('HYBRID') || n === 'NRP' || n === 'RFO';
};
const isInbred = (name = '') => {
  const n = name.toUpperCase();
  return n.includes('INBRED') || n === 'RCEF';
};

// ─────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const c = STATUS_CFG[status] || STATUS_CFG.DRAFT;
  return (
    <span style={{
      backgroundColor: c.bg, color: c.color,
      padding: '0.2rem 0.625rem', borderRadius: '999px',
      fontSize: '0.7rem', fontWeight: 700,
    }}>{c.label}</span>
  );
};

const ProgressBar = ({ value, max }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: '100%', height: '5px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: GREEN.primary, borderRadius: '999px', transition: 'width 0.5s ease' }} />
    </div>
  );
};

// Toast notification
const Toast = ({ toast }) => {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 600,
      backgroundColor: isSuccess ? GREEN.primary : '#991b1b',
      color: 'white', padding: '0.75rem 1.5rem',
      borderRadius: '0.875rem', fontWeight: 600,
      fontSize: '0.875rem', display: 'flex',
      alignItems: 'center', gap: '0.5rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      maxWidth: 'calc(100vw - 2rem)',
    }}>
      {isSuccess ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {toast.message}
      <style>{`
        @keyframes toastIn {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// Confirm snackbar
const ConfirmSnack = ({ data, onConfirm, onCancel }) => {
  if (!data) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 600,
      width: 'min(100%, 420px)',
      animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem',
        padding: '1.25rem', boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        border: `1px solid ${GREEN.border}`,
      }}>
        <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 0.375rem', fontSize: '0.95rem' }}>
          {data.title}
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>
          {data.message}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '0.625rem',
            border: '1.5px solid #d1d5db', borderRadius: '0.625rem',
            backgroundColor: 'white', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.875rem', color: '#374151',
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex: 2, padding: '0.625rem',
            backgroundColor: GREEN.primary, color: 'white',
            border: 'none', borderRadius: '0.625rem',
            cursor: 'pointer', fontWeight: 700,
            fontSize: '0.875rem',
          }}>
            {data.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Signature viewer modal
const SignatureModal = ({ sig, onClose }) => {
  if (!sig) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      zIndex: 700, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem',
        padding: '1.25rem', maxWidth: '420px', width: '100%',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, margin: 0 }}>Farmer Signature</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}>×</button>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
          <img src={sig} alt="Farmer signature" style={{ width: '100%', display: 'block' }} />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────
const BrgyBeneficiaries = () => {
  const { role } = useAuth();

  // ── VIEW STATE ──
  // 'programs' | 'detail' | 'encode' | 'report' | 'edit'
  const [view, setView]               = useState('programs');
  const [currentEvent, setCurrentEvent] = useState(null);
  const [currentBatch, setCurrentBatch] = useState(null);
  const [currentFarmer, setCurrentFarmer] = useState(null);
  const [editEntry, setEditEntry]     = useState(null); // entry being edited

  // ── CONTEXT ──
  const [myBarangay, setMyBarangay]   = useState('');
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [finalSeeds, setFinalSeeds]   = useState([]);

  // ── DATA ──
  const [events, setEvents]           = useState([]);
  const [batches, setBatches]         = useState([]);
  const [batchDetails, setBatchDetails] = useState({});
  const [batchData, setBatchData]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [listPage, setListPage]       = useState(1);
  const PAGE_SIZE = 10;

  // ── FILTER ──
  const [programSearch, setProgramSearch] = useState('');
  const [filterType, setFilterType]   = useState('');
  const [encodedSearch, setEncodedSearch] = useState('');
  const [encodedSearchOpen, setEncodedSearchOpen] = useState(false);
  const encodedSearchRef = useRef(null);

  // ── FARMER SEARCH ──
  const [farmerSearch, setFarmerSearch]   = useState('');
  const [farmerResults, setFarmerResults] = useState([]);
  const [farmerSearching, setFarmerSearching] = useState(false);

  // ── ENCODE FORM ──
  const [encodeForm, setEncodeForm]   = useState({
    farm_area_ha: '',
    qty_bags: '',
    area_planted: '',
    crop_establishment: '',
    expected_sowing_date: '',
    date_received: '',
    authorized_representative: '',
    data_sharing: false,
    selected_variety_id: null,
    show_optional: false,
  });
  const [encodeErrors, setEncodeErrors] = useState({});
  const [saving, setSaving]           = useState(false);
  const sigRef                        = useRef(null);

  // ── REPORT ──
  const [reportBatchId, setReportBatchId]     = useState(null);
  const [reportBatchData, setReportBatchData] = useState(null);
  const [reportLoading, setReportLoading]     = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [nextStepBanner, setNextStepBanner]   = useState(null);

  // ── MODALS / TOASTS ──
  const [toast, setToast]             = useState(null);
  const [confirmSnack, setConfirmSnack] = useState(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [viewSig, setViewSig]         = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [eventForm, setEventForm]     = useState({ final_seed_id: '', organization_name: '' });
  const [eventFormErrors, setEventFormErrors] = useState({});
  const [creating, setCreating]       = useState(false);

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────
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

  const eventIsHybrid = isHybrid(currentEvent?.seed_type_name || currentEvent?.intervention || '');
  const eventIsInbred = isInbred(currentEvent?.seed_type_name || currentEvent?.intervention || '');

  const eventFinalVarieties = (() => {
    if (!currentEvent || !finalSeeds.length) return [];
    const fs = finalSeeds.find(f => {
      const n = f.seed_type.name;
      if (eventIsHybrid && isHybrid(n)) return true;
      if (eventIsInbred && isInbred(n)) return true;
      return false;
    });
    return fs?.varieties || [];
  })();

  // ─────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [ctxRes, evRes, fsRes] = await Promise.all([
        getBrgyDistributionContext(),
        getDistributionEvents(),
        getFinalSeeds(),
      ]);
      setMyBarangay(ctxRes.data.barangay || '');
      setTotalFarmers(ctxRes.data.total_approved_farmers || 0);
      setEvents(evRes.data || []);
      setFinalSeeds(fsRes.data || []);
    } catch {
      showToast('error', 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const finalSeason = finalSeeds[0]
    ? `${finalSeeds[0].season_display} ${finalSeeds[0].year}`
    : null;

  const getEffectiveTotalMembers = (event) => {
    const expected = event?.total_members || 0;
    return Math.max(expected, totalFarmers || 0);
  };

  const compareEntries = (a, b) => {
    if (a.created_at && b.created_at) {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    if (a.id && b.id) {
      return Number(b.id) - Number(a.id);
    }
    return 0;
  };

  const loadAllBatchDetails = useCallback(async (batchList) => {
    if (!batchList?.length) {
      setBatchDetails({});
      return;
    }
    try {
      const details = await Promise.all(batchList.map(async (batch) => {
        const det = await getBatchDetail(batch.id);
        return {
          ...det.data,
          batch_id: batch.id,
          batch_number: batch.batch_number,
          batch_status: det.data.status,
        };
      }));
      setBatchDetails(details.reduce((acc, detail) => {
        acc[detail.batch_id] = detail;
        return acc;
      }, {}));
    } catch {
      setBatchDetails({});
    }
  }, []);

  const allEncodedEntries = Object.values(batchDetails)
    .flatMap(detail => (detail.entries || []).map(entry => ({
      ...entry,
      batch_id: detail.batch_id,
      batch_number: detail.batch_number,
      batch_status: detail.batch_status,
    })))
    .sort(compareEntries);

  const filteredEncodedEntries = allEncodedEntries.filter(entry => {
    const query = encodedSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      entry.farmer_name,
      entry.farmer_rsbsa?.toString(),
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });

  const totalEncodedEntries = allEncodedEntries.length;
  const totalEncodedFarmers = filteredEncodedEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalEncodedFarmers / PAGE_SIZE));
  const pageEntries = filteredEncodedEntries.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE);

  useEffect(() => {
    setListPage(1);
  }, [encodedSearch, totalEncodedFarmers]);

  useEffect(() => {
    if (!encodedSearchOpen) return;
    const handleClickOutside = (event) => {
      if (encodedSearchRef.current && !encodedSearchRef.current.contains(event.target)) {
        setEncodedSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [encodedSearchOpen]);

  // ─────────────────────────────────────────
  // OPEN PROGRAM
  // ─────────────────────────────────────────
  const openProgram = async (event) => {
    setCurrentEvent(event);
    setFarmerSearch('');
    setFarmerResults([]);
    setEncodedSearch('');
    setEncodedSearchOpen(false);
    setView('detail');
    try {
      const [evRes, bRes] = await Promise.all([
        getDistributionEvent(event.id),
        getEventBatches(event.id),
      ]);
      setCurrentEvent(evRes.data);
      const allBatches = bRes.data || [];
      setBatches(allBatches);
      await loadAllBatchDetails(allBatches);
      const rejectedBatch = allBatches.find(b => b.status === 'REJECTED');
      const draftBatches = allBatches.filter(b => b.status === 'DRAFT');
      const latestDraft = draftBatches.length > 0
        ? draftBatches.reduce((latest, batch) => (batch.batch_number > (latest.batch_number || 0) ? batch : latest), draftBatches[0])
        : null;
      const openBatch = rejectedBatch
        || (latestDraft && latestDraft.entry_count < 10 ? latestDraft : null);

      if (openBatch) {
        setCurrentBatch(openBatch);
        const det = await getBatchDetail(openBatch.id);
        setBatchData(det.data);
      } else if (allBatches.length === 0 || evRes.data.status === 'ACTIVE') {
        const nb = await createBatch(evRes.data.id);
        setBatches(prev => [...prev, nb.data]);
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
      showToast('error', 'Failed to load program details.');
    }
  };

  const refreshDetail = useCallback(async (batchId = null) => {
    if (!currentEvent?.id) return;
    try {
      const [evRes, bRes] = await Promise.all([
        getDistributionEvent(currentEvent.id),
        getEventBatches(currentEvent.id),
      ]);
      setCurrentEvent(evRes.data);
      const allBatches = bRes.data || [];
      setBatches(allBatches);
      await loadAllBatchDetails(allBatches);
      const targetBatchId = batchId || currentBatch?.id;
      if (targetBatchId) {
        const det = await getBatchDetail(targetBatchId);
        setBatchData(det.data);
        const found = allBatches.find(b => b.id === targetBatchId);
        if (found) setCurrentBatch(found);
      }
    } catch {}
  }, [currentEvent?.id, currentBatch?.id]);

  // ─────────────────────────────────────────
  // FARMER SEARCH
  // ─────────────────────────────────────────
  const searchTimer = useRef(null);
  const handleFarmerSearch = (q) => {
    setFarmerSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setFarmerResults([]); return; }
    setFarmerSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchFarmers({ search: q, event_id: currentEvent?.id });
        setFarmerResults(res.data || []);
      } catch { setFarmerResults([]); }
      finally { setFarmerSearching(false); }
    }, 250);
  };

  // ─────────────────────────────────────────
  // OPEN ENCODE PAGE
  // ─────────────────────────────────────────
  const openEncode = (farmer) => {
    setCurrentFarmer(farmer);
    setEncodeForm({
      farm_area_ha: (eventIsHybrid && farmer && farmer.remaining_hectares) ? String(parseFloat(farmer.remaining_hectares)) : '',
      qty_bags: '',
      area_planted: (eventIsInbred && farmer && farmer.remaining_hectares) ? String(parseFloat(farmer.remaining_hectares)) : '',
      crop_establishment: '',
      expected_sowing_date: '',
      date_received: '',
      authorized_representative: '',
      data_sharing: false,
      selected_variety_id: eventFinalVarieties.length === 1 ? eventFinalVarieties[0].id : null,
      show_optional: false,
    });
    setEncodeErrors({});
    setView('encode');
    setTimeout(() => sigRef.current?.clear(), 100);
  };

  // ─────────────────────────────────────────
  // OPEN EDIT PAGE
  // ─────────────────────────────────────────
  const openEdit = (entry) => {
    setEditEntry(entry);
    setEncodeForm({
      farm_area_ha: entry.farm_area_ha || '',
      qty_bags: entry.qty_bags || '',
      area_planted: entry.area_planted || '',
      crop_establishment: entry.crop_establishment || '',
      expected_sowing_date: entry.expected_sowing_date || '',
      date_received: entry.date_received || '',
      authorized_representative: entry.authorized_representative || '',
      data_sharing: entry.data_sharing || false,
      selected_variety_id: entry.variety || null,
      show_optional: !!(entry.qty_bags || entry.area_planted),
    });
    setEncodeErrors({});
    setView('edit');
    setTimeout(() => {
      if (sigRef.current && entry.signature) {
        // show existing sig preview — canvas cleared for re-sign
        sigRef.current.clear();
      }
    }, 100);
  };

  // ─────────────────────────────────────────
  // VALIDATE ENCODE
  // ─────────────────────────────────────────
  const validateEncode = () => {
    const errs = {};
    if (eventIsHybrid) {
      if (!encodeForm.farm_area_ha) errs.farm_area_ha = 'Farm area is required';
    }
    if (eventIsInbred) {
      if (!encodeForm.area_planted) errs.area_planted = 'Area to be planted is required';
      if (!encodeForm.data_sharing && encodeForm.data_sharing !== true)
        errs.data_sharing = 'Data sharing consent is required';
    }
    if (eventFinalVarieties.length > 1 && !encodeForm.selected_variety_id)
      errs.variety = 'Please select a variety';
    
    
    if (view === 'encode' && (!sigRef.current || sigRef.current.isEmpty()))
      errs.signature = 'Signature is required';

    // Prevent encoding more than remaining hectares
    const remaining = currentFarmer ? Number(currentFarmer.remaining_hectares || 0) : null;
    if (remaining != null && !isNaN(remaining)) {
      if (eventIsHybrid && encodeForm.farm_area_ha) {
        const val = Number(encodeForm.farm_area_ha);
        if (!isNaN(val) && val > remaining) errs.farm_area_ha = `Cannot encode more than remaining (${remaining} ha)`;
      }
      if (eventIsInbred && encodeForm.area_planted) {
        const val = Number(encodeForm.area_planted);
        if (!isNaN(val) && val > remaining) errs.area_planted = `Cannot encode more than remaining (${remaining} ha)`;
      }
    }
    return errs;
  };

  // ─────────────────────────────────────────
  // SAVE ENTRY
  // ─────────────────────────────────────────
  const handleSaveEntry = () => {
    const errs = validateEncode();
    if (Object.keys(errs).length > 0) {
      setEncodeErrors(errs);
      showToast('error', errs.signature ? 'Signature is required.' : 'Please fill all required fields.');
      return;
    }
    setConfirmSnack({
      title: view === 'edit'
        ? `Update ${editEntry?.farmer_name}?`
        : `Register ${currentFarmer?.first_name} ${currentFarmer?.last_name}?`,
      message: 'Review the data before confirming.',
      confirmLabel: view === 'edit' ? 'Save Changes' : 'Confirm & Save',
    });
  };

  const doSaveEntry = async () => {
    setConfirmSnack(null);
    setSaving(true);
    let refreshBatchId = currentBatch?.id;
    try {
      if (view === 'edit') {
        // Update existing entry
        const payload = {
          farm_area_ha: eventIsHybrid ? Number(encodeForm.farm_area_ha) : null,
          qty_bags: encodeForm.show_optional && encodeForm.qty_bags
            ? Number(encodeForm.qty_bags) : null,
          area_planted: eventIsInbred ? Number(encodeForm.area_planted) : null,
          crop_establishment: encodeForm.show_optional ? encodeForm.crop_establishment : null,
          expected_sowing_date: encodeForm.show_optional ? encodeForm.expected_sowing_date : null,
          date_received: encodeForm.show_optional ? encodeForm.date_received : null,
          data_sharing: eventIsInbred ? encodeForm.data_sharing : false,
          variety: encodeForm.selected_variety_id || null,
        };
        await updateEntry(editEntry.id, payload);
        // Re-sign if canvas has new signature
        if (sigRef.current && !sigRef.current.isEmpty()) {
          await saveSignature(editEntry.id, { signature: sigRef.current.toDataURL('image/png') });
        }
        showToast('success', 'Entry updated successfully.');
      } else {
        // New entry
        let activeBatch = currentBatch;
        const batchFull = (activeBatch?.entry_count || 0) >= 10 || (batchData?.entry_count || 0) >= 10;
        // If a rejected batch is reopened, backend turns it into DRAFT.
        // Only create a new batch when there is no usable DRAFT batch or current one is full.
        if (!activeBatch || activeBatch.status !== 'DRAFT' || batchFull) {
          const nb = await createBatch(currentEvent.id);
          activeBatch = nb.data;
          setCurrentBatch(activeBatch);
          refreshBatchId = activeBatch.id;
        }
        const entryRes = await addEntryToBatch(activeBatch.id, {
          farmer_id: currentFarmer.id,
          farm_area_ha: eventIsHybrid ? Number(encodeForm.farm_area_ha) : null,
          qty_bags: encodeForm.show_optional && encodeForm.qty_bags
            ? Number(encodeForm.qty_bags) : null,
          area_planted: eventIsInbred ? Number(encodeForm.area_planted) : null,
          crop_establishment: encodeForm.show_optional ? encodeForm.crop_establishment : null,
          expected_sowing_date: encodeForm.show_optional ? encodeForm.expected_sowing_date : null,
          date_received: encodeForm.show_optional ? encodeForm.date_received : null,
          data_sharing: eventIsInbred ? encodeForm.data_sharing : false,
          variety_id: encodeForm.selected_variety_id || null,
        });
        await saveSignature(entryRes.data.id, {
          signature: sigRef.current.toDataURL('image/png'),
        });
        showToast('success', `${currentFarmer.first_name} ${currentFarmer.last_name} encoded successfully.`);
        const det = await getBatchDetail(activeBatch.id);
        setBatchData(det.data);
      }
      setTimeout(async () => {
        setView('detail');
        setCurrentFarmer(null);
        setEditEntry(null);
        setFarmerSearch('');
        setFarmerResults([]);
        await refreshDetail(refreshBatchId);
      }, 800);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────
  // REMOVE ENTRY
  // ─────────────────────────────────────────
  const handleRemove = (entry) => {
    setConfirmSnack({
      title: `Remove ${entry.farmer_name}?`,
      message: 'This farmer will need to be re-encoded.',
      confirmLabel: 'Remove',
    });
    // store entry to delete
    setConfirmSnack(prev => ({ ...prev, _entry: entry }));
  };

  // ─────────────────────────────────────────
  // SUBMIT BATCH
  // ─────────────────────────────────────────
  const handleSubmitBatch = async (batchId) => {
    setSubmitConfirm(false);
    setSubmitting(true);
    try {
      await submitBatch(batchId);
      await refreshDetail();
      if (view === 'report') await loadReportBatch(batchId);
      showToast('success', 'Batch submitted to admin for review.');
      setNextStepBanner('beneficiaries');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoBackToFixEntries = async (batchId) => {
    if (!batchId) return;
    try {
      await reopenBatch(batchId);
      setView('detail');
      await refreshDetail(batchId);
      showToast('success', 'Batch reopened. You can now fix entries and resubmit.');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to reopen batch.');
      setView('detail');
    }
  };

  // ─────────────────────────────────────────
  // REPORT
  // ─────────────────────────────────────────
  const openReport = async () => {
    setView('report');
    if (batches.length > 0) {
      await loadReportBatch(batches[0].id);
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

  // Group entries by variety for Hybrid
  const entriesByVariety = (() => {
    if (!reportBatchData?.entries) return [];
    if (eventIsInbred) {
      return reportBatchData.entries.length > 0
        ? [{ name: null, entries: reportBatchData.entries }]
        : [];
    }
    // Hybrid — group by variety
    const groups = {};
    reportBatchData.entries.forEach(e => {
      const key = e.variety_name || currentEvent?.variety_name || 'Unspecified';
      if (!groups[key]) groups[key] = { name: key, entries: [] };
      groups[key].entries.push(e);
    });
    return Object.values(groups);
  })();

  const csvEscape = (value) => {
    const text = value == null ? '' : String(value);
    if (/[\n",]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const downloadBatchCsv = () => {
    if (!reportBatchData?.entries?.length) return;
    const rows = reportBatchData.entries.map(entry => {
      const farmer = entry.farmer_name || '';
      const rsbsa = entry.farmer_rsbsa || '';
      const signature = entry.has_signature ? 'Yes' : 'No';
      const variety = entry.variety_name || entry.variety || '';
      return [
        entry.row_number,
        rsbsa,
        farmer,
        entry.farm_area_ha ?? '',
        entry.qty_bags ?? '',
        variety,
        entry.authorized_representative || '',
        entry.date_received || '',
        signature,
        reportBatchData.status || '',
      ].map(csvEscape).join(',');
    });

    const header = [
      'Row','RSBSA No','Farmer Name','Farm Area (ha)','QTY (bags)','Variety','Authorized Rep','Date Received','Signed','Batch Status'
    ].map(csvEscape).join(',');
    const csvContent = [header, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `brgy_batch_${reportBatchData.batch_number || reportBatchId || 'report'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────
  // CREATE PROGRAM
  // ─────────────────────────────────────────
  const selectedFS = finalSeeds.find(
    fs => fs.id?.toString() === eventForm.final_seed_id?.toString()
  );

  const handleCreateEvent = async () => {
    const errs = {};
    if (!eventForm.final_seed_id)             errs.final_seed_id     = 'Select a seed type';
    if (!eventForm.organization_name?.trim()) errs.organization_name = 'Required';
    if (Object.keys(errs).length > 0) { setEventFormErrors(errs); return; }
    setCreating(true);
    try {
      const season = finalSeeds[0]?.season || 'WET';
      const year   = finalSeeds[0]?.year   || new Date().getFullYear();
      await createDistributionEvent({
        barangay: myBarangay,
        intervention: isHybrid(selectedFS.seed_type.name) ? 'NRP' : 'RCEF',
        seed_type: selectedFS.seed_type.id,
        variety: selectedFS.varieties.length === 1 ? selectedFS.varieties[0].id : null,
        season, year,
        organization_name: eventForm.organization_name,
        total_members: totalFarmers,
      });
      setCreateModal(false);
      setEventForm({ final_seed_id: '', organization_name: '' });
      setEventFormErrors({});
      loadAll();
      showToast('success', 'Distribution program created.');
    } catch (err) {
      setEventFormErrors({ general: err.response?.data?.error || 'Failed.' });
    } finally {
      setCreating(false);
    }
  };

  // ─────────────────────────────────────────
  // HANDLE CONFIRM SNACK
  // ─────────────────────────────────────────
  const handleConfirmSnack = async () => {
    if (confirmSnack?._entry) {
      // It's a remove action
      const entry = confirmSnack._entry;
      setConfirmSnack(null);
      try {
        await deleteEntry(entry.id);
        await refreshDetail();
        if (view === 'report' && reportBatchId) {
          await loadReportBatch(reportBatchId);
        }
        showToast('success', `${entry.farmer_name} removed.`);
      } catch (err) {
        showToast('error', err.response?.data?.error || 'Failed to remove.');
      }
    } else {
      // It's a save action
      await doSaveEntry();
    }
  };

  // ─────────────────────────────────────────
  // FILTERED EVENTS
  // ─────────────────────────────────────────
  const filteredEvents = events.filter(ev => {
    const q = programSearch.toLowerCase();
    const matchSearch = !q ||
      ev.organization_name?.toLowerCase().includes(q) ||
      ev.seed_type_name?.toLowerCase().includes(q);
    const matchType = !filterType ||
      (ev.seed_type_name || '').toUpperCase() === filterType;
    return matchSearch && matchType;
  });

  const typeOptions = finalSeeds.map(fs => ({
    value: fs.seed_type.name.toUpperCase(),
    label: fs.seed_type.name,
  }));

  // ─────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#9ca3af' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes toastIn {
            from { transform: translateX(-50%) translateY(20px); opacity: 0; }
            to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `}</style>
        <div style={{ width: 36, height: 36, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading beneficiaries...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <div style={{ paddingBottom: '5rem' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .prog-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.12) !important; transform: translateY(-2px); }
        .row-hover:hover { background-color: ${GREEN.light} !important; }
        .btn-sm { transition: opacity 0.15s; }
        .btn-sm:active { opacity: 0.7; }
      `}</style>

      <Toast toast={toast} />
      <ConfirmSnack
        data={confirmSnack}
        onConfirm={handleConfirmSnack}
        onCancel={() => setConfirmSnack(null)}
      />
      <SignatureModal sig={viewSig} onClose={() => setViewSig(null)} />

      {/* Submit Confirm */}
      {submitConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', maxWidth: '380px', width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', animation: 'slideUp 0.25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, backgroundColor: GREEN.light, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Send size={20} color={GREEN.primary} />
              </div>
              <div>
                <p style={{ fontWeight: 800, margin: 0, fontSize: '0.95rem' }}>Submit Batch?</p>
                <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>Admin will review this batch before approval.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setSubmitConfirm(false)} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button
                onClick={() => handleSubmitBatch(reportBatchData?.id || batchData?.id)}
                disabled={submitting}
                style={{ flex: 2, padding: '0.75rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                {submitting ? 'Submitting...' : 'Submit Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEXT STEP BANNER ── */}
      {nextStepBanner === 'beneficiaries' && (
        <div style={{
          position: 'fixed', bottom: '5.5rem', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 550, width: 'min(100%, 420px)',
          animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '1.25rem',
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            border: `1px solid ${GREEN.border}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <p style={{ fontWeight: 700, color: '#166534', margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <CheckCircle size={15} color="#166534" /> Batch submitted!
              </p>
              <button onClick={() => setNextStepBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.1rem', padding: 0 }}>×</button>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0 0 0.875rem', lineHeight: 1.5 }}>
              Next step: wait for admin approval, then proceed to Distribution to encode seed delivery details.
            </p>
            <button
              onClick={() => setNextStepBanner(null)}
              style={{ width: '100%', padding: '0.625rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── BREADCRUMB ── */}
      {view !== 'programs' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '1.25rem 1.25rem 0', fontSize: '0.8rem', animation: 'fadeIn 0.2s ease', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (view === 'detail') { setView('programs'); loadAll(); }
              else if (view === 'encode' || view === 'edit') setView('detail');
              else if (view === 'report') setView('detail');
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <ChevronLeft size={15} />
            {view === 'detail' ? 'Programs' : currentEvent?.organization_name || 'Program'}
          </button>
          {view !== 'detail' && (
            <>
              <ChevronRight size={12} color="#9ca3af" />
              <span style={{ color: '#374151', fontWeight: 700 }}>
                {view === 'encode' ? 'Register Farmer'
                  : view === 'edit' ? 'Edit Entry'
                  : 'Report'}
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
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Beneficiaries</h1>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                {myBarangay} · {finalSeason || 'No active season'}
              </p>
            </div>
            <button
              onClick={() => {
                if (finalSeeds.length === 0) { showToast('error', 'No finalized seed types yet. Admin must finalize seeds first.'); return; }
                setCreateModal(true);
              }}
              style={{ padding: '0.625rem 1.125rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Plus size={16} /> Beneficiaries
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Approved Farmers', value: totalFarmers, sub: `in ${myBarangay}` },
              { label: 'Active Programs', value: events.filter(e => e.status === 'ACTIVE').length, sub: `${events.length} total` },
            ].map(({ label, value, sub }, i) => (
              <div key={i} style={{ backgroundColor: GREEN.light, borderRadius: '1rem', padding: '1rem', border: `1px solid ${GREEN.border}`, animation: `slideUp ${0.3 + i * 0.05}s ease` }}>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: GREEN.primary, margin: '0 0 0.125rem', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '0.72rem', color: GREEN.accent, fontWeight: 700, margin: 0 }}>{label}</p>
                <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Search + Filter */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={programSearch} onChange={e => setProgramSearch(e.target.value)} placeholder="Search by organization or seed type..." style={{ ...inp(false), paddingLeft: '2.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {typeOptions.map(opt => (
                <button key={opt.value}
                  onClick={() => setFilterType(filterType === opt.value ? '' : opt.value)}
                  style={{ padding: '0.375rem 0.875rem', border: `1.5px solid ${filterType === opt.value ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: filterType === opt.value ? GREEN.light : 'white', color: filterType === opt.value ? GREEN.primary : '#6b7280', fontWeight: filterType === opt.value ? 700 : 400, fontSize: '0.78rem', cursor: 'pointer' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Program cards */}
          {filteredEvents.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem 1.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
              <Package size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>
                {events.length === 0 ? 'No programs yet' : 'No results found'}
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                {events.length === 0 ? 'Tap "Beneficiaries" to start.' : 'Try adjusting your search.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filteredEvents.map((event, idx) => {
                const evH = isHybrid(event.seed_type_name || event.intervention || '');
                const tagColor = evH ? '#1e40af' : GREEN.primary;
                const tagBg    = evH ? '#eff6ff' : GREEN.light;
                const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                return (
                  <div key={event.id}
                    className="prog-card"
                    onClick={() => openProgram(event)}
                    style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${tagBorder}`, cursor: 'pointer', transition: 'all 0.2s', animation: `slideUp ${0.3 + idx * 0.06}s ease` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                          <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.15rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                            {event.seed_type_name || (evH ? 'Hybrid' : 'Inbred')}
                          </span>
                          {event.variety_name && (
                            <span style={{ fontSize: '0.7rem', color: '#6b7280', backgroundColor: '#f9fafb', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid #e5e7eb' }}>
                              {event.variety_name}
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: '#111827' }}>{event.organization_name}</h3>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>{event.season_display} {event.year}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: tagColor, margin: 0, lineHeight: 1 }}>
                          {event.total_encoded}<span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>/{getEffectiveTotalMembers(event)}</span>
                        </p>
                        <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>encoded</p>
                      </div>
                    </div>
                    <ProgressBar value={event.total_encoded} max={getEffectiveTotalMembers(event)} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: '#9ca3af' }}>
                      <span>Approved: {event.total_approved}</span>
                      <span>{event.batch_count} batch{event.batch_count !== 1 ? 'es' : ''} <ChevronRight size={11} style={{ display: 'inline' }} /></span>
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
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${GREEN.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ backgroundColor: GREEN.light, color: GREEN.primary, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${GREEN.border}` }}>
                  {currentEvent.seed_type_name || (eventIsHybrid ? 'Hybrid' : 'Inbred')}
                </span>
                <h2 style={{ fontWeight: 800, fontSize: '1rem', margin: '0.375rem 0 0', color: '#0f172a' }}>{currentEvent.organization_name}</h2>
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                  {finalSeason || `${currentEvent.season_display} ${currentEvent.year}`} · {currentEvent.barangay}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={openReport}
                  style={{ padding: '0.5rem 0.875rem', backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, color: GREEN.accent, borderRadius: '0.625rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <FileText size={14} /> Report
                </button>
                {!currentEvent.delete_requested && (
                  <button onClick={() => setDeleteModal(currentEvent.id)}
                    style={{ padding: '0.5rem 0.875rem', backgroundColor: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.625rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Trash2 size={14} /> Request Delete
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#9ca3af', marginBottom: '0.375rem' }}>
              <span>{currentEvent.total_encoded} of {getEffectiveTotalMembers(currentEvent)} farmers</span>
              <span>{getEffectiveTotalMembers(currentEvent) > 0 ? Math.round((currentEvent.total_encoded / getEffectiveTotalMembers(currentEvent)) * 100) : 0}%</span>
            </div>
            <ProgressBar value={currentEvent.total_encoded} max={getEffectiveTotalMembers(currentEvent)} />
          </div>

          {/* Batch status */}
          {batchData && (
            <div style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1.25rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <StatusBadge status={batchData.status} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Batch {batchData.batch_number}</span>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{batchData.entry_count}/10</span>
              </div>
              {batchData.status === 'DRAFT' && batchData.entry_count > 0 && (
                <button onClick={() => setSubmitConfirm(true)}
                  style={{ padding: '0.375rem 0.875rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Send size={13} /> Submit to Admin
                </button>
              )}
            </div>
          )}

          {/* Rejection note */}
          {batchData?.status === 'REJECTED' && batchData?.rejected_reason && (
            <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1rem' }}>
              <p style={{ color: '#991b1b', fontWeight: 700, margin: '0 0 0.375rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <AlertCircle size={14} /> Admin Rejection Notes:
              </p>
              <p style={{ color: '#991b1b', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>{batchData.rejected_reason}</p>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>
                Please fix the issues above, then edit or remove the affected entries and resubmit.
              </p>
            </div>
          )}

          {/* Farmer search — available while the program is active and the current batch can still accept entries */}
          {currentEvent.status === 'ACTIVE' && batchData && (
            (batchData.status === 'DRAFT' || batchData.status === 'REJECTED') && !batchData.is_full
          ) && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem', border: '1px solid #f3f4f6' }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 Add Beneficiary
              </p>
              <div style={{ position: 'relative' }}>
                <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input value={farmerSearch} onChange={e => handleFarmerSearch(e.target.value)} placeholder="Search farmer by name or RSBSA..." style={{ ...inp(false), paddingLeft: '2.25rem' }} />
              </div>
              {farmerSearching && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0', color: '#9ca3af', fontSize: '0.78rem' }}>
                  <div style={{ width: 14, height: 14, border: '2px solid #e5e7eb', borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Searching...
                </div>
              )}
              {!farmerSearching && farmerSearch.length >= 2 && farmerResults.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.5rem 0 0', textAlign: 'center', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  No eligible farmers found.
                </p>
              )}
              {farmerResults.length > 0 && (
                <div style={{ marginTop: '0.625rem', border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden' }}>
                  {farmerResults.map((farmer, idx) => {
                    const remaining = Number(farmer.remaining_hectares || 0);
                    const total = Number(farmer.hectares || 0) || 0;
                    let badgeColor = '#a3e635';
                    if (remaining <= 0) badgeColor = '#fee2e2';
                    else if (total > 0 && remaining <= total * 0.5) badgeColor = '#fef3c7';
                    const disabled = remaining <= 0;
                    return (
                      <div key={farmer.id} className="row-hover"
                        onClick={() => { if (!disabled) openEncode(farmer); else showToast('error', 'No remaining hectares to encode.'); }}
                        style={{ 
                          padding: '0.875rem 1rem', 
                          borderBottom: idx < farmerResults.length - 1 ? '1px solid #f3f4f6' : 'none', 
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          backgroundColor: 'white',
                          opacity: disabled ? 0.55 : 1,
                          transition: 'background 0.15s' 
                        }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>
                            {farmer.last_name}, {farmer.first_name}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                            {farmer.rsbsa_number || 'No RSBSA'} · {farmer.barangay}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div style={{ backgroundColor: badgeColor, color: '#444', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {remaining > 0 ? `${Number(remaining).toFixed(2)} ha` : 'Exhausted'}
                          </div>
                          <ChevronRight size={14} color="#9ca3af" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {/* Encoded farmers list */}
          {totalEncodedEntries > 0 && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
              <div style={{ padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>Registered Farmers</h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                    Showing {(listPage - 1) * PAGE_SIZE + 1}–{Math.min(listPage * PAGE_SIZE, totalEncodedFarmers)} of {totalEncodedFarmers}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                    Overall {currentEvent ? ` / ${getEffectiveTotalMembers(currentEvent)}` : ''}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                    Page {listPage} of {totalPages}
                  </span>
                </div>
              </div>
              <div style={{ padding: '0 1.25rem 1rem', borderBottom: '1px solid #f3f4f6' }}>
                <div ref={encodedSearchRef} style={{ position: 'relative', width: encodedSearchOpen ? '100%' : '40px', maxWidth: '420px', minWidth: '40px', transition: 'width 0.25s ease' }}>
                  <button
                    type="button"
                    onClick={() => setEncodedSearchOpen(true)}
                    style={{
                      position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '999px', border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: encodedSearchOpen ? GREEN.primary : '#9ca3af', zIndex: 1
                    }}>
                    <Search size={18} />
                  </button>
                  <input
                    value={encodedSearch}
                    onChange={e => setEncodedSearch(e.target.value)}
                    placeholder="Search farmers by name or RSBSA..."
                    style={{
                      ...inp(false),
                      width: encodedSearchOpen ? '100%' : '40px',
                      paddingLeft: '2.75rem',
                      paddingRight: encodedSearch ? '2.75rem' : '0.75rem',
                      borderRadius: '999px',
                      opacity: encodedSearchOpen ? 1 : 0,
                      visibility: encodedSearchOpen ? 'visible' : 'hidden',
                      transition: 'all 0.25s ease',
                      height: '40px',
                    }}
                    onFocus={() => setEncodedSearchOpen(true)}
                  />
                  {encodedSearch && encodedSearchOpen && (
                    <button
                      type="button"
                      onClick={() => setEncodedSearch('')}
                      style={{
                        position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '28px', height: '28px', borderRadius: '999px', border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer'
                      }}>
                      <XCircle size={18} />
                    </button>
                  )}
                </div>
              </div>
              {pageEntries.length === 0 ? (
                <div style={{ padding: '1rem 1.25rem', color: '#9ca3af', textAlign: 'center', backgroundColor: '#f9fafb' }}>
                  No registered farmers match that filter.
                </div>
              ) : pageEntries.map((entry, idx) => (
                <div key={`${entry.batch_id}-${entry.id}`} style={{ padding: '0.875rem 1.25rem', borderBottom: idx < pageEntries.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>
                      {(listPage - 1) * PAGE_SIZE + idx + 1}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>{entry.farmer_name}</p>
                      <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                        {entry.farmer_rsbsa || '—'} · {entry.farm_area_ha ? `${entry.farm_area_ha} ha` : '—'}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
                        Batch {entry.batch_number}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {/* Signature badge — clickable */}
                    {entry.has_signature ? (
                      <button
                        onClick={() => {
                          getBatchDetail(entry.batch_id).then(res => {
                            const full = res.data.entries.find(e => e.id === entry.id);
                            if (full?.signature) setViewSig(full.signature);
                          });
                        }}
                        style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${GREEN.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Eye size={10} /> Signed
                      </button>
                    ) : (
                      <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>Unsigned</span>
                    )}
                    {/* Edit — only in DRAFT/REJECTED */}
                    {((entry.batch_status === 'DRAFT' || entry.batch_status === 'REJECTED') || (batchData?.status === 'DRAFT' || batchData?.status === 'REJECTED')) && (
                      <>
                        <button className="btn-sm" onClick={() => openEdit(entry)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af', padding: '0.25rem' }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-sm"
                          onClick={() => {
                            setConfirmSnack({
                              title: `Remove ${entry.farmer_name}?`,
                              message: 'This farmer will need to be re-encoded.',
                              confirmLabel: 'Remove',
                              _entry: entry,
                            });
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.25rem' }}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => setListPage(p => Math.max(1, p - 1))}
                  disabled={listPage === 1}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: `1px solid ${listPage === 1 ? '#e5e7eb' : '#d1d5db'}`, backgroundColor: listPage === 1 ? '#f9fafb' : 'white', color: listPage === 1 ? '#9ca3af' : '#111827', cursor: listPage === 1 ? 'not-allowed' : 'pointer' }}>
                  Previous
                </button>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Page {listPage} of {totalPages}
                </div>
                <button
                  onClick={() => setListPage(p => Math.min(totalPages, p + 1))}
                  disabled={listPage === totalPages}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: `1px solid ${listPage === totalPages ? '#e5e7eb' : '#d1d5db'}`, backgroundColor: listPage === totalPages ? '#f9fafb' : 'white', color: listPage === totalPages ? '#9ca3af' : '#111827', cursor: listPage === totalPages ? 'not-allowed' : 'pointer' }}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: ENCODE / EDIT FARMER
      ══════════════════════════════════════════ */}
      {(view === 'encode' || view === 'edit') && (currentFarmer || editEntry) && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          {/* Farmer info card */}
          {currentFarmer && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: GREEN.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
                  {(currentFarmer.first_name?.[0] || '').toUpperCase()}{(currentFarmer.last_name?.[0] || '').toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a1a', margin: 0 }}>
                    {currentFarmer.last_name}, {currentFarmer.first_name} {currentFarmer.middle_name || ''}
                  </h2>
                  <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>
                    {currentFarmer.rsbsa_number || 'No RSBSA'} · {currentFarmer.barangay}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Program type label */}
          <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.75rem', padding: '0.625rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 700, color: GREEN.accent }}>
              {eventIsHybrid ? '🌾 Hybrid (Region) Program' : '🌾 Inbred (PhilRice) Program'} — {currentEvent?.organization_name}
            </span>
          </div>

          {/* ── REQUIRED FIELDS ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 1rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
              Required Fields
            </p>

            {/* Hybrid: Farm Area */}
            {eventIsHybrid && (() => {
              return (
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Farm Area (ha) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="number" step="0.01" min="0.01" value={encodeForm.farm_area_ha}
                    onChange={e => { setEncodeForm(p => ({ ...p, farm_area_ha: e.target.value })); setEncodeErrors(p => ({ ...p, farm_area_ha: '' })); }}
                    placeholder={currentFarmer && currentFarmer.remaining_hectares ? `Suggested: ${Number(currentFarmer.remaining_hectares).toFixed(2)} ha` : 'e.g. 0.50'}
                    style={{ ...inp(!!encodeErrors.farm_area_ha) }} />
                  {/* Remaining hint */}
                  {currentFarmer && (
                    (() => {
                      const rem = Number(currentFarmer.remaining_hectares || 0);
                      const tot = Number(currentFarmer.hectares || 0) || 0;
                      const dotColor = rem <= 0 ? '#ef4444' : (tot > 0 && rem <= tot * 0.5 ? '#f59e0b' : '#16a34a');
                      return (
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.375rem 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 10, height: 10, borderRadius: 6, backgroundColor: dotColor, display: 'inline-block' }} />
                          {rem > 0 ? `Remaining: ${Number(rem).toFixed(2)} ha of ${Number(tot).toFixed(2)} ha` : 'No remaining hectares available.'}
                        </p>
                      );
                    })()
                  )}
                  {encodeErrors.farm_area_ha && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{encodeErrors.farm_area_ha}</p>}
                </div>
              );
            })()}

            {/* Inbred: Area to be planted */}
            {eventIsInbred && (() => {
              return (
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Area to be Planted (ha) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="number" step="0.01" min="0.01" value={encodeForm.area_planted}
                    onChange={e => { setEncodeForm(p => ({ ...p, area_planted: e.target.value })); setEncodeErrors(p => ({ ...p, area_planted: '' })); }}
                    placeholder={currentFarmer && currentFarmer.remaining_hectares ? `Suggested: ${Number(currentFarmer.remaining_hectares).toFixed(2)} ha` : 'e.g. 0.50'}
                    style={{ ...inp(!!encodeErrors.area_planted) }} />
                  {currentFarmer && (
                    (() => {
                      const rem = Number(currentFarmer.remaining_hectares || 0);
                      const tot = Number(currentFarmer.hectares || 0) || 0;
                      const dotColor = rem <= 0 ? '#ef4444' : (tot > 0 && rem <= tot * 0.5 ? '#f59e0b' : '#16a34a');
                      return (
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.375rem 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 10, height: 10, borderRadius: 6, backgroundColor: dotColor, display: 'inline-block' }} />
                          {rem > 0 ? `Remaining: ${Number(rem).toFixed(2)} ha of ${Number(tot).toFixed(2)} ha` : 'No remaining hectares available.'}
                        </p>
                      );
                    })()
                  )}
                  {encodeErrors.area_planted && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{encodeErrors.area_planted}</p>}
                </div>
              );
            })()}

            {/* Inbred: Data Sharing */}
            {eventIsInbred && (
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', padding: '0.75rem', backgroundColor: encodeErrors.data_sharing ? '#fff1f2' : '#eff6ff', borderRadius: '0.625rem', border: `1px solid ${encodeErrors.data_sharing ? '#fca5a5' : '#bfdbfe'}` }}>
                  <input type="checkbox" checked={encodeForm.data_sharing}
                    onChange={e => { setEncodeForm(p => ({ ...p, data_sharing: e.target.checked })); setEncodeErrors(p => ({ ...p, data_sharing: '' })); }}
                    style={{ width: 16, height: 16, accentColor: '#1e40af' }} />
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af', margin: 0 }}>Data Sharing Consent <span style={{ color: '#dc2626' }}>*</span></p>
                    <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: '0.125rem 0 0' }}>Farmer agrees to share data with DA PhilRice</p>
                  </div>
                </label>
                {encodeErrors.data_sharing && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{encodeErrors.data_sharing}</p>}
              </div>
            )}

            {/* Variety selector — if more than 1 */}
            {eventFinalVarieties.length > 1 && (
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
                  Select Variety <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {eventFinalVarieties.map(v => {
                    const sel = encodeForm.selected_variety_id === v.id;
                    return (
                      <button key={v.id} type="button"
                        onClick={() => { setEncodeForm(p => ({ ...p, selected_variety_id: v.id })); setEncodeErrors(p => ({ ...p, variety: '' })); }}
                        style={{ padding: '0.5rem 1rem', border: `2px solid ${sel ? GREEN.primary : '#e5e7eb'}`, borderRadius: '0.75rem', backgroundColor: sel ? GREEN.light : 'white', cursor: 'pointer', fontWeight: sel ? 700 : 500, fontSize: '0.875rem', color: sel ? GREEN.primary : '#374151', transition: 'all 0.15s' }}>
                        {sel ? <CheckCircle size={12} style={{ display: 'inline', marginRight: '0.25rem' }} /> : null}{v.name}
                      </button>
                    );
                  })}
                </div>
                {encodeErrors.variety && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.5rem 0 0' }}>{encodeErrors.variety}</p>}
              </div>
            )}
            {eventFinalVarieties.length === 1 && (
              <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginBottom: '0.875rem', fontSize: '0.78rem', color: GREEN.accent, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <CheckCircle size={13} /> Variety: <strong>{eventFinalVarieties[0].name}</strong>
              </div>
            )}
          </div>

          {/* ── SIGNATURE ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: encodeErrors.signature ? '2px solid #dc2626' : '1px solid #f3f4f6' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pen size={15} color={GREEN.primary} />
              Signature / Thumbmark {view === 'encode' && <span style={{ color: '#dc2626' }}>*</span>}
            </p>
            {view === 'edit' && editEntry?.has_signature && (
              <div style={{ marginBottom: '0.75rem', padding: '0.625rem', backgroundColor: GREEN.light, borderRadius: '0.5rem', border: `1px solid ${GREEN.border}`, fontSize: '0.78rem', color: GREEN.accent }}>
                Existing signature saved. Sign below to replace it, or leave blank to keep current.
              </div>
            )}
            <div style={{ border: `2px dashed ${encodeErrors.signature ? '#dc2626' : '#d1d5db'}`, borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#fafafa', marginBottom: '0.75rem', position: 'relative' }}>
              <SignatureCanvas ref={sigRef} penColor="#1a1a1a"
                canvasProps={{ width: Math.min(window.innerWidth - 80, 420), height: 160, style: { display: 'block', width: '100%', touchAction: 'none' } }}
                onBegin={() => setEncodeErrors(p => ({ ...p, signature: '' }))} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', opacity: 0.1, textAlign: 'center' }}>
                <Pen size={40} color="#9ca3af" />
              </div>
            </div>
            {encodeErrors.signature && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={12} /> {encodeErrors.signature}</p>}
            <button onClick={() => { sigRef.current?.clear(); setEncodeErrors(p => ({ ...p, signature: '' })); }}
              style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#6b7280' }}>
              Clear Signature
            </button>
          </div>

          {/* ── OPTIONAL FIELDS (collapsible) ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
            <button
              onClick={() => setEncodeForm(p => ({ ...p, show_optional: !p.show_optional }))}
              style={{ width: '100%', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: 0 }}>
                  Fill Out Optional Fields
                </p>
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                  {eventIsHybrid
                    ? 'QTY (bags) — can also be encoded in Distribution when seed arrives'
                    : 'No. of bags, Rice variety, Crop Estab, Expected Sowing Date, Date Received — can be encoded in Distribution'
                  }
                </p>
              </div>
              {encodeForm.show_optional ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
            </button>

            {encodeForm.show_optional && (
              <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid #f3f4f6', animation: 'fadeIn 0.2s ease' }}>
                <div style={{ height: '1rem' }} />

                {/* Hybrid optional: QTY */}
                {eventIsHybrid && (
                  <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>QTY (bags)</label>
                    <input type="number" min="1" step="1" value={encodeForm.qty_bags}
                      onChange={e => setEncodeForm(p => ({ ...p, qty_bags: e.target.value }))}
                      placeholder="e.g. 2" style={inp(false)} />
                  </div>
                )}

                {/* Inbred optional fields */}
                {eventIsInbred && (
                  <>
                    <div style={{ marginBottom: '0.875rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Number of Bags (20kg/bag)</label>
                      <input type="number" min="1" value={encodeForm.qty_bags}
                        onChange={e => setEncodeForm(p => ({ ...p, qty_bags: e.target.value }))}
                        placeholder="e.g. 1" style={inp(false)} />
                    </div>
                    <div style={{ marginBottom: '0.875rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Rice Variety Received</label>
                      <input type="text" value={encodeForm.crop_establishment === 'variety' ? '' : ''}
                        onChange={e => setEncodeForm(p => ({ ...p, rice_variety_received: e.target.value }))}
                        placeholder="e.g. RC 216" style={inp(false)} />
                    </div>
                    <div style={{ marginBottom: '0.875rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Crop Establishment (D/T)</label>
                      <select value={encodeForm.crop_establishment}
                        onChange={e => setEncodeForm(p => ({ ...p, crop_establishment: e.target.value }))}
                        style={inp(false)}>
                        <option value="">Select</option>
                        <option value="DS">Direct Seeding (D)</option>
                        <option value="TP">Transplanting (T)</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: '0.875rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Expected Sowing Date (Month/Week)</label>
                      <input type="text" value={encodeForm.expected_sowing_date}
                        onChange={e => setEncodeForm(p => ({ ...p, expected_sowing_date: e.target.value }))}
                        placeholder="e.g. June/2nd Week" style={inp(false)} />
                    </div>
                    <div style={{ marginBottom: '0.875rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Date Received (MM/DD/YY)</label>
                      <input type="date" value={encodeForm.date_received}
                        onChange={e => setEncodeForm(p => ({ ...p, date_received: e.target.value }))}
                        style={inp(false)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Name of Authorized Representative</label>
                      <input type="text" value={encodeForm.authorized_representative}
                        onChange={e => setEncodeForm(p => ({ ...p, authorized_representative: e.target.value }))}
                        placeholder="Last Name, First Name, Middle Initial" style={inp(false)} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Save button */}
          <button onClick={handleSaveEntry} disabled={saving}
            style={{ width: '100%', padding: '0.9375rem', backgroundColor: saving ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: saving ? 'none' : `0 4px 16px ${GREEN.primary}40`, transition: 'all 0.2s' }}>
            {saving ? 'Saving...'
              : view === 'edit' ? <><Edit2 size={18} /> Save Changes</>
              : <><CheckCircle size={18} /> Confirm Registration</>
            }
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: REPORT
      ══════════════════════════════════════════ */}
      {view === 'report' && currentEvent && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          {/* Document header */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.875rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.875rem' }}>
              <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>Republic of the Philippines · Department of Agriculture · Regional Field Office No. IV-A</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1a1a1a', margin: '0.375rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Lists of Farmer-Beneficiaries
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.75rem', color: '#374151' }}>
              <span><strong>Province:</strong> Quezon</span>
              <span><strong>Municipality:</strong> Lucban</span>
              <span><strong>Intervention:</strong> {eventIsHybrid ? 'Hybrid (NRP/Region)' : 'Inbred (RCEF/PhilRice)'}</span>
              <span><strong>Season:</strong> {finalSeason || `${currentEvent.season_display} ${currentEvent.year}`}</span>
              <span><strong>Barangay:</strong> {currentEvent.barangay}</span>
              <span><strong>Total Members:</strong> {getEffectiveTotalMembers(currentEvent)}</span>
              {currentEvent.total_members !== getEffectiveTotalMembers(currentEvent) && (
                <span style={{ gridColumn: '1/-1', fontSize: '0.72rem', color: '#6b7280' }}>
                  Original program size: {currentEvent.total_members} · Currently approved in barangay: {getEffectiveTotalMembers(currentEvent)}
                </span>
              )}
              <span style={{ gridColumn: '1/-1' }}><strong>Organization:</strong> {currentEvent.organization_name}</span>
              {!eventIsInbred && currentEvent.variety_name && (
                <span style={{ gridColumn: '1/-1' }}><strong>Variety:</strong> {currentEvent.variety_name}</span>
              )}
            </div>
          </div>

          {/* Batch selector */}
          {batches.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {batches.map(b => (
                <button key={b.id} onClick={() => loadReportBatch(b.id)}
                  style={{ padding: '0.375rem 0.875rem', borderRadius: '999px', cursor: 'pointer', border: `1.5px solid ${reportBatchId === b.id ? GREEN.primary : '#e5e7eb'}`, backgroundColor: reportBatchId === b.id ? GREEN.light : 'white', color: reportBatchId === b.id ? GREEN.primary : '#374151', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.15s' }}>
                  Batch {b.batch_number} <StatusBadge status={b.status} />
                </button>
              ))}
            </div>
          )}

          {reportLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
              Loading...
            </div>
          ) : entriesByVariety.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {entriesByVariety.map((group, gIdx) => (
                <div key={gIdx} style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #f3f4f6', animation: `slideUp ${0.3 + gIdx * 0.07}s ease` }}>
                  {/* Table header */}
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: '2px solid #e5e7eb', backgroundColor: GREEN.light, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: GREEN.accent }}>
                        Batch {reportBatchData?.batch_number}
                      </span>
                      {eventIsHybrid && group.name && (
                        <>
                          <span style={{ color: GREEN.border }}>·</span>
                          <span style={{ fontWeight: 800, fontSize: '0.875rem', color: GREEN.primary }}>
                            Variety: {group.name}
                          </span>
                        </>
                      )}
                      <span style={{ backgroundColor: 'white', color: '#6b7280', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, border: '1px solid #e5e7eb' }}>
                        {group.entries.length} farmer{group.entries.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {/* Submit/status */}
                    {reportBatchData?.status === 'DRAFT' && (
                      <button onClick={() => setSubmitConfirm(true)}
                        style={{ padding: '0.5rem 1.125rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Send size={13} /> Submit
                      </button>
                    )}
                    {reportBatchData?.status === 'SUBMITTED' && (
                      <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.375rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} /> Awaiting Admin
                      </span>
                    )}
                    {reportBatchData?.status === 'APPROVED' && (
                      <span style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.375rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle size={12} /> Approved
                      </span>
                    )}
                    {reportBatchData?.status === 'REJECTED' && (
                      <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.375rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <XCircle size={12} /> Rejected
                      </span>
                    )}
                  </div>

                  {/* Scrollable table */}
                  <div style={{ overflowX: 'auto' }}>
                    {eventIsHybrid ? (
                      /* ── HYBRID TABLE ── */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1100px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            {[
                              'No.','RSBSA No.','Last Name','First Name','Middle Name','Ext.',
                              'Date of Birth','Res. Municipality','Res. Barangay',
                              'Farm Municipality','Farm Barangay',
                              'Gender','IP','Senior Citizen','PWD','ARBs','4Ps',
                              'Farm Area (ha)','QTY (bags)','Contact No.','Signature'
                            ].map((col, i) => (
                              <th key={i} style={{ padding: '0.5rem 0.375rem', textAlign: 'center', fontWeight: 700, color: ['Res. Municipality','Res. Barangay','Farm Municipality','Farm Barangay','IP','Senior Citizen','PWD','ARBs','4Ps'].includes(col) ? '#dc2626' : '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((entry, idx) => {
                            const fd = entry.farmer_detail || {};
                            const td = { padding: '0.4375rem 0.375rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                            return (
                              <tr key={entry.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
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
                                <td style={{ ...td, textAlign: 'center' }}>{entry.qty_bags ?? '—'}</td>
                                <td style={td}>{entry.farmer_contact || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {entry.has_signature ? (
                                    <button
                                      onClick={() => {
                                        getBatchDetail(reportBatchData.id).then(res => {
                                          const full = res.data.entries.find(e => e.id === entry.id);
                                          if (full?.signature) setViewSig(full.signature);
                                        });
                                      }}
                                      style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, border: `1px solid ${GREEN.border}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                      <Eye size={9} /> View
                                    </button>
                                  ) : (
                                    <span style={{ color: '#9ca3af', fontSize: '0.6rem' }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      /* ── INBRED / PHILRICE TABLE ── */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1200px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            {[
                              'No.','Farmer Name','RSBSA No.','Area to be Planted (ha)','No. of Bags (20kg)',
                              'Rice Variety Received','Crop Estab (D/T)','Expected Sowing Date','Data Sharing',
                              '2025 DS YIELD','Authorized Rep.','Date Received','Signature'
                            ].map((col, i) => (
                              <th key={i} style={{ padding: '0.5rem 0.375rem', textAlign: 'center', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((entry, idx) => {
                            const td = { padding: '0.4375rem 0.375rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                            return (
                              <tr key={entry.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.row_number}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{entry.farmer_name || '—'}</td>
                                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.area_planted || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.qty_bags ?? '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.variety_name || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.crop_establishment || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.expected_sowing_date || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.data_sharing ? '✓' : '✗'}</td>
                                <td style={{ ...td, textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>To be encoded in Yield</td>
                                <td style={td}>{entry.authorized_representative || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.date_received ? new Date(entry.date_received + 'T00:00:00').toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {entry.has_signature ? (
                                    <button
                                      onClick={() => {
                                        getBatchDetail(reportBatchData.id).then(res => {
                                          const full = res.data.entries.find(e => e.id === entry.id);
                                          if (full?.signature) setViewSig(full.signature);
                                        });
                                      }}
                                      style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, border: `1px solid ${GREEN.border}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                      <Eye size={9} /> View
                                    </button>
                                  ) : <span style={{ color: '#9ca3af', fontSize: '0.6rem' }}>—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ))}

              {/* Rejection note in report */}
              {reportBatchData?.status === 'REJECTED' && reportBatchData?.rejected_reason && (
                <div style={{ backgroundColor: '#fff1f2', borderRadius: '0.875rem', padding: '1rem 1.25rem', border: '1px solid #fecdd3', animation: 'slideUp 0.3s ease' }}>
                  <p style={{ fontWeight: 700, color: '#991b1b', margin: '0 0 0.375rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={15} /> Admin Rejection Notes
                  </p>
                  <p style={{ color: '#991b1b', fontSize: '0.8rem', margin: '0 0 1rem' }}>{reportBatchData.rejected_reason}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 1rem' }}>
                    Please edit or remove the affected entries in this batch, then resubmit.
                  </p>
                  <button onClick={() => handleGoBackToFixEntries(reportBatchData.id)}
                    style={{ padding: '0.625rem 1.25rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Edit2 size={14} /> Go Back to Fix Entries
                  </button>
                </div>
              )}
            </div>
          ) : !reportLoading && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af', border: '1px solid #f3f4f6' }}>
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
                <h2 style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>New Beneficiary Program</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{myBarangay} · {finalSeason}</p>
              </div>
              <button onClick={() => { setCreateModal(false); setEventFormErrors({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.5rem' }}>×</button>
            </div>
            {eventFormErrors.general && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem' }}>{eventFormErrors.general}</div>
            )}
            <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: GREEN.accent }}>
              <strong>Barangay:</strong> {myBarangay} · <strong>Season:</strong> {finalSeason} · <strong>Total Members:</strong> {totalFarmers}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>Seed Type <span style={{ color: '#dc2626' }}>*</span></label>
              {finalSeeds.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: '#dc2626' }}>No finalized seed types. Admin must finalize seeds in Seed Poll first.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: finalSeeds.length === 1 ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
                  {finalSeeds.map(fs => {
                    const isH = isHybrid(fs.seed_type.name);
                    const tagColor = isH ? '#1e40af' : GREEN.primary;
                    const tagBg = isH ? '#eff6ff' : GREEN.light;
                    const tagBorder = isH ? '#bfdbfe' : GREEN.border;
                    const selected = eventForm.final_seed_id?.toString() === fs.id?.toString();
                    return (
                      <button key={fs.id} type="button"
                        onClick={() => setEventForm(p => ({ ...p, final_seed_id: fs.id }))}
                        style={{ padding: '0.875rem', textAlign: 'left', border: `2px solid ${selected ? tagColor : '#e5e7eb'}`, borderRadius: '0.875rem', backgroundColor: selected ? tagBg : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <p style={{ fontWeight: 800, fontSize: '0.95rem', color: selected ? tagColor : '#374151', margin: 0 }}>{fs.seed_type.name}</p>
                        <p style={{ fontSize: '0.68rem', color: selected ? tagColor : '#9ca3af', margin: '0.125rem 0 0.375rem', opacity: 0.9 }}>
                          {isH ? 'Region (NRP/RFO)' : 'PhilRice (RCEF)'}
                        </p>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {fs.varieties.map(v => (
                            <span key={v.id} style={{ backgroundColor: selected ? `${tagColor}15` : '#f3f4f6', color: selected ? tagColor : '#6b7280', padding: '0.1rem 0.375rem', borderRadius: '999px', fontSize: '0.63rem', fontWeight: 600 }}>{v.name}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {eventFormErrors.final_seed_id && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{eventFormErrors.final_seed_id}</p>}
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Organization / Association <span style={{ color: '#dc2626' }}>*</span></label>
              <input value={eventForm.organization_name} onChange={e => setEventForm(p => ({ ...p, organization_name: e.target.value }))} placeholder="e.g. Samahan ng Magpapalay sa Brgy. May-It" style={inp(!!eventFormErrors.organization_name)} />
              {eventFormErrors.organization_name && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{eventFormErrors.organization_name}</p>}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { setCreateModal(false); setEventFormErrors({}); }} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleCreateEvent} disabled={creating} style={{ flex: 2, padding: '0.875rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.95rem', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={18} /> {creating ? 'Creating...' : 'Create Program'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE REQUEST MODAL */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Request Program Deletion?</h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>This will send a deletion request to the admin. The program will only be deleted after admin approves.</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeleteModal(null)} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await requestDeleteEvent(deleteModal, { note: 'BRGY President requested deletion.' });
                    setDeleteModal(null);
                    showToast('success', 'Deletion request sent to admin.');
                    await loadAll();
                  } catch (err) {
                    showToast('error', err.response?.data?.error || 'Failed.');
                  } finally { setDeleting(false); }
                }}
                disabled={deleting}
                style={{ flex: 2, padding: '0.875rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrgyBeneficiaries;