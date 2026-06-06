const AreaMonitoring = ({ data }) => {
  if (!data) return null;
  const entries = Object.entries(data).filter(([, v]) => v.actual > 0 || v.planned > 0);

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 16 }}>
        Area monitoring performance (ha)
      </div>
      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8', fontSize: 13 }}>No area data yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {entries.map(([key, v]) => {
            const pct    = v.planned > 0 ? Math.min(100, (v.actual / v.planned) * 100) : null;
            const color  = key === 'HYBRID' ? '#166534' : key === 'INBRED' ? '#1e40af' : '#92400e';
            const light  = key === 'HYBRID' ? '#dcfce7' : key === 'INBRED' ? '#dbeafe' : '#fef3c7';
            const isOwn  = key === 'OWN_SEED';
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{v.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {pct !== null && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: v.met ? '#dcfce7' : '#fee2e2', color: v.met ? '#166534' : '#dc2626' }}>
                        {v.pct}% {v.met ? '✓ met' : 'below target'}
                      </span>
                    )}
                  </div>
                </div>
                {!isOwn && v.planned > 0 && (
                  <div style={{ marginBottom: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                      <span>Planned: <strong style={{ color: '#374151' }}>{v.planned} ha</strong></span>
                      <span>Monitored: <strong style={{ color: '#374151' }}>{v.actual} ha</strong></span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(2, Math.min(100, pct || 0))}%`, background: color, borderRadius: 999, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                )}
                {isOwn && (
                  <div style={{ background: light, border: `1px solid ${color}30`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color, fontWeight: 600 }}>
                    {v.actual > 0 ? `${v.actual} ha monitored` : 'No area data'} — no planned target (own seed)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AreaMonitoring;