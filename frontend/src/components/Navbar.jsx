// src/components/Navbar.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';
import { usePwaInstall } from '../hooks/usePwaInstall';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const { install, installed } = usePwaInstall();

  const scrollTo = (id) => {
    setMenuOpen(false);
    if (isLandingPage) {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/#${id}`);
    }
  };

  const handleNavClick = (e, id) => {
    e.preventDefault();
    setMenuOpen(false);
    if (isLandingPage) {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/#${id}`);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">

        {/* LEFT: BRAND */}
        <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <img src={logo} alt="AGRICE" />
          <div className="navbar-brand-text">
            <span className="navbar-brand-title">AGRICE</span>
          </div>
        </Link>

        {/* CENTER: NAV LINKS — Static layout for public landing page */}
        <ul className={`navbar-links${menuOpen ? ' open' : ''}`}>
          <li style={{ textAlign: 'center' }}><a href="#home" onClick={(e) => { e.preventDefault(); scrollTo('home'); }}>Home</a></li>
          <li style={{ textAlign: 'center' }}><a href="#about" onClick={(e) => { e.preventDefault(); scrollTo('about'); }}>About MAO</a></li>
          <li style={{ textAlign: 'center' }}><a href="#gis" onClick={(e) => { e.preventDefault(); scrollTo('gis'); }}>GIS Map</a></li>
          <li style={{ textAlign: 'center' }}><a href="#announcements" onClick={(e) => { e.preventDefault(); scrollTo('announcements'); }}>Announcements</a></li>
          <li style={{ textAlign: 'center' }}><a href="#documentation" onClick={(e) => { e.preventDefault(); scrollTo('documentation'); }}>Documentation</a></li>

          {/* Mobile-only auth links inside drawer — ALWAYS Static */}
          <li className="mobile-only">
            <div style={{ display: 'flex', gap: '0.625rem', padding: '0 1rem' }}>
              <button className="nav-drawer-btn nav-drawer-btn--outline" onClick={install} type="button" style={{ flex: 1, justifyContent: 'center' }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 21h20"/>
                </svg>
                {installed ? 'Installed' : 'Download'}
              </button>
              <a href="#login" onClick={(e) => handleNavClick(e, 'login')} style={{ flex: 1 }}>
                <button className="nav-drawer-btn nav-drawer-btn--solid" style={{ width: '100%', justifyContent: 'center' }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
                  </svg>
                  Sign In
                </button>
              </a>
            </div>
          </li>
        </ul>

        {/* RIGHT: ACTION BUTTONS — ALWAYS Static */}
        <div className="navbar-actions">
          <button className="navbar-install-btn" onClick={install} type="button">
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 21h20"/>
            </svg>
            {installed ? 'App Installed' : 'Download App'}
          </button>
          <a href="#login" onClick={(e) => handleNavClick(e, 'login')}>
            <button className="navbar-sign-in-btn">
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
              </svg>
              Sign In
            </button>
          </a>
        </div>

        {/* HAMBURGER — mobile only */}
        <button
          className="navbar-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen
              ? <path d="M6 6l12 12M6 18L18 6"/>
              : <path d="M3 6h18M3 12h18M3 18h18"/>}
          </svg>
        </button>

      </div>
    </nav>
  );
};

export default Navbar;