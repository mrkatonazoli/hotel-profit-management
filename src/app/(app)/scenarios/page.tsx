"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Loader2, X, Check,
  GitBranch, Star, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Scale,
  Sparkles, BarChart3, FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioMonth = {
  id?: string; month: number;
  occupancyPct: number; adr: number;
  fbRevenue: number; spaRevenue: number; otherRevenue: number;
};

type Scenario = {
  id: string; name: string; description: string | null;
  probability: number; isBase: boolean; year: number;
  months: ScenarioMonth[];
};

type ScenarioForm = {
  name: string; description: string;
  probability: string; isBase: boolean; year: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear + i - 1);

const HU_MONTHS = [
  "Január","Február","Március","Április","Május","Június",
  "Július","Augusztus","Szeptember","Október","November","December",
];

const DAYS_IN_MONTH: Record<number, number> = {
  1:31, 2:28, 3:31, 4:30, 5:31, 6:30,
  7:31, 8:31, 9:30, 10:31, 11:30, 12:31,
};

function emptyMonths(): ScenarioMonth[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, occupancyPct: 0, adr: 0,
    fbRevenue: 0, spaRevenue: 0, otherRevenue: 0,
  }));
}

function emptyForm(): ScenarioForm {
  return { name: "", description: "", probability: "50", isBase: false, year: String(currentYear) };
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

function fmt(n: number) { return n.toLocaleString("hu-HU"); }

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Summary Modal types ──────────────────────────────────────────────────────

type SummaryModalState = {
  scenarioId: string;
  scenarioName: string;
  status: "streaming" | "done" | "error";
  text: string;
  error?: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScenariosPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotel, setHotel] = useState<{ totalRooms: number | null } | null>(null);

  // Summary modal
  const [summaryModal, setSummaryModal] = useState<SummaryModalState | null>(null);
  // Simple generate loading state
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  async function handleGenerate(scenarioId: string) {
    setGeneratingId(scenarioId);
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}/generate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Ismeretlen hiba" }));
        alert(err.error ?? "Generálás sikertelen");
        return;
      }
      const data = await res.json();
      const pinned = data.constraintsSummary?.pinnedDays ?? [];
      const ranges = data.constraintsSummary?.rangeDays  ?? [];
      const pinnedParam = pinned.length > 0
        ? `&pinned=${encodeURIComponent(JSON.stringify(pinned))}`
        : "";
      const rangeParam = ranges.length > 0
        ? `&ranges=${encodeURIComponent(JSON.stringify(ranges))}`
        : "";
      router.push(`/revenue-planner/${scenarioId}?generated=${data.generated}${pinnedParam}${rangeParam}`);
    } catch (err) {
      alert(String(err));
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleSummary(scenarioId: string, scenarioName: string) {
    setSummaryModal({ scenarioId, scenarioName, status: "streaming", text: "" });

    try {
      const res = await fetch(`/api/scenarios/${scenarioId}/summary`, { method: "POST" });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Ismeretlen hiba" }));
        setSummaryModal(prev => prev ? { ...prev, status: "error", error: err.error } : null);
        return;
      }

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
              setSummaryModal(prev => prev ? { ...prev, text: prev.text + msg.text } : null);
            } else if (msg.type === "done") {
              setSummaryModal(prev => prev ? { ...prev, status: "done" } : null);
            }
          } catch {}
        }
      }
    } catch (err) {
      setSummaryModal(prev => prev ? { ...prev, status: "error", error: String(err) } : null);
    }
  }

  // Add form
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<ScenarioForm>(emptyForm());
  const [formMonths, setFormMonths] = useState<ScenarioMonth[]>(emptyMonths());
  const [saving, setSaving] = useState(false);

  // Open/close scenario detail (months table)
  const [openId, setOpenId] = useState<string | null>(null);
  const [monthData, setMonthData] = useState<Record<string, ScenarioMonth[]>>({});
  const [monthSaving, setMonthSaving] = useState<string | null>(null); // `${scenarioId}|${month}`

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/scenarios").then(r => r.json()),
      fetch("/api/hotels").then(r => r.json()),
    ]).then(([sc, h]) => {
      setScenarios(Array.isArray(sc) ? sc : []);
      setHotel(h?.id ? h : null);
      setLoading(false);
    });
  }, []);

  // Group by year
  const byYear = scenarios.reduce<Record<number, Scenario[]>>((acc, s) => {
    (acc[s.year] ??= []).push(s);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  // ─── Add scenario ──────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name, description: form.description || null,
      probability: Number(form.probability),
      isBase: form.isBase, year: Number(form.year),
    };
    const res = await fetch("/api/scenarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const s: Scenario = await res.json();

    // Save months
    for (const m of formMonths) {
      if (m.occupancyPct > 0 || m.adr > 0) {
        await fetch(`/api/scenarios/${s.id}/plan`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m),
        });
      }
    }

    // Reload with months
    const fresh = await fetch(`/api/scenarios/${s.id}`).then(r => r.json());
    setScenarios(prev => {
      let updated = payload.isBase
        ? prev.map(x => x.year === payload.year ? { ...x, isBase: false } : x) : [...prev];
      return [...updated, fresh].sort((a, b) => b.year - a.year);
    });
    setForm(emptyForm());
    setFormMonths(emptyMonths());
    setAdding(false);
    setSaving(false);
    setOpenId(fresh.id);
  }

  // ─── Toggle scenario detail ────────────────────────────────────────────────

  function toggleOpen(s: Scenario) {
    if (openId === s.id) { setOpenId(null); return; }
    setOpenId(s.id);
    // Initialize monthData from scenario.months if not already loaded
    if (!monthData[s.id]) {
      const map = emptyMonths();
      for (const m of s.months) {
        map[m.month - 1] = { ...m };
      }
      setMonthData(prev => ({ ...prev, [s.id]: map }));
    }
  }

  // ─── Save a single month cell ──────────────────────────────────────────────

  async function saveMonth(scenarioId: string, month: ScenarioMonth) {
    const key = `${scenarioId}|${month.month}`;
    setMonthSaving(key);
    await fetch(`/api/scenarios/${scenarioId}/plan`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(month),
    });
    setMonthSaving(null);
  }

  function updateMonthCell(scenarioId: string, monthIdx: number, field: keyof ScenarioMonth, value: number) {
    setMonthData(prev => {
      const arr = [...(prev[scenarioId] ?? emptyMonths())];
      arr[monthIdx] = { ...arr[monthIdx], [field]: value };
      return { ...prev, [scenarioId]: arr };
    });
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Biztosan törlöd ezt a forgatókönyvet?")) return;
    setDeletingId(id);
    await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
    setScenarios(prev => prev.filter(s => s.id !== id));
    if (openId === id) setOpenId(null);
    setDeletingId(null);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Forgatókönyvek</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
            Éves tervek kihasználtsággal és ADR-rel hónapokra bontva
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#7C3AED", color: "white" }}>
            <Plus size={15} /> Új forgatókönyv
          </button>
        )}
      </div>

      {/* ── Add form ── */}
      {adding && (
        <div className="rounded-2xl" style={{ border: "1.5px solid #C4B5FD", overflow: "hidden" }}>
          <form onSubmit={handleAdd}>
            {/* Meta */}
            <div className="p-5 space-y-4" style={{ background: "#EDE9FE" }}>
              <div className="flex items-center gap-2 mb-1">
                <GitBranch size={16} style={{ color: "#7C3AED" }} />
                <span className="text-sm font-semibold" style={{ color: "#7C3AED" }}>Új forgatókönyv</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <ScField label="Megnevezés" required>
                    <input autoFocus required value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="pl. Alap terv 2026" className="sc-input" />
                  </ScField>
                </div>
                <div className="sm:col-span-2">
                  <ScField label="Leírás">
                    <input value={form.description}
                      onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Rövid leírás (opcionális)" className="sc-input" />
                  </ScField>
                </div>
                <ScField label="Év">
                  <select value={form.year}
                    onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                    className="sc-input">
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </ScField>
                <ScField label="Valószínűség (%)">
                  <div className="space-y-1">
                    <span className="text-xs" style={{ color: probColor(Number(form.probability)).text }}>
                      {probLabel(Number(form.probability))} — {form.probability}%
                    </span>
                    <input type="range" min={0} max={100} step={5}
                      value={form.probability}
                      onChange={e => setForm(p => ({ ...p, probability: e.target.value }))}
                      className="sc-range" />
                  </div>
                </ScField>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div onClick={() => setForm(p => ({ ...p, isBase: !p.isBase }))}
                  className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                  style={{ background: form.isBase ? "#7C3AED" : "white", border: `1.5px solid ${form.isBase ? "#7C3AED" : "#CBD5E1"}` }}>
                  {form.isBase && <Check size={12} color="white" strokeWidth={3} />}
                </div>
                <span className="text-sm" style={{ color: "#334155" }}>Alap forgatókönyv</span>
                <Star size={13} style={{ color: "#F59E0B" }} />
              </label>
            </div>

            {/* Monthly table */}
            <MonthTable
              months={formMonths}
              totalRooms={hotel?.totalRooms ?? null}
              saving={null}
              onChange={(idx, field, val) => {
                setFormMonths(prev => {
                  const arr = [...prev];
                  arr[idx] = { ...arr[idx], [field]: val };
                  return arr;
                });
              }}
              onBlur={() => {}} // no auto-save for new scenario
            />

            <div className="flex gap-2 p-4" style={{ borderTop: "1px solid #E2E8F0" }}>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#7C3AED", color: "white" }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? "Mentés..." : "Forgatókönyv mentése"}
              </button>
              <button type="button" onClick={() => { setAdding(false); setForm(emptyForm()); setFormMonths(emptyMonths()); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "white", color: "#64748B", border: "1px solid #E2E8F0" }}>
                <X size={14} /> Mégse
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Empty state ── */}
      {scenarios.length === 0 && !adding && (
        <div className="rounded-2xl p-12 text-center" style={{ background: "white", border: "1px solid #E2E8F0" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#EDE9FE" }}>
            <GitBranch size={24} style={{ color: "#7C3AED" }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: "#0F172A" }}>Még nincs forgatókönyv</p>
          <p className="text-sm mb-5" style={{ color: "#94A3B8" }}>Hozd létre az első forgatókönyvet a bevételterv alapjához.</p>
          <button onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#7C3AED", color: "white" }}>
            <Plus size={15} /> Első forgatókönyv
          </button>
        </div>
      )}

      {/* ── Scenario list ── */}
      {years.map(year => (
        <div key={year} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold" style={{ color: "#0F172A" }}>{year}</span>
            <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#F1F5F9", color: "#64748B" }}>
              {byYear[year].length} forgatókönyv
            </span>
          </div>

          {byYear[year].map(s => {
            const pc = probColor(s.probability);
            const isOpen = openId === s.id;
            const months = monthData[s.id] ?? emptyMonths().map((m, i) => {
              const found = s.months.find(x => x.month === i + 1);
              return found ? { ...found } : m;
            });

            return (
              <div key={s.id} className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${s.isBase ? "#C4B5FD" : "#E2E8F0"}` }}>

                {/* Scenario header row */}
                <div className="flex items-center gap-4 px-5 py-4"
                  style={{ background: "white" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: s.isBase ? "#EDE9FE" : "#F1F5F9" }}>
                    {s.isBase ? <Star size={18} style={{ color: "#7C3AED" }} />
                      : s.probability >= 70 ? <TrendingUp size={18} style={{ color: "#10B981" }} />
                      : s.probability < 40 ? <AlertTriangle size={18} style={{ color: "#EF4444" }} />
                      : <GitBranch size={18} style={{ color: "#64748B" }} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "#0F172A" }}>{s.name}</span>
                      {s.isBase && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "#EDE9FE", color: "#7C3AED" }}>Alap</span>
                      )}
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: pc.bg, color: pc.text }}>
                        {probLabel(s.probability)} · {s.probability}%
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-sm mt-0.5 truncate" style={{ color: "#64748B" }}>{s.description}</p>
                    )}
                    {/* Mini annual KPI */}
                    {s.months.length > 0 && !isOpen && (
                      <AnnualMini months={s.months} totalRooms={hotel?.totalRooms ?? null} />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleOpen(s)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: isOpen ? "#EDE9FE" : "#F1F5F9", color: isOpen ? "#7C3AED" : "#334155" }}>
                      {isOpen ? <><ChevronUp size={13} /> Bezárás</> : <><ChevronDown size={13} /> Havi terv</>}
                    </button>
                    <button
                      onClick={() => handleGenerate(s.id)}
                      disabled={generatingId === s.id || s.months.length === 0}
                      title={s.months.length === 0 ? "Előbb töltsd ki a havi tervet" : "Generálja le a napi tervet a súlyozás alapján"}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                      {generatingId === s.id
                        ? <><Loader2 size={13} className="animate-spin" /> Generálás...</>
                        : <><Sparkles size={13} /> Generálás</>
                      }
                    </button>
                    <button
                      onClick={() => handleSummary(s.id, s.name)}
                      disabled={summaryModal?.scenarioId === s.id && summaryModal.status === "streaming"}
                      title="Szöveges összefoglaló készítése az AI által"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      style={{ background: "#F0FDF4", color: "#16A34A" }}>
                      <FileText size={13} /> Összefoglaló
                    </button>
                    <button
                      onClick={() => router.push(`/weighting/${s.id}`)}
                      title="Súlyozás beállítása"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                      <Scale size={13} /> Súlyozás
                    </button>
                    <button onClick={() => handleDelete(s.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: "#FEE2E2", color: "#EF4444" }}>
                      {deletingId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>

                {/* Monthly table (expandable) */}
                {isOpen && (
                  <MonthTable
                    months={months}
                    totalRooms={hotel?.totalRooms ?? null}
                    saving={monthSaving}
                    scenarioId={s.id}
                    onChange={(idx, field, val) => updateMonthCell(s.id, idx, field, val)}
                    onBlur={(idx) => saveMonth(s.id, months[idx])}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* ── Összefoglaló modal ── */}
      {summaryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }}
        >
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "white", border: "1px solid #E2E8F0" }}>

            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 py-5" style={{ background: "#0F172A" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#16A34A" }}>
                <FileText size={18} color="white" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold" style={{ color: "#F8FAFC" }}>
                  Összefoglaló — {summaryModal.scenarioName}
                </h2>
                <p className="text-xs" style={{ color: "#64748B" }}>
                  {summaryModal.status === "streaming" && "Riport generálása folyamatban..."}
                  {summaryModal.status === "done" && "Riport elkészült"}
                  {summaryModal.status === "error" && "Hiba történt"}
                </p>
              </div>
              {(summaryModal.status === "done" || summaryModal.status === "error") && (
                <button onClick={() => setSummaryModal(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "#1E293B", color: "#64748B" }}>
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-3 px-6 py-3" style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {summaryModal.status === "streaming" && (
                <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: "#16A34A" }} />
              )}
              {summaryModal.status === "done" && (
                <Check size={14} className="flex-shrink-0" style={{ color: "#16A34A" }} />
              )}
              {summaryModal.status === "error" && (
                <AlertTriangle size={14} className="flex-shrink-0" style={{ color: "#EF4444" }} />
              )}
              <span className="text-sm" style={{ color: summaryModal.status === "error" ? "#EF4444" : "#334155" }}>
                {summaryModal.status === "streaming" && "Tényszerű riport összeállítása a generált napi tervből..."}
                {summaryModal.status === "done" && "Az összefoglaló elkészült."}
                {summaryModal.status === "error" && (summaryModal.error ?? "Ismeretlen hiba")}
              </span>
            </div>

            {/* Streaming text */}
            <div className="px-6 py-4 overflow-y-auto" style={{ minHeight: 200, maxHeight: 420 }}>
              {summaryModal.status === "streaming" && !summaryModal.text && (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
                        style={{ background: "#16A34A", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p className="text-sm" style={{ color: "#94A3B8" }}>Riport összeállítása...</p>
                </div>
              )}

              {(summaryModal.text) && (
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#334155" }}>
                  {summaryModal.text}
                  {summaryModal.status === "streaming" && (
                    <span className="inline-block w-2 h-4 ml-0.5 animate-pulse rounded-sm"
                      style={{ background: "#16A34A", verticalAlign: "text-bottom" }} />
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {summaryModal.status === "done" && (
              <div className="flex gap-2 px-6 py-4" style={{ borderTop: "1px solid #E2E8F0" }}>
                <button
                  onClick={() => { router.push(`/revenue-planner/${summaryModal.scenarioId}`); setSummaryModal(null); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#7C3AED", color: "white" }}>
                  <BarChart3 size={15} /> Bevételtervező
                </button>
                <button onClick={() => setSummaryModal(null)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: "#F1F5F9", color: "#334155" }}>
                  Bezárás
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .sc-input {
          width: 100%; padding: 9px 12px; border: 1.5px solid #E2E8F0;
          border-radius: 10px; font-size: 14px; font-family: inherit;
          color: #0F172A; background: white; outline: none;
          transition: border-color .15s; box-sizing: border-box;
        }
        .sc-input:focus { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
        .sc-range { width: 100%; accent-color: #7C3AED; cursor: pointer; }
        .month-cell {
          width: 100%; text-align: right; font-family: monospace; font-size: 13px;
          padding: 5px 8px; border: 1.5px solid transparent; border-radius: 8px;
          outline: none; background: transparent; color: #0F172A; box-sizing: border-box;
          transition: border-color .1s, background .1s;
        }
        .month-cell:hover { background: #F5F3FF; border-color: #DDD6FE; }
        .month-cell:focus { background: white; border-color: #7C3AED; box-shadow: 0 0 0 2px rgba(124,58,237,0.12); }
      `}</style>
    </div>
  );
}

// ─── Monthly table component ──────────────────────────────────────────────────

function MonthTable({ months, totalRooms, saving, scenarioId, onChange, onBlur }: {
  months: ScenarioMonth[];
  totalRooms: number | null;
  saving: string | null;
  scenarioId?: string;
  onChange: (idx: number, field: keyof ScenarioMonth, val: number) => void;
  onBlur: (idx: number) => void;
}) {
  // Annual totals
  let annRoomRev = 0, annRooms = 0, occSum = 0, filledMonths = 0;

  for (let i = 0; i < 12; i++) {
    const m = months[i];
    const days = DAYS_IN_MONTH[i + 1];
    const rooms = totalRooms ? Math.round(m.occupancyPct / 100 * totalRooms * days) : 0;
    annRoomRev += rooms * m.adr;
    annRooms += rooms;
    if (m.occupancyPct > 0 || m.adr > 0) { occSum += m.occupancyPct; filledMonths++; }
  }
  const avgOcc = filledMonths > 0 ? Math.round(occSum / filledMonths) : 0;

  return (
    <div style={{ borderTop: "1px solid #E2E8F0" }}>
      {!totalRooms && (
        <div className="px-5 py-2 text-xs flex items-center gap-1.5" style={{ background: "#FFFBEB", color: "#D97706" }}>
          ⚠️ A szobaszámot add meg a Hotel beállításoknál, hogy a szobabevétel kalkulálható legyen.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 420 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8", width: 110 }}>Hónap</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8", width: 100 }}>Kihas. %</th>
              {totalRooms && <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8", width: 80 }}>Szobaéj</th>}
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8", width: 110 }}>ADR (Ft)</th>
              {totalRooms && <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8", width: 130 }}>Szoba bev.</th>}
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => {
              const days = DAYS_IN_MONTH[i + 1];
              const rooms = totalRooms ? Math.round(m.occupancyPct / 100 * totalRooms * days) : 0;
              const roomRev = rooms * m.adr;
              const isSaving = saving === `${scenarioId}|${i + 1}`;

              return (
                <tr key={i} style={{ borderBottom: "1px solid #F8FAFC" }}>
                  <td className="px-4 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium" style={{ color: "#0F172A" }}>{HU_MONTHS[i]}</span>
                      {isSaving && <Loader2 size={10} className="animate-spin" style={{ color: "#7C3AED" }} />}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min={0} max={100}
                      value={m.occupancyPct || ""}
                      placeholder="0"
                      onChange={e => onChange(i, "occupancyPct", Number(e.target.value))}
                      onBlur={() => onBlur(i)}
                      className="month-cell" />
                  </td>
                  {totalRooms && (
                    <td className="px-3 py-1.5 text-right font-mono text-sm" style={{ color: rooms > 0 ? "#334155" : "#CBD5E1" }}>
                      {rooms > 0 ? rooms : "—"}
                    </td>
                  )}
                  <td className="px-2 py-1">
                    <input type="number" min={0}
                      value={m.adr || ""}
                      placeholder="0"
                      onChange={e => onChange(i, "adr", Number(e.target.value))}
                      onBlur={() => onBlur(i)}
                      className="month-cell" />
                  </td>
                  {totalRooms && (
                    <td className="px-4 py-1.5 text-right font-mono text-sm font-semibold"
                      style={{ color: roomRev > 0 ? "#7C3AED" : "#CBD5E1" }}>
                      {roomRev > 0 ? fmt(roomRev) : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
              <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide" style={{ color: "#64748B" }}>
                Éves összesen
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-sm" style={{ color: "#0F172A" }}>
                {avgOcc > 0 ? `${avgOcc}%` : "—"}
              </td>
              {totalRooms && (
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-sm" style={{ color: "#0F172A" }}>
                  {annRooms > 0 ? fmt(annRooms) : "—"}
                </td>
              )}
              <td className="px-3 py-2.5 text-right font-mono text-sm" style={{ color: "#94A3B8" }}>—</td>
              {totalRooms && (
                <td className="px-4 py-2.5 text-right font-mono font-bold text-sm" style={{ color: "#7C3AED" }}>
                  {annRoomRev > 0 ? fmt(annRoomRev) : "—"}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Annual mini summary (collapsed state) ────────────────────────────────────

function AnnualMini({ months, totalRooms }: { months: ScenarioMonth[]; totalRooms: number | null }) {
  let annRoomRev = 0, occSum = 0, filled = 0;
  for (const m of months) {
    const days = DAYS_IN_MONTH[m.month];
    const rooms = totalRooms ? Math.round(m.occupancyPct / 100 * totalRooms * days) : 0;
    annRoomRev += rooms * m.adr;
    if (m.occupancyPct > 0) { occSum += m.occupancyPct; filled++; }
  }
  const avgOcc = filled > 0 ? Math.round(occSum / filled) : 0;
  if (annRoomRev === 0 && avgOcc === 0) return null;

  return (
    <div className="flex items-center gap-3 mt-1.5">
      {avgOcc > 0 && (
        <span className="text-xs font-mono" style={{ color: "#64748B" }}>
          ~{avgOcc}% kihas.
        </span>
      )}
      {annRoomRev > 0 && (
        <span className="text-xs font-mono font-semibold" style={{ color: "#7C3AED" }}>
          {fmt(annRoomRev)} Ft szobabev. / év
        </span>
      )}
    </div>
  );
}

function ScField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: "#334155", letterSpacing: "0.06em" }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
