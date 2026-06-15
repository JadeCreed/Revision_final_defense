const DocumentationSection = () => (
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
);

export default DocumentationSection;