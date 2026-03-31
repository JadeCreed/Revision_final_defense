// src/pages/admin/users/Archive.jsx
// ============================================================
// Archive — all deactivated users
// FIXED: was stuck on "Loading..." — fetch was never triggered
// Added: polling, sorting, COL_WIDTHS, NewBadge, pagination
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { getArchive, reactivateUser } from '../../../api/axios';
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

const Archive = () => {
  const [users, setUsers]       = useState([]);
  const [count, setCount]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [sort, setSort]         = useState('-date_joined');

  const [newIds, setNewIds]     = useState(new Set());
  const knownIds                = useRef(new Set());
  const timeouts                = useRef({});
  const didInit                 = useRef(false);

  const [reactivateModal, setReactivateModal]     = useState(null);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  // ── FETCH FUNCTION ──
  const fetchArchive = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError('');
    try {
      const params = { page, ordering: sort };
      if (search)               params.search = search;
      if (roleFilter !== 'ALL') params.role   = roleFilter;

      const res   = await getArchive(params);
      const items = res.data.results || res.data;
      const total = res.data.count   || 0;

      // Detect new archived items
      if (!isInitial && didInit.current) {
        const freshIds = items.map(u => u.id).filter(id => !knownIds.current.has(id));
        if (freshIds.length > 0) {
          setNewIds(prev => { const n = new Set(prev); freshIds.forEach(id => n.add(id)); return n; });
          freshIds.forEach(id => {
            if (timeouts.current[id]) clearTimeout(timeouts.current[id]);
            timeouts.current[id] = setTimeout(() => {
              setNewIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            }, 10000);
          });
        }
      }

      knownIds.current = new Set(items.map(u => u.id));
      setUsers(items);
      setCount(total);
      didInit.current = true;
    } catch {
      setError('Failed to load archived users.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [page, search, roleFilter, sort]); // ← dependencies are correct

  // ── INITIAL FETCH + POLLING ──
  // This useEffect triggers fetchArchive whenever filters/page/sort change
  useEffect(() => {
    fetchArchive(true);
  }, [fetchArchive]); // fetchArchive changes when its deps change

  useEffect(() => {
    const poll = setInterval(() => fetchArchive(false), 15000);
    return () => clearInterval(poll);
  }, [fetchArchive]);

  useEffect(() => () => Object.values(timeouts.current).forEach(clearTimeout), []);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, roleFilter, sort]);

  const handleReactivate = async () => {
    if (!reactivateModal) return;
    setReactivateLoading(true);
    try {
      await reactivateUser(reactivateModal.id);
      setReactivateModal(null);
      fetchArchive(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Reactivation failed.');
    } finally {
      setReactivateLoading(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const filterStyle = { padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none' };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>Archive</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          All deactivated accounts. Data is preserved. Can be reactivated anytime.
        </p>
      </div>

      {/* Filters + Sort */}
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
        {/* Sort — replaces Reset button */}
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
                  ['Name',       COL_WIDTHS.name],
                  ['Contact',    COL_WIDTHS.contact],
                  ['Role',       COL_WIDTHS.role],
                  ['Barangay',   COL_WIDTHS.barangay],
                  ['Date Joined',COL_WIDTHS.date],
                  ['Action',     '120px'],
                ].map(([col, w]) => (
                  <th key={col} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', minWidth: w, whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No archived users found.</td></tr>
              ) : users.map((u, idx) => {
                const roleStyle = ROLE_BADGE[u.role] || {};
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: '500', color: '#6b7280', minWidth: COL_WIDTHS.name }}>
                      {u.first_name} {u.last_name}
                      <NewBadge isNew={newIds.has(u.id)} />
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#9ca3af', minWidth: COL_WIDTHS.contact }}>{u.contact_number}</td>
                    <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.role }}>
                      <span style={{ backgroundColor: roleStyle.bg, color: roleStyle.color, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', opacity: 0.7, whiteSpace: 'nowrap' }}>
                        {roleStyle.label || u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#9ca3af', minWidth: COL_WIDTHS.barangay }}>{u.barangay || '—'}</td>
                    <td style={{ padding: '0.875rem 1rem', color: '#9ca3af', minWidth: COL_WIDTHS.date, whiteSpace: 'nowrap' }}>{formatDate(u.date_joined)}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <button
                        onClick={() => setReactivateModal(u)}
                        style={{ padding: '0.375rem 0.875rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap' }}
                      >
                        Reactivate
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

      {reactivateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '0.75rem' }}>✅ Reactivate Account</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Reactivate <strong>{reactivateModal.first_name} {reactivateModal.last_name}</strong>? They will regain access immediately.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setReactivateModal(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleReactivate} disabled={reactivateLoading}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
                {reactivateLoading ? 'Reactivating...' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Archive;