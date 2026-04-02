// src/components/navigation/Sidebar.jsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { MENU_CONFIG } from './MenuConfig';
import { getBadgeCount } from '../../api/axios';
import { LogOut, ChevronDown } from 'lucide-react';

// ── localStorage helpers ──
const LS_KEY = 'agrice_badge_seen';

const getSeenFromStorage = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
};

const setSeenInStorage = (key, value) => {
  try {
    const s = getSeenFromStorage();
    s[key] = value;
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
};

const Sidebar = () => {
  const { role, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();
  const menus            = MENU_CONFIG[role] || [];

  const [liveBadges, setLiveBadges] = useState({});
  // Initialize seen from localStorage immediately — survives refresh
  const [seen, setSeen]             = useState(getSeenFromStorage);
  const [openGroups, setOpenGroups] = useState({});
  const pollRef                     = useRef(null);

  // ── FETCH LIVE BADGES every 15s ──
  const fetchBadges = useCallback(() => {
    if (role !== 'ADMIN') return;
    getBadgeCount()
      .then(res => setLiveBadges(res.data))
      .catch(() => {});
  }, [role]);

  useEffect(() => {
    // ✅ Always clear any existing interval first
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    // ✅ Only start polling if role is ADMIN
    if (role !== 'ADMIN') return;

    fetchBadges();
    pollRef.current = setInterval(fetchBadges, 15000);

    // ✅ Cleanup on unmount OR when role/fetchBadges changes
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      };
  }, [fetchBadges, role]);   // ← add role to deps so it reacts to role changes

  // ── AUTO-OPEN DROPDOWN if child route active ──
  useEffect(() => {
    menus.forEach(item => {
      if (!item.hasChildren) return;
      const anyActive = item.children.some(c => location.pathname.startsWith(c.path));
      if (anyActive) setOpenGroups(prev => ({ ...prev, [item.label]: true }));
    });
  }, [location.pathname]);

  // ── AUTO-MARK SEEN when admin is on the badge page ──
  // Runs whenever route changes OR live badges update
  useEffect(() => {
    if (role !== 'ADMIN') return;
    menus.forEach(item => {
      if (!item.hasChildren) return;
      item.children.forEach(child => {
        if (!child.badgeKey) return;
        const onPage = location.pathname.startsWith(child.path);
        if (!onPage) return;
        const live    = liveBadges[child.badgeKey] || 0;
        const current = getSeenFromStorage()[child.badgeKey] || 0;
        if (live > current) {
          setSeenInStorage(child.badgeKey, live);
          setSeen(prev => ({ ...prev, [child.badgeKey]: live }));
        }
      });
    });
  }, [location.pathname, liveBadges, role]);

  // ── ON CLICK: mark badge as seen immediately ──
  const handleChildClick = (child) => {
    if (!child.badgeKey) return;
    const live = liveBadges[child.badgeKey] || 0;
    setSeenInStorage(child.badgeKey, live);
    setSeen(prev => ({ ...prev, [child.badgeKey]: live }));
  };

  // ── COMPUTE DISPLAY BADGE ──
  // Shows only items that arrived AFTER last seen
  const getDisplayBadge = (badgeKey) => {
    if (!badgeKey) return 0;
    const live   = liveBadges[badgeKey] || 0;
    const seenN  = seen[badgeKey]       || 0;
    return Math.max(0, live - seenN);
  };

  const handleLogout = () => {
    // Clear seen on logout so fresh session starts clean
    localStorage.removeItem(LS_KEY);
    logout();
    navigate('/');
  };

  const toggleGroup = (label) =>
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));

  // ── STYLES ──
  const base = {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.75rem 1.5rem', textDecoration: 'none',
    fontSize: '0.875rem', transition: 'all 0.15s ease',
    borderLeft: '3px solid transparent',
    width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
  };

  const linkStyle = (active) => ({
    ...base,
    fontWeight:      active ? '600' : '400',
    color:           active ? '#f5c842' : 'rgba(255,255,255,0.85)',
    backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
    borderLeft:      active ? '3px solid #f5c842' : '3px solid transparent',
  });

  const childStyle = (active) => ({
    ...linkStyle(active),
    padding:  '0.6rem 1.5rem 0.6rem 3rem',
    fontSize: '0.825rem',
  });

  const parentStyle = (active) => ({
    ...base,
    fontWeight:      active ? '600' : '400',
    color:           active ? '#f5c842' : 'rgba(255,255,255,0.85)',
    backgroundColor: active ? 'rgba(255,255,255,0.05)' : 'transparent',
    borderLeft:      '3px solid transparent',
  });

  const badgePill = {
    backgroundColor: '#f5c842', color: '#1a1a1a',
    borderRadius: '999px', fontSize: '0.65rem', fontWeight: '700',
    padding: '1px 7px', marginLeft: 'auto', flexShrink: 0,
  };

  const renderIcon = (icon, active, size = 18) => {
    if (!icon) return null;
    if (typeof icon === 'string') return <span style={{ fontSize: '1rem' }}>{icon}</span>;
    const I = icon;
    return <I size={size} color={active ? '#f5c842' : 'rgba(255,255,255,0.85)'} />;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '240px', height: '100vh',
      backgroundColor: '#1a4d1a', display: 'flex', flexDirection: 'column',
      zIndex: 50, overflowY: 'auto',
    }}>
      {/* LOGO */}
      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.625rem', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, backgroundColor: '#f5c842', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          🌾
        </div>
        <span style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem' }}>AGRICE</span>
      </div>

      {/* MENU */}
      <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
        {menus.map(item => {
          if (item.hasChildren) {
            const isOpen   = !!openGroups[item.label];
            const isActive = item.children.some(c => location.pathname.startsWith(c.path));
            return (
              <div key={item.label}>
                <button onClick={() => toggleGroup(item.label)} style={parentStyle(isActive)}>
                  <span style={{ minWidth: 20, display: 'flex', alignItems: 'center' }}>
                    {renderIcon(item.icon, isActive)}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <ChevronDown size={14} color="rgba(255,255,255,0.5)"
                    style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>

                {isOpen && item.children.map(child => {
                  const childActive =
                    location.pathname === child.path ||
                    location.pathname.startsWith(child.path + '/');
                  const badge = getDisplayBadge(child.badgeKey);

                  return (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      onClick={() => handleChildClick(child)}
                      style={childStyle(childActive)}
                    >
                      <span style={{ minWidth: 16, display: 'flex', alignItems: 'center' }}>
                        {renderIcon(child.icon, childActive, 16)}
                      </span>
                      <span style={{ flex: 1 }}>{child.label}</span>
                      {badge > 0 && <span style={badgePill}>{badge}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          }

          const isRoot = ['/admin', '/farmer', '/at', '/brgy'].includes(item.path);
          return (
            <NavLink key={item.path} to={item.path} end={isRoot}>
              {({ isActive }) => (
                <div style={linkStyle(isActive)}>
                  <span style={{ minWidth: 20, display: 'flex', alignItems: 'center' }}>
                    {renderIcon(item.icon, isActive)}
                  </span>
                  <span>{item.label}</span>
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* LOGOUT */}
      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontSize: '0.9rem', width: '100%', padding: '0.5rem 0' }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}>
          <LogOut size={18} color="rgba(255,255,255,0.75)" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;