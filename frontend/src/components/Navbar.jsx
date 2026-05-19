// src/components/Navbar.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import logo from '../assets/logo.png';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoggedIn, role, logout, token } = useAuth();
  const navigate = useNavigate();
  const actuallyLoggedIn = isLoggedIn && !!token;

  const handleLogout = () => { logout(); navigate('/'); setMenuOpen(false); };
  const dashboardPath = { ADMIN: '/admin', FARMER: '/farmer', AT: '/at', BRGY: '/brgy' }[role] || '/';

  const scrollTo = (id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="navbar">
      {/* BRAND */}
      <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
        <img src={logo} alt="AGRICE" />
        <div>
          <span>AGRICE</span>
          <span className="navbar-brand-sub">Municipal Agriculture Office System</span>
        </div>
      </Link>

      {/* NAV LINKS */}
      <ul className={`navbar-links${menuOpen ? ' open' : ''}`}>
        <li><a href="#home"          onClick={(e) => { e.preventDefault(); scrollTo('home'); }}>Home</a></li>
        <li><a href="#about"         onClick={(e) => { e.preventDefault(); scrollTo('about'); }}>About MAO</a></li>
        <li><a href="#programs"      onClick={(e) => { e.preventDefault(); scrollTo('programs'); }}>Programs</a></li>
        <li><a href="#announcements" onClick={(e) => { e.preventDefault(); scrollTo('announcements'); }}>Announcements</a></li>
        <li><a href="#documentation" onClick={(e) => { e.preventDefault(); scrollTo('documentation'); }}>Documentation</a></li>

        {actuallyLoggedIn ? (
          <>
            <li><Link to={dashboardPath} onClick={() => setMenuOpen(false)} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Dashboard</Link></li>
            <li><button className="navbar-sign-in-btn" onClick={handleLogout}>Logout</button></li>
          </>
        ) : (
          <>
            <li>
              <button className="navbar-install-btn" onClick={() => setMenuOpen(false)}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 21h20"/>
                </svg>
                Download App
              </button>
            </li>
            <li>
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                <button className="navbar-sign-in-btn">
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
                  </svg>
                  Sign In
                </button>
              </Link>
            </li>
          </>
        )}
      </ul>

      {/* HAMBURGER */}
      <button className="navbar-hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
          {menuOpen
            ? <path d="M6 6l12 12M6 18L18 6"/>
            : <path d="M3 6h18M3 12h18M3 18h18"/>}
        </svg>
      </button>
    </nav>
  );
};

export default Navbar;