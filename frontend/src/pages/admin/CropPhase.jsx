// src/pages/admin/CropPhase.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { getGisPlots, getMapSummary } from '../../api/axios';
import API from '../../api/axios';

const PHASE_COLORS = {
  'Seed Distribution': '#9CA3AF', 'Crop Establishment': '#3B82F6',
  'Tillering': '#22C55E', 'Flowering': '#A855F7',
  'Ripening': '#FACC15', 'Harvesting': '#F97316',
};
const PHASE_ORDER = ['Seed Distribution','Crop Establishment','Tillering','Flowering','Ripening','Harvesting'];
const PHASE_SHORT = {
  'Seed Distribution':'Seed dist.','Crop Establishment':'Establish.',
  'Tillering':'Tillering','Flowering':'Flowering','Ripening':'Ripening','Harvesting':'Harvesting',
};

const normalizePhase = (raw) => {
  if (!raw) return 'Seed Distribution';
  const r = raw.toString().trim();
  if (/^seed[\s_-]*dist/i.test(r) || r === 'DISTRIBUTION') return 'Seed Distribution';
  if (/^crop[\s_-]*est/i.test(r) || r === 'ESTABLISHMENT') return 'Crop Establishment';
  if (r === 'TILLERING' || r === 'Tillering') return 'Tillering';
  if (r === 'FLOWERING' || r === 'Flowering') return 'Flowering';
  if (r === 'RIPENING' || r === 'Ripening') return 'Ripening';
  if (r === 'HARVESTING' || r === 'Harvesting') return 'Harvesting';
  return r;
};

const phaseColor = (k) => PHASE_COLORS[k] || '#9CA3AF';
const fmtNum = (n, d = 0) => n != null && !isNaN(n)
  ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
  : '—';

const TIMELINE_START = new Date('2025-10-01T00:00:00');
const TIMELINE_END   = new Date('2026-03-31T23:59:59');
const TIMELINE_DURATION_MS = TIMELINE_END.getTime() - TIMELINE_START.getTime();
const MONTH_LABELS = (() => {
  const labels = [];
  let current = new Date(TIMELINE_START.getTime());
  current.setDate(1);
  while (current <= TIMELINE_END) {
    labels.push(current.toLocaleDateString('en-US', { month: 'short' }));
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return labels;
})();
const ALL_BARANGAYS = [
  'Abang', 'Aliliw', 'Atulinao', 'Ayuti', 'Igang', 'Kabatete', 'Kakawit', 'Kalangay', 'Kalyaat', 'Kilib',
  'Kulapi', 'Mahabang Parang', 'Malupak', 'Manasa', 'May-It', 'Nagsinamo', 'Nalunao', 'Palola', 'Piis', 'Samil',
  'Tiawe', 'Tinamnan',
];

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const clampDate = (date) => {
  if (!date) return null;
  if (date < TIMELINE_START) return TIMELINE_START;
  if (date > TIMELINE_END) return TIMELINE_END;
  return date;
};

const dateToTimelinePct = (value) => {
  const date = clampDate(parseDate(value));
  if (!date) return 0;
  return ((date.getTime() - TIMELINE_START.getTime()) / TIMELINE_DURATION_MS) * 100;
};

const getPhaseIndex = (phase) => {
  const index = PHASE_ORDER.indexOf(phase);
  return index >= 0 ? index : 0;
};

const getPhaseShortLabel = (phase) => PHASE_SHORT[phase] || phase;

// ── Toast ──
const Toast = ({ toast }) => {
  if (!toast) return null;
  const bg = toast.type === 'error' ? '#a32d2d' : toast.type === 'info' ? '#185FA5' : '#1a4d1a';
  const Icon = toast.type === 'error' ? AlertCircle : CheckCircle;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, backgroundColor: bg, color: 'white', padding: '0.625rem 1.25rem',
      borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: '0.45rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      animation: 'fadeIn 0.25s ease',
    }}>
      <Icon size={14} />{toast.msg}
    </div>
  );
};

// ── Phase bar ──
const PhaseBar = ({ phase, count, total, animate }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const c = phaseColor(phase);
  return (
    <div style={{ marginBottom: '0.625rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--color-text-primary, #0f172a)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: c, display: 'inline-block', flexShrink: 0 }} />
          {phase}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>{count} farmers</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 5, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: animate ? `${Math.max(2, pct)}%` : 0,
          backgroundColor: c, borderRadius: '999px',
          transition: animate ? 'width 0.6s ease' : 'none',
        }} />
      </div>
    </div>
  );
};

// ── Gantt row ──
const GanttRow = ({ item }) => {
  const { barangay, segments, farmerCount, currentPhase } = item;
  const hasData = Array.isArray(segments) && segments.length > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid #f1f5f9' }}>
      <div style={{ width: 96, flexShrink: 0, fontSize: 12, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 10 }} title={barangay}>{barangay}</div>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ position: 'relative', minWidth: `${MONTH_LABELS.length * 96}px`, height: 24, backgroundColor: '#f1f5f9', borderRadius: 12, overflow: 'hidden' }}>
          {hasData ? segments.map((segment, idx) => {
            const left = dateToTimelinePct(segment.start);
            const right = dateToTimelinePct(segment.end || segment.start);
            const width = Math.max(3, right - left || 3);
            const color = phaseColor(segment.phase);
            return (
              <div key={`${segment.phase}-${idx}`} title={`${segment.phase} • ${segment.startLabel} → ${segment.endLabel}`} style={{
                position: 'absolute', left: `${left}%`, width: `${width}%`, height: '100%',
                backgroundColor: `${color}cc`, borderRadius: '999px', boxShadow: '0 0 0 1px rgba(255,255,255,0.12)',
                borderTopRightRadius: idx === segments.length - 1 ? 12 : 2,
                borderBottomRightRadius: idx === segments.length - 1 ? 12 : 2,
              }} />
            );
          }) : (
            <div style={{ position: 'absolute', inset: 0, border: '1px dashed #cbd5e1', borderRadius: 12 }} />
          )}
        </div>
      </div>
      <div style={{ width: 42, flexShrink: 0, fontSize: 12, color: '#475569', textAlign: 'right', paddingLeft: 10 }}>{farmerCount ?? '-'}</div>
    </div>
  );
};

// ── Audit item ──
const AuditItem = ({ record }) => {
  const ph = normalizePhase(record.crop_phase || record.land_type);
  const c = phaseColor(ph);
  const isOwn = (record.seed_source || '').toUpperCase() === 'OWN_SEED';
  const name = record.encoded_by_name || record.encoded_by || 'AT';
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const brgy = record.barangay || record.farmer_barangay || '';
  const time = record.date_observed || record.created_at || '';
  const timeStr = time ? new Date(time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '-';
  return (
    <div style={{ padding: '0.625rem 1rem', borderBottom: '0.5px solid #f1f5f9', display: 'flex', gap: '0.625rem' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        backgroundColor: isOwn ? '#FAEEDA' : '#E6F1FB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 600, color: isOwn ? '#854F0B' : '#185FA5',
      }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {name}
          <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, backgroundColor: `${c}20`, color: c }}>
            {PHASE_SHORT[ph] || ph}
          </span>
          {isOwn && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, backgroundColor: '#E6F1FB', color: '#185FA5' }}>own seed</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Encoded → {brgy}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{timeStr}</div>
      </div>
    </div>
  );
};

// ── Main Component ──
const CropPhase = () => {
  const [plots, setPlots] = useState([]);
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animate, setAnimate] = useState(false);
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);
  const intervalRef = useRef(null);

  const navigate = useNavigate();

  const showToast = useCallback((msg, type = 'success') => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, type });
    toastRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [plotsRes, sumRes, recordsRes] = await Promise.allSettled([
        getGisPlots(),
        getMapSummary(),
        API.get('/crop-monitoring/admin/records/'),
      ]);
      if (plotsRes.status === 'fulfilled') {
        const d = plotsRes.value.data;
        setPlots(Array.isArray(d) ? d : (d?.plots || []));
      }
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
      if (recordsRes.status === 'fulfilled') {
        const d = recordsRes.value.data;
        setRecords(Array.isArray(d) ? d : (d?.results || []));
      }
      if (!silent) {
        setAnimate(true);
        setTimeout(() => setAnimate(false), 700);
        showToast('Data loaded successfully');
      }
    } catch {
      if (!silent) showToast('Failed to load data', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(() => loadData(true), 30000);
    return () => {
      clearInterval(intervalRef.current);
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, [loadData]);

  const brgyPlotData = useMemo(() => {
    const map = {};
    plots.forEach(p => {
      if (!p.barangay) return;
      const name = p.barangay.trim();
      if (!map[name]) map[name] = { farmers: new Set(), ha: 0, phase: {} };
      map[name].farmers.add(p.farmer || p.id);
      map[name].ha += parseFloat(p.area_ha) || 0;
      const ph = normalizePhase(p.land_type);
      map[name].phase[ph] = (map[name].phase[ph] || 0) + 1;
    });
    return map;
  }, [plots]);

  const timelineRows = useMemo(() => {
    const groups = {};
    records.forEach(rec => {
      const barangay = rec.barangay?.trim();
      const date = parseDate(rec.date_observed || rec.encoded_at || rec.created_at);
      if (!barangay || !date) return;
      if (!groups[barangay]) groups[barangay] = { entries: [], farmers: new Set() };
      groups[barangay].entries.push({
        phase: normalizePhase(rec.crop_phase || rec.land_type),
        date,
      });
      if (rec.farmer) groups[barangay].farmers.add(rec.farmer);
    });

    const rowBarangays = [...new Set([...ALL_BARANGAYS, ...Object.keys(groups)])].sort((a, b) => a.localeCompare(b));

    return rowBarangays.map(barangay => {
      const plotData = brgyPlotData[barangay];
      const group = groups[barangay];
      if (!group || group.entries.length === 0) {
        return {
          barangay,
          farmerCount: plotData?.farmers.size || 0,
          areaHa: plotData?.ha || 0,
          currentPhase: 'No data',
          currentPhaseIndex: -1,
          startDate: null,
          latestDate: null,
          segments: [],
        };
      }

      const entries = [...group.entries].sort((a, b) => a.date - b.date);
      const phaseStarts = [];
      const seenPhases = new Set();
      entries.forEach(entry => {
        if (!seenPhases.has(entry.phase)) {
          seenPhases.add(entry.phase);
          phaseStarts.push(entry);
        }
      });
      const lastEntry = entries[entries.length - 1];
      const currentPhase = normalizePhase(lastEntry.phase);
      const segments = phaseStarts.map((entry, index) => {
        const next = phaseStarts[index + 1];
        const end = next ? new Date(next.date.getTime() - 1) : lastEntry.date;
        return {
          phase: entry.phase,
          start: entry.date,
          end,
          startLabel: entry.date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
          endLabel: end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        };
      });

      return {
        barangay,
        farmerCount: group.farmers.size || plotData?.farmers.size || 0,
        areaHa: plotData?.ha || 0,
        currentPhase,
        currentPhaseIndex: getPhaseIndex(currentPhase),
        startDate: phaseStarts[0].date,
        latestDate: lastEntry.date,
        segments,
      };
    });
  }, [records, brgyPlotData]);

  const brgyRows = timelineRows;
  const maxFarmers = Math.max(...timelineRows.map(row => row.farmerCount), 1);

  const phaseCounts = {};
  plots.forEach(p => { const k = normalizePhase(p.land_type); phaseCounts[k] = (phaseCounts[k] || 0) + 1; });
  const totalPlots = Math.max(plots.length, 1);
  const phaseSorted = PHASE_ORDER.map(ph => ({ ph, cnt: phaseCounts[ph] || 0 })).filter(x => x.cnt > 0).sort((a, b) => b.cnt - a.cnt);
  const dominant = phaseSorted[0];

  const seedMap = { HYBRID: { cnt: 0, ha: 0 }, INBRED: { cnt: 0, ha: 0 }, OWN_SEED: { cnt: 0, ha: 0 } };
  plots.forEach(p => {
    const src = (p.seed_source || 'OWN_SEED').toUpperCase();
    const key = src === 'OWN_SEED' ? 'OWN_SEED' : src === 'INBRED' ? 'INBRED' : 'HYBRID';
    seedMap[key].cnt++;
    seedMap[key].ha += parseFloat(p.area_ha) || 0;
  });
  if (summary?.seed_breakdown) {
    seedMap.HYBRID.cnt = summary.seed_breakdown.HYBRID?.total_farmers || seedMap.HYBRID.cnt;
    seedMap.INBRED.cnt = summary.seed_breakdown.INBRED?.total_farmers || seedMap.INBRED.cnt;
    seedMap.OWN_SEED.cnt = summary.seed_breakdown.OWN_SEED?.total_farmers || seedMap.OWN_SEED.cnt;
  }

  const matrixCols = ['Seed Distribution', 'Crop Establishment', 'Tillering', 'Flowering'];
  const matrix = { HYBRID: {}, INBRED: {}, OWN_SEED: {} };
  plots.forEach(p => {
    const src = (p.seed_source || 'OWN_SEED').toUpperCase();
    const key = src === 'OWN_SEED' ? 'OWN_SEED' : src === 'INBRED' ? 'INBRED' : 'HYBRID';
    const ph = normalizePhase(p.land_type);
    matrix[key][ph] = (matrix[key][ph] || 0) + 1;
  });
  const colTotals = {};
  matrixCols.forEach(c => { colTotals[c] = (matrix.HYBRID[c] || 0) + (matrix.INBRED[c] || 0) + (matrix.OWN_SEED[c] || 0); });
  const rowTotals = { HYBRID: 0, INBRED: 0, OWN_SEED: 0 };
  Object.entries(matrix).forEach(([k, v]) => { rowTotals[k] = Object.values(v).reduce((a, b) => a + b, 0); });
  const grandTotal = Object.values(rowTotals).reduce((a, b) => a + b, 0);

  const totalFarmers = summary?.current_farmers || plots.length;
  const totalApproved = summary?.total_approved_farmers || totalFarmers;
  const totalBrgys = brgyRows.filter(row => Array.isArray(row.segments) && row.segments.length > 0).length;
  const totalBrgysAll = brgyRows.length;
  const totalHa = plots.reduce((s, p) => s + (parseFloat(p.area_ha) || 0), 0);

  const auditItems = records.slice(0, 10);
  const savedCount = seedMap.OWN_SEED.cnt;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
        <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: 13 }}>Loading crop phase data...</span>
      </div>
    );
  }

  return (
    <div className="crop-phase-shell" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cp-row-hover:hover td{background:#f0fdf4!important;cursor:pointer}
        .cp-vbtn:hover{background:#E6F1FB!important}
        .cp-audit-scroll::-webkit-scrollbar{width:3px}
        .cp-audit-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
        .crop-phase-shell .crop-phase-topbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;}
        .crop-phase-shell .crop-phase-body{display:grid;grid-template-columns:minmax(0,1fr) 252px;gap:1rem;align-items:start;}
        .crop-phase-shell .crop-phase-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.625rem;}
        .crop-phase-shell .crop-phase-timeline-header{display:flex;flex-wrap:wrap;gap:0.5rem;border-bottom:1px solid #f1f5f9;padding-bottom:4px;margin-bottom:4px;}
        .crop-phase-shell .crop-phase-timeline-header .label-months{flex:1;min-width:0;display:flex;justify-content:space-between;padding:0 2px;overflow-x:auto;}
        .crop-phase-shell .crop-phase-timeline-header .label-months span{min-width:40px;}
        @media (max-width: 960px){
          .crop-phase-shell .crop-phase-body{grid-template-columns:minmax(0,1fr);}
          .crop-phase-shell .crop-phase-metrics{grid-template-columns:repeat(2,minmax(0,1fr));}
          .crop-phase-shell .crop-phase-topbar{flex-direction:column;align-items:stretch;}
          .crop-phase-shell .crop-phase-topbar > div:last-child{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.5rem;}
        }
        @media (max-width: 640px){
          .crop-phase-shell .crop-phase-metrics{grid-template-columns:1fr;}
        }
        @media (max-width: 640px){
          .crop-phase-shell .crop-phase-topbar > div:last-child{justify-content:stretch;}
          .crop-phase-shell .crop-phase-timeline-header{flex-direction:column;align-items:flex-start;}
          .crop-phase-shell .crop-phase-timeline-header .label-months{width:100%;}
        }
      `}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="crop-phase-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#0f172a' }}>Crop phase analytics</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#639922' }} />
            Live &nbsp;·&nbsp; Dry Season 2025–2026 &nbsp;·&nbsp; Lucban, Quezon
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => loadData()} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '0.375rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: 'white', cursor: 'pointer' }}>
            <RefreshCw size={13} color="#64748b" /> Refresh
          </button>
          <button onClick={() => navigate('/admin/gis')} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '0.375rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: 'white', cursor: 'pointer' }}>
            <MapPin size={13} color="#64748b" /> Open GIS map ↗
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="crop-phase-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '0.625rem' }}>
        {[
          { val: `${totalFarmers}/${totalApproved}`, lbl: 'total farmers' },
          { val: totalHa > 0 ? fmtNum(totalHa, 2) : '—', lbl: 'hectares' },
          { val: `${totalBrgys}/${totalBrgysAll}`, lbl: 'barangays' },
          { val: dominant?.ph || '—', lbl: 'dominant phase', color: dominant ? phaseColor(dominant.ph) : '#64748b', small: (dominant?.ph?.length || 0) > 12 },
        ].map((m, i) => (
          <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '0.875rem 1rem', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: m.small ? 13 : 20, fontWeight: 500, color: m.color || '#0f172a', lineHeight: 1.1 }}>{m.val}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{m.lbl}</div>
          </div>
        ))}
      </div>

      {/* Body: left + right */}
      <div className="crop-phase-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 252px', gap: '1rem', alignItems: 'start' }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Gantt */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Barangay phase timeline</div>
            {brgyRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: 12 }}>No barangay data yet</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <div className="crop-phase-timeline-header">
                    <div style={{ width: 96, flexShrink: 0, fontSize: 12, color: '#94a3b8' }}>Barangay</div>
                    <div className="label-months" style={{ minWidth: `${MONTH_LABELS.length * 96}px` }}>
                      {MONTH_LABELS.map(m => <span key={m} style={{ fontSize: 12, color: '#94a3b8' }}>{m}</span>)}
                    </div>
                    <div style={{ width: 42, flexShrink: 0, fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>Farmers</div>
                  </div>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {brgyRows.map(b => <GanttRow key={b.barangay} item={b} />)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: '.625rem', paddingTop: '.5rem', borderTop: '1px solid #f1f5f9' }}>
                  {[...new Set(brgyRows.map(b => b.ph))].map(ph => (
                    <span key={ph} style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: phaseColor(ph), display: 'inline-block' }} />{ph}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Phase distribution */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Phase distribution (overall)</div>
            {phaseSorted.length === 0
              ? <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: 12 }}>No phase data yet</div>
              : phaseSorted.map(x => <PhaseBar key={x.ph} phase={x.ph} count={x.cnt} total={totalPlots} animate={animate} />)
            }
          </div>

          {/* Seed breakdown */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Seed type breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '.5rem' }}>
              {[
                { key: 'HYBRID', label: 'Hybrid', color: '#1a4d1a', accent: false },
                { key: 'INBRED', label: 'Certified', color: '#3B82F6', accent: false },
                { key: 'OWN_SEED', label: 'Farmer saved', color: '#185FA5', accent: true },
              ].map(s => (
                <div key={s.key} style={{ background: '#f8fafc', borderRadius: 8, padding: '.625rem .75rem', border: s.accent ? '1px solid #B5D4F4' : '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />{s.label}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 500, color: s.accent ? s.color : '#0f172a' }}>{fmtNum(seedMap[s.key].cnt)}</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{seedMap[s.key].ha > 0 ? fmtNum(seedMap[s.key].ha, 2) + ' ha' : '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Matrix */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Seed source × phase matrix</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {['Seed type', 'Seed dist.', 'Establish.', 'Tillering', 'Flowering', 'Total'].map(h => (
                      <th key={h} style={{ fontSize: 10, fontWeight: 600, color: '#475569', padding: '5px 6px', textAlign: h === 'Seed type' ? 'left' : 'right', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'HYBRID', label: 'Hybrid', saved: false },
                    { key: 'INBRED', label: 'Certified', saved: false },
                    { key: 'OWN_SEED', label: '🔵 Saved', saved: true },
                  ].map(r => (
                    <tr key={r.key}>
                      <td style={{ fontSize: 11, padding: '5px 6px', color: r.saved ? '#185FA5' : '#64748b', fontWeight: 500, borderBottom: '1px solid #f1f5f9' }}>{r.label}</td>
                      {matrixCols.map(c => (
                        <td key={c} style={{ fontSize: 11, padding: '5px 6px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: r.saved && (matrix[r.key][c] || 0) > 0 ? '#185FA5' : '#0f172a', fontWeight: r.saved && (matrix[r.key][c] || 0) > 0 ? 600 : 400 }}>
                          {matrix[r.key][c] || 0}
                        </td>
                      ))}
                      <td style={{ fontSize: 11, padding: '5px 6px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: r.saved ? '#185FA5' : '#0f172a', fontWeight: r.saved ? 600 : 400 }}>{rowTotals[r.key]}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ fontSize: 11, padding: '5px 6px', color: '#0f172a', fontWeight: 600 }}>Total</td>
                    {matrixCols.map(c => <td key={c} style={{ fontSize: 11, padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{colTotals[c]}</td>)}
                    <td style={{ fontSize: 11, padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{grandTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {seedMap.OWN_SEED.cnt > 0 && (
              <div style={{ fontSize: 10, color: '#64748b', marginTop: '.5rem' }}>
                🔵 Saved seed farmers ({seedMap.OWN_SEED.cnt}) are consistently 1–2 phases behind formal seed recipients.
              </div>
            )}
          </div>

          {/* Barangay status table */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em' }}>Barangay phase status</div>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>click row for GIS detail</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Barangay', 'Phase', 'Farmers', 'ha', ''].map((h, i) => (
                      <th key={i} style={{ fontSize: 10, fontWeight: 600, color: '#475569', padding: '5px 8px', textAlign: i >= 2 && i < 4 ? 'right' : 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {brgyRows.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '.75rem', color: '#94a3b8', fontSize: 12 }}>No data yet</td></tr>
                  ) : brgyRows.map(b => {
                    const c = phaseColor(b.ph);
                    const sh = PHASE_SHORT[b.ph] || b.ph;
                    return (
                      <tr key={b.n} className="cp-row-hover" onClick={() => navigate(`/admin/gis?barangay=${encodeURIComponent(b.n)}`)}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 500 }}>{b.n}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, backgroundColor: `${c}18`, color: c }}>{sh}</span>
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{b.f}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{b.ha > 0 ? fmtNum(b.ha, 2) : '—'}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                          <button className="cp-vbtn" onClick={e => { e.stopPropagation(); navigate(`/admin/gis?barangay=${encodeURIComponent(b.n)}`); }}
                            style={{ fontSize: 10, color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit' }}>
                            Map ↗
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>

          {/* Audit log */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em' }}>AT action log</span>
              <button onClick={() => loadData()} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#64748b' }}>
                <RefreshCw size={10} /> refresh
              </button>
            </div>
            <div className="cp-audit-scroll" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {auditItems.length === 0
                ? <div style={{ padding: '1rem', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>No activity yet</div>
                : auditItems.map((r, i) => <AuditItem key={r.id || i} record={r} />)
              }
            </div>
          </div>

          {/* Pre-distribution alert */}
          {savedCount > 0 && (
            <div style={{ background: '#FAEEDA', border: '1px solid #FAC775', borderRadius: 12, padding: '.75rem 1rem', display: 'flex', gap: '.625rem' }}>
              <AlertCircle size={16} color="#854F0B" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#412402', marginBottom: 2 }}>
                  Pre-distribution activity — {savedCount} farmer{savedCount !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 11, color: '#633806', lineHeight: 1.5 }}>
                  AT visited these farmers before government seeds arrived. They use saved seeds and are recorded under the Informal Seed System in the Planting Accomplishment Report.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CropPhase;