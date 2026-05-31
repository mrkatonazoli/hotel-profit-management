"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, Check,
  Settings2, TrendingDown, TrendingUp, BedDouble, Landmark,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CostBand = {
  id?: string;
  fromOccPct: number;
  toOccPct: number;
  costPerRoom: number;
  label: string;
};

type FolderMonth = {
  month: number;
  outOfOrderNights: number;
};

type Settings = {
  id: string;
  optimalOccupancyPct: number;
  tfhEnabled: boolean;
  tfhRate: number;
  costBands: CostBand[];
  folderMonths: FolderMonth[];
};

const HU_MONTHS_SHORT = ["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Sze","Okt","Nov","Dec"];

function getDaysInMonth(month: number) {
  return new Date(new Date().getFullYear(), month, 0).getDate();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n).toLocaleString("hu-HU");
}

const DEFAULT_BANDS: CostBand[] = [
  { fromOccPct: 0,  toOccPct: 40,  costPerRoom: 0, label: "Nagyon alacsony" },
  { fromOccPct: 40, toOccPct: 60,  costPerRoom: 0, label: "Alacsony" },
  { fromOccPct: 60, toOccPct: 80,  costPerRoom: 0, label: "Optimális" },
  { fromOccPct: 80, toOccPct: 100, costPerRoom: 0, label: "Magas" },
];

// ─── Number input ─────────────────────────────────────────────────────────────

function NumInput({
  value, onChange, min, max, step, suffix, width,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  width?: number;
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
        ref={ref}
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onFocus={e => e.target.select()}
        onKeyDown={e => e.key === "Enter" && commit()}
        step={step ?? 1}
        placeholder="0"
        style={{
          width: width ?? 80, fontSize: 13, fontWeight: 600, color: "#0F172A",
          border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 10px",
          outline: "none", background: "white", fontVariantNumeric: "tabular-nums",
          boxSizing: "border-box",
        }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = "#7C3AED")}
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

  const [optimalOcc, setOptimalOcc] = useState(70);
  const [tfhEnabled, setTfhEnabled] = useState(true);
  const [tfhRate, setTfhRate] = useState(4);
  const [bands, setBands] = useState<CostBand[]>(DEFAULT_BANDS);
  const [folderMonths, setFolderMonths] = useState<FolderMonth[]>(
    Array.from({ length: 12 }, (_, i) => ({ month: i + 1, outOfOrderNights: 0 }))
  );

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/simple-planner-settings")
      .then(r => r.json())
      .then((data: Settings | null) => {
        if (data) {
          setOptimalOcc(data.optimalOccupancyPct);
          setTfhEnabled(data.tfhEnabled ?? true);
          setTfhRate(data.tfhRate ?? 4);
          setBands(data.costBands.length > 0 ? data.costBands : DEFAULT_BANDS);
          if (data.folderMonths?.length > 0) {
            setFolderMonths(
              Array.from({ length: 12 }, (_, i) => {
                const saved = data.folderMonths.find(f => f.month === i + 1);
                return { month: i + 1, outOfOrderNights: saved?.outOfOrderNights ?? 0 };
              })
            );
          }
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
          optimalOccupancyPct: optimalOcc,
          tfhEnabled,
          tfhRate,
          costBands: bands.map((b, i) => ({ ...b, sortOrder: i })),
          folderMonths,
        }),
      });
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function updateFolderMonth(month: number, nights: number) {
    setFolderMonths(prev => prev.map(f => f.month === month ? { ...f, outOfOrderNights: nights } : f));
  }

  // ─── Band editing ──────────────────────────────────────────────────────────

  function updateBand(i: number, field: keyof CostBand, value: number | string) {
    setBands(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
  }

  function addBand() {
    const last = bands[bands.length - 1];
    const from = last ? last.toOccPct : 0;
    const to = Math.min(100, from + 20);
    setBands(prev => [...prev, { fromOccPct: from, toOccPct: to, costPerRoom: 0, label: "" }]);
  }

  function removeBand(i: number) {
    setBands(prev => prev.filter((_, idx) => idx !== i));
  }

  // ─── Chart preview ────────────────────────────────────────────────────────

  const maxCost = Math.max(...bands.map(b => b.costPerRoom), 1);
  const sortedBands = [...bands].sort((a, b) => a.fromOccPct - b.fromOccPct);

  // ─── UI ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "#7C3AED" }} />
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
            background: "linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Settings2 size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: 0 }}>Simple Planner beállítások</h1>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>Kiadásstruktúra kihasználtság szerint</p>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: saved ? "#10B981" : "#7C3AED",
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
      {/* BLOKK 1 — Optimális pont */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
        padding: "24px", marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>
          Referencia pont
        </h2>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          Melyik kihasználtsági szint az "optimális"? Ehhez igazítod a kiadás sávokat.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "#F5F3FF", border: "1px solid #DDD6FE",
            borderRadius: 14, padding: "14px 20px",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={16} color="white" />
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#7C3AED", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Optimális kihasználtság
              </p>
              <NumInput
                value={optimalOcc}
                onChange={setOptimalOcc}
                min={1} max={100} step={1}
                suffix="%"
                width={70}
              />
            </div>
          </div>

          <div style={{ flex: 1, fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
            Ez a referenciapont segít vizuálisan azonosítani, melyik sáv az "optimális üzemmód".
            A kiadás sávokban szabadon meghatározhatod, hogy különböző kihasználtságoknál
            mennyi legyen a szoba/éj kiadás.
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BLOKK 2 — Kiadás sávok */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
        padding: "24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
            Kiadás sávok kihasználtság szerint
          </h2>
          <button
            onClick={addBand}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "#F5F3FF", border: "1px solid #DDD6FE",
              borderRadius: 9, padding: "6px 12px",
              color: "#7C3AED", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Plus size={13} /> Sáv hozzáadása
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          Adj meg kihasználtsági tartományokat és a hozzájuk tartozó szoba/éjszaka kiadást.
          A Simple Planner a hónap tényleges kihasználtsága alapján automatikusan a megfelelő sávból veszi a kiadást.
        </p>

        {/* Sáv táblázat */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Fejléc */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 40px",
            gap: 10, padding: "0 4px",
          }}>
            {["Kihasználtság (tól)", "Kihasználtság (ig)", "Kiadás (Ft/szoba/éj)", "Megnevezés (opcionális)", ""].map(h => (
              <p key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                {h}
              </p>
            ))}
          </div>

          {bands.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>
              Nincs sáv megadva. Kattints a „Sáv hozzáadása" gombra.
            </div>
          ) : (
            bands.map((band, i) => {
              const isOptimal = band.fromOccPct <= optimalOcc && band.toOccPct >= optimalOcc;
              return (
                <div
                  key={i}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 40px",
                    gap: 10, alignItems: "center",
                    background: isOptimal ? "#F5F3FF" : "#F8FAFC",
                    border: `1px solid ${isOptimal ? "#DDD6FE" : "#E2E8F0"}`,
                    borderRadius: 12, padding: "10px 12px",
                  }}
                >
                  {/* Tól */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <NumInput value={band.fromOccPct} onChange={v => updateBand(i, "fromOccPct", v)} min={0} max={100} step={1} suffix="%" width={60} />
                  </div>

                  {/* Ig */}
                  <NumInput value={band.toOccPct} onChange={v => updateBand(i, "toOccPct", v)} min={0} max={100} step={1} suffix="%" width={60} />

                  {/* Kiadás */}
                  <NumInput value={band.costPerRoom} onChange={v => updateBand(i, "costPerRoom", v)} min={0} step={100} suffix="Ft" width={90} />

                  {/* Megnevezés */}
                  <input
                    type="text"
                    value={band.label}
                    onChange={e => updateBand(i, "label", e.target.value)}
                    placeholder="pl. Alacsony szezon"
                    style={{
                      fontSize: 12, color: "#0F172A", border: "1px solid #E2E8F0",
                      borderRadius: 8, padding: "7px 10px", outline: "none",
                      background: "white", width: "100%", boxSizing: "border-box",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#7C3AED")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
                  />

                  {/* Törlés */}
                  <button
                    onClick={() => removeBand(i)}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "#FEE2E2", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Trash2 size={13} color="#EF4444" />
                  </button>

                  {/* Optimális badge */}
                  {isOptimal && (
                    <div style={{ gridColumn: "1 / -1", marginTop: 2 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "#7C3AED",
                        background: "#EDE9FE", padding: "2px 8px", borderRadius: 5,
                        textTransform: "uppercase", letterSpacing: "0.04em",
                      }}>
                        ★ Optimális sáv ({optimalOcc}% referencia)
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BLOKK 3 — Vizuális előnézet */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {sortedBands.length > 0 && sortedBands.some(b => b.costPerRoom > 0) && (
        <div style={{
          background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
          padding: "24px", marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 20px" }}>
            Kiadásstruktúra előnézet
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedBands.filter(b => b.costPerRoom > 0).map((band, i) => {
              const isOptimal = band.fromOccPct <= optimalOcc && band.toOccPct >= optimalOcc;
              const barWidth = maxCost > 0 ? (band.costPerRoom / maxCost) * 100 : 0;
              const midpoint = (band.fromOccPct + band.toOccPct) / 2;
              const isBelow = midpoint < optimalOcc;
              const isAbove = midpoint > optimalOcc;

              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Kihasználtság tartomány */}
                  <div style={{ width: 90, flexShrink: 0, textAlign: "right" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>
                      {band.fromOccPct}% – {band.toOccPct}%
                    </span>
                  </div>

                  {/* Irány ikon */}
                  <div style={{ width: 20, display: "flex", justifyContent: "center" }}>
                    {isBelow && <TrendingDown size={14} color="#EF4444" />}
                    {isAbove && <TrendingUp size={14} color="#10B981" />}
                    {isOptimal && <span style={{ fontSize: 14 }}>★</span>}
                  </div>

                  {/* Bar */}
                  <div style={{ flex: 1, background: "#F1F5F9", borderRadius: 6, height: 22, position: "relative", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 6,
                      width: `${barWidth}%`,
                      background: isOptimal
                        ? "linear-gradient(90deg, #6D28D9, #7C3AED)"
                        : isBelow
                          ? "linear-gradient(90deg, #EF4444, #F87171)"
                          : "linear-gradient(90deg, #10B981, #34D399)",
                      transition: "width 0.3s",
                    }} />
                  </div>

                  {/* Érték */}
                  <div style={{ width: 110, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: isOptimal ? "#7C3AED" : isBelow ? "#EF4444" : "#10B981",
                    }}>
                      {fmt(band.costPerRoom)} Ft/éj
                    </span>
                  </div>

                  {/* Label */}
                  {band.label && (
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>{band.label}</span>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 12, color: "#94A3B8", margin: "16px 0 0" }}>
            Piros = optimálisnál alacsonyabb kihasználtság (magasabb fix terhek / szoba) ·
            Lila = optimális sáv · Zöld = optimálisnál magasabb kihasználtság
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* BLOKK 4 — Out of Order (OOO) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
        padding: "24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BedDouble size={15} color="#D97706" />
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
            Out of Order — nem kiadható szobaéjszakák
          </h2>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          Havi bontásban add meg, hogy várhatóan hány szobaéjszaka <strong>nem lesz kiadható</strong>
          (felújítás, karbantartás, OOO). A Simple Planner ezzel korrigálja az elérhető szobaéjszakák számát —
          a RevPAR, a kiadás és a fedezeti pont is a valós elérhető kapacitással számol.
        </p>

        {/* 12 hónap grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10, marginBottom: 16,
        }}>
          {folderMonths.map(fm => {
            const maxNights = getDaysInMonth(fm.month) * 200; // laza limit
            const isActive = fm.outOfOrderNights > 0;
            return (
              <div key={fm.month} style={{
                background: isActive ? "#FFFBEB" : "#F8FAFC",
                border: `1px solid ${isActive ? "#FDE68A" : "#E2E8F0"}`,
                borderRadius: 12, padding: "12px 10px", textAlign: "center",
              }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, margin: "0 0 8px",
                  color: isActive ? "#D97706" : "#94A3B8",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {HU_MONTHS_SHORT[fm.month - 1]}
                </p>
                <NumInput
                  value={fm.outOfOrderNights}
                  onChange={v => updateFolderMonth(fm.month, Math.round(v))}
                  min={0}
                  step={1}
                  width={70}
                />
                <p style={{ fontSize: 10, color: "#94A3B8", margin: "4px 0 0" }}>
                  szobaéj
                </p>
                {isActive && (
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#D97706", margin: "4px 0 0" }}>
                    {getDaysInMonth(fm.month) * 100} - {fm.outOfOrderNights} el.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Összesítő sor */}
        {folderMonths.some(f => f.outOfOrderNights > 0) && (
          <div style={{
            background: "#FFFBEB", border: "1px solid #FDE68A",
            borderRadius: 12, padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <BedDouble size={14} color="#D97706" />
            <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
              Éves szinten összesen{" "}
              <strong>{folderMonths.reduce((s, f) => s + f.outOfOrderNights, 0).toLocaleString("hu-HU")}</strong>{" "}
              szobaéjszaka nem lesz kiadható — a Simple Planner ezeket levonja az elérhető kapacitásból.
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
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: tfhEnabled ? "#FEE2E2" : "#F1F5F9",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}>
              <Landmark size={15} color={tfhEnabled ? "#DC2626" : "#94A3B8"} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Turizmusfejlesztési Hozzájárulás (TFH)
            </h2>
          </div>

          {/* Toggle */}
          <button
            onClick={() => setTfhEnabled(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: tfhEnabled ? "#FEF2F2" : "#F8FAFC",
              border: `1px solid ${tfhEnabled ? "#FECACA" : "#E2E8F0"}`,
              borderRadius: 10, padding: "7px 14px",
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <div style={{
              width: 32, height: 18, borderRadius: 9,
              background: tfhEnabled ? "#EF4444" : "#CBD5E1",
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}>
              <div style={{
                position: "absolute", top: 3, left: tfhEnabled ? 17 : 3,
                width: 12, height: 12, borderRadius: "50%", background: "white",
                transition: "left 0.15s",
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: tfhEnabled ? "#DC2626" : "#94A3B8" }}>
              {tfhEnabled ? "Bekapcsolva" : "Kikapcsolva"}
            </span>
          </button>
        </div>

        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
          A nettó szobaárbevétel után fizetendő állami hozzájárulás. Bekapcsolt állapotban a Simple Planner
          levonja a TFH-t a bevételből — a profit és a fedezeti pont is ezzel korrigált értéket mutat.
        </p>

        {/* Mérték beállítás */}
        <div style={{
          display: "flex", alignItems: "center", gap: 20,
          opacity: tfhEnabled ? 1 : 0.4,
          transition: "opacity 0.2s",
          pointerEvents: tfhEnabled ? "auto" : "none",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "#FEF2F2", border: "1px solid #FECACA",
            borderRadius: 14, padding: "14px 20px",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Landmark size={16} color="white" />
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#DC2626", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                TFH mértéke
              </p>
              <NumInput
                value={tfhRate}
                onChange={setTfhRate}
                min={0} max={100} step={0.5}
                suffix="%"
                width={70}
              />
            </div>
          </div>

          <div style={{ flex: 1, fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
            Alapértelmezés: <strong>4%</strong> — a hatályos magyar jogszabály alapján. Ha eltér a szállodádra
            vonatkozó mérték, módosítsd itt. A számítás: <em>TFH = szobaárbevétel × {tfhRate}%</em>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* Hogyan működik */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div style={{
        background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 16,
        padding: "16px 20px", marginBottom: 8,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#64748B", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Hogyan használja ezt a Simple Planner?
        </p>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.7 }}>
          <strong>Kiadás sávok:</strong> ha nincs egyedi kiadás megadva, a kihasználtság alapján automatikusan a megfelelő sávból veszi az értéket.
          <br />
          <strong>Out of Order:</strong> az OOO szobaéjszakák levonásra kerülnek az elérhető kapacitásból —
          a kiadás és fedezeti pont szintén korrigált kapacitással számol.
          <br />
          <strong>TFH:</strong> ha be van kapcsolva, a profit = bevétel − kiadás − TFH. A fedezeti pont is
          a TFH-val korrigált nettó bevételt veszi alapul.
        </p>
      </div>

    </div>
  );
}
