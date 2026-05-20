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
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    setError('');
    try {
      await forgotPassword({ email });
      navigate('/forgot-password/verify-otp', { state: { email } });
    } catch (err) {
      setError(err.response?.data?.error || 'Email not found. Please try again.');
    } finally {
      setLoading(false);
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

        {/* Icon */}
        <div style={{
          width: '60px', height: '60px',
          background: 'var(--color-primary)',
          borderRadius: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
          fontSize: '1.5rem',
        }}>🔒</div>

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