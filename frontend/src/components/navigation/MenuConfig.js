// src/components/navigation/MenuConfig.js
// ============================================================
// MENU CONFIGURATION — edit icons and labels here anytime
// Each item: { label, path, icon (emoji or you can swap to lucide) }
// ============================================================

export const MENU_CONFIG = {

  ADMIN: [
    { label: 'Dashboard',       path: '/admin',             icon: '🏠' },
    { label: 'Seed Poll',       path: '/admin/seed-poll',   icon: '🌱' },
    { label: 'Announcement',    path: '/admin/announcement',icon: '📢' },
    { label: 'Seed Inventory',  path: '/admin/inventory',   icon: '🗃️' },
    { label: 'Distribution',    path: '/admin/distribution',icon: '📦' },
    { label: 'Crop Phase',      path: '/admin/crop-phase',  icon: '🌾' },
    { label: 'Production',      path: '/admin/production',  icon: '📊' },
    { label: 'GIS Map',         path: '/admin/gis',         icon: '🗺️' },
    { label: 'User Management', path: '/admin/users',       icon: '👥' },
    { label: 'Reports',         path: '/admin/reports',     icon: '📋' },
    { label: 'Settings',        path: '/admin/settings',    icon: '⚙️' },
  ],

  FARMER: [
    { label: 'Dashboard',       path: '/farmer',            icon: '🏠' },
    { label: 'My Profile',      path: '/farmer/profile',    icon: '👤' },
    { label: 'Crop Monitoring', path: '/farmer/crops',      icon: '🌾' },
    { label: 'Announcements',   path: '/farmer/announcements', icon: '📢' },
    { label: 'Seed Poll',       path: '/farmer/poll',       icon: '🌱' },
  ],

  AT: [
    { label: 'Dashboard',       path: '/at',                icon: '🏠' },
    { label: 'Crop Monitoring', path: '/at/crop-monitoring',icon: '🌾' },
    { label: 'Farmers',         path: '/at/farmers',        icon: '👨‍🌾' },
    { label: 'GIS Map',         path: '/at/gis',            icon: '🗺️' },
    { label: 'Reports',         path: '/at/reports',        icon: '📋' },
    { label: 'Announcements',   path: '/at/announcements',  icon: '📢' },
  ],

  BRGY: [
    { label: 'Dashboard',       path: '/brgy',              icon: '🏠' },
    { label: 'Farmers',         path: '/brgy/farmers',      icon: '👨‍🌾' },
    { label: 'Crop Phase',      path: '/brgy/crop-phase',   icon: '🌾' },
    { label: 'Announcements',   path: '/brgy/announcements',icon: '📢' },
    { label: 'Reports',         path: '/brgy/reports',      icon: '📋' },
  ],

};

// Role display labels shown in the top-right profile area
export const ROLE_LABELS = {
  ADMIN:  'Admin',
  FARMER: 'Farmer',
  AT:     'Agricultural Technician',
  BRGY:   'Barangay President',
};