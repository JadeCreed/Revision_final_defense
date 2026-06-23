// src/components/navigation/MenuConfig.js
import {
  Home, Sprout, Megaphone, Archive, Package, Wheat,
  BarChart3, Map, Users, ClipboardList, Landmark,
  Settings, User, UserCircle, Tractor, Truck, FileText
} from 'lucide-react';

export const MENU_CONFIG = {
  ADMIN: [
    { label: 'Dashboard',      path: '/admin',              icon: Home        },
    { label: 'Seed Poll',      path: '/admin/seed-poll',    icon: Sprout      },
    { label: 'Beneficiaries',  path: '/admin/beneficiaries', icon: Package     },
    { label: 'GIS Map',        path: '/admin/gis',          icon: Map         },
    { label: 'Seed Inventory', path: '/admin/inventory',    icon: Archive     },
    { label: 'Distribution',   path: '/admin/distribution', icon: Truck       },
    { label: 'Crop Phase',     path: '/admin/crop-phase',   icon: Wheat       },
    { label: 'Production',     path: '/admin/production',   icon: BarChart3   },
    { label: 'Announcement',   path: '/admin/announcement', icon: Megaphone   },
    {
      label: 'User Management',
      icon:  Users,
      hasChildren: true,
      children: [
        { label: 'Farmer Records', path: '/admin/users/farmers', icon: User, badgeKey: 'pending_farmers' },
        { label: 'Officials',      path: '/admin/users/officials', icon: Landmark },
        { label: 'Archive',        path: '/admin/users/archive', icon: Archive },
      ],
    },



    {
      label: 'Reports',
      icon:  ClipboardList,
      hasChildren: true,
      children: [
        { label: 'Masterlist', path: '/admin/reports/masterlist', icon: FileText },
        { label: 'Analytics',  path: '/admin/reports/analytics',  icon: BarChart3 },
      ],
    },

    
    { label: 'Settings', path: '/admin/settings', icon: Settings      },
  ],

  FARMER: [
    { label: 'Home',    path: '/farmer',               icon: Home        },
    { label: 'News',    path: '/farmer/announcements', icon: Megaphone   },
    { label: 'Poll',    path: '/farmer/poll',          icon: Sprout      },
    { label: 'Harvest', path: '/farmer/harvest',       icon: Wheat       },
    { label: 'Map',     path: '/farmer/gis',           icon: Map         },
    { label: 'Profile', path: '/farmer/profile',       icon: UserCircle  },
  ],

  AT: [
    { label: 'Home',    path: '/at',                   icon: Home        },
    { label: 'News',    path: '/at/announcements',     icon: Megaphone   },
    { label: 'Farmers', path: '/at/farmers',           icon: Users       },
    { label: 'Monitor', path: '/at/crop-monitoring',   icon: Tractor     },
    { label: 'GIS Map', path: '/at/gis',               icon: Map         },
    // { label: 'Reports', path: '/at/reports',           icon: ClipboardList },
  ],

  BRGY: [
    { label: 'Home',            path: '/brgy',                 icon: Home        },
    { label: 'News',            path: '/brgy/announcements',   icon: Megaphone   },
    { label: 'Poll',            path: '/brgy/poll',            icon: Sprout      },
    { label: 'Farmers',         path: '/brgy/farmers',         icon: Users       },
    { label: 'Beneficiaries',   path: '/brgy/beneficiaries',   icon: Package     },
    { label: 'Distribution',    path: '/brgy/distribution',    icon: Truck       },
    { label: 'GIS Map',         path: '/brgy/gis',             icon: Map         },
    { label: 'Harvest',         path: '/brgy/harvest',         icon: Wheat       },
    { label: 'Reports',         path: '/brgy/reports',         icon: ClipboardList },
  ],
};

// ── BOTTOM NAV CONFIG FALLBACKS ──
export const BOTTOM_NAV_CONFIG = {
  ADMIN: [
    { label: 'Dashboard', path: '/admin',                       icon: Home },
    { label: 'Seed Poll', path: '/admin/seed-poll',             icon: Sprout },
    { label: 'Beneficiaries', path: '/admin/beneficiaries',     icon: Package },
    { label: 'Reports',   path: '/admin/reports',               icon: ClipboardList },
  ],
  FARMER: [
    { label: 'Home',    path: '/farmer',               icon: Home },
    { label: 'News',    path: '/farmer/announcements', icon: Megaphone },
    { label: 'Poll',    path: '/farmer/poll',          icon: Sprout },
    { label: 'Harvest', path: '/farmer/harvest',       icon: Wheat },
  ],
  AT: [
    { label: 'Home',    path: '/at',                   icon: Home },
    { label: 'News',    path: '/at/announcements',     icon: Megaphone },
    { label: 'Farmers', path: '/at/farmers',           icon: Users },
    { label: 'Monitor', path: '/at/crop-monitoring',   icon: Tractor },
  ],
  BRGY: [
    { label: 'Home',          path: '/brgy',                 icon: Home },
    { label: 'News',          path: '/brgy/announcements',   icon: Megaphone },
    { label: 'Poll',          path: '/brgy/poll',            icon: Sprout },
    { label: 'Farmers',       path: '/brgy/farmers',         icon: Users },
  ],
};

// ── FARMER: 5 nav items ──
const FARMER_NAV = [
  { label: 'Home',    path: '/farmer',               icon: Home        },
  { label: 'News',    path: '/farmer/announcements', icon: Megaphone   },
  { label: 'Poll',    path: '/farmer/poll',          icon: Sprout      },
  { label: 'Map',     path: '/farmer/gis',           icon: Map         },
  { label: 'Profile', path: '/farmer/profile',       icon: UserCircle  },
];

// ── AT (Agricultural Technician): 6 nav items ──
const AT_NAV = [
  { label: 'Home',    path: '/at',                   icon: Home        },
  { label: 'News',    path: '/at/announcements',     icon: Megaphone   }, 
  { label: 'Farmers', path: '/at/farmers',           icon: Users       },
  { label: 'Monitor', path: '/at/crop-monitoring',   icon: Tractor     },
  { label: 'GIS Map', path: '/at/gis',               icon: Map         },
  // { label: 'Reports', path: '/at/reports',           icon: ClipboardList },
];

// ── BRGY PRESIDENT: 7 nav items ──
const BRGY_NAV = [
  { label: 'Home',          path: '/brgy',                 icon: Home        },
  { label: 'News',          path: '/brgy/announcements',   icon: Megaphone   },
  { label: 'Beneficiaries', path: '/brgy/beneficiaries',   icon: Package     },
  { label: 'Distribution',  path: '/brgy/distribution',    icon: Truck       },
  { label: 'GIS Map',       path: '/brgy/gis',             icon: Map         },
  { label: 'Harvest',       path: '/brgy/harvest',         icon: Wheat       },
  { label: 'Reports',       path: '/brgy/reports',         icon: FileText    },
];

// ── EXPORTED MAP ──
export const USER_NAV = {
  FARMER: FARMER_NAV,
  AT:     AT_NAV,
  BRGY:   BRGY_NAV,
};

// ── ROLE COLORS ──
export const ROLE_COLORS = {
  FARMER: { primary: '#1a4d1a', accent: '#f5c842' },  // Deep Forest Green
  AT:     { primary: '#1a4d1a', accent: '#f5c842' },  // Deep Forest Green
  BRGY:   { primary: '#1a4d1a', accent: '#f5c842' },  // Deep Forest Green
};

// ── ROLE LABELS ──
export const ROLE_LABELS = {
  ADMIN:  'Admin',
  FARMER: 'Farmer',
  AT:     'Agricultural Technician',
  BRGY:   'Barangay President',
};