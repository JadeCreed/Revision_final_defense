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
  const { isLoggedIn, role } = useAuth();
  const allowedRoles = Array.isArray(allowedRole) ? allowedRole : [allowedRole].filter(Boolean);

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_REDIRECT[role]} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;