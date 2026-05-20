// src/pages/VerifyOTP.jsx
// FORGOT PASSWORD — Step 2 of 3
// User enters the 6-digit OTP sent to their email
// 60-second countdown before Resend OTP becomes clickable
// On success → goes to /forgot-password/reset-password

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { verifyOTP, forgotPassword } from '../api/axios';

const VerifyOTP = () => {
  const navigate  = useNavigate();
  const location  = useLocation();

  // Email passed from ForgotPassword page via navigation state
  const email = location.state?.email || '';

  const [otp, setOtp]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  // Countdown timer: 60 seconds before Resend is enabled
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef(null);

  // Start countdown on mount
  useEffect(() => {
    startCountdown();
    // Redirect if no email in state (user navigated here directly)
    if (!email) navigate('/forgot-password', { replace: true });
    return () => clearInterval(timerRef.current); // cleanup on unmount
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    setCanResend(false);
    clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true); // enable Resend button
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Verify OTP with Django
      await verifyOTP({ email, otp });
      // Pass email + otp to reset page (otp needed as proof)
      navigate('/forgot-password/reset-password', { state: { email, otp } });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setError('');
    setResendSuccess('');
    try {
      // Resend OTP by calling Step 1 again
      await forgotPassword({ email });
      setResendSuccess('A new code has been sent to your email.');
      setOtp('');
      startCountdown(); // restart the 60s timer
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="register-page">
      <div className="auth-card">

        {/* Icon */}
        <div className="auth-card-icon">
          <span style={{ fontSize: '1.5rem' }}>📨</span>
        </div>

        {/* Title + intro */}
        <h2 className="auth-card-title">Check Your Email</h2>
        <p className="auth-card-subtitle">
          We sent a 6-digit verification code to{' '}
          <strong style={{ color: 'var(--color-primary)' }}>{email}</strong>.
          Enter the code below to continue.
        </p>

        {/* Error / success banners */}
        {error        && <div className="error-banner">{error}</div>}
        {resendSuccess && (
          <div style={{
            backgroundColor: '#dcfce7',
            color: '#166534',
            borderRadius: '0.5rem',
            padding: '0.625rem 0.875rem',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            textAlign: 'center',
          }}>
            {resendSuccess}
          </div>
        )}

        <form onSubmit={handleVerify}>
          {/* OTP input */}
          <div className="form-group">
            <label>Verification Code</label>
            <input
              className={`form-input ${error ? 'error' : ''}`}
              type="text"
              placeholder="Enter 6-digit code"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                // Only allow numbers
                const val = e.target.value.replace(/\D/g, '');
                setOtp(val);
                setError('');
              }}
              style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.5rem' }}
              required
            />
          </div>

          {/* Resend row: countdown OR resend button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            fontSize: '0.8rem',
          }}>
            {/* Countdown / Resend */}
            <span style={{ color: 'var(--color-muted)' }}>
              {canResend ? (
                // Resend button — active after countdown
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.8rem',
                    padding: 0,
                  }}
                >
                  {resending ? 'Resending...' : 'Resend OTP'}
                </button>
              ) : (
                // Countdown — not yet clickable
                <span>Resend OTP in <strong>{countdown}s</strong></span>
              )}
            </span>

            {/* Try another way link */}
            <Link
              to="/forgot-password/admin-reset"
              style={{ color: 'var(--color-primary)', fontWeight: '500', textDecoration: 'none' }}
            >
              Try Another Way
            </Link>
          </div>

          {/* Verify button */}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        {/* Back to forgot password */}
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          Wrong email?{' '}
          <Link to="/forgot-password" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Go Back
          </Link>
        </p>

        {/* ── BELOW CARD: footer + socials only ── */}
        <div className="authbox-below">
          <p className="authbox-footer">
            AGRICE 	6 Municipal Agriculture Office, Lucban<br />	6 2025 All rights reserved.
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
    </div>
  );
};

export default VerifyOTP;