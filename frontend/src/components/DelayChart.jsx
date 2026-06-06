const SEED_CFG = {
  HYBRID:   { label: 'Hybrid Seed',  color: '#166534' },
  INBRED:   { label: 'Inbred Seed',  color: '#1e40af' },
  OWN_SEED: { label: 'Own Seed',     color: '#92400e' },
};

const DelayChart = ({ data }) => {
  if (!data) return null;
  const entries = Object.values(data);
  const hasData = entries.some(e => e.total > 0);

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 16 }}>
        Delay analytics
      </div>
      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
          No delay data yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {entries.map(e => {
            const cfg        = Object.values(SEED_CFG).find(s => s.label === e.label) || { color: '#64748b' };
            const onTimePct  = e.total > 0 ? (e.on_time  / e.total) * 100 : 0;
            const delayedPct = e.total > 0 ? (e.delayed  / e.total) * 100 : 0;
            return (
              <div key={e.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{e.label}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{e.total} farmers</span>
                </div>
                <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: '#f1f5f9' }}>
                  {onTimePct > 0 && (
                    <div title={`On time: ${e.on_time}`}
                      style={{ width: `${onTimePct}%`, background: cfg.color, opacity: .8 }} />
                  )}
                  {delayedPct > 0 && (
                    <div title={`Delayed: ${e.delayed}`}
                      style={{ width: `${delayedPct}%`, background: '#ef4444' }} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 5 }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>On-time: {e.on_time}</span>
                  {e.delayed > 0 && (
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>
                      Delayed: {e.delayed} ({e.rate}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DelayChart;