// src/components/Hero.jsx
import AuthBox from './AuthBox';
import heroBg from '../assets/hero.png';
import AboutSection from './AboutSection';
import GisMapSection from './GisMapSection';
import AnnouncementsSection from './AnnouncementsSection';
import DocumentationSection from './DocumentationSection';
import FooterSection from './FooterSection';

const STATS = [
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    number: '1,245+', label: 'Registered Farmers', desc: 'Farmers actively registered in our municipality',
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
      </svg>
    ),
    number: '28', label: 'Seed Varieties', desc: 'Quality seeds available for planting season',
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
    number: '16', label: 'Distribution Schedules', desc: 'Upcoming schedules for all barangays',
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    number: '42', label: 'Reports Generated', desc: 'Accomplishment reports generated this year',
  },
];

const Hero = () => {
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
              <button className="lp-btn-primary" onClick={() => scrollTo('programs')}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
                </svg>
                Learn About Programs
              </button>
              <button className="lp-btn-secondary">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>
                </svg>
                Install AGRICE App
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
              <span><strong>Current Season:</strong> Dry Season</span>
            </div>
            <span className="lp-season-div" />
            <div className="lp-season-item">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <span><strong>Next Distribution:</strong> June 2026</span>
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