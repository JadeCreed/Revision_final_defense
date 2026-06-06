import { useState } from 'react';
import { Clock, AlertTriangle, MapPin, ChevronDown, ChevronUp, X, Search } from 'lucide-react';

const SEED_CFG = {
  HYBRID:   { label: 'Hybrid',   color: '#166534', light: '#dcfce7' },
  INBRED:   { label: 'Inbred',   color: '#1e40af', light: '#dbeafe' },
  OWN_SEED: { label: 'Own Seed', color: '#92400e', light: '#fef3c7' },
};

const fmtDate = v => v
  ? new Date(v).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  : '—';

const PREVIEW_LIMIT = 5;

// ── Single farmer card ────────────────────────────────────────
const FarmerCard = ({ farmer, type }) => {
  const sc       = SEED_CFG[farmer.seed_type] || { label: farmer.seed_label, color: '#64748b', light: '#f1f5f9' };
  const isDelay  = type === 'delayed';
  const border   = isDelay ? '#fecaca' : '#fed7aa';
  const bg       = isDelay ? '#fff5f5' : '#fff7ed';
  const iconBg   = isDelay ? '#fee2e2' : '#ffedd5';
  const Icon     = isDelay ? Clock : AlertTriangle;
  const iconColor = isDelay ? '#dc2626' : '#ea580c';
  const issueColor = isDelay ? '#dc2626' : '#ea580c';
  const issueText  = isDelay
    ? (farmer.delay_days ? `${farmer.delay_days}d delayed` : 'Delayed')
    : (farmer.damage_cause || 'Damage reported');

  return (
    <div style={{
      padding: '11px 13px', borderRadius: 11,
      border: `1px solid ${border}`, background: bg,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: iconBg, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>
          {farmer.farmer_name}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: sc.light, color: sc.color }}>
            {sc.label}
          </span>
          <span style={{ fontSize: 11, color: '#475569' }}>{farmer.phase}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748b' }}>
            <MapPin size={10} />{farmer.barangay}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: issueColor }}>{issueText}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(farmer.date_observed)}</span>
        </div>
      </div>
    </div>
  );
};

// ── Full list modal ───────────────────────────────────────────
const FullListModal = ({ title, farmers, type, onClose, accentColor, accentBg }) => {
  const [search, setSearch] = useState('');
  const filtered = farmers.filter(f =>
    f.farmer_name.toLowerCase().includes(search.toLowerCase()) ||
    f.barangay.toLowerCase().includes(search.toLowerCase()) ||
    (f.damage_cause || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,23,42,.45)',
      zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: 20,
        width: '100%', maxWidth: 620,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(15,23,42,.25)',
        animation: 'modal-in .2s ease',
      }}>
        <style>{`@keyframes modal-in { from { opacity:0; transform:scale(.96)translateY(8px) } to { opacity:1; transform:none } }`}</style>

        {/* Modal header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {farmers.length} farmer{farmers.length !== 1 ? 's' : ''} total
              {filtered.length !== farmers.length && ` · ${filtered.length} shown`}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            border: '1px solid #e2e8f0', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <X size={15} color="#64748b" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px 8px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 10, padding: '8px 12px',
          }}>
            <Search size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, barangay, or cause..."
              style={{
                border: 'none', background: 'transparent',
                fontSize: 13, color: '#374151', outline: 'none',
                flex: 1, minWidth: 0,
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={13} color="#94a3b8" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
              No results for "{search}"
            </div>
          ) : (
            filtered.map((f, i) => <FarmerCard key={i} farmer={f} type={type} />)
          )}
        </div>
      </div>
    </div>
  );
};

// ── Panel card (preview + view all) ──────────────────────────
const PanelCard = ({ icon, iconBg, title, count, countBg, countColor, summary, farmers, type }) => {
  const [showModal, setShowModal] = useState(false);
  const preview  = farmers.slice(0, PREVIEW_LIMIT);
  const hasMore  = farmers.length > PREVIEW_LIMIT;
  const remaining = farmers.length - PREVIEW_LIMIT;

  return (
    <>
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: countBg, color: countColor }}>
              {count} farmer{count !== 1 ? 's' : ''}
            </span>
          </div>
          {summary && <div style={{ marginTop: 6, marginLeft: 36 }}>{summary}</div>}
        </div>

        {/* Preview list — 5 lang */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {preview.map((f, i) => <FarmerCard key={i} farmer={f} type={type} />)}
        </div>

        {/* View all button kapag >5 */}
        {hasMore && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              width: '100%', padding: '11px 16px',
              border: 'none', borderTop: '1px solid #f1f5f9',
              background: '#fafafa', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, color: countColor,
              transition: 'background .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = countBg}
            onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}
          >
            View all {remaining} more farmer{remaining !== 1 ? 's' : ''} →
          </button>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <FullListModal
          title={title}
          farmers={farmers}
          type={type}
          onClose={() => setShowModal(false)}
          accentColor={countColor}
          accentBg={countBg}
        />
      )}
    </>
  );
};

// ── Main component ────────────────────────────────────────────
const AttentionPanel = ({ data }) => {
  const delayed = (data || []).filter(f => f.status === 'DELAYED');
  const damaged = (data || []).filter(f => f.status === 'DAMAGED');

  if (!delayed.length && !damaged.length) return null;

  const avgDelay = delayed.length
    ? Math.round(delayed.reduce((s, f) => s + (f.delay_days || 0), 0) / delayed.length)
    : 0;

  const causeSummary = damaged.reduce((acc, f) => {
    const c = f.damage_cause || 'Unknown';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  const bothHaveData = delayed.length > 0 && damaged.length > 0;

  return (
    <>
      <style>{`@media(max-width:800px){.ap-wrap{grid-template-columns:1fr!important}}`}</style>
      <div className="ap-wrap" style={{
        display: 'grid',
        gridTemplateColumns: bothHaveData ? '1fr 1fr' : '1fr',
        gap: 14,
      }}>

        {delayed.length > 0 && (
          <PanelCard
            icon={<Clock size={14} color="#dc2626" />}
            iconBg="#fee2e2"
            title="Delayed Farmers"
            count={delayed.length}
            countBg="#fee2e2"
            countColor="#dc2626"
            farmers={delayed}
            type="delayed"
            summary={
              avgDelay > 0 ? (
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  Average delay: <strong style={{ color: '#dc2626' }}>{avgDelay} days</strong>
                </span>
              ) : null
            }
          />
        )}

        {damaged.length > 0 && (
          <PanelCard
            icon={<AlertTriangle size={14} color="#ea580c" />}
            iconBg="#ffedd5"
            title="Damaged Farmers"
            count={damaged.length}
            countBg="#ffedd5"
            countColor="#ea580c"
            farmers={damaged}
            type="damaged"
            summary={
              Object.keys(causeSummary).length > 0 ? (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {Object.entries(causeSummary).map(([cause, cnt]) => (
                    <span key={cause} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
                      {cause}: {cnt}
                    </span>
                  ))}
                </div>
              ) : null
            }
          />
        )}

      </div>
    </>
  );
};

export default AttentionPanel;