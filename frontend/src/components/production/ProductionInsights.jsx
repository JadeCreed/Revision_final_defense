import { fmtNum, SEED_CFG, SEED_KEYS, getUtilTier, computeUtil as defaultComputeUtil } from './productionUtils';

const Dot = ({ color }) => (
  <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, display: 'inline-block', marginRight: '0.5rem', flexShrink: 0 }} />
);

const ProductionInsights = ({ records, computeUtil, computeMetrics, season, year }) => {
  if (!records.length) return null;

  const totalFarmers = new Set(records.map(r => r.farmer)).size;
  const totalMT      = records.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0);
  const allUtils     = records.map(r => computeUtil(r)).filter(v => v !== null);
  const avgUtil      = allUtils.length > 0 ? allUtils.reduce((a, b) => a + b, 0) / allUtils.length : null;

  // Best seed type by avg yield
  const seedStats = SEED_KEYS.map(k => {
    const group = records.filter(r => r.seed_source === k);
    const area  = group.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
    const mt    = group.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0);
    return { key: k, label: SEED_CFG[k].label, color: SEED_CFG[k].color, avg_yield: area > 0 ? mt / area : 0, count: group.length };
  }).filter(s => s.count > 0).sort((a, b) => b.avg_yield - a.avg_yield);

  const exceeded  = records.filter(r => { const u = computeUtil(r); return u !== null && u > 100; }).length;
  const critical  = records.filter(r => { const u = computeUtil(r); return u !== null && u < 50; }).length;
  const achieved  = records.filter(r => { const u = computeUtil(r); return u !== null && u >= 80; }).length;
  const achievePct = totalFarmers > 0 ? Math.round((achieved / totalFarmers) * 100) : 0;

  const insights = [
    seedStats[0] && {
      color: SEED_CFG[seedStats[0].key].color,
      text: `${seedStats[0].label} recorded the highest average yield at ${fmtNum(seedStats[0].avg_yield)} t/ha.`,
    },
    achievePct > 0 && {
      color: '#15803d',
      text: `${achievePct}% of farmers achieved or exceeded the expected yield.`,
    },
    exceeded > 0 && {
      color: '#166534',
      text: `${exceeded} farmer${exceeded !== 1 ? 's' : ''} exceeded the target yield — classified as Exceeded Target.`,
    },
    critical > 0 && {
      color: '#b91c1c',
      text: `${critical} farmer${critical !== 1 ? 's' : ''} were classified as Critical (below 50% of target). AT field visit recommended.`,
    },
    totalMT > 0 && {
      color: '#2563eb',
      text: `Total production reached ${fmtNum(totalMT)} MT${season && year ? ` for ${season === 'DRY' ? 'Dry' : 'Wet'} Season ${year}` : ''}.`,
    },
    avgUtil !== null && {
      color: getUtilTier(avgUtil).color,
      text: `Overall achievement rate is ${fmtNum(avgUtil, 1)}% — rated as ${getUtilTier(avgUtil).key}.`,
    },
  ].filter(Boolean);

  return (
    <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
      <p style={{ margin: '0 0 0.875rem', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Auto-generated insights
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.25rem', fontSize: '0.82rem', color: '#374151', lineHeight: 1.55 }}>
            <Dot color={ins.color} />
            <span>{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductionInsights;