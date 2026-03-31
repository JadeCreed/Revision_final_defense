// src/pages/admin/UserManagement.jsx
// Admin → User Management page
// Connected to: /admin/users route in AppRoutes.jsx
// Feature: list, approve, create AT/BRGY users (build here later)
// src/pages/admin/UserManagement.jsx
// Redirects to the first sub-page
import { Navigate } from 'react-router-dom';
const UserManagement = () => <Navigate to="/admin/users/farmer-requests" replace />;
export default UserManagement;