import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

  // ✅ Correct validation
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
      await registerFarmer({
        ...form,
        email: form.email.trim() === '' ? null : form.email
      });

      setSuccess(true);

    } catch (err) {
      const data = err.response?.data;
      let hasError = false;

      if (data && typeof data === 'object') {
        // Flatten Django errors
        const flatErrors = {};
        Object.keys(data).forEach(key => {
          flatErrors[key] = Array.isArray(data[key]) ? data[key][0] : data[key];
        });

        if (Object.keys(flatErrors).length > 0) hasError = true;
        setErrors(flatErrors);

      } else {
        hasError = true;
        setApiError(data?.error || 'Registration failed. Please try again.');
      }

      if (hasError) {
        setVibrate(true);
        setTimeout(() => setVibrate(false), 500);
      }

    } finally {
      setLoading(false);
    }
  };

  // ✅ Success UI
  if (success) {
    return (
      <div className="register-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-card-icon">
            <span style={{ fontSize: '1.5rem' }}>✅</span>
          </div>
          <h2 className="auth-card-title">Registration Successful!</h2>
          <p style={{ color: 'var(--color-muted)', margin: '1rem 0' }}>
            Your account is pending admin approval. You will be notified once verified.
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
      <div className="auth-card" style={{ maxWidth: '420px' }}>
        <div className="auth-card-icon">
          <span style={{ fontSize: '1.5rem' }}>🌿</span>
        </div>

        <h2 className="auth-card-title">Create Farmer Account</h2>
        <p className="auth-card-subtitle">Join the AGRICE Program</p>

        {apiError && <div className="error-banner">{apiError}</div>}

        <form onSubmit={handleSubmit}>
          {/* Name Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label>First Name</label>
              <input
                className={`form-input ${errors.first_name ? 'error' : ''}`}
                type="text"
                name="first_name"
                placeholder="Juan"
                value={form.first_name}
                onChange={handleChange}
                required
              />
              {errors.first_name && <span className="error-message">{errors.first_name}</span>}
            </div>

            <div className="form-group">
              <label>Last Name</label>
              <input
                className={`form-input ${errors.last_name ? 'error' : ''}`}
                type="text"
                name="last_name"
                placeholder="Dela Cruz"
                value={form.last_name}
                onChange={handleChange}
                required
              />
              {errors.last_name && <span className="error-message">{errors.last_name}</span>}
            </div>
          </div>

          {/* Barangay */}
          <div className="form-group">
            <label>Barangay</label>
            <select
              className={`form-input ${errors.barangay ? 'error' : ''}`}
              name="barangay"
              value={form.barangay}
              onChange={handleChange}
              required
            >
              <option value="">Select your Barangay</option>
              {BARANGAY_CHOICES.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.barangay && <span className="error-message">{errors.barangay}</span>}
          </div>

          {/* Contact Number */}
          <div className="form-group">
            <label>Contact Number</label>
            <input
              className={`form-input ${errors.contact_number ? 'error' : ''}`}
              type="text"
              name="contact_number"
              placeholder="09123456789"
              maxLength={11}
              value={form.contact_number}
              onChange={handleChange}
              required
            />
            {errors.contact_number && <span className="error-message">{errors.contact_number}</span>}
          </div>

          {/* RSBSA Number */}
          <div className="form-group">
            <label>RSBSA Number</label>
            <input
              className={`form-input ${errors.rsbsa_number ? 'error' : ''}`}
              type="text"
              name="rsbsa_number"
              placeholder="04-0432-000-0010"
              value={form.rsbsa_number}
              onChange={handleChange}
              required
            />
            {errors.rsbsa_number && <span className="error-message">{errors.rsbsa_number}</span>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label>Email (optional)</label>
            <input
              className={`form-input ${errors.email ? 'error' : ''}`}
              type="email"
              name="email"
              placeholder="juan@gmail.com"
              value={form.email}
              onChange={handleChange}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label>Password</label>
            <input
              className={`form-input ${errors.password ? 'error' : ''}`}
              type="password"
              name="password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              required
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              className={`form-input ${errors.confirm_password ? 'error' : ''}`}
              type="password"
              name="confirm_password"
              placeholder="Confirm your password"
              value={form.confirm_password}
              onChange={handleChange}
              required
            />
            {errors.confirm_password && <span className="error-message">{errors.confirm_password}</span>}
          </div>

          <button
            className={`btn-primary ${vibrate ? 'button-vibrate' : ''}`}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        {/* ✅ Restore the missing design */}
        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          Already have an account?{' '}
          <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Sign in as Farmer
          </Link>
        </p>

        <p className="footer-text" style={{ color: 'var(--color-muted)' }}>
          AGRICE - Municipal Agriculture Office, Lucban
        </p>
      </div>
    </div>
  );
};

export default Register;