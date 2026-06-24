import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import AppRoutes from './routes/AppRoutes';
import { useInactivityTimeout } from './auth/useInactivityTimeout';

function AppContent() {
  useInactivityTimeout(30);
  return <AppRoutes />;
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