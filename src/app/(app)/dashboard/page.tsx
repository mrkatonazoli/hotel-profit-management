"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Bed, DollarSign, BarChart3,
  Loader2, ChevronDown, ArrowRight, Star,
  Building2, AlertTriangle, TrendingDown,
  CalendarDays, Wallet, PiggyBank,
  Settings, Receipt, ChevronRight, Users,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioRef = { id: string; name: string; year: number; probability: number; isBase: boolean };

type SegmentSummary = {
  id: string; name: string; color: string;
  avgShare: number; effectiveCommPct: number;
};

type MonthRow = {
  month: number; dayCount: number;
  roomNights: number; roomRevenue: number;
  fbRevenue: number; spaRevenue: number; otherRevenue: number;
  totalRevenue: number; totalCosts: number; commissionCost: number;
  profit: number; profitPct: number;
  avgOcc: number; avgAdr: number; revpar: number;
};

type DashData = {
  hotel: { name: string; totalRooms: number | null; currency: string };
  scenario: ScenarioRef;
  scenarios: ScenarioRef[];
  hasData: boolean;
  kpis: {
    totalRoomRevenue: number; totalFbRevenue: number;
    totalSpaRevenue: number; totalOtherRevenue: number;
    totalRevenue: number; totalCosts: number; totalProfit: number; profitPct: number;
    totalRoomNights: number; avgOccPct: number; avgAdr: number; revpar: number;
    totalCommissionCost: number;
  };
  months: MonthRow[];
  currentMonth: number;
  currentMonthData: MonthRow | null;
  segments: SegmentSummary[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HU_MONTHS_SHORT = ["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Sze","Okt","Nov","Dec"];
const HU_MONTHS = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];

function fmt(n: number) { return n.toLocaleString("hu-HU"); }
function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString("hu-HU", { maximumFractionDigits: 0 })} E`;
  return fmt(n);
}

function occColor(occ: number) {
  if (occ >= 85) return "#10B981";
  if (occ >= 65) return "#7C3AED";
  if (occ >= 45) return "#F59E0B";
  return "#EF4444";
}
function profitColor(p: number) {
  if (p > 0) return "#10B981";
  if (p === 0) return "#94A3B8";
  return "#EF4444";
}
function probColor(p: number) {
  if (p >= 70) return { bg: "#D1FAE5", text: "#059669" };
  if (p >= 40) return { bg: "#FEF3C7", text: "#D97706" };
  return { bg: "#FEE2E2", text: "#DC2626" };
}
function probLabel(p: number) {
  if (p >= 70) return "Optimista";
  if (p >= 40) return "Reális";
  return "Pesszimista";
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

function MonthlyBarChart({ months, metric, currentMonth }: {
  months: MonthRow[];
  metric: "roomRevenue" | "avgOcc" | "totalRevenue" | "revpar" | "profit";
  currentMonth: number;
}) {
  const W = 600; const H = 180; const PAD = { t: 10, r: 8, b: 28, l: 48 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const barW = Math.floor(chartW / 12) - 3;
  const values = months.map(m => m[metric]);
  const max = Math.max(...values.map(Math.abs), 1);
  const min = Math.min(...values, 0);
  const hasNeg = min < 0;

  const fmtY = (v: number) =>
    metric === "avgOcc" ? `${v}%` : fmtM(v);

  const zeroY = hasNeg
    ? PAD.t + chartH * (max / (max - min))
    : PAD.t + chartH;

  const ticks = hasNeg
    ? [-1, -0.5, 0, 0.5, 1].map(f => ({ y: f, v: f < 0 ? min * (-f) : max * f }))
    : [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: f, v: max * f }));

  function barTop(v: number) {
    if (hasNeg) {
      const pct = v / (max - min);
      return v >= 0
        ? zeroY - pct * chartH
        : zeroY;
    }
    return PAD.t + chartH - Math.max((v / max) * chartH, 0);
  }
  function barHeight(v: number) {
    if (hasNeg) {
      const range = max - min;
      return Math.max(Math.abs(v) / range * chartH, v !== 0 ? 2 : 0);
    }
    return v > 0 ? Math.max((v / max) * chartH, 2) : 0;
  }
  function barColor(m: MonthRow, v: number) {
    if (metric === "avgOcc") return occColor(v);
    if (metric === "profit") return v >= 0 ? "#10B981" : "#EF4444";
    return m.month === currentMonth ? "#7C3AED" : "#A78BFA";
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Grid + Y labels */}
      {ticks.map(t => {
        const cy = hasNeg
          ? PAD.t + chartH * (1 - (t.y - (-1)) / 2)
          : PAD.t + chartH * (1 - t.y);
        return (
          <g key={t.y}>
            <line x1={PAD.l} y1={cy} x2={PAD.l + chartW} y2={cy}
              stroke={t.v === 0 ? "#CBD5E1" : "#F1F5F9"} strokeWidth={t.v === 0 ? 1.5 : 1} />
            <text x={PAD.l - 4} y={cy + 4} textAnchor="end" fontSize={9} fill="#94A3B8">
              {fmtY(Math.round(t.v))}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {months.map((m, i) => {
        const v = m[metric];
        const bH = barHeight(v);
        const bT = barTop(v);
        const x = PAD.l + i * (chartW / 12) + (chartW / 12 - barW) / 2;
        const color = barColor(m, v);
        const isCurrent = m.month === currentMonth;
        return (
          <g key={i}>
            {/* Current month highlight */}
            {isCurrent && m.dayCount > 0 && (
              <rect x={x - 2} y={PAD.t} width={barW + 4} height={chartH}
                fill="#7C3AED" opacity={0.06} rx={3} />
            )}
            <rect x={x} y={bT} width={barW} height={bH}
              fill={m.dayCount > 0 ? color : "#F1F5F9"}
              rx={3} opacity={m.dayCount > 0 ? 1 : 0.4} />
            {Math.abs(v) > 0 && bH > 16 && (
              <text x={x + barW / 2} y={bT + 10} textAnchor="middle" fontSize={7.5} fill="white" fontWeight={600}>
                {metric === "avgOcc" ? `${v}%` : fmtM(v)}
              </text>
            )}
            <text x={x + barW / 2} y={PAD.t + chartH + 14}
              textAnchor="middle" fontSize={9}
              fill={isCurrent ? "#7C3AED" : "#94A3B8"}
              fontWeight={isCurrent ? 700 : 400}>
              {HU_MONTHS_SHORT[m.month - 1]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Revenue Planner", icon: CalendarDays, path: (sid: string) => `/revenue-planner/${sid}`, color: "#7C3AED", bg: "#EDE9FE" },
  { label: "Elemzés",          icon: BarChart3,   path: () => "/analysis",     color: "#3B82F6", bg: "#DBEAFE" },
  { label: "Kiadások",         icon: Receipt,     path: () => "/costs",        color: "#F59E0B", bg: "#FEF3C7" },
  { label: "Szcenáriók",       icon: TrendingUp,  path: () => "/scenarios",    color: "#10B981", bg: "#D1FAE5" },
  { label: "Szegmensek",       icon: Users,       path: (sid: string) => `/segments/${sid}`, color: "#EC4899", bg: "#FCE7F3" },
  { label: "Beállítások",      icon: Settings,    path: () => "/hotel-config", color: "#64748B", bg: "#F1F5F9" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<"roomRevenue" | "avgOcc" | "totalRevenue" | "revpar" | "profit">("totalRevenue");
  const [recalcLoading, setRecalcLoading] = useState(false);

  async function load(scenarioId?: string) {
    setLoading(true);
    const url = scenarioId ? `/api/dashboard?scenarioId=${scenarioId}` : "/api/dashboard";
    try {
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function recalcCommission() {
    if (!data) return;
    setRecalcLoading(true);
    try {
      await fetch(`/api/scenarios/${data.scenario.id}/recalc-commission`, { method: "POST" });
      await load(data.scenario.id);
    } finally {
      setRecalcLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Building2 size={32} style={{ color: "#CBD5E1" }} />
      <p style={{ color: "#94A3B8" }}>Nincs beállított hotel.</p>
    </div>
  );

  const { hotel, scenario, scenarios, hasData, kpis, months, currentMonth, currentMonthData, segments = [] } = data;
  const pc = probColor(scenario.probability);
  const filledMonths = months.filter(m => m.dayCount > 0);
  const peakMonth   = filledMonths.length > 0 ? filledMonths.reduce((a, b) => b.avgOcc > a.avgOcc ? b : a) : null;
  const troughMonth = filledMonths.length > 0 ? filledMonths.reduce((a, b) => b.avgOcc < a.avgOcc ? b : a) : null;
  const cur = currentMonthData;

  const metricOptions: { key: typeof chartMetric; label: string }[] = [
    { key: "totalRevenue", label: "Teljes bevétel" },
    { key: "profit",       label: "Profit" },
    { key: "roomRevenue",  label: "Szobabevétel" },
    { key: "avgOcc",       label: "Kihasználtság %" },
    { key: "revpar",       label: "RevPAR" },
  ];

  const ccy = hotel.currency ?? "Ft";

  return (
    <div className="space-y-4 md:space-y-5" style={{ maxWidth: 1140 }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: "#0F172A" }}>Dashboard</h1>
          <p className="text-xs md:text-sm mt-0.5" style={{ color: "#64748B" }}>
            {hotel.name} · {scenario.year} · {hotel.totalRooms ? `${hotel.totalRooms} szoba` : "szobaszám nincs megadva"}
          </p>
        </div>

        {/* Scenario switcher */}
        <div className="relative">
          <button onClick={() => setScenarioOpen(o => !o)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#0F172A", color: "#F8FAFC" }}>
            {scenario.isBase && <Star size={13} style={{ color: "#F59E0B" }} />}
            <span>{scenario.name}</span>
            <span className="px-1.5 py-0.5 rounded text-xs font-bold"
              style={{ background: pc.bg, color: pc.text }}>
              {scenario.probability}%
            </span>
            <ChevronDown size={14} style={{ opacity: 0.6 }} />
          </button>

          {scenarioOpen && (
            <div className="absolute right-0 mt-1.5 w-72 rounded-2xl shadow-xl z-30 overflow-hidden"
              style={{ background: "white", border: "1px solid #E2E8F0" }}>
              <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                style={{ background: "#F8FAFC", color: "#94A3B8", borderBottom: "1px solid #F1F5F9" }}>
                Forgatókönyv választása
              </div>
              {scenarios.map(s => {
                const sp = probColor(s.probability);
                const active = s.id === scenario.id;
                return (
                  <button key={s.id}
                    onClick={() => { setScenarioOpen(false); load(s.id); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{ background: active ? "#F5F3FF" : "white", borderBottom: "1px solid #F8FAFC" }}>
                    {s.isBase && <Star size={13} style={{ color: "#F59E0B", flexShrink: 0 }} />}
                    {!s.isBase && <div style={{ width: 13 }} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#0F172A" }}>{s.name}</p>
                      <p className="text-xs" style={{ color: "#64748B" }}>{s.year}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: sp.bg, color: sp.text }}>
                      {probLabel(s.probability)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 md:gap-3">
        {QUICK_ACTIONS.map(a => {
          const Icon = a.icon;
          const href = a.path(scenario.id);
          return (
            <button key={a.label} onClick={() => router.push(href)}
              className="flex flex-col items-center gap-2 rounded-2xl py-4 px-2 transition-all group"
              style={{ background: "white", border: "1px solid #E2E8F0" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = a.color + "60"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: a.bg }}>
                <Icon size={18} style={{ color: a.color }} />
              </div>
              <span className="text-xs font-semibold text-center leading-tight" style={{ color: "#334155" }}>
                {a.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── No data warning ── */}
      {!hasData && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <AlertTriangle size={18} style={{ color: "#D97706", flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#92400E" }}>
              Még nincs generált napi terv ehhez a szcenárióhoz
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#B45309" }}>
              Menj a Forgatókönyvek oldalra, és kattints a Generálás gombra.
            </p>
          </div>
          <button onClick={() => router.push("/scenarios")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
            style={{ background: "#F59E0B", color: "white" }}>
            Generálás <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* ── Komisszió újraszámítás banner ── */}
      {hasData && segments.length > 0 && (kpis.totalCommissionCost ?? 0) === 0 && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <Receipt size={18} style={{ color: "#D97706", flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#92400E" }}>
              A jutalékszámítás nincs naprakész
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#B45309" }}>
              A szegmensek a generálás után lettek beállítva — kattints a frissítésre.
            </p>
          </div>
          <button
            onClick={recalcCommission}
            disabled={recalcLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
            style={{ background: "#D97706", color: "white", opacity: recalcLoading ? 0.6 : 1 }}>
            {recalcLoading
              ? <><Loader2 size={12} className="animate-spin" /> Számítás…</>
              : <>Komisszió frissítése <ArrowRight size={12} /></>}
          </button>
        </div>
      )}

      {/* ── KPI Cards — 2 rows of 4 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="Teljes bevétel"
          value={`${fmtM(kpis.totalRevenue)} ${ccy}`}
          sub={`Szoba: ${fmtM(kpis.totalRoomRevenue)} · F&B: ${fmtM(kpis.totalFbRevenue)}`}
          icon={<DollarSign size={17} />} color="#3B82F6"
        />
        <KpiCard
          label="Éves profit (GOP)"
          value={`${fmtM(kpis.totalProfit)} ${ccy}`}
          sub={`${kpis.profitPct > 0 ? "+" : ""}${kpis.profitPct}% margin`}
          icon={kpis.totalProfit >= 0 ? <PiggyBank size={17} /> : <TrendingDown size={17} />}
          color={profitColor(kpis.totalProfit)}
          highlight={kpis.totalProfit > 0}
        />
        <KpiCard
          label="Átl. kihasználtság"
          value={`${kpis.avgOccPct}%`}
          sub={peakMonth ? `Csúcs: ${HU_MONTHS_SHORT[peakMonth.month - 1]} ${peakMonth.avgOcc}%` : undefined}
          icon={<Bed size={17} />} color={occColor(kpis.avgOccPct)}
        />
        <KpiCard
          label="Tervezett komisszió"
          value={`${fmtM(kpis.totalCommissionCost ?? 0)} ${ccy}`}
          sub={kpis.totalRevenue > 0 && (kpis.totalCommissionCost ?? 0) > 0
            ? `${Math.round((kpis.totalCommissionCost ?? 0) / kpis.totalRevenue * 1000) / 10}% a bevételből`
            : segments.length === 0 ? "Nincs szegmens beállítva" : "Nincs jutalék"}
          icon={<Receipt size={17} />} color="#F59E0B"
        />
        <KpiCard
          label="Szobabevétel"
          value={`${fmtM(kpis.totalRoomRevenue)} ${ccy}`}
          sub={kpis.totalRevenue > 0 ? `${Math.round(kpis.totalRoomRevenue / kpis.totalRevenue * 100)}% a teljes bevételből` : undefined}
          icon={<Wallet size={17} />} color="#7C3AED"
        />
        <KpiCard
          label="RevPAR"
          value={`${fmt(kpis.revpar)} ${ccy}`}
          sub={`ADR: ${fmt(kpis.avgAdr)} ${ccy}`}
          icon={<TrendingUp size={17} />} color="#10B981"
        />
        <KpiCard
          label="Szobaéjszakák"
          value={fmt(kpis.totalRoomNights)}
          sub={hotel.totalRooms ? `${hotel.totalRooms} elérhető szoba` : undefined}
          icon={<BarChart3 size={17} />} color="#F59E0B"
        />
        <KpiCard
          label="Kiadás összesen"
          value={`${fmtM(kpis.totalCosts)} ${ccy}`}
          sub={kpis.totalRevenue > 0 ? `${Math.round(kpis.totalCosts / kpis.totalRevenue * 100)}% cost ratio` : undefined}
          icon={<TrendingDown size={17} />} color="#EF4444"
        />
      </div>

      {/* ── Aktuális hónap spotlight ── */}
      {hasData && cur && cur.dayCount > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
          {/* Header strip */}
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ background: "#F5F3FF", borderBottom: "1px solid #EDE9FE" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "#7C3AED" }} />
              <span className="text-sm font-bold" style={{ color: "#5B21B6" }}>
                {HU_MONTHS[currentMonth - 1]} — aktuális hónap
              </span>
            </div>
            <button onClick={() => router.push(`/analysis`)}
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "#7C3AED", background: "none", border: "none", cursor: "pointer" }}>
              Részletes elemzés <ChevronRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0"
            style={{ borderColor: "#F1F5F9" }}>
            <SpotlightCell label="Kihasználtság" value={`${cur.avgOcc}%`} color={occColor(cur.avgOcc)} />
            <SpotlightCell label="Teljes bevétel" value={`${fmtM(cur.totalRevenue)} ${ccy}`} color="#3B82F6" />
            <SpotlightCell
              label="Profit"
              value={`${cur.profit >= 0 ? "+" : ""}${fmtM(cur.profit)} ${ccy}`}
              color={profitColor(cur.profit)}
              sub={`${cur.profitPct > 0 ? "+" : ""}${cur.profitPct}% margin`}
            />
            <SpotlightCell label="ADR" value={`${fmt(cur.avgAdr)} ${ccy}`} color="#7C3AED" />
          </div>
        </div>
      )}

      {/* ── Chart ── */}
      {hasData && (
        <div className="rounded-2xl p-4 md:p-5" style={{ background: "white", border: "1px solid #E2E8F0" }}>
          <div className="flex items-center justify-between mb-3 md:mb-4 flex-wrap gap-2">
            <h2 className="text-sm md:text-base font-semibold" style={{ color: "#0F172A" }}>Havi alakulás</h2>
            <div className="flex gap-1 md:gap-1.5 flex-wrap">
              {metricOptions.map(o => (
                <button key={o.key} onClick={() => setChartMetric(o.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: chartMetric === o.key ? "#7C3AED" : "#F1F5F9",
                    color: chartMetric === o.key ? "white" : "#64748B",
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <MonthlyBarChart months={months} metric={chartMetric} currentMonth={currentMonth} />

          {peakMonth && troughMonth && peakMonth.month !== troughMonth.month && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: "#D1FAE5", color: "#065F46" }}>
                <span className="font-bold">↑ Csúcs:</span>
                {HU_MONTHS[peakMonth.month - 1]} — {peakMonth.avgOcc}% kihas., {fmt(peakMonth.avgAdr)} {ccy} ADR
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: "#FEE2E2", color: "#991B1B" }}>
                <span className="font-bold">↓ Völgy:</span>
                {HU_MONTHS[troughMonth.month - 1]} — {troughMonth.avgOcc}% kihas., {fmt(troughMonth.avgAdr)} {ccy} ADR
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Monthly table ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Havi összesítő</h2>
          <button onClick={() => router.push(`/revenue-planner/${scenario.id}`)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
            style={{ background: "#EDE9FE", color: "#7C3AED" }}>
            Revenue Planner <ArrowRight size={12} />
          </button>
        </div>

        {!hasData ? (
          <p className="text-sm text-center py-10" style={{ color: "#94A3B8" }}>
            Nincs generált adat — futtasd a generálást a Forgatókönyvek oldalon.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 780 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["Hónap","Kihas.","Szobaéj","ADR","RevPAR","Bevétel","Komisszió","Kiadás","Profit"].map((h, i) => (
                    <th key={h} className={`py-2.5 text-xs font-semibold uppercase tracking-wide ${i === 0 ? "text-left px-5" : i <= 4 ? "text-center px-3" : "text-right px-3"} ${h === "Profit" ? "pr-5" : ""}`}
                      style={{ color: i === 6 ? "#D97706" : "#94A3B8" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map(m => {
                  const hasMonthData = m.dayCount > 0;
                  const isCurrent = m.month === currentMonth;
                  return (
                    <tr key={m.month}
                      style={{
                        borderBottom: "1px solid #F8FAFC",
                        opacity: hasMonthData ? 1 : 0.35,
                        background: isCurrent ? "#FAFAF9" : "white",
                      }}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          {isCurrent && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#7C3AED" }} />}
                          <span className="text-sm font-medium" style={{ color: "#0F172A" }}>
                            {HU_MONTHS[m.month - 1]}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {hasMonthData ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-1.5 rounded-full" style={{ width: 36, background: "#F1F5F9", overflow: "hidden" }}>
                              <div className="h-full rounded-full" style={{ width: `${m.avgOcc}%`, background: occColor(m.avgOcc) }} />
                            </div>
                            <span className="text-xs font-mono font-semibold" style={{ color: occColor(m.avgOcc) }}>
                              {m.avgOcc}%
                            </span>
                          </div>
                        ) : <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-sm" style={{ color: hasMonthData ? "#334155" : "#CBD5E1" }}>
                        {hasMonthData ? fmt(m.roomNights) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-sm" style={{ color: hasMonthData ? "#334155" : "#CBD5E1" }}>
                        {hasMonthData ? `${fmt(m.avgAdr)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-sm" style={{ color: hasMonthData ? "#334155" : "#CBD5E1" }}>
                        {hasMonthData ? `${fmt(m.revpar)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold" style={{ color: hasMonthData ? "#334155" : "#CBD5E1" }}>
                        {hasMonthData ? `${fmtM(m.totalRevenue)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm" style={{ color: hasMonthData && m.commissionCost > 0 ? "#D97706" : "#CBD5E1" }}>
                        {hasMonthData && m.commissionCost > 0 ? `−${fmtM(m.commissionCost)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm" style={{ color: hasMonthData ? "#94A3B8" : "#CBD5E1" }}>
                        {hasMonthData ? `${fmtM(m.totalCosts)}` : "—"}
                      </td>
                      <td className="px-3 pr-5 py-2.5 text-right font-mono text-sm font-bold"
                        style={{ color: hasMonthData ? profitColor(m.profit) : "#CBD5E1" }}>
                        {hasMonthData ? `${m.profit >= 0 ? "+" : ""}${fmtM(m.profit)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {hasData && (
                <tfoot>
                  <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                    <td className="px-5 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: "#64748B" }}>Éves összesen</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-bold" style={{ color: occColor(kpis.avgOccPct) }}>{kpis.avgOccPct}%</span>
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-semibold text-sm" style={{ color: "#0F172A" }}>
                      {fmt(kpis.totalRoomNights)}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-sm" style={{ color: "#64748B" }}>
                      {fmt(kpis.avgAdr)}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-sm" style={{ color: "#64748B" }}>
                      {fmt(kpis.revpar)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-sm" style={{ color: "#0F172A" }}>
                      {fmtM(kpis.totalRevenue)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: (kpis.totalCommissionCost ?? 0) > 0 ? "#D97706" : "#CBD5E1" }}>
                      {(kpis.totalCommissionCost ?? 0) > 0 ? `−${fmtM(kpis.totalCommissionCost)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: "#64748B" }}>
                      {fmtM(kpis.totalCosts)}
                    </td>
                    <td className="px-3 pr-5 py-3 text-right font-mono font-bold text-sm"
                      style={{ color: profitColor(kpis.totalProfit) }}>
                      {kpis.totalProfit >= 0 ? "+" : ""}{fmtM(kpis.totalProfit)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ── Szegmens mix + Komisszió ── */}
      {hasData && segments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Donut chart — szegmens mix */}
          <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Szegmens mix</h2>
              <button onClick={() => router.push(`/segments/${scenario.id}`)}
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: "#7C3AED" }}>
                Szerkesztés <ChevronRight size={13} />
              </button>
            </div>

            {segments.every(s => s.avgShare === 0) ? (
              <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>
                Még nincs beállított havi arány
              </p>
            ) : (
              <div className="flex items-center gap-4">
                {/* Donut */}
                <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={segments.filter(s => s.avgShare > 0)}
                        cx="50%" cy="50%"
                        innerRadius={44} outerRadius={72}
                        paddingAngle={2}
                        dataKey="avgShare"
                        nameKey="name"
                        strokeWidth={0}
                      >
                        {segments.filter(s => s.avgShare > 0).map(seg => (
                          <Cell key={seg.id} fill={seg.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}%`]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda */}
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  {segments.filter(s => s.avgShare > 0).map(seg => (
                    <div key={seg.id} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate" style={{ color: "#0F172A" }}>{seg.name}</p>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>
                          {seg.avgShare}%
                          {seg.effectiveCommPct > 0 && (
                            <span className="ml-1" style={{ color: "#D97706" }}>· {seg.effectiveCommPct}% jut.</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Komisszió breakdown */}
          <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: "#0F172A" }}>Tervezett komisszió</h2>

            {(kpis.totalCommissionCost ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Receipt size={28} style={{ color: "#CBD5E1" }} />
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  Nincs jutalékköltség — állítsd be a szegmenseknél.
                </p>
                <button onClick={() => router.push(`/segments/${scenario.id}`)}
                  className="mt-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: "#FEF3C7", color: "#D97706" }}>
                  Szegmensek beállítása
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Összesen sor */}
                <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <span className="text-sm font-semibold" style={{ color: "#92400E" }}>Éves komisszió összesen</span>
                  <span className="text-base font-bold" style={{ color: "#D97706" }}>
                    {fmtM(kpis.totalCommissionCost ?? 0)} {ccy}
                  </span>
                </div>

                {/* Szegmensenkénti bontás */}
                {segments.filter(s => s.effectiveCommPct > 0 && s.avgShare > 0).map(seg => {
                  const segShare = seg.avgShare / 100;
                  const segComm  = segShare * (kpis.totalRoomRevenue) * (seg.effectiveCommPct / 100);
                  const pctOfTotal = (kpis.totalCommissionCost ?? 0) > 0
                    ? Math.round(segComm / (kpis.totalCommissionCost ?? 1) * 100) : 0;
                  return (
                    <div key={seg.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
                          <span className="text-xs font-medium" style={{ color: "#334155" }}>{seg.name}</span>
                          <span className="text-xs" style={{ color: "#94A3B8" }}>{seg.effectiveCommPct}%</span>
                        </div>
                        <span className="text-xs font-mono font-semibold" style={{ color: "#D97706" }}>
                          ≈{fmtM(Math.round(segComm))} {ccy}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "#F1F5F9" }}>
                        <div className="h-full rounded-full" style={{ width: `${pctOfTotal}%`, background: seg.color }} />
                      </div>
                    </div>
                  );
                })}

                {/* Bevételarány */}
                {kpis.totalRevenue > 0 && (
                  <p className="text-xs pt-1" style={{ color: "#94A3B8" }}>
                    A teljes bevétel{" "}
                    <strong style={{ color: "#D97706" }}>
                      {Math.round((kpis.totalCommissionCost ?? 0) / kpis.totalRevenue * 1000) / 10}%
                    </strong>
                    -a megy jutalékra
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Revenue mix + Cost breakdown ── */}
      {hasData && kpis.totalRevenue > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revenue mix */}
          <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: "#0F172A" }}>Bevételi mix</h2>
            <div className="space-y-3">
              {[
                { label: "Szobabevétel", value: kpis.totalRoomRevenue, color: "#7C3AED" },
                { label: "F&B bevétel",  value: kpis.totalFbRevenue,   color: "#10B981" },
                { label: "Spa bevétel",  value: kpis.totalSpaRevenue,  color: "#3B82F6" },
                { label: "Egyéb bevétel",value: kpis.totalOtherRevenue,color: "#F59E0B" },
              ].filter(r => r.value > 0).map(row => {
                const pct = Math.round(row.value / kpis.totalRevenue * 100);
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: "#334155" }}>{row.label}</span>
                      <span className="text-xs font-mono font-semibold" style={{ color: row.color }}>
                        {fmtM(row.value)} {ccy} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "#F1F5F9" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: row.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Profit summary */}
          <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: "#0F172A" }}>Profit összefoglaló</h2>
            <div className="space-y-3">
              {[
                { label: "Teljes bevétel",  value: kpis.totalRevenue,  color: "#3B82F6", sign: false },
                { label: "Összes kiadás",   value: -kpis.totalCosts,   color: "#EF4444", sign: true },
                { label: "GOP profit",      value: kpis.totalProfit,   color: profitColor(kpis.totalProfit), sign: true, bold: true },
              ].map(row => {
                const pct = kpis.totalRevenue > 0 ? Math.abs(Math.round(row.value / kpis.totalRevenue * 100)) : 0;
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${row.bold ? "font-bold" : "font-medium"}`} style={{ color: row.bold ? "#0F172A" : "#334155" }}>
                        {row.label}
                      </span>
                      <span className={`text-xs font-mono font-semibold`} style={{ color: row.color }}>
                        {row.sign && row.value >= 0 ? "+" : ""}{fmtM(row.value)} {ccy}
                        {!row.bold && ` · ${pct}%`}
                        {row.bold && ` · ${kpis.profitPct}%`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "#F1F5F9" }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%`, background: row.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Click outside */}
      {scenarioOpen && <div className="fixed inset-0 z-20" onClick={() => setScenarioOpen(false)} />}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, highlight }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string; highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl p-3 md:p-5 relative overflow-hidden"
      style={{ background: "white", border: `1px solid ${highlight ? color + "40" : "#E2E8F0"}` }}>
      {highlight && (
        <div className="absolute inset-0 opacity-[0.03]" style={{ background: color }} />
      )}
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide leading-tight" style={{ color: "#94A3B8" }}>{label}</span>
        <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + "18", color }}>
          {icon}
        </div>
      </div>
      <div className="text-lg md:text-2xl font-bold leading-tight" style={{ color: "#0F172A" }}>{value}</div>
      {sub && <p className="text-xs mt-1 md:mt-1.5 leading-relaxed hidden sm:block" style={{ color: "#94A3B8" }}>{sub}</p>}
    </div>
  );
}

function SpotlightCell({ label, value, color, sub }: {
  label: string; value: string; color: string; sub?: string;
}) {
  return (
    <div className="px-3 md:px-5 py-3 md:py-4">
      <p className="text-xs font-medium mb-1" style={{ color: "#64748B" }}>{label}</p>
      <p className="text-base md:text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{sub}</p>}
    </div>
  );
}
