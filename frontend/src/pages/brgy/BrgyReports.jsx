// src/pages/brgy/BrgyReports.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart3, Users, Layers, TrendingUp, Target, Download, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import API, { getGisAllPolls } from '../../api/axios';

const SEED_CFG = {
  HYBRID:   { label: 'Hybrid',   color: '#1a4d1a', bg: '#f0fdf4', border: '#bbf7d0' },
  INBRED:   { label: 'Inbred',   color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  OWN_SEED: { label: 'Own Seed', color: '#b45309', bg: '#fefce8', border: '#fde68a' },
};

const TIER_COLORS = {
  'Exceeded Target': { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  'Achieved Target': { color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  'Near Target':     { color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe' },
  'Below Target':    { color: '#b45309', bg: '#fefce8', border: '#fde68a' },
  'Critical':        { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
};

const fmtNum = (n, d = 2) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

const TierBadge = ({ tier }) => {
  const cfg = TIER_COLORS[tier] || { color: '#94a3b8', bg: '#f9fafb', border: '#e5e7eb' };
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '999px', padding: '0.15rem 0.625rem', fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {tier || 'N/A'}
    </span>
  );
};

const Tile = ({ icon: Icon, label, value, sub, color }) => (
  <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem 1.1rem', border: '1px solid #e2e8f0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.375rem' }}>
      <Icon size={14} color={color || '#94a3b8'} />
      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
    <p style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: color || '#0f172a', lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.67rem', color: '#64748b' }}>{sub}</p>}
  </div>
);

const chartToBase64 = async (ref) => {
  if (!ref?.current) return null;
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(ref.current, { backgroundColor: '#ffffff', scale: 2 });
  return canvas.toDataURL('image/png').split(',')[1];
};

const BrgyReports = () => {
  const [polls, setPolls] = useState([]);
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const prodChartRef = useRef(null);
  const yieldChartRef = useRef(null);
  const gapChartRef = useRef(null);

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const res = await getGisAllPolls();
        const list = Array.isArray(res.data) ? res.data : [];
        setPolls(list);
        const active = list.find((p) => p.is_active) || list[0];
        if (active) setSelectedPollId(active.poll_id);
      } catch {
        console.error('Failed to load seasons');
      }
    };
    fetchPolls();
  }, []);

  const loadReport = useCallback(async () => {
    if (!selectedPollId) return;
    setLoading(true);
    try {
      const res = await API.get('/production/brgy-report/', { params: { poll_id: selectedPollId } });
      setReportData(res.data);
    } catch {
      console.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [selectedPollId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const selectedPoll = polls.find((p) => p.poll_id === selectedPollId);
  const seasons = [...new Set(polls.map((p) => p.season))];
  const yearsForSeason = [...new Set(polls.filter((p) => p.season === selectedPoll?.season).map((p) => p.year))].sort((a, b) => b - a);

  const handleSeasonChange = (e) => {
    const match = polls.find((p) => p.season === e.target.value);
    if (match) setSelectedPollId(match.poll_id);
  };

  const handleYearChange = (e) => {
    const match = polls.find((p) => p.season === selectedPoll?.season && p.year === Number(e.target.value));
    if (match) setSelectedPollId(match.poll_id);
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const [prodChart, yieldChart, gapChart] = await Promise.all([
        chartToBase64(prodChartRef),
        chartToBase64(yieldChartRef),
        chartToBase64(gapChartRef),
      ]);

      const response = await API.post(
        '/production/brgy-report/pdf/',
        {
          poll_id: selectedPollId,
          charts: {
            production_chart: prodChart || '',
            yield_chart: yieldChart || '',
            gap_chart: gapChart || '',
          },
        },
        { responseType: 'blob' }
      );

      const contentType = response.headers?.['content-type'] || response.headers?.get?.('content-type') || '';
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        const payload = JSON.parse(text);
        throw new Error(payload.error || 'PDF generation failed.');
      }

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      const season = selectedPoll?.season === 'DRY' ? 'DrySeason' : 'WetSeason';
      link.download = `BrgyReport_${reportData?.barangay || ''}_${season}${selectedPoll?.year || ''}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert(err?.response?.data?.error || err?.message || 'Unable to generate PDF report.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: '0.875rem' }}>Loading report data...</span>
      </div>
    );
  }

  const summary = reportData?.summary || {};
  const bySeedType = reportData?.by_seed_type || [];
  const seedProd = reportData?.seed_productivity || [];
  const cropPhase = reportData?.crop_phase_summary || {};
  const insights = reportData?.insights || [];
  const pollInfo = reportData?.poll_info || {};
  const seasonLabel = pollInfo.season_display ? `${pollInfo.season_display} ${pollInfo.year}` : 'All Seasons';

  const prodChartData = bySeedType.filter((s) => s.farmer_count > 0).map((s) => ({ name: SEED_CFG[s.seed_source]?.label || s.label, mt: s.total_mt, color: SEED_CFG[s.seed_source]?.color || '#64748b' }));
  const yieldChartData = bySeedType.filter((s) => s.farmer_count > 0).map((s) => ({ name: SEED_CFG[s.seed_source]?.label || s.label, yield: s.avg_yield_t_ha, util: s.avg_util_pct, color: SEED_CFG[s.seed_source]?.color || '#64748b' }));
  const gapChartData = bySeedType.filter((s) => s.farmer_count > 0 && s.seed_source !== 'OWN_SEED').map((s) => ({ name: SEED_CFG[s.seed_source]?.label || s.label, prod: s.prod_seed_equiv_kg, gap: s.yield_gap_equiv_kg }));

  const SELECT_STYLE = { padding: '0.45rem 1.75rem 0.45rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.8rem', color: '#111827', outline: 'none', backgroundColor: 'white', appearance: 'none', cursor: 'pointer' };

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div style={{ padding: '1.25rem 1.25rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Barangay Reports</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>Analytics and downloadable reports for Brgy. {reportData?.barangay || ''}</p>
          </div>
          <button onClick={handleExportPDF} disabled={exporting || !reportData} style={{ padding: '0.625rem 1.25rem', backgroundColor: exporting ? '#d1d5db' : '#1a4d1a', color: 'white', border: 'none', borderRadius: '0.875rem', cursor: exporting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Download size={15} />
            {exporting ? 'Generating PDF...' : 'Export PDF'}
          </button>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '0.875rem 1.25rem', border: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Season</p>
            <div style={{ position: 'relative' }}>
              <select value={selectedPoll?.season || ''} onChange={handleSeasonChange} style={SELECT_STYLE}>{seasons.map((s) => <option key={s} value={s}>{s === 'WET' ? 'Wet Season' : 'Dry Season'}</option>)}</select>
              <ChevronDown size={13} color='#9ca3af' style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year</p>
            <div style={{ position: 'relative' }}>
              <select value={selectedPoll?.year || ''} onChange={handleYearChange} style={SELECT_STYLE}>{yearsForSeason.map((y) => <option key={y} value={y}>{y}</option>)}</select>
              <ChevronDown size={13} color='#9ca3af' style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}><span style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '999px', padding: '0.3rem 0.875rem', fontSize: '0.75rem', fontWeight: 700 }}>{seasonLabel}</span></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Tile icon={Users} label='Farmers Harvested' value={summary.total_farmers || 0} sub='With harvest records' color='#0f172a' />
          <Tile icon={BarChart3} label='Beneficiaries' value={summary.total_beneficiaries || 0} sub='Seed distribution recipients' color='#166534' />
          <Tile icon={Layers} label='Area Harvested' value={`${fmtNum(summary.total_area_ha)} ha`} sub='Total harvested area' color='#2563eb' />
          <Tile icon={TrendingUp} label='Total Production' value={`${fmtNum(summary.total_production_mt)} MT`} sub='Combined output' color='#7c3aed' />
          <Tile icon={Target} label='Avg Yield' value={`${fmtNum(summary.avg_yield_t_ha)} t/ha`} sub='Per hectare' color='#0369a1' />
          <Tile icon={BarChart3} label='Achievement Rate' value={summary.avg_util_pct != null ? `${fmtNum(summary.avg_util_pct, 1)}%` : '—'} sub={summary.overall_tier || ''} color={TIER_COLORS[summary.overall_tier]?.color || '#94a3b8'} />
        </div>
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.875rem', padding: '0.2rem', gap: '0.2rem', width: 'fit-content', marginBottom: '1.25rem' }}>
          {[{ key: 'overview', label: 'Overview' }, { key: 'seed', label: 'Seed Performance' }, { key: 'crop', label: 'Crop Phase' }, { key: 'insights', label: 'Insights' }].map((t) => <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '0.4rem 1rem', borderRadius: '0.55rem', border: 'none', backgroundColor: activeTab === t.key ? 'white' : 'transparent', color: activeTab === t.key ? '#1a4d1a' : '#64748b', fontWeight: activeTab === t.key ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer', boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>{t.label}</button>)}
        </div>
      </div>
      {activeTab === 'overview' && <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>Production by Seed Type</p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.68rem', color: '#94a3b8' }}>Total harvest output in MT per seed program</p>
          <div ref={prodChartRef} style={{ width: '100%', height: 240 }}><ResponsiveContainer><BarChart data={prodChartData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }} barSize={52}><CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f1f5f9' /><XAxis dataKey='name' axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v} MT`} width={52} /><Tooltip formatter={(v) => [`${fmtNum(v)} MT`, 'Production']} cursor={{ fill: '#f8fafc' }} /><Bar dataKey='mt' radius={[8, 8, 0, 0]}>{prodChartData.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar></BarChart></ResponsiveContainer></div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>Yield Achievement by Seed Type (%)</p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.68rem', color: '#94a3b8' }}>Achievement rate vs target yield per seed program</p>
          <div ref={yieldChartRef} style={{ width: '100%', height: 240 }}><ResponsiveContainer><BarChart data={yieldChartData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }} barSize={52}><CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f1f5f9' /><XAxis dataKey='name' axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} width={44} /><Tooltip formatter={(v) => [`${fmtNum(v, 1)}%`, 'Achievement']} cursor={{ fill: '#f8fafc' }} /><Bar dataKey='util' radius={[8, 8, 0, 0]}>{yieldChartData.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar></BarChart></ResponsiveContainer></div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}><p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>Harvest Performance by Seed Type</p></div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}><thead><tr style={{ backgroundColor: '#f8fafc' }}>{['Seed Type', 'Farmers', 'Area (ha)', 'Production (MT)', 'Avg Yield', 'Achievement', 'Status'].map((h) => <th key={h} style={{ padding: '0.625rem 0.875rem', fontSize: '0.63rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', textAlign: h === 'Seed Type' || h === 'Status' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead><tbody>{bySeedType.filter((s) => s.farmer_count > 0).map((s, idx) => <tr key={s.seed_source} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}><td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}><span style={{ backgroundColor: SEED_CFG[s.seed_source]?.bg || 'white', color: SEED_CFG[s.seed_source]?.color || '#374151', border: `1px solid ${SEED_CFG[s.seed_source]?.border || '#e2e8f0'}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.68rem', fontWeight: 700 }}>{SEED_CFG[s.seed_source]?.label || s.label}</span></td><td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{s.farmer_count}</td><td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(s.total_area_ha)}</td><td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #f3f4f6' }}>{fmtNum(s.total_mt)} MT</td><td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(s.avg_yield_t_ha)} t/ha</td><td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 800, color: TIER_COLORS[s.tier]?.color || '#94a3b8', borderBottom: '1px solid #f3f4f6' }}>{s.avg_util_pct != null ? `${fmtNum(s.avg_util_pct, 1)}%` : '—'}</td><td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}><TierBadge tier={s.tier} /></td></tr>)}</tbody></table></div>
        </div>
      </div>}
      {activeTab === 'seed' && <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>{bySeedType.filter((s) => s.seed_source !== 'OWN_SEED' && s.farmer_count > 0).map((s) => <div key={s.seed_source} style={{ backgroundColor: SEED_CFG[s.seed_source]?.bg || 'white', borderRadius: '1rem', padding: '1rem 1.1rem', border: `1px solid ${SEED_CFG[s.seed_source]?.border || '#e2e8f0'}` }}><p style={{ margin: '0 0 0.625rem', fontSize: '0.7rem', fontWeight: 700, color: SEED_CFG[s.seed_source]?.color || '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>{[{ label: 'Seed distributed', value: `${fmtNum(s.seed_distributed_kg, 1)} kg` }, { label: 'Productive equivalent', value: `${fmtNum(s.prod_seed_equiv_kg, 1)} kg`, color: '#15803d' }, { label: 'Yield gap equivalent', value: `${fmtNum(s.yield_gap_equiv_kg, 1)} kg`, color: s.yield_gap_equiv_kg > 0 ? '#b45309' : '#15803d' }].map((row) => <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#374151', marginBottom: '0.3rem' }}><span>{row.label}</span><strong style={{ color: row.color || SEED_CFG[s.seed_source]?.color || '#374151' }}>{row.value}</strong></div>)}</div>)}</div>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>Productive Seed Equivalent vs Yield Gap</p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.68rem', color: '#94a3b8' }}>Comparison of realized vs unrealized seed productivity (kg)</p>
          <div ref={gapChartRef} style={{ width: '100%', height: 240 }}><ResponsiveContainer><BarChart data={gapChartData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }} barSize={36}><CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f1f5f9' /><XAxis dataKey='name' axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v} kg`} width={58} /><Tooltip formatter={(v, name) => [`${fmtNum(v, 1)} kg`, name]} cursor={{ fill: '#f8fafc' }} /><Bar dataKey='prod' name='Productive Equivalent' fill='#15803d' radius={[6, 6, 0, 0]} /><Bar dataKey='gap' name='Yield Gap' fill='#fbbf24' radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}><p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>Seed Productivity Analytics Table</p><p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#94a3b8' }}>Per-farmer breakdown — sorted by highest yield gap</p></div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}><thead><tr style={{ backgroundColor: '#f8fafc' }}>{['Farmer', 'Seed Type', 'Seed Dist.', 'Prod. Equiv.', 'Yield Gap', 'Yield %', 'Status'].map((h) => <th key={h} style={{ padding: '0.625rem 0.875rem', fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', textAlign: h === 'Farmer' || h === 'Seed Type' || h === 'Status' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead><tbody>{seedProd.length === 0 ? <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No seed productivity data available.</td></tr> : seedProd.map((row, idx) => <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}><td style={{ padding: '0.7rem 0.875rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f3f4f6' }}>{row.farmer_name}</td><td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}><span style={{ backgroundColor: SEED_CFG[row.seed_source]?.bg || 'white', color: SEED_CFG[row.seed_source]?.color || '#374151', border: `1px solid ${SEED_CFG[row.seed_source]?.border || '#e2e8f0'}`, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700 }}>{SEED_CFG[row.seed_source]?.label || row.seed_label}</span></td><td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.seed_distributed_kg, 1)} kg</td><td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#15803d', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.prod_seed_equiv_kg, 1)} kg</td><td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 700, color: row.yield_gap_equiv_kg > 0 ? '#b45309' : '#15803d', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.yield_gap_equiv_kg, 1)} kg</td><td style={{ padding: '0.7rem 0.875rem', textAlign: 'right', fontWeight: 800, color: TIER_COLORS[row.tier]?.color || '#94a3b8', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(row.utilization_pct, 1)}%</td><td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}><TierBadge tier={row.tier} /></td></tr>)}</tbody></table></div>
        </div>
      </div>}
      {activeTab === 'crop' && <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>{[{ label: 'Total Monitored', value: cropPhase.total_monitored || 0, color: '#0f172a' }, { label: 'Delayed', value: cropPhase.delayed_count || 0, color: '#b45309', bg: '#fefce8', border: '#fde68a' }, { label: 'Damaged', value: cropPhase.damaged_count || 0, color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' }].map((m) => <div key={m.label} style={{ backgroundColor: m.bg || 'white', borderRadius: '1rem', padding: '1rem', border: `1px solid ${m.border || '#e2e8f0'}`, textAlign: 'center' }}><p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</p><p style={{ margin: '0.3rem 0 0', fontSize: '0.65rem', fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</p></div>)}</div>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}><p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>Crop Phase Breakdown</p><p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#94a3b8' }}>From AT monitoring records for this barangay</p></div>
          <div style={{ padding: '1rem 1.25rem' }}>{Object.entries(cropPhase.phase_counts || {}).length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>No crop phase data available.</p> : Object.entries(cropPhase.phase_counts || {}).map(([phase, count]) => { const total = cropPhase.total_monitored || 1; const pct = Math.round((count / total) * 100); const PHASE_COLORS = { 'Crop Establishment': '#3B82F6', Tillering: '#22C55E', Flowering: '#A855F7', Ripening: '#FACC15', Harvesting: '#F97316', 'Seed Distribution': '#9CA3AF' }; const color = PHASE_COLORS[phase] || '#64748b'; return <div key={phase} style={{ marginBottom: '0.75rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} /><span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{phase}</span></div><span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{count} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({pct}%)</span></span></div><div style={{ height: 7, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(2, pct)}%`, backgroundColor: color, borderRadius: '999px', transition: 'width 0.5s ease' }} /></div></div>; })}</div>
        </div>
      </div>}
      {activeTab === 'insights' && <div style={{ padding: '0 1.25rem' }}><div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}><p style={{ margin: '0 0 0.875rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Auto-generated Insights</p>{insights.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No insights available yet. Encode harvest records to generate insights.</p> : insights.map((ins, i) => <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.85rem', color: '#374151', lineHeight: 1.6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#1a4d1a', display: 'inline-block', marginTop: '0.45rem', flexShrink: 0 }} /><span>{ins}</span></div>)}</div></div>}
    </div>
  );
};

export default BrgyReports;