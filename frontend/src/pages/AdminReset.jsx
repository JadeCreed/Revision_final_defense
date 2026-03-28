// src/pages/AdminReset.jsx
// FORGOT PASSWORD — Alternative flow (no email)
// User enters their contact number → system checks if it exists
// → notifies admin to manually reset → user waits for admin action
// Admin will see this request in User Management (to be built later)

import { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';

const AdminReset = () => {
  const [contactNumber, setContactNumber] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (contactNumber.length !== 11) {
      setError('Please enter a valid 11-digit contact number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Call backend to verify number exists + notify admin
      // Endpoint: POST /api/accounts/request-admin-reset/
      // (you will create this Django view later)
      await API.post('/admin-reset-request/', { contact_number: contactNumber });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Contact number not found in our records.');
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (submitted) {
    return (
      <div className="register-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-card-icon"><span style={{ fontSize: '1.5rem' }}>📋</span></div>
          <h2 className="auth-card-title">Request Submitted</h2>
          <p style={{ color: 'var(--color-muted)', margin: '1rem 0', lineHeight: 1.6 }}>
            Your password reset request has been sent to the administrator.
            Please wait for the admin to verify your account and reset your password.
            You may contact the MAO office directly for faster assistance.
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
          <span style={{ fontSize: '1.5rem' }}>📞</span>
        </div>

        <h2 className="auth-card-title">Request Admin Reset</h2>
        <p className="auth-card-subtitle">
          Don't have access to your email? Enter your registered contact number and
          the administrator will verify and reset your password for you.
        </p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Contact Number */}
          <div className="form-group">
            <label>Contact Number</label>
            <input
              className={`form-input ${error ? 'error' : ''}`}
              type="text"
              placeholder="09XXXXXXXXX"
              maxLength={11}
              value={contactNumber}
              onChange={(e) => {
                // Only allow numbers
                const val = e.target.value.replace(/\D/g, '');
                setContactNumber(val);
                setError('');
              }}
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              Enter the contact number you used when registering
            </span>
          </div>

          {/* Submit */}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Request Admin Reset'}
          </button>
        </form>

        {/* Back to email reset */}
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          Have access to your email?{' '}
          <Link to="/forgot-password" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Reset via Email
          </Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          <Link to="/" style={{ color: 'var(--color-muted)' }}>Back to Login</Link>
        </p>

        <p className="footer-text" style={{ color: 'var(--color-muted)' }}>
          AGRICE - Municipal Agriculture Office, Lucban
        </p>
      </div>
    </div>
  );
};

export default AdminReset;