// src/api/axios.js
// Axios instance connected to Django backend
// Automatically attaches JWT token to every request

import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Auto-attach token on every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  response => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      ['access_token', 'role', 'is_verified', 'first_name', 'last_name']
        .forEach((key) => localStorage.removeItem(key));
    }
    return Promise.reject(error);
  }
);

// ===== AUTH =====
// NOTE: field is "login" not "contact_number" — matches your new Django LoginView
export const loginUser = (data) => API.post('/accounts/login/', data);
// Farmer self-registration
export const registerFarmer = (data) => API.post('/accounts/register/farmer/', data);

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

// ── OFFICIALS (Tab 3) ──
export const getOfficials       = (params) => API.get('/accounts/admin/users/officials/', { params });
export const createOfficial     = (data)   => API.post('/accounts/admin/users/officials/create/', data);
export const deactivateUser     = (id)     => API.post(`/accounts/admin/users/${id}/deactivate/`);

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
export const createBatch      = (eventId)      => API.post(`/distribution/events/${eventId}/batches/`);
export const getBatchDetail   = (id)           => API.get(`/distribution/batches/${id}/`);
export const submitBatch      = (id)           => API.post(`/distribution/batches/${id}/submit/`);
export const approveBatch     = (id)           => API.post(`/distribution/batches/${id}/approve/`);
export const rejectBatch      = (id, data)     => API.post(`/distribution/batches/${id}/reject/`, data);
export const unlockBatch      = (id, data)     => API.post(`/distribution/batches/${id}/unlock/`, data);
export const getBatchAudit    = (id)           => API.get(`/distribution/batches/${id}/audit/`);
export const getBrgyDistributionContext = ()   =>API.get('/distribution/brgy-context/');
// Entries
export const addEntryToBatch  = (batchId, data) => API.post(`/distribution/batches/${batchId}/entries/`, data);
export const updateEntry      = (id, data)      => API.put(`/distribution/entries/${id}/`, data);
export const deleteEntry      = (id)            => API.delete(`/distribution/entries/${id}/`);
export const saveSignature    = (id, data)      => API.post(`/distribution/entries/${id}/signature/`, data);

// Admin
export const getAdminPendingBatches = ()       => API.get('/distribution/admin/pending/');
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

export default API;