// src/pages/at/ATGisMap.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Activity, TrendingUp, RefreshCw, AlertCircle,
  ChevronLeft, X, MapPin, Clock, Database,
} from 'lucide-react';
import API, {
  getGisPlots, getMapSummary, getHarvestRecords, getGisActivePoll,
} from '../../api/axios';
import LucbanGIS from '../../data/LucbanGIS.json';

const PHASES = [
  { key: 'Seed Distribution',  color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB', label: 'Seed Distribution'  },
  { key: 'Crop Establishment', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', label: 'Crop Establishment' },
  { key: 'Tillering',          color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', label: 'Tillering'          },
  { key: 'Flowering',          color: '#A855F7', bg: '#FAF5FF', border: '#E9D5FF', label: 'Flowering'          },
  { key: 'Ripening',           color: '#FACC15', bg: '#FEFCE8', border: '#FDE68A', label: 'Ripening'           },
  { key: 'Harvesting',         color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', label: 'Harvesting'         },
];
const PHASE_ORDER = PHASES.map(p => p.key);
const PHASE_MAP   = Object.fromEntries(PHASES.map(p => [p.key, p]));

const UTIL_TIERS = [
  { key: 'Exceeded Target', min: 100.01, color: '#166534', label: 'Exceeded Target' },
  { key: 'Achieved Target', min: 80,     color: '#15803d', label: 'Achieved Target' },
  { key: 'Near Target',     min: 70,     color: '#0369a1', label: 'Near Target'     },
  { key: 'Below Target',    min: 50,     color: '#b45309', label: 'Below Target'    },
  { key: 'Critical',        min: 0,      color: '#b91c1c', label: 'Critical'        },
];
const NO_DATA_COLOR = '#1E293B';
const TARGET_YIELD_KG_HA = { HYBRID: 5000, INBRED: 4000, OWN_SEED: 3000 };

const computeUtilPct = (rec) => {
  const bags = parseFloat(rec.harvest_bags) || 0;
  const area = parseFloat(rec.harvest_area_ha) || 0;
  const seed = rec.seed_source || 'OWN_SEED';
  const exp_kg = area * (TARGET_YIELD_KG_HA[seed] || 3000);
  if (exp_kg <= 0) return null;
  return (bags * 50 / exp_kg) * 100;
};
const getUtilTier  = (pct) => {
  if (pct == null) return null;
  if (pct > 100) return UTIL_TIERS[0];
  return UTIL_TIERS.find(t => pct >= t.min) || UTIL_TIERS[UTIL_TIERS.length - 1];
};
const getUtilColor = (pct) => getUtilTier(pct)?.color || NO_DATA_COLOR;

const ALLOWED_BRGYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan',
];
const normBrgy = v => v?.toString().trim().replace(/[-_]+/g,' ').replace(/\s+/g,' ').toLowerCase();
const fmtNum = (n, d = 2) => n != null && !isNaN(n)
  ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

const normalizePhase = (value) => {
  const p = (value || '').toString().trim();
  if (!p) return 'Seed Distribution';
  if (/^seed[\s_-]*distribution$/i.test(p) || /^distribution$/i.test(p)) return 'Seed Distribution';
  if (/^crop[\s_-]*establishment$/i.test(p)) return 'Crop Establishment';
  if (/^no[\s_-]*monitoring[\s_-]*yet$/i.test(p)) return 'Seed Distribution';
  return Object.keys(PHASE_MAP).find(k => k.toLowerCase() === p.toLowerCase()) || p;
};

const buildBrgyUtil = (harvestRecords) => {
  const result = {};
  harvestRecords.forEach(rec => {
    const brgy = ALLOWED_BRGYS.find(b => normBrgy(b) === normBrgy(rec.barangay)) || rec.barangay;
    if (!brgy) return;
    const util = computeUtilPct(rec);
    const area = parseFloat(rec.harvest_area_ha) || 0;
    const mt   = (parseFloat(rec.harvest_bags) || 0) * 50 / 1000;
    if (!result[brgy]) result[brgy] = { util_vals: [], total_area: 0, total_mt: 0, farmer_ids: new Set() };
    if (util !== null) result[brgy].util_vals.push(util);
    result[brgy].total_area += area;
    result[brgy].total_mt += mt;
    result[brgy].farmer_ids.add(rec.farmer);
  });
  Object.values(result).forEach(b => {
    b.avg_util = b.util_vals.length > 0
      ? b.util_vals.reduce((a, v) => a + v, 0) / b.util_vals.length : null;
    b.farmer_count = b.farmer_ids.size;
    delete b.farmer_ids; delete b.util_vals;
  });
  return result;
};

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

// ── Shared GIS component for AT, BRGY, FARMER ──────────────────────────────
export const RoleGisMap = ({ assignedBarangays = [], roleLabel = '', pollId = null }) => {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const polygonRef = useRef(null);
  const outlineRef = useRef(null);
  const panelRef   = useRef(null);
  const [L, setL]  = useState(null);

  const [plots,          setPlots]          = useState([]);
  const [summary,        setSummary]        = useState(null);
  const [harvestRecords, setHarvestRecords] = useState([]);
  const [approvedCounts, setApprovedCounts] = useState({});
  const [loading,        setLoading]        = useState(true);

  const [activeBarangay,  setActiveBarangay]  = useState(null);
  const [lastClickedBrgy, setLastClickedBrgy] = useState(null);
  const [activeTab,       setActiveTab]       = useState('monitoring');
  const [isMobile,        setIsMobile]        = useState(false);
  const [mobileSheet,     setMobileSheet]     = useState(false);

  // ── STRICT ISOLATION: only show assigned barangays ──
  // If no assigned barangays at all → show nothing (empty map)
  const BRGY_FEATURES = useMemo(() => {
    if (assignedBarangays.length === 0) return [];
    const assignedSet = new Set(assignedBarangays.map(normBrgy));
    return LucbanGIS.features.filter(f =>
      assignedSet.has(normBrgy(f.properties?.ADM4_EN))
    );
  }, [assignedBarangays]);

  const brgyUtilData = useMemo(() => buildBrgyUtil(harvestRecords), [harvestRecords]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { loadLeaflet().then(setL); }, []);

  const loadAll = useCallback(async () => {
    if (assignedBarangays.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = {};
      if (pollId) params.poll_id = pollId;
      // Filter to assigned barangays — use first if single, otherwise no barangay filter
      // (backend will return all, we filter client-side)

      const [plotsRes, sumRes, harvestRes] = await Promise.allSettled([
        getGisPlots(params),
        getMapSummary(params),
        getHarvestRecords(params),
      ]);

      const assignedSet = new Set(assignedBarangays.map(normBrgy));

      if (plotsRes.status === 'fulfilled') {
        const d = plotsRes.value.data;
        const rawPlots = Array.isArray(d) ? d : (d?.plots || []);
        // Filter to assigned barangays only
        setPlots(rawPlots.filter(p => p.barangay && assignedSet.has(normBrgy(p.barangay))));
        if (d?.approved_counts) setApprovedCounts(d.approved_counts);
      }
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
      if (harvestRes.status === 'fulfilled') {
        const d = harvestRes.value.data;
        const rawHarvest = Array.isArray(d) ? d : (d?.results || []);
        // Filter to assigned barangays only
        setHarvestRecords(rawHarvest.filter(r => r.barangay && assignedSet.has(normBrgy(r.barangay))));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [pollId, assignedBarangays]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Init map
  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [14.1167, 121.5833], zoom: 13,
      minZoom: 9, zoomControl: false, attributionControl: true,
    });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);

    if (BRGY_FEATURES.length > 0) {
      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], animate: false });
      }
    }
    leafletMap.current = map;
    setL(L);
  }, [L, BRGY_FEATURES]);

  // Draw polygons — only assigned barangays get a polygon
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;
    if (polygonRef.current) { map.removeLayer(polygonRef.current); polygonRef.current = null; }
    if (outlineRef.current)  { map.removeLayer(outlineRef.current); outlineRef.current = null; }
    if (BRGY_FEATURES.length === 0) return;

    const brgyPhaseCounts = {};
    plots.forEach(p => {
      if (!p.barangay) return;
      const k = normalizePhase(p.land_type);
      if (!brgyPhaseCounts[p.barangay]) brgyPhaseCounts[p.barangay] = {};
      brgyPhaseCounts[p.barangay][k] = (brgyPhaseCounts[p.barangay][k] || 0) + 1;
    });

    const getDominantPhaseColor = (name) => {
      const counts = brgyPhaseCounts[name];
      if (!counts) return NO_DATA_COLOR;
      const sorted = Object.entries(counts).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return PHASE_ORDER.indexOf(b[0]) - PHASE_ORDER.indexOf(a[0]);
      });
      return PHASE_MAP[sorted[0]?.[0]]?.color || NO_DATA_COLOR;
    };

    const getPolygonColor = (name) => {
      if (activeTab === 'utilization') {
        const util = brgyUtilData[name];
        return util?.avg_util != null ? getUtilColor(util.avg_util) : NO_DATA_COLOR;
      }
      return getDominantPhaseColor(name);
    };

    polygonRef.current = L.geoJSON(BRGY_FEATURES, {
      style: feature => {
        const name    = feature.properties.ADM4_EN;
        const isActive = name === activeBarangay;
        return {
          color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
          fillColor: getPolygonColor(name),
          fillOpacity: isActive ? 0.88 : 0.68,
          weight: isActive ? 2.5 : 1.8,
          opacity: 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.ADM4_EN;
        layer.bindTooltip(
          `<div style="font-family:inherit;padding:.1rem .15rem;">
            <div style="font-size:.82rem;font-weight:800;color:#0f172a;">${name}</div>
          </div>`,
          { permanent: false, direction: 'top', className: 'gis-tooltip', offset: [0, -6] }
        );
        layer.on('click', () => {
          if (lastClickedBrgy === name) {
            setActiveBarangay(null); setLastClickedBrgy(null);
            const fb = L.geoJSON(BRGY_FEATURES).getBounds();
            if (fb.isValid()) map.fitBounds(fb, { padding: [30, 30], animate: true });
          } else {
            setActiveBarangay(name); setLastClickedBrgy(name);
            if (isMobile) setMobileSheet(true);
            if (panelRef.current) panelRef.current.scrollTop = 0;
          }
        });
        layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.88, weight: 2.5 }));
        layer.on('mouseout',  () => polygonRef.current?.resetStyle(layer));
      },
    }).addTo(map);

    outlineRef.current = L.geoJSON(BRGY_FEATURES, {
      style: { color: 'white', fillOpacity: 0, weight: 2.5, opacity: 0.9, interactive: false },
    }).addTo(map);

    // Labels
    BRGY_FEATURES.forEach(feature => {
      const name   = feature.properties.ADM4_EN;
      const center = L.geoJSON(feature).getBounds().getCenter();
      L.marker(center, {
        icon: L.divIcon({
          html: `<div class="role-brgy-label" style="font-size:.9rem;font-weight:800;color:white;text-shadow:0 1px 4px rgba(0,0,0,.95),0 0 10px rgba(0,0,0,.8);white-space:nowrap;pointer-events:none;">${name}</div>`,
          className: '', iconAnchor: [40, 8],
        }),
        interactive: false,
      }).addTo(map);
    });
  }, [L, plots, activeBarangay, isMobile, activeTab, brgyUtilData, lastClickedBrgy, BRGY_FEATURES]);

  // Zoom to selected brgy
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L || !activeBarangay) return;
    const feature = BRGY_FEATURES.find(f => f.properties.ADM4_EN === activeBarangay);
    if (!feature) return;
    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
  }, [L, activeBarangay, BRGY_FEATURES]);

  const handleBack = useCallback(() => {
    setActiveBarangay(null); setLastClickedBrgy(null); setMobileSheet(false);
    if (panelRef.current) panelRef.current.scrollTop = 0;
    if (leafletMap.current && L && BRGY_FEATURES.length > 0) {
      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
      if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [30, 30], animate: true });
    }
  }, [L, BRGY_FEATURES]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab); setActiveBarangay(null); setLastClickedBrgy(null); setMobileSheet(false);
    if (leafletMap.current && L && BRGY_FEATURES.length > 0) {
      const bounds = L.geoJSON(BRGY_FEATURES).getBounds();
      if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [30, 30], animate: true });
    }
  }, [L, BRGY_FEATURES]);

  // ── Panel data ──
  const brgyPlots   = activeBarangay ? plots.filter(p => p.barangay === activeBarangay) : plots;
  const brgyHarvest = activeBarangay ? harvestRecords.filter(r => r.barangay === activeBarangay) : harvestRecords;
  const uniqueFarmers = [...new Set(brgyPlots.map(p => p.farmer))].length;
  const totalApproved = activeBarangay
    ? (approvedCounts?.[activeBarangay] || brgyPlots[0]?.total_approved_in_brgy || 0)
    : (summary?.total_approved_farmers ?? 0);
  const encodedCount = [...new Set(brgyHarvest.map(r => r.farmer))].length;
  const harvestMT    = brgyHarvest.reduce((s, r) => s + ((parseFloat(r.harvest_bags) || 0) * 50) / 1000, 0);
  const harvestArea  = brgyHarvest.reduce((s, r) => s + (parseFloat(r.harvest_area_ha) || 0), 0);

  const phaseCounts = {};
  brgyPlots.forEach(p => {
    const ph = normalizePhase(p.land_type);
    phaseCounts[ph] = (phaseCounts[ph] || 0) + 1;
  });
  const phaseList = Object.entries(phaseCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count, color: PHASE_MAP[key]?.color || '#9ca3af' }));

  const utilCounts = {};
  brgyHarvest.forEach(r => {
    const tier = getUtilTier(computeUtilPct(r));
    const key  = tier?.key || 'Critical';
    utilCounts[key] = (utilCounts[key] || 0) + 1;
  });
  const utilList = UTIL_TIERS.map(t => ({ ...t, count: utilCounts[t.key] || 0 })).filter(t => t.count > 0);

  const now = new Date();
  const ts  = `${now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · ${now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
  const roleLabelShort = roleLabel.replace('Agricultural Technician', 'AT').replace('Barangay President', 'Brgy. Pres.');

  // ── Panel Content ──
  const PanelContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {activeTab === 'utilization' ? <TrendingUp size={15} color='#1a4d1a' /> : <Activity size={15} color='#1a4d1a' />}
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
          {activeBarangay ? `Brgy. ${activeBarangay}` : activeTab === 'utilization' ? 'Utilization overview' : 'Monitoring overview'}
        </span>
        {activeBarangay && (
          <button onClick={handleBack} style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Body */}
      <div ref={panelRef} style={{ flex: 1, overflowY: 'auto', paddingTop: '0' }} className='role-gis-scroll'>
        {/* Overview green card */}
        <div style={{ padding: '1rem 1.25rem 0.75rem', flexShrink: 0 }}>
          <div style={{ background: 'linear-gradient(135deg,#1a4d1a,#166534)', borderRadius: '1.25rem', padding: '1rem 1.25rem', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
              {activeTab === 'utilization'
                ? <TrendingUp size={14} color='rgba(255,255,255,0.8)' />
                : <Activity   size={14} color='rgba(255,255,255,0.8)' />}
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {activeBarangay ? `Brgy. ${activeBarangay}` : `${roleLabelShort} overview`}
              </span>
              {!activeBarangay && <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '999px', padding: '0.15rem 0.5rem', fontSize: '0.6rem', fontWeight: 700 }}>LIVE</span>}
            </div>

            {activeBarangay && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button onClick={handleBack} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '0.5rem', color: 'white', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600 }}>
                  <ChevronLeft size={13} /> Back
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={14} color='white' />
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>Brgy. {activeBarangay}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'monitoring' ? '1fr 1fr' : 'repeat(3,1fr)', gap: '0.5rem' }}>
              {activeTab === 'monitoring' ? (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '0.625rem', padding: '0.5rem 0.625rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>
                      {totalApproved ? `${uniqueFarmers}/${totalApproved}` : uniqueFarmers}
                    </p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.58rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 600 }}>Farmers</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '0.625rem', padding: '0.5rem 0.625rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>
                      {assignedBarangays.length}
                    </p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.58rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 600 }}>Barangays</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '0.625rem', padding: '0.5rem 0.625rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'white' }}>{encodedCount}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.55rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 600 }}>Encoded</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '0.625rem', padding: '0.5rem 0.625rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'white' }}>{harvestMT > 0 ? `${fmtNum(harvestMT)}` : '—'}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.55rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 600 }}>MT</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '0.625rem', padding: '0.5rem 0.625rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'white' }}>{harvestArea > 0 ? `${fmtNum(harvestArea)}` : '—'}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.55rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: 600 }}>Ha</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ padding: '0 1.25rem 1rem' }}>
          {activeTab === 'monitoring' ? (
            phaseList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                <MapPin size={26} color='#cbd5e1' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.8rem' }}>No monitoring data yet.</p>
              </div>
            ) : (
              <>
                <p style={{ margin: '0 0 0.625rem', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Crop phase breakdown
                </p>
                {phaseList.map((ph, i) => {
                  const total = phaseList.reduce((s, p) => s + p.count, 0);
                  const pct   = Math.round((ph.count / total) * 100);
                  return (
                    <div key={ph.key} style={{ marginBottom: '0.625rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ph.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: i === 0 ? 700 : 500, color: '#374151' }}>{ph.key}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 5, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: ph.color, borderRadius: '999px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </>
            )
          ) : (
            utilList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                <TrendingUp size={26} color='#d1d5db' style={{ display: 'block', margin: '0 auto 0.5rem' }} />
                <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.25rem', fontSize: '0.82rem' }}>No harvest data yet</p>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Utilization appears once harvest is encoded.</p>
              </div>
            ) : (
              <>
                <p style={{ margin: '0 0 0.625rem', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Utilization breakdown
                </p>
                {utilList.map((tier, i) => {
                  const total = utilList.reduce((s, t) => s + t.count, 0);
                  const pct   = Math.round((tier.count / total) * 100);
                  return (
                    <div key={tier.key} style={{ marginBottom: '0.625rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tier.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: i === 0 ? 700 : 500, color: '#374151' }}>{tier.label}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>{tier.count}</span>
                      </div>
                      <div style={{ height: 5, backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: tier.color, borderRadius: '999px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </>
            )
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '0.625rem 0.875rem', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', flexShrink: 0 }}>
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '0.625rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
            <Clock size={11} color='#64748b' />
            <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Last updated</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: '#1e293b' }}>{ts}</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '0.625rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
            <Database size={11} color='#64748b' />
            <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Data source</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: '#16a34a' }}>
            {activeTab === 'utilization' ? 'Harvest records' : 'AT monitoring'}
          </p>
        </div>
      </div>
    </div>
  );

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      // Fill the UserLayout content area — same trick as admin GisMap
      padding: '1rem', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes role-gis-spin  { to { transform: rotate(360deg); } }
        @keyframes role-gis-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .leaflet-tooltip { border-radius:.75rem !important; border:none !important; box-shadow:0 4px 20px rgba(0,0,0,.18) !important; }
        .role-gis-scroll::-webkit-scrollbar { width:4px; }
        .role-gis-scroll::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:99px; }
        .leaflet-container { font-family:inherit !important; height:100% !important; }
      `}</style>

      {/* Title */}
      {!isMobile && (
        <div style={{ paddingBottom: '0.5rem', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16a34a' }}>
            GIS Map · {roleLabel}
            {assignedBarangays.length > 0 && (
              <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '0.5rem' }}>
                — {assignedBarangays.join(', ')}
              </span>
            )}
          </p>
        </div>
      )}

      {/* No assignment warning */}
      {assignedBarangays.length === 0 && !loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem', color: '#94a3b8' }}>
          <MapPin size={32} color='#cbd5e1' />
          <p style={{ margin: 0, fontWeight: 700, color: '#374151' }}>No barangay assigned</p>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>Contact your administrator to assign a barangay.</p>
        </div>
      )}

      {/* DESKTOP layout */}
      {!isMobile && assignedBarangays.length > 0 && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', gap: '0.65rem' }}>
          {/* LEFT — MAP */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(15,23,42,.08)', overflow: 'hidden', minHeight: 0 }}>
            {/* Toolbar */}
            <div style={{ padding: '0.55rem 0.875rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.625rem', padding: '0.175rem', gap: '0.175rem' }}>
                <button onClick={() => handleTabChange('monitoring')} style={{ padding: '0.32rem 0.7rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'monitoring' ? 'white' : 'transparent', color: activeTab === 'monitoring' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'monitoring' ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: activeTab === 'monitoring' ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
                  <Activity size={12} /> Crop monitoring
                </button>
                <button onClick={() => handleTabChange('utilization')} style={{ padding: '0.32rem 0.7rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'utilization' ? 'white' : 'transparent', color: activeTab === 'utilization' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'utilization' ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: activeTab === 'utilization' ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
                  <TrendingUp size={12} /> Crop utilization
                </button>
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderLeft: '1px solid #e2e8f0', padding: '0 0.75rem', overflowX: 'auto', flexShrink: 0 }}>
                {(activeTab === 'utilization' ? UTIL_TIERS : PHASES).map((item, idx, arr) => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0 0.4rem', borderRight: idx < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.65rem', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>{item.label || item.key}</span>
                  </div>
                ))}
              </div>
              <button onClick={loadAll} style={{ marginLeft: 'auto', padding: '0.32rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', flexShrink: 0 }}>
                <RefreshCw size={13} color='#64748b' style={{ animation: loading ? 'role-gis-spin 0.8s linear infinite' : 'none' }} />
              </button>
            </div>

            {/* Map */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              {loading && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' }}>
                  <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ width: 26, height: 26, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'role-gis-spin 0.8s linear infinite', margin: '0 auto 0.625rem' }} />
                    Loading map...
                  </div>
                </div>
              )}
              <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 0 }} />
            </div>

            {/* Map footer */}
            <div style={{ padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={11} color='#94a3b8' />
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                {activeTab === 'utilization'
                  ? 'Utilization from harvest records. Targets: Hybrid 5,000 · Certified 4,000 · Farmer saved 3,000 kg/ha'
                  : 'Crop phase data from AT monitoring visits. Updates in real-time.'}
              </span>
            </div>
          </div>

          {/* RIGHT — PANEL */}
          <div style={{ width: 'clamp(260px, 22vw, 310px)', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(15,23,42,.08)', overflow: 'hidden', minHeight: 0, height: '100%' }}>
            <PanelContent />
          </div>
        </div>
      )}

      {/* MOBILE layout */}
      {isMobile && assignedBarangays.length > 0 && (
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
          {/* Map fills full area */}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Tab switcher pill */}
          {!mobileSheet && (
            <div style={{ position: 'absolute', top: '0.75rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500, display: 'flex', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '999px', padding: '0.2rem', gap: '0.2rem', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
              <button onClick={() => handleTabChange('monitoring')} style={{ padding: '0.4rem 0.875rem', borderRadius: '999px', border: 'none', backgroundColor: activeTab === 'monitoring' ? '#1a4d1a' : 'transparent', color: activeTab === 'monitoring' ? 'white' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Activity size={13} /> Monitoring
              </button>
              <button onClick={() => handleTabChange('utilization')} style={{ padding: '0.4rem 0.875rem', borderRadius: '999px', border: 'none', backgroundColor: activeTab === 'utilization' ? '#1a4d1a' : 'transparent', color: activeTab === 'utilization' ? 'white' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <TrendingUp size={13} /> Utilization
              </button>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.85)' }}>
              <div style={{ width: 26, height: 26, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'role-gis-spin 0.8s linear infinite' }} />
            </div>
          )}

          {/* Bottom sheet */}
          {mobileSheet && (
            <>
              <div onClick={() => setMobileSheet(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 700 }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 800, backgroundColor: 'white', borderRadius: '1.25rem 1.25rem 0 0', maxHeight: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,.14)', animation: 'role-gis-sheet 0.35s cubic-bezier(0.34,1.1,0.64,1)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div style={{ width: 44, height: 4, backgroundColor: '#e2e8f0', borderRadius: '999px', margin: '0.75rem auto', flexShrink: 0 }} />
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className='role-gis-scroll'>
                  <PanelContent />
                </div>
              </div>
            </>
          )}

          {/* FAB button */}
          {!mobileSheet && (
            <button onClick={() => setMobileSheet(true)} style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 600, backgroundColor: '#1a4d1a', color: 'white', border: 'none', borderRadius: '999px', padding: '0.7rem 1.1rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {activeTab === 'utilization' ? <TrendingUp size={15} /> : <Activity size={15} />}
              Overview
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── ATGisMap wrapper ────────────────────────────────────────────────────────
const ATGisMap = () => {
  const [assignedBarangays, setAssignedBarangays] = useState(null); // null = loading
  const [activePoll,        setActivePoll]        = useState(null);

  useEffect(() => {
    Promise.allSettled([
      API.get('/accounts/me/'),
      getGisActivePoll(),
    ]).then(([meRes, pollRes]) => {
      if (meRes.status === 'fulfilled') {
        const data = meRes.value.data;
        // AT can have assigned_barangays (array) or barangay (string)
        const raw = data?.assigned_barangays || (data?.barangay ? [data.barangay] : []);
        setAssignedBarangays(Array.isArray(raw) ? raw.filter(Boolean) : [raw].filter(Boolean));
      } else {
        setAssignedBarangays([]);
      }
      if (pollRes.status === 'fulfilled') setActivePoll(pollRes.value.data);
    });
  }, []);

  if (assignedBarangays === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ width: 24, height: 24, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'role-gis-spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <RoleGisMap
      assignedBarangays={assignedBarangays}
      roleLabel="Agricultural Technician"
      pollId={activePoll?.poll_id || null}
    />
  );
};

export default ATGisMap;