import { useState, useEffect, useCallback } from 'react';
import {
  getAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../api/axios';
import { Pagination, SortDropdown } from '../../components/tables/TableBase';

// All Lucban barangays — same list used across the system
const BARANGAYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit',
  'Kalangay','Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak',
  'Manasa','May-It','Nagsinamo','Nalunao','Palola','Piis','Samil',
  'Tiawe','Tinamnan',
];

const SORT_OPTIONS = [
  { value: '-created_at', label: 'Newest First' },
  { value: 'created_at',  label: 'Oldest First' },
];

// Empty form state — reset when modal opens for CREATE
const EMPTY_FORM = {
  title:                 '',
  content:               '',
  target_role:           'ALL',
  target_barangays_list: [],
  is_active:             true,
};

// Role badge colors for the table
const ROLE_BADGE = {
  ALL:    { bg: '#f0fdf4', color: '#166534', label: 'All Users' },
  FARMER: { bg: '#fef9c3', color: '#854d0e', label: 'Farmers' },
  AT:     { bg: '#dbeafe', color: '#1e40af', label: 'Agri Tech' },
  BRGY:   { bg: '#f3e8ff', color: '#7c3aed', label: 'Brgy President' },
};

const Announcement = () => {
  // ── TABLE STATE ──
  const [announcements, setAnnouncements] = useState([]);
  const [count, setCount]                 = useState(0);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [page, setPage]                   = useState(1);
  const [search, setSearch]               = useState('');
  const [sort, setSort]                   = useState('-created_at');
  const [roleFilter, setRoleFilter]       = useState('ALL');

  // ── MODAL STATE ──
  const [modal, setModal]                 = useState(null); // null | 'create' | 'edit' | 'deactivate'
  const [selectedAnn, setSelectedAnn]     = useState(null); // for edit/deactivate
  const [form, setForm]                   = useState({ ...EMPTY_FORM });
  const [barangayModalOpen, setBarangayModalOpen] = useState(false);
  const [fieldErrors, setFieldErrors]     = useState({});
  const [formError, setFormError]         = useState('');
  const [formLoading, setFormLoading]     = useState(false);

  // ── FETCH ──
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, ordering: sort };
      if (search)               params.search = search;
      if (roleFilter !== 'ALL') params.role   = roleFilter;

      const res   = await getAdminAnnouncements(params);
      const items = res.data.results || res.data;
      const total = res.data.count   || 0;
      setAnnouncements(items);
      setCount(total);
    } catch {
      setError('Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  }, [page, search, sort, roleFilter]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);
  useEffect(() => { setPage(1); },          [search, sort, roleFilter]);

  // ── OPEN CREATE MODAL ──
  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setFieldErrors({});
    setFormError('');
    setModal('create');
  };

  // ── OPEN EDIT MODAL ──
  const openEdit = (ann) => {
    setSelectedAnn(ann);
    setForm({
      title:                 ann.title,
      content:               ann.content,
      target_role:           ann.target_role,
      target_barangays_list: ann.target_barangays_display || [],
      is_active:             ann.is_active,
    });
    setFieldErrors({});
    setFormError('');
    setModal('edit');
  };

  // ── FORM FIELD HANDLER ──
  const handleField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key]: '' }));
  };

  // ── TOGGLE BARANGAY CHECKBOX ──
  const toggleBarangay = (brgy) => {
    setForm(prev => ({
      ...prev,
      target_barangays_list: prev.target_barangays_list.includes(brgy)
        ? prev.target_barangays_list.filter(b => b !== brgy)
        : [...prev.target_barangays_list, brgy],
    }));
  };

  // ── VALIDATE ──
  const validate = () => {
    const errs = {};
    if (!form.title.trim())   errs.title   = 'Title is required';
    if (!form.content.trim()) errs.content = 'Content is required';
    return errs;
  };

  // ── SUBMIT CREATE / EDIT ──
  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      if (modal === 'create') {
        await createAnnouncement(form);
      } else {
        await updateAnnouncement(selectedAnn.id, form);
      }
      setModal(null);
      fetchAnnouncements();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fe = {};
        Object.entries(data).forEach(([k, v]) => {
          fe[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setFieldErrors(fe);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setFormLoading(false);
    }
  };

  // ── DEACTIVATE ──
  const handleDeactivate = async () => {
    if (!selectedAnn) return;
    setFormLoading(true);
    try {
      await deleteAnnouncement(selectedAnn.id);
      setModal(null);
      fetchAnnouncements();
    } catch {
      setFormError('Failed to deactivate.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── STYLES ──
  const inputStyle = (hasErr) => ({
    padding:      '0.5rem 0.75rem',
    border:       `1.5px solid ${hasErr ? '#dc2626' : '#d1d5db'}`,
    borderRadius: '0.5rem',
    fontSize:     '0.875rem',
    width:        '100%',
    outline:      'none',
    boxSizing:    'border-box',
  });

  const labelStyle = {
    fontSize:     '0.75rem',
    fontWeight:   '600',
    color:        '#374151',
    marginBottom: '0.25rem',
    display:      'block',
  };

  const filterStyle = {
    padding:      '0.5rem 0.875rem',
    border:       '1.5px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize:     '0.875rem',
    outline:      'none',
    backgroundColor: 'white',
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric'
    }) : '—';

  // ── SHARED FORM (create + edit use same form JSX) ──
  const renderForm = () => (
    <div>
      {/* General error */}
      {formError && (
        <div style={{
          backgroundColor: '#fee2e2',
          color:           '#991b1b',
          padding:         '0.75rem',
          borderRadius:    '0.5rem',
          marginBottom:    '1rem',
          fontSize:        '0.85rem',
        }}>
          {formError}
        </div>
      )}

      {/* Title */}
      <div style={{ marginBottom: '0.875rem' }}>
        <label style={labelStyle}>Title *</label>
        <input
          value={form.title}
          onChange={e => handleField('title', e.target.value)}
          placeholder="e.g. Seed Distribution Schedule"
          style={inputStyle(!!fieldErrors.title)}
        />
        {fieldErrors.title && (
          <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem', display: 'block' }}>
            {fieldErrors.title}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ marginBottom: '0.875rem' }}>
        <label style={labelStyle}>Content *</label>
        <textarea
          value={form.content}
          onChange={e => handleField('content', e.target.value)}
          placeholder="Write the full announcement here..."
          rows={5}
          style={{
            ...inputStyle(!!fieldErrors.content),
            resize:    'vertical',
            lineHeight: 1.5,
            fontFamily: 'inherit',
          }}
        />
        {fieldErrors.content && (
          <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem', display: 'block' }}>
            {fieldErrors.content}
          </span>
        )}
      </div>

      {/* Target Role */}
      <div style={{ marginBottom: '0.875rem' }}>
        <label style={labelStyle}>Target Role *</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['ALL', 'FARMER', 'AT', 'BRGY'].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => handleField('target_role', r)}
              style={{
                padding:         '0.4rem 1rem',
                border:          `2px solid ${form.target_role === r ? '#2d6a2d' : '#d1d5db'}`,
                borderRadius:    '0.5rem',
                backgroundColor: form.target_role === r ? '#2d6a2d' : 'white',
                color:           form.target_role === r ? 'white' : '#374151',
                fontWeight:      600,
                cursor:          'pointer',
                fontSize:        '0.8rem',
              }}
            >
              {ROLE_BADGE[r]?.label || r}
            </button>
          ))}
        </div>
      </div>

      {/* Target Barangays */}
      <div style={{ marginBottom: '0.875rem' }}>
        <label style={labelStyle}>
          Target Barangays
          <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '0.5rem' }}>
            (leave empty for ALL barangays)
          </span>
        </label>
        <button
          type="button"
          onClick={() => setBarangayModalOpen(true)}
          style={{
            width:           '100%',
            padding:         '0.5rem 0.75rem',
            textAlign:       'left',
            border:          '1.5px solid #d1d5db',
            borderRadius:    '0.5rem',
            backgroundColor: 'white',
            cursor:          'pointer',
            fontSize:        '0.85rem',
            color:           form.target_barangays_list.length > 0 ? '#374151' : '#9ca3af',
          }}
        >
          {form.target_barangays_list.length === 0
            ? 'All barangays (click to select specific ones)'
            : `${form.target_barangays_list.length} selected: ${form.target_barangays_list.join(', ')}`
          }
        </button>
      </div>

      {/* Active toggle (edit only) */}
      {modal === 'edit' && (
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => handleField('is_active', e.target.checked)}
            />
            <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 600 }}>
              Active (visible to users)
            </span>
          </label>
        </div>
      )}
    </div>
  );

  return (
    <div>

      {/* ── PAGE HEADER ── */}
      <div style={{
        display:       'flex',
        justifyContent:'space-between',
        alignItems:    'flex-start',
        marginBottom:  '1.5rem',
        flexWrap:      'wrap',
        gap:           '1rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            Announcements
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Create and manage announcements for all user roles.
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            padding:         '0.625rem 1.25rem',
            backgroundColor: '#2d6a2d',
            color:           'white',
            border:          'none',
            borderRadius:    '0.5rem',
            fontWeight:      600,
            cursor:          'pointer',
            fontSize:        '0.875rem',
          }}
        >
          + New Announcement
        </button>
      </div>

      {/* ── FILTERS ── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <input
          placeholder="Search title or content..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...filterStyle, flex: 1, minWidth: '200px' }}
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={filterStyle}>
          <option value="ALL">All Roles</option>
          <option value="FARMER">Farmers</option>
          <option value="AT">Agri Tech</option>
          <option value="BRGY">Brgy President</option>
        </select>
        <SortDropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          color:           '#991b1b',
          padding:         '0.75rem',
          borderRadius:    '0.5rem',
          marginBottom:    '1rem',
          fontSize:        '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* ── TABLE ── */}
      <div style={{
        backgroundColor: 'white',
        borderRadius:    '0.75rem',
        boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
        overflow:        'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {[
                  ['Title',      '220px'],
                  ['Target',     '130px'],
                  ['Barangays',  '160px'],
                  ['Status',     '100px'],
                  ['Date',       '130px'],
                  ['Actions',    '150px'],
                ].map(([col, w]) => (
                  <th key={col} style={{
                    padding:    '0.875rem 1rem',
                    textAlign:  'left',
                    fontWeight: 600,
                    color:      '#374151',
                    minWidth:   w,
                    whiteSpace: 'nowrap',
                  }}>
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
              ) : announcements.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                    No announcements found.
                  </td>
                </tr>
              ) : announcements.map((ann, idx) => {
                const roleStyle = ROLE_BADGE[ann.target_role] || ROLE_BADGE.ALL;
                const brgys     = ann.target_barangays_display || [];
                return (
                  <tr key={ann.id} style={{
                    borderBottom:    '1px solid #f3f4f6',
                    backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                    opacity:         ann.is_active ? 1 : 0.5,
                  }}>
                    {/* Title */}
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 500, color: '#1a1a1a' }}>
                      <div style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ann.title}
                      </div>
                    </td>

                    {/* Target role */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{
                        backgroundColor: roleStyle.bg,
                        color:           roleStyle.color,
                        padding:         '0.25rem 0.75rem',
                        borderRadius:    '999px',
                        fontSize:        '0.75rem',
                        fontWeight:      600,
                        whiteSpace:      'nowrap',
                      }}>
                        {roleStyle.label}
                      </span>
                    </td>

                    {/* Barangays */}
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', fontSize: '0.8rem' }}>
                      {brgys.length === 0
                        ? 'All Barangays'
                        : brgys.length <= 2
                          ? brgys.join(', ')
                          : `${brgys[0]}, ${brgys[1]} +${brgys.length - 2}`
                      }
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{
                        backgroundColor: ann.is_active ? '#dcfce7' : '#f3f4f6',
                        color:           ann.is_active ? '#166534' : '#6b7280',
                        padding:         '0.25rem 0.75rem',
                        borderRadius:    '999px',
                        fontSize:        '0.75rem',
                        fontWeight:      600,
                      }}>
                        {ann.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {formatDate(ann.created_at)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openEdit(ann)}
                          style={{
                            padding:         '0.375rem 0.75rem',
                            backgroundColor: '#eff6ff',
                            color:           '#1e40af',
                            border:          '1px solid #bfdbfe',
                            borderRadius:    '0.375rem',
                            fontSize:        '0.8rem',
                            cursor:          'pointer',
                            fontWeight:      500,
                          }}
                        >
                          Edit
                        </button>
                        {ann.is_active && (
                          <button
                            onClick={() => { setSelectedAnn(ann); setModal('deactivate'); }}
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
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination count={count} page={page} pageSize={10} onPageChange={setPage} />
      </div>

      {/* ══════════════════════════════════════════
          CREATE / EDIT MODAL
      ══════════════════════════════════════════ */}
      {(modal === 'create' || modal === 'edit') && (
        <div style={{
          position:        'fixed',
          inset:           0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display:         'flex',
          alignItems:      'flex-start',
          justifyContent:  'center',
          zIndex:          100,
          padding:         '1rem',
          overflowY:       'auto',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius:    '1rem',
            padding:         '2rem',
            maxWidth:        '560px',
            width:           '100%',
            margin:          '2rem auto',
            boxShadow:       '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            {/* Modal header */}
            <div style={{
              display:       'flex',
              justifyContent:'space-between',
              marginBottom:  '1.5rem',
            }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.25rem', margin: 0 }}>
                  {modal === 'create' ? 'New Announcement' : 'Edit Announcement'}
                </h2>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                  {modal === 'create'
                    ? 'Create a new announcement for users'
                    : 'Update the announcement details'
                  }
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            {/* Form */}
            {renderForm()}

            {/* Modal footer */}
            <div style={{
              display:       'flex',
              justifyContent:'flex-end',
              gap:           '0.75rem',
              marginTop:     '1.5rem',
              borderTop:     '1px solid #f3f4f6',
              paddingTop:    '1.25rem',
            }}>
              <button
                onClick={() => setModal(null)}
                style={{
                  padding:         '0.5rem 1.25rem',
                  border:          '1.5px solid #d1d5db',
                  borderRadius:    '0.5rem',
                  backgroundColor: 'white',
                  cursor:          'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={formLoading}
                style={{
                  padding:         '0.5rem 1.5rem',
                  backgroundColor: '#2d6a2d',
                  color:           'white',
                  border:          'none',
                  borderRadius:    '0.5rem',
                  cursor:          formLoading ? 'not-allowed' : 'pointer',
                  fontWeight:      600,
                  opacity:         formLoading ? 0.7 : 1,
                }}
              >
                {formLoading
                  ? 'Saving...'
                  : modal === 'create' ? 'Post Announcement' : 'Save Changes'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          BARANGAY CHECKBOX MODAL
      ══════════════════════════════════════════ */}
      {barangayModalOpen && (
        <div style={{
          position:        'fixed',
          inset:           0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          zIndex:          200,
          padding:         '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius:    '1rem',
            padding:         '1.5rem',
            maxWidth:        '420px',
            width:           '100%',
            maxHeight:       '80vh',
            display:         'flex',
            flexDirection:   'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, margin: 0 }}>Select Barangays</h3>
              <button
                onClick={() => setBarangayModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
              Leave all unchecked to target ALL barangays.
            </p>

            {/* Select all / Clear all */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                onClick={() => setForm(prev => ({ ...prev, target_barangays_list: [...BARANGAYS] }))}
                style={{
                  fontSize: '0.78rem', padding: '0.3rem 0.75rem',
                  border: '1px solid #d1d5db', borderRadius: '0.375rem',
                  backgroundColor: 'white', cursor: 'pointer',
                }}
              >
                Select All
              </button>
              <button
                onClick={() => setForm(prev => ({ ...prev, target_barangays_list: [] }))}
                style={{
                  fontSize: '0.78rem', padding: '0.3rem 0.75rem',
                  border: '1px solid #d1d5db', borderRadius: '0.375rem',
                  backgroundColor: 'white', cursor: 'pointer',
                }}
              >
                Clear All
              </button>
            </div>

            {/* Barangay checkboxes */}
            <div style={{
              overflowY:           'auto',
              flex:                1,
              display:             'grid',
              gridTemplateColumns: '1fr 1fr',
              gap:                 '0.5rem',
            }}>
              {BARANGAYS.map(brgy => (
                <label key={brgy} style={{
                  display:         'flex',
                  alignItems:      'center',
                  gap:             '0.5rem',
                  fontSize:        '0.875rem',
                  cursor:          'pointer',
                  padding:         '0.375rem 0.5rem',
                  borderRadius:    '0.375rem',
                  backgroundColor: form.target_barangays_list.includes(brgy) ? '#dcfce7' : 'transparent',
                }}>
                  <input
                    type="checkbox"
                    checked={form.target_barangays_list.includes(brgy)}
                    onChange={() => toggleBarangay(brgy)}
                  />
                  {brgy}
                </label>
              ))}
            </div>

            <div style={{
              marginTop:     '1rem',
              display:       'flex',
              justifyContent:'space-between',
              alignItems:    'center',
            }}>
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                {form.target_barangays_list.length === 0
                  ? 'All barangays selected'
                  : `${form.target_barangays_list.length} selected`
                }
              </span>
              <button
                onClick={() => setBarangayModalOpen(false)}
                style={{
                  padding:         '0.5rem 1.25rem',
                  backgroundColor: '#2d6a2d',
                  color:           'white',
                  border:          'none',
                  borderRadius:    '0.5rem',
                  cursor:          'pointer',
                  fontWeight:      600,
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          DEACTIVATE CONFIRM MODAL
      ══════════════════════════════════════════ */}
      {modal === 'deactivate' && selectedAnn && (
        <div style={{
          position:        'fixed',
          inset:           0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          zIndex:          100,
          padding:         '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius:    '1rem',
            padding:         '2rem',
            maxWidth:        '400px',
            width:           '100%',
          }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>
              ⚠️ Deactivate Announcement
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Deactivate <strong>"{selectedAnn.title}"</strong>?
              It will no longer be visible to users.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModal(null)}
                style={{
                  padding:         '0.5rem 1.25rem',
                  border:          '1.5px solid #d1d5db',
                  borderRadius:    '0.5rem',
                  backgroundColor: 'white',
                  cursor:          'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={formLoading}
                style={{
                  padding:         '0.5rem 1.25rem',
                  backgroundColor: '#dc2626',
                  color:           'white',
                  border:          'none',
                  borderRadius:    '0.5rem',
                  cursor:          'pointer',
                  fontWeight:      600,
                  opacity:         formLoading ? 0.7 : 1,
                }}
              >
                {formLoading ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Announcement;