// src/components/gis/PublicGisMap.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Users, TrendingUp, MapPin, Activity, X, ChevronRight } from 'lucide-react';
import LucbanGIS from '../../data/LucbanGIS.json';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const fetchPublicStats = () => fetch(`${API_BASE}/gis/public/stats/`).then(r => r.json()).catch(() => null);
const fetchPublicBrgys = () => fetch(`${API_BASE}/gis/public/barangays/`).then(r => r.json()).catch(() => null);

const ALLOWED_BRGYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan',
];
const normBrgy = v => v?.toString().trim().replace(/[-_]+/g,' ').replace(/\s+/g,' ').toLowerCase();
const BRGY_FEATURES = LucbanGIS.features.filter(f =>
  ALLOWED_BRGYS.some(b => normBrgy(f.properties?.ADM4_EN) === normBrgy(b))
);

// ── Same util tiers as admin GisMap ──────────────────────────
const UTIL_TIERS = [
  { key: 'Exceeded Target', min: 100.01, color: '#166534', label: 'Exceeded Target' },
  { key: 'Achieved Target', min: 80,     color: '#15803d', label: 'Achieved Target' },
  { key: 'Near Target',     min: 70,     color: '#0369a1', label: 'Near Target'     },
  { key: 'Below Target',    min: 50,     color: '#b45309', label: 'Below Target'    },
  { key: 'Critical',        min: 0,      color: '#b91c1c', label: 'Critical'        },
];
const NO_DATA_COLOR = '#1E293B';

const fmtNum = (n, d = 2) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

let _leafletReady = false;
const loadLeaflet = () => new Promise(resolve => {
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

// ── Stat Tile ────────────────────────────────────────────────
const StatTile = ({ icon: Icon, label, value, sub, color, accent }) => (
  <div style={{
    flex: '1 1 180px', minWidth: 0,
    background: 'white', border: '1px solid #e5e7eb',
    borderRadius: '1rem', padding: '1.25rem 1.375rem',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    position: 'relative', overflow: 'hidden',
    transition: 'all 0.18s ease',
  }}
    className="pub-stat-tile"
  >
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '1rem 1rem 0 0' }} />
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
      <div style={{ width: 38, height: 38, borderRadius: '0.625rem', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} strokeWidth={2} />
      </div>
      {accent && (
        <span style={{ fontSize: '0.6rem', fontWeight: 700, color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: '999px', padding: '0.15rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {accent}
        </span>
      )}
    </div>
    <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</p>
    <p style={{ margin: '0.375rem 0 0', fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
    {sub && <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#9ca3af' }}>{sub}</p>}
  </div>
);

// ── Tier Legend — same style as admin map (dark background) ──
const TierLegend = () => (
  <div style={{
    position: 'absolute', top: '1rem', left: '1rem', zIndex: 500,
    background: 'rgba(15,23,42,0.75)', borderRadius: '0.75rem',
    padding: '0.55rem 0.875rem', backdropFilter: 'blur(4px)',
  }}>
    <p style={{ margin: '0 0 0.35rem', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      Production utilization
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {UTIL_TIERS.map(t => (
        <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 9, height: 9, borderRadius: 2, background: t.color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{t.label}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Barangay detail panel (floating inside map, right side) ──
const BrgyPanel = ({ brgy, allBrgys, onClose, visible }) => {
  // Top barangays sorted by production (harvest-based), not farmer count
  const topBrgys = useMemo(
    () => [...allBrgys]
      .filter(b => b.production_mt > 0 || b.registered_farmers > 0)
      .sort((a, b) => b.production_mt - a.production_mt)
      .slice(0, 5),
    [allBrgys]
  );

  const maxProduction = topBrgys[0]?.production_mt || 1;
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (visible) {
      setAnimated(false);
      const t = setTimeout(() => setAnimated(true), 80);
      return () => clearTimeout(t);
    } else {
      setAnimated(false);
    }
  }, [visible, brgy]);

  const tierColor = brgy?.dominant_color || NO_DATA_COLOR;
  const tierLabel = brgy?.dominant_tier || null;

  return (
    <div style={{
      position: 'absolute',
      top: '1rem', right: '1rem', bottom: '1rem',
      width: 'clamp(230px, 26%, 270px)',
      background: 'white', zIndex: 600,
      display: 'flex', flexDirection: 'column',
      borderRadius: '1.25rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)',
      border: '1px solid rgba(255,255,255,0.9)',
      transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 1.5rem))',
      transition: 'transform 0.4s cubic-bezier(0.34,1,0.64,1)',
      overflow: 'hidden',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      {/* Green header — same as admin */}
      <div style={{ background: 'linear-gradient(135deg,#1a4d1a,#166534)', padding: '1rem 1.125rem', color: 'white', flexShrink: 0, borderRadius: '1.25rem 1.25rem 0 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={14} color="white" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>Brgy. {brgy?.name || '—'}</p>
              <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)' }}>Lucban, Quezon</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} color="white" />
          </button>
        </div>

        {/* Tier badge if available */}
        {tierLabel && (
          <div style={{ marginBottom: '0.625rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: `${tierColor}33`, border: `1px solid ${tierColor}66`, borderRadius: '999px', padding: '0.2rem 0.625rem', fontSize: '0.65rem', fontWeight: 700, color: 'white' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: tierColor, display: 'inline-block' }} />
              {tierLabel}
            </span>
          </div>
        )}

        {/* 4 stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
          {[
            { label: 'Farmers',    value: brgy?.registered_farmers?.toLocaleString() ?? '—' },
            { label: 'Production', value: brgy?.production_mt > 0 ? `${fmtNum(brgy.production_mt)} MT` : '—' },
            { label: 'Total Area', value: brgy?.harvest_area_ha > 0 ? `${fmtNum(brgy.harvest_area_ha)} ha` : '—' },
            { label: 'Avg Yield',  value: brgy?.avg_yield_t_ha > 0 ? `${fmtNum(brgy.avg_yield_t_ha)} t/ha` : '—' },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '0.625rem', padding: '0.5rem 0.625rem', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>{item.value}</p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.58rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top barangays by production (harvest-based) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem 1rem' }}>
        <p style={{ margin: '0 0 0.625rem', fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Top barangays by farmers
        </p>
        {topBrgys.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>No harvest data yet</p>
        ) : topBrgys.map((b, i) => {
          const pct = maxProduction > 0 ? Math.round((b.production_mt / maxProduction) * 100) : 0;
          const isSelected = b.name === brgy?.name;
          const bColor = b.dominant_color || NO_DATA_COLOR;
          return (
            <div key={b.name} style={{ marginBottom: '0.55rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ width: 17, height: 17, borderRadius: '50%', background: isSelected ? '#166534' : '#f1f5f9', color: isSelected ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: 700, flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#166534' : '#374151' }}>
                    {b.name}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>
                  {b.production_mt > 0 ? `${fmtNum(b.production_mt)} MT` : `${b.registered_farmers}`}
                </span>
              </div>
              <div style={{ height: 5, background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: animated ? `${Math.max(2, pct)}%` : '0%',
                  background: isSelected ? '#166534' : (bColor !== NO_DATA_COLOR ? bColor : '#86efac'),
                  borderRadius: '999px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0, borderRadius: '0 0 1.25rem 1.25rem' }}>
        <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8' }}>
          Farmer data from official MAO registry
        </p>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────
const PublicGisMap = () => {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const polyRef    = useRef(null);
  const [L, setL]  = useState(null);

  const [stats,   setStats]   = useState(null);
  const [brgys,   setBrgys]   = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedBrgy,    setSelectedBrgy]    = useState(null);
  const [panelVisible,    setPanelVisible]    = useState(false);
  const [lastClickedBrgy, setLastClickedBrgy] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([fetchPublicStats(), fetchPublicBrgys()]);
      if (s) setStats(s);
      if (b) setBrgys(b.barangays || []);
    } catch (e) {
      console.warn('PublicGisMap load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadLeaflet().then(setL); }, []);

  const brgyMap = useMemo(() => Object.fromEntries(brgys.map(b => [b.name, b])), [brgys]);

  // ── Init Leaflet map ─────────────────────────────────────────
  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [14.1167, 121.5833], zoom: 12, minZoom: 11,
      // ── SCROLL WHEEL ZOOM enabled ──
      zoomControl: true, attributionControl: true, scrollWheelZoom: true,
    });
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri', maxZoom: 19 }
    ).addTo(map);
    const allLayer = L.geoJSON(BRGY_FEATURES);
    const bounds   = allLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [10, 10], animate: false });
      map.setMinZoom(map.getZoom() - 1);
    }
    leafletMap.current = map;
    setL(L);
  }, [L]);

  // ── Draw polygons — same style as admin GisMap ───────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;
    if (polyRef.current) { map.removeLayer(polyRef.current); polyRef.current = null; }

    polyRef.current = L.geoJSON(BRGY_FEATURES, {
      style: feature => {
        const name  = feature.properties.ADM4_EN;
        const data  = brgyMap[name];
        // Use dominant_color from backend (matches admin logic)
        const fill  = data?.dominant_color || NO_DATA_COLOR;
        const isSel = name === lastClickedBrgy;
        return {
          // ── Same border style as admin (white, same opacity) ──
          color: isSel ? 'white' : 'rgba(255,255,255,0.55)',
          fillColor: fill,
          fillOpacity: isSel ? 0.88 : 0.68,
          weight: isSel ? 2.5 : 1.2,
          opacity: 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const name    = feature.properties.ADM4_EN;
        const data    = brgyMap[name];
        const farmers = data?.registered_farmers ?? 0;
        const prodMT  = data?.production_mt ?? 0;
        const tier    = data?.dominant_tier;
        const color   = data?.dominant_color || NO_DATA_COLOR;

        // Tooltip matching admin style
        const tooltipHtml = tier
          ? `<div style="font-family:inherit;padding:.15rem .2rem;">
              <div style="font-size:.82rem;font-weight:800;color:#0f172a;margin-bottom:.25rem;">${name}</div>
              <div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.2rem;">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
                <span style="font-size:.72rem;font-weight:700;color:${color};">${tier}</span>
              </div>
              <div style="font-size:.68rem;color:#64748b;">${fmtNum(prodMT)} MT · ${farmers.toLocaleString()} farmers</div>
            </div>`
          : `<div style="font-family:inherit;padding:.15rem .2rem;">
              <div style="font-size:.82rem;font-weight:800;color:#0f172a;margin-bottom:.2rem;">${name}</div>
              <div style="font-size:.72rem;color:#94a3b8;">No harvest data yet</div>
            </div>`;

        layer.bindTooltip(tooltipHtml, {
          permanent: false, direction: 'top',
          className: 'pub-gis-tooltip', offset: [0, -6],
        });

        layer.on('click', () => {
          if (lastClickedBrgy === name) {
            setLastClickedBrgy(null);
            setSelectedBrgy(null);
            setPanelVisible(false);
            const fb = L.geoJSON(BRGY_FEATURES).getBounds();
            if (fb.isValid()) map.fitBounds(fb, { padding: [20, 20], animate: true });
          } else {
            setLastClickedBrgy(name);
            setSelectedBrgy(data || { name, registered_farmers: 0 });
            setPanelVisible(true);
            const feat = BRGY_FEATURES.find(f => f.properties.ADM4_EN === name);
            if (feat) {
              const b = L.geoJSON(feat).getBounds();
              if (b.isValid()) map.fitBounds(b, { padding: [50, 310], maxZoom: 14, animate: true, duration: 0.5 });
            }
          }
        });

        layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.88, weight: 2 }));
        layer.on('mouseout',  () => polyRef.current?.resetStyle(layer));
      },
    }).addTo(map);

    // ── Outline layer (same as admin) ───────────────────────────
    L.geoJSON(BRGY_FEATURES, {
      style: { color: 'white', fillOpacity: 0, weight: 2.5, opacity: 0.9, interactive: false },
    }).addTo(map);

    // ── Barangay name labels (same as admin) ────────────────────
    BRGY_FEATURES.forEach(feature => {
      const name   = feature.properties.ADM4_EN;
      const center = L.geoJSON(feature).getBounds().getCenter();
      L.marker(center, {
        icon: L.divIcon({
          html: `<div style="font-size:.85rem;font-weight:800;color:white;text-shadow:0 1px 4px rgba(0,0,0,.9),0 0 8px rgba(0,0,0,.7);white-space:nowrap;pointer-events:none;">${name}</div>`,
          className: '', iconAnchor: [36, 8],
        }),
        interactive: false,
      }).addTo(map);
    });
  }, [L, brgyMap, lastClickedBrgy]);

  const handleClose = useCallback(() => {
    setPanelVisible(false);
    setLastClickedBrgy(null);
    setSelectedBrgy(null);
    if (leafletMap.current && L) {
      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
      if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [20, 20], animate: true });
    }
  }, [L]);

  // ── Season label split ────────────────────────────────────────
  const seasonLabel   = stats?.season_label || '';
  const seasonDisplay = seasonLabel.replace('Season', '').trim(); // "Dry 2025"
  const [seasonWord, yearWord] = seasonDisplay.split(' ');

  // ── Tiles ─────────────────────────────────────────────────────
  // Total Area tile = registered farmer hectares (static from FarmerProfile)
  // Total Production = harvest-based, season-scoped
  const tiles = [
    {
      icon: Users,
      label: 'Registered Farmers',
      value: stats ? stats.total_registered_farmers.toLocaleString() : '—',
      sub: 'Official MAO registry',
      color: '#16a34a',
      accent: 'Registry',
    },
    {
      icon: TrendingUp,
      label: 'Total Production',
      value: stats ? `${fmtNum(stats.total_production_mt)} MT` : '—',
      sub: stats?.season_label || '—',
      color: '#2563eb',
      accent: 'Harvest',
    },
    {
      icon: Activity,
      label: 'Total Area',
      // ── Shows total registered farmland (from FarmerProfile.hectares) ──
      value: stats ? `${fmtNum(stats.total_area_ha)} ha` : '—',
      sub: 'Registered farmland',
      color: '#d97706',
      accent: 'Area',
    },
    {
      icon: MapPin,
      label: 'Active Barangays',
      value: stats ? stats.active_barangays.toString() : '—',
      sub: 'Out of 22 barangays',
      color: '#7c3aed',
      accent: 'Coverage',
    },
  ];

  return (
    <section id="gis-map" style={{ padding: '4rem 0', background: '#f8fafc' }}>
      <style>{`
        .pub-gis-tooltip {
          border-radius: .75rem !important;
          border: none !important;
          box-shadow: 0 4px 20px rgba(0,0,0,.18) !important;
        }
        .leaflet-container { font-family: inherit !important; }
        @keyframes pubFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pubSpin { to { transform: rotate(360deg); } }
        .pub-stat-tile:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.10) !important;
          transform: translateY(-1px);
        }
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>

        {/* Section header */}
        <div style={{ marginBottom: '1.75rem', animation: 'pubFadeUp .45s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '999px', padding: '0.2rem 0.875rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <MapPin size={11} strokeWidth={2.5} /> GIS Farm Map
            </span>
            {stats?.is_past_data && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.65rem', fontWeight: 700 }}>
                Past data
              </span>
            )}
          </div>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: 'clamp(1.4rem, 3vw, 1.75rem)', fontWeight: 800, color: '#0f172a' }}>
            Lucban farmer distribution
          </h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
            GIS farm map of barangays in Lucban, Quezon · Click a barangay to view details
          </p>
        </div>

        {/* 4 stat tiles */}
        <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.25rem', flexWrap: 'wrap', animation: 'pubFadeUp .5s ease' }}>
          {tiles.map(t => <StatTile key={t.label} {...t} />)}
        </div>

        {/* Map container */}
        <div style={{
          position: 'relative', borderRadius: '1.5rem',
          border: '1px solid #e2e8f0', overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(15,23,42,.08)',
          animation: 'pubFadeUp .55s ease',
        }}>
          {/* Toolbar */}
          <div style={{ padding: '0.55rem 0.875rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Activity size={13} color='#16a34a' />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Farmer distribution
              </span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {seasonWord && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', borderRadius: '0.5rem', padding: '0.28rem 0.65rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Season</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1a4d1a' }}>
                    {seasonWord === 'Dry' ? 'Dry Season' : 'Wet Season'}
                  </span>
                </div>
              )}
              {yearWord && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', borderRadius: '0.5rem', padding: '0.28rem 0.65rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Year</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1a4d1a' }}>{yearWord}</span>
                </div>
              )}
            </div>
          </div>

          {/* Map area */}
          <div style={{ position: 'relative', height: 'clamp(400px, 55vw, 560px)' }}>

            {loading && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 700, background: 'rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '.75rem' }}>
                <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'pubSpin .8s linear infinite' }} />
                <span style={{ fontSize: '.82rem', color: '#64748b', fontWeight: 600 }}>Loading map data…</span>
              </div>
            )}

            {!panelVisible && !loading && (
              <div style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: 'rgba(15,23,42,.72)', color: 'white', borderRadius: '999px', padding: '.4rem 1rem', fontSize: '.7rem', fontWeight: 600, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '.4rem', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
                <ChevronRight size={12} color="white" />
                Click a barangay to see details
              </div>
            )}

            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

            {/* ── Tier legend — matches admin ── */}
            <TierLegend />

            {/* ── Floating barangay detail panel ── */}
            <BrgyPanel
              brgy={selectedBrgy}
              allBrgys={brgys}
              onClose={handleClose}
              visible={panelVisible}
            />
          </div>

          {/* Bottom note */}
          <div style={{ padding: '0.55rem 1rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Activity size={11} color='#94a3b8' />
            <span style={{ fontSize: '.7rem', color: '#94a3b8' }}>
              {stats?.data_note || 'Farm data from the official MAO farmer registry.'}
              {' '}Production updates automatically per season.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PublicGisMap;