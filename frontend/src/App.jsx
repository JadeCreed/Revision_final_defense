import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes /> {/* ✅ ALL ROUTES HANDLED HERE */}
      </Router>
    </AuthProvider>
  );
}

export default App;