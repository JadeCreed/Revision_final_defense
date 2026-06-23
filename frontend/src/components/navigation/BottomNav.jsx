// src/components/navigation/BottomNav.jsx
import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { MENU_CONFIG, USER_NAV } from './MenuConfig';
import { LogOut, Menu, X } from 'lucide-react';

const BottomNav = () => {
  const { role, logout }  = useAuth();
  const navigate          = useNavigate();
  const location          = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Awtomatikong alamin kung nasa GIS Map page para i-adjust ang z-index
  const isGisPage = location.pathname.includes('/gis');
  const bottomNavZIndex = isGisPage ? 1010 : 50;
  const backdropZIndex = isGisPage ? 1020 : 60;
  const panelZIndex = isGisPage ? 1030 : 70;



  // Kukunin ang buong menu list ng kasalukuyang role
  const fullMenu = role === 'ADMIN' 
    ? (MENU_CONFIG.ADMIN || []) 
    : (USER_NAV[role] || MENU_CONFIG[role] || []);

  const totalCount = fullMenu.length;
  const hasMore = totalCount > 5;

  // Bottom bar items: Kung higit sa 5 ang menu, ipakita ang unang 4. Kung hindi, ipakita lahat.
  const bottomItems = hasMore ? fullMenu.slice(0, 4) : fullMenu;

  // Kukunin ang mga paths ng items na nakalabas na sa bottom bar
  const bottomPaths = bottomItems.map(item => item.path);

  // I-filter ang menu para sa drawer upang tuluyang TANGGALIN ang mga nakalabas na sa bottom bar (No Duplication / No Double Active Highlights)
  const drawerMenu = fullMenu.filter(item => !bottomPaths.includes(item.path));

  // Flatten ang natitirang menu items para sa More drawer
  const allMenuItems = drawerMenu.flatMap(item => {
    if (item.hasChildren) {
      const filteredChildren = item.children.filter(c => !bottomPaths.includes(c.path));
      if (filteredChildren.length === 0) return [];
      return [
        { type: 'header', label: item.label },
        ...filteredChildren.map(c => ({ ...c, type: 'link' }))
      ];
    }
    return [{ ...item, type: 'link' }];
  });

  const handleLogout = () => {
    logout();
    navigate('/');
    setDrawerOpen(false);
  };

  // Ligtas na path check para maiwasan ang double-active highlight
  const checkActive = (path) => {
    const current = location.pathname.replace(/\/$/, '');
    const target = path.replace(/\/$/, '');
    const isRoleRoot = ['/admin', '/farmer', '/at', '/brgy'].includes(target);
    
    if (isRoleRoot) {
      return current === target;
    }
    return current === target || current.startsWith(target + '/');
  };

  // Render icon na may magkaibang kulay para sa puting bottom bar at madilim na berdeng drawer
  const renderIcon = (icon, isActive, size = 20, isDrawer = false) => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{icon}</span>;
    }
    const Icon = icon;
    if (isDrawer) {
      // Sa loob ng green drawer: Gold (#f5c842) kapag active, Soft White kapag inactive
      return <Icon size={size} color={isActive ? '#f5c842' : 'rgba(255,255,255,0.7)'} />;
    }
    // Sa puting bottom bar: Deep Forest Green (#1a4d1a) kapag active, Gray kapag inactive
    return <Icon size={size} color={isActive ? '#1a4d1a' : '#9ca3af'} />;
  };

  const navItemStyle = (isActive) => ({
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            '2px',
    textDecoration: 'none',
    color:          isActive ? '#1a4d1a' : '#9ca3af',
    fontSize:       '0.6rem',
    fontWeight:     isActive ? '700' : '500',
    minWidth:       '52px',
    padding:        '4px 0',
    background:     'none',
    border:         'none',
    cursor:         'pointer',
  });

  return (
    <>
      {/* ── BOTTOM BAR ── */}
      <div style={{
        position:        'fixed',
        bottom: 0, left: 0, right: 0,
        backgroundColor: '#ffffff',                                              // ◀── UNIFORM WHITE BACKGROUND FOR ALL PORTALS
        display:         'flex',
        justifyContent:  'space-around',
        alignItems:      'center',
        height:          '60px',
        zIndex:          bottomNavZIndex,
        borderTop:       '1px solid #e5e7eb',                                    // ◀── LIGHT GRAY BORDER                          // ◀── LIGHT GRAY BORDER
        boxShadow:       '0 -2px 10px rgba(0,0,0,0.05)',                         // ◀── CLEAN BOTTOM SHADOW
        paddingBottom:   'env(safe-area-inset-bottom)',
      }}>
        {bottomItems.map(item => {
          const isActive = checkActive(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={navItemStyle(isActive)}
            >
              {renderIcon(item.icon, isActive, 22, false)}
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {/* More button — lilitaw lamang kapag lumampas sa 5 ang inyong menu items */}
        {hasMore && (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              ...navItemStyle(drawerOpen),
              color: drawerOpen ? '#1a4d1a' : '#9ca3af',
            }}
          >
            <Menu size={22} color={drawerOpen ? '#1a4d1a' : '#9ca3af'} />
            <span>More</span>
          </button>
        )}
      </div>

      {/* ── MORE DRAWER ── */}
      {drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: backdropZIndex }}
          />
          <div style={{
            position:        'fixed',
            bottom:          '60px', left: 0, right: 0,
            backgroundColor: '#1a4d1a',                                      
            borderRadius:    '1rem 1rem 0 0',
            zIndex:          panelZIndex,
            
            maxHeight:       '70vh',
            overflowY:       'auto',
            boxShadow:       '0 -4px 20px rgba(0,0,0,0.3)',
          }}>
            {/* Handle */}
            <div style={{ textAlign: 'center', padding: '0.75rem 0 0.25rem' }}>
              <div style={{ width: '40px', height: '4px', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '2px', margin: '0 auto' }} />
            </div>

            {/* Drawer header */}
            <div style={{
              padding: '0.75rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: 'white', fontWeight: '700', fontSize: '1rem' }}>All Menus</span>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="rgba(255,255,255,0.6)" />
              </button>
            </div>

            {/* Drawer remaining items (Unduplicated) */}
            <div style={{ padding: '0.5rem 0' }}>
              {allMenuItems.map((item, idx) => {
                if (item.type === 'header') {
                  return (
                    <div key={`h-${idx}`} style={{
                      padding: '0.75rem 1.5rem 0.25rem',
                      fontSize: '0.7rem', fontWeight: '700',
                      color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {item.label}
                    </div>
                  );
                }

                const isActive = checkActive(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      gap:            '0.875rem',
                      padding:        '0.75rem 1.5rem',
                      textDecoration: 'none',
                      color:          isActive ? '#f5c842' : 'rgba(255,255,255,0.85)',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                      borderLeft:     isActive ? '3px solid #f5c842' : '3px solid transparent',
                      fontSize:       '0.9rem',
                      fontWeight:     isActive ? '600' : '400',
                    }}
                  >
                    <span style={{ minWidth: '22px', display: 'flex', alignItems: 'center' }}>
                      {renderIcon(item.icon, isActive, 18, true)}
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />
              <button onClick={handleLogout} style={{
                display: 'flex', alignItems: 'center', gap: '0.875rem',
                padding: '0.75rem 1.5rem',
                background: 'none', border: 'none', width: '100%',
                cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem',
              }}>
                <LogOut size={18} color="rgba(255,255,255,0.75)" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default BottomNav;