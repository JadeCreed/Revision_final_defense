import { Users, TrendingUp, Clock, AlertTriangle, Activity } from 'lucide-react';

const PHASE_COLORS = {
  DISTRIBUTION:  '#64748b',
  ESTABLISHMENT: '#3b82f6',
  TILLERING:     '#22c55e',
  FLOWERING:     '#a855f7',
  RIPENING:      '#eab308',
  HARVESTING:    '#f97316',
};
const pc = k => PHASE_COLORS[k] || '#94a3b8';

const fmtN = (n, d = 0) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

const KpiCard = ({ icon, value, label, sub, accent, warn, small }) => (
  <div style={{
    background: 'white',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(15,23,42,.06)',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
      <span style={{
        fontSize: small ? 14 : 22,
        fontWeight: 800,
        color: accent || (warn ? '#dc2626' : '#111827'),
        lineHeight: 1.2,
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        flex: 1,
        minWidth: 0,
      }}>
        {value}
      </span>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: accent ? `${accent}18` : '#f0fdf4',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{sub}</div>}
  </div>
);

const KpiCards = ({ kpi }) => {
  const dominantColor = pc(kpi?.dominant_phase);
  const dominantLabel = kpi?.dominant_label || '—';
  const isLongLabel   = dominantLabel.length > 10;

  return (
    <>
      <style>{`
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1100px) {
          .kpi-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
        }
        @media (max-width: 700px) {
          .kpi-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 400px) {
          .kpi-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="kpi-grid">
        <KpiCard
          icon={<Users size={16} color="#16a34a" />}
          value={fmtN(kpi?.total_farmers)}
          label="Active Monitoring Records"
          sub="this season"
        />
        <KpiCard
          icon={<TrendingUp size={16} color="#3b82f6" />}
          value={kpi?.total_area_ha > 0 ? `${fmtN(kpi.total_area_ha, 2)} ha` : '—'}
          label="Area monitored"
          sub="latest per farmer"
          accent="#1e40af"
        />
        <KpiCard
          icon={<Clock size={16} color="#ef4444" />}
          value={fmtN(kpi?.delayed_farmers)}
          label="Delayed farmers"
          sub={kpi?.avg_delay_days > 0 ? `avg ${kpi.avg_delay_days}d delay` : 'no delays'}
          warn={kpi?.delayed_farmers > 0}
        />
        <KpiCard
          icon={<AlertTriangle size={16} color="#f97316" />}
          value={fmtN(kpi?.damaged_farmers)}
          label="Damaged farmers"
          sub="reported damage"
          warn={kpi?.damaged_farmers > 0}
        />
        <KpiCard
          icon={<Activity size={16} color={dominantColor} />}
          value={dominantLabel}
          label="Dominant phase"
          sub={kpi?.dominant_count > 0 ? `${kpi.dominant_count} farmers` : 'no data'}
          accent={dominantColor}
          small={isLongLabel}
        />
      </div>
    </>
  );
};

export default KpiCards;