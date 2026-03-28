// src/components/navigation/Sidebar.jsx
// Desktop sidebar — dark green, matches your wireframe exactly
// Shows: AGRICE logo, menu items with icons, Logout at bottom
// Active item: lighter green background + yellow text

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { MENU_CONFIG } from './MenuConfig';

const Sidebar = () => {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const menus = MENU_CONFIG[role] || [];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{
      width: '240px',
      minHeight: '100vh',
      backgroundColor: '#1a4d1a',   // dark green sidebar
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0, left: 0,
      zIndex: 50,
    }}>
      {/* ===== LOGO ===== */}
      <div style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Wheat icon — swap this SVG with your actual logo later */}
        <div style={{
          width: '36px', height: '36px',
          backgroundColor: '#f5c842',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem',
        }}>
          🌾
        </div>
        <span style={{
          color: 'white',
          fontWeight: '800',
          fontSize: '1.25rem',
          letterSpacing: '0.5px',
        }}>
          AGRICE
        </span>
      </div>

      {/* ===== MENU ITEMS ===== */}
      <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
        {menus.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin' || item.path === '/farmer' || item.path === '/at' || item.path === '/brgy'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1.5rem',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: isActive ? '600' : '400',
              color: isActive ? '#f5c842' : 'rgba(255,255,255,0.85)',
              backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderLeft: isActive ? '3px solid #f5c842' : '3px solid transparent',
              transition: 'all 0.15s ease',
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.classList.contains('active'))
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)';
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.classList.contains('active'))
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {/* Icon — swap emoji with lucide icon if you want later */}
            <span style={{ fontSize: '1.1rem', minWidth: '20px', textAlign: 'center' }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ===== LOGOUT BUTTON (bottom) ===== */}
      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500',
            padding: '0.5rem 0',
            width: '100%',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
        >
          {/* Logout icon */}
          <span style={{ fontSize: '1.1rem' }}>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;