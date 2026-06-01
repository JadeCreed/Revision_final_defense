import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getInventorySummary, getSeedDeliveries, createSeedDelivery,
  updateSeedDelivery, deleteSeedDelivery, createAllocation,
  getDeliveryAudit, getFinalSeeds,
} from '../../api/axios';
import {
  Plus, Package, ChevronRight, ChevronLeft, CheckCircle,
  AlertCircle, Search, Wheat, Truck, Users, Clock,
  ClipboardList, Edit2, Trash2, Eye, History, X,
  MapPin, Calendar, Hash, CalendarClock, Leaf,
} from 'lucide-react';

const GREEN = {
  primary: '#1a4d1a', light: '#f0fdf4', border: '#bbf7d0',
  accent: '#166534', soft: '#dcfce7',
};

const isHybrid = (s = '') => {
  const n = s.toUpperCase();
  return n.includes('HYBRID') || n === 'NRP' || n === 'RFO';
};

const StatusBadge = ({ status }) => {
  const cfg = {
    PENDING:   { bg: '#fef9c3', color: '#854d0e', label: 'Pending Pickup' },
    CONFIRMED: { bg: '#dcfce7', color: '#166534', label: 'Confirmed'       },
    SCHEDULED: { bg: '#eff6ff', color: '#1e40af', label: 'Scheduled'       },
    DELIVERED: { bg: '#dcfce7', color: '#166534', label: 'Delivered'       },
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
      color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.875rem',
      fontWeight: 600, fontSize: '0.875rem', display: 'flex',
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
        <p style={{ fontWeight: 700, color: '#1a1a1a', margin: '0 0 0.375rem', fontSize: '0.95rem' }}>{data.title}</p>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>{data.message}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 2, padding: '0.625rem', backgroundColor: data.danger ? '#dc2626' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
            {data.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProgressBar = ({ value, max, color = GREEN.primary }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '999px', transition: 'width 0.5s ease' }} />
    </div>
  );
};

const inp = (hasErr = false) => ({
  padding: '0.625rem 0.875rem',
  border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
  borderRadius: '0.5rem', fontSize: '0.875rem',
  width: '100%', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', backgroundColor: 'white',
});

const BARANGAYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit','Kalangay','Kalyaat','Kilib','Kulapi',
  'Mahabang Parang','Malupak','Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil','Tiawe','Tinamnan',
];

// ── LOCAL STORAGE KEY for scheduled deliveries ──
const SCHEDULE_STORAGE_KEY = 'agrice_delivery_schedules';

const loadSchedules = () => {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveSchedulesToStorage = (schedules) => {
  try { localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedules)); } catch {}
};

export default function SeedInventory() {
  const [view, setView]               = useState('landing');
  const [deliveries, setDeliveries]   = useState([]);
  const [summary, setSummary]         = useState(null);
  const [finalSeeds, setFinalSeeds]   = useState([]);
  const [loading, setLoading]         = useState(true);

  const [selected, setSelected]       = useState(null);
  const [auditLogs, setAuditLogs]     = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [search, setSearch]           = useState('');
  const [filterSeason, setFilterSeason] = useState('');

  const [deliveryModal, setDeliveryModal] = useState(false);
  const [editDelivery, setEditDelivery]   = useState(null);
  const [allocModal, setAllocModal]       = useState(null);
  const [confirmSnack, setConfirmSnack]   = useState(null);
  const [toast, setToast]                 = useState(null);

  const [dForm, setDForm]             = useState({ final_seed_id: '', season: '', year: '', total_bags: '', delivery_date: '', lot_number: '', remarks: '' });
  const [dErrors, setDErrors]         = useState({});
  const [dSaving, setDSaving]         = useState(false);

  const [aForm, setAForm]             = useState({ barangay: '', allocated_bags: '', notes: '' });
  const [aErrors, setAErrors]         = useState({});
  const [aSaving, setASaving]         = useState(false);

  // ── SCHEDULE DELIVERY STATE ──
  const [scheduleModal, setScheduleModal]     = useState(false);
  const [editSchedule, setEditSchedule]       = useState(null);
  const [activeScheduleTab, setActiveScheduleTab] = useState(null);
  const [scheduleForms, setScheduleForms]     = useState({});
  const [scheduleErrors, setScheduleErrors]   = useState({});
  const [scheduleSaving, setScheduleSaving]   = useState(false);
  const [schedules, setSchedules]             = useState(loadSchedules);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const [delRes, sumRes] = await Promise.all([
        getSeedDeliveries(),
        getInventorySummary(),
      ]);
      setDeliveries(delRes.data || []);
      setSummary(sumRes.data);
    } catch (err) {
      showToast('error', err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to load inventory data.');
      setDeliveries([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadFinalSeeds = useCallback(async () => {
    try {
      const res = await getFinalSeeds();
      setFinalSeeds(res.data || []);
    } catch (err) {
      showToast('error', err.response?.data?.error || err.response?.data?.detail || 'Failed to load final seeds.');
      setFinalSeeds([]);
    }
  }, [showToast]);

  useEffect(() => {
    loadInventory();
    loadFinalSeeds();
  }, [loadInventory, loadFinalSeeds]);

  const openDetail = (delivery) => { setSelected(delivery); setView('detail'); };

  const openAudit = async (delivery) => {
    setSelected(delivery);
    setView('audit');
    setAuditLoading(true);
    try {
      const res = await getDeliveryAudit(delivery.id);
      setAuditLogs(res.data || []);
    } catch { setAuditLogs([]); }
    finally { setAuditLoading(false); }
  };

  // ── EXISTING DELIVERY FORM (unchanged) ──
  const openCreateDelivery = async () => {
    setEditDelivery(null);
    if (!finalSeeds.length) await loadFinalSeeds();
    const fs = finalSeeds[0];
    setDForm({ final_seed_id: '', season: fs?.season || '', year: fs?.year || new Date().getFullYear(), total_bags: '', delivery_date: '', lot_number: '', remarks: '' });
    setDErrors({});
    setDeliveryModal(true);
  };

  const openEditDelivery = (delivery) => {
    setEditDelivery(delivery);
    setDForm({ final_seed_id: delivery.seed_type, season: delivery.season, year: delivery.year, total_bags: delivery.total_bags, delivery_date: delivery.delivery_date, lot_number: delivery.lot_number || '', remarks: delivery.remarks || '' });
    setDErrors({});
    setDeliveryModal(true);
  };

  const handleSaveDelivery = async () => {
    const errs = {};
    if (!dForm.season)        errs.season        = 'Required';
    if (!dForm.year)          errs.year          = 'Required';
    if (!dForm.total_bags)    errs.total_bags    = 'Required';
    if (!dForm.delivery_date) errs.delivery_date = 'Required';
    if (!editDelivery && !dForm.final_seed_id) errs.final_seed_id = 'Select seed type';
    if (Object.keys(errs).length > 0) { setDErrors(errs); return; }

    setDSaving(true);
    try {
      const selectedFS = finalSeeds.find(fs => fs.id?.toString() === dForm.final_seed_id?.toString());
      const payload = {
        seed_type:     selectedFS?.seed_type?.id || editDelivery?.seed_type,
        variety:       selectedFS?.varieties?.[0]?.id || editDelivery?.variety,
        season:        dForm.season,
        year:          Number(dForm.year),
        total_bags:    Number(dForm.total_bags),
        delivery_date: dForm.delivery_date,
        lot_number:    dForm.lot_number,
        remarks:       dForm.remarks,
      };
      if (editDelivery) {
        await updateSeedDelivery(editDelivery.id, payload);
        showToast('success', 'Delivery record updated.');
      } else {
        await createSeedDelivery(payload);
        showToast('success', 'Seed delivery recorded successfully.');
      }
      setDeliveryModal(false);
      await loadInventory();
      if (selected) {
        const res = await getSeedDeliveries();
        const updated = (res.data || []).find(d => d.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch (err) {
      showToast('error', err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to save delivery.');
    } finally {
      setDSaving(false);
    }
  };

  const handleDeleteDelivery = (delivery) => {
    setConfirmSnack({
      title: `Delete this delivery record?`,
      message: `${delivery.seed_type_name} — ${delivery.season_display} ${delivery.year}. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      _action: async () => {
        try {
          await deleteSeedDelivery(delivery.id);
          showToast('success', 'Delivery deleted.');
          setView('landing');
          await loadInventory();
        } catch (err) {
          showToast('error', err.response?.data?.error || 'Failed to delete.');
        }
      },
    });
  };

  // ── ALLOCATION FORM (unchanged) ──
  const openAllocModal = (delivery) => {
    setAllocModal(delivery);
    setAForm({ barangay: '', allocated_bags: '', notes: '' });
    setAErrors({});
  };

  const handleSaveAlloc = async () => {
    const errs = {};
    if (!aForm.barangay.trim())  errs.barangay       = 'Required';
    if (!aForm.allocated_bags)   errs.allocated_bags = 'Required';
    if (Object.keys(errs).length > 0) { setAErrors(errs); return; }
    setASaving(true);
    try {
      await createAllocation(allocModal.id, { barangay: aForm.barangay.trim(), allocated_bags: Number(aForm.allocated_bags), notes: aForm.notes });
      showToast('success', `Allocated ${aForm.allocated_bags} bags to Brgy. ${aForm.barangay}.`);
      setAllocModal(null);
      const res = await getSeedDeliveries();
      setDeliveries(res.data || []);
      const updated = (res.data || []).find(d => d.id === allocModal.id);
      if (updated) setSelected(updated);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to allocate.');
    } finally {
      setASaving(false);
    }
  };

  // ── SCHEDULE DELIVERY HANDLERS ──
  const openScheduleModal = async () => {
    setEditSchedule(null);
    if (!finalSeeds.length) await loadFinalSeeds();
    setScheduleForms({});
    setScheduleErrors({});
    setActiveScheduleTab(null);
    setScheduleModal(true);
  };

  const openEditSchedule = (schedule) => {
    setEditSchedule(schedule);
    // Pre-fill forms from saved schedule entries
    const forms = {};
    schedule.entries.forEach(entry => {
      forms[entry.seedTypeId] = {
        total_bags:    entry.total_bags,
        delivery_date: entry.delivery_date,
        lot_number:    entry.lot_number || '',
        remarks:       entry.remarks || '',
        season:        entry.season,
        year:          entry.year,
      };
    });
    setScheduleForms(forms);
    setScheduleErrors({});
    // Set first entry's seedTypeId as active tab
    setActiveScheduleTab(schedule.entries[0]?.seedTypeId || null);
    setScheduleModal(true);
  };

  const handleScheduleTabToggle = (fs) => {
    const key = fs.id?.toString();
    if (activeScheduleTab === key) {
      // deselect — remove its form data
      setActiveScheduleTab(null);
    } else {
      setActiveScheduleTab(key);
      // Initialize form for this seed type if not yet filled
      if (!scheduleForms[key]) {
        setScheduleForms(prev => ({
          ...prev,
          [key]: { total_bags: '', delivery_date: '', lot_number: '', remarks: '', season: fs.season || '', year: fs.year || new Date().getFullYear() },
        }));
      }
    }
    setScheduleErrors(prev => ({ ...prev, [key]: {} }));
  };

  const updateScheduleForm = (fsId, field, value) => {
    const key = fsId?.toString();
    setScheduleForms(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));
    setScheduleErrors(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: '' } }));
  };

  const handleSaveSchedule = () => {
    // Validate all tabs that have been opened (have form data)
    const openedKeys = Object.keys(scheduleForms);
    if (openedKeys.length === 0) {
      showToast('error', 'Please select at least one seed type to schedule.');
      return;
    }

    let hasError = false;
    const newErrors = {};

    openedKeys.forEach(key => {
      const f = scheduleForms[key] || {};
      const errs = {};
      if (!f.total_bags)    errs.total_bags    = 'Required';
      if (!f.delivery_date) errs.delivery_date = 'Required';
      if (!f.season)        errs.season        = 'Required';
      if (!f.year)          errs.year          = 'Required';
      if (Object.keys(errs).length > 0) {
        newErrors[key] = errs;
        hasError = true;
      }
    });

    if (hasError) {
      setScheduleErrors(newErrors);
      // Switch to first tab with error
      const firstErrKey = Object.keys(newErrors)[0];
      setActiveScheduleTab(firstErrKey);
      showToast('error', 'Please fill all required fields.');
      return;
    }

    setScheduleSaving(true);

    // Build entries from opened forms
    const entries = openedKeys.map(key => {
      const fs = finalSeeds.find(s => s.id?.toString() === key);
      const f  = scheduleForms[key];
      return {
        seedTypeId:    key,
        seedTypeName:  fs?.seed_type?.name || 'Unknown',
        varietyName:   fs?.varieties?.map(v => v.name).join(', ') || '—',
        source:        isHybrid(fs?.seed_type?.name || '') ? 'Region (NRP/RFO)' : 'PhilRice (RCEF)',
        season:        f.season,
        year:          f.year,
        total_bags:    Number(f.total_bags),
        delivery_date: f.delivery_date,
        lot_number:    f.lot_number,
        remarks:       f.remarks,
        status:        'SCHEDULED',
      };
    });

    let updated;
    if (editSchedule) {
      updated = schedules.map(s => s.id === editSchedule.id ? { ...s, entries, updatedAt: new Date().toISOString() } : s);
      showToast('success', 'Delivery schedule updated.');
    } else {
      const newSchedule = {
        id:        Date.now(),
        entries,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updated = [...schedules, newSchedule];
      showToast('success', `Delivery program saved with ${entries.length} seed type${entries.length > 1 ? 's' : ''}.`);
    }

    setSchedules(updated);
    saveSchedulesToStorage(updated);
    setScheduleModal(false);
    setScheduleSaving(false);
  };

  const handleMarkDelivered = (scheduleId, entryIdx) => {
    setConfirmSnack({
      title: 'Mark as Delivered?',
      message: 'This confirms that the scheduled delivery has arrived.',
      confirmLabel: 'Mark Delivered',
      danger: false,
      _action: () => {
        const updated = schedules.map(s => {
          if (s.id !== scheduleId) return s;
          const entries = s.entries.map((e, i) => i === entryIdx ? { ...e, status: 'DELIVERED' } : e);
          return { ...s, entries, updatedAt: new Date().toISOString() };
        });
        setSchedules(updated);
        saveSchedulesToStorage(updated);
        showToast('success', 'Delivery marked as delivered.');
      },
    });
  };

  const handleDeleteSchedule = (scheduleId) => {
    setConfirmSnack({
      title: 'Delete this schedule?',
      message: 'This delivery program will be permanently removed.',
      confirmLabel: 'Delete',
      danger: true,
      _action: () => {
        const updated = schedules.filter(s => s.id !== scheduleId);
        setSchedules(updated);
        saveSchedulesToStorage(updated);
        showToast('success', 'Schedule deleted.');
      },
    });
  };

  const filteredDeliveries = deliveries.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.seed_type_name?.toLowerCase().includes(q) || d.variety_name?.toLowerCase().includes(q) || d.lot_number?.toLowerCase().includes(q);
    const matchSeason = !filterSeason || d.season === filterSeason;
    return matchSearch && matchSeason;
  });

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#9ca3af' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes slideUp { from { transform:translateY(12px);opacity:0; } to { transform:translateY(0);opacity:1; } }
      `}</style>
      <div style={{ width: 36, height: 36, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading seed inventory...</p>
    </div>
  );

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes slideUp { from { transform:translateY(12px);opacity:0; } to { transform:translateY(0);opacity:1; } }
        @keyframes modalSlideUp { from { transform:translateY(40px);opacity:0; } to { transform:translateY(0);opacity:1; } }
        .card-hover:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.12) !important; transform: translateY(-2px); transition: all 0.2s; }
        .row-hover:hover { background-color: ${GREEN.light} !important; }
        .btn-icon:hover { opacity: 0.75; }
        .schedule-tab-btn { transition: all 0.2s ease; }
        .schedule-tab-btn:hover { transform: translateY(-1px); }
      `}</style>

      <Toast toast={toast} />
      <ConfirmSnack
        data={confirmSnack}
        onConfirm={async () => { const fn = confirmSnack?._action; setConfirmSnack(null); if (fn) await fn(); }}
        onCancel={() => setConfirmSnack(null)}
      />

      {/* BREADCRUMB */}
      {view !== 'landing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1.25rem', fontSize: '0.8rem', animation: 'fadeIn 0.2s ease', flexWrap: 'wrap' }}>
          <button onClick={() => { setView('landing'); setSelected(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <ChevronLeft size={15} /> Seed Inventory
          </button>
          <ChevronRight size={12} color="#9ca3af" />
          <span style={{ color: '#374151', fontWeight: 700 }}>
            {view === 'detail' ? `${selected?.seed_type_name} — ${selected?.season_display} ${selected?.year}` : 'Audit Trail'}
          </span>
        </div>
      )}

      {/* ══ LANDING ══ */}
      {view === 'landing' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Seed Inventory</h1>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Track seed deliveries and barangay allocations.</p>
            </div>
            {/* ── TWO BUTTONS IN HEADER ── */}
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              <button onClick={openScheduleModal}
                style={{ padding: '0.625rem 1.125rem', backgroundColor: 'white', color: GREEN.primary, border: `2px solid ${GREEN.primary}`, borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = GREEN.light; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; }}>
                <CalendarClock size={16} /> Schedule Delivery
              </button>
              <button onClick={openCreateDelivery}
                style={{ padding: '0.625rem 1.125rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Plus size={16} /> Record Delivery
              </button>
            </div>
          </div>

          {/* Summary stats */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Deliveries',  value: summary.total_deliveries,      Icon: Truck,        color: '#1e40af', bg: '#eff6ff' },
                { label: 'Bags Received',     value: summary.total_bags_received,   Icon: Package,      color: GREEN.primary, bg: GREEN.light },
                { label: 'Bags Allocated',    value: summary.total_bags_allocated,  Icon: Users,        color: '#854d0e', bg: '#fef9c3' },
                { label: 'Bags Remaining',    value: summary.total_bags_remaining,  Icon: Wheat,        color: GREEN.accent, bg: GREEN.soft },
                { label: 'Pending Pickups',   value: summary.pending_confirmations, Icon: Clock,        color: '#854d0e', bg: '#fff7ed' },
                { label: 'Confirmed Pickups', value: summary.confirmed_pickups,     Icon: CheckCircle,  color: GREEN.accent, bg: GREEN.light },
              ].map(({ label, value, Icon, color, bg }, i) => (
                <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', animation: `slideUp ${0.3 + i * 0.04}s ease` }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <Icon size={16} color={color} />
                  </div>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: '0 0 0.125rem', lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Search + filter */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by seed type, variety, or lot number..." style={{ ...inp(), paddingLeft: '2.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['WET', 'DRY'].map(s => (
                <button key={s} onClick={() => setFilterSeason(filterSeason === s ? '' : s)}
                  style={{ padding: '0.375rem 0.875rem', border: `1.5px solid ${filterSeason === s ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: filterSeason === s ? GREEN.light : 'white', color: filterSeason === s ? GREEN.primary : '#6b7280', fontWeight: filterSeason === s ? 700 : 400, fontSize: '0.78rem', cursor: 'pointer' }}>
                  {s === 'WET' ? '💧 Wet Season' : '☀️ Dry Season'}
                </button>
              ))}
              {(search || filterSeason) && (
                <button onClick={() => { setSearch(''); setFilterSeason(''); }}
                  style={{ padding: '0.375rem 0.625rem', border: '1.5px solid #fca5a5', borderRadius: '999px', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <X size={11} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Delivery cards */}
          {filteredDeliveries.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
              <Package size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>{deliveries.length === 0 ? 'No deliveries recorded yet' : 'No results found'}</p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Record a seed delivery using the button above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filteredDeliveries.map((delivery, idx) => {
                const evH = isHybrid(delivery.seed_type_name || '');
                const tagColor  = evH ? '#1e40af' : GREEN.primary;
                const tagBg     = evH ? '#eff6ff' : GREEN.light;
                const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                return (
                  <div key={delivery.id} className="card-hover"
                    onClick={() => openDetail(delivery)}
                    style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${tagBorder}`, cursor: 'pointer', animation: `slideUp ${0.3 + idx * 0.06}s ease` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                          <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.15rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>{delivery.seed_type_name}</span>
                          {delivery.variety_name && <span style={{ fontSize: '0.7rem', color: '#6b7280', backgroundColor: '#f9fafb', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid #e5e7eb' }}>{delivery.variety_name}</span>}
                          <span style={{ fontSize: '0.7rem', color: '#6b7280', backgroundColor: '#f9fafb', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid #e5e7eb' }}>{delivery.season_display} {delivery.year}</span>
                        </div>
                        <h3 style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: '#111827' }}>
                          {delivery.source === 'REGION' ? 'From Region (NRP/RFO)' : 'From PhilRice (RCEF)'}
                        </h3>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Calendar size={11} /> {new Date(delivery.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                          {delivery.lot_number && <><Hash size={11} style={{ marginLeft: '0.375rem' }} />{delivery.lot_number}</>}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '1.75rem', fontWeight: 800, color: tagColor, margin: 0, lineHeight: 1 }}>{delivery.total_bags}</p>
                        <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>total bags</p>
                      </div>
                    </div>
                    <ProgressBar value={delivery.allocated_bags} max={delivery.total_bags} color={tagColor} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: '#9ca3af', flexWrap: 'wrap', gap: '0.25rem' }}>
                      <span>{delivery.allocated_bags} allocated · {delivery.remaining_bags} remaining</span>
                      <span style={{ color: tagColor, fontWeight: 600 }}>{delivery.allocations?.length || 0} brgy{delivery.allocations?.length !== 1 ? 's' : ''} allocated <ChevronRight size={11} style={{ display: 'inline' }} /></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ DELIVERY PROGRAM SECTION ══ */}
          {schedules.length > 0 && (
            <div style={{ marginTop: '2rem', animation: 'fadeIn 0.3s ease' }}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: 4, height: 28, backgroundColor: GREEN.primary, borderRadius: '999px' }} />
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Delivery Program</h2>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>Scheduled seed variety deliveries</p>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '0.25rem 0.75rem', borderRadius: '999px', fontWeight: 600 }}>
                  {schedules.length} program{schedules.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {schedules.map((schedule, sIdx) => (
                  <div key={schedule.id} style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb', overflow: 'hidden', animation: `slideUp ${0.3 + sIdx * 0.06}s ease` }}>
                    {/* Schedule header */}
                    <div style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <CalendarClock size={16} color={GREEN.primary} />
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>
                            Program #{sIdx + 1}
                          </p>
                          <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>
                            Created {new Date(schedule.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {schedule.updatedAt !== schedule.createdAt && ` · Updated ${new Date(schedule.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.2rem 0.625rem', borderRadius: '999px', fontWeight: 600 }}>
                          {schedule.entries.length} seed type{schedule.entries.length !== 1 ? 's' : ''}
                        </span>
                        <button onClick={() => openEditSchedule(schedule)}
                          style={{ padding: '0.375rem 0.75rem', backgroundColor: GREEN.light, color: GREEN.primary, border: `1px solid ${GREEN.border}`, borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Edit2 size={12} /> Edit
                        </button>
                        <button onClick={() => handleDeleteSchedule(schedule.id)}
                          style={{ padding: '0.375rem 0.625rem', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Entry cards */}
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {schedule.entries.map((entry, eIdx) => {
                        const evH = isHybrid(entry.seedTypeName || '');
                        const tagColor  = evH ? '#1e40af' : GREEN.primary;
                        const tagBg     = evH ? '#eff6ff' : GREEN.light;
                        const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                        const isDelivered = entry.status === 'DELIVERED';
                        return (
                          <div key={eIdx} style={{ borderRadius: '0.875rem', border: `1.5px solid ${isDelivered ? GREEN.border : tagBorder}`, backgroundColor: isDelivered ? GREEN.light : 'white', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', transition: 'all 0.2s' }}>
                            {/* Left info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.15rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                                  {entry.seedTypeName}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: '#6b7280', backgroundColor: '#f9fafb', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid #e5e7eb' }}>
                                  {entry.source}
                                </span>
                                <StatusBadge status={entry.status} />
                              </div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a1a', margin: '0 0 0.375rem' }}>
                                {entry.varietyName}
                              </p>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.72rem', color: '#6b7280' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Calendar size={11} />
                                  {new Date(entry.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Package size={11} />
                                  {entry.total_bags} bags
                                </span>
                                {entry.lot_number && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Hash size={11} /> {entry.lot_number}
                                  </span>
                                )}
                                <span style={{ backgroundColor: '#f3f4f6', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                                  {entry.season === 'WET' ? '💧' : '☀️'} {entry.season === 'WET' ? 'Wet' : 'Dry'} {entry.year}
                                </span>
                              </div>
                              {entry.remarks && (
                                <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0.375rem 0 0', fontStyle: 'italic' }}>
                                  {entry.remarks}
                                </p>
                              )}
                            </div>
                            {/* Right actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: tagColor, margin: 0, lineHeight: 1 }}>{entry.total_bags}</p>
                                <p style={{ fontSize: '0.62rem', color: '#9ca3af', margin: '0.1rem 0 0' }}>total bags</p>
                              </div>
                              {!isDelivered ? (
                                <button
                                  onClick={() => handleMarkDelivered(schedule.id, eIdx)}
                                  style={{ padding: '0.4rem 0.875rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s' }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = GREEN.accent}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = GREEN.primary}>
                                  <CheckCircle size={12} /> Delivered
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: GREEN.accent, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <CheckCircle size={13} /> Delivered
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ DETAIL VIEW (unchanged) ══ */}
      {view === 'detail' && selected && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          <div style={{ backgroundColor: GREEN.primary, borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.25rem', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <p style={{ fontSize: '0.72rem', opacity: 0.75, margin: '0 0 0.25rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {selected.source === 'REGION' ? 'Region (NRP/RFO)' : 'PhilRice (RCEF)'} · {selected.season_display} {selected.year}
                </p>
                <h2 style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>{selected.seed_type_name}</h2>
                {selected.variety_name && <p style={{ opacity: 0.8, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{selected.variety_name}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={e => { e.stopPropagation(); openEditDelivery(selected); }}
                  style={{ padding: '0.5rem 0.875rem', backgroundColor: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Edit2 size={13} /> Edit
                </button>
                <button onClick={e => { e.stopPropagation(); openAudit(selected); }}
                  style={{ padding: '0.5rem 0.875rem', backgroundColor: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <History size={13} /> Audit
                </button>
                <button onClick={e => { e.stopPropagation(); handleDeleteDelivery(selected); }}
                  style={{ padding: '0.5rem 0.875rem', backgroundColor: 'rgba(220,38,38,0.3)', color: 'white', border: '1px solid rgba(220,38,38,0.5)', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1.25rem' }}>
              {[
                { label: 'Total Received', value: selected.total_bags },
                { label: 'Allocated',      value: selected.allocated_bags },
                { label: 'Remaining',      value: selected.remaining_bags },
              ].map(({ label, value }) => (
                <div key={label} style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '0.75rem', padding: '0.75rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: '0.65rem', opacity: 0.8, margin: '0.25rem 0 0', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', border: '1px solid #f3f4f6' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div>
                <p style={{ color: '#9ca3af', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.25rem' }}>Delivery Date</p>
                <p style={{ fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{new Date(selected.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <div>
                <p style={{ color: '#9ca3af', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.25rem' }}>Lot Number</p>
                <p style={{ fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{selected.lot_number || '—'}</p>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <p style={{ color: '#9ca3af', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.25rem' }}>Remarks</p>
                <p style={{ fontWeight: 600, color: '#374151', margin: 0 }}>{selected.remarks || '—'}</p>
              </div>
              <div>
                <p style={{ color: '#9ca3af', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.25rem' }}>Encoded By</p>
                <p style={{ fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{selected.encoded_by_name || '—'}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <h2 style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1a1a', margin: 0 }}>Barangay Allocations</h2>
            {selected.remaining_bags > 0 && (
              <button onClick={() => openAllocModal(selected)}
                style={{ padding: '0.5rem 1rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Plus size={14} /> Allocate Bags
              </button>
            )}
          </div>
          {selected.allocations?.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center', border: '1px solid #f3f4f6', color: '#9ca3af' }}>
              <Users size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.25rem' }}>No allocations yet</p>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>Allocate bags to barangays using the button above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {selected.allocations.map((alloc, idx) => (
                <div key={alloc.id} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${alloc.status === 'CONFIRMED' ? GREEN.border : '#fde68a'}`, animation: `slideUp ${0.3 + idx * 0.05}s ease`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <MapPin size={13} color={GREEN.primary} />
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1a1a1a' }}>Brgy. {alloc.barangay}</span>
                      <StatusBadge status={alloc.status} />
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>
                      Allocated: {new Date(alloc.date_allocated + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {alloc.date_confirmed && ` · Confirmed: ${new Date(alloc.date_confirmed + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                    {alloc.confirmed_by_name && <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>Confirmed by: {alloc.confirmed_by_name}</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: alloc.status === 'CONFIRMED' ? GREEN.primary : '#854d0e', margin: 0, lineHeight: 1 }}>{alloc.allocated_bags}</p>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>bags</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ AUDIT VIEW (unchanged) ══ */}
      {view === 'audit' && selected && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
            <h2 style={{ fontWeight: 800, fontSize: '1rem', margin: '0 0 0.25rem' }}>Audit Trail</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: 0 }}>{selected.seed_type_name} — {selected.season_display} {selected.year}</p>
          </div>
          {auditLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
              Loading audit logs...
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af', border: '1px solid #f3f4f6' }}>
              <History size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
              No audit logs yet.
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
              {auditLogs.map((log, idx) => {
                const actionCfg = {
                  CREATED:   { color: GREEN.accent,  bg: GREEN.soft,   icon: <Package size={16} /> },
                  UPDATED:   { color: '#1e40af',     bg: '#eff6ff',    icon: <Edit2 size={16} /> },
                  ALLOCATED: { color: '#854d0e',     bg: '#fef9c3',    icon: <Truck size={16} /> },
                  CONFIRMED: { color: GREEN.primary, bg: GREEN.light,  icon: <CheckCircle size={16} /> },
                  DELETED:   { color: '#991b1b',     bg: '#fee2e2',    icon: <Trash2 size={16} /> },
                }[log.action] || { color: '#6b7280', bg: '#f9fafb', icon: <ClipboardList size={16} /> };
                return (
                  <div key={log.id} style={{ padding: '1rem 1.25rem', borderBottom: idx < auditLogs.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', gap: '0.875rem', alignItems: 'flex-start', animation: `slideUp ${0.3 + idx * 0.04}s ease` }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: actionCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>{actionCfg.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: actionCfg.color }}>{log.action_display}</span>
                        <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{new Date(log.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#374151', margin: '0.25rem 0 0.125rem' }}>{log.details}</p>
                      {log.performed_by_name && <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>By: {log.performed_by_name}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ RECORD DELIVERY MODAL (unchanged) ══ */}
      {deliveryModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))', animation: 'slideUp 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>{editDelivery ? 'Edit Delivery' : 'Record Seed Delivery'}</h2>
              <button onClick={() => setDeliveryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.5rem' }}>×</button>
            </div>
            {!editDelivery && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>Seed Type <span style={{ color: '#dc2626' }}>*</span></label>
                {finalSeeds.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#dc2626' }}>No finalized seeds. Admin must finalize in Seed Poll first.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: finalSeeds.length === 1 ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
                    {finalSeeds.map(fs => {
                      const evH = isHybrid(fs.seed_type?.name || '');
                      const tagColor = evH ? '#1e40af' : GREEN.primary;
                      const tagBg    = evH ? '#eff6ff' : GREEN.light;
                      const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                      const sel = dForm.final_seed_id?.toString() === fs.id?.toString();
                      return (
                        <button key={fs.id} type="button"
                          onClick={() => setDForm(p => ({ ...p, final_seed_id: fs.id, season: fs.season || p.season, year: fs.year || p.year }))}
                          style={{ padding: '0.875rem', textAlign: 'left', border: `2px solid ${sel ? tagColor : '#e5e7eb'}`, borderRadius: '0.875rem', backgroundColor: sel ? tagBg : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                          <p style={{ fontWeight: 800, fontSize: '0.9rem', color: sel ? tagColor : '#374151', margin: 0 }}>{fs.seed_type?.name}</p>
                          <p style={{ fontSize: '0.68rem', color: sel ? tagColor : '#9ca3af', margin: '0.125rem 0 0.25rem', opacity: 0.9 }}>{evH ? 'Region (NRP/RFO)' : 'PhilRice (RCEF)'}</p>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {fs.varieties?.map(v => (
                              <span key={v.id} style={{ backgroundColor: sel ? `${tagColor}15` : '#f3f4f6', color: sel ? tagColor : '#6b7280', padding: '0.1rem 0.375rem', borderRadius: '999px', fontSize: '0.63rem', fontWeight: 600 }}>{v.name}</span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {dErrors.final_seed_id && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{dErrors.final_seed_id}</p>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Season <span style={{ color: '#dc2626' }}>*</span></label>
                <select value={dForm.season} onChange={e => { setDForm(p => ({ ...p, season: e.target.value })); setDErrors(p => ({ ...p, season: '' })); }} style={inp(!!dErrors.season)}>
                  <option value="">Select</option>
                  <option value="WET">Wet Season</option>
                  <option value="DRY">Dry Season</option>
                </select>
                {dErrors.season && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{dErrors.season}</p>}
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Year <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="number" value={dForm.year} onChange={e => { setDForm(p => ({ ...p, year: e.target.value })); setDErrors(p => ({ ...p, year: '' })); }} placeholder="2025" style={inp(!!dErrors.year)} />
                {dErrors.year && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{dErrors.year}</p>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Total Bags <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="number" min="1" value={dForm.total_bags} onChange={e => { setDForm(p => ({ ...p, total_bags: e.target.value })); setDErrors(p => ({ ...p, total_bags: '' })); }} placeholder="e.g. 500" style={inp(!!dErrors.total_bags)} />
                {dErrors.total_bags && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{dErrors.total_bags}</p>}
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Delivery Date <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="date" value={dForm.delivery_date} onChange={e => { setDForm(p => ({ ...p, delivery_date: e.target.value })); setDErrors(p => ({ ...p, delivery_date: '' })); }} style={inp(!!dErrors.delivery_date)} />
                {dErrors.delivery_date && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{dErrors.delivery_date}</p>}
              </div>
            </div>
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Lot Number</label>
              <input type="text" value={dForm.lot_number} onChange={e => setDForm(p => ({ ...p, lot_number: e.target.value }))} placeholder="e.g. LOT-2025-001" style={inp()} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Remarks</label>
              <textarea value={dForm.remarks} onChange={e => setDForm(p => ({ ...p, remarks: e.target.value }))} rows={2} placeholder="Optional notes..." style={{ ...inp(), resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeliveryModal(false)} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSaveDelivery} disabled={dSaving}
                style={{ flex: 2, padding: '0.875rem', backgroundColor: dSaving ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, cursor: dSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <CheckCircle size={16} /> {dSaving ? 'Saving...' : editDelivery ? 'Save Changes' : 'Record Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SCHEDULE DELIVERY MODAL (NEW) ══ */}
      {scheduleModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', width: '100%', maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', animation: 'modalSlideUp 0.3s cubic-bezier(0.34,1.1,0.64,1)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.5rem 1.75rem 1rem', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderRadius: '1.25rem 1.25rem 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: GREEN.light, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CalendarClock size={16} color={GREEN.primary} />
                    </div>
                    <h2 style={{ fontWeight: 800, fontSize: '1.15rem', margin: 0, color: '#1a1a1a' }}>
                      {editSchedule ? 'Edit Delivery Schedule' : 'Schedule Seed Delivery'}
                    </h2>
                  </div>
                  <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: 0, paddingLeft: '2.5rem' }}>
                    Select seed types to schedule. Data is saved per tab.
                  </p>
                </div>
                <button onClick={() => setScheduleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0.25rem', borderRadius: '0.5rem', display: 'flex', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#374151'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.75rem 1.75rem' }}>
              {/* No final seeds warning */}
              {finalSeeds.length === 0 ? (
                <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde68a', borderRadius: '0.875rem', padding: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <AlertCircle size={18} color="#854d0e" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <div>
                    <p style={{ fontWeight: 700, color: '#854d0e', margin: '0 0 0.25rem', fontSize: '0.875rem' }}>No Finalized Seeds Found</p>
                    <p style={{ color: '#92400e', fontSize: '0.78rem', margin: 0 }}>Finalize seed varieties in Seed Poll first before scheduling a delivery.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Step 1 label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: GREEN.primary, color: 'white', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: 0 }}>Choose seed type(s) to schedule</p>
                  </div>

                  {/* Seed type toggle tabs */}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${finalSeeds.length}, 1fr)`, gap: '0.625rem', marginBottom: '1.25rem' }}>
                    {finalSeeds.map(fs => {
                      const key    = fs.id?.toString();
                      const evH    = isHybrid(fs.seed_type?.name || '');
                      const tagColor  = evH ? '#1e40af' : GREEN.primary;
                      const tagBg     = evH ? '#eff6ff' : GREEN.light;
                      const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                      const isActive  = activeScheduleTab === key;
                      const hasData   = !!scheduleForms[key];
                      const hasErr    = !!(scheduleErrors[key] && Object.values(scheduleErrors[key]).some(Boolean));
                      return (
                        <button key={key} type="button" className="schedule-tab-btn"
                          onClick={() => handleScheduleTabToggle(fs)}
                          style={{
                            padding: '1rem',
                            textAlign: 'left',
                            border: `2px solid ${hasErr ? '#dc2626' : isActive ? tagColor : hasData ? tagBorder : '#e5e7eb'}`,
                            borderRadius: '0.875rem',
                            backgroundColor: isActive ? tagBg : hasData ? `${tagBg}80` : 'white',
                            cursor: 'pointer',
                            position: 'relative',
                            boxShadow: isActive ? `0 4px 12px ${tagColor}25` : 'none',
                          }}>
                          {/* Active indicator dot */}
                          {isActive && (
                            <div style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', width: 8, height: 8, borderRadius: '50%', backgroundColor: tagColor }} />
                          )}
                          {/* Has data checkmark */}
                          {hasData && !isActive && (
                            <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', width: 16, height: 16, borderRadius: '50%', backgroundColor: tagBg, border: `1.5px solid ${tagColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle size={10} color={tagColor} />
                            </div>
                          )}
                          <p style={{ fontWeight: 800, fontSize: '0.9rem', color: isActive ? tagColor : '#374151', margin: '0 0 0.125rem' }}>
                            {fs.seed_type?.name}
                          </p>
                          <p style={{ fontSize: '0.68rem', color: isActive ? tagColor : '#9ca3af', margin: '0 0 0.375rem', opacity: 0.9 }}>
                            {evH ? 'Region (NRP/RFO)' : 'PhilRice (RCEF)'}
                          </p>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {fs.varieties?.map(v => (
                              <span key={v.id} style={{ backgroundColor: isActive ? `${tagColor}20` : '#f3f4f6', color: isActive ? tagColor : '#6b7280', padding: '0.1rem 0.375rem', borderRadius: '999px', fontSize: '0.63rem', fontWeight: 600 }}>{v.name}</span>
                            ))}
                          </div>
                          {hasErr && <p style={{ fontSize: '0.65rem', color: '#dc2626', margin: '0.375rem 0 0', fontWeight: 600 }}>⚠ Fill required fields</p>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Step 2 — form for active tab */}
                  {activeScheduleTab && (() => {
                    const fs  = finalSeeds.find(s => s.id?.toString() === activeScheduleTab);
                    const key = activeScheduleTab;
                    const f   = scheduleForms[key] || {};
                    const errs = scheduleErrors[key] || {};
                    const evH  = isHybrid(fs?.seed_type?.name || '');
                    const tagColor = evH ? '#1e40af' : GREEN.primary;
                    const tagBg    = evH ? '#eff6ff' : GREEN.light;
                    const tagBorder = evH ? '#bfdbfe' : GREEN.border;

                    return (
                      <div style={{ animation: 'fadeIn 0.2s ease' }}>
                        {/* Step 2 label */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: tagColor, color: 'white', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</span>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: 0 }}>
                            Enter delivery details for <span style={{ color: tagColor }}>{fs?.seed_type?.name}</span>
                          </p>
                        </div>

                        {/* Seed info banner */}
                        <div style={{ backgroundColor: tagBg, border: `1px solid ${tagBorder}`, borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <Leaf size={15} color={tagColor} />
                          <div>
                            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: tagColor, margin: 0 }}>
                              {fs?.seed_type?.name} · {evH ? 'Region (NRP/RFO)' : 'PhilRice (RCEF)'}
                            </p>
                            <p style={{ fontSize: '0.68rem', color: tagColor, opacity: 0.8, margin: 0 }}>
                              Varieties: {fs?.varieties?.map(v => v.name).join(', ') || '—'}
                            </p>
                          </div>
                        </div>

                        {/* Season + Year */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Season <span style={{ color: '#dc2626' }}>*</span></label>
                            <select value={f.season || ''} onChange={e => updateScheduleForm(key, 'season', e.target.value)} style={inp(!!errs.season)}>
                              <option value="">Select</option>
                              <option value="WET">Wet Season</option>
                              <option value="DRY">Dry Season</option>
                            </select>
                            {errs.season && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errs.season}</p>}
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Year <span style={{ color: '#dc2626' }}>*</span></label>
                            <input type="number" value={f.year || ''} onChange={e => updateScheduleForm(key, 'year', e.target.value)} placeholder={new Date().getFullYear()} style={inp(!!errs.year)} />
                            {errs.year && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errs.year}</p>}
                          </div>
                        </div>

                        {/* Bags + Date */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Expected Bags <span style={{ color: '#dc2626' }}>*</span></label>
                            <input type="number" min="1" value={f.total_bags || ''} onChange={e => updateScheduleForm(key, 'total_bags', e.target.value)} placeholder="e.g. 500" style={inp(!!errs.total_bags)} />
                            {errs.total_bags && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errs.total_bags}</p>}
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Scheduled Date <span style={{ color: '#dc2626' }}>*</span></label>
                            <input type="date" value={f.delivery_date || ''} onChange={e => updateScheduleForm(key, 'delivery_date', e.target.value)} style={inp(!!errs.delivery_date)} />
                            {errs.delivery_date && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{errs.delivery_date}</p>}
                          </div>
                        </div>

                        {/* Lot + Remarks */}
                        <div style={{ marginBottom: '0.875rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Lot Number</label>
                          <input type="text" value={f.lot_number || ''} onChange={e => updateScheduleForm(key, 'lot_number', e.target.value)} placeholder="e.g. LOT-2026-001" style={inp()} />
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Remarks</label>
                          <textarea value={f.remarks || ''} onChange={e => updateScheduleForm(key, 'remarks', e.target.value)} rows={2} placeholder="Optional notes..." style={{ ...inp(), resize: 'vertical' }} />
                        </div>

                        {/* Multi-tab hint */}
                        {finalSeeds.length > 1 && (
                          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '0.625rem', padding: '0.625rem 0.875rem', fontSize: '0.72rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <AlertCircle size={12} color="#9ca3af" />
                            Click the other seed type above to fill its schedule too. Both will be saved together.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* No tab selected hint */}
                  {!activeScheduleTab && Object.keys(scheduleForms).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', backgroundColor: '#f9fafb', borderRadius: '0.875rem', border: '1.5px dashed #e5e7eb' }}>
                      <CalendarClock size={28} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.625rem' }} />
                      <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 0.25rem', fontSize: '0.875rem' }}>Select a seed type above</p>
                      <p style={{ fontSize: '0.78rem', margin: 0 }}>Click a seed type card to start entering schedule details.</p>
                    </div>
                  )}

                  {/* Summary of filled tabs */}
                  {Object.keys(scheduleForms).length > 0 && !activeScheduleTab && (
                    <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '0.5rem' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.8rem', color: GREEN.accent, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <CheckCircle size={14} /> Ready to save:
                      </p>
                      {Object.keys(scheduleForms).map(key => {
                        const fs = finalSeeds.find(s => s.id?.toString() === key);
                        const f  = scheduleForms[key];
                        return (
                          <div key={key} style={{ fontSize: '0.75rem', color: GREEN.accent, display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 700 }}>{fs?.seed_type?.name}</span>
                            <span style={{ color: '#6b7280' }}>·</span>
                            <span>{f.total_bags || '—'} bags</span>
                            <span style={{ color: '#6b7280' }}>·</span>
                            <span>{f.delivery_date ? new Date(f.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '1rem 1.75rem 1.5rem', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '0.75rem', position: 'sticky', bottom: 0, backgroundColor: 'white', borderRadius: '0 0 1.25rem 1.25rem' }}>
              <button onClick={() => setScheduleModal(false)} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Cancel</button>
              <button onClick={handleSaveSchedule} disabled={scheduleSaving || finalSeeds.length === 0}
                style={{ flex: 2, padding: '0.875rem', backgroundColor: (scheduleSaving || finalSeeds.length === 0) ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.875rem', cursor: (scheduleSaving || finalSeeds.length === 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'background 0.15s' }}>
                <CalendarClock size={16} />
                {scheduleSaving ? 'Saving...' : editSchedule ? 'Update Schedule' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ALLOCATION MODAL (unchanged) ══ */}
      {allocModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.75rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: 800, margin: 0 }}>Allocate Bags</h3>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{allocModal.remaining_bags} bags remaining</p>
              </div>
              <button onClick={() => setAllocModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#6b7280' }}>×</button>
            </div>
            <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: GREEN.accent }}>
              <strong>{allocModal.seed_type_name}</strong> · {allocModal.season_display} {allocModal.year} · {allocModal.remaining_bags} bags available
            </div>
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Barangay <span style={{ color: '#dc2626' }}>*</span></label>
              <select value={aForm.barangay} onChange={e => { setAForm(p => ({ ...p, barangay: e.target.value })); setAErrors(p => ({ ...p, barangay: '' })); }} style={{ ...inp(!!aErrors.barangay), cursor: 'pointer' }}>
                <option value="">Select barangay</option>
                {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {aErrors.barangay && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{aErrors.barangay}</p>}
            </div>
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Bags to Allocate <span style={{ color: '#dc2626' }}>*</span>
                <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '0.375rem' }}>max: {allocModal.remaining_bags}</span>
              </label>
              <input type="number" min="1" max={allocModal.remaining_bags} value={aForm.allocated_bags} onChange={e => { setAForm(p => ({ ...p, allocated_bags: e.target.value })); setAErrors(p => ({ ...p, allocated_bags: '' })); }} placeholder="e.g. 45" style={inp(!!aErrors.allocated_bags)} />
              {aErrors.allocated_bags && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{aErrors.allocated_bags}</p>}
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Notes</label>
              <input type="text" value={aForm.notes} onChange={e => setAForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" style={inp()} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setAllocModal(null)} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSaveAlloc} disabled={aSaving}
                style={{ flex: 2, padding: '0.75rem', backgroundColor: aSaving ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, cursor: aSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={16} /> {aSaving ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}