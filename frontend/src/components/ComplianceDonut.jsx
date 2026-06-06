import { CheckCircle2, XCircle } from 'lucide-react';

const ComplianceDonut = ({ data }) => {
  if (!data) return null;
  const { met = 0, not_met = 0, total = 0, pct = 0 } = data;
  const r     = 38;
  const cx    = 50;
  const cy    = 50;
  const circ  = 2 * Math.PI * r;
  const dash  = (circ * Math.min(pct, 100)) / 100;
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#eab308' : '#ef4444';

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 16 }}>
        Planting plan compliance
      </div>
      {total === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
          No compliance data yet
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <svg width={100} height={100} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={12} />
            <circle
              cx={cx} cy={cy} r={r} fill="none"
              stroke={color} strokeWidth={12}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            <text x={cx} y={cy - 5} textAnchor="middle" fontSize={18} fontWeight={700} fill={color}>{pct}%</text>
            <text x={cx} y={cy + 13} textAnchor="middle" fontSize={9} fill="#94a3b8">met plan</text>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} color="#16a34a" />
              <span style={{ fontSize: 13, color: '#374151' }}>
                Met: <strong>{met}</strong> farmers
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircle size={15} color="#ef4444" />
              <span style={{ fontSize: 13, color: '#374151' }}>
                Not met: <strong>{not_met}</strong> farmers
              </span>
            </div>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
              Area monitored ≥ planned area
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceDonut;