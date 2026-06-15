const AnnouncementsSection = () => (
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
);

export default AnnouncementsSection;