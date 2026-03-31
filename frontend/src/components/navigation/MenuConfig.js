// src/components/navigation/MenuConfig.js

import {
  Home, Sprout, Megaphone, Archive, Package, Wheat,
  BarChart3, Map, Users, ClipboardList, Landmark,
  Key, Settings, User, UserCircle, Tractor
} from 'lucide-react';

export const MENU_CONFIG = {
  ADMIN: [
    { label: 'Dashboard',      path: '/admin',             icon: Home },
    { label: 'Seed Poll',      path: '/admin/seed-poll',   icon: Sprout },
    { label: 'Announcement',   path: '/admin/announcement',icon: Megaphone },
    { label: 'Seed Inventory', path: '/admin/inventory',   icon: Archive },
    { label: 'Distribution',   path: '/admin/distribution',icon: Package },
    { label: 'Crop Phase',     path: '/admin/crop-phase',  icon: Wheat },
    { label: 'Production',     path: '/admin/production',  icon: BarChart3 },
    { label: 'GIS Map',        path: '/admin/gis',         icon: Map },
    {
      label: 'User Management',
      icon:  Users,
      hasChildren: true,
      children: [
        { label: 'Farmer Accounts',  path: '/admin/users/farmer-requests',   icon: User,          badgeKey: 'pending_farmers' },
        { label: 'Farmer Masterlist',path: '/admin/users/farmer-masterlist',  icon: ClipboardList },
        { label: 'Officials',        path: '/admin/users/officials',          icon: Landmark },
        { label: 'Reset Requests',   path: '/admin/users/reset-requests',     icon: Key,           badgeKey: 'reset_requests' },
        { label: 'Archive',          path: '/admin/users/archive',            icon: Archive },
      ],
    },
    { label: 'Reports',  path: '/admin/reports',  icon: ClipboardList },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ],

  FARMER: [
    { label: 'Dashboard',       path: '/farmer',               icon: Home },
    { label: 'My Profile',      path: '/farmer/profile',       icon: UserCircle },
    { label: 'Crop Monitoring', path: '/farmer/crops',         icon: Wheat },
    { label: 'Announcements',   path: '/farmer/announcements', icon: Megaphone },
    { label: 'Seed Poll',       path: '/farmer/poll',          icon: Sprout },
  ],

  AT: [
    { label: 'Dashboard',       path: '/at',                 icon: Home },
    { label: 'Crop Monitoring', path: '/at/crop-monitoring', icon: Wheat },
    { label: 'Farmers',         path: '/at/farmers',         icon: Tractor },
    { label: 'GIS Map',         path: '/at/gis',             icon: Map },
    { label: 'Reports',         path: '/at/reports',         icon: ClipboardList },
    { label: 'Announcements',   path: '/at/announcements',   icon: Megaphone },
  ],

  BRGY: [
    { label: 'Dashboard',    path: '/brgy',                icon: Home },
    { label: 'Farmers',      path: '/brgy/farmers',        icon: Tractor },
    { label: 'Crop Phase',   path: '/brgy/crop-phase',     icon: Wheat },
    { label: 'Announcements',path: '/brgy/announcements',  icon: Megaphone },
    { label: 'Reports',      path: '/brgy/reports',        icon: ClipboardList },
  ],
};

export const ROLE_LABELS = {
  ADMIN:  'Admin',
  FARMER: 'Farmer',
  AT:     'Agricultural Technician',
  BRGY:   'Barangay President',
};

export const BOTTOM_NAV_CONFIG = {
  ADMIN: [
    { label: 'Dashboard', path: '/admin',                       icon: Home },
    { label: 'Users',     path: '/admin/users/farmer-requests', icon: Users },
    { label: 'GIS',       path: '/admin/gis',                   icon: Map },
    { label: 'Reports',   path: '/admin/reports',               icon: ClipboardList },
  ],
  FARMER: [
    { label: 'Dashboard', path: '/farmer',               icon: Home },
    { label: 'Profile',   path: '/farmer/profile',       icon: UserCircle },
    { label: 'Crops',     path: '/farmer/crops',         icon: Wheat },
    { label: 'News',      path: '/farmer/announcements', icon: Megaphone },
  ],
  AT: [
    { label: 'Dashboard', path: '/at',                 icon: Home },
    { label: 'Crops',     path: '/at/crop-monitoring', icon: Wheat },
    { label: 'Farmers',   path: '/at/farmers',         icon: Tractor },
    { label: 'Map',       path: '/at/gis',             icon: Map },
  ],
  BRGY: [
    { label: 'Dashboard', path: '/brgy',              icon: Home },
    { label: 'Farmers',   path: '/brgy/farmers',      icon: Tractor },
    { label: 'Crops',     path: '/brgy/crop-phase',   icon: Wheat },
    { label: 'News',      path: '/brgy/announcements',icon: Megaphone },
  ],
};