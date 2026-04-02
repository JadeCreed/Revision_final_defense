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


export default API;