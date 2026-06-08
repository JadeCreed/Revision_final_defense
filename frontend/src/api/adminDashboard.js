import api from './axios';

export const fetchAdminDashboard = (params = {}) => {
  const query = new URLSearchParams();
  if (params.poll_id)   query.set('poll_id',   params.poll_id);
  if (params.seed_type) query.set('seed_type', params.seed_type);
  return api.get(`/analytics/dashboard/?${query.toString()}`);
};