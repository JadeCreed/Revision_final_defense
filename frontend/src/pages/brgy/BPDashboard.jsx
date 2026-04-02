import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  Users, Megaphone, Wheat, FileText,
  ChevronRight, ClipboardList,
} from 'lucide-react';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const QUICK_ACTIONS = [
  {
    label:     'My Barangay Farmers',
    subLabel:  'View and manage farmers + signing list',
    icon:      Users,
    path:      '/brgy/farmers',
    iconBg:    '#dcfce7',
    iconColor: '#166534',
  },
  {
    label:     'Announcements',
    subLabel:  'View news and updates from admin',
    icon:      Megaphone,
    path:      '/brgy/announcements',
    iconBg:    '#dbeafe',
    iconColor: '#1e40af',
  },
  {
    label:     'Encode Harvest Data',
    subLabel:  "Encode harvest for farmers without phones",
    icon:      Wheat,
    path:      '/brgy/harvest',
    iconBg:    '#fef9c3',
    iconColor: '#854d0e',
  },
  {
    label:     'Submit Report',
    subLabel:  'Send distribution or harvest report',
    icon:      FileText,
    path:      '/brgy/reports',
    iconBg:    '#f3e8ff',
    iconColor: '#7c3aed',
  },
];

const BPDashboard = () => {
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
          {firstName || 'President'} 🏛️
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
          Barangay President — AGRICE Lucban
        </p>
      </div>

      {/* ── INFO BANNER ── */}
      <div style={{
        backgroundColor: '#dcfce7',
        borderRadius:    '1rem',
        padding:         '1rem 1.125rem',
        marginBottom:    '1.375rem',
        border:          '1px solid #bbf7d0',
        display:         'flex',
        alignItems:      'center',
        gap:             '0.75rem',
      }}>
        <ClipboardList size={24} color="#166534" />
        <div>
          <p style={{ fontWeight: 700, color: '#166534', margin: 0, fontSize: '0.875rem' }}>
            📋 Distribution Season
          </p>
          <p style={{ color: '#166534', opacity: 0.8, margin: '0.125rem 0 0', fontSize: '0.78rem' }}>
            Confirm seed receipts and facilitate farmer signing.
          </p>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div>
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
                <div style={{ width: 44, height: 44, backgroundColor: action.iconBg, borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={action.iconColor} />
                </div>
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

export default BPDashboard;