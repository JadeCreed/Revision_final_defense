import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  Users, Tractor, ClipboardList, MapPin,
  ChevronRight, Wheat,
} from 'lucide-react';

const QUICK_ACTIONS = [
  {
    label:     'My Assigned Farmers',
    subLabel:  'View and manage farmers in your barangays',
    icon:      Users,
    path:      '/at/farmers',
    iconBg:    '#dcfce7',
    iconColor: '#166534',
  },
  {
    label:     'Crop Monitoring',
    subLabel:  'Record and update crop phases per barangay',
    icon:      Tractor,
    path:      '/at/crop-monitoring',
    iconBg:    '#dbeafe',
    iconColor: '#1e40af',
  },
  {
    label:     'Submit Report',
    subLabel:  'Send field report to admin',
    icon:      ClipboardList,
    path:      '/at/reports',
    iconBg:    '#fef9c3',
    iconColor: '#854d0e',
  },
  {
    label:     'GIS Map',
    subLabel:  'View barangay crop phase map',
    icon:      MapPin,
    path:      '/at/gis',
    iconBg:    '#f3e8ff',
    iconColor: '#7c3aed',
  },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const ATDashboard = () => {
  const { firstName } = useAuth();
  const navigate      = useNavigate();

  return (
    <div style={{ padding: '1.25rem' }}>

      {/* ── GREETING ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {getGreeting()},
        </p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a1a1a', margin: '0.125rem 0 0.25rem', lineHeight: 1.2 }}>
          {firstName || 'AT'} 👨‍🌾
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
          Agricultural Technician — AGRICE Lucban
        </p>
      </div>

      {/* ── SEASON BANNER ──
          This will show the current active crop phase season
          once the crop_phase feature is built. For now it's
          a static info card. */}
      <div style={{
        backgroundColor: '#dcfce7',
        borderRadius:    '1rem',
        padding:         '1rem 1.125rem',
        marginBottom:    '1.375rem',
        border:        '1px solid #bbf7d0',
        display:         'flex',
        alignItems:      'center',
        gap:             '0.75rem',
      }}>
        <Wheat size={24} color="#166534" />
        <div>
          <p style={{ fontWeight: 700, color: '#1e40af', margin: 0, fontSize: '0.875rem' }}>
            📋 Active Season
          </p>
          <p style={{ color: '#1e40af', opacity: 0.8, margin: '0.125rem 0 0', fontSize: '0.78rem' }}>
            Record crop phases for your assigned barangays.
          </p>
        </div>
      </div>

      {/* ── QUICK ACTIONS — vertical list for AT ──
          AT actions are more task-focused so vertical list
          is clearer than a 2x2 grid */}
      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.75rem' }}>
          Your Tasks
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  gap:             '1rem',
                  padding:         '0.875rem 1rem',
                  backgroundColor: 'white',
                  borderRadius:    '0.875rem',
                  border:          '1px solid #f3f4f6',
                  cursor:          'pointer',
                  boxShadow:       '0 1px 3px rgba(0,0,0,0.05)',
                  textAlign:       'left',
                  width:           '100%',
                  transition:      'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}
              >
                {/* Icon */}
                <div style={{ width: 44, height: 44, backgroundColor: action.iconBg, borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={action.iconColor} />
                </div>

                {/* Labels */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, color: '#1a1a1a', margin: 0, fontSize: '0.9rem' }}>
                    {action.label}
                  </p>
                  <p style={{ color: '#9ca3af', margin: '0.125rem 0 0', fontSize: '0.75rem' }}>
                    {action.subLabel}
                  </p>
                </div>

                <ChevronRight size={16} color="#9ca3af" />
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default ATDashboard;