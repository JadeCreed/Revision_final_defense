// src/routes/AppRoutes.jsx
// Each import comes from its own folder — clean and organized

import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout    from '../layouts/PublicLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute  from './ProtectedRoute';

// Public
import Landing  from '../pages/Landing';
import Register from '../pages/Register';

// ── ADMIN pages ──
import AdminDashboard  from '../pages/admin/AdminDashboard';
import UserManagement  from '../pages/admin/UserManagement';
import Reports         from '../pages/admin/Reports';
import SeedPoll        from '../pages/admin/SeedPoll';
import Announcement    from '../pages/admin/Announcement';
import SeedInventory   from '../pages/admin/SeedInventory';
import Distribution    from '../pages/admin/Distribution';
import CropPhase       from '../pages/admin/CropPhase';
import Production      from '../pages/admin/Production';
import GisMap          from '../pages/admin/GisMap';
import Settings        from '../pages/admin/Settings';

// ── FARMER pages ──
import FarmerDashboard      from '../pages/farmer/FarmerDashboard';
import FarmerProfile        from '../pages/farmer/FarmerProfile';
import YieldEncode          from '../pages/farmer/YieldEncode';
import FarmerAnnouncements  from '../pages/farmer/FarmerAnnouncements';
import FarmerPoll           from '../pages/farmer/FarmerPoll';

// ── AT pages ──
import ATDashboard      from '../pages/at/ATDashboard';
import CropMonitoring   from '../pages/at/CropMonitoring';
import ATFarmers        from '../pages/at/ATFarmers';
import ATGisMap         from '../pages/at/ATGisMap';
import ATReports        from '../pages/at/ATReports';
import ATAnnouncements  from '../pages/at/ATAnnouncements'

// ── BRGY pages ──
import BPDashboard          from '../pages/brgy/BPDashboard';
import BrgyFarmers          from '../pages/brgy/BrgyFarmers';
import BrgyCropPhase        from '../pages/brgy/BrgyCropPhase';
import BrgyAnnouncements    from '../pages/brgy/BrgyAnnouncements';
import BrgyReports          from '../pages/brgy/BrgyReports';

// Forgot Password
import ForgotPassword from '../pages/ForgotPassword';
import VerifyOTP      from '../pages/VerifyOTP';
import ResetPassword  from '../pages/ResetPassword';
import AdminReset     from '../pages/AdminReset';

const AppRoutes = () => (
  <Routes>

    {/* PUBLIC */}
    <Route element={<PublicLayout />}>
      <Route path="/"         element={<Landing />} />
      <Route path="/login"    element={<Landing />} />
      <Route path="/register" element={<Register />} />

      {/* ── FORGOT PASSWORD FLOW ── */}
      <Route path="/forgot-password"              element={<ForgotPassword />} />
      <Route path="/forgot-password/verify-otp"  element={<VerifyOTP />} />
      <Route path="/forgot-password/reset-password" element={<ResetPassword />} />
      <Route path="/forgot-password/admin-reset" element={<AdminReset />} />
      
    </Route>

    {/* ADMIN */}
    <Route element={<ProtectedRoute allowedRole="ADMIN" />}>
      <Route element={<DashboardLayout />}>
        <Route path="/admin"              element={<AdminDashboard />} />
        <Route path="/admin/users"        element={<UserManagement />} />
        <Route path="/admin/reports"      element={<Reports />} />
        <Route path="/admin/seed-poll"    element={<SeedPoll />} />
        <Route path="/admin/announcement" element={<Announcement />} />
        <Route path="/admin/inventory"    element={<SeedInventory />} />
        <Route path="/admin/distribution" element={<Distribution />} />
        <Route path="/admin/crop-phase"   element={<CropPhase />} />
        <Route path="/admin/production"   element={<Production />} />
        <Route path="/admin/gis"          element={<GisMap />} />
        <Route path="/admin/settings"     element={<Settings />} />
      </Route>
    </Route>

    {/* FARMER */}
    <Route element={<ProtectedRoute allowedRole="FARMER" />}>
      <Route element={<DashboardLayout />}>
        <Route path="/farmer"                element={<FarmerDashboard />} />
        <Route path="/farmer/profile"        element={<FarmerProfile />} />
        <Route path="/farmer/crops"          element={<YieldEncode />} />
        <Route path="/farmer/announcements"  element={<FarmerAnnouncements />} />
        <Route path="/farmer/poll"           element={<FarmerPoll />} />
      </Route>
    </Route>

    {/* AT */}
    <Route element={<ProtectedRoute allowedRole="AT" />}>
      <Route element={<DashboardLayout />}>
        <Route path="/at"                  element={<ATDashboard />} />
        <Route path="/at/crop-monitoring"  element={<CropMonitoring />} />
        <Route path="/at/farmers"          element={<ATFarmers />} />
        <Route path="/at/gis"              element={<ATGisMap />} />
        <Route path="/at/reports"          element={<ATReports />} />
        <Route path="/at/announcements"    element={<ATAnnouncements />} />
      </Route>
    </Route>

    {/* BRGY */}
    <Route element={<ProtectedRoute allowedRole="BRGY" />}>
      <Route element={<DashboardLayout />}>
        <Route path="/brgy"                 element={<BPDashboard />} />
        <Route path="/brgy/farmers"         element={<BrgyFarmers />} />
        <Route path="/brgy/crop-phase"      element={<BrgyCropPhase />} />
        <Route path="/brgy/announcements"   element={<BrgyAnnouncements />} />
        <Route path="/brgy/reports"         element={<BrgyReports />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;