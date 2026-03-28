// src/pages/Landing.jsx
// The main landing page with hero text and embedded login form
// Desktop: two-column layout | Mobile: stacked

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../api/axios';
import { useAuth } from '../auth/AuthContext';

// Role → dashboard route mapping
const ROLE_ROUTES = {
  ADMIN: '/admin',
  FARMER: '/farmer',
  AT: '/at',
  BRGY: '/brgy',
};

const Landing = () => {
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(''); // clear error on type
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginUser(form);
      login(res.data); // save token + role to context
      const path = ROLE_ROUTES[res.data.role] || '/';
      navigate(path); // redirect to role dashboard
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hero-section">
      {/* LEFT: Hero text */}
      <div className="hero-content">
        <h1 className="hero-title">
          The Municipal Agriculture Office (MAO) of Lucban
        </h1>
        <p className="hero-subtitle">
          Supporting sustainable agricultural coordination and rice program
          monitoring for our community. Explore our programs and initiatives
          designed to uplift local farmers.
        </p>
        <button className="btn-outline" style={{ width: 'auto' }}>
          Explore Our Programs
        </button>
      </div>

      {/* RIGHT: Login card */}
      <div className="hero-auth">
        <div className="auth-card">
          {/* Icon */}
          <div className="auth-card-icon">
            <span style={{ fontSize: '1.5rem' }}>🌿</span>
          </div>

          <h2 className="auth-card-title">Sign in to AGRICE</h2>
          <p className="auth-card-subtitle">Rice Program Management System</p>

          {/* Error banner */}
          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Contact Number */}
            <div className="form-group">
              <label>Email or Contact Number</label>
              <input
                className={`form-input ${error ? 'error' : ''}`}
                type="text"
                name="login"
                placeholder="Email or Contact Number"
                value={form.login}
                onChange={handleChange}
                required
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label>Password</label>
              <input
                className={`form-input ${error ? 'error' : ''}`}
                type="password"
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            {/* Remember me + Forgot password */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-muted)' }}>
                <input type="checkbox" /> Remember me
              </label>
              <Link
                to="/forgot-password"
                style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit */}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Register link */}
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              Register as Farmer
            </Link>
          </p>

          {/* Footer */}
          <p className="footer-text" style={{ color: 'var(--color-muted)' }}>
            AGRICE - Municipal Agriculture Office, Lucban
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;