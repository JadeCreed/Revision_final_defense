import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getResetRequests,
  adminResetPassword,
  cancelResetRequest,
} from '../../../api/axios';
import {
  Pagination,
  SortDropdown,
  COL_WIDTHS,
  NewBadge,
  getSeenIds,
} from '../../../components/tables/TableBase';

// ── Role badge styles ──
const ROLE_BADGE = {
  ADMIN:  { bg: '#f3e8ff', color: '#7c3aed', label: 'Admin' },
  AT:     { bg: '#dbeafe', color: '#1e40af', label: 'Agri Tech' },
  BRGY:   { bg: '#dcfce7', color: '#166534', label: 'Brgy President' },
  FARMER: { bg: '#fef9c3', color: '#854d0e', label: 'Farmer' },
};

// ── Sort options ──
// IMPORTANT: Sort by password_reset_requested_at (when they requested),
// NOT date_joined (when they registered). This ensures newest requests
// appear at the top, regardless of when the account was created.
const SORT_OPTIONS = [
  { value: '-password_reset_requested_at', label: 'Request Date (Newest)' },
  { value: 'password_reset_requested_at',  label: 'Request Date (Oldest)' },
  { value: 'last_name',                    label: 'Name A–Z' },
  { value: '-last_name',                   label: 'Name Z–A' },
];

// ── Unique localStorage key for this table's seen IDs ──
const TABLE_KEY = 'reset_requests';

const ResetRequests = () => {
  // ── Table state ──
  const [requests, setRequests]     = useState([]);
  const [count, setCount]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Default sort: most recent request at top
  const [sort, setSort] = useState('-password_reset_requested_at');

  // ── NEW badge tracking ──
  // newIds: Set of row IDs currently showing the NEW badge
  const [newIds, setNewIds] = useState(new Set());

  // prevIds: IDs from the PREVIOUS poll — used to find truly new rows
  // (useRef so it doesn't trigger re-renders when updated)
  const prevIds = useRef(new Set());

  // didInit: becomes true after first fetch completes
  // Prevents false NEW badges on initial load from poll comparisons
  const didInit = useRef(false);
  const newTimeouts = useRef({});

  const scheduleNewBadgeHide = (id) => {
    if (newTimeouts.current[id]) clearTimeout(newTimeouts.current[id]);
    newTimeouts.current[id] = setTimeout(() => {
      setNewIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      delete newTimeouts.current[id];
    }, 10000);
  };

  // ── Reset password modal state ──
  const [resetModal, setResetModal]     = useState(null);
  const [resetMode, setResetMode]       = useState('manual');
  const [newPassword, setNewPassword]   = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState('');
  const [resetResult, setResetResult]   = useState('');

  // ── Cancel request modal state ──
  const [cancelModal, setCancelModal]     = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);


  // ─────────────────────────────────────────────────────────
  // FETCH FUNCTION
  // Called on mount (isInitial=true) and every 15s (isInitial=false).
  //
  // NEW badge logic:
  //   INITIAL LOAD  → compare against localStorage seen IDs.
  //                   Any ID not in seen IDs = NEW (unseen since last visit).
  //   POLL UPDATE   → compare against prevIds from last poll.
  //                   Any ID not seen before = NEW (just arrived).
  // ─────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError('');

    try {
      const params = { page, ordering: sort };
      if (search)               params.search = search;
      if (roleFilter !== 'ALL') params.role   = roleFilter;

      const res   = await getResetRequests(params);
      const items = res.data.results || res.data;
      const total = res.data.count   || 0;

      const currentIds = new Set(items.map(u => u.id));

      if (isInitial) {
        // ── INITIAL LOAD: use localStorage to find unseen items ──
        // This makes NEW badges work correctly when navigating
        // back to this page OR after a browser refresh.
        const alreadySeen = getSeenIds(TABLE_KEY);
        const unseenIds   = [...currentIds].filter(id => !alreadySeen.has(id));

        if (unseenIds.length > 0) {
          setNewIds(new Set(unseenIds));
          unseenIds.forEach(scheduleNewBadgeHide);
        }
        // Note: NEW badges disappear automatically after 10 seconds.

      } else if (didInit.current) {
        // ── POLL UPDATE: detect items that weren't here last poll ──
        const freshIds = [...currentIds].filter(id => !prevIds.current.has(id));

        if (freshIds.length > 0) {
          setNewIds(prev => {
            const next = new Set(prev);
            freshIds.forEach(id => next.add(id));
            return next;
          });
          freshIds.forEach(scheduleNewBadgeHide);
        }
      }

      // Always update prevIds for next poll comparison
      prevIds.current = currentIds;
      setRequests(items);
      setCount(total);
      didInit.current = true;

    } catch {
      setError('Failed to load reset requests.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [page, search, roleFilter, sort]);
  // NOTE: `newIds` is intentionally NOT in deps — adding it would
  // cause fetchRequests to re-create on every badge click, causing
  // the polling interval to reset unnecessarily.


  // ── Trigger fetch on mount and when filters/page/sort change ──
  useEffect(() => {
    fetchRequests(true);
  }, [fetchRequests]);

  // ── Poll every 15 seconds ──
  useEffect(() => {
    const poll = setInterval(() => fetchRequests(false), 15000);
    return () => clearInterval(poll); // cleanup on unmount
  }, [fetchRequests]);

  useEffect(() => {
    return () => {
      Object.values(newTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  // ── Reset to page 1 when filters/sort change ──
  // (don't want to be on page 3 after changing the role filter)
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, sort]);


  // ─────────────────────────────────────────────────────────
  // OPEN RESET MODAL
  // Resets modal state each time it opens so previous result
  // doesn't bleed into a new reset attempt.
  // ─────────────────────────────────────────────────────────
  const openResetModal = (user) => {
    setResetModal(user);
    setResetMode('manual');
    setNewPassword('');
    setResetError('');
    setResetResult('');
  };


  // ─────────────────────────────────────────────────────────
  // HANDLE PASSWORD RESET
  // Sends reset request to backend.
  // On success: shows the new password to admin.
  // On failure: shows error inside the modal.
  // ─────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!resetModal) return;

    setResetLoading(true);
    setResetError('');
    setResetResult('');

    try {
      const payload = resetMode === 'auto'
        ? { auto_generate: true }
        : { new_password: newPassword };

      const res = await adminResetPassword(resetModal.id, payload);

      // Show the new password to admin (they share it with the user)
      setResetResult(res.data.new_password);

      // Refresh table — this user's password_reset_requested is now False
      // so they will disappear from the list on next fetch
      fetchRequests(false);

    } catch (err) {
      setResetError(err.response?.data?.error || 'Reset failed. Try again.');
    } finally {
      setResetLoading(false);
    }
  };


  // ─────────────────────────────────────────────────────────
  // HANDLE CANCEL REQUEST
  // Clears the user's password_reset_requested flag without
  // changing their password. User disappears from this list.
  // ─────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelModal) return;

    setCancelLoading(true);
    try {
      await cancelResetRequest(cancelModal.id);
      setCancelModal(null);
      fetchRequests(false); // user disappears from table
    } catch (err) {
      setError(err.response?.data?.error || 'Cancel failed.');
    } finally {
      setCancelLoading(false);
    }
  };


  // ── Date formatter ──
  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-PH', {
          year: 'numeric', month: 'short', day: 'numeric',
        })
      : '—';

  const filterStyle = {
    padding:      '0.5rem 0.875rem',
    border:       '1.5px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize:     '0.875rem',
    outline:      'none',
  };


  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div>

      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>
          Password Reset Requests
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Users requesting admin password assistance. Reset or cancel each request.
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <input
          placeholder="Search name, contact..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...filterStyle, flex: 1, minWidth: '200px' }}
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={filterStyle}>
          <option value="ALL">All Roles</option>
          <option value="FARMER">Farmer</option>
          <option value="AT">Agricultural Technician</option>
          <option value="BRGY">Barangay President</option>
          <option value="ADMIN">Admin</option>
        </select>
        <SortDropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Table card */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>

            {/* Column headers */}
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {[
                  ['Name',           COL_WIDTHS.name],
                  ['Contact',        COL_WIDTHS.contact],
                  ['Role',           COL_WIDTHS.role],
                  // Show when they REQUESTED reset, not when account was created
                  ['Requested At',   COL_WIDTHS.date],
                  ['Reset',          '130px'],
                  ['Cancel',         '110px'],
                ].map(([col, w]) => (
                  <th
                    key={col}
                    style={{
                      padding:    '0.875rem 1rem',
                      textAlign:  'left',
                      fontWeight: '600',
                      color:      '#374151',
                      minWidth:   w,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table body */}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                    Loading...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                    No pending reset requests.
                  </td>
                </tr>
              ) : (
                requests.map((u, idx) => {
                  const rs = ROLE_BADGE[u.role] || {};
                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom:    '1px solid #f3f4f6',
                        backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                      }}
                    >

                      {/* Name + NEW badge */}
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '500', minWidth: COL_WIDTHS.name }}>
                        {u.first_name} {u.last_name}
                        {/*
                          NewBadge receives:
                            isNew → whether this row is in newIds
                          The badge disappears automatically after 10 seconds.
                        */}
                        <NewBadge isNew={newIds.has(u.id)} />
                      </td>

                      {/* Contact number */}
                      <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.contact }}>
                        {u.contact_number}
                      </td>

                      {/* Role badge */}
                      <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.role }}>
                        <span style={{
                          backgroundColor: rs.bg,
                          color:           rs.color,
                          padding:         '0.25rem 0.75rem',
                          borderRadius:    '999px',
                          fontSize:        '0.75rem',
                          fontWeight:      '600',
                          whiteSpace:      'nowrap',
                        }}>
                          {rs.label || u.role}
                        </span>
                      </td>

                      {/* Request date — uses password_reset_requested_at, not date_joined */}
                      <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.date, whiteSpace: 'nowrap' }}>
                        {formatDate(u.password_reset_requested_at || u.date_joined)}
                      </td>

                      {/* Reset button */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <button
                          onClick={() => openResetModal(u)}
                          style={{
                            padding:         '0.375rem 0.875rem',
                            backgroundColor: '#2d6a2d',
                            color:           'white',
                            border:          'none',
                            borderRadius:    '0.375rem',
                            fontSize:        '0.8rem',
                            cursor:          'pointer',
                            fontWeight:      '500',
                            whiteSpace:      'nowrap',
                          }}
                        >
                          Reset
                        </button>
                      </td>

                      {/* Cancel button */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <button
                          onClick={() => setCancelModal(u)}
                          style={{
                            padding:         '0.375rem 0.75rem',
                            backgroundColor: 'white',
                            color:           '#6b7280',
                            border:          '1.5px solid #d1d5db',
                            borderRadius:    '0.375rem',
                            fontSize:        '0.8rem',
                            cursor:          'pointer',
                            whiteSpace:      'nowrap',
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination count={count} page={page} pageSize={10} onPageChange={setPage} />
      </div>


      {/* ── RESET PASSWORD MODAL ── */}
      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: '700', margin: 0 }}>Reset Password</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                  {resetModal.first_name} {resetModal.last_name}
                </p>
              </div>
              <button
                onClick={() => setResetModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            {/* Error message */}
            {resetError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {resetError}
              </div>
            )}

            {/* Success: show generated password */}
            {resetResult ? (
              <div style={{ backgroundColor: '#dcfce7', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center', marginBottom: '1rem' }}>
                <p style={{ color: '#166534', fontWeight: '600', marginBottom: '0.5rem' }}>
                  ✅ Password Reset Successfully!
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  New password (share this with the user):
                </p>
                <code style={{ backgroundColor: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '700', letterSpacing: '0.1em', display: 'block' }}>
                  {resetResult}
                </code>
              </div>
            ) : (
              <>
                {/* Mode toggle: manual vs auto-generate */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {[
                    { key: 'manual', label: 'Set Password' },
                    { key: 'auto',   label: 'Auto-Generate' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setResetMode(key)}
                      style={{
                        flex:            1,
                        padding:         '0.5rem',
                        border:          `2px solid ${resetMode === key ? '#2d6a2d' : '#d1d5db'}`,
                        borderRadius:    '0.5rem',
                        backgroundColor: resetMode === key ? '#2d6a2d' : 'white',
                        color:           resetMode === key ? 'white' : '#374151',
                        fontWeight:      '600',
                        cursor:          'pointer',
                        fontSize:        '0.85rem',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Manual: password input */}
                {resetMode === 'manual' ? (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                      New Password *
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', outline: 'none' }}
                    />
                  </div>
                ) : (
                  /* Auto-generate: info box */
                  <div style={{ backgroundColor: '#f0f9ff', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#0369a1', margin: 0 }}>
                      🎲 A secure random 10-character password will be generated and shown to you after confirmation.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Modal footer buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setResetModal(null)}
                style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}
              >
                {resetResult ? 'Done' : 'Cancel'}
              </button>

              {/* Only show Reset button before success */}
              {!resetResult && (
                <button
                  onClick={handleReset}
                  disabled={resetLoading || (resetMode === 'manual' && !newPassword)}
                  style={{
                    padding:         '0.5rem 1.5rem',
                    backgroundColor: '#2d6a2d',
                    color:           'white',
                    border:          'none',
                    borderRadius:    '0.5rem',
                    cursor:          (resetLoading || (resetMode === 'manual' && !newPassword)) ? 'not-allowed' : 'pointer',
                    fontWeight:      '600',
                    opacity:         (resetLoading || (resetMode === 'manual' && !newPassword)) ? 0.6 : 1,
                  }}
                >
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ── CANCEL REQUEST MODAL ── */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '0.75rem' }}>Cancel Reset Request</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Cancel the password reset request for{' '}
              <strong>{cancelModal.first_name} {cancelModal.last_name}</strong>?
              Their current password will remain unchanged.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCancelModal(null)}
                style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}
              >
                Keep Request
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                style={{
                  padding:         '0.5rem 1.25rem',
                  backgroundColor: '#6b7280',
                  color:           'white',
                  border:          'none',
                  borderRadius:    '0.5rem',
                  cursor:          cancelLoading ? 'not-allowed' : 'pointer',
                  fontWeight:      '600',
                  opacity:         cancelLoading ? 0.7 : 1,
                }}
              >
                {cancelLoading ? 'Cancelling...' : 'Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ResetRequests;
