import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import { CheckCircle2, Eye, EyeOff, User, MapPin, Hash, Phone, Mail, Lock } from 'lucide-react';
import { registerFarmer } from '../api/axios';

const BARANGAY_CHOICES = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan'
];

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '#e5e7eb' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' };
  if (score === 2) return { score: 2, label: 'Fair', color: '#f97316' };
  if (score === 3) return { score: 3, label: 'Good', color: '#eab308' };
  if (score === 4) return { score: 4, label: 'Strong', color: '#22c55e' };
  return { score: 5, label: 'Very Strong', color: '#166534' };
};

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    first_name: '', last_name: '', barangay: '',
    rsbsa_number: '', contact_number: '', email: '',
    password: '', confirm_password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [vibrate, setVibrate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = getPasswordStrength(form.password);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!form.barangay) newErrors.barangay = 'Please select a barangay';
    if (!form.rsbsa_number.trim()) {
      newErrors.rsbsa_number = 'RSBSA number is required';
    } else {
      const rsbsaPattern = /^04-56-22-\d{2,3}-\d{5}$/;
      if (!rsbsaPattern.test(form.rsbsa_number.trim())) {
        newErrors.rsbsa_number = 'Invalid format. Use: 04-56-22-XXX-XXXXX';
      }
    }
    return newErrors;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!form.contact_number || form.contact_number.length !== 11)
      newErrors.contact_number = 'Must be 11 digits';
    if (form.password.length < 8)
      newErrors.password = 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(form.password))
      newErrors.password = 'Must include at least one uppercase letter';
    if (!/[0-9]/.test(form.password))
      newErrors.password = 'Must include at least one number';
    if (form.password !== form.confirm_password)
      newErrors.confirm_password = 'Passwords do not match';
    return newErrors;
  };

  const handleNextStep = async () => {
    const stepErrors = validateStep1();
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setVibrate(true);
      setTimeout(() => setVibrate(false), 500);
      return;
    }

    // Validate against MAO registry before proceeding to step 2
    setLoading(true);
    try {
      // We do a lightweight pre-check by submitting to see if step 1 data is valid
      // We'll catch field-specific errors from the backend
      await registerFarmer({
        first_name: form.first_name,
        last_name: form.last_name,
        barangay: form.barangay,
        rsbsa_number: form.rsbsa_number,
        contact_number: '09000000000', // dummy to pass required field
        password: 'TempPass1',
        confirm_password: 'TempPass1',
      });
      // If somehow it succeeds (shouldn't with dummy contact), still go to step 2
      setStep(2);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const step1Fields = ['first_name', 'last_name', 'barangay', 'rsbsa_number'];
        const step1Errors = {};
        let hasStep1Error = false;
        Object.keys(data).forEach(key => {
          if (step1Fields.includes(key)) {
            step1Errors[key] = Array.isArray(data[key]) ? data[key][0] : data[key];
            hasStep1Error = true;
          }
        });
        if (hasStep1Error) {
          setErrors(step1Errors);
          setVibrate(true);
          setTimeout(() => setVibrate(false), 500);
        } else {
          // No step 1 errors — safe to proceed
          setStep(2);
        }
      } else {
        setStep(2); // non-field error means step 1 is fine
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const stepErrors = validateStep2();
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setVibrate(true);
      setTimeout(() => setVibrate(false), 500);
      return;
    }
    setLoading(true);
    try {
      await registerFarmer({
        ...form,
        email: form.email.trim() === '' ? null : form.email,
      });
      setSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const flatErrors = {};
        Object.keys(data).forEach(key => {
          flatErrors[key] = Array.isArray(data[key]) ? data[key][0] : data[key];
        });
        // If backend returns step 1 errors, go back
        const step1Fields = ['first_name', 'last_name', 'barangay', 'rsbsa_number'];
        const hasStep1Error = Object.keys(flatErrors).some(k => step1Fields.includes(k));
        setErrors(flatErrors);
        if (hasStep1Error) setStep(1);
      }
      setVibrate(true);
      setTimeout(() => setVibrate(false), 500);
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ──
  const wrapStyle = {
    minHeight: '100vh',
    backgroundColor: 'var(--color-bg)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 'calc(var(--nav-h) + 2rem) 1.25rem 3rem',
    overflowY: 'auto',
  };

  const cardStyle = {
    background: 'white',
    borderRadius: '16px',
    padding: '2rem',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
    border: '1px solid rgba(0,0,0,0.06)',
  };

  const inputBase = (hasError) => ({
    width: '100%',
    padding: '0.65rem 0.85rem 0.65rem 2.4rem',
    border: `1.5px solid ${hasError ? '#fca5a5' : '#d1d5db'}`,
    borderRadius: '8px',
    fontSize: '0.85rem',
    background: '#fafafa',
    color: '#1a1a1a',
    outline: 'none',
    boxSizing: 'border-box',
    display: 'block',
  });

  const labelStyle = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.35rem',
  };

  const errorStyle = {
    color: '#dc2626',
    fontSize: '0.7rem',
    marginTop: '0.25rem',
    display: 'block',
  };

  const fieldWrap = { marginBottom: '0.85rem', position: 'relative' };

  const iconStyle = {
    position: 'absolute',
    left: '0.7rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
    pointerEvents: 'none',
  };

  const focusHandlers = (fieldName, hasError) => ({
    onFocus: e => { e.target.style.borderColor = '#2d6a2d'; e.target.style.background = 'white'; },
    onBlur:  e => { e.target.style.borderColor = hasError ? '#fca5a5' : '#d1d5db'; e.target.style.background = '#fafafa'; },
  });

  // ── Success screen ──
  if (success) {
    return (
      <div style={{ ...wrapStyle, alignItems: 'center' }}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
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
          <p style={{ color: '#9ca3af', marginTop: '0.75rem', fontSize: '0.8rem' }}>You may return to login after approval.</p>
        </div>
      </div>
    );
  }

  // ── Step indicator ──
  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.75rem', gap: 0 }}>
      {[1, 2].map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: step >= s ? 'var(--color-primary)' : '#e5e7eb',
              color: step >= s ? 'white' : '#9ca3af',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 700,
              transition: 'all 0.3s',
              boxShadow: step === s ? '0 0 0 4px rgba(45,106,45,0.15)' : 'none',
            }}>
              {step > s ? <CheckCircle2 size={16} /> : s}
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: step >= s ? 'var(--color-primary)' : '#9ca3af', whiteSpace: 'nowrap' }}>
              {s === 1 ? 'Personal Info' : 'Credentials'}
            </span>
          </div>
          {i < 1 && (
            <div style={{ width: '72px', height: '2px', background: step > 1 ? 'var(--color-primary)' : '#e5e7eb', margin: '0 0.5rem', marginBottom: '1.2rem', transition: 'background 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div style={wrapStyle}>
      <div style={{ ...cardStyle }} className={vibrate ? 'button-vibrate' : ''}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <img src={logo} alt="AGRICE Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.2rem' }}>Create Farmer Account</h2>
          <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>Join the AGRICE Program</p>
        </div>

        <StepIndicator />

        {/* ══ STEP 1: Personal Info ══ */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.78rem', color: '#6b7280', background: '#f9fafb', borderRadius: '8px', padding: '0.6rem 0.85rem', border: '1px solid #e5e7eb' }}>
                Enter your name and RSBSA number exactly as recorded in the MAO registry.
              </p>
            </div>

            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ ...iconStyle, top: '50%' }}><User size={14} /></div>
                  <input
                    type="text" name="first_name" placeholder="Juan"
                    value={form.first_name} onChange={handleChange}
                    style={inputBase(!!errors.first_name)}
                    {...focusHandlers('first_name', !!errors.first_name)}
                  />
                </div>
                {errors.first_name && <span style={errorStyle}>{errors.first_name}</span>}
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ ...iconStyle, top: '50%' }}><User size={14} /></div>
                  <input
                    type="text" name="last_name" placeholder="Dela Cruz"
                    value={form.last_name} onChange={handleChange}
                    style={inputBase(!!errors.last_name)}
                    {...focusHandlers('last_name', !!errors.last_name)}
                  />
                </div>
                {errors.last_name && <span style={errorStyle}>{errors.last_name}</span>}
              </div>
            </div>

            {/* Barangay */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Barangay</label>
              <div style={{ position: 'relative' }}>
                <div style={{ ...iconStyle, top: '50%' }}><MapPin size={14} /></div>
                <select
                  name="barangay" value={form.barangay} onChange={handleChange}
                  style={{ ...inputBase(!!errors.barangay), cursor: 'pointer' }}
                  onFocus={e => { e.target.style.borderColor = '#2d6a2d'; }}
                  onBlur={e => { e.target.style.borderColor = errors.barangay ? '#fca5a5' : '#d1d5db'; }}
                >
                  <option value="">Select your Barangay</option>
                  {BARANGAY_CHOICES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {errors.barangay && <span style={errorStyle}>{errors.barangay}</span>}
            </div>

            {/* RSBSA */}
            <div style={fieldWrap}>
              <label style={labelStyle}>RSBSA Number</label>
              <div style={{ position: 'relative' }}>
                <div style={{ ...iconStyle, top: '50%' }}><Hash size={14} /></div>
                <input
                  type="text" name="rsbsa_number" placeholder="04-56-22-001-01234"
                  value={form.rsbsa_number} onChange={handleChange}
                  style={inputBase(!!errors.rsbsa_number)}
                  {...focusHandlers('rsbsa_number', !!errors.rsbsa_number)}
                />
              </div>
              {errors.rsbsa_number && <span style={errorStyle}>{errors.rsbsa_number}</span>}
            </div>

            <button
              onClick={handleNextStep}
              disabled={loading}
              style={{
                width: '100%', padding: '0.75rem',
                background: loading ? '#86efac' : 'var(--color-primary)',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '0.9rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem',
              }}
            >
              {loading ? 'Verifying...' : 'Next →'}
            </button>
          </div>
        )}

        {/* ══ STEP 2: Credentials ══ */}
        {step === 2 && (
          <div>
            {/* Contact */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Contact Number</label>
              <div style={{ position: 'relative' }}>
                <div style={{ ...iconStyle, top: '50%' }}><Phone size={14} /></div>
                <input
                  type="text" name="contact_number" placeholder="09123456789"
                  maxLength={11} value={form.contact_number} onChange={handleChange}
                  style={inputBase(!!errors.contact_number)}
                  {...focusHandlers('contact_number', !!errors.contact_number)}
                />
              </div>
              {errors.contact_number && <span style={errorStyle}>{errors.contact_number}</span>}
            </div>

            {/* Email */}
            <div style={fieldWrap}>
              <label style={labelStyle}>Email <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <div style={{ position: 'relative' }}>
                <div style={{ ...iconStyle, top: '50%' }}><Mail size={14} /></div>
                <input
                  type="email" name="email" placeholder="juan@gmail.com"
                  value={form.email} onChange={handleChange}
                  style={inputBase(!!errors.email)}
                  {...focusHandlers('email', !!errors.email)}
                />
              </div>
              {errors.email && <span style={errorStyle}>{errors.email}</span>}
            </div>

            {/* Password */}
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <div style={{ ...iconStyle, top: '50%' }}><Lock size={14} /></div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password" placeholder="Create password"
                  value={form.password} onChange={handleChange}
                  style={{ ...inputBase(!!errors.password), paddingRight: '2.4rem' }}
                  {...focusHandlers('password', !!errors.password)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span style={errorStyle}>{errors.password}</span>}
            </div>

            {/* Strength bar */}
            {form.password.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{
                      flex: 1, height: '4px', borderRadius: '2px',
                      background: i <= strength.score ? strength.color : '#e5e7eb',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}

            {/* Password rules */}
            <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '0.85rem', border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Password must have:</p>
              {[
                { rule: form.password.length >= 8, text: 'At least 8 characters' },
                { rule: /[A-Z]/.test(form.password), text: 'One uppercase letter (A-Z)' },
                { rule: /[0-9]/.test(form.password), text: 'One number (0-9)' },
                { rule: /[^A-Za-z0-9]/.test(form.password), text: 'One special character (optional, for stronger password)' },
              ].map(({ rule, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: rule ? '#22c55e' : '#e5e7eb', flexShrink: 0, transition: 'background 0.2s' }} />
                  <span style={{ fontSize: '0.7rem', color: rule ? '#166534' : '#6b7280' }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <div style={{ ...iconStyle, top: '50%' }}><Lock size={14} /></div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  name="confirm_password" placeholder="Confirm password"
                  value={form.confirm_password} onChange={handleChange}
                  style={{ ...inputBase(!!errors.confirm_password), paddingRight: '2.4rem' }}
                  {...focusHandlers('confirm_password', !!errors.confirm_password)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm_password && <span style={errorStyle}>{errors.confirm_password}</span>}
              {form.confirm_password && form.password === form.confirm_password && (
                <span style={{ fontSize: '0.7rem', color: '#22c55e', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={12} /> Passwords match
                </span>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
              <button
                onClick={() => { setStep(1); setErrors({}); }}
                style={{ padding: '0.75rem', background: 'white', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ padding: '0.75rem', background: loading ? '#86efac' : 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
          Already have an account?{' '}
          <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>Sign in as Farmer</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.68rem', color: '#d1d5db' }}>
          AGRICE – Municipal Agriculture Office, Lucban
        </p>
      </div>
    </div>
  );
};

export default Register;