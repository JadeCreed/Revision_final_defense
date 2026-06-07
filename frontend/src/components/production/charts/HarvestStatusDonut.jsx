import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TIER_CFG, getUtilTier, fmtNum } from '../productionUtils';

const HarvestStatusDonut = ({ records, computeUtil }) => {
  const counts = {};
  TIER_CFG.forEach(t => { counts[t.key] = 0; });
  records.forEach(r => {
    const pct  = computeUtil(r);
    const tier = getUtilTier(pct);
    if (tier && tier.key !== 'N/A') counts[tier.key] = (counts[tier.key] || 0) + 1;
  });

  const data = TIER_CFG
    .map(t => ({ name: t.key, value: counts[t.key] || 0, color: t.color, bg: t.bg }))
    .filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ backgroundColor: 'white', border: `1px solid ${d.bg}`, borderRadius: '0.75rem', padding: '0.75rem 1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: '0.8rem' }}>
        <p style={{ margin: 0, fontWeight: 700, color: d.color }}>{d.name}</p>
        <p style={{ margin: '0.2rem 0 0', color: '#374151' }}>{d.value} farmer{d.value !== 1 ? 's' : ''}</p>
        <p style={{ margin: '0.1rem 0 0', color: '#94a3b8', fontSize: '0.72rem' }}>
          {total > 0 ? `${fmtNum((d.value / total) * 100, 1)}% of total` : ''}
        </p>
      </div>
    );
  };

  const renderCustomLabel = ({ cx, cy }) => (
    <>
      <text x={cx} y={cy - 8} textAnchor='middle' fill='#0f172a' fontSize={22} fontWeight={800}>{total}</text>
      <text x={cx} y={cy + 12} textAnchor='middle' fill='#94a3b8' fontSize={11} fontWeight={600}>FARMERS</text>
    </>
  );

  if (data.length === 0) return (
    <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
      No harvest data yet
    </div>
  );

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data} cx='50%' cy='50%'
            innerRadius={75} outerRadius={110}
            paddingAngle={3} dataKey='value'
            labelLine={false} label={renderCustomLabel}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} stroke={d.bg} strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType='circle' iconSize={9}
            formatter={(value) => <span style={{ fontSize: '0.72rem', color: '#374151', fontWeight: 600 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HarvestStatusDonut;