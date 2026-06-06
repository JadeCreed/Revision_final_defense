import { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const PHASE_COLORS = {
  DISTRIBUTION:  '#64748b',
  ESTABLISHMENT: '#3b82f6',
  TILLERING:     '#22c55e',
  FLOWERING:     '#a855f7',
  RIPENING:      '#eab308',
  HARVESTING:    '#f97316',
};
const PHASE_LABELS = {
  DISTRIBUTION:  'Seed Distribution',
  ESTABLISHMENT: 'Crop Establishment',
  TILLERING:     'Tillering',
  FLOWERING:     'Flowering',
  RIPENING:      'Ripening',
  HARVESTING:    'Harvesting',
};
const SEED_CFG = {
  HYBRID:   { label: 'Hybrid Seed',  color: '#166534', light: '#dcfce7', border: '#86efac' },
  INBRED:   { label: 'Inbred Seed',  color: '#1e40af', light: '#dbeafe', border: '#93c5fd' },
  OWN_SEED: { label: 'Own Seed',     color: '#92400e', light: '#fef3c7', border: '#fde047' },
};
const SEED_PHASES = {
  HYBRID:   ['DISTRIBUTION','ESTABLISHMENT','TILLERING','FLOWERING','RIPENING','HARVESTING'],
  INBRED:   ['DISTRIBUTION','ESTABLISHMENT','TILLERING','FLOWERING','RIPENING','HARVESTING'],
  OWN_SEED: ['ESTABLISHMENT','TILLERING','FLOWERING','RIPENING','HARVESTING'],
};
const ENCODED_BY = {
  DISTRIBUTION: 'Brgy Pres.',
  ESTABLISHMENT: 'AT', TILLERING: 'AT',
  FLOWERING: 'AT', RIPENING: 'AT', HARVESTING: 'AT',
};
const STD_LOCAL = {
  WET: { DISTRIBUTION:3,ESTABLISHMENT:20,TILLERING:45,FLOWERING:20,RIPENING:40,HARVESTING:5 },
  DRY: { DISTRIBUTION:3,ESTABLISHMENT:20,TILLERING:45,FLOWERING:20,RIPENING:50,HARVESTING:5 },
};

const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const fmtDate = v => v ? new Date(v).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '—';

const buildMonthCols = (season, year) => {
  const yr = parseInt(year);
  const slots = season === 'WET'
    ? [4,5,6,7,8,9].map(m => ({ y: yr, m }))
    : [9,10,11].map(m => ({ y: yr, m })).concat([0,1,2,3,4].map(m => ({ y: yr+1, m })));
  return slots.map(({ y, m }) => ({
    key: `${y}-${m}`,
    label: new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short' }),
    year: y,
    start: new Date(y, m, 1),
    end:   new Date(y, m+1, 0, 23, 59, 59),
  }));
};

const buildStdWindows = (seedKey, season, year, stdDays) => {
  const yr     = parseInt(year);
  const phases = SEED_PHASES[seedKey] || [];
  const dur    = stdDays?.[season] || STD_LOCAL[season] || STD_LOCAL.WET;
  let cursor   = season === 'WET' ? new Date(yr, 5, 1) : new Date(yr, 10, 1);
  const wins   = {};
  phases.forEach(ph => {
    const d  = dur[ph] ?? 1;
    wins[ph] = { start: new Date(cursor), end: addDays(cursor, d-1), days: d };
    cursor   = addDays(cursor, d);
  });
  return wins;
};

const GanttRow = ({ phase, stdWin, entry, monthCols, distEntry }) => {
  const tlStart = monthCols[0]?.start;
  const tlEnd   = monthCols[monthCols.length-1]?.end;
  if (!tlStart || !tlEnd) return null;

  const totalMs = tlEnd - tlStart;
  const toLeft  = d => Math.max(0, Math.min(100, ((d - tlStart) / totalMs) * 100));
  const toWidth = (s, e) => Math.max(0.5, toLeft(e) - toLeft(s));
  const color   = PHASE_COLORS[phase] || '#94a3b8';
  const encBy   = ENCODED_BY[phase];

  // Use distEntry for DISTRIBUTION phase, entry for others
  const activeEntry = phase === 'DISTRIBUTION' ? distEntry : entry;
  const pct = activeEntry?.completion_pct ?? null;
  const isDelayed = activeEntry?.all_delayed;

  let colorBar = null;
  if (activeEntry && stdWin) {
    const stdW    = toWidth(stdWin.start, stdWin.end);
    const barLeft = toLeft(stdWin.start);
    const barW    = pct !== null
      ? Math.max(stdW * 0.03, (stdW * Math.min(pct, 100)) / 100)
      : stdW * 0.03;

    const tooltip = activeEntry.mode_date
      ? `${pct ?? 0}% · Mode: ${fmtDate(activeEntry.mode_date)} · ${activeEntry.mode_count} farmers`
      : `${pct ?? 0}% of farmers reached this phase`;

    colorBar = (
      <div
        title={tooltip}
        style={{
          position: 'absolute',
          left: `${barLeft}%`, width: `${barW}%`,
          top: '50%', transform: 'translateY(-50%)',
          height: 12, borderRadius: 99,
          background: isDelayed ? '#ef4444' : color,
          opacity: 0.88, zIndex: 2,
          boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${isDelayed ? '#ef444440' : color + '40'}`,
          transition: 'width .5s ease',
        }}
      />
    );
  }

  const vsLabel = pct !== null
    ? (isDelayed ? 'delayed' : `${pct}%`)
    : null;
  const vsRed = isDelayed || (pct !== null && pct < 30);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr 60px',
      alignItems: 'center',
      minHeight: 54,
      borderBottom: '1px solid #f8fafc',
      padding: '6px 0',
    }}>
      {/* label */}
      <div style={{ paddingRight: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
            {PHASE_LABELS[phase] || phase}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 4, marginLeft: 15, flexWrap: 'wrap', alignItems: 'center' }}>
          {stdWin?.days && (
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{stdWin.days}d std</span>
          )}
          {encBy && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
              background: encBy === 'Brgy Pres.' ? '#fef3c7' : '#dbeafe',
              color:      encBy === 'Brgy Pres.' ? '#92400e' : '#1e40af',
            }}>
              {encBy}
            </span>
          )}
        </div>
      </div>

      {/* bar */}
      <div style={{ position: 'relative', height: 36, minWidth: 0 }}>
        {monthCols.map((col, i) => (
          <div key={col.key} style={{
            position: 'absolute',
            left: `${toLeft(col.start)}%`, top: 0, bottom: 0,
            width: 1, background: i === 0 ? 'transparent' : '#f1f5f9',
          }} />
        ))}
        {stdWin && (
          <div style={{
            position: 'absolute',
            left: `${toLeft(stdWin.start)}%`,
            width: `${toWidth(stdWin.start, stdWin.end)}%`,
            top: '50%', transform: 'translateY(-50%)',
            height: 7, borderRadius: 99,
            background: '#e2e8f0', border: '1px solid #cbd5e1', zIndex: 1,
          }} />
        )}
        {colorBar}
        {!stdWin && !colorBar && (
          <div style={{
            position: 'absolute', left: 0, right: 0,
            top: '50%', transform: 'translateY(-50%)',
            height: 3, borderRadius: 99, border: '1px dashed #e2e8f0',
          }} />
        )}
      </div>

      {/* vs std */}
      <div style={{ textAlign: 'right', paddingLeft: 8 }}>
        {vsLabel ? (
          <span style={{
            fontSize: 11, fontWeight: 700,
            padding: '3px 8px', borderRadius: 99,
            background: vsRed ? '#fee2e2' : pct >= 80 ? '#dcfce7' : '#fef9c3',
            color:      vsRed ? '#991b1b' : pct >= 80 ? '#166534' : '#854d0e',
          }}>
            {vsLabel}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
        )}
      </div>
    </div>
  );
};

const GanttChart = ({ ganttData, distDates, season, year, stdDays, ganttAlert }) => {
  const [tab, setTab] = useState('OWN_SEED');
  const seedCfg   = SEED_CFG[tab];
  const phases    = SEED_PHASES[tab] || [];
  const tabData   = ganttData?.[tab] || {};
  const monthCols = useMemo(() => buildMonthCols(season, year), [season, year]);
  const stdWins   = useMemo(() => buildStdWindows(tab, season, year, stdDays), [tab, season, year, stdDays]);

  const totalFarmers  = Object.values(tabData).reduce((s, e) => s + (e?.farmers || 0), 0);
  const activePhases  = Object.keys(tabData).length;
  const distEntry     = distDates?.[tab]
    ? { completion_pct: 100, mode_date: distDates[tab].date, mode_count: distDates[tab].count, farmers: distDates[tab].total, total_farmers: distDates[tab].total, all_delayed: false }
    : null;

  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0',
      borderRadius: 16, overflow: 'hidden',
    }}>
      {/* header + tabs */}
      <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          Phase timeline by seed type
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 12 }}>
          {Object.entries(SEED_CFG).map(([key, cfg]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${tab === key ? cfg.color : '#e2e8f0'}`,
                background: tab === key ? cfg.light : 'white',
                color:      tab === key ? cfg.color : '#64748b',
                cursor: 'pointer', transition: 'all .15s',
              }}>
              {cfg.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 20, paddingBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            <strong style={{ color: '#0f172a', marginRight: 4 }}>{totalFarmers}</strong>
            farmers reached phases
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            <strong style={{ color: '#0f172a', marginRight: 4 }}>{activePhases}/{phases.length}</strong>
            phases active
          </span>
        </div>
      </div>

      {/* month header + rows */}
      <div style={{ padding: '12px 20px 0', overflowX: 'auto' }}>
        {/* month cols header */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 60px', marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Phase
          </div>
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', paddingBottom: 6 }}>
            {monthCols.map((col, i) => (
              <div key={col.key} style={{
                flex: `0 0 ${100 / monthCols.length}%`,
                fontSize: 12, fontWeight: 700, color: '#475569',
                textAlign: 'center',
                borderLeft: i === 0 ? 'none' : '1px solid #f1f5f9',
              }}>
                {col.label}
                <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>
                  {col.year}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textAlign: 'right', paddingLeft: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            % done
          </div>
        </div>

        {/* rows */}
        {phases.map(ph => (
          <GanttRow
            key={ph}
            phase={ph}
            stdWin={stdWins[ph] || null}
            entry={tabData[ph] || null}
            distEntry={distEntry}
            monthCols={monthCols}
          />
        ))}

        {/* legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10, paddingBottom: 4, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { el: <span style={{ width: 20, height: 6, borderRadius: 99, background: '#e2e8f0', border: '1px solid #cbd5e1', display: 'inline-block' }} />, lbl: 'Standard window' },
            { el: <span style={{ width: 20, height: 6, borderRadius: 99, background: seedCfg.color, opacity: .8, display: 'inline-block' }} />, lbl: 'Phase completion %' },
            { el: <span style={{ width: 20, height: 6, borderRadius: 99, background: '#ef4444', display: 'inline-block' }} />, lbl: 'All dates delayed' },
            { el: <span style={{ width: 20, height: 6, borderRadius: 99, border: '1px dashed #cbd5e1', display: 'inline-block' }} />, lbl: 'No data yet' },
          ].map((x, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#64748b' }}>
              {x.el} {x.lbl}
            </span>
          ))}
          {tab === 'OWN_SEED' && (
            <span style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
              Own Seed starts at Crop Establishment
            </span>
          )}
        </div>
      </div>

      {/* alert strip */}
      <div style={{ padding: '10px 20px 16px' }}>
        {ganttAlert && ganttAlert.delayed > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 14px' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>
              <strong>{ganttAlert.pct}%</strong> of farmers in <strong>{ganttAlert.label}</strong> are delayed ({ganttAlert.delayed} of {ganttAlert.total} farmers)
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 14px' }}>
            <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
            Majority of farmers are within standard crop timelines.
          </div>
        )}
      </div>
    </div>
  );
};

export default GanttChart;