// src/pages/brgy/BPDashboard.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  getAnnouncements, getFinalSeeds, getATFarmers,
  getBrgyMyAllocation, brgyConfirmAllocation,
} from '../../api/axios';
import AnnouncementCard from '../../components/announcements/AnnouncementCard';
import { Users, ChevronRight, ClipboardList, Bell, Package, CheckCircle, Calendar } from 'lucide-react';

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

  // ── Existing states (HINDI BINAGO) ──
  const [seedDismissed, setSeedDismissed] = useState(false);
  const [seedVisible, setSeedVisible]     = useState(true);
  const [finalSeeds, setFinalSeeds]       = useState([]);
  const [totalFarmers, setTotalFarmers]   = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading]       = useState(true);

  // ── Bagong states ──
  const [scheduleNotifs, setScheduleNotifs]   = useState([]);   // Notif 1
  const [schedDismissed, setSchedDismissed]   = useState({});
  const [myAllocations, setMyAllocations]     = useState([]);   // Notif 2
  const [allocConfirming, setAllocConfirming] = useState({});

  // ── Existing useEffect 1: Final Seeds (HINDI BINAGO) ──
  useEffect(() => {
    getFinalSeeds()
      .then(res => {
        const seeds = res.data || [];
        setFinalSeeds(seeds);
        if (seeds.length > 0) {
          const payload = {
            season:         seeds[0]?.season || 'WET',
            season_display: seeds[0]?.season_display || '',
            year:           seeds[0]?.year || new Date().getFullYear(),
            varieties: seeds.map(fs => ({
              seed_type: fs.seed_type,
              varieties: fs.varieties || [],
            })),
          };
          localStorage.setItem('brgy_final_seeds_notif', JSON.stringify(payload));
          emitStorageSync('brgy_final_seeds_notif', localStorage.getItem('brgy_final_seeds_notif'));
        }
        const key       = getDismissKey(seeds);
        const dismissed = key ? localStorage.getItem(key) === 'true' : false;
        setSeedDismissed(dismissed);
        setSeedVisible(!dismissed);
      })
      .catch(() => {});
  }, []);

  // ── Existing useEffect 2: Total Farmers (HINDI BINAGO) ──
  useEffect(() => {
    getATFarmers({ barangay, limit: 1, role: 'brgy' })
      .then(res => {
        const data = res.data;
        if (data?.count !== undefined) setTotalFarmers(data.count);
        else if (Array.isArray(data))  setTotalFarmers(data.length);
        else                           setTotalFarmers(null);
      })
      .catch(() => setTotalFarmers(null));
  }, [barangay]);

  // ── Existing useEffect 3: Announcements (HINDI BINAGO) ──
  useEffect(() => {
    getAnnouncements({ limit: 3 })
      .then(res => setAnnouncements(res.data || []))
      .catch(() => {})
      .finally(() => setAnnLoading(false));
  }, []);

  // ── NOTIF 1: Schedule — from backend SeedDelivery records ──
  useEffect(() => {
    const NOTIF_KEY = 'brgy_bell_notifs_BRGY';

    const pushNotif = (entry) => {
      const notifId = `schedule_${entry.seed_type_id}_${entry.variety_id || 'x'}_${entry.season}_${entry.year}`;
      const dismissKey = `brgy_sched_dismissed_${notifId}`;
      const isDismissed = localStorage.getItem(dismissKey) === 'true';

      setSchedDismissed(prev => ({ ...prev, [notifId]: isDismissed }));

      try {
        const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
        const existingNotif = existing.find(n => n.id === notifId);
        if (existingNotif && !existingNotif.read) return;
        if (isDismissed) return;

        const seasonDisplay = entry.season === 'WET' ? 'Wet Season' : 'Dry Season';
        const delivDate = entry.delivery_date
          ? new Date(entry.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
          : '—';

        const newNotif = {
          id:    notifId,
          title: `Seed Schedule — ${entry.seed_type_name}${entry.variety_name ? ' (' + entry.variety_name + ')' : ''}`,
          info:  `Delivery: ${delivDate} · ${entry.total_bags} bags · ${seasonDisplay} ${entry.year}`,
          date:  new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
          read:  false,
          route: '/brgy',
        };

        const next = [newNotif, ...existing];
        localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
        emitStorageSync(NOTIF_KEY, JSON.stringify(next));
      } catch {}
    };

    const loadScheduleNotifs = () => {
      getBrgyMyAllocation()
        .then(res => {
          const allocs = res.data || [];
          const entries = allocs.map(a => ({
            seed_type_id: a.seed_type_id,
            variety_id: a.variety_id,
            seed_type_name: a.seed_type_name,
            variety_name: a.variety_name,
            season: a.season,
            year: a.year,
            delivery_date: a.delivery_date,
            total_bags: a.allocated_bags,
          }));
          setScheduleNotifs(entries);
          entries.forEach(pushNotif);
        })
        .catch(() => {});
    };

    loadScheduleNotifs();

    const onStorage = (e) => {
      if (e?.key === 'agrice_seed_delivered_trigger') {
        loadScheduleNotifs();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const loadAllocations = () => {
    getBrgyMyAllocation()
      .then(res => {
        const allocs = res.data || [];
        setMyAllocations(allocs);

        const NOTIF_KEY = 'brgy_bell_notifs_BRGY';
        allocs.forEach(alloc => {
          if (alloc.already_confirmed || alloc.alloc_status === 'CONFIRMED') return;

          const notifId = `alloc_${alloc.delivery_id}_${alloc.season}_${alloc.year}`;
          try {
            const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
            if (existing.find(n => n.id === notifId)) return;

            const newNotif = {
              id:    notifId,
              title: `Seed Allocation — ${alloc.seed_type_name}${alloc.variety_name ? ' (' + alloc.variety_name + ')' : ''} · ${alloc.allocated_bags} bags`,
              info:  `${alloc.farmer_count} farmer${alloc.farmer_count !== 1 ? 's' : ''} · ${alloc.total_hectares} ha · ${alloc.season_display} ${alloc.year}`,
              date:  new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
              read:  false,
              route: '/brgy',
            };
            const next = [newNotif, ...existing];
            localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
            emitStorageSync(NOTIF_KEY, JSON.stringify(next));
          } catch {}
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadAllocations();

    const onStorage = (e) => {
      if (e?.key === 'agrice_seed_delivered_trigger') {
        loadAllocations();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Existing handler (HINDI BINAGO) ──
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
        const notifId  = `seed_${finalSeeds[0]?.season}_${finalSeeds[0]?.year}`;
        const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
        const updated  = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
        localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
        emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
      } catch {}
      navigate('/brgy/beneficiaries');
    }, 300);
  };

  // ── BAGONG handler: Dismiss schedule notif (Notif 1) ──
  const handleSchedDismiss = (entry) => {
    const notifId = `schedule_${entry.seed_type_id}_${entry.variety_id || 'x'}_${entry.season}_${entry.year}`;
    const dismissKey = `brgy_sched_dismissed_${notifId}`;
    localStorage.setItem(dismissKey, 'true');
    setSchedDismissed(prev => ({ ...prev, [notifId]: true }));

    const NOTIF_KEY = 'brgy_bell_notifs_BRGY';
    try {
      const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
      const updated  = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
      localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
      emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
    } catch {}
  };

  // ── BAGONG handler: Confirm Received (Notif 2) ──
  const handleConfirmAllocation = async (alloc) => {
    const key = `${alloc.delivery_id}`;
    setAllocConfirming(prev => ({ ...prev, [key]: true }));
    try {
      await brgyConfirmAllocation({
        delivery_id:    alloc.delivery_id,
        allocated_bags: alloc.allocated_bags,
      });

      // Mark bell notif as read
      const notifId   = `alloc_${alloc.delivery_id}_${alloc.season}_${alloc.year}`;
      const NOTIF_KEY = 'brgy_bell_notifs_BRGY';
      try {
        const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
        const updated  = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
        localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
        emitStorageSync(NOTIF_KEY, JSON.stringify(updated));
      } catch {}

      // Update local state — card disappears
      setMyAllocations(prev =>
        prev.map(a => a.delivery_id === alloc.delivery_id
          ? { ...a, already_confirmed: true, alloc_status: 'CONFIRMED' }
          : a)
      );
    } catch (err) {
      console.error('Failed to confirm allocation:', err);
    } finally {
      setAllocConfirming(prev => ({ ...prev, [key]: false }));
    }
  };

  const showSeedNotif = finalSeeds.length > 0 && !seedDismissed;

  return (
    <div style={{ padding: '1.25rem' }}>
      <style>{`
        @keyframes brgyPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
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
        .seed-notif-exit  { animation: notifFadeOut 0.3s ease forwards; overflow: hidden; pointer-events: none; }
      `}</style>

      {/* ── Greeting ── */}
      <div style={{ marginBottom: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{getGreeting()},</p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a1a1a', margin: '0.125rem 0 0.25rem', lineHeight: 1.2 }}>
          {firstName || 'President'}
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>Barangay President — AGRICE Lucban</p>
      </div>

      {/* ── Existing: Seed Finalized Notif (HINDI BINAGO) ── */}
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
              flexShrink: 0, padding: '0.5rem 0.875rem',
              backgroundColor: '#166534', color: 'white', border: 'none',
              borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700,
              fontSize: '0.78rem', display: 'flex', alignItems: 'center',
              gap: '0.3rem', whiteSpace: 'nowrap',
            }}
          >
            <ClipboardList size={14} /> Go to Beneficiaries
          </button>
        </div>
      )}

      {/* ── NOTIF 1: Seed Schedule (blue, Got It!) ── */}
      {scheduleNotifs
        .filter(entry => {
          const notifId = `schedule_${entry.seed_type_id}_${entry.variety_id || 'x'}_${entry.season}_${entry.year}`;
          return !schedDismissed[notifId];
        })
        .map(entry => {
          const notifId = `schedule_${entry.seed_type_id}_${entry.variety_id || 'x'}_${entry.season}_${entry.year}`;
          const seasonDisp = entry.season === 'WET' ? 'Wet Season' : 'Dry Season';
          const delivDate  = entry.delivery_date
            ? new Date(entry.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—';

          return (
            <div
              key={notifId}
              style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)',
                border: '1px solid #bfdbfe',
                borderRadius: '1rem',
                padding: '0.875rem 1rem',
                marginBottom: '0.875rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.75rem',
                boxShadow: '0 4px 12px rgba(30,64,175,0.08)',
                animation: 'notifFadeIn 0.3s ease forwards',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: '0.875rem', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Calendar size={18} color="#1e40af" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: '0.875rem', color: '#1e40af', margin: 0 }}>
                    Seed Schedule — {entry.seed_type_name}{entry.variety_name ? ` (${entry.variety_name})` : ''}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: '#1e40af', margin: '0.2rem 0 0', opacity: 0.85, lineHeight: 1.4 }}>
                    Delivery on {delivDate} · {entry.total_bags} bags · {seasonDisp} {entry.year}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSchedDismiss(entry)}
                style={{
                  flexShrink: 0, padding: '0.5rem 0.875rem',
                  backgroundColor: '#1e40af', color: 'white', border: 'none',
                  borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 700,
                  fontSize: '0.75rem', whiteSpace: 'nowrap',
                }}
              >
                Got It!
              </button>
            </div>
          );
        })
      }

      {/* ── NOTIF 2: Confirm Received Allocation ── */}
      {myAllocations
        .filter(alloc => !alloc.already_confirmed && alloc.alloc_status !== 'CONFIRMED')
        .map(alloc => {
          const key          = `${alloc.delivery_id}`;
          const isConfirming = allocConfirming[key];
          const isHybrid     = alloc.is_hybrid;
          const tagColor     = isHybrid ? '#1e40af' : '#166534';
          const tagBg        = isHybrid ? '#eff6ff' : '#f0fdf4';
          const tagBorder    = isHybrid ? '#bfdbfe' : '#bbf7d0';
          const iconBg       = isHybrid ? '#dbeafe' : '#dcfce7';

          return (
            <div
              key={key}
              style={{
                backgroundColor: tagBg,
                border: `1px solid ${tagBorder}`,
                borderRadius: '1rem',
                padding: '0.875rem 1rem',
                marginBottom: '0.875rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.75rem',
                boxShadow: `0 4px 12px ${tagColor}15`,
                animation: 'notifFadeIn 0.3s ease forwards',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: '0.875rem', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={18} color={tagColor} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: '0.875rem', color: tagColor, margin: 0 }}>
                    {alloc.seed_type_name}{alloc.variety_name ? ` (${alloc.variety_name})` : ''}{' '}
                    — <span style={{ fontSize: '1rem' }}>{alloc.allocated_bags}</span> seed bags
                  </p>
                  <p style={{ fontSize: '0.78rem', color: tagColor, margin: '0.2rem 0 0', opacity: 0.85, lineHeight: 1.4 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: '999px',
                      padding: '0.15rem 0.45rem',
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      backgroundColor: alloc.alloc_status === 'CONFIRMED' ? '#dcfce7' : '#fef3c7',
                      color: alloc.alloc_status === 'CONFIRMED' ? '#166534' : '#92400e',
                      marginBottom: '0.18rem',
                    }}>
                      {alloc.alloc_status || 'PENDING'}
                    </span>
                    <span style={{ display: 'block', marginTop: '0.15rem' }}>
                      {alloc.farmer_count} farmer{alloc.farmer_count !== 1 ? 's' : ''} · {alloc.total_hectares} ha
                      {' · '}{isHybrid ? '1 bag/ha (15kg)' : '2 bags/ha (20kg)'}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.72rem', marginTop: '0.1rem' }}>
                      {alloc.season_display} {alloc.year}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleConfirmAllocation(alloc)}
                disabled={isConfirming}
                style={{
                  flexShrink: 0, padding: '0.5rem 0.875rem',
                  backgroundColor: isConfirming ? '#d1d5db' : tagColor,
                  color: 'white', border: 'none', borderRadius: '0.75rem',
                  cursor: isConfirming ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.75rem',
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                <CheckCircle size={14} />
                {isConfirming ? 'Saving...' : 'Confirm Received'}
              </button>
            </div>
          );
        })
      }

      {/* ── Tiles (HINDI BINAGO) ── */}
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

      {/* ── Announcements (HINDI BINAGO) ── */}
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