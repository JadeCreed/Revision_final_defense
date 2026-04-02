import { useState, useEffect, useRef, useCallback } from 'react';


// ─────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────
export const Pagination = ({ count, page, pageSize = 10, onPageChange }) => {
  // Don't render if everything fits on one page
  if (!count || count <= pageSize) return null;

  const totalPages = Math.ceil(count / pageSize);

  // Build a window of up to 5 page numbers centered on current page
  const pages = [];
  let start = Math.max(1, page - 2);
  let end   = Math.min(totalPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  for (let i = start; i <= end; i++) pages.push(i);

  const btnStyle = (isActive, disabled) => ({
    padding:         '0.375rem 0.75rem',
    border:          `1.5px solid ${isActive ? '#2d6a2d' : '#d1d5db'}`,
    borderRadius:    '0.375rem',
    backgroundColor: isActive ? '#2d6a2d' : 'white',
    color:           isActive ? 'white' : '#374151',
    cursor:          disabled ? 'default' : 'pointer',
    fontSize:        '0.8rem',
    fontWeight:      isActive ? '600' : '400',
    opacity:         disabled ? 0.4 : 1,
  });

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '0.75rem 1rem',
      borderTop:      '1px solid #f3f4f6',
      flexWrap:       'wrap',
      gap:            '0.5rem',
    }}>
      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
        Showing {Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} of {count}
      </span>

      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1} style={btnStyle(false, page === 1)}>‹</button>
        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)} style={btnStyle(p === page, false)}>{p}</button>
        ))}
        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages} style={btnStyle(false, page === totalPages)}>›</button>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// SORT DROPDOWN
// ─────────────────────────────────────────────────────────────
export const SortDropdown = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      padding:         '0.5rem 0.875rem',
      border:          '1.5px solid #d1d5db',
      borderRadius:    '0.5rem',
      fontSize:        '0.875rem',
      cursor:          'pointer',
      outline:         'none',
      backgroundColor: 'white',
    }}
  >
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);


// ─────────────────────────────────────────────────────────────
// COLUMN MIN-WIDTHS
// Use as: <th style={{ minWidth: COL_WIDTHS.name }}>
// ─────────────────────────────────────────────────────────────
export const COL_WIDTHS = {
  rsbsa:    '190px',  // fits "04-0432-000-0010" (15 chars + dashes)
  name:     '170px',  // fits "Juan Dela Cruz"
  contact:  '130px',  // fits "09123456789"
  barangay: '140px',  // fits "Mahabang Parang"
  status:   '120px',  // fits "Complete" badge
  role:     '160px',  // fits "Brgy President" badge
  email:    '190px',  // fits email addresses
  date:     '125px',  // fits "Mar 29, 2026"
  actions:  '130px',  // fits one action button
  details:  '120px',  // fits "View Details" button
};


// ─────────────────────────────────────────────────────────────
// NEW BADGE
//
// Yellow "NEW" pill next to a row name.
// Admin clicks it → calls `onClick` → badge disappears.
//
// Props:
//   isNew   {boolean} — whether to show the badge
//   onClick {function} — called when admin clicks to dismiss
// ─────────────────────────────────────────────────────────────
export const NewBadge = ({ isNew, onClick }) => {
  if (!isNew) return null;

  return (
    <span
      onClick={e => {
        e.stopPropagation(); // don't trigger row click
        if (onClick) onClick();
      }}
      title="Click to dismiss"
      style={{
        display:         'inline-block',
        backgroundColor: '#f5c842',
        color:           '#1a1a1a',
        fontSize:        '0.6rem',
        fontWeight:      '700',
        padding:         '1px 6px',
        borderRadius:    '999px',
        marginLeft:      '0.4rem',
        verticalAlign:   'middle',
        letterSpacing:   '0.05em',
        cursor:          'pointer',
        userSelect:      'none',
        transition:      'opacity 0.2s',
      }}
    >
      NEW
    </span>
  );
};


// ─────────────────────────────────────────────────────────────
// LOCALSTORAGE HELPERS
//
// markTableAsSeen(tableKey, idsSet)
//   Saves Set of seen IDs to localStorage for a table.
//   Call when admin clicks a NEW badge to dismiss it.
//
// getSeenIds(tableKey)
//   Reads Set of seen IDs from localStorage.
//   Call on component mount to detect unseen items.
// ─────────────────────────────────────────────────────────────
const LS_NEW_PREFIX = 'agrice_seen_ids_';

export const markTableAsSeen = (tableKey, ids) => {
  try {
    localStorage.setItem(
      LS_NEW_PREFIX + tableKey,
      JSON.stringify([...ids])
    );
  } catch {
    // Fail silently — badge is non-critical
  }
};

export const getSeenIds = (tableKey) => {
  try {
    const raw = localStorage.getItem(LS_NEW_PREFIX + tableKey);
    return new Set(JSON.parse(raw || '[]'));
  } catch {
    return new Set();
  }
};


// ─────────────────────────────────────────────────────────────
// useBadgeAwareTable HOOK
//
// Optional self-contained hook for tables that don't need custom
// fetch logic. Handles fetch, polling, and NEW badge tracking.
//
// Usage:
//   const { data, count, loading, error, newIds, dismissNew, refetch } =
//     useBadgeAwareTable({
//       fetchFn:      useCallback(() => getOfficials(params), [params]),
//       pollInterval: 15000,
//       tableKey:     'officials',
//     });
//
//   // In table row:
//   <NewBadge isNew={newIds.has(row.id)} onClick={() => dismissNew(row.id)} />
// ─────────────────────────────────────────────────────────────
export const useBadgeAwareTable = ({
  fetchFn,
  pollInterval = 15000,
  tableKey,
  idKey = 'id',
}) => {
  const [data, setData]       = useState([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [newIds, setNewIds]   = useState(new Set());

  // IDs from the PREVIOUS successful fetch — used to detect truly new rows
  const prevIds = useRef(new Set());
  // Flag: has the first fetch completed?
  const didInit = useRef(false);

  const doFetch = useCallback(async (isInitial = false) => {
    try {
      const res   = await fetchFn();
      const items = res.data.results || res.data || [];
      const total = res.data.count   || items.length;

      const currentIds = new Set(items.map(item => item[idKey]));

      if (isInitial) {
        // ── INITIAL LOAD ──
        // Compare against localStorage to find items admin hasn't seen yet.
        // This makes NEW badges survive page refresh and navigation.
        const alreadySeen = getSeenIds(tableKey);
        const unseenIds   = [...currentIds].filter(id => !alreadySeen.has(id));
        if (unseenIds.length > 0) {
          setNewIds(new Set(unseenIds));
        }
      } else if (didInit.current) {
        // ── POLL UPDATE ──
        // New = present now but wasn't in the previous poll.
        const freshIds = [...currentIds].filter(id => !prevIds.current.has(id));
        if (freshIds.length > 0) {
          setNewIds(prev => {
            const next = new Set(prev);
            freshIds.forEach(id => next.add(id));
            return next;
          });
        }
      }

      prevIds.current = currentIds;
      setData(items);
      setCount(total);
      didInit.current = true;
    } catch {
      setError('Failed to load data.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [fetchFn, idKey, tableKey]);
  // NOTE: no `newIds` in deps — avoids infinite re-render loop

  // Initial fetch (re-runs when fetchFn changes, i.e. when filters change)
  useEffect(() => {
    setLoading(true);
    doFetch(true);
  }, [doFetch]);

  // Polling
  useEffect(() => {
    const poll = setInterval(() => doFetch(false), pollInterval);
    return () => clearInterval(poll);
  }, [doFetch, pollInterval]);

  // Dismiss a NEW badge for one specific row ID
  const dismissNew = useCallback((id) => {
    setNewIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Persist dismissal to localStorage
    const updated = new Set(getSeenIds(tableKey));
    updated.add(id);
    markTableAsSeen(tableKey, updated);
  }, [tableKey]);

  const refetch = useCallback(() => doFetch(false), [doFetch]);

  return { data, count, loading, error, newIds, dismissNew, refetch };
};
