import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { resetPassword } from '../api/axios';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const otp   = location.state?.otp   || '';

  const [form, setForm] = useState({ new_password: '', confirm_password: '' });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  if (!email || !otp) {
    return (
      <div style={{
        minHeight: '100vh', paddingTop: 'var(--nav-h)',
        backgroundColor: 'var(--color-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'calc(var(--nav-h) + 2rem) 1.25rem 3rem',
      }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '2.5rem 2rem', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
          <div style={{ width: '60px', height: '60px', background: '#fef3c7', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.5rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem' }}>Session Expired</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem', lineHeight: 1.65 }}>Your reset session has expired. Please start again.</p>
          <Link to="/forgot-password">
            <button style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Start Over
            </button>
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
      await resetPassword({ email, otp, ...form });
      setSuccess(true);
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: 'white', borderRadius: '16px', padding: '2.5rem 2rem',
    width: '100%', maxWidth: '420px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.06)',
  };
  const wrapStyle = {
    minHeight: '100vh', backgroundColor: 'var(--color-bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 'calc(var(--nav-h) + 2rem) 1.25rem 3rem',
  };
  const inputStyle = (hasError) => ({
    width: '100%', padding: '0.7rem 1rem',
    border: `1.5px solid ${hasError ? '#fca5a5' : '#d1d5db'}`,
    borderRadius: '8px', fontSize: '0.875rem',
    background: '#fafafa', color: '#1a1a1a',
    outline: 'none', boxSizing: 'border-box', display: 'block',
  });

  if (success) {
    return (
      <div style={wrapStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', background: '#dcfce7', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.5rem' }}>✅</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem' }}>Password Changed!</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem', lineHeight: 1.65 }}>Your password has been successfully updated. You can now log in with your new password.</p>
          <Link to="/">
            <button style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Back to Login
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <div style={{ width: '60px', height: '60px', background: 'var(--color-primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.5rem' }}>🔑</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.4rem' }}>Set New Password</h2>
        <p style={{ fontSize: '0.82rem', color: '#6b7280', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6 }}>Create a strong new password for your AGRICE account.</p>

        {apiError && (
          <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Email Address</label>
            <input type="email" value={email} readOnly style={{ ...inputStyle(false), background: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>New Password</label>
            <input type="password" name="new_password" placeholder="Create a new password" value={form.new_password} onChange={handleChange} required style={inputStyle(!!errors.new_password)}
              onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
              onBlur={e => { e.target.style.borderColor = errors.new_password ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
            />
            {errors.new_password && <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{errors.new_password}</span>}
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Confirm New Password</label>
            <input type="password" name="confirm_password" placeholder="Confirm your new password" value={form.confirm_password} onChange={handleChange} required style={inputStyle(!!errors.confirm_password)}
              onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
              onBlur={e => { e.target.style.borderColor = errors.confirm_password ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
            />
            {errors.confirm_password && <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{errors.confirm_password}</span>}
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem', background: loading ? '#86efac' : 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Updating...' : 'Change Password'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.68rem', color: '#d1d5db' }}>AGRICE – Municipal Agriculture Office, Lucban</p>
      </div>
    </div>
  );
};

export default ResetPassword;