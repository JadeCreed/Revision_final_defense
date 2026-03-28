// src/pages/ResetPassword.jsx
// FORGOT PASSWORD — Step 3 of 3
// User sets a new password. Email is pre-filled (read-only).
// On success → redirects to landing/login page

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { resetPassword } from '../api/axios';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Email + otp passed from VerifyOTP page via navigation state
  const email = location.state?.email || '';
  const otp   = location.state?.otp   || '';

  const [form, setForm] = useState({ new_password: '', confirm_password: '' });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  // Redirect if missing state (direct URL access)
  if (!email || !otp) {
    return (
      <div className="register-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-card-icon"><span style={{ fontSize: '1.5rem' }}>⚠️</span></div>
          <h2 className="auth-card-title">Session Expired</h2>
          <p style={{ color: 'var(--color-muted)', margin: '1rem 0' }}>
            Your reset session has expired. Please start again.
          </p>
          <Link to="/forgot-password">
            <button className="btn-primary">Start Over</button>
          </Link>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
    setApiError('');
  };

  const validate = () => {
    const errs = {};
    if (form.new_password.length < 6) errs.new_password = 'Password must be at least 6 characters';
    if (form.new_password !== form.confirm_password) errs.confirm_password = 'Passwords do not match';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    setApiError('');
    try {
      // Send email + otp (proof) + new passwords to Django
      await resetPassword({ email, otp, ...form });
      setSuccess(true);
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success screen — redirect to login
  if (success) {
    return (
      <div className="register-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-card-icon"><span style={{ fontSize: '1.5rem' }}>✅</span></div>
          <h2 className="auth-card-title">Password Changed!</h2>
          <p style={{ color: 'var(--color-muted)', margin: '1rem 0' }}>
            Your password has been successfully updated. You can now log in with your new password.
          </p>
          <Link to="/">
            <button className="btn-primary">Back to Login</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="register-page">
      <div className="auth-card">

        {/* Icon */}
        <div className="auth-card-icon">
          <span style={{ fontSize: '1.5rem' }}>🔑</span>
        </div>

        <h2 className="auth-card-title">Set New Password</h2>
        <p className="auth-card-subtitle">
          Create a strong new password for your AGRICE account.
        </p>

        {apiError && <div className="error-banner">{apiError}</div>}

        <form onSubmit={handleSubmit}>
          {/* Email — auto-filled, read-only */}
          <div className="form-group">
            <label>Email Address</label>
            <input
              className="form-input"
              type="email"
              value={email}
              readOnly
              style={{ backgroundColor: '#f3f4f6', color: 'var(--color-muted)', cursor: 'not-allowed' }}
            />
          </div>

          {/* New Password */}
          <div className="form-group">
            <label>New Password</label>
            <input
              className={`form-input ${errors.new_password ? 'error' : ''}`}
              type="password"
              name="new_password"
              placeholder="Create a new password"
              value={form.new_password}
              onChange={handleChange}
              required
            />
            {errors.new_password && <span className="error-message">{errors.new_password}</span>}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              className={`form-input ${errors.confirm_password ? 'error' : ''}`}
              type="password"
              name="confirm_password"
              placeholder="Confirm your new password"
              value={form.confirm_password}
              onChange={handleChange}
              required
            />
            {errors.confirm_password && <span className="error-message">{errors.confirm_password}</span>}
          </div>

          {/* Submit */}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Change Password'}
          </button>
        </form>

        <p className="footer-text" style={{ color: 'var(--color-muted)' }}>
          AGRICE - Municipal Agriculture Office, Lucban
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;