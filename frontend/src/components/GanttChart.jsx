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
  ESTABLISHMENT:'AT', TILLERING:'AT',
  FLOWERING:'AT', RIPENING:'AT', HARVESTING:'AT',
};

const fmtDate = v => v
  ? new Date(v + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  : '—';

const buildMonthCols = (timelineMonths) => {
  if (!timelineMonths?.length) return [];
  return timelineMonths.map(({ month, label, year }) => ({
    key:   `${year}-${month}`,
    label,
    year,
    start: new Date(year, month - 1, 1),
    end:   new Date(year, month, 0, 23, 59, 59),
  }));
};

const GanttRow = ({ phase, entry, monthCols, distEntry }) => {
  if (!monthCols.length) return null;
  const tlStart = monthCols[0].start;
  const tlEnd   = monthCols[monthCols.length - 1].end;
  const totalMs = tlEnd - tlStart;

  const toLeft  = d => Math.max(0, Math.min(100, ((new Date(d + 'T00:00:00') - tlStart) / totalMs) * 100));
  const toWidth = (s, e) => Math.max(0.5, toLeft(e) - toLeft(s));
  const color   = PHASE_COLORS[phase] || '#94a3b8';
  const encBy   = ENCODED_BY[phase];

  // Use distEntry for DISTRIBUTION if no entry
  const activeEntry = (phase === 'DISTRIBUTION' && !entry) ? distEntry : entry;
  const pct         = activeEntry?.completion_pct ?? null;
  const isDelayed   = activeEntry?.all_delayed;
  const stdStart    = activeEntry?.std_start;
  const stdEnd      = activeEntry?.std_end;

  // Standard gray bar — from backend std_start/std_end
  const grayBar = stdStart && stdEnd ? (
    <div
      title={`Standard window: ${fmtDate(stdStart)} → ${fmtDate(stdEnd)} (${activeEntry?.std_days}d)`}
      style={{
        position: 'absolute',
        left:  `${toLeft(stdStart)}%`,
        width: `${toWidth(stdStart, stdEnd)}%`,
        top: '50%', transform: 'translateY(-50%)',
        height: 7, borderRadius: 99,
        background: '#e2e8f0', border: '1px solid #cbd5e1', zIndex: 1,
      }}
    />
  ) : null;

  // Colored bar — width proportional to completion_pct of standard window
  let colorBar = null;
  if (activeEntry && stdStart && stdEnd && pct !== null) {
    const stdW    = toWidth(stdStart, stdEnd);
    const barLeft = toLeft(stdStart);
    const barW    = Math.max(stdW * 0.03, (stdW * Math.min(pct, 100)) / 100);
    const barColor = isDelayed ? '#ef4444' : color;

    const validF   = activeEntry.valid_farmers   ?? 0;
    const delayedF = activeEntry.delayed_farmers ?? 0;
    const tooltip  = activeEntry.mode_date
      ? `${pct}% on-time · ${validF} valid · ${delayedF} delayed · Mode: ${fmtDate(activeEntry.mode_date)}`
      : `${pct}% on-time · ${validF} valid · ${delayedF} delayed`;

    colorBar = (
      <div
        title={tooltip}
        style={{
          position: 'absolute',
          left: `${barLeft}%`, width: `${barW}%`,
          top: '50%', transform: 'translateY(-50%)',
          height: 12, borderRadius: 99,
          background: barColor, opacity: 0.9, zIndex: 2,
          boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${barColor}40`,
          transition: 'width .5s ease',
        }}
      />
    );
  }

  const vsRed = isDelayed || (pct !== null && pct < 30);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '150px 1fr 64px',
      alignItems: 'center',
      minHeight: 52,
      borderBottom: '1px solid #f8fafc',
      padding: '5px 0',
    }}>
      {/* Phase label */}
      <div style={{ paddingRight: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
            {PHASE_LABELS[phase] || phase}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 3, marginLeft: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {activeEntry?.std_days && (
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{activeEntry.std_days}d std</span>
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

      {/* Bar area */}
      <div style={{ position: 'relative', height: 36, minWidth: 0, overflow: 'visible' }}>
        {/* Month dividers */}
        {monthCols.map((col, i) => i > 0 && (
          <div key={col.key} style={{
            position: 'absolute',
            left: `${toLeft(col.start.toISOString().slice(0, 10))}%`,
            top: 0, bottom: 0, width: 1,
            background: '#f1f5f9', zIndex: 0,
          }} />
        ))}
        {grayBar}
        {colorBar}
        {!grayBar && !colorBar && (
          <div style={{
            position: 'absolute', left: 0, right: 0,
            top: '50%', transform: 'translateY(-50%)',
            height: 3, borderRadius: 99, border: '1px dashed #e2e8f0',
          }} />
        )}
      </div>

      {/* % done */}
      <div style={{ textAlign: 'right', paddingLeft: 8 }}>
        {pct !== null ? (
          <span style={{
            fontSize: 11, fontWeight: 700,
            padding: '3px 8px', borderRadius: 99,
            background: vsRed ? '#fee2e2' : pct >= 80 ? '#dcfce7' : '#fef9c3',
            color:      vsRed ? '#991b1b' : pct >= 80 ? '#166534' : '#854d0e',
          }}>
            {isDelayed ? 'delayed' : `${pct}%`}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
        )}
      </div>
    </div>
  );
};

const GanttChart = ({ ganttData, distDates, season, year, stdDays, ganttAlert, timelineMonths }) => {
  const [tab, setTab] = useState('OWN_SEED');
  const seedCfg  = SEED_CFG[tab];
  const phases   = SEED_PHASES[tab] || [];
  const tabData  = ganttData?.[tab] || {};

  // Use backend-provided timeline months, fallback to computed
  const monthCols = useMemo(() => {
    if (timelineMonths?.length) return buildMonthCols(timelineMonths);
    // fallback
    const yr = parseInt(year);
    const slots = season === 'WET'
      ? [{month:6,label:'Jun',year:yr},{month:7,label:'Jul',year:yr},{month:8,label:'Aug',year:yr},{month:9,label:'Sep',year:yr},{month:10,label:'Oct',year:yr}]
      : [{month:11,label:'Nov',year:yr},{month:12,label:'Dec',year:yr},{month:1,label:'Jan',year:yr+1},{month:2,label:'Feb',year:yr+1},{month:3,label:'Mar',year:yr+1},{month:4,label:'Apr',year:yr+1}];
    return buildMonthCols(slots);
  }, [timelineMonths, season, year]);

  const totalFarmers = Object.values(tabData).reduce((s, e) => s + (e?.farmers || 0), 0);
  const activePhases = Object.keys(tabData).length;

  const distEntry = distDates?.[tab]
    ? {
        completion_pct: 100,
        mode_date:      distDates[tab].date,
        mode_count:     distDates[tab].count,
        farmers:        distDates[tab].total,
        total_farmers:  distDates[tab].total,
        all_delayed:    false,
        valid_farmers:  distDates[tab].total,
        delayed_farmers: 0,
        std_start:      tabData['DISTRIBUTION']?.std_start || null,
        std_end:        tabData['DISTRIBUTION']?.std_end   || null,
        std_days:       tabData['DISTRIBUTION']?.std_days  || null,
      }
    : null;

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>

      {/* Header + tabs */}
      <div style={{ padding: '14px 18px 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          Phase timeline by seed type
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingBottom: 12 }}>
          {Object.entries(SEED_CFG).map(([key, cfg]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '6px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${tab === key ? cfg.color : '#e2e8f0'}`,
              background: tab === key ? cfg.light : 'white',
              color:      tab === key ? cfg.color : '#64748b',
              cursor: 'pointer', transition: 'all .15s',
            }}>
              {cfg.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, paddingBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            <strong style={{ color: '#0f172a', marginRight: 3 }}>{totalFarmers}</strong>encodings
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            <strong style={{ color: '#0f172a', marginRight: 3 }}>{activePhases}/{phases.length}</strong>phases active
          </span>
        </div>
      </div>

      {/* Month header + rows */}
      <div style={{ padding: '10px 18px 0', overflowX: 'auto' }}>
        {/* Month columns header */}
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 64px', marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Phase
          </div>
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', paddingBottom: 5 }}>
            {monthCols.map((col, i) => (
              <div key={col.key} style={{
                flex: `0 0 ${100 / monthCols.length}%`,
                fontSize: 11, fontWeight: 700, color: '#475569',
                textAlign: 'center',
                borderLeft: i === 0 ? 'none' : '1px solid #f1f5f9',
              }}>
                {col.label}
                <span style={{ display: 'block', fontSize: 9, color: '#94a3b8', fontWeight: 400 }}>{col.year}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textAlign: 'right', paddingLeft: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            % done
          </div>
        </div>

        {/* Phase rows */}
        {phases.map(ph => (
          <GanttRow
            key={ph}
            phase={ph}
            entry={tabData[ph] || null}
            distEntry={distEntry}
            monthCols={monthCols}
          />
        ))}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, paddingBottom: 4, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { el: <span style={{ width: 18, height: 5, borderRadius: 99, background: '#e2e8f0', border: '1px solid #cbd5e1', display: 'inline-block' }} />, lbl: 'Standard window' },
            { el: <span style={{ width: 18, height: 5, borderRadius: 99, background: seedCfg.color, opacity: .8, display: 'inline-block' }} />, lbl: 'On-time farmers %' },
            { el: <span style={{ width: 18, height: 5, borderRadius: 99, background: '#ef4444', display: 'inline-block' }} />, lbl: 'All dates delayed' },
            { el: <span style={{ width: 18, height: 5, borderRadius: 99, border: '1px dashed #cbd5e1', display: 'inline-block' }} />, lbl: 'No data yet' },
          ].map((x, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#64748b' }}>
              {x.el} {x.lbl}
            </span>
          ))}
          {tab === 'OWN_SEED' && (
            <span style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
              Own Seed starts at Crop Establishment
            </span>
          )}
        </div>
      </div>

      {/* Alert strip */}
      <div style={{ padding: '10px 18px 14px' }}>
        {ganttAlert?.delayed > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 14px' }}>
            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
            <span>
              <strong>{ganttAlert.pct}%</strong> of farmers in <strong>{ganttAlert.label}</strong> are delayed ({ganttAlert.delayed} of {ganttAlert.total})
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 14px' }}>
            <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
            Majority of farmers are within standard crop timelines.
          </div>
        )}
      </div>
    </div>
  );
};

export default GanttChart;