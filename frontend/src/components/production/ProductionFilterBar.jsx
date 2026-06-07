import { ChevronDown, RefreshCw } from 'lucide-react';
import { SEED_CFG, SEED_KEYS } from './productionUtils';

const SELECT_STYLE = {
  padding: '0.5rem 2rem 0.5rem 0.875rem',
  border: '1.5px solid #e5e7eb', borderRadius: '0.625rem',
  fontSize: '0.82rem', color: '#111827', outline: 'none',
  backgroundColor: 'white', appearance: 'none', cursor: 'pointer',
  fontWeight: 500,
};

const SelectWrap = ({ children }) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    {children}
    <ChevronDown size={13} color='#9ca3af'
      style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
  </div>
);

const ProductionFilterBar = ({
  polls, selectedPollId, onPollChange,
  seedFilter, onSeedFilter,
  onRefresh, refreshing,
}) => {
  const seasons = [...new Set(polls.map(p => p.season))];
  const selectedPoll = polls.find(p => p.poll_id === selectedPollId) || polls[0];

  const yearsForSeason = [...new Set(
    polls.filter(p => p.season === selectedPoll?.season).map(p => p.year)
  )].sort((a, b) => b - a);

  const handleSeasonChange = (e) => {
    const season = e.target.value;
    const match  = polls.find(p => p.season === season);
    if (match) onPollChange(match.poll_id);
  };

  const handleYearChange = (e) => {
    const year  = Number(e.target.value);
    const match = polls.find(p => p.season === selectedPoll?.season && p.year === year);
    if (match) onPollChange(match.poll_id);
  };

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '1rem',
      padding: '0.875rem 1.25rem', border: '1px solid #e2e8f0',
      display: 'flex', gap: '0.75rem', alignItems: 'center',
      flexWrap: 'wrap', marginBottom: '1.25rem',
    }}>
      {/* Season */}
      <div>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Season</p>
        <SelectWrap>
          <select value={selectedPoll?.season || ''} onChange={handleSeasonChange} style={SELECT_STYLE}>
            {seasons.map(s => (
              <option key={s} value={s}>{s === 'WET' ? 'Wet Season' : 'Dry Season'}</option>
            ))}
          </select>
        </SelectWrap>
      </div>

      {/* Year */}
      <div>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year</p>
        <SelectWrap>
          <select value={selectedPoll?.year || ''} onChange={handleYearChange} style={SELECT_STYLE}>
            {yearsForSeason.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </SelectWrap>
      </div>

      {/* Seed type filter pills */}
      <div style={{ marginLeft: '0.5rem' }}>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seed type</p>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button onClick={() => onSeedFilter('')}
            style={{
              padding: '0.375rem 0.875rem', borderRadius: '999px', border: '1.5px solid',
              borderColor: !seedFilter ? '#1a4d1a' : '#e5e7eb',
              backgroundColor: !seedFilter ? '#f0fdf4' : 'white',
              color: !seedFilter ? '#1a4d1a' : '#6b7280',
              fontWeight: !seedFilter ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer',
            }}>All</button>
          {SEED_KEYS.map(k => {
            const cfg = SEED_CFG[k];
            const active = seedFilter === k;
            return (
              <button key={k} onClick={() => onSeedFilter(k)}
                style={{
                  padding: '0.375rem 0.875rem', borderRadius: '999px', border: '1.5px solid',
                  borderColor: active ? cfg.color : '#e5e7eb',
                  backgroundColor: active ? cfg.bg : 'white',
                  color: active ? cfg.color : '#6b7280',
                  fontWeight: active ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer',
                }}>
                {k === 'OWN_SEED' ? 'Own Seed' : k === 'HYBRID' ? 'Hybrid' : 'Inbred'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Refresh */}
      <button onClick={onRefresh} disabled={refreshing}
        style={{
          marginLeft: 'auto', padding: '0.5rem 0.875rem',
          backgroundColor: 'white', border: '1px solid #e2e8f0',
          borderRadius: '0.75rem', cursor: refreshing ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          fontSize: '0.78rem', fontWeight: 600, color: '#374151',
        }}>
        <RefreshCw size={13} style={{ animation: refreshing ? 'prod-spin 0.8s linear infinite' : 'none' }} />
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
};

export default ProductionFilterBar;