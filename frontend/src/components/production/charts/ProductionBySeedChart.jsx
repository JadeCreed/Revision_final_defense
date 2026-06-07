import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { SEED_CFG, SEED_KEYS, fmtNum } from '../productionUtils';

const ProductionBySeedChart = ({ records }) => {
  const data = SEED_KEYS.map(key => {
    const group = records.filter(r => r.seed_source === key);
    const mt    = group.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0);
    return { name: SEED_CFG[key].label.replace(' seeds', '').replace(' saved', ''), mt: parseFloat(mt.toFixed(2)), color: SEED_CFG[key].color, bg: SEED_CFG[key].bg };
  }).filter(d => d.mt > 0);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ backgroundColor: 'white', border: `1px solid #e2e8f0`, borderRadius: '0.75rem', padding: '0.75rem 1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: '0.8rem' }}>
        <p style={{ margin: 0, fontWeight: 700, color: d.color }}>{d.name}</p>
        <p style={{ margin: '0.2rem 0 0', color: '#374151' }}>{fmtNum(d.mt)} MT</p>
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
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v} MT`} width={52} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey='mt' radius={[8, 8, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            <LabelList dataKey='mt' position='top' formatter={v => `${fmtNum(v)} MT`} style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProductionBySeedChart;