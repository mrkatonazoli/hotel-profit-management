"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip as ReTooltip,
  ReferenceLine, Cell,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const HU_MONTHS = [
  "Január","Február","Március","Április","Május","Június",
  "Július","Augusztus","Szeptember","Október","November","December",
];

const HU_MONTHS_SHORT = ["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Sze","Okt","Nov","Dec"];

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthData = {
  id: string;
  month: number;
  adr: number;
  occupancyPct: number;
  roomRevenue: number;
  monthlyCost: number;
};

type CostBand = { fromOccPct: number; toOccPct: number; costPerRoom: number };

type ShareData = {
  plan: { id: string; name: string; year: number; shareSummary: string | null; shareExpiresAt: string | null };
  hotel: { name: string; totalRooms: number | null };
  months: MonthData[];
  settings: { tfhEnabled: boolean; tfhRate: number; costBands: CostBand[] };
};

type MonthCalc = {
  month: number;
  daysInMonth: number;
  roomNights: number;
  revenue: number;
  cost: number;
  tfh: number;
  profit: number;
  margin: number | null;
  breakeven: number | null;
  hasData: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return Math.round(n).toLocaleString("hu-HU"); }
function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString("hu-HU", { maximumFractionDigits: 0 })} E`;
  return fmt(n);
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function getCostFromBands(occupancyPct: number, costBands: CostBand[]): number | null {
  if (costBands.length === 0) return null;
  const band = costBands.find(b => occupancyPct >= b.fromOccPct && occupancyPct <= b.toOccPct);
  return band ? band.costPerRoom : null;
}

function computeMonthCalc(m: MonthData, totalRooms: number, year: number, tfhRate: number, costBands: CostBand[]): MonthCalc {
  const days = getDaysInMonth(m.month, year);
  const availableNights = totalRooms * days;
  const hasData = m.adr > 0 || m.occupancyPct > 0 || m.roomRevenue > 0 || m.monthlyCost > 0;
  const roomNights = (m.occupancyPct / 100) * availableNights;
  const effectiveCost = m.monthlyCost > 0 ? m.monthlyCost : (getCostFromBands(m.occupancyPct, costBands) ?? 0);
  const revenue = m.roomRevenue > 0 ? m.roomRevenue * roomNights : roomNights * m.adr;
  const cost = effectiveCost * roomNights;
  const tfh = revenue * (tfhRate / 100);
  const profit = revenue - cost - tfh;
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;
  const netRevenue = revenue - tfh;
  const unitRate = m.roomRevenue > 0 ? m.roomRevenue : m.adr;
  const breakeven = netRevenue > 0 && m.occupancyPct > 0
    ? (cost / netRevenue) * m.occupancyPct
    : unitRate > 0 && effectiveCost > 0
    ? (effectiveCost / (unitRate * (1 - tfhRate / 100))) * 100
    : null;
  return { month: m.month, daysInMonth: days, roomNights, revenue, cost, tfh, profit, margin, breakeven, hasData };
}

function profitColor(p: number) {
  if (p > 0) return "#10B981";
  if (p === 0) return "#94A3B8";
  return "#EF4444";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 16, padding: "16px 20px", backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: "white", margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ─── Chart Tooltips ───────────────────────────────────────────────────────────

function ChartTooltipRevenue({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 16px #0001" }}>
      <p style={{ fontWeight: 700, color: "#0F172A", margin: "0 0 6px", fontSize: 13 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ margin: "2px 0", fontSize: 12, color: p.color, fontWeight: 600 }}>
          {p.dataKey === "revenue" ? "Bevétel" : "Profit"}: {fmtM(p.value)} Ft
        </p>
      ))}
    </div>
  );
}

function ChartTooltipOcc({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 16px #0001" }}>
      <p style={{ fontWeight: 700, color: "#0F172A", margin: "0 0 6px", fontSize: 13 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ margin: "2px 0", fontSize: 12, color: p.color, fontWeight: 600 }}>
          {p.dataKey === "occ" ? "Kihasználtság" : "Fedezeti pont"}: {Math.round(p.value)}%
        </p>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not_found" | "expired" | null>(null);
  const [simOffset, setSimOffset] = useState(0);

  useEffect(() => {
    fetch(`/api/public/share/${token}`)
      .then(async res => {
        if (res.status === 410) { setError("expired"); return; }
        if (!res.ok) { setError("not_found"); return; }
        const json = await res.json() as ShareData;
        setData(json);
      })
      .catch(() => setError("not_found"))
      .finally(() => setLoading(false));
  }, [token]);

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, border: "3px solid rgba(124,58,237,0.3)",
            borderTopColor: "#7C3AED", borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Prezentáció betöltése...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ─── Error states ─────────────────────────────────────────────────────────

  if (error === "expired") {
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: "rgba(239,68,68,0.2)",
            border: "1px solid rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 28,
          }}>
            ⏰
          </div>
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>
            Ez a link lejárt
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "0 0 24px" }}>
            A megosztott prezentáció érvényessége lejárt. Kérd a szálloda munkatársait egy új link küldéséért.
          </p>
          <p style={{ color: "rgba(124,58,237,0.8)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>
            HOTEL PROFIT
          </p>
        </div>
      </div>
    );
  }

  if (error === "not_found" || !data) {
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: "rgba(100,116,139,0.2)",
            border: "1px solid rgba(100,116,139,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 28,
          }}>
            🔒
          </div>
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>
            A prezentáció nem elérhető
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "0 0 24px" }}>
            Ez a megosztási link nem érvényes vagy már visszavonták.
          </p>
          <p style={{ color: "rgba(124,58,237,0.8)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>
            HOTEL PROFIT
          </p>
        </div>
      </div>
    );
  }

  // ─── Calculations ─────────────────────────────────────────────────────────

  const { plan, hotel, months, settings } = data;
  const totalRooms = hotel.totalRooms ?? 0;
  const effectiveTfhRate = settings.tfhEnabled ? settings.tfhRate : 0;

  const monthsWithBands = months.map(m => {
    if (m.monthlyCost > 0) return m;
    const bandCost = getCostFromBands(m.occupancyPct, settings.costBands);
    return bandCost !== null ? { ...m, monthlyCost: bandCost } : m;
  });

  const calcs: MonthCalc[] = monthsWithBands.map(m =>
    computeMonthCalc(m, totalRooms, plan.year, effectiveTfhRate, settings.costBands)
  );
  const filledCalcs = calcs.filter(c => c.hasData);

  const annualRevenue = calcs.reduce((s, c) => s + c.revenue, 0);
  const annualCost = calcs.reduce((s, c) => s + c.cost, 0);
  const annualTfh = calcs.reduce((s, c) => s + c.tfh, 0);
  const annualProfit = annualRevenue - annualCost - annualTfh;
  const avgOcc = filledCalcs.length > 0
    ? filledCalcs.reduce((s, c) => s + (months.find(m => m.month === c.month)?.occupancyPct ?? 0), 0) / filledCalcs.length
    : 0;

  const annualNetRevenue = annualRevenue - annualTfh;
  const annualBreakeven = (annualNetRevenue > 0 && avgOcc > 0)
    ? (annualCost / annualNetRevenue) * avgOcc
    : null;

  const isSimActive = simOffset !== 0;
  const simMonths = months.map(m => ({
    ...m,
    occupancyPct: Math.min(100, Math.max(0, m.occupancyPct + simOffset)),
  }));
  const simCalcs: MonthCalc[] = simMonths.map(m =>
    computeMonthCalc(m, totalRooms, plan.year, effectiveTfhRate, settings.costBands)
  );
  const simFilledCalcs = simCalcs.filter(c => c.hasData);
  const simAnnualRevenue = simCalcs.reduce((s, c) => s + c.revenue, 0);
  const simAnnualTfh = simCalcs.reduce((s, c) => s + c.tfh, 0);
  const simAnnualProfit = simAnnualRevenue - annualCost - simAnnualTfh;
  const simAvgOcc = simFilledCalcs.length > 0
    ? simFilledCalcs.reduce((s, c) => s + (simMonths.find(m => m.month === c.month)?.occupancyPct ?? 0), 0) / simFilledCalcs.length
    : 0;

  const deltaRevenue = simAnnualRevenue - annualRevenue;
  const deltaProfit = simAnnualProfit - annualProfit;

  const chartData = calcs.map((c, i) => ({
    name: HU_MONTHS_SHORT[c.month - 1],
    revenue: Math.round(isSimActive ? simCalcs[i].revenue : c.revenue),
    profit: Math.round(isSimActive ? simCalcs[i].profit : c.profit),
    occ: isSimActive ? simMonths[i].occupancyPct : (months.find(m => m.month === c.month)?.occupancyPct ?? 0),
    breakeven: c.breakeven !== null ? Math.round(c.breakeven) : null,
    hasData: c.hasData,
  }));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)" }}>

      {/* ── Header bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10,
        background: "rgba(15,23,42,0.8)",
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "white", margin: 0, lineHeight: 1 }}>
            {hotel.name}
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "3px 0 0" }}>
            {plan.name} · {plan.year}
          </p>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(124,58,237,0.8)", letterSpacing: "0.1em" }}>
          HOTEL PROFIT
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* ── Summary card ── */}
        {plan.shareSummary && (
          <div style={{
            background: "white", borderRadius: 20, padding: "24px 28px",
            marginBottom: 28, borderLeft: "5px solid #7C3AED",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#7C3AED", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Terv összefoglalója
            </h2>
            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
              {plan.shareSummary}
            </p>
          </div>
        )}

        {/* ── KPI cards ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: settings.tfhEnabled ? "repeat(4, 1fr)" : "repeat(3, 1fr)",
          gap: 14, marginBottom: 28,
        }}>
          <KpiCard
            label="Éves bevétel"
            value={`${fmtM(isSimActive ? simAnnualRevenue : annualRevenue)} Ft`}
            color="#3B82F6"
            sub={totalRooms ? `${totalRooms} szoba alapján` : undefined}
          />
          {settings.tfhEnabled && (
            <KpiCard
              label={`TFH (${settings.tfhRate}%)`}
              value={`−${fmtM(isSimActive ? simAnnualTfh : annualTfh)} Ft`}
              color="#EF4444"
            />
          )}
          <KpiCard
            label="Éves profit"
            value={`${(isSimActive ? simAnnualProfit : annualProfit) >= 0 ? "+" : ""}${fmtM(isSimActive ? simAnnualProfit : annualProfit)} Ft`}
            color={profitColor(isSimActive ? simAnnualProfit : annualProfit)}
            sub={(isSimActive ? simAnnualRevenue : annualRevenue) > 0
              ? `${Math.round((isSimActive ? simAnnualProfit : annualProfit) / (isSimActive ? simAnnualRevenue : annualRevenue) * 100)}% margin`
              : undefined}
          />
          <KpiCard
            label="Átl. kihasználtság"
            value={`${Math.round(isSimActive ? simAvgOcc : avgOcc)}%`}
            color="#7C3AED"
            sub={filledCalcs.length > 0 ? `${filledCalcs.length} hónap alapján` : "nincs adat"}
          />
        </div>

        {/* ── Simulator ── */}
        <div style={{
          background: isSimActive ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${isSimActive ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 20, padding: "20px 24px", marginBottom: 28,
          transition: "all 0.2s",
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "white", margin: "0 0 4px" }}>
            Foglaltsági szimulátor
          </h2>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 20px" }}>
            Húzd a csúszkát az előrejelzés szimulálásához
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: isSimActive ? 20 : 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>
              Kihasználtság módosítás:
            </span>
            <div style={{ flex: 1 }}>
              <input
                type="range"
                min={-30}
                max={30}
                step={1}
                value={simOffset}
                onChange={e => setSimOffset(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#7C3AED", cursor: "pointer", height: 6 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>-30%</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>0%</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>+30%</span>
              </div>
            </div>
            <div style={{
              minWidth: 64, textAlign: "center",
              background: isSimActive ? "#7C3AED" : "rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "6px 12px",
              fontSize: 16, fontWeight: 800,
              color: "white",
              transition: "all 0.2s",
            }}>
              {simOffset > 0 ? "+" : ""}{simOffset}%
            </div>
            {isSimActive && (
              <button
                onClick={() => setSimOffset(0)}
                style={{
                  background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                  color: "#FCA5A5", fontSize: 12, fontWeight: 600,
                }}
              >
                Reset
              </button>
            )}
          </div>

          {isSimActive && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              <div style={{
                background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 18px",
                border: `1px solid ${deltaRevenue >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                  Bevétel változás
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, color: deltaRevenue >= 0 ? "#10B981" : "#EF4444", margin: 0 }}>
                  {deltaRevenue >= 0 ? "+" : ""}{fmtM(deltaRevenue)} Ft
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                  {fmtM(annualRevenue)} → {fmtM(simAnnualRevenue)} Ft
                </p>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 18px",
                border: `1px solid ${deltaProfit >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                  Profit változás
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, color: deltaProfit >= 0 ? "#10B981" : "#EF4444", margin: 0 }}>
                  {deltaProfit >= 0 ? "+" : ""}{fmtM(deltaProfit)} Ft
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                  {fmtM(annualProfit)} → {fmtM(simAnnualProfit)} Ft
                </p>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 18px",
                border: `1px solid ${simAnnualProfit >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                  Kihasználtság (avg)
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#A78BFA", margin: 0 }}>
                  {Math.round(simAvgOcc)}%
                </p>
                {annualBreakeven !== null && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                    fedezeti pont: {Math.round(annualBreakeven)}%
                    {simAvgOcc >= annualBreakeven
                      ? ` ✓ +${Math.round(simAvgOcc - annualBreakeven)} pp`
                      : ` ✗ ${Math.round(annualBreakeven - simAvgOcc)} pp hiányzik`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Charts ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 28 }}>
          {/* Revenue & Profit */}
          <div style={{
            background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
            padding: "20px 20px 12px",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
              Bevétel &amp; Profit
              {isSimActive && <span style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", background: "#F5F3FF", padding: "3px 8px", borderRadius: 6, marginLeft: 10 }}>SZIMULÁCIÓ</span>}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={2} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => fmtM(v)} width={50} />
                <ReTooltip content={<ChartTooltipRevenue />} />
                <ReferenceLine y={0} stroke="#E2E8F0" />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} opacity={0.9}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hasData ? (isSimActive ? "#7C3AED" : "#3B82F6") : "#E2E8F0"} />
                  ))}
                </Bar>
                <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.85}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hasData ? (entry.profit >= 0 ? "#10B981" : "#EF4444") : "#E2E8F0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: isSimActive ? "#7C3AED" : "#3B82F6" }} />
                <span style={{ fontSize: 11, color: "#64748B" }}>Bevétel</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "#10B981" }} />
                <span style={{ fontSize: 11, color: "#64748B" }}>Profit</span>
              </div>
            </div>
          </div>

          {/* Occupancy & Breakeven */}
          <div style={{
            background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
            padding: "20px 20px 12px",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
              Kihasználtság &amp; Fedezeti pont
              {isSimActive && <span style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", background: "#F5F3FF", padding: "3px 8px", borderRadius: 6, marginLeft: 10 }}>SZIMULÁCIÓ</span>}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={2} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={36} />
                <ReTooltip content={<ChartTooltipOcc />} />
                <Bar dataKey="occ" fill="#7C3AED" radius={[4, 4, 0, 0]} opacity={0.85}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hasData ? "#7C3AED" : "#E2E8F0"} />
                  ))}
                </Bar>
                {annualBreakeven !== null && (
                  <ReferenceLine
                    y={annualBreakeven}
                    stroke="#EF4444"
                    strokeDasharray="5 3"
                    strokeWidth={1.5}
                    label={{ value: `BE: ${Math.round(annualBreakeven)}%`, position: "insideTopRight", fill: "#EF4444", fontSize: 10, fontWeight: 700 }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "#7C3AED" }} />
                <span style={{ fontSize: 11, color: "#64748B" }}>Kihasználtság %</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 16, height: 2, background: "#EF4444", borderRadius: 1 }} />
                <span style={{ fontSize: 11, color: "#64748B" }}>Fedezeti pont</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Monthly table ── */}
        <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 20, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>Havi eredmények</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700, fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {[
                    { label: "Hónap", align: "left" },
                    { label: "Kihasználtság", align: "right" },
                    { label: "Szobaéj", align: "right" },
                    { label: "Bevétel", align: "right" },
                    { label: "Összes kiadás", align: "right" },
                    ...(settings.tfhEnabled ? [{ label: `TFH (${settings.tfhRate}%)`, align: "right" }] : []),
                    { label: "Profit", align: "right" },
                    { label: "Margin %", align: "right" },
                    { label: "Fedezeti pont %", align: "right" },
                  ].map(h => (
                    <th key={h.label} style={{
                      padding: "10px 16px", textAlign: h.align as "left" | "right",
                      fontSize: 11, fontWeight: 600, color: "#94A3B8",
                      textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(isSimActive ? simCalcs : calcs).map((c, _i) => {
                  const displayMonths = isSimActive ? simMonths : months;
                  const m = displayMonths.find(m => m.month === c.month)!;
                  return (
                    <tr key={c.month} style={{ borderBottom: "1px solid #F8FAFC", opacity: c.hasData ? 1 : 0.35 }}>
                      <td style={{ padding: "9px 16px", fontWeight: 600, color: "#0F172A" }}>
                        {HU_MONTHS[c.month - 1]}
                      </td>
                      <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#334155" }}>
                        {c.hasData ? `${m.occupancyPct}%` : "—"}
                      </td>
                      <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#334155" }}>
                        {c.hasData ? fmt(c.roomNights) : "—"}
                      </td>
                      <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#334155" }}>
                        {c.hasData ? `${fmtM(c.revenue)} Ft` : "—"}
                      </td>
                      <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8" }}>
                        {c.hasData ? fmtM(c.cost) : "—"}
                      </td>
                      {settings.tfhEnabled && (
                        <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.hasData && c.tfh > 0 ? "#EF4444" : "#CBD5E1" }}>
                          {c.hasData && c.tfh > 0 ? `−${fmtM(c.tfh)}` : "—"}
                        </td>
                      )}
                      <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: c.hasData ? profitColor(c.profit) : "#CBD5E1" }}>
                        {c.hasData ? `${c.profit >= 0 ? "+" : ""}${fmtM(c.profit)}` : "—"}
                      </td>
                      <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.margin !== null ? (c.margin >= 0 ? "#10B981" : "#EF4444") : "#CBD5E1" }}>
                        {c.margin !== null ? `${Math.round(c.margin)}%` : "—"}
                      </td>
                      <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.breakeven !== null ? "#64748B" : "#CBD5E1" }}>
                        {c.breakeven !== null ? `${Math.round(c.breakeven)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 700, fontSize: 12, color: "#64748B", textTransform: "uppercase" }}>
                    Éves összesen
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#7C3AED" }}>
                    {Math.round(isSimActive ? simAvgOcc : avgOcc)}% avg
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#0F172A" }}>
                    {fmt((isSimActive ? simCalcs : calcs).reduce((s, c) => s + c.roomNights, 0))}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#0F172A" }}>
                    {fmtM(isSimActive ? simAnnualRevenue : annualRevenue)} Ft
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748B" }}>
                    {fmtM(annualCost)}
                  </td>
                  {settings.tfhEnabled && (
                    <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#EF4444" }}>
                      −{fmtM(isSimActive ? simAnnualTfh : annualTfh)}
                    </td>
                  )}
                  <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: profitColor(isSimActive ? simAnnualProfit : annualProfit) }}>
                    {(isSimActive ? simAnnualProfit : annualProfit) >= 0 ? "+" : ""}{fmtM(isSimActive ? simAnnualProfit : annualProfit)}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: profitColor(isSimActive ? simAnnualProfit : annualProfit) }}>
                    {(isSimActive ? simAnnualRevenue : annualRevenue) > 0
                      ? `${Math.round((isSimActive ? simAnnualProfit : annualProfit) / (isSimActive ? simAnnualRevenue : annualRevenue) * 100)}%`
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#94A3B8" }}>
                    {annualBreakeven !== null ? `${Math.round(annualBreakeven)}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: "center", paddingTop: 12 }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>
            Ez egy megosztott előrejelzés — módosítás nem lehetséges
          </p>
          {plan.shareExpiresAt && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "0 0 8px" }}>
              Érvényes: {new Date(plan.shareExpiresAt).toLocaleDateString("hu-HU")}
            </p>
          )}
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(124,58,237,0.6)", letterSpacing: "0.1em", margin: 0 }}>
            Powered by Hotel Profit
          </p>
        </div>
      </div>
    </div>
  );
}
