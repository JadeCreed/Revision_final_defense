const PHASE_COLORS = {
  DISTRIBUTION:  '#64748b', ESTABLISHMENT: '#3b82f6',
  TILLERING:     '#22c55e', FLOWERING:     '#a855f7',
  RIPENING:      '#eab308', HARVESTING:    '#f97316',
};

const PhaseDistribution = ({ data }) => {
  const nonZero = (data || []).filter(d => d.farmers > 0);
  const max     = Math.max(...nonZero.map(d => d.farmers), 1);

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 16 }}>
        Crop phase distribution
      </div>
      {nonZero.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
          No phase data yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {nonZero.map(d => {
            const pct   = Math.round((d.farmers / max) * 100);
            const color = PHASE_COLORS[d.phase] || '#94a3b8';
            return (
              <div key={d.phase}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, color: '#0f172a' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                    {d.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {d.farmers} farmers
                  </span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.max(2, pct)}%`,
                    background: color, borderRadius: 999,
                    transition: 'width .6s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PhaseDistribution;