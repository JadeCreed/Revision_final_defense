// src/pages/admin/AdminBeneficiaries.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  getDistributionEvents, getAdminPendingBatches,
  getDistributionStats, approveBatch, rejectBatch,
  unlockBatch, getBatchDetail, adminConfirmDeleteEvent,
} from '../../api/axios';
import {
  ClipboardList, Clock, CheckCircle, XCircle,
  ChevronRight, ChevronLeft, Users, Wheat,
  MapPin, Unlock, Eye, Search, AlertCircle,
  Send, FileText, Package,
} from 'lucide-react';

const GREEN = {
  primary: '#1a4d1a',
  light:   '#f0fdf4',
  border:  '#bbf7d0',
  accent:  '#166534',
  soft:    '#dcfce7',
};

const STATUS_CFG = {
  DRAFT:     { bg: '#f9fafb', color: '#6b7280',  label: 'Draft'     },
  SUBMITTED: { bg: '#fef9c3', color: '#854d0e',  label: 'Submitted' },
  APPROVED:  { bg: '#dcfce7', color: '#166534',  label: 'Approved'  },
  REJECTED:  { bg: '#fee2e2', color: '#991b1b',  label: 'Rejected'  },
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
  const c = STATUS_CFG[status] || STATUS_CFG.DRAFT;
  return (
    <span style={{ backgroundColor: c.bg, color: c.color, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>
      {c.label}
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
          <img src={sig} alt="Farmer signature" style={{ width: '100%', display: 'block' }} />
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

const AdminBeneficiaries = () => {
  const [activeTab, setActiveTab]   = useState('events');
  const [events, setEvents]         = useState([]);
  const [pending, setPending]       = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);

  // ── Pending drill-down ──
  const [pendingView, setPendingView]       = useState('brgy_list');
  const [selectedEvent, setSelectedEvent]   = useState(null);

  // ── Approved tab ──
  const [approvedByBrgy, setApprovedByBrgy] = useState({});
  const [selectedApprovedBrgy, setSelectedApprovedBrgy] = useState(null);
  const [approvedBatches, setApprovedBatches] = useState([]);
  const [approvedView, setApprovedView]     = useState('brgy_list');

  // ── Batch detail modal ──
  const [batchDetail, setBatchDetail]       = useState(null);
  const [batchDetailLoading, setBatchDetailLoading] = useState(false);
  const [viewBatchId, setViewBatchId]       = useState(null);

  // ── Reject modal ──
  const [rejectModal, setRejectModal]       = useState(null);
  const [rejectReason, setRejectReason]     = useState('');
  const [actionLoading, setActionLoading]   = useState({});

  // ── Confirm snack ──
  const [confirmAction, setConfirmAction]   = useState(null);

  // ── Unlock modal ──
  const [unlockModal, setUnlockModal]       = useState(null);
  const [unlockReason, setUnlockReason]     = useState('');

  // ── Delete confirm ──
  const [deleteConfirm, setDeleteConfirm]   = useState(null);

  // ── Signature viewer ──
  const [viewSig, setViewSig]               = useState(null);

  // ── Events filter ──
  const [eventSearch, setEventSearch]       = useState('');
  const [filterSeason, setFilterSeason]     = useState('');

  // ── Toast ──
  const [toast, setToast]                   = useState(null);
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ─────────────────────────────────────────
  // FETCH
  // ─────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [evRes, pRes, sRes] = await Promise.all([
        getDistributionEvents(),
        getAdminPendingBatches(),
        getDistributionStats(),
      ]);
      const evData = evRes.data || [];
      setEvents(evData);
      setPending(pRes.data || []);
      setStats(sRes.data);

      // Build approved-by-brgy map
      const byBrgy = {};
      evData.forEach(ev => {
        if (!byBrgy[ev.barangay]) {
          byBrgy[ev.barangay] = {
            barangay: ev.barangay,
            events:   [],
            totalApproved: 0,
          };
        }
        byBrgy[ev.barangay].events.push(ev);
        byBrgy[ev.barangay].totalApproved += ev.total_approved || 0;
      });
      setApprovedByBrgy(byBrgy);
    } catch {
      showToast('error', 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────
  const pendingByBrgy = (() => {
    const groups = {};
    pending.forEach(batch => {
      const event = events.find(ev => ev.id === batch.event || ev.id === batch.event_id);
      if (!event) return;
      const key = event.barangay;
      if (!groups[key]) groups[key] = { barangay: event.barangay, batches: [], firstEvent: event };
      groups[key].batches.push(batch);
    });
    return Object.values(groups);
  })();

  const filteredEvents = events.filter(ev => {
    const q = eventSearch.toLowerCase();
    const matchSearch = !q ||
      ev.organization_name?.toLowerCase().includes(q) ||
      ev.barangay?.toLowerCase().includes(q) ||
      ev.intervention?.toLowerCase().includes(q);
    const matchSeason = !filterSeason || ev.season === filterSeason;
    return matchSearch && matchSeason;
  });

  // ─────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────
  const openBatchDetail = async (batchId) => {
    setViewBatchId(batchId);
    setBatchDetailLoading(true);
    try {
      const res = await getBatchDetail(batchId);
      setBatchDetail(res.data);
    } catch { setBatchDetail(null); }
    finally { setBatchDetailLoading(false); }
  };

  const handleApprove = async (batchId) => {
    setActionLoading(p => ({ ...p, [batchId]: 'approve' }));
    try {
      await approveBatch(batchId);
      showToast('success', 'Batch approved and locked.');
      fetchAll();
      if (viewBatchId === batchId) openBatchDetail(batchId);
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
      await rejectBatch(rejectModal, { reason: rejectReason });
      setRejectModal(null);
      setRejectReason('');
      showToast('success', 'Batch rejected. BRGY has been notified.');
      fetchAll();
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
      if (viewBatchId) openBatchDetail(viewBatchId);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to unlock.');
    } finally {
      setActionLoading(p => ({ ...p, [unlockModal]: null }));
    }
  };

  const handleConfirmApprove = async () => {
    if (!confirmAction) return;
    setConfirmAction(null);
    await handleApprove(confirmAction.batchId);
  };

  const handleDeleteEvent = async () => {
    if (!deleteConfirm) return;
    try {
      await adminConfirmDeleteEvent(deleteConfirm.id);
      showToast('success', 'Program deleted.');
      setDeleteConfirm(null);
      fetchAll();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to delete.');
    }
  };

  // View signature from batch detail
  const fetchAndViewSig = async (batchId, entryId) => {
    try {
      const res = await getBatchDetail(batchId);
      const entry = res.data.entries?.find(e => e.id === entryId);
      if (entry?.signature) setViewSig(entry.signature);
    } catch {}
  };

  // ─────────────────────────────────────────
  // OPEN APPROVED BRGY
  // ─────────────────────────────────────────
  const openApprovedBrgy = async (brgy) => {
    setSelectedApprovedBrgy(brgy);
    setApprovedView('batch_list');
    // Collect all approved batches for this brgy's events
    const brgyEvents = approvedByBrgy[brgy]?.events || [];
    const batchPromises = brgyEvents.map(ev =>
      getDistributionEvents({ barangay: ev.barangay })
    );
    // We'll load batch details per event on demand
    setApprovedBatches(brgyEvents);
  };

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
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading beneficiaries...</p>
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

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Seed Beneficiaries</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          Manage farmer beneficiary masterlist and batch approvals.
        </p>
      </div>

      {/* ── STATS ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Events',     value: stats.total_events,         Icon: ClipboardList },
            { label: 'Pending Review',   value: stats.pending_batches,      Icon: Clock        },
            { label: 'Approved Batches', value: stats.approved_batches,     Icon: CheckCircle  },
            { label: 'Farmers Served',   value: stats.total_farmers_served, Icon: Users        },
          ].map(({ label, value, Icon }) => (
            <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.125rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', animation: 'slideUp 0.3s ease' }}>
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
              if (key === 'pending') { setPendingView('brgy_list'); setSelectedEvent(null); }
              if (key === 'approved') { setApprovedView('brgy_list'); setSelectedApprovedBrgy(null); }
            }}
            style={{
              flex: 1, padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
              border: 'none',
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
            {key === 'pending' && pending.length > 0 && (
              <span style={{ backgroundColor: '#854d0e', color: 'white', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB 1: ALL EVENTS
      ══════════════════════════════════════════ */}
      {activeTab === 'events' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Search + filter */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={eventSearch} onChange={e => setEventSearch(e.target.value)} placeholder="Search by barangay, organization, or program..." style={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['WET', 'DRY'].map(s => (
                <button key={s} onClick={() => setFilterSeason(filterSeason === s ? '' : s)}
                  style={{ padding: '0.375rem 0.875rem', border: `1.5px solid ${filterSeason === s ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: filterSeason === s ? GREEN.light : 'white', color: filterSeason === s ? GREEN.primary : '#6b7280', fontWeight: filterSeason === s ? 700 : 400, fontSize: '0.78rem', cursor: 'pointer' }}>
                  {s === 'WET' ? '💧 Wet' : '☀️ Dry'}
                </button>
              ))}
              {(filterSeason || eventSearch) && (
                <button onClick={() => { setFilterSeason(''); setEventSearch(''); }}
                  style={{ padding: '0.375rem 0.625rem', border: '1.5px solid #fca5a5', borderRadius: '999px', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <XCircle size={11} /> Clear
                </button>
              )}
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
              <ClipboardList size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>
                {events.length === 0 ? 'No programs yet' : 'No results found'}
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                BRGY Presidents create programs from their portal.
              </p>
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
                    {/* Delete request badge */}
                    {event.delete_requested && (
                      <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.5rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.75rem', color: '#854d0e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>⚠️ BRGY requested deletion</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => setDeleteConfirm(event)}
                            style={{ padding: '0.25rem 0.625rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                            Approve Delete
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                // Cancel delete request by updating field
                                showToast('success', 'Delete request cancelled.');
                                fetchAll();
                              } catch {}
                            }}
                            style={{ padding: '0.25rem 0.625rem', backgroundColor: 'white', color: '#854d0e', border: '1px solid #fde68a', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

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
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: tagColor, margin: 0 }}>
                          {event.total_encoded}<span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#9ca3af' }}>/{event.total_members}</span>
                        </p>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>farmers encoded</p>
                      </div>
                    </div>

                    <div style={{ marginBottom: '0.625rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                          Approved: {event.total_approved} · Encoded: {event.total_encoded} · Remaining: {event.total_remaining}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: GREEN.primary }}>
                          {event.total_members > 0 ? Math.round((event.total_encoded / event.total_members) * 100) : 0}%
                        </span>
                      </div>
                      <ProgressBar value={event.total_encoded} max={event.total_members} color={tagColor} />
                    </div>

                    {/* Batch pills */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {event.batches?.map(batch => (
                        <button key={batch.id} onClick={() => openBatchDetail(batch.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.75rem', borderRadius: '999px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#374151', transition: 'all 0.15s' }}>
                          Batch {batch.batch_number} <StatusBadge status={batch.status} /> <ChevronRight size={12} color="#9ca3af" />
                        </button>
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
          TAB 2: PENDING REVIEW
      ══════════════════════════════════════════ */}
      {activeTab === 'pending' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Sub-nav breadcrumb */}
          {pendingView === 'batch_list' && selectedEvent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <button onClick={() => { setPendingView('brgy_list'); setSelectedEvent(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <ChevronLeft size={14} /> Pending Review
              </button>
              <ChevronRight size={12} color="#9ca3af" />
              <span style={{ color: '#374151', fontWeight: 700 }}>
                {selectedEvent.barangay} — {selectedEvent.organization_name}
              </span>
            </div>
          )}

          {/* BRGY list view */}
          {pendingView === 'brgy_list' && (
            <>
              {pendingByBrgy.length === 0 ? (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
                  <CheckCircle size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No pending batches</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>All submitted batches have been reviewed.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {pendingByBrgy.map((group, idx) => (
                    <div key={group.barangay} className="card-hover"
                      onClick={() => { setSelectedEvent(group.firstEvent); setPendingView('batch_list'); }}
                      style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: `1px solid ${GREEN.border}`, animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                            <MapPin size={14} color={GREEN.primary} />
                            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1a1a', margin: 0 }}>Brgy. {group.barangay}</h3>
                          </div>
                          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>{group.firstEvent?.organization_name}</p>
                          <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.25rem 0 0' }}>
                            {group.firstEvent?.intervention} · {group.firstEvent?.season_display} {group.firstEvent?.year}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#854d0e', margin: 0, lineHeight: 1 }}>{group.batches.length}</p>
                            <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>batch{group.batches.length !== 1 ? 'es' : ''} pending</p>
                          </div>
                          <ChevronRight size={20} color="#9ca3af" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Batch list view */}
          {pendingView === 'batch_list' && selectedEvent && (() => {
            const evBatches = pending.filter(b => b.event === selectedEvent.id || b.event_id === selectedEvent.id);
            const evH = isHybrid(selectedEvent.seed_type_name || selectedEvent.intervention || '');
            return (
              <div style={{ animation: 'fadeIn 0.2s ease' }}>
                {/* Event header */}
                <div style={{ backgroundColor: GREEN.primary, borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem', color: 'white' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div>
                      <p style={{ fontSize: '0.72rem', opacity: 0.75, margin: '0 0 0.25rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        {selectedEvent.intervention} · {selectedEvent.season_display} {selectedEvent.year}
                      </p>
                      <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>{selectedEvent.organization_name}</h2>
                      <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '0.25rem 0 0' }}>
                        Brgy. {selectedEvent.barangay}{selectedEvent.variety_name ? ` · ${selectedEvent.variety_name}` : ''}
                      </p>
                    </div>
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'white', borderRadius: '999px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>
                      {evBatches.length} pending batch{evBatches.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>

                {evBatches.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af', border: '1px solid #f3f4f6' }}>
                    No submitted batches found.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {evBatches.map((batch, idx) => (
                      <div key={batch.id} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${GREEN.border}`, animation: `slideUp ${0.25 + idx * 0.05}s ease` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                              <StatusBadge status={batch.status} />
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a' }}>Batch {batch.batch_number}</span>
                            </div>
                            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
                              {batch.entry_count} farmer{batch.entry_count !== 1 ? 's' : ''} · Encoded by {batch.encoded_by_name}
                            </p>
                            <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.125rem 0 0' }}>
                              Submitted: {batch.submitted_at ? new Date(batch.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                          <button onClick={() => openBatchDetail(batch.id)}
                            style={{ padding: '0.5rem 1rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Eye size={14} /> View Details
                          </button>
                          <button
                            onClick={() => setConfirmAction({ batchId: batch.id, batchNumber: batch.batch_number })}
                            disabled={actionLoading[batch.id] === 'approve'}
                            style={{ padding: '0.5rem 1rem', backgroundColor: GREEN.soft, color: GREEN.accent, border: `1px solid ${GREEN.border}`, borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: actionLoading[batch.id] === 'approve' ? 0.7 : 1 }}>
                            <CheckCircle size={14} />
                            {actionLoading[batch.id] === 'approve' ? 'Approving...' : 'Approve'}
                          </button>
                          <button onClick={() => { setRejectModal(batch.id); setRejectReason(''); }}
                            style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 3: APPROVED BATCHES
      ══════════════════════════════════════════ */}
      {activeTab === 'approved' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Sub-nav breadcrumb */}
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

          {/* BRGY list */}
          {approvedView === 'brgy_list' && (
            <>
              {Object.keys(approvedByBrgy).length === 0 ? (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
                  <CheckCircle size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No approved batches yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {Object.values(approvedByBrgy).map((brgyData, idx) => {
                    const hasApproved = brgyData.events.some(ev => ev.batches?.some(b => b.status === 'APPROVED'));
                    if (!hasApproved) return null;
                    return (
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
                              {brgyData.events.reduce((sum, ev) => sum + (ev.batches?.filter(b => b.status === 'APPROVED').length || 0), 0)} approved
                            </span>
                            <ChevronRight size={18} color="#9ca3af" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Approved batch list for selected BRGY */}
          {approvedView === 'batch_list' && selectedApprovedBrgy && (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {approvedBatches.map((event, idx) => {
                const approvedBatchList = event.batches?.filter(b => b.status === 'APPROVED') || [];
                if (approvedBatchList.length === 0) return null;
                const evH = isHybrid(event.seed_type_name || event.intervention || '');
                const tagColor = evH ? '#1e40af' : GREEN.primary;
                const tagBg    = evH ? '#eff6ff' : GREEN.light;
                const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                return (
                  <div key={event.id} style={{ marginBottom: '1.5rem', animation: `slideUp ${0.3 + idx * 0.06}s ease` }}>
                    {/* Event title */}
                    <div style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1.25rem', marginBottom: '0.75rem', border: `1px solid ${tagBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                          {event.seed_type_name || (evH ? 'Hybrid' : 'Inbred')}
                        </span>
                        <p style={{ fontWeight: 700, margin: '0.375rem 0 0', fontSize: '0.9rem', color: '#1a1a1a' }}>{event.organization_name}</p>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>{event.season_display} {event.year}</p>
                      </div>
                      <span style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${GREEN.border}` }}>
                        {approvedBatchList.length} approved
                      </span>
                    </div>

                    {/* Approved batch cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.75rem' }}>
                      {approvedBatchList.map(batch => (
                        <div key={batch.id} style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem', border: `1px solid ${GREEN.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <CheckCircle size={14} color={GREEN.accent} />
                              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a' }}>Batch {batch.batch_number}</span>
                              <StatusBadge status={batch.status} />
                            </div>
                            <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.25rem 0 0' }}>
                              {batch.entry_count} farmers · Approved {batch.approved_at ? new Date(batch.approved_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => openBatchDetail(batch.id)}
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
          BATCH DETAIL MODAL
      ══════════════════════════════════════════ */}
      {viewBatchId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem', overflowY: 'auto', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', width: '100%', maxWidth: '960px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', marginTop: '1rem' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
                  Batch {batchDetail?.batch_number} — Detail
                </h2>
                {batchDetail && (
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                    {batchDetail.entry_count} farmers · <StatusBadge status={batchDetail.status} />
                  </p>
                )}
              </div>
              <button onClick={() => { setViewBatchId(null); setBatchDetail(null); }}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflowX: 'auto' }}>
              {batchDetailLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
                  Loading...
                </div>
              ) : batchDetail ? (() => {
                const evH = isHybrid(batchDetail.entries?.[0]?.variety_name || '');
                return (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: '700px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            {['#', 'RSBSA No.', 'Name', 'Contact', 'Farm Area (ha)',
                              evH ? 'QTY (bags)' : 'Area Planted',
                              evH ? 'Variety' : 'Crop Estab.',
                              'Data Sharing', 'Signature'].map(col => (
                              <th key={col} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {batchDetail.entries?.map(entry => (
                            <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.625rem 0.75rem', color: '#9ca3af', fontWeight: 600 }}>{entry.row_number}</td>
                              <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.72rem', color: '#6b7280' }}>{entry.farmer_rsbsa || '—'}</td>
                              <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600 }}>{entry.farmer_name}</td>
                              <td style={{ padding: '0.625rem 0.75rem', color: '#6b7280' }}>{entry.farmer_contact}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{entry.farm_area_ha || '—'}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{evH ? (entry.qty_bags ?? '—') : (entry.area_planted || '—')}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{evH ? (entry.variety_name || '—') : (entry.crop_establishment || '—')}</td>
                              <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>{entry.data_sharing ? '✓' : '—'}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>
                                {entry.has_signature ? (
                                  <button
                                    onClick={() => fetchAndViewSig(batchDetail.id, entry.id)}
                                    style={{ backgroundColor: GREEN.soft, color: GREEN.accent, padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${GREEN.border}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                    <Eye size={11} /> View
                                  </button>
                                ) : (
                                  <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>Unsigned</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                      {batchDetail.status === 'SUBMITTED' && (
                        <>
                          <button
                            onClick={() => setConfirmAction({ batchId: batchDetail.id, batchNumber: batchDetail.batch_number })}
                            disabled={actionLoading[batchDetail.id] === 'approve'}
                            style={{ padding: '0.5rem 1.25rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <CheckCircle size={16} />
                            {actionLoading[batchDetail.id] === 'approve' ? 'Approving...' : 'Approve Batch'}
                          </button>
                          <button onClick={() => { setRejectModal(batchDetail.id); setRejectReason(''); }}
                            style={{ padding: '0.5rem 1.25rem', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <XCircle size={16} /> Reject Batch
                          </button>
                        </>
                      )}
                      {batchDetail.status === 'APPROVED' && (
                        <button onClick={() => { setUnlockModal(batchDetail.id); setUnlockReason(''); }}
                          style={{ padding: '0.5rem 1.25rem', backgroundColor: '#fef9c3', color: '#854d0e', border: '1.5px solid #fde68a', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Unlock size={16} /> Unlock for Edit
                        </button>
                      )}
                    </div>
                  </>
                );
              })() : (
                <p style={{ color: '#9ca3af', textAlign: 'center' }}>Failed to load batch details.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM APPROVE SNACK ── */}
      {confirmAction && (
        <div style={{ position: 'fixed', left: '50%', bottom: '1rem', transform: 'translateX(-50%)', zIndex: 650, width: 'min(100%, 420px)', animation: 'slideUp 0.25s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 14px 40px rgba(0,0,0,0.18)', padding: '1rem', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: GREEN.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={20} color={GREEN.primary} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>Approve Batch {confirmAction.batchNumber}?</p>
                <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.82rem' }}>This will lock the batch. BRGY will be notified.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button onClick={() => setConfirmAction(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConfirmApprove} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', backgroundColor: GREEN.primary, color: 'white', fontWeight: 700, cursor: 'pointer' }}>Confirm Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, backgroundColor: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <XCircle size={20} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontWeight: 700, margin: 0 }}>Reject Batch</h3>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.125rem 0 0' }}>Tell the BRGY what needs to be fixed.</p>
              </div>
            </div>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Missing farm area for rows 3 and 5. Please complete and resubmit."
              rows={4}
              style={{ width: '100%', padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setRejectModal(null)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || actionLoading[rejectModal] === 'reject'}
                style={{ flex: 2, padding: '0.625rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', opacity: !rejectReason.trim() ? 0.5 : 1 }}>
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
              <div style={{ width: 40, height: 40, backgroundColor: '#fef9c3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Unlock size={20} color="#854d0e" />
              </div>
              <div>
                <h3 style={{ fontWeight: 700, margin: 0 }}>Unlock for Emergency Edit</h3>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.125rem 0 0' }}>State reason. Must re-approve after editing.</p>
              </div>
            </div>
            <textarea value={unlockReason} onChange={e => setUnlockReason(e.target.value)}
              placeholder="e.g. Incorrect farm area for row 2."
              rows={3}
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

      {/* ── DELETE CONFIRM ── */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>⚠️ Confirm Program Deletion</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Permanently delete <strong>{deleteConfirm.organization_name}</strong> in Brgy. {deleteConfirm.barangay}? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeleteEvent} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBeneficiaries;