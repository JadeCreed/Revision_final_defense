// src/pages/admin/GisMap.jsx
// ============================================================
// GIS MAP — Farm Plot Tracker
// Layout: map (left 60%) | details panel (right 40%)
// Uses Leaflet via CDN (no npm install needed)
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Users, Wheat, Search, Plus, X,
  ChevronDown, CheckCircle, AlertCircle,
  Layers, Filter, Trash2, Edit2, RefreshCw,
} from 'lucide-react';
import { getGisPlots, createGisPlot, updateGisPlot, deleteGisPlot, getMapSummary, getGisBarangays } from '../../api/axios';
import API from '../../api/axios';

const GREEN = { primary: '#1a4d1a', light: '#f0fdf4', border: '#bbf7d0', accent: '#166534', soft: '#dcfce7' };

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

// ── Toast ──────────────────────────────────────────────────────────────────
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

// ── Land type color ────────────────────────────────────────────────────────
const LAND_COLORS = {
  'Irrigated':    '#1a4d1a',
  'Rainfed':      '#854d0e',
  'Upland':       '#7c3aed',
  'Lowland':      '#1e40af',
};
const landColor = (type) => LAND_COLORS[type] || '#6b7280';

const GisMap = () => {
  const mapRef        = useRef(null);   // DOM node
  const leafletMap    = useRef(null);   // L.Map instance
  const markersRef    = useRef({});     // plotId → L.Marker
  const [L, setL]     = useState(null);

  const [plots,     setPlots]     = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [barangays, setBarangays] = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Selected plot for details panel
  const [selected,  setSelected]  = useState(null);

  // Filters
  const [filterBrgy,     setFilterBrgy]     = useState('');
  const [filterLandType, setFilterLandType] = useState('');
  const [searchQ,        setSearchQ]        = useState('');

  // Add plot modal
  const [addModal,    setAddModal]    = useState(false);
  const [addForm,     setAddForm]     = useState({ farmer_id: '', label: 'Main Farm', latitude: '', longitude: '', area_ha: '', land_type: 'Irrigated' });
  const [addErrors,   setAddErrors]   = useState({});
  const [adding,      setAdding]      = useState(false);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [farmerResults, setFarmerResults] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  // Pick-on-map mode
  const [pickMode, setPickMode]       = useState(false);

  const [toast, setToast]             = useState(null);
  const toastTimer                    = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // ── Load Leaflet ────────────────────────────────────────────────────────
  useEffect(() => {
    loadLeaflet().then(setL);
  }, []);

  // ── Load data ───────────────────────────────────────────────────────────
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

  // ── Init Leaflet map ────────────────────────────────────────────────────
  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [14.1167, 121.6833], // Lucban, Quezon approximate center
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Custom zoom control bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    leafletMap.current = map;
    setL(L); // trigger re-render so markers get placed
  }, [L]);

  // ── Place / update markers ──────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;

    const filtered = filteredPlots; // computed below via useMemo-like filter
    // Clear old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    filtered.forEach(plot => {
      const lat = parseFloat(plot.latitude);
      const lng = parseFloat(plot.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const color = landColor(plot.land_type);
      const isSelected = selected?.id === plot.id;

      const icon = L.divIcon({
        html: `<div style="
          width:${isSelected ? 20 : 14}px;
          height:${isSelected ? 20 : 14}px;
          border-radius:50%;
          background:${color};
          border:3px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.7)'};
          box-shadow:0 2px 8px rgba(0,0,0,${isSelected ? 0.5 : 0.3});
          transition:all 0.2s;
        "></div>`,
        className: '',
        iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
        iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7],
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .on('click', () => setSelected(plot));

      marker.bindTooltip(`
        <div style="font-size:0.75rem;font-weight:700;color:#1a1a1a;">${plot.farmer_name || '—'}</div>
        <div style="font-size:0.65rem;color:#6b7280;">${plot.barangay} · ${plot.label || 'Farm'}</div>
        <div style="font-size:0.65rem;color:${color};font-weight:600;">${plot.land_type || '—'} · ${plot.area_ha ? plot.area_ha + ' ha' : '—'}</div>
      `, { permanent: false, direction: 'top', offset: [0, -10] });

      markersRef.current[plot.id] = marker;
    });
  }, [plots, selected, filterBrgy, filterLandType, searchQ, L]);

  // ── Pick-on-map mode ────────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const handler = (e) => {
      if (!pickMode) return;
      setAddForm(p => ({ ...p, latitude: e.latlng.lat.toFixed(6), longitude: e.latlng.lng.toFixed(6) }));
      setPickMode(false);
      showToast('Location picked. Fill in the rest and save.');
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [pickMode, showToast]);

  // ── Derived filtered plots ───────────────────────────────────────────────
  const filteredPlots = plots.filter(p => {
    const q = searchQ.toLowerCase();
    const matchSearch = !q || p.farmer_name?.toLowerCase().includes(q) || p.barangay?.toLowerCase().includes(q);
    const matchBrgy   = !filterBrgy     || p.barangay?.toLowerCase()  === filterBrgy.toLowerCase();
    const matchLand   = !filterLandType || p.land_type === filterLandType;
    return matchSearch && matchBrgy && matchLand;
  });

  // ── Farmer search for add modal ──────────────────────────────────────────
  const farmerTimer = useRef(null);
  const handleFarmerSearch = (q) => {
    setFarmerSearch(q);
    if (farmerTimer.current) clearTimeout(farmerTimer.current);
    if (q.length < 2) { setFarmerResults([]); return; }
    farmerTimer.current = setTimeout(async () => {
      try {
        // Use the existing farmer search endpoint
        const res = await API.get('/accounts/farmers/', { params: { search: q, status: 'APPROVED' } });
        setFarmerResults((res.data?.results || res.data || []).slice(0, 8));
      } catch { setFarmerResults([]); }
    }, 250);
  };

  // ── Add plot ─────────────────────────────────────────────────────────────
  const handleAddPlot = async () => {
    const errs = {};
    if (!selectedFarmer) errs.farmer = 'Select a farmer';
    if (!addForm.latitude)  errs.latitude  = 'Required';
    if (!addForm.longitude) errs.longitude = 'Required';
    if (Object.keys(errs).length) { setAddErrors(errs); return; }

    setAdding(true);
    try {
      await createGisPlot({
        farmer:     selectedFarmer.id,
        barangay:   selectedFarmer.barangay || '',
        label:      addForm.label,
        latitude:   addForm.latitude,
        longitude:  addForm.longitude,
        area_ha:    addForm.area_ha || null,
        land_type:  addForm.land_type,
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

  // ── Delete plot ───────────────────────────────────────────────────────────
  const handleDelete = async (plot) => {
    try {
      await deleteGisPlot(plot.id);
      if (selected?.id === plot.id) setSelected(null);
      await loadAll();
      showToast('Plot removed from map.');
    } catch { showToast('Failed to delete.', 'error'); }
  };

  // ── Fly to selected plot ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selected || !leafletMap.current) return;
    const lat = parseFloat(selected.latitude);
    const lng = parseFloat(selected.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      leafletMap.current.flyTo([lat, lng], 16, { duration: 0.8 });
    }
  }, [selected]);

  const inp = (hasErr = false) => ({
    padding: '0.6rem 0.875rem', border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: 'white',
  });

  // ── RENDER ────────────────────────────────────────────────────────────────
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

      {/* ── TOP HEADER ── */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '0.875rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>GIS Farm Map</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0.1rem 0 0' }}>Lucban, Quezon · Farm Plot Locations</p>
        </div>
        {/* Summary chips */}
        {summary && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Plots',   value: summary.total_plots,   color: GREEN.primary },
              { label: 'Farmers', value: summary.total_farmers, color: '#854d0e'     },
              { label: 'Hectares', value: `${summary.total_area_ha} ha`, color: '#1e40af' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ backgroundColor: '#f9fafb', borderRadius: '0.625rem', padding: '0.35rem 0.75rem', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color }}>{value}</span>
                <span style={{ fontSize: '0.65rem', color: '#9ca3af', marginLeft: '0.35rem', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setAddModal(true)}
          style={{ padding: '0.6rem 1.125rem', backgroundColor: GREEN.primary, color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
          <Plus size={16} /> Add Plot
        </button>
      </div>

      {/* ── MAIN LAYOUT: Map + Details ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

        {/* ── LEFT: FILTERS + MAP ── */}
        <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>

          {/* Filter bar */}
          <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '0.625rem 1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 160px', minWidth: '140px' }}>
              <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search farmer or brgy..."
                style={{ padding: '0.45rem 0.75rem 0.45rem 2rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.78rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            </div>
            {/* Barangay filter */}
            <select value={filterBrgy} onChange={e => setFilterBrgy(e.target.value)}
              style={{ padding: '0.45rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.78rem', outline: 'none', maxWidth: '140px' }}>
              <option value="">All Barangays</option>
              {barangays.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {/* Land type filter */}
            <select value={filterLandType} onChange={e => setFilterLandType(e.target.value)}
              style={{ padding: '0.45rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.78rem', outline: 'none' }}>
              <option value="">All Types</option>
              {Object.keys(LAND_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {/* Clear */}
            {(searchQ || filterBrgy || filterLandType) && (
              <button onClick={() => { setSearchQ(''); setFilterBrgy(''); setFilterLandType(''); }}
                style={{ padding: '0.45rem 0.625rem', border: '1.5px solid #fca5a5', borderRadius: '0.5rem', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <X size={11} /> Clear
              </button>
            )}
            {/* Plot count */}
            <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginLeft: 'auto', flexShrink: 0 }}>
              {filteredPlots.length} plot{filteredPlots.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Leaflet map */}
          <div style={{ flex: 1, position: 'relative' }}>
            {loading && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#6b7280' }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <p style={{ margin: 0, fontSize: '0.8rem' }}>Loading map data...</p>
              </div>
            )}

            {/* Pick mode overlay */}
            {pickMode && (
              <div style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500, backgroundColor: '#1a1a1a', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', pointerEvents: 'none' }}>
                <MapPin size={14} /> Click on the map to pick a location
              </div>
            )}

            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Legend */}
          <div style={{ backgroundColor: 'white', borderTop: '1px solid #e5e7eb', padding: '0.5rem 1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
            {Object.entries(LAND_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: '#6b7280' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
                {type}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: DETAILS PANEL ── */}
        <div style={{ width: '380px', flexShrink: 0, backgroundColor: 'white', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {selected ? (
            <>
              {/* Selected plot header */}
              <div style={{ backgroundColor: GREEN.primary, padding: '1.25rem', color: 'white', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', opacity: 0.75, margin: '0 0 0.25rem', fontWeight: 700, textTransform: 'uppercase' }}>Selected Farm Plot</p>
                    <h2 style={{ fontWeight: 800, fontSize: '1rem', margin: 0 }}>{selected.farmer_name || '—'}</h2>
                    <p style={{ opacity: 0.8, fontSize: '0.72rem', margin: '0.25rem 0 0' }}>
                      {selected.barangay} · {selected.label}
                    </p>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '0.5rem', color: 'white', cursor: 'pointer', padding: '0.4rem' }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.625rem', marginTop: '1rem' }}>
                  {[
                    { label: 'Area', value: selected.area_ha ? `${selected.area_ha} ha` : '—' },
                    { label: 'Type', value: selected.land_type || '—' },
                    { label: 'RSBSA', value: selected.farmer_rsbsa || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '0.625rem', padding: '0.5rem 0.625rem' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, lineHeight: 1 }}>{value}</p>
                      <p style={{ fontSize: '0.6rem', opacity: 0.75, margin: '0.2rem 0 0', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coordinates + contact */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {[
                    { label: 'Latitude',  value: parseFloat(selected.latitude).toFixed(5) },
                    { label: 'Longitude', value: parseFloat(selected.longitude).toFixed(5) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ fontSize: '0.63rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.1rem' }}>{label}</p>
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', margin: 0, fontFamily: 'monospace' }}>{value}</p>
                    </div>
                  ))}
                </div>
                {selected.farmer_contact && (
                  <div>
                    <p style={{ fontSize: '0.63rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.1rem' }}>Contact</p>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', margin: 0 }}>{selected.farmer_contact}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  onClick={() => leafletMap.current?.flyTo([parseFloat(selected.latitude), parseFloat(selected.longitude)], 17, { duration: 0.8 })}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', backgroundColor: GREEN.light, color: GREEN.accent, border: `1px solid ${GREEN.border}`, borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <MapPin size={13} /> Zoom In
                </button>
                <button
                  onClick={() => { if (window.confirm(`Remove ${selected.farmer_name}'s farm plot?`)) handleDelete(selected); }}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>

              {/* All plots list for same barangay */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '0.875rem 1.25rem 0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#374151', margin: 0 }}>
                    Other Plots in {selected.barangay}
                  </p>
                </div>
                {filteredPlots.filter(p => p.barangay === selected.barangay && p.id !== selected.id).length === 0 ? (
                  <p style={{ padding: '1.25rem', color: '#9ca3af', fontSize: '0.78rem', textAlign: 'center' }}>No other plots in this barangay.</p>
                ) : (
                  filteredPlots.filter(p => p.barangay === selected.barangay && p.id !== selected.id).map(plot => (
                    <div key={plot.id} className="plot-row"
                      onClick={() => setSelected(plot)}
                      style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', transition: 'background 0.15s' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1a1a1a', margin: 0 }}>{plot.farmer_name}</p>
                        <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.1rem 0 0' }}>{plot.label} · {plot.area_ha ? `${plot.area_ha} ha` : '—'}</p>
                      </div>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: landColor(plot.land_type), flexShrink: 0 }} />
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* No selection state */
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6' }}>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: 0 }}>All Farm Plots</p>
                <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>Click a pin or a row to view details</p>
              </div>
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ width: 24, height: 24, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.75rem' }} />
                  Loading...
                </div>
              ) : filteredPlots.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <MapPin size={32} color="#d1d5db" style={{ display: 'block', margin: '0 auto 0.75rem' }} />
                  <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.35rem' }}>No plots found</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{plots.length === 0 ? 'Add farm plots using the button above.' : 'Try adjusting your filters.'}</p>
                </div>
              ) : (
                filteredPlots.map(plot => (
                  <div key={plot.id} className="plot-row"
                    onClick={() => setSelected(plot)}
                    style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', transition: 'background 0.15s' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plot.farmer_name}</p>
                      <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.1rem 0 0' }}>
                        {plot.barangay} · {plot.label}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      {plot.area_ha && <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>{plot.area_ha} ha</span>}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: landColor(plot.land_type) }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ADD PLOT MODAL ── */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.75rem', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'fadeUp 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.125rem', margin: 0 }}>Add Farm Plot</h2>
              <button onClick={() => { setAddModal(false); setAddErrors({}); setSelectedFarmer(null); setFarmerSearch(''); setFarmerResults([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
            </div>

            {/* Farmer search */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Farmer <span style={{ color: '#dc2626' }}>*</span>
              </label>
              {selectedFarmer ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.875rem', border: `1.5px solid ${GREEN.border}`, borderRadius: '0.5rem', backgroundColor: GREEN.light }}>
                  <div>
                    <p style={{ fontWeight: 700, color: GREEN.accent, margin: 0, fontSize: '0.875rem' }}>{selectedFarmer.last_name}, {selectedFarmer.first_name}</p>
                    <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.1rem 0 0' }}>{selectedFarmer.rsbsa_number || 'No RSBSA'} · {selectedFarmer.barangay}</p>
                  </div>
                  <button onClick={() => { setSelectedFarmer(null); setFarmerSearch(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input value={farmerSearch} onChange={e => handleFarmerSearch(e.target.value)} placeholder="Search farmer by name..."
                      style={{ ...inp(!!addErrors.farmer), paddingLeft: '2.25rem' }} />
                  </div>
                  {farmerResults.length > 0 && (
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', marginTop: '0.375rem', overflow: 'hidden' }}>
                      {farmerResults.map((f, idx) => (
                        <div key={f.id}
                          onClick={() => { setSelectedFarmer(f); setFarmerSearch(''); setFarmerResults([]); setAddErrors(p => ({ ...p, farmer: '' })); }}
                          style={{ padding: '0.625rem 0.875rem', borderBottom: idx < farmerResults.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                          <p style={{ fontWeight: 700, margin: 0, fontSize: '0.82rem' }}>{f.last_name}, {f.first_name}</p>
                          <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.1rem 0 0' }}>{f.rsbsa_number || '—'} · {f.barangay}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {addErrors.farmer && <p style={{ fontSize: '0.7rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{addErrors.farmer}</p>}
            </div>

            {/* Label */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Plot Label</label>
              <input value={addForm.label} onChange={e => setAddForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Main Farm, Lot 2" style={inp()} />
            </div>

            {/* Coordinates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Latitude <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="number" step="any" value={addForm.latitude} onChange={e => { setAddForm(p => ({ ...p, latitude: e.target.value })); setAddErrors(p => ({ ...p, latitude: '' })); }} placeholder="e.g. 14.1167" style={inp(!!addErrors.latitude)} />
                {addErrors.latitude && <p style={{ fontSize: '0.7rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{addErrors.latitude}</p>}
              </div>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Longitude <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="number" step="any" value={addForm.longitude} onChange={e => { setAddForm(p => ({ ...p, longitude: e.target.value })); setAddErrors(p => ({ ...p, longitude: '' })); }} placeholder="e.g. 121.6833" style={inp(!!addErrors.longitude)} />
                {addErrors.longitude && <p style={{ fontSize: '0.7rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{addErrors.longitude}</p>}
              </div>
            </div>

            {/* Pick on map button */}
            <button
              onClick={() => { setAddModal(false); setPickMode(true); }}
              style={{ width: '100%', padding: '0.5rem', border: `1.5px dashed ${GREEN.border}`, borderRadius: '0.5rem', backgroundColor: GREEN.light, color: GREEN.accent, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', marginBottom: '0.875rem' }}>
              <MapPin size={14} /> Or click on the map to pick location
            </button>

            {/* Area + Land type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Area (ha)</label>
                <input type="number" step="0.01" value={addForm.area_ha} onChange={e => setAddForm(p => ({ ...p, area_ha: e.target.value }))} placeholder="e.g. 0.50" style={inp()} />
              </div>
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Land Type</label>
                <select value={addForm.land_type} onChange={e => setAddForm(p => ({ ...p, land_type: e.target.value }))} style={inp()}>
                  {Object.keys(LAND_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { setAddModal(false); setAddErrors({}); setSelectedFarmer(null); }}
                style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.875rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleAddPlot} disabled={adding}
                style={{ flex: 2, padding: '0.875rem', backgroundColor: adding ? '#d1d5db' : GREEN.primary, color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: adding ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <MapPin size={16} /> {adding ? 'Adding...' : 'Add to Map'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GisMap;