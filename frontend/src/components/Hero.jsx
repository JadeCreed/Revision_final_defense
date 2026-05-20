// src/components/Hero.jsx
import AuthBox from './AuthBox';
import heroBg from '../assets/hero.png';

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
        <div className="lp-hero-right">
          <AuthBox />
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" style={{ background: 'white' }}>
        <div className="section-wrapper">
          <span className="section-tag">About Us</span>
          <h2 className="section-title">Municipal Agriculture Office of Lucban</h2>
          <p className="section-sub">Dedicated to supporting local farmers through modern agricultural programs and digital tools for a more efficient rice production system.</p>
          <div className="about-grid">
            <div className="about-img-wrap">
              <img src="https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=800&q=80" alt="Rice farming in Lucban" />
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.7, marginBottom: '1rem' }}>
                The Municipal Agriculture Office (MAO) of Lucban, Quezon serves as the primary government body overseeing agricultural programs, seed distribution, and farmer welfare in the municipality.
              </p>
              <div className="about-feature-list">
                {[
                  { icon: '🌱', title: 'Seed Distribution Program', desc: 'Provides certified hybrid and inbred rice seeds to registered farmers every planting season.' },
                  { icon: '📊', title: 'Digital Crop Monitoring', desc: 'Real-time tracking of planting and harvesting activities across all barangays.' },
                  { icon: '🤝', title: 'Farmer Support Services', desc: 'Technical assistance, training, and coordination with Barangay Presidents and Agricultural Technicians.' },
                  { icon: '📄', title: 'Transparent Reporting', desc: 'Automated generation of accomplishment reports for the DA and PhilRice.' },
                ].map((f) => (
                  <div className="about-feature" key={f.title}>
                    <div className="about-feature-icon">{f.icon}</div>
                    <div>
                      <div className="about-feature-title">{f.title}</div>
                      <div className="about-feature-desc">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROGRAMS ── */}
      <section id="programs" style={{ background: 'var(--color-bg)' }}>
        <div className="section-wrapper">
          <span className="section-tag">Our Programs</span>
          <h2 className="section-title">Rice Program Services</h2>
          <p className="section-sub">Comprehensive programs designed to support every stage of rice production in Lucban.</p>
          <div className="programs-grid">
            {[
              { icon: '🌾', title: 'Seed Polling & Voting', desc: 'Farmers vote on preferred rice varieties for the upcoming season through a transparent digital polling system.' },
              { icon: '📦', title: 'Seed Inventory Management', desc: 'Real-time tracking of seed stock levels, allocations, and distributions across all barangays.' },
              { icon: '🗺️', title: 'GIS Farm Mapping', desc: 'Interactive maps showing farm plots, ownership, and planting status for every barangay in Lucban.' },
              { icon: '🚚', title: 'Distribution Management', desc: 'Scheduling and tracking of seed and fertilizer distribution events with digital acknowledgment receipts.' },
              { icon: '📈', title: 'Crop Monitoring', desc: 'Phase-by-phase tracking of crop growth from seedling to harvest with alerts for at-risk farms.' },
              { icon: '📋', title: 'Accomplishment Reports', desc: 'Automated generation of DA, PhilRice, and municipal reports with one-click Excel export.' },
            ].map((p) => (
              <div className="program-card" key={p.title}>
                <div className="program-card-icon">{p.icon}</div>
                <div className="program-card-title">{p.title}</div>
                <div className="program-card-desc">{p.desc}</div>
                <a href="#" className="program-card-link">
                  Learn more
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ANNOUNCEMENTS ── */}
      <section id="announcements" style={{ background: 'white' }}>
        <div className="section-wrapper">
          <span className="section-tag">Announcements</span>
          <h2 className="section-title">Latest Updates</h2>
          <p className="section-sub">Stay informed about distribution schedules, program announcements, and important notices.</p>
          <div className="announcements-grid">
            {[
              { badge: 'Distribution', date: 'May 15, 2026', title: 'Wet Season 2026 Seed Distribution Schedule', desc: 'Distribution of inbred and hybrid seeds will begin on June 2, 2026. Farmers must present their RSBSA registration.' },
              { badge: 'Program Update', date: 'May 10, 2026', title: 'Seed Polling Now Open for WS 2026', desc: 'Vote for your preferred rice variety for the upcoming wet season. Polling closes on May 31, 2026.' },
              { badge: 'Advisory', date: 'May 5, 2026', title: 'Crop Damage Reporting — El Niño Advisory', desc: 'Affected farmers are advised to report crop damage through their Barangay Agricultural Technician.' },
            ].map((a) => (
              <div className="announcement-card" key={a.title}>
                <div className="announcement-card-badge">{a.badge}</div>
                <div className="announcement-card-body">
                  <div className="announcement-card-date">{a.date}</div>
                  <div className="announcement-card-title">{a.title}</div>
                  <div className="announcement-card-desc">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOCUMENTATION ── */}
      <section id="documentation" style={{ background: 'var(--color-bg)' }}>
        <div className="section-wrapper">
          <span className="section-tag">Documentation</span>
          <h2 className="section-title">User Guides & Resources</h2>
          <p className="section-sub">Downloadable guides and reference materials for farmers, officials, and agricultural technicians.</p>
          <div className="docs-grid">
            {[
              { icon: '📖', title: 'Farmer User Manual', desc: 'Step-by-step guide for farmers on registering, joining polls, and viewing distribution schedules.' },
              { icon: '🏛️', title: 'Barangay President Guide', desc: 'Instructions for managing beneficiaries, viewing distribution events, and submitting harvest reports.' },
              { icon: '🔬', title: 'Agricultural Technician Manual', desc: 'Guide for ATs on crop monitoring, encoding yields, and generating accomplishment reports.' },
              { icon: '⚙️', title: 'System Administrator Guide', desc: 'Complete reference for managing users, seed inventory, polls, and system settings.' },
            ].map((d) => (
              <a href="#" className="doc-card" key={d.title}>
                <div className="doc-icon">{d.icon}</div>
                <div>
                  <div className="doc-title">{d.title}</div>
                  <div className="doc-desc">{d.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">🌾 AGRICE</div>
            <div className="footer-brand-sub">Municipal Agriculture Office System</div>
            <p className="footer-desc">
              AGRICE is the official digital platform of the Municipal Agriculture Office of Lucban, Quezon.
              Supporting transparent and efficient rice program management.
            </p>
            <div className="footer-socials">
              {[
                <svg key="fb" width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>,
                <svg key="ph" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.08 1.22 2 2 0 012.06 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
                <svg key="em" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
              ].map((icon, i) => (
                <button className="footer-social-btn" key={i}>{icon}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="footer-col-title">Quick Links</div>
            <ul className="footer-links">
              {['Home', 'About MAO', 'Programs', 'Announcements', 'Documentation'].map((l) => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Contact</div>
            <ul className="footer-links">
              <li><a href="#">MAO Lucban, Quezon</a></li>
              <li><a href="#">mao.lucban@quezon.gov.ph</a></li>
              <li><a href="#">(042) XXX-XXXX</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>AGRICE — Municipal Agriculture Office, Lucban © 2026. All rights reserved.</span>
          <span>Powered by the Office of the Municipal Mayor</span>
        </div>
      </footer>
    </div>
  );
};

export default Hero;