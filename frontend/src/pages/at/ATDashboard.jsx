// src/pages/at/ATDashboard.jsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getAnnouncements, getFinalSeeds, getATFarmers } from '../../api/axios';
import AnnouncementCard from '../../components/announcements/AnnouncementCard';
import { Users, ChevronRight, CheckCircle } from 'lucide-react';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const AT_COLOR = '#1e4d35';

const emitStorageSync = (key, value) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new StorageEvent('storage', {
    key, newValue: value, storageArea: localStorage,
  }));
};

const getATSeedDismissKey = (seeds) => {
  if (!seeds || seeds.length === 0) return null;
  return `at_seed_dismissed_${seeds[0]?.season}_${seeds[0]?.year}`;
};

const getATMasterlistDismissKey = (barangay) => {
  return `at_masterlist_dismissed_${barangay}`;
};

const ATDashboard = () => {
  const { firstName } = useAuth();
  const navigate = useNavigate();

  // ── Notification states ──
  const [finalSeeds, setFinalSeeds] = useState([]);
  const [seedDismissed, setSeedDismissed] = useState(false);
  const [seedVisible, setSeedVisible] = useState(true);

  const [masterlistNotif, setMasterlistNotif] = useState(null); // { barangay, season, year }
  const [masterlistDismissed, setMasterlistDismissed] = useState(false);
  const [masterlistVisible, setMasterlistVisible] = useState(true);

  // ── Analytics ──
  const [totalFarmers, setTotalFarmers] = useState(null);

  // ── Announcements ──
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);

  // ── Load final seeds ──
  useEffect(() => {
    getFinalSeeds()
      .then(res => {
        const seeds = res.data || [];
        setFinalSeeds(seeds);
        if (seeds.length === 0) return;

        const payload = {
          season: seeds[0].season,
          season_display: seeds[0].season_display,
          year: seeds[0].year,
          varieties: seeds.map(fs => ({
            seed_type: { name: fs.seed_type?.name || '' },
            varieties: fs.varieties || [],
          })),
        };
        localStorage.setItem('at_final_seeds_notif', JSON.stringify(payload));
        emitStorageSync('at_final_seeds_notif', JSON.stringify(payload));

        const dismissKey = getATSeedDismissKey(seeds);
        if (dismissKey && localStorage.getItem(dismissKey) === 'true') {
          setSeedDismissed(true);
          setSeedVisible(false);
        }
      })
      .catch(() => {});
  }, []);

  // ── Load total farmers assigned to this AT ──
  useEffect(() => {
    getATFarmers({ limit: 1 })
      .then(res => {
        const data = res.data;
        if (data?.count !== undefined) setTotalFarmers(data.count);
        else if (Array.isArray(data)) setTotalFarmers(data.length);
        else setTotalFarmers(null);
      })
      .catch(() => setTotalFarmers(null));
  }, []);

  // ── Check masterlist notification from localStorage ──
  // Written by BrgyDistribution when a brgy president encodes distribution data
  useEffect(() => {
    const checkMasterlist = () => {
      try {
        const raw = localStorage.getItem('at_masterlist_notif');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data) return;

        const dismissKey = getATMasterlistDismissKey(data.barangay);
        const dismissed = localStorage.getItem(dismissKey) === 'true';
        if (dismissed) {
          setMasterlistDismissed(true);
          setMasterlistVisible(false);
        } else {
          setMasterlistNotif(data);
        }
      } catch {}
    };
    checkMasterlist();

    const onStorage = (e) => {
      if (e.key === 'at_masterlist_notif') checkMasterlist();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Announcements ──
  useEffect(() => {
    getAnnouncements({ limit: 3 })
      .then(res => setAnnouncements(res.data || []))
      .catch(() => {})
      .finally(() => setAnnLoading(false));
  }, []);

  // ── Dismiss handlers ──
  const handleSeedDismiss = () => {
    setSeedVisible(false);
    setTimeout(() => {
      setSeedDismissed(true);
      const dismissKey = getATSeedDismissKey(finalSeeds);
      if (dismissKey) {
        localStorage.setItem(dismissKey, 'true');
        emitStorageSync(dismissKey, 'true');
      }
      // Mark bell notif as read
      const NOTIF_KEY = `brgy_bell_notifs_AT`;
      try {
        const notifId = `at_seed_${finalSeeds[0]?.season}_${finalSeeds[0]?.year}`;
        const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
        const updated = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
        localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
        emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
      } catch {}
    }, 300);
  };

  const handleMasterlistDismiss = () => {
    setMasterlistVisible(false);
    setTimeout(() => {
      setMasterlistDismissed(true);
      if (masterlistNotif?.barangay) {
        const dismissKey = getATMasterlistDismissKey(masterlistNotif.barangay);
        localStorage.setItem(dismissKey, 'true');
        emitStorageSync(dismissKey, 'true');
        // Mark bell notif as read
        const NOTIF_KEY = `brgy_bell_notifs_AT`;
        try {
          const notifId = `at_masterlist_${masterlistNotif.barangay}`;
          const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
          const updated = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
          localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
          emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
        } catch {}
      }
    }, 300);
  };

  // ── Which notifications to show (queue: seed first, then masterlist) ──
  const showSeedNotif = finalSeeds.length > 0 && !seedDismissed;
  const showMasterlistNotif = !showSeedNotif && masterlistNotif && !masterlistDismissed;

  return (
    <div style={{ padding: '1.25rem' }}>
      <style>{`
        @keyframes atPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-10px); max-height: 0; }
          to   { opacity: 1; transform: translateY(0); max-height: 200px; }
        }
        @keyframes notifSlideOut {
          from { opacity: 1; transform: translateY(0); max-height: 200px; margin-bottom: 1rem; }
          to   { opacity: 0; transform: translateY(-6px); max-height: 0; margin-bottom: 0; padding: 0; }
        }
        .at-notif-enter { animation: notifSlideIn 0.3s ease forwards; overflow: hidden; }
        .at-notif-exit  { animation: notifSlideOut 0.3s ease forwards; overflow: hidden; pointer-events: none; }
      `}</style>

      {/* ── GREETING ── */}
      <div style={{ marginBottom: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{getGreeting()},</p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a1a1a', margin: '0.125rem 0 0.25rem', lineHeight: 1.2 }}>
          {firstName || 'AT'}
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
          Agricultural Technician — AGRICE Lucban
        </p>
      </div>

      {/* ── NOTIFICATION AREA ── */}

      {/* Seed finalization notification */}
      {showSeedNotif && (
        <div
          className={seedVisible ? 'at-notif-enter' : 'at-notif-exit'}
          style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '1rem', marginBottom: '1rem' }}
        >
          <div style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#166534', margin: '0 0 0.35rem' }}>
                Confirmed Seed Varieties — {finalSeeds[0]?.season_display} {finalSeeds[0]?.year}
              </p>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {finalSeeds.map(fs => (
                  <span key={fs.id} style={{
                    fontSize: '0.72rem', color: '#166534',
                    backgroundColor: '#dcfce7', borderRadius: '999px',
                    padding: '0.1rem 0.6rem', fontWeight: 600,
                    border: '1px solid #bbf7d0',
                  }}>
                    {fs.seed_type.name}: {fs.varieties.map(v => v.name).join(', ')}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleSeedDismiss}
              style={{
                flexShrink: 0, padding: '0.5rem 0.875rem',
                backgroundColor: '#166534', color: 'white',
                border: 'none', borderRadius: '0.75rem', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.78rem',
                display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap',
              }}
            >
              <CheckCircle size={14} /> Got it!
            </button>
          </div>
        </div>
      )}

      {/* Masterlist notification */}
      {showMasterlistNotif && (
        <div
          className={masterlistVisible ? 'at-notif-enter' : 'at-notif-exit'}
          style={{ backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '1rem', marginBottom: '1rem' }}
        >
          <div style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e40af', margin: '0 0 0.25rem' }}>
                Seed Distribution Started — Brgy. {masterlistNotif.barangay}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#1e40af', opacity: 0.85, margin: 0, lineHeight: 1.4 }}>
                Brgy. {masterlistNotif.barangay} has started encoding seed distribution data for {masterlistNotif.season_display} {masterlistNotif.year}.
              </p>
            </div>
            <button
              onClick={handleMasterlistDismiss}
              style={{
                flexShrink: 0, padding: '0.5rem 0.875rem',
                backgroundColor: '#1e40af', color: 'white',
                border: 'none', borderRadius: '0.75rem', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.78rem',
                display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap',
              }}
            >
              <CheckCircle size={14} /> Acknowledged
            </button>
          </div>
        </div>
      )}

      {/* ── 4 ANALYTICS TILES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.375rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 36, height: 36, backgroundColor: '#dcfce7', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem' }}>
            <Users size={18} color="#166534" />
          </div>
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a1a', margin: 0, lineHeight: 1 }}>
            {totalFarmers !== null ? totalFarmers : '—'}
          </p>
          <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.25rem 0 0', fontWeight: 600 }}>Total Farmers</p>
        </div>

        {[2, 3, 4].map(i => (
          <div key={i} style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: 36, height: 36, backgroundColor: '#f3f4f6', borderRadius: '0.75rem', marginBottom: '0.625rem' }} />
            <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d1d5db', margin: 0, lineHeight: 1 }}>—</p>
            <p style={{ fontSize: '0.72rem', color: '#d1d5db', margin: '0.25rem 0 0', fontWeight: 600 }}>Coming soon</p>
          </div>
        ))}
      </div>

      {/* ── UPDATES & REMINDERS ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.125rem' }}>Updates & Reminders</p>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>Latest news from the MAO</p>
          </div>
          <button onClick={() => navigate('/at/announcements')} style={{ background: 'none', border: 'none', color: AT_COLOR, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
            View All <ChevronRight size={14} />
          </button>
        </div>

        {annLoading && [1, 2].map(i => (
          <div key={i} style={{ height: '80px', backgroundColor: '#f3f4f6', borderRadius: '0.875rem', marginBottom: '0.75rem', animation: 'atPulse 1.5s ease-in-out infinite' }} />
        ))}

        {!annLoading && announcements.length === 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem 1.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📢</div>
            <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>No announcements yet</p>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>Check back here for updates from the MAO.</p>
          </div>
        )}

        {!annLoading && announcements.map(ann => (
          <AnnouncementCard
            key={ann.id}
            announcement={ann}
            onClick={() => navigate(`/at/announcements/${ann.id}`, { state: { from: '/at' } })}
            roleColor={AT_COLOR}
          />
        ))}
      </div>
    </div>
  );
};

export default ATDashboard;