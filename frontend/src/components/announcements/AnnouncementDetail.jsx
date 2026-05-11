// src/components/announcements/AnnouncementDetail.jsx
// ============================================================
// OPTION A: Full screen overlay — covers UserLayout completely
// Uses React Portal to render outside the layout DOM tree
// 
// CHANGES:
// 1. Uses createPortal to render over everything including navbar
// 2. Farmers/AT/BRGY don't see target role or barangay info
// 3. Better visual design
// 4. Slide animation preserved
// ============================================================

import { useState, useEffect }  from 'react';
import { createPortal }         from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth }              from '../../auth/AuthContext';
import { getAnnouncementDetail } from '../../api/axios';
import { ROLE_COLORS }          from '../navigation/UserNavConfig';

const AnnouncementDetail = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { role }  = useAuth();

  const colors = ROLE_COLORS[role] || ROLE_COLORS.FARMER;

  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [slideClass, setSlideClass]     = useState('ann-slide-enter');

  // Determine back path from navigation state
  const getBackPath = () => {
    if (location.state?.from) return location.state.from;
    return `/${role?.toLowerCase()}/announcements`;
  };

  // Fetch announcement — this also auto-marks as READ on the backend
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getAnnouncementDetail(id);
        setAnnouncement(res.data);
      } catch {
        setError('Announcement not found or no longer available.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  // Slide in on mount
  useEffect(() => {
    const t = setTimeout(() => setSlideClass('ann-slide-enter-active'), 10);
    return () => clearTimeout(t);
  }, []);

  // Back with slide out animation
  const handleBack = () => {
    setSlideClass('ann-slide-exit-active');
    setTimeout(() => navigate(getBackPath()), 280);
  };

  // ── PORTAL CONTENT ──
  // Rendered into document.body so it sits ABOVE everything
  // including UserLayout's sticky header
  const content = (
    <>
      <style>{`
        /* Slide in from right */
        .ann-slide-enter {
          position: fixed;
          inset: 0;
          transform: translateX(100%);
          opacity: 0;
          z-index: 999;
          background: #f8fafc;
          overflow-y: auto;
        }
        .ann-slide-enter-active {
          position: fixed;
          inset: 0;
          transform: translateX(0);
          opacity: 1;
          z-index: 999;
          background: #f8fafc;
          overflow-y: auto;
          transition: transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      opacity 280ms ease;
        }
        /* Slide out to right */
        .ann-slide-exit-active {
          position: fixed;
          inset: 0;
          transform: translateX(100%);
          opacity: 0;
          z-index: 999;
          background: #f8fafc;
          overflow-y: auto;
          transition: transform 280ms cubic-bezier(0.55, 0.055, 0.675, 0.19),
                      opacity 200ms ease;
        }
      `}</style>

      <div className={slideClass}>

        {/* ── STICKY HEADER ── */}
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
          // Max width for mobile-first consistency
          maxWidth:        '480px',
          margin:          '0 auto',
          // Full width on desktop
          width:           '100%',
          boxSizing:       'border-box',
        }}>
          <button
            onClick={handleBack}
            style={{
              background:   'none',
              border:       'none',
              cursor:       'pointer',
              padding:      '0.375rem',
              borderRadius: '50%',
              display:      'flex',
              alignItems:   'center',
              transition:   'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {/* Left arrow */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
            Announcement
          </span>
        </div>

        {/* ── PAGE CONTENT — centered for mobile ── */}
        <div style={{
          maxWidth: '480px',
          margin:   '0 auto',
          padding:  '1.25rem',
        }}>

          {/* Loading */}
          {loading && (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af' }}>
              Loading...
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              color:           '#991b1b',
              padding:         '1rem',
              borderRadius:    '0.75rem',
              textAlign:       'center',
              fontSize:        '0.875rem',
            }}>
              {error}
            </div>
          )}

          {/* Content */}
          {!loading && !error && announcement && (
            <div>

              {/* ── DATE HEADER CARD ── */}
              <div style={{
                backgroundColor: 'white',
                borderRadius:    '1rem',
                padding:         '1.25rem',
                boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
                marginBottom:    '1rem',
                display:         'flex',
                alignItems:      'center',
                gap:             '1rem',
              }}>
                {/* Day box */}
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
                    color:         'rgba(255,255,255,0.8)',
                    fontWeight:    600,
                    textTransform: 'uppercase',
                  }}>
                    {announcement.formatted_date?.split(' ')[0]}
                  </span>
                </div>

                {/* Date meta */}
                <div>
                  <p style={{
                    fontWeight: 700,
                    color:      '#1a1a1a',
                    margin:     0,
                    fontSize:   '0.9rem',
                  }}>
                    {announcement.formatted_date}
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                    {announcement.time_ago}
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0.2rem 0 0' }}>
                    Posted by {announcement.posted_by_name}
                  </p>
                </div>
              </div>

              {/* ── TITLE + CONTENT CARD ── */}
              <div style={{
                backgroundColor: 'white',
                borderRadius:    '1rem',
                padding:         '1.25rem',
                boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
                marginBottom:    '1rem',
              }}>
                {/* Title */}
                <h1 style={{
                  fontSize:     '1.2rem',
                  fontWeight:   800,
                  color:        '#1a1a1a',
                  marginBottom: '1rem',
                  lineHeight:   1.3,
                  paddingBottom:'0.875rem',
                  borderBottom: '1px solid #f3f4f6',
                }}>
                  {announcement.title}
                </h1>

                {/* Full content — preserves line breaks */}
                <div style={{
                  fontSize:   '0.9rem',
                  color:      '#374151',
                  lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                }}>
                  {announcement.content}
                </div>

                {announcement.action_title && announcement.action_url && (
                  <button
                    onClick={() => {
                      const url = announcement.action_url.trim();
                      if (!url) return;
                      if (url.startsWith('/')) {
                        navigate(url);
                      } else {
                        window.open(url, '_blank', 'noopener');
                      }
                    }}
                    style={{
                      display:        'block',
                      width:          '100%',
                      marginTop:      '1.25rem',
                      padding:        '0.95rem 1rem',
                      border:         'none',
                      borderRadius:   '0.95rem',
                      backgroundColor: colors.primary,
                      color:          'white',
                      fontSize:       '0.95rem',
                      fontWeight:     700,
                      cursor:         'pointer',
                      textAlign:      'center',
                    }}
                  >
                    {announcement.action_title}
                  </button>
                )}
              </div>

              {/* ── READ STATUS BADGE ── */}
              {/* Small subtle indicator at the bottom */}
              <div style={{
                textAlign: 'center',
                padding:   '0.5rem',
              }}>
                <span style={{
                  backgroundColor: '#f0fdf4',
                  color:           '#166534',
                  fontSize:        '0.72rem',
                  fontWeight:      600,
                  padding:         '4px 12px',
                  borderRadius:    '999px',
                  border:          '1px solid #bbf7d0',
                }}>
                  ✓ Marked as read
                </span>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );

  // Render into document.body via Portal
  // This ensures it sits ABOVE the UserLayout navbar
  return createPortal(content, document.body);
};

export default AnnouncementDetail;