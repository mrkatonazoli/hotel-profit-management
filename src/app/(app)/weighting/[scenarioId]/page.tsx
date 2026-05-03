"use client";

import React, { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Loader2, Check, X, Pencil, Scale, ArrowLeft,
  MessageSquare, ChevronDown, ChevronUp, Sparkles, Variable,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mults = { occMult: number; adrMult: number; fbMult: number; spaMult: number; otherMult: number };
type DayWeightRow = Mults & { note?: string | null };

type ScenarioVariable = {
  id: string;
  name: string;
  value: string;
  sortOrder: number;
};

type Season = {
  id: string; name: string;
  monthFrom: number; dayFrom: number;
  monthTo: number; dayTo: number;
  note?: string | null;
} & Mults;

type SeasonForm = {
  name: string; dateFrom: string; dateTo: string; note: string;
  occMult: string; adrMult: string; fbMult: string; spaMult: string; otherMult: string;
};

type ScenarioInfo = { id: string; name: string; year: number };

type RoomTypeRow = {
  id: string;
  name: string;
  count: number;
  occShareMult: number;
  adultsPerRoom: number;
};

type BoardTypeShareRow = {
  boardType: string;
  sharePct: number;
};

type RtBoardTypeShares = {
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCount: number;
  shares: BoardTypeShareRow[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_GROUPS = [
  { label: "Vasárnap – Csütörtök", dows: [0, 1, 2, 3, 4], key: "vcs" },
  { label: "Péntek",               dows: [5],              key: "pen" },
  { label: "Szombat",              dows: [6],              key: "szo" },
];

const MULT_FIELDS: { key: keyof Mults; label: string }[] = [
  { key: "occMult",   label: "Kihas. szorzó"      },
  { key: "adrMult",   label: "ADR szorzó"          },
  { key: "fbMult",    label: "F&B (szobabev. %)"   },
  { key: "spaMult",   label: "Spa (szobabev. %)"   },
  { key: "otherMult", label: "Egyéb (szobabev. %)" },
];

const HU_MONTHS = ["jan","feb","már","ápr","máj","jún","júl","aug","sze","okt","nov","dec"];
const DEFAULT_MULTS: Mults = { occMult: 1, adrMult: 1, fbMult: 0, spaMult: 0, otherMult: 0 };

function emptySeasonForm(): SeasonForm {
  return { name: "", dateFrom: "", dateTo: "", note: "", occMult: "1.00", adrMult: "1.00", fbMult: "0.00", spaMult: "0.00", otherMult: "0.00" };
}
function parseDateInput(val: string): { month: number; day: number } | null {
  if (!val) return null;
  const [, m, d] = val.split("-").map(Number);
  return { month: m, day: d };
}
function seasonToDateStrings(s: Season) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return { dateFrom: `2000-${pad(s.monthFrom)}-${pad(s.dayFrom)}`, dateTo: `2000-${pad(s.monthTo)}-${pad(s.dayTo)}` };
}
function formatSeasonRange(s: Season) {
  return `${HU_MONTHS[s.monthFrom - 1]}. ${s.dayFrom}. – ${HU_MONTHS[s.monthTo - 1]}. ${s.dayTo}.`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScenarioWeightingPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = use(params);
  const router = useRouter();

  const [scenario, setScenario] = useState<ScenarioInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Day weights
  const [groupWeights, setGroupWeights] = useState<Record<string, DayWeightRow>>({
    vcs: { ...DEFAULT_MULTS }, pen: { ...DEFAULT_MULTS }, szo: { ...DEFAULT_MULTS },
  });
  const [dayWgtSaving, setDayWgtSaving] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});

  // Seasons
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [addingSeason, setAddingSeason] = useState(false);
  const [seasonForm, setSeasonForm] = useState<SeasonForm>(emptySeasonForm());
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [editSeasonId, setEditSeasonId] = useState<string | null>(null);
  const [editSeasonForm, setEditSeasonForm] = useState<SeasonForm>(emptySeasonForm());
  const [editSaving, setEditSaving] = useState(false);
  const [deletingSeasonId, setDeletingSeasonId] = useState<string | null>(null);

  // Room type weights
  const [roomTypeRows, setRoomTypeRows] = useState<RoomTypeRow[]>([]);
  const [rtSaving, setRtSaving] = useState<string | null>(null);

  // Board type shares
  const [activeBoardTypes, setActiveBoardTypes] = useState<string[]>([]);
  const [btShares, setBtShares] = useState<RtBoardTypeShares[]>([]);
  const [btSaving, setBtSaving] = useState<string | null>(null);
  const btDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Variables
  const [variables, setVariables] = useState<ScenarioVariable[]>([]);
  const [addingVar, setAddingVar] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [varSaving, setVarSaving] = useState(false);
  const [editVarId, setEditVarId] = useState<string | null>(null);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [deletingVarId, setDeletingVarId] = useState<string | null>(null);
  const varSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [scRes, wRes, sRes, vRes, rtRes, hbtRes, btRes] = await Promise.all([
          fetch(`/api/scenarios/${scenarioId}`),
          fetch(`/api/scenarios/${scenarioId}/weighting`),
          fetch(`/api/scenarios/${scenarioId}/weighting/seasons`),
          fetch(`/api/scenarios/${scenarioId}/variables`),
          fetch(`/api/scenarios/${scenarioId}/weighting/room-types`),
          fetch(`/api/hotel-board-types`),
          fetch(`/api/scenarios/${scenarioId}/weighting/board-type-shares`),
        ]);

        const scData  = await scRes.json();
        const wData   = await wRes.json();
        const sData   = await sRes.json();
        const vData   = vRes.ok ? await vRes.json() : [];
        const rtData  = rtRes.ok ? await rtRes.json() : [];
        // Hotel board types — source of truth (same as revenue planner)
        const hbtData: string[] = hbtRes.ok ? await hbtRes.json() : [];
        const btData  = btRes.ok ? await btRes.json() : { activeBoardTypes: [], roomTypes: [] };

        setScenario({ id: scData.id, name: scData.name, year: scData.year });

        const dayWeights = wData?.dayWeights ?? [];
        if (dayWeights.length) {
          const gw: Record<string, DayWeightRow> = {
            vcs: { ...DEFAULT_MULTS }, pen: { ...DEFAULT_MULTS }, szo: { ...DEFAULT_MULTS },
          };
          const openMap: Record<string, boolean> = {};
          for (const row of dayWeights) {
            const key = row.dayOfWeek === 5 ? "pen" : row.dayOfWeek === 6 ? "szo" : "vcs";
            if (row.id !== null) {
              gw[key] = { occMult: row.occMult, adrMult: row.adrMult, fbMult: row.fbMult, spaMult: row.spaMult, otherMult: row.otherMult, note: row.note ?? "" };
              if (row.note) openMap[key] = true;
            }
          }
          setGroupWeights(gw);
          setNoteOpen(openMap);
        }
        setSeasons(Array.isArray(sData) ? sData : []);
        setVariables(Array.isArray(vData) ? vData : []);
        setRoomTypeRows(Array.isArray(rtData) ? rtData : []);
        // Use hotel-board-types as source of truth; merge with saved shares
        const activeBts: string[] = hbtData.length > 0 ? hbtData : (btData.activeBoardTypes ?? []);
        setActiveBoardTypes(activeBts);

        // Build btShares: for each room type, fill in shares for active board types
        const rtList: { id: string; name: string; count: number }[] = Array.isArray(rtData) ? rtData : [];
        const savedRtShares: { roomTypeId: string; shares: BoardTypeShareRow[] }[] = btData.roomTypes ?? [];
        const defaultPct = activeBts.length > 0 ? Math.round(100 / activeBts.length * 10) / 10 : 0;

        const mergedShares: RtBoardTypeShares[] = rtList.map(rt => {
          const saved = savedRtShares.find(s => s.roomTypeId === rt.id);
          const shares = activeBts.map(bt => {
            const foundShare = saved?.shares.find(s => s.boardType === bt);
            return { boardType: bt, sharePct: foundShare?.sharePct ?? defaultPct };
          });
          return { roomTypeId: rt.id, roomTypeName: rt.name, roomTypeCount: rt.count, shares };
        });
        setBtShares(mergedShares);
      } catch (err) {
        console.error("Weighting load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [scenarioId]);

  // ── Day weights ──────────────────────────────────────────────────────────

  async function saveDayGroup(groupKey: string) {
    setDayWgtSaving(groupKey);
    const row = groupWeights[groupKey];
    const dows = DAY_GROUPS.find(g => g.key === groupKey)!.dows;
    await Promise.all(dows.map(dow =>
      fetch(`/api/scenarios/${scenarioId}/weighting`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: dow, ...row }),
      })
    ));
    setDayWgtSaving(null);
  }

  function updateGroupField(groupKey: string, field: keyof DayWeightRow, val: number | string) {
    setGroupWeights(prev => ({ ...prev, [groupKey]: { ...prev[groupKey], [field]: val } }));
  }

  // ── Room type weights ─────────────────────────────────────────────────────

  async function saveRoomTypeWeight(roomTypeId: string, occShareMult: number) {
    setRtSaving(roomTypeId);
    await fetch(`/api/scenarios/${scenarioId}/weighting/room-types`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomTypeId, occShareMult }),
    });
    setRtSaving(null);
  }

  async function saveAdultsPerRoom(roomTypeId: string, adultsPerRoom: number) {
    setRtSaving(roomTypeId);
    await fetch(`/api/scenarios/${scenarioId}/weighting/room-types`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomTypeId, adultsPerRoom }),
    });
    setRtSaving(null);
  }

  function updateRoomTypeMult(roomTypeId: string, val: number) {
    setRoomTypeRows(prev => prev.map(r => r.id === roomTypeId ? { ...r, occShareMult: val } : r));
  }

  function updateAdultsPerRoom(roomTypeId: string, val: number) {
    setRoomTypeRows(prev => prev.map(r => r.id === roomTypeId ? { ...r, adultsPerRoom: val } : r));
  }

  // ── Board type shares ─────────────────────────────────────────────────────

  function updateBtShare(roomTypeId: string, boardType: string, val: number) {
    setBtShares(prev => {
      const next = prev.map(rt =>
        rt.roomTypeId !== roomTypeId ? rt : {
          ...rt,
          shares: rt.shares.map(s => s.boardType === boardType ? { ...s, sharePct: val } : s),
        }
      );
      // Debounced auto-save: 600ms after last change for this RT
      clearTimeout(btDebounceRef.current[roomTypeId]);
      btDebounceRef.current[roomTypeId] = setTimeout(async () => {
        const rt = next.find(r => r.roomTypeId === roomTypeId);
        if (!rt) return;
        await fetch(`/api/scenarios/${scenarioId}/weighting/board-type-shares`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomTypeId, shares: rt.shares }),
        });
      }, 600);
      return next;
    });
  }

  async function saveBtShares(roomTypeId: string) {
    const rt = btShares.find(r => r.roomTypeId === roomTypeId);
    if (!rt) return;
    setBtSaving(roomTypeId);
    await fetch(`/api/scenarios/${scenarioId}/weighting/board-type-shares`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomTypeId, shares: rt.shares }),
    });
    // Normalize locally after save
    const total = rt.shares.reduce((s, x) => s + x.sharePct, 0);
    if (total > 0) {
      setBtShares(prev => prev.map(r =>
        r.roomTypeId !== roomTypeId ? r : {
          ...r,
          shares: r.shares.map(s => ({
            ...s,
            sharePct: Math.round((s.sharePct / total) * 1000) / 10,
          })),
        }
      ));
    }
    setBtSaving(null);
  }

  // ── Seasons ──────────────────────────────────────────────────────────────

  function formToPayload(f: SeasonForm) {
    const from = parseDateInput(f.dateFrom);
    const to   = parseDateInput(f.dateTo);
    return {
      name: f.name, note: f.note || null,
      monthFrom: from?.month ?? 1, dayFrom: from?.day ?? 1,
      monthTo: to?.month ?? 1, dayTo: to?.day ?? 1,
      occMult: Number(f.occMult), adrMult: Number(f.adrMult),
      fbMult: Number(f.fbMult), spaMult: Number(f.spaMult), otherMult: Number(f.otherMult),
    };
  }

  async function handleAddSeason(e: React.FormEvent) {
    e.preventDefault();
    setSeasonSaving(true);
    const res = await fetch(`/api/scenarios/${scenarioId}/weighting/seasons`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(seasonForm)),
    });
    const newSeason = await res.json();
    setSeasons(prev => [...prev, newSeason]);
    setSeasonForm(emptySeasonForm());
    setAddingSeason(false);
    setSeasonSaving(false);
  }

  async function handleEditSeason(id: string) {
    setEditSaving(true);
    const res = await fetch(`/api/scenarios/${scenarioId}/weighting/seasons/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(editSeasonForm)),
    });
    setSeasons(prev => prev.map(x => x.id === id ? res.ok ? undefined : x : x).filter(Boolean) as Season[]);
    const updated = await res.json();
    setSeasons(prev => prev.map(x => x.id === id ? updated : x));
    setEditSeasonId(null);
    setEditSaving(false);
  }

  async function handleDeleteSeason(id: string) {
    if (!confirm("Törlöd ezt az időszakot?")) return;
    setDeletingSeasonId(id);
    await fetch(`/api/scenarios/${scenarioId}/weighting/seasons/${id}`, { method: "DELETE" });
    setSeasons(prev => prev.filter(s => s.id !== id));
    setDeletingSeasonId(null);
  }

  function startEditSeason(s: Season) {
    const { dateFrom, dateTo } = seasonToDateStrings(s);
    setEditSeasonId(s.id);
    setEditSeasonForm({
      name: s.name, dateFrom, dateTo, note: s.note ?? "",
      occMult: s.occMult.toFixed(2), adrMult: s.adrMult.toFixed(2),
      fbMult: s.fbMult.toFixed(2), spaMult: s.spaMult.toFixed(2), otherMult: s.otherMult.toFixed(2),
    });
  }

  // ── Variables ─────────────────────────────────────────────────────────────

  async function handleAddVariable() {
    if (!newVarName.trim()) return;
    setVarSaving(true);
    const res = await fetch(`/api/scenarios/${scenarioId}/variables`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newVarName.trim(), value: newVarValue.trim() }),
    });
    const v = await res.json();
    setVariables(prev => [...prev, v]);
    setNewVarName(""); setNewVarValue("");
    setAddingVar(false);
    setVarSaving(false);
    setEditVarId(v.id); // open for editing immediately
  }

  function updateVarField(id: string, field: "name" | "value", val: string) {
    setVariables(prev => prev.map(v => v.id === id ? { ...v, [field]: val } : v));
    // Debounce save
    if (varSaveTimers.current[id]) clearTimeout(varSaveTimers.current[id]);
    varSaveTimers.current[id] = setTimeout(() => {
      const current = variables.find(v => v.id === id);
      if (!current) return;
      const updated = field === "name" ? { name: val } : { value: val };
      fetch(`/api/scenarios/${scenarioId}/variables/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    }, 600);
  }

  async function handleDeleteVariable(id: string) {
    setDeletingVarId(id);
    await fetch(`/api/scenarios/${scenarioId}/variables/${id}`, { method: "DELETE" });
    setVariables(prev => prev.filter(v => v.id !== id));
    setDeletingVarId(null);
  }

  async function handleRefineVariable(id: string) {
    setRefiningId(id);
    const res = await fetch(`/api/scenarios/${scenarioId}/variables/${id}/refine`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      setVariables(prev => prev.map(v => v.id === id ? updated : v));
    }
    setRefiningId(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.push("/scenarios")}
          className="flex items-center gap-1.5 text-sm mb-3" style={{ color: "#64748B" }}>
          <ArrowLeft size={14} /> Vissza a szcenáriókhoz
        </button>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#EDE9FE" }}>
            <Scale size={20} style={{ color: "#7C3AED" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Súlyozás</h1>
            <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
              {scenario?.name} · {scenario?.year} · Naptípus és kiemelt időszak szorzók
            </p>
          </div>
        </div>
      </div>

      {/* ── AI Változók ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <div className="flex items-center gap-3">
            <Variable size={16} style={{ color: "#7C3AED" }} />
            <div>
              <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>AI Változók</h2>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                Nevesített tények, szabályok, események — az AI generálás és összefoglaló figyelembe veszi
              </p>
            </div>
          </div>
          {!addingVar && (
            <button onClick={() => setAddingVar(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
              style={{ background: "#EDE9FE", color: "#7C3AED" }}>
              <Plus size={14} /> Új változó
            </button>
          )}
        </div>

        {/* Add form */}
        {addingVar && (
          <div className="p-5 space-y-3" style={{ borderBottom: "1px solid #E2E8F0", background: "#FAF9FF" }}>
            <div>
              <label className="wlabel">Változó neve</label>
              <input
                autoFocus
                value={newVarName}
                onChange={e => setNewVarName(e.target.value)}
                placeholder="pl. Hétvége max. kihasználtság, Május 28. esemény, Versenytárs helyzet..."
                className="sf-input"
                onKeyDown={e => e.key === "Enter" && handleAddVariable()}
              />
            </div>
            <div>
              <label className="wlabel">Érték / leírás</label>
              <textarea
                rows={2}
                value={newVarValue}
                onChange={e => setNewVarValue(e.target.value)}
                placeholder="Írj bármit — töredékes, vázlatos is jó. Az AI gomb majd szépen megfogalmazza."
                className="sf-textarea"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddVariable} disabled={varSaving || !newVarName.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: "#7C3AED", color: "white" }}>
                {varSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {varSaving ? "Mentés..." : "Hozzáadás"}
              </button>
              <button onClick={() => { setAddingVar(false); setNewVarName(""); setNewVarValue(""); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "white", color: "#64748B", border: "1px solid #E2E8F0" }}>
                <X size={14} /> Mégse
              </button>
            </div>
          </div>
        )}

        {/* Empty */}
        {variables.length === 0 && !addingVar && (
          <div className="py-10 text-center px-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#F5F3FF" }}>
              <Variable size={18} style={{ color: "#A78BFA" }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "#334155" }}>Még nincs változó</p>
            <p className="text-xs" style={{ color: "#94A3B8" }}>
              Adj hozzá nevesített szabályokat, eseményeket, piaci tényeket — pl. &ldquo;Hétvége max. kihasználtság&rdquo;,  &ldquo;Május 28. rendezvény&rdquo;
            </p>
          </div>
        )}

        {/* Variable list */}
        <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
          {variables.map(v => {
            const isEditing = editVarId === v.id;
            const isRefining = refiningId === v.id;
            const isDeleting = deletingVarId === v.id;

            return (
              <div key={v.id} className="px-5 py-4">
                {isEditing ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <input
                      value={v.name}
                      onChange={e => updateVarField(v.id, "name", e.target.value)}
                      className="sf-input text-sm font-semibold"
                      placeholder="Változó neve"
                    />
                    <div className="relative">
                      <textarea
                        rows={3}
                        value={v.value}
                        onChange={e => updateVarField(v.id, "value", e.target.value)}
                        placeholder="Írj bármit — töredékes, vázlatos is jó. Az AI gomb majd megfogalmazza."
                        className="sf-textarea"
                        style={{ paddingRight: 120 }}
                      />
                      <button
                        onClick={() => handleRefineVariable(v.id)}
                        disabled={isRefining || !v.value.trim()}
                        title="AI megfogalmazás"
                        className="absolute right-2 top-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all"
                        style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                        {isRefining
                          ? <><Loader2 size={11} className="animate-spin" /> Formázás...</>
                          : <><Sparkles size={11} /> AI formázás</>
                        }
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditVarId(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: "#D1FAE5", color: "#059669" }}>
                        <Check size={12} /> Kész
                      </button>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>Automatikusan mentődik gépelés közben</p>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "#EDE9FE" }}>
                      <Variable size={13} style={{ color: "#7C3AED" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5" style={{ color: "#0F172A" }}>{v.name}</p>
                      {v.value ? (
                        <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{v.value}</p>
                      ) : (
                        <p className="text-xs italic" style={{ color: "#CBD5E1" }}>Nincs érték megadva</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => setEditVarId(v.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: "#F1F5F9", color: "#64748B" }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDeleteVariable(v.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: "#FEE2E2", color: "#EF4444" }}>
                        {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Szobatípus súlyok ── */}
      {roomTypeRows.length > 0 && (
        <div className="space-y-4">

          {/* Népszerűség */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
              <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Szobatípus népszerűség</h2>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                Melyik szobák fogynak el hamarabb · 1.00 = hotel átlag · 1.30 = 30%-kal népszerűbb · 0.60 = 40%-kal kevésbé keresett
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Szobatípus</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Szobák</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Népszerűségi szorzó</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-center" style={{ color: "#94A3B8", width: 120 }}>Hatás (70% hotelnél)</th>
                    <th className="w-14" />
                  </tr>
                </thead>
                <tbody>
                  {roomTypeRows.map(rt => {
                    const isSaving = rtSaving === rt.id;
                    const previewOcc = Math.min(Math.round(70 * rt.occShareMult), 100);
                    const multColor = rt.occShareMult > 1.05 ? "#059669"
                      : rt.occShareMult < 0.95 ? "#DC2626" : "#64748B";
                    return (
                      <tr key={rt.id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#7C3AED" }} />
                            <span className="text-sm font-medium" style={{ color: "#0F172A" }}>{rt.name}</span>
                            {isSaving && <Loader2 size={11} className="animate-spin" style={{ color: "#7C3AED" }} />}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-sm font-mono" style={{ color: "#64748B" }}>{rt.count} db</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number" step={0.05} min={0.1} max={5}
                              value={rt.occShareMult}
                              onChange={e => updateRoomTypeMult(rt.id, Number(e.target.value))}
                              onBlur={() => saveRoomTypeWeight(rt.id, rt.occShareMult)}
                              className="mult-input"
                              style={{ color: multColor, fontWeight: rt.occShareMult !== 1 ? 700 : 400 }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: 60, background: "#F1F5F9", overflow: "hidden" }}>
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${previewOcc}%`,
                                background: previewOcc >= 85 ? "#10B981" : previewOcc >= 60 ? "#7C3AED" : previewOcc >= 40 ? "#F59E0B" : "#EF4444",
                              }} />
                            </div>
                            <span className="text-xs font-mono font-semibold" style={{ color: multColor, minWidth: 36 }}>
                              ~{previewOcc}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => saveRoomTypeWeight(rt.id, rt.occShareMult)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto"
                            style={{ background: "#D1FAE5", color: "#10B981" }}>
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3" style={{ borderTop: "1px solid #F1F5F9", background: "#FAFAFA" }}>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                A bevételtervező szobatípus nézetei ezt a népszerűségi szorzót használják a kihasználtság megjelenítéséhez.
                A hotel szintű havi összesítő változatlan marad.
              </p>
            </div>
          </div>

          {/* ── Felnőttek száma szobánként ── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
              <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Felnőttek száma szobánként</h2>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                Az egyes és kétszemélyes foglalások aránya szobatípusonként.
                Szabály: minden szobában legalább 1 felnőtt · maximum 2 felnőttel számolunk.
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
              {roomTypeRows.map(rt => {
                const isSaving = rtSaving === rt.id;
                // adultsPerRoom ∈ [1.0, 2.0]:
                //   singlePct = (2 - v) * 100   → v=1.0 ⇒ 100% egyes, v=2.0 ⇒ 0%
                //   doublePct = (v - 1) * 100    → v=1.0 ⇒ 0% páros, v=2.0 ⇒ 100%
                const v = Math.min(2, Math.max(1, rt.adultsPerRoom));
                const singlePct = Math.round((2 - v) * 100);
                const doublePct = 100 - singlePct;
                const sliderPct = (v - 1) * 100; // 0–100 for CSS

                return (
                  <div key={rt.id} className="px-6 py-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#7C3AED" }} />
                        <span className="text-sm font-medium" style={{ color: "#0F172A" }}>{rt.name}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                          {rt.count} szoba
                        </span>
                        {isSaving && <Loader2 size={11} className="animate-spin" style={{ color: "#7C3AED" }} />}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        <span style={{ color: "#0EA5E9" }}>{singlePct}% esély 1 felnőtt</span>
                        <span style={{ color: "#8B5CF6" }}>{doublePct}% esély 2 felnőtt</span>
                      </div>
                    </div>

                    {/* Slider + felirat */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold w-16 text-right flex-shrink-0"
                        style={{ color: singlePct >= 70 ? "#0EA5E9" : "#94A3B8" }}>
                        1 felnőtt
                      </span>

                      <div className="relative flex-1" style={{ height: 28 }}>
                        {/* Track */}
                        <div className="absolute inset-y-0 flex items-center w-full" style={{ top: "calc(50% - 3px)", transform: "none", height: 6 }}>
                          {/* 1→csúszka: kék (egyes) */}
                          <div className="h-full rounded-l-full flex-shrink-0 transition-all"
                            style={{ width: `${sliderPct}%`, background: "#8B5CF6", minWidth: sliderPct === 0 ? 0 : 4 }} />
                          {/* csúszka→2: lila (páros) */}
                          <div className="h-full rounded-r-full flex-1 transition-all"
                            style={{ background: "#E2E8F0" }} />
                        </div>
                        <input
                          type="range"
                          min={1} max={2} step={0.05}
                          value={v}
                          onChange={e => updateAdultsPerRoom(rt.id, Number(e.target.value))}
                          onMouseUp={() => saveAdultsPerRoom(rt.id, rt.adultsPerRoom)}
                          onTouchEnd={() => saveAdultsPerRoom(rt.id, rt.adultsPerRoom)}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          style={{ height: "100%" }}
                        />
                        {/* Custom thumb */}
                        <div
                          className="absolute pointer-events-none flex items-center justify-center text-xs font-bold rounded-full shadow-md transition-all"
                          style={{
                            width: 32, height: 32,
                            top: "50%", transform: "translateY(-50%)",
                            left: `calc(${sliderPct}% - ${sliderPct / 100 * 32}px)`,
                            background: "white",
                            border: "2px solid #7C3AED",
                            color: "#7C3AED",
                            boxShadow: "0 2px 8px rgba(124,58,237,0.25)",
                          }}>
                          {v.toFixed(1)}
                        </div>
                      </div>

                      <span className="text-xs font-semibold w-16 flex-shrink-0"
                        style={{ color: doublePct >= 70 ? "#8B5CF6" : "#94A3B8" }}>
                        2 felnőtt
                      </span>
                    </div>

                    {/* Arány-sáv */}
                    <div className="mt-3 flex rounded-lg overflow-hidden" style={{ height: 8 }}>
                      <div className="transition-all" style={{ width: `${singlePct}%`, background: "#BFDBFE" }} />
                      <div className="transition-all" style={{ width: `${doublePct}%`, background: "#DDD6FE" }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs" style={{ color: "#94A3B8" }}>
                        {singlePct > 0 ? `${singlePct}% esély 1 felnőtt` : ""}
                      </span>
                      <span className="text-xs" style={{ color: "#94A3B8" }}>
                        {doublePct > 0 ? `${doublePct}% esély 2 felnőtt` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3" style={{ borderTop: "1px solid #F1F5F9", background: "#FAFAFA" }}>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                A csúszkát a vendégtérkép seed-elésekor és a vendégszám-kalkulációnál vesszük figyelembe.
                Háromfősnél több felnőtt szobánként nem szerepel a modellben.
              </p>
            </div>
          </div>

          {/* ── Ellátástípus arányok ── */}
          {activeBoardTypes.length > 0 && roomTypeRows.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
                <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Ellátástípus arányok</h2>
                <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                  A generáláskor szobatípusonként ilyen arányban kerülnek az ellátástípusokhoz a szobák.
                  Csak a szállodánál beállított ellátástípusok jelennek meg.
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
                {btShares.map(rt => {
                  const total = rt.shares.reduce((s, x) => s + x.sharePct, 0);
                  const isSaving = btSaving === rt.roomTypeId;

                  // Colors per board type
                  const BT_COLORS: Record<string, { bar: string; text: string; light: string }> = {
                    RO: { bar: "#94A3B8", text: "#64748B", light: "#F1F5F9" },
                    BB: { bar: "#3B82F6", text: "#1D4ED8", light: "#DBEAFE" },
                    HB: { bar: "#10B981", text: "#065F46", light: "#D1FAE5" },
                    FB: { bar: "#8B5CF6", text: "#5B21B6", light: "#EDE9FE" },
                    AI: { bar: "#F59E0B", text: "#92400E", light: "#FEF3C7" },
                  };

                  return (
                    <div key={rt.roomTypeId} className="px-6 py-5">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#10B981" }} />
                          <span className="text-sm font-medium" style={{ color: "#0F172A" }}>{rt.roomTypeName}</span>
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "#D1FAE5", color: "#065F46" }}>
                            {rt.roomTypeCount} szoba
                          </span>
                          {isSaving && <span className="text-xs" style={{ color: "#94A3B8" }}>Mentés…</span>}
                        </div>
                        <span className="text-xs font-semibold" style={{ color: Math.abs(total - 100) < 0.5 ? "#10B981" : "#EF4444" }}>
                          Σ {Math.round(total)}%
                        </span>
                      </div>

                      {/* Per board type: slider */}
                      <div className="space-y-5">
                        {rt.shares.map(({ boardType, sharePct }) => {
                          const c = BT_COLORS[boardType] ?? { bar: "#94A3B8", text: "#64748B", light: "#F1F5F9" };
                          const v = Math.min(100, Math.max(0, sharePct));
                          const thumbPct = v; // 0–100 → CSS %
                          return (
                            <div key={boardType}>
                              <div className="flex items-center gap-3">
                                {/* Board type badge */}
                                <span className="text-xs font-bold w-8 flex-shrink-0 text-center py-0.5 rounded"
                                  style={{ background: c.light, color: c.text }}>
                                  {boardType}
                                </span>

                                {/* Slider track + thumb */}
                                <div className="relative flex-1" style={{ height: 36 }}>
                                  {/* Track */}
                                  <div className="absolute w-full"
                                    style={{ top: "calc(50% - 3px)", height: 6, borderRadius: 999 }}>
                                    {/* Filled portion */}
                                    <div className="absolute h-full rounded-l-full"
                                      style={{ width: `${thumbPct}%`, background: c.bar, minWidth: thumbPct > 0 ? 4 : 0 }} />
                                    {/* Empty portion */}
                                    <div className="absolute h-full rounded-r-full"
                                      style={{ left: `${thumbPct}%`, right: 0, background: "#E2E8F0" }} />
                                  </div>

                                  {/* Native input (invisible, on top) */}
                                  <input
                                    type="range" min={0} max={100} step={1}
                                    value={Math.round(v)}
                                    onChange={e => updateBtShare(rt.roomTypeId, boardType, Number(e.target.value))}
                                    onMouseUp={() => saveBtShares(rt.roomTypeId)}
                                    onTouchEnd={() => saveBtShares(rt.roomTypeId)}
                                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                    style={{ height: "100%", zIndex: 10 }}
                                  />

                                  {/* Custom thumb gömböc */}
                                  <div className="absolute pointer-events-none flex items-center justify-center
                                    text-xs font-bold rounded-full shadow-md"
                                    style={{
                                      width: 34, height: 34,
                                      top: "50%", transform: "translateY(-50%)",
                                      left: `calc(${thumbPct}% - ${thumbPct / 100 * 34}px)`,
                                      background: "white",
                                      border: `2px solid ${c.bar}`,
                                      color: c.text,
                                      boxShadow: `0 2px 8px ${c.bar}44`,
                                      transition: "left 0s",
                                    }}>
                                    {Math.round(v)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Stacked bar */}
                      <div className="mt-4 flex rounded-lg overflow-hidden" style={{ height: 10 }}>
                        {rt.shares.map(({ boardType, sharePct }) => {
                          const c = BT_COLORS[boardType] ?? { bar: "#94A3B8", text: "#64748B", light: "#F1F5F9" };
                          const pct = total > 0 ? (sharePct / total) * 100 : 0;
                          return pct > 0 ? (
                            <div key={boardType} className="h-full transition-all" style={{ width: `${pct}%`, background: c.bar }} />
                          ) : null;
                        })}
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {rt.shares.filter(s => s.sharePct > 0).map(({ boardType, sharePct }) => {
                          const c = BT_COLORS[boardType] ?? { bar: "#94A3B8", text: "#64748B", light: "#F1F5F9" };
                          const pct = total > 0 ? Math.round((sharePct / total) * 100) : 0;
                          return (
                            <span key={boardType} className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: c.light, color: c.text }}>
                              {boardType} {pct}%
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-4 flex items-center justify-between gap-4"
                style={{ borderTop: "1px solid #F1F5F9", background: "#FAFAFA" }}>
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  Az összeg automatikusan 100%-ra normalizálódik mentéskor.
                  Csak a szállodánál felvett ellátástípusok szerepelnek.
                </p>
                <button
                  onClick={async () => {
                    for (const rt of btShares) await saveBtShares(rt.roomTypeId);
                  }}
                  disabled={btSaving !== null}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all"
                  style={{
                    background: btSaving !== null ? "#F1F5F9" : "#0F172A",
                    color: btSaving !== null ? "#94A3B8" : "white",
                    cursor: btSaving !== null ? "not-allowed" : "pointer",
                  }}>
                  {btSaving !== null
                    ? <><Loader2 size={13} className="animate-spin" /> Mentés…</>
                    : <><Check size={13} /> Arányok mentése</>}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Kihasználtság & ADR szorzók ── */}
      <DayGroupTable
        title="Kihasználtság & ADR szorzók"
        subtitle="1.00 = havi átlag · 1.20 = 20%-kal magasabb · 0.80 = 20%-kal alacsonyabb"
        columns={[
          { key: "occMult", label: "Kihas. szorzó", step: 0.05, min: 0, max: 5 },
          { key: "adrMult", label: "ADR szorzó",    step: 0.05, min: 0, max: 5 },
        ]}
        groupWeights={groupWeights}
        dayWgtSaving={dayWgtSaving}
        noteOpen={noteOpen}
        onToggleNote={key => setNoteOpen(prev => ({ ...prev, [key]: !prev[key] }))}
        onChange={updateGroupField}
        onSave={saveDayGroup}
      />

      {/* ── F&B / Spa / Egyéb ── */}
      <DayGroupTable
        title="F&B / Spa / Egyéb bevétel arányok"
        subtitle="A napi szobabevétel hányada · 0.20 = szobabevétel 20%-a · 0 = nincs bevétel"
        columns={[
          { key: "fbMult",    label: "F&B",   step: 0.01, min: 0, max: 10 },
          { key: "spaMult",   label: "Spa",   step: 0.01, min: 0, max: 10 },
          { key: "otherMult", label: "Egyéb", step: 0.01, min: 0, max: 10 },
        ]}
        groupWeights={groupWeights}
        dayWgtSaving={dayWgtSaving}
        noteOpen={noteOpen}
        onToggleNote={key => setNoteOpen(prev => ({ ...prev, [key]: !prev[key] }))}
        onChange={updateGroupField}
        onSave={saveDayGroup}
        hideNoteToggle
      />

      {/* ── Kiemelt időszakok ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Kiemelt időszakok</h2>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              Felülírják a naptípus szorzókat · Csak a hónap–nap számít (évente ismétlődnek)
            </p>
          </div>
          {!addingSeason && (
            <button onClick={() => setAddingSeason(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
              style={{ background: "#F1F5F9", color: "#334155" }}>
              <Plus size={14} /> Új időszak
            </button>
          )}
        </div>

        {addingSeason && (
          <form onSubmit={handleAddSeason} className="p-5 space-y-4"
            style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
            <SeasonFormFields f={seasonForm} setF={setSeasonForm} />
            <div className="flex gap-2">
              <button type="submit" disabled={seasonSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#7C3AED", color: "white" }}>
                {seasonSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {seasonSaving ? "Mentés..." : "Mentés"}
              </button>
              <button type="button" onClick={() => { setAddingSeason(false); setSeasonForm(emptySeasonForm()); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "white", color: "#64748B", border: "1px solid #E2E8F0" }}>
                <X size={14} /> Mégse
              </button>
            </div>
          </form>
        )}

        {seasons.length === 0 && !addingSeason && (
          <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>
            Még nincs kiemelt időszak. Adj hozzá egyet (pl. Karácsony, Húsvét, Nyári főszezon).
          </p>
        )}

        <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
          {seasons.map(s => {
            const isEditing = editSeasonId === s.id;
            return (
              <div key={s.id} className="px-5 py-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <SeasonFormFields f={editSeasonForm} setF={setEditSeasonForm} />
                    <div className="flex gap-2">
                      <button onClick={() => handleEditSeason(s.id)} disabled={editSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: "#7C3AED", color: "white" }}>
                        {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {editSaving ? "Mentés..." : "Mentés"}
                      </button>
                      <button onClick={() => setEditSeasonId(null)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                        style={{ background: "#F1F5F9", color: "#64748B" }}>
                        <X size={14} /> Mégse
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <span className="font-semibold text-sm" style={{ color: "#0F172A" }}>{s.name}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                          style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                          {formatSeasonRange(s)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {MULT_FIELDS.map(f => {
                          const val = s[f.key];
                          const isNeutral = f.key === "occMult" || f.key === "adrMult" ? val === 1 : val === 0;
                          return (
                            <span key={f.key} className="text-xs px-2 py-0.5 rounded-lg font-mono"
                              style={{
                                background: isNeutral ? "#F1F5F9" : val > (f.key === "occMult" || f.key === "adrMult" ? 1 : 0) ? "#D1FAE5" : "#FEE2E2",
                                color: isNeutral ? "#64748B" : val > (f.key === "occMult" || f.key === "adrMult" ? 1 : 0) ? "#059669" : "#DC2626",
                              }}>
                              {f.key === "occMult" ? "Kihas." : f.key === "adrMult" ? "ADR" : f.key === "fbMult" ? "F&B" : f.key === "spaMult" ? "Spa" : "Egyéb"}: ×{val.toFixed(2)}
                            </span>
                          );
                        })}
                      </div>
                      {s.note && (
                        <div className="flex items-start gap-1.5">
                          <MessageSquare size={12} style={{ color: "#7C3AED", marginTop: 2, flexShrink: 0 }} />
                          <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>{s.note}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => startEditSeason(s)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: "#F1F5F9", color: "#64748B" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteSeason(s.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: "#FEE2E2", color: "#EF4444" }}>
                        {deletingSeasonId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .mult-input {
          width: 76px; text-align: center; font-family: monospace; font-size: 13px;
          padding: 5px 6px; border: 1.5px solid #E2E8F0; border-radius: 8px;
          outline: none; background: white; color: #0F172A; box-sizing: border-box;
        }
        .mult-input:focus { border-color: #7C3AED; box-shadow: 0 0 0 2px rgba(124,58,237,0.1); }
        .sf-input {
          width: 100%; padding: 8px 10px; border: 1.5px solid #E2E8F0; border-radius: 10px;
          font-size: 13px; font-family: inherit; color: #0F172A; background: white;
          outline: none; box-sizing: border-box;
        }
        .sf-input:focus { border-color: #7C3AED; box-shadow: 0 0 0 2px rgba(124,58,237,0.1); }
        .sf-textarea {
          width: 100%; padding: 8px 10px; border: 1.5px solid #E2E8F0; border-radius: 10px;
          font-size: 13px; font-family: inherit; color: #0F172A; background: white;
          outline: none; box-sizing: border-box; resize: none; line-height: 1.5;
        }
        .sf-textarea:focus { border-color: #7C3AED; box-shadow: 0 0 0 2px rgba(124,58,237,0.1); }
        .note-textarea {
          width: 100%; padding: 8px 10px; border: 1.5px solid #DDD6FE; border-radius: 10px;
          font-size: 12px; font-family: inherit; color: #334155; background: #FAF9FF;
          outline: none; box-sizing: border-box; resize: none; line-height: 1.5;
        }
        .note-textarea:focus { border-color: #7C3AED; box-shadow: 0 0 0 2px rgba(124,58,237,0.1); background: white; }
        .wlabel { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px; }
      `}</style>
    </div>
  );
}

// ─── DayGroupTable ────────────────────────────────────────────────────────────

type ColDef = { key: keyof Mults; label: string; step: number; min: number; max: number };

function DayGroupTable({
  title, subtitle, columns, groupWeights, dayWgtSaving,
  noteOpen, onToggleNote, onChange, onSave, hideNoteToggle,
}: {
  title: string; subtitle: string; columns: ColDef[];
  groupWeights: Record<string, DayWeightRow>; dayWgtSaving: string | null;
  noteOpen: Record<string, boolean>;
  onToggleNote: (key: string) => void;
  onChange: (groupKey: string, field: keyof DayWeightRow, val: number | string) => void;
  onSave: (groupKey: string) => void;
  hideNoteToggle?: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
      <div className="px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
        <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>{title}</h2>
        <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Naptípus</th>
              {columns.map(c => (
                <th key={c.key} className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>{c.label}</th>
              ))}
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {DAY_GROUPS.map(group => {
              const w = groupWeights[group.key];
              const isSaving = dayWgtSaving === group.key;
              const isNoteOpen = noteOpen[group.key];
              const hasNote = !!w.note;
              return (
                <React.Fragment key={group.key}>
                  <tr style={{ borderBottom: isNoteOpen ? "none" : "1px solid #F8FAFC" }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "#0F172A" }}>{group.label}</span>
                        {isSaving && <Loader2 size={11} className="animate-spin" style={{ color: "#7C3AED" }} />}
                      </div>
                    </td>
                    {columns.map(c => (
                      <td key={c.key} className="px-3 py-2 text-center">
                        <input type="number" step={c.step} min={c.min} max={c.max}
                          value={w[c.key]}
                          onChange={e => onChange(group.key, c.key, Number(e.target.value))}
                          onBlur={() => onSave(group.key)}
                          className="mult-input" />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 justify-end">
                        {!hideNoteToggle && (
                          <button type="button" onClick={() => onToggleNote(group.key)}
                            title={isNoteOpen ? "Megjegyzés bezárása" : "AI megjegyzés"}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: isNoteOpen || hasNote ? "#EDE9FE" : "#F1F5F9", color: isNoteOpen || hasNote ? "#7C3AED" : "#94A3B8" }}>
                            <MessageSquare size={11} />
                            {isNoteOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                        )}
                        <button onClick={() => onSave(group.key)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: "#D1FAE5", color: "#10B981" }}>
                          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {!hideNoteToggle && isNoteOpen && (
                    <tr style={{ borderBottom: "1px solid #F8FAFC" }}>
                      <td colSpan={columns.length + 2} className="px-5 pb-3 pt-1">
                        <textarea rows={2} value={w.note ?? ""}
                          onChange={e => onChange(group.key, "note", e.target.value)}
                          onBlur={() => onSave(group.key)}
                          placeholder={`Pl.: "Péntekenként konferencia-vendégek, magasabb F&B forgalom."`}
                          className="note-textarea" />
                        <p className="text-xs mt-1" style={{ color: "#C4B5FD" }}>Mentéskor tárolódik</p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SeasonFormFields ─────────────────────────────────────────────────────────

function SeasonFormFields({ f, setF }: { f: SeasonForm; setF: (v: SeasonForm) => void }) {
  const set = (k: keyof SeasonForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-3">
      <div>
        <label className="wlabel">Megnevezés</label>
        <input required value={f.name} onChange={set("name")} placeholder="pl. Karácsonyi időszak" className="sf-input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="wlabel">Kezdő dátum</label>
          <input required type="date" value={f.dateFrom} onChange={set("dateFrom")} className="sf-input" />
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Csak a hónap–nap számít</p>
        </div>
        <div>
          <label className="wlabel">Záró dátum</label>
          <input required type="date" value={f.dateTo} onChange={set("dateTo")} className="sf-input" />
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Évente ismétlődik</p>
        </div>
      </div>
      <div className="rounded-xl p-3 space-y-2" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>Kihasználtság &amp; ADR szorzók</p>
        <div className="grid grid-cols-2 gap-3">
          {(["occMult", "adrMult"] as const).map(k => (
            <div key={k} className="text-center">
              <div className="text-xs mb-1.5" style={{ color: "#94A3B8" }}>{k === "occMult" ? "Kihas. szorzó" : "ADR szorzó"}</div>
              <input type="number" step="0.05" min="0" max="5" value={f[k]} onChange={set(k)} className="mult-input" style={{ width: "100%" }} />
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: "#94A3B8" }}>1.00 = havi átlag · 1.20 = 20%-kal magasabb</p>
      </div>
      <div className="rounded-xl p-3 space-y-2" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>F&amp;B / Spa / Egyéb bevétel arányok</p>
        <div className="grid grid-cols-3 gap-3">
          {(["fbMult", "spaMult", "otherMult"] as const).map(k => (
            <div key={k} className="text-center">
              <div className="text-xs mb-1.5" style={{ color: "#94A3B8" }}>{k === "fbMult" ? "F&B" : k === "spaMult" ? "Spa" : "Egyéb"}</div>
              <input type="number" step="0.01" min="0" max="10" value={f[k]} onChange={set(k)} className="mult-input" style={{ width: "100%" }} />
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: "#94A3B8" }}>Szobabevétel hányada · 0.20 = 20%</p>
      </div>
      <div className="rounded-xl p-3 space-y-2" style={{ background: "#FAF9FF", border: "1.5px solid #DDD6FE" }}>
        <div className="flex items-center gap-1.5">
          <MessageSquare size={13} style={{ color: "#7C3AED" }} />
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#7C3AED" }}>AI megjegyzés ehhez az időszakhoz</p>
        </div>
        <textarea rows={2} value={f.note} onChange={set("note")}
          placeholder={`Pl.: "Helyi fesztivál miatt korai foglalás jellemző, éttermi forgalom megduplázódik."`}
          className="sf-textarea" style={{ background: "white", border: "1.5px solid #DDD6FE" }} />
      </div>
    </div>
  );
}
