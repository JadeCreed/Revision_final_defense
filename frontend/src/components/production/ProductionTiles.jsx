import { Users, Layers, BarChart3, TrendingUp, Target } from 'lucide-react';
import { fmtNum, getUtilTier } from './productionUtils';

const Tile = ({ icon: Icon, label, value, sub, color, highlight, border }) => (
  <div style={{
    backgroundColor: highlight ? color + '0d' : 'white',
    borderRadius: '1rem', padding: '1rem 1.1rem',
    border: `1px solid ${highlight ? color + '40' : border || '#e2e8f0'}`,
    transition: 'all 0.2s',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.375rem' }}>
      <Icon size={14} color={color || '#94a3b8'} />
      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
    <p style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: color || '#0f172a', lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.67rem', color: '#64748b' }}>{sub}</p>}
  </div>
);

const ProductionTiles = ({ records, computeUtil }) => {
  const totalFarmers = new Set(records.map(r => r.farmer)).size;
  const totalArea    = records.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
  const totalMT      = records.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0);
  const avgYield     = totalArea > 0 ? totalMT / totalArea : 0;
  const allUtils     = records.map(r => computeUtil(r)).filter(v => v !== null);
  const avgUtil      = allUtils.length > 0 ? allUtils.reduce((a, b) => a + b, 0) / allUtils.length : null;
  const tier         = getUtilTier(avgUtil);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
      <Tile icon={Users}     label='Farmers Harvested'  value={totalFarmers}                                           sub='Farmers with harvest records'    color='#0f172a' />
      <Tile icon={Layers}    label='Harvested Area'      value={`${fmtNum(totalArea)} ha`}                              sub='Total harvested area'            color='#166534' />
      <Tile icon={BarChart3} label='Total Production'    value={`${fmtNum(totalMT)} MT`}                               sub='Combined harvest output'         color='#2563eb' />
      <Tile icon={TrendingUp} label='Average Yield'      value={`${fmtNum(avgYield)} t/ha`}                            sub='Average yield per hectare'       color='#7c3aed' />
      <Tile icon={Target}    label='Achievement Rate'    value={avgUtil !== null ? `${fmtNum(avgUtil, 1)}%` : '—'}      sub={tier.key}                        color={tier.color} highlight />
    </div>
  );
};

export default ProductionTiles;