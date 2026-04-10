// src/components/poll/PollCard.jsx
// ============================================================
// Reusable poll summary card — shown on Farmer and BRGY dashboards.
// Clicking navigates to the full poll page.
//
// Props:
//   poll      {object}   — poll data from API
//   onClick   {function} — navigate to full poll page
//   roleColor {string}   — role primary color for accents
// ============================================================

import { ChevronRight, Vote, Lock, CheckCircle } from 'lucide-react';

const PollCard = ({ poll, onClick, roleColor = '#1a4d1a' }) => {
  if (!poll) return null;

  // ✅ Fixed: no semicolon before [poll.status]
  // This is an object literal immediately accessed by key
  const statusConfig = {
    OPEN:   { label: 'Open',   color: '#166534', bg: '#dcfce7', dot: true  },
    LOCKED: { label: 'Locked', color: '#854d0e', bg: '#fef9c3', dot: false },
    CLOSED: { label: 'Closed', color: '#6b7280', bg: '#f3f4f6', dot: false },
  }[poll.status] || { label: poll.status, color: '#6b7280', bg: '#f3f4f6', dot: false };

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        borderRadius:    '1rem',
        padding:         '1.125rem',
        boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
        cursor:          onClick ? 'pointer' : 'default',
        border:          `1.5px solid ${poll.status === 'OPEN' ? '#bbf7d0' : '#e5e7eb'}`,
        transition:      'box-shadow 0.15s, transform 0.15s',
        marginBottom:    '0.75rem',
      }}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* ── Season + Status row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
        <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>
          {poll.season === 'WET' ? '💧' : '☀️'} {poll.season_display} {poll.year}
        </span>

        {/* Status pill with optional pulse dot for OPEN */}
        <span style={{
          display:         'inline-flex',
          alignItems:      'center',
          gap:             '0.3rem',
          backgroundColor: statusConfig.bg,
          color:           statusConfig.color,
          padding:         '0.2rem 0.625rem',
          borderRadius:    '999px',
          fontSize:        '0.7rem',
          fontWeight:      700,
        }}>
          {poll.status === 'OPEN' && (
            <span style={{
              width:           '6px',
              height:          '6px',
              borderRadius:    '50%',
              backgroundColor: '#22c55e',
              flexShrink:      0,
            }} />
          )}
          {poll.status === 'LOCKED' && <Lock size={10} />}
          {poll.status === 'CLOSED' && <CheckCircle size={10} />}
          {statusConfig.label}
        </span>
      </div>

      {/* ── Poll title ── */}
      <p style={{
        fontWeight:  700,
        color:       '#1a1a1a',
        margin:      '0 0 0.75rem',
        fontSize:    '0.95rem',
        lineHeight:  1.3,
      }}>
        {poll.title}
      </p>

      {/* ── Footer: vote status + arrow ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Vote size={14} color={roleColor} />
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            {poll.has_voted
              ? '✓ Voted'
              : poll.status === 'OPEN'
                ? 'Tap to vote'
                : 'View results'
            }
          </span>
        </div>
        {onClick && <ChevronRight size={16} color="#9ca3af" />}
      </div>
    </div>
  );
};

export default PollCard;