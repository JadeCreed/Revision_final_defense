// src/routes/ProtectedRoute.jsx
// Wraps dashboard pages so only logged-in users with correct role can access
// If not logged in → redirects to /login
// If wrong role → redirects to their own dashboard

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ROLE_REDIRECT = {
  ADMIN: '/admin',
  FARMER: '/farmer',
  AT: '/at',
  BRGY: '/brgy',
};

const ProtectedRoute = ({ allowedRole }) => {
  const { isLoggedIn, role, authLoading } = useAuth();
  const allowedRoles = Array.isArray(allowedRole) ? allowedRole : [allowedRole].filter(Boolean);

  // ⏳ While checking auth status, show nothing (prevent redirect flicker)
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#666', fontSize: '1rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_REDIRECT[role]} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;