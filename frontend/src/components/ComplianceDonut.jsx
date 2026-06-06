import { CheckCircle2, XCircle } from 'lucide-react';

const SEED_CFG = {
  HYBRID:   { label: 'Hybrid Seed',  color: '#166534', light: '#dcfce7' },
  INBRED:   { label: 'Inbred Seed',  color: '#1e40af', light: '#dbeafe' },
  OWN_SEED: { label: 'Own Seed',     color: '#92400e', light: '#fef3c7' },
};

const ComplianceDonut = ({ data }) => {
  if (!data) return null;
  const { met = 0, not_met = 0, partial = 0, total = 0, pct = 0 } = data;
  const r     = 36;
  const cx    = 46;
  const cy    = 46;
  const circ  = 2 * Math.PI * r;
  const dash  = (circ * Math.min(pct, 100)) / 100;
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#eab308' : '#ef4444';
  const bg    = pct >= 70 ? '#f0fdf4' : pct >= 40 ? '#fefce8' : '#fff5f5';
  const border = pct >= 70 ? '#bbf7d0' : pct >= 40 ? '#fde68a' : '#fecaca';

  const metPct    = total > 0 ? Math.round((met     / total) * 100) : 0;
  const notMetPct = total > 0 ? Math.round((not_met / total) * 100) : 0;
  const partialPct = total > 0 ? Math.round((partial / total) * 100) : 0;

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
        Planting plan compliance
      </div>

      {total === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
          No compliance data yet
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>

          {/* Left — donut + summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <svg width={92} height={92} viewBox="0 0 92 92" style={{ flexShrink: 0 }}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={11} />
              <circle
                cx={cx} cy={cy} r={r} fill="none"
                stroke={color} strokeWidth={11}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
              />
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize={17} fontWeight={800} fill={color}>{pct}%</text>
              <text x={cx} y={cy + 11} textAnchor="middle" fontSize={8} fill="#94a3b8">met plan</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span style={{ fontSize: 13, color: '#374151' }}>Met: <strong>{met}</strong></span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#dcfce7', color: '#166534' }}>{metPct}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <XCircle size={14} color="#ef4444" />
                <span style={{ fontSize: 13, color: '#374151' }}>Not met: <strong>{not_met}</strong></span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#fee2e2', color: '#dc2626' }}>{notMetPct}%</span>
              </div>
              {partial > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 700 }}>~</span>
                  <span style={{ fontSize: 13, color: '#374151' }}>Partial: <strong>{partial}</strong></span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#fefce8', color: '#854d0e' }}>{partialPct}%</span>
                </div>
              )}
              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                Area monitored ≥ planned area
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: '#f1f5f9', alignSelf: 'stretch', flexShrink: 0 }} />

          {/* Right — stacked bar breakdown */}
          <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>
              {total} farmers with planned area
            </div>

            {/* Full stacked bar */}
            <div style={{ height: 14, borderRadius: 999, overflow: 'hidden', background: '#fee2e2', display: 'flex' }}>
              {met > 0 && (
                <div
                  title={`Met: ${met} farmers`}
                  style={{ width: `${metPct}%`, background: '#16a34a', transition: 'width .6s ease' }}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} />
                Met: {met}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} />
                Not met: {not_met}
              </span>
            </div>

            {/* Status badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 10,
              background: bg, border: `1px solid ${border}`,
              fontSize: 12, fontWeight: 700, color,
              alignSelf: 'flex-start',
            }}>
              {pct >= 70
                ? <><CheckCircle2 size={13} /> On track — {pct}% compliance</>
                : pct >= 40
                ? <>⚠ Moderate — {pct}% compliance</>
                : <><XCircle size={13} /> Low compliance — {pct}%</>
              }
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default ComplianceDonut;