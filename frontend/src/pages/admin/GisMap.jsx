// src/pages/admin/GisMap.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MapPin, Users, Search, X, RefreshCw,
  CheckCircle, AlertCircle, ChevronLeft,
  Layers, Activity, TrendingUp, Clock, Database,
} from 'lucide-react';
import { getGisPlots, getMapSummary, getGisBarangays } from '../../api/axios';
import API from '../../api/axios';
import LucbanGIS from '../../data/LucbanGIS.json';

// ─── CONSTANTS ────────────────────────────────────────────────
const PHASES = [
  { key: 'Seed Distribution',  color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB', label: 'Seed Distribution'  },
  { key: 'Crop Establishment', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', label: 'Crop Establishment' },
  { key: 'Tillering',          color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', label: 'Tillering'          },
  { key: 'Flowering',          color: '#A855F7', bg: '#FAF5FF', border: '#E9D5FF', label: 'Flowering'          },
  { key: 'Ripening',           color: '#FACC15', bg: '#FEFCE8', border: '#FDE68A', label: 'Ripening'           },
  { key: 'Harvesting',         color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', label: 'Harvesting'         },
];
const PHASE_MAP = Object.fromEntries(PHASES.map(p => [p.key, p]));
const phaseColor = (key) => PHASE_MAP[key]?.color || '#64748B';

const ALLOWED_BRGYS = [
  'Abang', 'Aliliw', 'Atulinao', 'Ayuti', 'Igang', 'Kabatete', 'Kakawit', 'Kalangay', 'Kalyaat', 'Kilib', 'Kulapi', 'Mahabang Parang', 'Malupak', 'Manasa', 'May It', 'Nagsinamo', 'Nalunao', 'Palola', 'Piis', 'Samil', 'Tiawe', 'Tinamnan'
];

const BRGY_FEATURES = LucbanGIS.features.filter(
  f => ALLOWED_BRGYS.includes(f.properties?.ADM4_EN)
);

// ─── LEAFLET LOADER ───────────────────────────────────────────
let _leafletReady = false;
const loadLeaflet = () =>
  new Promise(resolve => {
    if (window.L) { resolve(window.L); return; }
    if (_leafletReady) {
      const t = setInterval(() => { if (window.L) { clearInterval(t); resolve(window.L); } }, 40);
      return;
    }
    _leafletReady = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = () => resolve(window.L);
    document.head.appendChild(js);
  });

// ─── PHASE ICON ───────────────────────────────────────────────
const PhaseIcon = ({ phaseKey, size = 18 }) => {
  const icons = {
    'Seed Distribution':  '🌾',
    'Crop Establishment': '🌱',
    'Tillering':          '🍃',
    'Flowering':          '🌸',
    'Ripening':           '🌾',
    'Harvesting':         '🚜',
  };
  return <span style={{ fontSize: size }}>{icons[phaseKey] || '📍'}</span>;
};

// ─── TOAST ────────────────────────────────────────────────────
const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 9999,
      backgroundColor: toast.type === 'error' ? '#991b1b' : '#1a4d1a',
      color: 'white', padding: '0.7rem 1.4rem',
      borderRadius: '999px', fontSize: '0.84rem', fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: '0.45rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
      animation: 'gis-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      maxWidth: 'calc(100vw - 2rem)',
    }}>
      {toast.type === 'error'
        ? <AlertCircle size={14} />
        : <CheckCircle size={14} />}
      {toast.msg}
    </div>
  );
};

// ─── PHASE BAR ────────────────────────────────────────────────
const PhaseBar = ({ phase, percent, count, total, animate }) => {
  const cfg = PHASE_MAP[phase] || { color: '#9CA3AF', label: phase };
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{cfg.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {count !== undefined && (
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{count} farmers</span>
          )}
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', minWidth: 36, textAlign: 'right' }}>{percent}%</span>
        </div>
      </div>
      <div style={{ height: 7, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: animate ? `${Math.max(2, percent)}%` : 0,
          backgroundColor: cfg.color,
          borderRadius: '999px',
          transition: animate ? 'width 0.6s cubic-bezier(0.34,1,0.64,1)' : 'none',
        }} />
      </div>
    </div>
  );
};

// ─── INFO STAT PAIR ───────────────────────────────────────────
const StatPair = ({ icon: Icon, label, value, color }) => (
  <div style={{ backgroundColor: '#f8fafc', borderRadius: '0.875rem', padding: '0.875rem 1rem', border: '1px solid #e2e8f0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
      <Icon size={14} color={color || '#64748b'} />
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: color || '#0f172a' }}>{value}</p>
  </div>
);

// ─── OVERVIEW PANEL ───────────────────────────────────────────
const OverviewPanel = ({ plots, summary, animate }) => {
  const totalFarmers = summary?.total_farmers || new Set(plots.map(p => p.farmer)).size;
  const totalBarangays = summary?.barangays?.length || new Set(plots.map(p => p.barangay).filter(Boolean)).size;

  const phaseCounts = useMemo(() => {
    const counts = {};
    plots.forEach(p => {
      const k = p.land_type || 'Seed Distribution';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [plots]);

  const total = Math.max(1, plots.length);
  const distribution = PHASES.map(ph => ({
    ...ph,
    count: phaseCounts[ph.key] || 0,
    percent: Math.round(((phaseCounts[ph.key] || 0) / total) * 100),
  })).filter(ph => ph.count > 0);

  const dominant = distribution.sort((a, b) => b.count - a.count)[0];

  const now = new Date();
  const lastUpdated = `${now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} • ${now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;

  return (
    <div style={{ padding: '0 1.25rem 1.5rem', animation: animate ? 'gis-fadeSlide 0.35s ease' : 'none' }}>
      {/* Header card */}
      <div style={{
        background: 'linear-gradient(135deg, #1a4d1a 0%, #166534 100%)',
        borderRadius: '1.25rem', padding: '1.25rem',
        marginBottom: '1rem', color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Activity size={16} color='rgba(255,255,255,0.8)' />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Lucban Rice Monitoring
          </span>
          <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            LIVE
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{totalFarmers.toLocaleString()}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Total Farmers</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{totalBarangays}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Active Barangays</p>
          </div>
        </div>
      </div>

      {/* Phase distribution */}
      <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.1rem 1.15rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Phase Distribution (Overall)
        </p>
        {distribution.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0, textAlign: 'center', padding: '1rem 0' }}>No phase data yet.</p>
        ) : (
          distribution.sort((a, b) => b.count - a.count).map(ph => (
            <PhaseBar key={ph.key} phase={ph.key} percent={ph.percent} count={ph.count} animate={animate} />
          ))
        )}
      </div>

      {/* Most active phase */}
      {dominant && (
        <div style={{ backgroundColor: PHASE_MAP[dominant.key]?.bg || '#f9fafb', borderRadius: '1.25rem', padding: '1rem 1.15rem', border: `1px solid ${PHASE_MAP[dominant.key]?.border || '#e5e7eb'}`, marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Most Active Phase
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PhaseIcon phaseKey={dominant.key} size={22} />
            <div>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: PHASE_MAP[dominant.key]?.color }}>{dominant.label}</p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>Dominant phase across Lucban</p>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '1.4rem', fontWeight: 800, color: PHASE_MAP[dominant.key]?.color }}>{dominant.percent}%</span>
          </div>
        </div>
      )}

      {/* Footer meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', padding: '0.875rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <Clock size={13} color='#64748b' />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Updated</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.4 }}>{lastUpdated}</p>
        </div>
        <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', padding: '0.875rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <Database size={13} color='#64748b' />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Source</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', lineHeight: 1.4 }}>Seed Distribution<br /><span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 400 }}>(Confirmed)</span></p>
        </div>
      </div>
    </div>
  );
};

const UtilizationOverviewPanel = () => (
  <div style={{ padding: '0 1.25rem 1.5rem' }}>
    <div style={{ backgroundColor: '#f8fafc', borderRadius: '1.25rem', padding: '2rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
      <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</p>
      <p style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>Crop Utilization</p>
      <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
        Utilization data will appear here once connected to your Production module.
      </p>
    </div>
  </div>
);

// ─── BARANGAY PANEL ───────────────────────────────────────────
const BarangayPanel = ({ barangayName, plots, onBack, animate }) => {
  const brgyPlots = useMemo(() => plots.filter(p => p.barangay === barangayName), [plots, barangayName]);

  const phaseCounts = useMemo(() => {
    const counts = {};
    brgyPlots.forEach(p => {
      const k = p.land_type || 'Seed Distribution';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [brgyPlots]);

  const totalApproved = brgyPlots[0]?.total_approved_in_brgy || brgyPlots.length;
  const total = Math.max(1, totalApproved);
  const distribution = PHASES.map(ph => ({
    ...ph,
    count: phaseCounts[ph.key] || 0,
    percent: Math.round(((phaseCounts[ph.key] || 0) / total) * 100),
  }));

  const dominant = [...distribution].sort((a, b) => b.count - a.count)[0];
  const dominantCfg = PHASE_MAP[dominant?.key];

  const totalHa = brgyPlots.reduce((s, p) => s + (parseFloat(p.area_ha) || 0), 0);

  const now = new Date();
  const lastUpdated = `${now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} • ${now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;

  return (
    <div style={{ animation: animate ? 'gis-fadeSlide 0.35s ease' : 'none' }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem',
        background: 'linear-gradient(135deg, #1a4d1a 0%, #166534 100%)',
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
          <button onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.5rem', color: 'white', padding: '0.35rem 0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
            <ChevronLeft size={14} /> Back
          </button>
          {dominantCfg && (
            <span style={{ marginLeft: 'auto', backgroundColor: dominantCfg.color, borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
              Dominant: {dominant.label}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin size={20} color='white' />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Brgy. {barangayName}</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>Lucban, Quezon</p>
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginTop: '1rem' }}>
          {[
            { label: 'Farmers', value: brgyPlots.length },
            { label: 'Area', value: totalHa > 0 ? `${totalHa.toFixed(1)} ha` : '—' },
            { label: 'Plots', value: brgyPlots.length },
          ].map(item => (
            <div key={item.label} style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.75rem', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'white' }}>{item.value}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.62rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Phase breakdown */}
      <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Phase Breakdown
        </p>
        {distribution.filter(ph => ph.count > 0).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8' }}>
            <MapPin size={28} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.84rem' }}>No phase data for this barangay yet.</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#cbd5e1' }}>Data appears after seed distribution is confirmed.</p>
          </div>
        ) : (
          distribution.filter(ph => ph.count > 0).map(ph => (
            <PhaseBar key={ph.key} phase={ph.key} percent={ph.percent} count={ph.count} animate={true} />
          ))
        )}
      </div>

      {/* Last updated */}
      <div style={{ padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', padding: '0.875rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <Clock size={13} color='#64748b' />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Updated</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.4 }}>{lastUpdated}</p>
        </div>
        <div style={{ backgroundColor: '#f8fafc', borderRadius: '1rem', padding: '0.875rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <Database size={13} color='#64748b' />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Source</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', lineHeight: 1.4 }}>Seed Distribution<br /><span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 400 }}>(Confirmed)</span></p>
        </div>
      </div>

      {/* Farmer list */}
      {brgyPlots.length > 0 && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          <div style={{ padding: '0.875rem 1.25rem', backgroundColor: '#fafafa' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Farmers in this Barangay
            </p>
          </div>
          {brgyPlots.map((plot, idx) => {
            const cfg = PHASE_MAP[plot.land_type] || { color: '#9CA3AF', label: 'Unknown' };
            return (
              <div key={plot.id} style={{ padding: '0.875rem 1.25rem', borderBottom: idx < brgyPlots.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: `${cfg.color}20`, border: `1.5px solid ${cfg.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: cfg.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {plot.farmer_name || '—'}
                  </p>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                    {plot.label} {plot.area_ha ? `· ${plot.area_ha} ha` : ''}
                  </p>
                </div>
                <span style={{ backgroundColor: cfg.bg || '#f9fafb', color: cfg.color, border: `1px solid ${PHASE_MAP[plot.land_type]?.border || '#e5e7eb'}`, borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────
const GisMap = () => {
  const mapRef      = useRef(null);
  const leafletMap  = useRef(null);
  const polygonRef  = useRef(null);
  const outlineRef  = useRef(null);
  const markersRef  = useRef({});
  const panelRef    = useRef(null);
  const [L, setL]   = useState(null);

  const [plots,    setPlots]    = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [barangays,setBarangays]= useState([]);
  const [loading,  setLoading]  = useState(true);

  const [activeBarangay, setActiveBarangay] = useState(null);
  const [panelAnimate,   setPanelAnimate]   = useState(false);
  const [isMobile,       setIsMobile]       = useState(false);
  const [mobileSheet,    setMobileSheet]    = useState(false);

  const [searchQ,    setSearchQ]    = useState('');
  const [filterBrgy, setFilterBrgy] = useState('');
  const [activeTab,  setActiveTab]  = useState('monitoring');

  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  const [lastClickedBrgy, setLastClickedBrgy] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, type });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Responsive check
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load Leaflet
  useEffect(() => { loadLeaflet().then(setL); }, []);

  // Load data
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [plotsRes, sumRes, brgyRes] = await Promise.all([
        getGisPlots(),
        getMapSummary(),
        getGisBarangays(),
      ]);
      setPlots(plotsRes.data || []);
      setSummary(sumRes.data);
      setBarangays(brgyRes.data || []);
    } catch {
      showToast('Failed to load map data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      Promise.all([
        getGisPlots(),
        getMapSummary(),
        getGisBarangays(),
      ]).then(([plotsRes, sumRes, brgyRes]) => {
        setPlots(plotsRes.data || []);
        setSummary(sumRes.data);
        setBarangays(brgyRes.data || []);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [loadAll]);

  // Init map
  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [14.1167, 121.5833],
      zoom: 13,
      minZoom: 12,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);
    const allLayer = L.geoJSON(BRGY_FEATURES);
    const bounds = allLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13, animate: false });
      map.setMinZoom(map.getZoom());
    }
    leafletMap.current = map;
    setL(L);
  }, [L]);

  // Draw polygons
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;

    if (polygonRef.current) map.removeLayer(polygonRef.current);
    if (outlineRef.current)  map.removeLayer(outlineRef.current);

    // Build color lookup per barangay from plots
    const brgyPhase = {};
    plots.forEach(p => {
      if (!p.barangay) return;
      if (!brgyPhase[p.barangay]) brgyPhase[p.barangay] = {};
      const k = p.land_type || 'Seed Distribution';
      brgyPhase[p.barangay][k] = (brgyPhase[p.barangay][k] || 0) + 1;
    });
    const getDominantColor = (name) => {
      const counts = brgyPhase[name];
      if (!counts) return '#1E293B'; // dark navy slate for no data
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return phaseColor(dominant?.[0]) || '#1E293B';
    };

    polygonRef.current = L.geoJSON(BRGY_FEATURES, {
      style: feature => {
        const name = feature.properties.ADM4_EN;
        const isActive = name === activeBarangay;
        const color = getDominantColor(name);
        return {
          color:       isActive ? 'white'  : 'rgba(255,255,255,0.55)',
          fillColor:   color,
          fillOpacity: isActive ? 0.85     : 0.65,
          weight:      isActive ? 2.5      : 1.2,
          opacity:     1,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.ADM4_EN;
        const counts = brgyPhase[name];
        let dominant = null;
        let dominantPct = 0;
        if (counts) {
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          dominant = sorted[0]?.[0];
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          dominantPct = Math.round((sorted[0]?.[1] / total) * 100);
        }
        const phCfg = PHASE_MAP[dominant];

        layer.bindTooltip(`
          <div style="font-family:inherit;padding:0.15rem 0.1rem;">
            <div style="font-size:0.82rem;font-weight:800;color:#0f172a;margin-bottom:0.2rem;">${name}</div>
            ${dominant
              ? `<div style="display:flex;align-items:center;gap:0.35rem;">
                   <span style="width:8px;height:8px;border-radius:50%;background:${phCfg?.color || '#9ca3af'};display:inline-block;flex-shrink:0;"></span>
                   <span style="font-size:0.72rem;font-weight:700;color:${phCfg?.color || '#9ca3af'};">${dominant}</span>
                   <span style="font-size:0.72rem;color:#64748b;font-weight:600;">${dominantPct}%</span>
                 </div>`
              : `<div style="font-size:0.72rem;color:#94a3b8;">No data yet</div>`}
          </div>`, {
          permanent: false,
          direction: 'top',
          className: 'gis-tooltip',
          offset: [0, -6],
        });

        layer.on('click', () => {
          if (lastClickedBrgy === name) {
            // Same barangay clicked again → zoom back to full Lucban
            setActiveBarangay(null);
            setLastClickedBrgy(null);
            const fullBounds = L.geoJSON(BRGY_FEATURES).getBounds();
            if (fullBounds.isValid()) {
              map.fitBounds(fullBounds, { padding: [30, 30], maxZoom: 13, animate: true });
            }
          } else {
            // New barangay clicked → zoom in
            setActiveBarangay(name);
            setLastClickedBrgy(name);
            setPanelAnimate(true);
            if (isMobile) setMobileSheet(true);
            setTimeout(() => setPanelAnimate(false), 400);
            if (panelRef.current) panelRef.current.scrollTop = 0;
          }
        });
        layer.on('mouseover', () => {
          layer.setStyle({ fillOpacity: name === activeBarangay ? 0.92 : 0.8, weight: name === activeBarangay ? 2.5 : 2 });
        });
        layer.on('mouseout', () => {
          polygonRef.current?.resetStyle(layer);
        });
      },
    }).addTo(map);

    // Bold white outline for entire Lucban area
    outlineRef.current = L.geoJSON(BRGY_FEATURES, {
      style: {
        color: 'white',
        fillOpacity: 0,
        weight: 2.5,
        opacity: 0.9,
        interactive: false,
      },
    }).addTo(map);

    // Add barangay labels
    const labelLayerRef_inner = [];
    BRGY_FEATURES.forEach(feature => {
      const name = feature.properties.ADM4_EN;
      const layer = L.geoJSON(feature);
      const center = layer.getBounds().getCenter();
      const marker = L.marker(center, {
        icon: L.divIcon({
          html: `<div class="brgy-label" style="font-size:0.95rem;font-weight:800;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.95),0 0 10px rgba(0,0,0,0.8);white-space:nowrap;pointer-events:none;text-align:center;transition:font-size 0.2s;">${name}</div>`,
          className: '',
          iconAnchor: [40, 8],
        }),
        interactive: false,
      });
      marker.addTo(map);
      labelLayerRef_inner.push(marker);
    });

    const updateLabelSizes = () => {
      const zoom = map.getZoom();
      const size = zoom <= 11 ? '1.1rem'
        : zoom === 12 ? '1rem'
        : zoom === 13 ? '0.95rem'
        : zoom === 14 ? '0.8rem'
        : '0.7rem';
      document.querySelectorAll('.brgy-label').forEach(el => {
        el.style.fontSize = size;
      });
    };

    map.on('zoomend', updateLabelSizes);
    updateLabelSizes();

  }, [L, plots, activeBarangay, isMobile]);

  // Fly to selected barangay
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L || !activeBarangay) return;
    const feature = BRGY_FEATURES.find(f => f.properties.ADM4_EN === activeBarangay);
    if (!feature) return;
    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true, duration: 0.6 });
  }, [L, activeBarangay]);

  // Filter plots
  const filteredPlots = useMemo(() => plots.filter(p => {
    const q = searchQ.trim().toLowerCase();
    if (q && !(p.farmer_name?.toLowerCase().includes(q) || p.barangay?.toLowerCase().includes(q))) return false;
    if (filterBrgy && p.barangay?.toLowerCase() !== filterBrgy.toLowerCase()) return false;
    return true;
  }), [plots, searchQ, filterBrgy]);

  const handleBrgyClick = (name) => {
    setActiveBarangay(name);
    setLastClickedBrgy(name);
    setPanelAnimate(true);
    setTimeout(() => setPanelAnimate(false), 400);
    if (panelRef.current) panelRef.current.scrollTop = 0;
    const map = leafletMap.current;
    if (map && L) {
      const feature = BRGY_FEATURES.find(f => f.properties.ADM4_EN === name);
      if (feature) {
        const bounds = L.geoJSON(feature).getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
      }
    }
  };

  const handleBack = () => {
    setPanelAnimate(true);
    setActiveBarangay(null);
    setLastClickedBrgy(null);
    setMobileSheet(false);
    setTimeout(() => setPanelAnimate(false), 400);
    if (panelRef.current) panelRef.current.scrollTop = 0;
    if (leafletMap.current && L) {
      const allLayer = L.geoJSON(BRGY_FEATURES);
      const bounds = allLayer.getBounds();
      if (bounds.isValid()) {
        leafletMap.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 13, animate: true });
      }
    }
  };

  // ─── LEGEND ITEMS ────────────────────────────────────────────
  const Legend = () => (
    <div style={{
      position: 'absolute', bottom: '2.5rem', left: '1rem', zIndex: 400,
      backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: '1rem',
      padding: '0.875rem 1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)',
      minWidth: 160,
    }}>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.68rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Crop Phase Legend
      </p>
      {PHASES.map(ph => (
        <div key={ph.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '3px', backgroundColor: ph.color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.72rem', color: '#1e293b', fontWeight: 500 }}>{ph.label}</span>
        </div>
      ))}
    </div>
  );

  // ─── RENDER ───────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      <style>{`
        @keyframes gis-pop { 0%{opacity:0;transform:translateX(-50%) scale(0.88)} 70%{transform:translateX(-50%) scale(1.03)} 100%{opacity:1;transform:translateX(-50%) scale(1)} }
        @keyframes gis-fadeSlide { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gis-spin { to{transform:rotate(360deg)} }
        @keyframes gis-sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .gis-tooltip .leaflet-tooltip { background:white;border:none;border-radius:0.75rem;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:0.5rem 0.75rem; }
        .leaflet-tooltip { border-radius:0.75rem !important; border:none !important; box-shadow:0 4px 20px rgba(0,0,0,0.18) !important; }
        .gis-panel-scroll::-webkit-scrollbar { width:4px; }
        .gis-panel-scroll::-webkit-scrollbar-track { background:transparent; }
        .gis-panel-scroll::-webkit-scrollbar-thumb { background:#cbd5e1;border-radius:99px; }
        .leaflet-container { font-family: inherit !important; }
        .gis-brgy-btn:hover { background-color:#f0fdf4 !important; }
      `}</style>

      <Toast toast={toast} />

      {/* ── DESKTOP LAYOUT ── */}
      {!isMobile && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '1rem', gap: '1rem' }}>

          {/* MAP SIDE */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white',
            borderRadius: '1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
            overflow: 'hidden',
          }}>
            {/* Toolbar */}
            <div style={{ padding: '0.875rem 1.1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={16} color='#1a4d1a' />
                Lucban, Quezon — Barangay Map
              </div>
              <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.75rem', padding: '0.2rem', gap: '0.2rem' }}>
                <button
                  onClick={() => setActiveTab('monitoring')}
                  style={{ padding: '0.4rem 0.875rem', borderRadius: '0.6rem', border: 'none', backgroundColor: activeTab === 'monitoring' ? 'white' : 'transparent', color: activeTab === 'monitoring' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'monitoring' ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: activeTab === 'monitoring' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                  🌱 Crop Monitoring
                </button>
                <button
                  onClick={() => setActiveTab('utilization')}
                  style={{ padding: '0.4rem 0.875rem', borderRadius: '0.6rem', border: 'none', backgroundColor: activeTab === 'utilization' ? 'white' : 'transparent', color: activeTab === 'utilization' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'utilization' ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: activeTab === 'utilization' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                  📊 Crop Utilization
                </button>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} color='#9ca3af' style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    placeholder='Search barangay...'
                    style={{ padding: '0.5rem 0.875rem 0.5rem 2.2rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.82rem', outline: 'none', backgroundColor: '#f8fafc', width: 180, color: '#0f172a' }} />
                </div>
                <select value={filterBrgy} onChange={e => { setFilterBrgy(e.target.value); if (e.target.value) handleBrgyClick(e.target.value); }}
                  style={{ padding: '0.5rem 0.875rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.82rem', outline: 'none', backgroundColor: '#f8fafc', color: '#0f172a' }}>
                  <option value=''>Filters 0</option>
                  {barangays.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <button onClick={loadAll}
                  style={{ padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={14} color='#64748b' style={{ animation: loading ? 'gis-spin 0.8s linear infinite' : 'none' }} />
                </button>
              </div>
            </div>

            {/* MAP */}
            <div style={{ flex: 1, position: 'relative' }}>
              {loading && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '0 0 1.5rem 1.5rem' }}>
                  <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'gis-spin 0.8s linear infinite', margin: '0 auto 0.75rem' }} />
                    Loading map...
                  </div>
                </div>
              )}
              <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
              <Legend />
            </div>

            {/* Footer note */}
            <div style={{ padding: '0.6rem 1.1rem', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={12} color='#94a3b8' />
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Data is updated in real-time based on confirmed seed distribution.</span>
            </div>
          </div>

          {/* PANEL SIDE */}
          <div style={{
            width: 340,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white',
            borderRadius: '1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
            overflow: 'hidden',
          }}>
            {/* Panel title */}
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={15} color='#1a4d1a' />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                {activeBarangay ? `Brgy. ${activeBarangay}` : 'Overview'}
              </span>
              {activeBarangay && (
                <button onClick={handleBack}
                  style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <X size={13} /> Clear
                </button>
              )}
            </div>

            {/* Panel body */}
            <div ref={panelRef} className='gis-panel-scroll' style={{ flex: 1, overflowY: 'auto' }}>
              {!activeBarangay ? (
                <div style={{ paddingTop: '1.25rem' }}>
                  {activeTab === 'utilization' ? (
                    <UtilizationOverviewPanel />
                  ) : (
                    <OverviewPanel plots={filteredPlots} summary={summary} animate={panelAnimate} />
                  )}
                  {/* Barangay quick list */}
                  <div style={{ padding: '0 1.25rem 1.5rem' }}>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      All Barangays
                    </p>
                    {barangays.map(b => {
                      const brgyPlots = filteredPlots.filter(p => p.barangay === b);
                      const dominant = (() => {
                        const counts = {};
                        brgyPlots.forEach(p => { const k = p.land_type || 'Seed Distribution'; counts[k] = (counts[k] || 0) + 1; });
                        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
                      })();
                      const cfg = PHASE_MAP[dominant];
                      return (
                        <div key={b} className='gis-brgy-btn'
                          onClick={() => handleBrgyClick(b)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.875rem', borderRadius: '0.875rem', marginBottom: '0.375rem', cursor: 'pointer', backgroundColor: 'white', border: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg?.color || '#94a3b8', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: '0.84rem', fontWeight: 600, color: '#1e293b' }}>{b}</span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{brgyPlots.length} plots</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <BarangayPanel
                  barangayName={activeBarangay}
                  plots={filteredPlots}
                  onBack={handleBack}
                  animate={panelAnimate}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE LAYOUT ── */}
      {isMobile && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Full screen map */}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          {!mobileSheet && (
            <div style={{ position: 'absolute', bottom: '1.5rem', left: '1rem', right: '1rem', zIndex: 500 }}>
              <Legend />
            </div>
          )}

          {/* Mobile bottom sheet */}
          {mobileSheet && (
            <>
              <div onClick={() => setMobileSheet(false)}
                style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 700 }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 800,
                backgroundColor: 'white', borderRadius: '1.5rem 1.5rem 0 0',
                maxHeight: '80vh', overflowY: 'auto',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
                animation: 'gis-sheetUp 0.35s cubic-bezier(0.34,1.1,0.64,1)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}>
                <div style={{ width: 44, height: 4, backgroundColor: '#e2e8f0', borderRadius: '999px', margin: '0.875rem auto' }} />
                {activeBarangay ? (
                  <BarangayPanel
                    barangayName={activeBarangay}
                    plots={filteredPlots}
                    onBack={handleBack}
                    animate={panelAnimate}
                  />
                ) : (
                  <div style={{ paddingTop: '0.5rem' }}>
                    {activeTab === 'utilization' ? (
                      <UtilizationOverviewPanel />
                    ) : (
                      <OverviewPanel plots={filteredPlots} summary={summary} animate={panelAnimate} />
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Mobile fab */}
          {!mobileSheet && (
            <button onClick={() => setMobileSheet(true)}
              style={{ position: 'absolute', bottom: '1.5rem', right: '1rem', zIndex: 600, backgroundColor: '#1a4d1a', color: 'white', border: 'none', borderRadius: '999px', padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} /> Overview
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GisMap;