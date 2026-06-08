import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Download, Trophy } from 'lucide-react';
import { getGisAllPolls, getHarvestRecords, getSeedProductivity } from '../../api/axios';

import { computeUtil, computeMetrics, fmtNum, getUtilTier, SEED_CFG, SEED_KEYS, TIER_CFG, UtilBadge } from '../../components/production/productionUtils';
import ProductionFilterBar    from '../../components/production/ProductionFilterBar';
import ProductionTiles        from '../../components/production/ProductionTiles';
import HarvestPerformanceTable from '../../components/production/HarvestPerformanceTable';
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
  const [allRecords,       setAllRecords]       = useState([]);
  const [seedProdData,     setSeedProdData]     = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [activeTab,      setActiveTab]      = useState('harvest');
  const [seedFilter,     setSeedFilter]     = useState('');
  const [seedPage,       setSeedPage]       = useState(1);
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
      const [harvestRes, seedProdRes] = await Promise.allSettled([
        getHarvestRecords({ poll_id: selectedPollId }),
        getSeedProductivity({ poll_id: selectedPollId }),
      ]);
      if (harvestRes.status === 'fulfilled') {
        const data = harvestRes.value.data;
        setAllRecords(Array.isArray(data) ? data : (data?.results || []));
      }
      if (seedProdRes.status === 'fulfilled') {
        setSeedProdData(Array.isArray(seedProdRes.value.data) ? seedProdRes.value.data : []);
      }
    } catch {
      pushToast('Failed to load production data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPollId, pushToast]);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { setSeedPage(1); }, [seedFilter, seedProdData.length]);

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

            {/* Yield Gap Chart — full width */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                Productive Seed Equivalent vs Yield Gap
              </p>
              <YieldGapChart records={records} computeMetrics={computeMetrics} />
            </div>

            {/* Seed Productivity Analytics Table — full width below chart */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: '0 0 0.125rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                Seed Productivity Analytics Table
              </p>
              <p style={{ margin: '0 0 0.875rem', fontSize: '0.67rem', color: '#94a3b8' }}>
                Per-farmer breakdown — Yield Ratio = Actual ÷ Expected · Productive Equivalent = Seed Distributed × Yield Ratio · Gap = Distributed − Productive
              </p>
              {(() => {
                // Use backend-computed seed productivity data
                const PAGE_SIZE = 15;
                const rows = (seedFilter
                  ? seedProdData.filter(r => r.seed_source === seedFilter)
                  : seedProdData
                ).map(r => ({
                  id:              r.harvest_id,
                  farmer_name:     r.farmer_name,
                  barangay:        r.barangay,
                  seed_source:     r.seed_source,
                  seed_dist_kg:    r.seed_distributed_kg,
                  prod_seed_equiv: r.productive_equiv_kg,
                  yield_gap_equiv: r.yield_gap_equiv_kg,
                  yield_ratio:     r.utilization_pct > 0 ? r.utilization_pct / 100 : 0,
                  util_pct:        r.utilization_pct,
                }));
                const totalSeedPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
                const paginatedRows  = rows.slice((seedPage - 1) * PAGE_SIZE, seedPage * PAGE_SIZE);

                if (!rows.length) return (
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                    No seed productivity data available.
                  </p>
                );

                return (
                  <>
                    <div style={{ overflowX: 'auto', borderRadius: '0.875rem', border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 700 }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc' }}>
                          {[
                            { label: 'Farmer', align: 'left' },
                            { label: 'Seed Type', align: 'left' },
                            { label: 'Seed Distributed', align: 'right' },
                            { label: 'Productive Equivalent', align: 'right' },
                            { label: 'Yield Gap Equivalent', align: 'right' },
                            { label: 'Yield %', align: 'right' },
                            { label: 'Status', align: 'left' },
                          ].map(h => (
                            <th key={h.label} style={{
                              padding: '0.625rem 0.875rem',
                              fontSize: '0.62rem', fontWeight: 700,
                              color: '#94a3b8', textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              borderBottom: '1px solid #e2e8f0',
                              textAlign: h.align, whiteSpace: 'nowrap',
                            }}>
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row, idx) => {
                          const cfg = SEED_CFG[row.seed_source] || SEED_CFG.OWN_SEED;
                          const tier = getUtilTier(row.util_pct);
                          return (
                            <tr key={row.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                              <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                                <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{row.farmer_name}</p>
                                {row.barangay && <p style={{ margin: 0, fontSize: '0.67rem', color: '#94a3b8' }}>Brgy. {row.barangay}</p>}
                              </td>
                              <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                                <span style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700 }}>
                                  {cfg.label.replace(' seeds', '')}
                                </span>
                              </td>
                              <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                                {fmtNum(row.seed_dist_kg, 1)} kg
                              </td>
                              <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#15803d', borderBottom: '1px solid #f3f4f6' }}>
                                {fmtNum(row.prod_seed_equiv, 1)} kg
                              </td>
                              <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #f3f4f6', color: row.yield_gap_equiv > 0 ? '#b45309' : '#15803d' }}>
                                {fmtNum(row.yield_gap_equiv, 1)} kg
                              </td>
                              <td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 800, color: tier.color, borderBottom: '1px solid #f3f4f6' }}>
                                {row.util_pct !== null ? `${fmtNum(row.util_pct, 1)}%` : '—'}
                              </td>
                              <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                                <UtilBadge pct={row.util_pct} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>

                    {totalSeedPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setSeedPage(p => Math.max(1, p - 1))}
                          disabled={seedPage === 1}
                          style={{ padding: '0.375rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: seedPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.78rem', color: '#374151', opacity: seedPage === 1 ? 0.4 : 1 }}>
                          Prev
                        </button>
                        <button
                          onClick={() => setSeedPage(p => Math.min(totalSeedPages, p + 1))}
                          disabled={seedPage === totalSeedPages}
                          style={{ padding: '0.375rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: seedPage === totalSeedPages ? 'not-allowed' : 'pointer', fontSize: '0.78rem', color: '#374151', opacity: seedPage === totalSeedPages ? 0.4 : 1 }}>
                          Next
                        </button>
                      </div>
                      <span style={{ color: '#475569', fontSize: '0.78rem' }}>
                        Page {seedPage} of {totalSeedPages} · {rows.length} records
                      </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Production Insights — pinakababa ng analytics tab */}
          {records.length > 0 && (() => {
            const totalMT    = records.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0);
            const totalArea  = records.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
            const avgYield   = totalArea > 0 ? totalMT / totalArea : 0;
            const allUtils   = records.map(r => computeUtil(r)).filter(v => v !== null);
            const avgUtil    = allUtils.length > 0 ? allUtils.reduce((a, b) => a + b, 0) / allUtils.length : null;
            const belowCount = records.filter(r => { const u = computeUtil(r); return u !== null && u < 80; }).length;
            const exceeded   = records.filter(r => { const u = computeUtil(r); return u !== null && u > 100; }).length;
            const critical   = records.filter(r => { const u = computeUtil(r); return u !== null && u < 50; }).length;

            const seedYields = SEED_KEYS.map(k => {
              const g    = records.filter(r => r.seed_source === k);
              const area = g.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);
              const mt   = g.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0);
              return { k, label: SEED_CFG[k].label, avg: area > 0 ? mt / area : 0, count: g.length };
            }).filter(s => s.count > 0).sort((a, b) => b.avg - a.avg);

            const totalGap = records.reduce((s, r) => {
              const m = computeMetrics(r);
              return s + Math.max(0, m.expected_kg - m.harvest_kg);
            }, 0);

            const insightItems = [
              seedYields[0] && {
                color: SEED_CFG[seedYields[0].k].color,
                text: `${seedYields[0].label} recorded the highest average yield at ${fmtNum(seedYields[0].avg)} t/ha.`,
              },
              avgYield > 0 && {
                color: '#2563eb',
                text: `Average yield reached ${fmtNum(avgYield)} t/ha across all seed types.`,
              },
              belowCount > 0 && {
                color: '#b45309',
                text: `${belowCount} farmer${belowCount !== 1 ? 's' : ''} ${belowCount !== 1 ? 'are' : 'is'} below target (below 80% achievement).`,
              },
              exceeded > 0 && {
                color: '#166534',
                text: `${exceeded} farmer${exceeded !== 1 ? 's' : ''} exceeded the target yield — classified as Exceeded Target.`,
              },
              critical > 0 && {
                color: '#b91c1c',
                text: `${critical} farmer${critical !== 1 ? 's' : ''} classified as Critical. Immediate AT field visit recommended.`,
              },
              avgUtil !== null && {
                color: getUtilTier(avgUtil).color,
                text: `Overall achievement rate is ${fmtNum(avgUtil, 1)}% — rated as ${getUtilTier(avgUtil).key}.`,
              },
              totalMT > 0 && {
                color: '#0369a1',
                text: `Total production reached ${fmtNum(totalMT)} MT${selectedPoll?.season && selectedPoll?.year ? ` for ${selectedPoll.season === 'DRY' ? 'Dry' : 'Wet'} Season ${selectedPoll.year}` : ''}.`,
              },
              totalGap > 0 && {
                color: '#b45309',
                text: `Seasonal yield gap reached ${fmtNum(totalGap, 0)} kg — potential production not yet realized.`,
              },
            ].filter(Boolean);

            return (
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
                <p style={{ margin: '0 0 0.875rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Production Insights
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {insightItems.map((ins, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: '#374151', lineHeight: 1.6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: ins.color, display: 'inline-block', marginTop: '0.45rem', flexShrink: 0 }} />
                      <span>{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default Production;