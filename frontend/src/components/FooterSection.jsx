const FooterSection = () => (
  <footer className="site-footer">
    <div className="footer-inner">
      <div>
        <div className="footer-brand">AGRICE</div>
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
);

export default FooterSection;