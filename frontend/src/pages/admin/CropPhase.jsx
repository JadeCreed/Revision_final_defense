import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, MapPin, ChevronDown, BarChart3, CheckCircle2, AlertCircle, AlertTriangle, Users, TrendingUp } from 'lucide-react';
import { getCropPhaseAnalytics } from '../../api/axios';
import KpiCards          from '../../components/KpiCards';
import GanttChart        from '../../components/GanttChart';
import PhaseDistribution from '../../components/PhaseDistribution';
import AreaMonitoring    from '../../components/AreaMonitoring';
import ComplianceDonut   from '../../components/ComplianceDonut';
import DelayChart        from '../../components/DelayChart';
import DamageChart       from '../../components/DamageChart';
import AttentionPanel    from '../../components/AttentionPanel';

const SEED_CFG = {
  HYBRID:   { label: 'Hybrid Seed',  color: '#166534', light: '#dcfce7', border: '#86efac' },
  INBRED:   { label: 'Inbred Seed',  color: '#1e40af', light: '#dbeafe', border: '#93c5fd' },
  OWN_SEED: { label: 'Own Seed',     color: '#92400e', light: '#fef3c7', border: '#fde047' },
};
const PHASE_COLORS = {
  DISTRIBUTION:'#64748b', ESTABLISHMENT:'#3b82f6', TILLERING:'#22c55e',
  FLOWERING:'#a855f7',    RIPENING:'#eab308',      HARVESTING:'#f97316',
};
const pc   = k => PHASE_COLORS[k] || '#94a3b8';
const fmtN = (n, d = 0) => n != null && !isNaN(n)
  ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
  : '—';


// ── Simple dropdown ──────────────────────────────────────────
const SimpleDropdown = ({ options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find(o => o.value === value);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 13px', borderRadius: 10,
        border: '1px solid #e2e8f0', background: 'white',
        fontSize: 13, fontWeight: 600, color: '#374151',
        cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.05)',
        whiteSpace: 'nowrap',
      }}>
        {current?.label || placeholder}
        <ChevronDown size={13} style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: 'white', border: '1px solid #e2e8f0',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          zIndex: 50, minWidth: 170, overflow: 'hidden',
        }}>
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{
              width: '100%', textAlign: 'left', padding: '9px 14px',
              border: 'none', fontSize: 13, cursor: 'pointer',
              background: o.value === value ? '#f0fdf4' : 'white',
              color: o.value === value ? '#166534' : '#374151',
              fontWeight: o.value === value ? 700 : 400,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              {o.label}
              {o.active && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: '#dcfce7', color: '#166534' }}>active</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Insight card ──────────────────────────────────────────────
const InsightCard = ({ icon, title, value, sub, accent = '#166534', bg = '#f0fdf4', border = '#bbf7d0' }) => (
  <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: accent, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: `${accent}bb`, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────
const CropPhase = () => {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [pollId,     setPollId]     = useState(null);
  const [seedFilter, setSeedFilter] = useState('ALL');
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const params = {};
      if (pollId)                             params.poll_id   = pollId;
      if (seedFilter && seedFilter !== 'ALL') params.seed_type = seedFilter;
      const res = await getCropPhaseAnalytics(params);
      setData(res.data);
    } catch (e) {
      setError('Failed to load analytics. Make sure /api/crop-phase/analytics/ is accessible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pollId, seedFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    timerRef.current = setInterval(() => load(true), 30000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const poll   = data?.poll;
  const kpi    = data?.kpi;
  const ins    = data?.insights;
  const polls  = data?.poll_list || [];
  const season = poll?.season || 'WET';
  const year   = poll?.year   || new Date().getFullYear();

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 14, color: '#64748b' }}>
      <style>{`@keyframes cp-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'cp-spin .7s linear infinite' }} />
      <span style={{ fontSize: 13 }}>Loading crop phase analytics…</span>
    </div>
  );

  if (error) return (
    <div style={{ margin: '2rem', padding: '1.5rem', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 14, color: '#991b1b', fontSize: 13 }}>
      <strong>Error:</strong> {error}
      <br />
      <button onClick={() => load()} style={{ marginTop: 12, padding: '6px 14px', background: '#1a4d1a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh'}}>
      <style>{`
        @keyframes cp-spin   { to { transform: rotate(360deg); } }
        @keyframes cp-pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        .cp-two  { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .cp-ins  { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
        @media(max-width:900px)  { .cp-two { grid-template-columns: 1fr !important; } .cp-ins { grid-template-columns: repeat(2,minmax(0,1fr)) !important; } }
        @media(max-width:600px)  { .cp-ins { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Hero ── */}
        <div style={{
          background: 'linear-gradient(135deg, #14532d 0%, #166534 55%, #15803d 100%)',
          borderRadius: 16, padding: '24px 28px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
          boxShadow: '0 4px 16px rgba(15,23,42,.10)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#86efac' }}>Crop Phase Analytics</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'rgba(255,255,255,.15)', color: '#dcfce7' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'cp-pulse 1.5s infinite' }} />
                Live
              </span>
            </div>
            <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: 'white', lineHeight: 1.15 }}>{poll?.label || '—'}</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#bbf7d0', lineHeight: 1.5 }}>Track crop phase progression per seed type across all barangays in Lucban, Quezon.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => load()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.12)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'cp-spin .7s linear infinite' : 'none' }} /> Refresh
            </button>
            <button onClick={() => navigate('/admin/gis')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.12)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <MapPin size={13} /> GIS Map ↗
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        {(() => {
          const seasonOptions = [...new Map(
            polls.map(p => [p.season, { value: p.season, label: p.season === 'WET' ? 'Wet Season' : 'Dry Season' }])
          ).values()];

          const activePoll   = polls.find(p => p.id === (pollId ?? poll?.id));
          const activeSeason = activePoll?.season || poll?.season || 'WET';
          const activeYear   = activePoll?.year || poll?.year || new Date().getFullYear();

          const yearOptions = polls
            .filter(p => p.season === activeSeason)
            .map(p => ({
              value: p.id,
              label: String(p.year),
              active: p.status === 'OPEN',
            }))
            .filter((v, i, a) => a.findIndex(x => x.value === v.value) === i);

          const handleSeasonChange = newSeason => {
            const match = polls.find(p => p.season === newSeason && p.status === 'OPEN')
              || polls.find(p => p.season === newSeason);
            if (match) setPollId(match.id);
          };

          const handleYearChange = newPollId => setPollId(newPollId);

          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {seasonOptions.length > 0 && (
                <SimpleDropdown
                  options={seasonOptions}
                  value={activeSeason}
                  onChange={handleSeasonChange}
                  placeholder="Select season"
                />
              )}

              {yearOptions.length > 0 && (
                <SimpleDropdown
                  options={yearOptions}
                  value={pollId ?? activePoll?.id}
                  onChange={handleYearChange}
                  placeholder={String(activeYear)}
                />
              )}

              <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0 }} />

              <div style={{ display: 'flex', gap: 5, background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: 4, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
                {[
                  { key: 'ALL',      label: 'All seeds' },
                  { key: 'HYBRID',   label: 'Hybrid'    },
                  { key: 'INBRED',   label: 'Inbred'    },
                  { key: 'OWN_SEED', label: 'Own Seed'  },
                ].map(s => {
                  const cfg    = SEED_CFG[s.key];
                  const active = seedFilter === s.key;
                  return (
                    <button key={s.key} onClick={() => setSeedFilter(s.key)} style={{
                      padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: active ? (cfg?.light || '#f0fdf4') : 'transparent',
                      color:      active ? (cfg?.color || '#166534') : '#64748b',
                      border:     active ? `1px solid ${cfg?.border || '#bbf7d0'}` : '1px solid transparent',
                      cursor: 'pointer', transition: 'all .12s',
                    }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── KPI cards ── */}
        <KpiCards kpi={kpi} />

        {/* ── Gantt ── */}
        <GanttChart
          ganttData={data?.gantt}
          distDates={data?.dist_dates}
          season={season}
          year={year}
          stdDays={data?.std_days}
          ganttAlert={ins?.gantt_alert}
          timelineMonths={data?.timeline_months}
        />

        {/* ── Insights ── */}
        {ins && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Key insights</div>
            <div className="cp-ins">
              {ins.most_active_phase?.phase && (
                <InsightCard icon={<BarChart3 size={16} color={pc(ins.most_active_phase.phase)} />}
                  title="Most active phase" value={ins.most_active_phase.label}
                  sub={`${ins.most_active_phase.count} farmers · ${ins.most_active_phase.pct}% of monitored`}
                  accent={pc(ins.most_active_phase.phase)} bg={`${pc(ins.most_active_phase.phase)}12`} border={`${pc(ins.most_active_phase.phase)}33`} />
              )}
              {ins.area_performance?.pct !== null && ins.area_performance?.pct !== undefined && (
                <InsightCard icon={<TrendingUp size={16} color="#1e40af" />}
                  title="Area performance" value={`${ins.area_performance.pct}%`}
                  sub={`${fmtN(ins.area_performance.actual,2)} ha of ${fmtN(ins.area_performance.planned,2)} ha planned`}
                  accent="#1e40af" bg="#eff6ff" border="#bfdbfe" />
              )}
              {ins.planting_compliance?.pct !== undefined && (
                <InsightCard icon={<CheckCircle2 size={16} color={ins.planting_compliance.pct >= 70 ? '#16a34a' : '#dc2626'} />}
                  title="Planting compliance" value={`${ins.planting_compliance.pct}%`}
                  sub={`${ins.planting_compliance.met} met · ${ins.planting_compliance.not_met} did not`}
                  accent={ins.planting_compliance.pct >= 70 ? '#166534' : '#991b1b'}
                  bg={ins.planting_compliance.pct >= 70 ? '#f0fdf4' : '#fee2e2'}
                  border={ins.planting_compliance.pct >= 70 ? '#bbf7d0' : '#fca5a5'} />
              )}
              {ins.delay_alert?.count > 0 && (
                <InsightCard icon={<AlertCircle size={16} color="#dc2626" />}
                  title="Delay alert" value={`${ins.delay_alert.count} delayed`}
                  sub={`Highest in ${ins.delay_alert.seed_label} · ${ins.delay_alert.total_delayed} total`}
                  accent="#991b1b" bg="#fee2e2" border="#fca5a5" />
              )}
              {ins.risk_alert?.cause && (
                <InsightCard icon={<AlertTriangle size={16} color="#f97316" />}
                  title="Risk alert" value={ins.risk_alert.cause}
                  sub={`${ins.risk_alert.count} cases · ${ins.risk_alert.pct}% of all damage`}
                  accent="#c2410c" bg="#fff7ed" border="#fed7aa" />
              )}
              {ins.attention_required > 0 && (
                <InsightCard icon={<Users size={16} color="#7c3aed" />}
                  title="Attention required" value={`${ins.attention_required} farmers`}
                  sub="Delayed or damaged — need follow-up visit"
                  accent="#5b21b6" bg="#faf5ff" border="#ddd6fe" />
              )}
            </div>
          </div>
        )}

        {/* ── Phase distribution + Area monitoring ── */}
        <div className="cp-two">
          <PhaseDistribution data={data?.phase_distribution} />
          <AreaMonitoring    data={data?.area_data} />
        </div>

        {/* ── Compliance + Delay ── */}
        <div className="cp-two">
          <ComplianceDonut data={data?.compliance} />
          <DelayChart      data={data?.delay_by_seed} />
        </div>

        {/* ── Damage ── */}
        <DamageChart data={data?.cause_of_damage} />

        {/* ── Attention panel ── */}
        <AttentionPanel data={data?.attention_list} />

        {/* ── Std days reference ── */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
            Standard days — {season === 'WET' ? 'Wet' : 'Dry'} Season {year}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {Object.entries((data?.std_days?.[season]) || {}).map(([ph, d]) => (
              <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: pc(ph), flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#475569' }}>
                  {ph === 'DISTRIBUTION' ? 'Seed dist.' : ph === 'ESTABLISHMENT' ? 'Establishment' : ph.charAt(0) + ph.slice(1).toLowerCase()}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{d}d</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '8px 0 0', lineHeight: 1.5 }}>
            Seed Distribution encoded by Brgy President · All other phases encoded by AT
          </p>
        </div>

      </div>
    </div>
  );
};

export default CropPhase;