// src/pages/at/ATFarmers.jsx
// ─────────────────────────────────────────────────────────────
// AT Farmer Viewer — full farmer information hub.
// NOT for encoding (that's CropMonitoring).
// Shows complete farmer journey: profile → beneficiaries →
// distribution → crop phase history in one place.
// AT uses this to CHECK status, not to encode.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, ChevronRight, ChevronLeft, Users,
  RefreshCw, CheckCircle, AlertCircle, Clock,
  Leaf, Package, FileText, MapPin, Phone,
  User, BarChart2, Wheat, X,
} from 'lucide-react';
import {
  getATFarmers,
  getATDashboardStats,
  getFarmerCropHistory,
  getATFarmerDetail,
  getFinalSeeds,
} from '../../api/axios';

// ─────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────
const GREEN = {
  primary: '#1a4d1a',
  light:   '#f0fdf4',
  border:  '#bbf7d0',
  accent:  '#166534',
  soft:    '#dcfce7',
};

const PHASE_CFG = {
  DISTRIBUTION:  { label: 'Seed Distribution',  color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', dot: '#9CA3AF' },
  ESTABLISHMENT: { label: 'Crop Establishment', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', dot: '#3B82F6' },
  TILLERING:     { label: 'Tillering',          color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '#22C55E' },
  FLOWERING:     { label: 'Flowering',          color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff', dot: '#A855F7' },
  RIPENING:      { label: 'Ripening',           color: '#ca8a04', bg: '#fefce8', border: '#fde68a', dot: '#FACC15' },
  HARVESTING:    { label: 'Harvesting',         color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', dot: '#F97316' },
};

const getPhaseCfg = (key) =>
  PHASE_CFG[key] || { label: 'Not monitored', color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af' };

// ─────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 900,
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

const PhaseBadge = ({ phase, size = 'md' }) => {
  const cfg = getPhaseCfg(phase);
  return (
    <span style={{
      backgroundColor: cfg.bg, color: cfg.color,
      padding: size === 'sm' ? '0.1rem 0.5rem' : '0.2rem 0.625rem',
      borderRadius: '999px',
      fontSize: size === 'sm' ? '0.65rem' : '0.72rem',
      fontWeight: 700,
      border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
};

// Vertical timeline step for crop phase history
const TimelineStep = ({ record, isLast }) => {
  const cfg = getPhaseCfg(record.crop_phase);
  return (
    <div style={{ display: 'flex', gap: '0.875rem' }}>
      {/* Line + dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          backgroundColor: cfg.dot, border: '2px solid white',
          boxShadow: `0 0 0 2px ${cfg.dot}44`, flexShrink: 0,
          marginTop: '0.125rem',
        }} />
        {!isLast && (
          <div style={{ width: 2, flex: 1, backgroundColor: '#e5e7eb', marginTop: '0.25rem' }} />
        )}
      </div>
      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem', flexWrap: 'wrap', gap: '0.25rem' }}>
          <PhaseBadge phase={record.crop_phase} size="sm" />
          <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
            {new Date(record.date_observed).toLocaleDateString('en-PH', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.5 }}>
          {record.area_monitored_ha && (
            <span>Area: {record.area_monitored_ha} ha</span>
          )}
          {record.crop_establishment && (
            <span> · {record.crop_establishment === 'DS' ? 'Direct Seeding' : 'Transplanting'}</span>
          )}
          {record.sowing_date && (
            <span style={{ display: 'block' }}>
              Sowing: {new Date(record.sowing_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {record.remarks && (
            <span style={{ display: 'block', color: '#6b7280', fontStyle: 'italic', marginTop: '0.25rem' }}>
              "{record.remarks}"
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.65rem', color: '#d1d5db', margin: '0.375rem 0 0' }}>
          by {record.encoded_by_name}
        </p>
      </div>
    </div>
  );
};

// Info row used in farmer detail panel
const InfoRow = ({ label, value, valueColor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid #f9fafb', gap: '0.5rem' }}>
    <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: '0.78rem', color: valueColor || '#374151', fontWeight: 500, textAlign: 'right' }}>{value || '—'}</span>
  </div>
);

// Progress summary focused on AT monitoring and seed tracking
// Progress summary focused on AT monitoring and seed tracking — Redesigned Header
const SeasonProgress = ({ farmer, distributionEntries }) => {
  const currentDist = distributionEntries?.[0]; // Kukunin ang pinakaunang current season distribution record (filtered na mula sa backend)
  const assigned = !!currentDist;
  const seedLabel = currentDist 
    ? `${currentDist.seed_type} — ${currentDist.variety_name || 'Unspecified Variety'}` 
    : 'No seed assignment found';
  
  const observed = !!farmer.latest_phase;
  const observedDate = farmer.latest_observed ? new Date(farmer.latest_observed).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
      {/* Sleek KPI Card 1: Seed Assignment */}
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.2)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Wheat size={20} color="#16a34a" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Seed variety</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', fontWeight: 800, color: '#111827' }}>
            {seedLabel}
          </p>
          <span style={{ display: 'inline-block', marginTop: '0.4rem', fontSize: '0.65rem', fontWeight: 700, color: assigned ? '#166534' : '#991b1b', backgroundColor: assigned ? '#dcfce7' : '#fee2e2', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
            {assigned ? 'Assigned' : 'Not Assigned'}
          </span>
        </div>
      </div>

      {/* Sleek KPI Card 2: Field Observation */}
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.2)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Leaf size={20} color="#2563eb" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Field Phase</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', fontWeight: 800, color: '#111827' }}>
            {observed ? getPhaseCfg(farmer.latest_phase).label : 'No observations recorded'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem' }}>
            <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, color: observed ? '#1e40af' : '#4b5563', backgroundColor: observed ? '#dbeafe' : '#f3f4f6', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
              {observed ? 'Recorded' : 'Pending Visit'}
            </span>
            {observedDate && <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>({observedDate})</span>}
          </div>
        </div>
      </div>
    </div>
  );
};                                                                                       // ◀── PINALITAN (HEADER REDESIGN)

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────
const ATFarmers = () => {
  // ── VIEW ──
  // 'list' | 'detail'
  const [view, setView]   = useState('list');

  // ── LIST STATE ──
  const [farmers,    setFarmers]    = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [brgyFilter, setBrgyFilter] = useState('');
  const [barangays,  setBarangays]  = useState([]);

  // ── DETAIL STATE ──
  const [selectedFarmer,  setSelectedFarmer]  = useState(null);
  const [farmerProfile,   setFarmerProfile]   = useState(null);
  const [cropHistory,     setCropHistory]     = useState(null);
  const [detailLoading,   setDetailLoading]   = useState(false);
  const [historyLoading,  setHistoryLoading]  = useState(false);
  const [finalSeeds,      setFinalSeeds]      = useState([]);
  const [seasonOptions,   setSeasonOptions]   = useState([]);
  const [yearOptions,     setYearOptions]     = useState([]);
  const [seasonFilter,    setSeasonFilter]    = useState('');
  const [yearFilter,      setYearFilter]      = useState('');
  const [selectedSeedTab, setSelectedSeedTab] = useState('HYBRID'); 

  // ── ACTIVE DETAIL TAB ──
  // 'overview' | 'history'
  const [detailTab, setDetailTab] = useState('overview');

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ─────────────────────────────────────────
  // LOAD FINAL SEED / SEASON DATA
  // ─────────────────────────────────────────
  useEffect(() => {
    let canceled = false;
    getFinalSeeds()
      .then(res => {
        if (!canceled) setFinalSeeds(res.data || []);
      })
      .catch(() => {
        if (!canceled) setFinalSeeds([]);
      });
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    let canceled = false;
    getFinalSeeds({ all: true })
      .then(res => {
        if (canceled) return;
        const uniqueSeasons = [];
        const uniqueYears = [];
        res.data.forEach(item => {
          if (!uniqueSeasons.some(entry => entry.season === item.season)) {
            uniqueSeasons.push({
              season: item.season,
              season_display: item.season_display,
            });
          }
          if (!uniqueYears.includes(item.year)) {
            uniqueYears.push(item.year);
          }
        });
        setSeasonOptions(uniqueSeasons);
        setYearOptions(uniqueYears.sort((a, b) => b - a));
      })
      .catch(() => {
        if (!canceled) {
          setSeasonOptions([]);
          setYearOptions([]);
        }
      });
    return () => { canceled = true; };
  }, []);

  // ─────────────────────────────────────────
  // LOAD LIST
  // ─────────────────────────────────────────
  const loadList = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const [fRes, sRes] = await Promise.all([
        getATFarmers({ barangay: brgyFilter }),
        getATDashboardStats(),
      ]);
      setFarmers(fRes.data?.farmers || []);
      setBarangays(fRes.data?.barangays || []);
      setStats(sRes.data);
    } catch {
      showToast('error', 'Failed to load farmers. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [brgyFilter, showToast]);

  useEffect(() => { loadList(); }, [brgyFilter, loadList]);

  const handleSearch = (q) => {
    setSearch(q);
  };

  const getSelectedSeason = () => {
    return seasonOptions.find(option => option.season === seasonFilter);
  };

  const buildHistoryQuery = () => {
    const params = {};
    if (seasonFilter) params.season = seasonFilter;
    if (yearFilter) params.year = yearFilter;
    return params;
  };

  useEffect(() => {
    if (!selectedFarmer || !view || view !== 'detail') return;
    const params = buildHistoryQuery();
    setHistoryLoading(true);
    getFarmerCropHistory(selectedFarmer.id, params)
      .then(res => {
        setCropHistory(res.data);
      })
      .catch(() => {
        showToast('error', 'Failed to refresh season history.');
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, [seasonFilter, yearFilter, selectedFarmer, view, seasonOptions, showToast]); 

  // ─────────────────────────────────────────
  // OPEN FARMER DETAIL
  // Loads full profile + crop history in parallel
  // ─────────────────────────────────────────
  const openDetail = async (farmer) => {
    setSelectedFarmer(farmer);
    setView('detail');
    setDetailTab('overview');
    setSelectedSeedTab('HYBRID'); 
    setDetailLoading(true);
    setHistoryLoading(true);
    setSeasonFilter('');
    setYearFilter('');
    setCropHistory(null);
    setFarmerProfile(null);

    try {
      const [profileRes, historyRes] = await Promise.all([
        getATFarmerDetail(farmer.id),
        getFarmerCropHistory(farmer.id, buildHistoryQuery()),
      ]);
      setFarmerProfile(profileRes.data);
      setCropHistory(historyRes.data);
    } catch (error) {
      const message = error?.response?.status === 403
        ? 'You do not have permission to view this farmer.'
        : 'Failed to load farmer details.';
      showToast('error', message);
    } finally {
      setDetailLoading(false);
      setHistoryLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────

  const filteredFarmers = farmers.filter(f => {
    const query = search.trim().toLowerCase();
    if (query) {
      const target = `${f.full_name || ''} ${f.rsbsa_number || ''} ${f.contact_number || ''}`.toLowerCase();
      if (!target.includes(query)) return false;
    }
    return true;
  });

  // Group farmers by barangay for the list view
  const farmersByBrgy = filteredFarmers.reduce((acc, f) => {
    const key = f.barangay || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  // Phase distribution for stats overview
  const phaseDistribution = farmers.reduce((acc, f) => {
    const key = f.latest_phase || 'NOT_MONITORED';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const totalMonitored   = farmers.filter(f => !!f.latest_phase).length;
  const totalUnmonitored = farmers.filter(f => !f.latest_phase).length;
  const totalFarmersCount = farmers.length;      
  const totalBarangaysCount = barangays.length;  


  const activeSeason = cropHistory?.selected_season || (finalSeeds[0] ? {
    season: finalSeeds[0].season,
    year: finalSeeds[0].year,
    season_display: finalSeeds[0].season_display,
  } : null);

  const selectedSeasonLabel = seasonFilter
    ? seasonFilter === 'WET' ? 'Wet Season' : 'Dry Season'
    : null;
  const selectedYearLabel = yearFilter || activeSeason?.year;
  const activeSeasonLabel = selectedSeasonLabel
    ? `${selectedSeasonLabel}${selectedYearLabel ? ` ${selectedYearLabel}` : ''}`
    : activeSeason
      ? `${activeSeason.season_display} ${activeSeason.year}`
      : 'No active season currently';

  const observationsThisSeason = cropHistory?.records?.length ?? 0;
  const observationSummary = `${observationsThisSeason} Observation${observationsThisSeason !== 1 ? 's' : ''}`;

  // ─────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#9ca3af' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }
          @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
          @keyframes slideUp { from { transform:translateY(10px); opacity:0; } to { transform:translateY(0); opacity:1; } }
          @keyframes slideInRight { from { transform:translateX(20px); opacity:0; } to { transform:translateX(0); opacity:1; } }
        `}</style>
        <div style={{ width: 36, height: 36, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading farmers...</p>
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
        @keyframes toastIn { from { transform: translateX(-50%) translateY(20px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes slideUp { from { transform:translateY(10px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes slideInRight { from { transform:translateX(20px); opacity:0; } to { transform:translateX(0); opacity:1; } }
        .farmer-row:hover { background-color: ${GREEN.light} !important; }
        .tab-btn:hover { background-color: #f9fafb !important; }
      `}</style>

      <Toast toast={toast} />

      {/* ══════════════════════════════════════════
          VIEW: LIST
      ══════════════════════════════════════════ */}
      {view === 'list' && (
        <div style={{ padding: '1.25rem', animation: 'fadeIn 0.25s ease' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
                My Farmers
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                Complete farmer overview for your assigned barangays
              </p>
            </div>
            <button
              onClick={() => loadList(true)}
              disabled={refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', backgroundColor: GREEN.light, color: GREEN.accent, border: `1px solid ${GREEN.border}`, borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* ── STATS OVERVIEW ── */}
          {stats && (
            <>
              {/* Main stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Total Farmers',   value: totalFarmersCount,         color: '#374151'     }, 
                  { label: 'Monitored',        value: totalMonitored,            color: '#16a34a'     }, 
                  { label: 'Not Monitored',    value: totalUnmonitored,          color: '#dc2626'     }, 
                  { label: 'Barangays',        value: totalBarangaysCount,       color: GREEN.primary }, 
                ].map(({ label, value, color }, i) => (
                  <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animation: `slideUp ${0.3 + i * 0.05}s ease` }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: '0 0 0.125rem', lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.4 }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Phase distribution mini chart */}
              {farmers.length > 0 && (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 0.875rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart2 size={13} /> Season Phase Summary
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Unmonitored */}
                    {totalUnmonitored > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: '#e5e7eb' }} />
                            Not yet monitored
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af' }}>
                            {totalUnmonitored} ({Math.round((totalUnmonitored / farmers.length) * 100)}%)
                          </span>
                        </div>
                        <div style={{ height: 6, backgroundColor: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((totalUnmonitored / farmers.length) * 100)}%`, height: '100%', backgroundColor: '#e5e7eb', borderRadius: '999px' }} />
                        </div>
                      </div>
                    )}
                    {/* Phase bars */}
                    {Object.entries(PHASE_CFG).map(([key, cfg]) => {
                      const count = phaseDistribution[key] || 0;
                      if (count === 0) return null;
                      const pct = Math.round((count / farmers.length) * 100);
                      return (
                        <div key={key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: cfg.dot }} />
                              {cfg.label}
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151' }}>
                              {count} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ height: 6, backgroundColor: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: cfg.dot, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── SEARCH + FILTER ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem', border: '1px solid #f3f4f6' }}>
            <div style={{ position: 'relative', marginBottom: barangays.length > 1 ? '0.75rem' : 0 }}>
              <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search by name, RSBSA, or contact..."
                style={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {barangays.length > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => setBrgyFilter('')}
                  style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${!brgyFilter ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: !brgyFilter ? GREEN.light : 'white', color: !brgyFilter ? GREEN.primary : '#6b7280', fontWeight: !brgyFilter ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer' }}>
                  All Barangays
                </button>
                {barangays.map(b => (
                  <button key={b} onClick={() => setBrgyFilter(b)}
                    style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${brgyFilter === b ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: brgyFilter === b ? GREEN.light : 'white', color: brgyFilter === b ? GREEN.primary : '#6b7280', fontWeight: brgyFilter === b ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer' }}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── FARMER LIST — grouped by barangay ── */}
          {filteredFarmers.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
              <Users size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No farmers found</p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                {search ? 'Try a different search term.' : 'No approved farmers in your assigned barangays.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.entries(brgyFilter ? { [brgyFilter]: filteredFarmers } : farmersByBrgy).map(([brgy, brgyFarmers], gIdx) => (
                <div key={brgy} style={{ animation: `slideUp ${0.3 + gIdx * 0.05}s ease` }}>
                  {/* Barangay header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
                    <MapPin size={13} color={GREEN.primary} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: GREEN.accent }}>
                      Brgy. {brgy}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
                      — {brgyFarmers.length} farmer{brgyFarmers.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Farmers */}
                  <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
                    {brgyFarmers.map((farmer, idx) => {
                      const phaseCfg = farmer.latest_phase ? PHASE_CFG[farmer.latest_phase] : null;
                      return (
                        <div key={farmer.id} className="farmer-row"
                          onClick={() => openDetail(farmer)}
                          style={{ padding: '0.875rem 1.25rem', borderBottom: idx < brgyFarmers.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: 'white', transition: 'background 0.15s', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: 0 }}>
                            {/* Phase dot avatar */}
                            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: phaseCfg ? `${phaseCfg.dot}18` : '#f3f4f6', border: `1.5px solid ${phaseCfg ? phaseCfg.dot : '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {phaseCfg
                                ? <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: phaseCfg.dot }} />
                                : <Leaf size={16} color="#d1d5db" />
                              }
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {farmer.full_name}
                              </p>
                              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                                {farmer.rsbsa_number || 'No RSBSA'}
                              </p>
                              {/* Phase + date */}
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: phaseCfg ? phaseCfg.color : '#d1d5db' }}>
                                  {phaseCfg ? phaseCfg.label : 'Not yet monitored'}
                                </span>
                                {farmer.latest_observed && (
                                  <span style={{ fontSize: '0.62rem', color: '#d1d5db' }}>
                                    · {new Date(farmer.latest_observed).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                              {farmer.distributed_variety && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: GREEN.accent }}>
                                    Seed: {farmer.distributed_variety}
                                  </span>
                                </div>
                              )}
                              {!farmer.distributed_variety && farmer.distributed_seed_type && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: GREEN.accent }}>
                                    Seed type: {farmer.distributed_seed_type}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.68rem', color: GREEN.accent, fontWeight: 600 }}>View</span>
                            <ChevronRight size={15} color={GREEN.accent} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          VIEW: FARMER DETAIL
      ══════════════════════════════════════════ */}
      {view === 'detail' && selectedFarmer && (
        <div style={{ padding: '1.25rem', animation: 'slideInRight 0.25s ease' }}>
          {/* ── Back nav ── */}
          <button
            onClick={() => { setView('list'); setSelectedFarmer(null); setFarmerProfile(null); setCropHistory(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN.primary, fontWeight: 700, fontSize: '0.8rem', padding: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <ChevronLeft size={15} /> My Farmers
          </button>

          {/* ── Farmer card header ── */}
          {/* ── Farmer card header — Clean & Minimal ── */}
          <div style={{ backgroundColor: GREEN.primary, borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.125rem', flexShrink: 0 }}>
                {selectedFarmer.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0, color: 'white' }}>
                  {selectedFarmer.full_name}
                </h2>
                <p style={{ fontSize: '0.75rem', opacity: 0.75, margin: '0.25rem 0 0' }}>
                  {selectedFarmer.rsbsa_number || 'No RSBSA'} · Brgy. {selectedFarmer.barangay}
                </p>
              </div>
            </div>
          </div>                                                                                 

          {/* ── Tab navigation ── */}
          <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.25rem', marginBottom: '1.25rem', border: '1px solid #e5e7eb' }}>
            {[
              { key: 'overview', label: 'Overview', Icon: User },
              { key: 'history',  label: 'Crop History', Icon: Leaf },
            ].map(({ key, label, Icon }) => (
              <button key={key} className="tab-btn"
                onClick={() => setDetailTab(key)}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', backgroundColor: detailTab === key ? 'white' : 'transparent', color: detailTab === key ? '#1a1a1a' : '#6b7280', fontWeight: detailTab === key ? 700 : 400, cursor: 'pointer', fontSize: '0.8rem', boxShadow: detailTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* ── LOADING SPINNER ── */}
          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
              Loading farmer details...
            </div>
          ) : (
            <>
              {/* ── TAB: OVERVIEW ── */}
              {detailTab === 'overview' && (
                <div style={{ animation: 'fadeIn 0.2s ease' }}>

                  {/* Current Phase tile */}
                  <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 0.75rem', letterSpacing: '0.04em' }}>
                      Current Crop Phase
                    </p>
                    {selectedFarmer.latest_phase ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: getPhaseCfg(selectedFarmer.latest_phase).bg, border: `2px solid ${getPhaseCfg(selectedFarmer.latest_phase).border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: getPhaseCfg(selectedFarmer.latest_phase).dot }} />
                        </div>
                        <div>
                          <p style={{ fontWeight: 800, fontSize: '1rem', color: getPhaseCfg(selectedFarmer.latest_phase).color, margin: 0 }}>
                            {getPhaseCfg(selectedFarmer.latest_phase).label}
                          </p>
                          {selectedFarmer.latest_observed && (
                            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                              Last observed {new Date(selectedFarmer.latest_observed).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.625rem' }}>
                        <Leaf size={20} color="#d1d5db" />
                        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                          No crop phase recorded yet this season.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Distribution status */}
                  <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 0.875rem', letterSpacing: '0.04em' }}>
                      Distribution Status
                    </p>
                    {farmerProfile?.distribution_entries?.length > 0 ? (
                      farmerProfile.distribution_entries.map((entry, idx) => (
                        <div key={idx} style={{ backgroundColor: GREEN.light, borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: idx < farmerProfile.distribution_entries.length - 1 ? '0.5rem' : 0, border: `1px solid ${GREEN.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: GREEN.accent }}>
                              {entry.seed_type || 'Seed'} — {entry.variety_name || '—'}
                            </span>
                            <span style={{ backgroundColor: entry.is_distributed ? GREEN.soft : '#fef9c3', color: entry.is_distributed ? GREEN.accent : '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, border: `1px solid ${entry.is_distributed ? GREEN.border : '#fde68a'}` }}>
                              {entry.is_distributed ? 'Received' : 'Pending'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                            {entry.farm_area_ha && <span>Farm Area: {entry.farm_area_ha} ha</span>}
                            {entry.qty_bags && <span> · {entry.qty_bags} bags</span>}
                            {entry.date_received && <span> · Received {new Date(entry.date_received + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.625rem' }}>
                        <Package size={18} color="#d1d5db" />
                        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                          No distribution records found for this season.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Farmer profile details */}
                  {farmerProfile && (
                    <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 0.875rem', letterSpacing: '0.04em' }}>
                        Farmer Profile
                      </p>
                      <InfoRow label="Contact"    value={farmerProfile.contact_number} />
                      <InfoRow label="RSBSA"      value={farmerProfile.rsbsa_number} />
                      <InfoRow label="Gender"     value={farmerProfile.profile?.gender} />
                      <InfoRow label="Birthdate"  value={farmerProfile.profile?.date_of_birth
                        ? new Date(farmerProfile.profile.date_of_birth + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
                        : null
                      } />
                      <InfoRow label="Residency"  value={farmerProfile.profile?.residency_municipality && `${farmerProfile.profile.residency_barangay}, ${farmerProfile.profile.residency_municipality}`} />
                      <InfoRow label="Farm Loc."  value={farmerProfile.profile?.farm_municipality && `${farmerProfile.profile.farm_barangay}, ${farmerProfile.profile.farm_municipality}`} />
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                        {[
                          { flag: farmerProfile.profile?.ip,             label: 'IP'    },
                          { flag: farmerProfile.profile?.senior_citizen, label: 'Senior'},
                          { flag: farmerProfile.profile?.pwd,            label: 'PWD'   },
                          { flag: farmerProfile.profile?.arbs,           label: 'ARBs'  },
                          { flag: farmerProfile.profile?.four_ps,        label: '4Ps'   },
                        ].filter(f => f.flag).map(({ label }) => (
                          <span key={label} style={{ backgroundColor: GREEN.light, color: GREEN.accent, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${GREEN.border}` }}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: CROP HISTORY ── */}
              {detailTab === 'history' && (
                <div style={{ animation: 'fadeIn 0.2s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', margin: '0 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Season history
                      </p>
                      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                        {activeSeasonLabel}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>
                        Season
                      </label>
                      <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}
                        style={{ minWidth: 160, padding: '0.55rem 0.75rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#111827', fontSize: '0.85rem', outline: 'none' }}>
                        <option value="">Current season</option>
                        {seasonOptions.map(option => (
                          <option key={option.season} value={option.season}>
                            {option.season_display}
                          </option>
                        ))}
                      </select>
                      <label style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>
                        Year
                      </label>
                      <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                        style={{ minWidth: 110, padding: '0.55rem 0.75rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#111827', fontSize: '0.85rem', outline: 'none' }}>
                        <option value="">Any year</option>
                        {yearOptions.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {historyLoading ? (
                    <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
                      <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
                      <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>Loading season history...</p>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      
                      {/* Seed Source Tabs Selector (Hybrid, Inbred, Own Seed) */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem' }}>
                        {[
                          { key: 'HYBRID', label: 'Hybrid', color: '#1e40af', bg: '#eff6ff' },
                          { key: 'INBRED', label: 'Inbred', color: '#166534', bg: '#f0fdf4' },
                          { key: 'OWN_SEED', label: 'Own Seed', color: '#b45309', bg: '#fefce8' },
                        ].map(tab => {
                          const active = selectedSeedTab === tab.key;
                          return (
                            <button key={tab.key}
                              onClick={() => setSelectedSeedTab(tab.key)}
                              style={{
                                padding: '0.4rem 0.875rem',
                                borderRadius: '999px',
                                border: `1.5px solid ${active ? tab.color : '#e5e7eb'}`,
                                backgroundColor: active ? tab.bg : 'white',
                                color: active ? tab.color : '#4b5563',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}>
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      {(() => {
                        // Kumuha ng crop history records na sumasailalim lamang sa kasalukuyang piniling tab
                        const filteredRecords = (cropHistory?.records || []).filter(rec => rec.seed_source === selectedSeedTab);
                        
                        if (filteredRecords.length === 0) {
                          return (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>
                              <Leaf size={36} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
                              <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No records yet</p>
                              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                                No crop monitoring records found for this season.
                              </p>
                            </div>
                          );
                        }
                        
                        return (
                          <>
                            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 1.25rem', letterSpacing: '0.04em' }}>
                              {filteredRecords.length} Observation{filteredRecords.length !== 1 ? 's' : ''} {seasonFilter ? '' : 'This Season'}
                            </p>
                            {filteredRecords.map((rec, idx) => (
                              <TimelineStep
                                key={rec.id}
                                record={rec}
                                isLast={idx === filteredRecords.length - 1}
                              />
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  )}    
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ATFarmers;