// src/pages/admin/users/FarmerRequests.jsx
// ============================================================
// Farmer Account Requests
// - Polls every 15s
// - "NEW" row badge (10s auto-dismiss when viewing page)
// - Badge count in sidebar disappears on click (handled by Sidebar)
// - Pagination + Sorting + Fixed column widths
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFarmerRequests, approveFarmer } from '../../../api/axios';
import { Pagination, SortDropdown, COL_WIDTHS, NewBadge } from '../../../components/tables/TableBase';

const STATUS_COLORS = {
  PENDING:  { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  COMPLETE: { bg: '#dbeafe', color: '#1e40af', label: 'Complete' },
  APPROVED: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
  REJECTED: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
};

const BARANGAYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan'
];

const SORT_OPTIONS = [
  { value: '-date_joined', label: 'Newest First' },
  { value: 'date_joined',  label: 'Oldest First' },
  { value: 'last_name',    label: 'Name A–Z' },
  { value: '-last_name',   label: 'Name Z–A' },
];

const FarmerRequests = () => {
  const [farmers, setFarmers]   = useState([]);
  const [count, setCount]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [sort, setSort]         = useState('-date_joined');

  // "NEW" tracking
  const [newIds, setNewIds]     = useState(new Set());
  const knownIds                = useRef(new Set());
  const timeouts                = useRef({});
  const didInit                 = useRef(false);

  const [actionLoading, setActionLoading] = useState({});
  const [confirmModal, setConfirmModal]   = useState(null);

  const fetchFarmers = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError('');
    try {
      const params = { page, ordering: sort };
      if (search)                 params.search   = search;
      if (statusFilter !== 'ALL') params.status   = statusFilter;
      if (barangayFilter)         params.barangay = barangayFilter;

      const res   = await getFarmerRequests(params);
      const items = res.data.results || res.data;
      const total = res.data.count   || 0;

      // Detect new items (only after initial load)
      if (!isInitial && didInit.current) {
        const freshIds = items.map(f => f.id).filter(id => !knownIds.current.has(id));
        if (freshIds.length > 0) {
          setNewIds(prev => {
            const n = new Set(prev);
            freshIds.forEach(id => n.add(id));
            return n;
          });
          // Admin is viewing this page — auto-remove after 10s
          freshIds.forEach(id => {
            if (timeouts.current[id]) clearTimeout(timeouts.current[id]);
            timeouts.current[id] = setTimeout(() => {
              setNewIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            }, 10000);
          });
        }
      }

      knownIds.current = new Set(items.map(f => f.id));
      setFarmers(items);
      setCount(total);
      didInit.current = true;
    } catch {
      setError('Failed to load farmer requests.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [page, search, statusFilter, barangayFilter, sort]);

  useEffect(() => { fetchFarmers(true); }, [fetchFarmers]);
  useEffect(() => {
    const poll = setInterval(() => fetchFarmers(false), 15000);
    return () => clearInterval(poll);
  }, [fetchFarmers]);
  useEffect(() => () => Object.values(timeouts.current).forEach(clearTimeout), []);
  useEffect(() => { setPage(1); }, [search, statusFilter, barangayFilter, sort]);

  const handleAction = async (userId, action) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      await approveFarmer(userId, { action });
      await fetchFarmers(false);
      setConfirmModal(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

  const filterStyle = {
    padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none',
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>Farmer Account Requests</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Review farmer registrations. Approve or reject after profile is completed.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <input
          placeholder="Search name, contact, RSBSA..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...filterStyle, flex: 1, minWidth: '200px' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterStyle}>
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETE">Complete</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select value={barangayFilter} onChange={e => setBarangayFilter(e.target.value)} style={filterStyle}>
          <option value="">All Barangays</option>
          {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
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
                  ['RSBSA', COL_WIDTHS.rsbsa],
                  ['Name', COL_WIDTHS.name],
                  ['Contact', COL_WIDTHS.contact],
                  ['Barangay', COL_WIDTHS.barangay],
                  ['Status', COL_WIDTHS.status],
                  ['Date Joined', COL_WIDTHS.date],
                  ['Action', COL_WIDTHS.actions],
                ].map(([col, w]) => (
                  <th key={col} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', minWidth: w, whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</td></tr>
              ) : farmers.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No records found.</td></tr>
              ) : farmers.map((farmer, idx) => {
                const s = STATUS_COLORS[farmer.status] || STATUS_COLORS.PENDING;
                return (
                  <tr key={farmer.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', fontFamily: 'monospace', minWidth: COL_WIDTHS.rsbsa }}>{farmer.rsbsa_number || '—'}</td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: '500', minWidth: COL_WIDTHS.name }}>
                      {farmer.first_name} {farmer.last_name}
                      <NewBadge isNew={newIds.has(farmer.id)} />
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.contact }}>{farmer.contact_number}</td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.barangay }}>{farmer.barangay || '—'}</td>
                    <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.status }}>
                      <span style={{ backgroundColor: s.bg, color: s.color, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {s.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.date, whiteSpace: 'nowrap' }}>{formatDate(farmer.date_joined)}</td>
                    <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.actions }}>
                      {farmer.status === 'COMPLETE' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => setConfirmModal({ userId: farmer.id, action: 'APPROVED', farmerName: `${farmer.first_name} ${farmer.last_name}` })}
                            disabled={actionLoading[farmer.id]}
                            style={{ padding: '0.375rem 0.875rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setConfirmModal({ userId: farmer.id, action: 'REJECTED', farmerName: `${farmer.first_name} ${farmer.last_name}` })}
                            disabled={actionLoading[farmer.id]}
                            style={{ padding: '0.375rem 0.875rem', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                          {farmer.status === 'PENDING' ? 'Awaiting profile' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination count={count} page={page} pageSize={10} onPageChange={setPage} />
      </div>

      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '0.75rem' }}>
              {confirmModal.action === 'APPROVED' ? '✅ Approve' : '❌ Reject'} Farmer
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Are you sure you want to <strong>{confirmModal.action === 'APPROVED' ? 'approve' : 'reject'}</strong>{' '}
              <strong>{confirmModal.farmerName}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => handleAction(confirmModal.userId, confirmModal.action)}
                disabled={actionLoading[confirmModal.userId]}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: confirmModal.action === 'APPROVED' ? '#2d6a2d' : '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                {actionLoading[confirmModal.userId] ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerRequests;