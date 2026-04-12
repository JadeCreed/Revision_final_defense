// src/auth/AuthContext.jsx
// Added: clears stale/invalid token on first load

import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// Helper — checks if a JWT token is expired
// JWT payload is base64 encoded in the middle segment
const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds, Date.now() is in milliseconds
    return payload.exp * 1000 < Date.now();
  } catch {
    // If token is malformed, treat as expired
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem('access_token');
    // If token exists but is expired, clear it immediately on load
    if (savedToken && isTokenExpired(savedToken)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('role');
      localStorage.removeItem('is_verified');
      localStorage.removeItem('first_name');
      localStorage.removeItem('last_name');
      return null; // treat as logged out
    }
    return savedToken;
  });

  const [role, setRole]           = useState(() => localStorage.getItem('role'));
  const [firstName, setFirstName] = useState(() => localStorage.getItem('first_name') || '');
  const [lastName, setLastName]   = useState(() => localStorage.getItem('last_name') || '');
  const [isVerified, setIsVerified] = useState(() => localStorage.getItem('is_verified') === 'true');

  const login = (data) => {
    localStorage.setItem('access_token', data.token);
    localStorage.setItem('role',         data.role);
    localStorage.setItem('is_verified',  data.is_verified);
    localStorage.setItem('first_name',   data.first_name || '');
    localStorage.setItem('last_name',    data.last_name  || '');
    setToken(data.token);
    setRole(data.role);
    setIsVerified(data.is_verified);
    setFirstName(data.first_name || '');
    setLastName(data.last_name   || '');
  };

  const logout = () => {
    ['access_token', 'role', 'is_verified', 'first_name', 'last_name']
      .forEach(k => localStorage.removeItem(k));
    setToken(null);
    setRole(null);
    setIsVerified(false);
    setFirstName('');
    setLastName('');
  };

  const isLoggedIn = !!token && !isTokenExpired(token);

  return (
    <AuthContext.Provider value={{
      token,
      role,
      firstName,
      lastName,
      isVerified,
      isLoggedIn,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);