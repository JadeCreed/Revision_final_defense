// src/pages/admin/users/FarmerRecords.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getFarmerRequests, approveFarmer,
  getFarmerMasterlist, getFarmerFullProfile,
  updateFarmerProfile, deactivateUser,
  adminResetPassword,
} from '../../../api/axios';
import {
  Pagination, SortDropdown, COL_WIDTHS, NewBadge, getSeenIds,
} from '../../../components/tables/TableBase';

const BARANGAYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan',
];

const filterStyle = {
  padding: '0.5rem 0.875rem',
  border: '1.5px solid #d1d5db',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  outline: 'none',
};

const inputStyle = {
  padding: '0.5rem 0.75rem',
  border: '1.5px solid #d1d5db',
  borderRadius: '0.5rem',
  fontSize: '0.85rem',
  width: '100%',
  outline: 'none',
};

const labelStyle = {
  fontSize: '0.75rem',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '0.25rem',
  display: 'block',
};

const STATUS_COLORS = {
  PENDING:  { bg: '#fef9c3', color: '#854d0e', label: 'Pending'  },
  COMPLETE: { bg: '#dbeafe', color: '#1e40af', label: 'Complete' },
  APPROVED: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
  REJECTED: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
};

const REQUESTS_SORT = [
  { value: 'status_priority', label: 'Status Priority' },
  { value: '-date_joined',    label: 'Newest First'    },
  { value: 'date_joined',     label: 'Oldest First'    },
  { value: 'last_name',       label: 'Name A–Z'        },
  { value: '-last_name',      label: 'Name Z–A'        },
];

const MASTERLIST_SORT = [
  { value: '-date_joined', label: 'Newest First' },
  { value: 'date_joined',  label: 'Oldest First' },
  { value: 'last_name',    label: 'Name A–Z'     },
  { value: '-last_name',   label: 'Name Z–A'     },
];

const TABLE_KEY = 'farmer_requests';

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';


// ── TAB 1: FARMER ACCOUNTS (exact logic from FarmerRequests.jsx) ──
const FarmerAccountsTab = () => {
  const [farmers, setFarmers]               = useState([]);
  const [count, setCount]                   = useState(0);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [page, setPage]                     = useState(1);
  const [search, setSearch]                 = useState('');
  const [statusFilter, setStatusFilter]     = useState('ALL');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [sort, setSort]                     = useState('status_priority');
  const [newIds, setNewIds]                 = useState(new Set());
  const prevIds                             = useRef(new Set());
  const didInit                             = useRef(false);
  const newTimeouts                         = useRef({});
  const [actionLoading, setActionLoading]   = useState({});
  const [confirmModal, setConfirmModal]     = useState(null);
  const [accountsDetailsModal, setAccountsDetailsModal] = useState(null);
  const [accountsEditForm, setAccountsEditForm] = useState({});
  const [accountsEditLoading, setAccountsEditLoading] = useState(false);
  const [accountsEditError, setAccountsEditError] = useState('');
  const [accountsEditSuccess, setAccountsEditSuccess] = useState('');

  const scheduleNewBadgeHide = (id) => {
    if (newTimeouts.current[id]) clearTimeout(newTimeouts.current[id]);
    newTimeouts.current[id] = setTimeout(() => {
      setNewIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      delete newTimeouts.current[id];
    }, 10000);
  };

  const fetchFarmers = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError('');
    try {
      const params = { page, ordering: sort };
      if (search)                 params.search   = search;
      if (statusFilter !== 'ALL') params.status   = statusFilter;
      if (barangayFilter)         params.barangay = barangayFilter;

      const res        = await getFarmerRequests(params);
      const items      = res.data.results || res.data;
      const total      = res.data.count   || 0;
      const currentIds = new Set(items.map(f => f.id));

      if (isInitial) {
        const alreadySeen = getSeenIds(TABLE_KEY);
        const unseenIds   = [...currentIds].filter(id => !alreadySeen.has(id));
        if (unseenIds.length > 0) {
          setNewIds(new Set(unseenIds));
          unseenIds.forEach(scheduleNewBadgeHide);
        }
      } else if (didInit.current) {
        const freshIds = [...currentIds].filter(id => !prevIds.current.has(id));
        if (freshIds.length > 0) {
          setNewIds(prev => { const n = new Set(prev); freshIds.forEach(id => n.add(id)); return n; });
          freshIds.forEach(scheduleNewBadgeHide);
        }
      }

      prevIds.current = currentIds;
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
  useEffect(() => () => Object.values(newTimeouts.current).forEach(clearTimeout), []);
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

  const openAccountsDetails = async (userId) => {
    try {
      const res = await getFarmerFullProfile(userId);
      const farmer = res.data;
      setAccountsDetailsModal(farmer);
      setAccountsEditForm({
        first_name: farmer.first_name || '',
        last_name: farmer.last_name || '',
        middle_name: farmer.profile?.middle_name || '',
        ext_name: farmer.profile?.ext_name || '',
        date_of_birth: farmer.profile?.date_of_birth || '',
        email: farmer.email || '',
        contact_number: farmer.contact_number || '',
        barangay: farmer.barangay || '',
        rsbsa_number: farmer.rsbsa_number || '',
        residency_municipality: farmer.profile?.residency_municipality || '',
        residency_barangay: farmer.profile?.residency_barangay || '',
        farm_municipality: farmer.profile?.farm_municipality || '',
        farm_barangay: farmer.profile?.farm_barangay || '',
        gender: farmer.profile?.gender || '',
        hectares: farmer.profile?.hectares ?? '',
        id_card_url: farmer.profile?.id_card_url || '',
      });
      setAccountsEditError('');
      setAccountsEditSuccess('');
    } catch (err) {
      setError('Failed to load farmer details.');
    }
  };

  const handleAccountsSave = async () => {
    if (!accountsDetailsModal) return;
    setAccountsEditLoading(true);
    setAccountsEditError('');
    setAccountsEditSuccess('');
    try {
      await updateFarmerProfile(accountsDetailsModal.id, {
        first_name: accountsEditForm.first_name,
        last_name: accountsEditForm.last_name,
        email: accountsEditForm.email,
        contact_number: accountsEditForm.contact_number,
        barangay: accountsEditForm.barangay,
        rsbsa_number: accountsEditForm.rsbsa_number,
        profile: {
          middle_name: accountsEditForm.middle_name,
          ext_name: accountsEditForm.ext_name,
          date_of_birth: accountsEditForm.date_of_birth,
          gender: accountsEditForm.gender,
          residency_municipality: accountsEditForm.residency_municipality,
          residency_barangay: accountsEditForm.residency_barangay,
          farm_municipality: accountsEditForm.farm_municipality,
          farm_barangay: accountsEditForm.farm_barangay,
          hectares: accountsEditForm.hectares,
        },
      });
      setAccountsEditSuccess('Profile updated successfully.');
      await fetchFarmers(false);
    } catch (err) {
      setAccountsEditError(err.response?.data?.error || 'Update failed.');
    } finally {
      setAccountsEditLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <input placeholder="Search name, contact, RSBSA..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...filterStyle, flex: 1, minWidth: '200px' }} />
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
        <SortDropdown value={sort} onChange={setSort} options={REQUESTS_SORT} />
      </div>

      {error && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {[['RSBSA', COL_WIDTHS.rsbsa],['Name', COL_WIDTHS.name],['Contact', COL_WIDTHS.contact],['Barangay', COL_WIDTHS.barangay],['Status', COL_WIDTHS.status],['Details', '110px'],['Date Joined', COL_WIDTHS.date],['Action', COL_WIDTHS.actions]].map(([col, w]) => (
                  <th key={col} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', minWidth: w, whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</td></tr>
              ) : farmers.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No records found.</td></tr>
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
                      <span style={{ backgroundColor: s.bg, color: s.color, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', minWidth: '110px' }}>
                      <button onClick={() => openAccountsDetails(farmer.id)}
                        style={{ padding: '0.375rem 0.75rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        View Details
                      </button>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.date, whiteSpace: 'nowrap' }}>{formatDate(farmer.date_joined)}</td>
                    <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.actions }}>
                      {farmer.status === 'COMPLETE' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => setConfirmModal({ userId: farmer.id, action: 'APPROVED', farmerName: `${farmer.first_name} ${farmer.last_name}` })} disabled={actionLoading[farmer.id]}
                            style={{ padding: '0.375rem 0.875rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}>Approve</button>
                          <button onClick={() => setConfirmModal({ userId: farmer.id, action: 'REJECTED', farmerName: `${farmer.first_name} ${farmer.last_name}` })} disabled={actionLoading[farmer.id]}
                            style={{ padding: '0.375rem 0.875rem', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' }}>Reject</button>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{farmer.status === 'PENDING' ? 'Awaiting profile' : '—'}</span>
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
            <h3 style={{ fontWeight: '700', marginBottom: '0.75rem' }}>{confirmModal.action === 'APPROVED' ? '✅ Approve' : '❌ Reject'} Farmer</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Are you sure you want to <strong>{confirmModal.action === 'APPROVED' ? 'approve' : 'reject'}</strong> <strong>{confirmModal.farmerName}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleAction(confirmModal.userId, confirmModal.action)} disabled={actionLoading[confirmModal.userId]}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: confirmModal.action === 'APPROVED' ? '#2d6a2d' : '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', opacity: actionLoading[confirmModal.userId] ? 0.7 : 1 }}>
                {actionLoading[confirmModal.userId] ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {accountsDetailsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 110, padding: '1rem', overflowY: 'auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '720px', width: '100%', margin: '2rem auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem' }}>
              <div>
                <h2 style={{ fontWeight: '700', margin: 0 }}>Farmer Details</h2>
                <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.85rem' }}>View and edit farmer profile details.</p>
              </div>
              <button onClick={() => setAccountsDetailsModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            {accountsEditError && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{accountsEditError}</div>}
            {accountsEditSuccess && <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{accountsEditSuccess}</div>}

            <p style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2d6a2d', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Basic Info</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[['First Name','first_name'],['Last Name','last_name'],['Middle Name','middle_name'],['Suffix','ext_name']].map(([l,k]) => (
                <div key={k}><label style={labelStyle}>{l}</label>
                  <input value={accountsEditForm[k]} onChange={e => setAccountsEditForm(p => ({...p,[k]:e.target.value}))} style={inputStyle} /></div>
              ))}
            </div>

            <p style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2d6a2d', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Contact</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[['Contact','contact_number'],['Email','email'],['RSBSA','rsbsa_number'],['Date of Birth','date_of_birth']].map(([l,k]) => (
                <div key={k}><label style={labelStyle}>{l}</label>
                  <input type={k==='date_of_birth'?'date':'text'} value={accountsEditForm[k]} onChange={e => setAccountsEditForm(p => ({...p,[k]:e.target.value}))} style={inputStyle} /></div>
              ))}
            </div>

            <p style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2d6a2d', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Address & Farm</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[['Residency Municipality','residency_municipality'],['Residency Barangay','residency_barangay'],['Farm Municipality','farm_municipality'],['Farm Barangay','farm_barangay']].map(([l,k]) => (
                <div key={k}><label style={labelStyle}>{l}</label>
                  <input value={accountsEditForm[k]} onChange={e => setAccountsEditForm(p => ({...p,[k]:e.target.value}))} style={inputStyle} /></div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Gender</label>
                <select value={accountsEditForm.gender} onChange={e => setAccountsEditForm(p => ({...p,gender:e.target.value}))} style={inputStyle}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Total Farm Hectares (ha)</label>
                <input type="number" step="0.01" min="0" value={accountsEditForm.hectares}
                  onChange={e => setAccountsEditForm(p => ({ ...p, hectares: e.target.value }))}
                  style={inputStyle} placeholder="e.g. 1.50" />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>ID Card</label>
              {accountsEditForm.id_card_url ? (
                <img src={accountsEditForm.id_card_url} alt="Farmer ID card" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '0.75rem', border: '1px solid #d1d5db' }} />
              ) : (
                <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', color: '#6b7280' }}>
                  No ID card uploaded yet.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f3f4f6', paddingTop: '1.25rem' }}>
              <button onClick={() => setAccountsDetailsModal(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Close</button>
              <button onClick={handleAccountsSave} disabled={accountsEditLoading}
                style={{ padding: '0.5rem 1.5rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', opacity: accountsEditLoading ? 0.7 : 1 }}>
                {accountsEditLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ── TAB 2: FARMER MASTERLIST (exact logic from FarmerMasterlist.jsx) ──
const FarmerMasterlistTab = () => {
  const [farmers, setFarmers]               = useState([]);
  const [count, setCount]                   = useState(0);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [page, setPage]                     = useState(1);
  const [search, setSearch]                 = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [sort, setSort]                     = useState('-date_joined');
  const [newIds, setNewIds]                 = useState(new Set());
  const knownIds                            = useRef(new Set());
  const timeouts                            = useRef({});
  const [detailsModal, setDetailsModal]         = useState(null);
  const [editForm, setEditForm]                 = useState({});
  const [editLoading, setEditLoading]           = useState(false);
  const [editError, setEditError]               = useState('');
  const [editSuccess, setEditSuccess]           = useState('');
  const [deactivateModal, setDeactivateModal]   = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [resetModal, setResetModal]             = useState(null);
  const [resetMode, setResetMode]               = useState('');
  const [resetLoading, setResetLoading]         = useState(false);
  const [resetError, setResetError]             = useState('');
  const [resetSuccess, setResetSuccess]         = useState('');
  const [newPassword, setNewPassword]           = useState('');

  const fetchFarmers = useCallback(async (isInitial = false) => {
    try {
      const params = { page, ordering: sort };
      if (search)         params.search   = search;
      if (barangayFilter) params.barangay = barangayFilter;

      const res   = await getFarmerMasterlist(params);
      const items = res.data.results || res.data;
      const total = res.data.count   || 0;

      if (!isInitial) {
        const freshIds = items.map(f => f.id).filter(id => !knownIds.current.has(id));
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
      knownIds.current = new Set(items.map(f => f.id));
      setFarmers(items);
      setCount(total);
    } catch {
      setError('Failed to load farmers.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [page, search, barangayFilter, sort]);

  useEffect(() => { fetchFarmers(true); }, [fetchFarmers]);
  useEffect(() => {
    const poll = setInterval(() => fetchFarmers(false), 15000);
    return () => clearInterval(poll);
  }, [fetchFarmers]);
  useEffect(() => () => Object.values(timeouts.current).forEach(clearTimeout), []);
  useEffect(() => { setPage(1); }, [search, barangayFilter, sort]);

  const openDetails = async (farmerId) => {
    try {
      const res = await getFarmerFullProfile(farmerId);
      setDetailsModal(res.data);
      setEditForm({
        first_name: res.data.first_name || '', last_name: res.data.last_name || '',
        email: res.data.email || '', contact_number: res.data.contact_number || '',
        barangay: res.data.barangay || '', rsbsa_number: res.data.rsbsa_number || '',
        middle_name: res.data.profile?.middle_name || '',
        ext_name: res.data.profile?.ext_name || '',
        date_of_birth: res.data.profile?.date_of_birth || '',
        gender: res.data.profile?.gender || '',
        residency_municipality: res.data.profile?.residency_municipality || '',
        residency_barangay: res.data.profile?.residency_barangay || '',
        farm_municipality: res.data.profile?.farm_municipality || '',
        farm_barangay: res.data.profile?.farm_barangay || '',
        hectares: res.data.profile?.hectares ?? '',
        id_card_url: res.data.profile?.id_card_url || '',
        ip: res.data.profile?.ip || false,
        senior_citizen: res.data.profile?.senior_citizen || false,
        pwd: res.data.profile?.pwd || false,
        arbs: res.data.profile?.arbs || false,
        four_ps: res.data.profile?.four_ps || false,
      });
      setEditError(''); setEditSuccess('');
    } catch { setError('Failed to load farmer details.'); }
  };

  const handleSave = async () => {
    if (!detailsModal) return;
    setEditLoading(true); setEditError(''); setEditSuccess('');
    try {
      await updateFarmerProfile(detailsModal.id, {
        first_name: editForm.first_name, last_name: editForm.last_name,
        email: editForm.email, contact_number: editForm.contact_number,
        barangay: editForm.barangay, rsbsa_number: editForm.rsbsa_number,
        profile: {
          middle_name: editForm.middle_name, ext_name: editForm.ext_name,
          date_of_birth: editForm.date_of_birth, gender: editForm.gender,
          residency_municipality: editForm.residency_municipality,
          residency_barangay: editForm.residency_barangay,
          farm_municipality: editForm.farm_municipality,
          farm_barangay: editForm.farm_barangay,
          hectares: editForm.hectares,
          ip: editForm.ip, senior_citizen: editForm.senior_citizen,
          pwd: editForm.pwd, arbs: editForm.arbs, four_ps: editForm.four_ps,
        },
      });
      setEditSuccess('Profile updated!');
      fetchFarmers(false);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Update failed.');
    } finally { setEditLoading(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivateModal) return;
    setDeactivateLoading(true);
    try {
      await deactivateUser(deactivateModal.id);
      setDeactivateModal(null);
      fetchFarmers(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Deactivation failed.');
    } finally { setDeactivateLoading(false); }
  };

  const handleReset = async (mode) => {
    if (!resetModal) return;
    setResetLoading(true);
    setResetError('');
    setResetSuccess('');
    try {
      const payload = mode === 'auto'
        ? { auto_generate: true }
        : { new_password: newPassword };
      const res = await adminResetPassword(resetModal.id, payload);
      setResetSuccess(mode === 'auto'
        ? `Temporary password generated. Share it with the farmer: ${res.data.new_password || 'See admin console.'}`
        : 'Password has been reset successfully.');
      setResetMode('');
      setNewPassword('');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Reset failed. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <input placeholder="Search name, contact, RSBSA..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...filterStyle, flex: 1, minWidth: '200px' }} />
        <select value={barangayFilter} onChange={e => setBarangayFilter(e.target.value)} style={filterStyle}>
          <option value="">All Barangays</option>
          {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <SortDropdown value={sort} onChange={setSort} options={MASTERLIST_SORT} />
      </div>

      {error && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {[['RSBSA', COL_WIDTHS.rsbsa],['Name', COL_WIDTHS.name],['Contact', COL_WIDTHS.contact],['Barangay', COL_WIDTHS.barangay],['Gender', '90px'],['Hectares', '90px'],['Date Joined', COL_WIDTHS.date],['Details', COL_WIDTHS.details],['Reset Request', '140px'],['Action', COL_WIDTHS.actions]].map(([col, w]) => (
                  <th key={col} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', minWidth: w, whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</td></tr>
              ) : farmers.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No approved farmers found.</td></tr>
              ) : farmers.map((f, idx) => (
                <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280', fontFamily: 'monospace', minWidth: COL_WIDTHS.rsbsa }}>{f.rsbsa_number || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: '500', minWidth: COL_WIDTHS.name }}>
                    {f.first_name} {f.last_name}
                    <NewBadge isNew={newIds.has(f.id)} />
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.contact }}>{f.contact_number}</td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.barangay }}>{f.barangay || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>{f.gender || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>{typeof f.hectares === 'number' ? f.hectares.toFixed(2) : '—'}</td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.date, whiteSpace: 'nowrap' }}>{formatDate(f.date_joined)}</td>
                  <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.details }}>
                    <button onClick={() => openDetails(f.id)}
                      style={{ padding: '0.375rem 0.75rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      View Details
                    </button>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <button onClick={() => {
                        setResetModal(f);
                        setResetMode('');
                        setResetError('');
                        setResetSuccess('');
                        setNewPassword('');
                      }}
                      style={{ padding: '0.375rem 0.75rem', backgroundColor: '#fef3c7', color: '#92400e', border: '1.5px solid #fcd34d', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Reset Password
                    </button>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.actions }}>
                    <button onClick={() => setDeactivateModal(f)}
                      style={{ padding: '0.375rem 0.75rem', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination count={count} page={page} pageSize={10} onPageChange={setPage} />
      </div>

      {detailsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '1rem', overflowY: 'auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '680px', width: '100%', margin: '2rem auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontWeight: '700' }}>Farmer Profile</h2>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Edit farmer information</p>
              </div>
              <button onClick={() => setDetailsModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            {editError   && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{editError}</div>}
            {editSuccess && <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{editSuccess}</div>}
            <p style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2d6a2d', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Basic Info</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[['First Name','first_name'],['Last Name','last_name'],['Middle Name','middle_name'],['Suffix','ext_name']].map(([l,k]) => (
                <div key={k}><label style={labelStyle}>{l}</label>
                  <input value={editForm[k]} onChange={e => setEditForm(p => ({...p,[k]:e.target.value}))} style={inputStyle} /></div>
              ))}
            </div>
            <p style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2d6a2d', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Contact</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[['Contact','contact_number'],['Email','email'],['RSBSA','rsbsa_number'],['Date of Birth','date_of_birth']].map(([l,k]) => (
                <div key={k}><label style={labelStyle}>{l}</label>
                  <input type={k==='date_of_birth'?'date':'text'} value={editForm[k]} onChange={e => setEditForm(p => ({...p,[k]:e.target.value}))} style={inputStyle} /></div>
              ))}
            </div>
            <p style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2d6a2d', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Address & Farm</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[['Residency Municipality','residency_municipality'],['Residency Barangay','residency_barangay'],['Farm Municipality','farm_municipality'],['Farm Barangay','farm_barangay']].map(([l,k]) => (
                <div key={k}><label style={labelStyle}>{l}</label>
                  <input value={editForm[k]} onChange={e => setEditForm(p => ({...p,[k]:e.target.value}))} style={inputStyle} /></div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Gender</label>
                <select value={editForm.gender} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))} style={inputStyle}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Total Farm Hectares (ha)</label>
                <input type="number" step="0.01" min="0" value={editForm.hectares}
                  onChange={e => setEditForm(p => ({ ...p, hectares: e.target.value }))}
                  style={inputStyle} placeholder="e.g. 1.50" />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>ID Card</label>
              {editForm.id_card_url ? (
                <img src={editForm.id_card_url} alt="Farmer ID card" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '0.75rem', border: '1px solid #d1d5db' }} />
              ) : (
                <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', color: '#6b7280' }}>
                  No ID card uploaded yet.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f3f4f6', paddingTop: '1.25rem' }}>
              <button onClick={() => setDetailsModal(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Close</button>
              <button onClick={handleSave} disabled={editLoading} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '0.75rem' }}>⚠️ Deactivate Farmer</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Deactivate <strong>{deactivateModal.first_name} {deactivateModal.last_name}</strong>? They'll be moved to Archive.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeactivateModal(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeactivate} disabled={deactivateLoading}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
                {deactivateLoading ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontWeight: '700', margin: 0, fontSize: '1.1rem' }}>Reset Password</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
                  {resetModal.first_name} {resetModal.last_name}
                </p>
              </div>
              <button onClick={() => { setResetModal(null); setResetMode(''); setResetSuccess(''); setResetError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>

            {resetError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{resetError}</div>
            )}

            {resetSuccess ? (
              <div>
                <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.25rem', fontSize: '0.875rem', fontWeight: '600', lineHeight: 1.6 }}>
                  ✅ {resetSuccess}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setResetModal(null); setResetMode(''); setResetSuccess(''); }} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '1rem' }}>
                  Choose how to reset this farmer's password:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <button onClick={() => setResetMode('auto')} style={{ padding: '0.85rem 1rem', borderRadius: '0.75rem', cursor: 'pointer', border: `2px solid ${resetMode === 'auto' ? '#2d6a2d' : '#e5e7eb'}`, backgroundColor: resetMode === 'auto' ? '#f0fdf4' : 'white', textAlign: 'left', transition: 'all 0.15s' }}>
                    <p style={{ fontWeight: '700', color: '#1a1a1a', margin: '0 0 0.125rem', fontSize: '0.875rem' }}>🎲 Generate Temporary Password</p>
                    <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>System generates a temporary password the admin can share with the farmer.</p>
                  </button>

                  <button onClick={() => setResetMode('manual')} style={{ padding: '0.85rem 1rem', borderRadius: '0.75rem', cursor: 'pointer', border: `2px solid ${resetMode === 'manual' ? '#2d6a2d' : '#e5e7eb'}`, backgroundColor: resetMode === 'manual' ? '#f0fdf4' : 'white', textAlign: 'left', transition: 'all 0.15s' }}>
                    <p style={{ fontWeight: '700', color: '#1a1a1a', margin: '0 0 0.125rem', fontSize: '0.875rem' }}>✏️ Set Manual Password</p>
                    <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>Enter a password you've agreed on with the farmer.</p>
                  </button>
                </div>

                {resetMode === 'manual' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                      New Password
                    </label>
                    <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setResetModal(null); setResetMode(''); setResetError(''); }} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
                  {resetMode && (
                    <button onClick={() => handleReset(resetMode)} disabled={resetLoading || (resetMode === 'manual' && newPassword.length < 6)} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: resetLoading || (resetMode === 'manual' && newPassword.length < 6) ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: resetLoading || (resetMode === 'manual' && newPassword.length < 6) ? 0.65 : 1 }}>
                      {resetLoading ? 'Resetting...' : 'Confirm Reset'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// ── MAIN EXPORT ──
const FarmerRecords = () => {
  const [activeTab, setActiveTab] = useState('accounts');

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>Farmer Records</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Manage farmer registrations and the approved farmer masterlist.
        </p>
      </div>

      <div style={{ display: 'flex', marginBottom: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: '0.25rem', border: '1px solid #e5e7eb', width: 'fit-content' }}>
        {[{ key: 'accounts', label: 'Pending Farmers' }, { key: 'masterlist', label: 'Registered Farmers' }].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', backgroundColor: activeTab === key ? 'white' : 'transparent', color: activeTab === key ? '#1a4d1a' : '#6b7280', fontWeight: activeTab === key ? '700' : '400', fontSize: '0.875rem', cursor: 'pointer', boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'accounts'   && <FarmerAccountsTab />}
      {activeTab === 'masterlist' && <FarmerMasterlistTab />}
    </div>
  );
};

export default FarmerRecords;
