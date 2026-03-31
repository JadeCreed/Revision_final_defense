// src/api/axios.js
// Axios instance connected to Django backend
// Automatically attaches JWT token to every request

import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000/api/accounts',
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
export const loginUser = (data) => API.post('/login/', data);
// Farmer self-registration
export const registerFarmer = (data) => API.post('/register/farmer/', data);

// ── FORGOT PASSWORD — 3-step flow ──
// Step 1: Send OTP to email
export const forgotPassword  = (data) => API.post('/forgot-password/', data);
// Step 2: Verify the 6-digit OTP
export const verifyOTP       = (data) => API.post('/verify-otp/', data);
// Step 3: Reset password (requires email + otp + new passwords)
export const resetPassword   = (data) => API.post('/reset-password/', data);
// ── ADMIN RESET REQUEST — for users without email ──
export const requestAdminReset = (data) => API.post('/admin-reset-request/', data);

// ── ADMIN BADGE ──
export const getBadgeCount = () => API.get('/admin/users/badge-count/');

// ── FARMER REQUESTS (Tab 1) ──
export const getFarmerRequests  = (params) => API.get('/admin/users/farmer-requests/', { params });
export const approveFarmer      = (id, data) => API.post(`/admin/users/farmers/${id}/approve/`, data);

// ── FARMER MASTERLIST (Tab 2) ──
export const getFarmerMasterlist   = (params) => API.get('/admin/users/farmer-masterlist/', { params });
export const getFarmerFullProfile  = (id)     => API.get(`/admin/users/farmers/${id}/full-profile/`);
export const updateFarmerProfile   = (id, data) => API.put(`/admin/users/farmers/${id}/full-profile/`, data);

// ── OFFICIALS (Tab 3) ──
export const getOfficials       = (params) => API.get('/admin/users/officials/', { params });
export const createOfficial     = (data)   => API.post('/admin/users/officials/create/', data);
export const deactivateUser     = (id)     => API.post(`/admin/users/${id}/deactivate/`);

// ── RESET REQUESTS (Tab 4) ──
export const getResetRequests    = (params) => API.get('/admin/users/reset-requests/', { params });
export const adminResetPassword  = (id, data) => API.post(`/admin/users/${id}/reset-password/`, data);

// ── ARCHIVE (Tab 5) ──
export const getArchive      = (params) => API.get('/admin/users/archive/', { params });
export const reactivateUser  = (id)     => API.post(`/admin/users/${id}/reactivate/`);

// ── BARANGAYS ──
export const getAvailableBarangays = () => API.get('/barangays/available/');

// ── CANCEL RESET REQUEST (Admin) ──
export const cancelResetRequest = (id) => API.post(`/admin/users/${id}/cancel-reset-request/`);

export default API;