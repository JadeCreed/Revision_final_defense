// src/pages/brgy/BrgyReports.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';

import {
  BarChart3, Users, Layers, TrendingUp, Target,
  Download, ChevronDown, X, Loader2,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import API, { getGisAllPolls } from '../../api/axios';

// ── Constants ────────────────────────────────────────────────
const SEED_CFG = {
  HYBRID:   { label: 'Hybrid',    color: '#1a4d1a', bg: '#f0fdf4', border: '#bbf7d0' },
  INBRED:   { label: 'Certified', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  OWN_SEED: { label: 'Own Seed',  color: '#b45309', bg: '#fefce8', border: '#fde68a' },
};
const TIER_COLORS = {
  'Exceeded Target': '#166534',
  'Achieved Target': '#15803d',
  'Near Target':     '#0369a1',
  'Below Target':    '#b45309',
  'Critical':        '#b91c1c',
};
const PHASE_DISPLAY = {
  DISTRIBUTION: 'Seed Distribution', ESTABLISHMENT: 'Crop Establishment',
  TILLERING: 'Tillering',            FLOWERING: 'Flowering',
  RIPENING: 'Ripening',              HARVESTING: 'Harvesting',
};
const PHASE_COLORS = {
  DISTRIBUTION: '#9ca3af', ESTABLISHMENT: '#3b82f6',
  TILLERING: '#22c55e',    FLOWERING: '#a855f7',
  RIPENING: '#facc15',     HARVESTING: '#f97316',
};

const fmtNum = (n, d = 2) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

// ── Sub-components ───────────────────────────────────────────
const TierBadge = ({ tier }) => {
  const color = TIER_COLORS[tier] || '#94a3b8';
  return (
    <span style={{
      backgroundColor: `${color}18`, color, border: `1px solid ${color}40`,
      borderRadius: 999, padding: '2px 8px', fontSize: '0.62rem', fontWeight: 700,
    }}>{tier || 'N/A'}</span>
  );
};

const Tile = ({ icon: Icon, label, value, sub, color }) => (
  <div style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem 1rem', border: '1px solid #e2e8f0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
      <Icon size={13} color={color || '#94a3b8'} />
      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
    <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: color || '#0f172a', lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ margin: '0.2rem 0 0', fontSize: '0.65rem', color: '#64748b' }}>{sub}</p>}
  </div>
);

const SectionCard = ({ title, sub, children, style = {} }) => (
  <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', ...style }}>
    <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{title}</p>
      {sub && <p style={{ margin: '0.15rem 0 0', fontSize: '0.67rem', color: '#94a3b8' }}>{sub}</p>}
    </div>
    <div style={{ padding: '1rem 1.25rem' }}>{children}</div>
  </div>
);

// ── Export Modal ──────────────────────────────────────────────
const ExportModal = ({ polls, onClose, onExport, exporting, barangay }) => {
  const seasons     = [...new Set(polls.map(p => p.season))];
  const [season, setSeason] = useState(polls.find(p => p.is_active)?.season || seasons[0] || 'WET');
  const years       = [...new Set(polls.filter(p => p.season === season).map(p => p.year))].sort((a, b) => b - a);
  const [year, setYear] = useState(
    polls.find(p => p.is_active && p.season === season)?.year || years[0] || new Date().getFullYear()
  );

  const selectedPoll = polls.find(p => p.season === season && p.year === year);
  const seasonLabel  = season === 'WET' ? 'Wet Season' : 'Dry Season';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.75rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Export PDF Report</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Brgy. {barangay} — Choose season</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Season</label>
            <div style={{ position: 'relative' }}>
              <select value={season} onChange={e => { setSeason(e.target.value); }} style={{ width: '100%', padding: '0.55rem 1.75rem 0.55rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.85rem', outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                {seasons.map(s => <option key={s} value={s}>{s === 'WET' ? 'Wet Season' : 'Dry Season'}</option>)}
              </select>
              <ChevronDown size={13} color="#9ca3af" style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Year</label>
            <div style={{ position: 'relative' }}>
              <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: '100%', padding: '0.55rem 1.75rem 0.55rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.85rem', outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown size={13} color="#9ca3af" style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#166534' }}>
          <strong>{seasonLabel} {year}</strong> · Brgy. {barangay}
          {!selectedPoll && <span style={{ color: '#b45309', marginLeft: '0.5rem' }}>⚠ No poll found for this selection</span>}
        </div>

        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.65rem', border: '1.5px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, color: '#374151' }}>Cancel</button>
          <button
            onClick={() => onExport(selectedPoll?.poll_id)}
            disabled={exporting || !selectedPoll}
            style={{ flex: 2, padding: '0.65rem', border: 'none', borderRadius: '0.75rem', background: exporting || !selectedPoll ? '#d1d5db' : '#1a4d1a', color: 'white', cursor: exporting || !selectedPoll ? 'not-allowed' : 'pointer', fontSize: '0.83rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            {exporting ? <><Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> Generating...</> : <><Download size={14} /> Export PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────
const BrgyReports = () => {
  const [polls,          setPolls]          = useState([]);
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [reportData,     setReportData]     = useState(null);
  const [exportReportData, setExportReportData] = useState(null); // ── BAGONG STATE PARA SA EXPORT ISOLATION ──
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState('overview');
  const [showExport,     setShowExport]     = useState(false);
  const [exporting,      setExporting]      = useState(false);
  const [toast,          setToast]          = useState(null);

  // ── Chart refs para sa html2canvas offscreen capture ──
  const prodChartRef      = useRef(null);
  const achieveChartRef   = useRef(null);
  const harvestDonutRef   = useRef(null);
  const phaseDonutRef     = useRef(null);
  const phaseBreakRef     = useRef(null);

  const pushToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load polls
  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const res  = await getGisAllPolls();
        const list = Array.isArray(res.data) ? res.data : [];
        setPolls(list);
        const active = list.find(p => p.is_active) || list[0];
        if (active) setSelectedPollId(active.poll_id);
      } catch {
        pushToast('Failed to load seasons.', 'error');
      }
    };
    fetchPolls();
  }, []);

  // Load report
  const loadReport = useCallback(async () => {
    if (!selectedPollId) return;
    setLoading(true);
    try {
      const res = await API.get('/production/brgy-report/', { params: { poll_id: selectedPollId } });
      setReportData(res.data);
    } catch {
      pushToast('Failed to load report data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedPollId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  // Season / Year picker for main view
  const selectedPoll   = polls.find(p => p.poll_id === selectedPollId);
  const viewSeasons    = [...new Set(polls.map(p => p.season))];
  const viewYears      = [...new Set(polls.filter(p => p.season === selectedPoll?.season).map(p => p.year))].sort((a, b) => b - a);

  const handleSeasonChange = e => {
    const match = polls.find(p => p.season === e.target.value);
    if (match) setSelectedPollId(match.poll_id);
  };
  const handleYearChange = e => {
    const match = polls.find(p => p.season === selectedPoll?.season && p.year === Number(e.target.value));
    if (match) setSelectedPollId(match.poll_id);
  };

  // PDF Export
  const handleExport = async (pollId) => {
    setExporting(true);
    try {
      // 1. I-fetch muna ang JSON data para sa target season na ie-export
      const res = await API.get('/production/brgy-report/', { params: { poll_id: pollId } });
      setExportReportData(res.data); // Itabi sa isolated export state

      // 2. Bigyan ng sapat na oras ang React offscreen container na ma-update ang state at Recharts
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 800);
          });
        });
      });

      const captureChart = async (ref) => {
        if (!ref?.current) return '';
        try {
          const canvas = await html2canvas(ref.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true,
          });
          return canvas.toDataURL('image/png').split(',')[1];
        } catch (err) {
          console.error('Chart capture failed:', err);
          return '';
        }
      };

      // 3. Kumuha ng base64 screenshots mula sa offscreen references (na may tamang isolated data na ngayon)
      const prodImg       = await captureChart(prodChartRef);
      const achieveImg    = await captureChart(achieveChartRef);
      const harvestImg    = await captureChart(harvestDonutRef);
      const phaseDonutImg = await captureChart(phaseDonutRef);
      const phaseBreakImg = await captureChart(phaseBreakRef);

      const response = await API.post(
        '/production/brgy-report/pdf/',
        {
          poll_id: pollId,
          charts: {
            production:    prodImg,
            yield_achieve: achieveImg,
            harvest_donut: harvestImg,
            phase_donut:   phaseDonutImg,
            phase_break:   phaseBreakImg,
          },
        },
        { responseType: 'blob' }
      );

      // 4. Clean up export data pagkatapos mag-export
      setExportReportData(null);

      const contentType = response.headers?.['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text  = await response.data.text();
        const payload = JSON.parse(text);
        console.error('PDF error detail:', payload);
        pushToast(payload.error || 'PDF export failed.', 'error');
        return;
      }

      const url  = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href  = url;
      const poll  = polls.find(p => p.poll_id === pollId);
      const slug  = poll ? `${poll.season === 'DRY' ? 'DrySeason' : 'WetSeason'}${poll.year}` : '';
      link.download = `BrgyReport_${reportData?.barangay || 'Brgy'}_${slug}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      setShowExport(false);
      pushToast('PDF exported successfully!');
    } catch (err) {
      setExportReportData(null); // Clean up sa catch block
      if (err?.response?.data instanceof Blob) {
        try {
          const text  = await err.response.data.text();
          const payload = JSON.parse(text);
          pushToast(payload.error || 'PDF export failed.', 'error');
        } catch {
          pushToast('PDF export failed.', 'error');
        }
      } else {
        pushToast(err?.message || 'PDF export failed.', 'error');
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────
  const summary     = reportData?.summary || {};
  const bySeed      = reportData?.by_seed_type || [];
  const harvestPerf = reportData?.harvest_performance || [];
  const cropPhase   = reportData?.crop_phase_summary || {};
  const insights    = reportData?.insights || [];
  const pollInfo    = reportData?.poll_info || {}; // ── INILAGAY muli ang nawawalang pollInfo declaration ──
  const barangay    = reportData?.barangay || '';
  const seasonLabel = pollInfo.season_display ? `${pollInfo.season_display} ${pollInfo.year}` : 'All Seasons';

  // ── Derived data para sa Offscreen Charts (Awtomatikong lumilipat sa exportReportData kapag nag-e-export) ──
  const activeReportData = exportReportData || reportData || {};
  const activeBySeed      = activeReportData.by_seed_type || [];
  const activeCropPhase   = activeReportData.crop_phase_summary || {};

  
  
  
  // Chart data (Gamit ang activeBySeed at activeCropPhase para sa tamang synchronization)
  
  
  const prodChartData = activeBySeed.filter(s => s.farmer_count > 0).map(s => ({
    name: SEED_CFG[s.seed_source]?.label || s.label,
    mt: s.total_mt,
    color: SEED_CFG[s.seed_source]?.color || '#64748b',
  }));
  const achieveChartData = activeBySeed.filter(s => s.farmer_count > 0 && s.avg_util_pct != null).map(s => ({
    name: SEED_CFG[s.seed_source]?.label || s.label,
    pct: s.avg_util_pct,
    color: SEED_CFG[s.seed_source]?.color || '#64748b',
  }));
  const phaseDonutData = Object.entries(activeCropPhase.phase_counts || {}).map(([ph, cnt]) => ({
    name: PHASE_DISPLAY[ph] || ph,
    value: cnt,
    color: PHASE_COLORS[ph] || '#64748b',
  }));
  const harvestDonutData = [
    { name: 'Expected', value: activeBySeed.reduce((s, b) => s + (b.expected_kg || 0), 0), color: '#94a3b8' },
    { name: 'Actual',   value: activeBySeed.reduce((s, b) => s + (b.actual_kg || 0), 0),   color: '#1a4d1a' },
  ].filter(d => d.value > 0);



  const SELECT = { padding: '0.4rem 1.75rem 0.4rem 0.7rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.78rem', outline: 'none', backgroundColor: 'white', appearance: 'none', cursor: 'pointer' };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading report data...</span>
    </div>
  );

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, backgroundColor: toast.type === 'error' ? '#991b1b' : '#1a4d1a', color: 'white', padding: '0.75rem 1.25rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          polls={polls}
          onClose={() => setShowExport(false)}
          onExport={handleExport}
          exporting={exporting}
          barangay={barangay}
        />
      )}

      {/* ── HIGHLY SECURE OFFSCREEN PRINT CONTAINER FOR EXPORT ── */}
      {/* Naka-scope ito offscreen at opacity: 0.01 pero pasok sa layout flow para makakuha ng tamang dimensional width measurement ang Recharts */}
      {/* ── HIGHLY SECURE OFFSCREEN PRINT CONTAINER FOR EXPORT ── */}
      {/* Naka-scope ito offscreen at opacity: 0.01 pero pasok sa layout flow para makakuha ng tamang dimensional width measurement ang Recharts */}
      <div style={{ position: 'fixed', left: 0, top: 0, width: '600px', background: '#ffffff', zIndex: -1, opacity: 0.01, pointerEvents: 'none' }}>
        <div ref={prodChartRef} style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Production by Seed Type (MT)</h4>
          <BarChart width={560} height={200} data={prodChartData} barSize={40} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => `${v} MT`} width={45} />
            <Bar dataKey="mt" isAnimationActive={false}>
              {prodChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </div>

        <div ref={achieveChartRef} style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Yield Achievement by Seed Type (%)</h4>
          <BarChart width={560} height={200} data={achieveChartData} barSize={40} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} width={40} />
            <Bar dataKey="pct" isAnimationActive={false}>
              {achieveChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </div>

        <div ref={harvestDonutRef} style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Expected vs Actual Harvest Comparison</h4>
          <PieChart width={560} height={200}>
            <Pie data={harvestDonutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value" isAnimationActive={false}>
              {harvestDonutData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
          </PieChart>
        </div>

        <div ref={phaseDonutRef} style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Phase Distribution</h4>
          <PieChart width={560} height={200}>
            <Pie data={phaseDonutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" isAnimationActive={false}>
              {phaseDonutData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '9px' }} />
          </PieChart>
        </div>

        <div ref={phaseBreakRef} style={{ padding: '20px', width: '560px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Phase Breakdown</h4>
          {Object.entries(activeCropPhase.phase_counts || {}).map(([ph, cnt]) => {
            const total = activeCropPhase.total_monitored || 1;
            const pct   = Math.round(cnt / total * 100);
            const color = PHASE_COLORS[ph] || '#64748b';
            return (
              <div key={ph} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '11px' }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{PHASE_DISPLAY[ph] || ph}</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{cnt} ({pct}%)</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px' }}>
                  <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, backgroundColor: color, borderRadius: '3px' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>


      

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ padding: '1.25rem 1.25rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Barangay Reports</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>Agricultural analytics for Brgy. {barangay}</p>
          </div>
          <button onClick={() => setShowExport(true)} style={{ padding: '0.625rem 1.25rem', backgroundColor: '#1a4d1a', color: 'white', border: 'none', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={14} /> Export PDF
          </button>
        </div>

        {/* Season filter */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <select value={selectedPoll?.season || ''} onChange={handleSeasonChange} style={SELECT}>
              {viewSeasons.map(s => <option key={s} value={s}>{s === 'WET' ? 'Wet Season' : 'Dry Season'}</option>)}
            </select>
            <ChevronDown size={12} color="#9ca3af" style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <select value={selectedPoll?.year || ''} onChange={handleYearChange} style={SELECT}>
              {viewYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={12} color="#9ca3af" style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          <span style={{ marginLeft: 'auto', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 999, padding: '0.3rem 0.875rem', fontSize: '0.75rem', fontWeight: 700 }}>{seasonLabel}</span>
        </div>

        {/* KPI Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.625rem', marginBottom: '1rem' }}>
          <Tile icon={Users}    label="Farmers Harvested"  value={summary.total_farmers || 0}                                                          color="#0f172a" />
          <Tile icon={BarChart3} label="Beneficiaries"      value={summary.total_beneficiaries || 0}   sub="Seed recipients"                             color="#166534" />
          <Tile icon={Layers}   label="Bags Received"       value={summary.total_dist_bags || 0}        sub={`${(summary.total_dist_kg || 0).toLocaleString('en-PH')} kg`} color="#7c3aed" />
          <Tile icon={Layers}   label="Area Harvested"      value={`${fmtNum(summary.total_area_ha)} ha`}                                                color="#2563eb" />
          <Tile icon={TrendingUp} label="Total Production"  value={`${fmtNum(summary.total_production_mt)} MT`}                                          color="#0369a1" />
          <Tile icon={Target}   label="Achievement Rate"    value={summary.avg_util_pct != null ? `${fmtNum(summary.avg_util_pct, 1)}%` : '—'} sub={summary.overall_tier || ''} color={TIER_COLORS[summary.overall_tier] || '#94a3b8'} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.875rem', padding: '0.2rem', gap: '0.2rem', width: 'fit-content', marginBottom: '1.25rem' }}>
          {[
            { key: 'overview',  label: 'Overview' },
            { key: 'harvest',   label: 'Harvest' },
            { key: 'crop',      label: 'Crop Phase' },
            { key: 'insights',  label: 'Insights' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '0.4rem 0.9rem', borderRadius: '0.55rem', border: 'none', backgroundColor: activeTab === t.key ? 'white' : 'transparent', color: activeTab === t.key ? '#1a4d1a' : '#64748b', fontWeight: activeTab === t.key ? 700 : 500, fontSize: '0.78rem', cursor: 'pointer', boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,.1)' : 'none', transition: 'all .15s' }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── TAB: OVERVIEW ──────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Bags breakdown */}
          <SectionCard title="Seed Distribution Summary" sub="Bags and kg received per seed program this season">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.75rem' }}>
              {[
                { src: 'HYBRID', bags: summary.hybrid_bags, kg: summary.hybrid_kg },
                { src: 'INBRED', bags: summary.inbred_bags, kg: summary.inbred_kg },
              ].map(({ src, bags, kg }) => {
                const cfg = SEED_CFG[src];
                return (
                  <div key={src} style={{ backgroundColor: cfg.bg, borderRadius: '0.875rem', padding: '1rem', border: `1px solid ${cfg.border}` }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.68rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase' }}>{cfg.label}</p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{bags || 0}</p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#64748b' }}>bags · {(kg || 0).toLocaleString('en-PH')} kg</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Production charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1rem' }}>
            <SectionCard title="Production by Seed Type (MT)" sub="Total harvest output per seed program">
              {prodChartData.length === 0
                ? <p style={{ color: '#94a3b8', fontSize: '0.83rem', textAlign: 'center', padding: '1.5rem 0' }}>No harvest data yet.</p>
                : <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={prodChartData} barSize={48} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v} MT`} width={50} />
                      <Tooltip formatter={v => [`${fmtNum(v)} MT`, 'Production']} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="mt" radius={[7, 7, 0, 0]}>
                        {prodChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>}
            </SectionCard>
            <SectionCard title="Yield Achievement by Seed Type (%)" sub="Achievement rate vs DA target yield">
              {achieveChartData.length === 0
                ? <p style={{ color: '#94a3b8', fontSize: '0.83rem', textAlign: 'center', padding: '1.5rem 0' }}>No harvest data yet.</p>
                : <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={achieveChartData} barSize={48} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} width={44} />
                      <Tooltip formatter={v => [`${fmtNum(v, 1)}%`, 'Achievement']} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="pct" radius={[7, 7, 0, 0]}>
                        {achieveChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>}
            </SectionCard>
          </div>

          {/* Harvest donut + Seed analytics table */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1rem' }}>
            <SectionCard title="Expected vs Actual Harvest" sub="Distribution of expected vs actual production">
              {harvestDonutData.length === 0
                ? <p style={{ color: '#94a3b8', fontSize: '0.83rem', textAlign: 'center', padding: '1.5rem 0' }}>No data yet.</p>
                : <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={harvestDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                        {harvestDonutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={v => [`${v.toLocaleString('en-PH')} kg`, '']} />
                      <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '0.75rem' }} />
                    </PieChart>
                  </ResponsiveContainer>}
            </SectionCard>
            <SectionCard title="Seed Program Summary" sub="Per seed type breakdown">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      {['Seed', 'Farmers', 'Area', 'Bags/kg', 'Achievement', 'Status'].map(h => (
                        <th key={h} style={{ padding: '0.5rem 0.625rem', fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bySeed.filter(s => s.farmer_count > 0).map((s, idx) => {
                      const cfg = SEED_CFG[s.seed_source];
                      return (
                        <tr key={s.seed_source} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '0.6rem 0.625rem', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ backgroundColor: cfg?.bg, color: cfg?.color, border: `1px solid ${cfg?.border}`, borderRadius: 999, padding: '1px 7px', fontSize: '0.62rem', fontWeight: 700 }}>{cfg?.label || s.label}</span>
                          </td>
                          <td style={{ padding: '0.6rem 0.625rem', borderBottom: '1px solid #f3f4f6' }}>{s.farmer_count}</td>
                          <td style={{ padding: '0.6rem 0.625rem', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(s.total_area_ha)} ha</td>
                          <td style={{ padding: '0.6rem 0.625rem', borderBottom: '1px solid #f3f4f6' }}>{s.seed_bags_received} bags<br /><span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{(s.seed_kg_received || 0).toLocaleString('en-PH')} kg</span></td>
                          <td style={{ padding: '0.6rem 0.625rem', fontWeight: 800, color: TIER_COLORS[s.tier] || '#94a3b8', borderBottom: '1px solid #f3f4f6' }}>{s.avg_util_pct != null ? `${fmtNum(s.avg_util_pct, 1)}%` : '—'}</td>
                          <td style={{ padding: '0.6rem 0.625rem', borderBottom: '1px solid #f3f4f6' }}><TierBadge tier={s.tier} /></td>
                        </tr>
                      );
                    })}
                    {bySeed.filter(s => s.farmer_count > 0).length === 0 && (
                      <tr><td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.83rem' }}>No harvest data yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── TAB: HARVEST ───────────────────────────────────── */}
      {activeTab === 'harvest' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionCard title="Harvest Performance — Expected vs Actual" sub="Per farmer comparison of expected yield (DA standard) vs actual harvest">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Farmer', 'Seed Type', 'Area (ha)', 'Expected (kg)', 'Actual (kg)', 'Achievement', 'Status'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.875rem', fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {harvestPerf.length === 0
                    ? <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.83rem' }}>No harvest records encoded yet.</td></tr>
                    : harvestPerf.map((p, idx) => {
                        const cfg = SEED_CFG[p.seed_source];
                        const tierColor = TIER_COLORS[p.tier] || '#94a3b8';
                        return (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '0.7rem 0.875rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f3f4f6' }}>{p.farmer_name}</td>
                            <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>
                              <span style={{ backgroundColor: cfg?.bg, color: cfg?.color, border: `1px solid ${cfg?.border}`, borderRadius: 999, padding: '1px 7px', fontSize: '0.62rem', fontWeight: 700 }}>{cfg?.label || p.seed_label}</span>
                            </td>
                            <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(p.area_ha)}</td>
                            <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}>{fmtNum(p.expected_kg, 0)}</td>
                            <td style={{ padding: '0.7rem 0.875rem', fontWeight: 700, borderBottom: '1px solid #f3f4f6' }}>{fmtNum(p.actual_kg, 0)}</td>
                            <td style={{ padding: '0.7rem 0.875rem', fontWeight: 800, color: tierColor, borderBottom: '1px solid #f3f4f6' }}>{p.utilization_pct != null ? `${fmtNum(p.utilization_pct, 1)}%` : '—'}</td>
                            <td style={{ padding: '0.7rem 0.875rem', borderBottom: '1px solid #f3f4f6' }}><TierBadge tier={p.tier} /></td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── TAB: CROP PHASE ────────────────────────────────── */}
      {activeTab === 'crop' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '0.625rem' }}>
            {[
              { label: 'Total Monitored', value: cropPhase.total_monitored || 0, color: '#0f172a', bg: 'white', border: '#e2e8f0' },
              { label: 'Delayed',  value: cropPhase.delayed_count  || 0, color: '#b45309', bg: '#fefce8', border: '#fde68a' },
              { label: 'Damaged',  value: cropPhase.damaged_count  || 0, color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
            ].map(m => (
              <div key={m.label} style={{ backgroundColor: m.bg, borderRadius: '1rem', padding: '1rem', border: `1px solid ${m.border}`, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</p>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.65rem', fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1rem' }}>
            <SectionCard title="Phase Distribution" sub="Crop phase breakdown from AT monitoring records">
              {phaseDonutData.length === 0
                ? <p style={{ color: '#94a3b8', fontSize: '0.83rem', textAlign: 'center', padding: '1.5rem 0' }}>No monitoring data yet.</p>
                : <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie data={phaseDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {phaseDonutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [`${v} farmers`, n]} />
                      <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '0.72rem' }} />
                    </PieChart>
                  </ResponsiveContainer>}
            </SectionCard>
            <SectionCard title="Phase Breakdown" sub="Farmer count per crop stage">
              {Object.entries(cropPhase.phase_counts || {}).length === 0
                ? <p style={{ color: '#94a3b8', fontSize: '0.83rem', textAlign: 'center', padding: '1.5rem 0' }}>No monitoring data.</p>
                : Object.entries(cropPhase.phase_counts || {}).map(([ph, cnt]) => {
                    const total = cropPhase.total_monitored || 1;
                    const pct   = Math.round(cnt / total * 100);
                    const color = PHASE_COLORS[ph] || '#64748b';
                    return (
                      <div key={ph} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{PHASE_DISPLAY[ph] || ph}</span>
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{cnt} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({pct}%)</span></span>
                        </div>
                        <div style={{ height: 7, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, backgroundColor: color, borderRadius: 999, transition: 'width .5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── TAB: INSIGHTS ──────────────────────────────────── */}
      {activeTab === 'insights' && (
        <div style={{ padding: '0 1.25rem' }}>
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
            <p style={{ margin: '0 0 0.875rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Auto-generated Insights</p>
            {insights.length === 0
              ? <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Encode harvest records to generate insights.</p>
              : insights.map((ins, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginBottom: '0.6rem' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#1a4d1a', display: 'inline-block', marginTop: '0.45rem', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.6 }}>{ins}</span>
                  </div>
                ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrgyReports;