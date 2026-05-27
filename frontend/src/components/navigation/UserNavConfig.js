import {
  Home,
  Megaphone,
  Sprout,
  Wheat,
  UserCircle,
  Users,
  Tractor,
  ClipboardList,
  FileText,
  Package,
  Truck,
} from 'lucide-react';

// ── FARMER: 5 nav items ──
// Home → News (announcements) → Poll (seed voting) → Harvest (yield encode) → Profile
const FARMER_NAV = [
  { label: 'Home',    path: '/farmer',               icon: Home        },
  { label: 'News',    path: '/farmer/announcements', icon: Megaphone   },
  { label: 'Poll',    path: '/farmer/poll',          icon: Sprout      },
  { label: 'Harvest', path: '/farmer/harvest',       icon: Wheat       },
  { label: 'Profile', path: '/farmer/profile',       icon: UserCircle  },
];

// ── AT (Agricultural Technician): 4 nav items ──
// Home → Farmers → Monitor (crop monitoring) → Reports
const AT_NAV = [
  { label: 'Home',    path: '/at',                   icon: Home        },
  { label: 'News',    path: '/at/announcements',     icon: Megaphone   }, 
  { label: 'Farmers', path: '/at/farmers',           icon: Users       },
  { label: 'Monitor', path: '/at/crop-monitoring',   icon: Tractor     },
  { label: 'Reports', path: '/at/reports',           icon: ClipboardList },
];

// ── BRGY PRESIDENT: 5 nav items ──
// Home → News → Farmers → Harvest (encode for farmers) → Reports
const BRGY_NAV = [
  { label: 'Home',          path: '/brgy',                 icon: Home        },
  { label: 'News',          path: '/brgy/announcements',   icon: Megaphone   },
  { label: 'Poll',          path: '/brgy/poll',            icon: Sprout      },
  { label: 'Farmers',       path: '/brgy/farmers',         icon: Users       },
  { label: 'Beneficiaries', path: '/brgy/beneficiaries',   icon: Package     },
  { label: 'Distribution',  path: '/brgy/distribution',    icon: Truck       },
  { label: 'Harvest',       path: '/brgy/harvest',         icon: Wheat       },
  { label: 'Reports',       path: '/brgy/reports',         icon: FileText    },
];

// ── EXPORTED MAP: role string → nav array ──
// Used in UserLayout.jsx: USER_NAV[role]
export const USER_NAV = {
  FARMER: FARMER_NAV,
  AT:     AT_NAV,
  BRGY:   BRGY_NAV,
};

// ── ROLE COLORS ──
// Each role gets its own accent color for the header and active states.
// Farmer = green (nature), AT = blue (technical), Brgy = warm green
export const ROLE_COLORS = {
  FARMER: { primary: '#1a4d1a', accent: '#f5c842' },  // dark green
  AT:     { primary: '#1e4d35', accent: '#f5c842' },  // teal green
  BRGY:   { primary: '#2d4d1a', accent: '#f5c842' },  // olive green
};

// ── ROLE LABELS ──
export const ROLE_LABELS = {
  FARMER: 'Farmer',
  AT:     'Agricultural Technician',
  BRGY:   'Barangay President',
};