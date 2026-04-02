// src/pages/farmer/FarmerDashboard.jsx
// Mobile-first home dashboard for Farmer

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CheckCircle, Clock, XCircle, AlertCircle, ChevronRight, Wheat, Megaphone, Sprout } from 'lucide-react';
import API from '../../api/axios';
import { getAnnouncements } from '../../api/axios';

const FarmerDashboard = () => {
  const { firstName } = useAuth();
  const navigate      = useNavigate();
  const [status, setStatus]     = useState(null);
  const [loading, setLoading]   = useState(true);

  const [announcements, setAnnouncements]     = useState([]);
  const [announcementsLoading, setAnnLoading] = useState(true);

  useEffect(() => {
    API.get('/farmer-profile/')
      .then(res => setStatus(res.data.user?.status || 'PENDING'))
      .catch(() => setStatus('PENDING'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
  // Only fetch if farmer is approved or complete
  if (status === 'APPROVED' || status === 'COMPLETE') {
    getAnnouncements({ limit: 3 })
      .then(res => setAnnouncements(res.data || []))
      .catch(() => {})
      .finally(() => setAnnLoading(false));
  } else {
    setAnnLoading(false);
  }
}, [status]);

  const statusConfig = {
    PENDING:  { icon: Clock,       color: '#854d0e', bg: '#fef9c3', label: 'Pending Review',    msg: 'Complete your profile to get started.' },
    COMPLETE: { icon: AlertCircle, color: '#1e40af', bg: '#dbeafe', label: 'Awaiting Approval',  msg: 'Your profile is under admin review.' },
    APPROVED: { icon: CheckCircle, color: '#166534', bg: '#dcfce7', label: 'Account Approved',   msg: 'You can now encode your harvest data.' },
    REJECTED: { icon: XCircle,     color: '#991b1b', bg: '#fee2e2', label: 'Application Rejected', msg: 'Contact the MAO office for assistance.' },
  };

  const s       = statusConfig[status] || statusConfig.PENDING;
  const StatusIcon = s.icon;

  const quickActions = [
    { label: 'View Announcements', icon: Megaphone, path: '/farmer/announcements', color: '#1e40af', bg: '#dbeafe' },
    { label: 'Vote on Seed Poll',  icon: Sprout,    path: '/farmer/poll',          color: '#166534', bg: '#dcfce7' },
    { label: 'Encode Harvest',     icon: Wheat,     path: '/farmer/harvest',       color: '#854d0e', bg: '#fef9c3' },
  ];

  return (
    <div style={{ padding: '1.25rem', paddingBottom: '1.5rem' }}>

      {/* Greeting */}
      <div style={{ marginBottom: '1.25rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Good day,</p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: '0.125rem 0 0' }}>
          {firstName || 'Farmer'} 👋
        </h1>
      </div>

      {/* Status card */}
      {!loading && (
        <div style={{
          backgroundColor: s.bg, borderRadius: '1rem',
          padding: '1rem 1.25rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.875rem',
        }}>
          <StatusIcon size={28} color={s.color} />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, color: s.color, margin: 0, fontSize: '0.9rem' }}>{s.label}</p>
            <p style={{ color: s.color, opacity: 0.8, margin: '0.125rem 0 0', fontSize: '0.8rem' }}>{s.msg}</p>
          </div>
          {status === 'PENDING' && (
            <button
              onClick={() => navigate('/farmer/profile')}
              style={{ backgroundColor: s.color, color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Complete
            </button>
          )}
        </div>
      )}

      {/* Quick actions */}
      <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
        Quick Actions
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
        {quickActions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.875rem 1rem',
                backgroundColor: 'white', borderRadius: '0.875rem',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                width: '100%', textAlign: 'left',
              }}
            >
              <div style={{ width: 42, height: 42, backgroundColor: action.bg, borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} color={action.color} />
              </div>
              <span style={{ flex: 1, fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{action.label}</span>
              <ChevronRight size={16} color="#9ca3af" />
            </button>
          );
        })}
      </div>
      {/* Updates & Reminders */}
<h2 style={{
  fontSize: '0.875rem',
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 0.75rem'
}}>
  Updates & Reminders
</h2>

<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
  {announcementsLoading ? (
    // Loading skeleton
    <div style={{
      backgroundColor: '#f3f4f6',
      borderRadius: '1rem',
      height: '80px'
    }} />
  ) : announcements.length === 0 ? (
    // Empty state
    <div style={{
      backgroundColor: 'white',
      borderRadius: '1rem',
      padding: '2rem 1.5rem',
      textAlign: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📢</div>
      <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>
        No announcements yet
      </p>
      <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
        Check back here for updates from your admin.
      </p>
    </div>
  ) : (
    announcements.map(ann => (
      <div
        key={ann.id}
        onClick={() => navigate(`/farmer/announcements/${ann.id}`, {
          state: { from: '/farmer' }
        })}
        style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '1rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          cursor: 'pointer'
        }}
      >
        <p style={{ fontWeight: 600, margin: '0 0 0.25rem', color: '#1a1a1a' }}>
          {ann.title}
        </p>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
          {ann.content?.slice(0, 80)}...
        </p>
      </div>
        ))
        )}
      </div>
      {/* Farmer info card */}
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 0.75rem' }}>My Account</h3>
        <button
          onClick={() => navigate('/farmer/profile')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.5rem 0', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid #f3f4f6' }}
        >
          <span style={{ fontSize: '0.875rem', color: '#374151' }}>View & Edit Profile</span>
          <ChevronRight size={16} color="#9ca3af" />
        </button>
      </div>
    </div>
  );
};

export default FarmerDashboard;