// src/pages/admin/ReportsAnalytics.jsx
import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  Download, RefreshCw, Printer, FileText, CheckCircle2,
  Layers, TrendingUp, Target, Tractor, Wheat, Info, AlertTriangle, AlertCircle, Eye
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  getReportFilterOptions, 
  getMonthlyAnalytics, 
  downloadMonthlyAnalyticsPDF 
} from '../../api/axios';

const GREEN = {
  primary: '#1a4d1a',
  light: '#f0fdf4',
  border: '#bbf7d0',
  accent: '#166534',
  soft: '#dcfce7',
};

const SEED_CFG = {
  HYBRID:   { label: 'Hybrid',    color: '#1a4d1a', bg: '#f0fdf4', border: '#bbf7d0' },
  INBRED:   { label: 'Certified', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  OWN_SEED: { label: 'Own Seed',  color: '#b45309', bg: '#fefce8', border: '#fde68a' },
};

const PHASE_COLORS = {
  'Seed Distribution': '#64748b',
  'Crop Establishment': '#3b82f6',
  'Tillering': '#22c55e',
  'Flowering': '#a855f7',
  'Ripening': '#eab308',
  'Harvesting': '#f97316',
};

export default function ReportsAnalytics() {
  const [filterOptions, setFilterOptions] = useState({ seasons: [], years: [], barangays: [] });
  const [season, setSeason] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [barangay, setBarangay] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Chart Capture References para sa PDF Export (Offscreen Refs)
  const distChartRef = useRef(null);
  const phaseDonutRef = useRef(null);
  const harvestChartRef = useRef(null);

  // Dynamic list of months based on the selected season
  const getAvailableMonths = (selectedSeason, selectedYear) => {
    const yrInt = selectedYear ? parseInt(selectedYear) : new Date().getFullYear();

    if (selectedSeason === 'DRY') {
      return [
        { value: '11', label: `November ${yrInt - 1}` },
        { value: '12', label: `December ${yrInt - 1}` },
        { value: '1', label: `January ${yrInt}` },
        { value: '2', label: `February ${yrInt}` },
        { value: '3', label: `March ${yrInt}` },
        { value: '4', label: `April ${yrInt}` },
        { value: '5', label: `May ${yrInt}` },
      ];
    } else if (selectedSeason === 'WET') {
      return [
        { value: '6', label: `June ${yrInt}` },
        { value: '7', label: `July ${yrInt}` },
        { value: '8', label: `August ${yrInt}` },
        { value: '9', label: `September ${yrInt}` },
        { value: '10', label: `October ${yrInt}` },
      ];
    }

    return [
      { value: '1', label: 'January' },
      { value: '2', label: 'February' },
      { value: '3', label: 'March' },
      { value: '4', label: 'April' },
      { value: '5', label: 'May' },
      { value: '6', label: 'June' },
      { value: '7', label: 'July' },
      { value: '8', label: 'August' },
      { value: '9', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' },
    ];
  };

  const availableMonths = getAvailableMonths(season, year);

  // Auto-reset month filter kung hindi ito kasama sa bagong piniling season
  useEffect(() => {
    if (season && month) {
      const validValues = availableMonths.map(m => m.value);
      if (!validValues.includes(month)) {
        setMonth('');
      }
    }
  }, [season, year, month]);

  // Gagamit ng ref para i-track ang huling buwan na pinili ng user
  const lastProcessedMonthRef = useRef('');

  // Awtomatikong nililipat ang Active Tab batay sa piniling yugto ng crop cycle
  useEffect(() => {
    if (month === lastProcessedMonthRef.current) return;
    lastProcessedMonthRef.current = month;

    if (!month) {
      setActiveTab('overview');
      return;
    }
    const mVal = parseInt(month);
    if (season === 'WET') {
      if ([6, 7].includes(mVal)) {
        setActiveTab('overview'); // Seed Distribution Phase
      } else if ([8, 9].includes(mVal)) {
        setActiveTab('phases');   // Active Growth Phase
      } else if (mVal === 10) {
        setActiveTab('harvest');  // Harvesting Phase
      }
    } else {
      if ([11, 12].includes(mVal)) {
        setActiveTab('overview'); // Seed Distribution Phase
      } else if ([1, 2, 3].includes(mVal)) {
        setActiveTab('phases');   // Active Growth Phase
      } else if ([4, 5].includes(mVal)) {
        setActiveTab('harvest');  // Harvesting Phase
      }
    }
  }, [month, season]);

  const loadFilters = async () => {
    try {
      const res = await getReportFilterOptions();
      setFilterOptions(res.data);
      if (res.data.current_season) setSeason(res.data.current_season);
      if (res.data.current_year) setYear(String(res.data.current_year));
    } catch (err) {
      console.error("Failed to load filter configurations", err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await getMonthlyAnalytics({ season, year, month, barangay });
      setData(res.data);
    } catch (err) {
      console.error("Failed to retrieve dashboard analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if (season && year) {
      fetchAnalytics();
    }
  }, [season, year, month, barangay]);

  // Capture Recharts graphs offscreen para i-embed bilang krisp na imahe sa PDF
  const handleExportPDF = async () => {
    setDownloading(true);
    try {
      const captureChart = async (ref) => {
        if (!ref?.current) return '';
        try {
          const canvas = await html2canvas(ref.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
          });
          return canvas.toDataURL('image/png').split(',')[1];
        } catch {
          return '';
        }
      };

      // ── CRITICAL: Kukunin ang base64 mula sa OFFSCREEN references para sa tatlong tsart ──
      const distImg = await captureChart(distChartRef);
      const phaseDonutImg = await captureChart(phaseDonutRef);
      const harvestImg = await captureChart(harvestChartRef);

      const res = await downloadMonthlyAnalyticsPDF({ 
        season, year, month, barangay,
        charts: {
          dist_chart: distImg,
          phase_donut: phaseDonutImg,
          harvest_yield: harvestImg
        }
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Monthly_Report_${season}_${year}_${month || 'All'}.pdf`;
      link.click();
    } catch (err) {
      alert("Failed to export PDF report.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Kumuha ng tumpak na operational phase details para sa cycle banner
  const getCycleStageInfo = () => {
    if (!month) {
      return {
        label: 'Seasonal Rice Crop Cycle Progress Report',
        color: GREEN.accent,
        icon: Tractor,
        desc: 'Showing consolidated overview across all growth stages and programs.',
      };
    }
    const mVal = parseInt(month);
    if (season === 'WET') {
      if ([6, 7].includes(mVal)) return { label: 'Seed Distribution & Establishment Stage', color: '#1e40af', icon: Layers, desc: 'Day 1-5 concentrated seed logistics and initial crop establishment monitoring.' };
      if ([8, 9].includes(mVal)) return { label: 'Vegetative & Growth Monitoring Stage', color: '#7c3aed', icon: Tractor, desc: 'Tillering, Flowering, and Ripening crop progress under evaluation by AT.' };
      return { label: 'Harvesting & Yield Encoding Stage', color: '#b45309', icon: Wheat, desc: 'Actual production output (MT) is recorded once harvesting monitoring completes.' };
    } else {
      if ([11, 12].includes(mVal)) return { label: 'Seed Distribution & Establishment Stage', color: '#1e40af', icon: Layers, desc: 'Day 1-5 concentrated seed logistics and initial crop establishment monitoring.' };
      if ([1, 2, 3].includes(mVal)) return { label: 'Vegetative & Growth Monitoring Stage', color: '#7c3aed', icon: Tractor, desc: 'Tillering, Flowering, and Ripening crop progress under evaluation by AT.' };
      return { label: 'Harvesting & Yield Encoding Stage', color: '#b45309', icon: Wheat, desc: 'Actual production output (MT) is recorded once harvesting monitoring completes.' };
    }
  };

  const stage = getCycleStageInfo();
  const StageIcon = stage.icon;

  // Chart parsing
  const prodChartData = data?.by_seed_type?.filter(s => s.farmer_count > 0).map(s => ({
    name: SEED_CFG[s.seed_source]?.label || s.label,
    mt: s.total_mt,
    color: SEED_CFG[s.seed_source]?.color || '#64748b',
  })) || [];

  const phaseDonutData = Object.entries(data?.crop_phase_summary?.phase_counts || {}).map(([ph, cnt]) => ({
    name: ph,
    value: cnt,
    color: PHASE_COLORS[ph] || '#64748b',
  })) || [];

  const distChartData = [
    { name: 'Hybrid Seeds', kg: (data?.summary?.hybrid_kg ?? 0), color: '#166534' },
    { name: 'Certified Seeds', kg: (data?.summary?.inbred_kg ?? 0), color: '#1e40af' }
  ];


  // Siguraduhing kung walang harvest data sa piniling buwan, hindi maiiwan ang user sa harvest tab
  useEffect(() => {
    if (data && activeTab === 'harvest' && !(data.summary.total_production_mt > 0)) {
      setActiveTab('overview');
    }
  }, [data, activeTab]);


  return (
    <div style={{ maxWidth: '1200px', paddingBottom: '3rem' }}>
      {/* ── HIGHLY SECURE OFFSCREEN PRINT CONTAINER FOR EXPORT ── */}
      {/* Ginagamit para makuha ang base64 screenshots ng TATLONG tsart nang sabay kahit anong Tab ang active */}
      <div style={{ position: 'fixed', left: 0, top: 0, width: '600px', background: '#ffffff', zIndex: -1, opacity: 0.01, pointerEvents: 'none' }}>
        <div ref={distChartRef} style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Seed Program Distribution Summary (kg)</h4>
          <BarChart width={560} height={210} data={distChartData} barSize={40}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => `${v.toLocaleString()} kg`} />
            <Bar dataKey="kg" radius={[4, 4, 0, 0]}>
              {distChartData.map((d, idx) => (
                <Cell key={idx} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </div>

        <div ref={phaseDonutRef} style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Farms in Phase Stages</h4>
          {phaseDonutData.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '11px' }}>No phase records logged for this month</p>
          ) : (
            <PieChart width={560} height={210}>
              <Pie data={phaseDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                {phaseDonutData.map((d, idx) => (
                  <Cell key={idx} fill={d.color} />
                ))}
              </Pie>
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          )}
        </div>

        <div ref={harvestChartRef} style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Harvest Yield Analysis (MT)</h4>
          {prodChartData.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '11px' }}>No harvest yield records found for this period.</p>
          ) : (
            <PieChart width={560} height={210}>
              <Pie data={prodChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="mt">
                {prodChartData.map((d, idx) => (
                  <Cell key={idx} fill={d.color} />
                ))}
              </Pie>
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          )}
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          Reports Analytics
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          Evaluate and extract seasonal and monthly data summaries across all growth phases.
        </p>
      </div>

      {/* Filter Bar */}
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem',
        border: '1px solid #f3f4f6',
      }}>
        <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Season
            </label>
            <select
              value={season}
              onChange={e => setSeason(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', backgroundColor: 'white', minWidth: '140px', color: '#374151' }}>
              <option value="">Select Season</option>
              {filterOptions.seasons.map(s => (
                <option key={s} value={s}>{s === 'WET' ? 'Wet Season' : 'Dry Season'}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Year
            </label>
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', backgroundColor: 'white', minWidth: '120px', color: '#374151' }}>
              <option value="">Select Year</option>
              {filterOptions.years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Month (Optional)
            </label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', backgroundColor: 'white', minWidth: '150px', color: '#374151' }}>
              <option value="">All Months</option>
              {availableMonths.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
              Barangay
            </label>
            <select
              value={barangay}
              onChange={e => setBarangay(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', backgroundColor: 'white', minWidth: '160px', color: '#374151' }}>
              <option value="">All Barangays</option>
              {filterOptions.barangays.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.625rem', marginLeft: 'auto' }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '0.5625rem 1.125rem', backgroundColor: '#f3f4f6', color: '#374151',
                border: '1.5px solid #d1d5db', borderRadius: '0.625rem', fontWeight: 700, fontSize: '0.875rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem'
              }}>
              <Printer size={14} /> Print
            </button>
            <button
              onClick={handleExportPDF}
              disabled={downloading}
              style={{
                padding: '0.5625rem 1.25rem', backgroundColor: GREEN.primary, color: 'white',
                border: 'none', borderRadius: '0.625rem', fontWeight: 700, fontSize: '0.875rem',
                cursor: downloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem',
                boxShadow: `0 3px 12px ${GREEN.primary}40`
              }}>
              <Download size={14} /> Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Cycle Stage Banner */}
      {data && (
        <div style={{
          display: 'flex', gap: '0.875rem', alignItems: 'center',
          backgroundColor: `${stage.color}15`, border: `1px solid ${stage.color}40`,
          borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem'
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: stage.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <StageIcon size={18} color="white" />
          </div>
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: stage.color, margin: 0 }}>{stage.label}</h4>
            <p style={{ fontSize: '0.8rem', color: '#4b5563', margin: '0.125rem 0 0', lineHeight: 1.45 }}>{stage.desc}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#6b7280' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: GREEN.primary }} />
          Calculating metrics...
        </div>
      ) : data ? (
        <>
          {/* Summary KPIs */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem', marginBottom: '1.5rem'
          }}>
            <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', borderLeft: `4px solid ${GREEN.primary}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Seed Distribution</span>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, color: GREEN.accent, margin: '0.25rem 0' }}>{(data?.summary?.total_dist_bags ?? 0)} bags</p>
              <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{(data?.summary?.total_dist_kg ?? 0).toLocaleString()} kg total distributed</span>
            </div>
            <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', borderLeft: '4px solid #2563eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Farms Monitored</span>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e40af', margin: '0.25rem 0' }}>{(data?.summary?.total_monitored ?? 0)} records</p>
              <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>Active growth monitoring logs</span>
            </div>
            <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', borderLeft: '4px solid #b45309', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Harvest Production</span>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#78350f', margin: '0.25rem 0' }}>{(data?.summary?.total_production_mt ?? 0)} MT</p>
              <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>From {(data?.summary?.total_area_ha ?? 0)} ha harvested</span>
            </div>
            <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.75rem', borderLeft: '4px solid #7c3aed', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Average Yield</span>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#5b21b6', margin: '0.25rem 0' }}>{(data?.summary?.avg_yield_t_ha ?? 0)} t/ha</p>
              <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>Achievement: {(data?.summary?.avg_util_pct ?? '—')}% ({(data?.summary?.overall_tier ?? 'N/A')})</span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '0.875rem', padding: '0.25rem', gap: '0.25rem', width: 'fit-content', marginBottom: '1.5rem' }}>
            {[
              { key: 'overview',  label: 'Overview & Distribution' },
              { key: 'phases',    label: 'Crop Phase Progress' },
              ...((data?.summary?.total_production_mt ?? 0) > 0 ? [{ key: 'harvest', label: 'Harvest & Yield' }] : []),
              { key: 'registry',  label: 'Monthly Action Logs' },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '0.45rem 1.25rem', borderRadius: '0.625rem', border: 'none', backgroundColor: activeTab === t.key ? 'white' : 'transparent', color: activeTab === t.key ? '#1a4d1a' : '#475569', fontWeight: activeTab === t.key ? 800 : 500, fontSize: '0.83rem', cursor: 'pointer', transition: 'all .15s' }}>{t.label}</button>
            ))}
          </div>

          {/* TAB 1 — OVERVIEW & DISTRIBUTION */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {/* Seed program breakdown */}
                <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Production Volume by Program</h3>
                  {prodChartData.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '0.8rem', textAlign: 'center', padding: '2rem' }}>No harvest output recorded for this period</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={prodChartData} barSize={40}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => `${v} MT`} />
                        <Tooltip formatter={v => [`${v} MT`, 'Volume']} />
                        <Bar dataKey="mt" radius={[4, 4, 0, 0]}>
                          {prodChartData.map((d, idx) => (
                            <Cell key={idx} fill={d.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Seed Distribution kg Overview */}
                <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Seed Program Distribution Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                      { label: 'Hybrid Seeds', value: (data?.summary?.hybrid_bags ?? 0), kg: (data?.summary?.hybrid_kg ?? 0), color: '#166534', light: '#dcfce7' },
                      { label: 'Certified (Inbred) Seeds', value: (data?.summary?.inbred_bags ?? 0), kg: (data?.summary?.inbred_kg ?? 0), color: '#1e40af', light: '#dbeafe' }
                    ].map((seed, idx) => (
                      <div key={idx} style={{ backgroundColor: seed.light, borderRadius: '0.75rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: seed.color }}>{seed.label}</span>
                          <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 800, color: seed.color, marginTop: '0.25rem' }}>{seed.value} bags</span>
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: seed.color }}>{(seed.kg ?? 0).toLocaleString()} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Insights Box */}
              <div style={{
                backgroundColor: GREEN.light, border: `1px solid ${GREEN.border}`,
                padding: '1.25rem', borderRadius: '0.75rem'
              }}>
                <h3 style={{ color: GREEN.accent, fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Key Seasonal Insights</h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#374151' }}>
                  {(data?.insights ?? []).map((ins, idx) => (
                    <li key={idx} style={{ marginBottom: '0.25rem' }}>{ins}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2 — CROP PHASE PROGRESS */}
          {activeTab === 'phases' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {/* Pie/Donut Chart */}
              <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Farms in Phase Stages (Pie View)</h3>
                {phaseDonutData.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: '0.8rem', textAlign: 'center', padding: '2rem' }}>No phase records logged for this month</p>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie data={phaseDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                        {phaseDonutData.map((d, idx) => (
                          <Cell key={idx} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => [`${v} farms`, 'Active']} />
                      <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Progress bars phase stage breakdown */}
              <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Farms in Phase Stages (Linear View)</h3>
                {Object.keys(data?.crop_phase_summary?.phase_counts ?? {}).length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>No phase records logged for this month</p>
                ) : (
                  Object.entries(data?.crop_phase_summary?.phase_counts ?? {}).map(([phase, count]) => (
                    <div key={phase} style={{ marginBottom: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        <span>{phase}</span>
                        <span>{count} farms</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          backgroundColor: PHASE_COLORS[phase] || '#7c3aed',
                          width: `${(data?.crop_phase_summary?.total_monitored ?? 0) > 0 ? (count / data.crop_phase_summary.total_monitored) * 100 : 0}%`
                        }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3 — HARVEST & YIELD */}
          {activeTab === 'harvest' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Harvest Yield Analysis</h3>
                <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0 0 1.25rem' }}>Monthly yield outcomes and program-specific MT volumes</p>
                {prodChartData.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '3rem 0' }}>No harvest yield records found for this period.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyRendering: 'center', gap: '0.75rem' }}>
                      {(data?.by_seed_type ?? []).filter(s => s.farmer_count > 0).map(s => {
                        const cfg = SEED_CFG[s.seed_source] || SEED_CFG.HYBRID;
                        return (
                          <div key={s.seed_source} style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', borderLeft: `4px solid ${cfg.color}` }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{cfg.label} Program</span>
                            <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: '0.25rem 0' }}>{s.total_mt} MT</h4>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>From {s.total_area_ha} ha harvested</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ResponsiveContainer width="100%" height={210}>
                        <PieChart>
                          <Pie data={prodChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="mt">
                            {prodChartData.map((d, idx) => (
                              <Cell key={idx} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={v => [`${v} MT`, 'Volume']} />
                          <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4 — REGISTRY LOGS */}
          {activeTab === 'registry' && (
            <div style={{
              backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Monthly Transactions Registry</h3>
              {data.records.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                  No database records match the selected monthly criteria.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 700 }}>Date</th>
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 700 }}>Farmer Name</th>
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 700 }}>Barangay</th>
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 700 }}>Activity Type</th>
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 700 }}>Summary Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.records.slice(0, 15).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '0.5rem 0.875rem', whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString()}</td>
                          <td style={{ padding: '0.5rem 0.875rem', fontWeight: 'bold' }}>{row.farmer_name}</td>
                          <td style={{ padding: '0.5rem 0.875rem' }}>{row.barangay}</td>
                          <td style={{ padding: '0.5rem 0.875rem' }}>
                            <span style={{
                              display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold',
                              backgroundColor: row.type.includes('Distribution') ? GREEN.soft : row.type.includes('Phase') ? '#eedffc' : '#ffedd5',
                              color: row.type.includes('Distribution') ? GREEN.accent : row.type.includes('Phase') ? '#6d28d9' : '#c2410c'
                            }}>{row.type}</span>
                          </td>
                          <td style={{ padding: '0.5rem 0.875rem', color: '#4b5563' }}>{row.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af' }}>
          Select filters above to load the Monthly Reports & Analytics Dashboard.
        </div>
      )}
    </div>
  );
}