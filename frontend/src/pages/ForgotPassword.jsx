// src/pages/ForgotPassword.jsx
// FORGOT PASSWORD — Step 1 of 3
// User enters their email → OTP is sent → goes to /forgot-password/verify-otp
// "Try Another Way" → goes to /forgot-password/admin-reset (phone number flow)

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/axios';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Call Django /forgot-password/ — sends OTP to email
      await forgotPassword({ email });
      // Pass email to next page via navigation state
      // so we don't have to re-enter it
      navigate('/forgot-password/verify-otp', { state: { email } });
    } catch (err) {
      setError(err.response?.data?.error || 'Email not found. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="auth-card">

        {/* Icon */}
        <div className="auth-card-icon">
          <span style={{ fontSize: '1.5rem' }}>🔒</span>
        </div>

        {/* Title + intro */}
        <h2 className="auth-card-title">Forgot Password</h2>
        <p className="auth-card-subtitle">
          Enter your registered email address and we'll send you a verification code to reset your password.
        </p>

        {/* Error banner */}
        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Email input */}
          <div className="form-group">
            <label>Email Address</label>
            <input
              className={`form-input ${error ? 'error' : ''}`}
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              required
            />
          </div>

          {/* Row: Try Another Way (left) + Send Code button (right) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginTop: '0.5rem',
          }}>
            {/* Try Another Way — goes to admin reset flow */}
            <Link
              to="/forgot-password/admin-reset"
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-primary)',
                fontWeight: '500',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Try Another Way
            </Link>

            {/* Send Code button */}
            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: 'auto', padding: '0.625rem 1.5rem' }}
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </div>
        </form>

        {/* Back to login */}
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          Remembered your password?{' '}
          <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Back to Login
          </Link>
        </p>

        <p className="footer-text" style={{ color: 'var(--color-muted)' }}>
          AGRICE - Municipal Agriculture Office, Lucban
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;