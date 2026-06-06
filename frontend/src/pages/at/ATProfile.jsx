// src/pages/at/ATProfile.jsx

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import API from '../../api/axios';
import {
  User, Mail, Phone, MapPin, Lock,
  CheckCircle, AlertCircle, Eye, EyeOff, Edit2, X,
} from 'lucide-react';

const AT_COLOR = '#1e4d35';
const AT_LIGHT = '#f0fdf4';
const AT_BORDER = '#bbf7d0';

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 600,
      backgroundColor: toast.type === 'success' ? AT_COLOR : '#991b1b',
      color: 'white', padding: '0.75rem 1.5rem',
      borderRadius: '0.875rem', fontWeight: 600,
      fontSize: '0.875rem', display: 'flex',
      alignItems: 'center', gap: '0.5rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      maxWidth: 'calc(100vw - 2rem)',
    }}>
      {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {toast.message}
    </div>
  );
};

const inp = (hasErr = false) => ({
  padding: '0.625rem 0.875rem',
  border: `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
  borderRadius: '0.625rem', fontSize: '0.875rem',
  width: '100%', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', backgroundColor: 'white',
});

const ATProfile = () => {
  const { firstName: authFirstName, lastName: authLastName } = useAuth();

  // ── Profile data ──
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Edit info state ──
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    first_name: '', last_name: '', email: '', contact_number: '',
  });
  const [infoErrors, setInfoErrors] = useState({});
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Change password state ──
  const [editingPassword, setEditingPassword] = useState(false);
  const [pwForm, setPwForm] = useState({
    current_password: '', new_password: '', confirm_password: '',
  });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);
  const [showPw, setShowPw] = useState({
    current: false, new: false, confirm: false,
  });

  // ── Toast ──
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch AT profile ──
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get('/accounts/at/profile/');
      setProfile(res.data);
      setInfoForm({
        first_name: res.data.first_name || '',
        last_name: res.data.last_name || '',
        email: res.data.email || '',
        contact_number: res.data.contact_number || '',
      });
    } catch {
      showToast('error', 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ── Save info ──
  const handleSaveInfo = async () => {
    const errs = {};
    if (!infoForm.first_name.trim()) errs.first_name = 'Required';
    if (!infoForm.last_name.trim()) errs.last_name = 'Required';
    if (!infoForm.contact_number.trim()) errs.contact_number = 'Required';
    else if (!/^\d{11}$/.test(infoForm.contact_number)) errs.contact_number = 'Must be 11 digits';
    if (Object.keys(errs).length > 0) { setInfoErrors(errs); return; }

    setSavingInfo(true);
    try {
      await API.put('/accounts/at/profile/', {
        first_name: infoForm.first_name,
        last_name: infoForm.last_name,
        email: infoForm.email,
        contact_number: infoForm.contact_number,
      });
      showToast('success', 'Profile updated successfully.');
      setEditingInfo(false);
      setInfoErrors({});
      await fetchProfile();
    } catch (err) {
      const data = err.response?.data;
      if (data?.contact_number) setInfoErrors({ contact_number: data.contact_number[0] });
      else if (data?.email) setInfoErrors({ email: data.email[0] });
      else showToast('error', data?.error || 'Failed to update profile.');
    } finally {
      setSavingInfo(false);
    }
  };

  // ── Change password ──
  const handleChangePassword = async () => {
    const errs = {};
    if (!pwForm.current_password) errs.current_password = 'Required';
    if (!pwForm.new_password) errs.new_password = 'Required';
    else if (pwForm.new_password.length < 6) errs.new_password = 'At least 6 characters';
    if (!pwForm.confirm_password) errs.confirm_password = 'Required';
    else if (pwForm.new_password !== pwForm.confirm_password) errs.confirm_password = 'Passwords do not match';
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }

    setSavingPw(true);
    try {
      await API.post('/accounts/change-password/', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      showToast('success', 'Password changed successfully.');
      setEditingPassword(false);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setPwErrors({});
    } catch (err) {
      const data = err.response?.data;
      if (data?.current_password) setPwErrors({ current_password: 'Incorrect current password.' });
      else showToast('error', data?.error || 'Failed to change password.');
    } finally {
      setSavingPw(false);
    }
  };

  const initials = `${infoForm.first_name?.[0] || ''}${infoForm.last_name?.[0] || ''}`.toUpperCase();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#9ca3af' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, border: `3px solid ${AT_BORDER}`, borderTopColor: AT_COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
      <Toast toast={toast} />
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>My Profile</h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
          Agricultural Technician — AGRICE Lucban
        </p>
      </div>

      {/* ── Avatar + Name card ── */}
      <div style={{
        backgroundColor: AT_COLOR, borderRadius: '1rem',
        padding: '1.5rem', marginBottom: '1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        animation: 'fadeIn 0.3s ease',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', fontWeight: 800, color: 'white', flexShrink: 0,
        }}>
          {initials || '?'}
        </div>
        <div>
          <p style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white', margin: 0 }}>
            {infoForm.first_name} {infoForm.last_name}
          </p>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', margin: '0.25rem 0 0' }}>
            Agricultural Technician
          </p>
          {profile?.assigned_barangays?.length > 0 && (
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', margin: '0.25rem 0 0' }}>
              {profile.assigned_barangays.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* ── Basic Info Card ── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        border: '1px solid #f3f4f6', marginBottom: '1.25rem',
        overflow: 'hidden', animation: 'fadeIn 0.3s ease',
      }}>
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a', margin: 0 }}>
            Basic Information
          </p>
          {!editingInfo ? (
            <button
              onClick={() => setEditingInfo(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.75rem', backgroundColor: AT_LIGHT,
                border: `1px solid ${AT_BORDER}`, borderRadius: '0.5rem',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: AT_COLOR,
              }}
            >
              <Edit2 size={13} /> Edit
            </button>
          ) : (
            <button
              onClick={() => { setEditingInfo(false); setInfoErrors({}); fetchProfile(); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ padding: '1.25rem' }}>
          {!editingInfo ? (
            // ── View mode ──
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                { icon: User,  label: 'Full Name',       value: `${profile?.first_name || ''} ${profile?.last_name || ''}` },
                { icon: Mail,  label: 'Email',           value: profile?.email || '—' },
                { icon: Phone, label: 'Contact Number',  value: profile?.contact_number || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{
                    width: 36, height: 36, backgroundColor: AT_LIGHT,
                    borderRadius: '0.625rem', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={16} color={AT_COLOR} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: '0.875rem', color: '#1a1a1a', fontWeight: 600, margin: '0.125rem 0 0' }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // ── Edit mode ──
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                    First Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    value={infoForm.first_name}
                    onChange={e => { setInfoForm(p => ({ ...p, first_name: e.target.value })); setInfoErrors(p => ({ ...p, first_name: '' })); }}
                    style={inp(!!infoErrors.first_name)}
                  />
                  {infoErrors.first_name && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.2rem 0 0' }}>{infoErrors.first_name}</p>}
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                    Last Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    value={infoForm.last_name}
                    onChange={e => { setInfoForm(p => ({ ...p, last_name: e.target.value })); setInfoErrors(p => ({ ...p, last_name: '' })); }}
                    style={inp(!!infoErrors.last_name)}
                  />
                  {infoErrors.last_name && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.2rem 0 0' }}>{infoErrors.last_name}</p>}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={infoForm.email}
                  onChange={e => { setInfoForm(p => ({ ...p, email: e.target.value })); setInfoErrors(p => ({ ...p, email: '' })); }}
                  style={inp(!!infoErrors.email)}
                />
                {infoErrors.email && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.2rem 0 0' }}>{infoErrors.email}</p>}
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                  Contact Number <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  value={infoForm.contact_number}
                  onChange={e => { setInfoForm(p => ({ ...p, contact_number: e.target.value })); setInfoErrors(p => ({ ...p, contact_number: '' })); }}
                  placeholder="09XXXXXXXXX"
                  style={inp(!!infoErrors.contact_number)}
                />
                {infoErrors.contact_number && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.2rem 0 0' }}>{infoErrors.contact_number}</p>}
              </div>
              <button
                onClick={handleSaveInfo}
                disabled={savingInfo}
                style={{
                  width: '100%', padding: '0.75rem',
                  backgroundColor: savingInfo ? '#d1d5db' : AT_COLOR,
                  color: 'white', border: 'none', borderRadius: '0.75rem',
                  fontWeight: 700, fontSize: '0.875rem',
                  cursor: savingInfo ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                <CheckCircle size={16} />
                {savingInfo ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Assigned Barangays (read-only) ── */}
      {profile?.assigned_barangays?.length > 0 && (
        <div style={{
          backgroundColor: 'white', borderRadius: '1rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          border: '1px solid #f3f4f6', marginBottom: '1.25rem',
          overflow: 'hidden', animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={16} color={AT_COLOR} />
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a', margin: 0 }}>
              Assigned Barangays
            </p>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '0.1rem 0.5rem', borderRadius: '999px' }}>
              Assigned by Admin
            </span>
          </div>
          <div style={{ padding: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {profile.assigned_barangays.map(brgy => (
              <span key={brgy} style={{
                backgroundColor: AT_LIGHT, color: AT_COLOR,
                padding: '0.25rem 0.875rem', borderRadius: '999px',
                fontSize: '0.78rem', fontWeight: 600,
                border: `1px solid ${AT_BORDER}`,
              }}>
                {brgy}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Change Password Card ── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        border: '1px solid #f3f4f6',
        overflow: 'hidden', animation: 'fadeIn 0.3s ease',
      }}>
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={16} color={AT_COLOR} />
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a', margin: 0 }}>
              Change Password
            </p>
          </div>
          {!editingPassword ? (
            <button
              onClick={() => setEditingPassword(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.75rem', backgroundColor: AT_LIGHT,
                border: `1px solid ${AT_BORDER}`, borderRadius: '0.5rem',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: AT_COLOR,
              }}
            >
              <Edit2 size={13} /> Change
            </button>
          ) : (
            <button
              onClick={() => { setEditingPassword(false); setPwErrors({}); setPwForm({ current_password: '', new_password: '', confirm_password: '' }); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {editingPassword && (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', animation: 'fadeIn 0.2s ease' }}>
            {[
              { key: 'current_password', label: 'Current Password', show: showPw.current, toggle: () => setShowPw(p => ({ ...p, current: !p.current })) },
              { key: 'new_password',     label: 'New Password',     show: showPw.new,     toggle: () => setShowPw(p => ({ ...p, new: !p.new })) },
              { key: 'confirm_password', label: 'Confirm New Password', show: showPw.confirm, toggle: () => setShowPw(p => ({ ...p, confirm: !p.confirm })) },
            ].map(({ key, label, show, toggle }) => (
              <div key={key}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                  {label} <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show ? 'text' : 'password'}
                    value={pwForm[key]}
                    onChange={e => { setPwForm(p => ({ ...p, [key]: e.target.value })); setPwErrors(p => ({ ...p, [key]: '' })); }}
                    style={{ ...inp(!!pwErrors[key]), paddingRight: '2.75rem' }}
                  />
                  <button
                    type="button"
                    onClick={toggle}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwErrors[key] && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.2rem 0 0' }}>{pwErrors[key]}</p>}
              </div>
            ))}
            <button
              onClick={handleChangePassword}
              disabled={savingPw}
              style={{
                width: '100%', padding: '0.75rem',
                backgroundColor: savingPw ? '#d1d5db' : AT_COLOR,
                color: 'white', border: 'none', borderRadius: '0.75rem',
                fontWeight: 700, fontSize: '0.875rem',
                cursor: savingPw ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              <Lock size={16} />
              {savingPw ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        )}

        {!editingPassword && (
          <div style={{ padding: '1rem 1.25rem' }}>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>
              Keep your account secure by using a strong password.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ATProfile;