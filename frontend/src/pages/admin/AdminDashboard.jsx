// src/pages/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Sprout, Megaphone, Map, ChevronRight,
  Clock, CheckCircle, AlertCircle, TrendingUp,
  Leaf, UserCheck, Bell, Package, Truck, ClipboardList
} from 'lucide-react';
import {
  getAdminPolls,
  getAdminPollResults,
  getBadgeCount,
  getFarmerMasterlist,
  getAdminAnnouncements,
  getDistributionStats,
  getInventorySummary,
} from '../../api/axios';

// ─── helpers ──────────────────────────────────────────────

const fmt = (n) =>
  n === null || n === undefined || n === '—' ? '—' : Number(n).toLocaleString();

function daysLeft(dateStr) {
  if (!dateStr) return 0;
  const d = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return d > 0 ? d : 0;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Tile — matches Beneficiaries page exactly ────────────

function Tile({ icon: Icon, value, label, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
    >
      <Icon size={20} color="#4b5563" strokeWidth={1.8} />
      <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>
        {label}
      </p>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────

function Card({ title, icon: Icon, action, onAction, children }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {Icon && <Icon size={16} color="#6b7280" strokeWidth={1.8} />}
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>{title}</span>
        </div>
        {action && (
          <button
            onClick={onAction}
            style={{
              fontSize: '0.78rem', color: '#15803d', fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 2,
            }}
          >
            {action} <ChevronRight size={13} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Poll status badge ────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    OPEN:   { bg: '#dcfce7', color: '#15803d', dot: '#16a34a', label: 'Open'   },
    LOCKED: { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b', label: 'Locked' },
    CLOSED: { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', label: 'Closed' },
  };
  const s = map[status] || map.CLOSED;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.color,
      fontSize: '0.72rem', fontWeight: 600,
      padding: '0.2rem 0.65rem', borderRadius: '9999px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {s.label}
    </span>
  );
}

// ─── Vote bar ─────────────────────────────────────────────

function VoteBar({ label, pct, votes, isTop }) {
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: isTop ? 600 : 400 }}>{label}</span>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{votes} vote{votes !== 1 ? 's' : ''} · {pct}%</span>
      </div>
      <div style={{ background: '#f3f4f6', borderRadius: '9999px', height: 7, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: '9999px',
          background: isTop ? '#15803d' : '#86efac',
          transition: 'width .5s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────

function Sk({ h = 14, w = '100%', mb = 8, r = 6 }) {
  return (
    <div style={{
      height: h, width: w, marginBottom: mb, borderRadius: r, flexShrink: 0,
      background: 'linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)',
      backgroundSize: '200% 100%', animation: 'sk 1.3s infinite',
    }} />
  );
}

// ─── Main ─────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [loading,  setLoading]  = useState(true);
  const [badges,   setBadges]   = useState(null);
  const [polls,    setPolls]    = useState([]);
  const [results,  setResults]  = useState(null);
  const [master,   setMaster]   = useState(null);
  const [anns,     setAnns]     = useState([]);
  const [dist,     setDist]     = useState(null);
  const [inv,      setInv]      = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [bR, pR, mR, aR, dR, iR] = await Promise.allSettled([
        getBadgeCount(),
        getAdminPolls(),
        getFarmerMasterlist({ page_size: 1 }),
        getAdminAnnouncements({ page_size: 5 }),
        getDistributionStats(),
        getInventorySummary(),
      ]);

      if (!alive) return;

      if (bR.status === 'fulfilled') setBadges(bR.value.data);
      if (mR.status === 'fulfilled') setMaster(mR.value.data);
      if (aR.status === 'fulfilled') setAnns(aR.value.data?.results || aR.value.data || []);
      if (dR.status === 'fulfilled') setDist(dR.value.data);
      if (iR.status === 'fulfilled') setInv(iR.value.data);

      const allPolls = pR.status === 'fulfilled' ? (pR.value.data || []) : [];
      setPolls(allPolls);

      const active = allPolls.find(p => p.status === 'OPEN')
                  || allPolls.find(p => p.status === 'CLOSED')
                  || allPolls.find(p => p.status === 'LOCKED')
                  || allPolls[0];

      if (active) {
        try {
          const r = await getAdminPollResults(active.id);
          if (alive) setResults({ ...r.data, status: active.status, end_date: active.end_date, title: active.title, season: active.season, year: active.year });
        } catch (_) {}
      }

      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // ── derived ────────────────────────────────────────────
  const pending     = badges?.pending_farmers ?? 0;
  const resets      = badges?.reset_requests  ?? 0;
  const approved    = master?.count ?? master?.total ?? '—';
  const totalSeeds  = inv?.total_seeds ?? inv?.total ?? '—';
  const distEvents  = dist?.total_events ?? dist?.events ?? '—';

  const activePoll  = polls.find(p => p.status === 'OPEN')
                   || polls.find(p => p.status === 'CLOSED')
                   || polls.find(p => p.status === 'LOCKED')
                   || null;

  const totalVotes  = results?.total_votes ?? 0;
  const varieties   = [
    ...(results?.hybrid_results  || []),
    ...(results?.inbred_results  || []),
  ].sort((a, b) => (b.votes || b.count || 0) - (a.votes || a.count || 0)).slice(0, 4);

  const recentAnns  = anns.slice(0, 3);

  const actions = [
    { label: 'Approve Farmers',   icon: UserCheck,     color: '#f59e0b', bg: '#fffbeb', path: '/admin/users/farmer-requests'   },
    { label: 'Manage Seed Poll',  icon: Sprout,        color: '#15803d', bg: '#f0fdf4', path: '/admin/seed-poll'               },
    { label: 'View GIS Map',      icon: Map,           color: '#2563eb', bg: '#eff6ff', path: '/admin/gis'                     },
    { label: 'New Announcement',  icon: Megaphone,     color: '#7c3aed', bg: '#f5f3ff', path: '/admin/announcement'            },
    { label: 'Seed Inventory',    icon: Package,       color: '#0891b2', bg: '#ecfeff', path: '/admin/inventory'               },
    { label: 'Distribution',      icon: Truck,         color: '#dc2626', bg: '#fef2f2', path: '/admin/distribution'            },
    { label: 'Beneficiaries',     icon: ClipboardList, color: '#059669', bg: '#ecfdf5', path: '/admin/beneficiaries'           },
    { label: 'Reports',           icon: TrendingUp,    color: '#9333ea', bg: '#faf5ff', path: '/admin/reports'                 },
  ];

  // ── render ─────────────────────────────────────────────
  return (
    <div style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
      <style>{`@keyframes sk{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          Admin Dashboard
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.2rem 0 0' }}>
          Municipal Agriculture Office — Lucban Rice Program
        </p>
      </div>

      {/* ── Pending banner ── */}
      {!loading && pending > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: '10px', padding: '0.75rem 1.1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}>
          <span style={{ fontSize: '0.83rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} color="#f59e0b" />
            <strong>{pending}</strong> farmer{pending !== 1 ? 's' : ''} pending approval
            {resets > 0 && <> · <strong>{resets}</strong> password reset{resets !== 1 ? 's' : ''}</>}
          </span>
          <button
            onClick={() => navigate('/admin/users/farmer-requests')}
            style={{
              background: '#f59e0b', color: '#fff', border: 'none',
              borderRadius: '8px', padding: '0.35rem 0.9rem',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Review
          </button>
        </div>
      )}

      {/* ── 4 Tiles — matches Beneficiaries page style ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.25rem',
      }}>
        {loading ? [1,2,3,4].map(i => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.25rem 1.5rem' }}>
            <Sk h={20} w={20} mb={14} r={4} />
            <Sk h={32} w="50%" mb={8} r={6} />
            <Sk h={11} w="70%" mb={0} r={4} />
          </div>
        )) : (
          <>
            <Tile
              icon={Users}
              value={fmt(approved)}
              label="Approved Farmers"
              onClick={() => navigate('/admin/users/farmer-masterlist')}
            />
            <Tile
              icon={AlertCircle}
              value={fmt(pending)}
              label="Pending Approvals"
              onClick={pending > 0 ? () => navigate('/admin/users/farmer-requests') : undefined}
            />
            <Tile
              icon={Package}
              value={fmt(totalSeeds)}
              label="Total Seed Stock"
              onClick={() => navigate('/admin/inventory')}
            />
            <Tile
              icon={Truck}
              value={fmt(distEvents)}
              label="Distribution Events"
              onClick={() => navigate('/admin/distribution')}
            />
          </>
        )}
      </div>

      {/* ── 2-col: Seed Poll + Announcements ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

        {/* Seed Poll card */}
        <Card title="Seed Poll" icon={Sprout} action="Manage" onAction={() => navigate('/admin/seed-poll')}>
          {loading ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Sk h={14} w="60%" mb={0} />
                <Sk h={22} w={55} mb={0} r={9999} />
              </div>
              <Sk h={7} mb={10} /><Sk h={7} mb={10} /><Sk h={7} mb={14} />
              <div style={{ display: 'flex', gap: 16 }}>
                <Sk h={11} w={80} mb={0} />
                <Sk h={11} w={90} mb={0} />
              </div>
            </>
          ) : activePoll ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>
                  {activePoll.title || `${activePoll.season} ${activePoll.year} Poll`}
                </span>
                <StatusBadge status={activePoll.status} />
              </div>

              {varieties.length > 0 ? varieties.map((row, i) => {
                const v   = row.votes ?? row.count ?? 0;
                const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0;
                return (
                  <VoteBar
                    key={row.variety_name || row.name || i}
                    label={row.variety_name || row.name}
                    votes={v} pct={pct} isTop={i === 0}
                  />
                );
              }) : (
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1.25rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.83rem', color: '#9ca3af', margin: 0 }}>No votes yet</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={12} /> {fmt(totalVotes)} total votes
                </span>
                {activePoll.end_date && (
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} />
                    {activePoll.status === 'OPEN'
                      ? `${daysLeft(activePoll.end_date)} day${daysLeft(activePoll.end_date) !== 1 ? 's' : ''} left`
                      : `Ended ${new Date(activePoll.end_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    }
                  </span>
                )}
              </div>

              {activePoll.status === 'CLOSED' && (
                <button
                  onClick={() => navigate('/admin/seed-poll')}
                  style={{
                    marginTop: '1rem', width: '100%',
                    background: '#15803d', color: '#fff',
                    border: 'none', borderRadius: '10px',
                    padding: '0.7rem', fontSize: '0.875rem',
                    fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                  }}
                >
                  <CheckCircle size={16} /> Finalize Seed Varieties
                </button>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <Leaf size={36} color="#d1d5db" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', margin: '0 0 0.25rem' }}>No Active Poll</p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 1rem' }}>Create a poll to collect seed preferences</p>
              <button
                onClick={() => navigate('/admin/seed-poll')}
                style={{
                  background: '#15803d', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '0.5rem 1.25rem',
                  fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Create Poll
              </button>
            </div>
          )}
        </Card>

        {/* Announcements card */}
        <Card title="Recent Announcements" icon={Bell} action="View all" onAction={() => navigate('/admin/announcement')}>
          {loading ? [1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 14, borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none', marginBottom: 14 }}>
              <Sk h={8} w={8} mb={0} r={9999} />
              <div style={{ flex: 1 }}><Sk h={13} mb={6} /><Sk h={11} w="45%" mb={0} /></div>
            </div>
          )) : recentAnns.length > 0 ? recentAnns.map((ann, i) => (
            <div key={ann.id || i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              paddingBottom: i < recentAnns.length - 1 ? '0.875rem' : 0,
              borderBottom: i < recentAnns.length - 1 ? '1px solid #f3f4f6' : 'none',
              marginBottom: i < recentAnns.length - 1 ? '0.875rem' : 0,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ann.is_active ? '#16a34a' : '#d1d5db', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.83rem', color: '#111827', margin: '0 0 0.2rem', lineHeight: 1.45, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ann.title}
                </p>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                  {timeAgo(ann.created_at || ann.posted_at)} · {ann.target_role === 'ALL' ? 'All users' : ann.target_role}
                </span>
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <Bell size={30} color="#d1d5db" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: '0.83rem', color: '#9ca3af', margin: 0 }}>No announcements yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Quick Actions — 8 buttons ── */}
      <Card title="Quick Actions">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
          {actions.map(({ label, icon: Icon, color, bg, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: '10px', padding: '0.875rem 1rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'background .15s, box-shadow .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ width: 34, height: 34, borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} color={color} strokeWidth={1.8} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', flex: 1 }}>{label}</span>
              <ChevronRight size={14} color="#d1d5db" />
            </button>
          ))}
        </div>
      </Card>

    </div>
  );
}