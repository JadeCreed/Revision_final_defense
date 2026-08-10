// src/pages/admin/AdminProfile.jsx

import { useState, useEffect, useCallback } from 'react';
import API from '../../api/axios';
import {
  User, Mail, Phone, Shield, Lock,
  CheckCircle, AlertCircle, Eye, EyeOff, Edit2, X,
} from 'lucide-react';



const AD_COLOR  = '#1a1a2e';
const AD_LIGHT  = '#f8fafc';
const AD_BORDER = '#e2e8f0';
const AD_ACCENT = '#2d6a2d';

const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 600,
      backgroundColor: toast.type === 'success' ? AD_ACCENT : '#991b1b',
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

const AdminProfile = () => {
  const [profile, setProfile]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [editingInfo, setEditingInfo]   = useState(false);
  const [infoForm, setInfoForm]         = useState({
    first_name: '', last_name: '', email: '', contact_number: '',
  });
  const [infoErrors, setInfoErrors]     = useState({});
  const [savingInfo, setSavingInfo]     = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [pwForm, setPwForm]             = useState({
    current_password: '', new_password: '', confirm_password: '',
  });
  const [pwErrors, setPwErrors]         = useState({});
  const [savingPw, setSavingPw]         = useState(false);
  const [showPw, setShowPw]             = useState({ current: false, new: false, confirm: false });
  const [toast, setToast]               = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get('/accounts/admin/profile/');
      setProfile(res.data);
      setInfoForm({
        first_name:     res.data.first_name     || '',
        last_name:      res.data.last_name      || '',
        email:          res.data.email          || '',
        contact_number: res.data.contact_number || '',
      });
    } catch {
      showToast('error', 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSaveInfo = async () => {
    const errs = {};
    if (!infoForm.first_name.trim())     errs.first_name     = 'Required';
    if (!infoForm.last_name.trim())      errs.last_name      = 'Required';
    if (!infoForm.contact_number.trim()) errs.contact_number = 'Required';
    else if (!/^\d{11}$/.test(infoForm.contact_number))
      errs.contact_number = 'Must be 11 digits';
    if (Object.keys(errs).length > 0) { setInfoErrors(errs); return; }

    setSavingInfo(true);
    try {
      await API.put('/accounts/admin/profile/', {
        first_name:     infoForm.first_name,
        last_name:      infoForm.last_name,
        email:          infoForm.email,
        contact_number: infoForm.contact_number,
      });
      showToast('success', 'Profile updated successfully.');
      setEditingInfo(false);
      setInfoErrors({});
      await fetchProfile();
    } catch (err) {
      const data = err.response?.data;
      if (data?.contact_number) setInfoErrors({ contact_number: data.contact_number[0] });
      else if (data?.email)     setInfoErrors({ email: data.email[0] });
      else showToast('error', data?.error || 'Failed to update profile.');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangePassword = async () => {
    const errs = {};
    if (!pwForm.current_password)  errs.current_password = 'Required';
    if (!pwForm.new_password)      errs.new_password     = 'Required';
    else if (pwForm.new_password.length < 6)
      errs.new_password = 'At least 6 characters';
    if (!pwForm.confirm_password)  errs.confirm_password = 'Required';
    else if (pwForm.new_password !== pwForm.confirm_password)
      errs.confirm_password = 'Passwords do not match';
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }

    setSavingPw(true);
    try {
      await API.post('/accounts/change-password/', {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      });
      showToast('success', 'Password changed successfully.');
      setEditingPassword(false);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setPwErrors({});
    } catch (err) {
      const data = err.response?.data;
      if (data?.current_password)
        setPwErrors({ current_password: 'Incorrect current password.' });
      else showToast('error', data?.error || 'Failed to change password.');
    } finally {
      setSavingPw(false);
    }
  };

  const initials = `${infoForm.first_name?.[0] || ''}${infoForm.last_name?.[0] || ''}`.toUpperCase();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: AD_ACCENT, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '640px' }}>
      <Toast toast={toast} />
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>My Profile</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          System Administrator — AGRICE Lucban
        </p>
      </div>

      {/* Avatar card */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #2d4d1a 100%)',
        borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        animation: 'fadeIn 0.3s ease',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', fontWeight: 800, color: 'white', flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.3)',
        }}>
          {initials || '?'}
        </div>
        <div>
          <p style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white', margin: 0 }}>
            {infoForm.first_name} {infoForm.last_name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
            <Shield size={12} color="rgba(255,255,255,0.7)" />
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              System Administrator
            </p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div style={{
        backgroundColor: 'white', borderRadius: '0.875rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #e5e7eb', marginBottom: '1rem',
        overflow: 'hidden', animation: 'fadeIn 0.3s ease',
      }}>
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <p style={{ fontWeight: 600, fontSize: '0.95rem', color: '#111827', margin: 0 }}>
            Basic Information
          </p>
          {!editingInfo ? (
            <button onClick={() => setEditingInfo(true)} style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.375rem 0.75rem', backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb', borderRadius: '0.5rem',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#374151',
            }}>
              <Edit2 size={13} /> Edit
            </button>
          ) : (
            <button onClick={() => { setEditingInfo(false); setInfoErrors({}); fetchProfile(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ padding: '1.25rem' }}>
          {!editingInfo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                { icon: User,  label: 'Full Name',      value: `${profile?.first_name || ''} ${profile?.last_name || ''}` },
                { icon: Mail,  label: 'Email',          value: profile?.email || '—' },
                { icon: Phone, label: 'Contact Number', value: profile?.contact_number || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{
                    width: 36, height: 36, backgroundColor: '#f3f4f6',
                    borderRadius: '0.625rem', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={16} color="#374151" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600, margin: '0.125rem 0 0' }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { key: 'first_name', label: 'First Name', required: true },
                  { key: 'last_name',  label: 'Last Name',  required: true },
                ].map(({ key, label, required }) => (
                  <div key={key}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                      {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
                    </label>
                    <input value={infoForm[key]}
                      onChange={e => { setInfoForm(p => ({ ...p, [key]: e.target.value })); setInfoErrors(p => ({ ...p, [key]: '' })); }}
                      style={inp(!!infoErrors[key])} />
                    {infoErrors[key] && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.2rem 0 0' }}>{infoErrors[key]}</p>}
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Email</label>
                <input type="email" value={infoForm.email}
                  onChange={e => { setInfoForm(p => ({ ...p, email: e.target.value })); setInfoErrors(p => ({ ...p, email: '' })); }}
                  style={inp(!!infoErrors.email)} />
                {infoErrors.email && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.2rem 0 0' }}>{infoErrors.email}</p>}
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                  Contact Number <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input value={infoForm.contact_number} placeholder="09XXXXXXXXX"
                  onChange={e => { setInfoForm(p => ({ ...p, contact_number: e.target.value })); setInfoErrors(p => ({ ...p, contact_number: '' })); }}
                  style={inp(!!infoErrors.contact_number)} />
                {infoErrors.contact_number && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.2rem 0 0' }}>{infoErrors.contact_number}</p>}
              </div>
              <button onClick={handleSaveInfo} disabled={savingInfo} style={{
                width: '100%', padding: '0.75rem',
                backgroundColor: savingInfo ? '#d1d5db' : AD_ACCENT,
                color: 'white', border: 'none', borderRadius: '0.75rem',
                fontWeight: 700, fontSize: '0.875rem',
                cursor: savingInfo ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}>
                <CheckCircle size={16} />
                {savingInfo ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div style={{
        backgroundColor: 'white', borderRadius: '0.875rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden', animation: 'fadeIn 0.3s ease',
      }}>
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={16} color="#374151" />
            <p style={{ fontWeight: 600, fontSize: '0.95rem', color: '#111827', margin: 0 }}>Change Password</p>
          </div>
          {!editingPassword ? (
            <button onClick={() => setEditingPassword(true)} style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.375rem 0.75rem', backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb', borderRadius: '0.5rem',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#374151',
            }}>
              <Edit2 size={13} /> Change
            </button>
          ) : (
            <button onClick={() => { setEditingPassword(false); setPwErrors({}); setPwForm({ current_password: '', new_password: '', confirm_password: '' }); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X size={18} />
            </button>
          )}
        </div>

        {editingPassword && (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', animation: 'fadeIn 0.2s ease' }}>
            {[
              { key: 'current_password', label: 'Current Password',     showKey: 'current' },
              { key: 'new_password',     label: 'New Password',         showKey: 'new'     },
              { key: 'confirm_password', label: 'Confirm New Password', showKey: 'confirm' },
            ].map(({ key, label, showKey }) => (
              <div key={key}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                  {label} <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw[showKey] ? 'text' : 'password'}
                    value={pwForm[key]}
                    onChange={e => { setPwForm(p => ({ ...p, [key]: e.target.value })); setPwErrors(p => ({ ...p, [key]: '' })); }}
                    style={{ ...inp(!!pwErrors[key]), paddingRight: '2.75rem' }}
                  />
                  <button type="button"
                    onClick={() => setShowPw(p => ({ ...p, [showKey]: !p[showKey] }))}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                    {showPw[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwErrors[key] && <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: '0.2rem 0 0' }}>{pwErrors[key]}</p>}
              </div>
            ))}
            <button onClick={handleChangePassword} disabled={savingPw} style={{
              width: '100%', padding: '0.75rem',
              backgroundColor: savingPw ? '#d1d5db' : AD_ACCENT,
              color: 'white', border: 'none', borderRadius: '0.75rem',
              fontWeight: 700, fontSize: '0.875rem',
              cursor: savingPw ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}>
              <Lock size={16} />
              {savingPw ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        )}

        {!editingPassword && (
          <div style={{ padding: '1rem 1.25rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
              Keep your account secure by using a strong password.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProfile;