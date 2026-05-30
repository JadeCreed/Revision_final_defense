import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { forgotPassword, verifyOTP } from '../api/axios';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const timerRef = useRef(null);
  const inputRefs = useRef([]);

  const startCountdown = () => {
    setCountdown(60);
    setCanResend(false);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    setError('');
    try {
      await forgotPassword({ email });
      setShowOTPModal(true);
      setOtpValues(['', '', '', '', '', '']);
      setOtpError('');
      setCanResend(false);
      startCountdown();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError('If this email is registered, a reset code will be sent.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...otpValues];
    next[index] = value;
    setOtpValues(next);
    setOtpError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpValues(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = otpValues.join('');
    if (otp.length !== 6) { setOtpError('Please enter the complete 6-digit code.'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      await verifyOTP({ email, otp });
      navigate('/forgot-password/reset-password', { state: { email, otp } });
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Invalid or expired code. Try again.');
      setOtpValues(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setOtpError('');
    try {
      await forgotPassword({ email });
      setOtpValues(['', '', '', '', '', '']);
      startCountdown();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setOtpError('Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      paddingTop: 'var(--nav-h)',
      backgroundColor: 'var(--color-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(var(--nav-h) + 2rem) 1.25rem 3rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <img src={logo} alt="AGRICE Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center', color: '#1a1a1a', marginBottom: '0.4rem' }}>
          Forgot Password
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#6b7280', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Enter your registered email address and we'll send you a verification code to reset your password.
        </p>

        {error && (
          <div style={{
            background: '#fee2e2', color: '#dc2626', borderRadius: '8px',
            padding: '0.6rem 0.85rem', fontSize: '0.8rem', marginBottom: '1rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              required
              style={{
                width: '100%', padding: '0.7rem 1rem',
                border: error ? '1.5px solid #fca5a5' : '1.5px solid #d1d5db',
                borderRadius: '8px', fontSize: '0.875rem',
                background: '#fafafa', color: '#1a1a1a',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
              onBlur={e => { e.target.style.borderColor = error ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <Link to="/forgot-password/admin-reset" style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Try Another Way
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                padding: '0.65rem 1.5rem',
                background: loading ? '#86efac' : 'var(--color-primary)',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '0.875rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </div>
        </form>

        {showOTPModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'white', borderRadius: '24px', padding: '2.5rem 2rem', width: '100%', maxWidth: '380px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', textAlign: 'center', position: 'relative' }}>
              <button onClick={() => setShowOTPModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <img src={logo} alt="AGRICE Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.375rem' }}>Check Your Email</h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1.75rem', lineHeight: 1.6 }}>
                We sent a 6-digit code to <strong style={{ color: '#2d6a2d' }}>{email}</strong>
              </p>
              {otpError && (
                <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.78rem', marginBottom: '1rem' }}>
                  {otpError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', marginBottom: '1.5rem' }} onPaste={handleOtpPaste}>
                {otpValues.map((val, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    style={{
                      width: '48px', height: '56px', textAlign: 'center', fontSize: '1.4rem', fontWeight: 700,
                      border: `2px solid ${otpError ? '#fca5a5' : val ? '#2d6a2d' : '#e5e7eb'}`,
                      borderRadius: '12px', outline: 'none', background: val ? '#f0fdf4' : 'white', color: '#1a1a1a', transition: 'all 0.15s', caretColor: '#2d6a2d',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#2d6a2d'; e.target.style.boxShadow = '0 0 0 3px rgba(45,106,45,0.12)'; }}
                    onBlur={(e) => { e.target.style.borderColor = otpError ? '#fca5a5' : val ? '#2d6a2d' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                  />
                ))}
              </div>
              <button onClick={handleVerify} disabled={otpLoading} style={{ width: '100%', padding: '0.8rem', background: otpLoading ? '#86efac' : '#2d6a2d', color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 700, cursor: otpLoading ? 'not-allowed' : 'pointer', marginBottom: '1.25rem' }}>
                {otpLoading ? 'Verifying...' : 'Verify Code'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                <span style={{ color: '#6b7280' }}>
                  {canResend ? (
                    <button onClick={handleResend} disabled={resending} style={{ background: 'none', border: 'none', color: '#2d6a2d', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>
                      {resending ? 'Resending...' : 'Resend OTP'}
                    </button>
                  ) : (
                    <span>Resend in <strong style={{ color: '#2d6a2d' }}>{countdown}s</strong></span>
                  )}
                </span>
                <Link to="/forgot-password/admin-reset" onClick={() => setShowOTPModal(false)} style={{ color: '#2d6a2d', fontWeight: 600, textDecoration: 'none' }}>
                  Try Another Way
                </Link>
              </div>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
          Remembered your password?{' '}
          <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>
            Back to Login
          </Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.68rem', color: '#d1d5db' }}>
          AGRICE – Municipal Agriculture Office, Lucban
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;