// src/pages/admin/users/OfficialMasterlist.jsx
// ============================================================
// Official Masterlist — approved AT, BRGY, and ADMIN accounts
// Separate from FarmerMasterlist — different columns and actions
// Admin can: View assigned barangays (AT), Deactivate
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { getOfficials, deactivateUser } from '../../../api/axios';

const ROLE_BADGE = {
  ADMIN: { bg: '#f3e8ff', color: '#7c3aed', label: 'Admin' },
  AT:    { bg: '#dbeafe', color: '#1e40af', label: 'Agri Tech' },
  BRGY:  { bg: '#dcfce7', color: '#166534', label: 'Brgy President' },
};

const OfficialMasterlist = () => {
  const [officials, setOfficials]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // View assigned barangays modal (AT only)
  const [viewBrgyModal, setViewBrgyModal] = useState(null);

  // Deactivate confirm modal
  const [deactivateModal, setDeactivateModal]   = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const fetchOfficials = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search) params.search = search;
      if (roleFilter !== 'ALL') params.role = roleFilter;
      const res = await getOfficials(params);
      setOfficials(res.data.results || res.data);
    } catch {
      setError('Failed to load officials.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => { fetchOfficials(); }, [fetchOfficials]);

  const handleDeactivate = async () => {
    if (!deactivateModal) return;
    setDeactivateLoading(true);
    try {
      await deactivateUser(deactivateModal.id);
      setDeactivateModal(null);
      fetchOfficials();
    } catch (err) {
      setError(err.response?.data?.error || 'Deactivation failed.');
    } finally {
      setDeactivateLoading(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const inputStyle = {
    padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>
          Official Masterlist
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          All active AT, Barangay President, and Admin accounts.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <input
          placeholder="Search name, contact, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="ALL">All Roles</option>
          <option value="AT">Agricultural Technician</option>
          <option value="BRGY">Barangay President</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          onClick={() => { setSearch(''); setRoleFilter('ALL'); }}
          style={{ ...inputStyle, backgroundColor: 'white', cursor: 'pointer' }}
        >
          Reset
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Name', 'Contact', 'Email', 'Role', 'Barangay', 'Date Joined', 'Actions'].map(col => (
                  <th key={col} style={{
                    padding: '0.875rem 1rem', textAlign: 'left',
                    fontWeight: '600', color: '#374151', whiteSpace: 'nowrap'
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                    Loading...
                  </td>
                </tr>
              ) : officials.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                    No officials found.
                  </td>
                </tr>
              ) : officials.map((u, idx) => {
                const roleStyle = ROLE_BADGE[u.role] || {};
                // Determine barangay display
                const barangayDisplay = u.role === 'BRGY'
                  ? u.brgy_barangay || '—'
                  : u.role === 'AT'
                    ? `${(u.assigned_barangays || []).length} assigned`
                    : '—';

                return (
                  <tr key={u.id} style={{
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                  }}>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: '500', color: '#1a1a1a' }}>
                      {u.first_name} {u.last_name}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>
                      {u.contact_number}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>
                      {u.email || '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{
                        backgroundColor: roleStyle.bg,
                        color:           roleStyle.color,
                        padding:         '0.25rem 0.75rem',
                        borderRadius:    '999px',
                        fontSize:        '0.75rem',
                        fontWeight:      '600',
                      }}>
                        {roleStyle.label || u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>
                      {barangayDisplay}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {formatDate(u.date_joined)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* View Barangays — AT only */}
                        {u.role === 'AT' && (
                          <button
                            onClick={() => setViewBrgyModal(u)}
                            style={{
                              padding:         '0.375rem 0.75rem',
                              backgroundColor: '#eff6ff',
                              color:           '#1e40af',
                              border:          '1px solid #bfdbfe',
                              borderRadius:    '0.375rem',
                              fontSize:        '0.8rem',
                              cursor:          'pointer',
                            }}
                          >
                            View Barangays
                          </button>
                        )}
                        {/* Deactivate */}
                        <button
                          onClick={() => setDeactivateModal(u)}
                          style={{
                            padding:         '0.375rem 0.75rem',
                            backgroundColor: 'white',
                            color:           '#dc2626',
                            border:          '1.5px solid #dc2626',
                            borderRadius:    '0.375rem',
                            fontSize:        '0.8rem',
                            cursor:          'pointer',
                          }}
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #f3f4f6', fontSize: '0.8rem', color: '#9ca3af' }}>
            {officials.length} record{officials.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* ── VIEW ASSIGNED BARANGAYS MODAL ── */}
      {viewBrgyModal && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '1rem',
            padding: '2rem', maxWidth: '420px', width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: '700', fontSize: '1.1rem' }}>Assigned Barangays</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                  {viewBrgyModal.first_name} {viewBrgyModal.last_name}
                </p>
              </div>
              <button
                onClick={() => setViewBrgyModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            {viewBrgyModal.assigned_barangays?.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {viewBrgyModal.assigned_barangays.map(b => (
                  <span key={b} style={{
                    backgroundColor: '#dcfce7',
                    color:           '#166534',
                    padding:         '0.375rem 0.875rem',
                    borderRadius:    '999px',
                    fontSize:        '0.875rem',
                    fontWeight:      '500',
                  }}>
                    {b}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem 0' }}>
                No barangays assigned yet.
              </p>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                onClick={() => setViewBrgyModal(null)}
                style={{
                  padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db',
                  borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEACTIVATE CONFIRM MODAL ── */}
      {deactivateModal && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '1rem',
            padding: '2rem', maxWidth: '400px', width: '100%',
          }}>
            <h3 style={{ fontWeight: '700', marginBottom: '0.75rem' }}>⚠️ Deactivate Account</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Deactivate <strong>{deactivateModal.first_name} {deactivateModal.last_name}</strong>{' '}
              ({ROLE_BADGE[deactivateModal.role]?.label})? They will be moved to the Archive and can be reactivated later.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeactivateModal(null)}
                style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={deactivateLoading}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                {deactivateLoading ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficialMasterlist;