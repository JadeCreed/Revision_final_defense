import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { SEED_CFG, fmtNum, getUtilTier, UtilBadge } from './productionUtils';

const HarvestPerformanceTable = ({ records, computeUtil, computeMetrics }) => {
  const [sortCol, setSortCol] = useState('util_pct');
  const [sortDir, setSortDir] = useState('desc');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 15;

  const rows = records.map(r => {
    const m    = computeMetrics(r);
    const util = computeUtil(r);
    return {
      id:           r.id,
      farmer_name:  r.farmer_name || `Farmer #${r.farmer}`,
      barangay:     r.barangay || '',
      seed_source:  r.seed_source,
      variety:      r.variety || '',
      area:         parseFloat(r.harvest_area_ha) || 0,
      expected_kg:  m.expected_kg,
      actual_kg:    m.harvest_kg,
      yield_t_ha:   m.yield_t_ha,
      util_pct:     util,
    };
  });

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.farmer_name.toLowerCase().includes(q) || r.barangay.toLowerCase().includes(q) || r.variety.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortCol] ?? -Infinity;
    const vb = b[sortCol] ?? -Infinity;
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setPage(1);
  };

  const Th = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)} style={{
      padding: '0.625rem 0.875rem', textAlign: right ? 'right' : 'left',
      fontSize: '0.63rem', fontWeight: 700, color: sortCol === col ? '#1a4d1a' : '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      borderBottom: '1px solid #e2e8f0', cursor: 'pointer',
      backgroundColor: '#f8fafc', whiteSpace: 'nowrap', userSelect: 'none',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        {label}
        {sortCol === col
          ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
          : <ChevronDown size={11} color='#d1d5db' />}
      </span>
    </th>
  );

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: '0.875rem' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder='Search farmer, barangay, or variety...'
          style={{ padding: '0.5rem 0.875rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.82rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <Th col='farmer_name'  label='Farmer' />
              <Th col='seed_source'  label='Seed Type' />
              <Th col='area'         label='Area (ha)'       right />
              <Th col='expected_kg'  label='Expected (kg)'   right />
              <Th col='actual_kg'    label='Actual (kg)'     right />
              <Th col='yield_t_ha'   label='Yield (t/ha)'    right />
              <Th col='util_pct'     label='Achievement'     right />
              <th style={{ padding: '0.625rem 0.875rem', fontSize: '0.63rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, idx) => {
              const cfg  = SEED_CFG[row.seed_source] || SEED_CFG.OWN_SEED;
              return (
                <tr key={row.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>{row.farmer_name}</p>
                    {row.barangay && <p style={{ margin: 0, fontSize: '0.67rem', color: '#94a3b8' }}>Brgy. {row.barangay}</p>}
                  </td>
                  <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700 }}>
                      {cfg.label.replace(' seeds', '')}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.area)}</td>
                  <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.expected_kg, 0)}</td>
                  <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.actual_kg, 0)}</td>
                  <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.yield_t_ha)}</td>
                  <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 800, color: getUtilTier(row.util_pct).color, borderBottom: '1px solid #f3f4f6' }}>
                    {row.util_pct !== null ? `${fmtNum(row.util_pct, 1)}%` : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                    <UtilBadge pct={row.util_pct} />
                  </td>
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  {search ? 'No records match your search.' : 'No harvest records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '0.375rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.78rem', color: '#374151', opacity: page === 1 ? 0.4 : 1 }}>
            Prev
          </button>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Page {page} of {totalPages} · {filtered.length} records</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: '0.375rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.78rem', color: '#374151', opacity: page === totalPages ? 0.4 : 1 }}>
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default HarvestPerformanceTable;