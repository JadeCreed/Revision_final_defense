import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Search,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Users,
  AlertTriangle,
  Activity,
  Filter,
  Eye,
  Upload,
  RotateCcw,
  Save,
} from 'lucide-react';
import logo from '../../assets/logo.png';
import { getAuditLogs } from '../../api/axios';

/*
 * Activity Type vocabulary.
 *
 * The backend AuditLog.ACTIVITY_TYPE_CHOICES codes are the single
 * source of truth. Codes are what live in React state and what all
 * filtering compares against. Labels exist for display only.
 */
const ACTIVITY_TYPE_LABELS = {
  DATA_CHANGE: 'Data Changes',
  SECURITY: 'Security',
  USER_MANAGEMENT: 'User Management',
  WORKFLOW: 'Workflow',
  SYSTEM_CONFIGURATION: 'System Configuration',
  SYSTEM_ACTIVITY: 'System Activity',
};

const ACTIVITY_TYPE_CODES = Object.keys(ACTIVITY_TYPE_LABELS);

const formatActivityType = (value) => {
  if (!value) return '';
  return ACTIVITY_TYPE_LABELS[value] || value;
};

const toActivityTypeCode = (value) => value || '';

const formatActionLabel = (action) => {
  const raw = (action || '').trim();
  if (!raw) return '';
  if (!/^[A-Z0-9_]+$/.test(raw)) return raw;

  return raw
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

const toLocalDateKey = (value) => {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


const GENERAL_DEFAULTS = {
  systemName: 'AGRICE',
  systemSubtitle: 'Municipal Agriculture Office System',
  systemDescription:
    'AGRICE is the official digital platform of the Municipal Agriculture Office of Lucban, Quezon. Supporting transparent and efficient rice program management.',
  contactOffice: 'MAO Lucban, Quezon',
  contactEmail: 'mao.lucban@quezon.gov.ph',
  contactNumber: '(042) XXX-XXXX',
  copyrightText: '© 2026. All rights reserved.',
  poweredByText: 'Powered by the Office of the Municipal Mayor',
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');

   const [generalSettings, setGeneralSettings] = useState(GENERAL_DEFAULTS);
  const [generalPreviews, setGeneralPreviews] = useState({
    logo,
    icon: logo,
    favicon: logo,
  });
  const [generalNotice, setGeneralNotice] = useState('');

  const handleGeneralTextChange = (field) => (event) => {
    setGeneralSettings((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
    setGeneralNotice('');
  };

  const handleGeneralImageChange = (previewKey) => (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isAcceptedImage =
      selectedFile.type.startsWith('image/') || fileName.endsWith('.ico');

    if (!isAcceptedImage) {
      setGeneralNotice('Please choose an image file or an .ico favicon file.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') return;

      setGeneralPreviews((previous) => ({
        ...previous,
        [previewKey]: reader.result,
      }));
      setGeneralNotice('');
    };

    reader.onerror = () => {
      setGeneralNotice('The selected file could not be previewed.');
    };

    reader.readAsDataURL(selectedFile);
  };

  const resetGeneralPreview = () => {
    setGeneralSettings(GENERAL_DEFAULTS);
    setGeneralPreviews({
      logo,
      icon: logo,
      favicon: logo,
    });
    setGeneralNotice('Preview reset to the original temporary defaults.');
  };

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [moduleFilter, setModuleFilter] = useState('All Modules');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [activityTypeFilter, setActivityTypeFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

const [currentPage, setCurrentPage] = useState(1);
const [selectedLog, setSelectedLog] = useState(null);

const [auditLogs, setAuditLogs] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(false);
const [auditLogsLoaded, setAuditLogsLoaded] = useState(false);

const PAGE_SIZE = 25;


const fetchAuditLogs = useCallback(async () => {
  setLoading(true);
  setError(false);

  try {
    let page = 1;
    let allResults = [];
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await getAuditLogs({
        page,
        page_size: 100,
      });

      const data = response.data;
      const results = Array.isArray(data?.results) ? data.results : [];

      allResults = [...allResults, ...results];

      hasNextPage = Boolean(data?.next);
      page += 1;
    }

    const mappedLogs = allResults.map((item) => ({
      id: item.id,
      timestamp: item.created_at,
      user: item.actor_name || 'System',
      role: item.actor_role || 'SYSTEM',
      action: item.action,
      module: item.module,
      record: item.target_repr || '',
      status: item.status,
      activityType: toActivityTypeCode(item.activity_type),
      description: item.description || '',
    }));

    setAuditLogs(mappedLogs);
    setAuditLogsLoaded(true);
  } catch (fetchError) {
    console.error('Failed to load audit logs:', fetchError);
    // No fallback data. A failed request means an empty, honest
    // error state — never fabricated audit records.
    setAuditLogs([]);
    setError(true);
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  if (activeTab !== 'audit' || auditLogsLoaded) {
    return;
  }

  fetchAuditLogs();
}, [activeTab, auditLogsLoaded, fetchAuditLogs]);

const handleRetry = () => {
  setSelectedLog(null);
  fetchAuditLogs();
};

  const roles = useMemo(
    () => ['All Roles', ...new Set(auditLogs.map((log) => log.role))],
    [auditLogs]
  );

  const modules = useMemo(
  () => ['All Modules', ...new Set(auditLogs.map((log) => log.module))],
  [auditLogs]
);

const activityTypes = ['ALL', ...ACTIVITY_TYPE_CODES];

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const activityLabel = formatActivityType(log.activityType);
      const actionLabel = formatActionLabel(log.action);

      const matchesSearch =
        !query ||
        (log.user || '').toLowerCase().includes(query) ||
        (log.record || '').toLowerCase().includes(query) ||
        (log.action || '').toLowerCase().includes(query) ||
        actionLabel.toLowerCase().includes(query) ||
        (log.module || '').toLowerCase().includes(query) ||
        (log.description || '').toLowerCase().includes(query) ||
        (log.activityType || '').toLowerCase().includes(query) ||
        activityLabel.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === 'All Roles' || log.role === roleFilter;

      const matchesModule =
        moduleFilter === 'All Modules' || log.module === moduleFilter;

      const matchesStatus =
        statusFilter === 'All Status' || log.status === statusFilter;

      const matchesActivity =
        activityTypeFilter === 'ALL' ||
        log.activityType === activityTypeFilter;

      // Local calendar date — same rule as Today's Activities.
      const logDate = toLocalDateKey(log.timestamp);

      const matchesFrom = !fromDate || (logDate !== '' && logDate >= fromDate);
      const matchesTo = !toDate || (logDate !== '' && logDate <= toDate);

      return (
        matchesSearch &&
        matchesRole &&
        matchesModule &&
        matchesStatus &&
        matchesActivity &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    auditLogs,
    search,
    roleFilter,
    moduleFilter,
    statusFilter,
    activityTypeFilter,
    fromDate,
    toDate,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / PAGE_SIZE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedLogs = filteredLogs.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  /*
   * How many audit events happened today, where "today" is the
   * local calendar date the timestamp actually falls on.
   */
  const todaysActivityCount = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    if (!todayKey) return 0;

    return auditLogs.filter(
      (log) => toLocalDateKey(log.timestamp) === todayKey
    ).length;
  }, [auditLogs]);

  /*
   * Close the details panel when the selected record is no longer
   * in the filtered set — covers filter changes, search changes,
   * and any future data replacement in one place.
   */
  useEffect(() => {
    if (!selectedLog) return;

    const stillVisible = filteredLogs.some(
      (log) => log.id === selectedLog.id
    );

    if (!stillVisible) {
      setSelectedLog(null);
    }
  }, [filteredLogs, selectedLog]);

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('All Roles');
    setModuleFilter('All Modules');
    setStatusFilter('All Status');
    setActivityTypeFilter('ALL');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
  };

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp);

    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const getRoleStyle = (role) => {
    if (role === 'ADMIN') {
      return {
        background: '#f3e8ff',
        color: '#7e22ce',
      };
    }

    if (role === 'AT') {
      return {
        background: '#eff6ff',
        color: '#2563eb',
      };
    }

    if (role === 'BRGY') {
      return {
        background: '#fff7ed',
        color: '#c2410c',
      };
    }

    return {
      background: '#ecfdf5',
      color: '#059669',
    };
  };

    /*
   * Matches on substrings of the uppercased action so it works for
   * real backend codes (FARMER_ACCOUNT_CREATED) without needing a
   * per-action lookup table.
   */
  const getActionStyle = (action) => {
    const key = (action || '').toUpperCase();

    if (key.includes('DELET') || key.includes('REJECT') || key.includes('DEACTIVAT')) {
      return {
        background: '#fee2e2',
        color: '#dc2626',
      };
    }

    if (key.includes('CREAT') || key.includes('APPROV') || key.includes('REACTIVAT')) {
      return {
        background: '#dcfce7',
        color: '#15803d',
      };
    }

    if (key.includes('CONFIGURATION')) {
      return {
        background: '#f3e8ff',
        color: '#7e22ce',
      };
    }

    return {
      background: '#eff6ff',
      color: '#2563eb',
    };
  };

  const getStatusStyle = (status) => {
    if (status === 'FAILED') {
      return {
        background: '#fee2e2',
        color: '#dc2626',
      };
    }

    return {
      background: '#dcfce7',
      color: '#15803d',
    };
  };

  return (
    <div
        className="admin-settings-page"
        style={{
          minHeight: '100%',
          padding: '1.5rem',
          background: '#f8faf9',
        }}
      >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            width: '3rem',
            height: '3rem',
            borderRadius: '0.75rem',
            background: '#e8f5ed',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <SettingsIcon size={28} />
        </div>

        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: '700',
              color: '#172033',
            }}
          >
            Settings
          </h1>

          <p
            style={{
              margin: '0.25rem 0 0',
              color: '#6b7280',
              fontSize: '0.9rem',
            }}
          >
            Manage system configuration, branding and monitor system
            activities.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          style={{
            flex: 1,
            minHeight: '3.25rem',
            padding: '0.75rem 1rem',
            border: 'none',
            borderBottom:
              activeTab === 'general'
                ? '3px solid #15803d'
                : '3px solid transparent',
            background: '#ffffff',
            color: activeTab === 'general' ? '#166534' : '#64748b',
            fontWeight: activeTab === 'general' ? '700' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <SettingsIcon size={18} />
          General Settings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          style={{
            flex: 1,
            minHeight: '3.25rem',
            padding: '0.75rem 1rem',
            border: 'none',
            borderBottom:
              activeTab === 'audit'
                ? '3px solid #15803d'
                : '3px solid transparent',
            background: '#ffffff',
            color: activeTab === 'audit' ? '#166534' : '#64748b',
            fontWeight: activeTab === 'audit' ? '700' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldCheck size={18} />
          Audit Trail
        </button>
      </div>

      {/* General Tab */}
{activeTab === 'general' && (
  <div style={{ display: 'grid', gap: '1rem' }}>
    <section
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '0.875rem',
        padding: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <SettingsIcon size={22} color="#166534" />
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#172033',
            }}
          >
            General Settings
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Preview branding and footer information without changing the live system.
          </p>
        </div>
      </div>
    </section>

    <section
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '0.875rem',
        padding: '1.5rem',
      }}
    >
      <h3 style={{ margin: '0 0 0.35rem', color: '#172033', fontSize: '1.05rem' }}>
        System Branding
      </h3>
      <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
        Selected files are temporary previews inside this page only.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        {[
          { key: 'logo', label: 'System Logo', inputId: 'system-logo-upload' },
          { key: 'icon', label: 'Application Icon', inputId: 'application-icon-upload' },
          { key: 'favicon', label: 'Favicon', inputId: 'favicon-upload' },
        ].map((item) => (
          <div
            key={item.key}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '0.75rem',
              padding: '1rem',
            }}
          >
            <p style={{ margin: '0 0 0.25rem', fontWeight: '700', color: '#172033' }}>
              {item.label}
            </p>
            <p style={{ margin: '0 0 0.85rem', color: '#64748b', fontSize: '0.75rem' }}>
              Preview only — not applied to the system.
            </p>

            <div
              style={{
                height: '96px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8faf9',
                border: '1px solid #e5e7eb',
                borderRadius: '0.65rem',
                marginBottom: '0.75rem',
                overflow: 'hidden',
              }}
            >
              <img
                src={generalPreviews[item.key]}
                alt={`${item.label} preview`}
                style={{ maxWidth: '80%', maxHeight: '72px', objectFit: 'contain' }}
              />
            </div>

            <input
              id={item.inputId}
              type="file"
              accept="image/*,.ico"
              onChange={handleGeneralImageChange(item.key)}
              style={{ display: 'none' }}
            />

            <label
              htmlFor={item.inputId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.6rem 0.75rem',
                border: '1px solid #bbd6c2',
                borderRadius: '0.55rem',
                color: '#166534',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              <Upload size={15} />
              Choose Image
            </label>
          </div>
        ))}
      </div>
    </section>

    <section
  style={{
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '0.875rem',
    padding: '1.5rem',
  }}
>
  <h3 style={{ margin: '0 0 0.35rem', color: '#172033', fontSize: '1.05rem' }}>
    System Information
  </h3>
  <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
    These fields update the Settings preview only.
  </p>

  {[
    { key: 'systemName', label: 'System Name', rows: 1, maxLength: 255 },
    { key: 'systemSubtitle', label: 'System Subtitle', rows: 1, maxLength: 255 },
    {
      key: 'systemDescription',
      label: 'System Description',
      rows: 4,
      maxLength: 500,
    },
  ].map((field) => (
    <div key={field.key} style={{ marginBottom: '1rem' }}>
      <label
        htmlFor={field.key}
        style={{
          display: 'block',
          marginBottom: '0.45rem',
          color: '#334155',
          fontSize: '0.82rem',
          fontWeight: '700',
        }}
      >
        {field.label}
      </label>

      <textarea
        id={field.key}
        rows={field.rows}
        maxLength={field.maxLength}
        value={generalSettings[field.key]}
        onChange={handleGeneralTextChange(field.key)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          border: '1px solid #dbe3ea',
          borderRadius: '0.6rem',
          padding: '0.75rem',
          color: '#334155',
          fontFamily: 'inherit',
          fontSize: '0.85rem',
          lineHeight: 1.5,
        }}
      />

      <p
        style={{
          margin: '0.3rem 0 0',
          color: '#94a3b8',
          fontSize: '0.72rem',
          textAlign: 'right',
        }}
      >
        {generalSettings[field.key].length}/{field.maxLength}
      </p>
    </div>
  ))}

  <div
    style={{
      borderTop: '1px solid #e5e7eb',
      margin: '1.5rem 0',
      paddingTop: '1.5rem',
    }}
  >
    <h3 style={{ margin: '0 0 0.35rem', color: '#172033', fontSize: '1.05rem' }}>
      Contact Information
    </h3>
    <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
      These values are preview-only and do not update the public footer yet.
    </p>

    {[
      { key: 'contactOffice', label: 'Contact Office', maxLength: 255 },
      { key: 'contactEmail', label: 'Contact Email', maxLength: 255 },
      { key: 'contactNumber', label: 'Contact Number', maxLength: 255 },
    ].map((field) => (
      <div key={field.key} style={{ marginBottom: '1rem' }}>
        <label
          htmlFor={field.key}
          style={{
            display: 'block',
            marginBottom: '0.45rem',
            color: '#334155',
            fontSize: '0.82rem',
            fontWeight: '700',
          }}
        >
          {field.label}
        </label>

        <textarea
          id={field.key}
          rows={1}
          maxLength={field.maxLength}
          value={generalSettings[field.key]}
          onChange={handleGeneralTextChange(field.key)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            border: '1px solid #dbe3ea',
            borderRadius: '0.6rem',
            padding: '0.75rem',
            color: '#334155',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            lineHeight: 1.5,
          }}
        />

        <p
          style={{
            margin: '0.3rem 0 0',
            color: '#94a3b8',
            fontSize: '0.72rem',
            textAlign: 'right',
          }}
        >
          {generalSettings[field.key].length}/{field.maxLength}
        </p>
      </div>
    ))}
  </div>

  <div
    style={{
      borderTop: '1px solid #e5e7eb',
      margin: '1.5rem 0',
      paddingTop: '1.5rem',
    }}
  >
    <h3 style={{ margin: '0 0 0.35rem', color: '#172033', fontSize: '1.05rem' }}>
      Footer Information
    </h3>

    {[
      { key: 'copyrightText', label: 'Copyright Text', maxLength: 255 },
      { key: 'poweredByText', label: 'Powered By Text', maxLength: 255 },
    ].map((field) => (
      <div key={field.key} style={{ marginTop: '1rem' }}>
        <label
          htmlFor={field.key}
          style={{
            display: 'block',
            marginBottom: '0.45rem',
            color: '#334155',
            fontSize: '0.82rem',
            fontWeight: '700',
          }}
        >
          {field.label}
        </label>

        <textarea
          id={field.key}
          rows={1}
          maxLength={field.maxLength}
          value={generalSettings[field.key]}
          onChange={handleGeneralTextChange(field.key)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            border: '1px solid #dbe3ea',
            borderRadius: '0.6rem',
            padding: '0.75rem',
            color: '#334155',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            lineHeight: 1.5,
          }}
        />

        <p
          style={{
            margin: '0.3rem 0 0',
            color: '#94a3b8',
            fontSize: '0.72rem',
            textAlign: 'right',
          }}
        >
          {generalSettings[field.key].length}/{field.maxLength}
        </p>
      </div>
    ))}
  </div>

  {generalNotice && (
    <div
      role="status"
      style={{
        marginTop: '1rem',
        padding: '0.75rem',
        color: '#166534',
        background: '#ecfdf5',
        border: '1px solid #bbf7d0',
        borderRadius: '0.6rem',
        fontSize: '0.82rem',
      }}
    >
      {generalNotice}
    </div>
  )}

  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: '0.75rem',
      marginTop: '1.25rem',
    }}
  >
    <button
      type="button"
      onClick={resetGeneralPreview}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.65rem 0.9rem',
        border: '1px solid #cbd5e1',
        borderRadius: '0.55rem',
        background: '#ffffff',
        color: '#475569',
        fontWeight: '700',
        cursor: 'pointer',
      }}
    >
      <RotateCcw size={16} />
      Reset
    </button>

    <button
      type="button"
      onClick={() =>
        setGeneralNotice(
          'Preview updated only—changes are not yet applied to the live system.'
        )
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.65rem 0.9rem',
        border: 'none',
        borderRadius: '0.55rem',
        background: '#15803d',
        color: '#ffffff',
        fontWeight: '700',
        cursor: 'pointer',
      }}
    >
      <Save size={16} />
      Save Changes
    </button>
  </div>
</section>

  <section
  style={{
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '0.875rem',
    padding: '1.5rem',
  }}
>
  <h3 style={{ margin: '0 0 0.35rem', color: '#172033', fontSize: '1.05rem' }}>
    Live Preview
  </h3>

  <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.85rem' }}>
    Preview only — the real public footer remains unchanged.
  </p>

  <div
    style={{
      overflow: 'hidden',
      border: '1px solid #dbe3ea',
      borderRadius: '0.75rem',
      background: '#14532d',
      color: '#ffffff',
    }}
  >
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '2rem',
        padding: '1.5rem',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <img
            src={generalPreviews.logo}
            alt="System logo preview"
            style={{
              width: '42px',
              height: '42px',
              objectFit: 'contain',
              background: '#ffffff',
              borderRadius: '0.4rem',
            }}
          />
          <strong style={{ fontSize: '1rem' }}>
            {generalSettings.systemName}
          </strong>
        </div>

        <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', opacity: 0.82 }}>
          {generalSettings.systemSubtitle}
        </p>

        <p
          style={{
            margin: '0.75rem 0 0',
            fontSize: '0.78rem',
            lineHeight: 1.6,
            opacity: 0.9,
          }}
        >
          {generalSettings.systemDescription}
        </p>
      </div>

      <div>
        <strong style={{ fontSize: '0.85rem' }}>Quick Links</strong>

        {['Home', 'About MAO', 'Programs', 'Announcements', 'Documentation'].map(
          (link) => (
            <div
              key={link}
              style={{
                marginTop: '0.55rem',
                fontSize: '0.78rem',
                opacity: 0.9,
              }}
            >
              {link}
            </div>
          )
        )}
      </div>

      <div>
        <strong style={{ fontSize: '0.85rem' }}>Contact</strong>

        <div style={{ marginTop: '0.55rem', fontSize: '0.78rem', opacity: 0.9 }}>
          {generalSettings.contactOffice}
        </div>

        <div style={{ marginTop: '0.55rem', fontSize: '0.78rem', opacity: 0.9 }}>
          {generalSettings.contactEmail}
        </div>

        <div style={{ marginTop: '0.55rem', fontSize: '0.78rem', opacity: 0.9 }}>
          {generalSettings.contactNumber}
        </div>
      </div>
    </div>

    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.2)',
        padding: '1rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
        fontSize: '0.72rem',
        opacity: 0.92,
      }}
    >
      <span>
        {generalSettings.systemName} — Municipal Agriculture Office, Lucban{' '}
        {generalSettings.copyrightText}
      </span>

      <span>{generalSettings.poweredByText}</span>
    </div>
  </div>
  </section>
      </div>
    )}

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && (
        <div>
          {/* Audit Header */}
          <section
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.875rem',
              padding: '1.25rem 1.5rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '2.75rem',
                    height: '2.75rem',
                    borderRadius: '0.75rem',
                    background: '#e8f5ed',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldCheck size={24} />
                </div>

                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: '#172033',
                    }}
                  >
                    Audit Trail
                  </h2>

                  <p
                    style={{
                      margin: '0.2rem 0 0',
                      color: '#64748b',
                      fontSize: '0.85rem',
                    }}
                  >
                    Track and review system activities for accountability and
                    traceability.
                  </p>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  color: error ? '#b45309' : '#64748b',
                  background: error ? '#fffbeb' : '#f8fafc',
                  border: error ? '1px solid #fde68a' : '1px solid #e2e8f0',
                  borderRadius: '999px',
                  padding: '0.45rem 0.75rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {error ? 'Data unavailable' : 'Live audit data'}
              </div>
            </div>
          </section>

          {/* Summary Cards */}
          <div
            className="audit-summary-grid"
            style={{
              display: 'grid',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.875rem',
                padding: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: '#e8f5ed',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={20} />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '1.3rem',
                      fontWeight: '700',
                      color: '#172033',
                    }}
                  >
                    {auditLogs.length}
                  </div>

                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: '#64748b',
                    }}
                  >
                    Total Activities
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.875rem',
                padding: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: '#e8f5ed',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CalendarDays size={20} />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '1.3rem',
                      fontWeight: '700',
                      color: '#172033',
                    }}
                  >
                    {todaysActivityCount}
                  </div>

                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: '#64748b',
                    }}
                  >
                    Today's Activities
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.875rem',
                padding: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Users size={20} />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '1.3rem',
                      fontWeight: '700',
                      color: '#172033',
                    }}
                  >
                    {new Set(auditLogs.map((log) => log.role)).size}
                  </div>

                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: '#64748b',
                    }}
                  >
                    Active Roles
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.875rem',
                padding: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: '#fef2f2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={20} />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '1.3rem',
                      fontWeight: '700',
                      color: '#172033',
                    }}
                  >
                    {
                      auditLogs.filter(
                        (log) => log.status === 'FAILED'
                      ).length
                    }
                  </div>

                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: '#64748b',
                    }}
                  >
                    Failed Activities
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <section
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.875rem',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                }}
              >
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                  }}
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search user, record, action, or keyword..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '2.75rem',
                    padding: '0.65rem 0.75rem 0.65rem 2.5rem',
                    border: '1px solid #dbe3ea',
                    borderRadius: '0.65rem',
                    outline: 'none',
                    fontSize: '0.85rem',
                    color: '#172033',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={resetFilters}
                style={{
                  minHeight: '2.75rem',
                  padding: '0.65rem 0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.65rem',
                  background: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <Filter size={16} />
                Clear All
              </button>
            </div>

            <div
              className="audit-filter-grid"
              style={{
                display: 'grid',
                gap: '0.75rem',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.35rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#475569',
                  }}
                >
                  From
                </label>

                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) =>
                    handleFilterChange(setFromDate)(event.target.value)
                  }
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '2.5rem',
                    padding: '0.55rem',
                    border: '1px solid #dbe3ea',
                    borderRadius: '0.6rem',
                    fontSize: '0.78rem',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.35rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#475569',
                  }}
                >
                  To
                </label>

                <input
                  type="date"
                  value={toDate}
                  onChange={(event) =>
                    handleFilterChange(setToDate)(event.target.value)
                  }
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '2.5rem',
                    padding: '0.55rem',
                    border: '1px solid #dbe3ea',
                    borderRadius: '0.6rem',
                    fontSize: '0.78rem',
                  }}
                />
              </div>

              {[
                {
                  label: 'Role',
                  value: roleFilter,
                  setter: setRoleFilter,
                  options: roles,
                },
                {
                  label: 'Module',
                  value: moduleFilter,
                  setter: setModuleFilter,
                  options: modules,
                },
                {
                  label: 'Status',
                  value: statusFilter,
                  setter: setStatusFilter,
                  options: ['All Status', 'SUCCESS', 'FAILED'],
                },
              ].map((filter) => (
                <div key={filter.label}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.35rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: '#475569',
                    }}
                  >
                    {filter.label}
                  </label>

                  <div style={{ position: 'relative' }}>
                    <select
                      value={filter.value}
                      onChange={(event) =>
                        handleFilterChange(filter.setter)(event.target.value)
                      }
                      style={{
                        width: '100%',
                        minHeight: '2.5rem',
                        padding: '0.55rem 2rem 0.55rem 0.65rem',
                        border: '1px solid #dbe3ea',
                        borderRadius: '0.6rem',
                        background: '#ffffff',
                        fontSize: '0.78rem',
                        appearance: 'none',
                      }}
                    >
                      {filter.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={15}
                      style={{
                        position: 'absolute',
                        right: '0.6rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: '#64748b',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Activity Type */}
            <div style={{ marginTop: '1rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '0.5rem',
                }}
              >
                Activity Type
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                {activityTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      handleFilterChange(setActivityTypeFilter)(type)
                    }
                    style={{
                      border:
                        activityTypeFilter === type
                          ? '1px solid #15803d'
                          : '1px solid #dbe3ea',
                      background:
                        activityTypeFilter === type ? '#15803d' : '#f8fafc',
                      color:
                        activityTypeFilter === type ? '#ffffff' : '#475569',
                      borderRadius: '999px',
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {type === 'ALL' ? 'All' : formatActivityType(type)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Error State */}
          {error && (
            <section
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.875rem',
                padding: '1.5rem',
                marginBottom: '1rem',
                color: '#991b1b',
              }}
            >
            Unable to load audit records.
              <button
                type="button"
                onClick={handleRetry}
                disabled={loading}
                style={{
                  marginLeft: '0.75rem',
                  border: 'none',
                  background: 'transparent',
                  color: '#991b1b',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Retrying…' : 'Try Again'}
              </button>
            </section>
          )}

          {/* Main Audit Content */}
          <div
            className={`audit-main-grid${selectedLog ? ' audit-main-grid--details' : ''}`}
            style={{
              display: 'grid',
              gap: '1rem',
              alignItems: 'start',
            }}
          >
            {/* Audit Table */}
            <section
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.875rem',
                overflow: 'hidden',
              }}
            >
              {loading ? (
                <div
                  style={{
                    padding: '4rem 1rem',
                    textAlign: 'center',
                    color: '#64748b',
                  }}
                >
                  Loading audit records...
                </div>
              ) : paginatedLogs.length === 0 ? (
                <div
                  style={{
                    padding: '4rem 1rem',
                    textAlign: 'center',
                    color: '#64748b',
                  }}
                >
                  <Activity
                    size={32}
                    style={{
                      marginBottom: '0.75rem',
                      color: '#94a3b8',
                    }}
                  />

                  <div
                    style={{
                      fontWeight: '700',
                      color: '#334155',
                      marginBottom: '0.25rem',
                    }}
                  >
                    No audit records found.
                  </div>

                  <div style={{ fontSize: '0.8rem' }}>
                    Try changing your search or filters.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        minWidth: '850px',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: '#f8fafc',
                            borderBottom: '1px solid #e5e7eb',
                          }}
                        >
                          {[
                            'Date & Time',
                            'User',
                            'Role',
                            'Action',
                            'Module',
                            'Record',
                            'Status',
                            'Details',
                          ].map((heading) => (
                            <th
                              key={heading}
                              style={{
                                padding: '0.8rem 0.65rem',
                                textAlign: 'left',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                color: '#475569',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {paginatedLogs.map((log) => {
                          const dateTime = formatDateTime(log.timestamp);

                          return (
                            <tr
                              key={log.id}
                              style={{
                                borderBottom: '1px solid #eef2f5',
                              }}
                            >
                              <td
                                style={{
                                  padding: '0.75rem 0.65rem',
                                  fontSize: '0.72rem',
                                  color: '#334155',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <div style={{ fontWeight: '600' }}>
                                  {dateTime.date}
                                </div>
                                <div
                                  style={{
                                    color: '#94a3b8',
                                    marginTop: '0.15rem',
                                  }}
                                >
                                  {dateTime.time}
                                </div>
                              </td>

                              <td
                                style={{
                                  padding: '0.75rem 0.65rem',
                                  fontSize: '0.75rem',
                                  color: '#334155',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {log.user}
                              </td>

                              <td style={{ padding: '0.75rem 0.65rem' }}>
                                <span
                                  style={{
                                    ...getRoleStyle(log.role),
                                    display: 'inline-block',
                                    borderRadius: '999px',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.65rem',
                                    fontWeight: '700',
                                  }}
                                >
                                  {log.role}
                                </span>
                              </td>

                              <td style={{ padding: '0.75rem 0.65rem' }}>
                                <span
                                  style={{
                                    ...getActionStyle(log.action),
                                    display: 'inline-block',
                                    borderRadius: '999px',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.65rem',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                              {formatActionLabel(log.action)}
                                </span>
                              </td>

                              <td
                                style={{
                                  padding: '0.75rem 0.65rem',
                                  fontSize: '0.72rem',
                                  color: '#475569',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {log.module}
                              </td>

                              <td
                                style={{
                                  padding: '0.75rem 0.65rem',
                                  fontSize: '0.72rem',
                                  color: '#475569',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {log.record}
                              </td>

                              <td style={{ padding: '0.75rem 0.65rem' }}>
                                <span
                                  style={{
                                    ...getStatusStyle(log.status),
                                    display: 'inline-block',
                                    borderRadius: '999px',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.65rem',
                                    fontWeight: '700',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {log.status === 'SUCCESS'
                                    ? 'Success'
                                    : 'Failed'}
                                </span>
                              </td>

                              <td style={{ padding: '0.75rem 0.65rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedLog(log)}
                                  style={{
                                    border: '1px solid #dbe3ea',
                                    background: '#ffffff',
                                    color: '#475569',
                                    borderRadius: '0.5rem',
                                    padding: '0.4rem 0.6rem',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                  }}
                                >
                                  <Eye size={14} />
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.85rem 1rem',
                      borderTop: '1px solid #eef2f5',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: '#64748b',
                      }}
                    >
                      Showing{' '}
                      {filteredLogs.length === 0
                        ? 0
                        : (safeCurrentPage - 1) * PAGE_SIZE + 1}
                      –
                      {Math.min(
                        safeCurrentPage * PAGE_SIZE,
                        filteredLogs.length
                      )}{' '}
                      of {filteredLogs.length} results
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <button
                        type="button"
                        disabled={safeCurrentPage === 1}
                        onClick={() =>
                          setCurrentPage((page) => Math.max(1, page - 1))
                        }
                        style={{
                          width: '2rem',
                          height: '2rem',
                          border: '1px solid #dbe3ea',
                          borderRadius: '0.45rem',
                          background: '#ffffff',
                          color: '#64748b',
                          cursor:
                            safeCurrentPage === 1
                              ? 'not-allowed'
                              : 'pointer',
                          opacity: safeCurrentPage === 1 ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ChevronLeft size={16} />
                      </button>

                      {Array.from(
                        { length: totalPages },
                        (_, index) => index + 1
                      ).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          style={{
                            minWidth: '2rem',
                            height: '2rem',
                            border:
                              page === safeCurrentPage
                                ? '1px solid #15803d'
                                : '1px solid #dbe3ea',
                            borderRadius: '0.45rem',
                            background:
                              page === safeCurrentPage
                                ? '#15803d'
                                : '#ffffff',
                            color:
                              page === safeCurrentPage
                                ? '#ffffff'
                                : '#64748b',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            fontWeight:
                              page === safeCurrentPage ? '700' : '500',
                          }}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={safeCurrentPage === totalPages}
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.min(totalPages, page + 1)
                          )
                        }
                        style={{
                          width: '2rem',
                          height: '2rem',
                          border: '1px solid #dbe3ea',
                          borderRadius: '0.45rem',
                          background: '#ffffff',
                          color: '#64748b',
                          cursor:
                            safeCurrentPage === totalPages
                              ? 'not-allowed'
                              : 'pointer',
                          opacity: safeCurrentPage === totalPages ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Details Panel */}
            {selectedLog && (
              <aside
                className="audit-details-panel"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.875rem',
                  overflow: 'hidden',
                  position: 'sticky',
                  top: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    borderBottom: '1px solid #eef2f5',
                  }}
                >
                  <div
                    style={{
                      fontWeight: '700',
                      fontSize: '0.95rem',
                      color: '#172033',
                    }}
                  >
                    Audit Log Details
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedLog(null)}
                    style={{
                      width: '2rem',
                      height: '2rem',
                      border: 'none',
                      background: '#f8fafc',
                      borderRadius: '50%',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ padding: '1rem' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      ...getStatusStyle(selectedLog.status),
                      borderRadius: '999px',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      marginBottom: '1rem',
                    }}
                  >
                    {selectedLog.status === 'SUCCESS'
                      ? 'Success'
                      : 'Failed'}
                  </div>

                  {[
                    ['Action', formatActionLabel(selectedLog.action)],
                    ['Module', selectedLog.module],
                    ['Record', selectedLog.record],
                    ['Performed By', selectedLog.user],
                    ['Role', selectedLog.role],
                    [
                      'Date & Time',
                      `${formatDateTime(selectedLog.timestamp).date} — ${
                        formatDateTime(selectedLog.timestamp).time
                      }`,
                    ],
                    ['Activity Type', formatActivityType(selectedLog.activityType)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        padding: '0.7rem 0',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.68rem',
                          color: '#94a3b8',
                          marginBottom: '0.2rem',
                        }}
                      >
                        {label}
                      </div>

                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#334155',
                          fontWeight: '600',
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: '1rem' }}>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: '#94a3b8',
                        marginBottom: '0.35rem',
                      }}
                    >
                      Description
                    </div>

                    <div
                      style={{
                        background: '#f8fafc',
                        borderRadius: '0.6rem',
                        padding: '0.75rem',
                        fontSize: '0.75rem',
                        lineHeight: 1.5,
                        color: '#475569',
                      }}
                    >
                      {selectedLog.description}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '0.6rem',
                      fontSize: '0.7rem',
                      color: '#166534',
                      lineHeight: 1.5,
                    }}
                  >
                    These records are loaded from the live audit system.
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;