// src/pages/admin/Production.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3, Users, Layers, TrendingUp, Target,
  AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
  Download, CheckCircle2, X,
} from 'lucide-react';
import API from '../../api/axios';

// ─── CONSTANTS ────────────────────────────────────────────────
const SEED_DISPLAY = {
  HYBRID:   { label: 'Hybrid seeds',        color: '#1a4d1a', bg: '#f0fdf4', border: '#bbf7d0', standard: 4000 },
  INBRED:   { label: 'Certified seeds',     color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', standard: 1500 },
  OWN_SEED: { label: 'Farmer saved seeds',  color: '#b45309', bg: '#fefce8', border: '#fde68a', standard: 2000 },
};

const getUtilTier = (pct) => {
  if (pct === null || pct === undefined)
    return { label: 'N/A', color: '#94a3b8', bg: '#f9fafb', border: '#e5e7eb' };
  if (pct >= 200) return { label: 'Master Farmer', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' };
  if (pct >= 150) return { label: 'Exceptional',   color: '#1a4d1a', bg: '#dcfce7', border: '#86efac' };
  if (pct >= 100) return { label: 'Excellent',     color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
  if (pct >= 75)  return { label: 'Good',          color: '#b45309', bg: '#fefce8', border: '#fde68a' };
  if (pct >= 50)  return { label: 'Below target',  color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' };
  return             { label: 'Needs attention', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
};

const fmtNum = (n, d = 2) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

// ─── SMALL COMPONENTS ─────────────────────────────────────────
const Toast = ({ toasts }) => (
  <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', pointerEvents: 'none' }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        backgroundColor: t.type === 'error' ? '#991b1b' : '#1a4d1a',
        color: 'white', padding: '0.75rem 1.25rem', borderRadius: '999px',
        fontSize: '0.85rem', fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        animation: 'prodToast 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        maxWidth: 'calc(100vw - 2rem)',
      }}>
        {t.type === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
        {t.msg}
      </div>
    ))}
  </div>
);

const MetricCard = ({ icon: Icon, label, value, sub, color, highlight }) => (
  <div style={{
    backgroundColor: highlight ? color + '0d' : 'white',
    borderRadius: '1rem', padding: '1rem 1.1rem',
    border: `1px solid ${highlight ? color + '40' : '#e2e8f0'}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.375rem' }}>
      <Icon size={14} color={color || '#94a3b8'} />
      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
    </div>
    <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: color || '#0f172a', lineHeight: 1 }}>
      {value}
    </p>
    {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.68rem', color: '#64748b' }}>{sub}</p>}
  </div>
);

const UtilBadge = ({ pct }) => {
  const tier = getUtilTier(pct);
  return (
    <span style={{
      backgroundColor: tier.bg, color: tier.color,
      border: `1px solid ${tier.border}`,
      borderRadius: '999px', padding: '0.15rem 0.625rem',
      fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {pct !== null ? `${fmtNum(pct, 1)}% · ` : ''}{tier.label}
    </span>
  );
};

// ─── SEED TYPE CARD ───────────────────────────────────────────
const SeedTypeCard = ({ data }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg  = SEED_DISPLAY[data.seed_source] || SEED_DISPLAY.OWN_SEED;
  const tier = getUtilTier(data.avg_utilization_pct);
  const barW = data.avg_utilization_pct
    ? Math.min(100, data.avg_utilization_pct / 2.5)
    : 0;

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: expanded ? '1px solid #f1f5f9' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{cfg.label}</span>
            <span style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700 }}>
              DA std: {(cfg.standard / 1000).toFixed(1)} t/ha
            </span>
          </div>
          <button onClick={() => setExpanded(p => !p)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Key stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {[
            { label: 'Farmers', value: data.farmer_count },
            { label: 'Area (ha)', value: fmtNum(data.total_area_ha) },
            { label: 'Production', value: `${fmtNum(data.total_production_mt)} MT` },
            { label: 'Avg yield', value: `${fmtNum(data.avg_yield_t_ha)} t/ha` },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', padding: '0.5rem 0.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{m.value}</p>
              <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* Utilization bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: 7, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(2, barW)}%`, backgroundColor: tier.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
          </div>
          <UtilBadge pct={data.avg_utilization_pct} />
        </div>
      </div>

      {/* Expanded: top performers */}
      {expanded && data.top_performers?.length > 0 && (
        <div style={{ padding: '0.875rem 1.25rem' }}>
          <p style={{ margin: '0 0 0.625rem', fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Top performers
          </p>
          {data.top_performers.map((p, i) => {
            const pTier = getUtilTier(p.utilization_pct);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: i < data.top_performers.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'grid', placeItems: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#64748b', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{p.farmer_name}</p>
                    <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b' }}>{p.barangay} · {p.variety}</p>
                  </div>
                </div>
                <span style={{ backgroundColor: pTier.bg, color: pTier.color, border: `1px solid ${pTier.border}`, borderRadius: '999px', padding: '0.15rem 0.625rem', fontSize: '0.65rem', fontWeight: 700 }}>
                  {fmtNum(p.utilization_pct, 1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── BARANGAY TABLE ───────────────────────────────────────────
const BarangayTable = ({ data }) => {
  const [sortCol, setSortCol] = useState('total_production_mt');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = [...data].sort((a, b) => {
    const va = a[sortCol] ?? 0;
    const vb = b[sortCol] ?? 0;
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const Th = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)}
      style={{
        padding: '0.625rem 0.875rem', textAlign: right ? 'right' : 'left',
        fontSize: '0.65rem', fontWeight: 700, color: sortCol === col ? '#1a4d1a' : '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid #e2e8f0', cursor: 'pointer',
        backgroundColor: '#f8fafc', whiteSpace: 'nowrap', userSelect: 'none',
      }}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600, fontSize: '0.82rem' }}>
        <thead>
          <tr>
            <Th col='barangay'              label='Barangay' />
            <Th col='farmer_count'          label='Farmers'     right />
            <Th col='total_area_ha'         label='Area (ha)'   right />
            <Th col='total_production_mt'   label='Prod (MT)'   right />
            <Th col='avg_yield_t_ha'        label='Avg yield'   right />
            <Th col='avg_utilization_pct'   label='Utilization' right />
            <th style={{ padding: '0.625rem 0.875rem', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const tier = getUtilTier(row.avg_utilization_pct);
            const barW = row.avg_utilization_pct
              ? Math.min(100, row.avg_utilization_pct / 2.5)
              : 0;
            return (
              <tr key={row.barangay}
                style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '0.75rem 0.875rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f3f4f6' }}>
                  {row.barangay}
                </td>
                <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                  {row.farmer_count}
                </td>
                <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                  {fmtNum(row.total_area_ha)}
                </td>
                <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f3f4f6' }}>
                  {fmtNum(row.total_production_mt)} MT
                </td>
                <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                  {fmtNum(row.avg_yield_t_ha)} t/ha
                </td>
                <td style={{ padding: '0.75rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', justifyContent: 'flex-end' }}>
                    <span style={{ fontWeight: 700, color: tier.color, minWidth: 44, textAlign: 'right' }}>
                      {row.avg_utilization_pct !== null ? `${fmtNum(row.avg_utilization_pct, 1)}%` : '—'}
                    </span>
                    <div style={{ width: 60, height: 5, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${Math.max(2, barW)}%`, backgroundColor: tier.color, borderRadius: '999px' }} />
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0.75rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ backgroundColor: tier.bg, color: tier.color, border: `1px solid ${tier.border}`, borderRadius: '999px', padding: '0.15rem 0.625rem', fontSize: '0.62rem', fontWeight: 700 }}>
                    {tier.label}
                  </span>
                </td>
              </tr>
            );
          })}
          {/* Totals row */}
          {sorted.length > 0 && (() => {
            const totalFarmers = sorted.reduce((s, r) => s + r.farmer_count, 0);
            const totalArea    = sorted.reduce((s, r) => s + r.total_area_ha, 0);
            const totalProd    = sorted.reduce((s, r) => s + r.total_production_mt, 0);
            const avgYield     = totalArea > 0 ? totalProd / totalArea : 0;
            const utils = sorted.map(r => r.avg_utilization_pct).filter(v => v !== null);
            const avgUtil = utils.length > 0 ? utils.reduce((a, b) => a + b, 0) / utils.length : null;
            const totalTier = getUtilTier(avgUtil);
            return (
              <tr style={{ backgroundColor: '#f0fdf4', borderTop: '2px solid #bbf7d0' }}>
                <td style={{ padding: '0.75rem 0.875rem', fontWeight: 800, color: '#1a4d1a' }}>Total</td>
                <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#1a4d1a' }}>{totalFarmers}</td>
                <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#1a4d1a' }}>{fmtNum(totalArea)}</td>
                <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', fontWeight: 800, color: '#1a4d1a' }}>{fmtNum(totalProd)} MT</td>
                <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#1a4d1a' }}>{fmtNum(avgYield)} t/ha</td>
                <td style={{ padding: '0.75rem 0.875rem', textAlign: 'right', fontWeight: 800, color: '#1a4d1a' }}>
                  {avgUtil !== null ? `${fmtNum(avgUtil, 1)}%` : '—'}
                </td>
                <td style={{ padding: '0.75rem 0.875rem' }}>
                  <span style={{ backgroundColor: totalTier.bg, color: totalTier.color, border: `1px solid ${totalTier.border}`, borderRadius: '999px', padding: '0.15rem 0.625rem', fontSize: '0.62rem', fontWeight: 700 }}>
                    {totalTier.label}
                  </span>
                </td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────
const Production = () => {
  const [summary,      setSummary]      = useState(null);
  const [bySeedType,   setBySeedType]   = useState([]);
  const [byBarangay,   setByBarangay]   = useState([]);
  const [lowPerformers,setLowPerformers]= useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const pushToast = useCallback((msg, type = 'success') => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const loadAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [sumRes, seedRes, brgyRes, lowRes] = await Promise.allSettled([
        API.get('/production/summary/'),
        API.get('/production/by-seed-type/'),
        API.get('/production/by-barangay/'),
        API.get('/production/low-performers/?threshold=100'),
      ]);

      if (sumRes.status === 'fulfilled')  setSummary(sumRes.value.data);
      if (seedRes.status === 'fulfilled') setBySeedType(seedRes.value.data || []);
      if (brgyRes.status === 'fulfilled') setByBarangay(brgyRes.value.data || []);
      if (lowRes.status === 'fulfilled')  setLowPerformers(lowRes.value.data || []);

      if ([sumRes, seedRes, brgyRes].every(r => r.status === 'rejected')) {
        pushToast('Failed to load production data.', 'error');
      }
    } catch {
      pushToast('Failed to load production data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pushToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes prodToast { 0%{opacity:0;transform:scale(0.88)} 70%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading production data...</span>
    </div>
  );

  const overallTier = getUtilTier(summary?.overall_utilization_pct);

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes prodToast { 0%{opacity:0;transform:scale(0.88)} 70%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <Toast toasts={toasts} />

      {/* HEADER */}
      <div style={{ padding: '1.25rem 1.25rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
              Production dashboard
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Harvest performance across all barangays — dry weight basis
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            <button onClick={() => loadAll(true)} disabled={refreshing}
              style={{
                padding: '0.5rem 0.875rem', backgroundColor: 'white',
                border: '1px solid #e2e8f0', borderRadius: '0.75rem',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                fontSize: '0.78rem', fontWeight: 600, color: '#374151',
              }}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              style={{
                padding: '0.5rem 0.875rem', backgroundColor: '#1a4d1a',
                border: 'none', borderRadius: '0.75rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                fontSize: '0.78rem', fontWeight: 700, color: 'white',
              }}>
              <Download size={14} /> Export PDF
            </button>
          </div>
        </div>

        {/* KEY METRICS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <MetricCard icon={Users}     label='Total farmers'    value={summary?.total_farmers ?? '—'}                       sub='harvest records encoded'       color='#0f172a' />
          <MetricCard icon={Layers}    label='Total area'       value={`${fmtNum(summary?.total_area_ha)} ha`}               sub='harvested area'                color='#166534' />
          <MetricCard icon={BarChart3} label='Total production' value={`${fmtNum(summary?.total_production_mt)} MT`}         sub='dry weight basis'              color='#2563eb' />
          <MetricCard icon={TrendingUp} label='Avg. yield'      value={`${fmtNum(summary?.avg_yield_t_ha)} t/ha`}            sub='across all records'            color='#7c3aed' />
          <MetricCard icon={Target}    label='Utilization'      value={summary?.overall_utilization_pct !== undefined ? `${fmtNum(summary.overall_utilization_pct, 1)}%` : '—'} sub={overallTier.label} color={overallTier.color} highlight />
        </div>
      </div>

      {/* SEED TYPE BREAKDOWN */}
      <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
        <p style={{ margin: '0 0 0.875rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Breakdown by seed program
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {bySeedType.length > 0
            ? bySeedType.map(s => <SeedTypeCard key={s.seed_source} data={s} />)
            : (
              <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center', border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '0.875rem' }}>
                No harvest data available yet.
              </div>
            )
          }
        </div>
      </div>

      {/* BARANGAY TABLE */}
      <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
        <p style={{ margin: '0 0 0.875rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Performance by barangay
        </p>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {byBarangay.length > 0
            ? <BarangayTable data={byBarangay} />
            : (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                No barangay data available yet.
              </div>
            )
          }
        </div>
      </div>

      {/* LOW PERFORMERS ALERT */}
      {lowPerformers.length > 0 && (
        <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem', animation: 'slideUp 0.3s ease' }}>
          <p style={{ margin: '0 0 0.875rem', fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Farmers below target — needs attention
          </p>
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '1rem', overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <AlertTriangle size={16} color='#b91c1c' />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#b91c1c' }}>
                {lowPerformers.length} farmer{lowPerformers.length !== 1 ? 's' : ''} below 100% utilization
              </span>
            </div>
            {lowPerformers.map((p, idx) => {
              const tier = getUtilTier(p.utilization_pct);
              return (
                <div key={idx} style={{
                  padding: '0.875rem 1.25rem',
                  borderBottom: idx < lowPerformers.length - 1 ? '1px solid #fee2e2' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: 'white', gap: '0.75rem', flexWrap: 'wrap',
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                      {p.farmer_name}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {SEED_DISPLAY[p.seed_source]?.label || p.seed_source}
                      {p.barangay ? ` · Brgy. ${p.barangay}` : ''}
                      {' · '}Expected: {fmtNum(p.expected_kg, 0)} kg · Got: {fmtNum(p.actual_kg, 0)} kg
                      {' · '}Gap: <strong style={{ color: '#b91c1c' }}>{fmtNum(p.gap_kg, 0)} kg</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
                    <UtilBadge pct={p.utilization_pct} />
                    <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                      {p.utilization_pct < 75 ? 'AT field visit recommended' : 'Monitor next visit'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TIER REFERENCE */}
      <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1rem 1.25rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Utilization tier reference (based on DA standard yield)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
            {[
              { range: '≥ 200%',   label: 'Master Farmer',   color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
              { range: '150–199%', label: 'Exceptional',      color: '#1a4d1a', bg: '#dcfce7', border: '#86efac' },
              { range: '100–149%', label: 'Excellent',        color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
              { range: '75–99%',   label: 'Good',             color: '#b45309', bg: '#fefce8', border: '#fde68a' },
              { range: '50–74%',   label: 'Below target',     color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
              { range: '< 50%',    label: 'Needs attention',  color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
            ].map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ backgroundColor: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: '999px', padding: '0.15rem 0.625rem', fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}>
                  {t.label}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{t.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Production;