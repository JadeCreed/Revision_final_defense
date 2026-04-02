import { useState, useEffect, useCallback } from 'react'; // ✅ added useCallback
import { useAuth } from '../../auth/AuthContext';
import API from '../../api/axios';

const BARANGAYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan'
];

const FarmerProfile = () => {
  const { firstName, lastName } = useAuth();

  // Page state
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // User status — controls button label and messaging
  const [userStatus, setUserStatus] = useState('PENDING');

  // Form state — combines User fields + FarmerProfile fields
  const [form, setForm] = useState({
    first_name:             '',
    last_name:              '',
    email:                  '',
    contact_number:         '',
    barangay:               '',
    rsbsa_number:           '',
    middle_name:            '',
    ext_name:               '',
    date_of_birth:          '',
    gender:                 '',
    residency_municipality: '',
    residency_barangay:     '',
    farm_municipality:      '',
    farm_barangay:          '',
    ip:             false,
    senior_citizen: false,
    pwd:            false,
    arbs:           false,
    four_ps:        false,
  });

  const [fieldErrors, setFieldErrors] = useState({});

  // ── LOAD EXISTING PROFILE ──
  // ✅ useCallback: stable reference — doesn't recreate on every render
  // ✅ empty deps: only uses stable setters (setUserStatus, setForm, setError, setLoading)
  const loadProfile = useCallback(async () => {
    try {
      const res = await API.get('/farmer-profile/');
      const { user, profile } = res.data;

      setUserStatus(user.status || 'PENDING');

      setForm({
        first_name:             user.first_name             || '',
        last_name:              user.last_name              || '',
        email:                  user.email                  || '',
        contact_number:         user.contact_number         || '',
        barangay:               user.barangay               || '',
        rsbsa_number:           user.rsbsa_number           || '',
        middle_name:            profile.middle_name         || '',
        ext_name:               profile.ext_name            || '',
        date_of_birth:          profile.date_of_birth       || '',
        gender:                 profile.gender              || '',
        residency_municipality: profile.residency_municipality || '',
        residency_barangay:     profile.residency_barangay  || '',
        farm_municipality:      profile.farm_municipality   || '',
        farm_barangay:          profile.farm_barangay       || '',
        ip:             profile.ip             || false,
        senior_citizen: profile.senior_citizen || false,
        pwd:            profile.pwd            || false,
        arbs:           profile.arbs           || false,
        four_ps:        profile.four_ps        || false,
      });
    } catch {
      setError('Failed to load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []); // ✅ empty deps — all used values are stable setState functions

  // ── INITIAL LOAD ──
  useEffect(() => {
    loadProfile();
  }, [loadProfile]); // ✅ safe to include now that loadProfile is stable

  // ── RELOAD ON WINDOW FOCUS (e.g. user switches tabs and comes back) ──
  useEffect(() => {
    const handleFocus = () => loadProfile();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadProfile]); // ✅ safe to include

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key]: '' }));
    setError('');
    setSuccess('');
  };

  // ── VALIDATE REQUIRED FIELDS ──
  const validate = () => {
    const errs = {};
    if (!form.first_name.trim())             errs.first_name             = 'Required';
    if (!form.last_name.trim())              errs.last_name              = 'Required';
    if (!form.contact_number || form.contact_number.length !== 11)
                                             errs.contact_number         = 'Must be 11 digits';
    if (!form.date_of_birth)                 errs.date_of_birth          = 'Date of birth is required';
    if (!form.gender)                        errs.gender                 = 'Please select a gender';
    if (!form.residency_municipality.trim()) errs.residency_municipality = 'Required';
    if (!form.residency_barangay.trim())     errs.residency_barangay     = 'Required';
    if (!form.farm_municipality.trim())      errs.farm_municipality      = 'Required';
    if (!form.farm_barangay.trim())          errs.farm_barangay          = 'Required';
    return errs;
  };

  // ── SUBMIT PROFILE ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please fill in all required fields.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await API.put('/farmer-profile/', form);

      // Re-fetch to get the LATEST status from server
      const refreshed = await API.get('/farmer-profile/');
      const newStatus = refreshed.data.user.status;
      setUserStatus(newStatus);

      if (newStatus === 'COMPLETE') {
        setSuccess('Profile submitted! Waiting for admin approval.');
      } else if (newStatus === 'APPROVED') {
        setSuccess('Profile updated successfully!');
      } else {
        setSuccess('Profile saved.');
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const flatErrs = {};
        Object.entries(data).forEach(([k, v]) => {
          flatErrs[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setFieldErrors(flatErrs);
      }
      setError('Failed to save profile. Please check the form and try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── STYLES ──
  const inputStyle = (hasError) => ({
    padding:      '0.625rem 0.875rem',
    border:       `1.5px solid ${hasError ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem',
    fontSize:     '0.9rem',
    width:        '100%',
    outline:      'none',
    transition:   'border-color 0.15s',
  });

  const labelStyle = {
    fontSize:     '0.8rem',
    fontWeight:   '600',
    color:        '#374151',
    marginBottom: '0.25rem',
    display:      'block',
  };

  const sectionTitle = {
    fontSize:      '0.75rem',
    fontWeight:    '700',
    color:         '#2d6a2d',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom:  '0.875rem',
    paddingBottom: '0.5rem',
    borderBottom:  '1px solid #e5e7eb',
  };

  // ✅ Field component handles its own error display
  // DO NOT add a manual error span inside children — it will show twice
  const Field = ({ label, fieldKey, type = 'text', required = false, children }) => (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      {children || (
        <input
          type={type}
          value={form[fieldKey]}
          onChange={e => handleChange(fieldKey, e.target.value)}
          style={inputStyle(!!fieldErrors[fieldKey])}
        />
      )}
      {/* ✅ Field handles error here — don't repeat this inside children */}
      {fieldErrors[fieldKey] && (
        <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem', display: 'block' }}>
          {fieldErrors[fieldKey]}
        </span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: '#9ca3af' }}>
        Loading your profile...
      </div>
    );
  }

  // ── STATUS BANNER ──
  const StatusBanner = () => {
    const banners = {
      PENDING: {
        bg: '#fef9c3', color: '#854d0e', border: '#fde047',
        text: '⏳ Your account is pending. Please complete and submit your profile below for admin approval.',
      },
      COMPLETE: {
        bg: '#dbeafe', color: '#1e40af', border: '#93c5fd',
        text: '📋 Your profile has been submitted and is awaiting admin review.',
      },
      APPROVED: {
        bg: '#dcfce7', color: '#166534', border: '#86efac',
        text: '✅ Your account is approved. You can update your information anytime.',
      },
      REJECTED: {
        bg: '#fee2e2', color: '#991b1b', border: '#fca5a5',
        text: '❌ Your account was not approved. Please contact the MAO office for assistance.',
      },
    };

    const banner = banners[userStatus];
    if (!banner) return null;

    return (
      <div style={{
        backgroundColor: banner.bg,
        color:           banner.color,
        border:          `1px solid ${banner.border}`,
        borderRadius:    '0.75rem',
        padding:         '0.875rem 1.25rem',
        marginBottom:    '1.5rem',
        fontSize:        '0.875rem',
        lineHeight:      1.5,
      }}>
        {banner.text}
      </div>
    );
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>
          My Profile
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Complete your information so the admin can verify and approve your account.
        </p>
      </div>

      {/* Status banner */}
      <StatusBanner />

      {/* Success/Error messages */}
      {success && (
        <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
          {success}
        </div>
      )}
      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.875rem', borderRadius: '0.75rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── SECTION 1: Basic Information ── */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
          <p style={sectionTitle}>Basic Information</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

            {/* ✅ FIXED: no manual error span inside — Field handles it */}
            <Field label="First Name" fieldKey="first_name" required>
              <input
                type="text"
                value={form.first_name}
                onChange={e => handleChange('first_name', e.target.value)}
                style={inputStyle(!!fieldErrors.first_name)}
              />
            </Field>

            {/* ✅ FIXED: no manual error span inside — Field handles it */}
            <Field label="Last Name" fieldKey="last_name" required>
              <input
                type="text"
                value={form.last_name}
                onChange={e => handleChange('last_name', e.target.value)}
                style={inputStyle(!!fieldErrors.last_name)}
              />
            </Field>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Middle Name</label>
              <input
                value={form.middle_name}
                onChange={e => handleChange('middle_name', e.target.value)}
                style={inputStyle(false)}
                placeholder="Optional"
              />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Suffix / Ext. Name</label>
              <input
                value={form.ext_name}
                onChange={e => handleChange('ext_name', e.target.value)}
                style={inputStyle(false)}
                placeholder="Jr., Sr., III, etc."
              />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Date of Birth <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={e => handleChange('date_of_birth', e.target.value)}
                style={inputStyle(!!fieldErrors.date_of_birth)}
              />
              {fieldErrors.date_of_birth && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', display: 'block', marginTop: '0.25rem' }}>
                  {fieldErrors.date_of_birth}
                </span>
              )}
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Gender <span style={{ color: '#dc2626' }}>*</span></label>
              <select
                value={form.gender}
                onChange={e => handleChange('gender', e.target.value)}
                style={inputStyle(!!fieldErrors.gender)}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              {fieldErrors.gender && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', display: 'block', marginTop: '0.25rem' }}>
                  {fieldErrors.gender}
                </span>
              )}
            </div>

          </div>
        </div>

        {/* ── SECTION 2: Contact Information ── */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
          <p style={sectionTitle}>Contact Information</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Contact Number <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                type="text"
                value={form.contact_number}
                onChange={e => handleChange('contact_number', e.target.value.replace(/\D/g, '').slice(0, 11))}
                style={inputStyle(!!fieldErrors.contact_number)}
                placeholder="09XXXXXXXXX"
                maxLength={11}
              />
              {fieldErrors.contact_number && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', display: 'block', marginTop: '0.25rem' }}>
                  {fieldErrors.contact_number}
                </span>
              )}
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                style={inputStyle(false)}
                placeholder="Optional"
              />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>RSBSA Number</label>
              <input
                value={form.rsbsa_number}
                onChange={e => handleChange('rsbsa_number', e.target.value)}
                style={inputStyle(false)}
                placeholder="e.g. 04-0432-000-0010"
              />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Barangay</label>
              <select
                value={form.barangay}
                onChange={e => handleChange('barangay', e.target.value)}
                style={inputStyle(false)}
              >
                <option value="">Select Barangay</option>
                {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

          </div>
        </div>

        {/* ── SECTION 3: Residency Address ── */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
          <p style={sectionTitle}>Residency Address</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Municipality <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                value={form.residency_municipality}
                onChange={e => handleChange('residency_municipality', e.target.value)}
                style={inputStyle(!!fieldErrors.residency_municipality)}
                placeholder="e.g. Lucban"
              />
              {fieldErrors.residency_municipality && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', display: 'block', marginTop: '0.25rem' }}>
                  {fieldErrors.residency_municipality}
                </span>
              )}
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Barangay <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                value={form.residency_barangay}
                onChange={e => handleChange('residency_barangay', e.target.value)}
                style={inputStyle(!!fieldErrors.residency_barangay)}
                placeholder="e.g. Abang"
              />
              {fieldErrors.residency_barangay && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', display: 'block', marginTop: '0.25rem' }}>
                  {fieldErrors.residency_barangay}
                </span>
              )}
            </div>

          </div>
        </div>

        {/* ── SECTION 4: Farm Location ── */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
          <p style={sectionTitle}>Farm Location</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Municipality <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                value={form.farm_municipality}
                onChange={e => handleChange('farm_municipality', e.target.value)}
                style={inputStyle(!!fieldErrors.farm_municipality)}
                placeholder="e.g. Lucban"
              />
              {fieldErrors.farm_municipality && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', display: 'block', marginTop: '0.25rem' }}>
                  {fieldErrors.farm_municipality}
                </span>
              )}
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Barangay <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                value={form.farm_barangay}
                onChange={e => handleChange('farm_barangay', e.target.value)}
                style={inputStyle(!!fieldErrors.farm_barangay)}
                placeholder="e.g. Ayuti"
              />
              {fieldErrors.farm_barangay && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', display: 'block', marginTop: '0.25rem' }}>
                  {fieldErrors.farm_barangay}
                </span>
              )}
            </div>

          </div>
        </div>

        {/* ── SECTION 5: Demographics ── */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <p style={sectionTitle}>Demographics</p>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
            Check all that apply to you:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
            {[
              { label: 'Indigenous Person (IP)',            key: 'ip' },
              { label: 'Senior Citizen',                    key: 'senior_citizen' },
              { label: 'Person with Disability (PWD)',      key: 'pwd' },
              { label: 'Agrarian Reform Beneficiary (ARB)', key: 'arbs' },
              { label: '4Ps Beneficiary',                   key: 'four_ps' },
            ].map(({ label, key }) => (
              <label key={key} style={{
                display:         'flex',
                alignItems:      'center',
                gap:             '0.625rem',
                padding:         '0.625rem 0.875rem',
                borderRadius:    '0.5rem',
                border:          `1.5px solid ${form[key] ? '#2d6a2d' : '#e5e7eb'}`,
                backgroundColor: form[key] ? '#f0fdf4' : 'white',
                cursor:          'pointer',
                fontSize:        '0.85rem',
                fontWeight:      form[key] ? '600' : '400',
                color:           form[key] ? '#2d6a2d' : '#374151',
                transition:      'all 0.15s',
              }}>
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={e => handleChange(key, e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* ── SUBMIT BUTTON ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
          {userStatus === 'PENDING' && (
            <p style={{ fontSize: '0.8rem', color: '#6b7280', textAlign: 'right', flex: 1 }}>
              Submitting will send your profile to the admin for approval.
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            style={{
              padding:         '0.75rem 2rem',
              backgroundColor: '#2d6a2d',
              color:           'white',
              border:          'none',
              borderRadius:    '0.5rem',
              fontWeight:      '700',
              fontSize:        '0.95rem',
              cursor:          saving ? 'not-allowed' : 'pointer',
              opacity:         saving ? 0.7 : 1,
              minWidth:        '180px',
              transition:      'opacity 0.15s',
            }}
          >
            {saving
              ? 'Saving...'
              : userStatus === 'PENDING' || userStatus === 'REJECTED'
                ? '📤 Submit Profile'
                : '💾 Update Profile'
            }
          </button>
        </div>

      </form>
    </div>
  );
};

export default FarmerProfile;
