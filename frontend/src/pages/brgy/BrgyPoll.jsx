// ============================================================
// Barangay President poll results page.
// Shows:
//   - Current poll info (season, year, status)
//   - Their barangay's total votes vs participation rate
//   - Hybrid variety breakdown (progress bars + numbers)
//   - Inbred variety breakdown (progress bars + numbers)
// BRGY can see their results regardless of poll status.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth }           from '../../auth/AuthContext';
import { getActivePoll, getBrgyPollResults } from '../../api/axios';
import { ROLE_COLORS }       from '../../components/navigation/UserNavConfig';
import {
  Wheat, Sprout, MapPin, Vote,
  Lock, CheckCircle, BarChart2
} from 'lucide-react';

// ── Progress bar ──
const ProgressBar = ({ percent, color, label, votes }) => (
  <div style={{ marginBottom: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>{label}</span>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color, fontSize: '0.875rem' }}>{votes}</span>
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>({percent}%)</span>
      </div>
    </div>
    <div style={{ width: '100%', height: '10px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{
        width:           `${percent}%`,
        height:          '100%',
        backgroundColor: color,
        borderRadius:    '999px',
        transition:      'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
    </div>
  </div>
);

const BrgyPoll = () => {
  const { role } = useAuth();
  const colors   = ROLE_COLORS[role] || ROLE_COLORS.BRGY;

  const [poll, setPoll]         = useState(null);
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Get active poll first
      const pollRes = await getActivePoll().catch(() => ({ data: null }));

      // If no active poll try getting latest
      if (!pollRes.data || pollRes.data.poll === null) {
        setPoll(null);
        setLoading(false);
        return;
      }

      setPoll(pollRes.data);

      // Get barangay results for this poll
      const resultsRes = await getBrgyPollResults(pollRes.data.id);
      setResults(resultsRes.data);
    } catch {
      setError('Failed to load poll results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ padding: '1.25rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height:          '100px',
            backgroundColor: '#f3f4f6',
            borderRadius:    '1rem',
            marginBottom:    '1rem',
            animation:       'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    );
  }

  // No poll
  if (!poll) {
    return (
      <div style={{ padding: '1.25rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem 1.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <Vote size={48} color="#d1d5db" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <h2 style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No Active Poll</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            There are no polls available right now.
          </p>
        </div>
      </div>
    );
  }

  const brgyData = results?.brgy_results;

  return (
    <div style={{ padding: '1.25rem', paddingBottom: '2rem' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          Seed Poll
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
          Voting results for your barangay
        </p>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* ── POLL INFO CARD ── */}
      <div style={{
        backgroundColor: colors.primary,
        borderRadius:    '1rem',
        padding:         '1.25rem',
        marginBottom:    '1.25rem',
        color:           'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span>{poll.season === 'WET' ? '💧' : '☀️'}</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.85 }}>
            {poll.season_display} {poll.year}
          </span>
          <span style={{
            marginLeft:      'auto',
            backgroundColor: poll.status === 'OPEN' ? 'rgba(34,197,94,0.25)' : 'rgba(249,115,22,0.25)',
            color:           poll.status === 'OPEN' ? '#86efac' : '#fed7aa',
            padding:         '0.2rem 0.75rem',
            borderRadius:    '999px',
            fontSize:        '0.72rem',
            fontWeight:      700,
          }}>
            {poll.status === 'OPEN' ? '● Open' : '🔒 Locked'}
          </span>
        </div>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', margin: 0, lineHeight: 1.3 }}>
          {poll.title}
        </h2>
      </div>

      {/* ── PARTICIPATION CARD ── */}
      {brgyData && (
        <div style={{
          backgroundColor: 'white',
          borderRadius:    '1rem',
          padding:         '1.25rem',
          boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
          marginBottom:    '1.25rem',
        }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={16} color="#374151" />
            {brgyData.barangay} — Participation
          </p>

          {/* Big vote count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{
              width:           '64px',
              height:          '64px',
              backgroundColor: colors.primary,
              borderRadius:    '1rem',
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              justifyContent:  'center',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
                {brgyData.total_votes}
              </span>
              <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                VOTED
              </span>
            </div>
            <div>
              <p style={{ fontWeight: 700, color: '#1a1a1a', margin: 0, fontSize: '1rem' }}>
                {brgyData.total_votes} farmer{brgyData.total_votes !== 1 ? 's' : ''} voted
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                from your barangay
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── NO DATA STATE ── */}
      {!brgyData && (
        <div style={{
          backgroundColor: 'white',
          borderRadius:    '1rem',
          padding:         '2.5rem 1.5rem',
          textAlign:       'center',
          boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
          marginBottom:    '1.25rem',
        }}>
          <BarChart2 size={40} color="#d1d5db" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
          <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.375rem' }}>
            No votes yet
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
            No farmers from your barangay have voted yet.
          </p>
        </div>
      )}

      {/* ── HYBRID RESULTS ── */}
      {brgyData && brgyData.hybrid?.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius:    '1rem',
          boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
          marginBottom:    '1rem',
          overflow:        'hidden',
        }}>
          <div style={{
            padding: '0.875rem 1.25rem',
            backgroundColor: '#dbeafe',
            borderBottom: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
            }}>
            <Sprout size={18} color="#1e40af" />
            <h3 style={{ fontWeight: 700, color: '#1e40af', margin: 0, fontSize: '0.95rem' }}>
                Hybrid Variety Votes
            </h3>
           </div>
          <div style={{ padding: '1.25rem' }}>
            {brgyData.hybrid.map((r, idx) => (
              <div key={r.variety} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {/* Rank circle */}
                <span style={{
                  width:           '24px',
                  height:          '24px',
                  borderRadius:    '50%',
                  backgroundColor: idx === 0 ? '#f5c842' : idx === 1 ? '#e5e7eb' : '#f9fafb',
                  fontSize:        '0.7rem',
                  fontWeight:      700,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  flexShrink:      0,
                  marginTop:       '0.25rem',
                  color:           '#374151',
                }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <ProgressBar
                    label={r.variety}
                    votes={r.votes}
                    percent={r.percent}
                    color="#1e40af"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── INBRED RESULTS ── */}
      {brgyData && brgyData.inbred?.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius:    '1rem',
          boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
          overflow:        'hidden',
        }}>
          <div style={{
            padding: '0.875rem 1.25rem',
            backgroundColor: '#dcfce7',
            borderBottom: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
            }}>
            <Wheat size={18} color="#166534" />
            <h3 style={{ fontWeight: 700, color: '#166534', margin: 0, fontSize: '0.95rem' }}>
                Inbred Variety Votes
            </h3>
          </div>
          <div style={{ padding: '1.25rem' }}>
            {brgyData.inbred.map((r, idx) => (
              <div key={r.variety} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{
                  width:           '24px',
                  height:          '24px',
                  borderRadius:    '50%',
                  backgroundColor: idx === 0 ? '#f5c842' : idx === 1 ? '#e5e7eb' : '#f9fafb',
                  fontSize:        '0.7rem',
                  fontWeight:      700,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  flexShrink:      0,
                  marginTop:       '0.25rem',
                  color:           '#374151',
                }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <ProgressBar
                    label={r.variety}
                    votes={r.votes}
                    percent={r.percent}
                    color="#166534"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default BrgyPoll;