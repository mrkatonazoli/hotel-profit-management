"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import {
  Loader2, ChevronLeft, ChevronRight, ChevronDown,
  TrendingUp, TrendingDown, Bed, DollarSign, BarChart3, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioRef = { id: string; name: string; year: number; probability: number; isBase: boolean };
type ChildAgeGroup = { id: string; name: string; minAge: number; maxAge: number };

type MonthRow = {
  month: number; hasData: boolean; daysInMonth: number; daysPlanned: number;
  roomNights: number; avgOcc: number; avgAdr: number; revpar: number;
  roomRevenue: number; fbRevenue: number; spaRevenue: number; otherRevenue: number; totalRevenue: number;
  fixedCosts: number; variableCosts: number; staffCosts: number; labCosts: number;
  distributorCosts: number; totalCosts: number;
  profit: number; profitPct: number;
  adultCount: number; childCount: number; totalGuests: number;
};

type MonthlyData = {
  hotel: { name: string; totalRooms: number; currency: string };
  scenario: ScenarioRef;
  scenarios: ScenarioRef[];
  childAgeGroups: ChildAgeGroup[];
  months: MonthRow[];
  annual: {
    roomNights: number; roomRevenue: number; fbRevenue: number; spaRevenue: number;
    otherRevenue: number; totalRevenue: number; fixedCosts: number; variableCosts: number;
    staffCosts: number; labCosts: number; distributorCosts: number; totalCosts: number;
    profit: number; profitPct: number;
  };
};

type BoardTypeChildCount = {
  groupId: string; groupName: string; minAge: number; maxAge: number; count: number;
};

type BoardTypeRow = {
  boardType: string;
  roomCount: number;
  adultCount: number;
  childCounts: BoardTypeChildCount[];
};

type DayRow = {
  date: string; dayOfWeek: number; dayName: string; hasData: boolean;
  occupancyPct: number; adr: number; roomNights: number;
  roomRevenue: number; fbRevenue: number; spaRevenue: number; otherRevenue: number; totalRevenue: number;
  totalCosts: number; profit: number; profitPct: number;
  adultCount?: number; childCount?: number; totalGuests?: number;
  boardTypes?: BoardTypeRow[];
};

type DailyData = {
  hotel: { name: string; totalRooms: number; currency: string };
  scenario: ScenarioRef;
  scenarios: ScenarioRef[];
  year: number; month: number; daysInMonth: number;
  days: DayRow[];
  totals: {
    roomNights: number; totalRevenue: number; totalCosts: number; profit: number;
    avgOcc: number; avgAdr: number; revpar: number; profitPct: number;
  };
};

// ─── Board type constants ─────────────────────────────────────────────────────

const BOARD_COLORS: Record<string, { bg: string; text: string }> = {
  RO: { bg: "#F1F5F9", text: "#64748B" },
  BB: { bg: "#DBEAFE", text: "#1D4ED8" },
  HB: { bg: "#D1FAE5", text: "#065F46" },
  FB: { bg: "rgba(53,189,120,0.12)", text: "#03915A" },
  AI: { bg: "#FEF3C7", text: "#92400E" },
};

const BOARD_LABELS: Record<string, string> = {
  RO: "Csak szoba", BB: "Reggeli", HB: "Félpanzió", FB: "Teljes panzió", AI: "All Inclusive",
};

function BoardBadge({ code }: { code?: string }) {
  if (!code) return null;
  const c = BOARD_COLORS[code] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold"
      style={{ background: c.bg, color: c.text }} title={BOARD_LABELS[code] ?? code}>
      {code}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HU_MONTHS = ["Január","Február","Március","Április","Május","Június",
  "Július","Augusztus","Szeptember","Október","November","December"];
const HU_MONTHS_SHORT = ["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Sze","Okt","Nov","Dec"];

function fmt(n: number) { return Math.round(n).toLocaleString("hu-HU"); }
function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString("hu-HU", { maximumFractionDigits: 0 })} E`;
  return fmt(n);
}

function occColor(occ: number) {
  if (occ >= 85) return "#10B981";
  if (occ >= 65) return "#35BD78";
  if (occ >= 45) return "#F59E0B";
  return "#EF4444";
}
function profitColor(p: number) {
  return p >= 0 ? "#059669" : "#DC2626";
}
function profitBg(p: number) {
  return p >= 0 ? "#D1FAE5" : "#FEE2E2";
}

function probColor(p: number) {
  if (p >= 70) return { bg: "#D1FAE5", text: "#059669" };
  if (p >= 40) return { bg: "#FEF3C7", text: "#D97706" };
  return { bg: "#FEE2E2", text: "#DC2626" };
}

// ─── Shared: Scenario Selector ────────────────────────────────────────────────

function ScenarioSelector({
  scenarios, selected, onSelect,
}: {
  scenarios: ScenarioRef[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {scenarios.map(s => {
        const active = s.id === selected;
        const pc = probColor(s.probability);
        return (
          <button key={s.id} onClick={() => onSelect(s.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: active ? "#35BD78" : "white",
              color: active ? "white" : "#1E293B",
              border: `1px solid ${active ? "#35BD78" : "#E2E8F0"}`,
            }}>
            {s.name}
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
              style={{
                background: active ? "rgba(255,255,255,0.2)" : pc.bg,
                color: active ? "white" : pc.text,
              }}>
              {s.probability}%
            </span>
            {s.isBase && (
              <span className="text-xs opacity-70">★</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── KPI Chip ─────────────────────────────────────────────────────────────────

function KpiChip({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl px-5 py-4 flex flex-col gap-1" style={{ border: "1px solid #E2E8F0" }}>
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>{label}</span>
      <span className="text-2xl font-bold font-mono" style={{ color }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: "#94A3B8" }}>{sub}</span>}
    </div>
  );
}

// ─── Profit Bar (mini sparkline) ──────────────────────────────────────────────

function ProfitBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(Math.abs(value) / max, 1) * 100 : 0;
  const color = value >= 0 ? "#10B981" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#F1F5F9" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Havi nézet ───────────────────────────────────────────────────────────────

function MonthlyView() {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());

  const load = useCallback(async (sid?: string) => {
    setLoading(true);
    try {
      const url = `/api/reporting/monthly${sid ? `?scenarioId=${sid}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const d: MonthlyData = await res.json();
      setData(d);
      if (!sid) setSelectedScenario(d.scenario.id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleScenarioChange = (id: string) => {
    setSelectedScenario(id);
    load(id);
  };

  const toggleMonth = (m: number) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <Loader2 size={24} className="animate-spin" style={{ color: "#35BD78" }} />
    </div>
  );
  if (!data) return null;

  const maxProfit = Math.max(...data.months.map(m => Math.abs(m.profit)), 1);

  return (
    <div className="space-y-6">
      {/* Scenario selector */}
      <ScenarioSelector scenarios={data.scenarios} selected={selectedScenario} onSelect={handleScenarioChange} />

      {/* KPI chips */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <KpiChip label="Éves bevétel" value={fmtM(data.annual.totalRevenue)}
          sub={`${data.hotel.currency}`} color="#35BD78" />
        <KpiChip label="Éves kiadás" value={fmtM(data.annual.totalCosts)}
          sub="Fix + változó + bér + LAB" color="#64748B" />
        <KpiChip label="Éves profit" value={fmtM(data.annual.profit)}
          sub={`${data.annual.profitPct}% marzs`} color={profitColor(data.annual.profit)} />
        <KpiChip label="Szobaéjszakák" value={fmt(data.annual.roomNights)}
          sub={`${data.hotel.totalRooms} szoba`} color="#3B82F6" />
        <KpiChip
          label="Éves vendégek"
          value={fmt(data.months.reduce((a, m) => a + m.totalGuests, 0))}
          sub={(() => {
            const totalAdults = data.months.reduce((a, m) => a + m.adultCount, 0);
            const totalChildren = data.months.reduce((a, m) => a + m.childCount, 0);
            const avgPerRoom = data.annual.roomNights > 0
              ? `${Math.round(totalAdults / data.annual.roomNights * 10) / 10} F/szoba`
              : "";
            return `${fmt(totalAdults)} F + ${fmt(totalChildren)} Gy · ${avgPerRoom}`;
          })()}
          color="#0EA5E9"
        />
      </div>

      {/* Monthly P&L table */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#64748B" }}>
            Havi P&amp;L — {data.scenario.year}
          </h2>
        </div>

        {/* Header */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 980 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                {["Hónap", "Fogl.%", "ADR", "RevPAR", "Vendégek", "Bevétel", "Kiadás", "Profit", "Marzs", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#94A3B8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.months.map((m, idx) => {
                const isLast = idx === 11;
                const expanded = expandedMonths.has(m.month);
                return (
                  <Fragment key={m.month}>
                    <tr
                      onClick={() => m.hasData && toggleMonth(m.month)}
                      className="transition-colors"
                      style={{
                        borderBottom: isLast ? "none" : "1px solid #F8FAFC",
                        opacity: m.hasData ? 1 : 0.4,
                        cursor: m.hasData ? "pointer" : "default",
                        background: expanded ? "#FAFBFF" : "transparent",
                      }}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold" style={{ color: "#1E293B" }}>
                            {HU_MONTHS_SHORT[m.month - 1]}
                          </span>
                          {!m.hasData && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#F1F5F9", color: "#94A3B8" }}>
                              nincs adat
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {m.hasData && (
                          <span className="text-sm font-semibold font-mono" style={{ color: occColor(m.avgOcc) }}>
                            {m.avgOcc}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono" style={{ color: "#475569" }}>
                        {m.hasData ? fmt(m.avgAdr) : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono" style={{ color: "#475569" }}>
                        {m.hasData ? fmt(m.revpar) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {m.hasData && m.totalGuests > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold font-mono" style={{ color: "#1E293B" }}>
                              {fmt(m.totalGuests)}
                            </span>
                            <span className="text-xs" style={{ color: "#94A3B8" }}>
                              {fmt(m.adultCount)}F + {fmt(m.childCount)}Gy
                            </span>
                          </div>
                        ) : m.hasData ? (
                          <span className="text-sm font-mono" style={{ color: "#CBD5E1" }}>—</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold font-mono" style={{ color: "#35BD78" }}>
                        {m.hasData ? fmtM(m.totalRevenue) : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono" style={{ color: "#64748B" }}>
                        {m.hasData ? fmtM(m.totalCosts) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {m.hasData && (
                          <span className="text-sm font-bold font-mono" style={{ color: profitColor(m.profit) }}>
                            {m.profit >= 0 ? "+" : ""}{fmtM(m.profit)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {m.hasData && (
                          <span className="text-xs font-bold px-2 py-1 rounded-lg"
                            style={{ background: profitBg(m.profit), color: profitColor(m.profit) }}>
                            {m.profitPct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 w-32">
                        {m.hasData && <ProfitBar value={m.profit} max={maxProfit} />}
                      </td>
                    </tr>

                    {/* Expanded cost breakdown */}
                    {expanded && m.hasData && (
                      <tr style={{ borderBottom: "1px solid #F1F5F9", background: "#F8FAFF" }}>
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            {[
                              { label: "Szobabev.", value: m.roomRevenue, color: "#35BD78" },
                              { label: "F&B bev.", value: m.fbRevenue, color: "#3B82F6" },
                              { label: "Spa bev.", value: m.spaRevenue, color: "#06B6D4" },
                              { label: "Fix ktg.", value: -m.fixedCosts, color: "#64748B" },
                              { label: "Változó ktg.", value: -m.variableCosts, color: "#F59E0B" },
                              { label: "Bérköltség", value: -m.staffCosts, color: "#EF4444" },
                              { label: "LAB ktg.", value: -m.labCosts, color: "#35BD78" },
                              { label: "Közvetítő", value: -m.distributorCosts, color: "#EC4899" },
                              { label: "Szobaéjszakák", value: m.roomNights, color: "#1E293B", isRaw: true },
                              { label: "Felnőtt", value: m.adultCount, color: "#0EA5E9", isRaw: true },
                              { label: "Gyerek", value: m.childCount, color: "#F59E0B", isRaw: true },
                            ].map(item => (
                              <div key={item.label} className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
                                <div className="text-xs" style={{ color: "#94A3B8" }}>{item.label}</div>
                                <div className="text-sm font-bold font-mono mt-1" style={{ color: item.color }}>
                                  {(item as { isRaw?: boolean }).isRaw
                                    ? fmt(Math.abs(item.value))
                                    : `${item.value >= 0 ? "+" : ""}${fmtM(item.value)}`}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            {/* Annual totals */}
            <tfoot>
              <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                <td className="px-4 py-4 text-xs font-bold uppercase tracking-widest" style={{ color: "#64748B" }}>
                  Éves összesen
                </td>
                <td className="px-4 py-4" />
                <td className="px-4 py-4" />
                <td className="px-4 py-4" />
                <td className="px-4 py-4" />
                <td className="px-4 py-4 text-sm font-bold font-mono" style={{ color: "#35BD78" }}>
                  {fmtM(data.annual.totalRevenue)}
                </td>
                <td className="px-4 py-4 text-sm font-bold font-mono" style={{ color: "#64748B" }}>
                  {fmtM(data.annual.totalCosts)}
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm font-bold font-mono" style={{ color: profitColor(data.annual.profit) }}>
                    {data.annual.profit >= 0 ? "+" : ""}{fmtM(data.annual.profit)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm font-bold px-2 py-1 rounded-lg"
                    style={{ background: profitBg(data.annual.profit), color: profitColor(data.annual.profit) }}>
                    {data.annual.profitPct}%
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Cost breakdown footer note */}
      <p className="text-xs text-center" style={{ color: "#CBD5E1" }}>
        Kattints egy hónapra a részletes bontáshoz
      </p>
    </div>
  );
}

// ─── Napi nézet ───────────────────────────────────────────────────────────────

function DailyView() {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const load = useCallback(async (sid?: string, year?: number, month?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sid) params.set("scenarioId", sid);
      if (year) params.set("year", String(year));
      if (month) params.set("month", String(month));
      const res = await fetch(`/api/reporting/daily?${params}`);
      if (!res.ok) return;
      const d: DailyData = await res.json();
      setData(d);
      if (!sid) setSelectedScenario(d.scenario.id);
      setCurrentYear(d.year);
      setCurrentMonth(d.month);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    const y = currentMonth === 1 ? currentYear - 1 : currentYear;
    const m = currentMonth === 1 ? 12 : currentMonth - 1;
    setCurrentYear(y); setCurrentMonth(m);
    load(selectedScenario, y, m);
  };
  const nextMonth = () => {
    const y = currentMonth === 12 ? currentYear + 1 : currentYear;
    const m = currentMonth === 12 ? 1 : currentMonth + 1;
    setCurrentYear(y); setCurrentMonth(m);
    load(selectedScenario, y, m);
  };

  const handleScenarioChange = (id: string) => {
    setSelectedScenario(id);
    load(id, currentYear, currentMonth);
  };

  const WEEKEND = [0, 6]; // Vas, Szo

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <Loader2 size={24} className="animate-spin" style={{ color: "#35BD78" }} />
    </div>
  );
  if (!data) return null;

  const hasAnyData = data.days.some(d => d.hasData);

  return (
    <div className="space-y-6">
      {/* Scenario + month nav */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ScenarioSelector scenarios={data.scenarios} selected={selectedScenario} onSelect={handleScenarioChange} />
        <div className="flex items-center gap-2 bg-white rounded-xl px-2 py-1.5" style={{ border: "1px solid #E2E8F0" }}>
          <button onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft size={16} style={{ color: "#64748B" }} />
          </button>
          <span className="text-sm font-semibold px-2" style={{ color: "#1E293B", minWidth: 160, textAlign: "center" }}>
            {HU_MONTHS[currentMonth - 1]} {currentYear}
          </span>
          <button onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight size={16} style={{ color: "#64748B" }} />
          </button>
        </div>
      </div>

      {/* KPI chips */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <KpiChip label="Átl. foglaltság" value={`${data.totals.avgOcc}%`}
          sub={`ADR: ${fmt(data.totals.avgAdr)} ${data.hotel.currency}`} color={occColor(data.totals.avgOcc)} />
        <KpiChip label="RevPAR" value={fmt(data.totals.revpar)}
          sub={data.hotel.currency} color="#3B82F6" />
        <KpiChip label="Havi bevétel" value={fmtM(data.totals.totalRevenue)}
          sub={data.hotel.currency} color="#35BD78" />
        <KpiChip label="Havi profit" value={fmtM(data.totals.profit)}
          sub={`${data.totals.profitPct}% marzs`} color={profitColor(data.totals.profit)} />
        <KpiChip
          label="Havi vendégek"
          value={fmt(data.days.filter(d => d.hasData).reduce((a, d) => a + (d.totalGuests ?? 0), 0))}
          sub={`${fmt(data.days.filter(d => d.hasData).reduce((a, d) => a + (d.adultCount ?? 0), 0))} F + ${fmt(data.days.filter(d => d.hasData).reduce((a, d) => a + (d.childCount ?? 0), 0))} Gy`}
          color="#0EA5E9"
        />
      </div>

      {/* Daily table */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#64748B" }}>
            Napi bontás — {HU_MONTHS[currentMonth - 1]} {currentYear}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1020 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                {["Dátum", "Nap", "Fogl.%", "ADR", "Szobaéj.", "Vendégek / Ellátás", "Szobabev.", "Összes bev.", "Kiadás", "Profit", "Marzs"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "#94A3B8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.days.map((d, i) => {
                const isWeekend = WEEKEND.includes(d.dayOfWeek);
                const isLast = i === data.days.length - 1;
                const isExpanded = expandedDay === d.date;
                const hasGuests = d.hasData && ((d.adultCount ?? 0) > 0 || (d.childCount ?? 0) > 0);
                const activeBoardTypes = d.boardTypes?.filter(bt => bt.roomCount > 0) ?? [];
                return (
                  <Fragment key={d.date}>
                    <tr
                      style={{
                        borderBottom: (isLast && !isExpanded) ? "none" : "1px solid #F8FAFC",
                        background: isExpanded ? "#FAFBFF" : isWeekend ? "#FAFBFF" : "transparent",
                        opacity: d.hasData ? 1 : 0.35,
                      }}>
                      <td className="px-4 py-2.5 text-xs font-mono font-semibold" style={{ color: "#475569" }}>
                        {d.date.slice(5)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                          style={{
                            background: isWeekend ? "rgba(53,189,120,0.12)" : "#F1F5F9",
                            color: isWeekend ? "#35BD78" : "#64748B",
                          }}>
                          {d.dayName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {d.hasData && (
                          <span className="text-xs font-bold font-mono" style={{ color: occColor(d.occupancyPct) }}>
                            {d.occupancyPct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#475569" }}>
                        {d.hasData ? fmt(d.adr) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#64748B" }}>
                        {d.hasData ? d.roomNights : "—"}
                      </td>

                      {/* Vendégek — csak összesítés, kattintásra nyílik ki a bontás */}
                      <td className="px-4 py-2.5">
                        {d.hasData && hasGuests ? (
                          <button
                            onClick={() => setExpandedDay(isExpanded ? null : d.date)}
                            className="flex items-center gap-1 text-left hover:opacity-75 transition-opacity">
                            <span className="text-xs font-semibold font-mono" style={{ color: "#0EA5E9" }}>
                              {d.adultCount}F
                            </span>
                            {(d.childCount ?? 0) > 0 && (
                              <span className="text-xs font-semibold font-mono" style={{ color: "#F59E0B" }}>
                                +{d.childCount}Gy
                              </span>
                            )}
                            <ChevronDown size={11} style={{
                              color: "#94A3B8", flexShrink: 0,
                              transform: isExpanded ? "rotate(180deg)" : "none",
                              transition: "transform 0.15s",
                            }} />
                          </button>
                        ) : d.hasData ? (
                          <span className="text-xs" style={{ color: "#CBD5E1" }}>—</span>
                        ) : null}
                      </td>

                      <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#35BD78" }}>
                        {d.hasData ? fmtM(d.roomRevenue) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold font-mono" style={{ color: "#35BD78" }}>
                        {d.hasData ? fmtM(d.totalRevenue) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#64748B" }}>
                        {d.hasData ? fmtM(d.totalCosts) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.hasData && (
                          <span className="text-xs font-bold font-mono" style={{ color: profitColor(d.profit) }}>
                            {d.profit >= 0 ? "+" : ""}{fmtM(d.profit)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.hasData && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                            style={{ background: profitBg(d.profit), color: profitColor(d.profit) }}>
                            {d.profitPct}%
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded guest/board detail */}
                    {isExpanded && d.hasData && activeBoardTypes.length > 0 && (
                      <tr style={{ borderBottom: "1px solid #F1F5F9", background: "#F0F9FF" }}>
                        <td colSpan={11} className="px-6 py-3">
                          <div className="overflow-x-auto">
                            <table className="text-xs" style={{ minWidth: 540 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                                  <th className="text-left py-1.5 pr-4 font-semibold" style={{ color: "#94A3B8" }}>Ellátás</th>
                                  <th className="text-right py-1.5 pr-4 font-semibold" style={{ color: "#94A3B8" }}>Szobák</th>
                                  <th className="text-right py-1.5 pr-4 font-semibold" style={{ color: "#0EA5E9" }}>Felnőtt</th>
                                  <th className="text-right py-1.5 pr-4 font-semibold" style={{ color: "#10B981" }}>F/szoba</th>
                                  {(activeBoardTypes[0]?.childCounts ?? []).map(cc => (
                                    <th key={cc.groupId} className="text-right py-1.5 pr-4 font-semibold" style={{ color: "#F59E0B" }}>
                                      {cc.groupName} <span style={{ color: "#CBD5E1" }}>({cc.minAge}–{cc.maxAge}é)</span>
                                    </th>
                                  ))}
                                  <th className="text-right py-1.5 font-semibold" style={{ color: "#64748B" }}>Összes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeBoardTypes.map(bt => {
                                  const btChildren = bt.childCounts.reduce((s, c) => s + c.count, 0);
                                  const btTotal = bt.adultCount + btChildren;
                                  const adultsPerRoom = bt.roomCount > 0
                                    ? Math.round(bt.adultCount / bt.roomCount * 10) / 10
                                    : 0;
                                  const violation = bt.roomCount > 0 && bt.adultCount < bt.roomCount;
                                  return (
                                    <tr key={bt.boardType} style={{ borderBottom: "1px solid #F1F5F9", background: violation ? "#FFF5F5" : undefined }}>
                                      <td className="py-1.5 pr-4">
                                        <BoardBadge code={bt.boardType} />
                                      </td>
                                      <td className="py-1.5 pr-4 text-right font-mono font-semibold" style={{ color: violation ? "#DC2626" : "#475569" }}>
                                        {bt.roomCount}
                                      </td>
                                      <td className="py-1.5 pr-4 text-right font-mono font-semibold" style={{ color: violation ? "#DC2626" : "#0EA5E9" }}>
                                        {bt.adultCount}
                                      </td>
                                      <td className="py-1.5 pr-4 text-right font-mono" style={{ color: violation ? "#DC2626" : "#10B981" }}>
                                        {bt.roomCount > 0 ? adultsPerRoom : "—"}
                                        {violation && " ⚠"}
                                      </td>
                                      {bt.childCounts.map(cc => (
                                        <td key={cc.groupId} className="py-1.5 pr-4 text-right font-mono" style={{ color: cc.count > 0 ? "#F59E0B" : "#CBD5E1" }}>
                                          {cc.count > 0 ? cc.count : "—"}
                                        </td>
                                      ))}
                                      <td className="py-1.5 text-right font-mono font-bold" style={{ color: "#1E293B" }}>
                                        {btTotal}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr style={{ borderTop: "1px solid #E2E8F0" }}>
                                  <td className="py-1.5 pr-4 font-bold" style={{ color: "#64748B" }}>Összesen</td>
                                  <td className="py-1.5 pr-4 text-right font-bold font-mono" style={{ color: "#475569" }}>
                                    {activeBoardTypes.reduce((s, bt) => s + bt.roomCount, 0)}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right font-bold font-mono" style={{ color: "#0EA5E9" }}>
                                    {d.adultCount}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right font-bold font-mono" style={{ color: "#10B981" }}>
                                    {(() => {
                                      const totalRooms = activeBoardTypes.reduce((s, bt) => s + bt.roomCount, 0);
                                      return totalRooms > 0
                                        ? `${Math.round((d.adultCount ?? 0) / totalRooms * 10) / 10}`
                                        : "—";
                                    })()}
                                  </td>
                                  {(activeBoardTypes[0]?.childCounts ?? []).map(cc => {
                                    const total = activeBoardTypes.reduce((s, bt) => {
                                      const found = bt.childCounts.find(c => c.groupId === cc.groupId);
                                      return s + (found?.count ?? 0);
                                    }, 0);
                                    return (
                                      <td key={cc.groupId} className="py-1.5 pr-4 text-right font-bold font-mono" style={{ color: "#F59E0B" }}>
                                        {total > 0 ? total : "—"}
                                      </td>
                                    );
                                  })}
                                  <td className="py-1.5 text-right font-bold font-mono" style={{ color: "#1E293B" }}>
                                    {(d.adultCount ?? 0) + (d.childCount ?? 0)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            {hasAnyData && (
              <tfoot>
                <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                  <td colSpan={4} className="px-4 py-3.5 text-xs font-bold uppercase tracking-widest" style={{ color: "#64748B" }}>
                    Összesen
                  </td>
                  <td className="px-4 py-3.5 text-xs font-bold font-mono" style={{ color: "#64748B" }}>
                    {data.totals.roomNights}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-semibold">
                    {(() => {
                      const activeDays = data.days.filter(d => d.hasData);
                      const totalAdults = activeDays.reduce((a, d) => a + (d.adultCount ?? 0), 0);
                      const totalChildren = activeDays.reduce((a, d) => a + (d.childCount ?? 0), 0);
                      return totalAdults + totalChildren > 0
                        ? <span>
                            <span style={{ color: "#0EA5E9" }}>{fmt(totalAdults)}F</span>
                            {totalChildren > 0 && <span style={{ color: "#F59E0B" }}> + {fmt(totalChildren)}Gy</span>}
                          </span>
                        : <span style={{ color: "#CBD5E1" }}>—</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-bold font-mono" style={{ color: "#35BD78" }} />
                  <td className="px-4 py-3.5 text-xs font-bold font-mono" style={{ color: "#35BD78" }}>
                    {fmtM(data.totals.totalRevenue)}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-bold font-mono" style={{ color: "#64748B" }}>
                    {fmtM(data.totals.totalCosts)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-bold font-mono" style={{ color: profitColor(data.totals.profit) }}>
                      {data.totals.profit >= 0 ? "+" : ""}{fmtM(data.totals.profit)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ background: profitBg(data.totals.profit), color: profitColor(data.totals.profit) }}>
                      {data.totals.profitPct}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "monthly" | "daily";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "monthly", label: "Havi nézet", icon: <BarChart3 size={15} /> },
  { key: "daily",   label: "Napi nézet",  icon: <Calendar size={15} /> },
];

export default function ReportingPage() {
  const [tab, setTab] = useState<Tab>("monthly");

  return (
    <div className="space-y-6" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>
          Riportok
        </p>
        <h1 className="text-2xl font-bold" style={{ color: "#1E293B" }}>
          Profit & Loss
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Bevételek, kiadások és profit szcenárió szerint
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-white w-fit" style={{ border: "1px solid #E2E8F0" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === t.key ? "#35BD78" : "transparent",
              color: tab === t.key ? "white" : "#64748B",
            }}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "monthly" ? <MonthlyView /> : <DailyView />}
    </div>
  );
}
