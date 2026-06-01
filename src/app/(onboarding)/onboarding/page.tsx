"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, BedDouble, Utensils, Baby, Check, ChevronRight,
  ChevronLeft, Plus, Trash2, Loader2, BarChart3, Sparkles,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type RoomTypeInput = { id?: string; name: string; count: string };
type ChildGroupInput = { id?: string; name: string; minAge: string; maxAge: string };

const ALL_BOARD_TYPES = [
  { code: "RO", label: "Room Only", desc: "Csak szoba" },
  { code: "BB", label: "Bed & Breakfast", desc: "Reggeli" },
  { code: "HB", label: "Half Board", desc: "Reggeli + vacsora" },
  { code: "FB", label: "Full Board", desc: "3 étkezés" },
  { code: "AI", label: "All Inclusive", desc: "Minden benne" },
];

const CURRENCIES = ["HUF", "EUR", "USD", "GBP", "CZK", "RON"];
const COUNTRIES = [
  { code: "HU", label: "Magyarország" },
  { code: "AT", label: "Ausztria" },
  { code: "DE", label: "Németország" },
  { code: "CZ", label: "Csehország" },
  { code: "SK", label: "Szlovákia" },
  { code: "RO", label: "Románia" },
  { code: "HR", label: "Horvátország" },
];

const STEPS = [
  { icon: Building2, label: "Alapadatok" },
  { icon: BedDouble, label: "Szobatípusok" },
  { icon: Utensils, label: "Ellátástípusok" },
  { icon: Baby,      label: "Korcsoportok" },
  { icon: Sparkles,  label: "Kész!" },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  label:  { color: "#94A3B8", fontSize: 13, fontWeight: 500, marginBottom: 6, display: "block" },
  input:  {
    width: "100%", background: "#0F172A", border: "1px solid #334155",
    borderRadius: 10, padding: "10px 14px", color: "#F8FAFC", fontSize: 14,
    outline: "none",
  },
  select: {
    width: "100%", background: "#0F172A", border: "1px solid #334155",
    borderRadius: 10, padding: "10px 14px", color: "#F8FAFC", fontSize: 14,
    outline: "none",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #35BD78, #03915A)",
    color: "white", border: "none", borderRadius: 12, padding: "12px 28px",
    fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex",
    alignItems: "center", gap: 8,
  },
  btnSecondary: {
    background: "transparent", color: "#64748B", border: "1px solid #334155",
    borderRadius: 12, padding: "12px 24px", fontWeight: 600, fontSize: 14,
    cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
  },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Hotel basics
  const [form, setForm] = useState({
    name: "", city: "", country: "HU", baseCurrency: "HUF", totalRooms: "",
  });

  // Step 2 — Room types
  const [roomTypes, setRoomTypes] = useState<RoomTypeInput[]>([
    { name: "", count: "" },
  ]);

  // Step 3 — Board types
  const [boardTypes, setBoardTypes] = useState<string[]>(["BB"]);

  // Step 4 — Child age groups
  const [childGroups, setChildGroups] = useState<ChildGroupInput[]>([]);
  const [skipChildren, setSkipChildren] = useState(false);

  // ── Load hotel on mount ──
  useEffect(() => {
    fetch("/api/hotels")
      .then(r => r.json())
      .then(data => {
        if (data?.id) {
          setHotelId(data.id);
          setForm({
            name: data.name ?? "",
            city: data.city ?? "",
            country: data.country ?? "HU",
            baseCurrency: data.baseCurrency ?? "HUF",
            totalRooms: data.totalRooms ? String(data.totalRooms) : "",
          });
          // Pre-fill room types if any exist
          if (data.roomTypes?.length > 0) {
            setRoomTypes(data.roomTypes.map((rt: { id: string; name: string; count: number }) => ({
              id: rt.id, name: rt.name, count: String(rt.count),
            })));
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Step handlers ──

  async function saveStep1() {
    if (!form.name.trim() || !form.city.trim()) {
      setError("A szálloda neve és városa kötelező.");
      return false;
    }
    setSaving(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        city: form.city.trim(),
        country: form.country,
        baseCurrency: form.baseCurrency,
        totalRooms: form.totalRooms ? parseInt(form.totalRooms) : null,
      };
      if (hotelId) {
        await fetch(`/api/hotels/${hotelId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch("/api/hotels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        setHotelId(data.id);
        // Set cookie so subsequent API calls resolve the hotel
        await fetch("/api/hotels/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hotelId: data.id }),
        });
      }
      return true;
    } catch {
      setError("Hiba történt a mentés során.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStep2() {
    const validRooms = roomTypes.filter(rt => rt.name.trim() && rt.count);
    if (validRooms.length === 0) {
      setError("Adj meg legalább egy szobatípust.");
      return false;
    }
    setSaving(true); setError(null);
    try {
      for (const rt of validRooms) {
        if (rt.id) continue; // already saved
        await fetch(`/api/hotels/${hotelId}/room-types`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: rt.name.trim(), count: parseInt(rt.count) }),
        });
      }
      return true;
    } catch {
      setError("Hiba a szobatípusok mentése során.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStep3() {
    if (boardTypes.length === 0) {
      setError("Válassz ki legalább egy ellátástípust.");
      return false;
    }
    setSaving(true); setError(null);
    try {
      await fetch("/api/hotel-board-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardTypes }),
      });
      return true;
    } catch {
      setError("Hiba az ellátástípusok mentése során.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStep4() {
    if (skipChildren) return true;
    const valid = childGroups.filter(g => g.name.trim() && g.minAge !== "" && g.maxAge !== "");
    setSaving(true); setError(null);
    try {
      for (const g of valid) {
        if (g.id) continue;
        await fetch("/api/child-age-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: g.name, minAge: parseInt(g.minAge), maxAge: parseInt(g.maxAge), sortOrder: 0 }),
        });
      }
      return true;
    } catch {
      setError("Hiba a korcsoportok mentése során.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding() {
    if (!hotelId) return;
    setSaving(true);
    try {
      // Mark hotel as onboarded (need current data for required fields)
      await fetch(`/api/hotels/${hotelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          country: form.country,
          baseCurrency: form.baseCurrency,
          totalRooms: form.totalRooms ? parseInt(form.totalRooms) : null,
          isOnboarded: true,
        }),
      });
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  async function nextStep() {
    let ok = true;
    if (step === 0) ok = await saveStep1();
    else if (step === 1) ok = await saveStep2();
    else if (step === 2) ok = await saveStep3();
    else if (step === 3) ok = await saveStep4();
    else if (step === 4) { completeOnboarding(); return; }
    if (ok) setStep(s => Math.min(s + 1, 4));
  }

  // ── Render ──

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F172A" }}>
      <Loader2 size={32} className="animate-spin" style={{ color: "#35BD78" }} />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0F172A" }}>
      {/* Top gradient bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #35BD78, #3B82F6, #10B981)" }} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #35BD78, #03915A)", boxShadow: "0 8px 32px rgba(53,189,120,0.4)" }}>
            <BarChart3 size={24} color="white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#F8FAFC" }}>Szálloda beállítása</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>Néhány lépés és készen is vagyunk</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: done ? "#10B981" : active ? "#35BD78" : "#1E293B",
                      border: active ? "2px solid #35BD78" : done ? "2px solid #10B981" : "2px solid #334155",
                    }}>
                    {done
                      ? <Check size={16} color="white" />
                      : <Icon size={16} color={active ? "white" : "#64748B"} />
                    }
                  </div>
                  <span className="text-xs hidden sm:block" style={{ color: active ? "#90DBAC" : done ? "#10B981" : "#475569" }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-8 h-0.5 mb-4" style={{ background: i < step ? "#10B981" : "#334155" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="w-full max-w-lg rounded-2xl overflow-hidden"
          style={{ background: "#1E293B", border: "1px solid #334155" }}>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #35BD78, #03915A)" }} />

          <div className="p-8">
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: "#450A0A", color: "#FCA5A5", border: "1px solid #7F1D1D" }}>
                {error}
              </div>
            )}

            {/* ── Step 0: Alapadatok ── */}
            {step === 0 && (
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ color: "#F8FAFC" }}>Alapadatok</h2>
                <p className="text-sm mb-6" style={{ color: "#64748B" }}>A szállodád legfontosabb adatai</p>

                <div className="flex flex-col gap-4">
                  <div>
                    <label style={S.label}>Szálloda neve *</label>
                    <input style={S.input} value={form.name} placeholder="pl. Hotel Panoráma"
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={S.label}>Város *</label>
                      <input style={S.input} value={form.city} placeholder="pl. Budapest"
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                    </div>
                    <div>
                      <label style={S.label}>Ország</label>
                      <select style={S.select} value={form.country}
                        onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={S.label}>Szobák száma</label>
                      <input style={S.input} type="number" min="1" value={form.totalRooms} placeholder="pl. 80"
                        onChange={e => setForm(f => ({ ...f, totalRooms: e.target.value }))} />
                    </div>
                    <div>
                      <label style={S.label}>Alap deviza</label>
                      <select style={S.select} value={form.baseCurrency}
                        onChange={e => setForm(f => ({ ...f, baseCurrency: e.target.value }))}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 1: Szobatípusok ── */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ color: "#F8FAFC" }}>Szobatípusok</h2>
                <p className="text-sm mb-6" style={{ color: "#64748B" }}>Milyen szobákkal rendelkezik a szálloda?</p>

                <div className="flex flex-col gap-3">
                  {roomTypes.map((rt, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <div className="flex-1">
                        <input style={{ ...S.input, marginBottom: 0 }} value={rt.name} placeholder="Szobatípus neve (pl. Standard, Superior)"
                          onChange={e => setRoomTypes(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} />
                      </div>
                      <div style={{ width: 80 }}>
                        <input style={{ ...S.input, marginBottom: 0, textAlign: "center" }} type="number" min="1" value={rt.count} placeholder="db"
                          onChange={e => setRoomTypes(prev => prev.map((r, j) => j === i ? { ...r, count: e.target.value } : r))} />
                      </div>
                      {roomTypes.length > 1 && !rt.id && (
                        <button onClick={() => setRoomTypes(prev => prev.filter((_, j) => j !== i))}
                          style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setRoomTypes(prev => [...prev, { name: "", count: "" }])}
                    className="flex items-center gap-2 text-sm mt-1"
                    style={{ color: "#35BD78", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    <Plus size={16} /> Szobatípus hozzáadása
                  </button>
                </div>

                <p className="text-xs mt-5" style={{ color: "#475569" }}>
                  💡 A szobák számát összesítjük — a foglaltság ebből számolódik majd.
                </p>
              </div>
            )}

            {/* ── Step 2: Ellátástípusok ── */}
            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ color: "#F8FAFC" }}>Ellátástípusok</h2>
                <p className="text-sm mb-6" style={{ color: "#64748B" }}>Jelöld be a szálloda által kínált ellátásokat</p>

                <div className="flex flex-col gap-3">
                  {ALL_BOARD_TYPES.map(bt => {
                    const active = boardTypes.includes(bt.code);
                    return (
                      <button key={bt.code}
                        onClick={() => setBoardTypes(prev =>
                          prev.includes(bt.code) ? prev.filter(b => b !== bt.code) : [...prev, bt.code]
                        )}
                        className="flex items-center gap-4 text-left rounded-xl px-4 py-3 transition-all"
                        style={{
                          background: active ? "#2D1F6E" : "#0F172A",
                          border: `1px solid ${active ? "#35BD78" : "#334155"}`,
                          cursor: "pointer",
                        }}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: active ? "#35BD78" : "#1E293B", border: `1px solid ${active ? "#35BD78" : "#334155"}` }}>
                          {active && <Check size={14} color="white" />}
                        </div>
                        <div>
                          <div className="font-bold text-sm" style={{ color: active ? "#90DBAC" : "#F8FAFC" }}>
                            {bt.code} — {bt.label}
                          </div>
                          <div className="text-xs" style={{ color: "#64748B" }}>{bt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 3: Korcsoportok ── */}
            {step === 3 && (
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ color: "#F8FAFC" }}>Gyerekkorcsoportok</h2>
                <p className="text-sm mb-6" style={{ color: "#64748B" }}>
                  Adj meg életkori csoportokat, ha a szálloda gyerekekkel is kalkulál
                </p>

                {!skipChildren && (
                  <div className="flex flex-col gap-3 mb-4">
                    {childGroups.length === 0 && (
                      <p className="text-sm" style={{ color: "#475569" }}>
                        Még nincs korcsoport megadva. Kattints a "+" gombra vagy ugorj át ezt a lépést.
                      </p>
                    )}
                    {childGroups.map((g, i) => (
                      <div key={i} className="flex gap-3 items-center">
                        <input style={{ ...S.input, flex: 2 }} value={g.name} placeholder="Csoport neve (pl. Gyerek)"
                          onChange={e => setChildGroups(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                        <input style={{ ...S.input, width: 60, textAlign: "center" }} type="number" min="0" value={g.minAge} placeholder="Min"
                          onChange={e => setChildGroups(prev => prev.map((x, j) => j === i ? { ...x, minAge: e.target.value } : x))} />
                        <span style={{ color: "#64748B", fontSize: 12 }}>–</span>
                        <input style={{ ...S.input, width: 60, textAlign: "center" }} type="number" min="0" value={g.maxAge} placeholder="Max"
                          onChange={e => setChildGroups(prev => prev.map((x, j) => j === i ? { ...x, maxAge: e.target.value } : x))} />
                        <button onClick={() => setChildGroups(prev => prev.filter((_, j) => j !== i))}
                          style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setChildGroups(prev => [...prev, { name: "", minAge: "", maxAge: "" }])}
                      className="flex items-center gap-2 text-sm mt-1"
                      style={{ color: "#35BD78", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                      <Plus size={16} /> Korcsoport hozzáadása
                    </button>
                  </div>
                )}

                <button onClick={() => setSkipChildren(s => !s)}
                  className="text-sm mt-2"
                  style={{ color: skipChildren ? "#35BD78" : "#64748B", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  {skipChildren ? "✓ Átugrom ezt a lépést" : "Átugrom ezt a lépést"}
                </button>
              </div>
            )}

            {/* ── Step 4: Kész ── */}
            {step === 4 && (
              <div className="text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ background: "linear-gradient(135deg, #10B981, #059669)", boxShadow: "0 8px 32px rgba(16,185,129,0.4)" }}>
                  <Check size={36} color="white" />
                </div>
                <h2 className="text-2xl font-bold mb-3" style={{ color: "#F8FAFC" }}>Minden készen áll! 🎉</h2>
                <p className="text-sm mb-8" style={{ color: "#64748B", lineHeight: 1.7 }}>
                  A szállodád be van állítva.<br />
                  Most már létrehozhatsz szcenáriókat, tervezheted a bevételeket és elemezheted a profitot.
                </p>

                {/* Summary */}
                <div className="text-left rounded-xl p-4 mb-6" style={{ background: "#0F172A", border: "1px solid #1E293B" }}>
                  <div className="flex flex-col gap-2">
                    <SummaryRow icon="🏨" label="Szálloda" value={form.name} />
                    <SummaryRow icon="📍" label="Helyszín" value={`${form.city}`} />
                    <SummaryRow icon="🛏️" label="Szobatípusok" value={`${roomTypes.filter(r => r.name.trim()).length} db`} />
                    <SummaryRow icon="🍽️" label="Ellátástípusok" value={boardTypes.join(", ")} />
                    {childGroups.length > 0 && (
                      <SummaryRow icon="👶" label="Korcsoportok" value={`${childGroups.filter(g => g.name.trim()).length} db`} />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="px-8 pb-8 flex justify-between items-center">
            {step > 0 && step < 4 ? (
              <button style={S.btnSecondary} onClick={() => setStep(s => s - 1)}>
                <ChevronLeft size={16} />
                Vissza
              </button>
            ) : <div />}

            <button style={S.btnPrimary} onClick={nextStep} disabled={saving}>
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Mentés…</>
                : step === 4
                ? <><Sparkles size={16} /> Irány a dashboard!</>
                : <>{step === 3 ? "Tovább" : "Következő"} <ChevronRight size={16} /></>
              }
            </button>
          </div>
        </div>

        {/* Step counter */}
        <p className="mt-6 text-xs" style={{ color: "#334155" }}>
          {step + 1}. lépés / {STEPS.length}
        </p>
      </div>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: "#64748B" }}>{icon} {label}</span>
      <span className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{value}</span>
    </div>
  );
}
