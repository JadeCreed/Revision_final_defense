// src/api/axios.js
// Axios instance connected to Django backend
// Tokens stored securely in httpOnly cookies (not in localStorage)

import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // 🍪 Enable automatic cookie sending
});


// Response interceptor for error handling
// ── GLOBAL "SESSION EXPIRED" HANDLER ──
// AuthContext registers itself here so axios can trigger a logout
// whenever any request comes back 401, even outside of React components.
let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

// Endpoints na hindi dapat mag-trigger ng global logout sa 401:
// - /accounts/login/      → mali lang yung credentials, hindi session expiry
// - /accounts/verify-token/ → may sariling handling na sa AuthContext checkAuth()
const SKIP_GLOBAL_401 = ['/accounts/login/', '/accounts/verify-token/'];

// Response interceptor for error handling
API.interceptors.response.use(
  response => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const shouldSkip = SKIP_GLOBAL_401.some((path) => requestUrl.includes(path));

    if (status === 401 && !shouldSkip && onUnauthorized) {
      onUnauthorized();
    }

    return Promise.reject(error);
  }
);






// ===== AUTH =====
// NOTE: field is "login" not "contact_number" — matches your new Django LoginView
export const loginUser = (data) => API.post('/accounts/login/', data);
// Verify authentication token (check if user is logged in)
export const verifyToken = () => API.get('/accounts/verify-token/');
// Logout and clear cookie
export const logoutUser = () => API.post('/accounts/logout/');
// Farmer self-registration
export const registerFarmer = (data) => API.post('/accounts/register/farmer/', data);
export const validateStep1 = (data) => API.post('/accounts/register/validate-step1/', data);
// ── FORGOT PASSWORD — 3-step flow ──
// Step 1: Send OTP to email
export const forgotPassword  = (data) => API.post('/accounts/forgot-password/', data);
// Step 2: Verify the 6-digit OTP
export const verifyOTP       = (data) => API.post('/accounts/verify-otp/', data);
// Step 3: Reset password (requires email + otp + new passwords)
export const resetPassword   = (data) => API.post('/accounts/reset-password/', data);
// ── ADMIN RESET REQUEST — for users without email ──
export const requestAdminReset = (data) => API.post('/accounts/admin-reset-request/', data);

// ── ADMIN BADGE ──
export const getBadgeCount = () => API.get('/accounts/admin/users/badge-count/');

// ── FARMER REQUESTS (Tab 1) ──
export const getFarmerRequests  = (params) => API.get('/accounts/admin/users/farmer-requests/', { params });
export const approveFarmer      = (id, data) => API.post(`/accounts/admin/users/farmers/${id}/approve/`, data);

// ── FARMER MASTERLIST (Tab 2) ──
export const getFarmerMasterlist   = (params) => API.get('/accounts/admin/users/farmer-masterlist/', { params });
export const getFarmerFullProfile  = (id)     => API.get(`/accounts/admin/users/farmers/${id}/full-profile/`);
export const updateFarmerProfile   = (id, data) => API.put(`/accounts/admin/users/farmers/${id}/full-profile/`, data);
export const getATFarmerDetail     = (id)     => API.get(`/crop-monitoring/at/farmers/${id}/detail/`);

// ── OFFICIALS (Tab 3) ──
export const getOfficials       = (params) => API.get('/accounts/admin/users/officials/', { params });
export const createOfficial     = (data)   => API.post('/accounts/admin/users/officials/create/', data);
export const updateOfficialAssignedBarangays = (id, data) => API.put(`/accounts/admin/users/${id}/assigned-barangays/`, data);
export const deactivateUser     = (id, data = {}) => API.post(`/accounts/admin/users/${id}/deactivate/`, data);

// ── RESET REQUESTS (Tab 4) ──
export const getResetRequests    = (params) => API.get('/accounts/admin/users/reset-requests/', { params });
export const adminResetPassword  = (id, data) => API.post(`/accounts/admin/users/${id}/reset-password/`, data);

// ── ARCHIVE (Tab 5) ──
export const getArchive      = (params) => API.get('/accounts/admin/users/archive/', { params });
export const reactivateUser  = (id)     => API.post(`/accounts/admin/users/${id}/reactivate/`);

// ── BARANGAYS ──
export const getAvailableBarangays = () => API.get('/accounts/barangays/available/');

// ── CANCEL RESET REQUEST (Admin) ──
export const cancelResetRequest = (id) => API.post(`/accounts/admin/users/${id}/cancel-reset-request/`);


// ── ANNOUNCEMENTS ──
// Admin routes
export const getAdminAnnouncements  = (params) => API.get('/announcements/admin/', { params });
export const createAnnouncement     = (data)   => API.post('/announcements/admin/', data);
export const updateAnnouncement     = (id, data) => API.put(`/announcements/admin/${id}/`, data);
export const deleteAnnouncement     = (id)     => API.delete(`/announcements/admin/${id}/`);

// User routes (farmer/AT/BRGY)
export const getAnnouncements       = (params) => API.get('/announcements/', { params });
export const getAnnouncementDetail  = (id)     => API.get(`/announcements/${id}/`);
export const getUnreadCount         = ()       => API.get('/announcements/unread-count/');


// ── SEED POLL ──
// Admin — variety management
export const getAdminVarieties    = ()         => API.get('/seed-poll/admin/varieties/');
export const createVariety        = (data)     => API.post('/seed-poll/admin/varieties/', data);
export const updateVariety        = (id, data) => API.put(`/seed-poll/admin/varieties/${id}/`, data);
export const deleteVariety        = (id)       => API.delete(`/seed-poll/admin/varieties/${id}/`);

// Admin — poll management
export const getAdminPolls        = ()         => API.get('/seed-poll/admin/polls/');
export const createPoll           = (data)     => API.post('/seed-poll/admin/polls/', data);
export const updatePoll           = (id, data) => API.put(`/seed-poll/admin/polls/${id}/`, data);
export const lockPoll             = (id)       => API.post(`/seed-poll/admin/polls/${id}/lock/`);
export const closePoll            = (id)       => API.post(`/seed-poll/admin/polls/${id}/close/`);
export const getAdminPollResults  = (id)       => API.get(`/seed-poll/admin/polls/${id}/results/`);

// Shared — varieties for vote form
export const getSeedVarieties     = ()         => API.get('/seed-poll/varieties/');

// Farmer
export const getActivePoll        = ()         => API.get('/seed-poll/active/');
export const getGisActivePoll     = ()         => API.get('/seed-poll/gis-active-poll/');
export const submitVote           = (id, data) => API.post(`/seed-poll/${id}/vote/`, data);

// BRGY
export const getBrgyPollResults   = (id)       => API.get(`/seed-poll/${id}/brgy-results/`);
export const getCurrentSeason     = ()         => API.get('/seed-poll/current-season/');

// ── SEED POLL — Seed Type management (admin) ──
// Used by SeedPoll.jsx Tab 2 to manage seed categories
export const getAdminSeedTypes  = ()         => API.get('/seed-poll/admin/types/');
export const createSeedType     = (data)     => API.post('/seed-poll/admin/types/', data);
export const updateSeedType     = (id, data) => API.put(`/seed-poll/admin/types/${id}/`, data);
export const deleteSeedType     = (id)       => API.delete(`/seed-poll/admin/types/${id}/`);
export const deletePoll = (pollId)           => API.delete(`/seed-poll/polls/${pollId}/delete/`);
export const getFinalSeeds = (params = {})   => API.get('/seed-poll/final-seeds/', { params });
export const saveFinalSeeds = (data)         => API.post('/seed-poll/final-seeds/', data);

// ── DISTRIBUTION ──
// Farmer search
export const searchFarmers = (params) =>
  API.get('/distribution/farmers/search/', { params });
// Farmer distribution detail for BRGY two-panel distribution view
export const getFarmerDistributionDetail = (farmerId) =>
  API.get(`/distribution/farmers/${farmerId}/distribution-detail/`);
// ── DISTRIBUTION: BRGY requests program deletion ──
export const requestDeleteEvent = (eventId, data)       => API.post(`/distribution/events/${eventId}/request-delete/`, data);
// ── DISTRIBUTION: Admin confirms program deletion ──
export const adminConfirmDeleteEvent = (eventId)        => API.delete(`/distribution/events/${eventId}/confirm-delete/`);
// Events
export const getDistributionEvents   = (params) => API.get('/distribution/events/', { params });
export const createDistributionEvent = (data)   => API.post('/distribution/events/', data);
export const getDistributionEvent    = (id)     => API.get(`/distribution/events/${id}/`);
export const updateDistributionEvent = (id, data) => API.put(`/distribution/events/${id}/`, data);

// Batches
export const getEventBatches  = (eventId)      => API.get(`/distribution/events/${eventId}/batches/`);
export const createBatch = (eventId, varietyId) =>
  API.post(`/distribution/events/${eventId}/batches/`, varietyId ? { variety_id: varietyId } : {});
export const getBatchDetail   = (id)           => API.get(`/distribution/batches/${id}/`);
export const submitBatch      = (id)           => API.post(`/distribution/batches/${id}/submit/`);
export const submitDistributionBatch = (id) => API.post(`/distribution/batches/${id}/submit-distribution/`);
export const approveBatch     = (id)           => API.post(`/distribution/batches/${id}/approve/`);
export const rejectBatch      = (id, data)     => API.post(`/distribution/batches/${id}/reject/`, data);
export const approveDistributionBatch = (id) => API.post(`/distribution/batches/${id}/distribution-approve/`);
export const rejectDistributionBatch  = (id, data) => API.post(`/distribution/batches/${id}/distribution-reject/`, data);
export const reopenBatch      = (id)           => API.post(`/distribution/batches/${id}/reopen/`);
export const unlockBatch      = (id, data)     => API.post(`/distribution/batches/${id}/unlock/`, data);
export const getBatchAudit    = (id)           => API.get(`/distribution/batches/${id}/audit/`);
export const getBrgyDistributionContext = ()   =>API.get('/distribution/brgy-context/');
// Entries
export const addEntryToBatch  = (batchId, data) => API.post(`/distribution/batches/${batchId}/entries/`, data);
export const updateEntry      = (id, data)      => API.put(`/distribution/entries/${id}/`, data);
export const encodeDistributionEntry = (id, data) => API.post(`/distribution/entries/${id}/encode-distribution/`, data);
export const deleteEntry      = (id)            => API.delete(`/distribution/entries/${id}/`);
export const saveSignature    = (id, data)      => API.post(`/distribution/entries/${id}/signature/`, data);

// Crop monitoring
export const getATFarmers         = (params) => API.get('/crop-monitoring/at/farmers/', { params });
export const getATDashboardStats  = ()       => API.get('/accounts/at/dashboard-stats/');
export const createCropRecord     = (data)   => API.post('/crop-monitoring/records/', data);
export const updateCropRecord     = (id, data) => API.put(`/crop-monitoring/records/${id}/`, data);
export const getFarmerCropHistory = (farmerId, params = {}) => API.get(`/crop-monitoring/farmers/${farmerId}/history/`, { params });
export const getCropMonitoringBarangaySummary = () => API.get('/crop-monitoring/gis/summaries/');

// Admin
export const getAdminPendingBatches = ()       => API.get('/distribution/admin/pending/');
export const getAdminDistributionPending = () => API.get('/distribution/admin/distribution-pending/');
export const getDistributionStats   = ()       => API.get('/distribution/admin/stats/');
export const confirmSeedDelivery    = (eventId) => API.post(`/distribution/events/${eventId}/confirm-delivery/`);


// ── SEED INVENTORY ──
export const getInventorySummary      = ()           => API.get('/inventory/summary/');
export const getSeedDeliveries        = (params)     => API.get('/inventory/deliveries/', { params });
export const createSeedDelivery       = (data)       => API.post('/inventory/deliveries/', data);
export const updateSeedDelivery       = (id, data)   => API.patch(`/inventory/deliveries/${id}/`, data);
export const deleteSeedDelivery       = (id)         => API.delete(`/inventory/deliveries/${id}/`);
export const getDeliveryAllocations   = (id)         => API.get(`/inventory/deliveries/${id}/allocations/`);
export const createAllocation         = (id, data)   => API.post(`/inventory/deliveries/${id}/allocations/`, data);
export const getDeliveryAudit         = (id)         => API.get(`/inventory/deliveries/${id}/audit/`);

export const getBrgyAllocations       = ()           => API.get('/inventory/my-allocations/');
export const getBrgyPendingCount      = ()           => API.get('/inventory/my-allocations/pending-count/');
export const confirmPickup            = (id)         => API.post(`/inventory/allocations/${id}/confirm/`);
export const getBeneficiaryAllocations = (params = {}) => API.get('/inventory/beneficiary-allocations/', { params });
export const getBrgyMyAllocation       = ()           => API.get('/inventory/my-seed-allocation/');
export const getBrgyScheduleNotifications = () => API.get('/inventory/schedule-notifications/');
export const brgyConfirmAllocation    = (data)       => API.post('/inventory/confirm-allocation/', data);

// Delivery Schedule Programs (backend-persisted, replaces localStorage)
export const getDeliverySchedules     = ()           => API.get('/inventory/schedules/');
export const createDeliverySchedule   = (data)       => API.post('/inventory/schedules/', data);
export const updateDeliverySchedule   = (id, data)   => API.put(`/inventory/schedules/${id}/`, data);
export const deleteDeliverySchedule   = (id)         => API.delete(`/inventory/schedules/${id}/`);
export const updateScheduleEntry      = (entryId, data) => API.patch(`/inventory/schedules/entries/${entryId}/`, data);

// ── REPORTS ──


// ── MONTHLY ANALYTICS ──
export const getMonthlyAnalytics = (params) =>
  API.get('/analytics/monthly/', { params });

export const downloadMonthlyAnalyticsPDF = (data) =>
  API.post('/analytics/monthly/pdf/', data, { responseType: 'blob' });


// ── REPORTS ── (replace existing report calls)
export const getReportFilterOptions = () =>
  API.get('/reports/filter-options/');

export const getReportPreview = (params) =>
  API.get('/reports/preview/', { params });

export const downloadReport = (params) =>
  API.get('/reports/download/', { params, responseType: 'blob' });

export const getReportLogs = () =>
  API.get('/reports/logs/');

// GIS Map
export const getGisPlots    = (params) => API.get('/gis/plots/', { params });
export const createGisPlot  = (data)   => API.post('/gis/plots/', data);
export const updateGisPlot  = (id, d)  => API.patch(`/gis/plots/${id}/`, d);
export const deleteGisPlot  = (id)     => API.delete(`/gis/plots/${id}/`);
export const getMapSummary  = (params = {}) => API.get('/gis/summary/', { params });
export const getGisBarangays= ()       => API.get('/gis/barangays/');
export const getGisAllPolls = ()       => API.get('/seed-poll/gis-all-polls/');export const getATMonitoringHistory = (params = {}) =>
  API.get('/crop-monitoring/at/history/', { params });

// ── Farmer Registry (MAO Master List) ──
export const getFarmerRegistry    = (params) => API.get('/accounts/admin/farmer-registry/', { params });
export const addFarmerRegistry    = (data)   => API.post('/accounts/admin/farmer-registry/', data);
export const updateFarmerRegistry = (id, data) => API.put(`/accounts/admin/farmer-registry/${id}/`, data);
export const deleteFarmerRegistry = (id)     => API.delete(`/accounts/admin/farmer-registry/${id}/`);
export const bulkUploadRegistry   = (data)   => API.post('/accounts/admin/farmer-registry/bulk-upload/', data);
// ── CROP PHASE ──
export const getCropPhaseAnalytics = (params = {}) => {
  const query = new URLSearchParams();
  if (params.poll_id)   query.set('poll_id',   params.poll_id);
  if (params.seed_type) query.set('seed_type', params.seed_type);
  return API.get(`/crop-phase/analytics/?${query}`);
};


// ── PRODUCTION ──
export const getHarvestRecords        = (params = {}) => API.get('/production/harvest/', { params });
export const createHarvestRecord      = (data)        => API.post('/production/harvest/', data);
export const getHarvestRecord         = (id)          => API.get(`/production/harvest/${id}/`);
export const updateHarvestRecord      = (id, data)    => API.put(`/production/harvest/${id}/`, data);
export const deleteHarvestRecord      = (id)          => API.delete(`/production/harvest/${id}/`);


// Brgy Harvest — bagong endpoints
export const getHarvestingFarmers  = ()           => API.get('/production/harvesting-farmers/');
export const getBrgyHarvestHistory = (params = {}) => API.get('/production/harvest-history/', { params });

// Production analytics (Admin only)
export const getProductionSummary     = ()            => API.get('/production/summary/');
export const getProductionBySeedType  = ()            => API.get('/production/by-seed-type/');
export const getProductionByBarangay  = ()            => API.get('/production/by-barangay/');
export const getProductionLowPerformers = (threshold = 100) =>
  API.get(`/production/low-performers/?threshold=${threshold}`);
export const getProductionGISSummary    = ()            => API.get('/production/gis-summary/');
export const getSeedProductivity        = (params = {}) => API.get('/production/seed-productivity/', { params });


// 4 tiles for AT/BRGY/Farmer dashboards


export const getBRGYDashboardStats = () =>
  API.get('/accounts/brgy/dashboard-stats/');

export const getFarmerDashboardStats = () =>
  API.get('/accounts/farmer/dashboard-stats/');

export default API;