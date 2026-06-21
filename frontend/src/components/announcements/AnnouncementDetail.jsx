// src/components/announcements/AnnouncementDetail.jsx
// ============================================================
// OPTION A: Full screen overlay — covers UserLayout completely
// Uses React Portal to render outside the layout DOM tree
// ============================================================

import { useState, useEffect }  from 'react';
import { createPortal }         from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth }              from '../../auth/AuthContext';
import { getAnnouncementDetail, getBrgyMyAllocation, brgyConfirmAllocation, createAnnouncement } from '../../api/axios';
import { ROLE_COLORS }          from '../navigation/UserNavConfig';
import { CheckCircle }          from 'lucide-react';

const AnnouncementDetail = () => {
  // ── 1. HOOK DECLARATIONS (Sa pinakataas ng component) ──
  const { id }    = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { role }  = useAuth();

  const colors = ROLE_COLORS[role] || ROLE_COLORS.FARMER;

  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [slideClass, setSlideClass]     = useState('ann-slide-enter');

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmSaving, setConfirmSaving]       = useState(false);
  const [brgyAllocDetails, setBrgyAllocDetails] = useState(null);
  const [brgyAllocLoading, setBrgyAllocLoading] = useState(false);
  const [distTitle, setDistTitle]               = useState('');
  
  // Structured inputs para sa ligtas na scheduling
  const [distDate, setDistDate]                 = useState('');
  const [distTime, setDistTime]                 = useState('');
  const [distVenue, setDistVenue]               = useState('Barangay Hall / Multi-Purpose Center');

  // ── 2. COMPUTED VARIABLES ──
  const isConfirmAllocationUrl = announcement?.action_url?.startsWith('confirm-allocation-id:');
  const deliveryId = isConfirmAllocationUrl ? announcement.action_url.split(':')[1] : null;
  const isAlreadyConfirmed = brgyAllocDetails?.alloc_status === 'CONFIRMED';

  // Determine back path from navigation state
  const getBackPath = () => {
    if (location.state?.from) return location.state.from;
    return `/${role?.toLowerCase()}/announcements`;
  };

  // Back with slide out animation
  const handleBack = () => {
    setSlideClass('ann-slide-exit-active');
    setTimeout(() => navigate(getBackPath()), 280);
  };

  // ── 3. EFFECTS ──
  // Fetch announcement detail on mount
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

  // Fetch allocation details on mount once deliveryId is resolved
  useEffect(() => {
    if (deliveryId) {
      setBrgyAllocLoading(true);
      getBrgyMyAllocation()
        .then(res => {
          const list = res.data || [];
          const match = list.find(a => String(a.delivery_id) === String(deliveryId));
          if (match) {
            setBrgyAllocDetails(match);
            setDistTitle(`Seed Distribution Schedule — ${match.seed_type_name} (${match.variety_name})`);
          }
        })
        .catch(() => {})
        .finally(() => setBrgyAllocLoading(false));
    }
  }, [deliveryId]);

  // ── 4. CONFIRMATION & POSTING HANDLER ──
  const handleConfirmAndPost = async () => {
    if (!brgyAllocDetails || !deliveryId) return;
    
    if (!distDate || !distTime.trim() || !distVenue.trim()) {
      alert("Mangyaring sagutan ang lahat ng detalye para sa pamamahagi (Petsa, Oras, at Lugar).");
      return;
    }

    setConfirmSaving(true);
    try {
      const formattedDate = new Date(distDate + 'T00:00:00').toLocaleDateString('en-PH', { 
        month: 'long', day: 'numeric', year: 'numeric' 
      });

      const compiledContent = 
        `Magandang araw mga magsasaka!\n\n` +
        `Kami ay nagagalak na ipahatid na natanggap na natin ang ating alokasyon na ${brgyAllocDetails.bag_label} para sa ${brgyAllocDetails.seed_type_name} (${brgyAllocDetails.variety_name}) mula sa MAO.\n\n` +
        `Narito ang detalye para sa ating pamamahagi (distribution schedule):\n` +
        `• Araw/Petsa: ${formattedDate}\n` +
        `• Oras: ${distTime}\n` +
        `• Lugar/Venue: ${distVenue}\n\n` +
        `Mangyaring magdala ng inyong Valid ID o RSBSA Stub para sa pag-verify ng inyong account. Kita-kits!`;

      // 1. Confirm allocation sa backend database
      await brgyConfirmAllocation({
        delivery_id:    Number(deliveryId),
        allocated_bags: brgyAllocDetails.allocated_bags,
      });

      // 2. Post BP custom announcement para sa mga Farmers ng kanyang sariling Barangay
      await createAnnouncement({
        title: distTitle,
        content: compiledContent,
        target_role: 'FARMER',
        target_barangays_list: [role === 'BRGY' ? announcement.target_barangays_list[0] : ''],
        is_active: true,
      });

      setConfirmModalOpen(false);
      navigate('/brgy');
    } catch (err) {
      alert('Failed to process confirmation: ' + (err.response?.data?.error || err.message));
    } finally {
      setConfirmSaving(false);
    }
  };

  // ── 5. PORTAL CONTENT JSX ──
  const content = (
    <>
      <div className={slideClass}>

        {/* STICKY HEADER */}
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
          maxWidth:        '480px',
          margin:          '0 auto',
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
            Announcement
          </span>
        </div>

        {/* PAGE CONTENT */}
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

              {/* DATE HEADER CARD */}
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

              {/* TITLE + CONTENT CARD */}
              <div style={{
                backgroundColor: 'white',
                borderRadius:    '1rem',
                padding:         '1.25rem',
                boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
                marginBottom:    '1rem',
              }}>
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
                      
                      if (url.startsWith('confirm-allocation-id:')) {
                        setConfirmModalOpen(true);
                        return;
                      }

                      if (url.startsWith('/')) {
                        navigate(url);
                      } else {
                        window.open(url, '_blank', 'noopener');
                      }
                    }}
                    disabled={isAlreadyConfirmed}
                    style={{
                      display:        'block',
                      width:          '100%',
                      marginTop:      '1.25rem',
                      padding:        '0.95rem 1rem',
                      border:         'none',
                      borderRadius:   '0.95rem',
                      backgroundColor: isAlreadyConfirmed ? '#d1d5db' : colors.primary,
                      color:          'white',
                      fontSize:       '0.95rem',
                      fontWeight:     700,
                      cursor:         isAlreadyConfirmed ? 'not-allowed' : 'pointer',
                      textAlign:      'center',
                    }}
                  >
                    {isConfirmAllocationUrl && isAlreadyConfirmed
                      ? "DONE"
                      : announcement.action_title
                    }
                  </button>
                )}
              </div>

              <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                <span style={{ backgroundColor: '#f0fdf4', color: '#166534', fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px', borderRadius: '999px', border: '1px solid #bbf7d0' }}>
                  ✓ Marked as read
                </span>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );

  const portalContent = (
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
      {content}

      {/* CONFIRM ALLOCATION & CREATE DISTRIBUTION ANNOUNCEMENT MODAL */}
      {confirmModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1.25rem', padding: '1.75rem', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', animation: 'notifFadeIn 0.3s ease' }}>
            <h3 style={{ fontWeight: 800, margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#1a1a1a' }}>Confirm & Distribute Seeds</h3>
            
            {brgyAllocLoading ? (
              <p style={{ fontSize: '0.85rem', color: '#6b7280', padding: '1rem 0', textAlign: 'center' }}>Fetching allocation data...</p>
            ) : brgyAllocDetails ? (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#166534', margin: '0 0 0.25rem' }}>Computed bags for your Barangay:</p>
                  <p style={{ fontSize: '1.35rem', fontWeight: 800, color: '#14532d', margin: 0 }}>{brgyAllocDetails.bag_label}</p>
                  <p style={{ fontSize: '0.75rem', color: '#166534', margin: '0.25rem 0 0' }}>{brgyAllocDetails.farmer_count} farmers · {brgyAllocDetails.total_hectares} ha · {brgyAllocDetails.season_display} {brgyAllocDetails.year}</p>
                </div>

                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Announcement Title for Farmers</label>
                  <input type="text" value={distTitle} onChange={e => setDistTitle(e.target.value)} style={{ padding: '0.625rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                {/* Structured Form Fields for Distribution Schedule */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Date of Distribution *</label>
                    <input type="date" value={distDate} onChange={e => setDistDate(e.target.value)} style={{ padding: '0.625rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Time of Distribution *</label>
                    <input type="text" placeholder="e.g., 8:00 AM - 12:00 PM" value={distTime} onChange={e => setDistTime(e.target.value)} style={{ padding: '0.625rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Lugar / Venue *</label>
                    <input type="text" placeholder="e.g., Barangay Hall / Multi-Purpose Center" value={distVenue} onChange={e => setDistVenue(e.target.value)} style={{ padding: '0.625rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#dc2626', marginBottom: '1rem', textAlign: 'center' }}>No approved beneficiary list found for this variety in your barangay.</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmModalOpen(false)} style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>Cancel</button>
              <button
                onClick={handleConfirmAndPost}
                disabled={confirmSaving || !brgyAllocDetails}
                style={{ flex: 2, padding: '0.75rem', backgroundColor: (confirmSaving || !brgyAllocDetails) ? '#d1d5db' : colors.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.875rem', cursor: (confirmSaving || !brgyAllocDetails) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}
              >
                <CheckCircle size={16} /> {confirmSaving ? 'Processing...' : 'Confirm & Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(portalContent, document.body);
};

export default AnnouncementDetail;