// src/pages/brgy/BrgyDistribution.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  Search, ChevronRight, ChevronLeft, CheckCircle,
  AlertCircle, MapPin, Wheat, Package, Clock,
  FileText, Edit2, Eye, Send, Users, XCircle,
} from 'lucide-react';
import {
  getDistributionEvents,
  getDistributionEvent,
  getEventBatches,
  getBatchDetail,
  updateEntry,
  submitBatch,
  searchFarmers,
  getBrgyDistributionContext,
  getFinalSeeds,
} from '../../api/axios';

const GREEN = {
  primary: '#1a4d1a',
  light:   '#f0fdf4',
  border:  '#bbf7d0',
  accent:  '#166534',
  soft:    '#dcfce7',
};

const isHybrid = (s = '') => {
  const n = s.toUpperCase();
  return n.includes('HYBRID') || n === 'NRP' || n === 'RFO';
};
const isInbred = (s = '') => {
  const n = s.toUpperCase();
  return n.includes('INBRED') || n === 'RCEF';
};

const StatusBadge = ({ status }) => {
  const cfg = {
    DRAFT:     { bg: '#f9fafb', color: '#6b7280',  label: 'Draft'     },
    SUBMITTED: { bg: '#fef9c3', color: '#854d0e',  label: 'Submitted' },
    APPROVED:  { bg: '#dcfce7', color: '#166534',  label: 'Approved'  },
    REJECTED:  { bg: '#fee2e2', color: '#991b1b',  label: 'Rejected'  },
  }[status] || { bg: '#f9fafb', color: '#6b7280', label: status };
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
};

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 600,
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

const ConfirmSnack = ({ data, onConfirm, onCancel }) => {
  if (!data) return null;
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 600, width: 'min(100%, 420px)', animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: `1px solid ${GREEN.border}` }}>
        <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 0.375rem', fontSize: '0.95rem' }}>{data.title}</p>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>{data.message}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 2, padding: '0.625rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
            {data.confirmLabel || 'Confirm'}
          </button>
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

const BrgyDistribution = () => {
  const { role } = useAuth();

  // VIEW: 'landing' | 'program' | 'farmer_detail' | 'report'
  const [view, setView]                 = useState('landing');
  const [myBarangay, setMyBarangay]     = useState('');
  const [finalSeeds, setFinalSeeds]     = useState([]);
  const [events, setEvents]             = useState([]);
  const [loading, setLoading]           = useState(true);

  // Selected
  const [currentEvent, setCurrentEvent]   = useState(null);
  const [currentFarmer, setCurrentFarmer] = useState(null);
  const [currentEntry, setCurrentEntry]   = useState(null);
  const [currentBatches, setCurrentBatches] = useState([]);
  const [selectedBatch, setSelectedBatch]   = useState(null);
  const [batchData, setBatchData]           = useState(null);

  // Landing search
  const [landingSearch, setLandingSearch]   = useState('');
  const [landingResults, setLandingResults] = useState([]);
  const [landingSearching, setLandingSearching] = useState(false);

  // Program filter
  const [programSearch, setProgramSearch]   = useState('');

  // Distribution form (for encoding optional/missing data)
  const [distForm, setDistForm]     = useState({
    qty_bags: '',
    rice_variety_received: '',
    crop_establishment: '',
    expected_sowing_date: '',
    date_received: '',
    authorized_representative: '',
    number_of_bags: '',
  });
  const [distErrors, setDistErrors] = useState({});
  const [saving, setSaving]         = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Report
  const [reportBatchId, setReportBatchId]     = useState(null);
  const [reportBatchData, setReportBatchData] = useState(null);
  const [reportLoading, setReportLoading]     = useState(false);

  // Modals
  const [toast, setToast]               = useState(null);
  const [confirmSnack, setConfirmSnack] = useState(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [viewSig, setViewSig]           = useState(null);

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
      setEvents(evRes.data || []);
      setFinalSeeds(fsRes.data || []);
    } catch {
      showToast('error', 'Failed to load distribution data.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const finalSeason = finalSeeds[0]
    ? `${finalSeeds[0].season_display} ${finalSeeds[0].year}`
    : null;

  // ─────────────────────────────────────────
  // LANDING FARMER SEARCH
  // Searches farmers who are already encoded (in beneficiaries)
  // ─────────────────────────────────────────
  const searchTimer = useRef(null);
  const handleLandingSearch = (q) => {
    setLandingSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setLandingResults([]); return; }
    setLandingSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        // Search across all events for this brgy
        const res = await searchFarmers({ search: q });
        // Filter: only farmers that have been encoded in beneficiaries
        setLandingResults(res.data || []);
      } catch { setLandingResults([]); }
      finally { setLandingSearching(false); }
    }, 300);
  };

  // ─────────────────────────────────────────
  // OPEN PROGRAM
  // ─────────────────────────────────────────
  const openProgram = async (event) => {
    setCurrentEvent(event);
    setView('report');
    try {
      const [evRes, bRes] = await Promise.all([
        getDistributionEvent(event.id),
        getEventBatches(event.id),
      ]);
      setCurrentEvent(evRes.data);
      // Distribution should only operate on APPROVED beneficiaries batches
      const batches = (bRes.data || []).filter(b => b.status === 'APPROVED');
      setCurrentBatches(batches);
      if (batches.length > 0) {
        const first = batches[0];
        setSelectedBatch(first);
        await loadReportBatch(first.id);
      }
    } catch {
      showToast('error', 'Failed to load program.');
    }
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

  // ─────────────────────────────────────────
  // OPEN FARMER DETAIL
  // Called when BRGY clicks a farmer in the report table
  // to encode missing/optional distribution data
  // ─────────────────────────────────────────
  const openFarmerDetail = (entry) => {
    setCurrentEntry(entry);
    const evH = isHybrid(currentEvent?.seed_type_name || currentEvent?.intervention || '');
    setDistForm({
      qty_bags: entry.qty_bags || '',
      rice_variety_received: entry.variety_name || '',
      crop_establishment: entry.crop_establishment || '',
      expected_sowing_date: entry.expected_sowing_date || '',
      date_received: entry.date_received || '',
      authorized_representative: entry.authorized_representative || '',
      number_of_bags: entry.qty_bags || '',
    });
    setDistErrors({});
    setView('farmer_detail');
  };

  // Also allow landing search result to open farmer detail
  const openFarmerFromSearch = async (farmer) => {
    // Find this farmer's entry in any event
    try {
      const evRes = await getDistributionEvents();
      const allEvents = evRes.data || [];
      // Find the event this farmer is in
      for (const event of allEvents) {
        const batches = await getEventBatches(event.id);
        for (const batch of (batches.data || []).filter(b => b.status === 'APPROVED')) {
          const det = await getBatchDetail(batch.id);
          const entry = det.data.entries?.find(e => e.farmer === farmer.id || e.farmer_contact === farmer.contact_number);
          if (entry) {
            setCurrentEvent(event);
            setCurrentBatches((batches.data || []).filter(b => b.status === 'APPROVED'));
            setSelectedBatch(batch);
            setBatchData(det.data);
            openFarmerDetail(entry);
            return;
          }
        }
      }
      showToast('error', 'This farmer has not been encoded in Beneficiaries yet.');
    } catch {
      showToast('error', 'Failed to find farmer data.');
    }
  };

  const eventIsHybrid = isHybrid(currentEvent?.seed_type_name || currentEvent?.intervention || '');
  const eventIsInbred = isInbred(currentEvent?.seed_type_name || currentEvent?.intervention || '');

  // ─────────────────────────────────────────
  // VALIDATE DISTRIBUTION FORM
  // In distribution, optional fields from beneficiaries become REQUIRED
  // ─────────────────────────────────────────
  const validateDistForm = () => {
    const errs = {};
    if (eventIsHybrid) {
      if (!distForm.qty_bags) errs.qty_bags = 'QTY (bags) is required in distribution';
    }
    if (eventIsInbred) {
      if (!distForm.number_of_bags)          errs.number_of_bags          = 'Number of bags is required';
      if (!distForm.rice_variety_received)   errs.rice_variety_received   = 'Rice variety is required';
      if (!distForm.crop_establishment)      errs.crop_establishment      = 'Crop establishment is required';
      if (!distForm.expected_sowing_date)    errs.expected_sowing_date    = 'Expected sowing date is required';
      if (!distForm.date_received)           errs.date_received           = 'Date received is required';
    }
    return errs;
  };

  // ─────────────────────────────────────────
  // SAVE DISTRIBUTION DATA
  // ─────────────────────────────────────────
  const handleSaveDistribution = () => {
    const errs = validateDistForm();
    if (Object.keys(errs).length > 0) {
      setDistErrors(errs);
      showToast('error', 'Please fill all required distribution fields.');
      return;
    }
    setConfirmSnack({
      title: `Confirm distribution for ${currentEntry?.farmer_name}?`,
      message: 'This will update the farmer\'s distribution data and mark seed as distributed.',
      confirmLabel: 'Confirm Distribution',
    });
  };

  const doSaveDistribution = async () => {
    setConfirmSnack(null);
    setSaving(true);
    try {
      const payload = eventIsHybrid ? {
        qty_bags: Number(distForm.qty_bags),
      } : {
        qty_bags: Number(distForm.number_of_bags),
        crop_establishment: distForm.crop_establishment,
        expected_sowing_date: distForm.expected_sowing_date,
        date_received: distForm.date_received,
        authorized_representative: distForm.authorized_representative,
      };
      await updateEntry(currentEntry.id, payload);
      showToast('success', `Distribution data saved for ${currentEntry.farmer_name}.`);
      setTimeout(async () => {
        setView('report');
        await loadReportBatch(selectedBatch.id);
      }, 800);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────
  // SUBMIT BATCH
  // ─────────────────────────────────────────
  const handleSubmitBatch = async (batchId) => {
    setSubmitConfirm(false);
    setSubmitting(true);
    try {
      await submitBatch(batchId);
      await loadReportBatch(batchId);
      showToast('success', 'Batch submitted for admin review.');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────
  // REPORT TABLE: group by variety for Hybrid
  // ─────────────────────────────────────────
  const entriesByVariety = (() => {
    if (!reportBatchData?.entries) return [];
    if (eventIsInbred) {
      return reportBatchData.entries.length > 0
        ? [{ name: null, entries: reportBatchData.entries }]
        : [];
    }
    const groups = {};
    reportBatchData.entries.forEach(e => {
      const key = e.variety_name || currentEvent?.variety_name || 'Unspecified';
      if (!groups[key]) groups[key] = { name: key, entries: [] };
      groups[key].entries.push(e);
    });
    return Object.values(groups);
  })();

  const filteredEvents = events.filter(ev => {
    const q = programSearch.toLowerCase();
    return !q ||
      ev.organization_name?.toLowerCase().includes(q) ||
      ev.seed_type_name?.toLowerCase().includes(q);
  });

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
            to   { transform: translateX(-50%) translateY(0); opacity: 1; }
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `}</style>
        <div style={{ width: 36, height: 36, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading distribution...</p>
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
          to   { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .prog-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.12) !important; transform: translateY(-2px); transition: all 0.2s; }
        .row-hover:hover { background-color: ${GREEN.light} !important; }
      `}</style>

      <Toast toast={toast} />
      <ConfirmSnack
        data={confirmSnack}
        onConfirm={doSaveDistribution}
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
                <p style={{ fontWeight: 800, margin: 0 }}>Submit Batch?</p>
                <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>Admin will review this distribution batch.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setSubmitConfirm(false)} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleSubmitBatch(reportBatchData?.id)} disabled={submitting}
                style={{ flex: 2, padding: '0.75rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BREADCRUMB ── */}
      {view !== 'landing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '1.25rem 1.25rem 0', fontSize: '0.8rem', animation: 'fadeIn 0.2s ease', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (view === 'report') { setView('landing'); loadAll(); }
              else if (view === 'farmer_detail') setView('report');
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <ChevronLeft size={15} />
            {view === 'report' ? 'Distribution' : currentEvent?.organization_name || 'Report'}
          </button>
          {view !== 'landing' && (
            <>
              <ChevronRight size={12} color="#9ca3af" />
              <span style={{ color: '#374151', fontWeight: 700 }}>
                {view === 'farmer_detail' ? `${currentEntry?.farmer_name || 'Farmer'} — Encode Distribution` : currentEvent?.organization_name}
              </span>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: LANDING
      ══════════════════════════════════════════ */}
      {view === 'landing' && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          {/* Header */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Distribution</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {myBarangay} · {finalSeason || 'No active season'}
            </p>
          </div>

          {/* Info banner */}
          <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '1rem', padding: '1rem 1.125rem', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 700, color: GREEN.accent, margin: '0 0 0.25rem', fontSize: '0.875rem' }}>
               Seed Distribution Phase
            </p>
            <p style={{ color: GREEN.accent, opacity: 0.85, margin: 0, fontSize: '0.78rem', lineHeight: 1.5 }}>
              Once seeds arrive, encode missing distribution data here (QTY for Hybrid, complete details for Inbred). Search a farmer or select a program below.
            </p>
          </div>

          {/* Farmer search */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={15} color={GREEN.primary} /> Search Farmer
            </p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.75rem' }}>
              Search for a farmer that has been encoded in Beneficiaries to encode/complete their distribution data.
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
                No farmers found. Make sure they are encoded in Beneficiaries first.
              </p>
            )}
            {landingResults.length > 0 && (
              <div style={{ marginTop: '0.625rem', border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden' }}>
                {landingResults.slice(0, 8).map((farmer, idx) => (
                  <div key={farmer.id} className="row-hover"
                    onClick={() => openFarmerFromSearch(farmer)}
                    style={{ padding: '0.875rem 1rem', borderBottom: idx < Math.min(landingResults.length, 8) - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', transition: 'background 0.15s' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>
                        {farmer.last_name}, {farmer.first_name}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                        {farmer.rsbsa_number || 'No RSBSA'} · {farmer.barangay}
                      </p>
                    </div>
                    <ChevronRight size={14} color="#9ca3af" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Program cards */}
          <div style={{ marginBottom: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#374151', margin: 0 }}>Programs</p>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={programSearch} onChange={e => setProgramSearch(e.target.value)} placeholder="Filter programs..." style={{ padding: '0.4rem 0.75rem 0.4rem 2rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.78rem', outline: 'none', width: '180px' }} />
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
              <Package size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.375rem' }}>No programs yet</p>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Programs are created in the Beneficiaries menu.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filteredEvents.map((event, idx) => {
                const evH = isHybrid(event.seed_type_name || event.intervention || '');
                const tagColor = evH ? '#1e40af' : GREEN.primary;
                const tagBg    = evH ? '#eff6ff' : GREEN.light;
                const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                // Check if any approved batches have missing data
                const hasIncomplete = event.batches?.some(b =>
                  b.status === 'APPROVED' && (
                    evH ? event.total_encoded > 0 : event.total_encoded > 0
                  )
                );
                return (
                  <div key={event.id} className="prog-card"
                    onClick={() => openProgram(event)}
                    style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${tagBorder}`, cursor: 'pointer', animation: `slideUp ${0.3 + idx * 0.06}s ease` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
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
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                          {event.season_display} {event.year} · {event.barangay}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: tagColor, margin: 0 }}>
                          {event.total_approved}<span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>/{event.total_members}</span>
                        </p>
                        <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>approved</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af', alignItems: 'center' }}>
                      <span>{event.batch_count} batch{event.batch_count !== 1 ? 'es' : ''}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ color: tagColor, fontWeight: 600 }}>View Masterlist</span>
                        <ChevronRight size={12} color={tagColor} />
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
          VIEW: REPORT (Masterlist table)
      ══════════════════════════════════════════ */}
      {view === 'report' && currentEvent && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          {/* Document header */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.875rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.875rem' }}>
              <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>Republic of the Philippines · Department of Agriculture</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1a1a1a', margin: '0.375rem 0 0', textTransform: 'uppercase' }}>
                Distribution Masterlist
              </p>
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

          {/* Batch selector */}
          {currentBatches.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {currentBatches.map(b => (
                <button key={b.id} onClick={() => { setSelectedBatch(b); loadReportBatch(b.id); }}
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
                <div key={gIdx} style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
                  {/* Table header */}
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: '2px solid #e5e7eb', backgroundColor: GREEN.light, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: GREEN.accent }}>
                        Batch {reportBatchData?.batch_number}
                      </span>
                      {eventIsHybrid && group.name && (
                        <>
                          <span style={{ color: GREEN.border }}>·</span>
                          <span style={{ fontWeight: 800, fontSize: '0.875rem', color: GREEN.primary }}>Variety: {group.name}</span>
                        </>
                      )}
                      <StatusBadge status={reportBatchData?.status} />
                    </div>
                    {/* Submit button for DRAFT batches */}
                    {reportBatchData?.status === 'DRAFT' && (
                      <button onClick={() => setSubmitConfirm(true)}
                        style={{ padding: '0.5rem 1.125rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Send size={13} /> Submit
                      </button>
                    )}
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    {eventIsHybrid ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '900px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            {['No.','RSBSA No.','Name','Contact','Farm Area (ha)','QTY (bags)','Variety','Signature','Action'].map((col, i) => (
                              <th key={i} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 700, color: col === 'QTY (bags)' ? '#854d0e' : '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((entry, idx) => {
                            const missingQty = !entry.qty_bags;
                            const td = { padding: '0.4375rem 0.5rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                            return (
                              <tr key={entry.id} style={{ backgroundColor: missingQty ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.row_number}</td>
                                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{entry.farmer_name}</td>
                                <td style={td}>{entry.farmer_contact || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.farm_area_ha || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {missingQty ? (
                                    <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>Not yet</span>
                                  ) : entry.qty_bags}
                                </td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.variety_name || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {entry.has_signature ? (
                                    <button onClick={() => { getBatchDetail(reportBatchData.id).then(res => { const full = res.data.entries?.find(e => e.id === entry.id); if (full?.signature) setViewSig(full.signature); }); }}
                                      style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, border: `1px solid ${GREEN.border}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                      <Eye size={9} /> View
                                    </button>
                                  ) : <span style={{ color: '#9ca3af' }}>—</span>}
                                </td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {/* Allow encoding QTY even for approved batches */}
                                  <button onClick={() => openFarmerDetail(entry)}
                                    style={{ padding: '0.15rem 0.5rem', backgroundColor: missingQty ? '#854d0e' : '#eff6ff', color: missingQty ? 'white' : '#1e40af', border: missingQty ? 'none' : '1px solid #bfdbfe', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                    <Edit2 size={9} /> {missingQty ? 'Encode QTY' : 'Edit'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      /* INBRED table */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1300px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            {['No.','RSBSA No.','Name','Area Planted','No. of Bags','Rice Variety','Crop Estab.','Sowing Date','Data Sharing','Date Received','Auth. Rep.','Signature','Action'].map((col, i) => (
                              <th key={i} style={{ padding: '0.5rem 0.375rem', textAlign: 'center', fontWeight: 700, color: ['No. of Bags','Rice Variety','Crop Estab.','Sowing Date','Date Received'].includes(col) ? '#854d0e' : '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((entry, idx) => {
                            const missingDist = !entry.qty_bags || !entry.date_received;
                            const td = { padding: '0.4375rem 0.375rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                            return (
                              <tr key={entry.id} style={{ backgroundColor: missingDist ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.row_number}</td>
                                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{entry.farmer_name}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.area_planted || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {entry.qty_bags ? entry.qty_bags : (
                                    <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>Pending</span>
                                  )}
                                </td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.variety_name || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.crop_establishment || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.expected_sowing_date || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.data_sharing ? '✓' : '✗'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.date_received ? new Date(entry.date_received + 'T00:00:00').toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '—'}</td>
                                <td style={td}>{entry.authorized_representative || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {entry.has_signature ? (
                                    <button onClick={() => { getBatchDetail(reportBatchData.id).then(res => { const full = res.data.entries?.find(e => e.id === entry.id); if (full?.signature) setViewSig(full.signature); }); }}
                                      style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, border: `1px solid ${GREEN.border}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                      <Eye size={9} /> View
                                    </button>
                                  ) : <span style={{ color: '#9ca3af' }}>—</span>}
                                </td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  <button onClick={() => openFarmerDetail(entry)}
                                    style={{ padding: '0.15rem 0.5rem', backgroundColor: missingDist ? '#854d0e' : '#eff6ff', color: missingDist ? 'white' : '#1e40af', border: missingDist ? 'none' : '1px solid #bfdbfe', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                    <Edit2 size={9} /> {missingDist ? 'Encode' : 'Edit'}
                                  </button>
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
            </div>
          ) : !reportLoading && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af', border: '1px solid #f3f4f6' }}>
              <FileText size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              No farmers in this batch.
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: FARMER DETAIL (Encode distribution data)
      ══════════════════════════════════════════ */}
      {view === 'farmer_detail' && currentEntry && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          {/* Farmer info */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: GREEN.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
                {(currentEntry.farmer_name?.charAt(0) || '').toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a1a', margin: 0 }}>{currentEntry.farmer_name}</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>
                  {currentEntry.farmer_rsbsa || 'No RSBSA'} · {currentEntry.farmer_barangay}
                </p>
              </div>
            </div>
          </div>

          {/* Pre-filled data from beneficiaries */}
          <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.875rem', padding: '1rem', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: GREEN.accent, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <CheckCircle size={14} /> Data from Beneficiaries (auto-filled)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
              {eventIsHybrid ? (
                <>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>Farm Area</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{currentEntry.farm_area_ha || '—'} ha</p>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>Variety</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{currentEntry.variety_name || '—'}</p>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>QTY Status</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: currentEntry.qty_bags ? GREEN.accent : '#854d0e', margin: 0 }}>
                      {currentEntry.qty_bags ? `${currentEntry.qty_bags} bags` : 'Not yet encoded'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>Area Planted</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{currentEntry.area_planted || '—'} ha</p>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>Data Sharing</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: currentEntry.data_sharing ? GREEN.accent : '#9ca3af', margin: 0 }}>
                      {currentEntry.data_sharing ? '✓ Agreed' : 'Not agreed'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Distribution fields — NOW REQUIRED */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem', border: '1px solid #f3f4f6' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.25rem' }}>
              Distribution Data <span style={{ color: '#dc2626' }}>*</span>
            </p>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 1rem' }}>
              These fields are required now that seeds have arrived.
            </p>

            {/* Hybrid: QTY */}
            {eventIsHybrid && (
              <>
                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.625rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#1e40af' }}>
                  <strong>Variety:</strong> {currentEntry.variety_name || '—'} &nbsp;|&nbsp; <strong>Source:</strong> Region (NRP/RFO)
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    QTY (bags) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="number" min="1" step="1" value={distForm.qty_bags}
                    onChange={e => { setDistForm(p => ({ ...p, qty_bags: e.target.value })); setDistErrors(p => ({ ...p, qty_bags: '' })); }}
                    placeholder="Number of seed bags received" style={inp(!!distErrors.qty_bags)} />
                  {distErrors.qty_bags && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{distErrors.qty_bags}</p>}
                </div>
              </>
            )}

            {/* Inbred: All distribution fields */}
            {eventIsInbred && (
              <>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Number of Bags (20kg/bag) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="number" min="1" value={distForm.number_of_bags}
                    onChange={e => { setDistForm(p => ({ ...p, number_of_bags: e.target.value })); setDistErrors(p => ({ ...p, number_of_bags: '' })); }}
                    placeholder="e.g. 1" style={inp(!!distErrors.number_of_bags)} />
                  {distErrors.number_of_bags && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{distErrors.number_of_bags}</p>}
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Rice Variety Received <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="text" value={distForm.rice_variety_received}
                    onChange={e => { setDistForm(p => ({ ...p, rice_variety_received: e.target.value })); setDistErrors(p => ({ ...p, rice_variety_received: '' })); }}
                    placeholder="e.g. RC 216" style={inp(!!distErrors.rice_variety_received)} />
                  {distErrors.rice_variety_received && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{distErrors.rice_variety_received}</p>}
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Crop Establishment (D/T) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select value={distForm.crop_establishment}
                    onChange={e => { setDistForm(p => ({ ...p, crop_establishment: e.target.value })); setDistErrors(p => ({ ...p, crop_establishment: '' })); }}
                    style={inp(!!distErrors.crop_establishment)}>
                    <option value="">Select</option>
                    <option value="DS">Direct Seeding (D)</option>
                    <option value="TP">Transplanting (T)</option>
                  </select>
                  {distErrors.crop_establishment && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{distErrors.crop_establishment}</p>}
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Expected Sowing Date (Month/Week) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="text" value={distForm.expected_sowing_date}
                    onChange={e => { setDistForm(p => ({ ...p, expected_sowing_date: e.target.value })); setDistErrors(p => ({ ...p, expected_sowing_date: '' })); }}
                    placeholder="e.g. June/2nd Week" style={inp(!!distErrors.expected_sowing_date)} />
                  {distErrors.expected_sowing_date && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{distErrors.expected_sowing_date}</p>}
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Date Received (MM/DD/YY) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input type="date" value={distForm.date_received}
                    onChange={e => { setDistForm(p => ({ ...p, date_received: e.target.value })); setDistErrors(p => ({ ...p, date_received: '' })); }}
                    style={inp(!!distErrors.date_received)} />
                  {distErrors.date_received && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{distErrors.date_received}</p>}
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Name of Authorized Representative
                  </label>
                  <input type="text" value={distForm.authorized_representative}
                    onChange={e => setDistForm(p => ({ ...p, authorized_representative: e.target.value }))}
                    placeholder="Last Name, First Name, MI" style={inp(false)} />
                </div>
              </>
            )}

            {/* 2025 DS Yield placeholder */}
            <div style={{ backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '0.625rem', padding: '0.75rem 1rem', marginTop: '0.5rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.125rem' }}>
                2025 DS YIELD — Major Seed and Variety Planted
              </p>
              <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>
                Harvest data will be encoded in the Yield Encode menu after harvest. This section is a placeholder.
              </p>
            </div>
          </div>

          {/* Save button */}
          <button onClick={handleSaveDistribution} disabled={saving}
            style={{ width: '100%', padding: '0.9375rem', backgroundColor: saving ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: saving ? 'none' : `0 4px 16px ${GREEN.primary}40`, transition: 'all 0.2s' }}>
            {saving ? 'Saving...' : <><CheckCircle size={18} /> Confirm Seed Distributed</>}
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            This confirms the farmer received their seed allocation. Data will be used for GIS tracking.
          </p>
        </div>
      )}
    </div>
  );
};

export default BrgyDistribution;