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
import Sidebar from '../components/navigation/Sidebar';
import BottomNav from '../components/navigation/BottomNav';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../components/navigation/MenuConfig';

const DashboardLayout = () => {
  const { firstName, lastName, role } = useAuth();
  const roleLabel = ROLE_LABELS[role] || role;

  return (
    // Root container — full viewport height, flex row
    <div className="dashboard-root">

      {/* ===== SIDEBAR — fixed left, only visible on desktop ===== */}
      {/* Controlled by CSS class, NOT inline style, so media query can override */}
      <div className="sidebar-wrapper">
        <Sidebar />
      </div>

      {/* ===== RIGHT SIDE: header + content ===== */}
      <div className="dashboard-main">

        {/* ── TOP HEADER BAR — stays fixed, never changes ── */}
        <header className="dashboard-header-bar">

          {/* Notification Bell button — clickable, yellow background */}
          <button
            className="notif-btn"
            title="Notifications"
            onClick={() => alert('Notifications coming soon!')} // 🔔 replace with modal later
          >
            🔔
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