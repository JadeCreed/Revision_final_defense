// src/pages/admin/SeedPoll.jsx
// ============================================================
// Changes from previous version:
// 1. Tab 2 renamed "Varieties" → "Types & Varieties"
// 2. Added "Add Seed Type" section so admin can create new types
// 3. Fixed: fetchSeedTypes now uses getAdminSeedTypes (all types, not just shared)
// 4. Fixed: seed_type_name uses .name (not get_name_display)
// 5. Edit + Delete buttons on each type card header
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Lock, XCircle, Plus,
  CheckCircle, Clock, AlertCircle,
  Wheat, MapPin, Trophy, Tag, Edit2, Trash2,Sprout,
  Bean,
} from 'lucide-react';
import {
  getAdminPolls, createPoll,
  lockPoll, closePoll, getAdminPollResults,
  getAdminVarieties, createVariety, deleteVariety,
  // ✅ New imports for type management
  getAdminSeedTypes, createSeedType, updateSeedType, deleteSeedType,
} from '../../api/axios';
import { Pagination } from '../../components/tables/TableBase';

// ── TAB CONFIG — Tab 2 label updated ──
const TABS = [
  { key: 'poll',      label: 'Active Poll',       Icon: CheckCircle },
  { key: 'varieties', label: 'Types & Varieties',  Icon: Wheat       },
  { key: 'results',   label: 'Results',            Icon: BarChart2   },
];

const SEASON_OPTIONS = [
  { value: 'WET', label: 'Wet Season' },
  { value: 'DRY', label: 'Dry Season' },
];

const StatusBadge = ({ status }) => {
  const config = {
    OPEN:   { bg: '#dcfce7', color: '#166534', label: 'Open',   Icon: CheckCircle },
    LOCKED: { bg: '#fef9c3', color: '#854d0e', label: 'Locked', Icon: Lock        },
    CLOSED: { bg: '#f3f4f6', color: '#6b7280', label: 'Closed', Icon: XCircle     },
  }[status] || { bg: '#f3f4f6', color: '#6b7280', label: status, Icon: Clock };
  const { bg, color, label, Icon } = config;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: bg, color, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
      <Icon size={12} /> {label}
    </span>
  );
};

const ProgressBar = ({ percent, color = '#2d6a2d' }) => (
  <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
    <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', backgroundColor: color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
  </div>
);

// ── TYPE CARD COLORS — cycles through for visual variety ──
const TYPE_COLORS = [
  { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
  { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  { bg: '#f3e8ff', color: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
  { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
];
const getTypeColor = (idx) => TYPE_COLORS[idx % TYPE_COLORS.length];

const SeedPoll = () => {
  const [activeTab, setActiveTab] = useState('poll');

  // ── POLL STATE ──
  const [polls, setPolls]               = useState([]);
  const [pollLoading, setPollLoading]   = useState(true);
  const [pollError, setPollError]       = useState('');
  const [createModal, setCreateModal]   = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const [form, setForm] = useState({
    title: '', season: 'WET',
    year: new Date().getFullYear(), end_date: '',
  });
  const [formErrors, setFormErrors]   = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState('');

  // ── SEED TYPE STATE (NEW) ──
  const [seedTypes, setSeedTypes]           = useState([]);
  const [typeLoading, setTypeLoading]       = useState(true);
  const [typeError, setTypeError]           = useState('');
  const [newTypeName, setNewTypeName]       = useState('');
  const [typeFormError, setTypeFormError]   = useState('');
  const [typeFormLoading, setTypeFormLoading] = useState(false);
  const [editingType, setEditingType]       = useState(null); // { id, name }
  const [editTypeName, setEditTypeName]     = useState('');

  // ── VARIETY STATE ──
  const [newVariety, setNewVariety]         = useState({ seed_type: '', name: '' });
  const [varFormError, setVarFormError]     = useState('');
  const [varFormLoading, setVarFormLoading] = useState(false);

  // ── RESULTS STATE ──
  const [results, setResults]             = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError]   = useState('');
  const [selectedPollId, setSelectedPollId] = useState(null);

  // ── FETCHERS ──
  const fetchPolls = useCallback(async () => {
    try {
      setPollLoading(true);
      setPollError('');
      const res = await getAdminPolls();
      setPolls(res.data || []);
    } catch (err) {
      setPollError(err.response?.data?.error || 'Failed to load polls.');
    } finally {
      setPollLoading(false);
    }
  }, []);

  const fetchSeedTypes = useCallback(async () => {
    try {
      setTypeLoading(true);
      setTypeError('');
      // ✅ Use admin endpoint — shows ALL types including inactive
      const res = await getAdminSeedTypes();
      setSeedTypes(res.data || []);
    } catch (err) {
      // Fallback to shared varieties endpoint
      try {
        const fallback = await getAdminVarieties();
        setSeedTypes(fallback.data || []);
      } catch {
        setTypeError('Failed to load seed types. Run: python manage.py seed_seed_types');
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

  useEffect(() => { fetchPolls();     }, [fetchPolls]);
  useEffect(() => { fetchSeedTypes(); }, [fetchSeedTypes]);

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

  // ── POLL HANDLERS ──
  const handleField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFormErrors(prev => ({ ...prev, [key]: '' }));
  };

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
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create poll.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleLock = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'lock' }));
    try { await lockPoll(id); fetchPolls(); }
    catch (err) { setPollError(err.response?.data?.error || 'Failed to lock poll.'); }
    finally { setActionLoading(prev => ({ ...prev, [id]: null })); }
  };

  const handleClose = async (id) => {
    if (!window.confirm('Close this poll permanently? Cannot be undone.')) return;
    setActionLoading(prev => ({ ...prev, [id]: 'close' }));
    try { await closePoll(id); fetchPolls(); }
    catch (err) { setPollError(err.response?.data?.error || 'Failed to close poll.'); }
    finally { setActionLoading(prev => ({ ...prev, [id]: null })); }
  };

  // ── SEED TYPE HANDLERS (NEW) ──
  const handleAddType = async () => {
    const name = newTypeName.trim();
    if (!name) { setTypeFormError('Seed type name is required.'); return; }
    setTypeFormLoading(true);
    setTypeFormError('');
    try {
      await createSeedType({ name });
      setNewTypeName('');
      fetchSeedTypes();
    } catch (err) {
      const data = err.response?.data;
      setTypeFormError(data?.name?.[0] || data?.error || 'Failed to add type. May already exist.');
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
    } catch (err) {
      setTypeFormError(err.response?.data?.name?.[0] || 'Failed to rename type.');
    }
  };

  const handleDeleteType = async (id, name) => {
    if (!window.confirm(`Remove type "${name}"? All varieties under it will also be removed.`)) return;
    try {
      await deleteSeedType(id);
      fetchSeedTypes();
    } catch {
      setTypeError('Failed to remove seed type.');
    }
  };

  // ── VARIETY HANDLERS ──
  const handleAddVariety = async () => {
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
    } catch (err) {
      setVarFormError(err.response?.data?.name?.[0] || 'Failed to add variety. May already exist.');
    } finally {
      setVarFormLoading(false);
    }
  };

  const handleDeleteVariety = async (id, name) => {
    if (!window.confirm(`Remove "${name}"? If it has votes it will be deactivated instead.`)) return;
    try {
      await deleteVariety(id);
      fetchSeedTypes();
    } catch {
      setTypeError('Failed to remove variety.');
    }
  };

  // ── SHARED STYLES ──
  const inputStyle = (hasErr) => ({
    padding: '0.5rem 0.75rem',
    border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem',
    width: '100%', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  });

  const labelStyle = {
    fontSize: '0.75rem', fontWeight: '600',
    color: '#374151', marginBottom: '0.25rem', display: 'block',
  };

  const activePoll  = polls.find(p => p.status === 'OPEN')   || null;
  const lockedPoll  = polls.find(p => p.status === 'LOCKED') || null;
  const currentPoll = activePoll || lockedPoll;

  return (
    <div>

      {/* PAGE HEADER */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          Seed Poll
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          Manage seed types, varieties, and farmer preference polls.
        </p>
      </div>

      {/* TAB NAV */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.25rem', border: '1px solid #e5e7eb' }}>
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{ flex: 1, padding: '0.625rem 1rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === key ? 'white' : 'transparent', color: activeTab === key ? '#1a1a1a' : '#6b7280', fontWeight: activeTab === key ? 700 : 400, cursor: 'pointer', fontSize: '0.875rem', boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>


      {/* ══════════════ TAB 1: ACTIVE POLL ══════════════ */}
      {activeTab === 'poll' && (
        <div>
          {pollError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              ⚠️ {pollError}
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
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.75rem 1.25rem', textAlign: 'center', minWidth: '100px' }}>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#166534', margin: 0 }}>{currentPoll.total_votes}</p>
                  <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: 0 }}>Total Votes</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Season',  value: currentPoll.season_display },
                  { label: 'Year',    value: currentPoll.year },
                  { label: 'Ends',    value: new Date(currentPoll.end_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                  { label: 'Accepting', value: currentPoll.is_accepting ? '✅ Yes' : '🚫 No' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ backgroundColor: '#f9fafb', borderRadius: '0.5rem', padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.25rem' }}>{label}</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{String(value)}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={() => { setSelectedPollId(currentPoll.id); setActiveTab('results'); }}
                  style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <BarChart2 size={16} /> View Results
                </button>
                {currentPoll.status === 'OPEN' && (
                  <button onClick={() => handleLock(currentPoll.id)} disabled={actionLoading[currentPoll.id] === 'lock'}
                    style={{ padding: '0.5rem 1.25rem', backgroundColor: '#fef9c3', color: '#854d0e', border: '1.5px solid #fde68a', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Lock size={16} />
                    {actionLoading[currentPoll.id] === 'lock' ? 'Locking...' : 'Lock Poll'}
                  </button>
                )}
                <button onClick={() => handleClose(currentPoll.id)} disabled={actionLoading[currentPoll.id] === 'close'}
                  style={{ padding: '0.5rem 1.25rem', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <XCircle size={16} />
                  {actionLoading[currentPoll.id] === 'close' ? 'Closing...' : 'Close Poll'}
                </button>
              </div>
            </div>
          ) : (
            // ── No active poll ──
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
              <Wheat size={48} color="#d1d5db" style={{ margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#374151', margin: '0 0 0.5rem' }}>No Active Poll</p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
                Create a new poll to start collecting seed preferences from farmers.
              </p>
              <button onClick={() => setCreateModal(true)}
                style={{ padding: '0.625rem 1.5rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <Plus size={16} /> Create New Poll
              </button>
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
                      {['Title', 'Season', 'Year', 'Votes', 'Status', 'Results'].map(col => (
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
          {typeError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              ⚠️ {typeError}
            </div>
          )}

          {/* ── SECTION A: Add Seed Type (NEW) ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={18} /> Add Seed Type
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1rem' }}>
              Create a new seed category (e.g. Own Seed, Certified Seed)
            </p>
            {typeFormError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {typeFormError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={labelStyle}>Seed Type Name *</label>
                <input
                  value={newTypeName}
                  onChange={e => { setNewTypeName(e.target.value); setTypeFormError(''); }}
                  placeholder="e.g. Own Seed, Certified, Traditional"
                  style={inputStyle(!!typeFormError)}
                  onKeyDown={e => e.key === 'Enter' && handleAddType()}
                />
              </div>
              <button onClick={handleAddType} disabled={typeFormLoading}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', whiteSpace: 'nowrap' }}>
                <Plus size={16} />
                {typeFormLoading ? 'Adding...' : 'Add Type'}
              </button>
            </div>
          </div>

          {/* ── SECTION B: Add Variety ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> Add Variety
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1rem' }}>
              Add a specific variety under an existing seed type
            </p>
            {varFormError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {varFormError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 200px' }}>
                <label style={labelStyle}>Seed Type *</label>
                <select
                  value={newVariety.seed_type}
                  onChange={e => setNewVariety(prev => ({ ...prev, seed_type: e.target.value }))}
                  style={inputStyle(false)}
                >
                  <option value="">Select type</option>
                  {/* ✅ Only show active types in the dropdown */}
                  {seedTypes.filter(st => st.is_active !== false).map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={labelStyle}>Variety Name *</label>
                <input
                  value={newVariety.name}
                  onChange={e => setNewVariety(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. RC 216, Bigante Plus, TH 82"
                  style={inputStyle(false)}
                  onKeyDown={e => e.key === 'Enter' && handleAddVariety()}
                />
              </div>
              <button onClick={handleAddVariety} disabled={varFormLoading}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', whiteSpace: 'nowrap' }}>
                <Plus size={16} />
                {varFormLoading ? 'Adding...' : 'Add Variety'}
              </button>
            </div>
          </div>

          {/* ── SECTION C: Existing types + varieties ── */}
          {typeLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading seed types...</div>
          ) : seedTypes.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <Tag size={40} color="#d1d5db" style={{ margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No seed types yet</p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                Add a type above to get started, or run: <code>python manage.py seed_seed_types</code>
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {seedTypes.map((seedType, typeIdx) => {
                const tc = getTypeColor(typeIdx);
                return (
                  <div key={seedType.id} style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', opacity: seedType.is_active === false ? 0.6 : 1 }}>
                    {/* Type header with edit + delete */}
                    <div style={{ padding: '0.875rem 1.25rem', backgroundColor: tc.bg, borderBottom: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Tag size={16} color={tc.color} />

                      {/* Inline edit mode */}
                      {editingType?.id === seedType.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                          <input
                            value={editTypeName}
                            onChange={e => setEditTypeName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleEditType(seedType.id);
                              if (e.key === 'Escape') setEditingType(null);
                            }}
                            style={{ flex: 1, padding: '0.25rem 0.5rem', border: `1.5px solid ${tc.color}`, borderRadius: '0.375rem', fontSize: '0.875rem', outline: 'none', fontWeight: 700 }}
                            autoFocus
                          />
                          <button onClick={() => handleEditType(seedType.id)}
                            style={{ padding: '0.25rem 0.625rem', backgroundColor: tc.color, color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                            Save
                          </button>
                          <button onClick={() => setEditingType(null)}
                            style={{ padding: '0.25rem 0.5rem', backgroundColor: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 style={{ fontWeight: 700, color: tc.color, margin: 0, fontSize: '0.95rem', flex: 1 }}>
                            {seedType.name}
                            {seedType.is_active === false && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 400, marginLeft: '0.5rem', opacity: 0.7 }}>(inactive)</span>
                            )}
                          </h3>
                          {/* Variety count badge */}
                          <span style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: '#374151', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px' }}>
                            {seedType.varieties?.length || 0}
                          </span>
                          {/* Edit button */}
                          <button
                            onClick={() => { setEditingType(seedType); setEditTypeName(seedType.name); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.375rem', display: 'flex' }}
                            title="Rename type"
                          >
                            <Edit2 size={14} color={tc.color} />
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteType(seedType.id, seedType.name)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.375rem', display: 'flex' }}
                            title="Remove type"
                          >
                            <Trash2 size={14} color="#dc2626" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Varieties list */}
                    <div style={{ padding: '0.75rem' }}>
                      {(!seedType.varieties || seedType.varieties.length === 0) ? (
                        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '1rem' }}>
                          No varieties yet — add one above
                        </p>
                      ) : seedType.varieties.map(variety => (
                        <div key={variety.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', marginBottom: '0.375rem', backgroundColor: '#f9fafb', border: '1px solid #f3f4f6' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: variety.is_active ? '#22c55e' : '#9ca3af', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: variety.is_active ? '#1a1a1a' : '#9ca3af', textDecoration: variety.is_active ? 'none' : 'line-through' }}>
                              {variety.name}
                            </span>
                            {!variety.is_active && (
                              <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontStyle: 'italic' }}>(inactive)</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteVariety(variety.id, variety.name)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
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
            <select
              value={selectedPollId || ''}
              onChange={e => { setSelectedPollId(Number(e.target.value)); fetchResults(Number(e.target.value)); }}
              style={{ padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', minWidth: '280px' }}
            >
              <option value="">-- Select a poll --</option>
              {polls.map(p => (
                <option key={p.id} value={p.id}>
                  {p.season_display} {p.year} — {p.title} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {resultsError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {resultsError}
            </div>
          )}

          {resultsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading results...</div>
          ) : results ? (
            <div>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Total Votes', value: results.total_votes,    Icon: Trophy,        color: '#2d6a2d' },
                  { label: 'Season',      value: results.season_display, Icon: AlertCircle,   color: '#1e40af' },
                  { label: 'Year',        value: results.year,           Icon: Clock,         color: '#854d0e' },
                  { label: 'Status',      value: results.status_display, Icon: CheckCircle,   color: '#6b7280' },
                ].map(({ label, value, Icon: I, color }) => (
                  <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '1.125rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <I size={20} color={color} />
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color, margin: '0.5rem 0 0.125rem' }}>{value}</p>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Hybrid + Inbred results */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Hybrid */}
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', backgroundColor: '#dbeafe', borderBottom: '1px solid #bfdbfe' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sprout size={18} />
                      Hybrid Results
                    </h3>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    {!results.hybrid_results?.length ? (
                      <p style={{ color: '#9ca3af', textAlign: 'center' }}>No votes yet</p>
                    ) : results.hybrid_results.map((r, idx) => (
                      <div key={r.variety} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: idx === 0 ? '#f5c842' : idx === 1 ? '#d1d5db' : '#e5e7eb', color: '#1a1a1a', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {r.rank}
                            </span>
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
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sprout size={18} />
                      Inbred Results
                    </h3>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    {!results.inbred_results?.length ? (
                      <p style={{ color: '#9ca3af', textAlign: 'center' }}>No votes yet</p>
                    ) : results.inbred_results.map((r, idx) => (
                      <div key={r.variety} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: idx === 0 ? '#f5c842' : idx === 1 ? '#d1d5db' : '#e5e7eb', color: '#1a1a1a', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {r.rank}
                            </span>
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

              {/* Barangay breakdown */}
              {results.barangay_breakdown?.length > 0 && (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={18} color="#374151" />
                    <div>
                      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>Barangay Breakdown</h3>
                      <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>Most active barangay first</p>
                    </div>
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
                              <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: idx === 0 ? '#f5c842' : idx === 1 ? '#e5e7eb' : idx === 2 ? '#fde68a' : '#f9fafb', color: '#1a1a1a', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                {idx + 1}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{brgy.barangay}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ fontWeight: 700, color: '#2d6a2d' }}>{brgy.total_votes}</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                                {brgy.top_hybrid}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                                {brgy.top_inbred}
                              </span>
                            </td>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '520px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.25rem', margin: 0 }}>Create New Poll</h2>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Set up a seed preference poll for farmers</p>
              </div>
              <button onClick={() => setCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>

            {formError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {formError}
              </div>
            )}

            <div style={{ marginBottom: '0.875rem' }}>
              <label style={labelStyle}>Poll Title *</label>
              <input value={form.title} onChange={e => handleField('title', e.target.value)} placeholder="e.g. Wet Season 2026 Seed Preference Poll" style={inputStyle(!!formErrors.title)} />
              {formErrors.title && <span style={{ fontSize: '0.72rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>{formErrors.title}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <div>
                <label style={labelStyle}>Season *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {SEASON_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => handleField('season', opt.value)}
                      style={{ flex: 1, padding: '0.5rem', border: `2px solid ${form.season === opt.value ? '#2d6a2d' : '#d1d5db'}`, borderRadius: '0.5rem', backgroundColor: form.season === opt.value ? '#2d6a2d' : 'white', color: form.season === opt.value ? 'white' : '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Year *</label>
                <input type="number" value={form.year} onChange={e => handleField('year', Number(e.target.value))} min={new Date().getFullYear()} max={new Date().getFullYear() + 5} style={inputStyle(!!formErrors.year)} />
                {formErrors.year && <span style={{ fontSize: '0.72rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>{formErrors.year}</span>}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>
                End Date & Time *
                <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.72rem' }}>(auto-closes after this)</span>
              </label>
              <input type="datetime-local" value={form.end_date} onChange={e => handleField('end_date', e.target.value)} style={inputStyle(!!formErrors.end_date)} min={new Date().toISOString().slice(0, 16)} />
              {formErrors.end_date && <span style={{ fontSize: '0.72rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>{formErrors.end_date}</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setCreateModal(false)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreatePoll} disabled={formLoading}
                style={{ padding: '0.5rem 1.5rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, opacity: formLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Wheat size={16} />
                {formLoading ? 'Creating...' : 'Create Poll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeedPoll;