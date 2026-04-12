// src/pages/admin/Distribution.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Clock, CheckCircle, XCircle,
  ChevronRight, ChevronLeft, Users, Wheat, MapPin,
  Unlock, Eye, Search, Filter, AlertCircle, Send,
} from 'lucide-react';
import {
  getDistributionEvents,
  getAdminPendingBatches,
  getDistributionStats,
  approveBatch,
  rejectBatch,
  unlockBatch,
  getBatchDetail,
} from '../../api/axios';

// ── CSS animations injected once ──
const STYLES = `
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes spin    { to { transform: rotate(360deg); } }
  .brgy-card:hover  { box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; }
  .batch-row:hover  { background-color: #f9fafb !important; }
`;

// ── STATUS BADGE ──
const BatchStatusBadge = ({ status }) => {
  const config = {
    DRAFT:     { bg: '#f3f4f6', color: '#6b7280', label: 'Draft'     },
    SUBMITTED: { bg: '#dbeafe', color: '#1e40af', label: 'Submitted' },
    APPROVED:  { bg: '#dcfce7', color: '#166534', label: 'Approved'  },
    REJECTED:  { bg: '#fee2e2', color: '#991b1b', label: 'Rejected'  },
  }[status] || { bg: '#f3f4f6', color: '#6b7280', label: status };
  return (
    <span style={{ backgroundColor: config.bg, color: config.color, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
      {config.label}
    </span>
  );
};

// ── PROGRESS BAR ──
const ProgressBar = ({ value, max, color = '#2d6a2d' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
    </div>
  );
};

// ── TOAST ──
const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 600,
      backgroundColor: toast.type === 'error' ? '#991b1b' : '#166534',
      color: 'white', padding: '0.75rem 1.5rem', borderRadius: '999px',
      fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease',
      maxWidth: 'calc(100vw - 2rem)',
    }}>
      {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {toast.message}
    </div>
  );
};

const TABS = [
  { key: 'events',  label: 'All Events',     Icon: ClipboardList },
  { key: 'pending', label: 'Pending Review', Icon: Clock         },
];

const AdminBeneficiaries = () => {
  const [activeTab, setActiveTab] = useState('events');
  const [events,    setEvents]    = useState([]);
  const [pending,   setPending]   = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  // ── Toast ──
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Events tab: search + filter ──
  const [eventSearch,     setEventSearch]     = useState('');
  const [filterSeedType,  setFilterSeedType]  = useState('');
  const [filterSeason,    setFilterSeason]    = useState('');

  // ── Pending tab state ──
  // 'brgy_list'   = show grouped BRGY containers
  // 'batch_list'  = show batches for a selected BRGY/event
  const [pendingView,     setPendingView]     = useState('brgy_list');
  const [selectedEvent,   setSelectedEvent]   = useState(null); // event obj for pending drill-down

  // ── Batch detail modal ──
  const [selectedBatch,     setSelectedBatch]     = useState(null);
  const [batchDetail,       setBatchDetail]       = useState(null);
  const [batchDetailLoading, setBatchLoading]     = useState(false);

  // ── Reject modal ──
  const [rejectModal,  setRejectModal]  = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // ── Confirm action snackbar ──
  const [confirmAction, setConfirmAction] = useState(null);

  // ── Unlock modal ──
  const [unlockModal,  setUnlockModal]  = useState(null);
  const [unlockReason, setUnlockReason] = useState('');

  // ─────────────────────────
  // FETCH
  // ─────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [evRes, pRes, sRes] = await Promise.all([
        getDistributionEvents(),
        getAdminPendingBatches(),
        getDistributionStats(),
      ]);
      setEvents(evRes.data || []);
      setPending(pRes.data || []);
      setStats(sRes.data);
    } catch {
      setError('Failed to load distribution data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─────────────────────────
  // COMPUTED
  // ─────────────────────────

  // Group pending batches by event (for BRGY-level view)
  // pending items have event info via the batch → event relationship
  // We need to group them: { eventId: { event info, batches: [] } }
  // NOTE: DistributionBatchListSerializer doesn't include event details directly.
  // We need to match pending batches to events using the events list.
  const pendingGrouped = (() => {
    const groups = {};
    pending.forEach(batch => {
      // Find the event this batch belongs to from our events list
      // batch doesn't have event id directly in list serializer,
      // so we match by encoded_by_name + submitted_at being in events
      // Actually we need event_id — let's add it to the pending view by matching
      // We'll group by encoded_by_name as a proxy, or better: use events list to cross-match
      // The best approach: group all pending by event_id if we have it,
      // otherwise group by encoded_by_name
      const key = batch.event_id || batch.encoded_by_name || 'unknown';
      if (!groups[key]) {
        groups[key] = {
          key,
          event: events.find(ev =>
            ev.batches?.some(b => b.id === batch.id)
          ) || null,
          batches: [],
        };
      }
      groups[key].batches.push(batch);
    });
    return Object.values(groups);
  })();

  // Better grouping: match batches to events using events.batches
  const pendingByBrgy = (() => {
    const groups = {};
    pending.forEach(batch => {
      const event = events.find(ev => ev.id === batch.event || ev.id === batch.event_id);
      if (!event) return;
      const key = event.barangay || `brgy-${event.id}`;
      if (!groups[key]) {
        groups[key] = {
          barangay: event.barangay,
          organization_name: event.organization_name,
          intervention: event.intervention,
          season_display: event.season_display,
          year: event.year,
          variety_name: event.variety_name,
          batches: [],
          firstEvent: event,
        };
      }
      groups[key].batches.push(batch);
    });
    return Object.values(groups);
  })();

  // All events filtered
  const filteredEvents = events.filter(ev => {
    const q = eventSearch.toLowerCase();
    const matchSearch = !q ||
      ev.organization_name?.toLowerCase().includes(q) ||
      ev.barangay?.toLowerCase().includes(q) ||
      ev.intervention?.toLowerCase().includes(q);
    const matchSeedType = !filterSeedType || ev.seed_type?.toString() === filterSeedType;
    const matchSeason   = !filterSeason   || ev.season === filterSeason;
    return matchSearch && matchSeedType && matchSeason;
  });

  // BRGY completion summary
  // Count unique barangays and how many have fully encoded their members
  const brgyCompletion = (() => {
    const byBrgy = {};
    events.forEach(ev => {
      if (!byBrgy[ev.barangay]) {
        byBrgy[ev.barangay] = { total: 0, encoded: 0, approved: 0 };
      }
      byBrgy[ev.barangay].total   += ev.total_members;
      byBrgy[ev.barangay].encoded += ev.total_encoded;
      byBrgy[ev.barangay].approved += ev.total_approved;
    });
    const brgyList = Object.entries(byBrgy).map(([barangay, data]) => ({
      barangay, ...data,
      completed: data.encoded >= data.total && data.total > 0,
    }));
    const completed = brgyList.filter(b => b.completed).length;
    return { brgyList, completed, total: brgyList.length };
  })();

  const selectedPendingCount = selectedEvent
    ? pending.filter(batch => batch.event === selectedEvent.id).length
    : 0;

  // ─────────────────────────
  // ACTIONS
  // ─────────────────────────

  const openBatchDetail = async (batchId) => {
    setSelectedBatch(batchId);
    setBatchLoading(true);
    try {
      const res = await getBatchDetail(batchId);
      setBatchDetail(res.data);
    } catch {
      setBatchDetail(null);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleApprove = async (batchId) => {
    setActionLoading(prev => ({ ...prev, [batchId]: 'approve' }));
    try {
      await approveBatch(batchId);
      showToast('success', 'Batch approved and locked.');
      fetchAll();
      if (selectedBatch === batchId) {
        openBatchDetail(batchId);
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to approve.');
    } finally {
      setActionLoading(prev => ({ ...prev, [batchId]: null }));
    }
  };

  const requestActionConfirm = (type, batch) => {
    const message = type === 'approve'
      ? `Confirm approval of batch ${batch.batch_number}?`
      : `Confirm rejection of batch ${batch.batch_number}?`;
    const details = type === 'approve'
      ? 'This will lock the submitted batch and send approval to BRGY.'
      : 'This will send the batch back to BRGY for correction with a rejection note.';
    setConfirmAction({ type, batch, message, details });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, batch } = confirmAction;
    setConfirmAction(null);
    if (type === 'approve') {
      await handleApprove(batch.id);
    } else if (type === 'reject') {
      setRejectModal(batch.id);
      setRejectReason('');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(prev => ({ ...prev, [rejectModal]: 'reject' }));
    try {
      await rejectBatch(rejectModal, { reason: rejectReason });
      setRejectModal(null);
      setRejectReason('');
      showToast('success', 'Batch rejected. BRGY has been notified.');
      fetchAll();
      if (selectedEvent) {
        // stay in batch list but refresh
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to reject.');
    } finally {
      setActionLoading(prev => ({ ...prev, [rejectModal]: null }));
    }
  };

  const handleUnlock = async () => {
    if (!unlockReason.trim()) return;
    setActionLoading(prev => ({ ...prev, [unlockModal]: 'unlock' }));
    try {
      await unlockBatch(unlockModal, { reason: unlockReason });
      setUnlockModal(null);
      setUnlockReason('');
      showToast('success', 'Batch unlocked. Edit and re-approve when done.');
      fetchAll();
      if (selectedBatch) openBatchDetail(selectedBatch);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to unlock.');
    } finally {
      setActionLoading(prev => ({ ...prev, [unlockModal]: null }));
    }
  };

  // ─────────────────────────
  // LOADING
  // ─────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
        <style>{STYLES}</style>
        <div style={{ width: '36px', height: '36px', border: '3px solid #e5e7eb', borderTopColor: '#2d6a2d', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 0.7s linear infinite' }} />
        Loading distribution data...
      </div>
    );
  }

  // ─────────────────────────
  // RENDER
  // ─────────────────────────

  return (
    <div>
      <style>{STYLES}</style>
      <Toast toast={toast} />
      {confirmAction && (
        <div style={{ position: 'fixed', left: '50%', bottom: '1rem', transform: 'translateX(-50%)', zIndex: 650, width: 'min(100%, 440px)', animation: 'slideUp 0.25s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 14px 40px rgba(0,0,0,0.18)', padding: '1rem', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={20} color="#1e40af" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: '#111827' }}>{confirmAction.message}</p>
                <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.82rem', lineHeight: 1.5 }}>{confirmAction.details}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', backgroundColor: '#1e40af', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          Seed Distribution
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          Manage beneficiary programs, review submitted batches, and track barangay progress.
        </p>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* ── STATS CARDS ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Events',     value: stats.total_events,         Icon: ClipboardList, color: '#2d6a2d' },
            { label: 'Pending Review',   value: stats.pending_batches,      Icon: Clock,         color: '#1e40af' },
            { label: 'Approved Batches', value: stats.approved_batches,     Icon: CheckCircle,   color: '#166534' },
            { label: 'Farmers Served',   value: stats.total_farmers_served, Icon: Users,         color: '#854d0e' },
          ].map(({ label, value, Icon: I, color }) => (
            <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.125rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: 'slideUp 0.3s ease' }}>
              <I size={20} color={color} />
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: '0.5rem 0 0.125rem' }}>{value}</p>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── BRGY COMPLETION SUMMARY ── */}
      {brgyCompletion.total > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem', animation: 'slideUp 0.35s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a', margin: 0 }}>
                Barangay Progress
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
                {brgyCompletion.completed} of {brgyCompletion.total} barangays completed all registrations
              </p>
            </div>
            <span style={{
              backgroundColor: brgyCompletion.completed === brgyCompletion.total ? '#dcfce7' : '#fef9c3',
              color:           brgyCompletion.completed === brgyCompletion.total ? '#166534' : '#854d0e',
              padding: '0.25rem 0.875rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
            }}>
              {brgyCompletion.completed}/{brgyCompletion.total} complete
            </span>
          </div>

          {/* BRGY progress rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {brgyCompletion.brgyList.map(b => (
              <div key={b.barangay} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: b.completed ? '#22c55e' : '#f59e0b', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', minWidth: '120px' }}>{b.barangay}</span>
                <div style={{ flex: 1 }}>
                  <ProgressBar value={b.encoded} max={b.total} color={b.completed ? '#22c55e' : '#f59e0b'} />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, minWidth: '60px', textAlign: 'right' }}>
                  {b.encoded}/{b.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.25rem', border: '1px solid #e5e7eb' }}>
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); if (key === 'pending') { setPendingView('brgy_list'); setSelectedEvent(null); } }}
            style={{
              flex: 1, padding: '0.625rem 1rem',
              borderRadius: '0.5rem', border: 'none',
              backgroundColor: activeTab === key ? 'white' : 'transparent',
              color:           activeTab === key ? '#1a1a1a' : '#6b7280',
              fontWeight:      activeTab === key ? 700 : 400,
              cursor: 'pointer', fontSize: '0.875rem',
              boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              transition: 'all 0.15s',
            }}
          >
            <Icon size={15} />
            {label}
            {key === 'pending' && pending.length > 0 && (
              <span style={{ backgroundColor: '#dc2626', color: 'white', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', minWidth: '18px', textAlign: 'center' }}>
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════
          TAB 1: ALL EVENTS
      ══════════════════════════════════ */}
      {activeTab === 'events' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>

          {/* Search + filter bar */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                placeholder="Search by barangay, organization, or program..."
                style={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={filterSeedType} onChange={e => setFilterSeedType(e.target.value)} style={{ padding: '0.375rem 0.625rem', border: `1.5px solid ${filterSeedType ? '#2d6a2d' : '#e5e7eb'}`, borderRadius: '0.5rem', fontSize: '0.78rem', cursor: 'pointer', outline: 'none', backgroundColor: filterSeedType ? '#f0fdf4' : 'white', color: filterSeedType ? '#2d6a2d' : '#6b7280', fontWeight: filterSeedType ? 700 : 400 }}>
                <option value="">All Seed Types</option>
                <option value="RCEF">RCEF (PhilRice)</option>
                <option value="NRP">NRP (Region)</option>
                <option value="RFO">RFO (Region)</option>
              </select>
              <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)} style={{ padding: '0.375rem 0.625rem', border: `1.5px solid ${filterSeason ? '#2d6a2d' : '#e5e7eb'}`, borderRadius: '0.5rem', fontSize: '0.78rem', cursor: 'pointer', outline: 'none', backgroundColor: filterSeason ? '#f0fdf4' : 'white', color: filterSeason ? '#2d6a2d' : '#6b7280', fontWeight: filterSeason ? 700 : 400 }}>
                <option value="">All Seasons</option>
                <option value="WET">Wet Season</option>
                <option value="DRY">Dry Season</option>
              </select>
              {(filterSeedType || filterSeason || eventSearch) && (
                <button onClick={() => { setEventSearch(''); setFilterSeedType(''); setFilterSeason(''); }} style={{ padding: '0.375rem 0.625rem', border: '1.5px solid #fca5a5', borderRadius: '0.5rem', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <XCircle size={11} /> Clear
                </button>
              )}
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <ClipboardList size={40} color="#d1d5db" style={{ margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>
                {events.length === 0 ? 'No distribution events yet' : 'No results found'}
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                {events.length === 0
                  ? 'Barangay Presidents create distribution programs from their portal.'
                  : 'Try adjusting your search or filters.'
                }
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredEvents.map((event, idx) => (
                <div key={event.id} style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>

                  {/* Event header — unchanged from original */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                        <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {event.intervention}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{event.season_display} {event.year}</span>
                      </div>
                      <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a1a', margin: 0 }}>{event.organization_name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        <MapPin size={13} color="#9ca3af" />
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{event.barangay}</span>
                        {event.variety_name && (
                          <>
                            <Wheat size={13} color="#9ca3af" />
                            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{event.variety_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2d6a2d', margin: 0 }}>
                        {event.total_encoded}
                        <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#9ca3af' }}>/{event.total_members}</span>
                      </p>
                      <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>farmers encoded</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div style={{ marginBottom: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        Approved: {event.total_approved} | Encoded: {event.total_encoded} | Remaining: {event.total_remaining}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2d6a2d' }}>
                        {event.total_members > 0 ? Math.round((event.total_encoded / event.total_members) * 100) : 0}%
                      </span>
                    </div>
                    <ProgressBar value={event.total_encoded} max={event.total_members} />
                  </div>

                  {/* Batch pills */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {event.batches?.map(batch => (
                      <button
                        key={batch.id}
                        onClick={() => openBatchDetail(batch.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.75rem', borderRadius: '999px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#374151', transition: 'all 0.15s' }}
                      >
                        Batch {batch.batch_number}
                        <BatchStatusBadge status={batch.status} />
                        <ChevronRight size={12} color="#9ca3af" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════
          TAB 2: PENDING REVIEW
      ══════════════════════════════════ */}
      {activeTab === 'pending' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>

          {/* Pending sub-navigation — back button when in batch list */}
          {pendingView === 'batch_list' && selectedEvent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <button
                onClick={() => { setPendingView('brgy_list'); setSelectedEvent(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a2d', fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <ChevronLeft size={14} /> Pending Review
              </button>
              <ChevronRight size={12} color="#9ca3af" />
              <span style={{ color: '#374151', fontWeight: 700 }}>
                {selectedEvent.barangay} — {selectedEvent.organization_name}
              </span>
            </div>
          )}

          {/* ── BRGY LIST VIEW ── */}
          {pendingView === 'brgy_list' && (
            <>
              {pendingByBrgy.length === 0 ? (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <CheckCircle size={40} color="#d1d5db" style={{ margin: '0 auto 1rem', display: 'block' }} />
                  <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No pending batches</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>All submitted batches have been reviewed.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {pendingByBrgy.map((group, idx) => (
                    <div
                      key={group.barangay}
                      className="brgy-card"
                      onClick={() => {
                        setSelectedEvent(group.firstEvent);
                        setPendingView('batch_list');
                      }}
                      style={{
                        backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer',
                        border: '1px solid #bfdbfe', transition: 'box-shadow 0.2s ease',
                        animation: `slideUp ${0.3 + idx * 0.05}s ease`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                            <MapPin size={14} color="#1e40af" />
                            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1a1a', margin: 0 }}>
                              Brgy. {group.barangay}
                            </h3>
                          </div>
                          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
                            {group.organization_name}
                          </p>
                          <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.25rem 0 0' }}>
                            {group.intervention} · {group.season_display} {group.year}
                            {group.variety_name ? ` · ${group.variety_name}` : ''}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e40af', margin: 0, lineHeight: 1 }}>
                              {group.batches.length}
                            </p>
                            <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                              batch{group.batches.length !== 1 ? 'es' : ''} pending
                            </p>
                          </div>
                          <ChevronRight size={20} color="#9ca3af" />
                        </div>
                      </div>
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem', fontSize: '0.72rem', color: '#9ca3af' }}>
                        <span>Total farmers: {group.batches.reduce((sum, b) => sum + (b.entry_count || 0), 0)}</span>
                        <span>Submitted by: {group.batches[0]?.encoded_by_name || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── BATCH LIST VIEW (after clicking a BRGY) ── */}
          {pendingView === 'batch_list' && selectedEvent && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {/* Event info header */}
              <div style={{ backgroundColor: '#1e40af', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem', color: 'white' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <p style={{ fontSize: '0.72rem', opacity: 0.75, margin: '0 0 0.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {selectedEvent.intervention} · {selectedEvent.season_display} {selectedEvent.year}
                    </p>
                    <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>{selectedEvent.organization_name}</h2>
                    <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '0.25rem 0 0' }}>
                      Brgy. {selectedEvent.barangay}{selectedEvent.variety_name ? ` · ${selectedEvent.variety_name}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'white', borderRadius: '999px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>
                      {selectedPendingCount} pending batch{selectedPendingCount !== 1 ? 'es' : ''}
                    </span>
                    {selectedEvent.delete_requested && (
                      <span style={{ backgroundColor: '#fde68a', color: '#92400e', borderRadius: '999px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>
                        Delete Request Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Submitted batches list */}
              {(() => {
                const evBatches = pending.filter(batch => batch.event === selectedEvent.id || batch.event_id === selectedEvent.id);

                return evBatches.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                    No submitted batches found.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {evBatches.map((batch, idx) => (
                      <div
                        key={batch.id}
                        style={{
                          backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.25rem',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #bfdbfe',
                          animation: `slideUp ${0.25 + idx * 0.05}s ease`,
                        }}
                      >
                        {/* Batch info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                              <BatchStatusBadge status={batch.status} />
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a' }}>
                                Batch {batch.batch_number}
                              </span>
                            </div>
                            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
                              {batch.entry_count} farmer{batch.entry_count !== 1 ? 's' : ''} · Encoded by {batch.encoded_by_name}
                            </p>
                            <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.125rem 0 0' }}>
                              Submitted: {batch.submitted_at ? new Date(batch.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => openBatchDetail(batch.id)}
                            style={{ padding: '0.5rem 1rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Eye size={14} /> View Details
                          </button>
                          <button
                            onClick={() => requestActionConfirm('approve', batch)}
                            disabled={actionLoading[batch.id] === 'approve'}
                            style={{ padding: '0.5rem 1rem', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: actionLoading[batch.id] === 'approve' ? 0.7 : 1 }}
                          >
                            <CheckCircle size={14} />
                            {actionLoading[batch.id] === 'approve' ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => requestActionConfirm('reject', batch)}
                            style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════
          BATCH DETAIL MODAL
      ══════════════════════════════════ */}
      {selectedBatch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem', overflowY: 'auto', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', width: '100%', maxWidth: '900px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', marginTop: '1rem' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
                  Batch {batchDetail?.batch_number} — Review
                </h2>
                {batchDetail && (
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                    {batchDetail.entry_count} farmers · <BatchStatusBadge status={batchDetail.status} />
                  </p>
                )}
              </div>
              <button onClick={() => { setSelectedBatch(null); setBatchDetail(null); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflowX: 'auto' }}>
              {batchDetailLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  <div style={{ width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: '#2d6a2d', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
                  Loading...
                </div>
              ) : batchDetail ? (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        {['#', 'RSBSA No.', 'Name', 'Contact', 'Farm Area (ha)', 'Crop Est.', 'Qty (bags)', 'Signature'].map(col => (
                          <th key={col} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batchDetail.entries?.map(entry => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }} className="batch-row">
                          <td style={{ padding: '0.625rem 0.75rem', color: '#9ca3af', fontWeight: 600 }}>{entry.row_number}</td>
                          <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>{entry.farmer_rsbsa || '—'}</td>
                          <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{entry.farmer_name}</td>
                          <td style={{ padding: '0.625rem 0.75rem', color: '#6b7280' }}>{entry.farmer_contact}</td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>{entry.farm_area_ha || '—'}</td>
                          <td style={{ padding: '0.625rem 0.75rem', color: '#6b7280' }}>{entry.crop_establishment_display || '—'}</td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>{entry.qty_bags ?? '—'}</td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>
                            {entry.has_signature
                              ? <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>Signed</span>
                              : <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>Unsigned</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                    {batchDetail.status === 'SUBMITTED' && (
                      <>
                        <button
                          onClick={() => requestActionConfirm('approve', batchDetail)}
                          disabled={actionLoading[batchDetail.id] === 'approve'}
                          style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                        >
                          <CheckCircle size={16} />
                          {actionLoading[batchDetail.id] === 'approve' ? 'Approving...' : 'Approve Batch'}
                        </button>
                        <button
                          onClick={() => requestActionConfirm('reject', batchDetail)}
                          style={{ padding: '0.5rem 1.25rem', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                        >
                          <XCircle size={16} /> Reject Batch
                        </button>
                      </>
                    )}
                    {batchDetail.status === 'APPROVED' && (
                      <button
                        onClick={() => { setUnlockModal(batchDetail.id); setUnlockReason(''); }}
                        style={{ padding: '0.5rem 1.25rem', backgroundColor: '#fef9c3', color: '#854d0e', border: '1.5px solid #fde68a', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      >
                        <Unlock size={16} /> Unlock for Edit
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p style={{ color: '#9ca3af', textAlign: 'center' }}>Failed to load batch details.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <XCircle size={20} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontWeight: 700, margin: 0 }}>Reject Batch</h3>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.125rem 0 0' }}>Tell the BRGY President what needs to be fixed.</p>
              </div>
            </div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Missing farm area for rows 3 and 5. Please complete and resubmit."
              rows={4}
              style={{ width: '100%', padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setRejectModal(null)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading[rejectModal] === 'reject'}
                style={{ flex: 2, padding: '0.625rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', opacity: !rejectReason.trim() ? 0.5 : 1 }}
              >
                {actionLoading[rejectModal] === 'reject' ? 'Rejecting...' : 'Reject Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UNLOCK MODAL ── */}
      {unlockModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#fef9c3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Unlock size={20} color="#854d0e" />
              </div>
              <div>
                <h3 style={{ fontWeight: 700, margin: 0 }}>Unlock for Emergency Edit</h3>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.125rem 0 0' }}>State reason. You must re-approve after editing.</p>
              </div>
            </div>
            <textarea
              value={unlockReason}
              onChange={e => setUnlockReason(e.target.value)}
              placeholder="e.g. Incorrect farm area for row 2. Correcting per BRGY request."
              rows={3}
              style={{ width: '100%', padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setUnlockModal(null)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button
                onClick={handleUnlock}
                disabled={!unlockReason.trim()}
                style={{ flex: 2, padding: '0.625rem', backgroundColor: '#854d0e', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', opacity: !unlockReason.trim() ? 0.5 : 1 }}
              >
                Unlock Batch
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminBeneficiaries;