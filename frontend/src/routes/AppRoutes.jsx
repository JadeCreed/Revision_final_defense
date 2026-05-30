// src/routes/AppRoutes.jsx
// Each import comes from its own folder — clean and organized

import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout    from '../layouts/PublicLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute  from './ProtectedRoute';

// Public
import Landing  from '../pages/Landing';
import Register from '../pages/Register';
// Forgot Password
import ForgotPassword from '../pages/ForgotPassword';
import VerifyOTP      from '../pages/VerifyOTP';
import ResetPassword  from '../pages/ResetPassword';
import AdminReset     from '../pages/AdminReset';

// ── ADMIN pages ──
import AdminDashboard  from '../pages/admin/AdminDashboard';
import Reports         from '../pages/admin/Reports';
import SeedPoll        from '../pages/admin/SeedPoll';
import Announcement    from '../pages/admin/Announcement';
import SeedInventory   from '../pages/admin/SeedInventory';
import AdminBeneficiaries from '../pages/admin/AdminBeneficiaries';
import AdminDistribution  from '../pages/admin/AdminDistribution';  
import CropPhase       from '../pages/admin/CropPhase';
import Production      from '../pages/admin/Production';
import GisMap          from '../pages/admin/GisMap';
import Settings        from '../pages/admin/Settings';

// Admin — User Management sub-pages
import FarmerRequests    from '../pages/admin/users/FarmerRequests';
import FarmerMasterlist  from '../pages/admin/users/FarmerMasterlist';
import FarmerRecords     from '../pages/admin/users/FarmerRecords';
import SystemUsers       from '../pages/admin/users/SystemUsers';
import ResetRequests     from '../pages/admin/users/ResetRequests';
import Archive           from '../pages/admin/users/Archive';


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
import ATAnnouncements  from '../pages/at/ATAnnouncements';

// ── BRGY pages ──
import BPDashboard       from '../pages/brgy/BPDashboard';
import BrgyFarmers       from '../pages/brgy/BrgyFarmers';
import BrgyHarvest       from '../pages/brgy/BrgyHarvest';
import BrgyBeneficiaries from '../pages/brgy/BrgyBeneficiaries'; 
import BrgyDistribution  from '../pages/brgy/BrgyDistribution';
import BrgyCropPhase     from '../pages/brgy/BrgyCropPhase';
import BrgyAnnouncements from '../pages/brgy/BrgyAnnouncements';
import BrgyReports       from '../pages/brgy/BrgyReports';
import BrgyPoll          from '../pages/brgy/BrgyPoll';

// ── ANNOUNCEMENTS(SHARED PAGES) ──
import AnnouncementDetail   from '../components/announcements/AnnouncementDetail';
import AnnouncementCard     from '../components/announcements/AnnouncementCard';
import UserLayout from '../layouts/UserLayout';


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
          <Route path="/admin"                element={<AdminDashboard />} />
          <Route path="/admin/seed-poll"      element={<SeedPoll />} />
          <Route path="/admin/announcement"   element={<Announcement />} />
          <Route path="/admin/inventory"      element={<SeedInventory />} />
          <Route path="/admin/beneficiaries"  element={<AdminBeneficiaries />} />
          <Route path="/admin/distribution"   element={<AdminDistribution />} />  {/* ← bagong */}
          <Route path="/admin/crop-phase"     element={<CropPhase />} />
          <Route path="/admin/production"     element={<Production />} />
          <Route path="/admin/gis"            element={<GisMap />} />
          <Route path="/admin/reports"        element={<Reports />} />
          <Route path="/admin/settings"       element={<Settings />} />
          <Route path="/admin/users"          element={<Navigate to="/admin/users/farmer-requests" replace />} />
          <Route path="/admin/users/farmers"      element={<FarmerRecords />} />
          <Route path="/admin/users/farmer-requests"  element={<FarmerRequests />} />
          <Route path="/admin/users/farmer-masterlist" element={<FarmerMasterlist />} />
          <Route path="/admin/users/officials"         element={<SystemUsers />} />
          <Route path="/admin/users/reset-requests"    element={<ResetRequests />} />
          <Route path="/admin/users/archive"           element={<Archive />} />
        </Route>
      </Route>

      {/* ── FARMER ── uses UserLayout (mobile-first) */}
      <Route element={<ProtectedRoute allowedRole="FARMER" />}>
        <Route element={<UserLayout />}>
          <Route path="/farmer"               element={<FarmerDashboard />} />
          <Route path="/farmer/profile"       element={<FarmerProfile />} />
          <Route path="/farmer/harvest"       element={<YieldEncode />} />
          <Route path="/farmer/announcements" element={<FarmerAnnouncements />} />
          <Route path="/farmer/poll"          element={<FarmerPoll />} />
          <Route path="/farmer/announcements/:id" element={<AnnouncementDetail />} />
        </Route>
      </Route>

        {/* // ── AT ── uses UserLayout */}
    <Route element={<ProtectedRoute allowedRole="AT" />}>
      <Route element={<UserLayout />}>
        <Route path="/at"                  element={<ATDashboard />} />
        <Route path="/at/crop-monitoring"  element={<CropMonitoring />} />
        <Route path="/at/farmers"          element={<ATFarmers />} />
        <Route path="/at/gis"              element={<ATGisMap />} />
        <Route path="/at/reports"          element={<ATReports />} />
        <Route path="/at/announcements"    element={<ATAnnouncements />} />
        <Route path="/at/profile"          element={<FarmerProfile />} />
        <Route path="/at/announcements/:id" element={<AnnouncementDetail />} />
      </Route>
    </Route>

        {/* // ── BRGY ── uses UserLayout */}
    <Route element={<ProtectedRoute allowedRole="BRGY" />}>
      <Route element={<UserLayout />}>
        <Route path="/brgy"                      element={<BPDashboard />} />
        <Route path="/brgy/harvest"              element={<BrgyHarvest />} />
        <Route path="/brgy/farmers"              element={<BrgyFarmers />} />
        <Route path="/brgy/beneficiaries"        element={<BrgyBeneficiaries />} />
        <Route path="/brgy/distribution"         element={<BrgyDistribution />} />
        <Route path="/brgy/crop-phase"           element={<BrgyCropPhase />} />
        <Route path="/brgy/announcements"        element={<BrgyAnnouncements />} />
        <Route path="/brgy/reports"              element={<BrgyReports />} />
        <Route path="/brgy/profile"              element={<FarmerProfile />} />
        <Route path="/brgy/announcements/:id"    element={<AnnouncementDetail />} />
        <Route path="/brgy/poll"                 element={<BrgyPoll />} /> 
        
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;