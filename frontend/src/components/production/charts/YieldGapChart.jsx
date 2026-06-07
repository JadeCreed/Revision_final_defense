import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SEED_CFG, SEED_KEYS, fmtNum } from '../productionUtils';

const YieldGapChart = ({ records, computeMetrics }) => {
  const data = SEED_KEYS.map(key => {
    const group = records.filter(r => r.seed_source === key);
    if (!group.length) return null;
    const totals = group.reduce((s, r) => {
      const m = computeMetrics(r);
      return {
        prod_seed_equiv: s.prod_seed_equiv + m.prod_seed_equiv,
        yield_gap_equiv: s.yield_gap_equiv + m.yield_gap_equiv,
      };
    }, { prod_seed_equiv: 0, yield_gap_equiv: 0 });
    return {
      name: key === 'OWN_SEED' ? 'Own Seed' : key === 'HYBRID' ? 'Hybrid' : 'Inbred',
      'Productive Equivalent': parseFloat(totals.prod_seed_equiv.toFixed(1)),
      'Yield Gap': parseFloat(totals.yield_gap_equiv.toFixed(1)),
      color: SEED_CFG[key].color,
    };
  }).filter(Boolean).filter(d => d['Productive Equivalent'] > 0 || d['Yield Gap'] > 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem 1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: '0.8rem' }}>
        <p style={{ margin: '0 0 0.4rem', fontWeight: 700, color: '#0f172a' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ margin: '0.15rem 0', color: p.fill }}>{p.name}: <strong>{fmtNum(p.value)} kg</strong></p>
        ))}
      </div>
    );
  };

  if (data.length === 0) return (
    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No data yet</div>
  );

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barSize={28}>
          <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f1f5f9' />
          <XAxis dataKey='name' axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v} kg`} width={58} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Legend iconType='circle' iconSize={8} formatter={v => <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151' }}>{v}</span>} />
          <Bar dataKey='Productive Equivalent' fill='#15803d' radius={[6, 6, 0, 0]} />
          <Bar dataKey='Yield Gap'             fill='#fbbf24' radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default YieldGapChart;