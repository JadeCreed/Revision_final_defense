const DAMAGE_COLORS = ['#ef4444','#f97316','#eab308','#a855f7','#06b6d4','#64748b'];

const DamageChart = ({ data }) => {
  const max = Math.max(...(data || []).map(d => d.count), 1);

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 16 }}>
        Damage analytics
      </div>
      {!data?.length ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
          No damage reported
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.map((d, i) => (
            <div key={d.cause}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{d.cause}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                  {d.count}
                  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 4 }}>({d.pct}%)</span>
                </span>
              </div>
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${(d.count / max) * 100}%`,
                  background: DAMAGE_COLORS[i % DAMAGE_COLORS.length],
                  transition: 'width .6s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DamageChart;