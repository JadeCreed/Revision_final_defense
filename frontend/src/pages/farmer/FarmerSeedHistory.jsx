// src/pages/farmer/FarmerSeedHistory.jsx
// Read-only view ng sariling seed distribution history ng farmer.
// Base sa FarmerPoll.jsx pattern: useAuth para sa role/colors, useCallback
// fetch, loading skeleton, empty state, error card, card-based layout.

import { useState, useEffect, useCallback } from 'react';
import { useAuth }       from '../../auth/AuthContext';
import { ROLE_COLORS }   from '../../components/navigation/UserNavConfig';
import { getMyFarmerSeedHistory, getHistoryFilterOptions } from '../../api/axios';
import {
  History, Package, CalendarCheck, Wheat, SlidersHorizontal,
} from 'lucide-react';

const filterStyle = {
  padding: '0.5rem 0.75rem',
  border: '1.5px solid #d1d5db',
  borderRadius: '0.625rem',
  fontSize: '0.8rem',
  outline: 'none',
  backgroundColor: 'white',
  width: '100%',
};

const EMPTY_FILTERS = () => ({ seed_type: '', variety: '', year: '', season: '' });

const RECORDS_PAGE_SIZE = 5;

// I-flatten ang year → seasons → records papunta sa isang flat list, para
// magawang i-slice ng "See More" nang hindi nawawala ang pagkakasunod-sunod
// (Year pinakabago muna, Season WET bago DRY, records na naka-order na
// mula sa backend). Bawat item ay may kasamang year/season/season_label
// para magamit ulit sa pag-regroup para sa display.
const flattenHistory = (historyByYear) => {
  const flat = [];
  historyByYear.forEach(({ year, seasons }) => {
    seasons.forEach(({ season, season_label, records }) => {
      records.forEach(record => {
        flat.push({ year, season, season_label, record });
      });
    });
  });
  return flat;
};

// Ginagrupo ulit ang isang naka-slice na flat list papunta sa year → season
// → records shape, para magamit sa parehong rendering logic (headers lang
// ang lumalabas kapag nagbago ang year/season, hindi paulit-ulit).
const regroupForDisplay = (flatSlice) => {
  const grouped = [];
  flatSlice.forEach(({ year, season, season_label, record }) => {
    let yearGroup = grouped.find(g => g.year === year);
    if (!yearGroup) {
      yearGroup = { year, seasons: [] };
      grouped.push(yearGroup);
    }
    let seasonGroup = yearGroup.seasons.find(s => s.season === season);
    if (!seasonGroup) {
      seasonGroup = { season, season_label, records: [] };
      yearGroup.seasons.push(seasonGroup);
    }
    seasonGroup.records.push(record);
  });
  return grouped;
};


// ── Color scheme cycling for seed type summary chips (parehong TYPE_COLORS pattern ng FarmerPoll) ──
const TYPE_COLORS = [
  { header: '#dbeafe', headerText: '#1e40af', selected: '#eff6ff', border: '#1e40af' },
  { header: '#dcfce7', headerText: '#166534', selected: '#f0fdf4', border: '#166534' },
  { header: '#f3e8ff', headerText: '#7c3aed', selected: '#faf5ff', border: '#7c3aed' },
  { header: '#fef9c3', headerText: '#854d0e', selected: '#fefce8', border: '#854d0e' },
  { header: '#fee2e2', headerText: '#991b1b', selected: '#fff5f5', border: '#991b1b' },
];

const formatDate = (isoDate) => {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};

const FarmerSeedHistory = () => {
  const { role } = useAuth();
  const colors   = ROLE_COLORS[role] || ROLE_COLORS.FARMER;

    const [summary, setSummary]           = useState(null);
  const [historyByYear, setHistoryByYear] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // ── FILTER STATE ──
  const [filters, setFilters]             = useState(EMPTY_FILTERS());
  const [filterOptions, setFilterOptions] = useState({ seed_types: [], varieties: [], years: [], seasons: [] });
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);

  const activeFilterParams = useCallback((f) => {
    const params = {};
    if (f.seed_type) params.seed_type = f.seed_type;
    if (f.variety)   params.variety   = f.variety;
    if (f.year)      params.year      = f.year;
    if (f.season)    params.season    = f.season;
    return params;
  }, []);

  // Sariling filter options lang — awtomatikong naka-scope sa farmer=request.user
  // sa backend (HistoryFilterOptionsView), kaya iisang tawag lang, walang kailangang
  // farmer_id o barangay param dito.
  useEffect(() => {
    (async () => {
      setFilterOptionsLoading(true);
      try {
        const res = await getHistoryFilterOptions();
        setFilterOptions(res.data);
      } catch {
        // Filter options are non-critical — silently keep previous options
      } finally {
        setFilterOptionsLoading(false);
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMyFarmerSeedHistory(activeFilterParams(filters));
      setSummary(res.data?.summary || null);
      setHistoryByYear(res.data?.history_by_year || []);
      setError('');
    } catch {
      setError('Failed to load your seed distribution history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, activeFilterParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleVarietyOptions = filters.seed_type
    ? filterOptions.varieties.filter(v => String(v.seed_type_id) === String(filters.seed_type))
    : filterOptions.varieties;

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // ── "SEE MORE" — bounded scrollable container ──
  const [visibleCount, setVisibleCount] = useState(RECORDS_PAGE_SIZE);
  // I-reset ang visible count tuwing magbago ang filters/data, para
  // hindi manatili ang dating "See More" state sa bagong resulta.
  useEffect(() => { setVisibleCount(RECORDS_PAGE_SIZE); }, [historyByYear]);

  const flatRecords = historyByYear.length > 0 ? flattenHistory(historyByYear) : [];
  const visibleFlatRecords = flatRecords.slice(0, visibleCount);
  const visibleHistoryByYear = regroupForDisplay(visibleFlatRecords);
  const hasMore = visibleCount < flatRecords.length;
  // ── LOADING ──
  if (loading) {
    return (
      <div style={{ padding: '1.25rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height:          i === 1 ? '120px' : '80px',
            backgroundColor: '#f3f4f6',
            borderRadius:    '1rem',
            marginBottom:    '1rem',
            animation:       'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    );
  }

  const bagsBySeedType = summary?.bags_by_seed_type || {};
  const seedTypeEntries = Object.entries(bagsBySeedType);
  const hasHistory = historyByYear.length > 0;

  return (
    <div style={{ padding: '1.25rem 1.25rem 2rem 1.25rem' }}>

      {/* ── HEADER CARD ── */}
      <div style={{
        backgroundColor: colors.primary,
        borderRadius:    '1rem',
        padding:         '1.25rem',
        marginBottom:    '1.25rem',
        color:           'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
          <History size={20} color="white" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.85 }}>
            Seed Distribution History
          </span>
        </div>
        <h1 style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.375rem', lineHeight: 1.3 }}>
          Your Seed Records
        </h1>
        <p style={{ fontSize: '0.75rem', opacity: 0.75, margin: 0 }}>
          A complete, all-time record of the seeds you've received.
        </p>
      </div>

      {/* ── FILTER ROW ── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem', padding: '1rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <SlidersHorizontal size={15} color="#6b7280" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Filter Records</span>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS())}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline' }}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          <select
            value={filters.seed_type}
            onChange={e => setFilters(p => ({ ...p, seed_type: e.target.value, variety: '' }))}
            style={filterStyle}
            disabled={filterOptionsLoading}
          >
            <option value="">All Seed Types</option>
            {filterOptions.seed_types.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
          <select
            value={filters.variety}
            onChange={e => setFilters(p => ({ ...p, variety: e.target.value }))}
            style={filterStyle}
            disabled={filterOptionsLoading}
          >
            <option value="">All Varieties</option>
            {visibleVarietyOptions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select
            value={filters.year}
            onChange={e => setFilters(p => ({ ...p, year: e.target.value }))}
            style={filterStyle}
            disabled={filterOptionsLoading}
          >
            <option value="">All Years</option>
            {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={filters.season}
            onChange={e => setFilters(p => ({ ...p, season: e.target.value }))}
            style={filterStyle}
            disabled={filterOptionsLoading}
          >
            <option value="">All Seasons</option>
            {filterOptions.seasons.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.875rem 1.25rem', borderRadius: '0.875rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* ── SUMMARY CARDS ── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <History size={16} color={colors.primary} />
              <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Times Received</span>
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
              {summary.total_times_received}
            </p>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Package size={16} color={colors.primary} />
              <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Total Bags</span>
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
              {summary.total_bags}
            </p>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <CalendarCheck size={16} color={colors.primary} />
              <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Last Received</span>
            </div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              {formatDate(summary.last_received)}
            </p>
          </div>
        </div>
      )}

      {/* ── BAGS BY SEED TYPE ── */}
      {seedTypeEntries.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.25rem', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', backgroundColor: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
            <h3 style={{ fontWeight: 700, color: '#374151', margin: 0, fontSize: '0.9rem' }}>Bags by Seed Type</h3>
          </div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {seedTypeEntries.map(([seedTypeName, bags], idx) => {
              const tc = TYPE_COLORS[idx % TYPE_COLORS.length];
              return (
                <div key={seedTypeName} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.75rem 1rem', borderRadius: '0.75rem', backgroundColor: tc.header,
                }}>
                  <span style={{ fontWeight: 700, color: tc.headerText, fontSize: '0.875rem' }}>{seedTypeName}</span>
                  <span style={{ fontWeight: 800, color: tc.headerText, fontSize: '0.95rem' }}>{bags} bags</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {!hasHistory && (
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem 1.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <Wheat size={48} color="#d1d5db" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <h2 style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No Records Yet</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
            You haven't received any seed distributions yet. Once you do, they'll show up here.
          </p>
        </div>
      )}

            {/* ── HISTORY BY YEAR → SEASON ── */}
            {/* ── HISTORY BY YEAR → SEASON (bounded scrollable container) ── */}
      {hasHistory && (
        <div style={{
          maxHeight: '620px', overflowY: 'auto', paddingRight: '0.25rem',
          marginBottom: hasMore ? '0.75rem' : '0',
        }}>
          {visibleHistoryByYear.map(({ year, seasons }) => (

        <div key={year} style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1a1a1a', margin: '0 0 0.75rem' }}>
            {year}
          </h2>

          {seasons.map(({ season, season_label, records }) => (
            <div key={season} style={{ marginBottom: '1rem' }}>
              <p style={{ fontWeight: 700, fontSize: '0.72rem', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.625rem' }}>
                {season_label}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {records.map(record => (
                  <div key={record.entry_id} style={{
                    backgroundColor: 'white',
                    borderRadius:    '1rem',
                    boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
                    overflow:        'hidden',
                  }}>
                    <div style={{ padding: '0.875rem 1.25rem', backgroundColor: '#f9fafb', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Wheat size={16} color="#374151" />
                        <span style={{ fontWeight: 700, color: '#374151', fontSize: '0.875rem' }}>{record.seed_type}</span>
                      </div>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, color: '#166534',
                        backgroundColor: '#dcfce7', padding: '0.2rem 0.625rem', borderRadius: '999px',
                      }}>
                        {season_label} {record.year}
                      </span>
                    </div>

                    <div style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <p style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.2rem' }}>Variety</p>
                          <p style={{ fontSize: '0.875rem', color: '#1a1a1a', fontWeight: 600, margin: 0 }}>{record.variety || '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.2rem' }}>Bags Received</p>
                          <p style={{ fontSize: '0.875rem', color: '#1a1a1a', fontWeight: 600, margin: 0 }}>{record.bags}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.2rem' }}>Date Received</p>
                          <p style={{ fontSize: '0.875rem', color: '#1a1a1a', fontWeight: 600, margin: 0 }}>{formatDate(record.date_received)}</p>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.625rem', marginTop: '0.75rem' }}>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.15rem' }}>{record.event_name}</p>
                        {record.encoded_by_name && (
                          <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: 0 }}>
                            Recorded by {record.encoded_by_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* ── SEE MORE — nagdadagdag lang ng laman sa loob ng bounded container sa itaas ── */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount(prev => prev + RECORDS_PAGE_SIZE)}
          style={{
            width: '100%', padding: '0.75rem', backgroundColor: 'white', color: colors.primary,
            border: `1.5px solid ${colors.primary}`, borderRadius: '0.875rem', fontWeight: 700,
            fontSize: '0.875rem', cursor: 'pointer', marginBottom: '1rem',
          }}
        >
          See More ({flatRecords.length - visibleCount} more)
        </button>
      )}

    </div>
  );
};

export default FarmerSeedHistory;