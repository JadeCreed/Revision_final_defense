// src/pages/brgy/BPDashboard.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getAnnouncements, getFinalSeeds, getATFarmers } from '../../api/axios';
import AnnouncementCard from '../../components/announcements/AnnouncementCard';
import { Users, ChevronRight, ClipboardList, Bell } from 'lucide-react';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const BRGY_COLOR = '#2d4d1a';

const getDismissKey = (seeds) => {
  if (!seeds || seeds.length === 0) return null;
  return `brgy_seed_dismissed_${seeds[0]?.season || 'WET'}_${seeds[0]?.year || new Date().getFullYear()}`;
};

const emitStorageSync = (key, value) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new StorageEvent('storage', {
    key,
    newValue: value,
    storageArea: localStorage,
  }));
};

const BPDashboard = () => {
  const { firstName, barangay } = useAuth();
  const navigate = useNavigate();

  const [seedDismissed, setSeedDismissed] = useState(false);
  const [seedVisible, setSeedVisible] = useState(true);
  const [finalSeeds, setFinalSeeds] = useState([]);
  const [totalFarmers, setTotalFarmers] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);

  useEffect(() => {
    getFinalSeeds()
      .then(res => {
        const seeds = res.data || [];
        setFinalSeeds(seeds);

        if (seeds.length > 0) {
          const payload = {
            season: seeds[0]?.season || 'WET',
            season_display: seeds[0]?.season_display || '',
            year: seeds[0]?.year || new Date().getFullYear(),
            varieties: seeds.map(fs => ({
              seed_type: fs.seed_type,
              varieties: fs.varieties || [],
            })),
          };
          localStorage.setItem('brgy_final_seeds_notif', JSON.stringify(payload));
          emitStorageSync('brgy_final_seeds_notif', localStorage.getItem('brgy_final_seeds_notif'));
        }

        const key = getDismissKey(seeds);
        const dismissed = key ? localStorage.getItem(key) === 'true' : false;
        setSeedDismissed(dismissed);
        setSeedVisible(!dismissed);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getATFarmers({ barangay, limit: 1 })
      .then(res => {
        const data = res.data;
        if (data?.count !== undefined) setTotalFarmers(data.count);
        else if (Array.isArray(data)) setTotalFarmers(data.length);
        else setTotalFarmers(null);
      })
      .catch(() => setTotalFarmers(null));
  }, [barangay]);

  useEffect(() => {
    getAnnouncements({ limit: 3 })
      .then(res => setAnnouncements(res.data || []))
      .catch(() => {})
      .finally(() => setAnnLoading(false));
  }, []);

  const handleSeedDismiss = () => {
    setSeedVisible(false);
    setTimeout(() => {
      setSeedDismissed(true);
      const dismissKey = getDismissKey(finalSeeds);
      if (dismissKey) {
        localStorage.setItem(dismissKey, 'true');
        emitStorageSync(dismissKey, 'true');
      }

      const NOTIF_KEY = 'brgy_bell_notifs_BRGY';
      try {
        const notifId = `seed_${finalSeeds[0]?.season}_${finalSeeds[0]?.year}`;
        const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
        const updated = existing.map(n =>
          n.id === notifId ? { ...n, read: true } : n
        );
        localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
        emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
      } catch {}

      navigate('/brgy/beneficiaries');
    }, 300);
  };

  const showSeedNotif = finalSeeds.length > 0 && !seedDismissed;

  return (
    <div style={{ padding: '1.25rem' }}>
      <style>{`
        @keyframes brgyPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes notifFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes notifFadeOut {
          from { opacity: 1; transform: translateY(0); max-height: 200px; margin-bottom: 1rem; }
          to   { opacity: 0; transform: translateY(-8px); max-height: 0; margin-bottom: 0; }
        }
        .seed-notif-enter { animation: notifFadeIn 0.3s ease forwards; }
        .seed-notif-exit { animation: notifFadeOut 0.3s ease forwards; overflow: hidden; pointer-events: none; }
      `}</style>

      <div style={{ marginBottom: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{getGreeting()},</p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a1a1a', margin: '0.125rem 0 0.25rem', lineHeight: 1.2 }}>
          {firstName || 'President'}
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>Barangay President — AGRICE Lucban</p>
      </div>

      {showSeedNotif && (
        <div
          className={seedVisible ? 'seed-notif-enter' : 'seed-notif-exit'}
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1px solid #bbf7d0',
            borderRadius: '1rem',
            padding: '0.875rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            boxShadow: '0 8px 18px rgba(22, 163, 74, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: '0.9rem', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bell size={18} color="#166534" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 800, fontSize: '0.875rem', color: '#166534', margin: 0 }}>
                Seed varieties finalized for {finalSeeds[0]?.season_display} {finalSeeds[0]?.year}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#166534', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
                Review the confirmed list and open the beneficiary page when ready.
              </p>
            </div>
          </div>

          <button
            onClick={handleSeedDismiss}
            style={{
              flexShrink: 0,
              padding: '0.5rem 0.875rem',
              backgroundColor: '#166534',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              whiteSpace: 'nowrap',
            }}
          >
            <ClipboardList size={14} />
            Go to Beneficiaries
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.375rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 36, height: 36, backgroundColor: '#dcfce7', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem' }}>
            <Users size={18} color="#166534" />
          </div>
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a1a', margin: 0, lineHeight: 1 }}>{totalFarmers !== null ? totalFarmers : '—'}</p>
          <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.25rem 0 0', fontWeight: 600 }}>Total Farmers</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 36, height: 36, backgroundColor: '#f3f4f6', borderRadius: '0.75rem', marginBottom: '0.625rem' }} />
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d1d5db', margin: 0, lineHeight: 1 }}>—</p>
          <p style={{ fontSize: '0.72rem', color: '#d1d5db', margin: '0.25rem 0 0', fontWeight: 600 }}>Coming soon</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 36, height: 36, backgroundColor: '#f3f4f6', borderRadius: '0.75rem', marginBottom: '0.625rem' }} />
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d1d5db', margin: 0, lineHeight: 1 }}>—</p>
          <p style={{ fontSize: '0.72rem', color: '#d1d5db', margin: '0.25rem 0 0', fontWeight: 600 }}>Coming soon</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 36, height: 36, backgroundColor: '#f3f4f6', borderRadius: '0.75rem', marginBottom: '0.625rem' }} />
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d1d5db', margin: 0, lineHeight: 1 }}>—</p>
          <p style={{ fontSize: '0.72rem', color: '#d1d5db', margin: '0.25rem 0 0', fontWeight: 600 }}>Coming soon</p>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.125rem' }}>Updates & Reminders</p>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>Latest news from the MAO</p>
          </div>
          <button onClick={() => navigate('/brgy/announcements')} style={{ background: 'none', border: 'none', color: BRGY_COLOR, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
            View All <ChevronRight size={14} />
          </button>
        </div>

        {annLoading && (
          <div>
            {[1, 2].map(i => (
              <div key={i} style={{ height: '80px', backgroundColor: '#f3f4f6', borderRadius: '0.875rem', marginBottom: '0.75rem', animation: 'brgyPulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

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
            onClick={() => navigate(`/brgy/announcements/${ann.id}`, { state: { from: '/brgy' } })}
            roleColor={BRGY_COLOR}
          />
        ))}
      </div>
    </div>
  );
};

export default BPDashboard;