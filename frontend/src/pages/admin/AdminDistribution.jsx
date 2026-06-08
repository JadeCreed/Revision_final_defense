// src/pages/admin/Distribution.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDistributionEvents,
  getDistributionStats,
  approveBatch, rejectBatch,
  approveDistributionBatch, rejectDistributionBatch,
  unlockBatch, getBatchDetail, getEventBatches,
  searchFarmers, updateEntry,
  getAdminDistributionPending,
} from '../../api/axios';
import {
  Search, ChevronRight, ChevronLeft, CheckCircle,
  AlertCircle, MapPin, Clock, XCircle, Unlock,
  Eye, Edit2, FileText, Package, Users, ClipboardList,
  Send, Wheat,
} from 'lucide-react';

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

const ProgressBar = ({ value, max, color = GREEN.primary }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: '100%', height: '5px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '999px', transition: 'width 0.5s ease' }} />
    </div>
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

const TABS = [
  { key: 'events', label: 'All Events', Icon: ClipboardList },
  { key: 'pending', label: 'Pending Review', Icon: Clock },
  { key: 'approved', label: 'Approved Batches', Icon: CheckCircle },
];

const AdminDistribution = () => {
  const [activeTab, setActiveTab] = useState('events');
  // VIEW: 'landing' | 'brgy_detail' | 'batch_detail' | 'report' | 'farmer_detail'
  const [view, setView]               = useState('landing');
  const [events, setEvents]           = useState([]);
  const [stats, setStats]             = useState(null);
  const [distPending, setDistPending] = useState([]);
  const [loading, setLoading]         = useState(true);

  // Landing search
  const [landingSearch, setLandingSearch]   = useState('');
  const [landingResults, setLandingResults] = useState([]);
  const [landingSearching, setLandingSearching] = useState(false);

  // BRGY cards (grouped)
  const [brgyGroups, setBrgyGroups]   = useState({});
  const [filterSeason, setFilterSeason] = useState('');

  // Drill-down
  const [selectedBrgy, setSelectedBrgy]   = useState(null);
  const [brgyEvents, setBrgyEvents]       = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventBatches, setEventBatches]   = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchData, setBatchData]         = useState(null);
  const [batchLoading, setBatchLoading]   = useState(false);

  // Report batch
  const [reportBatchId, setReportBatchId]     = useState(null);
  const [reportBatchData, setReportBatchData] = useState(null);
  const [reportLoading, setReportLoading]     = useState(false);

  // Farmer detail (admin encodes QTY)
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [adminForm, setAdminForm]         = useState({ qty_bags: '', number_of_bags: '', rice_variety_received: '', crop_establishment: '', expected_sowing_date: '', date_received: '', authorized_representative: '' });
  const [adminFormErrors, setAdminFormErrors] = useState({});
  const [adminSaving, setAdminSaving]     = useState(false);

  // Modals
  const [rejectModal, setRejectModal]     = useState(null);
  const [rejectReason, setRejectReason]   = useState('');
  const [unlockModal, setUnlockModal]     = useState(null);
  const [unlockReason, setUnlockReason]   = useState('');
  const [rejectType, setRejectType]       = useState('beneficiary');
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [viewSig, setViewSig]             = useState(null);

  const [toast, setToast]               = useState(null);
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
  // FETCH
  // ─────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [evRes, sRes, dpRes] = await Promise.all([
        getDistributionEvents(),
        getDistributionStats(),
        getAdminDistributionPending(),
      ]);
      const evData = evRes.data || [];
      setEvents(evData);
      setStats(sRes.data);
      setDistPending(dpRes.data || []);

      // Group by barangay
      const groups = {};
      evData.forEach(ev => {
        if (!groups[ev.barangay]) {
          groups[ev.barangay] = {
            barangay: ev.barangay,
            events: [],
            season: ev.season_display,
            year: ev.year,
            totalEncoded: 0,
            totalMembers: 0,
            totalApproved: 0,
          };
        }
        groups[ev.barangay].events.push(ev);
        groups[ev.barangay].totalEncoded  += ev.total_encoded  || 0;
        groups[ev.barangay].totalMembers  += ev.total_members  || 0;
        groups[ev.barangay].totalApproved += ev.total_approved || 0;
      });
      setBrgyGroups(groups);
    } catch {
      showToast('error', 'Failed to load distribution data.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─────────────────────────────────────────
  // LANDING SEARCH
  // ─────────────────────────────────────────
  const searchTimer = useRef(null);
  const handleLandingSearch = (q) => {
    setLandingSearch(q);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setLandingResults([]); return; }
    setLandingSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchFarmers({ search: q });
        setLandingResults(res.data || []);
      } catch { setLandingResults([]); }
      finally { setLandingSearching(false); }
    }, 300);
  };

  // ─────────────────────────────────────────
  // OPEN BRGY
  // ─────────────────────────────────────────
  const openBrgy = (brgy) => {
    setSelectedBrgy(brgy);
    setBrgyEvents(brgyGroups[brgy]?.events || []);
    setView('brgy_detail');
  };

  // ─────────────────────────────────────────
  // OPEN EVENT → show batch cards
  // ─────────────────────────────────────────
  const openEvent = async (event) => {
    setSelectedEvent(event);
    try {
      const bRes = await getEventBatches(event.id);
      const batches = (bRes.data || []).filter(b => b.status === 'APPROVED' || b.status === 'SUBMITTED');
      setEventBatches(batches);
      setView('batch_detail');
    } catch {
      showToast('error', 'Failed to load batches.');
    }
  };

  // ─────────────────────────────────────────
  // OPEN BATCH REPORT
  // ─────────────────────────────────────────
  const openBatchReport = async (batch) => {
    setSelectedBatch(batch);
    setView('report');
    setReportBatchId(batch.id);
    setReportLoading(true);
    try {
      const res = await getBatchDetail(batch.id);
      setReportBatchData(res.data);
    } catch { setReportBatchData(null); }
    finally { setReportLoading(false); }
  };

  // ─────────────────────────────────────────
  // OPEN FARMER DETAIL (Admin encodes QTY)
  // ─────────────────────────────────────────
  const openFarmerDetail = (entry) => {
    setSelectedEntry(entry);
    const evH = isHybrid(selectedEvent?.seed_type_name || selectedEvent?.intervention || '');
    setAdminForm({
      qty_bags: entry.qty_bags || '',
      number_of_bags: entry.qty_bags || '',
      rice_variety_received: entry.variety_name || '',
      crop_establishment: entry.crop_establishment || '',
      expected_sowing_date: entry.expected_sowing_date || '',
      date_received: entry.date_received || '',
      authorized_representative: entry.authorized_representative || '',
    });
    setAdminFormErrors({});
    setView('farmer_detail');
  };

  const eventIsHybrid = isHybrid(selectedEvent?.seed_type_name || selectedEvent?.intervention || '');
  const eventIsInbred = isInbred(selectedEvent?.seed_type_name || selectedEvent?.intervention || '');

  // ─────────────────────────────────────────
  // REPORT TABLE
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
      const key = e.variety_name || selectedEvent?.variety_name || 'Unspecified';
      if (!groups[key]) groups[key] = { name: key, entries: [] };
      groups[key].entries.push(e);
    });
    return Object.values(groups);
  })();

  // ─────────────────────────────────────────
  // ADMIN SAVE DISTRIBUTION DATA
  // ─────────────────────────────────────────
  const validateAdminForm = () => {
    const errs = {};
    if (eventIsHybrid && !adminForm.qty_bags) errs.qty_bags = 'QTY is required';
    if (eventIsInbred) {
      if (!adminForm.number_of_bags)       errs.number_of_bags       = 'Required';
      if (!adminForm.rice_variety_received) errs.rice_variety_received = 'Required';
      if (!adminForm.crop_establishment)   errs.crop_establishment   = 'Required';
      if (!adminForm.expected_sowing_date) errs.expected_sowing_date = 'Required';
      if (!adminForm.date_received)        errs.date_received        = 'Required';
    }
    return errs;
  };

  const handleAdminSave = async () => {
    const errs = validateAdminForm();
    if (Object.keys(errs).length > 0) { setAdminFormErrors(errs); showToast('error', 'Please fill all required fields.'); return; }
    setAdminSaving(true);
    try {
      const payload = eventIsHybrid ? {
        qty_bags: Number(adminForm.qty_bags),
      } : {
        qty_bags: Number(adminForm.number_of_bags),
        crop_establishment: adminForm.crop_establishment,
        expected_sowing_date: adminForm.expected_sowing_date,
        date_received: adminForm.date_received,
        authorized_representative: adminForm.authorized_representative,
      };
      await updateEntry(selectedEntry.id, payload);
      showToast('success', `Distribution data updated for ${selectedEntry.farmer_name}.`);
      setTimeout(async () => {
        setView('report');
        const res = await getBatchDetail(reportBatchId);
        setReportBatchData(res.data);
      }, 800);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to save.');
    } finally {
      setAdminSaving(false);
    }
  };

  // ─────────────────────────────────────────
  // APPROVE / REJECT / UNLOCK
  // ─────────────────────────────────────────
  const handleApprove = async (batchId) => {
    setActionLoading(p => ({ ...p, [batchId]: 'approve' }));
    try {
      await approveBatch(batchId);
      showToast('success', 'Batch approved.');
      fetchAll();
      if (reportBatchId === batchId) {
        const res = await getBatchDetail(batchId);
        setReportBatchData(res.data);
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed.');
    } finally {
      setActionLoading(p => ({ ...p, [batchId]: null }));
    }
  };

  const handleApproveDistribution = async (batchId) => {
    setActionLoading(p => ({ ...p, [batchId]: 'dist_approve' }));
    try {
      await approveDistributionBatch(batchId);
      showToast('success', 'Distribution batch approved.');
      fetchAll();
      if (reportBatchId === batchId) {
        const res = await getBatchDetail(batchId);
        setReportBatchData(res.data);
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed.');
    } finally {
      setActionLoading(p => ({ ...p, [batchId]: null }));
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(p => ({ ...p, [rejectModal]: 'reject' }));
    try {
      if (rejectType === 'distribution') {
        await rejectDistributionBatch(rejectModal, { reason: rejectReason });
      } else {
        await rejectBatch(rejectModal, { reason: rejectReason });
      }
      setRejectModal(null);
      setRejectReason('');
      showToast('success', 'Batch rejected.');
      fetchAll();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed.');
    } finally {
      setActionLoading(p => ({ ...p, [rejectModal]: null }));
    }
  };

  const handleUnlock = async () => {
    if (!unlockReason.trim()) return;
    setActionLoading(p => ({ ...p, [unlockModal]: 'unlock' }));
    try {
      await unlockBatch(unlockModal, { reason: unlockReason });
      setUnlockModal(null);
      setUnlockReason('');
      showToast('success', 'Batch unlocked.');
      fetchAll();
      if (reportBatchId) {
        const res = await getBatchDetail(reportBatchId);
        setReportBatchData(res.data);
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed.');
    } finally {
      setActionLoading(p => ({ ...p, [unlockModal]: null }));
    }
  };

  const filteredBrgyGroups = Object.values(brgyGroups).filter(g =>
    !filterSeason || g.events.some(ev => ev.season === filterSeason)
  );

  const pendingDistributionBatches = distPending.filter(batch => batch.distribution_status === 'SUBMITTED');
  const approvedDistributionBatches = distPending.filter(batch => batch.distribution_status === 'APPROVED');

  const pendingByBrgy = (() => {
    const groups = {};
    pendingDistributionBatches.forEach(batch => {
      const ev = events.find(e => e.id === batch.event || e.id === batch.event_id);
      if (!ev) return;
      const key = ev.barangay;
      if (!groups[key]) groups[key] = { barangay: ev.barangay, batches: [], firstEvent: ev };
      groups[key].batches.push({ ...batch, _event: ev });
    });
    return Object.values(groups);
  })();

  const approvedByBrgy = (() => {
    const groups = {};
    approvedDistributionBatches.forEach(batch => {
      const ev = events.find(e => e.id === batch.event || e.id === batch.event_id);
      if (!ev) return;
      const key = ev.barangay;
      if (!groups[key]) groups[key] = { barangay: ev.barangay, batches: [], firstEvent: ev };
      groups[key].batches.push({ ...batch, _event: ev });
    });
    return Object.values(groups);
  })();

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
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .card-hover:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; transform: translateY(-1px); transition: all 0.2s; }
        .row-hover:hover  { background-color: ${GREEN.light} !important; }
      `}</style>

      <Toast toast={toast} />
      <SignatureModal sig={viewSig} onClose={() => setViewSig(null)} />

      {/* Header + Stats */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Seed Distribution</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          View and manage seed distribution across all barangays.
        </p>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Events',     value: stats.total_events,         Icon: ClipboardList },
            { label: 'Pending Batches',  value: stats.pending_batches,      Icon: Clock        },
            { label: 'Approved',         value: stats.approved_batches,     Icon: CheckCircle  },
            { label: 'Farmers Served',   value: stats.total_farmers_served, Icon: Users        },
          ].map(({ label, value, Icon }) => (
            <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.125rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
              <Icon size={18} color={GREEN.primary} />
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: GREEN.primary, margin: '0.375rem 0 0.125rem', lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.25rem', border: '1px solid #e5e7eb' }}>
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => { setActiveTab(key); setView('landing'); }} style={{ flex: 1, padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === key ? 'white' : 'transparent', color: activeTab === key ? '#1a1a1a' : '#6b7280', fontWeight: activeTab === key ? 700 : 400, cursor: 'pointer', fontSize: '0.8rem', boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── BREADCRUMB ── */}
      {activeTab === 'events' && view !== 'landing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1.25rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (view === 'brgy_detail')   { setView('landing'); }
              if (view === 'batch_detail')  { setView('brgy_detail'); }
              if (view === 'report')        { setView('batch_detail'); }
              if (view === 'farmer_detail') { setView('report'); }
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <ChevronLeft size={14} />
            {view === 'brgy_detail' ? 'Distribution'
              : view === 'batch_detail' ? `Brgy. ${selectedBrgy}`
              : view === 'report' ? selectedEvent?.organization_name || 'Batches'
              : 'Report'
            }
          </button>
          {view !== 'brgy_detail' && (
            <>
              <ChevronRight size={12} color="#9ca3af" />
              <span style={{ color: '#374151', fontWeight: 700 }}>
                {view === 'batch_detail' ? selectedEvent?.organization_name || 'Batches'
                  : view === 'report' ? `Batch ${selectedBatch?.batch_number}`
                  : selectedEntry?.farmer_name || 'Farmer Detail'
                }
              </span>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: LANDING
      ══════════════════════════════════════════ */}
      {activeTab === 'events' && view === 'landing' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Admin farmer search */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem', border: '1px solid #f3f4f6' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={15} color={GREEN.primary} /> Search Farmer
            </p>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={landingSearch} onChange={e => handleLandingSearch(e.target.value)} placeholder="Search a farmer across all barangays..." style={{ padding: '0.625rem 0.875rem 0.625rem 2.25rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {landingSearching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0', color: '#9ca3af', fontSize: '0.78rem' }}>
                <div style={{ width: 14, height: 14, border: '2px solid #e5e7eb', borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Searching...
              </div>
            )}
            {!landingSearching && landingSearch.length >= 2 && landingResults.length === 0 && (
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.5rem 0 0', textAlign: 'center', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                No farmers found.
              </p>
            )}
            {landingResults.length > 0 && (
              <div style={{ marginTop: '0.625rem', border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden' }}>
                {landingResults.slice(0, 8).map((farmer, idx) => (
                  <div key={farmer.id} className="row-hover"
                    style={{ padding: '0.875rem 1rem', borderBottom: idx < Math.min(landingResults.length, 8) - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>
                        {farmer.last_name}, {farmer.first_name}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                        {farmer.rsbsa_number || 'No RSBSA'} · {farmer.barangay}
                      </p>
                    </div>
                    <span style={{ backgroundColor: GREEN.light, color: GREEN.accent, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${GREEN.border}` }}>
                      {farmer.barangay}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Season filter */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Barangays:</span>
            {['WET', 'DRY'].map(s => (
              <button key={s} onClick={() => setFilterSeason(filterSeason === s ? '' : s)}
                style={{ padding: '0.375rem 0.875rem', border: `1.5px solid ${filterSeason === s ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: filterSeason === s ? GREEN.light : 'white', color: filterSeason === s ? GREEN.primary : '#6b7280', fontWeight: filterSeason === s ? 700 : 400, fontSize: '0.78rem', cursor: 'pointer' }}>
                {s === 'WET' ? ' Wet season' : 'Dry season'}
              </button>
            ))}
          </div>

          {/* BRGY cards */}
          {filteredBrgyGroups.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
              <Package size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No distribution events yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filteredBrgyGroups.map((group, idx) => (
                <div key={group.barangay} className="card-hover"
                  onClick={() => openBrgy(group.barangay)}
                  style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${GREEN.border}`, cursor: 'pointer', animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <MapPin size={14} color={GREEN.primary} />
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1a1a', margin: 0 }}>Brgy. {group.barangay}</h3>
                      </div>
                      <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>
                        {group.events.length} program{group.events.length !== 1 ? 's' : ''} · {group.season} {group.year}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: GREEN.primary, margin: 0 }}>
                        {group.totalApproved}<span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>/{group.totalMembers}</span>
                      </p>
                      <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>farmers approved</p>
                    </div>
                  </div>
                  <ProgressBar value={group.totalApproved} max={group.totalMembers} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: GREEN.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      View Programs <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: BRGY DETAIL (show programs/events)
      ══════════════════════════════════════════ */}
      {activeTab === 'events' && view === 'brgy_detail' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1a1a1a', margin: 0 }}>Brgy. {selectedBrgy}</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {brgyEvents.length} program{brgyEvents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {brgyEvents.map((event, idx) => {
              const evH = isHybrid(event.seed_type_name || event.intervention || '');
              const tagColor = evH ? '#1e40af' : GREEN.primary;
              const tagBg    = evH ? '#eff6ff' : GREEN.light;
              const tagBorder = evH ? '#bfdbfe' : GREEN.border;
              const approvedBatches = event.batches?.filter(b => b.status === 'APPROVED') || [];
              return (
                <div key={event.id} className="card-hover"
                  onClick={() => openEvent(event)}
                  style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: `1px solid ${tagBorder}`, animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem' }}>
                        <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                          {event.seed_type_name || (evH ? 'Hybrid' : 'Inbred')}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{event.season_display} {event.year}</span>
                      </div>
                      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a', margin: 0 }}>{event.organization_name}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${GREEN.border}` }}>
                          {approvedBatches.length} approved batch{approvedBatches.length !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      <ChevronRight size={16} color="#9ca3af" />
                    </div>
                  </div>
                  <ProgressBar value={event.total_approved} max={event.total_members} color={tagColor} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem', fontSize: '0.7rem', color: '#9ca3af' }}>
                    <span>{event.total_approved}/{event.total_members} approved</span>
                    <span>{event.total_encoded} encoded</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: BATCH DETAIL (show batch cards)
      ══════════════════════════════════════════ */}
      {activeTab === 'events' && view === 'batch_detail' && selectedEvent && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Event header */}
          <div style={{ backgroundColor: GREEN.primary, borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem', color: 'white' }}>
            <span style={{ fontSize: '0.72rem', opacity: 0.75, display: 'block', marginBottom: '0.25rem', fontWeight: 700, textTransform: 'uppercase' }}>
              {selectedEvent.intervention} · {selectedEvent.season_display} {selectedEvent.year}
            </span>
            <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>{selectedEvent.organization_name}</h2>
            <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '0.25rem 0 0' }}>Brgy. {selectedEvent.barangay}</p>
          </div>

          {eventBatches.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af', border: '1px solid #f3f4f6' }}>
              <FileText size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              No approved or submitted batches found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {eventBatches.map((batch, idx) => (
                <div key={batch.id} className="card-hover"
                  onClick={() => openBatchReport(batch)}
                  style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: `1px solid ${GREEN.border}`, animation: `slideUp ${0.25 + idx * 0.05}s ease` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <StatusBadge status={batch.status} />
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a1a' }}>Batch {batch.batch_number}</span>
                      </div>
                      <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>
                        {batch.entry_count} farmers · {batch.encoded_by_name}
                      </p>
                      {batch.approved_at && (
                        <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.125rem 0 0' }}>
                          Approved {new Date(batch.approved_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: GREEN.accent, fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        View Report <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: REPORT (Distribution masterlist)
      ══════════════════════════════════════════ */}
      {activeTab === 'events' && view === 'report' && selectedEvent && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Header */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.875rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.875rem' }}>
              <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>Republic of the Philippines · Department of Agriculture</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1a1a1a', margin: '0.375rem 0 0', textTransform: 'uppercase' }}>Distribution Masterlist</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.75rem', color: '#374151' }}>
              <span><strong>Province:</strong> Quezon</span>
              <span><strong>Municipality:</strong> Lucban</span>
              <span><strong>Program:</strong> {eventIsHybrid ? 'Hybrid (Region)' : 'Inbred (PhilRice)'}</span>
              <span><strong>Season:</strong> {`${selectedEvent.season_display} ${selectedEvent.year}`}</span>
              <span><strong>Barangay:</strong> {selectedEvent.barangay}</span>
              <span><strong>Batch:</strong> {selectedBatch?.batch_number}</span>
            </div>
          </div>

          {/* Batch status + actions */}
          {reportBatchData && (
            <div style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <StatusBadge status={reportBatchData.status} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Batch {reportBatchData.batch_number}</span>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{reportBatchData.entry_count} farmers</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {reportBatchData.status === 'SUBMITTED' && (
                  <>
                    <button
                      onClick={() => setConfirmAction({ batchId: reportBatchData.id, batchNumber: reportBatchData.batch_number })}
                      disabled={actionLoading[reportBatchData.id] === 'approve'}
                      style={{ padding: '0.375rem 0.875rem', backgroundColor: GREEN.soft, color: GREEN.accent, border: `1px solid ${GREEN.border}`, borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button onClick={() => { setRejectModal(reportBatchData.id); setRejectReason(''); }}
                      style={{ padding: '0.375rem 0.875rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <XCircle size={13} /> Reject
                    </button>
                  </>
                )}
                {reportBatchData.status === 'APPROVED' && (
                  <button onClick={() => { setUnlockModal(reportBatchData.id); setUnlockReason(''); }}
                    style={{ padding: '0.375rem 0.875rem', backgroundColor: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Unlock size={13} /> Unlock
                  </button>
                )}
              </div>
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
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: '2px solid #e5e7eb', backgroundColor: GREEN.light, display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    {eventIsHybrid && group.name && (
                      <span style={{ fontWeight: 800, fontSize: '0.875rem', color: GREEN.primary }}>Variety: {group.name}</span>
                    )}
                    <span style={{ backgroundColor: 'white', color: '#6b7280', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, border: '1px solid #e5e7eb' }}>
                      {group.entries.length} farmer{group.entries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    {eventIsHybrid ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '850px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            {['No.','RSBSA No.','Name','Contact','Farm Area (ha)','QTY (bags)','Variety','Signature'].map((col, i) => (
                              <th key={i} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 700, color: col === 'QTY (bags)' ? '#854d0e' : '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((entry, idx) => {
                            const missing = !entry.qty_bags;
                            const td = { padding: '0.4375rem 0.5rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                            return (
                              <tr key={entry.id} style={{ backgroundColor: missing ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.row_number}</td>
                                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{entry.farmer_name}</td>
                                <td style={td}>{entry.farmer_contact || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.farm_area_ha || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {missing ? (
                                    <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>Pending</span>
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
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1300px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            {['No.','RSBSA No.','Name','Area Planted','No. of Bags','Rice Variety','Crop Estab.','Sowing Date','Data Sharing','Date Received','Auth. Rep.','Signature'].map((col, i) => (
                              <th key={i} style={{ padding: '0.5rem 0.375rem', textAlign: 'center', fontWeight: 700, color: ['No. of Bags','Rice Variety','Crop Estab.','Sowing Date','Date Received'].includes(col) ? '#854d0e' : '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((entry, idx) => {
                            const missing = !entry.qty_bags || !entry.date_received;
                            const td = { padding: '0.4375rem 0.375rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                            return (
                              <tr key={entry.id} style={{ backgroundColor: missing ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.row_number}</td>
                                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{entry.farmer_name}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.area_planted || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {entry.qty_bags || <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700 }}>Pending</span>}
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
              No entries in this batch.
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: FARMER DETAIL (Admin encodes QTY/dist data)
      ══════════════════════════════════════════ */}
      {activeTab === 'events' && view === 'farmer_detail' && selectedEntry && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Farmer info */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: GREEN.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
                {(selectedEntry.farmer_name?.charAt(0) || '').toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a1a', margin: 0 }}>{selectedEntry.farmer_name}</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>
                  {selectedEntry.farmer_rsbsa || 'No RSBSA'} · {selectedEntry.farmer_barangay}
                </p>
              </div>
            </div>
          </div>

          {/* Current beneficiaries data */}
          <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.875rem', padding: '1rem', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: GREEN.accent, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <CheckCircle size={14} /> Data from Beneficiaries
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
              {eventIsHybrid ? (
                <>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>Farm Area</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{selectedEntry.farm_area_ha || '—'} ha</p>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>Variety</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{selectedEntry.variety_name || '—'}</p>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>Current QTY</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedEntry.qty_bags ? GREEN.accent : '#854d0e', margin: 0 }}>
                      {selectedEntry.qty_bags ? `${selectedEntry.qty_bags} bags` : 'Not encoded'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>Area Planted</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{selectedEntry.area_planted || '—'} ha</p>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.125rem' }}>Current Bags</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedEntry.qty_bags ? GREEN.accent : '#854d0e', margin: 0 }}>
                      {selectedEntry.qty_bags || 'Not encoded'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Admin encode form */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem', border: '1px solid #f3f4f6' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 1rem' }}>
              Encode Distribution Data <span style={{ color: '#dc2626' }}>*</span>
            </p>

            {eventIsHybrid && (
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                  QTY (bags) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input type="number" min="1" value={adminForm.qty_bags}
                  onChange={e => { setAdminForm(p => ({ ...p, qty_bags: e.target.value })); setAdminFormErrors(p => ({ ...p, qty_bags: '' })); }}
                  placeholder="Number of seed bags received" style={inp(!!adminFormErrors.qty_bags)} />
                {adminFormErrors.qty_bags && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{adminFormErrors.qty_bags}</p>}
              </div>
            )}

            {eventIsInbred && (
              <>
                {[
                  { key: 'number_of_bags', label: 'Number of Bags (20kg/bag)', type: 'number', placeholder: 'e.g. 1' },
                  { key: 'rice_variety_received', label: 'Rice Variety Received', type: 'text', placeholder: 'e.g. RC 216' },
                  { key: 'expected_sowing_date', label: 'Expected Sowing Date (Month/Week)', type: 'text', placeholder: 'e.g. June/2nd Week' },
                  { key: 'date_received', label: 'Date Received', type: 'date', placeholder: '' },
                  { key: 'authorized_representative', label: 'Name of Authorized Representative', type: 'text', placeholder: 'Last Name, First Name, MI', required: false },
                ].map(({ key, label, type, placeholder, required = true }) => (
                  <div key={key} style={{ marginBottom: '0.875rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                      {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
                    </label>
                    {key === 'crop_establishment' ? (
                      <select value={adminForm[key]} onChange={e => { setAdminForm(p => ({ ...p, [key]: e.target.value })); setAdminFormErrors(p => ({ ...p, [key]: '' })); }} style={inp(!!adminFormErrors[key])}>
                        <option value="">Select</option>
                        <option value="DS">Direct Seeding (D)</option>
                        <option value="TP">Transplanting (T)</option>
                      </select>
                    ) : (
                      <input type={type} value={adminForm[key]} onChange={e => { setAdminForm(p => ({ ...p, [key]: e.target.value })); setAdminFormErrors(p => ({ ...p, [key]: '' })); }} placeholder={placeholder} style={inp(!!adminFormErrors[key])} />
                    )}
                    {adminFormErrors[key] && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{adminFormErrors[key]}</p>}
                  </div>
                ))}
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Crop Establishment (D/T) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select value={adminForm.crop_establishment}
                    onChange={e => { setAdminForm(p => ({ ...p, crop_establishment: e.target.value })); setAdminFormErrors(p => ({ ...p, crop_establishment: '' })); }}
                    style={inp(!!adminFormErrors.crop_establishment)}>
                    <option value="">Select</option>
                    <option value="DS">Direct Seeding (D)</option>
                    <option value="TP">Transplanting (T)</option>
                  </select>
                  {adminFormErrors.crop_establishment && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{adminFormErrors.crop_establishment}</p>}
                </div>
              </>
            )}

            {/* 2025 DS Yield placeholder */}
            <div style={{ backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '0.625rem', padding: '0.75rem 1rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.125rem' }}>
                2025 DS YIELD — Major Seed and Variety Planted
              </p>
              <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>
                Harvest data will be encoded in the Yield Encode menu after harvest.
              </p>
            </div>
          </div>

          <button onClick={handleAdminSave} disabled={adminSaving}
            style={{ width: '100%', padding: '0.9375rem', backgroundColor: adminSaving ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 800, fontSize: '1rem', cursor: adminSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: adminSaving ? 'none' : `0 4px 16px ${GREEN.primary}40`, transition: 'all 0.2s' }}>
            {adminSaving ? 'Saving...' : <><CheckCircle size={18} /> Save Distribution Data</>}
          </button>
        </div>
      )}

      {activeTab === 'pending' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {pendingByBrgy.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
              <CheckCircle size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No pending distribution batches</p>
            </div>
          ) : pendingByBrgy.map(group => (
            <div key={group.barangay} style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ fontWeight: 800, margin: 0, color: '#1a1a1a' }}>Brgy. {group.barangay}</p>
                  <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.25rem 0 0' }}>{group.batches.length} distribution batch(es) submitted for review</p>
                </div>
                <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>Distribution: Submitted</span>
              </div>
              {group.batches.map(batch => (
                <div key={batch.id} style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <p style={{ fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Batch {batch.batch_number}</p>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0' }}>{batch._event?.organization_name} · {batch.entry_count} farmers</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button onClick={() => { setActiveTab('events'); setView('report'); setSelectedEvent(batch._event); setSelectedBatch(batch); setReportBatchId(batch.id); openBatchReport(batch); }} style={{ padding: '0.5rem 0.875rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Eye size={13} /> View</button>
                      <button onClick={() => setConfirmAction({ batchId: batch.id, batchNumber: batch.batch_number, type: 'distribution' })} style={{ padding: '0.5rem 0.875rem', backgroundColor: GREEN.soft, color: GREEN.accent, border: '1px solid ' + GREEN.border, borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={13} /> Approve</button>
                      <button onClick={() => { setRejectType('distribution'); setRejectModal(batch.id); setRejectReason(''); }} style={{ padding: '0.5rem 0.875rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={13} /> Reject</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'approved' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {approvedByBrgy.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
              <CheckCircle size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No approved distribution batches yet</p>
            </div>
          ) : approvedByBrgy.map(group => (
            <div key={group.barangay} style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ fontWeight: 800, margin: 0, color: '#1a1a1a' }}>Brgy. {group.barangay}</p>
                  <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.25rem 0 0' }}>{group.batches.length} distribution-approved batch(es)</p>
                </div>
                <span style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: '1px solid ' + GREEN.border }}>Distribution: Approved</span>
              </div>
              {group.batches.map(batch => (
                <div key={batch.id} style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <p style={{ fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Batch {batch.batch_number}</p>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0' }}>{batch._event?.organization_name} · {batch.entry_count} farmers</p>
                    </div>
                    <button onClick={() => { setActiveTab('events'); setView('report'); setSelectedEvent(batch._event); setSelectedBatch(batch); setReportBatchId(batch.id); openBatchReport(batch); }} style={{ padding: '0.5rem 0.875rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Eye size={13} /> View</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── CONFIRM APPROVE ── */}
      {confirmAction && (
        <div style={{ position: 'fixed', left: '50%', bottom: '1rem', transform: 'translateX(-50%)', zIndex: 650, width: 'min(100%, 420px)', animation: 'slideUp 0.25s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 14px 40px rgba(0,0,0,0.18)', padding: '1rem', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: GREEN.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={20} color={GREEN.primary} />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>Approve Batch {confirmAction.batchNumber}?</p>
                <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.82rem' }}>This will lock the batch.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmAction(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={async () => { setConfirmAction(null); if (confirmAction.type === 'distribution') { await handleApproveDistribution(confirmAction.batchId); } else { await handleApprove(confirmAction.batchId); } }} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', backgroundColor: GREEN.primary, color: 'white', fontWeight: 700, cursor: 'pointer' }}>Confirm Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <h3 style={{ fontWeight: 700, margin: '0 0 0.5rem' }}>Reject Batch</h3>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>Tell the BRGY what needs to be fixed.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain the issue..." rows={4}
              style={{ width: '100%', padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setRejectModal(null)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || actionLoading[rejectModal] === 'reject'}
                style={{ flex: 2, padding: '0.625rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', opacity: !rejectReason.trim() ? 0.5 : 1 }}>
                {actionLoading[rejectModal] === 'reject' ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UNLOCK MODAL ── */}
      {unlockModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <h3 style={{ fontWeight: 700, margin: '0 0 0.5rem' }}>Unlock Batch</h3>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>State reason. Must re-approve after editing.</p>
            <textarea value={unlockReason} onChange={e => setUnlockReason(e.target.value)} placeholder="Reason for unlocking..." rows={3}
              style={{ width: '100%', padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setUnlockModal(null)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleUnlock} disabled={!unlockReason.trim()}
                style={{ flex: 2, padding: '0.625rem', backgroundColor: '#854d0e', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', opacity: !unlockReason.trim() ? 0.5 : 1 }}>
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDistribution;