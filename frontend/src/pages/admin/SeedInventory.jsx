import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getInventorySummary, getSeedDeliveries, createSeedDelivery,
  updateSeedDelivery, deleteSeedDelivery, createAllocation,
  getDeliveryAudit, getFinalSeeds, getBeneficiaryAllocations,
} from '../../api/axios';
import {
  Plus, Package, ChevronRight, ChevronLeft, CheckCircle,
  AlertCircle, Search, Wheat, Truck, Users, Clock,
  ClipboardList, Edit2, Trash2, Eye, History, X,
  MapPin, Calendar, Hash, CalendarClock, Leaf, ArrowLeft,
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
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
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

const SCHEDULE_STORAGE_KEY = 'agrice_delivery_schedules';
const loadSchedules = () => {
  try { const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
};
const saveSchedulesToStorage = (schedules) => {
  try { localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedules)); } catch {}
};

// ── PROGRAM CARD with drill-down ──
const ProgramCard = ({
  schedule, sIdx, deliveries,
  onDeleteSchedule, onEditSchedule,
  onOpenVarietyDetail, onRecordDelivery,
  onEditEntry, onMarkDelivered,
  showToast,
}) => {
  const [drillSeedTypeKey, setDrillSeedTypeKey] = useState(null);

  // Group entries by actual seed type so each seed type has 1 card on top level
  const seedTypeGroups = {};
  schedule.entries.forEach(entry => {
    const k = entry.seedTypeDbId ? String(entry.seedTypeDbId) : entry.seedTypeName;
    if (!seedTypeGroups[k]) {
      seedTypeGroups[k] = {
        seedTypeId: k,
        seedTypeName: entry.seedTypeName,
        source: entry.source,
        entries: [],
      };
    }
    seedTypeGroups[k].entries.push(entry);
  });
  const seedTypeList = Object.values(seedTypeGroups);

  // Season/year label for program title — take from first entry
  const firstEntry = schedule.entries[0];
  const seasonLabel = firstEntry
    ? `${firstEntry.season === 'WET' ? 'Wet' : 'Dry'} Season ${firstEntry.year}`
    : '';

  const drillGroup = drillSeedTypeKey ? seedTypeGroups[drillSeedTypeKey] : null;

  // Fixed content height so program card doesn't resize
  const CONTENT_HEIGHT = '280px';

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '1rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
      border: '1px solid #e5e7eb', overflow: 'hidden',
      animation: `slideUp ${0.3 + sIdx * 0.06}s ease`,
    }}>
      {/* ── Program Header ── */}
      <div style={{
        backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb',
        padding: '0.875rem 1rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
          <CalendarClock size={16} color={GREEN.primary} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0, whiteSpace: 'nowrap' }}>
              Schedule #{sIdx + 1}
              {seasonLabel ? (
                <span style={{ fontWeight: 500, color: '#6b7280', fontSize: '0.78rem', marginLeft: '0.375rem' }}>· {seasonLabel}</span>
              ) : null}
            </p>
            <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>
              Created {new Date(schedule.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              {schedule.updatedAt !== schedule.createdAt && ` · Updated ${new Date(schedule.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '0.7rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.2rem 0.625rem', borderRadius: '999px', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {seedTypeList.length} seed type{seedTypeList.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => onDeleteSchedule(schedule.id)}
            style={{ padding: '0.375rem 0.5rem', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Content Area (fixed height, scrollable) ── */}
      <div style={{ height: CONTENT_HEIGHT, overflowY: 'auto', padding: '0.875rem 1rem', position: 'relative' }}>

        {/* ── SEED TYPE LIST VIEW ── */}
        {!drillGroup && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', animation: 'fadeIn 0.2s ease' }}>
            {seedTypeList.map(group => {
              const evH = isHybrid(group.seedTypeName || '');
              const tagColor  = evH ? '#1e40af' : GREEN.primary;
              const tagBg     = evH ? '#eff6ff' : GREEN.light;
              const tagBorder = evH ? '#bfdbfe' : GREEN.border;
              const totalBags = group.entries.reduce((s, e) => s + (Number(e.total_bags) || 0), 0);
              return (
                <div
                  key={group.seedTypeId}
                  onClick={() => setDrillSeedTypeKey(group.seedTypeId)}
                  className="card-hover"
                  style={{
                    border: `1.5px solid ${tagBorder}`,
                    borderRadius: '0.75rem',
                    backgroundColor: tagBg,
                    padding: '0.875rem 1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.18s',
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.375rem', alignItems: 'center' }}>
                      <span style={{ backgroundColor: 'white', color: tagColor, padding: '0.15rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                        {group.seedTypeName}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#6b7280', backgroundColor: 'white', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid #e5e7eb' }}>
                        {group.source}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: tagColor, fontWeight: 600, margin: 0, opacity: 0.85 }}>
                      {group.entries.map(e => e.varietyName).join(', ')}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.2rem 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {group.entries.length} variet{group.entries.length !== 1 ? 'ies' : 'y'} scheduled
                      <ChevronRight size={11} />
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: tagColor, margin: 0, lineHeight: 1 }}>{totalBags}</p>
                    <p style={{ fontSize: '0.62rem', color: '#9ca3af', margin: '0.1rem 0 0' }}>total bags</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── VARIETY DRILL-DOWN VIEW ── */}
        {drillGroup && (() => {
          const evH = isHybrid(drillGroup.seedTypeName || '');
          const tagColor  = evH ? '#1e40af' : GREEN.primary;
          const tagBg     = evH ? '#eff6ff' : GREEN.light;
          const tagBorder = evH ? '#bfdbfe' : GREEN.border;
          return (
            <div style={{ animation: 'fadeIn 0.2s ease' }}>
              {/* Back button */}
              <button
                onClick={() => setDrillSeedTypeKey(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: tagColor, fontWeight: 700, fontSize: '0.78rem',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0 0 0.625rem 0', marginBottom: '0.625rem',
                  borderBottom: `1px solid ${tagBorder}`,
                  width: '100%',
                }}>
                <ArrowLeft size={14} />
                Back to seed types
              </button>

              {/* Seed type label */}
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.625rem', alignItems: 'center' }}>
                <span style={{ backgroundColor: tagBg, color: tagColor, padding: '0.15rem 0.625rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, border: `1px solid ${tagBorder}` }}>
                  {drillGroup.seedTypeName}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#6b7280', backgroundColor: '#f9fafb', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid #e5e7eb' }}>
                  {drillGroup.source}
                </span>
              </div>

              {/* Variety cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {drillGroup.entries.map((entry, eIdx) => {
                  const isDelivered = entry.status === 'DELIVERED';
                  // Try to find matching backend delivery for detail view
                  const matchedDelivery = deliveries.find(d => {
                    const normalize = text => text?.toString().toLowerCase().trim();
                    const nameA = normalize(d.seed_type_name);
                    const nameB = normalize(entry.seedTypeName);
                    const varA = normalize(d.variety_name);
                    const varB = normalize(entry.varietyName);
                    const seasonMatch = d.season === entry.season;
                    const yearMatch = Number(d.year) === Number(entry.year);

                    const dbIdMatch = entry.seedTypeDbId
                      ? String(d.seed_type) === String(entry.seedTypeDbId)
                      : false;

                    const nameMatch = nameA && nameB && (
                      nameA === nameB ||
                      nameA.includes(nameB) ||
                      nameB.includes(nameA)
                    );

                    const entryVarieties = varB
                      ? varB.split(',').map(v => v.trim()).filter(Boolean)
                      : [];
                    const varietyMatch = varA && entryVarieties.length > 0 &&
                      entryVarieties.some(ev => ev === varA || varA.includes(ev) || ev.includes(varA));

                    if (dbIdMatch && seasonMatch && yearMatch) return true;
                    if (nameMatch && seasonMatch && yearMatch) return true;
                    if (varietyMatch && seasonMatch && yearMatch) return true;
                    return false;
                  });
                  return (
                    <div
                      key={eIdx}
                      onClick={() => {
                        onOpenVarietyDetail(matchedDelivery || null, entry);
                      }}
                      className="card-hover"
                      style={{
                        border: `1.5px solid ${isDelivered ? GREEN.border : tagBorder}`,
                        borderRadius: '0.75rem',
                        backgroundColor: isDelivered ? GREEN.light : 'white',
                        padding: '0.875rem 1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        transition: 'all 0.18s',
                      }}>
                      {/* Left */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.375rem', alignItems: 'center' }}>
                          <StatusBadge status={entry.status} />
                        </div>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: '0 0 0.3rem', wordBreak: 'break-word' }}>
                          {entry.varietyName}
                        </p>
                        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', fontSize: '0.7rem', color: '#6b7280', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Calendar size={10} />
                            {new Date(entry.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Package size={10} />
                            {entry.total_bags} bags
                          </span>
                          {entry.lot_number && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Hash size={10} /> {entry.lot_number}
                            </span>
                          )}
                        </div>
                        {entry.remarks && (
                          <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '0.3rem 0 0', fontStyle: 'italic', wordBreak: 'break-word' }}>
                            {entry.remarks}
                          </p>
                        )}
                      </div>
                      {/* Right */}
                      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                        <p style={{ fontSize: '1.375rem', fontWeight: 800, color: tagColor, margin: 0, lineHeight: 1 }}>{entry.total_bags}</p>
                        <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: 0 }}>total bags</p>
                        {matchedDelivery && (
                          <span style={{ fontSize: '0.65rem', color: tagColor, display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                            View details <ChevronRight size={10} />
                          </span>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={e => { e.stopPropagation(); onEditEntry(entry); }}
                            style={{ padding: '0.35rem 0.65rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '0.55rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Edit2 size={12} /> Edit
                          </button>
                          {entry.status !== 'DELIVERED' && (
                            <button
                              onClick={e => { e.stopPropagation(); onMarkDelivered(entry, matchedDelivery); }}
                              style={{ padding: '0.35rem 0.65rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.55rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle size={12} /> Delivered
                            </button>
                          )}
                          {entry.status === 'DELIVERED' && (
                            <span style={{ padding: '0.35rem 0.65rem', backgroundColor: GREEN.soft, color: GREEN.accent, borderRadius: '0.55rem', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle size={12} /> Done
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
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
  const [historyFilter, setHistoryFilter] = useState({ season: '', year: '' });
  const [historySearch, setHistorySearch] = useState('');

  const [deliveryModal, setDeliveryModal] = useState(false);
  const [editDelivery, setEditDelivery]   = useState(null);
  const [allocModal, setAllocModal]       = useState(null);
  const [confirmSnack, setConfirmSnack]   = useState(null);
  const [toast, setToast]                 = useState(null);

  const [dForm, setDForm]             = useState({ final_seed_id: '', variety_id: '', season: '', year: '', total_bags: '', delivery_date: '', lot_number: '', remarks: '' });
  const [dErrors, setDErrors]         = useState({});
  const [dSaving, setDSaving]         = useState(false);

  const [aForm, setAForm]             = useState({ barangay: '', allocated_bags: '', notes: '' });
  const [aErrors, setAErrors]         = useState({});
  const [aSaving, setASaving]         = useState(false);

  const [scheduleModal, setScheduleModal]         = useState(false);
  const [editSchedule, setEditSchedule]           = useState(null);
  const [activeScheduleTab, setActiveScheduleTab] = useState(null);
  const [scheduleForms, setScheduleForms]         = useState({});
  const [scheduleErrors, setScheduleErrors]       = useState({});
  const [scheduleSaving, setScheduleSaving]       = useState(false);
  const [schedules, setSchedules]                 = useState(loadSchedules);
  const [deliveredModal, setDeliveredModal]       = useState(null);
  const [deliveredForm, setDeliveredForm]         = useState({ confirmed: null, actual_bags: '' });
  const [deliveredSaving, setDeliveredSaving]     = useState(false);
  const [brgyAllocCards, setBrgyAllocCards]       = useState([]);
  const [brgyAllocLoading, setBrgyAllocLoading]   = useState(false);
  const [expandedBrgyCard, setExpandedBrgyCard]   = useState(null);
  const [brgyPages, setBrgyPages]                 = useState({});

  const FARMERS_PER_PAGE = 10;
  const getPage = useCallback((brgy) => brgyPages[brgy] || 1, [brgyPages]);
  const setPage = useCallback((brgy, page) => setBrgyPages(prev => ({ ...prev, [brgy]: page })), []);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const [delRes, sumRes] = await Promise.all([getSeedDeliveries(), getInventorySummary()]);
      setDeliveries(delRes.data || []);
      setSummary(sumRes.data);
      setSelected(prev => {
        if (!prev || !prev.id) return prev;
        const updated = (delRes.data || []).find(d => d.id === prev.id);
        if (!updated) return prev;
        return {
          ...updated,
          _fromSchedule: prev._fromSchedule,
          _scheduleEntry: prev._scheduleEntry,
          scheduled_bags: prev.scheduled_bags ?? updated.total_bags,
          _deliveredBags: updated.total_bags ?? prev._deliveredBags ?? 0,
        };
      });
    } catch (err) {
      showToast('error', err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to load inventory data.');
      setDeliveries([]); setSummary(null);
    } finally { setLoading(false); }
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

  const loadBrgyAllocCards = useCallback(async (scheduleEntry, delivery) => {
    setBrgyAllocCards([]);
    setBrgyAllocLoading(true);
    setExpandedBrgyCard(null);
    try {
      const params = {};
      const seedTypeId = scheduleEntry?.seedTypeDbId || delivery?.seed_type;
      const varietyId = scheduleEntry?.varietyId || delivery?.variety;
      const season = scheduleEntry?.season || delivery?.season;
      const year = scheduleEntry?.year || delivery?.year;

      if (seedTypeId) params.seed_type_id = seedTypeId;
      if (varietyId) params.variety_id = varietyId;
      if (season) params.season = season;
      if (year) params.year = year;

      const res = await getBeneficiaryAllocations(params);
      setBrgyAllocCards(res.data || []);
    } catch {
      setBrgyAllocCards([]);
    } finally {
      setBrgyAllocLoading(false);
    }
  }, []);

  useEffect(() => { loadInventory(); loadFinalSeeds(); }, [loadInventory, loadFinalSeeds]);

  const openDetail = (delivery, scheduleEntry) => {
    if (delivery && scheduleEntry) {
      setSelected({
        ...delivery,
        variety_name: scheduleEntry.varietyName || delivery.variety_name,
        seed_type_name: scheduleEntry.seedTypeName || delivery.seed_type_name,
        scheduled_bags: scheduleEntry.total_bags,
        _scheduleEntry: scheduleEntry,
        _fromSchedule: false,
        _deliveredBags: delivery.total_bags ?? 0,
      });
    } else if (scheduleEntry) {
      setSelected({
        _fromSchedule: true,
        _scheduleEntry: scheduleEntry,
        id: null,
        seed_type: scheduleEntry.seedTypeDbId,
        seed_type_name: scheduleEntry.seedTypeName,
        variety_name: scheduleEntry.varietyName,
        season: scheduleEntry.season,
        season_display: scheduleEntry.season === 'WET' ? 'Wet Season' : 'Dry Season',
        year: scheduleEntry.year,
        source: scheduleEntry.source,
        total_bags: 0,
        allocated_bags: 0,
        remaining_bags: 0,
        scheduled_bags: scheduleEntry.total_bags,
        delivery_date: scheduleEntry.delivery_date,
        lot_number: scheduleEntry.lot_number || null,
        remarks: scheduleEntry.remarks || null,
        encoded_by_name: null,
        allocations: [],
      });
    } else if (delivery) {
      setSelected({
        ...delivery,
        _deliveredBags: delivery.total_bags ?? 0,
      });
    }
    // Load brgy allocation cards
    setBrgyAllocCards([]);
    setExpandedBrgyCard(null);
    loadBrgyAllocCards(scheduleEntry, delivery);
    setView('detail');
  };
  const openAudit = async (delivery) => {
    setSelected(delivery); setView('audit'); setAuditLoading(true);
    try { const res = await getDeliveryAudit(delivery.id); setAuditLogs(res.data || []); }
    catch { setAuditLogs([]); } finally { setAuditLoading(false); }
  };

  const openHistory = () => {
    setView('history');
  };

  const openEditDelivery = (delivery) => {
    setEditDelivery(delivery);
    setDForm({ final_seed_id: delivery.seed_type, variety_id: delivery.variety || '', season: delivery.season, year: delivery.year, total_bags: delivery.total_bags, delivery_date: delivery.delivery_date, lot_number: delivery.lot_number || '', remarks: delivery.remarks || '' });
    setDErrors({}); setDeliveryModal(true);
  };

  const openRecordDeliveryFromEntry = async (entry) => {
    setEditDelivery(null);
    let availableFinalSeeds = finalSeeds;
    if (!availableFinalSeeds.length) {
      await loadFinalSeeds();
      try {
        const res = await getFinalSeeds();
        availableFinalSeeds = res.data || [];
      } catch {
        availableFinalSeeds = [];
      }
    }
    const matchedFs = availableFinalSeeds.find(fs =>
      entry.seedTypeDbId
        ? String(fs.seed_type?.id) === String(entry.seedTypeDbId)
        : fs.seed_type?.name?.toLowerCase().trim() === entry.seedTypeName?.toLowerCase().trim()
    );
    const matchedVariety = matchedFs?.varieties?.find(v =>
      String(v.id) === String(entry.varietyId) || v.name?.toLowerCase().trim() === entry.varietyName?.toLowerCase().trim()
    );
    setDForm({
      final_seed_id: matchedFs?.id || '',
      variety_id: matchedVariety?.id || '',
      season: entry.season || '',
      year: entry.year || new Date().getFullYear(),
      total_bags: entry.total_bags || '',
      delivery_date: entry.delivery_date || '',
      lot_number: entry.lot_number || '',
      remarks: entry.remarks || '',
    });
    setDErrors({});
    setDeliveryModal(true);
  };

  const openEditEntryFromCard = async (entry) => {
    setEditDelivery({ _fromEntry: true, _entry: entry });
    let availableFinalSeeds = finalSeeds;
    if (!availableFinalSeeds.length) {
      await loadFinalSeeds();
      try {
        const res = await getFinalSeeds();
        availableFinalSeeds = res.data || [];
      } catch {
        availableFinalSeeds = [];
      }
    }
    const matchedFs = availableFinalSeeds.find(fs =>
      entry.seedTypeDbId
        ? String(fs.seed_type?.id) === String(entry.seedTypeDbId)
        : fs.seed_type?.name?.toLowerCase().trim() === entry.seedTypeName?.toLowerCase().trim()
    );
    const matchedVariety = matchedFs?.varieties?.find(v =>
      String(v.id) === String(entry.varietyId) ||
      v.name?.toLowerCase().trim() === entry.varietyName?.toLowerCase().trim()
    );
    setDForm({
      final_seed_id: matchedFs?.id || '',
      variety_id: matchedVariety?.id || '',
      _lockedSeedTypeId: matchedFs?.id || '',
      _lockedVarietyId: matchedVariety?.id || '',
      _seedTypeName: entry.seedTypeName,
      _varietyName: entry.varietyName,
      season: entry.season || '',
      year: entry.year || new Date().getFullYear(),
      total_bags: entry.total_bags || '',
      delivery_date: entry.delivery_date || '',
      lot_number: entry.lot_number || '',
      remarks: entry.remarks || '',
    });
    setDErrors({});
    setDeliveryModal(true);
  };

  const openDeliveredModal = (entry, matchedDelivery) => {
    setDeliveredModal({ entry, matchedDelivery });
    setDeliveredForm({ confirmed: null, actual_bags: '' });
  };

  const handleConfirmDelivered = async () => {
    if (!deliveredModal) return;
    const { entry, matchedDelivery } = deliveredModal;
    const actualBags = deliveredForm.confirmed === true ? Number(entry.total_bags) : Number(deliveredForm.actual_bags);
    if (deliveredForm.confirmed === null) {
      showToast('error', 'Please choose whether the delivered bags are correct.');
      return;
    }
    if (deliveredForm.confirmed === false && (!deliveredForm.actual_bags || Number(deliveredForm.actual_bags) <= 0)) {
      showToast('error', 'Please enter the actual number of bags delivered.');
      return;
    }
    setDeliveredSaving(true);
    try {
      const seedName = (matchedDelivery?.seed_type_name || entry.seedTypeName || '').toUpperCase();
      const source = (seedName.includes('HYBRID') || seedName === 'NRP' || seedName === 'RFO') ? 'REGION' : 'PHILRICE';

      if (matchedDelivery) {
        await updateSeedDelivery(matchedDelivery.id, {
          seed_type: matchedDelivery.seed_type,
          variety: matchedDelivery.variety,
          season: matchedDelivery.season,
          year: matchedDelivery.year,
          source,
          total_bags: actualBags,
          delivery_date: matchedDelivery.delivery_date,
          lot_number: matchedDelivery.lot_number,
          remarks: matchedDelivery.remarks,
          status: 'DELIVERED',
        });
      } else {
        if (!finalSeeds.length) await loadFinalSeeds();
        const matchedFs = finalSeeds.find(fs =>
          entry.seedTypeDbId
            ? String(fs.seed_type?.id) === String(entry.seedTypeDbId)
            : fs.seed_type?.name?.toLowerCase().trim() === entry.seedTypeName?.toLowerCase().trim()
        );
        const matchedVariety = matchedFs?.varieties?.find(v =>
          String(v.id) === String(entry.varietyId) || v.name?.toLowerCase().trim() === entry.varietyName?.toLowerCase().trim()
        );
        await createSeedDelivery({
          seed_type: matchedFs?.seed_type?.id,
          variety: matchedVariety?.id,
          season: entry.season,
          year: Number(entry.year),
          source,
          total_bags: actualBags,
          delivery_date: entry.delivery_date,
          lot_number: entry.lot_number,
          remarks: entry.remarks,
          status: 'DELIVERED',
        });
      }

      const updatedSchedules = schedules.map(s => ({
        ...s,
        entries: s.entries.map(e =>
          e.seedTypeId === entry.seedTypeId
            ? { ...e, status: 'DELIVERED', total_bags: actualBags }
            : e
        ),
      }));
      setSchedules(updatedSchedules);
      saveSchedulesToStorage(updatedSchedules);
      showToast('success', `Delivery confirmed — ${actualBags} bags for ${entry.varietyName}.`);

      try {
        const deliveredKey = 'agrice_seed_delivered_trigger';
        const payload = JSON.stringify({
          seedTypeName: entry.seedTypeName,
          varietyName: entry.varietyName,
          season: entry.season,
          year: entry.year,
          actualBags,
          timestamp: Date.now(),
        });
        localStorage.setItem(deliveredKey, payload);
        window.dispatchEvent(new StorageEvent('storage', {
          key: deliveredKey,
          newValue: payload,
          storageArea: localStorage,
        }));
      } catch {}
      setDeliveredModal(null);
      setSelected(prev => prev ? { ...prev, _deliveredBags: actualBags } : prev);
      await loadInventory();
    } catch (err) {
      showToast('error', err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to confirm delivery.');
    } finally {
      setDeliveredSaving(false);
    }
  };

  const handleSaveDelivery = async () => {
    const errs = {};
    if (!dForm.season)        errs.season        = 'Required';
    if (!dForm.year)          errs.year          = 'Required';
    if (!dForm.total_bags)    errs.total_bags    = 'Required';
    if (!dForm.delivery_date) errs.delivery_date = 'Required';
    if (!editDelivery && !dForm.final_seed_id) errs.final_seed_id = 'Select seed type';
    const selectedFS = finalSeeds.find(fs => fs.id?.toString() === dForm.final_seed_id?.toString());
    if (!editDelivery && selectedFS?.varieties?.length > 1 && !dForm.variety_id) errs.variety_id = 'Select a variety';
    if (Object.keys(errs).length > 0) { setDErrors(errs); return; }
    setDSaving(true);
    try {
      const selectedFS = finalSeeds.find(fs => fs.id?.toString() === dForm.final_seed_id?.toString());
      const matchedVariety = selectedFS?.varieties?.find(v => String(v.id) === String(dForm.variety_id)) || selectedFS?.varieties?.[0];

      if (editDelivery?._fromEntry) {
        const entry = editDelivery._entry;
        const updatedSchedules = schedules.map(s => ({
          ...s,
          entries: s.entries.map(e =>
            e.seedTypeId === entry.seedTypeId
              ? {
                  ...e,
                  season: dForm.season,
                  year: Number(dForm.year),
                  total_bags: Number(dForm.total_bags),
                  delivery_date: dForm.delivery_date,
                  lot_number: dForm.lot_number,
                  remarks: dForm.remarks,
                }
              : e
          ),
        }));
        setSchedules(updatedSchedules);
        saveSchedulesToStorage(updatedSchedules);
        showToast('success', 'Schedule entry updated.');
        setDeliveryModal(false);

        if (selected && selected._scheduleEntry?.seedTypeId === entry.seedTypeId) {
          const updatedEntry = updatedSchedules.flatMap(s => s.entries).find(e => e.seedTypeId === entry.seedTypeId);
          if (updatedEntry) {
            setSelected(prev => ({
              ...prev,
              scheduled_bags: updatedEntry.total_bags,
              delivery_date: updatedEntry.delivery_date,
              lot_number: updatedEntry.lot_number,
              remarks: updatedEntry.remarks,
              season: updatedEntry.season,
              year: updatedEntry.year,
              _scheduleEntry: updatedEntry,
            }));
          }
        }

        return;
      }

      const payload = { seed_type: selectedFS?.seed_type?.id || editDelivery?.seed_type, variety: matchedVariety?.id || editDelivery?.variety, season: dForm.season, year: Number(dForm.year), total_bags: Number(dForm.total_bags), delivery_date: dForm.delivery_date, lot_number: dForm.lot_number, remarks: dForm.remarks };
      if (editDelivery) { await updateSeedDelivery(editDelivery.id, payload); showToast('success', 'Delivery record updated.'); }
      else { await createSeedDelivery(payload); showToast('success', 'Seed delivery recorded successfully.'); }
      setDeliveryModal(false); await loadInventory();
      if (selected) { const res = await getSeedDeliveries(); const updated = (res.data || []).find(d => d.id === selected.id); if (updated) setSelected(updated); }
    } catch (err) { showToast('error', err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to save delivery.'); }
    finally { setDSaving(false); }
  };

  const handleDeleteDelivery = (delivery) => {
    setConfirmSnack({ title: `Delete this delivery record?`, message: `${delivery.seed_type_name} — ${delivery.season_display} ${delivery.year}. This cannot be undone.`, confirmLabel: 'Delete', danger: true,
      _action: async () => { try { await deleteSeedDelivery(delivery.id); showToast('success', 'Delivery deleted.'); setView('landing'); await loadInventory(); } catch (err) { showToast('error', err.response?.data?.error || 'Failed to delete.'); } },
    });
  };

  const openAllocModal = (delivery) => { setAllocModal(delivery); setAForm({ barangay: '', allocated_bags: '', notes: '' }); setAErrors({}); };

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
      const res = await getSeedDeliveries(); setDeliveries(res.data || []);
      const updated = (res.data || []).find(d => d.id === allocModal.id); if (updated) setSelected(updated);
    } catch (err) { showToast('error', err.response?.data?.error || 'Failed to allocate.'); }
    finally { setASaving(false); }
  };

  const openScheduleModal = async () => {
    setEditSchedule(null);
    if (!finalSeeds.length) await loadFinalSeeds();
    setScheduleErrors({}); setActiveScheduleTab(null);
    setScheduleForms({});
    setScheduleModal(true);
  };

  const openEditSchedule = (schedule) => {
    setEditSchedule(schedule);
    const forms = {};
    schedule.entries.forEach(entry => {
      const seedTypeKey = entry.seedTypeId;
      const fs = finalSeeds.find(s => s.id?.toString() === seedTypeKey);
      const scheduleKey = seedTypeKey?.includes('::')
        ? seedTypeKey
        : fs?.varieties?.length === 1
          ? `${seedTypeKey}::${fs.varieties[0].id}::${fs.varieties[0].name}`
          : seedTypeKey;
      forms[scheduleKey] = {
        total_bags: entry.total_bags,
        delivery_date: entry.delivery_date,
        lot_number: entry.lot_number || '',
        remarks: entry.remarks || '',
        season: entry.season,
        year: entry.year,
      };
    });
    const firstEntryKey = schedule.entries[0]?.seedTypeId;
    const firstFs = finalSeeds.find(s => s.id?.toString() === firstEntryKey);
    const activeKey = firstEntryKey?.includes('::')
      ? firstEntryKey
      : firstFs?.varieties?.length === 1
        ? `${firstEntryKey}::${firstFs.varieties[0].id}::${firstFs.varieties[0].name}`
        : firstEntryKey;
    setScheduleForms(forms); setScheduleErrors({});
    setActiveScheduleTab(activeKey || null); setScheduleModal(true);
  };

  const handleScheduleTabToggle = (fs) => {
    const seedTypeKey = fs.id?.toString();
    if (activeScheduleTab === seedTypeKey) {
      setActiveScheduleTab(null);
    } else {
      if (fs.varieties?.length === 1) {
        const variety = fs.varieties[0];
        const key = `${seedTypeKey}::${variety.id}::${variety.name}`;
        setActiveScheduleTab(key);
        if (!scheduleForms[key]) {
          setScheduleForms(prev => ({
            ...prev,
            [key]: {
              total_bags: '',
              delivery_date: '',
              lot_number: '',
              remarks: '',
              season: fs.season || '',
              year: fs.year || new Date().getFullYear(),
            },
          }));
        }
      } else {
        setActiveScheduleTab(seedTypeKey);
      }
    }
    setScheduleErrors(prev => ({ ...prev, [seedTypeKey]: {} }));
  };

  const updateScheduleForm = (fsId, field, value) => {
    const key = fsId?.toString();
    setScheduleForms(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));
    setScheduleErrors(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: '' } }));
  };

  const handleSaveSchedule = () => {
    const openedKeys = Object.keys(scheduleForms);
    if (openedKeys.length === 0) { showToast('error', 'Please select at least one seed variety to schedule.'); return; }
    let hasError = false; const newErrors = {};
    openedKeys.forEach(key => {
      const f = scheduleForms[key] || {}; const errs = {};
      if (!f.total_bags)    errs.total_bags    = 'Required';
      if (!f.delivery_date) errs.delivery_date = 'Required';
      if (!f.season)        errs.season        = 'Required';
      if (!f.year)          errs.year          = 'Required';
      if (Object.keys(errs).length > 0) { newErrors[key] = errs; hasError = true; }
    });
    if (hasError) { setScheduleErrors(newErrors); setActiveScheduleTab(Object.keys(newErrors)[0]); showToast('error', 'Please fill all required fields.'); return; }
    setScheduleSaving(true);

    const entries = openedKeys.map(key => {
      const [fsId, varietyId, varietyName] = key.split('::');
      const fs = finalSeeds.find(s => s.id?.toString() === fsId);
      const f = scheduleForms[key];
      return {
        seedTypeId:    key,
        seedTypeDbId:  fs?.seed_type?.id ?? null,
        seedTypeName:  fs?.seed_type?.name || 'Unknown',
        varietyId:     varietyId || null,
        varietyName:   varietyName || '—',
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
    const firstEntry = entries[0];
    const existingSchedule = schedules.find(s =>
      s.entries.some(
        e => e.season === firstEntry.season && String(e.year) === String(firstEntry.year)
      )
    );

    if (existingSchedule) {
      const existingEntries = existingSchedule.entries.filter(
        existing => !entries.find(e =>
          e.seedTypeId === existing.seedTypeId
        )
      );
      const mergedEntries = [...existingEntries, ...entries];
      updated = schedules.map(s =>
        s.id === existingSchedule.id
          ? { ...s, entries: mergedEntries, updatedAt: new Date().toISOString() }
          : s
      );
      showToast('success', `Added to existing Schedule — ${firstEntry.season === 'WET' ? 'Wet' : 'Dry'} Season ${firstEntry.year}.`);
    } else {
      const newSchedule = { id: Date.now(), entries, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      updated = [...schedules, newSchedule];
      showToast('success', `Delivery program saved with ${entries.length} variet${entries.length !== 1 ? 'ies' : 'y'}.`);
    }

    setSchedules(updated); saveSchedulesToStorage(updated); setScheduleModal(false); setScheduleSaving(false);
  };

  const handleDeleteSchedule = (scheduleId) => {
    setConfirmSnack({ title: 'Delete this schedule?', message: 'This delivery program will be permanently removed.', confirmLabel: 'Delete', danger: true,
      _action: () => { const updated = schedules.filter(s => s.id !== scheduleId); setSchedules(updated); saveSchedulesToStorage(updated); showToast('success', 'Schedule deleted.'); },
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
        .card-hover:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; transform: translateY(-1px); transition: all 0.18s; }
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
            {view === 'detail' ? `${selected?.seed_type_name} — ${selected?.season_display} ${selected?.year}` : view === 'history' ? 'View History' : 'Audit Trail'}
          </span>
        </div>
      )}

      {/* ══ LANDING ══ */}
      {view === 'landing' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          {/* Header — Schedule Delivery button ONLY */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Seed Inventory</h1>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Track seed deliveries and barangay allocations.</p>
            </div>
            <button onClick={openScheduleModal}
              style={{ padding: '0.625rem 1.125rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = GREEN.accent}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = GREEN.primary}>
              <CalendarClock size={16} /> Schedule Delivery
            </button>
          </div>

          {(() => {
            const allEntries = schedules.flatMap(s => s.entries || []);
            const totalScheduled = allEntries.length;
            const confirmedEntries = allEntries.filter(e => e.status === 'DELIVERED');
            const pendingEntries = allEntries.filter(e => e.status !== 'DELIVERED');
            const totalDeliveriesLabel = totalScheduled > 0 ? `${confirmedEntries.length}/${totalScheduled}` : '0';
            const bagsReceived = confirmedEntries.reduce((sum, e) => sum + (Number(e.total_bags) || 0), 0);
            const bagsAllocated = summary?.total_bags_allocated ?? 0;
            const pendingCount = pendingEntries.length;
            const confirmedCount = confirmedEntries.length;

            const tiles = [
              { label: 'Total Deliveries',  value: totalDeliveriesLabel, Icon: Truck,       color: '#1e40af', bg: '#eff6ff' },
              { label: 'Bags Received',     value: bagsReceived,   Icon: Package,     color: GREEN.primary, bg: GREEN.light },
              { label: 'Bags Allocated',    value: bagsAllocated,  Icon: Users,       color: '#854d0e', bg: '#fef9c3' },
              { label: 'Pending Pickups',   value: pendingCount,   Icon: Clock,       color: '#854d0e', bg: '#fff7ed' },
              { label: 'Confirmed Pickups', value: confirmedCount, Icon: CheckCircle, color: GREEN.accent, bg: GREEN.light },
            ];

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
                {tiles.map(({ label, value, Icon, color, bg }, i) => (
                  <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', animation: `slideUp ${0.3 + i * 0.04}s ease` }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                      <Icon size={16} color={color} />
                    </div>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: '0 0 0.125rem', lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
                  </div>
                ))}
              </div>
            );
          })()}

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
                  {s === 'WET' ? ' Wet Season' : ' Dry Season'}
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

          {/* ══ DELIVERY PROGRAM SECTION ══ */}
          {schedules.length > 0 && (
            <div style={{ marginTop: '0.5rem', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: 4, height: 28, backgroundColor: GREEN.primary, borderRadius: '999px', flexShrink: 0 }} />
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Delivery Program</h2>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>Scheduled seed variety deliveries</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button onClick={openHistory}
                    style={{ padding: '0.4rem 0.75rem', backgroundColor: 'white', color: GREEN.primary, border: `1.5px solid ${GREEN.border}`, borderRadius: '999px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <History size={13} /> View History
                  </button>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '0.25rem 0.75rem', borderRadius: '999px', fontWeight: 600 }}>
                    {schedules.length} program{schedules.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {schedules.map((schedule, sIdx) => (
                  <ProgramCard
                    key={schedule.id}
                    schedule={schedule}
                    sIdx={sIdx}
                    deliveries={deliveries}
                    onDeleteSchedule={handleDeleteSchedule}
                    onEditSchedule={openEditSchedule}
                    onOpenVarietyDetail={openDetail}
                    onRecordDelivery={openRecordDeliveryFromEntry}
                    onEditEntry={openEditEntryFromCard}
                    onMarkDelivered={openDeliveredModal}
                    showToast={showToast}
                  />
                ))}
              </div>
            </div>
          )}

          {schedules.length === 0 && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', marginTop: '0.5rem' }}>
              <CalendarClock size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No delivery programs yet</p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>Schedule a seed delivery using the button above.</p>
              <button onClick={openScheduleModal}
                style={{ padding: '0.625rem 1.25rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <CalendarClock size={15} /> Schedule Delivery
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ DETAIL VIEW ══ */}
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
              <div />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1.25rem' }}>
              {[
                { label: 'Expected Bags', value: selected.scheduled_bags ?? selected.total_bags ?? 0 },
                { label: 'Bags Delivered', value: selected._deliveredBags ?? (selected._fromSchedule ? 0 : 0) },
                { label: 'Allocated', value: selected.allocated_bags ?? 0 },
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
          {/* ══ BRGY BENEFICIARY ALLOCATION CARDS ══ */}
          <div style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
                  <div style={{ width: 4, height: 24, backgroundColor: '#1e40af', borderRadius: '999px' }} />
                  <div>
                    <h2 style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1a1a', margin: 0 }}>Barangay Beneficiary Allocation</h2>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>Mga barangay na may approved beneficiary batch para sa seed variety na ito</p>
                  </div>
                </div>

                {brgyAllocLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem', backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #f3f4f6', color: '#9ca3af', fontSize: '0.875rem' }}>
                    <div style={{ width: 18, height: 18, border: `2px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                    Loading barangay beneficiary data...
                  </div>
                )}

                {!brgyAllocLoading && brgyAllocCards.length === 0 && (
                  <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
                    <Users size={32} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
                    <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.25rem', fontSize: '0.875rem' }}>Walang approved beneficiary batch</p>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Lalabas dito ang mga barangay kapag may na-approve nang batch sa Beneficiaries menu para sa seed variety na ito.</p>
                  </div>
                )}

                {!brgyAllocLoading && brgyAllocCards.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {brgyAllocCards.map((card, idx) => {
                      const isExpanded = expandedBrgyCard === card.barangay;
                      const currentPage = getPage(card.barangay);
                      const totalPages = Math.max(1, Math.ceil(card.farmers.length / FARMERS_PER_PAGE));
                      const pageStart = (currentPage - 1) * FARMERS_PER_PAGE;
                      const pageFarmers = card.farmers.slice(pageStart, pageStart + FARMERS_PER_PAGE);

                      return (
                        <div key={card.barangay} style={{ backgroundColor: 'white', borderRadius: '1rem', border: `1.5px solid ${isExpanded ? '#1e40af' : GREEN.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: `slideUp ${0.3 + idx * 0.05}s ease` }}>
                          <div
                            onClick={() => {
                              setExpandedBrgyCard(isExpanded ? null : card.barangay);
                              setPage(card.barangay, 1);
                            }}
                            className="card-hover"
                            style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', backgroundColor: isExpanded ? '#eff6ff' : 'white', transition: 'background 0.15s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: isExpanded ? '#1e40af' : GREEN.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <MapPin size={16} color="white" />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1a1a1a', margin: 0 }}>Brgy. {card.barangay}</p>
                                {card.alloc_status && (
                                  <span style={{
                                    display: 'inline-block',
                                    marginTop: '0.2rem',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '999px',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    backgroundColor: card.alloc_status === 'CONFIRMED' ? '#dcfce7' : '#fef9c3',
                                    color: card.alloc_status === 'CONFIRMED' ? '#166534' : '#854d0e',
                                    border: `1px solid ${card.alloc_status === 'CONFIRMED' ? '#bbf7d0' : '#fde68a'}`,
                                  }}>
                                    {card.alloc_status === 'CONFIRMED' ? '✓ Confirmed' : ' Pending'}
                                  </span>
                                )}
                                <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span style={{ backgroundColor: card.season === 'WET' ? '#eff6ff' : '#fef9c3', color: card.season === 'WET' ? '#1e40af' : '#854d0e', border: `1px solid ${card.season === 'WET' ? '#bfdbfe' : '#fde68a'}`, padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700 }}>
                                    {card.season === 'WET' ? '' : ''} {card.season_display}
                                  </span>
                                  <span style={{ backgroundColor: '#f3f4f6', color: '#374151', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, border: '1px solid #e5e7eb' }}>{card.year}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: GREEN.primary, margin: 0, lineHeight: 1 }}>{card.total_farmers}</p>
                                <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0.1rem 0 0', fontWeight: 600, textTransform: 'uppercase' }}>Farmers</p>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e40af', margin: 0, lineHeight: 1 }}>{card.total_hectares}</p>
                                <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0.1rem 0 0', fontWeight: 600, textTransform: 'uppercase' }}>Total ha</p>
                              </div>
                              <ChevronRight size={18} color={isExpanded ? '#1e40af' : '#9ca3af'} style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ borderTop: '1px solid #e5e7eb', animation: 'fadeIn 0.2s ease' }}>
                              <div style={{ padding: '0.625rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: 0, fontWeight: 600 }}>Showing {pageStart + 1}–{Math.min(pageStart + FARMERS_PER_PAGE, card.farmers.length)} of {card.farmers.length} farmer{card.farmers.length !== 1 ? 's' : ''}</p>
                                {totalPages > 1 && <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>Page {currentPage} of {totalPages}</p>}
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: '480px' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                                      {['#', 'Farmer Name', 'Hectare', 'Hybrid', 'Inbred'].map(col => (
                                        <th key={col} style={{ padding: '0.625rem 1rem', textAlign: col === 'Farmer Name' ? 'left' : 'center', fontWeight: 700, color: '#374151', fontSize: '0.68rem', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRight: '1px solid #f3f4f6' }}>{col}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pageFarmers.map((farmer, fIdx) => (
                                      <tr key={`${farmer.farmer_id}-${fIdx}`} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: fIdx % 2 === 0 ? 'white' : '#fafafa' }} className="row-hover">
                                        <td style={{ padding: '0.625rem 1rem', textAlign: 'center', color: '#9ca3af', fontWeight: 600, fontSize: '0.72rem', borderRight: '1px solid #f3f4f6', width: '40px' }}>{pageStart + fIdx + 1}</td>
                                        <td style={{ padding: '0.625rem 1rem', borderRight: '1px solid #f3f4f6' }}>
                                          <p style={{ fontWeight: 700, margin: 0, fontSize: '0.875rem', color: '#1a1a1a' }}>{farmer.farmer_name}</p>
                                          {farmer.rsbsa_number && <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.1rem 0 0', fontFamily: 'monospace' }}>{farmer.rsbsa_number}</p>}
                                        </td>
                                        <td style={{ padding: '0.625rem 1rem', textAlign: 'center', fontWeight: 700, color: '#374151', borderRight: '1px solid #f3f4f6' }}>{farmer.hectares > 0 ? `${farmer.hectares} ha` : '—'}</td>
                                        <td style={{ padding: '0.625rem 1rem', textAlign: 'center', borderRight: '1px solid #f3f4f6' }}>{farmer.seed_type_label === 'Hybrid' ? <span style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, border: '1px solid #bfdbfe' }}>{farmer.variety_name || 'Hybrid'}</span> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                                        <td style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>{farmer.seed_type_label === 'Inbred' ? <span style={{ backgroundColor: GREEN.light, color: GREEN.primary, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${GREEN.border}` }}>{farmer.variety_name || 'Inbred'}</span> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  {currentPage === totalPages && (
                                    <tfoot>
                                      <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e5e7eb' }}>
                                        <td />
                                        <td style={{ padding: '0.625rem 1rem', fontWeight: 800, color: '#374151', fontSize: '0.78rem' }}>Total: {card.total_farmers} farmer{card.total_farmers !== 1 ? 's' : ''}</td>
                                        <td style={{ padding: '0.625rem 1rem', textAlign: 'center', fontWeight: 800, color: GREEN.primary }}>{card.total_hectares} ha</td>
                                        <td colSpan={2} />
                                      </tr>
                                    </tfoot>
                                  )}
                                </table>
                              </div>
                              {totalPages > 1 && (
                                <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                                  <button onClick={() => setPage(card.barangay, Math.max(1, currentPage - 1))} disabled={currentPage === 1} style={{ padding: '0.4rem 0.875rem', borderRadius: '0.625rem', border: `1.5px solid ${currentPage === 1 ? '#e5e7eb' : '#d1d5db'}`, backgroundColor: currentPage === 1 ? '#f9fafb' : 'white', color: currentPage === 1 ? '#9ca3af' : '#374151', fontWeight: 600, fontSize: '0.78rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ChevronLeft size={14} /> Prev</button>
                                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('...'); acc.push(p); return acc; }, []).map((p, i) => p === '...' ? <span key={`ellipsis-${i}`} style={{ padding: '0.3rem 0.375rem', fontSize: '0.72rem', color: '#9ca3af' }}>…</span> : <button key={p} onClick={() => setPage(card.barangay, p)} style={{ width: 28, height: 28, borderRadius: '0.5rem', border: `1.5px solid ${currentPage === p ? GREEN.primary : '#e5e7eb'}`, backgroundColor: currentPage === p ? GREEN.primary : 'white', color: currentPage === p ? 'white' : '#374151', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p}</button>) }
                                  </div>
                                  <button onClick={() => setPage(card.barangay, Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} style={{ padding: '0.4rem 0.875rem', borderRadius: '0.625rem', border: `1.5px solid ${currentPage === totalPages ? '#e5e7eb' : '#d1d5db'}`, backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white', color: currentPage === totalPages ? '#9ca3af' : '#374151', fontWeight: 600, fontSize: '0.78rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Next <ChevronRight size={14} /></button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
        </div>
      )}

      {/* ══ HISTORY VIEW ══ */}
      {view === 'history' && (
        <div style={{ animation: 'fadeIn 0.25s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
            <h2 style={{ fontWeight: 800, fontSize: '1rem', margin: '0 0 0.25rem' }}>Allocation History</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: 0 }}>Past barangay allocations from previous seasons.</p>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', marginBottom: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['', 'WET', 'DRY'].map(s => (
                  <button key={s}
                    onClick={() => setHistoryFilter(p => ({ ...p, season: s }))}
                    style={{ padding: '0.375rem 0.875rem', border: `1.5px solid ${historyFilter.season === s ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: historyFilter.season === s ? GREEN.light : 'white', color: historyFilter.season === s ? GREEN.primary : '#6b7280', fontWeight: historyFilter.season === s ? 700 : 400, fontSize: '0.78rem', cursor: 'pointer' }}>
                    {s === '' ? 'All Seasons' : s === 'WET' ? 'Wet Season' : 'Dry Season'}
                  </button>
                ))}
              </div>
              <select
                value={historyFilter.year}
                onChange={e => setHistoryFilter(p => ({ ...p, year: e.target.value }))}
                style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '999px', fontSize: '0.78rem', color: '#374151', cursor: 'pointer', outline: 'none', backgroundColor: 'white' }}>
                <option value=''>All Years</option>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search barangay..."
                  style={{ padding: '0.375rem 0.75rem 0.375rem 2.25rem', border: '1.5px solid #e5e7eb', borderRadius: '999px', fontSize: '0.78rem', width: '100%', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {(() => {
            const filteredDelivs = deliveries.filter(d => {
              const matchSeason = !historyFilter.season || d.season === historyFilter.season;
              const matchYear   = !historyFilter.year   || String(d.year) === String(historyFilter.year);
              return matchSeason && matchYear;
            });

            const allAllocs = filteredDelivs.flatMap(d =>
              (d.allocations && d.allocations.length > 0)
                ? d.allocations.map(a => ({
                    ...a,
                    seed_type_name:  d.seed_type_name,
                    variety_name:    d.variety_name,
                    season:          d.season,
                    season_display:  d.season_display,
                    year:            d.year,
                    total_bags:      d.total_bags,
                    delivery_status: d.status,
                  }))
                : [{
                    id:              null,
                    barangay:        null,
                    allocated_bags:  null,
                    status:          null,
                    date_allocated:  null,
                    seed_type_name:  d.seed_type_name,
                    variety_name:    d.variety_name,
                    season:          d.season,
                    season_display:  d.season_display,
                    year:            d.year,
                    total_bags:      d.total_bags,
                    delivery_status: d.status,
                  }]
            ).filter(a => {
              if (!historySearch) return true;
              const q = historySearch.toLowerCase();
              return (
                a.barangay?.toLowerCase().includes(q) ||
                a.seed_type_name?.toLowerCase().includes(q) ||
                a.variety_name?.toLowerCase().includes(q)
              );
            });

            if (allAllocs.length === 0) {
              return (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#9ca3af', border: '1px solid #f3f4f6' }}>
                  <History size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
                  <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.25rem' }}>No allocation history found</p>
                  <p style={{ fontSize: '0.8rem', margin: 0 }}>Try adjusting the season or year filter.</p>
                </div>
              );
            }

            return (
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr 0.7fr 0.7fr 0.6fr', gap: '0.5rem', padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>
                  <span>Seed Type / Variety</span>
                  <span>Barangay</span>
                  <span>Season / Year</span>
                  <span style={{ textAlign: 'center' }}>Total Bags</span>
                  <span style={{ textAlign: 'center' }}>Allocated</span>
                  <span style={{ textAlign: 'center' }}>Status</span>
                </div>
                {allAllocs.map((a, idx) => {
                  const isHybrid = a.seed_type_name?.toUpperCase().includes('HYBRID');
                  const typeColor  = isHybrid ? '#1e40af' : GREEN.primary;
                  const typeBg     = isHybrid ? '#eff6ff' : GREEN.light;
                  const typeBorder = isHybrid ? '#bfdbfe' : GREEN.border;
                  return (
                    <div key={`${a.id || 'noalloc'}-${idx}`}
                      style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr 0.7fr 0.7fr 0.6fr', gap: '0.5rem', padding: '0.875rem 1.25rem', borderBottom: idx < allAllocs.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center' }}
                      className="row-hover">
                      <div>
                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <span style={{ backgroundColor: typeBg, color: typeColor, border: `1px solid ${typeBorder}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.65rem', fontWeight: 700 }}>
                            {a.seed_type_name}
                          </span>
                          {a.delivery_status && (
                            <StatusBadge status={a.delivery_status} />
                          )}
                        </div>
                        {a.variety_name && (
                          <p style={{ fontSize: '0.72rem', color: '#374151', margin: 0, fontWeight: 600 }}>{a.variety_name}</p>
                        )}
                      </div>
                      <div>
                        {a.barangay ? (
                          <>
                            <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a1a1a', margin: 0 }}>Brgy. {a.barangay}</p>
                            {a.date_allocated && (
                              <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.1rem 0 0' }}>
                                {new Date(a.date_allocated + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#d1d5db', fontStyle: 'italic' }}>No allocation yet</span>
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 600, margin: 0 }}>{a.season_display}</p>
                        <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.1rem 0 0' }}>{a.year}</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '1rem', fontWeight: 800, color: '#374151', margin: 0 }}>{a.total_bags ?? '—'}</p>
                        <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: 0 }}>expected</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        {a.allocated_bags != null ? (
                          <>
                            <p style={{ fontSize: '1rem', fontWeight: 800, color: GREEN.primary, margin: 0 }}>{a.allocated_bags}</p>
                            <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: 0 }}>bags</p>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#d1d5db' }}>—</span>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        {a.status ? (
                          <StatusBadge status={a.status} />
                        ) : (
                          <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontStyle: 'italic' }}>Pending</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ AUDIT VIEW ══ */}
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
                  CREATED:   { color: GREEN.accent,  bg: GREEN.soft,  icon: <Package size={16} /> },
                  UPDATED:   { color: '#1e40af',     bg: '#eff6ff',   icon: <Edit2 size={16} /> },
                  ALLOCATED: { color: '#854d0e',     bg: '#fef9c3',   icon: <Truck size={16} /> },
                  CONFIRMED: { color: GREEN.primary, bg: GREEN.light, icon: <CheckCircle size={16} /> },
                  DELETED:   { color: '#991b1b',     bg: '#fee2e2',   icon: <Trash2 size={16} /> },
                }[log.action] || { color: '#6b7280', bg: '#f9fafb', icon: <ClipboardList size={16} /> };
                return (
                  <div key={log.id} style={{ padding: '1rem 1.25rem', borderBottom: idx < auditLogs.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', gap: '0.875rem', alignItems: 'flex-start', animation: `slideUp ${0.3 + idx * 0.04}s ease` }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: actionCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{actionCfg.icon}</div>
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

      {/* ══ RECORD DELIVERY MODAL ══ */}
      {deliveryModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))', animation: 'slideUp 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>
                {editDelivery?._fromEntry ? 'Edit Schedule Entry' : editDelivery ? 'Edit Delivery' : 'Record Seed Delivery'}
              </h2>
              <button onClick={() => setDeliveryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.5rem' }}>×</button>
            </div>
            {(!editDelivery || !editDelivery?._fromEntry) && !dForm._lockedSeedTypeId && (
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
                {dForm.final_seed_id && (() => {
                  const selFs = finalSeeds.find(fs => fs.id?.toString() === dForm.final_seed_id?.toString());
                  if (!selFs || !selFs.varieties || selFs.varieties.length <= 1) return null;
                  return (
                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>Variety <span style={{ color: '#dc2626' }}>*</span></label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {selFs.varieties.map(v => {
                          const selVar = String(dForm.variety_id) === String(v.id);
                          return (
                            <button key={v.id} type="button" onClick={() => { setDForm(p => ({ ...p, variety_id: v.id })); setDErrors(p => ({ ...p, variety_id: '' })); }}
                              style={{ padding: '0.55rem 0.9rem', border: `2px solid ${selVar ? '#1e40af' : '#e5e7eb'}`, borderRadius: '0.75rem', backgroundColor: selVar ? '#eff6ff' : 'white', color: selVar ? '#1e40af' : '#374151', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
                              {v.name}
                            </button>
                          );
                        })}
                      </div>
                      {dErrors.variety_id && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.35rem 0 0' }}>{dErrors.variety_id}</p>}
                    </div>
                  );
                })()}
              </div>
            )}
            {editDelivery?._fromEntry && (
              <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.9rem', backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#374151' }}><strong>Seed type:</strong> {dForm._seedTypeName || 'Locked'}</p>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#374151' }}><strong>Variety:</strong> {dForm._varietyName || 'Locked'}</p>
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
                <CheckCircle size={16} /> {dSaving ? 'Saving...' : editDelivery?._fromEntry ? 'Update Delivery' : editDelivery ? 'Save Changes' : 'Record Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SCHEDULE DELIVERY MODAL ══ */}
      {scheduleModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', width: '100%', maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', animation: 'modalSlideUp 0.3s cubic-bezier(0.34,1.1,0.64,1)' }}>
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
                <button onClick={() => setScheduleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0.25rem', borderRadius: '0.5rem', display: 'flex' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#374151'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.75rem 1.75rem' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: GREEN.primary, color: 'white', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: 0 }}>Choose seed type(s) to schedule</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(finalSeeds.length, 2)}, 1fr)`, gap: '0.625rem', marginBottom: '1.25rem' }}>
                    {finalSeeds.map(fs => {
                      const key = fs.id?.toString();
                      const evH = isHybrid(fs.seed_type?.name || '');
                      const tagColor  = evH ? '#1e40af' : GREEN.primary;
                      const tagBg     = evH ? '#eff6ff' : GREEN.light;
                      const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                      const isActive  = activeScheduleTab === key || activeScheduleTab?.startsWith(`${key}::`);
                      const scheduledVarietyKeys = Object.keys(scheduleForms).filter(k => k.startsWith(`${key}::`));
                      const hasData   = scheduledVarietyKeys.length > 0;
                      const hasErr    = Object.keys(scheduleErrors).some(k => k.startsWith(`${key}::`) && Object.values(scheduleErrors[k] || {}).some(Boolean));
                      return (
                        <button key={key} type="button" className="schedule-tab-btn"
                          onClick={() => handleScheduleTabToggle(fs)}
                          style={{ padding: '1rem', textAlign: 'left', border: `2px solid ${hasErr ? '#dc2626' : isActive ? tagColor : hasData ? tagBorder : '#e5e7eb'}`, borderRadius: '0.875rem', backgroundColor: isActive ? tagBg : hasData ? `${tagBg}80` : 'white', cursor: 'pointer', position: 'relative', boxShadow: isActive ? `0 4px 12px ${tagColor}25` : 'none' }}>
                          {isActive && <div style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', width: 8, height: 8, borderRadius: '50%', backgroundColor: tagColor }} />}
                          {hasData && !isActive && (
                            <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', width: 16, height: 16, borderRadius: '50%', backgroundColor: tagBg, border: `1.5px solid ${tagColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle size={10} color={tagColor} />
                            </div>
                          )}
                          <p style={{ fontWeight: 800, fontSize: '0.9rem', color: isActive ? tagColor : '#374151', margin: '0 0 0.125rem' }}>{fs.seed_type?.name}</p>
                          <p style={{ fontSize: '0.68rem', color: isActive ? tagColor : '#9ca3af', margin: '0 0 0.375rem', opacity: 0.9 }}>{evH ? 'Region (NRP/RFO)' : 'PhilRice (RCEF)'}</p>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {fs.varieties?.map(v => (
                              <span key={v.id} style={{ backgroundColor: isActive ? `${tagColor}20` : '#f3f4f6', color: isActive ? tagColor : '#6b7280', padding: '0.1rem 0.375rem', borderRadius: '999px', fontSize: '0.63rem', fontWeight: 600 }}>{v.name}</span>
                            ))}
                          </div>
                          {hasData && !isActive && (
                            <p style={{ fontSize: '0.65rem', color: tagColor, margin: '0.375rem 0 0', fontWeight: 600 }}>{scheduledVarietyKeys.length} variet{scheduledVarietyKeys.length !== 1 ? 'ies' : 'y'} scheduled</p>
                          )}
                          {hasErr && <p style={{ fontSize: '0.65rem', color: '#dc2626', margin: '0.375rem 0 0', fontWeight: 600 }}>⚠ Fill required fields</p>}
                        </button>
                      );
                    })}
                  </div>

                  {activeScheduleTab && !activeScheduleTab.includes('::') && (() => {
                    const fs = finalSeeds.find(s => s.id?.toString() === activeScheduleTab);
                    if (!fs) return null;
                    const seedTypeKey = activeScheduleTab;
                    const evH = isHybrid(fs.seed_type?.name || '');
                    const tagColor  = evH ? '#1e40af' : GREEN.primary;
                    const tagBg     = evH ? '#eff6ff' : GREEN.light;
                    const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                    return (
                      <div style={{ animation: 'fadeIn 0.2s ease', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: tagColor, color: 'white', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</span>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: 0 }}>
                            Choose a variety of <span style={{ color: tagColor }}>{fs.seed_type?.name}</span> to schedule
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {fs.varieties?.map(v => {
                            const vKey = `${seedTypeKey}::${v.id}::${v.name}`;
                            const season = fs.season || '';
                            const year = fs.year || new Date().getFullYear();
                            const isScheduled = !!scheduleForms[vKey] || schedules.some(schedule =>
                              schedule.entries.some(entry =>
                                String(entry.seedTypeDbId) === String(fs.seed_type?.id) &&
                                String(entry.varietyId) === String(v.id) &&
                                entry.season === season &&
                                Number(entry.year) === Number(year)
                              )
                            );
                            return (
                              <button key={v.id} type="button"
                                onClick={() => {
                                  if (isScheduled) {
                                    showToast('error', `${v.name} is already encoded. Use the Edit button on the variety card to update it.`);
                                    return;
                                  }
                                  setActiveScheduleTab(vKey);
                                  if (!scheduleForms[vKey]) {
                                    setScheduleForms(prev => ({
                                      ...prev,
                                      [vKey]: {
                                        total_bags: '',
                                        delivery_date: '',
                                        lot_number: '',
                                        remarks: '',
                                        season,
                                        year,
                                      },
                                    }));
                                  }
                                  setScheduleErrors(prev => ({ ...prev, [vKey]: {} }));
                                }}
                                style={{ padding: '0.5rem 1rem', border: `2px solid ${isScheduled ? '#d1d5db' : tagBorder}`, borderRadius: '0.75rem', backgroundColor: isScheduled ? '#f3f4f6' : tagBg, color: isScheduled ? '#9ca3af' : tagColor, fontWeight: 700, fontSize: '0.8rem', cursor: isScheduled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.15s', opacity: isScheduled ? 0.75 : 1 }}>
                                {isScheduled && <CheckCircle size={13} color="#9ca3af" />}
                                {v.name}
                                {isScheduled && <span style={{ fontSize: '0.65rem' }}>· already encoded</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {activeScheduleTab && activeScheduleTab.includes('::') && (() => {
                    const [fsId, varietyId, varietyName] = activeScheduleTab.split('::');
                    const fs = finalSeeds.find(s => s.id?.toString() === fsId);
                    if (!fs) return null;
                    const key = activeScheduleTab;
                    const f   = scheduleForms[key] || {};
                    const errs = scheduleErrors[key] || {};
                    const evH  = isHybrid(fs?.seed_type?.name || '');
                    const tagColor = evH ? '#1e40af' : GREEN.primary;
                    const tagBg    = evH ? '#eff6ff' : GREEN.light;
                    const tagBorder = evH ? '#bfdbfe' : GREEN.border;
                    return (
                      <div style={{ animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: tagColor, color: 'white', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {fs?.varieties?.length > 1 ? '3' : '2'}
                          </span>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: 0 }}>
                            Delivery details for <span style={{ color: tagColor }}>{varietyName}</span>
                          </p>
                        </div>
                        <div style={{ backgroundColor: tagBg, border: `1px solid ${tagBorder}`, borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <Leaf size={15} color={tagColor} />
                          <div>
                            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: tagColor, margin: 0 }}>{fs?.seed_type?.name} · {evH ? 'Region (NRP/RFO)' : 'PhilRice (RCEF)'}</p>
                            <p style={{ fontSize: '0.68rem', color: tagColor, opacity: 0.8, margin: 0 }}>Variety: {varietyName}</p>
                          </div>
                          {fs?.varieties?.length > 1 && (
                            <button type="button"
                              onClick={() => setActiveScheduleTab(fsId)}
                              style={{ marginLeft: 'auto', fontSize: '0.7rem', color: tagColor, background: 'none', border: `1px solid ${tagBorder}`, borderRadius: '0.5rem', padding: '0.2rem 0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                              ← Change variety
                            </button>
                          )}
                        </div>
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
                        <div style={{ marginBottom: '0.875rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Lot Number</label>
                          <input type="text" value={f.lot_number || ''} onChange={e => updateScheduleForm(key, 'lot_number', e.target.value)} placeholder="e.g. LOT-2026-001" style={inp()} />
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Remarks</label>
                          <textarea value={f.remarks || ''} onChange={e => updateScheduleForm(key, 'remarks', e.target.value)} rows={2} placeholder="Optional notes..." style={{ ...inp(), resize: 'vertical' }} />
                        </div>
                        {finalSeeds.length > 1 && (
                          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '0.625rem', padding: '0.625rem 0.875rem', fontSize: '0.72rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <AlertCircle size={12} color="#9ca3af" />
                            Click the other seed type above to fill its schedule too. Both will be saved together.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {!activeScheduleTab && Object.keys(scheduleForms).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', backgroundColor: '#f9fafb', borderRadius: '0.875rem', border: '1.5px dashed #e5e7eb' }}>
                      <CalendarClock size={28} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.625rem' }} />
                      <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 0.25rem', fontSize: '0.875rem' }}>Select a seed type above</p>
                      <p style={{ fontSize: '0.78rem', margin: 0 }}>Click a seed type card to start entering schedule details.</p>
                    </div>
                  )}

                  {Object.keys(scheduleForms).length > 0 && !activeScheduleTab && (
                    <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '0.5rem' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.8rem', color: GREEN.accent, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <CheckCircle size={14} /> Ready to save:
                      </p>
                      {Object.keys(scheduleForms).map(key => {
                        const [fsId, varietyId, varietyName] = key.split('::');
                        const fs = finalSeeds.find(s => s.id?.toString() === fsId || s.id?.toString() === key);
                        const f  = scheduleForms[key];
                        return (
                          <div key={key} style={{ fontSize: '0.75rem', color: GREEN.accent, display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700 }}>{fs?.seed_type?.name}</span>
                            {varietyName && (
                              <><span style={{ color: '#6b7280' }}>·</span><span>{varietyName}</span></>
                            )}
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

            <div style={{ padding: '1rem 1.75rem 1.5rem', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '0.75rem', position: 'sticky', bottom: 0, backgroundColor: 'white', borderRadius: '0 0 1.25rem 1.25rem' }}>
              <button onClick={() => setScheduleModal(false)} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Cancel</button>
              <button onClick={handleSaveSchedule} disabled={scheduleSaving || finalSeeds.length === 0}
                style={{ flex: 2, padding: '0.875rem', backgroundColor: (scheduleSaving || finalSeeds.length === 0) ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.875rem', cursor: (scheduleSaving || finalSeeds.length === 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <CalendarClock size={16} />
                {scheduleSaving ? 'Saving...' : editSchedule ? 'Update Schedule' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ALLOCATION MODAL ══ */}
      {deliveredModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.75rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: 800, margin: 0, fontSize: '1.1rem' }}>Confirm Delivery</h3>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                  {deliveredModal.entry.seedTypeName} · {deliveredModal.entry.varietyName}
                </p>
              </div>
              <button onClick={() => setDeliveredModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#6b7280' }}>×</button>
            </div>
            <div style={{ backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`, borderRadius: '0.875rem', padding: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.72rem', color: GREEN.accent, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.25rem' }}>Expected Bags</p>
              <p style={{ fontSize: '2.5rem', fontWeight: 800, color: GREEN.primary, margin: 0, lineHeight: 1 }}>{deliveredModal.entry.total_bags}</p>
            </div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.75rem' }}>
              Did all <strong>{deliveredModal.entry.total_bags} bags</strong> arrive as expected?
            </p>
            <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1rem' }}>
              <button
                onClick={() => setDeliveredForm({ confirmed: true, actual_bags: '' })}
                style={{ flex: 1, padding: '0.75rem', border: `2px solid ${deliveredForm.confirmed === true ? GREEN.primary : '#e5e7eb'}`, borderRadius: '0.75rem', backgroundColor: deliveredForm.confirmed === true ? GREEN.light : 'white', color: deliveredForm.confirmed === true ? GREEN.primary : '#374151', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                ✓ Yes, all arrived
              </button>
              <button
                onClick={() => setDeliveredForm({ confirmed: false, actual_bags: '' })}
                style={{ flex: 1, padding: '0.75rem', border: `2px solid ${deliveredForm.confirmed === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: '0.75rem', backgroundColor: deliveredForm.confirmed === false ? '#fee2e2' : 'white', color: deliveredForm.confirmed === false ? '#dc2626' : '#374151', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                ✗ No, different count
              </button>
            </div>
            {deliveredForm.confirmed === false && (
              <div style={{ marginBottom: '1rem', animation: 'fadeIn 0.2s ease' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                  Actual Bags Received <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number" min="1"
                  value={deliveredForm.actual_bags}
                  onChange={e => setDeliveredForm(p => ({ ...p, actual_bags: e.target.value }))}
                  placeholder="Enter actual count"
                  style={inp()} autoFocus
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeliveredModal(null)} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button
                onClick={handleConfirmDelivered}
                disabled={deliveredSaving || deliveredForm.confirmed === null}
                style={{ flex: 2, padding: '0.75rem', backgroundColor: (deliveredSaving || deliveredForm.confirmed === null) ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, cursor: (deliveredSaving || deliveredForm.confirmed === null) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <CheckCircle size={16} /> {deliveredSaving ? 'Saving...' : 'Confirm Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}
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