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

export default API;