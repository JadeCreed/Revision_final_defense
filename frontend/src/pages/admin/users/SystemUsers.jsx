import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getOfficials, createOfficial, deactivateUser, getAvailableBarangays
} from '../../../api/axios';
import { Pagination, SortDropdown, COL_WIDTHS, NewBadge } from '../../../components/tables/TableBase';

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

const ROLE_BADGE = {
  ADMIN: { bg: '#f3e8ff', color: '#7c3aed', label: 'Admin' },
  AT:    { bg: '#dbeafe', color: '#1e40af', label: 'Agri Tech' },
  BRGY:  { bg: '#dcfce7', color: '#166534', label: 'Brgy President' },
};

// Empty form state — role-agnostic, reset on modal open
const EMPTY_FORM = {
  role: 'AT', first_name: '', last_name: '', email: '',
  contact_number: '', password: '', confirm_password: '',
  assigned_barangays: [], barangay: '',
};

const FormField = ({ label, fieldKey, type = 'text', placeholder = '', value, onChange, error }) => (
  <div>
    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem', display: 'block' }}>
      {label} *
    </label>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(fieldKey, e.target.value)}
      style={{
        padding: '0.5rem 0.75rem', border: `1.5px solid ${error ? '#dc2626' : '#d1d5db'}`,
        borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', outline: 'none',
      }}
    />
    {error && (
      <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem', display: 'block' }}>
        {error}
      </span>
    )}
  </div>
);

const SystemUsers = () => {
  const [officials, setOfficials] = useState([]);
  const [count, setCount]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [sort, setSort]           = useState('-date_joined');

  // "New" tracking
  const [newIds, setNewIds]       = useState(new Set());
  const knownIds                  = useRef(new Set());
  const timeouts                  = useRef({});

  // Create modal
  const [createModal, setCreateModal]             = useState(false);
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [createForm, setCreateForm]               = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors]             = useState({});
  const [createError, setCreateError]             = useState('');
  const [barangayModalOpen, setBarangayModalOpen] = useState(false);
  const [createLoading, setCreateLoading]         = useState(false);

  // View barangays modal (AT)
  const [viewBrgyModal, setViewBrgyModal]         = useState(null);

  // Deactivate modal
  const [deactivateModal, setDeactivateModal]     = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const fetchOfficials = useCallback(async (isInitial = false) => {
    try {
      const params = { page, ordering: sort };
      if (search)                 params.search = search;
      if (roleFilter !== 'ALL')   params.role   = roleFilter;

      const res   = await getOfficials(params);
      const items = res.data.results || res.data;
      const total = res.data.count   || 0;

      if (!isInitial) {
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
      setOfficials(items);
      setCount(total);
    } catch { setError('Failed to load officials.'); }
    finally  { if (isInitial) setLoading(false); }
  }, [page, search, roleFilter, sort]);

  useEffect(() => { fetchOfficials(true); }, [fetchOfficials]);
  useEffect(() => {
    const poll = setInterval(() => fetchOfficials(false), 15000);
    return () => clearInterval(poll);
  }, [fetchOfficials]);
  useEffect(() => () => Object.values(timeouts.current).forEach(clearTimeout), []);
  useEffect(() => { setPage(1); }, [search, roleFilter, sort]);

  // Open create modal — fetch available barangays fresh each time
  const openCreateModal = async () => {
    try {
      const res = await getAvailableBarangays();
      setAvailableBarangays(res.data.available_barangays || []);
    } catch { setAvailableBarangays(BARANGAYS); }
    setCreateForm({ ...EMPTY_FORM });
    setFieldErrors({});
    setCreateError('');
    setCreateModal(true);
  };

  // Update a single form field
  // Note: when role changes, reset role-specific fields BUT keep common fields
  const handleField = (key, value) => {
    if (key === 'role') {
      setCreateForm(prev => ({
        ...prev,
        role: value,
        assigned_barangays: [],   // reset AT barangays
        barangay: '',             // reset BRGY barangay
      }));
    } else {
      setCreateForm(prev => ({ ...prev, [key]: value }));
    }
    // Clear field error when user types
    setFieldErrors(prev => ({ ...prev, [key]: '' }));
  };

  const toggleBarangay = (brgy) => {
    setCreateForm(prev => ({
      ...prev,
      assigned_barangays: prev.assigned_barangays.includes(brgy)
        ? prev.assigned_barangays.filter(b => b !== brgy)
        : [...prev.assigned_barangays, brgy]
    }));
  };

  // Frontend validation before hitting the API
  const validateForm = () => {
    const errs = {};
    if (!createForm.first_name.trim())    errs.first_name    = 'First name is required';
    if (!createForm.last_name.trim())     errs.last_name     = 'Last name is required';
    if (!createForm.email.trim())         errs.email         = 'Email is required';
    if (createForm.contact_number.length !== 11 || !createForm.contact_number.match(/^\d+$/))
      errs.contact_number = 'Must be 11 digits';
    if (!createForm.password)             errs.password      = 'Password is required';
    else if (createForm.password.length < 6) errs.password   = 'Min 6 characters';
    if (createForm.password !== createForm.confirm_password)
      errs.confirm_password = 'Passwords do not match';
    if (createForm.role === 'AT' && createForm.assigned_barangays.length === 0)
      errs.assigned_barangays = 'Select at least one barangay';
    if (createForm.role === 'BRGY' && !createForm.barangay)
      errs.barangay = 'Please select a barangay';
    return errs;
  };

  const handleCreateSubmit = async () => {
    // Run frontend validation first — don't hit API if invalid
    const frontendErrors = validateForm();
    if (Object.keys(frontendErrors).length > 0) {
      setFieldErrors(frontendErrors);
      return;
    }

    setCreateLoading(true);
    setCreateError('');
    setFieldErrors({});

    try {
      // Build payload — only send fields relevant to the role
      const payload = {
        role:           createForm.role,
        first_name:     createForm.first_name.trim(),
        last_name:      createForm.last_name.trim(),
        email:          createForm.email.trim(),
        contact_number: createForm.contact_number.trim(),
        password:       createForm.password,
        confirm_password: createForm.confirm_password,
      };

      if (createForm.role === 'AT') {
        payload.assigned_barangays = createForm.assigned_barangays;
      } else if (createForm.role === 'BRGY') {
        payload.barangay = createForm.barangay;
      }

      await createOfficial(payload);
      setCreateModal(false);
      fetchOfficials(false); // refresh table without resetting page
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fieldErrs  = {};
        const generalMsg = [];
        Object.entries(data).forEach(([key, val]) => {
          const msg = Array.isArray(val) ? val[0] : String(val);
          const knownFields = [
            'first_name','last_name','email','contact_number',
            'password','confirm_password','assigned_barangays','barangay'
          ];
          if (knownFields.includes(key)) {
            fieldErrs[key] = msg;
          } else {
            generalMsg.push(msg);
          }
        });
        setFieldErrors(fieldErrs);
        if (generalMsg.length) setCreateError(generalMsg.join(' | '));
      } else {
        setCreateError('Server error. Please try again.');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateModal) return;
    setDeactivateLoading(true);
    try {
      await deactivateUser(deactivateModal.id);
      setDeactivateModal(null);
      fetchOfficials(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Deactivation failed.');
    } finally { setDeactivateLoading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const inputStyle = { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', width: '100%', outline: 'none' };
  const filterStyle = { padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none' };
  const labelStyle  = { fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem', display: 'block' };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1a1a1a' }}>Officials</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>AT, Barangay President, and Admin accounts.</p>
        </div>
        <button onClick={openCreateModal}
          style={{ padding: '0.625rem 1.25rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}>
          + Create Account
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <input placeholder="Search name, contact, email..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ ...filterStyle, flex: 1, minWidth: '200px' }} />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={filterStyle}>
          <option value="ALL">All Roles</option>
          <option value="AT">Agricultural Technician</option>
          <option value="BRGY">Barangay President</option>
          <option value="ADMIN">Admin</option>
        </select>
        <SortDropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />
      </div>

      {error && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {[
                  ['Name',     COL_WIDTHS.name],
                  ['Contact',  COL_WIDTHS.contact],
                  ['Email',    COL_WIDTHS.email],
                  ['Role',     COL_WIDTHS.role],
                  ['Date Joined', COL_WIDTHS.date],
                  ['Barangays', '130px'],    // AT only — separate column
                  ['Action',   COL_WIDTHS.actions],
                ].map(([col, w]) => (
                  <th key={col} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', minWidth: w, whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</td></tr>
              ) : officials.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No officials found.</td></tr>
              ) : officials.map((u, idx) => {
                const roleStyle = ROLE_BADGE[u.role] || {};
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: '500', minWidth: COL_WIDTHS.name }}>
                      {u.first_name} {u.last_name}
                      <NewBadge isNew={newIds.has(u.id)} />
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.contact }}>{u.contact_number}</td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.email }}>{u.email || '—'}</td>
                    <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.role }}>
                      <span style={{
                        backgroundColor: roleStyle.bg, color: roleStyle.color,
                        padding: '0.25rem 0.75rem', borderRadius: '999px',
                        fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap',
                        display: 'inline-block', textAlign: 'center',
                      }}>
                        {roleStyle.label || u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', minWidth: COL_WIDTHS.date, whiteSpace: 'nowrap' }}>{formatDate(u.date_joined)}</td>

                    {/* Barangays column — only AT has content */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {u.role === 'AT' ? (
                        <button onClick={() => setViewBrgyModal(u)}
                          style={{ padding: '0.375rem 0.75rem', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          View ({(u.assigned_barangays || []).length})
                        </button>
                      ) : u.role === 'BRGY' ? (
                        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{u.brgy_barangay || '—'}</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>

                    {/* Deactivate column */}
                    <td style={{ padding: '0.875rem 1rem', minWidth: COL_WIDTHS.actions }}>
                      <button onClick={() => setDeactivateModal(u)}
                        style={{ padding: '0.375rem 0.75rem', backgroundColor: 'white', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Deactivate
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

      {/* ── CREATE ACCOUNT MODAL ── */}
      {createModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '1rem', overflowY: 'auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '560px', width: '100%', margin: '2rem auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontWeight: '700', fontSize: '1.25rem' }}>Create Account</h2>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Create a new system user account</p>
              </div>
              <button onClick={() => setCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {/* General error */}
            {createError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {createError}
              </div>
            )}

            {/* Role selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Role *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['AT', 'BRGY', 'ADMIN'].map(r => (
                  <button key={r} type="button"
                    onClick={() => handleField('role', r)}
                    style={{
                      flex: 1, padding: '0.5rem',
                      border: `2px solid ${createForm.role === r ? '#2d6a2d' : '#d1d5db'}`,
                      borderRadius: '0.5rem',
                      backgroundColor: createForm.role === r ? '#2d6a2d' : 'white',
                      color: createForm.role === r ? 'white' : '#374151',
                      fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem',
                    }}>
                    {r === 'AT' ? 'Agri Tech' : r === 'BRGY' ? 'Brgy President' : 'Admin'}
                  </button>
                ))}
              </div>
            </div>

            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <FormField
                label="First Name" fieldKey="first_name" placeholder="Juan"
                value={createForm.first_name}
                onChange={handleField}
                error={fieldErrors.first_name}
              />
              <FormField
                label="Last Name" fieldKey="last_name" placeholder="Dela Cruz"
                value={createForm.last_name}
                onChange={handleField}
                error={fieldErrors.last_name}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: '0.75rem' }}>
              <FormField
                label="Email" fieldKey="email" type="email" placeholder="email@example.com"
                value={createForm.email}
                onChange={handleField}
                error={fieldErrors.email}
              />
            </div>

            {/* Contact */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Contact Number *</label>
              <input
                type="text" value={createForm.contact_number}
                placeholder="09XXXXXXXXX"
                maxLength={11}
                onChange={e => handleField('contact_number', e.target.value.replace(/\D/g, '').slice(0, 11))}
                style={{ ...inputStyle, borderColor: fieldErrors.contact_number ? '#dc2626' : '#d1d5db' }}
              />
              {fieldErrors.contact_number && (
                <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem', display: 'block' }}>{fieldErrors.contact_number}</span>
              )}
            </div>

            {/* AT — multiple barangay select */}
            {createForm.role === 'AT' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Assigned Barangays *</label>
                <button type="button" onClick={() => setBarangayModalOpen(true)}
                  style={{
                    width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left',
                    border: `1.5px solid ${fieldErrors.assigned_barangays ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.85rem', color: '#374151',
                  }}>
                  {createForm.assigned_barangays.length === 0
                    ? 'Click to select barangays...'
                    : `${createForm.assigned_barangays.length} selected: ${createForm.assigned_barangays.join(', ')}`
                  }
                </button>
                {fieldErrors.assigned_barangays && (
                  <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem', display: 'block' }}>{fieldErrors.assigned_barangays}</span>
                )}
              </div>
            )}

            {/* BRGY — single barangay */}
            {createForm.role === 'BRGY' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Assigned Barangay *</label>
                <select value={createForm.barangay} onChange={e => handleField('barangay', e.target.value)}
                  style={{ ...inputStyle, borderColor: fieldErrors.barangay ? '#dc2626' : '#d1d5db' }}>
                  <option value="">Select Barangay</option>
                  {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {fieldErrors.barangay && (
                  <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem', display: 'block' }}>{fieldErrors.barangay}</span>
                )}
              </div>
            )}

            {/* Password fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={labelStyle}>Password *</label>
                <input type="password" value={createForm.password}
                  onChange={e => handleField('password', e.target.value)}
                  style={{ ...inputStyle, borderColor: fieldErrors.password ? '#dc2626' : '#d1d5db' }} />
                {fieldErrors.password && <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem', display: 'block' }}>{fieldErrors.password}</span>}
              </div>
              <div>
                <label style={labelStyle}>Confirm Password *</label>
                <input type="password" value={createForm.confirm_password}
                  onChange={e => handleField('confirm_password', e.target.value)}
                  style={{ ...inputStyle, borderColor: fieldErrors.confirm_password ? '#dc2626' : '#d1d5db' }} />
                {fieldErrors.confirm_password && <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem', display: 'block' }}>{fieldErrors.confirm_password}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setCreateModal(false)}
                style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={createLoading}
                style={{ padding: '0.5rem 1.5rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: createLoading ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: createLoading ? 0.7 : 1 }}>
                {createLoading ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BARANGAY CHECKBOX MODAL ── */}
      {barangayModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', maxWidth: '420px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '700' }}>Select Barangays</h3>
              <button onClick={() => setBarangayModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
              Only unassigned barangays shown. Greyed = already assigned.
            </p>
            <div style={{ overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {availableBarangays.map(brgy => (
                <label key={brgy} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.875rem', cursor: 'pointer', padding: '0.375rem 0.5rem',
                  borderRadius: '0.375rem',
                  backgroundColor: createForm.assigned_barangays.includes(brgy) ? '#dcfce7' : 'transparent',
                }}>
                  <input type="checkbox"
                    checked={createForm.assigned_barangays.includes(brgy)}
                    onChange={() => toggleBarangay(brgy)} />
                  {brgy}
                </label>
              ))}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{createForm.assigned_barangays.length} selected</span>
              <button onClick={() => setBarangayModalOpen(false)}
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2d6a2d', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW BARANGAYS MODAL ── */}
      {viewBrgyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '420px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: '700' }}>Assigned Barangays</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>{viewBrgyModal.first_name} {viewBrgyModal.last_name}</p>
              </div>
              <button onClick={() => setViewBrgyModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            {(viewBrgyModal.assigned_barangays || []).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {viewBrgyModal.assigned_barangays.map(b => (
                  <span key={b} style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.375rem 0.875rem', borderRadius: '999px', fontSize: '0.875rem', fontWeight: '500' }}>{b}</span>
                ))}
              </div>
            ) : <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>No barangays assigned.</p>}
            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button onClick={() => setViewBrgyModal(null)} style={{ padding: '0.5rem 1.25rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEACTIVATE MODAL ── */}
      {deactivateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '0.75rem' }}>⚠️ Deactivate Account</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Deactivate <strong>{deactivateModal.first_name} {deactivateModal.last_name}</strong> ({ROLE_BADGE[deactivateModal.role]?.label})?
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

export default SystemUsers;