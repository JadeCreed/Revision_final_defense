// src/pages/admin/AdminDashboard.jsx
import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import {
  getProductionSummary,
  getProductionBySeedType,
  getProductionByBarangay,
  getProductionLowPerformers,
  getCropPhaseAnalytics,
  getAdminPendingBatches,
} from "../../api/axios";
import { useNavigate } from "react-router-dom";

// ── constants ──────────────────────────────────────────────────────────────
const TIER_COLORS = {
  "Exceeded Target": "#16a34a",
  "Achieved Target": "#22c55e",
  "Near Target":     "#3b82f6",
  "Below Target":    "#f59e0b",
  "Critical":        "#ef4444",
  "N/A":             "#475569",
};
const SEED_COLORS = {
  HYBRID:   "#3b82f6",
  INBRED:   "#22c55e",
  OWN_SEED: "#f97316",
};
const PHASE_ORDER = [
  "DISTRIBUTION","ESTABLISHMENT","TILLERING",
  "FLOWERING","RIPENING","HARVESTING",
];
const PHASE_LABELS = {
  DISTRIBUTION:"Distribution", ESTABLISHMENT:"Establishment",
  TILLERING:"Tillering",       FLOWERING:"Flowering",
  RIPENING:"Ripening",         HARVESTING:"Harvesting",
};
const PHASE_COLORS = {
  DISTRIBUTION:"#475569", ESTABLISHMENT:"#3b82f6",
  TILLERING:"#06b6d4",    FLOWERING:"#8b5cf6",
  RIPENING:"#f59e0b",     HARVESTING:"#ef4444",
};

// ── helpers ────────────────────────────────────────────────────────────────
const Card = ({ title, icon, children, className = "" }) => (
  <div className={`bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 ${className}`}>
    {title && (
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{title}</span>
      </div>
    )}
    {children}
  </div>
);

const Skeleton = ({ h = "h-4", w = "w-full", rounded = "rounded" }) => (
  <div className={`${h} ${w} ${rounded} bg-slate-800 animate-pulse`} />
);

const StatBadge = ({ label, color }) => {
  const map = {
    green:  "bg-emerald-900/60 text-emerald-400 border border-emerald-700/40",
    blue:   "bg-blue-900/60 text-blue-400 border border-blue-700/40",
    yellow: "bg-yellow-900/60 text-yellow-400 border border-yellow-700/40",
    orange: "bg-orange-900/60 text-orange-400 border border-orange-700/40",
    red:    "bg-red-900/60 text-red-400 border border-red-700/40",
    slate:  "bg-slate-800 text-slate-400 border border-slate-700",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[color] || map.slate}`}>
      {label}
    </span>
  );
};

// ── custom tooltip ─────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, suffix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {p.value}{suffix}
        </p>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const navigate = useNavigate();

  const [loading,  setLoading]  = useState(true);
  const [summary,  setSummary]  = useState(null);
  const [bySeed,   setBySeed]   = useState([]);
  const [byBrgy,   setByBrgy]   = useState([]);
  const [lowPerf,  setLowPerf]  = useState([]);
  const [phase,    setPhase]    = useState(null);
  const [pending,  setPending]  = useState(0);
  const [poll,     setPoll]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getProductionSummary(),
        getProductionBySeedType(),
        getProductionByBarangay(),
        getProductionLowPerformers(50),
        getCropPhaseAnalytics(),
        getAdminPendingBatches(),
      ]);

      if (results[0].status === "fulfilled") setSummary(results[0].value.data);
      if (results[1].status === "fulfilled") setBySeed(results[1].value.data);
      if (results[2].status === "fulfilled") setByBrgy(results[2].value.data);
      if (results[3].status === "fulfilled") setLowPerf(results[3].value.data);
      if (results[4].status === "fulfilled") {
        setPhase(results[4].value.data);
        setPoll(results[4].value.data?.poll);
      }
      if (results[5].status === "fulfilled") {
        const d = results[5].value.data;
        const cnt = Array.isArray(d)
          ? d.reduce((a, b) => a + (b.pending_batches || 0), 0)
          : (d?.total_pending || 0);
        setPending(cnt);
      }
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── derived data ─────────────────────────────────────────────────────────
  const kpi        = summary   || {};
  const phaseKpi   = phase?.kpi || {};
  const phaseDist  = phase?.phase_distribution || [];
  const totalF     = phaseKpi.total_farmers || kpi.total_farmers || 0;
  const distDates  = phase?.dist_dates || {};
  const distTotal  = Object.values(distDates).reduce((s, v) => s + (v?.total || 0), 0);
  const harvestPh  = phaseDist.find(p => p.phase === "HARVESTING")?.farmers || 0;
  const critCount  = lowPerf.length;
  const topDamage  = (phase?.cause_of_damage || []).slice(0, 2);

  const tierSubColor = (tier) => {
    if (!tier) return "text-slate-500";
    if (tier.includes("Exceeded") || tier.includes("Achieved")) return "text-emerald-400";
    if (tier === "Near Target")  return "text-blue-400";
    if (tier === "Below Target") return "text-amber-400";
    return "text-red-400";
  };

  // charts
  const brgyChart = [...byBrgy]
    .filter(b => b.avg_utilization_pct !== null)
    .sort((a, b) => (b.avg_utilization_pct || 0) - (a.avg_utilization_pct || 0))
    .slice(0, 10)
    .map(b => ({
      name:  b.barangay,
      value: b.avg_utilization_pct,
      fill:  TIER_COLORS[b.tier] || "#475569",
    }));

  const yieldChart = bySeed.map(s => ({
    name:   s.label,
    actual: s.avg_yield_t_ha,
    target: s.seed_source === "HYBRID" ? 5 : s.seed_source === "INBRED" ? 4 : 3,
    fill:   SEED_COLORS[s.seed_source] || "#64748b",
  }));

  const seedDonut = bySeed
    .filter(s => s.farmer_count > 0)
    .map(s => ({
      name:  s.label,
      value: s.farmer_count,
      fill:  SEED_COLORS[s.seed_source],
    }));

  const funnelData = PHASE_ORDER.map(ph => ({
    phase: ph,
    label: PHASE_LABELS[ph],
    value: phaseDist.find(p => p.phase === ph)?.farmers || 0,
    fill:  PHASE_COLORS[ph],
  }));

  const maxFunnel = Math.max(...funnelData.map(f => f.value), 1);

  // pipeline rows
  const pipelineRows = [
    {
      label:  "Beneficiaries encoded",
      value:  phase?.compliance?.met ?? 0,
      total:  phase?.compliance?.total ?? totalF,
      badge:  "Active",
      color:  "green",
    },
    {
      label:  "Seed distribution",
      value:  distTotal,
      total:  totalF,
      badge:  "Ongoing",
      color:  "blue",
    },
    {
      label:  "AT crop monitoring",
      value:  phaseKpi.total_farmers || 0,
      total:  totalF,
      badge:  "In progress",
      color:  "yellow",
    },
    {
      label:  "Harvest encoded",
      value:  harvestPh,
      total:  totalF,
      badge:  harvestPh > 0 ? "Partial" : "Pending",
      color:  harvestPh > 0 ? "orange" : "slate",
    },
    {
      label:  "Pending batch approvals",
      value:  pending,
      total:  null,
      badge:  pending > 0 ? "Action needed" : "Clear",
      color:  pending > 0 ? "red" : "slate",
      isCount: true,
    },
  ];

  const barColors = {
    green: "bg-emerald-500", blue: "bg-blue-500",
    yellow: "bg-yellow-500", orange: "bg-orange-500",
    red: "bg-red-500", slate: "bg-slate-600",
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080f1a] text-white">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">

        {/* ── Season Banner ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r
                        from-slate-800 via-slate-800 to-slate-700
                        border border-slate-700 px-6 py-4">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/10 to-transparent pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1">
                Active Season
              </p>
              <p className="text-xl sm:text-2xl font-black text-white">
                {poll
                  ? `${poll.season === "WET" ? "Wet" : "Dry"} Season ${poll.year} · Lucban, Quezon`
                  : "No active season"}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {poll?.status === "OPEN" && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Poll finalized
                </span>
              )}
              <button
                onClick={() => navigate("/admin/seed-poll")}
                className="text-xs bg-white text-slate-900 font-bold px-4 py-2 rounded-xl
                           hover:bg-slate-100 active:scale-95 transition-all"
              >
                View poll ↗
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI Tiles ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            {
              icon: "👥", label: "Total farmers",
              value: totalF,
              sub: "12 barangays",
              subColor: "text-slate-500",
            },
            {
              icon: "🗺️", label: "Area covered",
              value: kpi.total_area_ha != null ? `${kpi.total_area_ha} ha` : "—",
              sub: kpi.avg_yield_t_ha != null ? `Avg ${kpi.avg_yield_t_ha} t/ha` : "",
              subColor: "text-slate-500",
            },
            {
              icon: "📦", label: "Total production",
              value: kpi.total_production_mt != null ? `${kpi.total_production_mt} MT` : "—",
              sub: "",
              subColor: "",
            },
            {
              icon: "📈", label: "Avg utilization",
              value: kpi.overall_utilization_pct != null ? `${kpi.overall_utilization_pct}%` : "—",
              sub: kpi.overall_tier || "",
              subColor: tierSubColor(kpi.overall_tier),
            },
          ].map((k, i) => (
            <Card key={i} className="!gap-2 !py-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">{k.icon}</span>
                <span className="text-[11px] text-slate-400 font-medium">{k.label}</span>
              </div>
              {loading
                ? <Skeleton h="h-9" w="w-3/4" rounded="rounded-lg" />
                : <p className="text-3xl font-black text-white tracking-tight leading-none">{k.value}</p>
              }
              {k.sub && (
                <p className={`text-xs font-medium ${k.subColor}`}>{k.sub}</p>
              )}
            </Card>
          ))}
        </div>

        {/* ── Row 2: Barangay bar + Seed donut ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

          {/* Utilization by barangay — wider */}
          <Card title="Utilization by barangay" icon="📊" className="lg:col-span-3">
            <div className="flex flex-wrap gap-3 -mt-1">
              {[
                { label:"Exceeded/Achieved", color:"#16a34a" },
                { label:"Near target",       color:"#3b82f6" },
                { label:"Below target",      color:"#f59e0b" },
                { label:"Critical",          color:"#ef4444" },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>

            {loading ? (
              <div className="space-y-2.5 mt-1">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} h="h-5" />)}
              </div>
            ) : brgyChart.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-600 text-sm">
                No barangay data for this season
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={brgyChart}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 4, bottom: 0 }}
                  barSize={12}
                >
                  <XAxis
                    type="number"
                    domain={[0, 110]}
                    tickFormatter={v => `${v}%`}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={{ stroke: "#1e293b" }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={72}
                    tick={{ fill: "#cbd5e1", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltip suffix="%" />}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {brgyChart.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Farmers by seed type */}
          <Card title="Farmers by seed type" icon="🌾" className="lg:col-span-2">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Skeleton h="h-36" w="w-36" rounded="rounded-full" />
                <Skeleton h="h-3" w="w-2/3" />
              </div>
            ) : seedDonut.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-600 text-sm">
                No distribution data yet
              </div>
            ) : (
              <>
                <div className="flex flex-wrap justify-center gap-3">
                  {seedDonut.map(s => (
                    <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.fill }} />
                      {s.name} <span className="font-bold text-white">{s.value}</span>
                    </span>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={seedDonut}
                      cx="50%" cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {seedDonut.map((s, i) => <Cell key={i} fill={s.fill} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-center text-slate-600 text-xs -mt-2">
                  {totalF} total farmers
                </p>
              </>
            )}
          </Card>
        </div>

        {/* ── Row 3: Yield chart + Phase funnel ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          <Card title="Yield by seed type (t/ha)" icon="📈">
            <div className="flex gap-4 flex-wrap -mt-1">
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Actual yield
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-3 h-3 rounded-sm bg-slate-600 inline-block" /> Target yield
              </span>
            </div>
            {loading ? <Skeleton h="h-44" rounded="rounded-xl" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={yieldChart} margin={{ top: 4, right: 8, bottom: 4, left: -10 }} barGap={4}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v}t`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
                          <p className="text-slate-400 mb-1">{label}</p>
                          {payload.map((p, i) => (
                            <p key={i} style={{ color: p.color }} className="font-semibold">
                              {p.name === "actual" ? "Actual" : "Target"}: {p.value} t/ha
                            </p>
                          ))}
                        </div>
                      );
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  />
                  <Bar dataKey="actual" radius={[6,6,0,0]} maxBarSize={36}>
                    {yieldChart.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                  <Bar dataKey="target" fill="#334155" radius={[6,6,0,0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Crop phase funnel" icon="➕">
            <span className="flex items-center gap-1.5 text-xs text-slate-400 -mt-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
              Farmers in phase
            </span>
            {loading ? (
              <div className="space-y-2.5">
                {Array(6).fill(0).map((_, i) => <Skeleton key={i} h="h-6" rounded="rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {funnelData.map(p => (
                  <div key={p.phase} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-24 shrink-0">{p.label}</span>
                    <div className="flex-1 bg-slate-800/80 rounded-lg h-6 relative overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-700"
                        style={{
                          width: `${Math.min(100, (p.value / maxFunnel) * 100)}%`,
                          background: p.fill,
                          opacity: 0.85,
                        }}
                      />
                      {p.value > 0 && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2
                                         text-[11px] text-white font-bold">
                          {p.value}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Row 4: Pipeline + Alerts ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          <Card title="Data pipeline status" icon="🔄">
            {loading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} h="h-5" rounded="rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {pipelineRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-300 w-44 shrink-0 leading-tight">
                      {row.label}
                    </span>

                    {row.isCount ? (
                      <span className={`text-lg font-black ${row.value > 0 ? "text-red-400" : "text-slate-400"}`}>
                        {row.value}
                      </span>
                    ) : (
                      <>
                        <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-700 ${barColors[row.color]}`}
                            style={{
                              width: row.total > 0
                                ? `${Math.min(100, (row.value / row.total) * 100)}%`
                                : "0%",
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-12 text-right shrink-0 tabular-nums">
                          {row.value}/{row.total}
                        </span>
                      </>
                    )}

                    <StatBadge label={row.badge} color={row.color} />
                  </div>
                ))}

                <button
                  onClick={() => navigate("/admin/beneficiaries")}
                  className="mt-1 w-full text-xs text-slate-400 border border-slate-700 rounded-xl
                             py-2.5 hover:bg-slate-800 hover:text-white active:scale-[0.99]
                             transition-all font-medium"
                >
                  Review batches ↗
                </button>
              </div>
            )}
          </Card>

          <Card title="Alerts & attention" icon="🔔">
            {loading ? (
              <div className="space-y-3">
                {Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-8" rounded="rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Critical tier */}
                {critCount > 0 && (
                  <div className="flex items-start gap-3 bg-red-950/30 border border-red-900/40
                                  rounded-xl px-3 py-2.5">
                    <span className="text-base mt-0.5">⚠️</span>
                    <p className="text-sm text-slate-200 leading-snug">
                      <span className="font-bold text-red-400">{critCount} farmers</span>
                      {" "}at Critical tier — below 50% yield utilization
                    </p>
                  </div>
                )}

                {/* Delayed */}
                {phaseKpi.delayed_farmers > 0 && (
                  <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-900/40
                                  rounded-xl px-3 py-2.5">
                    <span className="text-base mt-0.5">🕐</span>
                    <p className="text-sm text-slate-200 leading-snug">
                      <span className="font-bold text-amber-400">{phaseKpi.delayed_farmers} farmers</span>
                      {" "}have delayed crop phases in AT monitoring
                    </p>
                  </div>
                )}

                {/* Damaged */}
                {phaseKpi.damaged_farmers > 0 && (
                  <div className="flex items-start gap-3 bg-red-950/20 border border-red-900/30
                                  rounded-xl px-3 py-2.5">
                    <span className="text-base mt-0.5">🚫</span>
                    <p className="text-sm text-slate-200 leading-snug">
                      <span className="font-bold text-red-400">{phaseKpi.damaged_farmers} farmers</span>
                      {" "}with damaged crop records
                      {topDamage.length > 0 && (
                        <> — {topDamage.map(d => `${d.cause.toLowerCase()} (${d.count})`).join(", ")}</>
                      )}
                    </p>
                  </div>
                )}

                {/* Pending batches */}
                {pending > 0 && (
                  <div className="flex items-start gap-3 bg-blue-950/30 border border-blue-900/40
                                  rounded-xl px-3 py-2.5">
                    <span className="text-base mt-0.5">📋</span>
                    <p className="text-sm text-slate-200 leading-snug">
                      <span className="font-bold text-blue-400">{pending} batches</span>
                      {" "}pending approval in beneficiaries & distribution
                    </p>
                  </div>
                )}

                {/* Harvest ready */}
                {harvestPh > 0 && (
                  <div className="flex items-start gap-3 bg-emerald-950/30 border border-emerald-900/40
                                  rounded-xl px-3 py-2.5">
                    <span className="text-base mt-0.5">🌾</span>
                    <p className="text-sm text-slate-200 leading-snug">
                      <span className="font-bold text-emerald-400">{harvestPh} farmers</span>
                      {" "}reaching harvesting phase — harvest encoding ready
                    </p>
                  </div>
                )}

                {/* No alerts */}
                {critCount === 0 && !phaseKpi.delayed_farmers && !phaseKpi.damaged_farmers
                  && pending === 0 && (
                  <div className="flex items-center justify-center gap-2 py-8 text-slate-600">
                    <span className="text-xl">✅</span>
                    <span className="text-sm font-medium">No active alerts</span>
                  </div>
                )}

                <button
                  onClick={() => navigate("/admin/production")}
                  className="mt-1 w-full text-xs text-slate-400 border border-slate-700 rounded-xl
                             py-2.5 hover:bg-slate-800 hover:text-white active:scale-[0.99]
                             transition-all font-medium"
                >
                  View low performers ↗
                </button>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}