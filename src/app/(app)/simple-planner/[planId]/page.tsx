"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle, Check, TrendingUp, TrendingDown, Percent, Bed, Sliders, RotateCcw, Download, X, GitBranch, ChevronRight, Landmark, Share2, Sparkles, Copy, ExternalLink, Trash2, Lock, Eye, EyeOff, ShieldCheck, ShieldOff, DollarSign } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip as ReTooltip,
  ReferenceLine, Cell, Legend,
  LineChart, Line,
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
  roomRevenue: number;    // közvetlenül bevitt szoba árbevétel (ha > 0, ez az elsődleges)
  monthlyCost: number;
  breakfastPct: number;   // havi reggelis vendégek aránya %
  halfboardPct: number;   // havi félpanziós vendégek aránya %
};

type Hotel = { id: string; name: string; totalRooms: number | null };

type Plan = {
  id: string;
  name: string;
  year: number;
  createdAt: string;
  hotel: Hotel;
  months: MonthData[];
  breakfastPct: number;
  halfboardPct: number;
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

type FbParams = {
  enabled: boolean;
  breakfastPrice: number; halfboardPrice: number; avgPaxPerRoom: number;
  fbOtherEnabled: boolean; fbOtherPct: number;
  spaEnabled: boolean; spaPct: number;
  otherRevenueEnabled: boolean; otherRevenuePct: number;
};

type CostParams = {
  annualFixedCost: number;
  breakfastCost: number;
  halfboardCost: number;
  avgPaxPerRoom: number;
  laundryEnabled: boolean;
  laundryPerRoom: number;
  commissionEnabled: boolean;
  commissionPct: number;          // átlagos jutalék %
  commissionBookingsPct: number;  // jutalékos foglalások aránya %
};

function computeMonthCalc(m: MonthData, totalRooms: number, year: number, tfhRate = 0, fb?: FbParams, costs?: CostParams): MonthCalc {
  const days = getDaysInMonth(m.month, year);
  const availableNights = totalRooms * days;
  const hasData = m.adr > 0 || m.occupancyPct > 0 || m.roomRevenue > 0;
  const roomNights = (m.occupancyPct / 100) * availableNights;

  // Bevétel: ADR + F&B felár + egyéb, vagy manuális roomRevenue ha megadva
  let boardPerRoomNight = 0;
  if (fb?.enabled && m.roomRevenue === 0) {
    boardPerRoomNight = fb.avgPaxPerRoom * (
      (m.breakfastPct / 100) * fb.breakfastPrice +
      (m.halfboardPct / 100) * fb.halfboardPrice
    );
  }
  let extraRevPerRoomNight = 0;
  if (m.roomRevenue === 0 && fb) {
    const extraPct =
      (fb.fbOtherEnabled ? fb.fbOtherPct : 0) +
      (fb.spaEnabled ? fb.spaPct : 0) +
      (fb.otherRevenueEnabled ? fb.otherRevenuePct : 0);
    extraRevPerRoomNight = m.adr * (extraPct / 100);
  }
  const revenuePerRoomNight = m.roomRevenue > 0
    ? m.roomRevenue
    : m.adr + boardPerRoomNight + extraRevPerRoomNight;
  const revenue = revenuePerRoomNight * roomNights;

  // Jutalék alapja: csak ADR + ellátás ára — egyéb bevételi % (spa, parkoló stb.) nem jutalékos
  const commissionableRevPerRoomNight = m.roomRevenue > 0
    ? m.roomRevenue
    : m.adr + boardPerRoomNight;

  // Kiadás: fix (éves÷12) + változó (F&B önköltség + mosatás + jutalék) × roomNights
  let cost = 0;
  if (costs) {
    const fixedPerMonth = costs.annualFixedCost / 12;
    const fbCostPerRoomNight = costs.avgPaxPerRoom * (
      (m.breakfastPct / 100) * costs.breakfastCost +
      (m.halfboardPct / 100) * costs.halfboardCost
    );
    const laundryCostPerRoomNight = costs.laundryEnabled ? costs.laundryPerRoom : 0;
    const commissionCostPerRoomNight = costs.commissionEnabled
      ? commissionableRevPerRoomNight * (costs.commissionPct / 100) * (costs.commissionBookingsPct / 100)
      : 0;
    const variablePerRoomNight = fbCostPerRoomNight + laundryCostPerRoomNight + commissionCostPerRoomNight;
    cost = fixedPerMonth + variablePerRoomNight * roomNights;
  }

  const tfh = revenue * (tfhRate / 100);
  const profit = revenue - cost - tfh;
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;
  const netRevenue = revenue - tfh;
  const breakeven = netRevenue > 0 && cost > 0 && m.occupancyPct > 0
    ? (cost / netRevenue) * m.occupancyPct
    : null;
  return { month: m.month, daysInMonth: days, roomNights, revenue, cost, tfh, profit, margin, breakeven, hasData };
}

function profitColor(p: number) {
  if (p > 0) return "#10B981";
  if (p === 0) return "#94A3B8";
  return "#EF4444";
}

function annualSummary(calcs: MonthCalc[], months: MonthData[]) {
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
  const totalDays = calcs.reduce((s, c) => s + c.daysInMonth, 0);
  const weightedAdr = filledCalcs.length > 0
    ? filledCalcs.reduce((s, c) => s + (months.find(m => m.month === c.month)?.adr ?? 0), 0) / filledCalcs.length
    : 0;
  const totalRooms = calcs.length > 0 ? undefined : 0; // not needed here
  return { annualRevenue, annualCost, annualProfit, avgOcc, avgMargin, totalDays, weightedAdr, filledCalcs };
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
          border: "none", borderBottom: "2px solid #35BD78", outline: "none",
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
  label, value, onBlur, unit, step, highlight, fromBand, note,
}: {
  label: string;
  value: number;
  onBlur: (v: number) => void;
  unit?: string;
  step?: number;
  highlight?: boolean;
  fromBand?: boolean;
  note?: string;
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
      {label !== "" && (
        <p style={{
          fontSize: 9, margin: "0 0 2px", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em",
          color: highlight ? "#35BD78" : fromBand ? "#0EA5E9" : "#94A3B8",
        }}>
          {label}{unit ? ` (${unit})` : ""}
        </p>
      )}
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
          border: `1px solid ${highlight ? "#90DBAC" : fromBand ? "#BAE6FD" : "#E2E8F0"}`,
          borderRadius: 6, padding: "4px 6px",
          outline: "none",
          background: highlight ? "#FBFBFC" : fromBand ? "#F0F9FF" : "#FAFAFA",
          fontVariantNumeric: "tabular-nums",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#90DBAC")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = highlight ? "#90DBAC" : fromBand ? "#BAE6FD" : "#E2E8F0")}
        onFocusCapture={e => (e.currentTarget.style.borderColor = "#35BD78")}
        onBlurCapture={e => (e.currentTarget.style.borderColor = highlight ? "#90DBAC" : fromBand ? "#BAE6FD" : "#E2E8F0")}
      />
      {note && (
        <p style={{
          fontSize: 8, margin: "1px 0 0", fontWeight: 700,
          color: fromBand ? "#0EA5E9" : "#35BD78",
        }}>{note}</p>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, icon, sub, delta }: {
  label: string; value: string; color: string;
  icon: React.ReactNode; sub?: string; delta?: string;
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
      {delta && (
        <p style={{ fontSize: 11, fontWeight: 700, color: delta.startsWith("+") ? "#10B981" : "#EF4444", margin: "4px 0 0" }}>{delta}</p>
      )}
      {sub && <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ─── Custom Recharts Tooltip ──────────────────────────────────────────────────

function ChartTooltipRevenue({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 16px #0001" }}>
      <p style={{ fontWeight: 700, color: "#0F172A", margin: "0 0 6px", fontSize: 13 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ margin: "2px 0", fontSize: 12, color: p.color, fontWeight: 600 }}>
          {p.dataKey === "revenue" ? "Bevétel" : p.dataKey === "simRevenue" ? "Sim. bevétel" : p.dataKey === "profit" ? "Profit" : "Sim. profit"}:{" "}
          {fmtM(p.value)} Ft
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
          {p.dataKey === "occ" ? "Kihasználtság" : p.dataKey === "simOcc" ? "Sim. kihasználtság" : "Fedezeti pont"}:{" "}
          {Math.round(p.value)}%
        </p>
      ))}
    </div>
  );
}

// ─── Scenario types (for import) ─────────────────────────────────────────────

type ScenarioItem = { id: string; name: string; year: number; isBase: boolean; probability: number };

type ImportMonth = { month: number; avgAdr: number; avgOcc: number };

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (months: ImportMonth[], scenarioName: string) => void;
}) {
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ months: ImportMonth[]; name: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    fetch("/api/scenarios")
      .then(r => r.json())
      .then((data: ScenarioItem[]) => setScenarios(data))
      .finally(() => setLoading(false));
  }, []);

  async function selectScenario(id: string) {
    setSelected(id);
    setPreview(null);
    setNoData(false);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/simple-plans/import-from-scenario?scenarioId=${id}`);
      const data = await res.json();
      if (data.hasData) {
        setPreview({ months: data.months, name: data.scenario.name });
      } else {
        setNoData(true);
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  function doImport() {
    if (!preview) return;
    setImporting(true);
    onImport(preview.months, preview.name);
  }

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{
        background: "white", borderRadius: 24, width: "100%", maxWidth: 560,
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        display: "flex", flexDirection: "column", maxHeight: "85vh",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: "1px solid #E2E8F0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FBFBFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Download size={16} color="#35BD78" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                Importálás szcenárióból
              </h2>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
                Válassz egy szcenáriót — az ADR és kihasználtság adatai kerülnek be
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} color="#64748B" />
          </button>
        </div>

        {/* Scenario list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
              <Loader2 size={20} style={{ color: "#35BD78" }} className="animate-spin" />
            </div>
          ) : scenarios.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94A3B8", padding: 32, fontSize: 13 }}>
              Nincs elérhető szcenárió.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {scenarios.map(s => {
                const isSelected = selected === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => selectScenario(s.id)}
                    style={{
                      width: "100%", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 14, cursor: "pointer",
                      border: `1px solid ${isSelected ? "#35BD78" : "#E2E8F0"}`,
                      background: isSelected ? "#FBFBFC" : "white",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: isSelected ? "#35BD78" : "#F1F5F9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <GitBranch size={14} color={isSelected ? "white" : "#94A3B8"} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, color: "#0F172A", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.name}
                        </span>
                        {s.isBase && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#35BD78", background: "#FBFBFC", padding: "1px 5px", borderRadius: 4, textTransform: "uppercase", flexShrink: 0 }}>
                            BASE
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>
                        {s.year} · {s.probability}% valószínűség
                      </span>
                    </div>
                    <ChevronRight size={14} color={isSelected ? "#35BD78" : "#CBD5E1"} style={{ flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview panel */}
        {selected && (
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "14px 24px", background: "#F8FAFC" }}>
            {previewLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94A3B8", fontSize: 13 }}>
                <Loader2 size={14} className="animate-spin" /> Adatok betöltése...
              </div>
            ) : noData ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={14} color="#D97706" />
                <p style={{ fontSize: 13, color: "#92400E", margin: 0 }}>
                  Ennek a szcenáriónak még nincs legenerált terve. Generáld le először.
                </p>
              </div>
            ) : preview ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#64748B", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Előnézet — havi átlagok
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, marginBottom: 14 }}>
                  {preview.months.map(m => (
                    <div key={m.month} style={{
                      background: "white", borderRadius: 8, padding: "6px 8px",
                      border: "1px solid #E2E8F0", textAlign: "center",
                    }}>
                      <p style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700, margin: "0 0 2px", textTransform: "uppercase" }}>
                        {["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Sze","Okt","Nov","Dec"][m.month - 1]}
                      </p>
                      {m.avgAdr > 0 ? (
                        <>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                            {(m.avgAdr / 1000).toFixed(0)}e
                          </p>
                          <p style={{ fontSize: 10, color: "#35BD78", margin: 0 }}>
                            {m.avgOcc}%
                          </p>
                        </>
                      ) : (
                        <p style={{ fontSize: 11, color: "#CBD5E1", margin: "4px 0 0" }}>—</p>
                      )}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: "0 0 0" }}>
                  A meglévő kiadásadatok <strong>megmaradnak</strong>. Csak az ADR és kihasználtság felülíródik.
                </p>
              </>
            ) : null}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10,
          padding: "16px 24px", borderTop: "1px solid #E2E8F0", background: "white",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 18px", borderRadius: 10, border: "1px solid #E2E8F0",
              background: "white", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Mégse
          </button>
          <button
            onClick={doImport}
            disabled={!preview || importing}
            style={{
              padding: "9px 20px", borderRadius: 10, border: "none",
              background: preview && !importing ? "#35BD78" : "#E2E8F0",
              color: preview && !importing ? "white" : "#94A3B8",
              fontSize: 13, fontWeight: 700, cursor: preview && !importing ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.15s",
            }}
          >
            {importing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Importálás
          </button>
        </div>
      </div>
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

  // ─── Board mix (plan-level) ───────────────────────────────────────────────
  const [breakfastPct, setBreakfastPct] = useState(0);
  const [halfboardPct, setHalfboardPct] = useState(0);

  // ─── TFH + F&B bevétel + egyéb bevétel + cost settings ──────────────────
  const [tfhEnabled, setTfhEnabled] = useState(false);
  const [tfhRate, setTfhRate] = useState(4);
  const [fbEnabled, setFbEnabled] = useState(false);
  const [breakfastPrice, setBreakfastPrice] = useState(0);
  const [halfboardPrice, setHalfboardPrice] = useState(0);
  const [avgPaxPerRoom, setAvgPaxPerRoom] = useState(1.8);
  const [fbOtherEnabled, setFbOtherEnabled] = useState(false);
  const [fbOtherPct, setFbOtherPct] = useState(0);
  const [spaEnabled, setSpaEnabled] = useState(false);
  const [spaPct, setSpaPct] = useState(0);
  const [otherRevenueEnabled, setOtherRevenueEnabled] = useState(false);
  const [otherRevenuePct, setOtherRevenuePct] = useState(0);
  // Cost settings
  const [annualFixedCost, setAnnualFixedCost] = useState(0);
  const [breakfastCost, setBreakfastCost] = useState(0);
  const [halfboardCost, setHalfboardCost] = useState(0);
  const [laundryEnabled, setLaundryEnabled] = useState(false);
  const [laundryPerRoom, setLaundryPerRoom] = useState(0);
  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [commissionPct, setCommissionPct] = useState(0);
  const [commissionBookingsPct, setCommissionBookingsPct] = useState(100);
  const [savingRevenues, setSavingRevenues] = useState(false);
  const [boardMixDirty, setBoardMixDirty] = useState(false);

  useEffect(() => {
    fetch("/api/simple-planner-settings")
      .then(r => r.json())
      .then((data: {
        tfhEnabled?: boolean; tfhRate?: number;
        fbEnabled?: boolean; breakfastPrice?: number;
        halfboardPrice?: number; avgPaxPerRoom?: number;
        defaultBreakfastPct?: number; defaultHalfboardPct?: number;
        fbOtherEnabled?: boolean; fbOtherPct?: number;
        spaEnabled?: boolean; spaPct?: number;
        otherRevenueEnabled?: boolean; otherRevenuePct?: number;
        breakfastCost?: number; halfboardCost?: number;
        laundryEnabled?: boolean; laundryPerRoom?: number;
        commissionEnabled?: boolean; commissionPct?: number; commissionBookingsPct?: number;
        fixedCosts?: { annualAmount: number }[];
      } | null) => {
        if (!data) return;
        if (data.tfhEnabled !== undefined) setTfhEnabled(data.tfhEnabled);
        if (data.tfhRate !== undefined) setTfhRate(data.tfhRate);
        if (data.fbEnabled !== undefined) setFbEnabled(data.fbEnabled);
        if (data.breakfastPrice !== undefined) setBreakfastPrice(data.breakfastPrice);
        if (data.halfboardPrice !== undefined) setHalfboardPrice(data.halfboardPrice);
        if (data.avgPaxPerRoom !== undefined) setAvgPaxPerRoom(data.avgPaxPerRoom);
        if (data.defaultBreakfastPct !== undefined) setBreakfastPct(data.defaultBreakfastPct);
        if (data.defaultHalfboardPct !== undefined) setHalfboardPct(data.defaultHalfboardPct);
        if ((data.defaultBreakfastPct ?? 0) > 0 || (data.defaultHalfboardPct ?? 0) > 0) {
          setBoardMixDirty(true);
        }
        if (data.fbOtherEnabled !== undefined) setFbOtherEnabled(data.fbOtherEnabled);
        if (data.fbOtherPct !== undefined) setFbOtherPct(data.fbOtherPct);
        if (data.spaEnabled !== undefined) setSpaEnabled(data.spaEnabled);
        if (data.spaPct !== undefined) setSpaPct(data.spaPct);
        if (data.otherRevenueEnabled !== undefined) setOtherRevenueEnabled(data.otherRevenueEnabled);
        if (data.otherRevenuePct !== undefined) setOtherRevenuePct(data.otherRevenuePct);
        if (data.breakfastCost !== undefined) setBreakfastCost(data.breakfastCost);
        if (data.halfboardCost !== undefined) setHalfboardCost(data.halfboardCost);
        if (data.laundryEnabled !== undefined) setLaundryEnabled(data.laundryEnabled);
        if (data.laundryPerRoom !== undefined) setLaundryPerRoom(data.laundryPerRoom);
        if (data.commissionEnabled !== undefined) setCommissionEnabled(data.commissionEnabled);
        if (data.commissionPct !== undefined) setCommissionPct(data.commissionPct);
        if (data.commissionBookingsPct !== undefined) setCommissionBookingsPct(data.commissionBookingsPct);
        if (data.fixedCosts?.length) {
          setAnnualFixedCost(data.fixedCosts.reduce((s, fc) => s + fc.annualAmount, 0));
        }
      });
  }, []);

  // ─── Simulator state ──────────────────────────────────────────────────────
  const [simOffset, setSimOffset] = useState(0); // global occ % offset
  const isSimActive = simOffset !== 0;

  // ─── Import modal state ───────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);

  // ─── Module access ────────────────────────────────────────────────────────
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
  useEffect(() => {
    fetch("/api/me/modules")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAllowedModules(d.allowedModules); });
  }, []);
  // null = teljes hozzáférés; string[] = korlátozott lista
  const canAccessScenarios = allowedModules === null || allowedModules.includes("SCENARIOS");

  // ─── Share modal state ────────────────────────────────────────────────────
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareState, setShareState] = useState<{
    shareToken: string | null;
    shareEnabled: boolean;
    shareSummary: string;
    shareExpiresAt: string | null;
    sharePasswordSet: boolean;
  } | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [shareSummaryStreaming, setShareSummaryStreaming] = useState(false);
  const [shareExpiry, setShareExpiry] = useState<"forever" | "custom">("forever");
  const [shareExpiryDate, setShareExpiryDate] = useState("");
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  // Password state: null = untouched (don't change), "" = cleared, string = new password
  const [sharePasswordDraft, setSharePasswordDraft] = useState<string | null>(null);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showPasswordValue, setShowPasswordValue] = useState(false);

  async function loadShareState() {
    setShareLoading(true);
    const res = await fetch(`/api/simple-plans/${planId}/share`);
    if (res.ok) {
      const data = await res.json();
      setShareState(data);
      if (data.shareExpiresAt) {
        setShareExpiry("custom");
        setShareExpiryDate(data.shareExpiresAt.slice(0, 10));
      } else {
        setShareExpiry("forever");
        setShareExpiryDate("");
      }
    }
    setShareLoading(false);
  }

  function openShareModal() {
    setShowShareModal(true);
    setSharePasswordDraft(null);
    setShowPasswordInput(false);
    setShowPasswordValue(false);
    loadShareState();
  }

  async function saveShare() {
    setShareSaving(true);
    const body: Record<string, unknown> = {
      enabled: shareState?.shareEnabled ?? false,
      summary: shareState?.shareSummary ?? "",
      expiresAt: shareExpiry === "forever" ? null : shareExpiryDate || null,
    };
    // Only include password if it was explicitly changed
    if (sharePasswordDraft !== null) {
      body.password = sharePasswordDraft; // "" = remove, string = set new
    }
    const res = await fetch(`/api/simple-plans/${planId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setShareState(data);
      setSharePasswordDraft(null);
      setShowPasswordInput(false);
      setShowPasswordValue(false);
    }
    setShareSaving(false);
  }

  async function revokeShare() {
    const res = await fetch(`/api/simple-plans/${planId}/share`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      setShareState(data);
    }
  }

  async function generateSummary() {
    setShareSummaryStreaming(true);
    setShareState(prev => prev ? { ...prev, shareSummary: "" } : prev);

    const res = await fetch(`/api/simple-plans/${planId}/share/generate-summary`, { method: "POST" });
    if (!res.ok || !res.body) { setShareSummaryStreaming(false); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const msg = JSON.parse(line.slice(6));
          if (msg.type === "text") {
            setShareState(prev => prev ? { ...prev, shareSummary: (prev.shareSummary ?? "") + msg.text } : prev);
          }
        } catch {}
      }
    }
    setShareSummaryStreaming(false);
  }

  function copyShareLink() {
    if (!shareState?.shareToken) return;
    const url = `${window.location.origin}/share/${shareState.shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    });
  }

  async function handleImport(importedMonths: ImportMonth[], scenarioName: string) {
    // Merge imported ADR + occ into saved months, keep costs
    const updated = months.map(m => {
      const imp = importedMonths.find(im => im.month === m.month);
      if (!imp || imp.avgAdr === 0) return m;
      return {
        ...m,
        adr: imp.avgAdr,
        occupancyPct: imp.avgOcc,
        // roomRevenue-t nem importáljuk — azt a felhasználó manuálisan viszi be
      };
    });
    setMonths(updated);
    await saveMonths(updated);
    setShowImport(false);
  }

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
        roomRevenue: m.roomRevenue,
        monthlyCost: m.monthlyCost,
        breakfastPct: m.breakfastPct,
        halfboardPct: m.halfboardPct,
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

  async function saveBoardMix(bPct: number, hPct: number) {
    await fetch(`/api/simple-plans/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ breakfastPct: bPct, halfboardPct: hPct }),
    });
    showSaved();
  }

  // Kiszámolja az ADR + F&B board + spa + egyéb bevételt és elmenti roomRevenue-ként
  // Mindig a JELENLEGI slider-értékeket (breakfastPct/halfboardPct) használja, nem a hónapokban tárolt értékeket
  async function saveComputedRevenues() {
    setSavingRevenues(true);
    try {
      const updated = months.map(m => {
        if (m.adr === 0) return m;
        let board = 0;
        if (fbEnabled) {
          board = avgPaxPerRoom * (
            (breakfastPct / 100) * breakfastPrice +
            (halfboardPct / 100) * halfboardPrice
          );
        }
        const extraPct =
          (fbOtherEnabled ? fbOtherPct : 0) +
          (spaEnabled ? spaPct : 0) +
          (otherRevenueEnabled ? otherRevenuePct : 0);
        const extra = m.adr * (extraPct / 100);
        return { ...m, roomRevenue: Math.round(m.adr + board + extra) };
      });
      setMonths(updated);
      await saveMonths(updated);
    } finally {
      setSavingRevenues(false);
      setBoardMixDirty(false);
    }
  }

  function updateMonthField(monthNum: number, field: keyof Pick<MonthData, "adr" | "occupancyPct" | "roomRevenue" | "breakfastPct" | "halfboardPct">, value: number) {
    const updated = months.map(m => {
      if (m.month !== monthNum) return m;
      const next = { ...m, [field]: value };
      // Ha ADR változik és van roomRevenue → újraszámítjuk a roomRevenue-t
      if (field === "adr" && value > 0) {
        let board = 0;
        if (fbEnabled) {
          board = avgPaxPerRoom * (
            (next.breakfastPct / 100) * breakfastPrice +
            (next.halfboardPct / 100) * halfboardPrice
          );
        }
        const extraPct =
          (fbOtherEnabled ? fbOtherPct : 0) +
          (spaEnabled ? spaPct : 0) +
          (otherRevenueEnabled ? otherRevenuePct : 0);
        const extra = value * (extraPct / 100);
        next.roomRevenue = Math.round(value + board + extra);
      }
      return next;
    });
    setMonths(updated);
    saveMonths(updated);
  }

  // ─── Calculations ─────────────────────────────────────────────────────────

  const totalRooms = plan?.hotel?.totalRooms ?? 0;
  const effectiveTfhRate = tfhEnabled ? tfhRate : 0;

  // F&B + egyéb bevétel params bundle (breakfastPct/halfboardPct most havi szinten tárolva)
  const fb: FbParams = {
    enabled: fbEnabled,
    breakfastPrice,
    halfboardPrice,
    avgPaxPerRoom,
    fbOtherEnabled,
    fbOtherPct,
    spaEnabled,
    spaPct,
    otherRevenueEnabled,
    otherRevenuePct,
  };

  // Ha egy hónapnál nincs saját board mix beállítva (0/0) → settings alapértelmezettjeit használjuk
  function applyBoardDefaults(m: MonthData): MonthData {
    if (fbEnabled && m.breakfastPct === 0 && m.halfboardPct === 0 && (breakfastPct > 0 || halfboardPct > 0)) {
      return { ...m, breakfastPct, halfboardPct };
    }
    return m;
  }

  // Board mix alapértékek alkalmazása, ha a hónaphoz nincs egyedi mix megadva
  const monthsWithBands: MonthData[] = months.map(m => applyBoardDefaults(m));

  // Cost params bundle
  const costs: CostParams = {
    annualFixedCost,
    breakfastCost,
    halfboardCost,
    avgPaxPerRoom,
    laundryEnabled,
    laundryPerRoom,
    commissionEnabled,
    commissionPct,
    commissionBookingsPct,
  };

  // Saved calcs (TFH + cost params)
  const calcs: MonthCalc[] = monthsWithBands.map(m =>
    computeMonthCalc(m, totalRooms, year, effectiveTfhRate, fb, costs)
  );
  const filledCalcs = calcs.filter(c => c.hasData);

  const annualRevenue = calcs.reduce((s, c) => s + c.revenue, 0);
  const annualCost = calcs.reduce((s, c) => s + c.cost, 0);
  const annualTfh = calcs.reduce((s, c) => s + c.tfh, 0);
  const annualProfit = annualRevenue - annualCost - annualTfh;
  const avgOcc = filledCalcs.length > 0
    ? filledCalcs.reduce((s, c) => s + (months.find(m => m.month === c.month)?.occupancyPct ?? 0), 0) / filledCalcs.length
    : 0;
  const avgMargin = filledCalcs.filter(c => c.margin !== null).length > 0
    ? filledCalcs.filter(c => c.margin !== null).reduce((s, c) => s + (c.margin ?? 0), 0) / filledCalcs.filter(c => c.margin !== null).length
    : 0;

  // Átlag ADR és szobaárbevétel/szoba/éj (szobaeladott éjszakával súlyozva)
  const totalFilledRoomNights = filledCalcs.reduce((s, c) => s + c.roomNights, 0);
  const weightedAvgAdr = totalFilledRoomNights > 0
    ? filledCalcs.reduce((s, c) => {
        const m = monthsWithBands.find(mm => mm.month === c.month);
        return s + (m?.adr ?? 0) * c.roomNights;
      }, 0) / totalFilledRoomNights
    : 0;
  const avgRevPerRoomNight = totalFilledRoomNights > 0
    ? annualRevenue / totalFilledRoomNights
    : 0;

  // Éves fedezeti pont: cost / (revenue − tfh) × avgOcc
  const annualNetRevenue = annualRevenue - annualTfh;
  const annualBreakeven = (annualNetRevenue > 0 && avgOcc > 0)
    ? (annualCost / annualNetRevenue) * avgOcc
    : null;

  // Simulated calcs — occ offset, fix + változó kiadás automatikusan újraszámolódik
  const simMonths: MonthData[] = monthsWithBands.map(m => ({
    ...m,
    occupancyPct: Math.min(100, Math.max(0, m.occupancyPct + simOffset)),
  }));
  const simCalcs: MonthCalc[] = simMonths.map(m =>
    computeMonthCalc(m, totalRooms, year, effectiveTfhRate, fb, costs)
  );
  const simFilledCalcs = simCalcs.filter(c => c.hasData);

  const simAnnualRevenue = simCalcs.reduce((s, c) => s + c.revenue, 0);
  const simAnnualCost   = simCalcs.reduce((s, c) => s + c.cost,    0);
  const simAnnualTfh    = simCalcs.reduce((s, c) => s + c.tfh,     0);
  const simAnnualProfit = simAnnualRevenue - simAnnualCost - simAnnualTfh;
  const simAvgOcc = simFilledCalcs.length > 0
    ? simFilledCalcs.reduce((s, c) => s + (simMonths.find(m => m.month === c.month)?.occupancyPct ?? 0), 0) / simFilledCalcs.length
    : 0;
  const simAvgMargin = simAnnualRevenue > 0 ? (simAnnualProfit / simAnnualRevenue) * 100 : 0;

  // Szimulált break-even: a szimulált adatokból újraszámolva, hogy konzisztens legyen a sim profittal
  // (ha a kihasználtság változik, a break-even occ is arányosan változik — nem az alap marad érvényes)
  const simNetRevenue = simAnnualRevenue - simAnnualTfh;
  const simBreakeven = (simNetRevenue > 0 && simAvgOcc > 0)
    ? (simAnnualCost / simNetRevenue) * simAvgOcc
    : annualBreakeven;

  // Revenue/Profit delta
  const deltaRevenue = simAnnualRevenue - annualRevenue;
  const deltaProfit = simAnnualProfit - annualProfit;

  // Chart data
  const chartData = calcs.map((c, i) => ({
    name: HU_MONTHS_SHORT[c.month - 1],
    revenue: Math.round(c.revenue),
    profit: Math.round(c.profit),
    occ: months.find(m => m.month === c.month)?.occupancyPct ?? 0,
    breakeven: c.breakeven !== null ? Math.round(c.breakeven) : null,
    simRevenue: Math.round(simCalcs[i].revenue),
    simProfit: Math.round(simCalcs[i].profit),
    simOcc: simMonths.find(m => m.month === c.month)?.occupancyPct ?? 0,
    hasData: c.hasData,
  }));

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <Loader2 size={24} className="animate-spin" style={{ color: "#35BD78" }} />
    </div>
  );

  if (!plan) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
      <p style={{ color: "#94A3B8" }}>A terv nem található.</p>
      <button onClick={() => router.push("/simple-planner")} style={{ color: "#35BD78", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
        ← Vissza
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* ── Import modal ── */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      {/* ── Share modal ── */}
      {showShareModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowShareModal(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "white", borderRadius: 24, width: "100%", maxWidth: 560,
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
            display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px", borderBottom: "1px solid #E2E8F0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FBFBFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Share2 size={16} color="#35BD78" />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Ügyfél prezentáció</h2>
                  <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>Megosztható link generálása az ügyfélnek</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color="#64748B" />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
              {shareLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                  <Loader2 size={20} style={{ color: "#35BD78" }} className="animate-spin" />
                </div>
              ) : (
                <>
                  {/* Section 1: Link settings */}
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Link beállítások
                    </h3>

                    {/* Toggle */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", margin: 0 }}>Megosztható link</p>
                        <p style={{ fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>
                          {shareState?.shareEnabled ? "Az ügyfél elérheti a prezentációt" : "A link jelenleg letiltva"}
                        </p>
                      </div>
                      <button
                        onClick={() => setShareState(prev => prev ? { ...prev, shareEnabled: !prev.shareEnabled } : prev)}
                        style={{
                          width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                          background: shareState?.shareEnabled ? "#35BD78" : "#E2E8F0",
                          position: "relative", transition: "background 0.2s", flexShrink: 0,
                        }}
                      >
                        <div style={{
                          position: "absolute", top: 3, left: shareState?.shareEnabled ? 25 : 3,
                          width: 20, height: 20, borderRadius: "50%", background: "white",
                          transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                        }} />
                      </button>
                    </div>

                    {shareState?.shareEnabled && (
                      <>
                        {/* Expiry */}
                        <div style={{ marginBottom: 14 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#64748B", margin: "0 0 8px" }}>Lejárat</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                              <input
                                type="radio"
                                checked={shareExpiry === "forever"}
                                onChange={() => setShareExpiry("forever")}
                                style={{ accentColor: "#35BD78" }}
                              />
                              <span style={{ fontSize: 13, color: "#0F172A" }}>Örök érvényű</span>
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                              <input
                                type="radio"
                                checked={shareExpiry === "custom"}
                                onChange={() => setShareExpiry("custom")}
                                style={{ accentColor: "#35BD78" }}
                              />
                              <span style={{ fontSize: 13, color: "#0F172A" }}>Időkorlátos</span>
                              {shareExpiry === "custom" && (
                                <input
                                  type="date"
                                  value={shareExpiryDate}
                                  onChange={e => setShareExpiryDate(e.target.value)}
                                  style={{
                                    marginLeft: 8, border: "1px solid #E2E8F0", borderRadius: 8,
                                    padding: "4px 10px", fontSize: 13, color: "#0F172A",
                                    outline: "none",
                                  }}
                                />
                              )}
                            </label>
                          </div>
                        </div>

                        {/* Link display */}
                        {shareState?.shareToken && (
                          <div style={{
                            background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12,
                            padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                          }}>
                            <p style={{
                              flex: 1, fontSize: 12, color: "#64748B", margin: 0,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              fontFamily: "monospace",
                            }}>
                              {typeof window !== "undefined" ? `${window.location.origin}/share/${shareState.shareToken}` : `/share/${shareState.shareToken}`}
                            </p>
                            <button
                              onClick={copyShareLink}
                              style={{
                                display: "flex", alignItems: "center", gap: 4,
                                padding: "5px 10px", borderRadius: 8,
                                border: "1px solid #E2E8F0", background: "white",
                                cursor: "pointer", fontSize: 11, fontWeight: 600,
                                color: copiedShareLink ? "#10B981" : "#35BD78",
                                flexShrink: 0,
                              }}
                            >
                              {copiedShareLink ? <Check size={12} /> : <Copy size={12} />}
                              {copiedShareLink ? "Másolva" : "Másolás"}
                            </button>
                            <button
                              onClick={() => window.open(`/share/${shareState?.shareToken}`, "_blank")}
                              style={{
                                display: "flex", alignItems: "center", gap: 4,
                                padding: "5px 10px", borderRadius: 8,
                                border: "1px solid #E2E8F0", background: "white",
                                cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#64748B",
                                flexShrink: 0,
                              }}
                            >
                              <ExternalLink size={12} />
                              Megnyitás
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Section 2: Password */}
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Jelszóvédelem
                    </h3>

                    {/* Current status badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {(shareState?.sharePasswordSet || sharePasswordDraft) && sharePasswordDraft !== "" ? (
                          <span style={{
                            display: "flex", alignItems: "center", gap: 6,
                            fontSize: 13, fontWeight: 600,
                            background: "#F0FDF4", color: "#059669",
                            border: "1px solid #BBF7D0",
                            borderRadius: 8, padding: "4px 10px",
                          }}>
                            <ShieldCheck size={13} /> Jelszóval védett
                          </span>
                        ) : (
                          <span style={{
                            display: "flex", alignItems: "center", gap: 6,
                            fontSize: 13, fontWeight: 600,
                            background: "#F8FAFC", color: "#94A3B8",
                            border: "1px solid #E2E8F0",
                            borderRadius: 8, padding: "4px 10px",
                          }}>
                            <ShieldOff size={13} /> Nyilvános (nincs jelszó)
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {!showPasswordInput && (
                          <button
                            onClick={() => { setShowPasswordInput(true); setSharePasswordDraft(""); setShowPasswordValue(false); }}
                            style={{
                              fontSize: 12, fontWeight: 600, cursor: "pointer",
                              padding: "5px 12px", borderRadius: 8,
                              background: "#FBFBFC", color: "#35BD78",
                              border: "1px solid #DDD6FE",
                            }}
                          >
                            <Lock size={11} style={{ display: "inline", marginRight: 4 }} />
                            {shareState?.sharePasswordSet ? "Módosítás" : "Jelszó beállítása"}
                          </button>
                        )}
                        {(shareState?.sharePasswordSet || (sharePasswordDraft !== null && sharePasswordDraft !== "")) && !showPasswordInput && (
                          <button
                            onClick={() => { setSharePasswordDraft(""); setShowPasswordInput(false); }}
                            style={{
                              fontSize: 12, fontWeight: 600, cursor: "pointer",
                              padding: "5px 12px", borderRadius: 8,
                              background: "#FEF2F2", color: "#EF4444",
                              border: "1px solid #FECACA",
                            }}
                          >
                            Eltávolítás
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Password input */}
                    {showPasswordInput && (
                      <div style={{
                        background: "#F8FAFC", border: "1px solid #E2E8F0",
                        borderRadius: 12, padding: "14px 16px",
                      }}>
                        <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 10px", fontWeight: 500 }}>
                          {shareState?.sharePasswordSet ? "Új jelszó megadása (felülírja a régit):" : "Jelszó megadása:"}
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <div style={{ flex: 1, position: "relative" }}>
                            <input
                              type={showPasswordValue ? "text" : "password"}
                              value={sharePasswordDraft ?? ""}
                              onChange={e => setSharePasswordDraft(e.target.value)}
                              placeholder="Min. 4 karakter..."
                              autoFocus
                              style={{
                                width: "100%", boxSizing: "border-box",
                                border: "1px solid #E2E8F0", borderRadius: 8,
                                padding: "8px 40px 8px 12px",
                                fontSize: 13, color: "#0F172A", outline: "none",
                                background: "white",
                              }}
                            />
                            <button
                              onClick={() => setShowPasswordValue(v => !v)}
                              style={{
                                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                background: "none", border: "none", cursor: "pointer", color: "#94A3B8",
                                display: "flex", alignItems: "center",
                              }}
                            >
                              {showPasswordValue ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          <button
                            onClick={() => { setShowPasswordInput(false); if (!sharePasswordDraft) setSharePasswordDraft(null); }}
                            style={{
                              padding: "8px 12px", borderRadius: 8,
                              background: "white", border: "1px solid #E2E8F0",
                              cursor: "pointer", color: "#64748B", fontSize: 12, fontWeight: 600,
                            }}
                          >
                            Mégse
                          </button>
                        </div>
                        <p style={{ fontSize: 11, color: "#94A3B8", margin: "8px 0 0" }}>
                          A jelszó a Mentés gombra kattintva kerül alkalmazásra.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Summary */}
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Összefoglaló szöveg
                    </h3>
                    <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 10px" }}>
                      Ez jelenik meg a megosztott linken az adatok felett.
                    </p>
                    <textarea
                      rows={5}
                      value={shareState?.shareSummary ?? ""}
                      onChange={e => setShareState(prev => prev ? { ...prev, shareSummary: e.target.value } : prev)}
                      placeholder="Az összefoglaló szöveg ide kerül..."
                      style={{
                        width: "100%", boxSizing: "border-box",
                        border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 14px",
                        fontSize: 13, color: "#0F172A", resize: "vertical", outline: "none",
                        fontFamily: "inherit", lineHeight: 1.6,
                      }}
                    />
                    <button
                      onClick={generateSummary}
                      disabled={shareSummaryStreaming}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        marginTop: 8, padding: "8px 14px", borderRadius: 10,
                        border: "1px solid #35BD78", background: shareSummaryStreaming ? "#FBFBFC" : "white",
                        cursor: shareSummaryStreaming ? "not-allowed" : "pointer",
                        color: "#35BD78", fontSize: 13, fontWeight: 600,
                      }}
                    >
                      {shareSummaryStreaming ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      AI generálás
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 24px", borderTop: "1px solid #E2E8F0", background: "white",
            }}>
              <div>
                {shareState?.shareToken && (
                  <button
                    onClick={revokeShare}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 10,
                      border: "1px solid #FCA5A5", background: "white",
                      cursor: "pointer", color: "#EF4444", fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <Trash2 size={13} />
                    Link visszavonása
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowShareModal(false)}
                  style={{
                    padding: "9px 18px", borderRadius: 10, border: "1px solid #E2E8F0",
                    background: "white", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Bezárás
                </button>
                <button
                  onClick={saveShare}
                  disabled={shareSaving || shareLoading}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 20px", borderRadius: 10, border: "none",
                    background: shareSaving || shareLoading ? "#E2E8F0" : "#35BD78",
                    color: shareSaving || shareLoading ? "#94A3B8" : "white",
                    fontSize: 13, fontWeight: 700,
                    cursor: shareSaving || shareLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {shareSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Mentés
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {saved && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#10B981", fontWeight: 600 }}>
              <Check size={14} /> Mentve
            </span>
          )}

          {/* Share button */}
          <button
            onClick={openShareModal}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "white", border: "1px solid #E2E8F0", borderRadius: 10,
              padding: "8px 14px", cursor: "pointer", color: "#35BD78",
              fontSize: 13, fontWeight: 600,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#35BD78"; e.currentTarget.style.background = "#FBFBFC"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "white"; }}
          >
            <Share2 size={14} />
            Ügyfél prezentáció
          </button>

          {/* Import from scenario button — only if SCENARIOS module is accessible */}
          {canAccessScenarios && (
            <button
              onClick={() => setShowImport(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "white", border: "1px solid #E2E8F0", borderRadius: 10,
                padding: "8px 14px", cursor: "pointer", color: "#35BD78",
                fontSize: 13, fontWeight: 600,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#35BD78"; e.currentTarget.style.background = "#FBFBFC"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "white"; }}
            >
              <Download size={14} />
              Importálás szcenárióból
            </button>
          )}

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

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 8,
          overflowX: "auto",
          minWidth: 700,
        }}>
          {months.map(m => {
            const c = calcs.find(c => c.month === m.month);
            const costPerRoom = c && c.roomNights > 0 ? Math.round(c.cost / c.roomNights) : null;
            return (
              <div
                key={m.month}
                style={{
                  background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10,
                  padding: "8px 8px 6px",
                }}
              >
                <p style={{
                  fontSize: 11, fontWeight: 700, color: "#35BD78", margin: "0 0 8px",
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
                  label="Szobaárb."
                  unit="Ft/szoba/éj"
                  value={m.roomRevenue}
                  step={10000}
                  highlight={m.roomRevenue > 0}
                  note={m.roomRevenue > 0 ? "↑ egyedi érték" : undefined}
                  onBlur={v => updateMonthField(m.month, "roomRevenue", v)}
                />

                {/* Kalkulált kiadás/szoba/éj — read-only, settings-ből számolt */}
                <div style={{ marginBottom: 4 }}>
                  <p style={{
                    fontSize: 9, margin: "0 0 2px", textTransform: "uppercase",
                    fontWeight: 600, letterSpacing: "0.04em", color: "#F87171",
                  }}>
                    Kiadás (Ft/éj)
                  </p>
                  <div style={{
                    width: "100%", boxSizing: "border-box",
                    fontSize: 12, fontWeight: 600,
                    color: costPerRoom !== null && costPerRoom > 0 ? "#DC2626" : "#CBD5E1",
                    border: "1px solid #FCA5A5",
                    borderRadius: 6, padding: "4px 6px",
                    background: "#FFF5F5",
                    fontVariantNumeric: "tabular-nums",
                    userSelect: "none",
                  }}>
                    {costPerRoom !== null && costPerRoom > 0
                      ? `${costPerRoom.toLocaleString("hu-HU")}`
                      : "—"}
                  </div>
                </div>

                {fbEnabled && (
                  <>
                    <MonthInput
                      label="🌅 Reggeli"
                      unit="%"
                      value={m.breakfastPct}
                      step={1}
                      onBlur={v => updateMonthField(m.month, "breakfastPct", Math.min(100, Math.max(0, v)))}
                    />
                    <MonthInput
                      label="🍽️ Félpanzió"
                      unit="%"
                      value={m.halfboardPct}
                      step={1}
                      onBlur={v => updateMonthField(m.month, "halfboardPct", Math.min(100, Math.max(0, v)))}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 11, color: "#94A3B8", margin: "10px 0 0" }}>
          Az értékek elhagyásakor (onBlur) automatikusan mentésre kerülnek.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION A2 — Board mix (F&B) — only shown if fbEnabled in settings */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {fbEnabled && (() => {
        const roomOnlyPct = Math.max(0, 100 - breakfastPct - halfboardPct);
        const brContrib = avgPaxPerRoom * (breakfastPct / 100) * breakfastPrice;
        const hbContrib = avgPaxPerRoom * (halfboardPct / 100) * halfboardPrice;
        const totalBoardSuppl = brContrib + hbContrib;

        function fillAllMonths() {
          const bPct = Math.min(breakfastPct, 100 - halfboardPct);
          const hPct = Math.min(halfboardPct, 100 - breakfastPct);
          const updated = months.map(m => {
            let board = 0;
            if (fbEnabled && m.adr > 0) {
              board = avgPaxPerRoom * (
                (bPct / 100) * breakfastPrice +
                (hPct / 100) * halfboardPrice
              );
            }
            const extraPct =
              (fbOtherEnabled ? fbOtherPct : 0) +
              (spaEnabled ? spaPct : 0) +
              (otherRevenueEnabled ? otherRevenuePct : 0);
            const extra = m.adr > 0 ? m.adr * (extraPct / 100) : 0;
            return {
              ...m,
              breakfastPct: bPct,
              halfboardPct: hPct,
              ...(m.adr > 0 && { roomRevenue: Math.round(m.adr + board + extra) }),
            };
          });
          setMonths(updated);
          saveMonths(updated);
          setBoardMixDirty(false);
        }

        return (
          <div style={{
            background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
            padding: "20px 24px", marginBottom: 24,
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  🍽️
                </div>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Étkezési vendégmix — gyors kitöltő
                  </h2>
                  <p style={{ fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>
                    Állítsd be az arányokat, majd alkalmaz minden hónapra — vagy havonta külön add meg a gridben
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={saveComputedRevenues}
                  disabled={savingRevenues || !boardMixDirty}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: savingRevenues ? "#6EE7B7" : boardMixDirty ? "#10B981" : "#D1FAE5", color: boardMixDirty ? "white" : "#6EE7B7",
                    border: "none", borderRadius: 10, padding: "8px 16px",
                    fontSize: 13, fontWeight: 600,
                    cursor: (savingRevenues || !boardMixDirty) ? "not-allowed" : "pointer",
                    opacity: (savingRevenues || !boardMixDirty) ? 0.7 : 1,
                    transition: "all 0.15s",
                  }}
                  title="ADR + F&B felár + egyéb bevétel kiszámítva és elmentve roomRevenue-ként minden hónapra"
                >
                  {savingRevenues && <Loader2 size={13} className="animate-spin" />}
                  {savingRevenues ? "Rögzítés folyamatban…" : "Rögzítés a tervbe"}
                </button>
              <button
                onClick={fillAllMonths}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#35BD78", color: "white",
                  border: "none", borderRadius: 10, padding: "8px 16px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                ✓ Alkalmazás mind a 12 hónapra
              </button>
              </div>
            </div>

            {/* Visual 3-way split bar */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", height: 28, borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0" }}>
                {roomOnlyPct > 0 && (
                  <div style={{
                    width: `${roomOnlyPct}%`, background: "#F1F5F9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "#64748B",
                    transition: "width 0.2s", overflow: "hidden", whiteSpace: "nowrap",
                  }}>
                    {roomOnlyPct >= 10 ? `🛏️ ${Math.round(roomOnlyPct)}%` : ""}
                  </div>
                )}
                {breakfastPct > 0 && (
                  <div style={{
                    width: `${breakfastPct}%`, background: "#FDE68A",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "#92400E",
                    transition: "width 0.2s", overflow: "hidden", whiteSpace: "nowrap",
                  }}>
                    {breakfastPct >= 10 ? `🌅 ${Math.round(breakfastPct)}%` : ""}
                  </div>
                )}
                {halfboardPct > 0 && (
                  <div style={{
                    width: `${halfboardPct}%`, background: "#BBF7D0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "#065F46",
                    transition: "width 0.2s", overflow: "hidden", whiteSpace: "nowrap",
                  }}>
                    {halfboardPct >= 10 ? `🍽️ ${Math.round(halfboardPct)}%` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "#94A3B8" }}>🛏️ Csak szoba: {Math.round(roomOnlyPct)}%</span>
                <span style={{ fontSize: 10, color: "#D97706" }}>🌅 Reggeli: {Math.round(breakfastPct)}%</span>
                <span style={{ fontSize: 10, color: "#059669" }}>🍽️ Félpanzió: {Math.round(halfboardPct)}%</span>
              </div>
            </div>

            {/* Two sliders */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>

              {/* Breakfast */}
              <div style={{
                background: "#FFFBEB", border: "1px solid #FDE68A",
                borderRadius: 14, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18 }}>🌅</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", margin: 0 }}>Reggeli</p>
                      <p style={{ fontSize: 10, color: "#B45309", margin: 0 }}>
                        {fmt(breakfastPrice)} Ft/fő/éj
                      </p>
                    </div>
                  </div>
                  <div style={{
                    minWidth: 56, textAlign: "center",
                    background: "#FEF3C7", borderRadius: 8, padding: "4px 10px",
                    fontSize: 18, fontWeight: 800, color: "#D97706",
                  }}>
                    {Math.round(breakfastPct)}%
                  </div>
                </div>

                <input
                  type="range" min={0} max={100} step={1} value={breakfastPct}
                  onChange={e => { setBreakfastPct(Math.min(Number(e.target.value), 100 - halfboardPct)); setBoardMixDirty(true); }}
                  onMouseUp={e => {
                    const v = Math.min(Number((e.target as HTMLInputElement).value), 100 - halfboardPct);
                    saveBoardMix(v, halfboardPct);
                  }}
                  onTouchEnd={e => {
                    const v = Math.min(Number((e.currentTarget as HTMLInputElement).value), 100 - halfboardPct);
                    saveBoardMix(v, halfboardPct);
                  }}
                  style={{ width: "100%", accentColor: "#D97706", cursor: "pointer", marginBottom: 8 }}
                />

                <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
                  {[0, 10, 25, 50, 75, 100].map(v => (
                    <button key={v} onClick={() => { const n = Math.min(v, 100 - halfboardPct); setBreakfastPct(n); setBoardMixDirty(true); saveBoardMix(n, halfboardPct); }}
                      style={{ flex: 1, fontSize: 9, fontWeight: 700, padding: "3px 0", borderRadius: 5, cursor: "pointer", border: "none",
                        background: Math.round(breakfastPct) === v ? "#D97706" : "#FEF3C7",
                        color: Math.round(breakfastPct) === v ? "white" : "#92400E" }}>{v}%</button>
                  ))}
                </div>

                {/* Category breakdown */}
                <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", border: "1px solid #FDE68A" }}>
                  <p style={{ fontSize: 9, color: "#B45309", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Hozzájárulás (összes szobára vetítve)
                  </p>
                  <p style={{ fontSize: 11, color: "#92400E", margin: 0, fontWeight: 600 }}>
                    {Math.round(breakfastPct)}% × {fmt(breakfastPrice)} Ft × {avgPaxPerRoom} fő
                  </p>
                  <p style={{ fontSize: 15, color: "#D97706", margin: "2px 0 0", fontWeight: 800 }}>
                    = +{fmt(brContrib)} Ft/szoba/éj
                  </p>
                </div>
              </div>

              {/* Halfboard */}
              <div style={{
                background: "#F0FDF4", border: "1px solid #BBF7D0",
                borderRadius: 14, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18 }}>🍽️</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#065F46", margin: 0 }}>Félpanzió</p>
                      <p style={{ fontSize: 10, color: "#047857", margin: 0 }}>
                        {fmt(halfboardPrice)} Ft/fő/éj (reggeli+vacsora)
                      </p>
                    </div>
                  </div>
                  <div style={{
                    minWidth: 56, textAlign: "center",
                    background: "#DCFCE7", borderRadius: 8, padding: "4px 10px",
                    fontSize: 18, fontWeight: 800, color: "#059669",
                  }}>
                    {Math.round(halfboardPct)}%
                  </div>
                </div>

                <input
                  type="range" min={0} max={100} step={1} value={halfboardPct}
                  onChange={e => { setHalfboardPct(Math.min(Number(e.target.value), 100 - breakfastPct)); setBoardMixDirty(true); }}
                  onMouseUp={e => {
                    const v = Math.min(Number((e.target as HTMLInputElement).value), 100 - breakfastPct);
                    saveBoardMix(breakfastPct, v);
                  }}
                  onTouchEnd={e => {
                    const v = Math.min(Number((e.currentTarget as HTMLInputElement).value), 100 - breakfastPct);
                    saveBoardMix(breakfastPct, v);
                  }}
                  style={{ width: "100%", accentColor: "#059669", cursor: "pointer", marginBottom: 8 }}
                />

                <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
                  {[0, 10, 25, 50, 75, 100].map(v => (
                    <button key={v} onClick={() => { const n = Math.min(v, 100 - breakfastPct); setHalfboardPct(n); setBoardMixDirty(true); saveBoardMix(breakfastPct, n); }}
                      style={{ flex: 1, fontSize: 9, fontWeight: 700, padding: "3px 0", borderRadius: 5, cursor: "pointer", border: "none",
                        background: Math.round(halfboardPct) === v ? "#059669" : "#DCFCE7",
                        color: Math.round(halfboardPct) === v ? "white" : "#065F46" }}>{v}%</button>
                  ))}
                </div>

                {/* Category breakdown */}
                <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", border: "1px solid #BBF7D0" }}>
                  <p style={{ fontSize: 9, color: "#047857", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Hozzájárulás (összes szobára vetítve)
                  </p>
                  <p style={{ fontSize: 11, color: "#065F46", margin: 0, fontWeight: 600 }}>
                    {Math.round(halfboardPct)}% × {fmt(halfboardPrice)} Ft × {avgPaxPerRoom} fő
                  </p>
                  <p style={{ fontSize: 15, color: "#059669", margin: "2px 0 0", fontWeight: 800 }}>
                    = +{fmt(hbContrib)} Ft/szoba/éj
                  </p>
                </div>
              </div>
            </div>

            {/* Formula + total */}
            <div style={{
              background: "#FBFBFC", border: "1px solid #DDD6FE",
              borderRadius: 14, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <p style={{ fontSize: 10, color: "#35BD78", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Képlet — súlyozott átlag az összes szobára
                </p>
                <p style={{ fontSize: 12, color: "#03915A", margin: 0, fontFamily: "monospace", lineHeight: 1.6 }}>
                  ({Math.round(breakfastPct)}% × {fmt(breakfastPrice)}{" "}
                  {halfboardPct > 0 && `+ ${Math.round(halfboardPct)}% × ${fmt(halfboardPrice)}`}){" "}
                  × {avgPaxPerRoom} fő = <strong>{fmt(totalBoardSuppl)} Ft</strong>
                </p>
                <p style={{ fontSize: 10, color: "#35BD78", margin: "4px 0 0" }}>
                  Ez adódik hozzá az ADR-hez minden szobaéjszakára (ha nincs manuális szobaárbevétel)
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 10, color: "#35BD78", fontWeight: 700, margin: "0 0 2px", textTransform: "uppercase" }}>
                  Összes F&B felár
                </p>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#35BD78", margin: 0, letterSpacing: "-0.02em" }}>
                  +{fmt(totalBoardSuppl)} Ft
                </p>
                <p style={{ fontSize: 10, color: "#90DBAC", margin: "2px 0 0" }}>
                  /szoba/éj átlag
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION B — KPI Cards */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Éves bevétel"
          value={`${fmtM(isSimActive ? simAnnualRevenue : annualRevenue)} Ft`}
          color="#3B82F6"
          icon={<TrendingUp size={16} />}
          delta={isSimActive && deltaRevenue !== 0 ? `${deltaRevenue > 0 ? "+" : ""}${fmtM(deltaRevenue)} Ft a tervhez képest` : undefined}
          sub={totalRooms ? `${totalRooms} szoba alapján` : "szobaszám hiányzik"}
        />
        {tfhEnabled && (
          <KpiCard
            label={`TFH (${tfhRate}%)`}
            value={`−${fmtM(isSimActive ? simAnnualTfh : annualTfh)} Ft`}
            color="#EF4444"
            icon={<TrendingDown size={16} />}
            sub={`${fmtM(isSimActive ? simAnnualRevenue : annualRevenue)} Ft × ${tfhRate}%`}
          />
        )}
        <KpiCard
          label="Éves profit"
          value={`${(isSimActive ? simAnnualProfit : annualProfit) >= 0 ? "+" : ""}${fmtM(isSimActive ? simAnnualProfit : annualProfit)} Ft`}
          color={profitColor(isSimActive ? simAnnualProfit : annualProfit)}
          icon={(isSimActive ? simAnnualProfit : annualProfit) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          delta={isSimActive && deltaProfit !== 0 ? `${deltaProfit > 0 ? "+" : ""}${fmtM(deltaProfit)} Ft a tervhez képest` : undefined}
          sub={(isSimActive ? simAnnualRevenue : annualRevenue) > 0
            ? `${Math.round((isSimActive ? simAnnualProfit : annualProfit) / (isSimActive ? simAnnualRevenue : annualRevenue) * 100)}% margin${tfhEnabled ? " (TFH után)" : ""}`
            : undefined}
        />
        <KpiCard
          label="Átl. kihasználtság"
          value={`${Math.round(isSimActive ? simAvgOcc : avgOcc)}%`}
          color="#35BD78"
          icon={<Bed size={16} />}
          delta={isSimActive && simOffset !== 0 ? `${simOffset > 0 ? "+" : ""}${simOffset} pp az összes hónapra` : undefined}
          sub={filledCalcs.length > 0 ? `${filledCalcs.length} hónap alapján` : "nincs adat"}
        />
        <KpiCard
          label="Átl. margin"
          value={`${Math.round(isSimActive ? simAvgMargin : avgMargin)}%`}
          color="#10B981"
          icon={<Percent size={16} />}
          delta={isSimActive ? `szimuláció aktív` : undefined}
          sub={filledCalcs.length > 0 ? `${filledCalcs.filter(c => c.margin !== null).length} hónap alapján` : "nincs adat"}
        />
        <KpiCard
          label="Átlag ADR"
          value={weightedAvgAdr > 0 ? `${fmt(Math.round(weightedAvgAdr))} Ft` : "—"}
          color="#F59E0B"
          icon={<DollarSign size={16} />}
          sub="szobaeladott éjszakára vetítve"
        />
        <KpiCard
          label="Szobaárbev./szoba/éj"
          value={avgRevPerRoomNight > 0 ? `${fmt(Math.round(avgRevPerRoomNight))} Ft` : "—"}
          color="#35BD78"
          icon={<TrendingUp size={16} />}
          sub={fbEnabled ? "ADR + F&B + egyéb" : "ADR alapján"}
        />
      </div>

      {/* Breakeven banner */}
      {annualBreakeven !== null && filledCalcs.length > 0 && (
        <div style={{
          background: (isSimActive ? simAnnualProfit : annualProfit) >= 0 ? "#D1FAE5" : "#FEE2E2",
          border: `1px solid ${(isSimActive ? simAnnualProfit : annualProfit) >= 0 ? "#6EE7B7" : "#FCA5A5"}`,
          borderRadius: 14, padding: "12px 20px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: (isSimActive ? simAnnualProfit : annualProfit) >= 0 ? "#10B981" : "#EF4444",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {(isSimActive ? simAnnualProfit : annualProfit) >= 0
              ? <TrendingUp size={18} color="white" />
              : <TrendingDown size={18} color="white" />}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: (isSimActive ? simAnnualProfit : annualProfit) >= 0 ? "#065F46" : "#991B1B", margin: 0 }}>
              {(isSimActive ? simAnnualProfit : annualProfit) >= 0
                ? `Éves szinten nyereséges — fedezeti pont: ${Math.round(isSimActive ? (simBreakeven ?? 0) : (annualBreakeven ?? 0))}% kihasználtság`
                : `Éves szinten veszteséges — fedezeti pont: ${Math.round(isSimActive ? (simBreakeven ?? 0) : (annualBreakeven ?? 0))}% kihasználtság`}
            </p>
            <p style={{ fontSize: 12, color: (isSimActive ? simAnnualProfit : annualProfit) >= 0 ? "#047857" : "#B91C1C", margin: "2px 0 0" }}>
              {isSimActive ? "Szimulált" : "Jelenlegi"} átlagos kihasználtság: {Math.round(isSimActive ? simAvgOcc : avgOcc)}%
              {(() => {
                const activeOcc = isSimActive ? simAvgOcc : avgOcc;
                const activeBe = isSimActive ? (simBreakeven ?? annualBreakeven) : annualBreakeven;
                if (activeOcc <= 0 || activeBe === null) return null;
                const diff = activeOcc - activeBe;
                return diff >= 0
                  ? ` — ${Math.round(diff)} százalékponttal a fedezeti pont felett`
                  : ` — ${Math.round(-diff)} százalékpont hiányzik a nullszaldóhoz`;
              })()}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION C — Live Simulator */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: isSimActive ? "linear-gradient(135deg, #FBFBFC 0%, #EEF2FF 100%)" : "white",
        border: `1px solid ${isSimActive ? "#90DBAC" : "#E2E8F0"}`,
        borderRadius: 20, padding: "20px 24px", marginBottom: 24,
        transition: "all 0.2s",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: isSimActive ? "#35BD78" : "#E2E8F0",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>
              <Sliders size={16} color={isSimActive ? "white" : "#94A3B8"} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                Élő szimulátor
              </h2>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
                Állítsd a kihasználtságot — valós időben látod a hatást (nem menti)
              </p>
            </div>
          </div>
          {isSimActive && (
            <button
              onClick={() => setSimOffset(0)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#EF4444", border: "none", borderRadius: 10,
                padding: "8px 14px", cursor: "pointer", color: "white",
                fontSize: 12, fontWeight: 600,
              }}
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>

        {/* Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: isSimActive ? 20 : 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", whiteSpace: "nowrap" }}>
            Kihasználtság módosítás:
          </span>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={simOffset}
              onChange={e => setSimOffset(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#35BD78", cursor: "pointer", height: 6 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>-30%</span>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>0%</span>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>+30%</span>
            </div>
          </div>
          <div style={{
            minWidth: 64, textAlign: "center",
            background: isSimActive ? "#35BD78" : "#F1F5F9",
            borderRadius: 10, padding: "6px 12px",
            fontSize: 16, fontWeight: 800,
            color: isSimActive ? "white" : "#94A3B8",
            transition: "all 0.2s",
          }}>
            {simOffset > 0 ? "+" : ""}{simOffset}%
          </div>
        </div>

        {/* Simulation result cards */}
        {isSimActive && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {/* Revenue delta */}
            <div style={{
              background: "white", borderRadius: 14, padding: "14px 18px",
              border: `1px solid ${deltaRevenue >= 0 ? "#A7F3D0" : "#FCA5A5"}`,
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                Bevétel változás
              </p>
              <p style={{ fontSize: 20, fontWeight: 800, color: deltaRevenue >= 0 ? "#10B981" : "#EF4444", margin: 0 }}>
                {deltaRevenue >= 0 ? "+" : ""}{fmtM(deltaRevenue)} Ft
              </p>
              <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
                {fmtM(annualRevenue)} → {fmtM(simAnnualRevenue)} Ft
              </p>
            </div>

            {/* Profit delta */}
            <div style={{
              background: "white", borderRadius: 14, padding: "14px 18px",
              border: `1px solid ${deltaProfit >= 0 ? "#A7F3D0" : "#FCA5A5"}`,
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                Profit változás
              </p>
              <p style={{ fontSize: 20, fontWeight: 800, color: deltaProfit >= 0 ? "#10B981" : "#EF4444", margin: 0 }}>
                {deltaProfit >= 0 ? "+" : ""}{fmtM(deltaProfit)} Ft
              </p>
              <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
                {fmtM(annualProfit)} → {fmtM(simAnnualProfit)} Ft
              </p>
            </div>

            {/* Occupancy → breakeven distance */}
            <div style={{
              background: "white", borderRadius: 14, padding: "14px 18px",
              border: `1px solid ${simAnnualProfit >= 0 ? "#A7F3D0" : "#FCA5A5"}`,
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                Kihasználtság (avg)
              </p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#35BD78", margin: 0 }}>
                {Math.round(simAvgOcc)}%
              </p>
              {simBreakeven !== null && (
                <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
                  fedezeti pont: {Math.round(simBreakeven)}%
                  {simAvgOcc >= simBreakeven
                    ? ` ✓ +${Math.round(simAvgOcc - simBreakeven)} pp`
                    : ` ✗ ${Math.round(simBreakeven - simAvgOcc)} pp hiányzik`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION D — Charts */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>

        {/* Chart 1: Revenue & Profit */}
        <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 20, padding: "20px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Bevétel & Profit</h3>
            {isSimActive && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#35BD78", background: "#FBFBFC", padding: "3px 8px", borderRadius: 6 }}>
                SZIMULÁCIÓ AKTÍV
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => fmtM(v)}
                width={50}
              />
              <ReTooltip content={<ChartTooltipRevenue />} />
              <ReferenceLine y={0} stroke="#E2E8F0" />

              {isSimActive ? (
                <>
                  <Bar dataKey="simRevenue" name="simRevenue" fill="#35BD78" radius={[4, 4, 0, 0]} opacity={0.9}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.hasData ? "#35BD78" : "#E2E8F0"} />
                    ))}
                  </Bar>
                  <Bar dataKey="simProfit" name="simProfit" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.85}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.hasData ? (entry.simProfit >= 0 ? "#10B981" : "#EF4444") : "#E2E8F0"} />
                    ))}
                  </Bar>
                </>
              ) : (
                <>
                  <Bar dataKey="revenue" name="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} opacity={0.9}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.hasData ? "#3B82F6" : "#E2E8F0"} />
                    ))}
                  </Bar>
                  <Bar dataKey="profit" name="profit" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.85}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.hasData ? (entry.profit >= 0 ? "#10B981" : "#EF4444") : "#E2E8F0"} />
                    ))}
                  </Bar>
                </>
              )}
            </BarChart>
          </ResponsiveContainer>

          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: isSimActive ? "#35BD78" : "#3B82F6" }} />
              <span style={{ fontSize: 11, color: "#64748B" }}>Bevétel</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: "#10B981" }} />
              <span style={{ fontSize: 11, color: "#64748B" }}>Profit</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: "#EF4444" }} />
              <span style={{ fontSize: 11, color: "#64748B" }}>Veszteség</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Occupancy + Breakeven */}
        <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 20, padding: "20px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Kihasználtság & Fedezeti pont</h3>
            {isSimActive && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#35BD78", background: "#FBFBFC", padding: "3px 8px", borderRadius: 6 }}>
                SZIMULÁCIÓ AKTÍV
              </span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
                width={36}
              />
              <ReTooltip content={<ChartTooltipOcc />} />

              {/* Actual or simulated occupancy bars */}
              {isSimActive ? (
                <>
                  <Bar dataKey="occ" name="occ" fill="rgba(53,189,120,0.4)" radius={[3, 3, 0, 0]} opacity={0.5}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.hasData ? "rgba(53,189,120,0.4)" : "#F1F5F9"} />
                    ))}
                  </Bar>
                  <Bar dataKey="simOcc" name="simOcc" fill="#35BD78" radius={[3, 3, 0, 0]} opacity={0.85}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.hasData ? "#35BD78" : "#F1F5F9"} />
                    ))}
                  </Bar>
                </>
              ) : (
                <Bar dataKey="occ" name="occ" fill="#35BD78" radius={[4, 4, 0, 0]} opacity={0.85}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hasData ? "#35BD78" : "#E2E8F0"} />
                  ))}
                </Bar>
              )}

              {/* Breakeven reference line for each month — rendered as separate bars */}
              <Bar dataKey="breakeven" name="breakeven" fill="none" radius={0} opacity={0}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill="transparent" />
                ))}
              </Bar>

              {/* Annual breakeven horizontal line */}
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
            {isSimActive ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(53,189,120,0.4)" }} />
                  <span style={{ fontSize: 11, color: "#64748B" }}>Terv</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: "#35BD78" }} />
                  <span style={{ fontSize: 11, color: "#64748B" }}>Szimuláció</span>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "#35BD78" }} />
                <span style={{ fontSize: 11, color: "#64748B" }}>Kihasználtság %</span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 2, background: "#EF4444", borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: "#64748B" }}>Fedezeti pont</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION E — Monthly results table */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>Havi eredmények</h2>
          {isSimActive && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#35BD78", background: "#FBFBFC", padding: "4px 10px", borderRadius: 8 }}>
              Szimulált adatok megjelenítve
            </span>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700, fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {[
                  { label: "Hónap", align: "left" },
                  { label: "Kihasználtság", align: "right" },
                  { label: "Szobaéj", align: "right" },
                  { label: "Szobaárbevétel/szoba/éj", align: "right" },
                  { label: "Bevétel", align: "right" },
                  { label: "Kiadás/szoba/éj", align: "right" },
                  { label: "Összes kiadás", align: "right" },
                  ...(tfhEnabled ? [{ label: `TFH (${tfhRate}%)`, align: "right" }] : []),
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
              {(isSimActive ? simCalcs : calcs).map((c, i) => {
                const m = (isSimActive ? simMonths : months).find(m => m.month === c.month)!;
                const effectiveCostPerRoom = c.roomNights > 0 ? c.cost / c.roomNights : 0;
                const savedC = calcs[i];
                const occChanged = isSimActive && m.occupancyPct !== months[i].occupancyPct;
                return (
                  <tr key={c.month} style={{ borderBottom: "1px solid #F8FAFC", opacity: c.hasData ? 1 : 0.35 }}>
                    <td style={{ padding: "9px 16px", fontWeight: 600, color: "#0F172A" }}>
                      {HU_MONTHS[c.month - 1]}
                    </td>
                    <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ color: occChanged ? "#35BD78" : "#334155", fontWeight: occChanged ? 700 : 400 }}>
                        {c.hasData ? `${m.occupancyPct}%` : "—"}
                      </span>
                      {occChanged && (
                        <span style={{ fontSize: 10, color: simOffset > 0 ? "#10B981" : "#EF4444", marginLeft: 4 }}>
                          ({simOffset > 0 ? "+" : ""}{simOffset}pp)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#334155" }}>
                      {c.hasData ? fmt(c.roomNights) : "—"}
                    </td>
                    <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {c.hasData && c.roomNights > 0 ? (
                        <span>
                          <span style={{
                            color: m.roomRevenue > 0 ? "#35BD78" : "#334155",
                            fontWeight: m.roomRevenue > 0 ? 700 : 400,
                          }}>
                            {fmt(Math.round(c.revenue / c.roomNights))} Ft
                          </span>
                          {m.roomRevenue === 0 && fbEnabled && (
                            <span style={{ fontSize: 9, color: "#10B981", marginLeft: 4, fontWeight: 700 }}>+F&B</span>
                          )}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: isSimActive && c.revenue !== savedC.revenue ? "#35BD78" : "#334155", fontWeight: isSimActive && c.revenue !== savedC.revenue ? 600 : 400 }}>
                      {c.hasData ? fmtM(c.revenue) : "—"}
                    </td>
                    <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8" }}>
                      {c.hasData && effectiveCostPerRoom > 0 ? `${fmt(effectiveCostPerRoom)} Ft` : "—"}
                    </td>
                    <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8" }}>
                      {c.hasData ? fmtM(c.cost) : "—"}
                    </td>
                    {tfhEnabled && (
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
                <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#35BD78" }}>
                  {Math.round(isSimActive ? simAvgOcc : avgOcc)}% avg
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#0F172A" }}>
                  {fmt((isSimActive ? simCalcs : calcs).reduce((s, c) => s + c.roomNights, 0))}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#94A3B8", fontSize: 11 }}>—</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#0F172A" }}>
                  {fmtM(isSimActive ? simAnnualRevenue : annualRevenue)}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#94A3B8", fontSize: 11 }}>—</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748B" }}>
                  {fmtM(isSimActive ? simAnnualCost : annualCost)}
                </td>
                {tfhEnabled && (
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
    </div>
  );
}
