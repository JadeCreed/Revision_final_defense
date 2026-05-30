// src/components/navigation/MenuConfig.js
import {
  Home, Sprout, Megaphone, Archive, Package, Wheat,
  BarChart3, Map, Users, ClipboardList, Landmark,
  Key, Settings, User, UserCircle, Tractor, Truck
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
        { label: 'Reset Requests', path: '/admin/users/reset-requests', icon: Key, badgeKey: 'reset_requests' },
        { label: 'Archive',        path: '/admin/users/archive', icon: Archive },
      ],
    },
    { label: 'Reports',  path: '/admin/reports',  icon: ClipboardList },
    { label: 'Settings', path: '/admin/settings', icon: Settings      },
  ],

  FARMER: [
    { label: 'Home',    path: '/farmer',               icon: Home        },
    { label: 'News',    path: '/farmer/announcements', icon: Megaphone   },
    { label: 'Poll',    path: '/farmer/poll',          icon: Sprout      },
    { label: 'Harvest', path: '/farmer/harvest',       icon: Wheat       },
    { label: 'Profile', path: '/farmer/profile',       icon: UserCircle  },
  ],

  AT: [
    { label: 'Home',    path: '/at',                   icon: Home        },
    { label: 'News',    path: '/at/announcements',     icon: Megaphone   },
    { label: 'Farmers', path: '/at/farmers',           icon: Tractor     },
    { label: 'Monitor', path: '/at/crop-monitoring',   icon: Wheat       },
    { label: 'Reports', path: '/at/reports',           icon: ClipboardList },
  ],

  BRGY: [
    { label: 'Home',            path: '/brgy',                 icon: Home        },
    { label: 'News',            path: '/brgy/announcements',   icon: Megaphone   },
    { label: 'Poll',            path: '/brgy/poll',            icon: Sprout      },
    { label: 'Farmers',         path: '/brgy/farmers',         icon: Tractor     },
    { label: 'Beneficiaries',   path: '/brgy/beneficiaries',   icon: Package     },
    { label: 'Distribution',    path: '/brgy/distribution',    icon: Truck       },
    { label: 'Harvest',         path: '/brgy/harvest',         icon: BarChart3   },
    { label: 'Reports',         path: '/brgy/reports',         icon: ClipboardList },
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
    { label: 'Farmers', path: '/at/farmers',           icon: Tractor },
    { label: 'Monitor', path: '/at/crop-monitoring',   icon: Wheat },
  ],
  BRGY: [
    { label: 'Home',          path: '/brgy',                 icon: Home },
    { label: 'News',          path: '/brgy/announcements',   icon: Megaphone },
    { label: 'Poll',          path: '/brgy/poll',            icon: Sprout },
    { label: 'Farmers',       path: '/brgy/farmers',         icon: Tractor },
  ],
};