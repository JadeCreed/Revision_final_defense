// src/pages/admin/users/OfficialMasterlist.jsx
import { useState, useEffect, useCallback } from 'react';
import { getOfficials, deactivateUser } from '../../../api/axios';

const ROLE_BADGE = {
  ADMIN: { bg: '#f3e8ff', color: '#7c3aed', label: 'Admin' },
  AT:    { bg: '#dbeafe', color: '#1e40af', label: 'Agri Tech' },
  BRGY:  { bg: '#dcfce7', color: '#166534', label: 'Brgy President' },
};

const PAGE_SIZE = 10;

const TABS = [
  { key: 'AT',    label: 'Agri Tech'      },
  { key: 'BRGY',  label: 'Brgy President' },
  { key: 'ADMIN', label: 'Admin'          },
];

// ── Single tab table ──
const RoleTable = ({ roleKey, search }) => {
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [page, setPage]         = useState(1);
  const [sortOrder, setSortOrder] = useState('newest');

  const [viewBrgyModal, setViewBrgyModal]         = useState(null);
  const [deactivateModal, setDeactivateModal]     = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateReason, setDeactivateReason]   = useState('');
  const [reasonError, setReasonError]             = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { role: roleKey };
      if (search) params.search = search;
      const res = await getOfficials(params);
      setData(res.data.results || res.data);
      setPage(1);
    } catch {
      setError('Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [roleKey, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeactivate = async () => {
    if (!deactivateReason.trim()) {
      setReasonError('Please provide a reason before deactivating.');
      return;
    }
    setDeactivateLoading(true);
    try {
      await deactivateUser(deactivateModal.id, { reason: deactivateReason });
      setDeactivateModal(null);
      setDeactivateReason('');
      setReasonError('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Deactivation failed.');
    } finally {
      setDeactivateLoading(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const sorted = [...data].sort((a, b) => {
    const da = new Date(a.date_joined);
    const db = new Date(b.date_joined);
    return sortOrder === 'newest' ? db - da : da - db;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inputStyle = {
    padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div>
      {/* Sort + count row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
          {data.length} record{data.length !== 1 ? 's' : ''} found
        </p>
        <select
          value={sortOrder}
          onChange={e => { setSortOrder(e.target.value); setPage(1); }}
          style={{ ...inputStyle, fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Name', 'Contact', 'Email', 'Date Joined',
                  roleKey === 'AT' ? 'Barangays' : roleKey === 'BRGY' ? 'Barangay' : null,
                  'Action'
                ].filter(Boolean).map(col => (
                  <th key={col} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                    Loading...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                    No {ROLE_BADGE[roleKey]?.label} accounts found.
                  </td>
                </tr>
              ) : paginated.map((u, idx) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 500, color: '#1a1a1a' }}>
                    {u.first_name} {u.last_name}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>
                    {u.contact_number}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>
                    {u.email || '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {formatDate(u.date_joined)}
                  </td>
                  {/* Barangay column — only AT and BRGY */}
                  {roleKey === 'AT' && (
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {(u.assigned_barangays || []).length > 0 ? (
                        <button
                          onClick={() => setViewBrgyModal(u)}
                          style={{ padding: '0.25rem 0.75rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                          View ({(u.assigned_barangays || []).length})
                        </button>
                      ) : <span style={{ color: '#9ca3af' }}>None</span>}
                    </td>
                  )}
                  {roleKey === 'BRGY' && (
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>
                      {u.brgy_barangay || '—'}
                    </td>
                  )}
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <button
                      onClick={() => { setDeactivateModal(u); setDeactivateReason(''); setReasonError(''); }}
                      style={{ padding: '0.375rem 0.75rem', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '0.375rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: page === 1 ? '#f9fafb' : 'white', color: page === 1 ? '#9ca3af' : '#374151', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>
              Previous
            </button>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: '0.375rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: page === totalPages ? '#f9fafb' : 'white', color: page === totalPages ? '#9ca3af' : '#374151', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>
              Next
            </button>
          </div>
        )}

        {!loading && totalPages <= 1 && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #f3f4f6', fontSize: '0.8rem', color: '#9ca3af' }}>
            {data.length} record{data.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── VIEW BARANGAYS MODAL ── */}
      {viewBrgyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>Assigned Barangays</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                  {viewBrgyModal.first_name} {viewBrgyModal.last_name}
                </p>
              </div>
              <button onClick={() => setViewBrgyModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            {viewBrgyModal.assigned_barangays?.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {viewBrgyModal.assigned_barangays.map(b => (
                  <span key={b} style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.375rem 0.875rem', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 500 }}>
                    {b}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem 0' }}>No barangays assigned yet.</p>
            )}
            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button onClick={() => setViewBrgyModal(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEACTIVATE MODAL ── */}
      {deactivateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>⚠️ Deactivate Account</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
              Deactivate <strong>{deactivateModal.first_name} {deactivateModal.last_name}</strong>{' '}
              ({ROLE_BADGE[deactivateModal.role]?.label})? They will be moved to Archive and can be reactivated later.
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Reason for deactivation <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                value={deactivateReason}
                onChange={e => { setDeactivateReason(e.target.value); setReasonError(''); }}
                placeholder="e.g. No longer active in the barangay, transferred, etc."
                rows={3}
                style={{
                  width: '100%', padding: '0.625rem 0.875rem',
                  border: `1.5px solid ${reasonError ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '0.5rem', fontSize: '0.875rem',
                  outline: 'none', resize: 'vertical',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              {reasonError && (
                <p style={{ fontSize: '0.75rem', color: '#dc2626', margin: '0.25rem 0 0' }}>{reasonError}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setDeactivateModal(null); setDeactivateReason(''); setReasonError(''); }}
                style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={deactivateLoading}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, opacity: deactivateLoading ? 0.7 : 1 }}>
                {deactivateLoading ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── MAIN COMPONENT ──
const OfficialMasterlist = () => {
  const [activeTab, setActiveTab] = useState('AT');
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const inputStyle = {
    padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Officials</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>
            AT, Barangay President, and Admin accounts.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.25rem',
        backgroundColor: '#f9fafb', borderRadius: '0.75rem',
        padding: '0.25rem', border: '1px solid #e5e7eb',
      }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setSearchInput(''); setSearch(''); }}
            style={{
              flex: 1,
              padding: '0.625rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: activeTab === key ? 'white' : 'transparent',
              color: activeTab === key ? '#1a1a1a' : '#6b7280',
              fontWeight: activeTab === key ? 700 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
              boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.25rem' }}>
        <input
          placeholder={`Search ${TABS.find(t => t.key === activeTab)?.label} by name, contact, email...`}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      {/* Tab content — each mounts its own RoleTable with independent pagination */}
      {TABS.map(({ key }) => (
        <div key={key} style={{ display: activeTab === key ? 'block' : 'none' }}>
          <RoleTable roleKey={key} search={search} />
        </div>
      ))}
    </div>
  );
};

export default OfficialMasterlist;