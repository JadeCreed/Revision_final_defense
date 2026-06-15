const AboutSection = () => (
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
);

export default AboutSection;