// src/pages/at/ATDashboard.jsx

import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth }             from '../../auth/AuthContext';
import { getAnnouncements,getFinalSeeds }    from '../../api/axios';
import AnnouncementCard        from '../../components/announcements/AnnouncementCard';
import {
  Users, Tractor, ClipboardList, MapPin,
  ChevronRight, Wheat,
} from 'lucide-react';



// ── Greeting based on time of day ──
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// ── Quick action cards for AT ──
const QUICK_ACTIONS = [
  {
    id:       'at-farmers',
    label:    'My Assigned Farmers',
    subLabel: 'View and manage farmers in your barangays',
    icon:     Users,
    path:     '/at/farmers',
    iconBg:   '#dcfce7',
    iconColor:'#166534',
  },
  {
    id:       'crop-monitoring',
    label:    'Crop Monitoring',
    subLabel: 'Record and update crop phases per barangay',
    icon:     Tractor,
    path:     '/at/crop-monitoring',
    iconBg:   '#dbeafe',
    iconColor:'#1e40af',
  },
  {
    id:       'fill-masterlist',
    label:    'Fill Masterlist',
    subLabel: 'Complete the required masterlist fill-out',
    icon:     ClipboardList,
    path:     '/at/crop-monitoring',
    iconBg:   '#e0e7ff',
    iconColor:'#4338ca',
  },
  {
    id:       'submit-report',
    label:    'Submit Report',
    subLabel: 'Send field report to admin',
    icon:     ClipboardList,
    path:     '/at/reports',
    iconBg:   '#fef9c3',
    iconColor:'#854d0e',
  },
  {
    id:       'gis-map',
    label:    'GIS Map',
    subLabel: 'View barangay crop phase map',
    icon:     MapPin,
    path:     '/at/gis',
    iconBg:   '#f3e8ff',
    iconColor:'#7c3aed',
  },
];

// AT primary color — matches ROLE_COLORS.AT in UserNavConfig
const AT_COLOR = '#1e4d35';

const ATDashboard = () => {
  const { firstName } = useAuth();
  const navigate      = useNavigate();

  // ── Announcements state ──
  const [announcements, setAnnouncements]   = useState([]);
  const [annLoading, setAnnLoading]         = useState(true);

  // ── Fetch latest 3 announcements on mount ──
  useEffect(() => {
    getAnnouncements({ limit: 3 })
      .then(res => setAnnouncements(res.data || []))
      .catch(() => {})
      .finally(() => setAnnLoading(false));
  }, []); // empty deps — only runs once on mount

  const [finalSeeds, setFinalSeeds] = useState([]);

  useEffect(() => {
    getFinalSeeds()
      .then(res => setFinalSeeds(res.data || []))
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '1.25rem' }}>

      {/* ── GREETING ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {getGreeting()},
        </p>
        <h1 style={{
          fontSize:   '1.75rem',
          fontWeight: 800,
          color:      '#1a1a1a',
          margin:     '0.125rem 0 0.25rem',
          lineHeight: 1.2,
        }}>
          {firstName || 'AT'} 👨‍🌾
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
          Agricultural Technician — AGRICE Lucban
        </p>
      </div>

      {/* ── SEASON BANNER ──
          Will show real crop phase data once crop_phase feature is built.
          Static info card for now. */}
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
        <Wheat size={24} color="#166534" />
        <div>
          <p style={{ fontWeight: 700, color: '#166534', margin: 0, fontSize: '0.875rem' }}>
            📋 Active Season
          </p>
          <p style={{ color: '#166534', opacity: 0.8, margin: '0.125rem 0 0', fontSize: '0.78rem' }}>
            Record crop phases for your assigned barangays.
          </p>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ marginBottom: '1.375rem' }}>
        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.75rem' }}>
          Your Tasks
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
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
                <div style={{
                  width:           44,
                  height:          44,
                  backgroundColor: action.iconBg,
                  borderRadius:    '0.75rem',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  flexShrink:      0,
                }}>
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

      <div style={{
        backgroundColor: '#eff6ff',
        border:          '1px solid #bfdbfe',
        borderRadius:    '1rem',
        padding:         '1rem 1.25rem',
        marginBottom:    '1.375rem',
        display:         'flex',
        justifyContent:  'space-between',
        flexWrap:        'wrap',
        gap:             '1rem',
        alignItems:      'center',
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 700, color: '#1e3a8a', margin: 0, fontSize: '0.95rem' }}>
            Masterlist fill-out required
          </p>
          <p style={{ color: '#1e40af', margin: '0.35rem 0 0', fontSize: '0.88rem', lineHeight: 1.5 }}>
            You have assigned barangays that still need their crop monitoring masterlist completed. Tap below to continue.
          </p>
        </div>
        <button
          onClick={() => navigate('/at/crop-monitoring')}
          style={{
            backgroundColor: '#1e40af',
            color:           'white',
            border:          'none',
            borderRadius:    '0.875rem',
            padding:         '0.9rem 1.1rem',
            cursor:          'pointer',
            fontWeight:      700,
            minWidth:        170,
          }}
        >
          Open Masterlist
        </button>
      </div>

        {/* ── CONFIRMED SEED VARIETIES ── */}
          {finalSeeds.length > 0 && (
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '1rem',
              padding: '1.25rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.875rem' }}>
                <div style={{ width: '36px', height: '36px', backgroundColor: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem' }}>
                  🌾
                </div>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#166534', margin: 0 }}>
                    Confirmed Seed Varieties — {finalSeeds[0]?.season_display} {finalSeeds[0]?.year}
                  </h3>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {finalSeeds.map(fs => (
                  <div key={fs.id} style={{
                    backgroundColor: 'white',
                    borderRadius: '0.875rem',
                    padding: '0.875rem 1rem',
                    border: '1px solid #bbf7d0',
                  }}>
                    <p style={{ fontWeight: 800, fontSize: '0.85rem', color: '#166534' }}>
                      {fs.seed_type.name}
                    </p>

                    {fs.varieties.map(v => (
                      <span key={v.id} style={{
                        marginRight: '5px',
                        fontSize: '0.75rem'
                      }}>
                        {v.name}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}


      {/* ── UPDATES & REMINDERS ──
          Same pattern as FarmerDashboard.
          Shows latest 3 announcements targeted at AT role.
          Clicking a card navigates to detail page with back → /at */}
      <div>
        {/* Section header */}
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   '0.875rem',
        }}>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.125rem' }}>
              Updates & Reminders
            </p>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>
              Latest news from the MAO
            </p>
          </div>
          <button
            onClick={() => navigate('/at/announcements')}
            style={{
              background:  'none',
              border:      'none',
              color:       AT_COLOR,
              fontSize:    '0.8rem',
              fontWeight:  600,
              cursor:      'pointer',
              display:     'flex',
              alignItems:  'center',
              gap:         '0.125rem',
            }}
          >
            View All <ChevronRight size={14} />
          </button>
        </div>

        {/* Loading skeleton — 2 placeholder bars */}
        {annLoading && (
          <div>
            {[1, 2].map(i => (
              <div key={i} style={{
                height:          '80px',
                backgroundColor: '#f3f4f6',
                borderRadius:    '0.875rem',
                marginBottom:    '0.75rem',
                animation:       'atPulse 1.5s ease-in-out infinite',
              }} />
            ))}
            <style>{`
              @keyframes atPulse {
                0%, 100% { opacity: 1; }
                50%       { opacity: 0.5; }
              }
            `}</style>
          </div>
        )}

        {/* Empty state */}
        {!annLoading && announcements.length === 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius:    '1rem',
            padding:         '2rem 1.5rem',
            textAlign:       'center',
            boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📢</div>
            <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 0.25rem' }}>
              No announcements yet
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
              Check back here for updates from the MAO.
            </p>
          </div>
        )}

        {/* Announcement cards */}
        {!annLoading && announcements.map(ann => (
          <AnnouncementCard
            key={ann.id}
            announcement={ann}
            onClick={() => navigate(`/at/announcements/${ann.id}`, {
              // Pass current page as 'from' so back arrow returns here
              state: { from: '/at' }
            })}
            roleColor={AT_COLOR}
          />
        ))}
      </div>

    </div>
  );
};

export default ATDashboard;