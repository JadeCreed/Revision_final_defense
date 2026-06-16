// src/layouts/UserLayout.jsx
// ============================================================
// Bell dropdown and top-header layout for the user portal.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Bell, X, LogOut, User, ChevronRight } from 'lucide-react'; // ✅ single import
import { getGisActivePoll } from '../api/axios';
import { USER_NAV, ROLE_COLORS, ROLE_LABELS } from '../components/navigation/UserNavConfig';
import logo from '../assets/logo.png';

const DESKTOP_BREAKPOINT = 768;

const BellDropdown = ({ isDesktop, colors, role, navigate }) => {
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  const NOTIF_KEY = `brgy_bell_notifs_${role}`;

  const readNotifs = () => {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); }
    catch { return []; }
  };

  const [notifs, setNotifs] = useState(readNotifs);
  const unread = notifs.filter(n => !n.read).length;

  const syncSeedNotif = () => {
    if (role !== 'BRGY') return;
    try {
      const seeds = JSON.parse(localStorage.getItem('brgy_final_seeds_notif') || 'null');
      if (!seeds) return;

      const season = seeds.season || 'WET';
      const year = seeds.year || new Date().getFullYear();
      const notifId = `seed_${season}_${year}`;
      const dismissKey = `brgy_seed_dismissed_${season}_${year}`;
      const isDismissed = localStorage.getItem(dismissKey) === 'true';

      const existing = readNotifs();
      const alreadyExists = existing.find(n => n.id === notifId);

      if (alreadyExists) {
        if (isDismissed && !alreadyExists.read) {
          const updated = existing.map(n =>
            n.id === notifId ? { ...n, read: true } : n
          );
          localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
          setNotifs(updated);
        } else {
          setNotifs([...existing]);
        }
        return;
      }

      const infoText = Array.isArray(seeds.varieties)
        ? seeds.varieties
            .map(fs => `${fs.seed_type?.name || ''}: ${(fs.varieties || []).map(v => v.name).join(', ')}`)
            .filter(Boolean)
            .join(' · ')
        : 'New seed varieties have been confirmed.';

      const newNotif = {
        id: notifId,
        title: `Confirmed Seed Varieties — ${seeds.season_display || ''} ${year}`.trim(),
        info: infoText,
        date: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        read: isDismissed,
        route: '/brgy',
      };

      const next = [newNotif, ...existing];
      localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
      setNotifs(next);
    } catch {}
  };

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const syncBRGYSeedNotif = () => {
      if (role !== 'BRGY') return;
      try {
        const seeds = JSON.parse(localStorage.getItem('brgy_final_seeds_notif') || 'null');
        if (!seeds) return;

        const season = seeds.season || 'WET';
        const year = seeds.year || new Date().getFullYear();
        const notifId = `seed_${season}_${year}`;
        const dismissKey = `brgy_seed_dismissed_${season}_${year}`;
        const isDismissed = localStorage.getItem(dismissKey) === 'true';

        const existing = readNotifs();
        const alreadyExists = existing.find(n => n.id === notifId);

        if (alreadyExists) {
          if (isDismissed && !alreadyExists.read) {
            const updated = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
            localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
            setNotifs(updated);
          } else {
            setNotifs([...existing]);
          }
          return;
        }

        const infoText = Array.isArray(seeds.varieties)
          ? seeds.varieties.map(fs => `${fs.seed_type?.name || ''}: ${(fs.varieties || []).map(v => v.name).join(', ')}`).filter(Boolean).join(' · ')
          : 'New seed varieties have been confirmed.';

        const newNotif = {
          id: notifId,
          title: `Confirmed Seed Varieties — ${seeds.season_display || ''} ${year}`.trim(),
          info: infoText,
          date: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
          read: isDismissed,
          route: '/brgy',
        };

        const next = [newNotif, ...existing];
        localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
        setNotifs(next);
      } catch {}
    };

    const syncATSeedNotif = () => {
      if (role !== 'AT') return;
      try {
        const seeds = JSON.parse(localStorage.getItem('at_final_seeds_notif') || 'null');
        if (!seeds) return;

        const season = seeds.season || 'WET';
        const year = seeds.year || new Date().getFullYear();
        const notifId = `at_seed_${season}_${year}`;
        const dismissKey = `at_seed_dismissed_${season}_${year}`;
        const isDismissed = localStorage.getItem(dismissKey) === 'true';

        const existing = readNotifs();
        if (existing.find(n => n.id === notifId)) {
          if (isDismissed) {
            const updated = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
            localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
            setNotifs(updated);
          } else {
            setNotifs([...existing]);
          }
          return;
        }

        const infoText = Array.isArray(seeds.varieties)
          ? seeds.varieties.map(fs => `${fs.seed_type?.name || ''}: ${(fs.varieties || []).map(v => v.name).join(', ')}`).filter(Boolean).join(' · ')
          : 'New seed varieties have been confirmed.';

        const newNotif = {
          id: notifId,
          title: `Confirmed Seed Varieties — ${seeds.season_display || ''} ${year}`.trim(),
          info: infoText,
          date: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
          read: isDismissed,
          route: '/at',
        };
        const next = [newNotif, ...existing];
        localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
        setNotifs(next);
      } catch {}
    };

    const syncATMasterlistNotif = () => {
      if (role !== 'AT') return;
      try {
        const raw = localStorage.getItem('at_masterlist_notif');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data) return;

        const notifId = `at_masterlist_${data.barangay}`;
        const dismissKey = `at_masterlist_dismissed_${data.barangay}`;
        const isDismissed = localStorage.getItem(dismissKey) === 'true';

        const existing = readNotifs();
        if (existing.find(n => n.id === notifId)) {
          if (isDismissed) {
            const updated = existing.map(n => n.id === notifId ? { ...n, read: true } : n);
            localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
            setNotifs(updated);
          } else {
            setNotifs([...existing]);
          }
          return;
        }

        const newNotif = {
          id: notifId,
          title: `Seed Distribution Started — Brgy. ${data.barangay}`,
          info: `Brgy. ${data.barangay} has started encoding seed distribution for ${data.season_display} ${data.year}.`,
          date: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
          read: isDismissed,
          route: '/at',
        };
        const next = [newNotif, ...existing];
        localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
        setNotifs(next);
      } catch {}
    };

    const syncFARMERNotifs = () => {
      if (role !== 'FARMER') return;

      try {
        const seeds = JSON.parse(localStorage.getItem('farmer_final_seeds_notif') || 'null');
        if (!seeds) {
          setNotifs(readNotifs());
          return;
        }

        const season = seeds.season || 'WET';
        const year = seeds.year || new Date().getFullYear();
        const notifId = `farmer_seed_${season}_${year}`;
        const dismissKey = `farmer_seed_dismissed_${season}_${year}`;
        const isDismissed = localStorage.getItem(dismissKey) === 'true';
        const existing = readNotifs();

        if (existing.find(n => n.id === notifId)) {
          if (isDismissed) {
            const updated = existing.map(n =>
              n.id === notifId ? { ...n, read: true } : n
            );
            localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
            setNotifs(updated);
          } else {
            setNotifs([...existing]);
          }
          return;
        }

        const infoText = Array.isArray(seeds.varieties)
          ? seeds.varieties
              .map(fs => `${fs.seed_type?.name || ''}: ${(fs.varieties || []).map(v => v.name).join(', ')}`)
              .filter(Boolean)
              .join(' · ')
          : 'New seed varieties have been confirmed.';

        const newNotif = {
          id: notifId,
          title: `Confirmed Seed Varieties — ${seeds.season_display || ''} ${year}`.trim(),
          info: infoText,
          date: new Date().toLocaleDateString('en-PH', {
            month: 'short', day: 'numeric', year: 'numeric',
          }),
          read: isDismissed,
          route: '/farmer',
        };

        const next = [newNotif, ...existing];
        localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
        setNotifs(next);
      } catch {
        setNotifs(readNotifs());
      }
    };

    if (role === 'BRGY') syncBRGYSeedNotif();
    if (role === 'AT') {
      syncATSeedNotif();
      syncATMasterlistNotif();
    }
    if (role === 'FARMER') {
      syncFARMERNotifs();
    }

    const onStorage = (e) => {
      if (!e || !e.key) return;

      if (e.key === NOTIF_KEY) {
        setNotifs(readNotifs());
        return;
      }

      if (role === 'BRGY') {
        if (e.key === 'brgy_final_seeds_notif' || e.key.startsWith('brgy_seed_dismissed_')) {
          setNotifs(readNotifs());
          syncBRGYSeedNotif();
        }
      }

      if (role === 'AT') {
        if (
          e.key === 'at_final_seeds_notif' ||
          e.key.startsWith('at_seed_dismissed_') ||
          e.key === 'at_masterlist_notif' ||
          e.key.startsWith('at_masterlist_dismissed_')
        ) {
          setNotifs(readNotifs());
          syncATSeedNotif();
          syncATMasterlistNotif();
        }
      }

      if (role === 'FARMER') {
        if (
          e.key === NOTIF_KEY ||
          e.key === 'farmer_final_seeds_notif' ||
          e.key.startsWith('farmer_seed_dismissed_')
        ) {
          setNotifs(readNotifs());
          syncFARMERNotifs();
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [role]);

  const handleNotifClick = (notif) => {
    const updated = notifs.map(n => n.id === notif.id ? { ...n, read: true } : n);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    setNotifs(updated);
    setOpen(false);
    navigate(notif.route);
  };

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        title={unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'Notifications'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.25rem', position: 'relative', display: 'flex', alignItems: 'center',
        }}
      >
        <Bell size={22} color={isDesktop ? '#374151' : 'rgba(255,255,255,0.9)'} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: '0px', right: '0px', minWidth: '16px', height: '16px',
            backgroundColor: '#dc2626', borderRadius: '999px', border: `2px solid ${isDesktop ? 'white' : colors.primary}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: 'white',
            padding: '0 2px', animation: 'bellPulse 2s ease-in-out infinite',
          }}>
            {Math.min(unread, 9)}{unread > 9 ? '+' : ''}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '340px', backgroundColor: 'white', borderRadius: '1rem',
          border: '1px solid #e5e7eb', boxShadow: '0 16px 40px rgba(0,0,0,0.13)', overflow: 'hidden', zIndex: 1100,
          animation: 'notifDropIn 0.2s ease forwards',
        }}>
          <style>{`
            @keyframes notifDropIn {
              from { opacity: 0; transform: translateY(-6px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          <div style={{ padding: '0.875rem 1rem 0.75rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={16} color="#374151" />
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827' }}>Notifications</span>
              {unread > 0 && <span style={{ backgroundColor: '#dc2626', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: '999px' }}>{unread} NEW</span>}
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
              <X size={15} color="#9ca3af" />
            </button>
          </div>

          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={28} color="#d1d5db" />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6b7280', margin: 0 }}>No notifications yet</p>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>You&apos;re all caught up</p>
              </div>
            ) : notifs.map((notif, idx) => (
              <button
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                style={{
                  width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '0.875rem 1rem',
                  backgroundColor: notif.read ? 'white' : '#f0fdf4', borderBottom: idx < notifs.length - 1 ? '1px solid #f3f4f6' : 'none',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = notif.read ? '#f9fafb' : '#dcfce7'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = notif.read ? 'white' : '#f0fdf4'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', lineHeight: 1.3, flex: 1 }}>{notif.title}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    {!notif.read && <span style={{ width: '8px', height: '8px', borderRadius: '999px', backgroundColor: '#dc2626', flexShrink: 0 }} />}
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{notif.date}</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: notif.read ? '#6b7280' : '#166534', lineHeight: 1.45 }}>{notif.info}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const UserLayout = () => {
  const { role, firstName, lastName, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = USER_NAV[role] || [];
  const colors   = ROLE_COLORS[role] || ROLE_COLORS.FARMER;
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();

  // ── STATE ──
  const [profileOpen, setProfileOpen] = useState(false);
  const [isDesktop, setIsDesktop]     = useState(window.innerWidth >= DESKTOP_BREAKPOINT);
  const [activeSeason, setActiveSeason] = useState(null);

  const fetchActiveSeason = useCallback(async () => {
    try {
      const res = await getGisActivePoll();
      if (res.data) {
        setActiveSeason(res.data);
      }
    } catch {
      // Silent fail — season pill is non-critical
    }
  }, []);

  // ── RESIZE LISTENER ──
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchActiveSeason();
  }, [fetchActiveSeason]);

  // ── LOGOUT ──
  const handleLogout = () => {
    localStorage.removeItem('agrice_badge_seen');
    logout();
    navigate('/');
  };

  // ── RENDER NAV ITEM (shared for sidebar + bottom nav) ──
  const renderNavItem = (item, isSidebar = false) => {
    const Icon   = item.icon;
    const isHome = item.path === `/${role.toLowerCase()}`;
    const isActive = isHome
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path);

    if (isSidebar) {
      return (
        <NavLink
          key={item.path}
          to={item.path}
          end={isHome}
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             '0.875rem',
            padding:         '0.75rem 1.5rem',
            textDecoration:  'none',
            color:           isActive ? colors.accent : 'rgba(255,255,255,0.85)',
            backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
            borderLeft:      isActive ? `3px solid ${colors.accent}` : '3px solid transparent',
            fontSize:        '0.875rem',
            fontWeight:      isActive ? '600' : '400',
            transition:      'all 0.15s ease',
          }}
        >
          <Icon size={18} color={isActive ? colors.accent : 'rgba(255,255,255,0.85)'} />
          <span>{item.label}</span>
        </NavLink>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={isHome}
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            '3px',
          textDecoration: 'none',
          color:          isActive ? colors.primary : '#9ca3af',
          padding:        '0.375rem 0.5rem',
          minWidth:       '52px',
          position:       'relative',
          transition:     'color 0.15s',
        }}
      >
        {isActive && (
          <span style={{
            position:        'absolute',
            bottom:          '-4px',
            left:            '50%',
            transform:       'translateX(-50%)',
            width:           '20px',
            height:          '3px',
            backgroundColor: colors.primary,
            borderRadius:    '2px',
          }} />
        )}
        <Icon size={22} color={isActive ? colors.primary : '#9ca3af'} />
        <span style={{ fontSize: '0.6rem', fontWeight: isActive ? '700' : '400' }}>
          {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>

      {/* ── GLOBAL ANIMATION STYLES ── */}
      {/* Put here so bellPulse is available wherever the bell renders */}
      <style>{`
        @keyframes bellPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.2); }
        }
      `}</style>

      {/* ════════════════════════════════════════════
          SIDEBAR — desktop only
      ════════════════════════════════════════════ */}
      {isDesktop && (
        <div style={{
          position:        'fixed',
          top:             0,
          left:            0,
          width:           '240px',
          height:          '100vh',
          backgroundColor: colors.primary,
          display:         'flex',
          flexDirection:   'column',
          zIndex:          50,
          overflowY:       'auto',
        }}>
          {/* Logo */}
          <div style={{
            padding:      '1.25rem 1.5rem',
            display:      'flex',
            alignItems:   'center',
            gap:          '0.625rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            flexShrink:   0,
          }}>
            <div style={{
              width: '36px', height: '36px',
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              backgroundColor: 'transparent'
            }}>
              <img src={logo} alt="AGRICE logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem' }}>AGRICE</span>
          </div>

          {/* Role label */}
          <div style={{ padding: '0.75rem 1.5rem 0.25rem', opacity: 0.6 }}>
            <span style={{
              color: 'white', fontSize: '0.7rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {ROLE_LABELS[role]}
            </span>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto' }}>
            {navItems.map(item => renderNavItem(item, true))}
          </nav>

          {/* User info + logout */}
          <div style={{
            padding:    '1rem 1.5rem',
            borderTop:  '1px solid rgba(255,255,255,0.1)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: 36, height: 36,
                backgroundColor: colors.accent,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700, color: colors.primary,
                flexShrink: 0,
              }}>
                {initials || '?'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{
                  color: 'white', fontWeight: 600, fontSize: '0.875rem',
                  margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {firstName} {lastName}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', margin: 0 }}>
                  {ROLE_LABELS[role]}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                fontSize: '0.85rem', padding: '0.25rem 0', width: '100%',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'white'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MAIN CONTENT AREA
      ════════════════════════════════════════════ */}
      <div style={{
        flex:           1,
        marginLeft:     isDesktop ? '240px' : '0',
        display:        'flex',
        flexDirection:  'column',
        minHeight:      '100vh',
        width:          '100%',
        boxShadow:      isDesktop ? 'none' : '0 0 30px rgba(0,0,0,0.06)',
      }}>

        {/* ── TOP HEADER ── */}
        <div style={{
          position:        'sticky',
          top:             0,
          backgroundColor: isDesktop ? 'white' : colors.primary,
          padding:         isDesktop ? '0.75rem 1.5rem' : '0.875rem 1.25rem',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          zIndex:          1000,
          boxShadow:       isDesktop ? '0 1px 4px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.15)',
          borderBottom:    isDesktop ? '1px solid #e5e7eb' : 'none',
        }}>

          {/* Left side */}
          {!isDesktop ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px', height: '32px',
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                backgroundColor: 'transparent'
              }}>
                <img src={logo} alt="AGRICE logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>AGRICE</span>
            </div>
          ) : (
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a' }}>
              {ROLE_LABELS[role]} Portal
            </span>
          )}

          {/* Right side: bell + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>

            {/* ── ACTIVE SEASON PILL ── */}
            {activeSeason && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: isDesktop ? '#f0fdf4' : 'rgba(255,255,255,0.15)',
                border: isDesktop ? '1px solid #bbf7d0' : '1px solid rgba(255,255,255,0.25)',
                borderRadius: '999px',
                padding: '0.25rem 0.75rem',
                flexShrink: 0,
              }}>
                <svg
                  width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke={isDesktop ? '#16a34a' : 'rgba(255,255,255,0.9)'}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  {activeSeason.season === 'WET' ? (
                    <>
                      <path d="M12 2v6M12 22v-2M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-2M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
                    </>
                  ) : (
                    <>
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                    </>
                  )}
                </svg>
                <div style={{ lineHeight: 1 }}>
                  <span style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: isDesktop ? '#16a34a' : 'rgba(255,255,255,0.7)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'block',
                  }}>
                    {activeSeason.season === 'WET' ? 'Wet Season' : 'Dry Season'}
                  </span>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: isDesktop ? '#14532d' : 'white',
                    display: 'block',
                  }}>
                    {activeSeason.year}
                  </span>
                </div>
              </div>
            )}

            {/* ── BELL ICON with dropdown ── */}
            <BellDropdown
              isDesktop={isDesktop}
              colors={colors}
              role={role}
              navigate={navigate}
            />

            {/* Avatar — opens profile drawer */}
            <button
              onClick={() => setProfileOpen(true)}
              style={{
                width:           36,
                height:          36,
                backgroundColor: isDesktop ? colors.primary : 'rgba(255,255,255,0.2)',
                borderRadius:    '50%',
                border:          isDesktop
                  ? `2px solid ${colors.primary}`
                  : '2px solid rgba(255,255,255,0.5)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                cursor:          'pointer',
                fontSize:        '0.8rem',
                fontWeight:      700,
                color:           'white',
                transition:      'opacity 0.15s',
              }}
            >
              {initials || <User size={16} color="white" />}
            </button>
          </div>
        </div>

        {/* ── PAGE CONTENT ── */}
        <div style={{
          flex:          1,
          display:       'flex',
          flexDirection: 'column',
          minHeight:     0,
          overflowY:     'hidden',
        }}>
          <Outlet />
        </div>
      </div>

      {/* ════════════════════════════════════════════
          BOTTOM NAVIGATION — mobile only
      ════════════════════════════════════════════ */}
      {!isDesktop && (
        <div style={{
          position:        'fixed',
          bottom:          0,
          left:            0,
          right:           0,
          width:           '100%',
          maxWidth:        '100%',
          backgroundColor: 'white',
          display:         'flex',
          justifyContent:  'space-around',
          alignItems:      'center',
          height:          '72px',
          zIndex:          1100,
          boxShadow:       '0 -2px 16px rgba(0,0,0,0.08)',
          borderTop:       '1px solid #e5e7eb',
          paddingBottom:   'env(safe-area-inset-bottom)',
        }}>
          {navItems.map(item => renderNavItem(item, false))}
        </div>
      )}

      {/* ════════════════════════════════════════════
          PROFILE DRAWER
      ════════════════════════════════════════════ */}
      {profileOpen && (
        <>
          <div
            onClick={() => setProfileOpen(false)}
            style={{
              position:        'fixed',
              inset:           0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex:          1000,
            }}
          />
          <div style={{
            position:        'fixed',
            bottom:          isDesktop ? 'auto' : 0,
            top:             isDesktop ? '70px' : 'auto',
            right:           isDesktop ? '1.5rem' : 'auto',
            left:            isDesktop ? 'auto' : '50%',
            transform:       isDesktop ? 'none' : 'translateX(-50%)',
            width:           isDesktop ? '260px' : '100%',
            maxWidth:        isDesktop ? '260px' : '480px',
            backgroundColor: 'white',
            borderRadius:    isDesktop ? '0.875rem' : '1.25rem 1.25rem 0 0',
            zIndex:          1100,
            padding:         '1.5rem',
            boxShadow:       '0 -4px 24px rgba(0,0,0,0.15)',
          }}>

            {/* Handle bar (mobile only) */}
            {!isDesktop && (
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{
                  width: 40, height: 4,
                  backgroundColor: '#e5e7eb',
                  borderRadius: 2, margin: '0 auto',
                }} />
              </div>
            )}

            {/* Close */}
            <button
              onClick={() => setProfileOpen(false)}
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <X size={18} color="#9ca3af" />
            </button>

            {/* User info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: 52, height: 52,
                backgroundColor: colors.primary,
                borderRadius:    '50%',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                fontSize:        '1.1rem',
                fontWeight:      700,
                color:           'white',
                flexShrink:      0,
              }}>
                {initials || '?'}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a', margin: 0 }}>
                  {firstName} {lastName}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.125rem 0 0' }}>
                  {ROLE_LABELS[role]}
                </p>
              </div>
            </div>

            {/* My Profile link */}
            <button
              onClick={() => {
                navigate(`/${role.toLowerCase()}/profile`);
                setProfileOpen(false);
              }}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                width:          '100%',
                padding:        '0.75rem 0',
                borderBottom:   '1px solid #f3f4f6',
                background:     'none',
                border:         'none',
                cursor:         'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <User size={16} color="#374151" />
                <span style={{ fontSize: '0.875rem', color: '#374151' }}>My Profile</span>
              </div>
              <ChevronRight size={14} color="#9ca3af" />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '0.75rem',
                width:      '100%',
                padding:    '0.75rem 0',
                marginTop:  '0.5rem',
                background: 'none',
                border:     'none',
                cursor:     'pointer',
              }}
            >
              <LogOut size={16} color="#dc2626" />
              <span style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: 600 }}>Logout</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UserLayout;