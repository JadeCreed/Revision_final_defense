// src/pages/admin/users/ResetRequests.jsx
// ============================================================
// Password Reset Requests
// FIXED: 
// - Sorting now works correctly
// - Cancel request column added
// - "NEW" badge on new rows
// - Polling every 15s
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { getResetRequests, adminResetPassword, cancelResetRequest } from '../../../api/axios';
import { Pagination, SortDropdown, COL_WIDTHS, NewBadge } from '../../../components/tables/TableBase';

const ROLE_BADGE = {
  ADMIN:  { bg: '#f3e8ff', color: '#7c3aed', label: 'Admin' },
  AT:     { bg: '#dbeafe', color: '#1e40af', label: 'Agri Tech' },
  BRGY:   { bg: '#dcfce7', color: '#166534', label: 'Brgy President' },
  FARMER: { bg: '#fef9c3', color: '#854d0e', label: 'Farmer' },
};

const SORT_OPTIONS = [
  { value: '-date_joined', label: 'Newest First' },
  { value: 'date_joined',  label: 'Oldest First' },
  { value: 'last_name',    label: 'Name A–Z' },
  { value: '-last_name',   label: 'Name Z–A' },
];

const ResetRequests = () => {
  const [requests, setRequests]     = useState([]);
  const [count, setCount]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [sort, setSort]             = useState('-date_joined');

  // "NEW" tracking
  const [newIds, setNewIds]   = useState(new Set());
  const knownIds              = useRef(new Set());
  const timeouts              = useRef({});
  const didInit               = useRef(false);

  // Reset password modal
  const [resetModal, setResetModal]   = useState(null);
  const [resetMode, setResetMode]     = useState('manual');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]   = useState('');
  const [resetResult, setResetResult] = useState('');

  // Cancel confirm modal
  const [cancelModal, setCancelModal]   = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── FETCH ──
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

      // Detect new items
      if (!isInitial && didInit.current) {
        const freshIds = items.map(u => u.id).filter(id => !knownIds.current.has(id));
        if (freshIds.length > 0) {
          setNewIds(prev => { const n = new Set(prev); freshIds.forEach(id => n.add(id)); return n; });
          freshIds.forEach(id => {
            if (timeouts.current[id]) clearTimeout(timeouts.current[id]);
            // Auto-remove "NEW" after 10s since admin is on this page
            timeouts.current[id] = setTimeout(() => {
              setNewIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            }, 10000);
          });
        }
      }

      knownIds.current = new Set(items.map(u => u.id));
      setRequests(items);
      setCount(total);
      didInit.current = true;
    } catch {
      setError('Failed to load reset requests.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [page, search, roleFilter, sort]);

  useEffect(() => { fetchRequests(true); }, [fetchRequests]);
  useEffect(() => {
    const poll = setInterval(() => fetchRequests(false), 15000);
    return () => clearInterval(poll);
  }, [fetchRequests]);
  useEffect(() => () => Object.values(timeouts.current).forEach(clearTimeout), []);
  useEffect(() => { setPage(1); }, [search, roleFilter, sort]);

  const openResetModal = (user) => {
    setResetModal(user);
    setResetMode('manual');
    setNewPassword('');
    setResetError('');
    setResetResult('');
  };

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
      setResetResult(res.data.new_password);
      fetchRequests(false); // refresh — this user should disappear from list
    } catch (err) {
      setResetError(err.response?.data?.error || 'Reset failed. Try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setCancelLoading(true);
    try {
      await cancelResetRequest(cancelModal.id);
      setCancelModal(null);
      fetchRequests(false); // refresh — this user disappears from list
    } catch (err) {
      setError(err.response?.data?.error || 'Cancel failed.');
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const filterStyle = { padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none' };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>Password Reset Requests</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Users who requested admin password assistance. Reset or cancel each request.
        </p>
      </div>

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

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {[
                  ['Name',        COL_WIDTHS.name],
                  ['Contact',     COL_WIDTHS.contact],
                  ['Role',        COL_WIDTHS.role],
                  ['Date Joined', COL_WIDTHS.date],
                  ['Reset',       '130px'],   // Reset Password action
                  ['Cancel',      '110px'],   // Cancel Request action
                ].map(([col, w]) => (
                  <th key={col} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', minWidth: w, whiteSpace: 'nowrap' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No pending reset requests.</td></tr>
              ) : requests.map((u, idx) => {
                const rs = ROLE_BADGE[u.role] || {};
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: '500', minWidth: COL_WIDTHS.name }}>
                      {u.first_name} {u.last_name}
                      <NewBadge isNew={newIds.has(u.id)} />
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.contact }}>
                      {u.contact_number}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.role }}>
                      <span style={{
                        backgroundColor: rs.bg, color: rs.color,
                        padding: '0.25rem 0.75rem', borderRadius: '999px',
                        fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap',
                      }}>
                        {rs.label || u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.date, whiteSpace: 'nowrap' }}>
                      {formatDate(u.date_joined)}
                    </td>
                    {/* Reset Password column */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <button
                        onClick={() => openResetModal(u)}
                        style={{ padding: '0.375rem 0.875rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap' }}
                      >
                        Reset
                      </button>
                    </td>
                    {/* Cancel Request column */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <button
                        onClick={() => setCancelModal(u)}
                        style={{ padding: '0.375rem 0.75rem', backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination count={count} page={page} pageSize={10} onPageChange={setPage} />
      </div>

      {/* ── RESET PASSWORD MODAL ── */}
      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: '700' }}>Reset Password</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>{resetModal.first_name} {resetModal.last_name}</p>
              </div>
              <button onClick={() => setResetModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {resetError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {resetError}
              </div>
            )}

            {resetResult ? (
              // ── SUCCESS: show new password ──
              <div style={{ backgroundColor: '#dcfce7', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center', marginBottom: '1rem' }}>
                <p style={{ color: '#166534', fontWeight: '600', marginBottom: '0.5rem' }}>✅ Password Reset Successfully!</p>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>New password (share with user):</p>
                <code style={{ backgroundColor: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '700', letterSpacing: '0.1em', display: 'block' }}>
                  {resetResult}
                </code>
              </div>
            ) : (
              <>
                {/* Mode toggle */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {['manual', 'auto'].map(m => (
                    <button key={m} type="button" onClick={() => setResetMode(m)}
                      style={{
                        flex: 1, padding: '0.5rem',
                        border: `2px solid ${resetMode === m ? '#2d6a2d' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        backgroundColor: resetMode === m ? '#2d6a2d' : 'white',
                        color: resetMode === m ? 'white' : '#374151',
                        fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem',
                      }}>
                      {m === 'manual' ? 'Set Password' : 'Auto-Generate'}
                    </button>
                  ))}
                </div>

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
                  <div style={{ backgroundColor: '#f0f9ff', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#0369a1' }}>
                      🎲 A secure random password will be generated and shown to you after confirmation.
                    </p>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setResetModal(null)}
                style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>
                {resetResult ? 'Done' : 'Cancel'}
              </button>
              {!resetResult && (
                <button
                  onClick={handleReset}
                  disabled={resetLoading || (resetMode === 'manual' && !newPassword)}
                  style={{ padding: '0.5rem 1.5rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
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
              Their password will remain unchanged.
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
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
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