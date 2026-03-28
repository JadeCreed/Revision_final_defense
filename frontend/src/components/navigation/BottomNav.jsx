// src/components/navigation/BottomNav.jsx
// Mobile bottom navigation bar (shown only on small screens)
// Shows up to 5 items from MenuConfig as icon + label tabs

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { MENU_CONFIG } from './MenuConfig';

const BottomNav = () => {
  const { role } = useAuth();
  // Only show first 5 items on mobile bottom nav
  const menus = (MENU_CONFIG[role] || []).slice(0, 5);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      backgroundColor: '#1a4d1a',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      height: '60px',
      zIndex: 50,
      borderTop: '1px solid rgba(255,255,255,0.15)',
      // Safe area for phones with home indicator
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {menus.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.label === 'Dashboard'}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            textDecoration: 'none',
            color: isActive ? '#f5c842' : 'rgba(255,255,255,0.7)',
            fontSize: '0.6rem',
            fontWeight: isActive ? '600' : '400',
            minWidth: '52px',
            padding: '4px 0',
          })}
        >
          {/* Icon */}
          <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
          {/* Short label */}
          <span>{item.label.split(' ')[0]}</span>
        </NavLink>
      ))}
    </div>
  );
};

export default BottomNav;