import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CheckCircle, Clock, XCircle, AlertCircle, ChevronRight, Users, Activity, MapPin, BarChart2, Sprout, Ruler, Wheat, Bell, CalendarDays, Clock3 } from 'lucide-react';
import API, { getAnnouncements, getFinalSeeds, getFarmerDashboardStats } from '../../api/axios';
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
    getAnnouncements({ limit: 10 }) // Tinaasan ang limit upang ma-detect ang unread distribution schedules
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

  // ── Helper upang i-parse ang Seed Distribution details mula sa anunsyo ──
  const getDistributionDetails = (ann) => {
    const title = ann.title || '';
    const content = ann.content || '';
    
    let seedType = 'Inbred';
    let variety = '—';
    const parts = title.split(' — ');
    if (parts.length > 1) {
      const seedInfo = parts[1]; // Kukunin ang "Inbred (RC-10)"
      const match = seedInfo.match(/([^(]+)\s*\(([^)]+)\)/);
      if (match) {
        seedType = match[1].trim();
        variety = match[2].trim();
      } else {
        seedType = seedInfo;
      }
    }

    const lines = content.split('\n');
    let date = '—';
    let time = '—';
    let venue = '—';
    
    lines.forEach(line => {
      if (line.includes('• Araw/Petsa:')) date = line.split('• Araw/Petsa:')[1].trim();
      if (line.includes('• Oras:'))      time = line.split('• Oras:')[1].trim();
      if (line.includes('• Lugar/Venue:')) venue = line.split('• Lugar/Venue:')[1].trim();
    });

    return { seedType, variety, date, time, venue };
  };

  // ── Dismiss handler para sa Farmer Distribution Schedule ──
  const handleDistDismiss = async (ann) => {
    const NOTIF_KEY = `brgy_bell_notifs_FARMER`;
    const notifId = `ann_${ann.id}`;
    
    // 1. I-save sa localStorage para mawala sa Home Screen
    localStorage.setItem(`farmer_dist_dismissed_${ann.id}`, 'true');
    
    // 2. Mark as read sa local bell notifications storage
    try {
      const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
      const updated = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
      localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
      emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
    } catch {}

    // 3. Tumawag sa backend detail endpoint upang markahan bilang read sa DB (mababawasan ang bell count)
    try {
      await API.get(`/announcements/${ann.id}/`);
    } catch {}

    // 4. I-update ang local state upang maitago ang card sa Home screen
    setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, is_read: true } : a));
  };

  // ── Dashboard stats (Farmer) ──
  const [dashStats, setDashStats] = useState({
    seed_display: 'Pending',
    selected_seeds: [],
    total_hectares: 0,
    monitoring_records: 0,
    unread_count: 0,
    crop_status: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    getFarmerDashboardStats()
      .then(res => setDashStats(res.data || {}))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  // ── Notification queue logic ──
  const showStatusNotif = !profileLoading && !statusDismissed && status && status !== 'REJECTED';
  const showSeedNotif = !showStatusNotif && finalSeeds.length > 0 && !seedDismissed;
  const showRejectedNotif = !profileLoading && status === 'REJECTED';

  // Kukunin ang pinakahuling hindi pa nadidismis na Distribution Announcement ng kanyang Barangay
  const unreadDistAnn = announcements.find(ann => {
    const isDist = ann.title?.startsWith('Seed Distribution');
    const isDismissed = localStorage.getItem(`farmer_dist_dismissed_${ann.id}`) === 'true';
    return isDist && !isDismissed; // Tinanggal ang !ann.is_read para lumabas pa rin sa Home kahit binuksan na sa Bell icon
  });
  
  // Ipapakita lamang ang distribution card kung walang aktibong status o seed varieties notifications
  const showDistNotif = !showStatusNotif && !showSeedNotif && !!unreadDistAnn;

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

      {/* ── NOTIFICATION AREA (Priority Scoped) ── */}
      <div style={{ marginBottom: '1rem' }}>

        {/* Type A: Profile Status Banner */}
        {showStatusNotif && statusNotifCfg && (
          <div
            className={statusVisible ? 'farmer-notif-enter' : 'farmer-notif-exit'}
            style={{
              backgroundColor: statusNotifCfg.bg,
              border: `1.5px solid ${statusNotifCfg.border}`,
              borderRadius: '1rem',
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

        {/* Type B: Confirmed Seed Varieties Banner */}
        {showSeedNotif && (
          <div
            className={seedVisible ? 'farmer-notif-enter' : 'farmer-notif-exit'}
            style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '1rem' }}
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

        {/* Type C: Seed Distribution Schedule Custom Card */}
        {showDistNotif && unreadDistAnn && (() => {
          const { seedType, variety, date, time, venue } = getDistributionDetails(unreadDistAnn);
          return (
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 100%)',
              border: '1.5px solid #a5d6a7',
              borderRadius: '1rem',
              padding: '1rem',
              boxShadow: '0 4px 14px rgba(26,77,26,0.06)',
              animation: 'notifSlideIn 0.3s ease forwards',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{
                      backgroundColor: '#1a4d1a', color: 'white',
                      padding: '0.15rem 0.5rem', borderRadius: '999px',
                      fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase'
                    }}>
                      {seedType}
                    </span>
                    <p style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1a4d1a', margin: 0 }}>
                      {variety}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <CalendarDays size={14} color="#2e7d32" />
                    <p style={{ fontSize: '0.78rem', color: '#2e7d32', margin: 0, fontWeight: 600 }}>
                      {date}
                    </p>
                    <span style={{ color: '#2e7d32', fontSize: '0.78rem', fontWeight: 600 }}>·</span>
                    <Clock3 size={14} color="#2e7d32" />
                    <p style={{ fontSize: '0.78rem', color: '#2e7d32', margin: 0, fontWeight: 600 }}>
                      {time}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} color="#3c763d" />
                    <p style={{ fontSize: '0.75rem', color: '#3c763d', margin: 0, fontWeight: 500 }}>
                      {venue}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDistDismiss(unreadDistAnn)}
                  style={{
                    flexShrink: 0, padding: '0.5rem 1rem',
                    backgroundColor: '#1a4d1a', color: 'white',
                    border: 'none', borderRadius: '0.75rem', cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.78rem',
                    boxShadow: '0 2px 6px rgba(26,77,26,0.15)',
                  }}
                >
                  Got it!
                </button>
              </div>
            </div>
          );
        })()}

      </div>

      {/* ── 4 ANALYTICS TILES + CROP MONITORING STATUS CARD ── */}
      <div style={{ marginBottom: '1.375rem' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>

          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: 36, height: 36, backgroundColor: '#dcfce7', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem' }}>
              <Sprout size={18} color="#166534" />
            </div>
            {statsLoading
              ? <div style={{ height: 20, width: 64, backgroundColor: '#f3f4f6', borderRadius: 6, marginBottom: 4 }} />
              : <p style={{ fontSize: dashStats.seed_display === 'Pending' ? '0.85rem' : '1rem', fontWeight: 800, color: dashStats.seed_display === 'Pending' ? '#d1d5db' : '#1a1a1a', margin: 0, lineHeight: 1.2 }}>
                  {dashStats.seed_display}
                </p>
            }
            <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.25rem 0 0', fontWeight: 600 }}>Selected Seed</p>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: 36, height: 36, backgroundColor: '#fef9c3', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem' }}>
              <Ruler size={18} color="#854d0e" />
            </div>
            {statsLoading
              ? <div style={{ height: 28, width: 56, backgroundColor: '#f3f4f6', borderRadius: 6, marginBottom: 4 }} />
              : <>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a1a', margin: 0, lineHeight: 1 }}>
                    {dashStats.total_hectares > 0 ? dashStats.total_hectares.toFixed(2) : '—'}
                  </p>
                  {dashStats.total_hectares > 0 && (
                    <p style={{ fontSize: '0.68rem', color: '#6b7280', margin: '0.1rem 0 0', fontWeight: 500 }}>hectares</p>
                  )}
                </>
            }
            <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.25rem 0 0', fontWeight: 600 }}>Total Farm Area</p>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: 36, height: 36, backgroundColor: '#eff6ff', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem' }}>
              <Wheat size={18} color="#1e40af" />
            </div>
            {statsLoading
              ? <div style={{ height: 28, width: 48, backgroundColor: '#f3f4f6', borderRadius: 6, marginBottom: 4 }} />
              : <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a1a', margin: 0, lineHeight: 1 }}>
                  {dashStats.monitoring_records ?? 0}
                </p>
            }
            <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.25rem 0 0', fontWeight: 600 }}>Monitoring Records</p>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: 36, height: 36, backgroundColor: dashStats.unread_count > 0 ? '#fef3c7' : '#f3f4f6', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem' }}>
              <Bell size={18} color={dashStats.unread_count > 0 ? '#d97706' : '#9ca3af'} />
            </div>
            {statsLoading
              ? <div style={{ height: 28, width: 40, backgroundColor: '#f3f4f6', borderRadius: 6, marginBottom: 4 }} />
              : <p style={{ fontSize: '1.4rem', fontWeight: 800, color: dashStats.unread_count > 0 ? '#d97706' : '#1a1a1a', margin: 0, lineHeight: 1 }}>
                  {dashStats.unread_count ?? 0}
                </p>
            }
            <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.25rem 0 0', fontWeight: 600 }}>Unread</p>
          </div>

        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', margin: '0 0 0.75rem' }}>
            Crop Monitoring Status
          </p>
          {statsLoading ? (
            <div>
              {[1, 2].map(i => (
                <div key={i} style={{ height: 48, backgroundColor: '#f3f4f6', borderRadius: 8, marginBottom: 8 }} />
              ))}
            </div>
          ) : dashStats.crop_status.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0, textAlign: 'center', padding: '0.75rem 0' }}>
              No monitoring records yet this season.
            </p>
          ) : (
            dashStats.crop_status.map((item) => {
              const phaseColors = {
                ESTABLISHMENT: { bg: '#dbeafe', text: '#1e40af' },
                TILLERING:     { bg: '#dcfce7', text: '#166534' },
                FLOWERING:     { bg: '#f3e8ff', text: '#7e22ce' },
                RIPENING:      { bg: '#fef9c3', text: '#854d0e' },
                HARVESTING:    { bg: '#ffedd5', text: '#c2410c' },
              };
              const colors = phaseColors[item.phase] || { bg: '#f3f4f6', text: '#6b7280' };
              return (
                <div key={item.seed_source} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem', borderRadius: '0.75rem',
                  backgroundColor: item.phase ? colors.bg + '60' : '#f9fafb',
                  border: `1px solid ${item.phase ? colors.bg : '#f3f4f6'}`,
                  marginBottom: '0.5rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700,
                      backgroundColor: item.phase ? colors.bg : '#e5e7eb',
                      color: item.phase ? colors.text : '#9ca3af',
                      padding: '0.15rem 0.5rem', borderRadius: '999px',
                    }}>
                      {item.seed_label}
                    </span>
                    {item.phase
                      ? <span style={{ fontSize: '0.78rem', fontWeight: 600, color: colors.text }}>✔ {item.phase_display}</span>
                      : <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>No monitoring yet</span>
                    }
                  </div>
                  {item.date_observed && (
                    <span style={{ fontSize: '0.68rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {item.date_observed}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

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
            <div style={{ width: 48, height: 48, borderRadius: '999px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem' }}>
              <Bell size={22} color="#9ca3af" />
            </div>
            <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>No announcements yet</p>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>Check back here for updates from your admin.</p>
          </div>
        )}

        {!annLoading && announcements.slice(0, 3).map(ann => (
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