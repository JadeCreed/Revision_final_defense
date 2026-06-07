import { SEED_CFG, fmtNum, UtilBadge } from './productionUtils';

const YieldGapTable = ({ records, computeMetrics, computeUtil }) => {
  const rows = records
    .filter(r => r.seed_source !== 'OWN_SEED')
    .map(r => {
      const m = computeMetrics(r);
      return {
        id:               r.id,
        farmer_name:      r.farmer_name || `Farmer #${r.farmer}`,
        seed_source:      r.seed_source,
        seed_dist_kg:     m.seed_dist_kg,
        prod_seed_equiv:  m.prod_seed_equiv,
        yield_gap_equiv:  m.yield_gap_equiv,
        util_pct:         computeUtil(r),
      };
    })
    .sort((a, b) => b.yield_gap_equiv - a.yield_gap_equiv);

  if (rows.length === 0) return (
    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
      No seed productivity data available.
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc' }}>
            {['Farmer', 'Seed Type', 'Seed Distributed', 'Productive Equivalent', 'Yield Gap Equivalent', 'Achievement'].map(h => (
              <th key={h} style={{ padding: '0.625rem 0.875rem', fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', textAlign: h === 'Farmer' || h === 'Seed Type' ? 'left' : 'right', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const cfg = SEED_CFG[row.seed_source] || SEED_CFG.OWN_SEED;
            return (
              <tr key={row.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '0.7rem 0.875rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f3f4f6' }}>{row.farmer_name}</td>
                <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700 }}>
                    {cfg.label.replace(' seeds', '')}
                  </span>
                </td>
                <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.seed_dist_kg, 1)} kg</td>
                <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#15803d', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.prod_seed_equiv, 1)} kg</td>
                <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 700, color: row.yield_gap_equiv > 0 ? '#b45309' : '#15803d', borderBottom: '1px solid #f3f4f6' }}>
                  {fmtNum(row.yield_gap_equiv, 1)} kg
                </td>
                <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                  <UtilBadge pct={row.util_pct} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default YieldGapTable;