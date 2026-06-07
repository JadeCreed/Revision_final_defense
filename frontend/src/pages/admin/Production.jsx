import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Download, Trophy } from 'lucide-react';
import API from '../../api/axios';
import { getGisAllPolls, getHarvestRecords } from '../../api/axios';

import { computeUtil, computeMetrics, fmtNum, getUtilTier, SEED_CFG, SEED_KEYS, TIER_CFG, UtilBadge } from '../../components/production/productionUtils';
import ProductionFilterBar    from '../../components/production/ProductionFilterBar';
import ProductionTiles        from '../../components/production/ProductionTiles';
import HarvestPerformanceTable from '../../components/production/HarvestPerformanceTable';
import ProductionInsights     from '../../components/production/ProductionInsights';
import YieldGapTable          from '../../components/production/YieldGapTable';
import HarvestStatusDonut     from '../../components/production/charts/HarvestStatusDonut.jsx';
import ProductionBySeedChart  from '../../components/production/charts/ProductionBySeedChart';
import YieldBySeedChart       from '../../components/production/charts/YieldBySeedChart';
import YieldGapChart          from '../../components/production/charts/YieldGapChart';

// ─── TOAST ────────────────────────────────────────────────────
const Toast = ({ toasts }) => (
  <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', pointerEvents: 'none' }}>
    {toasts.map(t => (
      <div key={t.id} style={{ backgroundColor: t.type === 'error' ? '#991b1b' : '#1a4d1a', color: 'white', padding: '0.75rem 1.25rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', animation: 'prod-spin 0.3s ease', maxWidth: 'calc(100vw - 2rem)' }}>
        {t.type === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
        {t.msg}
      </div>
    ))}
  </div>
);

// ─── SECTION CARD ─────────────────────────────────────────────
const Section = ({ title, sub, children }) => (
  <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '1rem' }}>
    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{title}</p>
      {sub && <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#94a3b8' }}>{sub}</p>}
    </div>
    <div style={{ padding: '1.25rem' }}>
      {children}
    </div>
  </div>
);

// ─── STATUS SUMMARY CARDS ─────────────────────────────────────
const StatusSummaryCards = ({ records, computeUtil }) => {
  const counts = {};
  TIER_CFG.forEach(t => { counts[t.key] = 0; });
  records.forEach(r => {
    const pct  = computeUtil(r);
    const tier = getUtilTier(pct);
    if (tier && tier.key !== 'N/A') counts[tier.key] = (counts[tier.key] || 0) + 1;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.625rem' }}>
      {TIER_CFG.map(t => (
        <div key={t.key} style={{ backgroundColor: t.bg, borderRadius: '0.875rem', padding: '0.875rem', border: `1px solid ${t.border}`, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: t.color, lineHeight: 1 }}>{counts[t.key] || 0}</p>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.62rem', fontWeight: 700, color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.3 }}>{t.key}</p>
        </div>
      ))}
    </div>
  );
};

// ─── TOP FARMERS TABLE ────────────────────────────────────────
const TopFarmersTable = ({ records, computeUtil }) => {
  const top = records
    .map(r => ({ r, util: computeUtil(r) }))
    .filter(x => x.util !== null)
    .sort((a, b) => b.util - a.util)
    .slice(0, 10);

  if (!top.length) return <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>No data yet.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc' }}>
            {['#', 'Farmer', 'Seed Type', 'Production', 'Achievement'].map(h => (
              <th key={h} style={{ padding: '0.6rem 0.875rem', fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', textAlign: h === '#' || h === 'Achievement' || h === 'Production' ? 'right' : 'left' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top.map(({ r, util }, idx) => {
            const cfg = SEED_CFG[r.seed_source] || SEED_CFG.OWN_SEED;
            const mt  = ((parseFloat(r.harvest_bags) || 0) * 50) / 1000;
            return (
              <tr key={r.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #f3f4f6' }}>{idx + 1}</td>
                <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{r.farmer_name || `Farmer #${r.farmer}`}</p>
                  {r.barangay && <p style={{ margin: 0, fontSize: '0.67rem', color: '#94a3b8' }}>Brgy. {r.barangay}</p>}
                </td>
                <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700 }}>
                    {cfg.label.replace(' seeds', '')}
                  </span>
                </td>
                <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(mt)} MT</td>
                <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}><UtilBadge pct={util} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── INTERVENTION TABLE ───────────────────────────────────────
const InterventionTable = ({ records, computeUtil, computeMetrics }) => {
  const rows = records
    .map(r => ({ r, util: computeUtil(r), m: computeMetrics(r) }))
    .filter(x => x.util !== null && x.util < 70)
    .sort((a, b) => a.util - b.util);

  if (!rows.length) return (
    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#15803d', fontSize: '0.85rem' }}>
      ✓ No farmers requiring immediate intervention.
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#fef2f2' }}>
            {['Farmer', 'Seed Type', 'Gap (kg)', 'Achievement', 'Status'].map(h => (
              <th key={h} style={{ padding: '0.6rem 0.875rem', fontSize: '0.62rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #fecaca', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, util, m }, idx) => {
            const cfg = SEED_CFG[r.seed_source] || SEED_CFG.OWN_SEED;
            const gap = m.expected_kg - m.harvest_kg;
            return (
              <tr key={r.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fff5f5' }}>
                <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #fee2e2' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{r.farmer_name || `Farmer #${r.farmer}`}</p>
                  {r.barangay && <p style={{ margin: 0, fontSize: '0.67rem', color: '#94a3b8' }}>Brgy. {r.barangay}</p>}
                </td>
                <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #fee2e2' }}>
                  <span style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700 }}>
                    {cfg.label.replace(' seeds', '')}
                  </span>
                </td>
                <td style={{ padding: '0.7rem 0.875rem', fontWeight: 700, color: '#b91c1c', borderBottom: '1px solid #fee2e2' }}>
                  {gap > 0 ? `−${fmtNum(gap, 0)} kg` : '—'}
                </td>
                <td style={{ padding: '0.7rem 0.875rem', fontWeight: 800, color: getUtilTier(util).color, borderBottom: '1px solid #fee2e2' }}>
                  {fmtNum(util, 1)}%
                </td>
                <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #fee2e2' }}>
                  <UtilBadge pct={util} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────
const Production = () => {
  const [polls,          setPolls]          = useState([]);
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [allRecords,     setAllRecords]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [activeTab,      setActiveTab]      = useState('harvest');
  const [seedFilter,     setSeedFilter]     = useState('');
  const [toasts,         setToasts]         = useState([]);
  const toastId = useRef(0);

  const pushToast = useCallback((msg, type = 'success') => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // Load polls on mount
  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const res = await getGisAllPolls();
        const list = Array.isArray(res.data) ? res.data : [];
        setPolls(list);
        // Default: active poll
        const active = list.find(p => p.is_active) || list[0];
        if (active) setSelectedPollId(active.poll_id);
      } catch {
        pushToast('Failed to load seasons.', 'error');
      }
    };
    fetchPolls();
  }, [pushToast]);

  // Load harvest records when poll changes
  const loadRecords = useCallback(async (isRefresh = false) => {
    if (!selectedPollId) return;
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res  = await getHarvestRecords({ poll_id: selectedPollId });
      const data = res.data;
      setAllRecords(Array.isArray(data) ? data : (data?.results || []));
    } catch {
      pushToast('Failed to load production data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPollId, pushToast]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // Apply seed filter
  const records = seedFilter
    ? allRecords.filter(r => r.seed_source === seedFilter)
    : allRecords;

  const selectedPoll = polls.find(p => p.poll_id === selectedPollId);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
      <style>{`@keyframes prod-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'prod-spin 0.7s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading production data...</span>
    </div>
  );

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <style>{`@keyframes prod-spin { to { transform: rotate(360deg); } }`}</style>
      <Toast toasts={toasts} />

      {/* HEADER */}
      <div style={{ padding: '1.25rem 1.25rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Production Monitoring & Analytics</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Monitor harvest performance, production output, yield attainment, and production trends.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button style={{ padding: '0.5rem 1rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>
              <Download size={13} /> Export PDF
            </button>
            <button style={{ padding: '0.5rem 1rem', backgroundColor: '#1a4d1a', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.78rem', fontWeight: 600, color: 'white' }}>
              <Download size={13} /> Export Excel
            </button>
          </div>
        </div>

        {/* FILTER BAR */}
        <ProductionFilterBar
          polls={polls}
          selectedPollId={selectedPollId}
          onPollChange={setSelectedPollId}
          seedFilter={seedFilter}
          onSeedFilter={setSeedFilter}
          onRefresh={() => loadRecords(true)}
          refreshing={refreshing}
        />

        {/* TILES */}
        <ProductionTiles records={records} computeUtil={computeUtil} />

        {/* TABS */}
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.875rem', padding: '0.2rem', gap: '0.2rem', width: 'fit-content', marginBottom: '1.5rem' }}>
          {[{ key: 'harvest', label: 'Harvest Performance' }, { key: 'analytics', label: 'Production Analytics' }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: '0.45rem 1.25rem', borderRadius: '0.625rem', border: 'none',
                backgroundColor: activeTab === t.key ? 'white' : 'transparent',
                color: activeTab === t.key ? '#1a4d1a' : '#64748b',
                fontWeight: activeTab === t.key ? 700 : 500,
                fontSize: '0.83rem', cursor: 'pointer',
                boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1 — HARVEST PERFORMANCE */}
      {activeTab === 'harvest' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Donut + Status Cards side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Section title='Harvest Performance Distribution' sub='Distribution of farmers by achievement tier'>
              <HarvestStatusDonut records={records} computeUtil={computeUtil} />
            </Section>
            <Section title='Status Summary' sub='Count of farmers per performance tier'>
              <StatusSummaryCards records={records} computeUtil={computeUtil} />
            </Section>
          </div>

          {/* Farmer table */}
          <Section title='Harvest Performance Table' sub='Detailed records per farmer — click column headers to sort'>
            <HarvestPerformanceTable records={records} computeUtil={computeUtil} computeMetrics={computeMetrics} />
          </Section>
        </div>
      )}

      {/* TAB 2 — PRODUCTION ANALYTICS */}
      {activeTab === 'analytics' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Section title='Production by Seed Type' sub='Total harvest output in MT per seed program'>
              <ProductionBySeedChart records={records} />
            </Section>
            <Section title='Average Yield by Seed Type' sub='Actual t/ha vs DA target yield'>
              <YieldBySeedChart records={records} />
            </Section>
          </div>

          {/* Top farmers */}
          <Section title='Top Performing Farmers' sub='Top 10 farmers by achievement rate'>
            <TopFarmersTable records={records} computeUtil={computeUtil} />
          </Section>

          {/* Intervention */}
          <Section title='Farmers Requiring Attention' sub='Farmers below Near Target (70%) — recommended for AT field visit'>
            <InterventionTable records={records} computeUtil={computeUtil} computeMetrics={computeMetrics} />
          </Section>

          {/* Seed Productivity Analysis */}
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>Seed Productivity Analysis</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#94a3b8' }}>
                Productive Seed Equivalent = (Actual Yield ÷ Expected Yield) × Seed Distributed · Yield Gap = Seed Dist − Productive Equiv
              </p>
            </div>

            {/* Summary cards for seed totals */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {SEED_KEYS.filter(k => k !== 'OWN_SEED').map(k => {
                  const group    = records.filter(r => r.seed_source === k);
                  const totals   = group.reduce((s, r) => {
                    const m = computeMetrics(r);
                    return { dist: s.dist + m.seed_dist_kg, prod: s.prod + m.prod_seed_equiv, gap: s.gap + m.yield_gap_equiv };
                  }, { dist: 0, prod: 0, gap: 0 });
                  const cfg = SEED_CFG[k];
                  return (
                    <div key={k} style={{ backgroundColor: cfg.bg, borderRadius: '0.875rem', padding: '1rem', border: `1px solid ${cfg.border}` }}>
                      <p style={{ margin: '0 0 0.625rem', fontSize: '0.7rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.label}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#374151' }}>
                          <span>Seed distributed</span>
                          <strong style={{ color: cfg.color }}>{fmtNum(totals.dist, 1)} kg</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#374151' }}>
                          <span>Productive equivalent</span>
                          <strong style={{ color: '#15803d' }}>{fmtNum(totals.prod, 1)} kg</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#374151' }}>
                          <span>Yield gap equivalent</span>
                          <strong style={{ color: totals.gap > 0 ? '#b45309' : '#15803d' }}>{fmtNum(totals.gap, 1)} kg</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Yield Gap Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ padding: '1.25rem', borderRight: '1px solid #f1f5f9' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Productive Seed Equivalent vs Yield Gap</p>
                <YieldGapChart records={records} computeMetrics={computeMetrics} />
              </div>
              <div style={{ padding: '1.25rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Per-farmer Breakdown</p>
                <YieldGapTable records={records} computeMetrics={computeMetrics} computeUtil={computeUtil} />
              </div>
            </div>

            {/* Auto insight for seed productivity */}
            {records.filter(r => r.seed_source !== 'OWN_SEED').length > 0 && (() => {
              const seedTotals = SEED_KEYS.filter(k => k !== 'OWN_SEED').map(k => {
                const group = records.filter(r => r.seed_source === k);
                if (!group.length) return null;
                const t = group.reduce((s, r) => {
                  const m = computeMetrics(r);
                  return { dist: s.dist + m.seed_dist_kg, prod: s.prod + m.prod_seed_equiv, gap: s.gap + m.yield_gap_equiv };
                }, { dist: 0, prod: 0, gap: 0 });
                return { k, label: SEED_CFG[k].label, ...t };
              }).filter(Boolean);

              return (
                <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc' }}>
                  <p style={{ margin: '0 0 0.625rem', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Seed productivity insight</p>
                  {seedTotals.map(s => (
                    <div key={s.k} style={{ marginBottom: '0.375rem', fontSize: '0.8rem', color: '#374151', lineHeight: 1.6 }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', backgroundColor: SEED_CFG[s.k].color, marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      <strong>{s.label}</strong> distribution totaled {fmtNum(s.dist, 1)} kg. Based on harvest performance, approximately{' '}
                      <strong style={{ color: '#15803d' }}>{fmtNum(s.prod, 1)} kg</strong> equivalent seed productivity was realized.
                      {s.gap > 0 && <> An estimated <strong style={{ color: '#b45309' }}>{fmtNum(s.gap, 1)} kg</strong> seed-equivalent production potential was not achieved.</>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Auto Insights */}
          <ProductionInsights
            records={records}
            computeUtil={computeUtil}
            computeMetrics={computeMetrics}
            season={selectedPoll?.season}
            year={selectedPoll?.year}
          />
        </div>
      )}
    </div>
  );
};

export default Production;