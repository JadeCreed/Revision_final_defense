// src/auth/AuthContext.jsx
// Secure cookie-based authentication (no localStorage for tokens)

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import API, { setUnauthorizedHandler } from '../api/axios';

const AuthContext = createContext(null);
const SESSION_TOKEN_KEY = 'agrice_access_token';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_TOKEN_KEY));
  const [role, setRole] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  // Guard para hindi mag-trigger ng logout() multiple times
  // kung sabay-sabay dumating ang ilang 401 response
  const isHandlingExpiry = useRef(false);

  const setAuthHeader = (accessToken) => {
    if (accessToken) {
      API.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    } else {
      delete API.defaults.headers.common.Authorization;
    }
  };

  // 🔍 Check authentication status on app mount
  useEffect(() => {
    const checkAuth = async () => {
      const existingToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (existingToken) {
        setAuthHeader(existingToken);
      }

      try {
        // Try to fetch a protected endpoint to verify token validity
        const res = await API.get('/accounts/verify-token/');
        
        if (res.data) {
          setRole(res.data.role);
          setIsVerified(res.data.is_verified);
          setFirstName(res.data.first_name || '');
          setLastName(res.data.last_name || '');
          setToken(existingToken || 'exists');
          setIsLoggedIn(true);
        }
      } catch {
        // No valid token/cookie found
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
        setAuthHeader(null);
        setIsLoggedIn(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (data) => {
    // Use cookie-based auth when available, plus sessionStorage fallback for refresh
    if (data.access_token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, data.access_token);
      setAuthHeader(data.access_token);
      setToken(data.access_token);
    } else {
      setToken('exists');
    }

    setRole(data.role);
    setIsVerified(data.is_verified);
    setFirstName(data.first_name || '');
    setLastName(data.last_name || '');
    setIsLoggedIn(true);
    // Bagong session na ang umpisahan, kaya buksan ulit ang guard
    isHandlingExpiry.current = false;
  };

  const logout = async () => {
    try {
      // Call logout endpoint to clear server-side session/cookie
      await API.post('/accounts/logout/');
    } catch {
      // Still logout on frontend even if API fails
    } finally {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      setAuthHeader(null);
      setToken(null);
      setRole(null);
      setIsVerified(false);
      setFirstName('');
      setLastName('');
      setIsLoggedIn(false);
    }
  };

  // 🔌 Connect axios unauthorized handling to the auth context.
  // When a protected request returns 401, this will force a logout
  // so the navbar and protected views stay in sync without a reload.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (isHandlingExpiry.current) return;
      isHandlingExpiry.current = true;
      logout().finally(() => {
        isHandlingExpiry.current = false;
      });
    });

    return () => setUnauthorizedHandler(null);
  }, [logout]);

  return (
    <AuthContext.Provider value={{
      token,
      role,
      firstName,
      lastName,
      isVerified,
      isLoggedIn,
      authLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);