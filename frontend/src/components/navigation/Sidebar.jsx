// src/components/navigation/Sidebar.jsx
// ============================================================
// Desktop sidebar with:
// - Lucide icons (replacing emojis)
// - Badge counts poll every 15s
// - Badge DISAPPEARS when admin clicks that sub-menu
// - Dropdown for User Management
// ============================================================

import { useState, useEffect, useRef,useCallback} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { MENU_CONFIG } from './MenuConfig';
import { getBadgeCount } from '../../api/axios';
import { LogOut, ChevronDown } from 'lucide-react';

const BADGE_SEEN_KEY = 'agrice_badge_seen';

const loadSeenCounts = () => {
  try {
    return JSON.parse(localStorage.getItem(BADGE_SEEN_KEY) || '{}');
  } catch { return {}; }
};

const saveSeenCount = (key, value) => {
  try {
    const current = loadSeenCounts();
    current[key] = value;
    localStorage.setItem(BADGE_SEEN_KEY, JSON.stringify(current));
  } catch {}
};

const Sidebar = () => {
  const { role, logout }  = useAuth();
  const navigate          = useNavigate();
  const location          = useLocation();
  const menus             = MENU_CONFIG[role] || [];

  // Badge counts: { pending_farmers: 3, reset_requests: 2 }
  const [badges, setBadges]         = useState({});
  // Live badge counts from API: { pending_farmers: 8, reset_requests: 5 }
  const [liveBadges, setLiveBadges]   = useState({});
  // Track which badge keys have been "seen" (admin clicked that menu)
  // Once seen → badge is 0 until next poll finds NEW data
  const [seenCounts, setSeenCounts] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const pollRef                     = useRef(null);

  // ── FETCH BADGES ──
  const fetchBadges = useCallback(() => {
    if (role !== 'ADMIN') return;
    getBadgeCount()
      .then(res => setLiveBadges(res.data))
      .catch(() => {});
  }, [role]);

  useEffect(() => {
    if (role !== 'ADMIN') return;
    fetchBadges();
    pollRef.current = setInterval(fetchBadges, 15000);
    return () => clearInterval(pollRef.current);
  }, [fetchBadges]);

  // ── AUTO-OPEN DROPDOWN if child route is active ──
  useEffect(() => {
    menus.forEach(item => {
      if (item.hasChildren) {
        const anyChildActive = item.children.some(c => //c mean child
          location.pathname.startsWith(c.path) 
        );
        if (anyChildActive) {
          setOpenGroups(prev => ({ ...prev, [item.label]: true }));
        }
      }
    });
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/'); };
  const toggleGroup  = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));

  // When admin clicks a child link that has a badge:
  // mark it as "seen" so badge shows 0 immediately (before next poll)
  const handleChildClick = (child) => {
    if (!child.badgeKey) return;
    const currentCount = liveBadges[child.badgeKey] || 0;
    // Save "I have seen up to this count" in localStorage
    saveSeenCount(child.badgeKey, currentCount);
    setSeenCounts(prev => ({ ...prev, [child.badgeKey]: currentCount }));
  };

  // Compute effective badge count: 0 if seen count equals current count
  const getDisplayBadge = (badgeKey) => {
    if (!badgeKey) return 0;
    const live = liveBadges[badgeKey] || 0;
    const seen = seenCounts[badgeKey] || 0;
    const diff = live - seen;
    return diff > 0 ? diff : 0;
  };

  // ── CHECK IF ADMIN IS CURRENTLY ON A BADGE PAGE ──
  // If admin is already on the page, immediately mark as seen
  useEffect(() => {
    if (role !== 'ADMIN') return;
    menus.forEach(item => {
      if (!item.hasChildren) return;
      item.children.forEach(child => {
        if (!child.badgeKey) return;
        const isOnPage = location.pathname.startsWith(child.path);
        if (isOnPage) {
          const currentCount = liveBadges[child.badgeKey] || 0;
          const seenCount    = seenCounts[child.badgeKey] || 0;
          // If there's a badge showing and we're on the page, mark as seen
          if (currentCount > seenCount) {
            saveSeenCount(child.badgeKey, currentCount);
            setSeenCounts(prev => ({ ...prev, [child.badgeKey]: currentCount }));
          }
        }
      });
    });
  }, [location.pathname, liveBadges]); // runs when route changes OR when new badges arrive


  const baseLink = {
    display:        'flex',
    alignItems:     'center',
    gap:            '0.75rem',
    padding:        '0.75rem 1.5rem',
    textDecoration: 'none',
    fontSize:       '0.875rem',
    transition:     'all 0.15s ease',
    borderLeft:     '3px solid transparent',
    width:          '100%',
    textAlign:      'left',
    background:     'none',
    border:         'none',
    cursor:         'pointer',
  };

  const linkStyle = (isActive) => ({
    ...baseLink,
    fontWeight:      isActive ? '600' : '400',
    color:           isActive ? '#f5c842' : 'rgba(255,255,255,0.85)',
    backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
    borderLeft:      isActive ? '3px solid #f5c842' : '3px solid transparent',
  });

  const childLinkStyle = (isActive) => ({
    ...linkStyle(isActive),
    padding:  '0.6rem 1.5rem 0.6rem 3rem',
    fontSize: '0.825rem',
  });

  const parentButtonStyle = (isParentActive) => ({
    ...baseLink,
    fontWeight:      isParentActive ? '600' : '400',
    color:           isParentActive ? '#f5c842' : 'rgba(255,255,255,0.85)',
    backgroundColor: isParentActive ? 'rgba(255,255,255,0.05)' : 'transparent',
    borderLeft:      '3px solid transparent',
  });

  const badgeStyle = {
    backgroundColor: '#f5c842',
    color:           '#1a1a1a',
    borderRadius:    '999px',
    fontSize:        '0.65rem',
    fontWeight:      '700',
    padding:         '1px 7px',
    marginLeft:      'auto',
    flexShrink:      0,
  };

  // Render an icon — supports both Lucide components and string emojis
  const renderIcon = (icon, isActive, size = 18) => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return <span style={{ fontSize: '1rem' }}>{icon}</span>;
    }
    const Icon = icon;
    return <Icon size={size} color={isActive ? '#f5c842' : 'rgba(255,255,255,0.85)'} />;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '240px', height: '100vh',
      backgroundColor: '#1a4d1a',
      display: 'flex', flexDirection: 'column',
      zIndex: 50, overflowY: 'auto',
    }}>

      {/* LOGO */}
      <div style={{
        padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center',
        gap: '0.625rem', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0,
      }}>
        <div style={{
          width: '36px', height: '36px', backgroundColor: '#f5c842',
          borderRadius: '8px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          🌾
        </div>
        <span style={{ color: 'white', fontWeight: '800', fontSize: '1.25rem' }}>AGRICE</span>
      </div>

      {/* MENU */}
      <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
        {menus.map(item => {

          // ── DROPDOWN PARENT ──
          if (item.hasChildren) {
            const isOpen = !!openGroups[item.label];
            const isParentActive = item.children.some(c =>
              location.pathname.startsWith(c.path)
            );

            return (
              <div key={item.label}>
                <button onClick={() => toggleGroup(item.label)} style={parentButtonStyle(isParentActive)}>
                  <span style={{ minWidth: '20px', display: 'flex', alignItems: 'center' }}>
                    {renderIcon(item.icon, isParentActive)}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <ChevronDown
                    size={14}
                    color="rgba(255,255,255,0.5)"
                    style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {isOpen && (
                  <div>
                    {item.children.map(child => {
                      const isChildActive =
                        location.pathname === child.path ||
                        location.pathname.startsWith(child.path + '/');

                      // Show only NEW count since last visit
                      const displayBadge = getDisplayBadge(child.badgeKey);

                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          onClick={() => handleChildClick(child)}
                          style={childLinkStyle(isChildActive)}
                        >
                          <span style={{ minWidth: '16px', display: 'flex', alignItems: 'center' }}>
                            {renderIcon(child.icon, isChildActive, 16)}
                          </span>
                          <span style={{ flex: 1 }}>{child.label}</span>
                          {displayBadge > 0 && (
                            <span style={badgeStyle}>{displayBadge}</span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // ── REGULAR ITEM ──
          const isExactRoot = ['/admin', '/farmer', '/at', '/brgy'].includes(item.path);
          return (
            <NavLink key={item.path} to={item.path} end={isExactRoot}>
              {({ isActive }) => (
                <div style={linkStyle(isActive)}>
                  <span style={{ minWidth: '20px', display: 'flex', alignItems: 'center' }}>
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
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500',
            padding: '0.5rem 0', width: '100%', transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
        >
          <LogOut size={18} color="rgba(255,255,255,0.75)" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;