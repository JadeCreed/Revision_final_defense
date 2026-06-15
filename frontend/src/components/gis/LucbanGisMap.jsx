// src/components/gis/LucbanGisMap.jsx
// Shared GIS map core — used by AT, Brgy, and Farmer pages
// Props:
//   assignedBarangays: string[]  — filter map to these barangays only
//   role: 'AT' | 'BRGY' | 'FARMER'
//   pollId: number | null

import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import {
  getGisPlots,
  getMapSummary,
  getHarvestRecords,
  getGisActivePoll,
  getGisAllPolls,
} from '../../api/axios';
import LucbanGIS from '../../data/LucbanGIS.json';

const ALLOWED_BRGYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan',
];

const normalizeBrgy = (v) =>
  v?.toString().trim().replace(/[-_]+/g,' ').replace(/\s+/g,' ').toLowerCase();

const PHASES = [
  { key: 'Seed Distribution',  color: '#9CA3AF' },
  { key: 'Crop Establishment', color: '#3B82F6' },
  { key: 'Tillering',          color: '#22C55E' },
  { key: 'Flowering',          color: '#A855F7' },
  { key: 'Ripening',           color: '#FACC15' },
  { key: 'Harvesting',         color: '#F97316' },
];
const PHASE_MAP = Object.fromEntries(PHASES.map(p => [p.key, p]));
const NO_DATA_COLOR = '#1E293B';

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

const LucbanGisMap = ({ assignedBarangays = [], role = 'BRGY', pollId = null }) => {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const polygonRef = useRef(null);
  const [L, setL]  = useState(null);

  const [plots,          setPlots]          = useState([]);
  const [harvestRecords, setHarvestRecords] = useState([]);
  const [activeBarangay, setActiveBarangay] = useState(null);
  const [activeTab,      setActiveTab]      = useState('monitoring');
  const [loading,        setLoading]        = useState(true);
  const [summary,        setSummary]        = useState(null);

  // Filter GIS features to only assigned barangays
  const assignedSet = assignedBarangays.length > 0
    ? new Set(assignedBarangays.map(normalizeBrgy))
    : null;

  const BRGY_FEATURES = LucbanGIS.features.filter(f => {
    const name = normalizeBrgy(f.properties?.ADM4_EN);
    if (assignedSet) return assignedSet.has(name);
    return ALLOWED_BRGYS.some(b => normalizeBrgy(b) === name);
  });

  useEffect(() => { loadLeaflet().then(setL); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = pollId ? { poll_id: pollId } : {};
      // If brgy role, filter by first assigned barangay
      if (assignedBarangays.length === 1) {
        params.barangay = assignedBarangays[0];
      }
      const [plotsRes, sumRes, harvestRes] = await Promise.allSettled([
        getGisPlots(params),
        getMapSummary(params),
        getHarvestRecords(params),
      ]);
      if (plotsRes.status === 'fulfilled') {
        const d = plotsRes.value.data;
        setPlots(Array.isArray(d) ? d : (d?.plots || []));
      }
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
      if (harvestRes.status === 'fulfilled') {
        const d = harvestRes.value.data;
        setHarvestRecords(Array.isArray(d) ? d : (d?.results || []));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [pollId, assignedBarangays]);

  useEffect(() => { loadData(); }, [loadData]);

  // Init map
  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [14.1167, 121.5833], zoom: 13,
      minZoom: 11, zoomControl: true,
    });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri', maxZoom: 19,
    }).addTo(map);

    const allLayer = L.geoJSON(BRGY_FEATURES);
    const bounds   = allLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    leafletMap.current = map;
    setL(L);
  }, [L]);

  // Draw polygons
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;
    if (polygonRef.current) map.removeLayer(polygonRef.current);

    // Build phase counts per barangay
    const brgyPhaseCounts = {};
    plots.forEach(p => {
      if (!p.barangay) return;
      const phase = p.land_type || 'Seed Distribution';
      if (!brgyPhaseCounts[p.barangay]) brgyPhaseCounts[p.barangay] = {};
      brgyPhaseCounts[p.barangay][phase] = (brgyPhaseCounts[p.barangay][phase] || 0) + 1;
    });

    const getDominantColor = (name) => {
      const counts = brgyPhaseCounts[name];
      if (!counts) return NO_DATA_COLOR;
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return PHASE_MAP[sorted[0]?.[0]]?.color || NO_DATA_COLOR;
    };

    polygonRef.current = L.geoJSON(BRGY_FEATURES, {
      style: feature => {
        const name    = feature.properties.ADM4_EN;
        const isActive = name === activeBarangay;
        return {
          color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
          fillColor: getDominantColor(name),
          fillOpacity: isActive ? 0.88 : 0.68,
          weight: isActive ? 2.5 : 1.2,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.ADM4_EN;
        layer.bindTooltip(`<strong>${name}</strong>`, {
          direction: 'top', className: 'gis-tooltip',
        });
        layer.on('click', () => {
          setActiveBarangay(prev => prev === name ? null : name);
        });
      },
    }).addTo(map);

    // Labels
    BRGY_FEATURES.forEach(feature => {
      const name   = feature.properties.ADM4_EN;
      const center = L.geoJSON(feature).getBounds().getCenter();
      L.marker(center, {
        icon: L.divIcon({
          html: `<div style="font-size:0.9rem;font-weight:800;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.95);white-space:nowrap;pointer-events:none;">${name}</div>`,
          className: '', iconAnchor: [40, 8],
        }),
        interactive: false,
      }).addTo(map);
    });
  }, [L, plots, activeBarangay, BRGY_FEATURES]);

  // Stats for selected barangay or overview
  const brgyPlots = activeBarangay
    ? plots.filter(p => p.barangay === activeBarangay)
    : plots;
  const uniqueFarmers = [...new Set(brgyPlots.map(p => p.farmer))].length;
  const totalApproved = summary?.total_approved_farmers ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '500px' }}>
      <style>{`
        @keyframes gis-spin { to { transform: rotate(360deg); } }
        .leaflet-tooltip { border-radius: 0.5rem !important; border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; }
        .leaflet-container { font-family: inherit !important; }
      `}</style>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.625rem', padding: '0.175rem', gap: '0.175rem' }}>
          <button
            onClick={() => setActiveTab('monitoring')}
            style={{ padding: '0.4rem 0.875rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'monitoring' ? 'white' : 'transparent', color: activeTab === 'monitoring' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'monitoring' ? 700 : 500, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Activity size={13} /> Crop Monitoring
          </button>
          <button
            onClick={() => setActiveTab('utilization')}
            style={{ padding: '0.4rem 0.875rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === 'utilization' ? 'white' : 'transparent', color: activeTab === 'utilization' ? '#1a4d1a' : '#64748b', fontWeight: activeTab === 'utilization' ? 700 : 500, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <TrendingUp size={13} /> Crop Utilization
          </button>
        </div>

        {activeBarangay && (
          <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
            Brgy. {activeBarangay}
          </span>
        )}

        <button onClick={loadData} style={{ marginLeft: 'auto', padding: '0.4rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>
          <RefreshCw size={13} color='#64748b' style={{ animation: loading ? 'gis-spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Stats tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {[
          { label: 'Farmers', value: `${uniqueFarmers}${totalApproved ? `/${totalApproved}` : ''}` },
          { label: 'Barangays', value: assignedBarangays.length || ALLOWED_BRGYS.length },
          { label: 'Phase', value: activeTab === 'monitoring' ? 'Monitoring' : 'Utilization' },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1a4d1a' }}>{value}</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #e2e8f0', minHeight: '350px' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.85)' }}>
            <div style={{ textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: 24, height: 24, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'gis-spin 0.8s linear infinite', margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.78rem' }}>Loading map...</p>
            </div>
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '350px' }} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        {PHASES.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: '#374151' }}>
            <span style={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: p.color, display: 'inline-block' }} />
            {p.key}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LucbanGisMap;