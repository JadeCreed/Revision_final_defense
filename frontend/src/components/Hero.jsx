// src/components/Hero.jsx
import { useEffect, useState } from 'react';
import AuthBox from './AuthBox';
import heroBg from '../assets/hero.png';
import AboutSection from './AboutSection';
import GisMapSection from './GisMapSection';
import AnnouncementsSection from './AnnouncementsSection';
import DocumentationSection from './DocumentationSection';
import FooterSection from './FooterSection';
import API from '../api/axios';
import { usePwaInstall } from '../hooks/usePwaInstall';

const Hero = () => {
  const [registeredFarmers, setRegisteredFarmers] = useState(0);
  const [totalHectares, setTotalHectares] = useState(0);
  const [currentSeason, setCurrentSeason] = useState('');
  const { install, installed } = usePwaInstall();

  useEffect(() => {
    API.get('/accounts/public-stats/')
      .then((res) => {
        setRegisteredFarmers(res.data.registered_farmers ?? 0);
        setTotalHectares(res.data.total_hectares ?? 0);
      })
      .catch(() => {});
    API.get('/accounts/public-season/')
      .then((res) => {
        const { season_display, year } = res.data;
        if (season_display && year) {
          setCurrentSeason(`${season_display} ${year}`);
        } else if (season_display) {
          setCurrentSeason(season_display);
        } else {
          setCurrentSeason('Dry Season');
        }
      })
      .catch(() => {
        setCurrentSeason('Dry Season');
      });
  }, []);

  const STATS = [
    {
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ),
      number: `${registeredFarmers.toLocaleString()}`,
      label: 'Registered Farmers',
      desc: 'Farmers actively registered in our municipality',
    },
    {
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          <path d="M7 8h10M7 11h6"/>
        </svg>
      ),
      number: `${parseFloat(totalHectares).toFixed(2)} ha`,
      label: 'Hectares of Rice Land',
      desc: 'Total registered farmland area in Lucban',
    },
    {
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      number: '22',
      label: 'Rural Barangays',
      desc: 'Barangays covered in Lucban municipality',
    },
    {
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/>
          <path d="M12 8v4l3 3"/>
        </svg>
      ),
      number: '3',
      label: 'Types of Seeds',
      desc: 'With multiple varieties available per season',
    },
  ];

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div id="home">

      {/* ── HERO SECTION ── */}
      <section className="lp-hero">

        {/* LEFT — image + content */}
        <div className="lp-hero-left">
          <img src={heroBg} alt="Rice fields of Lucban" className="lp-hero-bg" />
          <div className="lp-hero-overlay" />

          <div className="lp-hero-content">
            <p className="lp-eyebrow">Municipal Agriculture Office of Lucban</p>
            <h1 className="lp-hero-title">
              Smart Agriculture.<br />
              <span className="text-[#2d6a2d]">Stronger Communities.</span>
            </h1>
            <div className="w-12 h-[3px] bg-[#2d6a2d] rounded-[2px] mb-[0.9rem]" />
            <p className="lp-hero-subheading">
              A government-grade digital platform for Lucban's rice program.
            </p>
            <p className="lp-hero-desc">
              Designed for the Municipal Agriculture Office of Lucban, this system streamlines seed polling,
              beneficiary management, distribution scheduling, and reporting to make operations more
              efficient, transparent, and accountable.
            </p>
            <div className="lp-hero-ctas">
              <button className="lp-btn-primary" onClick={() => scrollTo('gis')}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
                </svg>
                Learn About Programs
              </button>
              <button className="lp-btn-secondary" onClick={install} type="button">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>
                </svg>
                {installed ? 'AGRICE App Installed' : 'Install AGRICE App'}
              </button>
            </div>
          </div>

          {/* STATS */}
          <div className="lp-stats">
            {STATS.map((s) => (
              <div className="lp-stat-card" key={s.label}>
                <div className="lp-stat-icon">{s.icon}</div>
                <div className="lp-stat-number">{s.number}</div>
                <div className="lp-stat-label">{s.label}</div>
                <div className="lp-stat-desc">{s.desc}</div>
              </div>
            ))}
          </div>

          {/* SEASON BAR */}
           <div className="lp-season-bar">
            <div className="lp-season-item">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              <span><strong>Current Season:</strong> {currentSeason || '—'}</span>
            </div>
            <span className="lp-season-div" />
            <span className="lp-season-note">Stay updated for the latest schedules and announcements.</span>
          </div>
        </div>

        {/* RIGHT — auth panel */}
        <div id="login" className="lp-hero-right">
          <AuthBox />
        </div>
      </section>

      {/* ── OTHER SECTIONS ── */}
      <AboutSection />
      <GisMapSection />
      <AnnouncementsSection />
      <DocumentationSection />
      <FooterSection />

    </div>
  );
};

export default Hero;