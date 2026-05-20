// src/components/AuthBox.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/axios';
import { useAuth } from '../auth/AuthContext';
import logo from '../assets/logo.png';

const ROLE_ROUTES = { ADMIN: '/admin', FARMER: '/farmer', AT: '/at', BRGY: '/brgy' };

const AuthBox = () => {
  const [form, setForm] = useState({ login: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginUser(form);
      login(res.data);
      navigate(ROLE_ROUTES[res.data.role] || '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authbox-outer">

      {/* ── FLOATING WHITE CARD ── */}
      <div className="authbox-card">

        {/* LOGO */}
        <div className="authbox-logo-wrap">
          <img src={logo} alt="AGRICE Logo" className="authbox-logo" />
        </div>

        <h2 className="authbox-title">Sign in to AGRICE</h2>
        <p className="authbox-subtitle">Rice Program Management System</p>

        {error && (
          <div className="authbox-error">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* EMAIL */}
          <div className="authbox-field">
            <label className="authbox-label">Email or Contact Number</label>
            <div className="authbox-input-wrap">
              <svg className="authbox-input-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
              </svg>
              <input
                className={`authbox-input${error ? ' authbox-input--error' : ''}`}
                type="text"
                name="login"
                placeholder="Email or Contact Number"
                value={form.login}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div className="authbox-field">
            <label className="authbox-label">Password</label>
            <div className="authbox-input-wrap">
              <svg className="authbox-input-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <input
                className={`authbox-input${error ? ' authbox-input--error' : ''}`}
                type={showPass ? 'text' : 'password'}
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="authbox-eye"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* REMEMBER + FORGOT */}
          <div className="authbox-row">
            <label className="authbox-remember">
              <input type="checkbox" /> Remember me
            </label>
            <Link to="/forgot-password" className="authbox-forgot">Forgot Password?</Link>
          </div>

          {/* SUBMIT */}
          <button className="authbox-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"
                  style={{ animation: 'ab-spin 1s linear infinite' }}>
                  <path d="M12 2a10 10 0 0110 10"/>
                </svg>
                Signing in…
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>
                </svg>
                Sign In
              </>
            )}
          </button>

          {/* REGISTER LINK */}
          <p className="authbox-register">
            Don't have an account?{' '}
            <Link to="/register" className="authbox-register-link">Register as Farmer</Link>
          </p>
        </form>

        {/* SECURITY NOTE */}
        <div className="authbox-security">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          For verified farmers and officials only. Your information is secure with us.
        </div>

      </div>
      {/* ── END CARD ── */}

      {/* ── BELOW CARD: footer + socials on cream bg (help removed) ── */}
      <div className="authbox-below">
        <p className="authbox-footer">
          AGRICE – Municipal Agriculture Office, Lucban<br />© 2026 A rights reserved.
        </p>
        <div className="authbox-socials">
          <a href="#" className="authbox-social-btn" aria-label="Facebook">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
            </svg>
          </a>
          <a href="#" className="authbox-social-btn" aria-label="Phone">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.08 1.22 2 2 0 012.06 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </a>
          <a href="#" className="authbox-social-btn" aria-label="Email">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </a>
        </div>
      </div>

    </div>
  );
};

export default AuthBox;