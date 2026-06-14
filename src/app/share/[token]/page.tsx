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
  id: string; month: number; adr: number;
  occupancyPct: number; roomRevenue: number; monthlyCost: number;
  breakfastPct: number; halfboardPct: number;
};
type ShareData = {
  plan: { id: string; name: string; year: number; shareSummary: string | null; shareExpiresAt: string | null };
  hotel: { name: string; totalRooms: number | null };
  months: MonthData[];
  settings: {
    tfhEnabled: boolean; tfhRate: number;
    fbEnabled: boolean; breakfastPrice: number; halfboardPrice: number; avgPaxPerRoom: number;
    defaultBreakfastPct: number; defaultHalfboardPct: number;
    fbOtherEnabled: boolean; fbOtherPct: number;
    spaEnabled: boolean; spaPct: number;
    otherRevenueEnabled: boolean; otherRevenuePct: number;
    annualFixedCost: number;
    breakfastCost: number; halfboardCost: number;
    laundryEnabled: boolean; laundryPerRoom: number;
    commissionEnabled: boolean; commissionPct: number; commissionBookingsPct: number;
  };
};
type CostParams = {
  annualFixedCost: number;
  breakfastCost: number; halfboardCost: number; avgPaxPerRoom: number;
  laundryEnabled: boolean; laundryPerRoom: number;
  commissionEnabled: boolean; commissionPct: number; commissionBookingsPct: number;
};
type MonthCalc = {
  month: number; daysInMonth: number; roomNights: number;
  revenue: number; cost: number; tfh: number;
  profit: number; margin: number | null; breakeven: number | null; hasData: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return Math.round(n).toLocaleString("hu-HU"); }
function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString("hu-HU", { maximumFractionDigits: 0 })} E`;
  return fmt(n);
}
function getDaysInMonth(month: number, year: number) { return new Date(year, month, 0).getDate(); }

type FbParams = {
  enabled: boolean;
  breakfastPrice: number; halfboardPrice: number; avgPaxPerRoom: number;
  fbOtherEnabled: boolean; fbOtherPct: number;
  spaEnabled: boolean; spaPct: number;
  otherRevenueEnabled: boolean; otherRevenuePct: number;
};

function computeMonthCalc(m: MonthData, totalRooms: number, year: number, tfhRate: number, fb?: FbParams, costs?: CostParams): MonthCalc {
  const days = getDaysInMonth(m.month, year);
  const availableNights = totalRooms * days;
  const hasData = m.adr > 0 || m.occupancyPct > 0 || m.roomRevenue > 0;
  const roomNights = (m.occupancyPct / 100) * availableNights;

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

  // Jutalék alapja: ADR + ellátás (egyéb % nélkül)
  const commissionableRevPerRoomNight = m.roomRevenue > 0 ? m.roomRevenue : m.adr + boardPerRoomNight;

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
    cost = fixedPerMonth + (fbCostPerRoomNight + laundryCostPerRoomNight + commissionCostPerRoomNight) * roomNights;
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
  if (p > 0) return "#059669";
  if (p === 0) return "#94A3B8";
  return "#DC2626";
}
function profitBg(p: number) {
  if (p > 0) return "#ECFDF5";
  if (p === 0) return "#F1F5F9";
  return "#FEF2F2";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accentColor, valueColor, icon,
}: {
  label: string; value: string; sub?: string;
  accentColor: string; valueColor?: string; icon: string;
}) {
  return (
    <div style={{
      background: "white",
      borderRadius: 16,
      padding: "20px 22px 18px",
      boxShadow: "0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
      border: "1px solid #E2E8F0",
      borderTop: `3px solid ${accentColor}`,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "#94A3B8",
          textTransform: "uppercase", letterSpacing: "0.07em",
        }}>
          {label}
        </span>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      </div>
      <p style={{
        fontSize: 26, fontWeight: 800, color: valueColor ?? "#0F172A",
        margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontWeight: 500 }}>{sub}</p>
      )}
    </div>
  );
}

// ─── Chart Tooltips ───────────────────────────────────────────────────────────

function TooltipRevenue({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "white", border: "1px solid #E2E8F0",
      borderRadius: 12, padding: "12px 16px",
      boxShadow: "0 8px 32px rgba(15,23,42,0.12)",
    }}>
      <p style={{ fontWeight: 700, color: "#0F172A", margin: "0 0 8px", fontSize: 13 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ margin: "3px 0", fontSize: 12, color: p.color, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: "inline-block", flexShrink: 0 }} />
          {p.dataKey === "revenue" ? "Bevétel" : "Profit"}: {fmtM(p.value)} Ft
        </p>
      ))}
    </div>
  );
}

function TooltipOcc({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "white", border: "1px solid #E2E8F0",
      borderRadius: 12, padding: "12px 16px",
      boxShadow: "0 8px 32px rgba(15,23,42,0.12)",
    }}>
      <p style={{ fontWeight: 700, color: "#0F172A", margin: "0 0 8px", fontSize: 13 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ margin: "3px 0", fontSize: 12, color: p.color, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: "inline-block", flexShrink: 0 }} />
          {p.dataKey === "occ" ? "Kihasználtság" : "Fedezeti pont"}: {Math.round(p.value)}%
        </p>
      ))}
    </div>
  );
}

// ─── Loading / Error screens ─────────────────────────────────────────────────

function FullScreenMessage({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#F8FAFC",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 32,
    }}>
      {/* Branding */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg,#35BD78,#03915A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>📈</div>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>HeyMax!</span>
      </div>

      <div style={{
        background: "white", borderRadius: 24,
        border: "1px solid #E2E8F0",
        boxShadow: "0 4px 24px rgba(15,23,42,0.08)",
        padding: "40px 48px", textAlign: "center", maxWidth: 420,
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "0 0 10px", letterSpacing: "-0.02em" }}>{title}</h1>
        <p style={{ fontSize: 14, color: "#64748B", margin: 0, lineHeight: 1.7 }}>{desc}</p>
      </div>
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
  const [simAdrPct, setSimAdrPct] = useState(0);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [passwordChecking, setPasswordChecking] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  async function fetchData(pwd?: string) {
    const headers: Record<string, string> = {};
    if (pwd) headers["X-Share-Password"] = pwd;
    try {
      const res = await fetch(`/api/public/share/${token}`, { headers });
      if (res.status === 410) { setError("expired"); return; }
      if (res.status === 401) {
        const json = await res.json().catch(() => ({}));
        if (json.error === "password_required") {
          setPasswordRequired(true);
          // Try sessionStorage cached password first
          if (!pwd) {
            let cached: string | null = null;
            try { cached = sessionStorage.getItem(`share_pwd_${token}`); } catch { /* ignore */ }
            if (cached) { fetchData(cached).catch(() => {}); return; }
          }
          return;
        }
        setError("not_found");
        return;
      }
      if (!res.ok) { setError("not_found"); return; }
      if (pwd) { try { sessionStorage.setItem(`share_pwd_${token}`, pwd); } catch { /* ignore */ } }
      setData(await res.json() as ShareData);
    } catch {
      setError("not_found");
    } finally {
      setLoading(false);
      setPasswordChecking(false);
    }
  }

  useEffect(() => { fetchData(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setPasswordError(false);
    setPasswordChecking(true);
    try {
      const headers: Record<string, string> = { "X-Share-Password": passwordInput };
      const res = await fetch(`/api/public/share/${token}`, { headers });
      if (res.status === 401) {
        setPasswordError(true);
        return;
      }
      if (!res.ok) { setError("not_found"); return; }
      try { sessionStorage.setItem(`share_pwd_${token}`, passwordInput); } catch { /* ignore storage errors */ }
      const json = await res.json() as ShareData;
      setData(json);
      setPasswordRequired(false);
      setLoading(false);
    } catch {
      setPasswordError(true);
    } finally {
      setPasswordChecking(false);
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#F8FAFC",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 16,
      }}>
        <div style={{
          width: 44, height: 44,
          border: "3px solid #E2E8F0",
          borderTopColor: "#35BD78",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>Prezentáció betöltése…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error === "expired") return (
    <FullScreenMessage
      icon="⏰"
      title="Ez a link lejárt"
      desc="A megosztott prezentáció érvényessége lejárt. Kérd a szálloda munkatársait egy új link küldéséért."
    />
  );
  if (error === "not_found") return (
    <FullScreenMessage
      icon="🔒"
      title="A prezentáció nem elérhető"
      desc="Ez a megosztási link nem érvényes, vagy már visszavonták."
    />
  );

  // ── Password gate ──────────────────────────────────────────────────────────
  if (passwordRequired && !data) return (
    <div style={{
      minHeight: "100vh", background: "#F1F5F9",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Branding */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg,#35BD78,#03915A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>📈</div>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>HeyMax!</span>
      </div>

      <div style={{
        background: "white", borderRadius: 24,
        border: "1px solid #E2E8F0",
        boxShadow: "0 8px 32px rgba(15,23,42,0.1)",
        padding: "40px 40px 36px",
        width: "100%", maxWidth: 400,
      }}>
        {/* Lock icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "linear-gradient(135deg,#35BD78,#03915A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 8px 24px rgba(53,189,120,0.3)",
        }}>
          <span style={{ fontSize: 26 }}>🔐</span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 6px", textAlign: "center", letterSpacing: "-0.02em" }}>
          Jelszóval védett tartalom
        </h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 28px", textAlign: "center", lineHeight: 1.6 }}>
          A prezentáció megtekintéséhez add meg a hozzáférési jelszót.
        </p>

        <form onSubmit={submitPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <input
              type={showPwd ? "text" : "password"}
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
              placeholder="Jelszó..."
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box",
                border: `1.5px solid ${passwordError ? "#EF4444" : "#E2E8F0"}`,
                borderRadius: 12, padding: "12px 44px 12px 16px",
                fontSize: 14, color: "#0F172A", outline: "none",
                background: passwordError ? "#FEF2F2" : "#F8FAFC",
                transition: "border-color 0.15s",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "#94A3B8",
                display: "flex", alignItems: "center", padding: 0,
              }}
            >
              {showPwd
                ? <span style={{ fontSize: 16 }}>🙈</span>
                : <span style={{ fontSize: 16 }}>👁️</span>}
            </button>
          </div>

          {passwordError && (
            <p style={{ fontSize: 12, color: "#EF4444", margin: 0, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              ✗ Helytelen jelszó. Próbáld újra.
            </p>
          )}

          <button
            type="submit"
            disabled={passwordChecking || !passwordInput.trim()}
            style={{
              padding: "13px 24px", borderRadius: 12, border: "none",
              background: passwordChecking || !passwordInput.trim()
                ? "#E2E8F0" : "linear-gradient(135deg,#35BD78,#03915A)",
              color: passwordChecking || !passwordInput.trim() ? "#94A3B8" : "white",
              fontSize: 14, fontWeight: 700, cursor: passwordChecking || !passwordInput.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
              boxShadow: passwordChecking || !passwordInput.trim() ? "none" : "0 4px 16px rgba(53,189,120,0.3)",
            }}
          >
            {passwordChecking
              ? <><span style={{ fontSize: 14 }}>⏳</span> Ellenőrzés…</>
              : <><span style={{ fontSize: 14 }}>🔓</span> Megtekintés</>}
          </button>
        </form>
      </div>

      <p style={{ fontSize: 11, color: "#CBD5E1", marginTop: 24 }}>
        HeyMax! · Biztonságos megosztás
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!data) return null;

  // ─── Calculations ─────────────────────────────────────────────────────────

  const { plan, hotel, months, settings } = data;
  const totalRooms = hotel.totalRooms ?? 0;
  const effectiveTfhRate = settings.tfhEnabled ? settings.tfhRate : 0;

  const fb: FbParams = {
    enabled: settings.fbEnabled,
    // breakfastPct/halfboardPct havi szinten van a month adatokban
    breakfastPrice: settings.breakfastPrice,
    halfboardPrice: settings.halfboardPrice,
    avgPaxPerRoom: settings.avgPaxPerRoom,
    fbOtherEnabled: settings.fbOtherEnabled,
    fbOtherPct: settings.fbOtherPct,
    spaEnabled: settings.spaEnabled,
    spaPct: settings.spaPct,
    otherRevenueEnabled: settings.otherRevenueEnabled,
    otherRevenuePct: settings.otherRevenuePct,
  };

  function applyBoardDefaults(m: MonthData): MonthData {
    if (
      settings.fbEnabled &&
      m.breakfastPct === 0 && m.halfboardPct === 0 &&
      (settings.defaultBreakfastPct > 0 || settings.defaultHalfboardPct > 0)
    ) {
      return { ...m, breakfastPct: settings.defaultBreakfastPct, halfboardPct: settings.defaultHalfboardPct };
    }
    return m;
  }

  const monthsWithDefaults = months.map(m => applyBoardDefaults(m));

  const costs: CostParams = {
    annualFixedCost: settings.annualFixedCost,
    breakfastCost: settings.breakfastCost,
    halfboardCost: settings.halfboardCost,
    avgPaxPerRoom: settings.avgPaxPerRoom,
    laundryEnabled: settings.laundryEnabled,
    laundryPerRoom: settings.laundryPerRoom,
    commissionEnabled: settings.commissionEnabled,
    commissionPct: settings.commissionPct,
    commissionBookingsPct: settings.commissionBookingsPct,
  };

  const calcs: MonthCalc[] = monthsWithDefaults.map(m =>
    computeMonthCalc(m, totalRooms, plan.year, effectiveTfhRate, fb, costs)
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
  const annualBreakeven = annualNetRevenue > 0 && avgOcc > 0
    ? (annualCost / annualNetRevenue) * avgOcc : null;

  // Átlag ADR és szobaárbevétel/szoba/éj (szobaeladott éjszakával súlyozva)
  const totalFilledRoomNights = filledCalcs.reduce((s, c) => s + c.roomNights, 0);
  const weightedAvgAdr = totalFilledRoomNights > 0
    ? filledCalcs.reduce((s, c) => {
        const m = monthsWithDefaults.find(mm => mm.month === c.month);
        return s + (m?.adr ?? 0) * c.roomNights;
      }, 0) / totalFilledRoomNights
    : 0;
  const avgRevPerRoomNight = totalFilledRoomNights > 0
    ? annualRevenue / totalFilledRoomNights
    : 0;

  const isSimActive = simOffset !== 0 || simAdrPct !== 0;
  const simMonths = monthsWithDefaults.map(m => ({
    ...m,
    occupancyPct: Math.min(100, Math.max(0, m.occupancyPct + simOffset)),
    adr: simAdrPct !== 0 ? Math.round(m.adr * (1 + simAdrPct / 100)) : m.adr,
    roomRevenue: simAdrPct !== 0 && m.roomRevenue > 0
      ? Math.round(m.roomRevenue * (1 + simAdrPct / 100))
      : m.roomRevenue,
  }));
  const simCalcs: MonthCalc[] = simMonths.map(m =>
    computeMonthCalc(m, totalRooms, plan.year, effectiveTfhRate, fb, costs)
  );
  const simFilledCalcs = simCalcs.filter(c => c.hasData);
  const simAnnualRevenue = simCalcs.reduce((s, c) => s + c.revenue, 0);
  const simAnnualCost   = simCalcs.reduce((s, c) => s + c.cost,    0);
  const simAnnualTfh    = simCalcs.reduce((s, c) => s + c.tfh,     0);
  const simAnnualProfit = simAnnualRevenue - simAnnualCost - simAnnualTfh;
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

  const displayCalcs = isSimActive ? simCalcs : calcs;
  const displayMonths = isSimActive ? simMonths : months;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── Sticky Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E2E8F0",
        boxShadow: "0 1px 8px rgba(15,23,42,0.06)",
      }}>
        <div style={{
          maxWidth: 1180, margin: "0 auto",
          padding: "14px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Left: hotel info */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg,#35BD78,#03915A)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, fontSize: 18, boxShadow: "0 4px 12px rgba(53,189,120,0.3)",
            }}>🏨</div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                {hotel.name}
              </h1>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
                {plan.name} · {plan.year}. évi terv
              </p>
            </div>
          </div>

          {/* Right: branding + badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: "#64748B",
              background: "#F1F5F9",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              padding: "4px 10px",
              letterSpacing: "0.05em",
            }}>
              CSAK OLVASHATÓ
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg,#35BD78,#03915A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>📈</div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>HeyMax!</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Page body ── */}
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 32px 80px" }}>

        {/* ── Hero strip ── */}
        <div style={{
          background: "linear-gradient(135deg, #35BD78 0%, #4F46E5 100%)",
          borderRadius: 20,
          padding: "32px 40px",
          marginBottom: 28,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(53,189,120,0.25)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative circles */}
          <div style={{
            position: "absolute", right: -40, top: -40,
            width: 200, height: 200, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", right: 60, bottom: -60,
            width: 160, height: 160, borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.65)", margin: "0 0 6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Profit előrejelzés
            </p>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: "white", margin: "0 0 6px", letterSpacing: "-0.03em" }}>
              {plan.year}. évi terv
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: 0 }}>
              {hotel.name}{totalRooms ? ` · ${totalRooms} szoba` : ""}
            </p>
          </div>
          <div style={{ textAlign: "right", position: "relative" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: "0 0 4px" }}>Tervezett éves profit</p>
            <p style={{
              fontSize: 36, fontWeight: 900, color: "white", margin: 0,
              letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums",
            }}>
              {annualProfit >= 0 ? "+" : ""}{fmtM(annualProfit)} Ft
            </p>
          </div>
        </div>

        {/* ── AI Summary ── */}
        {plan.shareSummary && (
          <div style={{
            background: "white",
            borderRadius: 18,
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
            marginBottom: 24,
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 24px",
              borderBottom: "1px solid #F1F5F9",
              background: "#FAFAFA",
            }}>
              <span style={{ fontSize: 16 }}>✨</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#35BD78", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                AI összefoglaló
              </span>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
                {plan.shareSummary}
              </p>
            </div>
          </div>
        )}

        {/* ── Interaktív szimulátor + KPI egy blokkban ── */}
        <div style={{
          background: "white",
          borderRadius: 24,
          border: isSimActive ? "2px solid #35BD78" : "1px solid #E2E8F0",
          boxShadow: isSimActive
            ? "0 12px 48px rgba(53,189,120,0.18)"
            : "0 2px 12px rgba(15,23,42,0.07)",
          marginBottom: 24,
          overflow: "hidden",
          transition: "all 0.3s",
        }}>

          {/* ── Header ── */}
          <div style={{
            background: isSimActive
              ? "linear-gradient(135deg, #FBFBFC 0%, rgba(53,189,120,0.12) 100%)"
              : "linear-gradient(135deg, #FAFAFA 0%, #F1F5F9 100%)",
            borderBottom: `1px solid ${isSimActive ? "#DDD6FE" : "#E2E8F0"}`,
            padding: "20px 28px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            transition: "all 0.3s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 16,
                background: isSimActive
                  ? "linear-gradient(135deg, #35BD78, #03915A)"
                  : "linear-gradient(135deg, #CBD5E1, #94A3B8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0,
                boxShadow: isSimActive ? "0 4px 16px rgba(53,189,120,0.35)" : "none",
                transition: "all 0.3s",
              }}>🎛️</div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                  Foglaltsági forgatókönyv-szimulátor
                </h2>
                <p style={{ fontSize: 12, color: isSimActive ? "#35BD78" : "#94A3B8", margin: "3px 0 0", fontWeight: 600, transition: "color 0.3s" }}>
                  {isSimActive
                    ? [
                        simOffset !== 0 ? `${simOffset > 0 ? "+" : ""}${simOffset} pp occ` : "",
                        simAdrPct !== 0 ? `${simAdrPct > 0 ? "+" : ""}${simAdrPct}% ADR` : "",
                      ].filter(Boolean).join(" · ") + " — az összes szám valós időben frissül"
                    : "Állítsd a csúszkákat és nézd meg, hogyan változna az éves eredmény"}
                </p>
              </div>
            </div>
            {isSimActive && (
              <button
                onClick={() => { setSimOffset(0); setSimAdrPct(0); }}
                style={{
                  fontSize: 12, fontWeight: 700,
                  color: "#35BD78", background: "white",
                  border: "1.5px solid rgba(53,189,120,0.4)",
                  borderRadius: 10, padding: "8px 18px",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(53,189,120,0.1)",
                }}
              >
                ↺ Visszaállítás
              </button>
            )}
          </div>

          {/* ── Csúszkák ── */}
          <div style={{
            padding: "24px 32px",
            borderBottom: "1px solid #F1F5F9",
            background: isSimActive ? "#FDFCFF" : "white",
            transition: "background 0.3s",
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            {/* Kihasználtság slider */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap", width: 140, flexShrink: 0 }}>
                Kihasználtság:
              </span>
              <div style={{ flex: 1, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pesszimista</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: simOffset !== 0 ? "#35BD78" : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", transition: "color 0.3s" }}>
                    {simOffset !== 0 ? `${simOffset > 0 ? "+" : ""}${simOffset} pp` : "Alapterv"}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Optimista</span>
                </div>
                <input
                  type="range" min={-30} max={30} step={1} value={simOffset}
                  onChange={e => setSimOffset(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#35BD78", cursor: "pointer", height: 6 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 600 }}>−30 pp</span>
                  <span style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 600 }}>0</span>
                  <span style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 600 }}>+30 pp</span>
                </div>
              </div>
              <div style={{
                minWidth: 72, textAlign: "center",
                background: simOffset !== 0 ? "linear-gradient(135deg, #35BD78, #03915A)" : "#F1F5F9",
                borderRadius: 12, padding: "10px 14px",
                fontSize: 20, fontWeight: 900,
                color: simOffset !== 0 ? "white" : "#CBD5E1",
                boxShadow: simOffset !== 0 ? "0 4px 12px rgba(53,189,120,0.3)" : "none",
                transition: "all 0.25s", lineHeight: 1, flexShrink: 0,
              }}>
                {simOffset > 0 ? "+" : ""}{simOffset}
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, opacity: 0.8 }}>pp</div>
              </div>
            </div>

            {/* ADR korrekció slider */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap", width: 140, flexShrink: 0 }}>
                ADR korrekció:
              </span>
              <div style={{ flex: 1, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Alacsonyabb</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: simAdrPct !== 0 ? "#6366F1" : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", transition: "color 0.3s" }}>
                    {simAdrPct !== 0 ? `${simAdrPct > 0 ? "+" : ""}${simAdrPct}% ADR` : "Változatlan"}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Magasabb</span>
                </div>
                <input
                  type="range" min={-30} max={30} step={1} value={simAdrPct}
                  onChange={e => setSimAdrPct(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#6366F1", cursor: "pointer", height: 6 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 600 }}>−30%</span>
                  <span style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 600 }}>0%</span>
                  <span style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 600 }}>+30%</span>
                </div>
              </div>
              <div style={{
                minWidth: 72, textAlign: "center",
                background: simAdrPct !== 0 ? "linear-gradient(135deg, #6366F1, #4F46E5)" : "#F1F5F9",
                borderRadius: 12, padding: "10px 14px",
                fontSize: 20, fontWeight: 900,
                color: simAdrPct !== 0 ? "white" : "#CBD5E1",
                boxShadow: simAdrPct !== 0 ? "0 4px 12px rgba(99,102,241,0.3)" : "none",
                transition: "all 0.25s", lineHeight: 1, flexShrink: 0,
              }}>
                {simAdrPct > 0 ? "+" : ""}{simAdrPct}
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, opacity: 0.8 }}>%</div>
              </div>
            </div>
          </div>

          {/* ── KPI sor ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: settings.tfhEnabled ? "repeat(6, 1fr)" : "repeat(5, 1fr)",
          }}>
            {/* Bevétel */}
            {(() => {
              const base = annualRevenue;
              const sim = simAnnualRevenue;
              const delta = sim - base;
              const current = isSimActive ? sim : base;
              return (
                <div style={{
                  padding: "24px 28px",
                  borderRight: "1px solid #F1F5F9",
                  borderTop: isSimActive ? "3px solid #3B82F6" : "3px solid #E2E8F0",
                  transition: "border-color 0.3s",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span>💰</span> Éves bevétel
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {fmtM(current)} Ft
                  </p>
                  {isSimActive && delta !== 0 ? (
                    <span style={{
                      display: "inline-block", fontSize: 12, fontWeight: 700,
                      padding: "2px 8px", borderRadius: 6,
                      background: delta > 0 ? "#ECFDF5" : "#FEF2F2",
                      color: delta > 0 ? "#059669" : "#DC2626",
                    }}>
                      {delta > 0 ? "+" : ""}{fmtM(delta)} Ft
                    </span>
                  ) : (
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
                      {totalRooms ? `${totalRooms} szoba alapján` : "éves összesen"}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* TFH */}
            {settings.tfhEnabled && (() => {
              const base = annualTfh;
              const sim = simAnnualTfh;
              const delta = sim - base;
              const current = isSimActive ? sim : base;
              return (
                <div style={{
                  padding: "24px 28px",
                  borderRight: "1px solid #F1F5F9",
                  borderTop: isSimActive ? "3px solid #F59E0B" : "3px solid #E2E8F0",
                  transition: "border-color 0.3s",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span>🏛️</span> TFH ({settings.tfhRate}%)
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "#D97706", margin: "0 0 6px", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    −{fmtM(current)} Ft
                  </p>
                  {isSimActive && delta !== 0 ? (
                    <span style={{
                      display: "inline-block", fontSize: 12, fontWeight: 700,
                      padding: "2px 8px", borderRadius: 6,
                      background: "#FEF3C7",
                      color: "#D97706",
                    }}>
                      {delta > 0 ? "+" : ""}{fmtM(delta)} Ft
                    </span>
                  ) : (
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>idegenforgalmi adó</p>
                  )}
                </div>
              );
            })()}

            {/* Profit */}
            {(() => {
              const base = annualProfit;
              const sim = simAnnualProfit;
              const delta = sim - base;
              const current = isSimActive ? sim : base;
              const color = current >= 0 ? "#059669" : "#DC2626";
              const accentColor = current >= 0 ? "#059669" : "#DC2626";
              return (
                <div style={{
                  padding: "24px 28px",
                  borderRight: "1px solid #F1F5F9",
                  borderTop: isSimActive ? `3px solid ${accentColor}` : "3px solid #E2E8F0",
                  transition: "border-color 0.3s",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span>{current >= 0 ? "📈" : "📉"}</span> Éves profit
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 800, color, margin: "0 0 6px", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {current >= 0 ? "+" : ""}{fmtM(current)} Ft
                  </p>
                  {isSimActive && delta !== 0 ? (
                    <span style={{
                      display: "inline-block", fontSize: 12, fontWeight: 700,
                      padding: "2px 8px", borderRadius: 6,
                      background: delta > 0 ? "#ECFDF5" : "#FEF2F2",
                      color: delta > 0 ? "#059669" : "#DC2626",
                    }}>
                      {delta > 0 ? "+" : ""}{fmtM(delta)} Ft
                    </span>
                  ) : (
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
                      {(isSimActive ? simAnnualRevenue : annualRevenue) > 0
                        ? `${Math.round(current / (isSimActive ? simAnnualRevenue : annualRevenue) * 100)}% profit margin`
                        : "éves összesen"}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Kihasználtság */}
            {(() => {
              const current = isSimActive ? simAvgOcc : avgOcc;
              const delta = isSimActive ? (simAvgOcc - avgOcc) : 0;
              const aboveBreakeven = annualBreakeven !== null ? current >= annualBreakeven : null;
              return (
                <div style={{
                  padding: "24px 28px",
                  borderTop: isSimActive ? "3px solid #35BD78" : "3px solid #E2E8F0",
                  transition: "border-color 0.3s",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span>🏨</span> Átl. kihasználtság
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "#35BD78", margin: "0 0 6px", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {Math.round(current)}%
                  </p>
                  {isSimActive && delta !== 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{
                        display: "inline-block", fontSize: 12, fontWeight: 700,
                        padding: "2px 8px", borderRadius: 6,
                        background: delta > 0 ? "#FBFBFC" : "#FEF2F2",
                        color: delta > 0 ? "#35BD78" : "#DC2626",
                        width: "fit-content",
                      }}>
                        {delta > 0 ? "+" : ""}{Math.round(delta)} pp
                      </span>
                      {annualBreakeven !== null && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: aboveBreakeven ? "#059669" : "#EF4444" }}>
                          {aboveBreakeven
                            ? `✓ fedezeti pont: ${Math.round(annualBreakeven)}%`
                            : `⚠ BE: ${Math.round(annualBreakeven)}% — ${Math.round(annualBreakeven - current)} pp hiányzik`}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
                      {annualBreakeven !== null ? `fedezeti pont: ${Math.round(annualBreakeven)}%` : "éves átlag"}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Átlag ADR */}
            {(() => {
              return (
                <div style={{
                  padding: "24px 28px",
                  borderRight: "1px solid #F1F5F9",
                  borderTop: isSimActive ? "3px solid #F59E0B" : "3px solid #E2E8F0",
                  transition: "border-color 0.3s",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span>💵</span> Átlag ADR
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "#B45309", margin: "0 0 6px", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {weightedAvgAdr > 0 ? `${fmt(Math.round(weightedAvgAdr))} Ft` : "—"}
                  </p>
                  <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>szobaeladott éjszakára</p>
                </div>
              );
            })()}

            {/* Átlag szobaárbevétel/szoba/éj */}
            {(() => {
              return (
                <div style={{
                  padding: "24px 28px",
                  borderTop: isSimActive ? "3px solid #35BD78" : "3px solid #E2E8F0",
                  transition: "border-color 0.3s",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span>🏷️</span> Szobaárbev./szoba/éj
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "#03915A", margin: "0 0 6px", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {avgRevPerRoomNight > 0 ? `${fmt(Math.round(avgRevPerRoomNight))} Ft` : "—"}
                  </p>
                  <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
                    {settings.fbEnabled ? "ADR + F&B + egyéb" : "ADR alapján"}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Board mix + bevételi struktúra ── */}
        {settings.fbEnabled && (() => {
          // Ha a hónapokban vannak havi mix értékek, azok az igazak (a terv aktuális állapota)
          // Ha nincs havi érték, visszaesünk a settings alapértelmezettjeire
          const filledM = months.filter(m => m.adr > 0);
          const monthsWithMix = filledM.filter(m => m.breakfastPct > 0 || m.halfboardPct > 0);
          const bPct = monthsWithMix.length > 0
            ? monthsWithMix.reduce((s, m) => s + m.breakfastPct, 0) / monthsWithMix.length
            : settings.defaultBreakfastPct;
          const hPct = monthsWithMix.length > 0
            ? monthsWithMix.reduce((s, m) => s + m.halfboardPct, 0) / monthsWithMix.length
            : settings.defaultHalfboardPct;
          const roomOnlyPct = Math.max(0, 100 - bPct - hPct);
          const brContrib = settings.avgPaxPerRoom * (bPct / 100) * settings.breakfastPrice;
          const hbContrib = settings.avgPaxPerRoom * (hPct / 100) * settings.halfboardPrice;
          const boardTotal = brContrib + hbContrib;
          const extraPct =
            (settings.fbOtherEnabled ? settings.fbOtherPct : 0) +
            (settings.spaEnabled ? settings.spaPct : 0) +
            (settings.otherRevenueEnabled ? settings.otherRevenuePct : 0);
          const hasAnyRevenue = bPct > 0 || hPct > 0 || extraPct > 0;
          if (!hasAnyRevenue) return null;

          // Weighted avg ADR across filled months (already computed above)
          const avgAdr = filledM.length > 0
            ? filledM.reduce((s, m) => s + m.adr, 0) / filledM.length
            : 0;
          const extraPerRoom = avgAdr * (extraPct / 100);

          return (
            <div style={{
              background: "white", border: "1px solid #E2E8F0",
              borderRadius: 18, marginBottom: 24, overflow: "hidden",
              boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
            }}>
              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 24px", borderBottom: "1px solid #F1F5F9", background: "#FAFAFA",
              }}>
                <span style={{ fontSize: 16 }}>🍽️</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Étkezési & bevételi struktúra
                </span>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

                {/* 3-way split bar */}
                {(bPct > 0 || hPct > 0) && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                      Vendégmix megoszlás
                    </p>
                    <div style={{ display: "flex", height: 32, borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0" }}>
                      {roomOnlyPct > 0 && (
                        <div style={{
                          width: `${roomOnlyPct}%`, background: "#F1F5F9",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#64748B",
                          overflow: "hidden", whiteSpace: "nowrap",
                        }}>
                          {roomOnlyPct >= 10 ? `🛏️ Csak szoba ${Math.round(roomOnlyPct)}%` : ""}
                        </div>
                      )}
                      {bPct > 0 && (
                        <div style={{
                          width: `${bPct}%`, background: "#FDE68A",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#92400E",
                          overflow: "hidden", whiteSpace: "nowrap",
                        }}>
                          {bPct >= 8 ? `🌅 Reggeli ${Math.round(bPct)}%` : ""}
                        </div>
                      )}
                      {hPct > 0 && (
                        <div style={{
                          width: `${hPct}%`, background: "#BBF7D0",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#065F46",
                          overflow: "hidden", whiteSpace: "nowrap",
                        }}>
                          {hPct >= 8 ? `🍽️ Félpanzió ${Math.round(hPct)}%` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      {roomOnlyPct > 0 && <span style={{ fontSize: 11, color: "#94A3B8" }}>🛏️ Csak szoba: {Math.round(roomOnlyPct)}%</span>}
                      {bPct > 0 && <span style={{ fontSize: 11, color: "#D97706", fontWeight: 600 }}>🌅 Reggeli: {Math.round(bPct)}%</span>}
                      {hPct > 0 && <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>🍽️ Félpanzió: {Math.round(hPct)}%</span>}
                    </div>
                  </div>
                )}

                {/* Category cards */}
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${[bPct > 0, hPct > 0, extraPct > 0].filter(Boolean).length}, 1fr)`, gap: 12 }}>
                  {bPct > 0 && (
                    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>🌅</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", margin: 0 }}>Reggeli</p>
                          <p style={{ fontSize: 11, color: "#B45309", margin: 0 }}>{fmt(settings.breakfastPrice)} Ft/fő/éj</p>
                        </div>
                        <div style={{
                          marginLeft: "auto", background: "#FEF3C7", borderRadius: 8, padding: "4px 10px",
                          fontSize: 18, fontWeight: 800, color: "#D97706",
                        }}>
                          {Math.round(bPct)}%
                        </div>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#D97706", margin: 0 }}>
                        +{fmt(Math.round(brContrib))} Ft/szoba/éj
                      </p>
                      <p style={{ fontSize: 10, color: "#B45309", margin: "2px 0 0" }}>
                        {Math.round(bPct)}% × {fmt(settings.breakfastPrice)} Ft × {settings.avgPaxPerRoom} fő
                      </p>
                    </div>
                  )}
                  {hPct > 0 && (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>🍽️</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#065F46", margin: 0 }}>Félpanzió</p>
                          <p style={{ fontSize: 11, color: "#047857", margin: 0 }}>{fmt(settings.halfboardPrice)} Ft/fő/éj</p>
                        </div>
                        <div style={{
                          marginLeft: "auto", background: "#DCFCE7", borderRadius: 8, padding: "4px 10px",
                          fontSize: 18, fontWeight: 800, color: "#059669",
                        }}>
                          {Math.round(hPct)}%
                        </div>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#059669", margin: 0 }}>
                        +{fmt(Math.round(hbContrib))} Ft/szoba/éj
                      </p>
                      <p style={{ fontSize: 10, color: "#047857", margin: "2px 0 0" }}>
                        {Math.round(hPct)}% × {fmt(settings.halfboardPrice)} Ft × {settings.avgPaxPerRoom} fő
                      </p>
                    </div>
                  )}
                  {extraPct > 0 && (
                    <div style={{ background: "#FBFBFC", border: "1px solid #DDD6FE", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>💰</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#03915A", margin: 0 }}>Egyéb bevételek</p>
                          <p style={{ fontSize: 11, color: "#35BD78", margin: 0 }}>
                            {[
                              settings.fbOtherEnabled && `Egyéb F&B ${settings.fbOtherPct}%`,
                              settings.spaEnabled && `Spa ${settings.spaPct}%`,
                              settings.otherRevenueEnabled && `Egyéb ${settings.otherRevenuePct}%`,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div style={{
                          marginLeft: "auto", background: "rgba(53,189,120,0.12)", borderRadius: 8, padding: "4px 10px",
                          fontSize: 18, fontWeight: 800, color: "#35BD78",
                        }}>
                          {extraPct.toFixed(1)}%
                        </div>
                      </div>
                      {avgAdr > 0 && (
                        <>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#35BD78", margin: 0 }}>
                            +{fmt(Math.round(extraPerRoom))} Ft/szoba/éj
                          </p>
                          <p style={{ fontSize: 10, color: "#35BD78", margin: "2px 0 0" }}>
                            átl. ADR {fmt(Math.round(avgAdr))} Ft × {extraPct.toFixed(1)}%
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Formula */}
                {boardTotal > 0 && (
                  <div style={{
                    background: "#FBFBFC", border: "1px solid #DDD6FE",
                    borderRadius: 12, padding: "14px 18px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                  }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#35BD78", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Képlet — súlyozott átlag
                      </p>
                      <p style={{ fontSize: 12, color: "#03915A", margin: 0, fontFamily: "monospace", lineHeight: 1.6 }}>
                        ({Math.round(bPct)}% × {fmt(settings.breakfastPrice)}
                        {hPct > 0 && ` + ${Math.round(hPct)}% × ${fmt(settings.halfboardPrice)}`})
                        {" "}× {settings.avgPaxPerRoom} fő = <strong>{fmt(Math.round(boardTotal))} Ft</strong>
                      </p>
                      <p style={{ fontSize: 10, color: "#90DBAC", margin: "3px 0 0" }}>
                        Ez adódik hozzá az ADR-hez minden szobaéjszakára
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 10, color: "#35BD78", fontWeight: 700, margin: "0 0 2px", textTransform: "uppercase" }}>
                        Összes F&amp;B felár
                      </p>
                      <p style={{ fontSize: 26, fontWeight: 800, color: "#35BD78", margin: 0, letterSpacing: "-0.02em" }}>
                        +{fmt(Math.round(boardTotal))} Ft
                      </p>
                      <p style={{ fontSize: 10, color: "#90DBAC", margin: 0 }}>/szoba/éj átlag</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}


        {/* ── Charts ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Revenue & Profit */}
          <div style={{
            background: "white", borderRadius: 18,
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
            padding: "22px 20px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Bevétel &amp; Profit</h3>
              {isSimActive && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#35BD78",
                  background: "rgba(53,189,120,0.12)", padding: "3px 9px", borderRadius: 6,
                  letterSpacing: "0.04em",
                }}>SZIMULÁCIÓ</span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={3} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="2 4" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#CBD5E1" }} axisLine={false} tickLine={false} tickFormatter={v => fmtM(v)} width={52} />
                <ReTooltip content={<TooltipRevenue />} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
                <ReferenceLine y={0} stroke="#E2E8F0" strokeWidth={1.5} />
                <Bar dataKey="revenue" radius={[5, 5, 0, 0]} opacity={0.9}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hasData ? (isSimActive ? "#6366F1" : "#3B82F6") : "#F1F5F9"} />
                  ))}
                </Bar>
                <Bar dataKey="profit" radius={[5, 5, 0, 0]} opacity={0.85}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hasData ? (entry.profit >= 0 ? "#059669" : "#DC2626") : "#F1F5F9"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: isSimActive ? "#6366F1" : "#3B82F6" }} />
                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>Bevétel</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "#059669" }} />
                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>Profit</span>
              </div>
            </div>
          </div>

          {/* Occupancy & Breakeven */}
          <div style={{
            background: "white", borderRadius: 18,
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
            padding: "22px 20px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Kihasználtság &amp; Fedezeti pont</h3>
              {isSimActive && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#35BD78",
                  background: "rgba(53,189,120,0.12)", padding: "3px 9px", borderRadius: 6,
                  letterSpacing: "0.04em",
                }}>SZIMULÁCIÓ</span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={3} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="2 4" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#CBD5E1" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={38} />
                <ReTooltip content={<TooltipOcc />} cursor={{ fill: "rgba(53,189,120,0.04)" }} />
                <Bar dataKey="occ" radius={[5, 5, 0, 0]} opacity={0.85}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hasData ? "#35BD78" : "#F1F5F9"} />
                  ))}
                </Bar>
                {annualBreakeven !== null && (
                  <ReferenceLine
                    y={annualBreakeven}
                    stroke="#DC2626"
                    strokeDasharray="5 3"
                    strokeWidth={2}
                    label={{
                      value: `BE: ${Math.round(annualBreakeven)}%`,
                      position: "insideTopRight",
                      fill: "#DC2626", fontSize: 10, fontWeight: 700,
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "#35BD78" }} />
                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>Kihasználtság %</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 16, height: 2.5, background: "#DC2626", borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>Fedezeti pont</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Monthly table ── */}
        <div style={{
          background: "white", borderRadius: 18,
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
          overflow: "hidden", marginBottom: 24,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "1px solid #F1F5F9",
            background: "#FAFAFA",
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Havi bontás</h2>
            {isSimActive && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#35BD78",
                background: "rgba(53,189,120,0.12)", padding: "4px 10px", borderRadius: 6,
                letterSpacing: "0.04em",
              }}>SZIMULÁLT ADATOK</span>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {[
                    { label: "Hónap", align: "left" },
                    { label: "Kihasználtság", align: "right" },
                    { label: "Szobaéj", align: "right" },
                    { label: "Bevétel", align: "right" },
                    { label: "Összes kiadás", align: "right" },
                    ...(settings.tfhEnabled ? [{ label: `TFH (${settings.tfhRate}%)`, align: "right" }] : []),
                    { label: "Profit", align: "right" },
                    { label: "Margin", align: "right" },
                    { label: "Fedezeti pont", align: "right" },
                  ].map((h, i) => (
                    <th key={h.label} style={{
                      padding: i === 0 ? "10px 24px" : "10px 16px",
                      textAlign: h.align as "left" | "right",
                      fontSize: 10, fontWeight: 700, color: "#94A3B8",
                      textTransform: "uppercase", letterSpacing: "0.07em",
                      whiteSpace: "nowrap",
                    }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayCalcs.map((c, rowIdx) => {
                  const m = displayMonths.find(m => m.month === c.month)!;
                  const isEven = rowIdx % 2 === 0;
                  return (
                    <tr key={c.month} style={{
                      borderBottom: "1px solid #F8FAFC",
                      background: isEven ? "white" : "#FAFBFC",
                      opacity: c.hasData ? 1 : 0.3,
                      transition: "background 0.1s",
                    }}>
                      <td style={{ padding: "10px 24px", fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap" }}>
                        {HU_MONTHS[c.month - 1]}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#334155", fontWeight: 500 }}>
                        {c.hasData ? `${m.occupancyPct}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748B" }}>
                        {c.hasData ? fmt(c.roomNights) : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#0F172A", fontWeight: 600 }}>
                        {c.hasData ? `${fmtM(c.revenue)} Ft` : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748B" }}>
                        {c.hasData ? `${fmtM(c.cost)} Ft` : "—"}
                      </td>
                      {settings.tfhEnabled && (
                        <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.hasData && c.tfh > 0 ? "#D97706" : "#CBD5E1", fontWeight: c.hasData && c.tfh > 0 ? 600 : 400 }}>
                          {c.hasData && c.tfh > 0 ? `−${fmtM(c.tfh)} Ft` : "—"}
                        </td>
                      )}
                      <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {c.hasData ? (
                          <span style={{
                            display: "inline-block",
                            padding: "2px 10px", borderRadius: 8,
                            fontSize: 12, fontWeight: 700,
                            background: profitBg(c.profit),
                            color: profitColor(c.profit),
                          }}>
                            {c.profit >= 0 ? "+" : ""}{fmtM(c.profit)} Ft
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: c.margin !== null ? (c.margin >= 0 ? "#059669" : "#DC2626") : "#CBD5E1" }}>
                        {c.margin !== null ? `${Math.round(c.margin)}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.breakeven !== null ? "#64748B" : "#CBD5E1" }}>
                        {c.breakeven !== null ? `${Math.round(c.breakeven)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                  <td style={{ padding: "12px 24px", fontWeight: 800, fontSize: 12, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Éves összesen
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#35BD78" }}>
                    {Math.round(isSimActive ? simAvgOcc : avgOcc)}% avg
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(displayCalcs.reduce((s, c) => s + c.roomNights, 0))}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                    {fmtM(isSimActive ? simAnnualRevenue : annualRevenue)} Ft
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#64748B", fontVariantNumeric: "tabular-nums" }}>
                    {fmtM(isSimActive ? simAnnualCost : annualCost)} Ft
                  </td>
                  {settings.tfhEnabled && (
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#D97706", fontVariantNumeric: "tabular-nums" }}>
                      −{fmtM(isSimActive ? simAnnualTfh : annualTfh)} Ft
                    </td>
                  )}
                  <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "3px 12px", borderRadius: 8,
                      fontWeight: 800, fontSize: 13,
                      background: profitBg(isSimActive ? simAnnualProfit : annualProfit),
                      color: profitColor(isSimActive ? simAnnualProfit : annualProfit),
                    }}>
                      {(isSimActive ? simAnnualProfit : annualProfit) >= 0 ? "+" : ""}{fmtM(isSimActive ? simAnnualProfit : annualProfit)} Ft
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: profitColor(isSimActive ? simAnnualProfit : annualProfit) }}>
                    {(isSimActive ? simAnnualRevenue : annualRevenue) > 0
                      ? `${Math.round((isSimActive ? simAnnualProfit : annualProfit) / (isSimActive ? simAnnualRevenue : annualRevenue) * 100)}%`
                      : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#94A3B8", fontWeight: 600 }}>
                    {annualBreakeven !== null ? `${Math.round(annualBreakeven)}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Planning details: monthly prices ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          marginBottom: 24,
          alignItems: "start",
        }}>

          {/* Monthly ADR & room revenue */}
          <div style={{
            background: "white", borderRadius: 18,
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 24px",
              borderBottom: "1px solid #F1F5F9",
              background: "#FAFAFA",
            }}>
              <span style={{ fontSize: 16 }}>💵</span>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Tervezett árak – havi bontás
                </h2>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0", fontWeight: 500 }}>
                  Az előrejelzés alapját képező bevételi adatok havonként
                </p>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {[
                      { label: "Hónap", align: "left" },
                      { label: "Kihasználtság", align: "right" },
                      { label: "ADR", align: "right" },
                      { label: "Szobaár/szoba/éj", align: "right" },
                      { label: "Számítás alapja", align: "center" },
                    ].map((h, i) => (
                      <th key={h.label} style={{
                        padding: i === 0 ? "10px 24px" : "10px 16px",
                        textAlign: h.align as "left" | "right" | "center",
                        fontSize: 10, fontWeight: 700, color: "#94A3B8",
                        textTransform: "uppercase", letterSpacing: "0.07em",
                        whiteSpace: "nowrap",
                      }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, rowIdx) => {
                    const calc = calcs.find(c => c.month === m.month);
                    const usesRoomRevenue = m.roomRevenue > 0;
                    const usesAdr = !usesRoomRevenue && m.adr > 0;
                    const hasData = calc?.hasData ?? false;
                    return (
                      <tr key={m.month} style={{
                        borderBottom: "1px solid #F8FAFC",
                        background: rowIdx % 2 === 0 ? "white" : "#FAFBFC",
                        opacity: hasData ? 1 : 0.3,
                      }}>
                        <td style={{ padding: "9px 24px", fontWeight: 700, color: "#0F172A" }}>
                          {HU_MONTHS[m.month - 1]}
                        </td>
                        <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#334155", fontWeight: 500 }}>
                          {hasData ? `${m.occupancyPct}%` : "—"}
                        </td>
                        <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: m.adr > 0 ? "#0F172A" : "#CBD5E1" }}>
                          {m.adr > 0 ? `${fmt(m.adr)} Ft` : "—"}
                        </td>
                        <td style={{ padding: "9px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: m.roomRevenue > 0 ? "#0F172A" : "#CBD5E1" }}>
                          {m.roomRevenue > 0 ? `${fmt(m.roomRevenue)} Ft` : "—"}
                        </td>
                        <td style={{ padding: "9px 16px", textAlign: "center" }}>
                          {hasData ? (
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              padding: "2px 10px", borderRadius: 8,
                              background: usesRoomRevenue ? "rgba(53,189,120,0.12)" : usesAdr ? "#DBEAFE" : "#F1F5F9",
                              color: usesRoomRevenue ? "#35BD78" : usesAdr ? "#3B82F6" : "#94A3B8",
                            }}>
                              {usesRoomRevenue ? "Szobaár" : usesAdr ? "ADR" : "—"}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Legend */}
            <div style={{
              padding: "10px 24px",
              borderTop: "1px solid #F1F5F9",
              background: "#FAFAFA",
              display: "flex", gap: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 6, background: "rgba(53,189,120,0.12)", color: "#35BD78", fontWeight: 700 }}>Szobaár</span>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>— fix bevétel/szoba/éj</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 6, background: "#DBEAFE", color: "#3B82F6", fontWeight: 700 }}>ADR</span>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>— átlagos szobai díj</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 4px",
        }}>
          <p style={{ fontSize: 12, color: "#CBD5E1", margin: 0 }}>
            Ez egy megosztott, csak olvasható előrejelzés
            {plan.shareExpiresAt && ` · Érvényes: ${new Date(plan.shareExpiresAt).toLocaleDateString("hu-HU")}`}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: "linear-gradient(135deg,#35BD78,#03915A)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11,
            }}>📈</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", letterSpacing: "-0.01em" }}>
              HeyMax!
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
