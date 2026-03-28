// src/components/Navbar.jsx
// Public navbar — shown ONLY on Landing and Register pages
// Dashboard button only shows if user is genuinely logged in
// Hamburger menu works on mobile

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoggedIn, role, logout, token } = useAuth();
  const navigate = useNavigate();

  // Double-check: only treat as logged in if token actually exists in state
  // This prevents stale localStorage from showing dashboard button
  const actuallyLoggedIn = isLoggedIn && !!token;

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  // Role → dashboard path mapping
  const dashboardPath = {
    ADMIN: '/admin',
    FARMER: '/farmer',
    AT: '/at',
    BRGY: '/brgy',
  }[role] || '/';

  return (
    <nav className="navbar">

      {/* ── LOGO ── */}
      <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
        <span>🌾</span> AGRICE
      </Link>

      {/* ── DESKTOP NAV LINKS ── */}
      <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        <li><a href="#home" onClick={() => setMenuOpen(false)}>Home</a></li>
        <li><a href="#about" onClick={() => setMenuOpen(false)}>About (MAO)</a></li>
        <li><a href="#programs" onClick={() => setMenuOpen(false)}>Programs</a></li>
        <li><a href="#documentation" onClick={() => setMenuOpen(false)}>Documentation</a></li>
        <li><a href="#announcements" onClick={() => setMenuOpen(false)}>Announcements</a></li>

        <li>
          {/* 
            Only show Dashboard + Logout if ACTUALLY logged in with a valid token.
            Never show Dashboard to guests — they only see Sign In button.
          */}
          {actuallyLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link
                to={dashboardPath}
                onClick={() => setMenuOpen(false)}
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Dashboard
              </Link>
              <button className="btn-outline" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            // Guest — show Sign In button only
            <Link to="/login" onClick={() => setMenuOpen(false)}>
              <button className="btn-outline">Sign In</button>
            </Link>
          )}
        </li>
      </ul>

      {/* ── MOBILE HAMBURGER ── */}
      <button
        className="navbar-hamburger"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
          {menuOpen
            ? <path d="M6 6l12 12M6 18L18 6" />
            : <path d="M3 6h18M3 12h18M3 18h18" />
          }
        </svg>
      </button>

    </nav>
  );
};

export default Navbar;