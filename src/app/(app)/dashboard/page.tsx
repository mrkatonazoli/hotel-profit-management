"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Bed, DollarSign, BarChart3,
  Loader2, ChevronDown, ArrowRight, Star,
  Building2, AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioRef = { id: string; name: string; year: number; probability: number; isBase: boolean };

type MonthRow = {
  month: number; dayCount: number;
  roomNights: number; roomRevenue: number;
  fbRevenue: number; spaRevenue: number; otherRevenue: number; totalRevenue: number;
  avgOcc: number; avgAdr: number; revpar: number;
};

type DashData = {
  hotel: { name: string; totalRooms: number | null };
  scenario: ScenarioRef;
  scenarios: ScenarioRef[];
  hasData: boolean;
  kpis: {
    totalRoomRevenue: number; totalFbRevenue: number;
    totalSpaRevenue: number; totalOtherRevenue: number;
    totalRevenue: number; totalRoomNights: number;
    avgOccPct: number; avgAdr: number; revpar: number;
  };
  months: MonthRow[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HU_MONTHS_SHORT = ["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Sze","Okt","Nov","Dec"];
const HU_MONTHS = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];

function fmt(n: number) { return n.toLocaleString("hu-HU"); }
function fmtM(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("hu-HU", { maximumFractionDigits: 0 })} E`;
  return fmt(n);
}

function occColor(occ: number) {
  if (occ >= 85) return "#10B981";
  if (occ >= 65) return "#7C3AED";
  if (occ >= 45) return "#F59E0B";
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

function MonthlyBarChart({ months, metric }: {
  months: MonthRow[];
  metric: "roomRevenue" | "avgOcc" | "totalRevenue" | "revpar";
}) {
  const W = 600; const H = 180; const PAD = { t: 10, r: 8, b: 28, l: 44 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const barW = Math.floor(chartW / 12) - 3;
  const values = months.map(m => m[metric]);
  const max = Math.max(...values, 1);

  const fmtY = (v: number) =>
    metric === "avgOcc" ? `${v}%` : metric === "revpar" ? `${fmtM(v)}` : fmtM(v);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: f, v: max * f }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Grid lines */}
      {ticks.map(t => {
        const cy = PAD.t + chartH * (1 - t.y);
        return (
          <g key={t.y}>
            <line x1={PAD.l} y1={cy} x2={PAD.l + chartW} y2={cy}
              stroke="#F1F5F9" strokeWidth={1} />
            <text x={PAD.l - 4} y={cy + 4} textAnchor="end" fontSize={9} fill="#94A3B8">
              {fmtY(Math.round(t.v))}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {months.map((m, i) => {
        const v = m[metric];
        const barH = v > 0 ? Math.max((v / max) * chartH, 2) : 0;
        const x = PAD.l + i * (chartW / 12) + (chartW / 12 - barW) / 2;
        const y = PAD.t + chartH - barH;
        const color = metric === "avgOcc" ? occColor(v) : "#7C3AED";
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={m.dayCount > 0 ? color : "#F1F5F9"}
              rx={3} opacity={m.dayCount > 0 ? 1 : 0.5} />
            {v > 0 && barH > 18 && (
              <text x={x + barW / 2} y={y + 11} textAnchor="middle" fontSize={8} fill="white" fontWeight={600}>
                {metric === "avgOcc" ? `${v}%` : fmtM(v)}
              </text>
            )}
            <text x={x + barW / 2} y={PAD.t + chartH + 14}
              textAnchor="middle" fontSize={9} fill="#94A3B8">
              {HU_MONTHS_SHORT[m.month - 1]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<"roomRevenue" | "avgOcc" | "totalRevenue" | "revpar">("roomRevenue");

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

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Building2 size={32} style={{ color: "#CBD5E1" }} />
      <p style={{ color: "#94A3B8" }}>Nincs beállított hotel. Először töltsd ki a Hotel beállításokat.</p>
    </div>
  );

  const { hotel, scenario, scenarios, hasData, kpis, months } = data;
  const pc = probColor(scenario.probability);
  const filledMonths = months.filter(m => m.dayCount > 0);
  const peakMonth   = filledMonths.length > 0 ? filledMonths.reduce((a, b) => b.avgOcc > a.avgOcc ? b : a) : null;
  const troughMonth = filledMonths.length > 0 ? filledMonths.reduce((a, b) => b.avgOcc < a.avgOcc ? b : a) : null;

  const metricOptions: { key: typeof chartMetric; label: string }[] = [
    { key: "roomRevenue",  label: "Szobabevétel" },
    { key: "totalRevenue", label: "Teljes bevétel" },
    { key: "avgOcc",       label: "Kihasználtság %" },
    { key: "revpar",       label: "RevPAR" },
  ];

  return (
    <div className="space-y-5" style={{ maxWidth: 1100 }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
            {hotel.name} · {scenario.year} · {hotel.totalRooms ? `${hotel.totalRooms} szoba` : "szobaszám nincs megadva"}
          </p>
        </div>

        {/* Scenario switcher */}
        <div className="relative">
          <button
            onClick={() => setScenarioOpen(o => !o)}
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

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Szobabevétel"
          value={`${fmtM(kpis.totalRoomRevenue)} Ft`}
          sub={kpis.totalRevenue > 0 ? `${Math.round(kpis.totalRoomRevenue / kpis.totalRevenue * 100)}% a bevételből` : undefined}
          icon={<DollarSign size={17} />} color="#7C3AED"
        />
        <KpiCard
          label="Teljes bevétel"
          value={`${fmtM(kpis.totalRevenue)} Ft`}
          sub={kpis.totalFbRevenue > 0
            ? `F&B: ${fmtM(kpis.totalFbRevenue)} · Spa: ${fmtM(kpis.totalSpaRevenue)}`
            : "F&B és Spa nélkül"}
          icon={<BarChart3 size={17} />} color="#3B82F6"
        />
        <KpiCard
          label="Átl. kihasználtság"
          value={`${kpis.avgOccPct}%`}
          sub={peakMonth ? `Csúcs: ${HU_MONTHS_SHORT[peakMonth.month - 1]} ${peakMonth.avgOcc}%` : undefined}
          icon={<Bed size={17} />} color={occColor(kpis.avgOccPct)}
        />
        <KpiCard
          label="RevPAR"
          value={`${fmt(kpis.revpar)} Ft`}
          sub={`ADR: ${fmt(kpis.avgAdr)} Ft · ${fmt(kpis.totalRoomNights)} szobaéj`}
          icon={<TrendingUp size={17} />} color="#10B981"
        />
      </div>

      {/* ── Chart ── */}
      {hasData && (
        <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #E2E8F0" }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Havi alakulás</h2>
            <div className="flex gap-1.5">
              {metricOptions.map(o => (
                <button key={o.key}
                  onClick={() => setChartMetric(o.key)}
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
          <MonthlyBarChart months={months} metric={chartMetric} />

          {/* Peak / trough callout */}
          {peakMonth && troughMonth && peakMonth.month !== troughMonth.month && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: "#D1FAE5", color: "#065F46" }}>
                <span className="font-bold">↑ Csúcs:</span>
                {HU_MONTHS[peakMonth.month - 1]} — {peakMonth.avgOcc}% kihas., {fmt(peakMonth.avgAdr)} Ft ADR
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: "#FEE2E2", color: "#991B1B" }}>
                <span className="font-bold">↓ Völgy:</span>
                {HU_MONTHS[troughMonth.month - 1]} — {troughMonth.avgOcc}% kihas., {fmt(troughMonth.avgAdr)} Ft ADR
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Monthly table ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Havi összesítő</h2>
          <button onClick={() => router.push(`/revenue-planner/${scenario.id}`)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
            style={{ background: "#EDE9FE", color: "#7C3AED" }}>
            Részletes nézet <ArrowRight size={12} />
          </button>
        </div>

        {!hasData ? (
          <p className="text-sm text-center py-10" style={{ color: "#94A3B8" }}>
            Nincs generált adat — futtasd a generálást a Forgatókönyvek oldalon.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 700 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Hónap</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Kihas.</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Szobaéj</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>ADR</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>RevPAR</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Szobabev.</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Teljes bev.</th>
                </tr>
              </thead>
              <tbody>
                {months.map(m => {
                  const hasMonthData = m.dayCount > 0;
                  return (
                    <tr key={m.month}
                      style={{ borderBottom: "1px solid #F8FAFC", opacity: hasMonthData ? 1 : 0.35 }}>
                      <td className="px-5 py-2.5">
                        <span className="text-sm font-medium" style={{ color: "#0F172A" }}>
                          {HU_MONTHS[m.month - 1]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {hasMonthData ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-1.5 rounded-full" style={{ width: 36, background: "#F1F5F9", overflow: "hidden" }}>
                              <div className="h-full rounded-full" style={{
                                width: `${m.avgOcc}%`,
                                background: occColor(m.avgOcc),
                              }} />
                            </div>
                            <span className="text-xs font-mono font-semibold" style={{ color: occColor(m.avgOcc) }}>
                              {m.avgOcc}%
                            </span>
                          </div>
                        ) : <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm" style={{ color: hasMonthData ? "#334155" : "#CBD5E1" }}>
                        {hasMonthData ? fmt(m.roomNights) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm" style={{ color: hasMonthData ? "#334155" : "#CBD5E1" }}>
                        {hasMonthData ? `${fmt(m.avgAdr)} Ft` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm" style={{ color: hasMonthData ? "#334155" : "#CBD5E1" }}>
                        {hasMonthData ? `${fmt(m.revpar)} Ft` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold" style={{ color: hasMonthData ? "#7C3AED" : "#CBD5E1" }}>
                        {hasMonthData ? `${fmtM(m.roomRevenue)} Ft` : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-sm font-bold" style={{ color: hasMonthData ? "#0F172A" : "#CBD5E1" }}>
                        {hasMonthData ? `${fmtM(m.totalRevenue)} Ft` : "—"}
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
                      <span className="text-sm font-bold" style={{ color: occColor(kpis.avgOccPct) }}>
                        {kpis.avgOccPct}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-sm" style={{ color: "#0F172A" }}>
                      {fmt(kpis.totalRoomNights)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: "#64748B" }}>
                      {fmt(kpis.avgAdr)} Ft
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: "#64748B" }}>
                      {fmt(kpis.revpar)} Ft
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-sm" style={{ color: "#7C3AED" }}>
                      {fmtM(kpis.totalRoomRevenue)} Ft
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-sm" style={{ color: "#0F172A" }}>
                      {fmtM(kpis.totalRevenue)} Ft
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ── Revenue mix ── */}
      {hasData && kpis.totalRevenue > 0 && (
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
                      {fmtM(row.value)} Ft · {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "#F1F5F9" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: row.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {scenarioOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setScenarioOpen(false)} />
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: color + "18", color }}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color: "#0F172A" }}>{value}</div>
      {sub && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#94A3B8" }}>{sub}</p>}
    </div>
  );
}
