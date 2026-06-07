import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { SEED_CFG, SEED_KEYS, fmtNum } from '../productionUtils';

const YieldBySeedChart = ({ records }) => {
  const data = SEED_KEYS.map(key => {
    const group = records.filter(r => r.seed_source === key);
    const area  = group.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
    const mt    = group.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0);
    const yield_t_ha = area > 0 ? mt / area : 0;
    const target_t_ha = SEED_CFG[key].target_kg_ha / 1000;
    return {
      name: key === 'OWN_SEED' ? 'Own Seed' : key === 'HYBRID' ? 'Hybrid' : 'Inbred',
      yield: parseFloat(yield_t_ha.toFixed(2)),
      target: target_t_ha,
      color: SEED_CFG[key].color,
      bg: SEED_CFG[key].bg,
    };
  }).filter(d => d.yield > 0);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = d.target > 0 ? (d.yield / d.target) * 100 : null;
    return (
      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem 1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: '0.8rem' }}>
        <p style={{ margin: 0, fontWeight: 700, color: d.color }}>{d.name}</p>
        <p style={{ margin: '0.2rem 0 0', color: '#374151' }}>Actual: <strong>{fmtNum(d.yield)} t/ha</strong></p>
        <p style={{ margin: '0.15rem 0 0', color: '#94a3b8' }}>Target: {fmtNum(d.target)} t/ha</p>
        {pct !== null && <p style={{ margin: '0.15rem 0 0', color: d.color, fontWeight: 700 }}>{fmtNum(pct, 1)}% of target</p>}
      </div>
    );
  };

  if (data.length === 0) return (
    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No data yet</div>
  );

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }} barSize={52}>
          <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f1f5f9' />
          <XAxis dataKey='name' axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v} t/ha`} width={58} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey='yield' radius={[8, 8, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            <LabelList dataKey='yield' position='top' formatter={v => `${fmtNum(v)} t/ha`} style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default YieldBySeedChart;