// src/layouts/DashboardLayout.jsx
// ============================================================
// Layout wrapper for ALL dashboard pages (Admin, Farmer, AT, BRGY)
// 
// STRUCTURE:
//   [Sidebar - fixed left 240px] | [TopHeader + PageContent]
//   On mobile: Sidebar hidden, BottomNav shown at bottom
//
// IMPORTANT: Sidebar and TopHeader NEVER unmount when navigating.
// Only <Outlet /> (the page content) changes on route change.
// ============================================================

import { Outlet } from 'react-router-dom';
import { Bell, Sprout, CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import Sidebar from '../components/navigation/Sidebar';
import BottomNav from '../components/navigation/BottomNav';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../components/navigation/MenuConfig';
import { getGisActivePoll } from '../api/axios';

const SEASON_CONFIG = {
  OPEN:   { bg: '#f0fdf4', border: '#bbf7d0', iconBg: '#dcfce7', dot: '#16a34a', text: '#166534' },
  LOCKED: { bg: '#fefce8', border: '#fde68a', iconBg: '#fef9c3', dot: '#d97706', text: '#92400e' },
  CLOSED: { bg: '#f0fdf4', border: '#bbf7d0', iconBg: '#dcfce7', dot: '#16a34a', text: '#166534' },
};
const FALLBACK_CONFIG = { bg: '#f9fafb', border: '#e5e7eb', iconBg: '#f3f4f6', dot: '#d1d5db', text: '#9ca3af' };

const ActiveSeasonBadge = ({ poll, loading }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.9rem 0.4rem 0.4rem', backgroundColor: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: '0.75rem' }}>
        <div style={{ width: 32, height: 32, borderRadius: '0.5rem', backgroundColor: '#e5e7eb', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ width: 40, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' }} />
          <div style={{ width: 110, height: 13, borderRadius: 4, backgroundColor: '#e5e7eb' }} />
        </div>
      </div>
    );
  }

  const status = poll?.status || null;
  const cfg = SEASON_CONFIG[status] || FALLBACK_CONFIG;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 1rem 0.4rem 0.4rem', backgroundColor: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: '0.75rem', flexShrink: 0, transition: 'all 0.2s ease' }}>
      <div style={{ width: 32, height: 32, borderRadius: '0.5rem', backgroundColor: cfg.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {poll ? <Sprout size={16} color={cfg.text} strokeWidth={2.5} /> : <CalendarDays size={16} color={cfg.text} strokeWidth={2.5} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: cfg.text, opacity: 0.65, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{poll ? poll.season_display : 'No Season'}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 800, color: cfg.text, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{poll ? poll.year : '—'}</span>
      </div>
      {status === 'OPEN' && (
        <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: cfg.dot, opacity: 0.35, animation: 'seasonPing 1.6s ease-in-out infinite' }} />
          <span style={{ position: 'absolute', inset: '1px', borderRadius: '50%', backgroundColor: cfg.dot }} />
        </div>
      )}
    </div>
  );
};

const DashboardLayout = () => {
  const { firstName, lastName, role } = useAuth();
  const roleLabel = ROLE_LABELS[role] || role;
  const [activePoll, setActivePoll] = useState(null);
  const [pollLoading, setPollLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchPoll = async () => {
      try {
        const res = await getGisActivePoll();
        if (!cancelled) setActivePoll(res.data?.poll_id ? res.data : null);
      } catch {
        if (!cancelled) setActivePoll(null);
      } finally {
        if (!cancelled) setPollLoading(false);
      }
    };

    fetchPoll();
    return () => { cancelled = true; };
  }, []);

  return (
    // Root container — full viewport height, flex row
    <div className="dashboard-root">
      <style>{`
        @keyframes seasonPing {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      {/* ===== SIDEBAR — fixed left, only visible on desktop ===== */}
      {/* Controlled by CSS class, NOT inline style, so media query can override */}
      <div className="sidebar-wrapper">
        <Sidebar />
      </div>

      {/* ===== RIGHT SIDE: header + content ===== */}
      <div className="dashboard-main">

        {/* ── TOP HEADER BAR — stays fixed, never changes ── */}
        <header className="dashboard-header-bar" style={{ justifyContent: 'space-between' }}>

          {/* Left: active season badge */}
          <ActiveSeasonBadge poll={activePoll} loading={pollLoading} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Notification Bell button — simple icon style like BRGY user header */}
            <button
            className="notif-btn"
            title="Notifications"
            onClick={() => alert('Notifications coming soon!')} // 🔔 replace with modal later
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              padding: '0.25rem',
            }}
          >
            <Bell size={18} />
          </button>

          {/* Profile section: Avatar + Name + Role */}
            <div
              className="profile-area"
              onClick={() => alert('Profile settings coming soon!')} // 👤 replace with dropdown later
              title="View profile"
            >
            {/* Avatar circle — replace with <img> when you have profile photos */}
            <div className="avatar-circle">
              {/* Show initials as fallback */}
              {firstName ? firstName[0].toUpperCase() : '👤'}
            </div>

              {/* Name + role label */}
              <div className="profile-text">
                <span className="profile-name">
                  {firstName} {lastName}
                </span>
                <span className="profile-role">{roleLabel}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── PAGE CONTENT — this is the ONLY part that changes on navigation ── */}
        <main className="dashboard-content">
          {/* <Outlet /> renders whatever page the current route maps to */}
          {/* e.g. /admin → AdminDashboard, /admin/users → UserManagement */}
          <Outlet />
        </main>
      </div>

      {/* ===== MOBILE BOTTOM NAV — only visible on small screens ===== */}
      <div className="bottom-nav-wrapper">
        <BottomNav />
      </div>

    </div>
  );
};

export default DashboardLayout;