import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getFarmerMasterlist, getFarmerFullProfile,
  updateFarmerProfile, deactivateUser
} from '../../../api/axios';
import {
  Pagination, SortDropdown, COL_WIDTHS, NewBadge
} from '../../../components/tables/TableBase';

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

const FarmerMasterlist = () => {
  const [farmers, setFarmers] = useState([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [sort, setSort]       = useState('-date_joined');

  // "New" tracking
  const [newIds, setNewIds]   = useState(new Set());
  const knownIds              = useRef(new Set());
  const timeouts              = useRef({});

  // Modals
  const [detailsModal, setDetailsModal]     = useState(null);
  const [editForm, setEditForm]             = useState({});
  const [editLoading, setEditLoading]       = useState(false);
  const [editError, setEditError]           = useState('');
  const [editSuccess, setEditSuccess]       = useState('');
  const [deactivateModal, setDeactivateModal] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const fetchFarmers = useCallback(async (isInitial = false) => {
    try {
      const params = { page, ordering: sort };
      if (search)         params.search   = search;
      if (barangayFilter) params.barangay = barangayFilter;

      const res     = await getFarmerMasterlist(params);
      const items   = res.data.results || res.data;
      const total   = res.data.count || 0;

      if (!isInitial) {
        // Detect new items
        const freshIds = items.map(f => f.id).filter(id => !knownIds.current.has(id));
        if (freshIds.length > 0) {
          setNewIds(prev => {
            const next = new Set(prev);
            freshIds.forEach(id => next.add(id));
            return next;
          });
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

  // Initial + poll
  useEffect(() => { fetchFarmers(true); }, [fetchFarmers]);
  useEffect(() => {
    const poll = setInterval(() => fetchFarmers(false), 15000);
    return () => clearInterval(poll);
  }, [fetchFarmers]);

  // Cleanup timeouts
  useEffect(() => () => Object.values(timeouts.current).forEach(clearTimeout), []);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, barangayFilter, sort]);

  // Mark all new as seen when admin is on this page and sees the table
  useEffect(() => {
    if (newIds.size > 0) {
      const timer = setTimeout(() => setNewIds(new Set()), 10000);
      return () => clearTimeout(timer);
    }
  }, []);

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
        }
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

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const inputStyle = { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', outline: 'none' };
  const labelStyle = { fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem', display: 'block' };
  const filterStyle = { padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none' };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>Farmer Masterlist</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>Approved and active farmers.</p>
      </div>

      {/* Filters + Sort */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <input placeholder="Search name, contact, RSBSA..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ ...filterStyle, flex: 1, minWidth: '200px' }} />
        <select value={barangayFilter} onChange={e => setBarangayFilter(e.target.value)} style={filterStyle}>
          <option value="">All Barangays</option>
          {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <SortDropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />
      </div>

      {error && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {[
                  ['RSBSA', COL_WIDTHS.rsbsa],
                  ['Name',  COL_WIDTHS.name],
                  ['Contact', COL_WIDTHS.contact],
                  ['Barangay', COL_WIDTHS.barangay],
                  ['Gender', '90px'],
                  ['Hectares', '90px'],
                  ['Date Joined', COL_WIDTHS.date],
                  ['Details', COL_WIDTHS.details],   // ← separate column
                  ['Action',  COL_WIDTHS.actions],    // ← separate column
                ].map(([col, w]) => (
                  <th key={col} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', minWidth: w, whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</td></tr>
              ) : farmers.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No approved farmers found.</td></tr>
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
                  {/* Separate Details column */}
                  <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.details }}>
                    <button onClick={() => openDetails(f.id)}
                      style={{ padding: '0.375rem 0.75rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      View Details
                    </button>
                  </td>
                  {/* Separate Action column */}
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

      {/* View Details Modal — unchanged from before, kept compact */}
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

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Gender</label>
              <select value={editForm.gender} onChange={e => setEditForm(p => ({...p,gender:e.target.value}))} style={inputStyle}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <p style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2d6a2d', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Address & Farm</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[['Residency Municipality','residency_municipality'],['Residency Barangay','residency_barangay'],['Farm Municipality','farm_municipality'],['Farm Barangay','farm_barangay']].map(([l,k]) => (
                <div key={k}><label style={labelStyle}>{l}</label>
                  <input value={editForm[k]} onChange={e => setEditForm(p => ({...p,[k]:e.target.value}))} style={inputStyle} /></div>
              ))}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Total Farm Hectares (ha)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.hectares}
                onChange={e => setEditForm(p => ({ ...p, hectares: e.target.value }))}
                style={inputStyle}
                placeholder="e.g. 1.50"
              />
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
    </div>
  );
};

export default FarmerMasterlist;