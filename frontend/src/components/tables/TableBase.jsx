// src/components/tables/TableBase.jsx
// ============================================================
// Shared utilities for all admin tables
// - Pagination
// - SortDropdown
// - COL_WIDTHS
// - NewBadge component
// - useBadgeAwareTable hook (polling + new-row tracking + badge-sync)
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// ── PAGINATION ──
export const Pagination = ({ count, page, pageSize = 10, onPageChange }) => {
  if (!count || count <= pageSize) return null;
  const totalPages = Math.ceil(count / pageSize);
  const pages = [];
  let start = Math.max(1, page - 2);
  let end   = Math.min(totalPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  for (let i = start; i <= end; i++) pages.push(i);

  const btn = (isActive, disabled) => ({
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
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.75rem 1rem', borderTop: '1px solid #f3f4f6',
      flexWrap: 'wrap', gap: '0.5rem',
    }}>
      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
        Showing {Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} of {count}
      </span>
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1} style={btn(false, page === 1)}>‹</button>
        {pages.map(p => <button key={p} onClick={() => onPageChange(p)} style={btn(p === page, false)}>{p}</button>)}
        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages} style={btn(false, page === totalPages)}>›</button>
      </div>
    </div>
  );
};

// ── SORT DROPDOWN ──
export const SortDropdown = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db',
      borderRadius: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', outline: 'none',
    }}
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

// ── COLUMN MIN-WIDTHS ──
export const COL_WIDTHS = {
  rsbsa:   '190px',
  name:    '170px',
  contact: '130px',
  barangay:'140px',
  status:  '120px',
  role:    '160px',
  email:   '190px',
  date:    '125px',
  actions: '130px',
  details: '120px',
};

// ── NEW ROW BADGE ──
export const NewBadge = ({ isNew }) => {
  if (!isNew) return null;
  return (
    <span style={{
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
    }}>
      NEW
    </span>
  );
};

// ── useBadgeAwareTable HOOK ──
// ============================================================
// This is the main hook for all user management tables.
// It handles:
// 1. Data polling every `pollInterval` ms
// 2. Detecting new rows (IDs not seen before)
// 3. "NEW" badge on new rows for 10 seconds
// 4. Badge count for the sidebar (pending_farmers or reset_requests)
// 5. Badge disappears when admin IS on this page
//    (isViewingPage = true clears badge immediately)
// 6. "NEW" indicator disappears after 10s
//
// Usage:
//   const { data, count, loading, error, newIds, refetch } = useBadgeAwareTable({
//     fetchFn: useCallback(() => getFarmerRequests(params), [params]),
//     pollInterval: 15000,
//     isViewingPage: true,   // pass true when this page is active
//   });
// ============================================================
export const useBadgeAwareTable = ({
  fetchFn,
  pollInterval = 15000,
  isViewingPage = true,
  idKey = 'id',
}) => {
  const [data, setData]       = useState([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // IDs currently marked as "NEW" (shown with yellow badge)
  const [newIds, setNewIds]   = useState(new Set());

  // IDs we've seen at least once
  const knownIds  = useRef(new Set());
  // Per-ID timeout handles for removing "NEW" badge after 10s
  const timeouts  = useRef({});
  // Whether we've done at least one fetch
  const didInit   = useRef(false);

  const fetch = useCallback(async (isInitial = false) => {
    try {
      const res   = await fetchFn();
      const items = res.data.results || res.data || [];
      const total = res.data.count   || items.length;

      if (!isInitial && didInit.current) {
        // Find IDs that weren't in the last fetch
        const freshIds = items
          .map(item => item[idKey])
          .filter(id => !knownIds.current.has(id));

        if (freshIds.length > 0) {
          setNewIds(prev => {
            const next = new Set(prev);
            freshIds.forEach(id => next.add(id));
            return next;
          });

          freshIds.forEach(id => {
            // Clear existing timeout for this ID
            if (timeouts.current[id]) clearTimeout(timeouts.current[id]);

            if (isViewingPage) {
              // Admin IS on this page — remove "NEW" after 10s
              timeouts.current[id] = setTimeout(() => {
                setNewIds(prev => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
              }, 10000);
            } else {
              // Admin is NOT on this page — keep "NEW" indefinitely
              // (will clear when they navigate to this page)
            }
          });
        }
      }

      // If admin IS viewing page and there are pending newIds, start clearing them
      if (isViewingPage && newIds.size > 0 && !isInitial) {
        newIds.forEach(id => {
          if (!timeouts.current[id]) {
            timeouts.current[id] = setTimeout(() => {
              setNewIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }, 10000);
          }
        });
      }

      knownIds.current = new Set(items.map(item => item[idKey]));
      setData(items);
      setCount(total);
      didInit.current = true;
    } catch {
      setError('Failed to load data.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [fetchFn, idKey, isViewingPage, newIds]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetch(true);
  }, [fetchFn]); // re-fetch when fetchFn changes (i.e., when filters/page/sort changes)

  // Polling
  useEffect(() => {
    const poll = setInterval(() => fetch(false), pollInterval);
    return () => clearInterval(poll);
  }, [fetch, pollInterval]);

  // When admin navigates TO this page, start 10s countdown for existing newIds
  useEffect(() => {
    if (!isViewingPage) return;
    newIds.forEach(id => {
      if (!timeouts.current[id]) {
        timeouts.current[id] = setTimeout(() => {
          setNewIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 10000);
      }
    });
  }, [isViewingPage]);

  // Cleanup
  useEffect(() => {
    return () => {
      Object.values(timeouts.current).forEach(clearTimeout);
    };
  }, []);

  const refetch = useCallback(() => fetch(false), [fetch]);

  return { data, count, loading, error, newIds, refetch };
};