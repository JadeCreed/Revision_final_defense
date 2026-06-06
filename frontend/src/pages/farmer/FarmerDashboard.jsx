import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CheckCircle, Clock, XCircle, AlertCircle, ChevronRight, Users } from 'lucide-react';
import API, { getAnnouncements, getFinalSeeds } from '../../api/axios';
import AnnouncementCard from '../../components/announcements/AnnouncementCard';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const FARMER_COLOR = '#1a4d1a';

const emitStorageSync = (key, value) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new StorageEvent('storage', {
    key, newValue: value, storageArea: localStorage,
  }));
};

const FarmerDashboard = () => {
  const { firstName } = useAuth();
  const navigate = useNavigate();

  // ── Status ──
  const [status, setStatus] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── Notification visibility ──
  const [statusVisible, setStatusVisible] = useState(true);
  const [statusDismissed, setStatusDismissed] = useState(false);

  // ── Seed notif ──
  const [finalSeeds, setFinalSeeds] = useState([]);
  const [seedDismissed, setSeedDismissed] = useState(false);
  const [seedVisible, setSeedVisible] = useState(true);

  // ── Announcements ──
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);

  const pollRef = useRef(null);
  const APPROVED_SEEN_KEY = 'farmer_approved_seen';

  // ── Fetch profile status ──
  const fetchProfileStatus = useCallback(async () => {
    try {
      const res = await API.get('/accounts/farmer-profile/');
      const newStatus = res.data.user?.status || 'PENDING';
      setStatus(newStatus);

      const NOTIF_KEY = `brgy_bell_notifs_FARMER`;

      if (newStatus === 'APPROVED') {
        const seen = localStorage.getItem(APPROVED_SEEN_KEY) === 'true';

        if (seen) {
          setStatusDismissed(true);
          setStatusVisible(false);
        } else {
          setStatusDismissed(false);
          setStatusVisible(true);
          const notifId = 'farmer_approved';
          try {
            const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
            const cleaned = existing.filter(n =>
              n.id !== 'farmer_pending' &&
              n.id !== 'farmer_complete'
            );
            if (!cleaned.find(n => n.id === notifId)) {
              const newNotif = {
                id: notifId,
                title: 'Account Approved!',
                info: 'Your account has been approved. You can now use all features.',
                date: new Date().toLocaleDateString('en-PH', {
                  month: 'short', day: 'numeric', year: 'numeric',
                }),
                read: false,
                route: '/farmer',
              };
              const updated = [newNotif, ...cleaned];
              localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
              emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
            }
          } catch {}
        }
      } else if (newStatus === 'PENDING') {
        setStatusDismissed(false);
        setStatusVisible(true);
        const notifId = 'farmer_pending';
        try {
          const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
          if (!existing.find(n => n.id === notifId)) {
            const newNotif = {
              id: notifId,
              title: 'Complete Your Profile',
              info: 'Please complete your farmer profile before proceeding with account verification.',
              date: new Date().toLocaleDateString('en-PH', {
                month: 'short', day: 'numeric', year: 'numeric',
              }),
              read: false,
              route: '/farmer/profile',
            };
            const updated = [newNotif, ...existing];
            localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
            emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
          }
        } catch {}
      } else if (newStatus === 'COMPLETE') {
        setStatusDismissed(false);
        setStatusVisible(true);
        const notifId = 'farmer_complete';
        try {
          const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
          const cleaned = existing.filter(n => n.id !== 'farmer_pending');
          if (!cleaned.find(n => n.id === notifId)) {
            const newNotif = {
              id: notifId,
              title: 'Pending Review',
              info: 'Your profile has been submitted and is currently under review by the administrator.',
              date: new Date().toLocaleDateString('en-PH', {
                month: 'short', day: 'numeric', year: 'numeric',
              }),
              read: false,
              route: '/farmer',
            };
            const updated = [newNotif, ...cleaned];
            localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
            emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
          }
        } catch {}
      } else if (newStatus === 'REJECTED') {
        setStatusDismissed(false);
        setStatusVisible(true);
      }
      return newStatus;
    } catch {
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

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
        localStorage.setItem('farmer_final_seeds_notif', JSON.stringify(payload));
        emitStorageSync('farmer_final_seeds_notif', JSON.stringify(payload));

        const dismissKey = `farmer_seed_dismissed_${seeds[0].season}_${seeds[0].year}`;
        if (localStorage.getItem(dismissKey) === 'true') {
          setSeedDismissed(true);
          setSeedVisible(false);
        }
      })
      .catch(() => {});
  }, []);

  // ── Fetch announcements ──
  useEffect(() => {
    getAnnouncements({ limit: 3 })
      .then(res => setAnnouncements(res.data || []))
      .catch(() => {})
      .finally(() => setAnnLoading(false));
  }, []);

  // ── Initial load ──
  useEffect(() => {
    fetchProfileStatus();
  }, [fetchProfileStatus]);

  // ── Poll for status change every 30s ──
  useEffect(() => {
    if (status === 'PENDING' || status === 'COMPLETE') {
      pollRef.current = setInterval(fetchProfileStatus, 30000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, fetchProfileStatus]);

  // ── Dismiss handlers ──
  const handleStatusDismiss = () => {
    if (status !== 'APPROVED') return;

    localStorage.setItem(APPROVED_SEEN_KEY, 'true');

    const NOTIF_KEY = `brgy_bell_notifs_FARMER`;
    try {
      const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
      const updated = existing.map(n =>
        n.id === 'farmer_approved' ? { ...n, read: true } : n
      );
      localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
      emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
    } catch {}

    setStatusVisible(false);
    setTimeout(() => {
      setStatusDismissed(true);
    }, 300);
  };

  const handleSeedDismiss = () => {
    setSeedVisible(false);
    setTimeout(() => {
      setSeedDismissed(true);
      if (finalSeeds[0]) {
        const dismissKey = `farmer_seed_dismissed_${finalSeeds[0].season}_${finalSeeds[0].year}`;
        localStorage.setItem(dismissKey, 'true');
        emitStorageSync(dismissKey, 'true');
        // Mark bell notif as read
        const NOTIF_KEY = `brgy_bell_notifs_FARMER`;
        try {
          const notifId = `farmer_seed_${finalSeeds[0].season}_${finalSeeds[0].year}`;
          const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
          const updated = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
          localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
          emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
        } catch {}
      }
    }, 300);
  };

  // ── Notification queue logic ──
  // Status notif first (PENDING/COMPLETE/APPROVED), then seed notif
  const showStatusNotif = !profileLoading && !statusDismissed && status && status !== 'REJECTED';
  const showSeedNotif = !showStatusNotif && finalSeeds.length > 0 && !seedDismissed;
  // REJECTED always shows below tiles, not in queue
  const showRejectedNotif = !profileLoading && status === 'REJECTED';

  // ── Status notif config ──
  const getStatusNotifConfig = () => {
    switch (status) {
      case 'PENDING':
        return {
          bg: '#fef9c3', border: '#fde68a', titleColor: '#854d0e',
          title: 'Complete Your Profile',
          info: 'Please complete your farmer profile before proceeding with account verification.',
          buttonLabel: 'Go to Profile',
          buttonBg: '#854d0e',
          onButton: () => navigate('/farmer/profile'),
          showButton: true,
        };
      case 'COMPLETE':
        return {
          bg: '#eff6ff', border: '#bfdbfe', titleColor: '#1e40af',
          title: 'Pending Review',
          info: 'Your profile has been submitted and is currently under review by the administrator.',
          buttonLabel: null,
          showButton: false,
        };
      case 'APPROVED':
        return {
          bg: '#f0fdf4', border: '#bbf7d0', titleColor: '#166534',
          title: 'Account Approved!',
          info: 'Congratulations! Your account has been approved. You can now use all features.',
          buttonLabel: 'Start Using App',
          buttonBg: '#166534',
          onButton: handleStatusDismiss,
          showButton: true,
        };
      default:
        return null;
    }
  };

  const statusNotifCfg = getStatusNotifConfig();

  return (
    <div style={{ padding: '1.25rem', paddingBottom: '1rem' }}>
      <style>{`
        @keyframes farmerPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-10px); max-height: 0; }
          to   { opacity: 1; transform: translateY(0); max-height: 200px; }
        }
        @keyframes notifSlideOut {
          from { opacity: 1; transform: translateY(0); max-height: 200px; margin-bottom: 1rem; }
          to   { opacity: 0; transform: translateY(-6px); max-height: 0; margin-bottom: 0; padding: 0; }
        }
        .farmer-notif-enter { animation: notifSlideIn 0.3s ease forwards; overflow: hidden; }
        .farmer-notif-exit  { animation: notifSlideOut 0.3s ease forwards; overflow: hidden; pointer-events: none; }
      `}</style>

      {/* ── GREETING ── */}
      <div style={{ marginBottom: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{getGreeting()},</p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a1a1a', margin: '0.125rem 0 0.25rem', lineHeight: 1.2 }}>
          {firstName || 'Farmer'} 
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
          Let's make farming productive today.
        </p>
      </div>

      {/* ── NOTIFICATION AREA ── */}

      {/* Status notification (PENDING / COMPLETE / APPROVED) */}
      {showStatusNotif && statusNotifCfg && (
        <div
          className={statusVisible ? 'farmer-notif-enter' : 'farmer-notif-exit'}
          style={{
            backgroundColor: statusNotifCfg.bg,
            border: `1.5px solid ${statusNotifCfg.border}`,
            borderRadius: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: statusNotifCfg.titleColor, margin: '0 0 0.25rem' }}>
                {statusNotifCfg.title}
              </p>
              <p style={{ fontSize: '0.78rem', color: statusNotifCfg.titleColor, opacity: 0.85, margin: 0, lineHeight: 1.4 }}>
                {statusNotifCfg.info}
              </p>
            </div>
            {statusNotifCfg.showButton && (
              <button
                onClick={statusNotifCfg.onButton}
                style={{
                  flexShrink: 0, padding: '0.5rem 0.875rem',
                  backgroundColor: statusNotifCfg.buttonBg, color: 'white',
                  border: 'none', borderRadius: '0.75rem', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.78rem',
                  display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap',
                }}
              >
                {statusNotifCfg.buttonLabel} <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Seed varieties notification */}
      {showSeedNotif && (
        <div
          className={seedVisible ? 'farmer-notif-enter' : 'farmer-notif-exit'}
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
                    padding: '0.1rem 0.6rem', fontWeight: 600, border: '1px solid #bbf7d0',
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

      {/* ── 4 ANALYTICS TILES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.375rem' }}>
        {[1, 2, 3, 4].map(i => (
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
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>Latest news from the admin</p>
          </div>
          <button onClick={() => navigate('/farmer/announcements')} style={{ background: 'none', border: 'none', color: FARMER_COLOR, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
            View All <ChevronRight size={14} />
          </button>
        </div>

        {annLoading && [1, 2].map(i => (
          <div key={i} style={{ height: '80px', backgroundColor: '#f3f4f6', borderRadius: '0.875rem', marginBottom: '0.75rem', animation: 'farmerPulse 1.5s ease-in-out infinite' }} />
        ))}

        {!annLoading && announcements.length === 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem 1.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📢</div>
            <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>No announcements yet</p>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>Check back here for updates from your admin.</p>
          </div>
        )}

        {!annLoading && announcements.map(ann => (
          <AnnouncementCard
            key={ann.id}
            announcement={ann}
            onClick={() => navigate(`/farmer/announcements/${ann.id}`, { state: { from: '/farmer' } })}
            roleColor={FARMER_COLOR}
          />
        ))}
      </div>
    </div>
  );
};

export default FarmerDashboard;