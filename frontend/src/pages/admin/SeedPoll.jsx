import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Lock, XCircle, Plus,
  CheckCircle, Clock, AlertCircle,
  Wheat, MapPin, Trophy, Tag, Edit2, Trash2, Sprout,
  Leaf, Layers, Star,
} from 'lucide-react';
import {
  getAdminPolls, createPoll,
  lockPoll, closePoll, getAdminPollResults,
  getAdminVarieties, createVariety, deleteVariety,
  getAdminSeedTypes, createSeedType, updateSeedType,
  deletePoll, deleteSeedType,
  getFinalSeeds, saveFinalSeeds,
} from '../../api/axios';

const TABS = [
  { key: 'poll',      label: 'Active Poll',      Icon: CheckCircle },
  { key: 'results',   label: 'Results',           Icon: BarChart2   },
  { key: 'varieties', label: 'Types & Varieties', Icon: Wheat       },
  
];

const SEASON_OPTIONS = [
  { value: 'WET', label: 'Wet Season' },
  { value: 'DRY', label: 'Dry Season' },
];

const getDetectedSeason = () => {
  const month = new Date().getMonth() + 1;
  return month >= 6 && month <= 11 ? 'WET' : 'DRY';
};

const getSuggestedTitle = (season, year) => {
  const seasonLabel = season === 'WET' ? 'Wet Season' : 'Dry Season';
  return `${seasonLabel} ${year} Seed Preference Poll`;
};

const StatusBadge = ({ status }) => {
  const config = {
    OPEN:   { bg: '#dcfce7', color: '#166534', label: 'Open',   Icon: CheckCircle },
    LOCKED: { bg: '#fef9c3', color: '#854d0e', label: 'Locked', Icon: Lock        },
    CLOSED: { bg: '#f3f4f6', color: '#6b7280', label: 'Closed', Icon: XCircle     },
  }[status] || { bg: '#f3f4f6', color: '#6b7280', label: status, Icon: Clock };
  const { bg, color, label, Icon: I } = config;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: bg, color, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
      <I size={12} /> {label}
    </span>
  );
};

const ProgressBar = ({ percent, color = '#2d6a2d' }) => (
  <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
    <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', backgroundColor: color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
  </div>
);

const TYPE_COLORS = [
  { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
  { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  { bg: '#f3e8ff', color: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
  { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
];
const getTypeColor = (idx) => TYPE_COLORS[idx % TYPE_COLORS.length];

// Auto-assign source based on seed type name (fixed relationships)
const isHybridType = (typeName) => {
  const n = (typeName || '').toUpperCase();
  return n.includes('HYBRID') || n === 'NRP' || n === 'RFO';
};
const isInbredType = (typeName) => {
  const n = (typeName || '').toUpperCase();
  return n.includes('INBRED') || n === 'RCEF';
};

const getSourceForType = (typeName) => {
  if (isInbredType(typeName)) return 'PHILRICE';
  return 'REGION'; // HYBRID and everything else → Region
};

const getSourceLabel = (typeName) => {
  if (isInbredType(typeName)) return 'PhilRice';
  return 'Region';
};

const getSourceColors = (typeName) => {
  if (isInbredType(typeName)) return { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' };
  return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
};

// ── TOAST ──
const Toast = ({ toast }) => {
  if (!toast) return null;
  const bg = toast.type === 'error' ? '#991b1b' : toast.type === 'warning' ? '#854d0e' : '#166534';
  const I  = toast.type === 'success' ? CheckCircle : AlertCircle;
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 600, backgroundColor: bg, color: 'white', padding: '0.75rem 1.5rem', borderRadius: '999px', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', animation: 'slideUp 0.25s ease', maxWidth: 'calc(100vw - 2rem)', whiteSpace: 'nowrap' }}>
      <I size={16} /> {toast.message}
    </div>
  );
};

const SeedPoll = () => {
  const [activeTab, setActiveTab] = useState('poll');

  // ── TOAST ──
  const [toast, setToast] = useState(null);
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── POLL STATE ──
  const [polls, setPolls]                   = useState([]);
  const [pollLoading, setPollLoading]       = useState(true);
  const [pollError, setPollError]           = useState('');
  const [createModal, setCreateModal]       = useState(false);
  const [actionLoading, setActionLoading]   = useState({});
  const [activePollExists, setActivePollExists] = useState(false);
  const [deletingPollId, setDeletingPollId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [closeConfirmId, setCloseConfirmId] = useState(null);

  const [form, setForm] = useState({ title: '', season: getDetectedSeason(), year: new Date().getFullYear(), end_date: '' });
  const [formErrors, setFormErrors]     = useState({});
  const [formLoading, setFormLoading]   = useState(false);
  const [formError, setFormError]       = useState('');
  const [seasonOverride, setSeasonOverride] = useState(false);
  const [manualTitle, setManualTitle]   = useState(false);

  // ── SEED TYPE STATE ──
  const [seedTypes, setSeedTypes]                 = useState([]);
  const [typeLoading, setTypeLoading]             = useState(true);
  const [typeError, setTypeError]                 = useState('');
  const [newTypeName, setNewTypeName]             = useState('');
  const [typeFormError, setTypeFormError]         = useState('');
  const [typeFormLoading, setTypeFormLoading]     = useState(false);
  const [editingType, setEditingType]             = useState(null);
  const [editTypeName, setEditTypeName]           = useState('');

  // ── VARIETY STATE ──
  const [newVariety, setNewVariety]               = useState({ seed_type: '', name: '' });
  const [varFormError, setVarFormError]           = useState('');
  const [varFormLoading, setVarFormLoading]       = useState(false);

  // ── RESULTS STATE ──
  const [results, setResults]                     = useState(null);
  const [resultsLoading, setResultsLoading]       = useState(false);
  const [resultsError, setResultsError]           = useState('');
  const [selectedPollId, setSelectedPollId]       = useState(null);

  // ── FINALIZE SEEDS STATE ──
  const [finalizeModal, setFinalizeModal]         = useState(false);
  const [finalSeeds, setFinalSeeds]               = useState([]);
  const [finalForm, setFinalForm]                 = useState({}); // { [seedTypeId]: { varIds: [] } }
  const [savingFinal, setSavingFinal]             = useState(false);
  const [latestClosedPoll, setLatestClosedPoll]   = useState(null);

  // ── FETCHERS ──
  const fetchPolls = useCallback(async () => {
    try {
      setPollLoading(true);
      setPollError('');
      const res  = await getAdminPolls();
      const data = res.data || [];
      setPolls(data);
      setActivePollExists(data.some(p => p.status === 'OPEN'));
      const closed = data.filter(p => p.status === 'CLOSED' || p.status === 'LOCKED')
        .sort((a, b) => b.year - a.year || new Date(b.created_at) - new Date(a.created_at));
      setLatestClosedPoll(closed[0] || null);
    } catch (err) {
      setPollError(err.response?.data?.error || 'Failed to load polls.');
    } finally {
      setPollLoading(false);
    }
  }, []);

  const fetchSeedTypes = useCallback(async () => {
    try {
      setTypeLoading(true);
      const res = await getAdminSeedTypes();
      setSeedTypes(res.data || []);
    } catch {
      try {
        const fallback = await getAdminVarieties();
        setSeedTypes(fallback.data || []);
      } catch {
        setTypeError('Failed to load seed types.');
      }
    } finally {
      setTypeLoading(false);
    }
  }, []);

  const fetchResults = useCallback(async (pollId) => {
    if (!pollId) return;
    try {
      setResultsLoading(true);
      setResultsError('');
      const res = await getAdminPollResults(pollId);
      setResults(res.data);
    } catch {
      setResultsError('Failed to load results.');
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const loadFinalSeeds = useCallback(async () => {
    try {
      const res  = await getFinalSeeds();
      const data = res.data || [];
      setFinalSeeds(data);
      // Pre-fill form — only varIds, no source toggle
      const preForm = {};
      data.forEach(fs => {
        preForm[fs.seed_type.id] = { varIds: fs.varieties.map(v => v.id) };
      });
      setFinalForm(preForm);
    } catch {}
  }, []);

  useEffect(() => { fetchPolls();     }, [fetchPolls]);
  useEffect(() => { fetchSeedTypes(); }, [fetchSeedTypes]);
  useEffect(() => { loadFinalSeeds(); }, [loadFinalSeeds]);

  useEffect(() => {
    if (polls.length > 0 && !selectedPollId) {
      setSelectedPollId(polls[0].id);
    }
  }, [polls, selectedPollId]);

  useEffect(() => {
    if (activeTab === 'results' && selectedPollId) {
      fetchResults(selectedPollId);
    }
  }, [activeTab, selectedPollId, fetchResults]);

  const detectedSeason = getDetectedSeason();

  // ── POLL HANDLERS ──
  const handleField = (key, value) => {
    // Simple field updater; title auto-generation is handled by an effect below
    setForm(prev => ({ ...prev, [key]: value }));

    if (key === 'title') {
      setManualTitle(true);
    }

    if (key === 'season') {
      setSeasonOverride(value !== detectedSeason);
    }

    setFormErrors(prev => ({ ...prev, [key]: '' }));
  };

  const openCreateModal = () => {
    const season = getDetectedSeason();
    const year = new Date().getFullYear();
    setForm({ title: getSuggestedTitle(season, year), season, year, end_date: '' });
    setFormErrors({});
    setFormError('');
    setSeasonOverride(false);
    setManualTitle(false);
    setCreateModal(true);
  };

  // Auto-update suggested title when season/year change — only when admin hasn't typed a custom title
  useEffect(() => {
    if (manualTitle) return;
    const suggested = getSuggestedTitle(form.season, form.year);
    if (form.title !== suggested) {
      setForm(prev => ({ ...prev, title: suggested }));
    }
  }, [form.season, form.year, manualTitle]);

  const validatePollForm = () => {
    const errs = {};
    if (!form.title.trim()) errs.title    = 'Title is required';
    if (!form.end_date)     errs.end_date = 'End date is required';
    if (!form.year)         errs.year     = 'Year is required';
    return errs;
  };

  const handleCreatePoll = async () => {
    const errs = validatePollForm();
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setFormLoading(true);
    setFormError('');
    try {
      await createPoll(form);
      setCreateModal(false);
      setForm({ title: '', season: 'WET', year: new Date().getFullYear(), end_date: '' });
      fetchPolls();
      showToast('success', 'Poll created successfully.');
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create poll.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleLock = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'lock' }));
    try {
      await lockPoll(id);
      fetchPolls();
      await loadFinalSeeds();
      showToast('success', 'Poll locked. Results are now final.');
    } catch (err) {
      setPollError(err.response?.data?.error || 'Failed to lock poll.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const handleClose = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'close' }));
    try {
      await closePoll(id);
      fetchPolls();
      await loadFinalSeeds();
      setCloseConfirmId(null);
      showToast('success', 'Poll closed. You can now finalize seed varieties.');
    } catch (err) {
      setPollError(err.response?.data?.error || 'Failed to close poll.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const handleDeletePoll = async (pollId) => {
    setDeleteConfirmId(pollId);
  };

  const doDeletePoll = async () => {
    const pollId = deleteConfirmId;
    setDeleteConfirmId(null);
    setDeletingPollId(pollId);
    try {
      await deletePoll(pollId);
      showToast('success', 'Poll deleted permanently.');
      fetchPolls();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to delete poll.');
    } finally {
      setDeletingPollId(null);
    }
  };

  // ── SEED TYPE HANDLERS ──
  const handleAddType = async () => {
    if (activePollExists) {
      showToast('warning', "Cannot add types while a poll is active. Close the poll first.");
      return;
    }
    const name = newTypeName.trim();
    if (!name) { setTypeFormError('Seed type name is required.'); return; }
    setTypeFormLoading(true);
    setTypeFormError('');
    try {
      await createSeedType({ name });
      setNewTypeName('');
      fetchSeedTypes();
      showToast('success', `Seed type "${name}" added.`);
    } catch (err) {
      const data = err.response?.data;
      setTypeFormError(data?.name?.[0] || data?.error || 'Failed to add type.');
    } finally {
      setTypeFormLoading(false);
    }
  };

  const handleEditType = async (id) => {
    const name = editTypeName.trim();
    if (!name) return;
    try {
      await updateSeedType(id, { name });
      setEditingType(null);
      setEditTypeName('');
      fetchSeedTypes();
      showToast('success', 'Seed type renamed.');
    } catch (err) {
      setTypeFormError(err.response?.data?.name?.[0] || 'Failed to rename type.');
    }
  };

  const handleDeleteType = async (id, name) => {
    if (!window.confirm(`Remove type "${name}"? All varieties under it will also be removed.`)) return;
    try {
      await deleteSeedType(id);
      fetchSeedTypes();
      showToast('success', `Type "${name}" removed.`);
    } catch {
      setTypeError('Failed to remove seed type.');
    }
  };

  // ── VARIETY HANDLERS ──
  const handleAddVariety = async () => {
    if (activePollExists) {
      showToast('warning', "Cannot add varieties while a poll is active. Close the poll first.");
      return;
    }
    if (!newVariety.seed_type || !newVariety.name.trim()) {
      setVarFormError('Please select a seed type and enter a variety name.');
      return;
    }
    setVarFormLoading(true);
    setVarFormError('');
    try {
      await createVariety(newVariety);
      setNewVariety({ seed_type: '', name: '' });
      fetchSeedTypes();
      showToast('success', `Variety "${newVariety.name}" added.`);
    } catch (err) {
      setVarFormError(err.response?.data?.name?.[0] || 'Failed to add variety.');
    } finally {
      setVarFormLoading(false);
    }
  };

  const handleDeleteVariety = async (id, name) => {
    if (!window.confirm(`Remove "${name}"? If it has votes it will be deactivated instead.`)) return;
    try {
      await deleteVariety(id);
      fetchSeedTypes();
      showToast('success', `Variety "${name}" removed.`);
    } catch {
      setTypeError('Failed to remove variety.');
    }
  };

  // ── FINALIZE SEEDS — no source toggle, auto-assigned ──
  const handleOpenFinalize = () => {
    // Reset form with current final seeds
    const preForm = {};
    finalSeeds.forEach(fs => {
      preForm[fs.seed_type.id] = { varIds: fs.varieties.map(v => v.id) };
    });
    setFinalForm(preForm);
    setFinalizeModal(true);
  };

  const handleSaveFinalSeeds = async () => {
    const payload = seedTypes
      .filter(st => st.is_active !== false)
      .map(st => ({
        seed_type_id: st.id,
        variety_ids:  finalForm[st.id]?.varIds || [],
        source:       getSourceForType(st.name), // auto-assigned, not from toggle
      }))
      .filter(p => p.variety_ids.length > 0);

    if (payload.length === 0) {
      showToast('error', 'Select at least one variety before confirming.');
      return;
    }

    setSavingFinal(true);
    try {
      await saveFinalSeeds(payload);
      await loadFinalSeeds();
      setFinalizeModal(false);
      showToast('success', 'Final seed varieties saved. Visible on all user home pages.');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to save final seeds.');
    } finally {
      setSavingFinal(false);
    }
  };

  // ── SHARED STYLES ──
  const inputStyle = (hasErr) => ({
    padding: '0.5rem 0.75rem', border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  });
  const labelStyle = { fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem', display: 'block' };

  const activePoll  = polls.find(p => p.status === 'OPEN')   || null;
  const lockedPoll  = polls.find(p => p.status === 'LOCKED') || null;
  const currentPoll = activePoll || lockedPoll;
  const canFinalize = polls.some(p => p.status === 'LOCKED' || p.status === 'CLOSED');

  return (
    <div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(12px) translateX(-50%); opacity: 0; } to { transform: translateY(0) translateX(-50%); opacity: 1; } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes modalIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      <Toast toast={toast} />

      {/* PAGE HEADER */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Seed Poll</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          Manage seed types, varieties, and farmer preference polls.
        </p>
      </div>

      {/* TAB NAV */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.25rem', border: '1px solid #e5e7eb' }}>
        {TABS.map(({ key, label, Icon: I }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{ flex: 1, padding: '0.625rem 1rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === key ? 'white' : 'transparent', color: activeTab === key ? '#1a1a1a' : '#6b7280', fontWeight: activeTab === key ? 700 : 400, cursor: 'pointer', fontSize: '0.875rem', boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
            <I size={15} /> {label}
          </button>
        ))}
      </div>


      {/* ══════════════ TAB 1: ACTIVE POLL ══════════════ */}
      {activeTab === 'poll' && (
        <div>
          {pollError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={15} /> {pollError}
            </div>
          )}

          {pollLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</div>
          ) : currentPoll ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem', border: `2px solid ${currentPoll.status === 'OPEN' ? '#bbf7d0' : '#fde68a'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <StatusBadge status={currentPoll.status} />
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{currentPoll.season_display} {currentPoll.year}</span>
                  </div>
                  <h2 style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1a1a1a', margin: 0 }}>{currentPoll.title}</h2>
                </div>
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.75rem 1.25rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#166534', margin: 0 }}>{currentPoll.total_votes}</p>
                  <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: 0 }}>Total Votes</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Season',    value: currentPoll.season_display },
                  { label: 'Year',      value: currentPoll.year },
                  { label: 'Ends',      value: new Date(currentPoll.end_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                  { label: 'Accepting', value: currentPoll.is_accepting ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ backgroundColor: '#f9fafb', borderRadius: '0.5rem', padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.25rem' }}>{label}</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{String(value)}</p>
                  </div>
                ))}
              </div>

{currentPoll.status === 'CLOSED' && (
              <div style={{
                backgroundColor: '#f3f4f6',
                border: '1.5px solid #d1d5db',
                borderRadius: '0.75rem',
                padding: '0.875rem 1.25rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
              }}>
                <XCircle size={18} color="#6b7280" />
                <div>
                  <p style={{ fontWeight: 700, color: '#374151', margin: 0, fontSize: '0.875rem' }}>Poll Closed</p>
                  <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.125rem 0 0' }}>
                    This poll is closed. Finalize seed varieties to make them available to all users.
                  </p>
                </div>
              </div>
            )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => { setSelectedPollId(currentPoll.id); setActiveTab('results'); }}
                  style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <BarChart2 size={16} /> View Results
                </button>
                <button onClick={() => setCloseConfirmId(currentPoll.id)} disabled={actionLoading[currentPoll.id] === 'close'}
                  style={{ padding: '0.5rem 1.25rem', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <XCircle size={16} />
                  {actionLoading[currentPoll.id] === 'close' ? 'Closing...' : 'Close Poll'}
                </button>
                {(currentPoll.status === 'LOCKED' || currentPoll.status === 'CLOSED') && finalSeeds.length === 0 && (
                  <div style={{ width: '100%', marginTop: '1rem' }}>
                    <div style={{
                      backgroundColor: '#f0fdf4',
                      border: '1.5px solid #bbf7d0',
                      borderRadius: '0.875rem',
                      padding: '1rem 1.25rem',
                      marginBottom: '1.25rem',
                    }}>
                      <p style={{ fontWeight: 700, color: '#166534', margin: '0 0 0.375rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Leaf size={16} /> Finalize Seed Varieties
                      </p>
                      <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                        Select and confirm which seed varieties are available for this season.
                        The finalized varieties will be used as the seed choices in Beneficiaries
                        when the Barangay President creates a distribution program.
                      </p>
                    </div>
                    <button
                      onClick={handleOpenFinalize}
                      style={{
                        width: '100%',
                        padding: '1rem 1.5rem',
                        backgroundColor: '#166534',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 16px rgba(22,101,52,0.35)',
                      }}
                    >
                      <Leaf size={18} /> Finalize Seed Varieties
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
              <Wheat size={48} color="#d1d5db" style={{ margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#374151', margin: '0 0 0.5rem' }}>No Active Poll</p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>Create a new poll to start collecting seed preferences from farmers.</p>
              <button onClick={openCreateModal}
                style={{ padding: '0.625rem 1.5rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <Plus size={16} /> Create New Poll
              </button>
            </div>
          )}

          {/* Finalize button when no current poll but past closed polls exist */}
          {!currentPoll && canFinalize && finalSeeds.length === 0 && (
            <div style={{ marginBottom: '1.5rem', backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '2px dashed #bbf7d0' }}>
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #bbf7d0',
                borderRadius: '0.875rem',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem',
              }}>
                <p style={{ fontWeight: 700, color: '#166534', margin: '0 0 0.375rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Leaf size={16} /> Finalize Seed Varieties
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                  Select and confirm which seed varieties are available for this season.
                  The finalized varieties will be used as the seed choices in Beneficiaries
                  when the Barangay President creates a distribution program.
                </p>
              </div>
              <button onClick={handleOpenFinalize}
                style={{
                  width: '100%',
                  padding: '1rem 1.5rem',
                  backgroundColor: '#166534',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 16px rgba(22,101,52,0.35)',
                }}>
                <Leaf size={18} /> Finalize Seed Varieties
              </button>
            </div>
          )}

          {/* Final Seeds Display */}
          {finalSeeds.length > 0 && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#166534', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={16} color="#166534" />
                    Final Seed Varieties — {finalSeeds[0]?.season_display} {finalSeeds[0]?.year}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.125rem 0 0' }}>
                    Visible on all user home pages · Used as choices in Beneficiaries
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {finalSeeds.map(fs => {
                  const sc = getSourceColors(fs.seed_type.name);
                  return (
                    <div key={fs.id} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1rem', border: `1px solid ${sc.border}`, flex: '1 1 180px' }}>
                      <p style={{ fontWeight: 800, fontSize: '0.875rem', color: sc.color, margin: '0 0 0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {fs.seed_type.name}
                        <span style={{ fontSize: '0.65rem', backgroundColor: sc.bg, color: sc.color, padding: '0.1rem 0.375rem', borderRadius: '999px', fontWeight: 700, border: `1px solid ${sc.border}` }}>
                          {getSourceLabel(fs.seed_type.name)}
                        </span>
                      </p>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {fs.varieties.map(v => (
                          <span key={v.id} style={{ backgroundColor: sc.bg, color: sc.color, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, border: `1px solid ${sc.border}` }}>
                            {v.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentPoll && (
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'right', marginBottom: '1rem' }}>
              Lock or close the current poll to create a new one.
            </p>
          )}

          {/* Past polls */}
          {polls.filter(p => p.status === 'CLOSED').length > 0 && (
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6' }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>Past Polls</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Title', 'Season', 'Year', 'Votes', 'Status', 'Results', 'Actions'].map(col => (
                        <th key={col} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {polls.filter(p => p.status === 'CLOSED').map((poll, idx) => (
                      <tr key={poll.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{poll.title}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{poll.season_display}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{poll.year}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>{poll.total_votes}</td>
                        <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={poll.status} /></td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <button onClick={() => { setSelectedPollId(poll.id); setActiveTab('results'); }}
                            style={{ padding: '0.3rem 0.75rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <BarChart2 size={13} /> View
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <button
                            onClick={() => handleDeletePoll(poll.id)}
                            disabled={deletingPollId === poll.id}
                            style={{ padding: '0.3rem 0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: deletingPollId === poll.id ? 0.6 : 1 }}>
                            <Trash2 size={13} />
                            {deletingPollId === poll.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ══════════════ TAB 2: TYPES & VARIETIES ══════════════ */}
      {activeTab === 'varieties' && (
        <div>
          {activePollExists && (
            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', color: '#854d0e' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>
                <strong>Active poll in progress.</strong> Adding new types or varieties is blocked until the poll is closed.
                Clicking the buttons will show a notification.
              </div>
            </div>
          )}

          {typeError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={15} /> {typeError}
            </div>
          )}

          {/* Add Seed Type */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Tag size={18} /> Add Seed Type</h3>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1rem' }}>Create a new seed category (e.g. Hybrid, Inbred)</p>
            {typeFormError && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{typeFormError}</div>}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={labelStyle}>Seed Type Name *</label>
                <input value={newTypeName} onChange={e => { setNewTypeName(e.target.value); setTypeFormError(''); }} placeholder="e.g. Hybrid, Inbred" style={inputStyle(!!typeFormError)} onKeyDown={e => e.key === 'Enter' && handleAddType()} />
              </div>
              <button onClick={handleAddType} disabled={typeFormLoading}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: activePollExists ? '#6b7280' : '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', opacity: typeFormLoading ? 0.6 : 1 }}>
                <Plus size={16} /> {typeFormLoading ? 'Adding...' : 'Add Type'}
              </button>
            </div>
          </div>

          {/* Add Variety */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Plus size={18} /> Add Variety</h3>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1rem' }}>Add a specific variety under an existing seed type</p>
            {varFormError && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{varFormError}</div>}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 200px' }}>
                <label style={labelStyle}>Seed Type *</label>
                <select value={newVariety.seed_type} onChange={e => setNewVariety(p => ({ ...p, seed_type: e.target.value }))} style={inputStyle(false)}>
                  <option value="">Select type</option>
                  {seedTypes.filter(st => st.is_active !== false).map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={labelStyle}>Variety Name *</label>
                <input value={newVariety.name} onChange={e => setNewVariety(p => ({ ...p, name: e.target.value }))} placeholder="e.g. TH 82, RC 216, Bigante Plus" style={inputStyle(false)} onKeyDown={e => e.key === 'Enter' && handleAddVariety()} />
              </div>
              <button onClick={handleAddVariety} disabled={varFormLoading}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: activePollExists ? '#6b7280' : '#1e40af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', opacity: varFormLoading ? 0.6 : 1 }}>
                <Plus size={16} /> {varFormLoading ? 'Adding...' : 'Add Variety'}
              </button>
            </div>
          </div>

          {/* Existing types */}
          {typeLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading seed types...</div>
          ) : seedTypes.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Tag size={40} color="#d1d5db" style={{ margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No seed types yet</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {seedTypes.map((seedType, typeIdx) => {
                const tc = getTypeColor(typeIdx);
                return (
                  <div key={seedType.id} style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', opacity: seedType.is_active === false ? 0.6 : 1 }}>
                    <div style={{ padding: '0.875rem 1.25rem', backgroundColor: tc.bg, borderBottom: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Tag size={16} color={tc.color} />
                      {editingType?.id === seedType.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                          <input value={editTypeName} onChange={e => setEditTypeName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEditType(seedType.id); if (e.key === 'Escape') setEditingType(null); }} style={{ flex: 1, padding: '0.25rem 0.5rem', border: `1.5px solid ${tc.color}`, borderRadius: '0.375rem', fontSize: '0.875rem', outline: 'none', fontWeight: 700 }} autoFocus />
                          <button onClick={() => handleEditType(seedType.id)} style={{ padding: '0.25rem 0.625rem', backgroundColor: tc.color, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Save</button>
                          <button onClick={() => setEditingType(null)} style={{ padding: '0.25rem 0.5rem', backgroundColor: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem' }}>×</button>
                        </div>
                      ) : (
                        <>
                          <h3 style={{ fontWeight: 700, color: tc.color, margin: 0, fontSize: '0.95rem', flex: 1 }}>
                            {seedType.name}
                            {seedType.is_active === false && <span style={{ fontSize: '0.7rem', fontWeight: 400, marginLeft: '0.5rem', opacity: 0.7 }}>(inactive)</span>}
                            {/* Auto source label */}
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', backgroundColor: 'rgba(255,255,255,0.7)', color: tc.color, padding: '0.1rem 0.375rem', borderRadius: '999px', fontWeight: 700 }}>
                              {getSourceLabel(seedType.name)}
                            </span>
                          </h3>
                          <span style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: '#374151', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px' }}>
                            {seedType.varieties?.length || 0}
                          </span>
                          <button onClick={() => { setEditingType(seedType); setEditTypeName(seedType.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.375rem', display: 'flex' }}><Edit2 size={14} color={tc.color} /></button>
                          <button onClick={() => handleDeleteType(seedType.id, seedType.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.375rem', display: 'flex' }}><Trash2 size={14} color="#dc2626" /></button>
                        </>
                      )}
                    </div>
                    <div style={{ padding: '0.75rem' }}>
                      {(!seedType.varieties || seedType.varieties.length === 0) ? (
                        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '1rem' }}>No varieties yet</p>
                      ) : seedType.varieties.map(variety => (
                        <div key={variety.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', marginBottom: '0.375rem', backgroundColor: '#f9fafb', border: '1px solid #f3f4f6' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: variety.is_active ? '#22c55e' : '#9ca3af', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: variety.is_active ? '#1a1a1a' : '#9ca3af', textDecoration: variety.is_active ? 'none' : 'line-through' }}>
                              {variety.name}
                            </span>
                            {!variety.is_active && <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontStyle: 'italic' }}>(inactive)</span>}
                          </div>
                          <button onClick={() => handleDeleteVariety(variety.id, variety.name)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <XCircle size={14} /> Remove
                          </button>
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


      {/* ══════════════ TAB 3: RESULTS ══════════════ */}
      {activeTab === 'results' && (
        <div>
          <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Select Poll:</label>
            <select value={selectedPollId || ''} onChange={e => { setSelectedPollId(Number(e.target.value)); fetchResults(Number(e.target.value)); }} style={{ padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', minWidth: '280px' }}>
              <option value="">-- Select a poll --</option>
              {polls.map(p => <option key={p.id} value={p.id}>{p.season_display} {p.year} — {p.title} ({p.status})</option>)}
            </select>
          </div>

          {resultsError && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{resultsError}</div>}

          {resultsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading results...</div>
          ) : results ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Total Votes', value: results.total_votes,    Icon: Trophy      },
                  { label: 'Season',      value: results.season_display, Icon: AlertCircle },
                  { label: 'Year',        value: results.year,           Icon: Clock       },
                  { label: 'Status',      value: results.status_display, Icon: CheckCircle },
                ].map(({ label, value, Icon: I }) => (
                  <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.125rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <I size={20} color="#2d6a2d" />
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: '0.5rem 0 0.125rem' }}>{value}</p>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Hybrid */}
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', backgroundColor: '#dbeafe', borderBottom: '1px solid #bfdbfe' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: '#1e40af' }}><Sprout size={18} /> Hybrid Results</h3>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    {!results.hybrid_results?.length ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>No votes yet</p> : results.hybrid_results.map((r, idx) => (
                      <div key={r.variety} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: idx === 0 ? '#f5c842' : '#e5e7eb', color: '#1a1a1a', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{r.rank}</span>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.variety}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#1e40af' }}>{r.votes}</span>
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({r.percent}%)</span>
                          </div>
                        </div>
                        <ProgressBar percent={r.percent} color="#1e40af" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inbred */}
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', backgroundColor: '#dcfce7', borderBottom: '1px solid #bbf7d0' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: '#166534' }}><Sprout size={18} /> Inbred Results</h3>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    {!results.inbred_results?.length ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>No votes yet</p> : results.inbred_results.map((r, idx) => (
                      <div key={r.variety} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: idx === 0 ? '#f5c842' : '#e5e7eb', color: '#1a1a1a', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{r.rank}</span>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.variety}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#166534' }}>{r.votes}</span>
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({r.percent}%)</span>
                          </div>
                        </div>
                        <ProgressBar percent={r.percent} color="#166534" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {results.barangay_breakdown?.length > 0 && (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={18} color="#374151" />
                    <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>Barangay Breakdown</h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          {['Rank', 'Barangay', 'Votes', 'Top Hybrid', 'Top Inbred'].map(col => (
                            <th key={col} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.barangay_breakdown.map((brgy, idx) => (
                          <tr key={brgy.barangay} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: idx === 0 ? '#f5c842' : '#f9fafb', color: '#1a1a1a', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{brgy.barangay}</td>
                            <td style={{ padding: '0.75rem 1rem' }}><span style={{ fontWeight: 700, color: '#2d6a2d' }}>{brgy.total_votes}</span></td>
                            <td style={{ padding: '0.75rem 1rem' }}><span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{brgy.top_hybrid}</span></td>
                            <td style={{ padding: '0.75rem 1rem' }}><span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{brgy.top_inbred}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Select a poll to view results</div>
          )}
        </div>
      )}


      {/* ══════════════ CREATE POLL MODAL ══════════════ */}
      {createModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '520px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'modalIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.25rem', margin: 0 }}>Create New Poll</h2>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Set up a seed preference poll for farmers</p>
              </div>
              <button onClick={() => setCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            {formError && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{formError}</div>}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={labelStyle}>Poll Title *</label>
              <input value={form.title} onChange={e => handleField('title', e.target.value)} placeholder={getSuggestedTitle(form.season, form.year)} style={inputStyle(!!formErrors.title)} />
              {formErrors.title && <span style={{ fontSize: '0.72rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>{formErrors.title}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <div>
                <label style={labelStyle}>Season *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {SEASON_OPTIONS.map(opt => {
                    const isActive = form.season === opt.value;
                    const isAuto = isActive && !seasonOverride && opt.value === detectedSeason;
                    return (
                      <button key={opt.value} type="button" onClick={() => handleField('season', opt.value)}
                        style={{
                          minWidth: '140px',
                          height: '40px',
                          position: 'relative',
                          padding: '0 0.9rem',
                          border: `2px solid ${isActive ? '#2d6a2d' : '#d1d5db'}`,
                          borderRadius: '0.5rem',
                          backgroundColor: isActive ? '#2d6a2d' : 'white',
                          color: isActive ? 'white' : '#374151',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'visible',
                        }}>
                        <span style={{ whiteSpace: 'nowrap' }}>{opt.label}</span>
                        {isAuto && (
                          <span style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '-10px',
                            backgroundColor: 'rgba(255,255,255,0.95)',
                            color: '#166534',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '999px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          }}>
                            Auto
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.75rem', margin: '0.5rem 0 0', color: seasonOverride ? '#c2410b' : '#166534' }}>
                  {seasonOverride
                    ? 'Manually overridden'
                    : `Auto-detected: ${detectedSeason === 'WET' ? 'Wet Season' : 'Dry Season'} (Current)`}
                </p>
              </div>
              <div>
                <label style={labelStyle}>Year *</label>
                <input type="number" value={form.year} onChange={e => handleField('year', Number(e.target.value))} min={new Date().getFullYear()} max={new Date().getFullYear() + 5} style={inputStyle(!!formErrors.year)} />
                {formErrors.year && <span style={{ fontSize: '0.72rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>{formErrors.year}</span>}
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>End Date & Time * <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.72rem' }}>(auto-closes after this)</span></label>
              <input type="datetime-local" value={form.end_date} onChange={e => handleField('end_date', e.target.value)} style={inputStyle(!!formErrors.end_date)} />
              {formErrors.end_date && <span style={{ fontSize: '0.72rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>{formErrors.end_date}</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setCreateModal(false)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreatePoll} disabled={formLoading}
                style={{ padding: '0.5rem 1.5rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, opacity: formLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Wheat size={16} /> {formLoading ? 'Creating...' : 'Create Poll'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ══════════════ FINALIZE SEEDS MODAL ══════════════ */}
      {finalizeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'modalIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Leaf size={22} color="#166534" /> Finalize Seed Varieties
                </h2>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.375rem 0 0' }}>
                  {latestClosedPoll
                    ? `${latestClosedPoll.season_display} ${latestClosedPoll.year} — Select which varieties are confirmed available.`
                    : 'Select which varieties are confirmed available from each seed type.'
                  }
                </p>
                <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.25rem 0 0' }}>
                  Source is auto-assigned: Hybrid → Region, Inbred → PhilRice
                </p>
              </div>
              <button onClick={() => setFinalizeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.5rem', padding: '0.25rem', flexShrink: 0 }}>×</button>
            </div>

            <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '1.25rem 0' }} />

            {seedTypes.filter(st => st.is_active !== false).length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No active seed types found. Add seed types first.</p>
            ) : seedTypes.filter(st => st.is_active !== false).map((seedType, typeIdx) => {
              const tc        = getTypeColor(typeIdx);
              const sc        = getSourceColors(seedType.name);
              const activeVars = (seedType.varieties || []).filter(v => v.is_active);
              const srcLabel  = getSourceLabel(seedType.name);
              return (
                <div key={seedType.id} style={{ marginBottom: '1.25rem', backgroundColor: '#f9fafb', borderRadius: '0.875rem', padding: '1rem', border: `1px solid ${tc.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: tc.color, margin: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Tag size={14} color={tc.color} /> {seedType.name}
                    </h3>
                    {/* Auto source label — not a toggle */}
                    <span style={{ padding: '0.2rem 0.625rem', fontSize: '0.7rem', fontWeight: 700, border: `1.5px solid ${sc.border}`, borderRadius: '0.375rem', backgroundColor: sc.bg, color: sc.color }}>
                      {srcLabel}
                    </span>
                  </div>

                  {activeVars.length === 0 ? (
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>No active varieties for this type. Add varieties first.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {activeVars.map(variety => {
                        const isSelected = (finalForm[seedType.id]?.varIds || []).includes(variety.id);
                        return (
                          <button key={variety.id} type="button"
                            onClick={() => {
                              const current = finalForm[seedType.id]?.varIds || [];
                              const updated = isSelected ? current.filter(id => id !== variety.id) : [...current, variety.id];
                              setFinalForm(prev => ({ ...prev, [seedType.id]: { varIds: updated } }));
                            }}
                            style={{ padding: '0.375rem 0.875rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, border: `1.5px solid ${isSelected ? tc.color : '#d1d5db'}`, backgroundColor: isSelected ? tc.bg : 'white', color: isSelected ? tc.color : '#6b7280', transition: 'all 0.15s' }}>
                            {isSelected ? <CheckCircle size={12} style={{ display: 'inline', marginRight: '0.25rem' }} /> : null}{variety.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => setFinalizeModal(false)} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSaveFinalSeeds} disabled={savingFinal}
                style={{ flex: 2, padding: '0.875rem', backgroundColor: '#166534', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.95rem', cursor: savingFinal ? 'not-allowed' : 'pointer', opacity: savingFinal ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {savingFinal ? (
                  <><div style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Saving...</>
                ) : (
                  <><CheckCircle size={18} /> Confirm Final Seeds</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ DELETE POLL CONFIRM MODAL ══════════════ */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '420px', backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '999px', backgroundColor: '#fef2f2', color: '#dc2626', margin: '0 auto 0.75rem' }}>
              <Leaf size={24} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', textAlign: 'center', fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>Delete this poll?</h3>
            <p style={{ margin: '0 0 0.75rem', textAlign: 'center', color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.5 }}>This action is permanent and cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '999px', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                {polls.find(p => p.id === deleteConfirmId)?.title || 'Selected Poll'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Cancel</button>
              <button onClick={doDeletePoll} disabled={deletingPollId === deleteConfirmId} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.75rem', cursor: deletingPollId === deleteConfirmId ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.875rem', opacity: deletingPollId === deleteConfirmId ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                {deletingPollId === deleteConfirmId ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ CLOSE POLL CONFIRM MODAL ══════════════ */}
      {closeConfirmId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '420px', backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '999px', backgroundColor: '#fef2f2', color: '#dc2626', margin: '0 auto 0.75rem' }}>
              <Leaf size={24} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', textAlign: 'center', fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>Close this poll?</h3>
            <p style={{ margin: '0 0 0.75rem', textAlign: 'center', color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.5 }}>You’re about to permanently close the poll.</p>
            <p style={{ margin: '0 0 1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.5 }}>Once closed, no more votes can be submitted and this action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '999px', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                Poll: {polls.find(p => p.id === closeConfirmId)?.title || 'Current Poll'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setCloseConfirmId(null)} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Cancel</button>
              <button onClick={() => handleClose(closeConfirmId)} disabled={actionLoading[closeConfirmId] === 'close'} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.75rem', cursor: actionLoading[closeConfirmId] === 'close' ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.875rem', opacity: actionLoading[closeConfirmId] === 'close' ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                {actionLoading[closeConfirmId] === 'close' ? 'Closing...' : 'Yes, Close Poll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeedPoll;