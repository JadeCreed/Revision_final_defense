import logo from '../../assets/logo.png';

const AppSplashScreen = () => (
  <div className="app-splash" role="status" aria-label="Loading MAO Lucban application">
    {/* Centered Logo */}
    <div className="app-splash-center">
      <img src={logo} alt="MAO Lucban Logo" className="app-splash-logo" />
    </div>

    {/* Centered Bottom Footer Branding */}
    <div className="app-splash-footer">
      <h1 className="app-splash-footer-acronym">MAO</h1>
      <p className="app-splash-footer-fullname">MUNICIPAL AGRICULTURE OFFICE OF LUCBAN</p>
    </div>
  </div>
);

export default AppSplashScreen;
