import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation }          from 'react-router-dom';
import { useAuth }                           from '../../auth/AuthContext';
import { getAnnouncements }                  from '../../api/axios';
import { ROLE_COLORS }                       from '../navigation/UserNavConfig';
import AnnouncementCard                      from './AnnouncementCard';

const AnnouncementsListPage = ({ basePath }) => {
  // basePath example: '/farmer/announcements'
  // Used to build the detail URL: basePath + '/' + id

  const { role }  = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const colors    = ROLE_COLORS[role] || ROLE_COLORS.FARMER;

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [search, setSearch]               = useState('');

  // ── FETCH ANNOUNCEMENTS ──
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;

      const res = await getAnnouncements(params);
      setAnnouncements(res.data);
    } catch {
      setError('Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // ── HANDLE CARD CLICK ──
  // Navigate to detail page and pass current path as 'from'
  // so detail page knows where to go back to
  const handleCardClick = (id) => {
    navigate(`${basePath}/${id}`, {
      state: { from: location.pathname }  // ← detail page uses this for back button
    });
  };

  return (
    <div style={{ padding: '1.25rem' }}>

      {/* Page header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{
          fontSize:   '1.5rem',
          fontWeight: 800,
          color:      '#1a1a1a',
          margin:     0,
        }}>
          Announcements
        </h1>
        <p style={{
          color:     '#9ca3af',
          fontSize:  '0.8rem',
          margin:    '0.25rem 0 0',
        }}>
          Updates and news from the MAO
        </p>
      </div>

      {/* Search bar */}
      <div style={{
        position:        'relative',
        marginBottom:    '1.25rem',
      }}>
        {/* Search icon */}
        <svg
          style={{
            position: 'absolute',
            left:     '0.875rem',
            top:      '50%',
            transform:'translateY(-50%)',
          }}
          width="16" height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9ca3af"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          placeholder="Search announcements..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width:        '100%',
            padding:      '0.625rem 0.875rem 0.625rem 2.5rem',
            border:       '1.5px solid #e5e7eb',
            borderRadius: '0.75rem',
            fontSize:     '0.875rem',
            outline:      'none',
            backgroundColor: 'white',
            boxSizing:    'border-box',
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          color:           '#991b1b',
          padding:         '0.75rem',
          borderRadius:    '0.75rem',
          fontSize:        '0.875rem',
          marginBottom:    '1rem',
        }}>
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height:          '90px',
              backgroundColor: '#f3f4f6',
              borderRadius:    '0.875rem',
              marginBottom:    '0.75rem',
              // Pulse animation
              animation:       'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50%       { opacity: 0.5; }
            }
          `}</style>
        </div>
      )}

      {/* Empty state */}
      {!loading && announcements.length === 0 && (
        <div style={{
          textAlign:       'center',
          padding:         '3rem 1.5rem',
          backgroundColor: 'white',
          borderRadius:    '1rem',
          boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📢</div>
          <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.25rem' }}>
            No announcements yet
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
            {search
              ? 'No results found. Try a different search.'
              : 'Check back here for updates from the admin.'
            }
          </p>
        </div>
      )}

      {/* Announcement cards */}
      {!loading && announcements.map(ann => (
        <AnnouncementCard
          key={ann.id}
          announcement={ann}
          onClick={() => handleCardClick(ann.id)}
          roleColor={colors.primary}
        />
      ))}

    </div>
  );
};

export default AnnouncementsListPage;