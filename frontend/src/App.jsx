import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import AppRoutes from './routes/AppRoutes';
import { useInactivityTimeout } from './auth/useInactivityTimeout';
import { InactivityWarningDialog } from './components/InactivityWarningDialog';

function AppContent() {
  const { showWarning, setShowWarning, remainingSeconds } = useInactivityTimeout(30);

  return (
    <>
      <InactivityWarningDialog
        isOpen={showWarning}
        remainingSeconds={remainingSeconds}
        onDismiss={() => setShowWarning(false)}
      />
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