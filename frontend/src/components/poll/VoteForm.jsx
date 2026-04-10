// src/components/poll/VoteForm.jsx
// ============================================================
// Reusable voting form used inside FarmerPoll.jsx.
// Renders one card per seed type, each with radio-style buttons.
// Color cycles through TYPE_COLORS for visual variety.
//
// Props:
//   seedTypes      {array}    — seed types + varieties from /api/seed-poll/varieties/
//   choices        {object}   — { [seedTypeId]: selectedVarietyId }
//   onChoiceChange {function} — (seedTypeId, varietyId) => void
//   onSubmit       {function} — called when Submit button clicked
//   submitting     {boolean}  — disables submit button while loading
//   roleColor      {string}   — role primary color for submit button
//   isUpdate       {boolean}  — true when updating an existing vote
//   allChosen      {boolean}  — true when all seed types have a selection
// ============================================================

import { Wheat, Vote, RefreshCw } from 'lucide-react';

// ── Color palette for seed type cards ──
// Cycles if admin adds more than 5 types
const TYPE_COLORS = [
  { header: '#dbeafe', headerText: '#1e40af', selected: '#eff6ff', border: '#1e40af' },
  { header: '#dcfce7', headerText: '#166534', selected: '#f0fdf4', border: '#166534' },
  { header: '#f3e8ff', headerText: '#7c3aed', selected: '#faf5ff', border: '#7c3aed' },
  { header: '#fef9c3', headerText: '#854d0e', selected: '#fefce8', border: '#854d0e' },
  { header: '#fee2e2', headerText: '#991b1b', selected: '#fff5f5', border: '#991b1b' },
];

const VoteForm = ({
  seedTypes      = [],
  choices        = {},
  onChoiceChange,
  onSubmit,
  submitting     = false,
  roleColor      = '#1a4d1a',
  isUpdate       = false,
  allChosen      = false,
}) => {
  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem', lineHeight: 1.5 }}>
        Select your preferred variety for each seed type. You must pick one from each.
      </p>

      {/* ── One card per seed type ── */}
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
            {/* Type header */}
            <div style={{
              padding:         '0.875rem 1.25rem',
              backgroundColor: tc.header,
              borderBottom:    '1px solid rgba(0,0,0,0.06)',
              display:         'flex',
              alignItems:      'center',
              gap:             '0.5rem',
            }}>
              <Wheat size={18} color={tc.headerText} />
              <h3 style={{ fontWeight: 700, color: tc.headerText, margin: 0, fontSize: '0.95rem', flex: 1 }}>
                {seedType.name} Varieties
              </h3>
              {/* Shows green check when this type has been selected */}
              {selectedId ? (
                <span style={{ fontSize: '0.72rem', color: tc.headerText, fontWeight: 700 }}>
                  ✓ Selected
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', color: tc.headerText, opacity: 0.6 }}>
                  Required — pick one
                </span>
              )}
            </div>

            {/* Variety options */}
            <div style={{ padding: '1rem' }}>
              {!seedType.varieties?.length ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem', fontSize: '0.875rem' }}>
                  No varieties available for this type.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {seedType.varieties.map(variety => {
                    const isSelected = selectedId === variety.id;
                    return (
                      <button
                        key={variety.id}
                        type="button"
                        onClick={() => onChoiceChange && onChoiceChange(seedType.id, variety.id)}
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
                        {/* Custom radio circle */}
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

                        {/* Variety name */}
                        <span style={{
                          fontWeight: isSelected ? 700 : 500,
                          color:      isSelected ? tc.border : '#374151',
                          fontSize:   '0.9rem',
                          flex:       1,
                        }}>
                          {variety.name}
                        </span>

                        {isSelected && <span style={{ color: tc.border, fontSize: '0.9rem' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Progress indicator ── */}
      <div style={{
        marginBottom:    '1rem',
        padding:         '0.75rem 1rem',
        backgroundColor: '#f9fafb',
        borderRadius:    '0.75rem',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
      }}>
        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
          {Object.keys(choices).length} of {seedTypes.length} selected
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: allChosen ? '#166534' : '#9ca3af' }}>
          {allChosen ? '✓ Ready to submit' : 'Select all types to continue'}
        </span>
      </div>

      {/* ── Submit button ── */}
      <button
        onClick={onSubmit}
        disabled={submitting || !allChosen}
        style={{
          width:           '100%',
          padding:         '0.875rem',
          backgroundColor: allChosen ? roleColor : '#d1d5db',
          color:           'white',
          border:          'none',
          borderRadius:    '0.875rem',
          fontWeight:      700,
          fontSize:        '1rem',
          cursor:          allChosen ? 'pointer' : 'not-allowed',
          transition:      'all 0.15s',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             '0.5rem',
        }}
      >
        {submitting
          ? 'Submitting...'
          : isUpdate
            ? <><RefreshCw size={18} /> Update My Vote</>
            : <><Vote size={18} /> Submit My Vote</>
        }
      </button>

      {/* Helper text when not all selected */}
      {!allChosen && (
        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.5rem' }}>
          Please select one variety from each seed type to enable submission.
        </p>
      )}
    </div>
  );
};

export default VoteForm;