// src/pages/farmer/FarmerProfile.jsx
// ============================================================
// Farmer profile page.
// Pre-fills from registration data on first load.
// Submit → sends to admin for approval.
// After approval → button changes to "Update Profile".
// Icons: lucide-react only (no emojis in UI elements).
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  User, Phone, MapPin, FileText,
  CheckCircle, Clock, AlertCircle,
  XCircle, Save, Send, ChevronRight,
} from 'lucide-react';
import API from '../../api/axios';

const BARANGAYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan'
];

// ── LABEL STYLE (constant — defined outside prevents recreation) ──
const labelStyle = {
  fontSize:     '0.8rem',
  fontWeight:   '600',
  color:        '#374151',
  marginBottom: '0.25rem',
  display:      'block',
};

// ── FIELD COMPONENT ──
// MUST be defined OUTSIDE FarmerProfile.
// If defined inside, React recreates it on every render,
// unmounting/remounting the input and losing keyboard focus.
const Field = ({ label, required, error, children }) => (
  <div style={{ marginBottom: '0.75rem' }}>
    <label style={labelStyle}>
      {label}
      {required && <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>}
    </label>
    {children}
    {error && (
      <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem', display: 'block' }}>
        {error}
      </span>
    )}
  </div>
);

// ── SECTION WRAPPER ──
// Also outside to prevent recreation
const Section = ({ icon: Icon, title, children }) => (
  <div style={{
    backgroundColor: 'white',
    borderRadius:    '0.875rem',
    padding:         '1.5rem',
    boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
    marginBottom:    '1rem',
  }}>
    <p style={{
      fontSize:      '0.75rem',
      fontWeight:    '700',
      color:         '#2d6a2d',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom:  '1rem',
      paddingBottom: '0.5rem',
      borderBottom:  '1px solid #e5e7eb',
      display:       'flex',
      alignItems:    'center',
      gap:           '0.5rem',
      margin:        '0 0 1rem',
    }}>
      <Icon size={15} />
      {title}
    </p>
    {children}
  </div>
);

// ── MAIN COMPONENT ──
const FarmerProfile = () => {

  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [userStatus, setUserStatus]   = useState('PENDING');
  const [fieldErrors, setFieldErrors] = useState({});

  // Inline confirmation state — shown before first-time submit
  // Gives user a chance to review before sending to admin
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    // User model fields (pre-filled from registration)
    first_name:     '',
    last_name:      '',
    email:          '',
    contact_number: '',
    barangay:       '',
    rsbsa_number:   '',
    // FarmerProfile fields (filled here)
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

  // ── INPUT STYLE (function, stable since it's defined in component scope correctly) ──
  const inputStyle = (hasError) => ({
    padding:      '0.625rem 0.875rem',
    border:       `1.5px solid ${hasError ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem',
    fontSize:     '0.9rem',
    width:        '100%',
    outline:      'none',
    transition:   'border-color 0.15s',
    boxSizing:    'border-box',
    fontFamily:   'inherit',
    backgroundColor: 'white',
  });

  // ── LOAD PROFILE ──
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get('/accounts/farmer-profile/');
      const { user, profile } = res.data;

      setUserStatus(user.status || 'PENDING');

      setForm({
        // Pre-fill from User model (registration data)
        first_name:     user.first_name     || '',
        last_name:      user.last_name      || '',
        email:          user.email          || '',
        contact_number: user.contact_number || '',
        barangay:       user.barangay       || '',
        rsbsa_number:   user.rsbsa_number   || '',
        // FarmerProfile fields
        middle_name:            profile.middle_name            || '',
        ext_name:               profile.ext_name               || '',
        date_of_birth:          profile.date_of_birth          || '',
        gender:                 profile.gender                 || '',
        residency_municipality: profile.residency_municipality || '',
        residency_barangay:     profile.residency_barangay     || '',
        farm_municipality:      profile.farm_municipality      || '',
        farm_barangay:          profile.farm_barangay          || '',
        ip:             profile.ip             ?? false,
        senior_citizen: profile.senior_citizen ?? false,
        pwd:            profile.pwd            ?? false,
        arbs:           profile.arbs           ?? false,
        four_ps:        profile.four_ps        ?? false,
      });
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'Access denied. Please log in as a farmer.'
          : 'Failed to load your profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Reload when user returns to the tab
  useEffect(() => {
    const handleFocus = () => loadProfile();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadProfile]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key]: '' }));
    setError('');
    setSuccess('');
  };

  // ── VALIDATE ──
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

  // ── HANDLE SUBMIT BUTTON CLICK ──
  // For PENDING: validate first, then show confirmation
  // For APPROVED: save directly without confirmation
  const handleSubmitClick = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please fill in all required fields before submitting.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If APPROVED → save directly (no confirmation needed for updates)
    if (userStatus === 'APPROVED') {
      doSave();
      return;
    }

    // If PENDING or COMPLETE → show inline confirmation card
    setShowConfirm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── ACTUAL SAVE ──
  // Called after confirmation (or directly for APPROVED updates)
  const doSave = async () => {
    setSaving(true);
    setShowConfirm(false);
    setError('');
    setSuccess('');

    try {
      await API.put('/accounts/farmer-profile/', {
        // Backend FarmerProfileView.put() reads request.data["user"] and request.data["profile"]
        user: {
          first_name:     form.first_name,
          last_name:      form.last_name,
          email:          form.email || null,
          contact_number: form.contact_number,
          barangay:       form.barangay,
          rsbsa_number:   form.rsbsa_number,
        },
        profile: {
          middle_name:            form.middle_name,
          ext_name:               form.ext_name,
          date_of_birth:          form.date_of_birth,
          gender:                 form.gender,
          residency_municipality: form.residency_municipality,
          residency_barangay:     form.residency_barangay,
          farm_municipality:      form.farm_municipality,
          farm_barangay:          form.farm_barangay,
          contact_number:     form.contact_number,
          ip:                 form.ip,
          senior_citizen:     form.senior_citizen,
          pwd:                form.pwd,
          arbs:               form.arbs,
          four_ps:            form.four_ps,
        },
      });

      // Re-fetch to get the latest status from server
      const refreshed = await API.get('/accounts/farmer-profile/');
      const newStatus = refreshed.data.user.status;
      setUserStatus(newStatus);

      if (newStatus === 'COMPLETE') {
        setSuccess('Profile submitted! The admin will review your information soon.');
      } else if (newStatus === 'APPROVED') {
        setSuccess('Profile updated successfully!');
      } else if (newStatus === 'PENDING') {
        // This should only show if profile is truly incomplete (missing required fields)
        // After the backend fix, this should NOT appear when all fields are filled
        setSuccess('Profile partially saved. Please fill all required fields and submit again.');
      } else {
        setSuccess('Profile saved.');
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const flatErrs = {};
        Object.entries(data).forEach(([k, v]) => {
          flatErrs[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setFieldErrors(flatErrs);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setError('Failed to save profile. Please check the highlighted fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── STATUS BANNER CONFIG ──
  const statusBanners = {
    PENDING: {
      bg: '#fef9c3', color: '#854d0e', border: '#fde047',
      Icon: Clock,
      text: 'Your account is pending. Complete and submit your profile below for admin approval.',
    },
    COMPLETE: {
      bg: '#dbeafe', color: '#1e40af', border: '#93c5fd',
      Icon: FileText,
      text: 'Your profile has been submitted and is awaiting admin review.',
    },
    APPROVED: {
      bg: '#dcfce7', color: '#166534', border: '#86efac',
      Icon: CheckCircle,
      text: 'Your account is approved. You can update your information anytime.',
    },
    REJECTED: {
      bg: '#fee2e2', color: '#991b1b', border: '#fca5a5',
      Icon: XCircle,
      text: 'Your account was not approved. Please contact the MAO office for assistance.',
    },
  };
  const banner = statusBanners[userStatus];

  // ── LOADING ──
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Clock size={32} color="#d1d5db" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.25rem', paddingBottom: '2rem' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          My Profile
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          Complete your information so the admin can verify and approve your account.
        </p>
      </div>

      {/* ── STATUS BANNER ── */}
      {banner && (
        <div style={{
          backgroundColor: banner.bg,
          color:           banner.color,
          border:          `1px solid ${banner.border}`,
          borderRadius:    '0.875rem',
          padding:         '0.875rem 1.25rem',
          marginBottom:    '1.25rem',
          fontSize:        '0.875rem',
          lineHeight:      1.5,
          display:         'flex',
          alignItems:      'flex-start',
          gap:             '0.75rem',
        }}>
          <banner.Icon size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{banner.text}</span>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {success && (
        <div style={{
          backgroundColor: '#dcfce7', color: '#166534',
          border: '1px solid #bbf7d0',
          padding: '0.875rem 1.25rem', borderRadius: '0.875rem',
          marginBottom: '1.25rem', fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          {success}
        </div>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2', color: '#991b1b',
          border: '1px solid #fca5a5',
          padding: '0.875rem 1.25rem', borderRadius: '0.875rem',
          marginBottom: '1.25rem', fontSize: '0.875rem',
          display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          {error}
        </div>
      )}

      {/* ── INLINE CONFIRMATION CARD ──
          Shows before first-time profile submission.
          Mobile-friendly — no browser confirm() dialog.
          Only appears for PENDING or COMPLETE status. */}
      {showConfirm && (
        <div style={{
          backgroundColor: 'white',
          border:          '2px solid #2d6a2d',
          borderRadius:    '1rem',
          padding:         '1.5rem',
          marginBottom:    '1.25rem',
          boxShadow:       '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: '40px', height: '40px',
              backgroundColor: '#f0fdf4',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Send size={20} color="#2d6a2d" />
            </div>
            <div>
              <p style={{ fontWeight: 700, color: '#1a1a1a', margin: 0, fontSize: '1rem' }}>
                Submit profile for approval?
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.125rem 0 0' }}>
                Your information will be sent to the MAO admin for review.
              </p>
            </div>
          </div>

          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius:    '0.75rem',
            padding:         '0.875rem',
            marginBottom:    '1.25rem',
            fontSize:        '0.8rem',
            color:           '#374151',
          }}>
            <p style={{ fontWeight: 600, margin: '0 0 0.375rem', color: '#1a1a1a' }}>
              What happens next:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {[
                'Your profile is submitted to the admin for review',
                'Admin will verify your information and RSBSA number',
                'You will see your status change to "Approved" once verified',
                'Approved farmers can access the full AGRICE system',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span style={{
                    width:           '18px',
                    height:          '18px',
                    backgroundColor: '#2d6a2d',
                    color:           'white',
                    borderRadius:    '50%',
                    fontSize:        '0.65rem',
                    fontWeight:      700,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    flexShrink:      0,
                    marginTop:       '1px',
                  }}>
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setShowConfirm(false)}
              style={{
                flex:            1,
                padding:         '0.75rem',
                backgroundColor: 'white',
                color:           '#374151',
                border:          '1.5px solid #d1d5db',
                borderRadius:    '0.5rem',
                fontWeight:      600,
                fontSize:        '0.9rem',
                cursor:          'pointer',
              }}
            >
              Review Again
            </button>
            <button
              onClick={doSave}
              disabled={saving}
              style={{
                flex:            2,
                padding:         '0.75rem',
                backgroundColor: '#2d6a2d',
                color:           'white',
                border:          'none',
                borderRadius:    '0.5rem',
                fontWeight:      700,
                fontSize:        '0.9rem',
                cursor:          saving ? 'not-allowed' : 'pointer',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                gap:             '0.5rem',
                opacity:         saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <><Clock size={16} /> Submitting...</>
              ) : (
                <><Send size={16} /> Yes, Submit Profile</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════
          FORM SECTIONS
      ════════════════════════════ */}
      <form onSubmit={handleSubmitClick}>

        {/* SECTION 1: Basic Information */}
        <Section icon={User} title="Basic Information">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

            <Field label="First Name" required error={fieldErrors.first_name}>
              <input
                type="text"
                value={form.first_name}
                onChange={e => handleChange('first_name', e.target.value)}
                style={inputStyle(!!fieldErrors.first_name)}
                placeholder="Juan"
              />
            </Field>

            <Field label="Last Name" required error={fieldErrors.last_name}>
              <input
                type="text"
                value={form.last_name}
                onChange={e => handleChange('last_name', e.target.value)}
                style={inputStyle(!!fieldErrors.last_name)}
                placeholder="Dela Cruz"
              />
            </Field>

            <Field label="Middle Name" error={fieldErrors.middle_name}>
              <input
                type="text"
                value={form.middle_name}
                onChange={e => handleChange('middle_name', e.target.value)}
                style={inputStyle(false)}
                placeholder="Optional"
              />
            </Field>

            <Field label="Suffix / Ext. Name" error={fieldErrors.ext_name}>
              <input
                type="text"
                value={form.ext_name}
                onChange={e => handleChange('ext_name', e.target.value)}
                style={inputStyle(false)}
                placeholder="Jr., Sr., III, etc."
              />
            </Field>

            <Field label="Date of Birth" required error={fieldErrors.date_of_birth}>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={e => handleChange('date_of_birth', e.target.value)}
                style={inputStyle(!!fieldErrors.date_of_birth)}
              />
            </Field>

            <Field label="Gender" required error={fieldErrors.gender}>
              <select
                value={form.gender}
                onChange={e => handleChange('gender', e.target.value)}
                style={inputStyle(!!fieldErrors.gender)}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </Field>

          </div>
        </Section>

        {/* SECTION 2: Contact Information */}
        <Section icon={Phone} title="Contact Information">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

            <Field label="Contact Number" required error={fieldErrors.contact_number}>
              <input
                type="text"
                value={form.contact_number}
                onChange={e => handleChange('contact_number', e.target.value.replace(/\D/g, '').slice(0, 11))}
                style={inputStyle(!!fieldErrors.contact_number)}
                placeholder="09XXXXXXXXX"
                maxLength={11}
              />
            </Field>

            <Field label="Email Address" error={fieldErrors.email}>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                style={inputStyle(false)}
                placeholder="Optional"
              />
            </Field>

            <Field label="RSBSA Number" error={fieldErrors.rsbsa_number}>
              <input
                value={form.rsbsa_number}
                onChange={e => handleChange('rsbsa_number', e.target.value)}
                style={inputStyle(false)}
                placeholder="e.g. 04-0432-000-0010"
              />
            </Field>

            <Field label="Barangay" error={fieldErrors.barangay}>
              <select
                value={form.barangay}
                onChange={e => handleChange('barangay', e.target.value)}
                style={inputStyle(false)}
              >
                <option value="">Select Barangay</option>
                {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>

          </div>
        </Section>

        {/* SECTION 3: Residency Address */}
        <Section icon={MapPin} title="Residency Address">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

            <Field label="Municipality" required error={fieldErrors.residency_municipality}>
              <input
                value={form.residency_municipality}
                onChange={e => handleChange('residency_municipality', e.target.value)}
                style={inputStyle(!!fieldErrors.residency_municipality)}
                placeholder="e.g. Lucban"
              />
            </Field>

            <Field label="Barangay" required error={fieldErrors.residency_barangay}>
              <input
                value={form.residency_barangay}
                onChange={e => handleChange('residency_barangay', e.target.value)}
                style={inputStyle(!!fieldErrors.residency_barangay)}
                placeholder="e.g. Abang"
              />
            </Field>

          </div>
        </Section>

        {/* SECTION 4: Farm Location */}
        <Section icon={MapPin} title="Farm Location">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

            <Field label="Municipality" required error={fieldErrors.farm_municipality}>
              <input
                value={form.farm_municipality}
                onChange={e => handleChange('farm_municipality', e.target.value)}
                style={inputStyle(!!fieldErrors.farm_municipality)}
                placeholder="e.g. Lucban"
              />
            </Field>

            <Field label="Barangay" required error={fieldErrors.farm_barangay}>
              <input
                value={form.farm_barangay}
                onChange={e => handleChange('farm_barangay', e.target.value)}
                style={inputStyle(!!fieldErrors.farm_barangay)}
                placeholder="e.g. Ayuti"
              />
            </Field>

          </div>
        </Section>

        {/* SECTION 5: Demographics */}
        <Section icon={FileText} title="Demographics">
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem', marginTop: 0 }}>
            Check all that apply to you:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
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
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2d6a2d' }}
                />
                {label}
              </label>
            ))}
          </div>
        </Section>

        {/* ── SUBMIT / UPDATE BUTTON ── */}
        {!showConfirm && (
          <div style={{ marginTop: '1.5rem' }}>
            {/* Helper text for pending users */}
            {(userStatus === 'PENDING' || userStatus === 'COMPLETE') && (
              <div style={{
                backgroundColor: '#f9fafb',
                border:          '1px solid #e5e7eb',
                borderRadius:    '0.75rem',
                padding:         '0.875rem 1.25rem',
                marginBottom:    '1rem',
                fontSize:        '0.8rem',
                color:           '#374151',
                display:         'flex',
                alignItems:      'center',
                gap:             '0.625rem',
              }}>
                <AlertCircle size={16} color="#6b7280" style={{ flexShrink: 0 }} />
                {userStatus === 'PENDING'
                  ? 'All required fields must be filled before you can submit for admin approval.'
                  : 'Your profile is under review. You can still edit and resubmit.'
                }
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                width:           '100%',
                padding:         '0.875rem',
                backgroundColor: '#2d6a2d',
                color:           'white',
                border:          'none',
                borderRadius:    '0.75rem',
                fontWeight:      700,
                fontSize:        '1rem',
                cursor:          saving ? 'not-allowed' : 'pointer',
                opacity:         saving ? 0.7 : 1,
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                gap:             '0.5rem',
                transition:      'opacity 0.15s',
              }}
            >
              {saving ? (
                <><Clock size={18} /> Saving...</>
              ) : userStatus === 'APPROVED' ? (
                <><Save size={18} /> Update Profile</>
              ) : (
                <><Send size={18} /> Submit Profile</>
              )}
            </button>
          </div>
        )}

      </form>
    </div>
  );
};

export default FarmerProfile;