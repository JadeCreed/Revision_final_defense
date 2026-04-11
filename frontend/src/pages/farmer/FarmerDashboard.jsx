import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate }    from 'react-router-dom';
import { useAuth }        from '../../auth/AuthContext';
import {
  Megaphone, Sprout, Wheat, UserCircle,
  ChevronRight, CheckCircle, Clock, XCircle, AlertCircle,
} from 'lucide-react';
import API, { getAnnouncements,getFinalSeeds } from '../../api/axios';
import AnnouncementCard   from '../../components/announcements/AnnouncementCard';

// ── Greeting based on time of day ──
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// ── localStorage key for tracking seen status notifications ──
// Format: agrice_status_seen_{userId}
// Stores the last status the user was notified about
// So we don't show the same notification twice
const getStatusSeenKey = (userId) => `agrice_status_seen_${userId}`;

// ── Status card config ──
// Each status has its own visual style and message
const STATUS_CONFIG = {
  PENDING: {
    icon:    Clock,
    color:   '#854d0e',
    bg:      '#fef9c3',
    border:  '#fde68a',
    iconBg:  '#fef3c7',
    label:   'Pending Review',
    message: 'Complete your profile to get started.',
    cta:     'Complete Profile',
    ctaPath: '/farmer/profile',
    // PENDING always stays visible — don't auto-dismiss
    autoDismiss: false,
  },
  COMPLETE: {
    icon:    AlertCircle,
    color:   '#1e40af',
    bg:      '#eff6ff',
    border:  '#bfdbfe',
    iconBg:  '#dbeafe',
    label:   'Awaiting Approval',
    message: 'Your profile has been submitted. Admin will review soon.',
    cta:     null,
    ctaPath: null,
    // COMPLETE stays visible — waiting for admin action
    autoDismiss: false,
  },
  APPROVED: {
    icon:    CheckCircle,
    color:   '#166534',
    bg:      '#f0fdf4',
    border:  '#bbf7d0',
    iconBg:  '#dcfce7',
    label:   'Account Approved!',
    message: "Congratulations! Your account has been approved. You can now use all features.",
    cta:     'Start Using App',
    ctaPath: '/farmer/announcements',
    // APPROVED auto-dismisses after user sees it
    autoDismiss: true,
    dismissDelay: 4000, // 4 seconds
  },
  REJECTED: {
    icon:    XCircle,
    color:   '#991b1b',
    bg:      '#fff1f2',
    border:  '#fecdd3',
    iconBg:  '#fee2e2',
    label:   'Application Rejected',
    message: 'Please contact the MAO office for assistance.',
    cta:     null,
    ctaPath: null,
    autoDismiss: false,
  },
};

// ── Quick action cards ──
const QUICK_ACTIONS = [
  {
    label:     'View Announcements',
    icon:      Megaphone,
    path:      '/farmer/announcements',
    iconBg:    '#dcfce7',
    iconColor: '#166534',
  },
  {
    label:     'Vote on Seed Poll',
    icon:      Sprout,
    path:      '/farmer/poll',
    iconBg:    '#dbeafe',
    iconColor: '#1e40af',
  },
  {
    label:     'Encode Harvest',
    icon:      Wheat,
    path:      '/farmer/harvest',
    iconBg:    '#fef9c3',
    iconColor: '#854d0e',
  },
  {
    label:     'My Profile',
    icon:      UserCircle,
    path:      '/farmer/profile',
    iconBg:    '#f3e8ff',
    iconColor: '#7c3aed',
  },
];

const FarmerDashboard = () => {
  const { firstName, token } = useAuth();
  const navigate             = useNavigate();

  // ── Profile status state ──
  const [status, setStatus]               = useState(null);
  const [userId, setUserId]               = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── Status card visibility ──
  // Controls whether the status card is shown at all
  // Once APPROVED card dismisses → this becomes false permanently
  const [showStatusCard, setShowStatusCard] = useState(true);

  // ── Dismissing animation ──
  // When APPROVED auto-dismiss fires, we fade out before hiding
  const [isDismissing, setIsDismissing] = useState(false);

  // ── Announcements state ──
  const [announcements, setAnnouncements]       = useState([]);
  const [announcementsLoading, setAnnLoading]   = useState(true);

  // Ref to track polling interval
  const pollRef = useRef(null);

  // ── FETCH PROFILE STATUS ──
  // Returns user status and id
  const fetchProfileStatus = useCallback(async () => {
    try {
      const res       = await API.get('/accounts/farmer-profile/');
      const newStatus = res.data.user?.status || 'PENDING';
      const newUserId = res.data.user?.id;

      setUserId(newUserId);
      setStatus(newStatus);

      // ── STATUS NOTIFICATION LOGIC ──
      // Check if user has already seen THIS status notification
      if (newUserId) {
        const seenKey    = getStatusSeenKey(newUserId);
        const seenStatus = localStorage.getItem(seenKey);

        if (newStatus === 'APPROVED' && seenStatus !== 'APPROVED') {
          // User hasn't seen the APPROVED notification yet
          // Show the card — it will auto-dismiss after delay
          setShowStatusCard(true);

          // Start auto-dismiss timer
          const config = STATUS_CONFIG.APPROVED;
          setTimeout(() => {
            // Start fade out animation
            setIsDismissing(true);
            // After animation completes, hide card permanently
            setTimeout(() => {
              setShowStatusCard(false);
              setIsDismissing(false);
              // Save to localStorage so it doesn't show again
              localStorage.setItem(seenKey, 'APPROVED');
            }, 500); // 500ms fade out animation
          }, config.dismissDelay);

        } else if (newStatus === 'APPROVED' && seenStatus === 'APPROVED') {
          // User already saw the approval — hide card permanently
          setShowStatusCard(false);

        } else if (newStatus === 'PENDING' || newStatus === 'COMPLETE') {
          // Always show for PENDING and COMPLETE
          setShowStatusCard(true);
          // Clear the seen status so if they get re-approved it shows again
          if (seenStatus) localStorage.removeItem(seenKey);

        } else if (newStatus === 'REJECTED') {
          // Always show rejection
          setShowStatusCard(true);
        }
      }

      return newStatus;
    } catch {
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // ── FETCH ANNOUNCEMENTS ──
  // Fetch regardless of account status — all farmers see announcements
  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await getAnnouncements({ limit: 3 });
      setAnnouncements(res.data || []);
    } catch {
      // Silent fail — dashboard should still load
    } finally {
      setAnnLoading(false);
    }
  }, []);

  // ── INITIAL LOAD ──
  useEffect(() => {
    fetchProfileStatus();
    fetchAnnouncements();
  }, [fetchProfileStatus, fetchAnnouncements]);

  // ── POLL FOR STATUS CHANGES every 30 seconds ──
  // Detects when admin approves while user is online
  useEffect(() => {
    // Only poll if status is still pending/complete (waiting for action)
    if (status === 'PENDING' || status === 'COMPLETE') {
      pollRef.current = setInterval(fetchProfileStatus, 30000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, fetchProfileStatus]);

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const StatusIcon   = statusConfig?.icon;

  // ── STYLES ──
  const sectionTitle = {
    fontSize:    '1rem',
    fontWeight:  '700',
    color:       '#1a1a1a',
    marginBottom:'0.125rem',
  };

  const sectionSub = {
    fontSize: '0.8rem',
    color:    '#9ca3af',
    margin:   0,
  };

  const [finalSeeds, setFinalSeeds] = useState([]);

  useEffect(() => {
  getFinalSeeds()
    .then(res => setFinalSeeds(res.data || []))
    .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '1.25rem', paddingBottom: '1rem' }}>

      {/* ── SECTION 1: GREETING ── */}
      <div style={{ marginBottom: '1.125rem' }}>
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
          {firstName || 'Farmer'} 👋
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
          Let's make farming productive today.
        </p>
      </div>


      {/* ── SECTION 2: STATUS CARD ──
          Only shows when:
          - Status is PENDING or COMPLETE (always show)
          - Status is APPROVED and user hasn't seen it yet
          - Status is REJECTED (always show)
          Hides permanently after APPROVED notification is seen
      ── */}
      {!profileLoading && showStatusCard && statusConfig && (
        <div style={{
          backgroundColor: statusConfig.bg,
          borderRadius:    '1rem',
          padding:         '1rem 1.125rem',
          marginBottom:    '1.25rem',
          border:          `1px solid ${statusConfig.border}`,
          display:         'flex',
          alignItems:      'center',
          gap:             '0.875rem',
          // Fade out animation when dismissing
          opacity:         isDismissing ? 0 : 1,
          transform:       isDismissing ? 'translateY(-8px)' : 'translateY(0)',
          transition:      'opacity 0.5s ease, transform 0.5s ease',
        }}>
          {/* Status icon */}
          <div style={{
            width:           44,
            height:          44,
            backgroundColor: statusConfig.iconBg,
            borderRadius:    '0.75rem',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
          }}>
            {StatusIcon && <StatusIcon size={22} color={statusConfig.color} />}
          </div>

          {/* Status text */}
          <div style={{ flex: 1 }}>
            <p style={{
              fontWeight: 700,
              color:      statusConfig.color,
              margin:     0,
              fontSize:   '0.9rem',
            }}>
              {statusConfig.label}
            </p>
            <p style={{
              color:      statusConfig.color,
              opacity:    0.8,
              margin:     '0.125rem 0 0',
              fontSize:   '0.78rem',
              lineHeight: 1.4,
            }}>
              {statusConfig.message}
            </p>
          </div>

          {/* CTA button */}
          {statusConfig.cta && (
            <button
              onClick={() => navigate(statusConfig.ctaPath)}
              style={{
                backgroundColor: statusConfig.color,
                color:           'white',
                border:          'none',
                borderRadius:    '0.625rem',
                padding:         '0.5rem 0.875rem',
                fontSize:        '0.75rem',
                fontWeight:      600,
                cursor:          'pointer',
                whiteSpace:      'nowrap',
                display:         'flex',
                alignItems:      'center',
                gap:             '0.25rem',
              }}
            >
              {statusConfig.cta}
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}


      {/* ── SECTION 3: QUICK ACTIONS ── */}
      <div style={{ marginBottom: '1.375rem' }}>
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   '0.875rem',
        }}>
          <div>
            <p style={sectionTitle}>Quick Actions</p>
            <p style={sectionSub}>Access common tasks quickly</p>
          </div>
        </div>

        {/* 2x2 grid */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: '1fr 1fr',
          gap:                 '0.75rem',
        }}>
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                style={{
                  display:         'flex',
                  flexDirection:   'column',
                  alignItems:      'flex-start',
                  padding:         '1rem',
                  backgroundColor: 'white',
                  borderRadius:    '1rem',
                  border:          '1px solid #f3f4f6',
                  cursor:          'pointer',
                  boxShadow:       '0 1px 4px rgba(0,0,0,0.05)',
                  textAlign:       'left',
                  transition:      'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
                }}
              >
                <div style={{
                  width:           42,
                  height:          42,
                  backgroundColor: action.iconBg,
                  borderRadius:    '0.75rem',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  marginBottom:    '0.75rem',
                }}>
                  <Icon size={20} color={action.iconColor} />
                </div>
                <div style={{
                  display:     'flex',
                  alignItems:  'center',
                  justifyContent: 'space-between',
                  width:       '100%',
                }}>
                  <span style={{
                    fontSize:   '0.85rem',
                    fontWeight: 600,
                    color:      '#1a1a1a',
                    lineHeight: 1.3,
                  }}>
                    {action.label}
                  </span>
                  <ChevronRight size={14} color="#9ca3af" />
                </div>
              </button>
            );
          })}
        </div>
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


      {/* ── SECTION 4: UPDATES & REMINDERS ──
          Shows latest 3 announcements from the API.
          Fetches for ALL farmers regardless of account status.
          Empty state shown if no announcements yet.
      ── */}
      <div>
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   '0.875rem',
        }}>
          <div>
            <p style={sectionTitle}>Updates & Reminders</p>
            <p style={sectionSub}>Latest news from the admin</p>
          </div>
          <button
            onClick={() => navigate('/farmer/announcements')}
            style={{
              background:  'none',
              border:      'none',
              color:       '#166534',
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

        {/* Loading skeleton */}
        {announcementsLoading && (
          <div>
            {[1, 2].map(i => (
              <div key={i} style={{
                height:          '80px',
                backgroundColor: '#f3f4f6',
                borderRadius:    '0.875rem',
                marginBottom:    '0.75rem',
                animation:       'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
          </div>
        )}

        {/* Empty state */}
        {!announcementsLoading && announcements.length === 0 && (
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
              Check back here for updates from your admin.
            </p>
          </div>
        )}

        {/* Announcement cards */}
        {!announcementsLoading && announcements.map(ann => (
          <AnnouncementCard
            key={ann.id}
            announcement={ann}
            onClick={() => navigate(`/farmer/announcements/${ann.id}`, {
              state: { from: '/farmer' } // back arrow returns to home
            })}
            roleColor="#1a4d1a"
          />
        ))}
      </div>

    </div>
  );
};

export default FarmerDashboard;