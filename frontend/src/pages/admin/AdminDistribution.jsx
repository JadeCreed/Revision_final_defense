// src/pages/admin/AdminDistribution.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDistributionEvents,
  getDistributionStats,
  approveBatch, rejectBatch,
  approveDistributionBatch, rejectDistributionBatch,
  unlockBatch, getBatchDetail, getEventBatches,
  searchFarmers,
  getAdminDistributionPending,
  encodeDistributionEntry,
  getFinalSeeds,
} from '../../api/axios';
import {
  Search, ChevronRight, ChevronLeft, CheckCircle,
  AlertCircle, MapPin, Clock, XCircle, Unlock,
  Eye, FileText, Package, ClipboardList, Wheat,   History,
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

// Dinagdag ang kulang na helper para ma-compute ang distribution status ng batch
const getDistributionStatus = (batch) => {
  if (batch?.distribution_status) return batch.distribution_status;
  if (Array.isArray(batch?.entries) && batch.entries.length > 0) {
    return batch.entries.every(entry => Number(entry.qty_bags || 0) > 0) ? 'APPROVED' : 'PENDING';
  }
  return 'PENDING';
};

const StatusBadge = ({ status }) => {
  const cfg = {
    DRAFT:     { bg: '#f9fafb', color: '#6b7280', label: 'Draft' },
    SUBMITTED: { bg: '#fef9c3', color: '#854d0e', label: 'Submitted' },
    APPROVED:  { bg: '#dcfce7', color: '#166534', label: 'Approved' },
    REJECTED:  { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
    PENDING:   { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
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
      borderRadius: '0.875rem', fontWeight: 600,
      fontSize: '0.875rem', display: 'flex',
      alignItems: 'center', gap: '0.5rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      maxWidth: 'calc(100vw - 2rem)',
      animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
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
  { key: 'events',   label: 'All Events',      Icon: ClipboardList },
  { key: 'pending',  label: 'Pending Review',  Icon: Clock         },
  { key: 'approved', label: 'Approved Batches', Icon: CheckCircle  },
];

const AdminDistribution = () => {
  const [activeTab, setActiveTab] = useState('events');
  // VIEW: 'landing' | 'report' | 'farmer_detail'
  const [view, setView]               = useState('landing');
  const [events, setEvents]           = useState([]);

  const [currentSeason, setCurrentSeason] = useState(null);
  const [currentYear, setCurrentYear]     = useState(null);
  const [historySeason, setHistorySeason] = useState('');
  const [historyYear, setHistoryYear]     = useState('');
  const [originView, setOriginView]       = useState('landing');

  const [stats, setStats]             = useState(null);
  const [distPending, setDistPending] = useState([]);
  const [loading, setLoading]         = useState(true);

  // Search & Filter
  const [eventSearch, setEventSearch]   = useState('');
  const [filterSeason, setFilterSeason] = useState('');

  // Drill-down states
  const [pendingView, setPendingView] = useState('brgy_list');
  const [selectedPendingBrgyGroup, setSelectedPendingBrgyGroup] = useState(null);

  const [approvedView, setApprovedView] = useState('brgy_list');
  const [selectedApprovedBrgy, setSelectedApprovedBrgy] = useState(null);
  const [approvedBatches, setApprovedBatches] = useState([]);

  // Report details state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [reportBatchId, setReportBatchId]     = useState(null);
  const [reportBatchData, setReportBatchData] = useState(null);
  const [reportLoading, setReportLoading]     = useState(false);

  // Forms
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [adminForm, setAdminForm]         = useState({ qty_bags: '', number_of_bags: '', rice_variety_received: '', crop_establishment: '', expected_sowing_date: '', date_received: '', authorized_representative: '' });
  const [adminFormErrors, setAdminFormErrors] = useState({});
  const [adminSaving, setAdminSaving]     = useState(false);

  // Modals
  const [rejectModal, setRejectModal]     = useState(null);
  const [rejectReason, setRejectReason]   = useState('');
  const [unlockModal, setUnlockModal]     = useState(null);
  const [unlockReason, setUnlockReason]   = useState('');
  const [rejectType, setRejectType]       = useState('distribution');
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
      const [evRes, sRes, dpRes, fsRes] = await Promise.all([
        getDistributionEvents(),
        getDistributionStats(),
        getAdminDistributionPending(),
        getFinalSeeds(), // Kinukuha ang kasalukuyang active season poll
      ]);
      const evData = evRes.data || [];
      setEvents(evData);
      setStats(sRes.data);
      setDistPending(dpRes.data || []);

      if (fsRes.data && fsRes.data.length > 0) {
        setCurrentSeason(fsRes.data[0].season);
        setCurrentYear(fsRes.data[0].year);
      } else {
        const latestEv = evData[0];
        if (latestEv) {
          setCurrentSeason(latestEv.season);
          setCurrentYear(latestEv.year);
        }
      }
    } catch {
      showToast('error', 'Failed to load distribution data.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);


  // ─────────────────────────────────────────
  // FILTERED EVENTS (ALL EVENTS TAB)
  // ─────────────────────────────────────────
  const activeEvents = events.filter(ev => 
    ev.season === currentSeason && String(ev.year) === String(currentYear)
  );

  const filteredEvents = activeEvents.filter(ev => {
    const q = eventSearch.toLowerCase();
    const matchSearch = !q ||
      ev.organization_name?.toLowerCase().includes(q) ||
      ev.barangay?.toLowerCase().includes(q) ||
      ev.seed_type_name?.toLowerCase().includes(q);
    const matchSeason = !filterSeason || ev.season === filterSeason;
    return matchSearch && matchSeason;
  });

  const yearsList = Array.from(new Set(events.map(ev => ev.year))).sort((a, b) => b - a);

  const filteredHistoryEvents = events.filter(ev => {
    const q = eventSearch.toLowerCase();
    const matchSearch = !q ||
      ev.organization_name?.toLowerCase().includes(q) ||
      ev.barangay?.toLowerCase().includes(q) ||
      ev.seed_type_name?.toLowerCase().includes(q);
    const matchSeason = !historySeason || ev.season === historySeason;
    const matchYear = !historyYear || String(ev.year) === String(historyYear);
    return matchSearch && matchSeason && matchYear;
  });

  // ─────────────────────────────────────────
  // PENDING DISTRIBUTION BATCHES GROUPING
  // ─────────────────────────────────────────
  const pendingDistributionBatches = distPending.filter(batch => batch.distribution_status === 'SUBMITTED');

  const pendingByBrgy = (() => {
    const groups = {};
    pendingDistributionBatches.forEach(batch => {
      const ev = events.find(e => e.id === batch.event || e.id === batch.event_id);
      if (!ev) return;
      const key = ev.barangay;
      if (!groups[key]) {
        groups[key] = {
          barangay: ev.barangay,
          batches: [],
          events: [],
          firstEvent: ev,
        };
      }
      groups[key].batches.push({ ...batch, _event: ev });
      if (!groups[key].events.find(e => e.id === ev.id)) {
        groups[key].events.push(ev);
      }
    });
    return Object.values(groups);
  })();

  // ─────────────────────────────────────────
  // APPROVED DISTRIBUTION BATCHES GROUPING
  // ─────────────────────────────────────────
  const approvedDistributionBatches = distPending.filter(batch => batch.distribution_status === 'APPROVED');

  const approvedByBrgy = (() => {
    const groups = {};
    approvedDistributionBatches.forEach(batch => {
      const ev = events.find(e => e.id === batch.event || e.id === batch.event_id);
      if (!ev) return;
      const key = ev.barangay;
      if (!groups[key]) {
        groups[key] = {
          barangay: ev.barangay,
          events: [],
          totalApproved: 0,
        };
      }
      if (!groups[key].events.find(e => e.id === ev.id)) {
        groups[key].events.push(ev);
      }
      groups[key].totalApproved += batch.entry_count || 0;
    });
    return Object.values(groups);
  })();

  // ─────────────────────────────────────────
  // OPEN APPROVED BRGY DRILL-DOWN
  // ─────────────────────────────────────────
  const openApprovedBrgy = async (brgy) => {
    setSelectedApprovedBrgy(brgy);
    setApprovedView('batch_list');
    const brgyEvents = events.filter(ev => ev.barangay === brgy);
    if (brgyEvents.length === 0) {
      setApprovedBatches([]);
      return;
    }
    try {
      const loadedEvents = await Promise.all(brgyEvents.map(async (ev) => {
        const bRes = await getEventBatches(ev.id);
        const distApproved = (bRes.data || []).filter(b => b.distribution_status === 'APPROVED');
        return { ...ev, batches: distApproved };
      }));
      setApprovedBatches(loadedEvents.filter(ev => ev.batches.length > 0));
    } catch {
      setApprovedBatches([]);
    }
  };

  // ─────────────────────────────────────────
  // OPEN BATCH REPORT
  // ─────────────────────────────────────────
  const openBatchReport = async (event, batch) => {
    setOriginView(view);
    setSelectedEvent(event);
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
  // APPROVE / REJECT / UNLOCK LOGIC
  // ─────────────────────────────────────────
  const handleApproveDistribution = async (batchId) => {
    setActionLoading(p => ({ ...p, [batchId]: 'approve' }));
    try {
      await approveDistributionBatch(batchId);
      showToast('success', 'Distribution batch approved.');
      fetchAll();
      if (view === 'report' && reportBatchId === batchId) {
        const res = await getBatchDetail(batchId);
        setReportBatchData(res.data);
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to approve.');
    } finally {
      setActionLoading(p => ({ ...p, [batchId]: null }));
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(p => ({ ...p, [rejectModal]: 'reject' }));
    try {
      await rejectDistributionBatch(rejectModal, { reason: rejectReason });
      setRejectModal(null);
      setRejectReason('');
      showToast('success', 'Distribution batch rejected.');
      fetchAll();
      if (view === 'report' && reportBatchId === rejectModal) {
        setView('landing');
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to reject.');
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
      if (view === 'report' && reportBatchId === unlockModal) {
        const res = await getBatchDetail(unlockModal);
        setReportBatchData(res.data);
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to unlock.');
    } finally {
      setActionLoading(p => ({ ...p, [unlockModal]: null }));
    }
  };

  // ─────────────────────────────────────────
  // REPORT VIEW LOGIC
  // ─────────────────────────────────────────
  const entriesByVariety = (() => {
    if (!reportBatchData?.entries) return [];
    if (isInbred(selectedEvent?.seed_type_name || '')) {
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

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Seed Distribution</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          View and manage seed distribution across all barangays.
        </p>
      </div>

      {/* ── STATS ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Events',     value: events.length,                        Icon: ClipboardList },
            { label: 'Pending Batches',  value: pendingDistributionBatches.length,   Icon: Clock        },
            { label: 'Approved',         value: approvedDistributionBatches.length,  Icon: CheckCircle  },
          ].map(({ label, value, Icon }) => (
            <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.125rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
              <Icon size={18} color={GREEN.primary} />
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: GREEN.primary, margin: '0.375rem 0 0.125rem', lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.25rem', border: '1px solid #e5e7eb' }}>
        {TABS.map(({ key, label, Icon }) => (
          <button key={key}
            onClick={() => {
              setActiveTab(key);
              setView('landing');
              if (key === 'pending') { setPendingView('brgy_list'); setSelectedPendingBrgyGroup(null); }
              if (key === 'approved') { setApprovedView('brgy_list'); setSelectedApprovedBrgy(null); }
            }}
            style={{
              flex: 1, padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: 'none',
              backgroundColor: activeTab === key ? 'white' : 'transparent',
              color: activeTab === key ? '#1a1a1a' : '#6b7280',
              fontWeight: activeTab === key ? 700 : 400,
              cursor: 'pointer', fontSize: '0.8rem',
              boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              transition: 'all 0.15s',
            }}>
            <Icon size={14} />
            {label}
            {key === 'pending' && pendingDistributionBatches.length > 0 && (
              <span style={{
                backgroundColor: '#dc2626', color: 'white',
                borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700,
                padding: '0px 6px', minWidth: 18, height: 16,
                display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', lineHeight: 1,
              }}>
                {pendingDistributionBatches.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── DRILL DOWN BREADCRUMB ── */}
      {view !== 'landing' && view !== 'history' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1.25rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
          <button onClick={() => { setView(originView); }}

            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <ChevronLeft size={14} /> Distribution
          </button>
          <ChevronRight size={12} color="#9ca3af" />
          <span style={{ color: '#374151', fontWeight: 700 }}>
            {selectedEvent?.organization_name || 'Event Detail'}
          </span>
          <ChevronRight size={12} color="#9ca3af" />
          <span style={{ color: '#374151', fontWeight: 700 }}>
            Batch {selectedBatch?.batch_number}
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 1: ALL EVENTS (aligned with Beneficiaries)
      ══════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════
          TAB 1: ALL EVENTS (aligned with Beneficiaries)
      ══════════════════════════════════════════ */}
      {activeTab === 'events' && (view === 'landing' || view === 'history') && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {view === 'history' ? (
            /* ── PORTAL HISTORY VIEW — ALIGNED WITH AT MONITOR DESIGN ── */
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <button onClick={() => { setView('landing'); setEventSearch(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <ChevronLeft size={14} /> Back to Active Season
                </button>
              </div>

              <div style={{ backgroundColor: GREEN.primary, borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem', color: 'white' }}>
                <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Distribution History</h2>
                <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '0.25rem 0 0' }}>
                  View and filter all historical seed distribution programs.
                </p>
              </div>

              {/* Filters Panel */}
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#374151', margin: '0 0 0.875rem' }}>Filter Records</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Season</label>
                    <select value={historySeason} onChange={e => setHistorySeason(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', width: '100%', fontSize: '0.8rem', outline: 'none' }}>
                      <option value="">All seasons</option>
                      <option value="DRY">Dry Season</option>
                      <option value="WET">Wet Season</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Year</label>
                    <select value={historyYear} onChange={e => setHistoryYear(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', width: '100%', fontSize: '0.8rem', outline: 'none' }}>
                      <option value="">All years</option>
                      {yearsList.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Search</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)' }} />
                      <input value={eventSearch} onChange={e => setEventSearch(e.target.value)} placeholder="Search program..." style={{ padding: '0.45rem 0.5rem 0.45rem 1.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', width: '100%', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Historical List - Tabular Design matching AT */}
              {filteredHistoryEvents.length === 0 ? (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
                  <ClipboardList size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
                  <p style={{ fontWeight: 700, color: '#6b7280', margin: 0, fontSize: '0.85rem' }}>No historical records match these filters.</p>
                </div>
              ) : (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Barangay</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Program / Organization</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#374151' }}>Seed Type</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: '#374151' }}>Farmers Distributed</th>
                        
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistoryEvents.map((event, idx) => {
                        const evH = isHybrid(event.seed_type_name || '');
                        const tagColor = evH ? '#1e40af' : GREEN.primary;
                        const tagBg    = evH ? '#eff6ff' : GREEN.light;
                        const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                        return (
                          <tr key={event.id} className="row-hover" style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{event.barangay}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <p style={{ margin: 0, fontWeight: 600 }}>{event.organization_name}</p>
                              <p style={{ margin: '0.125rem 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>{event.season_display} {event.year}</p>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                                {event.seed_type_name}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700 }}>
                              {event.total_distribution_encoded || 0} / {event.total_approved || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* ── PORTAL ACTIVE SEASON VIEW — DEFAULT ── */
            <>
              {/* Search + filter */}
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={eventSearch} onChange={e => setEventSearch(e.target.value)} placeholder="Search by barangay, organization, or program..." style={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['WET', 'DRY'].map(s => (
                  <button key={s} onClick={() => setFilterSeason(filterSeason === s ? '' : s)}
                    style={{ padding: '0.375rem 0.875rem', border: `1.5px solid ${filterSeason === s ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: filterSeason === s ? GREEN.light : 'white', color: filterSeason === s ? GREEN.primary : '#6b7280', fontWeight: filterSeason === s ? 700 : 400, fontSize: '0.78rem', cursor: 'pointer' }}>
                    {s === 'WET' ? ' Wet season' : 'Dry season'}
                  </button>
                ))}
                {(filterSeason || eventSearch) && (
                  <button onClick={() => { setFilterSeason(''); setEventSearch(''); }}
                    style={{ padding: '0.375rem 0.625rem', border: '1.5px solid #fca5a5', borderRadius: '999px', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <XCircle size={11} /> Clear
                  </button>
                )}
              </div>
              <button onClick={() => { setView('history'); setEventSearch(''); }}
                style={{ padding: '0.375rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '999px', backgroundColor: 'white', color: '#374151', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s' }} className="card-hover">
                <History size={13} /> View History
              </button>
            </div>
          </div>



          {filteredEvents.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
              <ClipboardList size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No results found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredEvents.map((event, idx) => {
                const evH = isHybrid(event.seed_type_name || event.intervention || '');
                const tagColor = evH ? '#1e40af' : GREEN.primary;
                const tagBg    = evH ? '#eff6ff' : GREEN.light;
                const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                return (
                  <div key={event.id} style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${tagBorder}`, animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                          <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                            {event.seed_type_name || (evH ? 'Hybrid' : 'Inbred')}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{event.season_display} {event.year}</span>
                        </div>
                        <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a1a', margin: 0 }}>{event.organization_name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                          <MapPin size={13} color="#9ca3af" />
                          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{event.barangay}</span>
                          {event.variety_name && (
                            <>
                              <Wheat size={13} color="#9ca3af" />
                              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{event.variety_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: tagColor, margin: 0, lineHeight: 1 }}>
                          {event.total_distribution_encoded || 0}<span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#9ca3af' }}>/{event.total_approved || 0}</span>
                        </p>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>farmers distributed</p>
                      </div>
                    </div>

                    <div style={{ marginBottom: '0.625rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                          Approved: {event.total_approved} · Distributed: {event.total_distribution_encoded || 0}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: GREEN.primary }}>
                          {event.total_approved > 0 ? Math.round(((event.total_distribution_encoded || 0) / event.total_approved) * 100) : 0}%
                        </span>
                      </div>
                      <ProgressBar value={event.total_distribution_encoded || 0} max={event.total_approved} color={tagColor} />
                    </div>

                   {/* Batch pills */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {event.batches?.filter(b => b.status === 'APPROVED').map(batch => (
                        <button key={batch.id} onClick={() => openBatchReport(event, batch)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.75rem', borderRadius: '999px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#374151', transition: 'all 0.15s' }}>
                          Batch {batch.batch_number} <StatusBadge status={getDistributionStatus(batch)} /> <ChevronRight size={12} color="#9ca3af" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  )}

      {/* ══════════════════════════════════════════
          TAB 2: PENDING REVIEW (aligned with Beneficiaries)
      ══════════════════════════════════════════ */}
      {activeTab === 'pending' && view === 'landing' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {pendingView === 'batch_list' && selectedPendingBrgyGroup && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <button onClick={() => { setPendingView('brgy_list'); setSelectedPendingBrgyGroup(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <ChevronLeft size={14} /> Pending Review
              </button>
              <ChevronRight size={12} color="#9ca3af" />
              <span style={{ color: '#374151', fontWeight: 700 }}>
                {selectedPendingBrgyGroup.barangay}
              </span>
            </div>
          )}

          {pendingView === 'brgy_list' && (
            <>
              {pendingByBrgy.length === 0 ? (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
                  <CheckCircle size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No pending distribution batches</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {pendingByBrgy.map((group, idx) => (
                    <div key={group.barangay} className="card-hover"
                      onClick={() => { setSelectedPendingBrgyGroup(group); setPendingView('batch_list'); }}
                      style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: `1px solid ${GREEN.border}`, animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                            <MapPin size={14} color={GREEN.primary} />
                            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1a1a', margin: 0 }}>Brgy. {group.barangay}</h3>
                          </div>
                          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
                            {group.batches.length} distribution batch{group.batches.length !== 1 ? 'es' : ''} submitted
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                          <span style={{
                            backgroundColor: '#fef9c3', color: '#854d0e',
                            border: '1px solid #fde68a', borderRadius: '999px',
                            fontSize: '0.72rem', fontWeight: 700,
                            padding: '0.25rem 0.75rem', whiteSpace: 'nowrap',
                          }}>
                            {group.batches.length} pending
                          </span>
                          <ChevronRight size={20} color="#9ca3af" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {pendingView === 'batch_list' && selectedPendingBrgyGroup && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              <div style={{ backgroundColor: GREEN.primary, borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem', color: 'white' }}>
                <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Brgy. {selectedPendingBrgyGroup.barangay}</h2>
                <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '0.25rem 0 0' }}>
                  Seed Distribution batches awaiting your review.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedPendingBrgyGroup.batches.map((batch, idx) => {
                  const ev = batch._event || {};
                  const evH = isHybrid(ev.seed_type_name || ev.intervention || '');
                  const tagColor = evH ? '#1e40af' : GREEN.primary;
                  const tagBg = evH ? '#eff6ff' : GREEN.light;
                  const tagBorder = evH ? '#bfdbfe' : GREEN.border;

                  return (
                    <div key={batch.id} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${tagBorder}`, animation: `slideUp ${0.25 + idx * 0.05}s ease` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem' }}>
                            <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                              {ev.seed_type_name || (evH ? 'Hybrid' : 'Inbred')}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{ev.organization_name}</span>
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a' }}>Batch {batch.batch_number}</span>
                          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                            {batch.entry_count} farmers · Encoded by {batch.encoded_by_name}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                        <button onClick={() => openBatchReport(ev, batch)}
                          style={{ padding: '0.5rem 1rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Eye size={14} /> View Details
                        </button>
                        <button
                          onClick={() => setConfirmAction({ batchId: batch.id, batchNumber: batch.batch_number, type: 'distribution' })}
                          disabled={actionLoading[batch.id] === 'approve'}
                          style={{ padding: '0.5rem 1rem', backgroundColor: GREEN.soft, color: GREEN.accent, border: `1px solid ${GREEN.border}`, borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button onClick={() => { setRejectType('distribution'); setRejectModal(batch.id); setRejectReason(''); }}
                          style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 3: APPROVED BATCHES (aligned with Beneficiaries)
      ══════════════════════════════════════════ */}
      {activeTab === 'approved' && view === 'landing' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {approvedView === 'batch_list' && selectedApprovedBrgy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <button onClick={() => { setApprovedView('brgy_list'); setSelectedApprovedBrgy(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <ChevronLeft size={14} /> Approved Batches
              </button>
              <ChevronRight size={12} color="#9ca3af" />
              <span style={{ color: '#374151', fontWeight: 700 }}>Brgy. {selectedApprovedBrgy}</span>
            </div>
          )}

          {approvedView === 'brgy_list' && (
            <>
              {approvedByBrgy.length === 0 ? (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
                  <CheckCircle size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No approved distribution batches yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {approvedByBrgy.map((brgyData, idx) => (
                    <div key={brgyData.barangay} className="card-hover"
                      onClick={() => openApprovedBrgy(brgyData.barangay)}
                      style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: `1px solid ${GREEN.border}`, animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                            <MapPin size={14} color={GREEN.primary} />
                            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1a1a', margin: 0 }}>Brgy. {brgyData.barangay}</h3>
                          </div>
                          <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>
                            {brgyData.events.length} program{brgyData.events.length !== 1 ? 's' : ''} · {brgyData.totalApproved} farmers approved
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${GREEN.border}` }}>
                            {brgyData.totalApproved} distributed
                          </span>
                          <ChevronRight size={18} color="#9ca3af" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {approvedView === 'batch_list' && selectedApprovedBrgy && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {approvedBatches.map((event, idx) => {
                const tagColor = isHybrid(event.seed_type_name || '') ? '#1e40af' : GREEN.primary;
                const tagBg    = isHybrid(event.seed_type_name || '') ? '#eff6ff' : GREEN.light;
                const tagBorder = isHybrid(event.seed_type_name || '') ? '#bfdbfe' : GREEN.border;

                return (
                  <div key={event.id} style={{ marginBottom: '1.5rem', animation: `slideUp ${0.3 + idx * 0.06}s ease` }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1.25rem', marginBottom: '0.75rem', border: `1px solid ${tagBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                          {event.seed_type_name}
                        </span>
                        <p style={{ fontWeight: 700, margin: '0.375rem 0 0', fontSize: '0.9rem', color: '#1a1a1a' }}>{event.organization_name}</p>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>{event.season_display} {event.year}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.75rem' }}>
                      {event.batches?.map(batch => (
                        <div key={batch.id} style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem', border: `1px solid ${GREEN.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <CheckCircle size={14} color={GREEN.accent} />
                              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a' }}>Batch {batch.batch_number}</span>
                              <StatusBadge status={getDistributionStatus(batch)} />
                            </div>
                            <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.25rem 0 0' }}>
                              {batch.entry_count} farmers · Approved distribution
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => openBatchReport(event, batch)}
                              style={{ padding: '0.375rem 0.875rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Eye size={13} /> View
                            </button>
                            <button onClick={() => { setUnlockModal(batch.id); setUnlockReason(''); }}
                              style={{ padding: '0.375rem 0.875rem', backgroundColor: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Unlock size={13} /> Unlock
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: REPORT (Distribution Masterlist)
      ══════════════════════════════════════════ */}
      {view === 'report' && reportBatchData && selectedEvent && (
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
              <span><strong>Program:</strong> {isHybrid(selectedEvent.seed_type_name || '') ? 'Hybrid (Region)' : 'Inbred (PhilRice)'}</span>
              <span><strong>Season:</strong> {`${selectedEvent.season_display} ${selectedEvent.year}`}</span>
              <span><strong>Barangay:</strong> {selectedEvent.barangay}</span>
              <span><strong>Batch:</strong> {selectedBatch?.batch_number}</span>
            </div>
          </div>

          {/* Action Header inside Report */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <StatusBadge status={getDistributionStatus(reportBatchData)} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Batch {reportBatchData.batch_number}</span>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{reportBatchData.entry_count} farmers</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {reportBatchData.distribution_status === 'SUBMITTED' && (
                <>
                  <button onClick={() => setConfirmAction({ batchId: reportBatchData.id, batchNumber: reportBatchData.batch_number, type: 'distribution' })}
                    style={{ padding: '0.375rem 0.875rem', backgroundColor: GREEN.soft, color: GREEN.accent, border: `1px solid ${GREEN.border}`, borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle size={13} /> Approve Distribution
                  </button>
                  <button onClick={() => { setRejectType('distribution'); setRejectModal(reportBatchData.id); setRejectReason(''); }}
                    style={{ padding: '0.375rem 0.875rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <XCircle size={13} /> Reject Distribution
                  </button>
                </>
              )}
              {reportBatchData.distribution_status === 'APPROVED' && (
                <button onClick={() => { setUnlockModal(reportBatchData.id); setUnlockReason(''); }}
                  style={{ padding: '0.375rem 0.875rem', backgroundColor: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Unlock size={13} /> Unlock Distribution
                </button>
              )}
            </div>
          </div>

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
                    {isHybrid(selectedEvent.seed_type_name || '') && group.name && (
                      <span style={{ fontWeight: 800, fontSize: '0.875rem', color: GREEN.primary }}>Variety: {group.name}</span>
                    )}
                    <span style={{ backgroundColor: 'white', color: '#6b7280', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, border: '1px solid #e5e7eb' }}>
                      {group.entries.length} farmer{group.entries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    {isHybrid(selectedEvent.seed_type_name || '') ? (
                      /* Hybrid Table View */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1100px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            {['No.','RSBSA No.','Name','Contact','Farm Area (ha)','QTY (bags)','Variety','Signature'].map((col, i) => (
                              <th key={i} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: col === 'QTY (bags)' ? '#854d0e' : '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((entry, idx) => {
                            const td = { padding: '0.4375rem 0.5rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                            return (
                              <tr key={entry.id} style={{ backgroundColor: !entry.qty_bags ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.row_number}</td>
                                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{entry.farmer_name}</td>
                                <td style={td}>{entry.farmer_contact || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.farm_area_ha || '—'}</td>
                                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{entry.qty_bags ?? '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.variety_name || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {entry.has_signature ? (
                                    <button onClick={() => setViewSig(entry.signature)}
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
                      /* Inbred Table View */
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', minWidth: '1100px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            {['No.','RSBSA No.','Name','Area Planted','No. of Bags','Rice Variety','Crop Estab.','Sowing Date','Date Received','Auth. Rep.','Data Sharing','Signature'].map((col, i) => (
                              <th key={i} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: ['No. of Bags','Rice Variety','Crop Estab.','Sowing Date','Date Received'].includes(col) ? '#854d0e' : '#374151', whiteSpace: 'nowrap', fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: '2px solid #d1d5db', borderRight: '1px solid #e5e7eb' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((entry, idx) => {
                            const td = { padding: '0.4375rem 0.5rem', color: '#374151', whiteSpace: 'nowrap', fontSize: '0.68rem', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb' };
                            return (
                              <tr key={entry.id} style={{ backgroundColor: !entry.qty_bags ? '#fffbeb' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.row_number}</td>
                                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.63rem' }}>{entry.farmer_rsbsa || '—'}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{entry.farmer_name}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.area_planted || '—'}</td>
                                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{entry.qty_bags ?? '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.variety_name || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.crop_establishment || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.expected_sowing_date || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.date_received ? new Date(entry.date_received + 'T00:00:00').toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '—'}</td>
                                <td style={td}>{entry.authorized_representative || '—'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>{entry.data_sharing ? '✓' : '✗'}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  {entry.has_signature ? (
                                    <button onClick={() => setViewSig(entry.signature)}
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
          ) : null}
        </div>
      )}

      {/* ── CONFIRM APPROVE MODAL ── */}
      {confirmAction && (
        <div style={{ position: 'fixed', left: '50%', bottom: '1rem', transform: 'translateX(-50%)', zIndex: 650, width: 'min(100%, 420px)', animation: 'slideUp 0.25s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 14px 40px rgba(0,0,0,0.18)', padding: '1rem', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: GREEN.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={20} color={GREEN.primary} />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>Approve Batch {confirmAction.batchNumber}?</p>
                <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.82rem' }}>This will approve the seed distribution record.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmAction(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={async () => { setConfirmAction(null); await handleApproveDistribution(confirmAction.batchId); }} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', backgroundColor: GREEN.primary, color: 'white', fontWeight: 700, cursor: 'pointer' }}>Confirm Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <h3 style={{ fontWeight: 700, margin: '0 0 0.5rem' }}>Reject Batch Distribution</h3>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>Tell the BRGY what needs to be fixed.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain the issue clearly..." rows={4}
              style={{ width: '100%', padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setRejectModal(null)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim()}
                style={{ flex: 2, padding: '0.625rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', opacity: !rejectReason.trim() ? 0.5 : 1 }}>
                Reject Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UNLOCK MODAL ── */}
      {unlockModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <h3 style={{ fontWeight: 700, margin: '0 0 0.5rem' }}>Unlock Batch Distribution</h3>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>State reason. Must re-approve after editing.</p>
            <textarea value={unlockReason} onChange={e => setUnlockReason(e.target.value)} placeholder="Reason for unlocking..." rows={3}
              style={{ width: '100%', padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setUnlockModal(null)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleUnlock} disabled={!unlockReason.trim()}
                style={{ flex: 2, padding: '0.625rem', backgroundColor: '#854d0e', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', opacity: !unlockReason.trim() ? 0.5 : 1 }}>
                Unlock Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDistribution;