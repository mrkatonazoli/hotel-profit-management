"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Loader2, TrendingUp, TrendingDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioRef = { id: string; name: string; year: number; probability: number; isBase: boolean };

type DayData = {
  date: string; dayOfWeek: number; dayName: string; dayNameShort: string; hasData: boolean;
  occupancyPct?: number; adr?: number; roomNights?: number; freeRooms?: number;
  roomRevenue?: number; fbRevenue?: number; spaRevenue?: number; otherRevenue?: number; totalRevenue?: number;
  costs?: { fixed: number; variable: number; staff: number; lab: number; distributor: number; total: number };
  profit?: number; profitPct?: number;
};

type RoomTypeBreakdown = {
  roomTypeId: string; roomTypeName: string; totalCapacity: number;
  roomsOccupied: number; occupancyPct: number; adultCount: number; childCount: number;
  boardTypes: { boardType: string; roomCount: number; adultCount: number; childCount: number }[];
};
type BoardTypeBreakdown = {
  boardType: string; adultCount: number; totalGuests: number;
  childCounts: { ageGroupId: string; name: string; minAge: number; maxAge: number; count: number }[];
};

type DayDetail = DayData & {
  breakEvenOccupancy: number; breakEvenRooms: number;
  variableCostPerRoom: number; fixedCostPerDay: number; aboveBreakEven: number;
  historicalPickup: { snapshotDate: string; roomsSold: number; adr: number }[];
  roomTypeBreakdown: RoomTypeBreakdown[];
  boardTypeBreakdown: BoardTypeBreakdown[];
};

type MonthData = {
  hotel: { name: string; totalRooms: number; currency: string };
  scenario: ScenarioRef;
  scenarios: ScenarioRef[];
  year: number; month: number; daysInMonth: number; offset: number;
  days: DayData[];
  dayDetail: DayDetail | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HU_MONTHS = ["Január","Február","Március","Április","Május","Június",
  "Július","Augusztus","Szeptember","Október","November","December"];
const HU_DOW = ["H","K","Sze","Cs","P","Szo","V"];

function fmt(n: number) { return Math.round(n).toLocaleString("hu-HU"); }
function fmtM(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${(n / 1_000).toLocaleString("hu-HU", { maximumFractionDigits: 0 })} E`;
  return fmt(n);
}
const BT_LABELS: Record<string, string> = { RO: "Csak szoba", BB: "Reggeli", HB: "Félpanzió", FB: "Teljes panzió", AI: "All inclusive" };
const BT_COLORS: Record<string, string> = { RO: "#64748B", BB: "#7C3AED", HB: "#3B82F6", FB: "#10B981", AI: "#F59E0B" };

function occColor(o: number) {
  if (o >= 85) return "#10B981";
  if (o >= 65) return "#7C3AED";
  if (o >= 45) return "#F59E0B";
  return "#EF4444";
}
function probColor(p: number) {
  if (p >= 70) return { bg: "#D1FAE5", text: "#059669" };
  if (p >= 40) return { bg: "#FEF3C7", text: "#D97706" };
  return { bg: "#FEE2E2", text: "#DC2626" };
}

// ─── Break-even chart (SVG) ───────────────────────────────────────────────────

function BreakEvenChart({ detail, totalRooms, currency }: { detail: DayDetail; totalRooms: number; currency: string }) {
  const { adr, fixedCostPerDay, variableCostPerRoom, breakEvenOccupancy, occupancyPct } = detail;
  const A = adr ?? 0;
  const F = fixedCostPerDay;
  const V = variableCostPerRoom;

  // Revenue at 100% occ
  const maxRev = A * totalRooms;
  // Total cost at 100% occ
  const maxCost = F + V * totalRooms;
  const yMax = Math.max(maxRev, maxCost, 1);

  const W = 432; const H = 160;
  const PAD = { l: 44, r: 12, t: 10, b: 30 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;

  const xOf = (pct: number) => PAD.l + (pct / 100) * cW;
  const yOf = (val: number) => PAD.t + cH - (val / yMax) * cH;

  const beX = xOf(breakEvenOccupancy ?? 0);
  const beY = yOf(F + V * (breakEvenOccupancy / 100 * totalRooms));
  const currX = xOf(occupancyPct ?? 0);

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {/* Grid */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + cH} stroke="#E2E8F0" strokeWidth={1} />
      <line x1={PAD.l} y1={PAD.t + cH} x2={PAD.l + cW} y2={PAD.t + cH} stroke="#E2E8F0" strokeWidth={1} />
      {ticks.filter(t => t > 0).map(t => (
        <g key={t}>
          <line x1={PAD.l} y1={yOf(yMax * t)} x2={PAD.l + cW} y2={yOf(yMax * t)}
            stroke="#E2E8F0" strokeWidth={0.5} strokeDasharray="4,4" />
          <text x={PAD.l - 4} y={yOf(yMax * t) + 3} textAnchor="end" fontSize={8} fill="#94A3B8">
            {fmtM(yMax * t)}
          </text>
        </g>
      ))}
      {[0, 20, 40, 60, 80, 100].map(p => (
        <text key={p} x={xOf(p)} y={PAD.t + cH + 12} textAnchor="middle" fontSize={8} fill="#94A3B8">
          {p}%
        </text>
      ))}

      {/* Loss zone */}
      {breakEvenOccupancy > 0 && (
        <rect x={PAD.l} y={yOf(F)} width={beX - PAD.l} height={cH - (yOf(F) - PAD.t)}
          fill="#EF444408" />
      )}

      {/* Fixed cost line */}
      <line x1={PAD.l} y1={yOf(F)} x2={PAD.l + cW} y2={yOf(F)}
        stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4,4" opacity={0.7} />
      <text x={PAD.l + cW + 2} y={yOf(F) + 3} fontSize={7} fill="#F59E0B">Fix</text>

      {/* Total cost line */}
      <line
        x1={PAD.l} y1={yOf(F)}
        x2={PAD.l + cW} y2={yOf(F + V * totalRooms)}
        stroke="#F97316" strokeWidth={1.5} strokeDasharray="6,3" />

      {/* Revenue line */}
      <line x1={PAD.l} y1={PAD.t + cH} x2={PAD.l + cW} y2={yOf(maxRev)}
        stroke="#7C3AED" strokeWidth={2.5} strokeLinecap="round" />

      {/* Break-even */}
      {breakEvenOccupancy > 0 && breakEvenOccupancy <= 100 && (
        <>
          <line x1={beX} y1={PAD.t} x2={beX} y2={PAD.t + cH}
            stroke="#10B981" strokeWidth={1.5} strokeDasharray="5,3" />
          <circle cx={beX} cy={beY} r={5} fill="#10B981" stroke="white" strokeWidth={2} />
          <rect x={beX - 47} y={PAD.t - 2} width={94} height={16} rx={4} fill="#10B981" />
          <text x={beX} y={PAD.t + 9} textAnchor="middle" fontSize={9} fontWeight={700} fill="white">
            Break-even: {breakEvenOccupancy}%
          </text>
        </>
      )}

      {/* Current occupancy */}
      {(occupancyPct ?? 0) > 0 && (
        <>
          <line x1={currX} y1={PAD.t} x2={currX} y2={PAD.t + cH}
            stroke="#7C3AED" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
          <rect x={currX - 22} y={PAD.t - 2} width={44} height={14} rx={4}
            fill="#7C3AED" opacity={0.15} />
          <text x={currX} y={PAD.t + 8} textAnchor="middle" fontSize={8} fontWeight={700} fill="#7C3AED">
            Terv: {occupancyPct}%
          </text>
        </>
      )}
    </svg>
  );
}

// ─── Revenue breakdown bars ───────────────────────────────────────────────────

function RevBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
          <span className="text-xs" style={{ color: "#475569" }}>{label}</span>
        </div>
        <span className="text-xs font-semibold font-mono" style={{ color: "#1E293B" }}>{fmt(value)} Ft</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "#F1F5F9" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

function SidePanel({
  detail, totalRooms, currency, onClose,
}: {
  detail: DayDetail; totalRooms: number; currency: string; onClose: () => void;
}) {
  const [strategy, setStrategy] = useState<"adr" | "volume">("adr");
  const [volPrice, setVolPrice] = useState(detail.adr ? Math.round(detail.adr * 0.65) : 20000);

  const freeRooms = detail.freeRooms ?? 0;
  const varCost   = detail.variableCostPerRoom ?? 0;
  const adr       = detail.adr ?? 0;
  const totalRev  = detail.totalRevenue ?? 0;
  const profit    = detail.profit ?? 0;
  const occ       = detail.occupancyPct ?? 0;
  const be        = detail.breakEvenOccupancy ?? 0;

  const extraRevAdr = freeRooms * adr;
  const extraVarAdr = freeRooms * varCost;
  const extraProfitAdr = extraRevAdr - extraVarAdr;

  const extraRevVol = freeRooms * volPrice;
  const extraVarVol = freeRooms * varCost;
  const extraProfitVol = extraRevVol - extraVarVol;

  const isProfit = profit >= 0;
  const aboveBe  = occ - be;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl"
      style={{ background: "white", border: "1px solid #E2E8F0", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", height: "100%" }}>

      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 flex-shrink-0"
        style={{ borderBottom: "1px solid #E2E8F0" }}>
        <div>
          <div className="text-xl font-bold" style={{ color: "#0F172A" }}>
            {new Date(detail.date + "T00:00:00Z").toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
            {", "}
            {detail.dayName}
          </div>
          <div className="text-sm mt-1" style={{ color: "#64748B" }}>
            Napi részletnézet · {totalRooms} szoba
          </div>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "#F1F5F9", border: "1px solid #E2E8F0" }}>
          <X size={14} style={{ color: "#64748B" }} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-px" style={{ borderBottom: "1px solid #E2E8F0", background: "#E2E8F0" }}>
          {[
            { label: "Bevétel", value: `${fmtM(totalRev)} Ft`, color: "#7C3AED" },
            { label: "Kihasználtság", value: `${occ}%`, color: occColor(occ) },
            { label: "Profit", value: `${isProfit ? "+" : ""}${fmtM(profit)} Ft`, color: isProfit ? "#059669" : "#DC2626" },
          ].map(k => (
            <div key={k.label} className="bg-white px-4 py-4 text-center">
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#94A3B8" }}>{k.label}</div>
              <div className="text-lg font-bold font-mono leading-tight" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Profitability / Break-even */}
        <div className="px-6 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: "#1E293B" }}>⚖️ Profitabilitás görbe</h3>
            <span className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{ background: "#D1FAE5", color: "#065F46" }}>Break-even</span>
          </div>
          <p className="text-xs mb-3" style={{ color: "#64748B" }}>
            A nap{" "}
            <strong style={{ color: "#10B981" }}>{be}% kihasználtságnál</strong> válik nyereségessé.
          </p>
          <BreakEvenChart detail={detail} totalRooms={totalRooms} currency={currency} />
          <div className="flex flex-wrap gap-3 mt-3">
            {[
              { color: "#7C3AED", label: "Bevétel", dash: false },
              { color: "#F97316", label: "Összes ktg.", dash: true },
              { color: "#F59E0B", label: "Fix ktg.", dash: true },
              { color: "#10B981", label: "Break-even", dash: false },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <svg width={18} height={3}>
                  <line x1={0} y1={1.5} x2={18} y2={1.5}
                    stroke={l.color} strokeWidth={l.dash ? 1.5 : 2.5}
                    strokeDasharray={l.dash ? "4,2" : undefined} />
                </svg>
                <span className="text-xs" style={{ color: "#64748B" }}>{l.label}</span>
              </div>
            ))}
          </div>
          {/* Profit summary */}
          <div className="mt-4 p-3 rounded-xl flex justify-between items-center"
            style={{ background: isProfit ? "#D1FAE5" : "#FEE2E2" }}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: isProfit ? "#065F46" : "#991B1B" }}>
                Tervezett profit ({occ}%)
              </div>
              <div className="text-lg font-bold font-mono mt-1" style={{ color: isProfit ? "#065F46" : "#991B1B" }}>
                {isProfit ? "+" : ""}{fmt(profit)} Ft
              </div>
            </div>
            {aboveBe > 0 && (
              <div className="text-right">
                <div className="text-xs" style={{ color: "#065F46" }}>Break-even felett</div>
                <div className="text-sm font-bold" style={{ color: "#065F46" }}>+{Math.round(aboveBe)} pp</div>
              </div>
            )}
          </div>
        </div>

        {/* Potenciál elemzés */}
        {freeRooms > 0 && (
          <div className="px-6 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: "#1E293B" }}>🎯 Potenciál elemzés</h3>
              <span className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{ background: "#DBEAFE", color: "#1E40AF" }}>Marginális profit</span>
            </div>

            {/* Capacity bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "#64748B" }}>
                <span>Szobafoglaltság ({totalRooms} szobából)</span>
                <span className="font-bold" style={{ color: "#1E293B" }}>{detail.roomNights} / {totalRooms}</span>
              </div>
              <div className="h-3.5 rounded-full overflow-hidden flex" style={{ background: "#F1F5F9" }}>
                <div style={{ width: `${be}%`, background: "#F59E0B" }} title="Fix ktg. fedezi" />
                <div style={{ width: `${Math.max(occ - be, 0)}%`, background: "#7C3AED" }} title="Profit zóna" />
                <div style={{ flex: 1, background: "#E2E8F0" }} />
              </div>
              <div className="flex gap-4 mt-2">
                {[
                  { color: "#F59E0B", label: "Fix ktg. fedez" },
                  { color: "#7C3AED", label: "Profit zóna" },
                  { color: "#E2E8F0", label: `${freeRooms} szabad szoba` },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                    <span className="text-xs" style={{ color: "#64748B" }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategy selector */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { key: "adr" as const, emoji: "📈", title: "ADR stratégia", sub: "Tartja az árat" },
                { key: "volume" as const, emoji: "🎯", title: "Volumen stratégia", sub: "Tölt, alacsonyabb áron" },
              ].map(s => {
                const active = strategy === s.key;
                return (
                  <button key={s.key} onClick={() => setStrategy(s.key)}
                    className="p-3 rounded-xl text-center transition-all"
                    style={{
                      background: active ? (s.key === "adr" ? "#EDE9FE" : "#EFF6FF") : "#F8FAFC",
                      border: `2px solid ${active ? (s.key === "adr" ? "#7C3AED" : "#3B82F6") : "#E2E8F0"}`,
                    }}>
                    <div className="text-base mb-1">{s.emoji}</div>
                    <div className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: active ? (s.key === "adr" ? "#7C3AED" : "#1E40AF") : "#94A3B8" }}>
                      {s.title}
                    </div>
                    <div className="text-xs mt-0.5"
                      style={{ color: active ? (s.key === "adr" ? "#7C3AED" : "#1E40AF") : "#94A3B8" }}>
                      {s.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            {strategy === "adr" ? (
              <div className="rounded-xl p-4" style={{ background: "#EDE9FE", border: "1px solid #C4B5FD" }}>
                <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#7C3AED" }}>
                  📈 ADR stratégia — Tartja az árat
                </div>
                {[
                  { label: "Fennmaradó szobák", value: `${freeRooms} szoba` },
                  { label: "Értékesítési ár", value: `${fmt(adr)} Ft / szoba` },
                  { label: "Extra bevétel", value: `+${fmt(extraRevAdr)} Ft`, color: "#7C3AED" },
                  { label: `Változó ktg. (${freeRooms} × ${fmt(varCost)} Ft)`, value: `−${fmt(extraVarAdr)} Ft`, color: "#7C3AED" },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-xs py-1">
                    <span style={{ color: "#5B21B6" }}>{r.label}</span>
                    <strong style={{ color: r.color ?? "#5B21B6" }}>{r.value}</strong>
                  </div>
                ))}
                <div className="flex justify-between pt-2 mt-1" style={{ borderTop: "1px solid #C4B5FD" }}>
                  <strong className="text-xs" style={{ color: "#5B21B6" }}>Extra profit</strong>
                  <strong className="text-base" style={{ color: "#059669" }}>+{fmt(extraProfitAdr)} Ft</strong>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-4" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#1E40AF" }}>
                  🎯 Volumen stratégia — Célzott ár
                </div>
                <div className="flex items-center gap-2 mb-3 rounded-lg p-2"
                  style={{ background: "white", border: "1.5px solid #BFDBFE" }}>
                  <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "#1E40AF" }}>
                    Célár / szoba:
                  </span>
                  <input type="number" value={volPrice} min={5000} max={adr} step={500}
                    onChange={e => setVolPrice(parseInt(e.target.value) || 0)}
                    className="flex-1 border-0 outline-none text-right font-bold text-sm bg-transparent font-mono"
                    style={{ color: "#1E40AF" }} />
                  <span className="text-sm font-semibold" style={{ color: "#1E40AF" }}>Ft</span>
                </div>
                {[
                  { label: "Extra bevétel", value: `+${fmt(extraRevVol)} Ft`, color: "#1E40AF" },
                  { label: `Változó ktg. (${freeRooms} × ${fmt(varCost)} Ft)`, value: `−${fmt(extraVarVol)} Ft`, color: "#1E40AF" },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-xs py-1">
                    <span style={{ color: "#1E40AF" }}>{r.label}</span>
                    <strong style={{ color: r.color }}>{r.value}</strong>
                  </div>
                ))}
                <div className="flex justify-between pt-2 mt-1" style={{ borderTop: "1px solid #BFDBFE" }}>
                  <strong className="text-xs" style={{ color: "#1E40AF" }}>Extra profit</strong>
                  <strong className="text-base" style={{ color: extraProfitVol >= 0 ? "#059669" : "#DC2626" }}>
                    {extraProfitVol >= 0 ? "+" : ""}{fmt(extraProfitVol)} Ft
                  </strong>
                </div>
                {/* Compare */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    { label: "ADR stratégia", profit: extraProfitAdr, price: adr, bg: "white", border: "#E2E8F0", c: "#059669" },
                    { label: "Volumen stratégia", profit: extraProfitVol, price: volPrice, bg: "#EFF6FF", border: "#BFDBFE", c: "#3B82F6" },
                  ].map(r => (
                    <div key={r.label} className="rounded-lg p-2 text-center"
                      style={{ background: r.bg, border: `1px solid ${r.border}` }}>
                      <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#64748B" }}>{r.label}</div>
                      <div className="text-sm font-bold" style={{ color: r.c }}>+{fmt(r.profit)} Ft</div>
                      <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{fmt(r.price)} Ft/szoba</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Revenue breakdown */}
        <div className="px-6 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "#1E293B" }}>📊 Bevétel megoszlás</h3>
          <div className="space-y-3">
            {[
              { label: "Szobabevétel", value: detail.roomRevenue ?? 0, color: "#7C3AED" },
              { label: "Vendéglátás (F&B)", value: detail.fbRevenue ?? 0, color: "#3B82F6" },
              { label: "Spa", value: detail.spaRevenue ?? 0, color: "#10B981" },
              { label: "Egyéb", value: detail.otherRevenue ?? 0, color: "#F59E0B" },
            ].map(r => (
              <RevBar key={r.label} {...r} total={detail.totalRevenue ?? 1} />
            ))}
            <div className="flex justify-between pt-3" style={{ borderTop: "1px solid #E2E8F0" }}>
              <span className="text-sm font-bold" style={{ color: "#1E293B" }}>Összesen</span>
              <span className="text-sm font-bold font-mono" style={{ color: "#1E293B" }}>
                {fmt(detail.totalRevenue ?? 0)} Ft
              </span>
            </div>
          </div>
        </div>

        {/* Room type breakdown */}
        {detail.roomTypeBreakdown?.length > 0 && (
          <div className="px-6 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: "#1E293B" }}>🛏️ Szobatípus bontás</h3>
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                {detail.roomTypeBreakdown.reduce((s, r) => s + r.roomsOccupied, 0)} / {detail.roomTypeBreakdown.reduce((s, r) => s + r.totalCapacity, 0)} szoba
              </span>
            </div>
            <div className="space-y-4">
              {detail.roomTypeBreakdown.map(rt => {
                const occC = occColor(rt.occupancyPct);
                return (
                  <div key={rt.roomTypeId} className="rounded-xl p-3.5" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    {/* RT header */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "#0F172A" }}>{rt.roomTypeName}</div>
                        <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{rt.totalCapacity} szoba kapacitás</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold font-mono" style={{ color: occC }}>{rt.occupancyPct}%</div>
                        <div className="text-xs" style={{ color: "#94A3B8" }}>{rt.roomsOccupied} / {rt.totalCapacity} szoba</div>
                      </div>
                    </div>
                    {/* Occ bar */}
                    <div className="h-2 rounded-full mb-3 overflow-hidden" style={{ background: "#E2E8F0" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${rt.occupancyPct}%`, background: occC }} />
                    </div>
                    {/* Guests */}
                    <div className="flex gap-3">
                      <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ background: "white", border: "1px solid #E2E8F0" }}>
                        <div className="text-xs mb-0.5" style={{ color: "#94A3B8" }}>Felnőtt</div>
                        <div className="text-base font-bold" style={{ color: "#1E293B" }}>{rt.adultCount}</div>
                      </div>
                      <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ background: "white", border: "1px solid #E2E8F0" }}>
                        <div className="text-xs mb-0.5" style={{ color: "#94A3B8" }}>Gyerek</div>
                        <div className="text-base font-bold" style={{ color: "#1E293B" }}>{rt.childCount}</div>
                      </div>
                      <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ background: "white", border: "1px solid #E2E8F0" }}>
                        <div className="text-xs mb-0.5" style={{ color: "#94A3B8" }}>Összesen</div>
                        <div className="text-base font-bold" style={{ color: "#7C3AED" }}>{rt.adultCount + rt.childCount}</div>
                      </div>
                    </div>
                    {/* Board type chips for this RT */}
                    {rt.boardTypes.filter(b => b.roomCount > 0).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {rt.boardTypes.filter(b => b.roomCount > 0).map(b => (
                          <div key={b.boardType} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                            style={{ background: `${BT_COLORS[b.boardType] ?? "#64748B"}15`, border: `1px solid ${BT_COLORS[b.boardType] ?? "#64748B"}30` }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: BT_COLORS[b.boardType] ?? "#64748B" }} />
                            <span style={{ color: BT_COLORS[b.boardType] ?? "#64748B", fontWeight: 600 }}>{BT_LABELS[b.boardType] ?? b.boardType}</span>
                            <span style={{ color: "#64748B" }}>{b.roomCount} szoba</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Board type + age group breakdown */}
        {detail.boardTypeBreakdown?.length > 0 && (
          <div className="px-6 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: "#1E293B" }}>🍽️ Ellátástípus bontás</h3>
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "#D1FAE5", color: "#065F46" }}>
                {detail.boardTypeBreakdown.reduce((s, b) => s + b.totalGuests, 0)} vendég
              </span>
            </div>
            <div className="space-y-3">
              {detail.boardTypeBreakdown.map(bt => {
                const color = BT_COLORS[bt.boardType] ?? "#64748B";
                const label = BT_LABELS[bt.boardType] ?? bt.boardType;
                const totalGuests = detail.boardTypeBreakdown.reduce((s, b) => s + b.totalGuests, 0);
                const pct = totalGuests > 0 ? Math.round((bt.totalGuests / totalGuests) * 100) : 0;
                return (
                  <div key={bt.boardType} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color}25` }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3" style={{ background: `${color}10` }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                        <span className="text-sm font-bold" style={{ color }}>{label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold" style={{ color: "#64748B" }}>{pct}%</span>
                        <span className="text-sm font-bold" style={{ color: "#1E293B" }}>{bt.totalGuests} fő</span>
                      </div>
                    </div>
                    {/* Guest detail */}
                    <div className="px-4 py-3 bg-white">
                      <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: "#F1F5F9" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                          <span style={{ color: "#64748B" }}>Felnőtt</span>
                          <span className="font-bold" style={{ color: "#1E293B" }}>{bt.adultCount} fő</span>
                        </div>
                        {bt.childCounts.filter(c => c.count > 0).map(c => (
                          <div key={c.ageGroupId} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                            style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                            <span style={{ color: "#92400E" }}>{c.name} ({c.minAge}–{c.maxAge} év)</span>
                            <span className="font-bold" style={{ color: "#92400E" }}>{c.count} fő</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Total row */}
              <div className="flex justify-between items-center px-4 py-3 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <span className="text-sm font-bold" style={{ color: "#1E293B" }}>Összes vendég</span>
                <span className="text-sm font-bold font-mono" style={{ color: "#7C3AED" }}>
                  {detail.boardTypeBreakdown.reduce((s, b) => s + b.totalGuests, 0)} fő
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Cost breakdown */}
        <div className="px-6 py-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "#1E293B" }}>💸 Kiadás megoszlás</h3>
          <div className="space-y-2">
            {[
              { label: "Fix kiadás", value: detail.costs?.fixed ?? 0, color: "#64748B" },
              { label: "Változó kiadás", value: detail.costs?.variable ?? 0, color: "#F59E0B" },
              { label: "Bérköltség", value: detail.costs?.staff ?? 0, color: "#EF4444" },
              { label: "LAB", value: detail.costs?.lab ?? 0, color: "#8B5CF6" },
              { label: "Közvetítő", value: detail.costs?.distributor ?? 0, color: "#EC4899" },
            ].map(r => (
              <RevBar key={r.label} {...r} total={detail.costs?.total ?? 1} />
            ))}
            <div className="flex justify-between pt-3" style={{ borderTop: "1px solid #E2E8F0" }}>
              <span className="text-sm font-bold" style={{ color: "#1E293B" }}>Összes kiadás</span>
              <span className="text-sm font-bold font-mono" style={{ color: "#1E293B" }}>
                {fmt(detail.costs?.total ?? 0)} Ft
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Calendar cell ────────────────────────────────────────────────────────────

function CalCell({ day, selected, onClick }: { day: DayData; selected: boolean; onClick: () => void }) {
  const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
  const profit = day.profit ?? 0;
  const profitPos = profit > 0;

  return (
    <div onClick={day.hasData ? onClick : undefined}
      className="border-r border-b relative transition-all"
      style={{
        minHeight: 76,
        padding: "8px 8px 24px 8px",
        borderColor: "#E2E8F0",
        background: selected
          ? "#EDE9FE"
          : isWeekend ? "#F5F7FF" : "white",
        cursor: day.hasData ? "pointer" : "default",
        outline: selected ? "2px solid #7C3AED" : "none",
        outlineOffset: -2,
      }}>
      <div className="font-bold mb-1.5"
        style={{ fontSize: 12, color: selected ? "#7C3AED" : day.hasData ? "#334155" : "#CBD5E1" }}>
        {parseInt(day.date.slice(8))}
      </div>
      {day.hasData && (
        <>
          <div className="font-bold font-mono leading-snug"
            style={{ fontSize: 11, color: selected ? "#7C3AED" : "#0F172A" }}>
            {fmtM(day.totalRevenue ?? 0)} Ft
          </div>
          <div className="font-semibold mt-0.5"
            style={{ fontSize: 10, color: occColor(day.occupancyPct ?? 0) }}>
            {day.occupancyPct}%
          </div>
          <div className="absolute bottom-1.5 right-1.5 font-bold rounded-full px-1.5 py-0.5"
            style={{
              fontSize: 9,
              background: profitPos ? "#D1FAE5" : profit === 0 ? "#FEF3C7" : "#FEE2E2",
              color: profitPos ? "#065F46" : profit === 0 ? "#92400E" : "#991B1B",
            }}>
            {profitPos ? "+" : ""}{fmtM(profit)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const load = useCallback(async (opts?: { sid?: string; y?: number; m?: number; date?: string }) => {
    const sid  = opts?.sid  ?? selectedScenario;
    const y    = opts?.y    ?? year;
    const m    = opts?.m    ?? month;
    const date = opts?.date ?? null;

    if (date) setPanelLoading(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (sid) params.set("scenarioId", sid);
      params.set("year", String(y));
      params.set("month", String(m));
      if (date) params.set("date", date);

      const res = await fetch(`/api/analysis?${params}`);
      if (!res.ok) return;
      const d: MonthData = await res.json();
      setData(d);
      if (!sid) setSelectedScenario(d.scenario.id);
    } finally {
      setLoading(false);
      setPanelLoading(false);
    }
  }, [selectedScenario, year, month]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    load({ date });
  };

  const navigate = (dir: -1 | 1) => {
    const newMonth = month + dir;
    const newYear  = newMonth < 1 ? year - 1 : newMonth > 12 ? year + 1 : year;
    const nm       = newMonth < 1 ? 12 : newMonth > 12 ? 1 : newMonth;
    setYear(newYear); setMonth(nm); setSelectedDate(null);
    load({ y: newYear, m: nm });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );
  if (!data) return null;

  const offset = data.offset ?? 0;
  const detail = data.dayDetail;

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>
          Részletes elemzés
        </p>
        <h1 className="text-2xl font-bold" style={{ color: "#1E293B" }}>Napi részletnézet</h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Kattints egy napra a részletes profitabilitás és potenciál elemzéshez
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Scenario selector */}
        <div className="flex flex-wrap gap-2">
          {data.scenarios.map(s => {
            const active = s.id === selectedScenario;
            const pc = probColor(s.probability);
            return (
              <button key={s.id} onClick={() => { setSelectedScenario(s.id); setSelectedDate(null); load({ sid: s.id }); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: active ? "#7C3AED" : "white",
                  color: active ? "white" : "#1E293B",
                  border: `1px solid ${active ? "#7C3AED" : "#E2E8F0"}`,
                }}>
                {s.name}
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: active ? "rgba(255,255,255,0.2)" : pc.bg, color: active ? "white" : pc.text }}>
                  {s.probability}%
                </span>
                {s.isBase && <span className="opacity-70 text-xs">★</span>}
              </button>
            );
          })}
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-2 bg-white rounded-xl px-2 py-1.5" style={{ border: "1px solid #E2E8F0" }}>
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft size={16} style={{ color: "#64748B" }} />
          </button>
          <span className="text-sm font-semibold px-2" style={{ color: "#1E293B", minWidth: 160, textAlign: "center" }}>
            {HU_MONTHS[month - 1]} {year}
          </span>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight size={16} style={{ color: "#64748B" }} />
          </button>
        </div>
      </div>

      {/* Calendar + Panel */}
      <div className="flex gap-5 items-start">

        {/* Calendar */}
        <div className={`transition-all ${detail ? "flex-1" : "w-full"}`}
          style={{ minWidth: 0 }}>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
            {/* Day header */}
            <div className="grid grid-cols-7" style={{ background: "#0F172A" }}>
              {HU_DOW.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#94A3B8" }}>{d}</div>
              ))}
            </div>
            {/* Grid */}
            <div className="grid grid-cols-7 bg-white">
              {/* Offset empty cells */}
              {Array.from({ length: offset }, (_, i) => (
                <div key={`e-${i}`} className="border-r border-b min-h-16" style={{ borderColor: "#E2E8F0", background: "#FAFAFA" }} />
              ))}
              {/* Day cells */}
              {data.days.map(day => (
                <CalCell key={day.date} day={day} selected={day.date === selectedDate}
                  onClick={() => handleDayClick(day.date)} />
              ))}
              {/* Trailing empty cells */}
              {Array.from({ length: (7 - (offset + data.days.length) % 7) % 7 }, (_, i) => (
                <div key={`t-${i}`} className="border-r border-b min-h-16" style={{ borderColor: "#E2E8F0", background: "#FAFAFA" }} />
              ))}
            </div>
          </div>
          {!detail && (
            <p className="text-xs text-center mt-3" style={{ color: "#CBD5E1" }}>
              Kattints egy napra a részletes elemzéshez
            </p>
          )}
        </div>

        {/* Side panel */}
        {selectedDate && (
          <div style={{ width: 460, flexShrink: 0, maxHeight: "calc(100vh - 200px)", display: "flex" }}>
            {panelLoading ? (
              <div className="flex-1 flex items-center justify-center bg-white rounded-2xl"
                style={{ border: "1px solid #E2E8F0", minHeight: 300 }}>
                <Loader2 size={22} className="animate-spin" style={{ color: "#7C3AED" }} />
              </div>
            ) : detail ? (
              <SidePanel detail={detail} totalRooms={data.hotel.totalRooms} currency={data.hotel.currency}
                onClose={() => setSelectedDate(null)} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl p-8"
                style={{ border: "1px solid #E2E8F0" }}>
                <TrendingUp size={32} style={{ color: "#CBD5E1" }} />
                <p className="text-sm text-center" style={{ color: "#94A3B8" }}>
                  Erre a napra nincs tervezett adat
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
