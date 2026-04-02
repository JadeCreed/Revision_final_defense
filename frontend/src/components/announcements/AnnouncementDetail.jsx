import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getAnnouncementDetail } from '../../api/axios';
import { ROLE_COLORS } from '../navigation/UserNavConfig';

const AnnouncementDetail = () => {
  const { id }       = useParams();     // announcement ID from URL
  const navigate     = useNavigate();
  const location     = useLocation();
  const { role }     = useAuth();

  const colors = ROLE_COLORS[role] || ROLE_COLORS.FARMER;

  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // ── SLIDE ANIMATION ──
  // We use a CSS class toggle to trigger slide in/out.
  // On mount: slides in from right
  // On back: slides out to right then navigates
  const [slideClass, setSlideClass] = useState('slide-enter');

  // Where to go back — determined by referrer
  // If user came from dashboard → go back to dashboard
  // If user came from announcements list → go back to list
  const getBackPath = () => {
    const role_lower = role?.toLowerCase();
    // location.state.from is set when navigating to detail
    if (location.state?.from) return location.state.from;
    // Default fallback: go to announcements list
    return `/${role_lower}/announcements`;
  };

  // ── FETCH ANNOUNCEMENT ──
  // Calling this endpoint also marks the announcement as READ
  // (handled automatically in UserAnnouncementDetailView)
  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await getAnnouncementDetail(id);
        setAnnouncement(res.data);
      } catch {
        setError('Announcement not found or no longer available.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  // ── TRIGGER SLIDE IN on mount ──
  useEffect(() => {
    // Small delay so the browser renders the initial state first
    const timer = setTimeout(() => {
      setSlideClass('slide-enter-active');
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  // ── HANDLE BACK ──
  // Trigger slide-out animation THEN navigate
  const handleBack = () => {
    setSlideClass('slide-exit-active'); // trigger slide out
    setTimeout(() => {
      navigate(getBackPath());
    }, 280); // wait for animation to finish (matches CSS duration)
  };

  // Format role label for display
  const roleLabels = {
    ALL:    'All Users',
    FARMER: 'Farmers',
    AT:     'Agricultural Technicians',
    BRGY:   'Barangay Presidents',
  };

  return (
    <>
      {/* ── SLIDE ANIMATION STYLES ── */}
      {/* Injected as a style tag so no extra CSS file needed */}
      <style>{`
        .slide-enter {
          transform: translateX(100%);
          opacity: 0;
        }
        .slide-enter-active {
          transform: translateX(0);
          opacity: 1;
          transition: transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      opacity 280ms ease;
        }
        .slide-exit-active {
          transform: translateX(100%);
          opacity: 0;
          transition: transform 280ms cubic-bezier(0.55, 0.055, 0.675, 0.19),
                      opacity 280ms ease;
        }
      `}</style>

      <div
        className={slideClass}
        style={{
          minHeight:       '100vh',
          backgroundColor: '#f8fafc',
        }}
      >

        {/* ── STICKY HEADER with back arrow ── */}
        <div style={{
          position:        'sticky',
          top:             0,
          backgroundColor: colors.primary,
          padding:         '0.875rem 1.25rem',
          display:         'flex',
          alignItems:      'center',
          gap:             '0.75rem',
          zIndex:          10,
          boxShadow:       '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {/* Back arrow button */}
          <button
            onClick={handleBack}
            style={{
              background:  'none',
              border:      'none',
              cursor:      'pointer',
              padding:     '0.25rem',
              display:     'flex',
              alignItems:  'center',
              borderRadius:'50%',
              transition:  'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {/* Left arrow SVG */}
            <svg
              width="22" height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <span style={{
            color:      'white',
            fontWeight: 700,
            fontSize:   '1rem',
          }}>
            Announcement
          </span>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: '1.25rem' }}>

          {/* Loading state */}
          {loading && (
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        '4rem',
              color:          '#9ca3af',
            }}>
              Loading...
            </div>
          )}

          {/* Error state */}
          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              color:           '#991b1b',
              padding:         '1rem',
              borderRadius:    '0.75rem',
              fontSize:        '0.875rem',
              textAlign:       'center',
            }}>
              {error}
            </div>
          )}

          {/* Announcement content */}
          {!loading && !error && announcement && (
            <div>

              {/* Day + Month header */}
              <div style={{
                display:        'flex',
                alignItems:     'center',
                gap:            '1rem',
                marginBottom:   '1.25rem',
              }}>
                {/* Large day box */}
                <div style={{
                  width:           '64px',
                  height:          '64px',
                  backgroundColor: colors.primary,
                  borderRadius:    '0.875rem',
                  display:         'flex',
                  flexDirection:   'column',
                  alignItems:      'center',
                  justifyContent:  'center',
                  flexShrink:      0,
                }}>
                  <span style={{
                    fontSize:   '1.75rem',
                    fontWeight: 800,
                    color:      'white',
                    lineHeight: 1,
                  }}>
                    {announcement.day_number}
                  </span>
                  <span style={{
                    fontSize:      '0.6rem',
                    color:         'rgba(255,255,255,0.75)',
                    fontWeight:    600,
                    textTransform: 'uppercase',
                  }}>
                    {announcement.formatted_date?.split(' ')[0]}
                  </span>
                </div>

                {/* Date + meta info */}
                <div>
                  <p style={{
                    fontSize:   '0.8rem',
                    color:      '#6b7280',
                    margin:     0,
                  }}>
                    {announcement.formatted_date}
                  </p>
                  <p style={{
                    fontSize:   '0.75rem',
                    color:      '#9ca3af',
                    margin:     '0.2rem 0 0',
                  }}>
                    {announcement.time_ago}
                  </p>
                  <p style={{
                    fontSize:   '0.75rem',
                    color:      '#9ca3af',
                    margin:     '0.2rem 0 0',
                  }}>
                    Posted by: {announcement.posted_by_name}
                  </p>
                </div>
              </div>

              {/* Title */}
              <h1 style={{
                fontSize:     '1.25rem',
                fontWeight:   800,
                color:        '#1a1a1a',
                marginBottom: '0.5rem',
                lineHeight:   1.3,
              }}>
                {announcement.title}
              </h1>

              {/* Target info pills */}
              <div style={{
                display:      'flex',
                gap:          '0.5rem',
                flexWrap:     'wrap',
                marginBottom: '1.25rem',
              }}>
                {/* Target role pill */}
                <span style={{
                  backgroundColor: '#f0fdf4',
                  color:           colors.primary,
                  fontSize:        '0.72rem',
                  fontWeight:      600,
                  padding:         '3px 10px',
                  borderRadius:    '999px',
                  border:          `1px solid ${colors.primary}30`,
                }}>
                  {roleLabels[announcement.target_role] || announcement.target_role}
                </span>

                {/* Barangay pills */}
                {announcement.target_barangays_list?.length > 0
                  ? announcement.target_barangays_list.map(b => (
                    <span key={b} style={{
                      backgroundColor: '#f9fafb',
                      color:           '#6b7280',
                      fontSize:        '0.72rem',
                      fontWeight:      500,
                      padding:         '3px 10px',
                      borderRadius:    '999px',
                      border:          '1px solid #e5e7eb',
                    }}>
                      {b}
                    </span>
                  ))
                  : (
                    <span style={{
                      backgroundColor: '#f9fafb',
                      color:           '#6b7280',
                      fontSize:        '0.72rem',
                      fontWeight:      500,
                      padding:         '3px 10px',
                      borderRadius:    '999px',
                      border:          '1px solid #e5e7eb',
                    }}>
                      All Barangays
                    </span>
                  )
                }
              </div>

              {/* Divider */}
              <div style={{
                height:       '1px',
                backgroundColor: '#e5e7eb',
                marginBottom: '1.25rem',
              }} />

              {/* Full content */}
              <div style={{
                fontSize:   '0.9rem',
                color:      '#374151',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap', // preserves line breaks from admin input
              }}>
                {announcement.content}
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AnnouncementDetail;