"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, Check,
  Settings2, Landmark, Utensils, Users, WashingMachine, Percent,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FixedCost = {
  id?: string;
  label: string;
  annualAmount: number;
};

type Settings = {
  id: string;
  tfhEnabled: boolean;
  tfhRate: number;
  fbEnabled: boolean;
  breakfastPrice: number;
  halfboardPrice: number;
  breakfastCost: number;
  halfboardCost: number;
  avgPaxPerRoom: number;
  defaultBreakfastPct: number;
  defaultHalfboardPct: number;
  fbOtherEnabled: boolean;
  fbOtherPct: number;
  spaEnabled: boolean;
  spaPct: number;
  otherRevenueEnabled: boolean;
  otherRevenuePct: number;
  laundryEnabled: boolean;
  laundryPerRoom: number;
  commissionEnabled: boolean;
  commissionPct: number;
  commissionBookingsPct: number;
  fixedCosts: FixedCost[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n).toLocaleString("hu-HU");
}

function Toggle({ enabled, onToggle, activeColor = "#059669" }: { enabled: boolean; onToggle: () => void; activeColor?: string }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: enabled ? `${activeColor}18` : "#F8FAFC",
        border: `1px solid ${enabled ? activeColor + "44" : "#E2E8F0"}`,
        borderRadius: 10, padding: "7px 14px",
        cursor: "pointer", transition: "all 0.2s",
      }}
    >
      <div style={{
        width: 32, height: 18, borderRadius: 9,
        background: enabled ? activeColor : "#CBD5E1",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 3, left: enabled ? 17 : 3,
          width: 12, height: 12, borderRadius: "50%", background: "white",
          transition: "left 0.15s",
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: enabled ? activeColor : "#94A3B8" }}>
        {enabled ? "Bekapcsolva" : "Kikapcsolva"}
      </span>
    </button>
  );
}

function NumInput({
  value, onChange, min, max, step, suffix, width,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; suffix?: string; width?: number;
}) {
  const [local, setLocal] = useState(value === 0 ? "" : String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocal(value === 0 ? "" : String(value)); }, [value]);
  function commit() {
    const parsed = parseFloat(local.replace(",", "."));
    let v = isNaN(parsed) ? 0 : parsed;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
    setLocal(v === 0 ? "" : String(v));
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <input
        ref={ref} type="number" value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit} onFocus={e => e.target.select()}
        onKeyDown={e => e.key === "Enter" && commit()}
        step={step ?? 1} placeholder="0"
        style={{
          width: width ?? 80, fontSize: 13, fontWeight: 600, color: "#0F172A",
          border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 10px",
          outline: "none", background: "white", fontVariantNumeric: "tabular-nums",
          boxSizing: "border-box",
        }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = "#35BD78")}
        onBlurCapture={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
      />
      {suffix && <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>{suffix}</span>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SimplePlannerSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Revenue settings
  const [tfhEnabled, setTfhEnabled] = useState(true);
  const [tfhRate, setTfhRate] = useState(4);
  const [fbEnabled, setFbEnabled] = useState(false);
  const [breakfastPrice, setBreakfastPrice] = useState(0);
  const [halfboardPrice, setHalfboardPrice] = useState(0);
  const [avgPaxPerRoom, setAvgPaxPerRoom] = useState(1.8);
  const [defaultBreakfastPct, setDefaultBreakfastPct] = useState(0);
  const [defaultHalfboardPct, setDefaultHalfboardPct] = useState(0);
  const [fbOtherEnabled, setFbOtherEnabled] = useState(false);
  const [fbOtherPct, setFbOtherPct] = useState(0);
  const [spaEnabled, setSpaEnabled] = useState(false);
  const [spaPct, setSpaPct] = useState(0);
  const [otherRevenueEnabled, setOtherRevenueEnabled] = useState(false);
  const [otherRevenuePct, setOtherRevenuePct] = useState(0);

  // Cost settings
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [breakfastCost, setBreakfastCost] = useState(0);
  const [halfboardCost, setHalfboardCost] = useState(0);
  const [laundryEnabled, setLaundryEnabled] = useState(false);
  const [laundryPerRoom, setLaundryPerRoom] = useState(0);
  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [commissionPct, setCommissionPct] = useState(0);
  const [commissionBookingsPct, setCommissionBookingsPct] = useState(100);

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/simple-planner-settings")
      .then(r => r.json())
      .then((data: Settings | null) => {
        if (data) {
          setTfhEnabled(data.tfhEnabled ?? true);
          setTfhRate(data.tfhRate ?? 4);
          setFbEnabled(data.fbEnabled ?? false);
          setBreakfastPrice(data.breakfastPrice ?? 0);
          setHalfboardPrice(data.halfboardPrice ?? 0);
          setBreakfastCost(data.breakfastCost ?? 0);
          setHalfboardCost(data.halfboardCost ?? 0);
          setAvgPaxPerRoom(data.avgPaxPerRoom ?? 1.8);
          setDefaultBreakfastPct(data.defaultBreakfastPct ?? 0);
          setDefaultHalfboardPct(data.defaultHalfboardPct ?? 0);
          setFbOtherEnabled(data.fbOtherEnabled ?? false);
          setFbOtherPct(data.fbOtherPct ?? 0);
          setSpaEnabled(data.spaEnabled ?? false);
          setSpaPct(data.spaPct ?? 0);
          setOtherRevenueEnabled(data.otherRevenueEnabled ?? false);
          setOtherRevenuePct(data.otherRevenuePct ?? 0);
          setLaundryEnabled(data.laundryEnabled ?? false);
          setLaundryPerRoom(data.laundryPerRoom ?? 0);
          setCommissionEnabled(data.commissionEnabled ?? false);
          setCommissionPct(data.commissionPct ?? 0);
          setCommissionBookingsPct(data.commissionBookingsPct ?? 100);
          setFixedCosts(data.fixedCosts ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/simple-planner-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tfhEnabled, tfhRate,
          fbEnabled, breakfastPrice, halfboardPrice,
          breakfastCost, halfboardCost,
          avgPaxPerRoom,
          defaultBreakfastPct, defaultHalfboardPct,
          fbOtherEnabled, fbOtherPct, spaEnabled, spaPct, otherRevenueEnabled, otherRevenuePct,
          laundryEnabled, laundryPerRoom,
          commissionEnabled, commissionPct, commissionBookingsPct,
          fixedCosts: fixedCosts.map((fc, i) => ({ ...fc, sortOrder: i })),
        }),
      });
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  // ─── Fixed cost helpers ────────────────────────────────────────────────────

  function addFixedCost() {
    setFixedCosts(prev => [...prev, { label: "", annualAmount: 0 }]);
  }

  function updateFixedCost(i: number, field: keyof FixedCost, value: string | number) {
    setFixedCosts(prev => prev.map((fc, idx) => idx === i ? { ...fc, [field]: value } : fc));
  }

  function removeFixedCost(i: number) {
    setFixedCosts(prev => prev.filter((_, idx) => idx !== i));
  }

  const totalAnnualFixed = fixedCosts.reduce((s, fc) => s + fc.annualAmount, 0);
  const monthlyFixed = totalAnnualFixed / 12;

  // ─── UI ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "#35BD78" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800 }}>

      {/* ── Back + Header ── */}
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "linear-gradient(135deg, #03915A 0%, #35BD78 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Settings2 size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: 0 }}>Simple Planner beállítások</h1>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>Bevételek, kiadások és TFH konfigurálása</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: saved ? "#10B981" : "#35BD78",
            border: "none", borderRadius: 12, padding: "10px 20px",
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? "Mentve" : "Mentés"}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BLOKK 1 — Fix éves költségek */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
        padding: "24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "#EFF6FF",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 16 }}>🏢</span>
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Fix éves költségek
            </h2>
          </div>
          <button
            onClick={addFixedCost}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: 9, padding: "6px 12px",
              color: "#2563EB", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Plus size={13} /> Tétel hozzáadása
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          Ezek a kiadások nem függnek a kihasználtságtól — havonként egyenletesen terhelik a szállodát.
          A rendszer automatikusan elosztja 12-vel és minden hónap fix terhéként számolja.
        </p>

        {fixedCosts.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "28px 0", color: "#94A3B8", fontSize: 13,
            border: "2px dashed #E2E8F0", borderRadius: 14,
          }}>
            Nincs fix költségtétel. Kattints a „Tétel hozzáadása" gombra.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Fejléc */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 40px", gap: 10, padding: "0 4px" }}>
              {["Megnevezés", "Éves összeg (Ft/év)", ""].map(h => (
                <p key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                  {h}
                </p>
              ))}
            </div>

            {fixedCosts.map((fc, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 200px 40px",
                gap: 10, alignItems: "center",
                background: "#F8FAFC", border: "1px solid #E2E8F0",
                borderRadius: 12, padding: "10px 12px",
              }}>
                <input
                  type="text"
                  value={fc.label}
                  onChange={e => updateFixedCost(i, "label", e.target.value)}
                  placeholder="pl. Személyzet, Bérleti díj, Rezsi…"
                  style={{
                    fontSize: 13, color: "#0F172A", border: "1px solid #E2E8F0",
                    borderRadius: 8, padding: "7px 10px", outline: "none",
                    background: "white", width: "100%", boxSizing: "border-box",
                    fontWeight: 500,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#3B82F6")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <NumInput
                    value={fc.annualAmount}
                    onChange={v => updateFixedCost(i, "annualAmount", v)}
                    min={0} step={100000} suffix="Ft" width={120}
                  />
                  {fc.annualAmount > 0 && (
                    <span style={{ fontSize: 10, color: "#64748B", whiteSpace: "nowrap" }}>
                      ≈ {fmt(fc.annualAmount / 12)}/hó
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeFixedCost(i)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "#FEE2E2", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Trash2 size={13} color="#EF4444" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Összesítő */}
        {fixedCosts.length > 0 && totalAnnualFixed > 0 && (
          <div style={{
            background: "#EFF6FF", border: "1px solid #BFDBFE",
            borderRadius: 12, padding: "12px 16px", marginTop: 14,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <p style={{ fontSize: 12, color: "#1D4ED8", fontWeight: 700, margin: 0 }}>
                Összes fix éves teher: {fmt(totalAnnualFixed)} Ft/év
              </p>
              <p style={{ fontSize: 11, color: "#3B82F6", margin: "2px 0 0" }}>
                → {fmt(monthlyFixed)} Ft/hó minden hónapban
              </p>
            </div>
            <span style={{ fontSize: 22 }}>🏢</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BLOKK 2 — Étkezési bevételek (F&B) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: `1px solid ${fbEnabled ? "#BBF7D0" : "#E2E8F0"}`,
        borderRadius: 20, padding: "24px", marginBottom: 20,
        transition: "border-color 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: fbEnabled ? "#DCFCE7" : "#F1F5F9",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}>
              <Utensils size={15} color={fbEnabled ? "#059669" : "#94A3B8"} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Étkezési bevételek (F&amp;B)
            </h2>
          </div>
          <Toggle enabled={fbEnabled} onToggle={() => setFbEnabled(v => !v)} activeColor="#059669" />
        </div>

        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          Reggeli és félpanzió árak megadása. A tervlapon beállított board mix alapján
          a rendszer automatikusan adja a felárat az ADR-hez.
        </p>

        <div style={{
          display: "flex", flexDirection: "column", gap: 16,
          opacity: fbEnabled ? 1 : 0.4, transition: "opacity 0.2s",
          pointerEvents: fbEnabled ? "auto" : "none",
        }}>
          {/* Átlagos vendégek/szoba */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "#F8FAFC", border: "1px solid #E2E8F0",
            borderRadius: 14, padding: "14px 20px",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={16} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "#6366F1", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Átlagos vendégek / szoba
              </p>
              <NumInput value={avgPaxPerRoom} onChange={setAvgPaxPerRoom} min={1} max={6} step={0.1} suffix="fő/szoba" width={70} />
            </div>
            <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5, maxWidth: 260 }}>
              Ez a szám szorzódik az étkezési árral és önköltséggel egyaránt.
            </div>
          </div>

          {/* Bevétel + Önköltség kártyák */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Reggeli */}
            <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>🌅</span>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", margin: 0 }}>Reggeli</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: "#D97706", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Bevételi ár
                  </p>
                  <NumInput value={breakfastPrice} onChange={setBreakfastPrice} min={0} step={100} suffix="Ft/fő/éj" width={100} />
                  {breakfastPrice > 0 && (
                    <p style={{ fontSize: 11, color: "#92400E", margin: "4px 0 0", fontWeight: 600 }}>
                      → +{fmt(breakfastPrice * avgPaxPerRoom)} Ft/szoba/éj (bevétel)
                    </p>
                  )}
                </div>
                <div style={{ borderTop: "1px solid #FED7AA", paddingTop: 10 }}>
                  <p style={{ fontSize: 10, color: "#EF4444", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Önköltség
                  </p>
                  <NumInput value={breakfastCost} onChange={setBreakfastCost} min={0} step={100} suffix="Ft/fő/éj" width={100} />
                  {breakfastCost > 0 && (
                    <p style={{ fontSize: 11, color: "#DC2626", margin: "4px 0 0", fontWeight: 600 }}>
                      → −{fmt(breakfastCost * avgPaxPerRoom)} Ft/szoba/éj (kiadás)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Félpanzió */}
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>🍽️</span>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#065F46", margin: 0 }}>Félpanzió</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: "#059669", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Bevételi ár
                  </p>
                  <NumInput value={halfboardPrice} onChange={setHalfboardPrice} min={0} step={100} suffix="Ft/fő/éj" width={100} />
                  {halfboardPrice > 0 && (
                    <p style={{ fontSize: 11, color: "#065F46", margin: "4px 0 0", fontWeight: 600 }}>
                      → +{fmt(halfboardPrice * avgPaxPerRoom)} Ft/szoba/éj (bevétel)
                    </p>
                  )}
                </div>
                <div style={{ borderTop: "1px solid #BBF7D0", paddingTop: 10 }}>
                  <p style={{ fontSize: 10, color: "#EF4444", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Önköltség
                  </p>
                  <NumInput value={halfboardCost} onChange={setHalfboardCost} min={0} step={100} suffix="Ft/fő/éj" width={100} />
                  {halfboardCost > 0 && (
                    <p style={{ fontSize: 11, color: "#DC2626", margin: "4px 0 0", fontWeight: 600 }}>
                      → −{fmt(halfboardCost * avgPaxPerRoom)} Ft/szoba/éj (kiadás)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Alapértelmezett vendégmix */}
          {(() => {
            const roomOnlyPct = Math.max(0, 100 - defaultBreakfastPct - defaultHalfboardPct);
            const brRev = avgPaxPerRoom * (defaultBreakfastPct / 100) * breakfastPrice;
            const hbRev = avgPaxPerRoom * (defaultHalfboardPct / 100) * halfboardPrice;
            const brCost = avgPaxPerRoom * (defaultBreakfastPct / 100) * breakfastCost;
            const hbCost = avgPaxPerRoom * (defaultHalfboardPct / 100) * halfboardCost;
            return (
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: "16px 20px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Alapértelmezett vendégmix
                </p>
                <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 14px" }}>
                  Tervlapon havonként módosítható.
                </p>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", height: 26, borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0" }}>
                    {roomOnlyPct > 0 && (
                      <div style={{ width: `${roomOnlyPct}%`, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#64748B", transition: "width 0.2s", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {roomOnlyPct >= 12 ? `🛏️ ${Math.round(roomOnlyPct)}%` : ""}
                      </div>
                    )}
                    {defaultBreakfastPct > 0 && (
                      <div style={{ width: `${defaultBreakfastPct}%`, background: "#FDE68A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#92400E", transition: "width 0.2s", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {defaultBreakfastPct >= 10 ? `🌅 ${Math.round(defaultBreakfastPct)}%` : ""}
                      </div>
                    )}
                    {defaultHalfboardPct > 0 && (
                      <div style={{ width: `${defaultHalfboardPct}%`, background: "#BBF7D0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#065F46", transition: "width 0.2s", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {defaultHalfboardPct >= 10 ? `🍽️ ${Math.round(defaultHalfboardPct)}%` : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#94A3B8" }}>🛏️ Csak szoba: {Math.round(roomOnlyPct)}%</span>
                    <span style={{ fontSize: 10, color: "#D97706" }}>🌅 Reggeli: {Math.round(defaultBreakfastPct)}%</span>
                    <span style={{ fontSize: 10, color: "#059669" }}>🍽️ Félpanzió: {Math.round(defaultHalfboardPct)}%</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 16 }}>🌅</span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", margin: 0 }}>Reggeli</p>
                      </div>
                      <div style={{ minWidth: 48, textAlign: "center", background: "#FEF3C7", borderRadius: 8, padding: "3px 8px", fontSize: 16, fontWeight: 800, color: "#D97706" }}>
                        {Math.round(defaultBreakfastPct)}%
                      </div>
                    </div>
                    <input type="range" min={0} max={100} step={1} value={defaultBreakfastPct}
                      onChange={e => setDefaultBreakfastPct(Math.min(Number(e.target.value), 100 - defaultHalfboardPct))}
                      style={{ width: "100%", accentColor: "#D97706", cursor: "pointer", marginBottom: 6 }} />
                    <div style={{ display: "flex", gap: 3 }}>
                      {[0, 10, 25, 50, 75, 100].map(v => (
                        <button key={v} onClick={() => setDefaultBreakfastPct(Math.min(v, 100 - defaultHalfboardPct))}
                          style={{ flex: 1, fontSize: 9, fontWeight: 700, padding: "3px 0", borderRadius: 5, cursor: "pointer", border: "none", background: Math.round(defaultBreakfastPct) === v ? "#D97706" : "#FEF3C7", color: Math.round(defaultBreakfastPct) === v ? "white" : "#92400E" }}>
                          {v}%
                        </button>
                      ))}
                    </div>
                    {(brRev > 0 || brCost > 0) && (
                      <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
                        {brRev > 0 && <p style={{ color: "#059669", fontWeight: 600, margin: 0 }}>+{fmt(brRev)} Ft/szoba/éj (bev.)</p>}
                        {brCost > 0 && <p style={{ color: "#DC2626", fontWeight: 600, margin: 0 }}>−{fmt(brCost)} Ft/szoba/éj (kiad.)</p>}
                      </div>
                    )}
                  </div>

                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 16 }}>🍽️</span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#065F46", margin: 0 }}>Félpanzió</p>
                      </div>
                      <div style={{ minWidth: 48, textAlign: "center", background: "#DCFCE7", borderRadius: 8, padding: "3px 8px", fontSize: 16, fontWeight: 800, color: "#059669" }}>
                        {Math.round(defaultHalfboardPct)}%
                      </div>
                    </div>
                    <input type="range" min={0} max={100} step={1} value={defaultHalfboardPct}
                      onChange={e => setDefaultHalfboardPct(Math.min(Number(e.target.value), 100 - defaultBreakfastPct))}
                      style={{ width: "100%", accentColor: "#059669", cursor: "pointer", marginBottom: 6 }} />
                    <div style={{ display: "flex", gap: 3 }}>
                      {[0, 10, 25, 50, 75, 100].map(v => (
                        <button key={v} onClick={() => setDefaultHalfboardPct(Math.min(v, 100 - defaultBreakfastPct))}
                          style={{ flex: 1, fontSize: 9, fontWeight: 700, padding: "3px 0", borderRadius: 5, cursor: "pointer", border: "none", background: Math.round(defaultHalfboardPct) === v ? "#059669" : "#DCFCE7", color: Math.round(defaultHalfboardPct) === v ? "white" : "#065F46" }}>
                          {v}%
                        </button>
                      ))}
                    </div>
                    {(hbRev > 0 || hbCost > 0) && (
                      <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
                        {hbRev > 0 && <p style={{ color: "#059669", fontWeight: 600, margin: 0 }}>+{fmt(hbRev)} Ft/szoba/éj (bev.)</p>}
                        {hbCost > 0 && <p style={{ color: "#DC2626", fontWeight: 600, margin: 0 }}>−{fmt(hbCost)} Ft/szoba/éj (kiad.)</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BLOKK 3 — Mosatás (változó kiadás) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: `1px solid ${laundryEnabled ? "#BAE6FD" : "#E2E8F0"}`,
        borderRadius: 20, padding: "24px", marginBottom: 20,
        transition: "border-color 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: laundryEnabled ? "#E0F2FE" : "#F1F5F9",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}>
              <WashingMachine size={15} color={laundryEnabled ? "#0284C7" : "#94A3B8"} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Mosatás — változó kiadás
            </h2>
          </div>
          <Toggle enabled={laundryEnabled} onToggle={() => setLaundryEnabled(v => !v)} activeColor="#0284C7" />
        </div>

        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          A mosatás a kihasználtsággal arányos: minél több szoba foglalt, annál több a mosatási teher.
          A megadott összeg szobaeladott éjszakánként kerül a kalkulációba.
        </p>

        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          opacity: laundryEnabled ? 1 : 0.4, transition: "opacity 0.2s",
          pointerEvents: laundryEnabled ? "auto" : "none",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "#F0F9FF", border: "1px solid #BAE6FD",
            borderRadius: 14, padding: "14px 20px",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#0284C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WashingMachine size={16} color="white" />
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#0284C7", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Mosatási költség
              </p>
              <NumInput value={laundryPerRoom} onChange={setLaundryPerRoom} min={0} step={100} suffix="Ft/szoba/éj" width={100} />
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
            Változó kiadás — a szobaeladott éjszakák számával arányosan terhelődik.
            {laundryEnabled && laundryPerRoom > 0 && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#0284C7", fontWeight: 600 }}>
                Pl. 50 szoba × 80% occ × 30 nap = 1 200 éj → {fmt(laundryPerRoom * 1200)} Ft/hó
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BLOKK 3b — Jutalék (változó kiadás) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: `1px solid ${commissionEnabled ? "#DDD6FE" : "#E2E8F0"}`,
        borderRadius: 20, padding: "24px", marginBottom: 20,
        transition: "border-color 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: commissionEnabled ? "#EDE9FE" : "#F1F5F9",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}>
              <Percent size={15} color={commissionEnabled ? "#7C3AED" : "#94A3B8"} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Jutalék — változó kiadás
            </h2>
          </div>
          <Toggle enabled={commissionEnabled} onToggle={() => setCommissionEnabled(v => !v)} activeColor="#7C3AED" />
        </div>

        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          A jutalék az ADR + ellátás árából (szobaárbevételből) számolódik, csak a jutalékos foglalásokra.
          Marketing és egyéb fix éves kiadások a „Fix éves költségek" blokkban adhatók meg.
        </p>

        <div style={{
          display: "flex", flexDirection: "column", gap: 14,
          opacity: commissionEnabled ? 1 : 0.4, transition: "opacity 0.2s",
          pointerEvents: commissionEnabled ? "auto" : "none",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Jutalék mértéke */}
            <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Percent size={14} color="white" />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#4C1D95", margin: 0 }}>Átlagos jutalék mértéke</p>
              </div>
              <NumInput value={commissionPct} onChange={setCommissionPct} min={0} max={50} step={0.5} suffix="%" width={80} />
              {commissionPct > 0 && (
                <p style={{ fontSize: 11, color: "#7C3AED", margin: "6px 0 0", fontWeight: 600 }}>
                  pl. 20 000 Ft/szoba/éj → −{Math.round(20000 * commissionPct / 100).toLocaleString("hu-HU")} Ft jutalék
                </p>
              )}
            </div>

            {/* Jutalékos foglalások aránya */}
            <div style={{ background: "#FAF5FF", border: "1px solid #E9D5FF", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "#9333EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 14 }}>🔗</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#581C87", margin: 0 }}>Jutalékos foglalások aránya</p>
              </div>
              <NumInput value={commissionBookingsPct} onChange={setCommissionBookingsPct} min={0} max={100} step={1} suffix="%" width={80} />
              <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
                {[20, 40, 60, 80, 100].map(v => (
                  <button key={v} onClick={() => setCommissionBookingsPct(v)}
                    style={{ flex: 1, fontSize: 9, fontWeight: 700, padding: "3px 0", borderRadius: 5, cursor: "pointer", border: "none", background: commissionBookingsPct === v ? "#9333EA" : "#EDE9FE", color: commissionBookingsPct === v ? "white" : "#6B21A8" }}>
                    {v}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Összefoglaló számítás */}
          {commissionPct > 0 && commissionBookingsPct > 0 && (
            <div style={{
              background: "#EDE9FE", border: "1px solid #DDD6FE",
              borderRadius: 12, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 20 }}>📊</span>
              <div style={{ fontSize: 12, color: "#4C1D95", lineHeight: 1.7 }}>
                <strong>Hatékony jutalék kulcs:</strong>{" "}
                {(commissionPct * commissionBookingsPct / 100).toFixed(2)}% a teljes szobaárbevételre vetítve
                <br />
                <span style={{ color: "#7C3AED" }}>
                  pl. 20 000 Ft/szoba/éj → −{Math.round(20000 * commissionPct / 100 * commissionBookingsPct / 100).toLocaleString("hu-HU")} Ft/szoba/éj tényleges jutalékteher
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BLOKK 4 — Egyéb bevételek */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: "1px solid #E2E8F0",
        borderRadius: 20, padding: "24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F0F9FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 16 }}>💰</span>
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>Egyéb bevételek</h2>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          Az ADR meghatározott százalékát ezek a bevételi kategóriák adják hozzá a szobaárbevételhez.
        </p>

        {([
          { emoji: "🍻", label: "Egyéb F&B bevétel", desc: "Bár, étterem, room service stb.", enabled: fbOtherEnabled, setEnabled: setFbOtherEnabled, pct: fbOtherPct, setPct: setFbOtherPct, color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", toggleBg: "#FFEDD5", toggleActive: "#EA580C" },
          { emoji: "🧖", label: "Spa & wellness bevétel", desc: "Masszázs, medence, szépségápolás stb.", enabled: spaEnabled, setEnabled: setSpaEnabled, pct: spaPct, setPct: setSpaPct, color: "#35BD78", bg: "#FBFBFC", border: "#DDD6FE", toggleBg: "rgba(53,189,120,0.12)", toggleActive: "#35BD78" },
          { emoji: "📦", label: "Egyéb bevétel", desc: "Parkoló, áruház, konferencia stb.", enabled: otherRevenueEnabled, setEnabled: setOtherRevenueEnabled, pct: otherRevenuePct, setPct: setOtherRevenuePct, color: "#0EA5E9", bg: "#F0F9FF", border: "#BAE6FD", toggleBg: "#E0F2FE", toggleActive: "#0EA5E9" },
        ] as const).map(item => (
          <div key={item.label} style={{
            background: item.enabled ? item.bg : "#F8FAFC",
            border: `1px solid ${item.enabled ? item.border : "#E2E8F0"}`,
            borderRadius: 14, padding: "16px 20px", marginBottom: 10,
            transition: "all 0.2s", display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{item.emoji}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>{item.desc}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: item.enabled ? 1 : 0.4, transition: "opacity 0.2s", pointerEvents: item.enabled ? "auto" : "none" }}>
              <p style={{ fontSize: 11, color: "#64748B", margin: 0, whiteSpace: "nowrap" }}>ADR %-a:</p>
              <NumInput value={item.pct} onChange={item.setPct as (v: number) => void} min={0} max={100} step={0.5} suffix="%" width={64} />
              {item.enabled && item.pct > 0 && (
                <div style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: item.color, whiteSpace: "nowrap" }}>
                  pl. 20 000 Ft ADR → +{Math.round(20000 * item.pct / 100).toLocaleString("hu-HU")} Ft
                </div>
              )}
            </div>
            <button onClick={() => (item.setEnabled as (v: boolean) => void)(!item.enabled)} style={{ display: "flex", alignItems: "center", gap: 6, background: item.enabled ? item.toggleBg : "#F8FAFC", border: `1px solid ${item.enabled ? item.border : "#E2E8F0"}`, borderRadius: 10, padding: "6px 12px", cursor: "pointer", transition: "all 0.2s", flexShrink: 0 }}>
              <div style={{ width: 28, height: 16, borderRadius: 8, background: item.enabled ? item.toggleActive : "#CBD5E1", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 2, left: item.enabled ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: "white", transition: "left 0.15s" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: item.enabled ? item.color : "#94A3B8" }}>{item.enabled ? "Be" : "Ki"}</span>
            </button>
          </div>
        ))}

        {(fbOtherEnabled || spaEnabled || otherRevenueEnabled) && (
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 16px", marginTop: 4, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <p style={{ fontSize: 12, color: "#64748B", margin: 0, fontWeight: 500 }}>
              Összes egyéb bevételi szorzó:{" "}
              <strong style={{ color: "#0F172A" }}>
                {((fbOtherEnabled ? fbOtherPct : 0) + (spaEnabled ? spaPct : 0) + (otherRevenueEnabled ? otherRevenuePct : 0)).toFixed(1)}%
              </strong>{" "}az ADR-ből → pl. 20 000 Ft ADR esetén +{Math.round(20000 * ((fbOtherEnabled ? fbOtherPct : 0) + (spaEnabled ? spaPct : 0) + (otherRevenueEnabled ? otherRevenuePct : 0)) / 100).toLocaleString("hu-HU")} Ft/szoba/éj
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BLOKK 5 — TFH */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: `1px solid ${tfhEnabled ? "#FECACA" : "#E2E8F0"}`,
        borderRadius: 20, padding: "24px", marginBottom: 20,
        transition: "border-color 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: tfhEnabled ? "#FEE2E2" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
              <Landmark size={15} color={tfhEnabled ? "#DC2626" : "#94A3B8"} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Turizmusfejlesztési Hozzájárulás (TFH)
            </h2>
          </div>
          <Toggle enabled={tfhEnabled} onToggle={() => setTfhEnabled(v => !v)} activeColor="#EF4444" />
        </div>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          A nettó szobaárbevétel után fizetendő állami hozzájárulás. Profit = bevétel − kiadás − TFH.
        </p>
        <div style={{
          display: "flex", alignItems: "center", gap: 20,
          opacity: tfhEnabled ? 1 : 0.4, transition: "opacity 0.2s",
          pointerEvents: tfhEnabled ? "auto" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14, padding: "14px 20px" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Landmark size={16} color="white" />
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#DC2626", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>TFH mértéke</p>
              <NumInput value={tfhRate} onChange={setTfhRate} min={0} max={100} step={0.5} suffix="%" width={70} />
            </div>
          </div>
          <div style={{ flex: 1, fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
            Alapértelmezés: <strong>4%</strong> — hatályos magyar jogszabály alapján.
            A számítás: <em>TFH = szobaárbevétel × {tfhRate}%</em>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* Kalkuláció összefoglaló */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 16, padding: "16px 20px", marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#64748B", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Hogyan számol a Simple Planner?
        </p>
        <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.8 }}>
          <strong style={{ color: "#0F172A" }}>Bevétel/hó</strong> = (ADR + F&amp;B felár + egyéb) × szobaeladott éjszakák<br />
          <strong style={{ color: "#0F172A" }}>Kiadás/hó</strong> = fix éves / 12 + (F&amp;B önköltség + mosatás + jutalék) × szobaeladott éjszakák<br />
          <strong style={{ color: "#0F172A" }}>Profit/hó</strong> = Bevétel − Kiadás − TFH
        </div>
      </div>

    </div>
  );
}
