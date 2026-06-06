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

const KpiCard = ({ icon, value, label, sub, accent, warn }) => (
  <div style={{
    background: 'white',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(15,23,42,.06)',
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 110,
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <span style={{
        fontSize: 26,
        fontWeight: 800,
        color: accent || (warn ? '#dc2626' : '#111827'),
        lineHeight: 1.1,
        wordBreak: 'break-word',
      }}>
        {value}
      </span>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: accent ? `${accent}18` : '#f0fdf4',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{label}</div>
    {sub && <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>{sub}</div>}
  </div>
);

const KpiCards = ({ kpi }) => {
  const dominantColor = pc(kpi?.dominant_phase);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
      gap: 14,
    }}>
      <style>{`
        @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(3, minmax(0,1fr)) !important; } }
        @media (max-width: 700px)  { .kpi-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } }
      `}</style>
      <KpiCard
        icon={<Users size={17} color="#16a34a" />}
        value={fmtN(kpi?.total_farmers)}
        label="Farmers monitored"
        sub="this season"
      />
      <KpiCard
        icon={<TrendingUp size={17} color="#3b82f6" />}
        value={kpi?.total_area_ha > 0 ? `${fmtN(kpi.total_area_ha, 2)} ha` : '—'}
        label="Area monitored"
        sub="latest per farmer"
        accent="#1e40af"
      />
      <KpiCard
        icon={<Clock size={17} color="#ef4444" />}
        value={fmtN(kpi?.delayed_farmers)}
        label="Delayed farmers"
        sub={kpi?.avg_delay_days > 0 ? `avg ${kpi.avg_delay_days}d delay` : 'no delays'}
        warn={kpi?.delayed_farmers > 0}
      />
      <KpiCard
        icon={<AlertTriangle size={17} color="#f97316" />}
        value={fmtN(kpi?.damaged_farmers)}
        label="Damaged farmers"
        sub="reported damage"
        warn={kpi?.damaged_farmers > 0}
      />
      <KpiCard
        icon={<Activity size={17} color={dominantColor} />}
        value={kpi?.dominant_label || '—'}
        label="Dominant phase"
        sub={kpi?.dominant_count > 0 ? `${kpi.dominant_count} farmers` : 'no data'}
        accent={dominantColor}
      />
    </div>
  );
};

export default KpiCards;