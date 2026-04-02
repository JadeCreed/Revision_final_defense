const AnnouncementCard = ({ announcement, onClick, roleColor = '#1a4d1a' }) => {
  const {
    title,
    content,
    day_number,
    formatted_date,
    time_ago,
    is_new,
    is_read,
    target_barangays_list,
  } = announcement;

  // Show barangay in the card footer
  // If targeted to specific barangays, show first one + count
  // If empty (ALL), show "All Barangays"
  const barangayDisplay = target_barangays_list?.length > 0
    ? target_barangays_list.length === 1
      ? target_barangays_list[0]
      : `${target_barangays_list[0]} +${target_barangays_list.length - 1}`
    : 'All Barangays';

  // Truncate content to show only a short preview
  // Full content shown in detail page
  const contentPreview = content?.length > 80
    ? content.slice(0, 80) + '...'
    : content;

  return (
    <div
      onClick={onClick}
      style={{
        display:         'flex',
        alignItems:      'stretch',
        backgroundColor: 'white',
        borderRadius:    '0.875rem',
        border:          '1px solid #f0f0f0',
        boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
        cursor:          'pointer',
        overflow:        'hidden',
        transition:      'box-shadow 0.15s, transform 0.15s',
        marginBottom:    '0.75rem',
        // Highlight unread announcements with a subtle left border
        borderLeft:      is_new
          ? `3px solid ${roleColor}`
          : is_read
            ? '3px solid #e5e7eb'
            : '3px solid transparent',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow  = '0 4px 16px rgba(0,0,0,0.10)';
        e.currentTarget.style.transform  = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow  = '0 1px 4px rgba(0,0,0,0.06)';
        e.currentTarget.style.transform  = 'translateY(0)';
      }}
    >

      {/* ── LEFT BOX: Day number ── */}
      {/* Shows the calendar day the announcement was posted */}
      {/* e.g. Jan 25 → shows "25" */}
      <div style={{
        width:           '64px',
        flexShrink:      0,
        backgroundColor: roleColor,
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '1rem 0.5rem',
      }}>
        <span style={{
          fontSize:   '1.75rem',
          fontWeight: 800,
          color:      'white',
          lineHeight: 1,
        }}>
          {day_number}
        </span>
        {/* Small month abbreviation below the day */}
        <span style={{
          fontSize:   '0.6rem',
          color:      'rgba(255,255,255,0.75)',
          marginTop:  '0.2rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {/* Extract month from formatted_date: "Jan 25, 2026" → "Jan" */}
          {formatted_date?.split(' ')[0]}
        </span>
      </div>

      {/* ── MIDDLE: Content ── */}
      <div style={{
        flex:       1,
        padding:    '0.875rem 0.75rem',
        minWidth:   0, // prevents text overflow breaking layout
      }}>

        {/* Title row with NEW/READ badge */}
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '0.5rem',
          marginBottom: '0.25rem',
          flexWrap:   'wrap',
        }}>
          <span style={{
            fontWeight:   700,
            fontSize:     '0.9rem',
            color:        '#1a1a1a',
            lineHeight:   1.3,
            // Prevent very long titles from breaking layout
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            maxWidth:     '200px',
          }}>
            {title}
          </span>

          {/* NEW badge — yellow, shows if unread within 24 hours */}
          {is_new && (
            <span style={{
              backgroundColor: '#f5c842',
              color:           '#1a1a1a',
              fontSize:        '0.6rem',
              fontWeight:      700,
              padding:         '2px 7px',
              borderRadius:    '999px',
              letterSpacing:   '0.05em',
              flexShrink:      0,
            }}>
              NEW
            </span>
          )}

          {/* READ badge — gray, shows after user has read it */}
          {is_read && !is_new && (
            <span style={{
              backgroundColor: '#f3f4f6',
              color:           '#9ca3af',
              fontSize:        '0.6rem',
              fontWeight:      600,
              padding:         '2px 7px',
              borderRadius:    '999px',
              flexShrink:      0,
            }}>
              READ
            </span>
          )}
        </div>

        {/* Content preview */}
        <p style={{
          fontSize:   '0.78rem',
          color:      '#6b7280',
          margin:     '0 0 0.375rem',
          lineHeight: 1.4,
          // Clamp to 2 lines max
          display:         '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow:        'hidden',
        }}>
          {contentPreview}
        </p>

        {/* Footer: date • barangay */}
        <div style={{
          display:  'flex',
          gap:      '0.375rem',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
            {formatted_date}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#d1d5db' }}>•</span>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
            {barangayDisplay}
          </span>
        </div>

        {/* Time ago — "2 mins ago" */}
        <p style={{
          fontSize:  '0.68rem',
          color:     '#c4c4c4',
          margin:    '0.2rem 0 0',
        }}>
          {time_ago}
        </p>
      </div>

      {/* ── RIGHT: Chevron arrow ── */}
      <div style={{
        display:     'flex',
        alignItems:  'center',
        paddingRight:'0.875rem',
        paddingLeft: '0.25rem',
        flexShrink:  0,
      }}>
        <svg
          width="16" height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9ca3af"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

    </div>
  );
};

export default AnnouncementCard;