"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle, Check, TrendingUp, TrendingDown, Percent, Bed } from "lucide-react";

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
  monthlyCost: number;
};

type Hotel = { id: string; name: string; totalRooms: number | null };

type Plan = {
  id: string;
  name: string;
  year: number;
  createdAt: string;
  hotel: Hotel;
  months: MonthData[];
};

type MonthCalc = {
  month: number;
  daysInMonth: number;
  roomNights: number;
  revenue: number;
  cost: number;
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

function computeMonthCalc(m: MonthData, totalRooms: number, year: number): MonthCalc {
  const days = getDaysInMonth(m.month, year);
  const hasData = m.adr > 0 || m.occupancyPct > 0 || m.monthlyCost > 0;
  const roomNights = (m.occupancyPct / 100) * totalRooms * days;
  const revenue = roomNights * m.adr;
  const cost = m.monthlyCost;
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;
  const breakeven = (m.adr > 0 && totalRooms > 0)
    ? (m.monthlyCost / (totalRooms * days * m.adr)) * 100
    : null;

  return { month: m.month, daysInMonth: days, roomNights, revenue, cost, profit, margin, breakeven, hasData };
}

function profitColor(p: number) {
  if (p > 0) return "#10B981";
  if (p === 0) return "#94A3B8";
  return "#EF4444";
}

// ─── Inline editable name ────────────────────────────────────────────────────

function EditableName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    if (val.trim() && val.trim() !== value) onSave(val.trim());
    else setVal(value);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setVal(value); } }}
        style={{
          fontSize: 22, fontWeight: 700, color: "#0F172A",
          border: "none", borderBottom: "2px solid #7C3AED", outline: "none",
          background: "transparent", padding: "0 2px", minWidth: 200,
        }}
      />
    );
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      style={{
        fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0, cursor: "text",
        borderBottom: "2px solid transparent",
      }}
      title="Kattints a névhez a szerkesztéshez"
    >
      {value}
    </h1>
  );
}

// ─── Month input cell ─────────────────────────────────────────────────────────

function MonthInput({
  label, value, onBlur, unit, step,
}: {
  label: string;
  value: number;
  onBlur: (v: number) => void;
  unit?: string;
  step?: number;
}) {
  const [local, setLocal] = useState(String(value === 0 ? "" : value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(value === 0 ? "" : String(value)); }, [value]);

  function commit() {
    const parsed = parseFloat(local.replace(",", "."));
    const v = isNaN(parsed) ? 0 : parsed;
    onBlur(v);
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ fontSize: 9, color: "#94A3B8", margin: "0 0 2px", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>
        {label}{unit ? ` (${unit})` : ""}
      </p>
      <input
        ref={ref}
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onFocus={e => e.target.select()}
        step={step ?? 1}
        placeholder="0"
        style={{
          width: "100%", boxSizing: "border-box",
          fontSize: 12, fontWeight: 600, color: "#0F172A",
          border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 6px",
          outline: "none", background: "#FAFAFA",
          fontVariantNumeric: "tabular-nums",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#A78BFA")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
        onFocusCapture={e => (e.currentTarget.style.borderColor = "#7C3AED")}
        onBlurCapture={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
      />
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, icon, sub }: {
  label: string; value: string; color: string;
  icon: React.ReactNode; sub?: string;
}) {
  return (
    <div style={{
      background: "white", border: "1px solid #E2E8F0", borderRadius: 16,
      padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#94A3B8", margin: "6px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SimplePlanDetailPage() {
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const planId = params.planId;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local month state (editable)
  const [months, setMonths] = useState<MonthData[]>([]);
  const [year, setYear] = useState(2026);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/simple-plans/${planId}`);
      if (res.ok) {
        const data: Plan = await res.json();
        setPlan(data);
        setMonths(data.months);
        setYear(data.year);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [planId]);

  function showSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }

  async function saveMonths(updatedMonths: MonthData[]) {
    await fetch(`/api/simple-plans/${planId}/months`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ months: updatedMonths.map(m => ({
        month: m.month,
        adr: m.adr,
        occupancyPct: m.occupancyPct,
        monthlyCost: m.monthlyCost,
      })) }),
    });
    showSaved();
  }

  async function saveName(name: string) {
    await fetch(`/api/simple-plans/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setPlan(p => p ? { ...p, name } : p);
    showSaved();
  }

  async function saveYear(newYear: number) {
    await fetch(`/api/simple-plans/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: newYear }),
    });
    setYear(newYear);
    showSaved();
  }

  function updateMonthField(monthNum: number, field: keyof Pick<MonthData, "adr" | "occupancyPct" | "monthlyCost">, value: number) {
    const updated = months.map(m =>
      m.month === monthNum ? { ...m, [field]: value } : m
    );
    setMonths(updated);
    saveMonths(updated);
  }

  // ─── Calculations ─────────────────────────────────────────────────────────

  const totalRooms = plan?.hotel?.totalRooms ?? 0;
  const calcs: MonthCalc[] = months.map(m => computeMonthCalc(m, totalRooms, year));
  const filledCalcs = calcs.filter(c => c.hasData);

  const annualRevenue = calcs.reduce((s, c) => s + c.revenue, 0);
  const annualCost = calcs.reduce((s, c) => s + c.cost, 0);
  const annualProfit = annualRevenue - annualCost;
  const avgOcc = filledCalcs.length > 0
    ? filledCalcs.reduce((s, c) => s + (months.find(m => m.month === c.month)?.occupancyPct ?? 0), 0) / filledCalcs.length
    : 0;
  const avgMargin = filledCalcs.filter(c => c.margin !== null).length > 0
    ? filledCalcs.filter(c => c.margin !== null).reduce((s, c) => s + (c.margin ?? 0), 0) / filledCalcs.filter(c => c.margin !== null).length
    : 0;

  // Annual breakeven: what avg occupancy % is needed to cover all costs
  // annualBreakeven = annualCost / (totalRooms * totalDays * avgAdr) * 100
  const totalDays = calcs.reduce((s, c) => s + c.daysInMonth, 0);
  const weightedAdr = filledCalcs.length > 0
    ? filledCalcs.reduce((s, c) => s + (months.find(m => m.month === c.month)?.adr ?? 0), 0) / filledCalcs.length
    : 0;
  const annualBreakeven = (totalRooms > 0 && weightedAdr > 0)
    ? (annualCost / (totalRooms * totalDays * weightedAdr)) * 100
    : null;

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );

  if (!plan) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
      <p style={{ color: "#94A3B8" }}>A terv nem található.</p>
      <button onClick={() => router.push("/simple-planner")} style={{ color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
        ← Vissza
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* ── Back link ── */}
      <button
        onClick={() => router.push("/simple-planner")}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          color: "#64748B", fontSize: 13, fontWeight: 500, marginBottom: 16, padding: 0,
        }}
      >
        <ArrowLeft size={14} /> Simple tervek
      </button>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <EditableName value={plan.name} onSave={saveName} />
          <p style={{ color: "#64748B", fontSize: 13, margin: "4px 0 0" }}>
            {plan.hotel.name} · {totalRooms ? `${totalRooms} szoba` : "szobaszám nincs megadva"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Save indicator */}
          {saved && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#10B981", fontWeight: 600 }}>
              <Check size={14} /> Mentve
            </span>
          )}

          {/* Year selector */}
          <select
            value={year}
            onChange={e => saveYear(Number(e.target.value))}
            style={{
              border: "1px solid #E2E8F0", borderRadius: 10, padding: "8px 12px",
              fontSize: 14, fontWeight: 600, color: "#0F172A", background: "white", cursor: "pointer",
            }}
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── No totalRooms warning ── */}
      {!totalRooms && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14,
          padding: "12px 16px", marginBottom: 16,
        }}>
          <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: "#92400E", margin: 0 }}>
            A szobaszám nincs beállítva — a bevétel és profit számítás 0-val dolgozik.{" "}
            <a href="/hotel-config" style={{ color: "#D97706", fontWeight: 600 }}>Hotel beállítások</a>
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION A — Input */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
        padding: "20px 20px", marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
          Havi input adatok
        </h2>

        {/* 12-column month grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 8,
          overflowX: "auto",
          minWidth: 700,
        }}>
          {months.map(m => (
            <div
              key={m.month}
              style={{
                background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10,
                padding: "8px 8px 6px",
              }}
            >
              {/* Month label */}
              <p style={{
                fontSize: 11, fontWeight: 700, color: "#7C3AED", margin: "0 0 8px",
                textAlign: "center", letterSpacing: "0.03em",
              }}>
                {HU_MONTHS_SHORT[m.month - 1]}
              </p>

              <MonthInput
                label="ADR"
                unit="Ft"
                value={m.adr}
                step={100}
                onBlur={v => updateMonthField(m.month, "adr", v)}
              />
              <MonthInput
                label="Kihas."
                unit="%"
                value={m.occupancyPct}
                step={1}
                onBlur={v => updateMonthField(m.month, "occupancyPct", Math.min(100, Math.max(0, v)))}
              />
              <MonthInput
                label="Kiadás"
                unit="Ft"
                value={m.monthlyCost}
                step={10000}
                onBlur={v => updateMonthField(m.month, "monthlyCost", v)}
              />
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: "#94A3B8", margin: "10px 0 0" }}>
          Az értékek elhagyásakor (onBlur) automatikusan mentésre kerülnek.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION B — Dashboard */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {/* 4 KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <KpiCard
          label="Éves bevétel"
          value={`${fmtM(annualRevenue)} Ft`}
          color="#3B82F6"
          icon={<TrendingUp size={16} />}
          sub={totalRooms ? `${totalRooms} szoba alapján` : "szobaszám hiányzik"}
        />
        <KpiCard
          label="Éves profit"
          value={`${annualProfit >= 0 ? "+" : ""}${fmtM(annualProfit)} Ft`}
          color={profitColor(annualProfit)}
          icon={annualProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          sub={annualRevenue > 0 ? `${Math.round(annualProfit / annualRevenue * 100)}% margin` : undefined}
        />
        <KpiCard
          label="Átl. kihasználtság"
          value={`${Math.round(avgOcc)}%`}
          color="#7C3AED"
          icon={<Bed size={16} />}
          sub={filledCalcs.length > 0 ? `${filledCalcs.length} hónap alapján` : "nincs adat"}
        />
        <KpiCard
          label="Átl. margin"
          value={`${Math.round(avgMargin)}%`}
          color="#10B981"
          icon={<Percent size={16} />}
          sub={filledCalcs.length > 0 ? `${filledCalcs.filter(c => c.margin !== null).length} hónap alapján` : "nincs adat"}
        />
      </div>

      {/* Breakeven highlight banner */}
      {annualBreakeven !== null && filledCalcs.length > 0 && (
        <div style={{
          background: annualProfit >= 0 ? "#D1FAE5" : "#FEE2E2",
          border: `1px solid ${annualProfit >= 0 ? "#6EE7B7" : "#FCA5A5"}`,
          borderRadius: 14, padding: "12px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: annualProfit >= 0 ? "#10B981" : "#EF4444",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {annualProfit >= 0
              ? <TrendingUp size={18} color="white" />
              : <TrendingDown size={18} color="white" />}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: annualProfit >= 0 ? "#065F46" : "#991B1B", margin: 0 }}>
              {annualProfit >= 0
                ? `Éves szinten nyereséges — fedezeti pont: ${Math.round(annualBreakeven)}% kihasználtság`
                : `Éves szinten veszteséges — fedezeti pont: ${Math.round(annualBreakeven)}% kihasználtság`}
            </p>
            <p style={{ fontSize: 12, color: annualProfit >= 0 ? "#047857" : "#B91C1C", margin: "2px 0 0" }}>
              Jelenlegi átlagos kihasználtság: {Math.round(avgOcc)}%
              {avgOcc > 0 && annualBreakeven !== null && (
                annualProfit >= 0
                  ? ` — ${Math.round(avgOcc - annualBreakeven)} százalékponttal a fedezeti pont felett`
                  : ` — ${Math.round(annualBreakeven - avgOcc)} százalékpont hiányzik a nullszaldóhoz`
              )}
            </p>
          </div>
        </div>
      )}

      {/* Monthly results table */}
      <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>Havi eredmények</h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700, fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {[
                  { label: "Hónap", align: "left" },
                  { label: "Szobaéj", align: "right" },
                  { label: "Bevétel", align: "right" },
                  { label: "Kiadás", align: "right" },
                  { label: "Profit", align: "right" },
                  { label: "Margin %", align: "right" },
                  { label: "Fedezeti pont %", align: "right" },
                ].map(h => (
                  <th key={h.label}
                    style={{
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
              {calcs.map(c => {
                const m = months.find(m => m.month === c.month)!;
                return (
                  <tr key={c.month} style={{ borderBottom: "1px solid #F8FAFC", opacity: c.hasData ? 1 : 0.35 }}>
                    <td style={{ padding: "9px 16px", fontWeight: 600, color: "#0F172A" }}>
                      {HU_MONTHS[c.month - 1]}
                    </td>
                    <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#334155" }}>
                      {c.hasData ? fmt(c.roomNights) : "—"}
                    </td>
                    <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#334155" }}>
                      {c.hasData ? fmtM(c.revenue) : "—"}
                    </td>
                    <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8" }}>
                      {c.hasData ? fmtM(c.cost) : "—"}
                    </td>
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
                <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#0F172A" }}>
                  {fmt(calcs.reduce((s, c) => s + c.roomNights, 0))}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#0F172A" }}>
                  {fmtM(annualRevenue)}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748B" }}>
                  {fmtM(annualCost)}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: profitColor(annualProfit) }}>
                  {annualProfit >= 0 ? "+" : ""}{fmtM(annualProfit)}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: profitColor(annualProfit) }}>
                  {annualRevenue > 0 ? `${Math.round(annualProfit / annualRevenue * 100)}%` : "—"}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#94A3B8" }}>
                  {annualBreakeven !== null ? `${Math.round(annualBreakeven)}%` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
