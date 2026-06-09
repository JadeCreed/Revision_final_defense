import React, { useState, useEffect, useCallback } from 'react';
import { fetchAdminDashboard } from '../../api/adminDashboard';
import { Users, MapPin, Box, BarChart2, CheckCircle } from 'lucide-react';

// ── Animation keyframes injected once ────────────────────────────────────────
const STYLES = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
@keyframes barGrow {
  from { width: 0%; }
  to   { width: var(--bar-width); }
}
@keyframes scaleIn {
  from { transform: scale(0.92); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
.dash-card  { animation: fadeUp 0.45s ease both; }
.dash-fade  { animation: fadeIn 0.5s ease both; }
.dash-scale { animation: scaleIn 0.4s ease both; }

/* ── Responsive grid helpers ── */
.grid-kpi       { display: grid; gap: 14px; grid-template-columns: repeat(5, minmax(0,1fr)); }
.grid-2col      { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; }
.grid-brgy      { display: grid; gap: 0 32px; grid-template-columns: 1fr 1fr; }

@media (max-width: 768px) {
  .grid-kpi  { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .grid-2col { grid-template-columns: 1fr; }
  .grid-brgy { grid-template-columns: 1fr; }
}
@media (max-width: 400px) {
  .grid-kpi  { grid-template-columns: 1fr 1fr; }
}
`;

// ── Color helpers ─────────────────────────────────────────────────────────────
const TIER_COLOR = {
  'Exceeded Target': '#166534',
  'Achieved Target': '#15803d',
  'Near Target':     '#0369a1',
  'Below Target':    '#b45309',
  'Critical':        '#b91c1c',
  'N/A':             '#64748b',
};
const TIER_BG = {
  'Exceeded Target': '#dcfce7',
  'Achieved Target': '#f0fdf4',
  'Near Target':     '#e0f2fe',
  'Below Target':    '#fef3c7',
  'Critical':        '#fee2e2',
  'N/A':             '#f1f5f9',
};
const SEED_COLORS = {
  HYBRID:   '#16a34a',
  INBRED:   '#0369a1',
  OWN_SEED: '#b45309',
};
const PHASE_COLORS = {
  DISTRIBUTION:  '#15803d',
  ESTABLISHMENT: '#0891b2',
  TILLERING:     '#7c3aed',
  FLOWERING:     '#db2777',
  RIPENING:      '#d97706',
  HARVESTING:    '#ea580c',
};

// ── Skeleton loader ───────────────────────────────────────────────────────────
const Skeleton = ({ h = 16, w = '100%', r = 8 }) => (
  <div style={{
    height: h, width: w, borderRadius: r,
    background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
    backgroundSize: '400px 100%',
    animation: 'shimmer 1.4s infinite linear',
  }} />
);

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ title, children, delay = 0, colSpan = 1 }) => (
  <div className="dash-card" style={{
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    padding: '20px 22px',
    animationDelay: `${delay}ms`,
    gridColumn: colSpan > 1 ? `span ${colSpan}` : undefined,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }}>
    {title && (
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: '#64748b', marginBottom: 14 }}>
        {title}
      </div>
    )}
    {children}
  </div>
);

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color = '#15803d', icon, delay = 0 }) => (
  <div className="dash-card" style={{
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: '18px 20px',
    animationDelay: `${delay}ms`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
          {value ?? <Skeleton h={28} w={80} />}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
      </div>
      {icon && (
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, color,
        }}>
          {icon}
        </div>
      )}
    </div>
  </div>
);

// ── Horizontal bar chart row ──────────────────────────────────────────────────
const BarRow = ({ label, value, max, color, suffix = '%', sub, delay = 0 }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10, animationDelay: `${delay}ms` }} className="dash-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {value !== null && value !== undefined ? `${value}${suffix}` : '—'}
        </span>
      </div>
      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 99, transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
        }} />
      </div>
      {sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
};

// ── Donut chart (pure CSS/SVG) ────────────────────────────────────────────────
const DonutChart = ({ data, size = 130 }) => {
  const total   = data.reduce((s, d) => s + (d.value || 0), 0);
  const radius  = 45;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const slices = data.map((d) => {
    const pct   = total > 0 ? d.value / total : 0;
    const dash  = pct * circumference;
    const gap   = circumference - dash;
    const slice = { ...d, dashArray: `${dash} ${gap}`, dashOffset: -offset * circumference / (total || 1) };
    offset += d.value;
    return slice;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={18} />
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={18} />
      ) : slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={radius} fill="none"
          stroke={s.color} strokeWidth={18}
          strokeDasharray={s.dashArray}
          strokeDashoffset={`${-((data.slice(0, i).reduce((a, b) => a + b.value, 0)) / total) * circumference}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontWeight={800} fill="#0f172a">{total || 0}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={9} fill="#64748b">Total</text>
    </svg>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [pollId,     setPollId]     = useState('');
  const [seedFilter, setSeedFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminDashboard({ poll_id: pollId, seed_type: seedFilter });
      setData(res.data);
    } catch (e) {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [pollId, seedFilter]);

  useEffect(() => { load(); }, [load]);

  const poll      = data?.poll      || {};
  const kpi       = data?.kpi       || {};
  const pollList  = data?.poll_list || [];
  const insights  = data?.insights  || [];

  // ── Unique years and seasons from poll_list ────────────────────────────────
  const uniqueYears   = [...new Set(pollList.map(p => p.year))].sort((a, b) => b - a);
  const uniqueSeasons = [...new Set(pollList.map(p => p.season))];
  const [yearFilter,   setYearFilter]   = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');

  // Sync yearFilter + seasonFilter → pollId
  useEffect(() => {
    if (!yearFilter && !seasonFilter) { setPollId(''); return; }
    const match = pollList.find(p =>
      (!yearFilter   || p.year   === parseInt(yearFilter))   &&
      (!seasonFilter || p.season === seasonFilter)
    );
    if (match) setPollId(String(match.id));
  }, [yearFilter, seasonFilter, pollList]);

  const SEED_TABS = [
    { key: '',        label: 'All Seeds' },
    { key: 'HYBRID',   label: 'Hybrid'    },
    { key: 'INBRED',   label: 'Inbred'    },
    { key: 'OWN_SEED', label: 'Own Seed'  },
  ];

  const gridCol = (n) => `repeat(${n}, minmax(0, 1fr))`;

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ padding: '1.25rem',  minHeight: '100vh' }}>

        {/* ── Hero Banner ── */}
        <div className="dash-card" style={{
          background: 'linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)',
          borderRadius: 16, padding: '22px 28px', marginBottom: 22,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 4px 20px rgba(21,128,61,0.25)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#bbf7d0',
                textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                ADMIN DASHBOARD
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(255,255,255,0.15)', borderRadius: 99,
                padding: '2px 9px', fontSize: 10, color: '#fff', fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%',
                  background: '#4ade80', display: 'inline-block',
                  boxShadow: '0 0 6px #4ade80' }} />
                Live
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
              {poll.label || 'Agricultural Performance Overview'}
            </div>
            <div style={{ fontSize: 13, color: '#bbf7d0', marginTop: 3 }}>
              Municipal Agriculture Office — Lucban, Quezon
            </div>
          </div>
          <button onClick={load} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 10, padding: '8px 16px', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            ↻ Refresh
          </button>
        </div>

        {/* ── Filter Row ── */}
        <div className="dash-fade" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 20, flexWrap: 'wrap',
        }}>
          {/* Season filter */}
          <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}
            style={{
              border: '1px solid #d1d5db', borderRadius: 10,
              padding: '7px 14px', fontSize: 13, fontWeight: 600,
              background: '#fff', color: '#374151', cursor: 'pointer',
              outline: 'none',
            }}>
            <option value="">All Seasons</option>
            {uniqueSeasons.map(s => (
              <option key={s} value={s}>{s === 'WET' ? 'Wet Season' : 'Dry Season'}</option>
            ))}
          </select>

          {/* Year filter */}
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            style={{
              border: '1px solid #d1d5db', borderRadius: 10,
              padding: '7px 14px', fontSize: 13, fontWeight: 600,
              background: '#fff', color: '#374151', cursor: 'pointer',
              outline: 'none',
            }}>
            <option value="">All Years</option>
            {uniqueYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: '#e2e8f0', margin: '0 4px' }} />

          {/* Seed type tabs */}
          <div style={{
            display: 'flex', background: '#f1f5f9',
            borderRadius: 10, padding: 3, gap: 2,
          }}>
            {SEED_TABS.map(tab => (
              <button key={tab.key}
                onClick={() => setSeedFilter(tab.key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: seedFilter === tab.key ? '#fff' : 'transparent',
                  color:      seedFilter === tab.key ? '#15803d' : '#64748b',
                  boxShadow:  seedFilter === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5',
            borderRadius: 10, padding: '12px 16px', color: '#991b1b',
            fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div className="grid-kpi" style={{ marginBottom: 20 }}>
          {loading ? Array(5).fill(0).map((_, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px',
              border: '1px solid #e2e8f0' }}>
              <Skeleton h={28} w={80} /><Skeleton h={12} w={120} />
            </div>
          )) : <>
            <KpiCard label="Total Farmers"      value={kpi.total_farmers}                   icon={<Users size={18} />} color="#15803d" delay={0}   />
            <KpiCard label="Area Covered"       value={`${kpi.area_covered_ha ?? 0} ha`}    icon={<MapPin size={18} />} color="#0369a1" delay={60}
              sub={`${kpi.barangays_covered ?? 0} barangays`} />
            <KpiCard label="Total Production"   value={`${kpi.total_production_mt ?? 0} MT`} icon={<Box size={18} />} color="#7c3aed" delay={120} />
            <KpiCard label="Avg Utilization"    value={kpi.avg_utilization_pct !== null ? `${kpi.avg_utilization_pct}%` : '—'}
              icon={<BarChart2 size={18} />} color={TIER_COLOR[kpi.utilization_tier] || '#64748b'} delay={180}
              sub={kpi.utilization_tier} />
            <KpiCard label="Harvest Records"    value={kpi.total_harvest_records}            icon={<CheckCircle size={18} />} color="#ea580c" delay={240} />
          </>}
        </div>

        {/* ── Row 2: Phase Distribution + Damage Donut ── */}
        <div className="grid-2col" style={{ marginBottom: 16 }}>

          {/* Phase Distribution */}
          <Section title="Crop Phase Distribution" delay={300}>
            {loading ? Array(6).fill(0).map((_, i) => <Skeleton key={i} h={12} />) :
              (data?.phase_distribution || []).map((ph, i) => (
                <BarRow key={ph.phase} label={ph.label} value={ph.farmers}
                  max={Math.max(...(data?.phase_distribution || []).map(p => p.farmers), 1)}
                  color={PHASE_COLORS[ph.phase] || '#64748b'}
                  suffix=" farmers" delay={i * 60} />
              ))
            }
          </Section>

          {/* Damage Analytics */}
          <Section title="Damage Analytics" delay={360}>
            {loading ? <Skeleton h={130} /> : (() => {
              const damages = data?.cause_of_damage || [];
              const donutData = damages.map(d => ({
                label: d.cause, value: d.count,
                color: ['#b91c1c','#b45309','#7c3aed','#0369a1','#15803d'][damages.indexOf(d) % 5],
              }));
              return (
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <DonutChart data={donutData.length ? donutData : [{ label: 'No data', value: 1, color: '#e2e8f0' }]} />
                  <div style={{ flex: 1 }}>
                    {damages.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>No damage records</div>
                    ) : damages.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%',
                            background: donutData[i]?.color, display: 'inline-block' }} />
                          <span style={{ fontSize: 12, color: '#374151' }}>{d.cause}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{d.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Section>
        </div>

        {/* ── Row 3: Yield by Seed + Farmers by Seed ── */}
        <div className="grid-2col" style={{ marginBottom: 16 }}>

          {/* Yield by Seed Type */}
          <Section title="Yield by Seed Type (t/ha)" delay={420}>
            {loading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} h={50} />) :
              (data?.yield_by_seed || []).map((s, i) => (
                <div key={s.seed_source} className="dash-fade" style={{
                  animationDelay: `${420 + i * 80}ms`,
                  background: '#f8fafc', borderRadius: 10, padding: '12px 14px',
                  marginBottom: 10, border: `1px solid ${SEED_COLORS[s.seed_source]}30`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{s.farmer_count} farmers</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Actual</div>
                      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${s.target_yield_t_ha > 0 ? Math.min(100, (s.actual_yield_t_ha / s.target_yield_t_ha) * 100) : 0}%`,
                          background: SEED_COLORS[s.seed_source],
                          transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
                        }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800,
                      color: SEED_COLORS[s.seed_source], minWidth: 48, textAlign: 'right' }}>
                      {s.actual_yield_t_ha}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    Target: {s.target_yield_t_ha} t/ha — Total: {s.total_mt} MT
                  </div>
                </div>
              ))
            }
          </Section>

          {/* Farmers by Seed Type */}
          <Section title="Farmers by Seed Type" delay={480}>
            {loading ? <Skeleton h={130} /> : (() => {
              const fbs = data?.farmers_by_seed || [];
              const total = fbs.reduce((s, d) => s + d.count, 0);
              const donutData = fbs.map(d => ({
                label: d.label, value: d.count,
                color: SEED_COLORS[d.seed_source] || '#64748b',
              }));
              return (
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <DonutChart data={donutData.length && total > 0 ? donutData : [{ label: 'No data', value: 1, color: '#e2e8f0' }]} />
                  <div style={{ flex: 1 }}>
                    {fbs.map((d, i) => (
                      <div key={d.seed_source} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%',
                              background: SEED_COLORS[d.seed_source], display: 'inline-block' }} />
                            <span style={{ fontSize: 12, color: '#374151' }}>{d.label}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                            {total > 0 ? `${Math.round(d.count / total * 100)}%` : '0%'}
                          </span>
                        </div>
                        <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', background: SEED_COLORS[d.seed_source],
                            width: `${total > 0 ? (d.count / total) * 100 : 0}%`,
                            borderRadius: 99, transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
                          }} />
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{d.count} farmers</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Section>
        </div>

        {/* ── Row 4: Utilization by Barangay (full width) ── */}
        <div style={{ marginBottom: 16 }}>
          <Section title="Utilization by Barangay" delay={540} colSpan={1}>
            {loading ? Array(8).fill(0).map((_, i) => <Skeleton key={i} h={10} />) : (() => {
              const rows = data?.utilization_by_barangay || [];
              const maxUtil = Math.max(...rows.map(r => r.utilization_pct || 0), 100);
              return (
                <div className="grid-brgy">
                  {rows.map((b, i) => (
                    <div key={b.barangay} className="dash-fade" style={{ animationDelay: `${540 + i * 40}ms` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 3, marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{b.barangay}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                            background: TIER_BG[b.tier] || '#f1f5f9',
                            color: TIER_COLOR[b.tier] || '#64748b',
                          }}>{b.tier}</span>
                          <span style={{ fontSize: 12, fontWeight: 700,
                            color: TIER_COLOR[b.tier] || '#64748b' }}>
                            {b.utilization_pct !== null ? `${b.utilization_pct}%` : '—'}
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 7, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${b.utilization_pct !== null ? Math.min(100, (b.utilization_pct / maxUtil) * 100) : 0}%`,
                          background: TIER_COLOR[b.tier] || '#64748b',
                          transition: 'width 1s cubic-bezier(0.22,1,0.36,1)',
                        }} />
                      </div>
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', gridColumn: 'span 2', padding: '16px 0' }}>
                      No barangay data available for the selected filters.
                    </div>
                  )}
                </div>
              );
            })()}
          </Section>
        </div>

        {/* ── Row 5: Delay Analytics + Pipeline ── */}
        <div className="grid-2col" style={{ marginBottom: 16 }}>

          {/* Delay Analytics */}
          <Section title="Delay Analytics by Phase" delay={600}>
            {loading ? Array(6).fill(0).map((_, i) => <Skeleton key={i} h={12} />) : (() => {
              const delay = data?.delay_analytics || {};
              const byPhase = delay.by_phase || [];
              const maxTotal = Math.max(...byPhase.map(p => p.total), 1);
              return (
                <>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                    <div style={{ flex: 1, background: '#fee2e2', borderRadius: 10,
                      padding: '10px 14px' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#b91c1c' }}>
                        {delay.delayed_farmers ?? 0}
                      </div>
                      <div style={{ fontSize: 11, color: '#b91c1c' }}>Delayed Farmers</div>
                    </div>
                    <div style={{ flex: 1, background: '#fef3c7', borderRadius: 10,
                      padding: '10px 14px' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>
                        {delay.delay_rate_pct ?? 0}%
                      </div>
                      <div style={{ fontSize: 11, color: '#b45309' }}>Delay Rate</div>
                    </div>
                  </div>
                  {byPhase.map((p, i) => (
                    <div key={p.phase} className="dash-fade" style={{ marginBottom: 8, animationDelay: `${600 + i * 60}ms` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: '#374151' }}>{p.label}</span>
                        <span style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>
                          {p.delayed > 0 ? `${p.delayed} delayed` : '—'}
                        </span>
                      </div>
                      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          height: '100%', background: '#e2e8f0', borderRadius: 99,
                          width: `${p.total > 0 ? (p.total / maxTotal) * 100 : 0}%`,
                        }} />
                        <div style={{
                          height: '100%', background: '#b91c1c', borderRadius: 99,
                          width: `${p.total > 0 ? (p.delayed / maxTotal) * 100 : 0}%`,
                          position: 'absolute', top: 0, left: 0,
                          transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
                        }} />
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </Section>

          {/* Data Pipeline */}
          <Section title="Data Pipeline Status" delay={660}>
            {loading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} h={40} />) : (() => {
              const pipe = data?.pipeline || {};
              const totalBeneficiaries = pipe.beneficiaries?.count ?? 0;
              const steps = [
                { key: 'beneficiaries', label: 'Seed Distributed', color: '#15803d',
                  count: totalBeneficiaries, total: totalBeneficiaries,
                  pct: totalBeneficiaries > 0 ? 100 : 0 },
                { key: 'monitored', label: 'Crop Monitored', color: '#0369a1',
                  count: pipe.monitored?.count ?? 0, total: pipe.monitored?.total ?? 0, pct: pipe.monitored?.pct ?? 0 },
                { key: 'harvested', label: 'Harvest Encoded', color: '#ea580c',
                  count: pipe.harvested?.count ?? 0, total: pipe.harvested?.total ?? 0, pct: pipe.harvested?.pct ?? 0 },
              ];
              return steps.map((s, i) => (
                <div key={s.key} className="dash-fade" style={{
                  marginBottom: 14, animationDelay: `${660 + i * 80}ms`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>
                      {s.count} / {s.total}
                    </span>
                  </div>
                  <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99, background: s.color,
                      width: `${Math.min(100, s.pct)}%`,
                      transition: 'width 1s cubic-bezier(0.22,1,0.36,1)',
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                    {s.pct}% completion
                  </div>
                </div>
              ));
            })()}
          </Section>
        </div>

        {/* ── Row 6: Alerts + Executive Insights ── */}
        <div className="grid-2col" style={{ marginBottom: 16 }}>

          {/* Alerts */}
          <Section title="Alerts & Attention Required" delay={720}>
            {loading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} h={16} />) : (() => {
              const al = data?.alerts || {};
              const summary = [
                { label: 'Critical Yield (<50%)', count: al.critical_yield_count ?? 0, color: '#b91c1c', bg: '#fee2e2' },
                { label: 'Delayed Farmers',        count: al.delayed_count         ?? 0, color: '#b45309', bg: '#fef3c7' },
                { label: 'Damaged Farms',           count: al.damaged_count         ?? 0, color: '#7c3aed', bg: '#f3e8ff' },
              ];
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {summary.map(s => (
                      <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
                        <div style={{ fontSize: 10, color: s.color, lineHeight: 1.3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {(al.attention_list || []).length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
                         No alerts at this time
                      </div>
                    ) : (al.attention_list || []).map((a, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', padding: '7px 0',
                        borderBottom: '1px solid #f1f5f9',
                      }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{a.farmer_name}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>
                            {a.barangay} · {a.seed_label} · {a.phase}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                          background: a.status === 'DELAYED' ? '#fef3c7' : '#fee2e2',
                          color:      a.status === 'DELAYED' ? '#b45309' : '#b91c1c',
                        }}>
                          {a.status === 'DELAYED' ? `${a.delay_days}d delay` : a.damage_cause || 'Damaged'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </Section>

          {/* Executive Insights */}
          <Section title="Executive Insights" delay={780}>
            {loading ? Array(6).fill(0).map((_, i) => <Skeleton key={i} h={14} />) : (
              insights.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No insights available yet.</div>
              ) : insights.map((ins, i) => (
                <div key={i} className="dash-fade" style={{
                  display: 'flex', gap: 10, marginBottom: 10,
                  animationDelay: `${780 + i * 60}ms`,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#15803d',
                    marginTop: 5, flexShrink: 0,
                  }} />
                  <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}>{ins}</div>
                </div>
              ))
            )}
          </Section>
        </div>

      </div>
    </>
  );
}