import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { USER_NAV, ROLE_COLORS, ROLE_LABELS } from '../components/navigation/UserNavConfig';
import {
  Bell, X, LogOut, User, ChevronRight, Menu
} from 'lucide-react';

// ── Toggle: set to true when weather API is ready ──
const SHOW_WEATHER = false;

// ── Breakpoint for sidebar vs bottom nav ──
const DESKTOP_BREAKPOINT = 768;

const UserLayout = () => {
  const { role, firstName, lastName, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Nav items for this role
  const navItems = USER_NAV[role] || [];

  // Role-specific colors
  const colors = ROLE_COLORS[role] || ROLE_COLORS.FARMER;

  // User's display initials for avatar
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();

  // Controls the profile drawer (mobile slide-up / desktop panel)
  const [profileOpen, setProfileOpen] = useState(false);

  // Track window width for responsive behavior
  const [isDesktop, setIsDesktop] = useState(
    window.innerWidth >= DESKTOP_BREAKPOINT
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    // Clear badge seen state on logout so fresh session starts clean
    localStorage.removeItem('agrice_badge_seen');
    logout();
    navigate('/');
  };

  // ── SHARED: render a single nav item ──
  // Used in both sidebar (desktop) and bottom nav (mobile)
  const renderNavItem = (item, isSidebar = false) => {
    const Icon = item.icon;

    // Determine if this nav item is active
    // For Home (exact root path) — only active on exact match
    const isHome = item.path === `/${role.toLowerCase()}`;
    const isActive = isHome
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path);

    if (isSidebar) {
      // ── SIDEBAR STYLE (desktop) ──
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

    // ── BOTTOM NAV STYLE (mobile) ──
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
        {/* Active underline indicator */}
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
        <span style={{
          fontSize:   '0.6rem',
          fontWeight: isActive ? '700' : '400',
        }}>
          {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>

      {/* ════════════════════════════════════════════
          SIDEBAR — desktop only (≥ 768px)
          Fixed left panel, 240px wide.
          Same green as admin sidebar for consistency.
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
          {/* Logo area */}
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
              backgroundColor: colors.accent,
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', flexShrink: 0,
            }}>
              🌾
            </div>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem' }}>
              AGRICE
            </span>
          </div>

          {/* Role label below logo */}
          <div style={{ padding: '0.75rem 1.5rem 0.25rem', opacity: 0.6 }}>
            <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {ROLE_LABELS[role]}
            </span>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto' }}>
            {navItems.map(item => renderNavItem(item, true))}
          </nav>

          {/* User profile section at bottom of sidebar */}
          <div style={{
            padding:    '1rem 1.5rem',
            borderTop:  '1px solid rgba(255,255,255,0.1)',
            flexShrink: 0,
          }}>
            {/* User info row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {/* Avatar circle */}
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
                <p style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {firstName} {lastName}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', margin: 0 }}>
                  {ROLE_LABELS[role]}
                </p>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '0.625rem',
                background: 'none',
                border:     'none',
                color:      'rgba(255,255,255,0.7)',
                cursor:     'pointer',
                fontSize:   '0.85rem',
                padding:    '0.25rem 0',
                width:      '100%',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'white'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
            >
              <LogOut size={16} color="inherit" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MAIN CONTENT AREA
          On desktop: pushed right by sidebar width (240px)
          On mobile: full width
      ════════════════════════════════════════════ */}
      <div style={{
        flex:           1,
        marginLeft:     isDesktop ? '240px' : '0',
        display:        'flex',
        flexDirection:  'column',
        minHeight:      '100vh',
        // Limit mobile width and center it for a phone-like feel on small screens
        maxWidth:       isDesktop ? 'none' : '480px',
        margin:         isDesktop ? '0 0 0 240px' : '0 auto',
        width:          '100%',
        boxShadow:      isDesktop ? 'none' : '0 0 30px rgba(0,0,0,0.06)',
      }}>

        {/* ── TOP HEADER ── */}
        {/* Always visible on mobile. On desktop it's a thinner top bar. */}
        <div style={{
          position:        'sticky',
          top:             0,
          backgroundColor: isDesktop ? 'white' : colors.primary,
          padding:         isDesktop ? '0.75rem 1.5rem' : '0.875rem 1.25rem',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          zIndex:          40,
          boxShadow:       isDesktop
            ? '0 1px 4px rgba(0,0,0,0.08)'
            : '0 2px 8px rgba(0,0,0,0.15)',
          borderBottom:    isDesktop ? '1px solid #e5e7eb' : 'none',
        }}>

          {/* Left: Logo (mobile) or page context (desktop) */}
          {!isDesktop ? (
            // Mobile: show full AGRICE logo in header
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🌾</span>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>AGRICE</span>
            </div>
          ) : (
            // Desktop: show role label as context
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a' }}>
              {ROLE_LABELS[role]} Portal
            </span>
          )}

          {/* Right: Notification bell + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            {/* Notification bell */}
            <button style={{
              background: 'none', border: 'none',
              cursor: 'pointer', padding: '0.25rem',
              position: 'relative',
              display: 'flex', alignItems: 'center',
            }}>
              <Bell
                size={22}
                color={isDesktop ? '#374151' : 'rgba(255,255,255,0.9)'}
              />
              {/* Red dot — show when there are unread notifications */}
              {/* Uncomment when notification system is implemented:
              <span style={{
                position: 'absolute', top: 0, right: 0,
                width: 8, height: 8,
                backgroundColor: '#dc2626',
                borderRadius: '50%',
                border: '2px solid white',
              }} /> */}
            </button>

            {/* Avatar button — opens profile drawer */}
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
                color:           isDesktop ? 'white' : 'white',
                transition:      'opacity 0.15s',
              }}
            >
              {initials || <User size={16} color="white" />}
            </button>
          </div>
        </div>

        {/* ── PAGE CONTENT (Outlet) ── */}
        {/* paddingBottom on mobile to prevent content hiding behind bottom nav */}
        <div style={{
          flex:          1,
          overflowY:     'auto',
          paddingBottom: isDesktop ? '2rem' : '80px',
        }}>
          <Outlet />
        </div>
      </div>

      {/* ════════════════════════════════════════════
          BOTTOM NAVIGATION — mobile only (< 768px)
          Fixed at the bottom of the screen.
          White background with subtle shadow.
      ════════════════════════════════════════════ */}
      {!isDesktop && (
        <div style={{
          position:        'fixed',
          bottom:          0,
          left:            '50%',
          transform:       'translateX(-50%)',
          width:           '100%',
          maxWidth:        '480px',
          backgroundColor: 'white',
          display:         'flex',
          justifyContent:  'space-around',
          alignItems:      'center',
          height:          '64px',
          zIndex:          40,
          boxShadow:       '0 -2px 16px rgba(0,0,0,0.08)',
          borderTop:       '1px solid #e5e7eb',
          paddingBottom:   'env(safe-area-inset-bottom)', // safe area for phones with notch
        }}>
          {navItems.map(item => renderNavItem(item, false))}
        </div>
      )}

      {/* ════════════════════════════════════════════
          PROFILE DRAWER
          Mobile: slides up from the bottom
          Desktop: small dropdown panel from the header
      ════════════════════════════════════════════ */}
      {profileOpen && (
        <>
          {/* Backdrop — click to close */}
          <div
            onClick={() => setProfileOpen(false)}
            style={{
              position:        'fixed',
              inset:           0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex:          60,
            }}
          />

          {/* Drawer panel */}
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
            zIndex:          70,
            padding:         '1.5rem',
            boxShadow:       '0 -4px 24px rgba(0,0,0,0.15)',
          }}>
            {/* Handle bar (mobile only) */}
            {!isDesktop && (
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, margin: '0 auto' }} />
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => setProfileOpen(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}
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

            {/* Profile link */}
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