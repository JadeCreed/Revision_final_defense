// src/pages/admin/GisMap.jsx
// ============================================================
// GIS MAP — Farm Plot Tracker
// Layout: map (left 60%) | details panel (right 40%)
// Uses Leaflet via CDN (no npm install needed)
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MapPin, Users, Wheat, Search, Plus, X,
  ChevronDown, CheckCircle, AlertCircle,
  Layers, Filter, Trash2, Edit2, RefreshCw,
} from 'lucide-react';
import { getGisPlots, createGisPlot, updateGisPlot, deleteGisPlot, getMapSummary, getGisBarangays } from '../../api/axios';
import API from '../../api/axios';
import LucbanGIS from '../../data/LucbanGIS.json';

const GREEN = { primary: '#1a4d1a', light: '#f0fdf4', border: '#bbf7d0', accent: '#166534', soft: '#dcfce7' };
const BRGY_FEATURES = LucbanGIS.features.filter((feature) => !feature.properties?.ADM4_EN?.includes('(Pob.)'));
const BRGY_POLYGON_STYLE = {
  color: '#2563eb',
  fillColor: '#2563eb',
  fillOpacity: 0.08,
  weight: 1.8,
  opacity: 0.85,
  lineJoin: 'round',
  lineCap: 'round',
};
const BRGY_OUTLINE_STYLE = {
  color: '#1d4ed8',
  fillOpacity: 0,
  weight: 3.4,
  opacity: 0.95,
  lineJoin: 'round',
  lineCap: 'round',
};

// ── Leaflet loader (CDN) ───────────────────────────────────────────────────
let leafletLoaded = false;
const loadLeaflet = () =>
  new Promise((resolve) => {
    if (window.L) { resolve(window.L); return; }
    if (leafletLoaded) {
      const wait = setInterval(() => { if (window.L) { clearInterval(wait); resolve(window.L); } }, 50);
      return;
    }
    leafletLoaded = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = () => resolve(window.L);
    document.head.appendChild(js);
  });

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 999,
      backgroundColor: toast.type === 'error' ? '#991b1b' : GREEN.primary,
      color: 'white', padding: '0.7rem 1.25rem', borderRadius: '999px',
      fontSize: '0.85rem', fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: '0.45rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
      animation: 'popIn 0.35s ease', maxWidth: 'calc(100vw - 2rem)',
    }}>
      {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
      {toast.msg}
    </div>
  );
};

const PHASE_COLORS = {
  'Seed Distribution': '#E5E7EB',
  'Crop Establishment': '#3B82F6',
  'Tillering': '#22C55E',
  'Flowering': '#A855F7',
  'Ripening': '#FACC15',
  'Harvesting': '#F97316',
};
const phaseColor = (phase) => PHASE_COLORS[phase] || '#64748b';

const GisMap = () => {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef({});
  const polygonLayer = useRef(null);
  const outlineLayer = useRef(null);
  const polygonLabelLayer = useRef(null);
  const [L, setL] = useState(null);

  const [plots, setPlots] = useState([]);
  const [summary, setSummary] = useState(null);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeBarangay, setActiveBarangay] = useState(null);

  const [filterBrgy, setFilterBrgy] = useState('');
  const [filterPhase, setFilterPhase] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ farmer_id: '', label: 'Main Farm', latitude: '', longitude: '', area_ha: '', land_type: 'Irrigated' });
  const [addErrors, setAddErrors] = useState({});
  const [adding, setAdding] = useState(false);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [farmerResults, setFarmerResults] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [pickMode, setPickMode] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    loadLeaflet().then(setL);
  }, []);

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

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [14.1167, 121.6833],
      zoom: 13,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    leafletMap.current = map;
    setL(L);
  }, [L]);

  const filteredPlots = useMemo(() => plots.filter((plot) => {
    const q = searchQ.trim().toLowerCase();
    const matchesSearch = !q || plot.farmer_name?.toLowerCase().includes(q) || plot.barangay?.toLowerCase().includes(q);
    const matchesBrgy = !filterBrgy || plot.barangay?.toLowerCase() === filterBrgy.toLowerCase();
    const matchesPhase = !filterPhase || plot.land_type === filterPhase;
    return matchesSearch && matchesBrgy && matchesPhase;
  }), [plots, searchQ, filterBrgy, filterPhase]);

  const activeBarangayPlots = useMemo(() => {
    if (!activeBarangay) return [];
    return filteredPlots.filter((plot) => plot.barangay === activeBarangay);
  }, [filteredPlots, activeBarangay]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;

    if (polygonLayer.current) {
      map.removeLayer(polygonLayer.current);
      polygonLayer.current = null;
    }
    if (polygonLabelLayer.current) {
      map.removeLayer(polygonLabelLayer.current);
      polygonLabelLayer.current = null;
    }

    polygonLayer.current = L.geoJSON(BRGY_FEATURES, {
      style: (feature) => {
        const isActive = feature.properties.ADM4_EN === activeBarangay;
        return {
          ...BRGY_POLYGON_STYLE,
          fillOpacity: isActive ? 0.22 : 0.08,
          weight: isActive ? 2.5 : 1.8,
          color: isActive ? '#1d4ed8' : '#2563eb',
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.ADM4_EN;
        layer.on('click', () => {
          setActiveBarangay(name);
          setSelected(null);
        });
      },
    }).addTo(map);

    if (outlineLayer.current) {
      map.removeLayer(outlineLayer.current);
      outlineLayer.current = null;
    }
    outlineLayer.current = L.geoJSON(BRGY_FEATURES, {
      style: BRGY_OUTLINE_STYLE,
      interactive: false,
    }).addTo(map);

  }, [L, activeBarangay]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L || !activeBarangay) return;
    const feature = BRGY_FEATURES.find((item) => item.properties.ADM4_EN === activeBarangay);
    if (!feature) return;
    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [L, activeBarangay]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;

    Object.values(markersRef.current).forEach((marker) => map.removeLayer(marker));
    markersRef.current = {};

    filteredPlots.forEach((plot) => {
      const lat = parseFloat(plot.latitude);
      const lng = parseFloat(plot.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;

      const color = phaseColor(plot.land_type);
      const isSelected = selected?.id === plot.id;
      const icon = L.divIcon({
        html: `<div style="width:${isSelected ? 20 : 14}px; height:${isSelected ? 20 : 14}px; border-radius:50%; background:${color}; border:3px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.7)'}; box-shadow:0 2px 10px rgba(0,0,0,${isSelected ? 0.45 : 0.28}); transition:all 0.2s;"></div>`,
        className: '',
        iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
        iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7],
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .on('click', () => {
          setSelected(plot);
          setActiveBarangay(plot.barangay);
        });

      marker.bindTooltip(`
        <div style="font-size:0.75rem;font-weight:700;color:#1a1a1a;">${plot.farmer_name || '—'}</div>
        <div style="font-size:0.65rem;color:#6b7280;">${plot.barangay} · ${plot.label || 'Farm'}</div>
        <div style="font-size:0.65rem;color:${color};font-weight:600;">${plot.land_type || '—'} · ${plot.area_ha ? plot.area_ha + ' ha' : '—'}</div>
      `, { permanent: false, direction: 'top', offset: [0, -10] });

      markersRef.current[plot.id] = marker;
    });
  }, [filteredPlots, selected, L]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const handler = (e) => {
      if (!pickMode) return;
      setAddForm((p) => ({ ...p, latitude: e.latlng.lat.toFixed(6), longitude: e.latlng.lng.toFixed(6) }));
      setPickMode(false);
      showToast('Location picked. Fill in the rest and save.');
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [pickMode, showToast]);

  const farmerTimer = useRef(null);
  const handleFarmerSearch = (q) => {
    setFarmerSearch(q);
    if (farmerTimer.current) clearTimeout(farmerTimer.current);
    if (q.length < 2) { setFarmerResults([]); return; }
    farmerTimer.current = setTimeout(async () => {
      try {
        const res = await API.get('/accounts/farmers/', { params: { search: q, status: 'APPROVED' } });
        setFarmerResults((res.data?.results || res.data || []).slice(0, 8));
      } catch {
        setFarmerResults([]);
      }
    }, 250);
  };

  const handleAddPlot = async () => {
    const errs = {};
    if (!selectedFarmer) errs.farmer = 'Select a farmer';
    if (!addForm.latitude) errs.latitude = 'Required';
    if (!addForm.longitude) errs.longitude = 'Required';
    if (Object.keys(errs).length) { setAddErrors(errs); return; }

    setAdding(true);
    try {
      await createGisPlot({
        farmer: selectedFarmer.id,
        barangay: selectedFarmer.barangay || '',
        label: addForm.label,
        latitude: addForm.latitude,
        longitude: addForm.longitude,
        area_ha: addForm.area_ha || null,
        land_type: addForm.land_type,
      });
      setAddModal(false);
      setAddForm({ farmer_id: '', label: 'Main Farm', latitude: '', longitude: '', area_ha: '', land_type: 'Irrigated' });
      setSelectedFarmer(null);
      setFarmerSearch('');
      setFarmerResults([]);
      setAddErrors({});
      await loadAll();
      showToast('Farm plot added to map.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add plot.', 'error');
    } finally { setAdding(false); }
  };

  const handleDelete = async (plot) => {
    try {
      await deleteGisPlot(plot.id);
      if (selected?.id === plot.id) setSelected(null);
      await loadAll();
      showToast('Plot removed from map.');
    } catch {
      showToast('Failed to delete.', 'error');
    }
  };

  useEffect(() => {
    if (!selected || !leafletMap.current) return;
    const lat = parseFloat(selected.latitude);
    const lng = parseFloat(selected.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      leafletMap.current.flyTo([lat, lng], 16, { duration: 0.8 });
    }
  }, [selected]);

  const inp = (hasErr = false) => ({
    padding: '0.6rem 0.875rem', border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: 'white',
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      <style>{`
        @keyframes popIn { 0%{opacity:0;transform:translateX(-50%) scale(0.88)} 60%{transform:translateX(-50%) scale(1.04)} 100%{opacity:1;transform:translateX(-50%) scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .plot-row:hover { background-color: #f0fdf4 !important; cursor: pointer; }
        .leaflet-container { font-family: inherit !important; }
      `}</style>
      <Toast toast={toast} />

      <div style={{ flex: 1, display: 'flex', gap: '1rem', padding: '1.25rem', overflow: 'hidden', alignItems: 'stretch' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #d1d5db', boxShadow: '0 18px 45px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '0.95rem 1.25rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '180px' }}>
              <Search size={13} color='#9ca3af' style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder='Search farmer or barangay...' style={{ padding: '0.55rem 0.85rem 0.55rem 2.3rem', border: '1px solid #cbd5e1', borderRadius: '0.75rem', width: '100%', outline: 'none', fontSize: '0.86rem', boxSizing: 'border-box', color: '#0f172a', backgroundColor: '#f8fafc' }} />
            </div>
            <select value={filterBrgy} onChange={(e) => setFilterBrgy(e.target.value)} style={{ padding: '0.55rem 0.95rem', border: '1px solid #cbd5e1', borderRadius: '0.75rem', backgroundColor: 'white', fontSize: '0.86rem', outline: 'none', minWidth: '170px' }}>
              <option value=''>All Barangays</option>
              {barangays.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)} style={{ padding: '0.55rem 0.95rem', border: '1px solid #cbd5e1', borderRadius: '0.75rem', backgroundColor: 'white', fontSize: '0.86rem', outline: 'none', minWidth: '145px' }}>
              <option value=''>All Phases</option>
              {Object.keys(PHASE_COLORS).map((phase) => <option key={phase} value={phase}>{phase}</option>)}
            </select>
            {(searchQ || filterBrgy || filterPhase) && (
              <button onClick={() => { setSearchQ(''); setFilterBrgy(''); setFilterPhase(''); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 0.85rem', border: '1px solid #fecaca', borderRadius: '0.75rem', backgroundColor: '#fff1f2', color: '#b91c1c', fontSize: '0.82rem', cursor: 'pointer' }}>
                <X size={12} /> Clear
              </button>
            )}
            <button onClick={loadAll} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 0.85rem', border: '1px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', color: '#374151', fontSize: '0.82rem', cursor: 'pointer' }}>
              <RefreshCw size={12} /> Refresh
            </button>
            <span style={{ marginLeft: 'auto', color: '#475569', fontSize: '0.86rem' }}>{filteredPlots.length} plots</span>
          </div>

          <div style={{ flex: 1, minHeight: '560px', position: 'relative' }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)' }}>
                <div style={{ textAlign: 'center', color: '#475569' }}>
                  <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.75rem' }} />
                  Loading map data...
                </div>
              </div>
            )}
            {pickMode && (
              <div style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500, backgroundColor: '#111827', color: 'white', padding: '0.6rem 1.1rem', borderRadius: '999px', fontSize: '0.84rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.45rem', pointerEvents: 'none' }}>
                <MapPin size={14} /> Click on the map to pick a location
              </div>
            )}
            <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid #cbd5e1' }} />
          </div>

          <div style={{ padding: '0.95rem 1.25rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', backgroundColor: '#f8fafc' }}>
            {Object.entries(PHASE_COLORS).map(([phase, color]) => (
              <div key={phase} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.85rem', borderRadius: '0.85rem', backgroundColor: 'white', border: '1px solid #cbd5e1', color: '#334155', fontSize: '0.84rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                {phase}
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: '380px', display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #d1d5db', boxShadow: '0 18px 45px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          {(selected || activeBarangay) ? (
            <>
              <div style={{ backgroundColor: selected ? GREEN.primary : '#1d4ed8', color: 'white', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <p style={{ margin: 0, opacity: 0.75, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {selected ? 'Selected Plot' : 'Selected Barangay'}
                    </p>
                    <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.1rem', fontWeight: 800 }}>
                      {selected ? selected.farmer_name || '—' : activeBarangay || '—'}
                    </h2>
                    <p style={{ margin: '0.5rem 0 0', color: 'rgba(255,255,255,0.88)', fontSize: '0.85rem' }}>
                      {selected ? `${selected.barangay} · ${selected.label}` : activeBarangay}
                    </p>
                  </div>
                  <button onClick={() => { setSelected(null); setActiveBarangay(null); }} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '0.65rem', color: 'white', padding: '0.5rem', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>

                {selected ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                    {[
                      { label: 'Area', value: selected.area_ha ? `${selected.area_ha} ha` : '—' },
                      { label: 'Dominant Phase', value: selected.land_type || '—' },
                      { label: 'RSBSA', value: selected.farmer_rsbsa || '—' },
                    ].map((item) => (
                      <div key={item.label} style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '0.9rem', padding: '0.85rem' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800 }}>{item.value}</p>
                        <p style={{ margin: '0.35rem 0 0', opacity: 0.8, fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                    {[
                      { label: 'Plots', value: activeBarangayPlots.length },
                      { label: 'Total hectares', value: activeBarangayPlots.reduce((sum, plot) => sum + (parseFloat(plot.area_ha) || 0), 0).toFixed(2) || '—' },
                      { label: 'Phase breakdown', value: [...new Set(activeBarangayPlots.map((plot) => plot.land_type))].filter(Boolean).join(', ') || '—' },
                    ].map((item) => (
                      <div key={item.label} style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '0.9rem', padding: '0.85rem' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800 }}>{item.value}</p>
                        <p style={{ margin: '0.35rem 0 0', opacity: 0.8, fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected ? (
                <>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {[
                        { label: 'Latitude', value: selected.latitude || '—' },
                        { label: 'Longitude', value: selected.longitude || '—' },
                      ].map((item) => (
                        <div key={item.label}>
                          <p style={{ margin: 0, fontSize: '0.65rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</p>
                          <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {selected.farmer_contact && (
                      <div style={{ marginTop: '0.9rem' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Contact</p>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', fontWeight: 600, color: '#111827' }}>{selected.farmer_contact}</p>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button
                      onClick={() => {
                        const lat = parseFloat(selected.latitude);
                        const lng = parseFloat(selected.longitude);
                        if (!Number.isNaN(lat) && !Number.isNaN(lng)) leafletMap.current?.flyTo([lat, lng], 16, { duration: 0.8 });
                      }}
                      style={{ backgroundColor: GREEN.light, color: GREEN.accent, border: `1px solid ${GREEN.border}`, borderRadius: '0.85rem', padding: '0.9rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                      <MapPin size={14} /> Zoom In
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`Remove ${selected.farmer_name || 'this'} plot?`)) handleDelete(selected); }}
                      style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.85rem', padding: '0.9rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>Other plots in {selected.barangay}</p>
                    </div>
                    {filteredPlots.filter((plot) => plot.barangay === selected.barangay && plot.id !== selected.id).length === 0 ? (
                      <p style={{ padding: '1rem 1.25rem', color: '#6b7280', fontSize: '0.88rem' }}>No other plots in this barangay.</p>
                    ) : filteredPlots.filter((plot) => plot.barangay === selected.barangay && plot.id !== selected.id).map((plot) => (
                      <div
                        key={plot.id}
                        onClick={() => setSelected(plot)}
                        style={{ padding: '0.95rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>{plot.farmer_name}</p>
                          <p style={{ margin: '0.3rem 0 0', color: '#6b7280', fontSize: '0.78rem' }}>{plot.label} · {plot.area_ha ? `${plot.area_ha} ha` : '—'}</p>
                        </div>
                        <span style={{ width: 10, height: 10, borderRadius: '999px', backgroundColor: phaseColor(plot.land_type), display: 'inline-block' }} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
                    <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#111827' }}>Barangay summary</p>
                    <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.82rem' }}>Plots in {activeBarangay}</p>
                  </div>
                  <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '0.75rem' }}>
                    {activeBarangayPlots.length === 0 ? (
                      <p style={{ color: '#6b7280', fontSize: '0.88rem' }}>No active plots found in this barangay.</p>
                    ) : activeBarangayPlots.map((plot) => (
                      <div key={plot.id} onClick={() => setSelected(plot)} style={{ padding: '0.95rem 1rem', border: '1px solid #e5e7eb', borderRadius: '1rem', cursor: 'pointer' }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>{plot.farmer_name}</p>
                        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.81rem' }}>{plot.label} · {plot.area_ha ? `${plot.area_ha} ha` : '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
                <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#111827' }}>Map overview</p>
                <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.82rem' }}>Select a barangay or marker from the map.</p>
              </div>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  Loading...
                </div>
              ) : filteredPlots.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  <MapPin size={32} color='#d1d5db' />
                  <p style={{ margin: '0.75rem 0 0', fontWeight: 700, color: '#111827' }}>No data available.</p>
                  <p style={{ margin: '0.35rem 0 0', color: '#6b7280' }}>Try changing filters or refresh to update phase data.</p>
                </div>
              ) : (
                <div style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '1.2rem', padding: '1.1rem', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>Total Farmers</p>
                    <p style={{ margin: '0.45rem 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{summary?.total_farmers || '2,430'}</p>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '1.2rem', padding: '1.1rem', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>Total Barangays</p>
                    <p style={{ margin: '0.45rem 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{summary?.barangays || 22}</p>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '1.2rem', padding: '1.15rem', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>Current Phase Distribution</p>
                    {[
                      { label: 'Tillering', value: '42%', color: PHASE_COLORS['Tillering'] },
                      { label: 'Crop Establishment', value: '28%', color: PHASE_COLORS['Crop Establishment'] },
                      { label: 'Flowering', value: '15%', color: PHASE_COLORS['Flowering'] },
                      { label: 'Ripening', value: '10%', color: PHASE_COLORS['Ripening'] },
                      { label: 'Harvesting', value: '5%', color: PHASE_COLORS['Harvesting'] },
                    ].map((phase) => (
                      <div key={phase.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.95rem', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ width: 12, height: 12, borderRadius: '999px', backgroundColor: phase.color, display: 'inline-block' }} />
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>{phase.label}</p>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{phase.value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '1.2rem', padding: '1.1rem', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>Most Active Phase</p>
                    <p style={{ margin: '0.45rem 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Tillering (42%)</p>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '1.2rem', padding: '1.1rem', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>Last Updated</p>
                    <p style={{ margin: '0.45rem 0 0', fontSize: '0.95rem', color: '#0f172a' }}>{summary?.last_updated || 'Jan 15, 2026 | 2:30 PM'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {addModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '520px', backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.75rem', boxShadow: '0 22px 60px rgba(15,23,42,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#111827' }}>Add Plot</h2>
              <button onClick={() => { setAddModal(false); setAddErrors({}); setSelectedFarmer(null); setFarmerSearch(''); setFarmerResults([]); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Farmer <span style={{ color: '#dc2626' }}>*</span></label>
              {selectedFarmer ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 0.95rem', borderRadius: '0.85rem', border: `1.5px solid ${GREEN.border}`, backgroundColor: GREEN.light }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: GREEN.accent }}>{selectedFarmer.last_name}, {selectedFarmer.first_name}</p>
                    <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.82rem' }}>{selectedFarmer.rsbsa_number || 'No RSBSA'} · {selectedFarmer.barangay}</p>
                  </div>
                  <button onClick={() => { setSelectedFarmer(null); setFarmerSearch(''); }} style={{ border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}><X size={16} /></button>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} color='#9ca3af' style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input value={farmerSearch} onChange={(e) => handleFarmerSearch(e.target.value)} placeholder='Search farmer by name...' style={{ ...inp(!!addErrors.farmer), paddingLeft: '2.3rem' }} />
                  </div>
                  {farmerResults.length > 0 && (
                    <div style={{ marginTop: '0.65rem', border: '1px solid #e5e7eb', borderRadius: '0.85rem', overflow: 'hidden' }}>
                      {farmerResults.map((farmer, index) => (
                        <div key={farmer.id} onClick={() => { setSelectedFarmer(farmer); setFarmerSearch(''); setFarmerResults([]); setAddErrors((prev) => ({ ...prev, farmer: '' })); }} style={{ padding: '0.85rem 1rem', cursor: 'pointer', backgroundColor: 'white', borderBottom: index < farmerResults.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>{farmer.last_name}, {farmer.first_name}</p>
                          <p style={{ margin: '0.3rem 0 0', color: '#6b7280', fontSize: '0.8rem' }}>{farmer.rsbsa_number || '—'} · {farmer.barangay}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {addErrors.farmer && <p style={{ margin: '0.5rem 0 0', color: '#dc2626', fontSize: '0.78rem' }}>{addErrors.farmer}</p>}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Plot Label</label>
              <input value={addForm.label} onChange={(e) => setAddForm((p) => ({ ...p, label: e.target.value }))} placeholder='e.g. Main Farm, Lot 2' style={inp()} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Latitude <span style={{ color: '#dc2626' }}>*</span></label>
                <input type='number' step='any' value={addForm.latitude} onChange={(e) => { setAddForm((p) => ({ ...p, latitude: e.target.value })); setAddErrors((p) => ({ ...p, latitude: '' })); }} placeholder='14.1167' style={inp(!!addErrors.latitude)} />
                {addErrors.latitude && <p style={{ margin: '0.35rem 0 0', color: '#dc2626', fontSize: '0.78rem' }}>{addErrors.latitude}</p>}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Longitude <span style={{ color: '#dc2626' }}>*</span></label>
                <input type='number' step='any' value={addForm.longitude} onChange={(e) => { setAddForm((p) => ({ ...p, longitude: e.target.value })); setAddErrors((p) => ({ ...p, longitude: '' })); }} placeholder='121.6833' style={inp(!!addErrors.longitude)} />
                {addErrors.longitude && <p style={{ margin: '0.35rem 0 0', color: '#dc2626', fontSize: '0.78rem' }}>{addErrors.longitude}</p>}
              </div>
            </div>

            <button onClick={() => { setAddModal(false); setPickMode(true); }} style={{ width: '100%', border: `1.5px dashed ${GREEN.border}`, borderRadius: '0.85rem', backgroundColor: GREEN.light, color: GREEN.accent, padding: '0.95rem', fontWeight: 700, cursor: 'pointer', marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <MapPin size={14} /> Or click on the map to pick location
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Area (ha)</label>
                <input type='number' step='0.01' value={addForm.area_ha} onChange={(e) => setAddForm((p) => ({ ...p, area_ha: e.target.value }))} placeholder='0.50' style={inp()} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Phase</label>
                <select value={addForm.land_type} onChange={(e) => setAddForm((p) => ({ ...p, land_type: e.target.value }))} style={inp()}>
                  {Object.keys(PHASE_COLORS).map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
            </div>

            <button onClick={handleAddPlot} disabled={adding} style={{ width: '100%', padding: '0.95rem', borderRadius: '0.95rem', border: 'none', backgroundColor: GREEN.primary, color: 'white', fontWeight: 700, cursor: 'pointer' }}>
              {adding ? 'Saving...' : 'Save Plot'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GisMap;
