import { useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import AppRoutes from './routes/AppRoutes';
import { useInactivityTimeout } from './auth/useInactivityTimeout';
import { useAppDisplayMode } from './hooks/useAppDisplayMode';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import AppSplashScreen from './components/app/AppSplashScreen';
import OfflineBanner from './components/app/OfflineBanner';

function AppContent() {
  useInactivityTimeout(30);
  const isInstalledApp = useAppDisplayMode();
  const isOnline = useNetworkStatus();
  const [showSplash, setShowSplash] = useState(isInstalledApp);

  useEffect(() => {
    if (!isInstalledApp) {
      setShowSplash(false);
      return undefined;
    }

    setShowSplash(true);
    const timer = window.setTimeout(() => setShowSplash(false), 1000);
    return () => window.clearTimeout(timer);
  }, [isInstalledApp]);

  return (
    <>
      {isInstalledApp && showSplash && <AppSplashScreen />}
      {isInstalledApp && !isOnline && <OfflineBanner />}
      <AppRoutes />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;