// ─────────────────────────────────────────────────────────────────────────────
// src/pages/admin/CropPhase.jsx
// Complete replacement — copy-paste this entire file
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, RefreshCw, AlertCircle, CheckCircle,
  Sprout, Wheat, Leaf, Activity, TrendingUp,
} from 'lucide-react';
import { getGisPlots, getMapSummary } from '../../api/axios';
import API from '../../api/axios';

const PHASE_CFG = [
  { key: 'Seed Distribution',  color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB' },
  { key: 'Crop Establishment', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'Tillering',          color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0' },
  { key: 'Flowering',          color: '#A855F7', bg: '#FAF5FF', border: '#E9D5FF' },
  { key: 'Ripening',           color: '#FACC15', bg: '#FEFCE8', border: '#FDE68A' },
  { key: 'Harvesting',         color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
];
const PHASE_MAP   = Object.fromEntries(PHASE_CFG.map(p => [p.key, p]));
const PHASE_ORDER = PHASE_CFG.map(p => p.key);
const phaseColor  = k => PHASE_MAP[k]?.color || '#9CA3AF';
const PHASE_SHORT = {
  'Seed Distribution':  'Seed dist.',
  'Crop Establishment': 'Establish.',
  'Tillering':          'Tillering',
  'Flowering':          'Flowering',
  'Ripening':           'Ripening',
  'Harvesting':         'Harvesting',
};

const SEED_TABS = [
  {
    key: 'OWN_SEED', label: 'Own Seed', icon: Leaf,
    color: '#639922', bg: '#EAF3DE', border: '#C0DD97',
    phases: ['Crop Establishment','Tillering','Flowering','Ripening','Harvesting'],
    encodedBy: { 'Crop Establishment':'AT','Tillering':'AT','Flowering':'AT','Ripening':'AT','Harvesting':'AT' },
  },
  {
    key: 'INBRED', label: 'Inbred Seed', icon: Sprout,
    color: '#185FA5', bg: '#E6F1FB', border: '#B5D4F4',
    phases: ['Seed Distribution','Crop Establishment','Tillering','Flowering','Ripening','Harvesting'],
    encodedBy: { 'Seed Distribution':'Brgy Pres.','Crop Establishment':'AT','Tillering':'AT','Flowering':'AT','Ripening':'AT','Harvesting':'AT' },
  },
  {
    key: 'HYBRID', label: 'Hybrid Seed', icon: Wheat,
    color: '#1a4d1a', bg: '#d1fae5', border: '#6ee7b7',
    phases: ['Seed Distribution','Crop Establishment','Tillering','Flowering','Ripening','Harvesting'],
    encodedBy: { 'Seed Distribution':'Brgy Pres.','Crop Establishment':'AT','Tillering':'AT','Flowering':'AT','Ripening':'AT','Harvesting':'AT' },
  },
];
const SEED_TAB_MAP = Object.fromEntries(SEED_TABS.map(t => [t.key, t]));

const STD_DAYS = {
  dry: {
    'Seed Distribution':  3,
    'Crop Establishment': 20,
    'Tillering':          45,
    'Flowering':          20,
    'Ripening':           50,
    'Harvesting':         5,
  },
  wet: {
    'Seed Distribution':  3,
    'Crop Establishment': 20,
    'Tillering':          45,
    'Flowering':          20,
    'Ripening':           40,
    'Harvesting':         5,
  },
};

const buildMonthCols = (season, year) => {
  const slots = season === 'dry'
    ? [
        { y: year,   m: 9  },
        { y: year,   m: 10 },
        { y: year,   m: 11 },
        { y: year+1, m: 0  },
        { y: year+1, m: 1  },
        { y: year+1, m: 2  },
        { y: year+1, m: 3  },
        { y: year+1, m: 4  },
      ]
    : [
        { y: year, m: 4 },
        { y: year, m: 5 },
        { y: year, m: 6 },
        { y: year, m: 7 },
        { y: year, m: 8 },
        { y: year, m: 9 },
      ];
  return slots.map(({ y, m }) => ({
    key:   `${y}-${m}`,
    label: new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short' }),
    year:  y,
    start: new Date(y, m, 1),
    end:   new Date(y, m + 1, 0, 23, 59, 59),
  }));
};

const buildStdWindows = (seedKey, season, year) => {
  const phases    = SEED_TAB_MAP[seedKey]?.phases || [];
  const durations = STD_DAYS[season];
  let cursor = season === 'dry' ? new Date(year, 10, 1) : new Date(year, 5, 1);
  const wins = {};
  phases.forEach(ph => {
    const days = durations[ph] ?? 1;
    const start = new Date(cursor);
    const end   = addDays(cursor, days - 1);
    wins[ph] = { start, end, days };
    cursor   = addDays(cursor, days);
  });
  return wins;
};

const normalizePhase = raw => {
  if (!raw) return 'Seed Distribution';
  const r = raw.toString().trim();
  if (/^seed[\s_-]*dist/i.test(r) || /^distribution$/i.test(r)) return 'Seed Distribution';
  if (/^crop[\s_-]*est/i.test(r)  || /^establishment$/i.test(r)) return 'Crop Establishment';
  if (/^tiller/i.test(r))  return 'Tillering';
  if (/^flower/i.test(r))  return 'Flowering';
  if (/^ripen/i.test(r))   return 'Ripening';
  if (/^harvest/i.test(r)) return 'Harvesting';
  return r;
};

const normSeed = raw => {
  if (!raw) return 'OWN_SEED';
  const r = raw.toString().toUpperCase().replace(/[\s-]/g, '_');
  if (r.includes('HYBRID'))  return 'HYBRID';
  if (r.includes('INBRED') || r.includes('CERTIFIED')) return 'INBRED';
  return 'OWN_SEED';
};

const parseDate = v => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const fmtShort = d =>
  d ? d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';

const fmtNum = (n, d = 0) =>
  n != null && !isNaN(n)
    ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

const ALL_BARANGAYS = [
  'Abang','Aliliw','Atulinao','Ayuti','Igang','Kabatete','Kakawit','Kalangay',
  'Kalyaat','Kilib','Kulapi','Mahabang Parang','Malupak','Manasa','May-It',
  'Nagsinamo','Nalunao','Palola','Piis','Samil','Tiawe','Tinamnan',
];

const Toast = ({ toast }) => {
  if (!toast) return null;
  const bg   = toast.type === 'error' ? '#a32d2d' : '#1a4d1a';
  const Icon = toast.type === 'error' ? AlertCircle : CheckCircle;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: bg, color: 'white', padding: '.6rem 1.25rem',
      borderRadius: 999, fontSize: '.78rem', fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: '.45rem',
      boxShadow: '0 4px 20px rgba(0,0,0,.22)', animation: 'cp-fadein .25s ease',
    }}>
      <Icon size={14} />{toast.msg}
    </div>
  );
};

const PhaseBar = ({ phase, count, total, animate }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const c   = phaseColor(phase);
  return (
    <div style={{ marginBottom: '.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 500, color: '#0f172a' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />
          {phase}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>{count} farmers</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: animate ? `${Math.max(2, pct)}%` : 0,
          background: c, borderRadius: 999, transition: animate ? 'width .6s ease' : 'none',
        }} />
      </div>
    </div>
  );
};

const AuditItem = ({ record }) => {
  const ph    = normalizePhase(record.crop_phase || record.land_type);
  const c     = phaseColor(ph);
  const isOwn = normSeed(record.seed_source) === 'OWN_SEED';
  const name  = record.encoded_by_name || record.encoded_by || 'AT';
  const inits = name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const brgy  = record.barangay || record.farmer_barangay || '';
  const time  = record.date_observed || record.created_at || '';
  const ts    = time ? new Date(time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '-';
  return (
    <div style={{ padding: '.6rem 1rem', borderBottom: '.5px solid #f1f5f9', display: 'flex', gap: '.6rem' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: isOwn ? '#FAEEDA' : '#E6F1FB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 600, color: isOwn ? '#854F0B' : '#185FA5',
      }}>{inits}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {name}
          <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: `${c}20`, color: c }}>
            {PHASE_SHORT[ph] || ph}
          </span>
          {isOwn && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#E6F1FB', color: '#185FA5' }}>own seed</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Encoded → {brgy}</div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{ts}</div>
      </div>
    </div>
  );
};

const GanttPhaseRow = ({ phase, stdWin, actualBar, monthCols, encodedByLabel }) => {
  const tlStart = monthCols[0].start;
  const tlEnd   = monthCols[monthCols.length - 1].end;
  const totalMs = tlEnd.getTime() - tlStart.getTime();
  const toLeft  = d => Math.max(0, Math.min(100, ((d.getTime() - tlStart.getTime()) / totalMs) * 100));
  const toWidth = (s, e) => Math.max(2, toLeft(e) - toLeft(s));
  const c = phaseColor(phase);

  const grayBarEl = stdWin ? (
    <div
      title={`Standard: ${fmtShort(stdWin.start)} → ${fmtShort(stdWin.end)} (${stdWin.days}d)`}
      style={{
        position: 'absolute',
        left:  `${toLeft(stdWin.start)}%`,
        width: `${toWidth(stdWin.start, stdWin.end)}%`,
        top: '50%', transform: 'translateY(-50%)',
        height: 16, borderRadius: 99,
        background: '#E2E8F0', border: '1px solid #CBD5E1', zIndex: 1,
      }}
    />
  ) : null;

  let colorBarEl = null;
  let pct        = null;
  if (actualBar?.start) {
    const ae = actualBar.end || actualBar.start;
    let barLeft = toLeft(actualBar.start);
    let barWidth = Math.max(2, toWidth(actualBar.start, ae));

    if (stdWin) {
      const stdMs = Math.max(1, stdWin.end.getTime() - stdWin.start.getTime());
      const actMs = Math.max(0, ae.getTime() - actualBar.start.getTime());
      const stdWidth = toWidth(stdWin.start, stdWin.end);
      const fillRatio = actMs === 0 ? 0.08 : Math.min(1, actMs / stdMs);

      barLeft = toLeft(stdWin.start);
      barWidth = Math.max(stdWidth * 0.08, stdWidth * fillRatio);
      pct = Math.min(100, Math.round(fillRatio * 100));
    }

    colorBarEl = (
      <div
        title={`Actual: ${fmtShort(actualBar.start)} → ${actualBar.end ? fmtShort(ae) : 'ongoing'} · ${actualBar.count} encoding${actualBar.count !== 1 ? 's' : ''}`}
        style={{
          position: 'absolute',
          left:  `${barLeft}%`,
          width: `${barWidth}%`,
          top: '50%', transform: 'translateY(-50%)',
          height: 22, borderRadius: 99,
          background: c, opacity: 0.9, zIndex: 2,
          boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${c}66`,
          transition: 'width .5s ease',
        }}
      />
    );
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 1fr 68px',
      alignItems: 'center', minHeight: 54,
      borderBottom: '1px solid #f8fafc', padding: '6px 0',
    }}>
      <div style={{ paddingRight: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: c, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{phase}</span>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginLeft: 18, marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span>{stdWin ? `${stdWin.days}d standard` : 'no standard'}</span>
          {encodedByLabel && (
            <span style={{
              background: encodedByLabel === 'Brgy Pres.' ? '#FAEEDA' : '#E6F1FB',
              color:       encodedByLabel === 'Brgy Pres.' ? '#854F0B'  : '#185FA5',
              padding: '0 4px', borderRadius: 3, fontWeight: 600,
            }}>{encodedByLabel}</span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: `${monthCols.length * 82}px`, position: 'relative' }}>
        {monthCols.map((col, i) => (
          <div key={col.key} style={{
            position: 'absolute',
            left:  `${toLeft(col.start)}%`,
            width: `${toWidth(col.start, col.end)}%`,
            top: 0, bottom: 0,
            borderLeft: i > 0 ? '.5px solid #f1f5f9' : 'none',
          }} />
        ))}
        <div style={{ position: 'relative', height: 36, display: 'flex', alignItems: 'center' }}>
          {grayBarEl}
          {colorBarEl}
          {!grayBarEl && !colorBarEl && (
            <div style={{
              position: 'absolute', left: 0, right: 0,
              top: '50%', transform: 'translateY(-50%)',
              height: 6, borderRadius: 99, border: '1px dashed #E2E8F0',
            }} />
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', paddingLeft: 10 }}>
        {pct !== null ? (
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
            background: pct >= 80 ? '#d1fae5' : pct >= 50 ? '#FAEEDA' : '#fee2e2',
            color:      pct >= 80 ? '#065f46' : pct >= 50 ? '#854F0B' : '#991b1b',
          }}>{pct}%</span>
        ) : actualBar?.start ? (
          <span style={{ fontSize: 12, color: '#F97316', fontWeight: 700 }}>live</span>
        ) : (
          <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>
        )}
      </div>
    </div>
  );
};

const SeedTypeGantt = ({ records, plots, season, year }) => {
  const [activeTab, setActiveTab] = useState('OWN_SEED');
  const tabCfg    = SEED_TAB_MAP[activeTab];
  const monthCols = useMemo(() => buildMonthCols(season, year), [season, year]);
  const stdWins   = useMemo(() => buildStdWindows(activeTab, season, year), [activeTab, season, year]);

  const actualBars = useMemo(() => {
    const bars = {};
    records
      .filter(r => normSeed(r.seed_source) === activeTab)
      .forEach(r => {
        const ph = normalizePhase(r.crop_phase || r.land_type);
        if (!tabCfg.phases.includes(ph)) return;
        const d = parseDate(r.date_observed || r.encoded_at || r.created_at);
        if (!d) return;
        if (!bars[ph]) bars[ph] = { start: d, end: d, count: 0 };
        if (d < bars[ph].start) bars[ph].start = d;
        if (d > bars[ph].end)   bars[ph].end   = d;
        bars[ph].count++;
      });
    return bars;
  }, [records, activeTab, tabCfg]);

  const filtPlots = plots.filter(p => normSeed(p.seed_source) === activeTab);
  const farmers   = new Set(filtPlots.map(p => p.farmer || p.id)).size;
  const brgysSet  = new Set(filtPlots.map(p => p.barangay).filter(Boolean));
  const ha        = filtPlots.reduce((s, p) => s + (parseFloat(p.area_ha) || 0), 0);
  const activePh  = Object.keys(actualBars).length;

  const brgyBreakdown = useMemo(() => {
    const map = {};
    records
      .filter(r => normSeed(r.seed_source) === activeTab)
      .forEach(r => {
        const brgy  = r.barangay || r.farmer_barangay || '';
        const phase = normalizePhase(r.crop_phase || r.land_type);
        if (!brgy) return;
        if (!map[brgy]) map[brgy] = { lastPhase: phase, lastDate: null, count: 0 };
        map[brgy].lastPhase = phase;
        const d = parseDate(r.date_observed || r.created_at);
        if (d && (!map[brgy].lastDate || d > map[brgy].lastDate)) map[brgy].lastDate = d;
        map[brgy].count++;
      });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [records, activeTab]);

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.1rem 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          Phase Timeline by Seed Type
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SEED_TABS.map(t => {
            const Icon   = t.icon;
            const active = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  border:     active ? `1.5px solid ${t.color}` : '1.5px solid #e2e8f0',
                  background: active ? t.bg : 'white',
                  color:      active ? t.color : '#64748b',
                  cursor: 'pointer', transition: 'all .15s',
                }}>
                <Icon size={12} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid #f1f5f9' }}>
        {[
          { v: farmers,                                                 lbl: 'farmers'       },
          { v: brgysSet.size,                                           lbl: 'barangays'     },
          { v: ha > 0 ? fmtNum(ha, 1) + ' ha' : '—',                   lbl: 'area'          },
          { v: activePh > 0 ? `${activePh}/${tabCfg.phases.length}` : '—', lbl: 'phases active' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '12px 16px', textAlign: 'center', borderRight: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: tabCfg.color }}>{s.v}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 68px', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Phase</div>
          <div style={{ display: 'flex', minWidth: `${monthCols.length * 90}px`, borderBottom: '2px solid #e2e8f0', paddingBottom: 6 }}>
            {monthCols.map((col, i) => (
              <div key={col.key} style={{
                flex: `0 0 ${100 / monthCols.length}%`,
                fontSize: 13, fontWeight: 700, color: '#475569',
                textAlign: 'center', paddingBottom: 4,
                borderBottom: '.5px solid #e2e8f0',
                borderLeft: i === 0 ? 'none' : '.5px solid #f1f5f9',
              }}>
                {col.label}
                <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{col.year}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.05em', paddingLeft: 10 }}>vs std</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {tabCfg.phases.map(ph => (
            <GanttPhaseRow
              key={ph}
              phase={ph}
              stdWin={stdWins[ph] || null}
              actualBar={actualBars[ph] || null}
              monthCols={monthCols}
              encodedByLabel={tabCfg.encodedBy[ph] || null}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingTop: 10, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { el: <span style={{ width: 22, height: 7, borderRadius: 99, background: '#E2E8F0', border: '1px solid #CBD5E1', display: 'inline-block' }} />, lbl: 'Standard baseline' },
            { el: <span style={{ width: 22, height: 7, borderRadius: 99, background: tabCfg.color, opacity: .85, display: 'inline-block' }} />,               lbl: 'Actual progress (all brgy)' },
            { el: <span style={{ width: 22, height: 7, borderRadius: 99, border: '1px dashed #CBD5E1', display: 'inline-block' }} />,                          lbl: 'No data yet' },
          ].map((x, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
              {x.el} {x.lbl}
            </span>
          ))}
          {activeTab === 'OWN_SEED' && (
            <span style={{ fontSize: 12, color: '#854F0B', background: '#FAEEDA', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
              Own seed starts at Crop Establishment
            </span>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #f1f5f9' }}>
        <div style={{ padding: '.6rem 1rem .4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Barangay activity — {tabCfg.label}
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{brgyBreakdown.length} brgy{brgyBreakdown.length !== 1 ? 's' : ''} with data</span>
        </div>
        {brgyBreakdown.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
            No {tabCfg.label.toLowerCase()} data encoded yet for this season
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Barangay', 'Latest phase', 'Encodings', 'Last encoded'].map((h, i) => (
                    <th key={i} style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', padding: '5px 12px', textAlign: 'left', borderBottom: '.5px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brgyBreakdown.map(([brgy, data]) => {
                  const pc = phaseColor(data.lastPhase);
                  return (
                    <tr key={brgy}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '6px 12px', borderBottom: '.5px solid #f8fafc', fontWeight: 500, color: '#0f172a' }}>{brgy}</td>
                      <td style={{ padding: '6px 12px', borderBottom: '.5px solid #f8fafc' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: `${pc}18`, color: pc }}>
                          {PHASE_SHORT[data.lastPhase] || data.lastPhase}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', borderBottom: '.5px solid #f8fafc', color: '#64748b' }}>{data.count}</td>
                      <td style={{ padding: '6px 12px', borderBottom: '.5px solid #f8fafc', color: '#94a3b8' }}>{fmtShort(data.lastDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const CropPhase = () => {
  const [plots,   setPlots]   = useState([]);
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animate, setAnimate] = useState(false);
  const [toast,   setToast]   = useState(null);
  const toastRef    = useRef(null);
  const intervalRef = useRef(null);
  const navigate    = useNavigate();

  const showToast = useCallback((msg, type = 'success') => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, type });
    toastRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [plotsRes, sumRes, recRes] = await Promise.allSettled([
        getGisPlots(),
        getMapSummary(),
        API.get('/crop-monitoring/admin/records/'),
      ]);
      if (plotsRes.status === 'fulfilled') {
        const d = plotsRes.value.data;
        setPlots(Array.isArray(d) ? d : (d?.plots || []));
      }
      if (sumRes.status  === 'fulfilled') setSummary(sumRes.value.data);
      if (recRes.status  === 'fulfilled') {
        const d = recRes.value.data;
        setRecords(Array.isArray(d) ? d : (d?.results || []));
      }
      if (!silent) {
        setAnimate(true);
        setTimeout(() => setAnimate(false), 700);
        showToast('Data loaded successfully');
      }
    } catch {
      if (!silent) showToast('Failed to load data', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(() => loadData(true), 30000);
    return () => {
      clearInterval(intervalRef.current);
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, [loadData]);

  const season = useMemo(() => {
    if (summary?.active_season) {
      const s = summary.active_season.toLowerCase();
      if (s.includes('wet')) return 'wet';
      if (s.includes('dry')) return 'dry';
    }
    if (summary?.poll_season) return summary.poll_season === 'WET' ? 'wet' : 'dry';
    const m = new Date().getMonth();
    return (m >= 5 && m <= 9) ? 'wet' : 'dry';
  }, [summary]);

  const seasonYear = useMemo(() => {
    if (summary?.season_year) return parseInt(summary.season_year);
    if (summary?.poll_year)   return parseInt(summary.poll_year);
    return new Date().getFullYear();
  }, [summary]);

  const seasonLabel = useMemo(() =>
    season === 'dry'
      ? `Dry Season ${seasonYear}–${seasonYear + 1}`
      : `Wet Season ${seasonYear}`,
  [season, seasonYear]);

  const phaseCounts = useMemo(() => {
    const pc = {};
    plots.forEach(p => { const k = normalizePhase(p.land_type); pc[k] = (pc[k] || 0) + 1; });
    return pc;
  }, [plots]);

  const totalPlots  = Math.max(plots.length, 1);
  const phaseSorted = PHASE_ORDER
    .map(ph => ({ ph, cnt: phaseCounts[ph] || 0 }))
    .filter(x => x.cnt > 0)
    .sort((a, b) => b.cnt - a.cnt);
  const dominant = phaseSorted[0];

  const seedMap = useMemo(() => {
    const m = { HYBRID: { cnt: 0, ha: 0 }, INBRED: { cnt: 0, ha: 0 }, OWN_SEED: { cnt: 0, ha: 0 } };
    plots.forEach(p => {
      const k = normSeed(p.seed_source);
      m[k].cnt++;
      m[k].ha += parseFloat(p.area_ha) || 0;
    });
    if (summary?.seed_breakdown) {
      ['HYBRID', 'INBRED', 'OWN_SEED'].forEach(k => {
        m[k].cnt = summary.seed_breakdown[k]?.total_farmers || m[k].cnt;
      });
    }
    return m;
  }, [plots, summary]);

  const totalFarmers  = summary?.current_farmers || plots.length;
  const totalApproved = summary?.total_approved_farmers || totalFarmers;
  const totalHa       = plots.reduce((s, p) => s + (parseFloat(p.area_ha) || 0), 0);
  const activeBrgys   = useMemo(
    () => [...new Set(records.map(r => r.barangay || r.farmer_barangay).filter(Boolean))].length,
    [records],
  );

  const matCols  = ['Seed Distribution', 'Crop Establishment', 'Tillering', 'Flowering'];
  const matrix   = { HYBRID: {}, INBRED: {}, OWN_SEED: {} };
  plots.forEach(p => {
    const k  = normSeed(p.seed_source);
    const ph = normalizePhase(p.land_type);
    matrix[k][ph] = (matrix[k][ph] || 0) + 1;
  });
  const colTotals = {};
  matCols.forEach(c => { colTotals[c] = (matrix.HYBRID[c] || 0) + (matrix.INBRED[c] || 0) + (matrix.OWN_SEED[c] || 0); });
  const rowTotals = { HYBRID: 0, INBRED: 0, OWN_SEED: 0 };
  Object.entries(matrix).forEach(([k, v]) => { rowTotals[k] = Object.values(v).reduce((a, b) => a + b, 0); });
  const grandTotal = Object.values(rowTotals).reduce((a, b) => a + b, 0);

  const auditItems = records.slice(0, 10);
  const savedCount = seedMap.OWN_SEED.cnt;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748b' }}>
      <style>{`@keyframes cp-spin{to{transform:rotate(360deg)}} @keyframes cp-fadein{from{opacity:0}to{opacity:1}}`}</style>
      <div style={{ width: 28, height: 28, border: '3px solid #bbf7d0', borderTopColor: '#1a4d1a', borderRadius: '50%', animation: 'cp-spin .7s linear infinite' }} />
      <span style={{ fontSize: 13 }}>Loading crop phase data...</span>
    </div>
  );

  return (
    <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '100vh' }}>
      <style>{`
        @keyframes cp-fadein { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cp-spin   { to { transform:rotate(360deg) } }
        @keyframes cp-pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        .cp-audit::-webkit-scrollbar { width:3px }
        .cp-audit::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:99px }
        .cp-body    { display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:1.25rem; align-items:start }
        .cp-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.875rem }
        @media(max-width:960px){ .cp-body{grid-template-columns:minmax(0,1fr)} .cp-metrics{grid-template-columns:repeat(2,1fr)} }
        @media(max-width:640px){ .cp-metrics{grid-template-columns:1fr} }
      `}</style>
      <Toast toast={toast} />

      <div style={{
        background: 'linear-gradient(135deg, #14532D 0%, #166534 60%, #15803D 100%)',
        borderRadius: 16, padding: '1.75rem 2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '1rem', boxShadow: '0 8px 24px rgba(15,23,42,0.10)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#BBF7D0' }}>
              Crop Phase Analytics
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,.15)', color: '#DCFCE7' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'cp-pulse 1.5s infinite' }} />
              Live
            </span>
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.9rem', fontWeight: 800, color: 'white', lineHeight: 1.15 }}>
            {seasonLabel}
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#BBF7D0', fontWeight: 400, lineHeight: 1.5 }}>
            Track crop phase progression per seed type across all barangays in Lucban, Quezon.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => loadData()} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '.5rem 1rem', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 10, background: 'rgba(255,255,255,.12)', cursor: 'pointer', color: 'white' }}>
            <RefreshCw size={15} color="white" /> Refresh
          </button>
          <button onClick={() => navigate('/admin/gis')} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '.5rem 1rem', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 10, background: 'rgba(255,255,255,.12)', cursor: 'pointer', color: 'white' }}>
            <MapPin size={15} color="white" /> Open GIS Map ↗
          </button>
        </div>
      </div>

      <div className="cp-metrics">
        {[
          { icon: <Activity size={20} color="#16a34a" />,  val: `${totalFarmers}/${totalApproved}`, lbl: 'Total farmers',  sub: 'monitored / approved'     },
          { icon: <TrendingUp size={20} color="#185FA5" />, val: totalHa > 0 ? fmtNum(totalHa, 2) : '—', lbl: 'Hectares', sub: 'total area monitored'    },
          { icon: <MapPin size={20} color="#A855F7" />,     val: `${activeBrgys}/${ALL_BARANGAYS.length}`, lbl: 'Barangays', sub: 'active / total'        },
          { icon: <Sprout size={20} color={dominant ? phaseColor(dominant.ph) : '#64748b'} />,
            val: dominant?.ph || '—', lbl: 'Dominant phase', sub: dominant ? `${dominant.cnt} farmers` : 'no data yet', small: (dominant?.ph?.length || 0) > 12 },
        ].map((m, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 14, padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(15,23,42,.06)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: m.small ? 15 : 24, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>{m.val}</span>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#E8F5EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.icon}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{m.lbl}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="cp-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SeedTypeGantt records={records} plots={plots} season={season} year={seasonYear} />

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Phase distribution (overall)</div>
            {phaseSorted.length === 0
              ? <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: 12 }}>No phase data yet</div>
              : phaseSorted.map(x => <PhaseBar key={x.ph} phase={x.ph} count={x.cnt} total={totalPlots} animate={animate} />)
            }
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Seed type breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '.5rem' }}>
              {[
                { key: 'HYBRID',   label: 'Hybrid',       color: '#1a4d1a', accent: false },
                { key: 'INBRED',   label: 'Certified',    color: '#3B82F6', accent: false },
                { key: 'OWN_SEED', label: 'Farmer saved', color: '#639922', accent: true  },
              ].map(s => (
                <div key={s.key} style={{ background: '#f8fafc', borderRadius: 8, padding: '.625rem .75rem', border: s.accent ? '1px solid #C0DD97' : '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />{s.label}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 500, color: s.accent ? s.color : '#0f172a' }}>{fmtNum(seedMap[s.key].cnt)}</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{seedMap[s.key].ha > 0 ? fmtNum(seedMap[s.key].ha, 2) + ' ha' : '—'}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Seed source × phase matrix</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {['Seed type', 'Seed dist.', 'Establish.', 'Tillering', 'Flowering', 'Total'].map(h => (
                      <th key={h} style={{ fontSize: 10, fontWeight: 600, color: '#475569', padding: '5px 6px', textAlign: h === 'Seed type' ? 'left' : 'right', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'HYBRID',   label: 'Hybrid',    saved: false },
                    { key: 'INBRED',   label: 'Certified', saved: false },
                    { key: 'OWN_SEED', label: 'Own Seed',  saved: true  },
                  ].map(r => (
                    <tr key={r.key}>
                      <td style={{ fontSize: 11, padding: '5px 6px', color: r.saved ? '#639922' : '#64748b', fontWeight: 500, borderBottom: '1px solid #f1f5f9' }}>{r.label}</td>
                      {matCols.map(c => (
                        <td key={c} style={{ fontSize: 11, padding: '5px 6px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: r.saved && (matrix[r.key][c] || 0) > 0 ? '#639922' : '#0f172a', fontWeight: r.saved && (matrix[r.key][c] || 0) > 0 ? 600 : 400 }}>
                          {matrix[r.key][c] || 0}
                        </td>
                      ))}
                      <td style={{ fontSize: 11, padding: '5px 6px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', color: r.saved ? '#639922' : '#0f172a', fontWeight: r.saved ? 600 : 400 }}>{rowTotals[r.key]}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ fontSize: 11, padding: '5px 6px', color: '#0f172a', fontWeight: 600 }}>Total</td>
                    {matCols.map(c => <td key={c} style={{ fontSize: 11, padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{colTotals[c]}</td>)}
                    <td style={{ fontSize: 11, padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{grandTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          <div style={{ background: '#1a4d1a', borderRadius: 12, padding: '1rem 1.1rem', color: 'white' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86efac', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Active season</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{seasonLabel}</div>
            <div style={{ fontSize: 11, color: '#bbf7d0', marginTop: 4 }}>
              {season === 'dry' ? 'Oct buffer + Nov → May (+1yr)' : 'May buffer + Jun → Oct'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {SEED_TABS.map(t => (
                <span key={t.key} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,.13)', color: '#bbf7d0' }}>
                  {t.label}: {seedMap[t.key].cnt}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '.875rem 1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Standard days reference</div>
            {(['dry', 'wet']).map(s => (
              <div key={s} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: s === season ? '#1a4d1a' : '#94a3b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ textTransform: 'capitalize' }}>{s} season</span>
                  {s === season && <span style={{ fontSize: 9, background: '#d1fae5', color: '#065f46', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>active</span>}
                </div>
                {Object.entries(STD_DAYS[s]).map(([ph, d]) => (
                  <div key={ph} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
                      <span style={{ width: 6, height: 6, borderRadius: 1, background: phaseColor(ph), flexShrink: 0 }} />
                      {PHASE_SHORT[ph] || ph}
                    </span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{d}d</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '.5px solid #f1f5f9', fontSize: 10, color: '#94a3b8' }}>
              Seed Distribution encoded by Brgy President.<br />All other phases encoded by AT.
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '.875rem 1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Phase legend</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PHASE_CFG.map(ph => (
                <div key={ph.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#475569' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: ph.color, flexShrink: 0 }} />
                  {ph.key}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em' }}>AT action log</span>
              <button onClick={() => loadData()} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#64748b' }}>
                <RefreshCw size={10} /> refresh
              </button>
            </div>
            <div className="cp-audit" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {auditItems.length === 0
                ? <div style={{ padding: '1rem', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>No activity yet</div>
                : auditItems.map((r, i) => <AuditItem key={r.id || i} record={r} />)
              }
            </div>
          </div>

          {savedCount > 0 && (
            <div style={{ background: '#FAEEDA', border: '1px solid #FAC775', borderRadius: 12, padding: '.75rem 1rem', display: 'flex', gap: '.625rem' }}>
              <AlertCircle size={16} color="#854F0B" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#412402', marginBottom: 2 }}>
                  Pre-distribution activity — {savedCount} farmer{savedCount !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 11, color: '#633806', lineHeight: 1.5 }}>
                  AT visited these farmers before government seeds arrived. They use saved seeds and are recorded under the Informal Seed System in the Planting Accomplishment Report.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CropPhase;