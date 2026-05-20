import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { registerFarmer } from '../api/axios';

const BARANGAY_CHOICES = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan'
];

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '', last_name: '', barangay: '',
    contact_number: '', rsbsa_number: '', email: '',
    password: '', confirm_password: ''
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [vibrate, setVibrate] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
    setApiError('');
  };

  const validate = () => {
    const newErrors = {};
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!form.barangay) newErrors.barangay = 'Please select a barangay';
    if (form.contact_number.length !== 11) newErrors.contact_number = 'Must be 11 digits';
    if (!form.rsbsa_number.trim()) newErrors.rsbsa_number = 'RSBSA number is required';
    if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirm_password) newErrors.confirm_password = 'Passwords do not match';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setApiError('');
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setVibrate(true);
      setTimeout(() => setVibrate(false), 500);
      return;
    }
    setLoading(true);
    try {
      await registerFarmer({ ...form, email: form.email.trim() === '' ? null : form.email });
      setSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const flatErrors = {};
        Object.keys(data).forEach(key => { flatErrors[key] = Array.isArray(data[key]) ? data[key][0] : data[key]; });
        setErrors(flatErrors);
      } else {
        setApiError(data?.error || 'Registration failed. Please try again.');
      }
      setVibrate(true);
      setTimeout(() => setVibrate(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (hasError) => ({
    width: '100%', padding: '0.65rem 0.85rem',
    border: `1.5px solid ${hasError ? '#fca5a5' : '#d1d5db'}`,
    borderRadius: '8px', fontSize: '0.85rem',
    background: '#fafafa', color: '#1a1a1a',
    outline: 'none', boxSizing: 'border-box', display: 'block',
  });

  const wrapStyle = {
    minHeight: '100vh',
    backgroundColor: 'var(--color-bg)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 'calc(var(--nav-h) + 2rem) 1.25rem 3rem',
    overflowY: 'auto',
  };

  if (success) {
    return (
      <div style={{ ...wrapStyle, alignItems: 'center' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '2.5rem 2rem', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
          <div style={{ width: '72px', height: '72px', background: '#ecfdf5', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <CheckCircle2 size={36} color="#166534" />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>Registration Received</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem', lineHeight: 1.75 }}>
            Your account has been submitted for admin approval. You will receive a notification once your farmer profile is verified.
          </p>
          <button onClick={() => navigate('/')} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer', width: '100%', maxWidth: '260px' }}>
            Back to Login
          </button>
          <p style={{ color: '#9ca3af', marginTop: '0.75rem', fontSize: '0.8rem' }}>You may return to login and check later after approval.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={{
        background: 'white', borderRadius: '16px',
        padding: '2rem 2rem 2rem',
        width: '100%', maxWidth: '480px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '56px', height: '56px', background: 'var(--color-primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.4rem' }}>🌿</div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.25rem' }}>Create Farmer Account</h2>
          <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Join the AGRICE Program</p>
        </div>

        {apiError && (
          <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.8rem', marginBottom: '1rem' }}>{apiError}</div>
        )}

        <form onSubmit={handleSubmit} className={vibrate ? 'button-vibrate' : ''}>

          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>First Name</label>
              <input type="text" name="first_name" placeholder="Juan" value={form.first_name} onChange={handleChange} required style={inputStyle(!!errors.first_name)}
                onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
                onBlur={e => { e.target.style.borderColor = errors.first_name ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
              />
              {errors.first_name && <span style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>{errors.first_name}</span>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Last Name</label>
              <input type="text" name="last_name" placeholder="Dela Cruz" value={form.last_name} onChange={handleChange} required style={inputStyle(!!errors.last_name)}
                onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
                onBlur={e => { e.target.style.borderColor = errors.last_name ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
              />
              {errors.last_name && <span style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>{errors.last_name}</span>}
            </div>
          </div>

          {/* Barangay */}
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Barangay</label>
            <select name="barangay" value={form.barangay} onChange={handleChange} required style={{ ...inputStyle(!!errors.barangay), cursor: 'pointer' }}>
              <option value="">Select your Barangay</option>
              {BARANGAY_CHOICES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {errors.barangay && <span style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>{errors.barangay}</span>}
          </div>

          {/* Contact */}
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Contact Number</label>
            <input type="text" name="contact_number" placeholder="09123456789" maxLength={11} value={form.contact_number} onChange={handleChange} required style={inputStyle(!!errors.contact_number)}
              onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
              onBlur={e => { e.target.style.borderColor = errors.contact_number ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
            />
            {errors.contact_number && <span style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>{errors.contact_number}</span>}
          </div>

          {/* RSBSA */}
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>RSBSA Number</label>
            <input type="text" name="rsbsa_number" placeholder="04-0432-000-0010" value={form.rsbsa_number} onChange={handleChange} required style={inputStyle(!!errors.rsbsa_number)}
              onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
              onBlur={e => { e.target.style.borderColor = errors.rsbsa_number ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
            />
            {errors.rsbsa_number && <span style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>{errors.rsbsa_number}</span>}
          </div>

          {/* Email */}
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Email <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
            <input type="email" name="email" placeholder="juan@gmail.com" value={form.email} onChange={handleChange} style={inputStyle(!!errors.email)}
              onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
              onBlur={e => { e.target.style.borderColor = errors.email ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
            />
            {errors.email && <span style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>{errors.email}</span>}
          </div>

          {/* Password row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Password</label>
              <input type="password" name="password" placeholder="Create password" value={form.password} onChange={handleChange} required style={inputStyle(!!errors.password)}
                onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
                onBlur={e => { e.target.style.borderColor = errors.password ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
              />
              {errors.password && <span style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>{errors.password}</span>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Confirm Password</label>
              <input type="password" name="confirm_password" placeholder="Confirm password" value={form.confirm_password} onChange={handleChange} required style={inputStyle(!!errors.confirm_password)}
                onFocus={e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; }}
                onBlur={e => { e.target.style.borderColor = errors.confirm_password ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; }}
              />
              {errors.confirm_password && <span style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>{errors.confirm_password}</span>}
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem', background: loading ? '#86efac' : 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
          Already have an account?{' '}
          <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>Sign in as Farmer</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.68rem', color: '#d1d5db' }}>
          AGRICE – Municipal Agriculture Office, Lucban
        </p>
      </div>
    </div>
  );
};

export default Register;