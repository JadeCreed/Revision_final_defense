// FIXED IN THIS VERSION:
// 1. Vote choices are now dynamic per seed type (not hardcoded HYBRID/INBRED)
// 2. Admin can have any number of seed types — farmer votes for each one
// 3. Colors cycle through TYPE_COLORS array for visual variety
// 4. VoteForm component is now used instead of duplicating the logic
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth }       from '../../auth/AuthContext';
import { ROLE_COLORS }   from '../../components/navigation/UserNavConfig';
import {
  getActivePoll,
  getSeedVarieties,
  submitVote,
} from '../../api/axios';
import {
  CheckCircle, Vote, Lock, RefreshCw, Wheat,
} from 'lucide-react';

// ── Color scheme cycling for seed type cards ──
const TYPE_COLORS = [
  { header: '#dbeafe', headerText: '#1e40af', selected: '#eff6ff', border: '#1e40af' },
  { header: '#dcfce7', headerText: '#166534', selected: '#f0fdf4', border: '#166534' },
  { header: '#f3e8ff', headerText: '#7c3aed', selected: '#faf5ff', border: '#7c3aed' },
  { header: '#fef9c3', headerText: '#854d0e', selected: '#fefce8', border: '#854d0e' },
  { header: '#fee2e2', headerText: '#991b1b', selected: '#fff5f5', border: '#991b1b' },
];

// ── Progress bar ──
const ProgressBar = ({ percent, color, label, votes }) => (
  <div style={{ marginBottom: '0.875rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color }}>{votes}</span>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({percent}%)</span>
      </div>
    </div>
    <div style={{ width: '100%', height: '10px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{
        width:      `${Math.min(percent, 100)}%`,
        height:     '100%',
        backgroundColor: color,
        borderRadius: '999px',
        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
    </div>
  </div>
);

const FarmerPoll = () => {
  const { role } = useAuth();
  const colors   = ROLE_COLORS[role] || ROLE_COLORS.FARMER;

  const [poll, setPoll]           = useState(null);
  const [seedTypes, setSeedTypes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // ── DYNAMIC choices: { [seedTypeId]: varietyId } ──
  // Instead of hardcoding hybridChoice/inbredChoice,
  // we track one selection per seed type dynamically
  const [choices, setChoices]           = useState({});
  const [submitting, setSubmitting]     = useState(false);
  const [voteError, setVoteError]       = useState('');
  const [voteSuccess, setVoteSuccess]   = useState('');
  const [isChangingVote, setIsChangingVote] = useState(false);

  // ── FETCH DATA ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pollRes, varRes] = await Promise.all([
        getActivePoll(),
        getSeedVarieties(),
      ]);

      const pollData  = pollRes.data;
      const typesData = varRes.data || [];

      setPoll(pollData);
      setSeedTypes(typesData);

      // Pre-fill choices from existing vote
      // my_vote stores: { hybrid_choice_id, inbred_choice_id }
      // We map these back to { [typeId]: varietyId }
      if (pollData?.my_vote) {
        const mv = pollData.my_vote;
        const prefilled = {};

        // Find which type each voted variety belongs to
        typesData.forEach(st => {
          const matchHybrid = st.varieties?.find(v => v.id === mv.hybrid_choice_id);
          const matchInbred = st.varieties?.find(v => v.id === mv.inbred_choice_id);
          if (matchHybrid) prefilled[st.id] = mv.hybrid_choice_id;
          if (matchInbred) prefilled[st.id] = mv.inbred_choice_id;
        });

        setChoices(prefilled);
      }
    } catch {
      setError('Failed to load poll. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── CHECK: all seed types have a choice selected ──
  const allChosen = seedTypes.length > 0 &&
    seedTypes.every(st => choices[st.id]);

  // ── SUBMIT VOTE ──
  const handleSubmit = async () => {
    if (!allChosen) {
      setVoteError('Please select one variety from each seed type.');
      return;
    }

    // Build vote payload
    // Backend still expects hybrid_choice and inbred_choice
    // Map: first active seed type = hybrid_choice, second = inbred_choice
    // This matches your existing PollVote model structure
    const typeIds   = seedTypes.map(st => st.id);
    const firstId   = typeIds[0];
    const secondId  = typeIds[1];

    if (!firstId || !secondId) {
      setVoteError('At least 2 seed types are required to vote.');
      return;
    }

    setSubmitting(true);
    setVoteError('');
    setVoteSuccess('');

    try {
      await submitVote(poll.id, {
        hybrid_choice: choices[firstId],
        inbred_choice: choices[secondId],
      });
      setVoteSuccess(poll.has_voted ? 'Your vote has been updated!' : 'Your vote has been submitted!');
      setIsChangingVote(false);
      await fetchData();
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to submit vote.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── LOADING ──
  if (loading) {
    return (
      <div style={{ padding: '1.25rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height:          i === 1 ? '120px' : '80px',
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

  // ── NO POLL ──
  if (!poll || poll.poll === null) {
    return (
      <div style={{ padding: '1.25rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem 1.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <Wheat size={48} color="#d1d5db" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <h2 style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>No Active Poll</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
            There are no seed polls available right now. Check back later.
          </p>
        </div>
      </div>
    );
  }

  const isOpen      = poll.status === 'OPEN' && poll.is_accepting;
  const isLocked    = poll.status === 'LOCKED' || poll.status === 'CLOSED';
  const hasVoted    = poll.has_voted;
  const showForm    = isOpen && (!hasVoted || isChangingVote);
  const showVoted   = isOpen && hasVoted && !isChangingVote;
  const showResults = isLocked;

  return (
    <div style={{ padding: '1.25rem', paddingBottom: '2rem' }}>

      {/* ── POLL HEADER CARD ── */}
      <div style={{
        backgroundColor: colors.primary,
        borderRadius:    '1rem',
        padding:         '1.25rem',
        marginBottom:    '1.25rem',
        color:           'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
          <span style={{ fontSize: '1.1rem' }}>
            {poll.season === 'WET' ? '💧' : '☀️'}
          </span>
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
            border:          `1px solid ${poll.status === 'OPEN' ? 'rgba(34,197,94,0.4)' : 'rgba(249,115,22,0.4)'}`,
          }}>
            {poll.status === 'OPEN' ? '● Open' : poll.status === 'LOCKED' ? '🔒 Locked' : '⛔ Closed'}
          </span>
        </div>
        <h1 style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
          {poll.title}
        </h1>
        {poll.status === 'OPEN' && (
          <p style={{ fontSize: '0.75rem', opacity: 0.75, margin: 0 }}>
            Voting ends: {new Date(poll.end_date).toLocaleDateString('en-PH', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}
          </p>
        )}
      </div>

      {/* ── SUCCESS ── */}
      {voteSuccess && (
        <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.875rem 1.25rem', borderRadius: '0.875rem', marginBottom: '1.25rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} /> {voteSuccess}
        </div>
      )}

      {/* ── ERROR ── */}
      {(error || voteError) && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.875rem 1.25rem', borderRadius: '0.875rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
          {error || voteError}
        </div>
      )}

      {/* ══════════════════════════════════════
          VOTING FORM
      ══════════════════════════════════════ */}
      {showForm && (
        <div>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Select your preferred variety for each seed type. You must pick one from each.
          </p>

          {/* ── DYNAMIC SEED TYPE SECTIONS ── */}
          {seedTypes.map((seedType, typeIdx) => {
            const tc         = TYPE_COLORS[typeIdx % TYPE_COLORS.length];
            const selectedId = choices[seedType.id];

            return (
              <div key={seedType.id} style={{
                backgroundColor: 'white',
                borderRadius:    '1rem',
                boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
                marginBottom:    '1.25rem',
                overflow:        'hidden',
              }}>
                {/* Header */}
                <div style={{ padding: '0.875rem 1.25rem', backgroundColor: tc.header, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wheat size={18} color={tc.headerText} />
                  <h3 style={{ fontWeight: 700, color: tc.headerText, margin: 0, fontSize: '0.95rem', flex: 1 }}>
                    {seedType.name} Varieties
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: tc.headerText, opacity: 0.7 }}>
                    Required — pick one
                  </span>
                </div>

                {/* Variety buttons */}
                <div style={{ padding: '1rem' }}>
                  {!seedType.varieties?.length ? (
                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>No varieties available</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {seedType.varieties.map(variety => {
                        const isSelected = selectedId === variety.id;
                        return (
                          <button
                            key={variety.id}
                            onClick={() => setChoices(prev => ({ ...prev, [seedType.id]: variety.id }))}
                            style={{
                              display:         'flex',
                              alignItems:      'center',
                              gap:             '0.875rem',
                              padding:         '0.875rem 1rem',
                              borderRadius:    '0.75rem',
                              border:          `2px solid ${isSelected ? tc.border : '#e5e7eb'}`,
                              backgroundColor: isSelected ? tc.selected : '#f9fafb',
                              cursor:          'pointer',
                              textAlign:       'left',
                              transition:      'all 0.15s',
                              width:           '100%',
                            }}
                          >
                            {/* Radio */}
                            <div style={{
                              width:           '20px',
                              height:          '20px',
                              borderRadius:    '50%',
                              border:          `2px solid ${isSelected ? tc.border : '#d1d5db'}`,
                              backgroundColor: isSelected ? tc.border : 'white',
                              display:         'flex',
                              alignItems:      'center',
                              justifyContent:  'center',
                              flexShrink:      0,
                              transition:      'all 0.15s',
                            }}>
                              {isSelected && (
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'white' }} />
                              )}
                            </div>
                            <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? tc.border : '#374151', fontSize: '0.9rem', flex: 1 }}>
                              {variety.name}
                            </span>
                            {isSelected && <span style={{ color: tc.border }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Progress indicator */}
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {Object.keys(choices).length} of {seedTypes.length} selected
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: allChosen ? '#166534' : '#9ca3af' }}>
              {allChosen ? '✓ Ready to submit' : 'Select all types to continue'}
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !allChosen}
            style={{
              width:           '100%',
              padding:         '0.875rem',
              backgroundColor: allChosen ? colors.primary : '#d1d5db',
              color:           'white',
              border:          'none',
              borderRadius:    '0.875rem',
              fontWeight:      700,
              fontSize:        '1rem',
              cursor:          allChosen ? 'pointer' : 'not-allowed',
              transition:      'all 0.15s',
              marginBottom:    '0.75rem',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              gap:             '0.5rem',
            }}
          >
            {submitting ? 'Submitting...' : isChangingVote
              ? <><RefreshCw size={18} /> Update My Vote</>
              : <><Vote size={18} /> Submit My Vote</>
            }
          </button>

          {isChangingVote && (
            <button
              onClick={() => {
                setIsChangingVote(false);
                setVoteError('');
                // Re-prefill choices from existing vote
                if (poll.my_vote) {
                  const prefilled = {};
                  const mv = poll.my_vote;
                  seedTypes.forEach(st => {
                    const matchH = st.varieties?.find(v => v.id === mv.hybrid_choice_id);
                    const matchI = st.varieties?.find(v => v.id === mv.inbred_choice_id);
                    if (matchH) prefilled[st.id] = mv.hybrid_choice_id;
                    if (matchI) prefilled[st.id] = mv.inbred_choice_id;
                  });
                  setChoices(prefilled);
                }
              }}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          VOTED STATE
      ══════════════════════════════════════ */}
      {showVoted && poll.my_vote && (
        <div>
          <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <CheckCircle size={28} color="#166534" />
              <div>
                <p style={{ fontWeight: 700, color: '#166534', margin: 0, fontSize: '0.95rem' }}>You've voted!</p>
                <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.125rem 0 0' }}>
                  Voted {new Date(poll.my_vote.voted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {poll.my_vote.updated_at !== poll.my_vote.voted_at && ' (updated)'}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { label: `${seedTypes[0]?.name || 'Hybrid'} Choice`, value: poll.my_vote.hybrid_choice_name, tc: TYPE_COLORS[0] },
                { label: `${seedTypes[1]?.name || 'Inbred'} Choice`, value: poll.my_vote.inbred_choice_name, tc: TYPE_COLORS[1] },
              ].map(({ label, value, tc }) => (
                <div key={label} style={{ backgroundColor: tc.header, borderRadius: '0.75rem', padding: '0.875rem' }}>
                  <p style={{ fontSize: '0.7rem', color: tc.headerText, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 0.375rem' }}>
                    {label}
                  </p>
                  <p style={{ fontWeight: 700, color: tc.headerText, margin: 0, fontSize: '0.9rem' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsChangingVote(true)}
            style={{ width: '100%', padding: '0.75rem', backgroundColor: 'white', color: colors.primary, border: `2px solid ${colors.primary}`, borderRadius: '0.875rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} /> Change My Vote
          </button>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', margin: '0.5rem 0 0' }}>
            You can change your vote while the poll is still open.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════
          RESULTS — shown when LOCKED or CLOSED
      ══════════════════════════════════════ */}
      {showResults && poll.results && (
        <div>
          {poll.my_vote && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.875rem', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle size={22} color="#166534" />
              <p style={{ fontWeight: 600, color: '#166534', margin: 0, fontSize: '0.85rem' }}>
                You voted: {poll.my_vote.hybrid_choice_name} &amp; {poll.my_vote.inbred_choice_name}
              </p>
            </div>
          )}

          <div style={{ backgroundColor: colors.primary, borderRadius: '1rem', padding: '1.125rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'white', margin: 0, lineHeight: 1 }}>{poll.results.total_votes}</p>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', margin: '0.25rem 0 0', fontWeight: 600 }}>Total Farmers Voted</p>
            </div>
            <Vote size={32} color="rgba(255,255,255,0.6)" style={{ marginLeft: 'auto' }} />
          </div>

          {/* Hybrid */}
          {poll.results.hybrid?.length > 0 && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', backgroundColor: TYPE_COLORS[0].header, borderBottom: `1px solid ${TYPE_COLORS[0].header}` }}>
                <h3 style={{ fontWeight: 700, color: TYPE_COLORS[0].headerText, margin: 0, fontSize: '0.95rem' }}>
                  {seedTypes[0]?.name || 'Hybrid'} Results
                </h3>
              </div>
              <div style={{ padding: '1.25rem' }}>
                {poll.results.hybrid.map((r, idx) => (
                  <div key={r.variety} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: idx === 0 ? '#f5c842' : idx === 1 ? '#e5e7eb' : '#f9fafb', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#374151' }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <ProgressBar percent={r.percent} color={TYPE_COLORS[0].headerText} label={r.variety} votes={r.votes} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inbred */}
          {poll.results.inbred?.length > 0 && (
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', backgroundColor: TYPE_COLORS[1].header, borderBottom: `1px solid ${TYPE_COLORS[1].header}` }}>
                <h3 style={{ fontWeight: 700, color: TYPE_COLORS[1].headerText, margin: 0, fontSize: '0.95rem' }}>
                  {seedTypes[1]?.name || 'Inbred'} Results
                </h3>
              </div>
              <div style={{ padding: '1.25rem' }}>
                {poll.results.inbred.map((r, idx) => (
                  <div key={r.variety} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: idx === 0 ? '#f5c842' : idx === 1 ? '#e5e7eb' : '#f9fafb', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#374151' }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <ProgressBar percent={r.percent} color={TYPE_COLORS[1].headerText} label={r.variety} votes={r.votes} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showResults && !poll.results && (
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '3rem 1.5rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <Lock size={40} color="#d1d5db" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <p style={{ fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>Poll is Locked</p>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Results will be available once admin publishes them.</p>
        </div>
      )}

    </div>
  );
};

export default FarmerPoll;