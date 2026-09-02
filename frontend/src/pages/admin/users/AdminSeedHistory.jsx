// src/pages/admin/users/AdminSeedHistory.jsx
// Read-only: listahan ng farmers na may kumpletong (Rule B) seed history,
// (Summary -> Full History) gamit ang FarmerSeedHistoryView.
//
// Base sa FarmerMasterlist.jsx UI shell (filter bar, table, Pagination) —
// HINDI kinopya: updateFarmerProfile, deactivateUser, getFarmerFullProfile,
// newIds/knownIds/timeouts polling. Purong read-only report ito.
//
// Double-modal pattern (parehong prinsipyo ng succession feature):
//   summaryModal && !fullHistoryOpen  → Step 1 (summary)
//   fullHistoryOpen                    → Step 2 (full history)
//   "Back" → isara lang ang Step 2 (bumalik sa Step 1)
//   "X"    → isara LAHAT (bumalik sa listahan)

import { useState, useEffect, useCallback } from 'react';
import {
  getAdminSeedHistory, getFarmerSeedHistory, getHistoryFilterOptions,
} from '../../../api/axios';
import {
  Pagination,
} from '../../../components/tables/TableBase';
import {
  History, Package, CalendarCheck, Wheat, SlidersHorizontal,
} from 'lucide-react';

const BARANGAYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan'
];

const filterStyle = {
  padding: '0.5rem 0.875rem',
  border: '1.5px solid #d1d5db',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  outline: 'none',
  backgroundColor: 'white',
};

const formatDate = (isoDate) => {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};

const TYPE_COLORS = [
  { header: '#dbeafe', headerText: '#1e40af' },
  { header: '#dcfce7', headerText: '#166534' },
  { header: '#f3e8ff', headerText: '#7c3aed' },
  { header: '#fef9c3', headerText: '#854d0e' },
  { header: '#fee2e2', headerText: '#991b1b' },
];

const EMPTY_FILTERS = () => ({
  barangay: '', seed_type: '', variety: '', year: '', season: '',
});

const AdminSeedHistory = () => {
  // ── LIST STATE ──
  const [farmers, setFarmers] = useState([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');

  // ── FILTER STATE ──
  const [filters, setFilters]           = useState(EMPTY_FILTERS());
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS()); // edited inside drawer, applied on "Apply"
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    seed_types: [], varieties: [], years: [], seasons: [],
  });
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);

  // ── TWO-STEP MODAL STATE ──
  const [summaryModal, setSummaryModal]   = useState(null);  // farmer row that was clicked
  const [historyData, setHistoryData]     = useState(null);  // full response from getFarmerSeedHistory
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError]   = useState('');
  const [fullHistoryOpen, setFullHistoryOpen] = useState(false); // Step 2 toggle

  // ── Build active (non-empty) filter params, shared by list + filter-options calls ──
  const activeFilterParams = useCallback((f) => {
    const params = {};
    if (f.barangay)     params.barangay     = f.barangay;
    if (f.seed_type)    params.seed_type    = f.seed_type;
    if (f.variety)      params.variety      = f.variety;
    if (f.year)         params.year         = f.year;
    if (f.season)        params.season       = f.season;
    return params;
  }, []);

  // ── FETCH FILTER OPTIONS (Barangay-scoped: refetch when barangay filter changes) ──
  const fetchFilterOptions = useCallback(async () => {
    setFilterOptionsLoading(true);
    try {
      const params = filters.barangay ? { barangay: filters.barangay } : {};
      const res = await getHistoryFilterOptions(params);
      setFilterOptions(res.data);
    } catch {
      // Filter options are non-critical — silently keep previous options
    } finally {
      setFilterOptionsLoading(false);
    }
  }, [filters.barangay]);

  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);

  // ── FETCH FARMER LIST ──
  const fetchFarmers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, ...activeFilterParams(filters) };
      if (search) params.search = search;

      const res   = await getAdminSeedHistory(params);
      const items = res.data.results || res.data;
      const total = res.data.count   || 0;

      setFarmers(items);
      setCount(total);
    } catch {
      setError('Failed to load seed history.');
    } finally {
      setLoading(false);
    }
  }, [page, search, filters, activeFilterParams]);

  useEffect(() => { fetchFarmers(); }, [fetchFarmers]);
  useEffect(() => { setPage(1); }, [search, filters]);

  // ── FILTER DRAWER ──
  const openFilterDrawer = () => {
    setDraftFilters(filters);
    setFilterDrawerOpen(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setFilterDrawerOpen(false);
  };

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS());
    setDraftFilters(EMPTY_FILTERS());
    setFilterDrawerOpen(false);
  };

  const removeChip = (key) => {
    setFilters(prev => ({ ...prev, [key]: '' }));
  };

  const activeChipCount = Object.values(filters).filter(Boolean).length;

  // Varieties shown in the drawer — filtered by draftFilters.seed_type if chosen
  const visibleVarietyOptions = draftFilters.seed_type
    ? filterOptions.varieties.filter(v => String(v.seed_type_id) === String(draftFilters.seed_type))
    : filterOptions.varieties;

  // ── HISTORY MODAL ──
  const openHistory = async (farmer) => {
    setSummaryModal(farmer);
    setFullHistoryOpen(false);
    setHistoryData(null);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const res = await getFarmerSeedHistory(farmer.farmer_id, activeFilterParams(filters));
      setHistoryData(res.data);
    } catch {
      setHistoryError('Failed to load this farmer\'s history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeAllModals = () => {
    setSummaryModal(null);
    setHistoryData(null);
    setHistoryError('');
    setFullHistoryOpen(false);
  };

  const chipLabel = (key, value) => {
    if (key === 'barangay') return `Barangay: ${value}`;
    if (key === 'seed_type') {
      const st = filterOptions.seed_types.find(s => String(s.id) === String(value));
      return `Seed Type: ${st ? st.name : value}`;
    }
    if (key === 'variety') {
      const v = filterOptions.varieties.find(v => String(v.id) === String(value));
      return `Variety: ${v ? v.name : value}`;
    }
    if (key === 'year') return `Year: ${value}`;
    if (key === 'season') {
      const s = filterOptions.seasons.find(s => s.value === value);
      return `Season: ${s ? s.label : value}`;
    }
    return `${key}: ${value}`;
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>Seed History</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          All-time seed distribution records per farmer.
        </p>
      </div>

      {/* Search + Filters button */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
        <input placeholder="Search name, RSBSA..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ ...filterStyle, flex: 1, minWidth: '200px' }} />
        <button
          onClick={openFilterDrawer}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', backgroundColor: activeChipCount > 0 ? '#2d6a2d' : 'white',
            color: activeChipCount > 0 ? 'white' : '#374151',
            border: `1.5px solid ${activeChipCount > 0 ? '#2d6a2d' : '#d1d5db'}`,
            borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <SlidersHorizontal size={15} />
          Filters {activeChipCount > 0 && `(${activeChipCount})`}
        </button>
      </div>

      {/* Active filter chips */}
      {activeChipCount > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {Object.entries(filters).filter(([, v]) => v).map(([key, value]) => (
            <span key={key} style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
              padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
            }}>
              {chipLabel(key, value)}
              <button onClick={() => removeChip(key)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#166534',
                fontWeight: 800, fontSize: '0.85rem', lineHeight: 1, padding: 0,
              }}>×</button>
            </span>
          ))}
          <button onClick={clearAllFilters} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280',
            fontSize: '0.78rem', fontWeight: 600, textDecoration: 'underline',
          }}>
            Clear all
          </button>
        </div>
      )}

      {error && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['RSBSA', 'Name', 'Barangay', 'Times Received', 'Total Bags', 'Last Received', 'History'].map(col => (
                  <th key={col} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</td></tr>
              ) : farmers.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                  {activeChipCount > 0 || search
                    ? 'No records match your search/filters.'
                    : 'No seed distribution records found.'}
                </td></tr>
              ) : farmers.map((f, idx) => (
                <tr key={f.farmer_id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280', fontFamily: 'monospace' }}>{f.rsbsa_number || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: '500' }}>{f.first_name} {f.last_name}</td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>{f.barangay || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>{f.total_times_received}</td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>{f.total_bags}</td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(f.last_received)}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <button onClick={() => openHistory(f)}
                      style={{ padding: '0.375rem 0.75rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      View History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
                <Pagination count={count} page={page} pageSize={10} onPageChange={setPage} />
      </div>

      {/* ══════════════════════════════════════
          FILTER DRAWER
      ══════════════════════════════════════ */}
      {filterDrawerOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.75rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontWeight: '700', margin: 0, fontSize: '1.05rem' }}>Filter Distribution History</h2>
              <button onClick={() => setFilterDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem', display: 'block' }}>Barangay</label>
                <select value={draftFilters.barangay} onChange={e => setDraftFilters(p => ({ ...p, barangay: e.target.value }))} style={{ ...filterStyle, width: '100%' }}>
                  <option value="">All Barangays</option>
                  {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem', display: 'block' }}>Seed Type</label>
                <select
                  value={draftFilters.seed_type}
                  onChange={e => setDraftFilters(p => ({ ...p, seed_type: e.target.value, variety: '' }))}
                  style={{ ...filterStyle, width: '100%' }}
                  disabled={filterOptionsLoading}
                >
                  <option value="">All Seed Types</option>
                  {filterOptions.seed_types.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem', display: 'block' }}>Variety</label>
                <select
                  value={draftFilters.variety}
                  onChange={e => setDraftFilters(p => ({ ...p, variety: e.target.value }))}
                  style={{ ...filterStyle, width: '100%' }}
                  disabled={filterOptionsLoading}
                >
                  <option value="">All Varieties</option>
                  {visibleVarietyOptions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem', display: 'block' }}>Year</label>
                  <select value={draftFilters.year} onChange={e => setDraftFilters(p => ({ ...p, year: e.target.value }))} style={{ ...filterStyle, width: '100%' }} disabled={filterOptionsLoading}>
                    <option value="">All Years</option>
                    {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem', display: 'block' }}>Season</label>
                  <select value={draftFilters.season} onChange={e => setDraftFilters(p => ({ ...p, season: e.target.value }))} style={{ ...filterStyle, width: '100%' }} disabled={filterOptionsLoading}>
                    <option value="">All Seasons</option>
                    {filterOptions.seasons.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #f3f4f6' }}>
              <button onClick={clearAllFilters} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>Clear</button>
              <button onClick={applyFilters} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}>Apply Filters</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          STEP 1 — SUMMARY MODAL
          (hidden while Step 2 is open — double-modal pattern)
      ══════════════════════════════════════ */}
      {summaryModal && !fullHistoryOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 110, padding: '1rem', overflowY: 'auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '520px', width: '100%', margin: '2rem auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontWeight: '700', margin: 0 }}>
                  {summaryModal.first_name} {summaryModal.last_name}
                </h2>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {summaryModal.barangay || '—'} · {summaryModal.rsbsa_number || 'No RSBSA'}
                </p>
              </div>
              <button onClick={closeAllModals} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {historyLoading && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading history...</div>
            )}

            {historyError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{historyError}</div>
            )}

            {historyData && !historyLoading && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <History size={14} color="#2d6a2d" />
                      <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Received</span>
                    </div>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>{historyData.summary.total_times_received}</p>
                  </div>
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <Package size={14} color="#2d6a2d" />
                      <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Bags</span>
                    </div>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>{historyData.summary.total_bags}</p>
                  </div>
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <CalendarCheck size={14} color="#2d6a2d" />
                      <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Latest</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{formatDate(historyData.summary.last_received)}</p>
                  </div>
                </div>

                {Object.keys(historyData.summary.bags_by_seed_type || {}).length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#374151', marginBottom: '0.5rem' }}>Seed Types</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {Object.entries(historyData.summary.bags_by_seed_type).map(([name, bags], idx) => {
                        const tc = TYPE_COLORS[idx % TYPE_COLORS.length];
                        return (
                          <span key={name} style={{ backgroundColor: tc.header, color: tc.headerText, padding: '0.375rem 0.75rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700 }}>
                            {name}: {bags} bags
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {historyData.history_by_year.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af' }}>
                    <Wheat size={28} color="#d1d5db" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                    No complete distribution records match the current filters.
                  </div>
                ) : (
                  <button
                    onClick={() => setFullHistoryOpen(true)}
                    style={{
                      width: '100%', padding: '0.75rem', backgroundColor: '#2d6a2d', color: 'white',
                      border: 'none', borderRadius: '0.625rem', fontWeight: 700, fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    View Full History →
                  </button>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f3f4f6', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <button onClick={closeAllModals} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          STEP 2 — FULL HISTORY MODAL
      ══════════════════════════════════════ */}
    {fullHistoryOpen && historyData && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem' }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '1rem', width: '100%', maxWidth: '680px',
            maxHeight: '85vh', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '2rem 2rem 1.25rem', borderBottom: '1px solid #f3f4f6', flexShrink: 0,
            }}>
              <div>
                <button
                  type="button"
                  onClick={() => setFullHistoryOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a2d', fontSize: '0.8rem', fontWeight: 600, padding: 0, marginBottom: '0.5rem' }}
                >
                  ← Back to Summary
                </button>
                <h2 style={{ fontWeight: '700', margin: 0 }}>
                  {summaryModal.first_name} {summaryModal.last_name} — Full History
                </h2>
              </div>
              <button onClick={closeAllModals} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '1.25rem 2rem', overflowY: 'auto', flex: 1 }}>
            {historyData.history_by_year.map(({ year, seasons }) => (
              <div key={year} style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1a1a1a', marginBottom: '0.75rem' }}>{year}</p>
                {seasons.map(({ season, season_label, records }) => (
                  <div key={season} style={{ marginBottom: '1rem' }}>
                    <p style={{ fontWeight: '700', fontSize: '0.72rem', color: '#2d6a2d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>{season_label}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {records.map(record => (
                        <div key={record.entry_id} style={{ border: '1px solid #f3f4f6', borderRadius: '0.75rem', padding: '0.875rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a1a' }}>{record.seed_type} — {record.variety}</span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#166534', backgroundColor: '#dcfce7', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                              {season === 'WET' ? 'Wet' : 'Dry'} {record.year}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.78rem', color: '#6b7280' }}>
                            <span>Bags: <strong style={{ color: '#374151' }}>{record.bags}</strong></span>
                            <span>Date: <strong style={{ color: '#374151' }}>{formatDate(record.date_received)}</strong></span>
                            <span style={{ gridColumn: '1 / -1' }}>{record.event_name}</span>
                            {record.encoded_by_name && (
                              <span style={{ gridColumn: '1 / -1' }}>Recorded by {record.encoded_by_name}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                </div>
            ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f3f4f6', padding: '1.25rem 2rem', flexShrink: 0 }}>
              <button onClick={closeAllModals} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSeedHistory;