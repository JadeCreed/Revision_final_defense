// src/pages/at/ATFarmers.jsx
// AT views all farmers in their assigned barangays.
// Shows beneficiaries status, crop phase, and quick encode link.

import { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Leaf, ChevronRight, Users, RefreshCw, Filter } from 'lucide-react';
import { getATFarmers, getATDashboardStats } from '../../api/axios';
import { useNavigate } from 'react-router-dom';

const GREEN = { primary: '#1a4d1a', light: '#f0fdf4', border: '#bbf7d0', accent: '#166534', soft: '#dcfce7' };

const PHASE_CFG = {
  DISTRIBUTION:  { label: 'Seed Distribution',  dot: '#9CA3AF' },
  ESTABLISHMENT: { label: 'Crop Establishment', dot: '#3B82F6' },
  TILLERING:     { label: 'Tillering',          dot: '#22C55E' },
  FLOWERING:     { label: 'Flowering',          dot: '#A855F7' },
  RIPENING:      { label: 'Ripening',           dot: '#FACC15' },
  HARVESTING:    { label: 'Harvesting',         dot: '#F97316' },
};

const ATFarmers = () => {
  const navigate = useNavigate();
  const [farmers,    setFarmers]    = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [brgyFilter, setBrgyFilter] = useState('');
  const [barangays,  setBarangays]  = useState([]);
  const [toast,      setToast]      = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, message: msg });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [fRes, sRes] = await Promise.all([
        getATFarmers({ search, barangay: brgyFilter }),
        getATDashboardStats(),
      ]);
      setFarmers(fRes.data?.farmers || []);
      setBarangays(fRes.data?.barangays || []);
      setStats(sRes.data);
    } catch {
      showToast('error', 'Failed to load farmers.');
    } finally {
      setLoading(false);
    }
  }, [search, brgyFilter, showToast]);

  useEffect(() => { load(); }, [brgyFilter]);

  const handleSearch = (q) => {
    setSearch(q);
    clearTimeout(window._atFarmerSearch);
    window._atFarmerSearch = setTimeout(load, 400);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes slideUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ width: 32, height: 32, border: `3px solid ${GREEN.border}`, borderTopColor: GREEN.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes slideUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}} .farmer-row:hover{background:${GREEN.light}!important;}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 900, backgroundColor: toast.type === 'success' ? GREEN.primary : '#991b1b', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.875rem', fontWeight: 600, fontSize: '0.875rem', animation: 'fadeIn 0.3s ease' }}>
          {toast.message}
        </div>
      )}

      <div style={{ padding: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>My Farmers</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Farmers in your assigned barangays
            </p>
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', backgroundColor: GREEN.light, color: GREEN.accent, border: `1px solid ${GREEN.border}`, borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Total Farmers',    value: stats.total_farmers,          color: '#374151' },
              { label: 'Monitored',        value: stats.monitored_farmers,       color: '#16a34a' },
              { label: 'Not Monitored',    value: stats.unmonitored_farmers,     color: '#dc2626' },
              { label: 'My Encoded',       value: stats.my_records_encoded,      color: GREEN.primary },
            ].map(({ label, value, color }, i) => (
              <div key={label} style={{ backgroundColor: 'white', borderRadius: '0.875rem', padding: '0.875rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animation: `slideUp ${0.3 + i * 0.05}s ease` }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: '0 0 0.125rem', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.4 }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem', border: '1px solid #f3f4f6' }}>
          <div style={{ position: 'relative', marginBottom: barangays.length > 1 ? '0.75rem' : 0 }}>
            <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search farmer by name or RSBSA..."
              style={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {barangays.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => setBrgyFilter('')}
                style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${!brgyFilter ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: !brgyFilter ? GREEN.light : 'white', color: !brgyFilter ? GREEN.primary : '#6b7280', fontWeight: !brgyFilter ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer' }}>
                All Barangays
              </button>
              {barangays.map(b => (
                <button key={b} onClick={() => setBrgyFilter(b)}
                  style={{ padding: '0.3rem 0.75rem', border: `1.5px solid ${brgyFilter === b ? GREEN.primary : '#e5e7eb'}`, borderRadius: '999px', backgroundColor: brgyFilter === b ? GREEN.light : 'white', color: brgyFilter === b ? GREEN.primary : '#6b7280', fontWeight: brgyFilter === b ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer' }}>
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Farmer list */}
        {farmers.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
            <Users size={40} color="#d1d5db" style={{ display: 'block', margin: '0 auto 1rem' }} />
            <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No farmers found</p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>Farmers ({farmers.length})</h3>
            </div>
            {farmers.map((farmer, idx) => {
              const phaseCfg = farmer.latest_phase ? PHASE_CFG[farmer.latest_phase] : null;
              return (
                <div key={farmer.id} className="farmer-row"
                  onClick={() => navigate('/at/crop-monitoring', { state: { farmerId: farmer.id } })}
                  style={{ padding: '0.875rem 1.25rem', borderBottom: idx < farmers.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: 'white', transition: 'background 0.15s', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: phaseCfg ? `${phaseCfg.dot}22` : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {phaseCfg
                        ? <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: phaseCfg.dot }} />
                        : <Leaf size={16} color="#d1d5db" />
                      }
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {farmer.full_name}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.125rem 0 0' }}>
                        {farmer.rsbsa_number || 'No RSBSA'} · Brgy. {farmer.barangay}
                      </p>
                      <p style={{ fontSize: '0.68rem', margin: '0.25rem 0 0', color: phaseCfg ? phaseCfg.dot : '#d1d5db', fontWeight: 600 }}>
                        {phaseCfg ? phaseCfg.label : 'Not yet monitored'}
                        {farmer.latest_observed && ` · ${new Date(farmer.latest_observed).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ATFarmers;