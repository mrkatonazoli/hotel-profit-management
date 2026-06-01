"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  ArrowLeft, Users, Percent, ToggleLeft, ToggleRight, X, Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Distributor = { id: string; name: string; commissionPct: number; isCommission: boolean; segmentTags: string };

type ChannelEntry = { distributorId: string; month: number | null; sharePct: number };

type SegmentMonth = { month: number; sharePct: number };

type Segment = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  channelMixMode: "ANNUAL" | "MONTHLY";
  useChannelMix: boolean;
  commissionPct: number;
  monthShares: SegmentMonth[];
  channelMix: (ChannelEntry & { distributor: Distributor })[];
};

const HU_MONTHS = ["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Sze","Okt","Nov","Dec"];

const SEGMENT_COLORS = [
  "#35BD78","#10B981","#F59E0B","#3B82F6","#EF4444","#35BD78","#06B6D4","#84CC16",
];

const DEFAULT_SEGMENTS = [
  { name: "Egyéni", color: "#35BD78" },
  { name: "Corporate", color: "#3B82F6" },
  { name: "MICE", color: "#10B981" },
  { name: "Utazási iroda", color: "#F59E0B" },
];

// ─── SegNumInput — lokális draft, csak onBlur-ra ment (nincs race condition) ──

function SegNumInput({
  value, onCommit, className, step = 1,
}: { value: number; onCommit: (v: number) => void; className?: string; step?: number }) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value > 0 ? String(value) : ""); }, [value]);

  const commit = () => {
    const n = Math.max(0, Math.min(100, parseFloat(draft.replace(",", ".")) || 0));
    setDraft(n > 0 ? String(n) : "");
    onCommit(n);
  };

  return (
    <input
      ref={ref}
      type="number" min={0} max={100} step={step}
      value={draft}
      placeholder="0"
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") { commit(); ref.current?.blur(); } }}
      className={className ?? "w-20 text-center text-sm font-semibold rounded-lg px-2 py-1.5 border border-slate-200 focus:border-emerald-400 bg-white outline-none"}
    />
  );
}

// Visszafelé kompatibilis alias
function CommissionInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  return <SegNumInput value={value} onCommit={onCommit} step={0.5} />;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="flex items-center gap-1.5 flex-shrink-0">
      <span className="relative inline-flex items-center rounded-full transition-colors duration-200"
        style={{ width: 36, height: 20, background: checked ? "#35BD78" : "#CBD5E1" }}>
        <span className="absolute rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ width: 14, height: 14, transform: checked ? "translateX(18px)" : "translateX(3px)" }} />
      </span>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SegmentsPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = use(params);
  const router = useRouter();

  const [segments, setSegments] = useState<Segment[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState("");

  // Szegmens picker
  const [showPicker, setShowPicker] = useState(false);
  const [customName, setCustomName] = useState("");

  // Csatorna picker (melyik szegmensnél van nyitva)
  const [channelPickerId, setChannelPickerId] = useState<string | null>(null);
  const [newChannelForm, setNewChannelForm] = useState({ name: "", isCommission: true, commissionPct: "0" });
  const [showNewChannelForm, setShowNewChannelForm] = useState(false);
  const [channelSaving, setChannelSaving] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    async function load() {
      const [segRes, distRes, scRes] = await Promise.all([
        fetch(`/api/scenarios/${scenarioId}/segments`),
        fetch("/api/distributors"),
        fetch(`/api/scenarios/${scenarioId}`),
      ]);
      const segs = await segRes.json();
      const dists = await distRes.json();
      const sc = await scRes.json();
      setSegments(segs);
      setDistributors(dists);
      setScenarioName(sc.name ?? "");
      setLoading(false);
    }
    load();
  }, [scenarioId]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getMonthShare(seg: Segment, month: number): number {
    return seg.monthShares.find(m => m.month === month)?.sharePct ?? 0;
  }

  function getMonthTotal(month: number): number {
    return segments.reduce((sum, seg) => sum + getMonthShare(seg, month), 0);
  }

  function getChannelShare(seg: Segment, distId: string, month: number | null): number {
    return seg.channelMix.find(c => c.distributorId === distId && c.month === month)?.sharePct ?? 0;
  }

  function getChannelTotal(seg: Segment, month: number | null): number {
    const entries = seg.channelMix.filter(c => c.month === month);
    return entries.reduce((sum, c) => sum + c.sharePct, 0);
  }

  // Effective commission for a segment in a month
  function calcCommission(seg: Segment, month: number): number {
    const mode = seg.channelMixMode;
    const dists = distributors.filter(d => d.isCommission);
    return dists.reduce((sum, d) => {
      const share = getChannelShare(seg, d.id, mode === "MONTHLY" ? month : null);
      return sum + (share / 100) * d.commissionPct;
    }, 0);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  async function addSegment(template?: { name: string; color: string }) {
    setSaving("new");
    const res = await fetch(`/api/scenarios/${scenarioId}/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: template?.name ?? "Új szegmens",
        color: template?.color ?? SEGMENT_COLORS[segments.length % SEGMENT_COLORS.length],
        sortOrder: segments.length,
      }),
    });
    const seg = await res.json();
    setSegments(prev => [...prev, seg]);
    setExpanded(seg.id);
    setSaving(null);
  }

  async function deleteSegment(id: string) {
    if (!confirm("Biztosan törlöd ezt a szegmenst?")) return;
    await fetch(`/api/scenarios/${scenarioId}/segments/${id}`, { method: "DELETE" });
    setSegments(prev => prev.filter(s => s.id !== id));
    if (expanded === id) setExpanded(null);
  }

  async function updateMonthShare(seg: Segment, month: number, value: number) {
    const updated = {
      ...seg,
      monthShares: seg.monthShares.map(m => m.month === month ? { ...m, sharePct: value } : m),
    };
    setSegments(prev => prev.map(s => s.id === seg.id ? updated : s));
    setSaving(seg.id);
    await fetch(`/api/scenarios/${scenarioId}/segments/${seg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthShares: [{ month, sharePct: value }] }),
    });
    setSaving(null);
  }

  async function updateChannelShare(seg: Segment, distId: string, month: number | null, value: number) {
    const updated = {
      ...seg,
      channelMix: (() => {
        const existing = seg.channelMix.find(c => c.distributorId === distId && c.month === month);
        if (existing) return seg.channelMix.map(c => c.distributorId === distId && c.month === month ? { ...c, sharePct: value } : c);
        const dist = distributors.find(d => d.id === distId)!;
        return [...seg.channelMix, { distributorId: distId, month, sharePct: value, distributor: dist }];
      })(),
    };
    setSegments(prev => prev.map(s => s.id === seg.id ? updated : s));
    setSaving(seg.id);
    await fetch(`/api/scenarios/${scenarioId}/segments/${seg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelMix: [{ distributorId: distId, month, sharePct: value }] }),
    });
    setSaving(null);
  }

  // ── Csatorna hozzáadása szegmenshez ──────────────────────────────────────────

  async function addChannelToSegment(seg: Segment, dist: Distributor) {
    // Már benne van?
    if (seg.channelMix.some(c => c.distributorId === dist.id && c.month === null)) return;
    const updated = {
      ...seg,
      channelMix: [...seg.channelMix, { distributorId: dist.id, month: null, sharePct: 0, distributor: dist }],
    };
    setSegments(prev => prev.map(s => s.id === seg.id ? updated : s));
    await fetch(`/api/scenarios/${scenarioId}/segments/${seg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelMix: [{ distributorId: dist.id, month: null, sharePct: 0 }] }),
    });
    setChannelPickerId(null);
  }

  async function removeChannelFromSegment(seg: Segment, distId: string, month: number | null) {
    const updated = {
      ...seg,
      channelMix: seg.channelMix.filter(c => !(c.distributorId === distId && c.month === month)),
    };
    setSegments(prev => prev.map(s => s.id === seg.id ? updated : s));
    await fetch(`/api/scenarios/${scenarioId}/segments/${seg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeChannels: [{ distributorId: distId, month }] }),
    });
  }

  async function createAndAddChannel(seg: Segment) {
    const name = newChannelForm.name.trim();
    if (!name) return;
    setChannelSaving(seg.id);
    // 1. Csatorna létrehozása hotel szinten
    const res = await fetch("/api/distributors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        isCommission: newChannelForm.isCommission,
        commissionPct: Number(newChannelForm.commissionPct) || 0,
        sortOrder: distributors.length,
      }),
    });
    const dist: Distributor = await res.json();
    setDistributors(prev => [...prev, dist]);
    // 2. Szegmenshez hozzáadás
    await addChannelToSegment(seg, dist);
    setNewChannelForm({ name: "", isCommission: true, commissionPct: "0" });
    setShowNewChannelForm(false);
    setChannelSaving(null);
  }

  async function toggleChannelMixMode(seg: Segment) {
    const newMode = seg.channelMixMode === "ANNUAL" ? "MONTHLY" : "ANNUAL";
    setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, channelMixMode: newMode } : s));
    await fetch(`/api/scenarios/${scenarioId}/segments/${seg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelMixMode: newMode }),
    });
  }

  async function updateName(seg: Segment, name: string) {
    setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, name } : s));
    await fetch(`/api/scenarios/${scenarioId}/segments/${seg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function toggleUseChannelMix(seg: Segment) {
    const newVal = !seg.useChannelMix;
    setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, useChannelMix: newVal } : s));
    await fetch(`/api/scenarios/${scenarioId}/segments/${seg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useChannelMix: newVal }),
    });
  }

  async function updateCommissionPct(seg: Segment, value: number) {
    setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, commissionPct: value } : s));
    setSaving(seg.id);
    await fetch(`/api/scenarios/${scenarioId}/segments/${seg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionPct: value }),
    });
    setSaving(null);
  }

  function effectiveCommission(seg: Segment, month: number): number {
    if (seg.useChannelMix) return calcCommission(seg, month);
    return seg.commissionPct;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Szegmensek</h1>
          <p className="text-sm text-slate-500 mt-0.5">{scenarioName} · Havi vendégszegmens arányok és csatorna mix</p>
        </div>
      </div>

      {/* Quick add default segments if empty */}
      {segments.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Users size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 text-sm mb-5">Még nincsenek szegmensek. Adj hozzá egyet!</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {DEFAULT_SEGMENTS.map(s => (
              <button key={s.name} onClick={() => addSegment(s)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: s.color }}>
                + {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Segments */}
      {segments.map(seg => {
        const isExp = expanded === seg.id;
        const hasChannelMix = distributors.length > 0;

        return (
          <div key={seg.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Segment header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: seg.color }} />
              <input
                className="flex-1 font-semibold text-slate-800 bg-transparent border-none outline-none text-sm"
                value={seg.name}
                onChange={e => updateName(seg, e.target.value)}
                onBlur={e => updateName(seg, e.target.value)}
              />
              {saving === seg.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
              <button onClick={() => deleteSegment(seg.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                <Trash2 size={15} />
              </button>
              <button onClick={() => setExpanded(isExp ? null : seg.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors">
                {isExp ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {/* Monthly share grid */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Havi arány (%)</p>
              <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                {HU_MONTHS.map((label, i) => {
                  const month = i + 1;
                  const val = getMonthShare(seg, month);
                  const total = getMonthTotal(month);
                  const over = total > 100.05;
                  return (
                    <div key={month} className="flex flex-col gap-1">
                      <span className="text-xs text-slate-400 text-center">{label}</span>
                      <SegNumInput
                        value={val}
                        onCommit={v => updateMonthShare(seg, month, v)}
                        className={`w-full text-center text-sm font-semibold rounded-lg px-1 py-1.5 border outline-none transition-colors ${
                          over ? "border-red-300 bg-red-50 text-red-600" : "border-slate-200 focus:border-emerald-400 bg-slate-50"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Monthly totals */}
              <div className="grid grid-cols-6 md:grid-cols-12 gap-2 mt-1">
                {HU_MONTHS.map((_, i) => {
                  const month = i + 1;
                  const total = getMonthTotal(month);
                  const ok = Math.abs(total - 100) < 0.5;
                  const over = total > 100.05;
                  return (
                    <div key={month} className={`text-center text-xs font-bold ${
                      ok ? "text-emerald-500" : over ? "text-red-500" : "text-slate-300"
                    }`}>
                      {total > 0 ? `${Math.round(total)}%` : ""}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Commission config (expanded) */}
            {isExp && (
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Jutalék beállítás</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {seg.useChannelMix ? "Csatorna mix alapján számolva (automatikus)" : "Fix jutalék % — manuálisan megadva"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={seg.useChannelMix ? "text-slate-400" : "font-semibold text-slate-700"}>Fix %</span>
                    <Toggle checked={seg.useChannelMix} onChange={() => toggleUseChannelMix(seg)} />
                    <span className={seg.useChannelMix ? "font-semibold text-emerald-600" : "text-slate-400"}>Csatorna mix</span>
                  </div>
                </div>
                {!seg.useChannelMix && (
                  <div className="flex items-center gap-3 mt-3">
                    <label className="text-sm text-slate-600">Fix jutalék:</label>
                    <CommissionInput
                      value={seg.commissionPct}
                      onCommit={v => updateCommissionPct(seg, v)}
                    />
                    <span className="text-sm text-slate-400">%</span>
                    {seg.commissionPct > 0 && (
                      <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                        {seg.commissionPct}% jutalék
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Channel mix (expanded) */}
            {isExp && hasChannelMix && seg.useChannelMix && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Csatorna mix (% a szegmensen belül)
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Éves</span>
                    <Toggle
                      checked={seg.channelMixMode === "MONTHLY"}
                      onChange={() => toggleChannelMixMode(seg)}
                    />
                    <span>Havi</span>
                  </div>
                </div>

                {(() => {
                  // Csak az ehhez a szegmenshez hozzáadott csatornák
                  const addedChannelIds = new Set(
                    seg.channelMix.filter(c => c.month === null || seg.channelMixMode === "MONTHLY").map(c => c.distributorId)
                  );
                  const addedDistributors = distributors.filter(d => addedChannelIds.has(d.id));
                  // Még nem hozzáadott globális csatornák (a pickerhez)
                  const availableDistributors = distributors.filter(d => !addedChannelIds.has(d.id));
                  const isPickerOpen = channelPickerId === seg.id;

                  return (
                    <div className="space-y-4">

                      {/* Csatornák listája */}
                      {seg.channelMixMode === "ANNUAL" ? (
                        <div className="space-y-2">
                          {addedDistributors.length === 0 && (
                            <p className="text-sm text-slate-400 italic py-2">
                              Még nincs csatorna hozzáadva ehhez a szegmenshez.
                            </p>
                          )}
                          {addedDistributors.map(dist => {
                            const share = getChannelShare(seg, dist.id, null);
                            const total = getChannelTotal(seg, null);
                            const over = total > 100.05;
                            return (
                              <div key={dist.id} className="flex items-center gap-3">
                                <span className="text-sm text-slate-600 w-36 truncate">{dist.name}</span>
                                <SegNumInput
                                  value={share}
                                  onCommit={v => updateChannelShare(seg, dist.id, null, v)}
                                  className={`w-20 text-center text-sm font-semibold rounded-lg px-2 py-1.5 border outline-none transition-colors ${
                                    over ? "border-red-300 bg-red-50 text-red-600" : "border-slate-200 focus:border-emerald-400 bg-slate-50"
                                  }`}
                                />
                                <span className="text-xs text-slate-400">%</span>
                                {dist.isCommission && dist.commissionPct > 0 && (
                                  <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                                    {dist.commissionPct}% jutalék
                                  </span>
                                )}
                                <button
                                  onClick={() => removeChannelFromSegment(seg, dist.id, null)}
                                  className="ml-auto text-slate-300 hover:text-red-400 transition-colors"
                                  title="Eltávolítás ebből a szegmensből">
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })}

                          {/* Összesen */}
                          {addedDistributors.length > 0 && (
                            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                              <span className="text-xs font-semibold text-slate-400 w-36">Összesen</span>
                              <span className={`text-sm font-bold w-20 text-center ${
                                Math.abs(getChannelTotal(seg, null) - 100) < 0.5 ? "text-emerald-600" :
                                getChannelTotal(seg, null) > 100 ? "text-red-500" : "text-slate-400"
                              }`}>{Math.round(getChannelTotal(seg, null))}%</span>
                              <span className="text-xs text-slate-400 ml-4">
                                Átlag jutalék: <strong className="text-amber-600">{calcCommission(seg, 1).toFixed(1)}%</strong>
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Havi csatorna mix
                        <div className="overflow-x-auto">
                          {addedDistributors.length === 0 && (
                            <p className="text-sm text-slate-400 italic py-2">
                              Még nincs csatorna hozzáadva ehhez a szegmenshez.
                            </p>
                          )}
                          {addedDistributors.length > 0 && (
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  <th className="text-left text-slate-400 font-semibold pb-2 pr-3 w-32">Csatorna</th>
                                  {HU_MONTHS.map(m => (
                                    <th key={m} className="text-center text-slate-400 font-semibold pb-2 px-1">{m}</th>
                                  ))}
                                  <th className="w-6" />
                                </tr>
                              </thead>
                              <tbody>
                                {addedDistributors.map(dist => (
                                  <tr key={dist.id}>
                                    <td className="pr-3 py-1">
                                      <div className="text-slate-600 font-medium truncate max-w-[120px]">{dist.name}</div>
                                      {dist.isCommission && dist.commissionPct > 0 && (
                                        <div className="text-amber-500 text-xs">{dist.commissionPct}%</div>
                                      )}
                                    </td>
                                    {HU_MONTHS.map((_, i) => {
                                      const month = i + 1;
                                      const share = getChannelShare(seg, dist.id, month);
                                      const total = getChannelTotal(seg, month);
                                      const over = total > 100.05;
                                      return (
                                        <td key={month} className="px-1 py-1">
                                          <SegNumInput
                                            value={share}
                                            onCommit={v => updateChannelShare(seg, dist.id, month, v)}
                                            className={`w-12 text-center font-semibold rounded px-1 py-1 border outline-none transition-colors ${
                                              over ? "border-red-200 bg-red-50 text-red-600" : "border-slate-200 focus:border-emerald-400 bg-slate-50"
                                            }`}
                                          />
                                        </td>
                                      );
                                    })}
                                    <td className="pl-1">
                                      <button onClick={() => removeChannelFromSegment(seg, dist.id, null)}
                                        className="text-slate-300 hover:text-red-400 transition-colors" title="Eltávolítás">
                                        <X size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-t border-slate-100">
                                  <td className="pr-3 py-1 text-slate-400 font-semibold">Összesen</td>
                                  {HU_MONTHS.map((_, i) => {
                                    const month = i + 1;
                                    const total = getChannelTotal(seg, month);
                                    const ok = Math.abs(total - 100) < 0.5;
                                    return (
                                      <td key={month} className={`px-1 py-1 text-center font-bold ${
                                        ok ? "text-emerald-600" : total > 100 ? "text-red-500" : "text-slate-300"
                                      }`}>
                                        {total > 0 ? `${Math.round(total)}%` : "—"}
                                      </td>
                                    );
                                  })}
                                  <td />
                                </tr>
                                <tr>
                                  <td className="pr-3 py-1 text-amber-600 font-semibold">Jutalék</td>
                                  {HU_MONTHS.map((_, i) => {
                                    const month = i + 1;
                                    const comm = calcCommission(seg, month);
                                    return (
                                      <td key={month} className="px-1 py-1 text-center text-amber-600 font-semibold">
                                        {comm > 0 ? `${comm.toFixed(1)}%` : "—"}
                                      </td>
                                    );
                                  })}
                                  <td />
                                </tr>
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}

                      {/* Csatorna hozzáadása gomb / picker */}
                      {!isPickerOpen ? (
                        <button
                          onClick={() => { setChannelPickerId(seg.id); setShowNewChannelForm(false); setNewChannelForm({ name: "", isCommission: true, commissionPct: "0" }); }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 hover:text-emerald-700 transition-colors"
                        >
                          <Plus size={13} /> Csatorna hozzáadása
                        </button>
                      ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-600">Melyik csatornát adod hozzá?</p>
                            <button onClick={() => { setChannelPickerId(null); setShowNewChannelForm(false); }}
                              className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                          </div>

                          {/* Meglévő globális csatornák — szegmens tag alapján szűrve */}
                          {(() => {
                            const recommended = availableDistributors.filter(d => {
                              if (!d.segmentTags || d.segmentTags.trim() === "") return true; // untagged = mindenhol
                              return d.segmentTags.split(",").some(t => t.trim().toLowerCase() === seg.name.toLowerCase());
                            });
                            const others = availableDistributors.filter(d => {
                              if (!d.segmentTags || d.segmentTags.trim() === "") return false;
                              return !d.segmentTags.split(",").some(t => t.trim().toLowerCase() === seg.name.toLowerCase());
                            });

                            const renderBtn = (d: Distributor) => (
                              <button key={d.id}
                                onClick={() => addChannelToSegment(seg, d)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                                style={{ color: "#334155" }}>
                                <Plus size={11} /> {d.name}
                                {d.isCommission && d.commissionPct > 0 && (
                                  <span className="text-amber-500 font-normal">({d.commissionPct}%)</span>
                                )}
                              </button>
                            );

                            return (
                              <>
                                {recommended.length > 0 && (
                                  <div>
                                    <p className="text-xs text-slate-400 mb-2">
                                      Ehhez a szegmenshez ajánlott:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {recommended.map(renderBtn)}
                                    </div>
                                  </div>
                                )}
                                {others.length > 0 && (
                                  <div>
                                    <p className="text-xs text-slate-300 mb-2">Egyéb csatornák:</p>
                                    <div className="flex flex-wrap gap-1.5 opacity-70">
                                      {others.map(renderBtn)}
                                    </div>
                                  </div>
                                )}
                                {availableDistributors.length === 0 && (
                                  <p className="text-xs text-slate-400 italic">Nincs több elérhető csatorna.</p>
                                )}
                              </>
                            );
                          })()}

                          {/* Új csatorna */}
                          {!showNewChannelForm ? (
                            <button
                              onClick={() => setShowNewChannelForm(true)}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                              <Plus size={12} /> Új csatorna létrehozása
                            </button>
                          ) : (
                            <div className="space-y-2 pt-1 border-t border-emerald-200">
                              <p className="text-xs font-semibold text-slate-500">Új csatorna:</p>
                              <div className="flex gap-2 flex-wrap">
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Csatorna neve (pl. MICE Agency)"
                                  value={newChannelForm.name}
                                  onChange={e => setNewChannelForm(f => ({ ...f, name: e.target.value }))}
                                  className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-emerald-400"
                                />
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                  <input type="checkbox"
                                    checked={newChannelForm.isCommission}
                                    onChange={e => setNewChannelForm(f => ({ ...f, isCommission: e.target.checked }))}
                                    className="rounded" />
                                  Jutalékos
                                </label>
                                {newChannelForm.isCommission && (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" min={0} max={100} step={0.5}
                                      value={newChannelForm.commissionPct}
                                      onChange={e => setNewChannelForm(f => ({ ...f, commissionPct: e.target.value }))}
                                      className="w-16 text-center px-2 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-emerald-400"
                                    />
                                    <span className="text-xs text-slate-400">% jut.</span>
                                  </div>
                                )}
                                <button
                                  onClick={() => createAndAddChannel(seg)}
                                  disabled={!newChannelForm.name.trim() || channelSaving === seg.id}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                                  style={{ background: "#35BD78" }}>
                                  {channelSaving === seg.id ? <Loader2 size={12} className="animate-spin" /> : "Hozzáadás"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {!isExp && (
              <div className="px-5 pb-3 flex items-center gap-4 text-xs text-slate-400">
                <span>Jutalék: <strong className="text-amber-600">{effectiveCommission(seg, 6).toFixed(1)}%</strong></span>
                <span>{seg.useChannelMix ? `Csatorna mix (${seg.channelMixMode === "MONTHLY" ? "havi" : "éves"})` : "Fix jutalék"}</span>
                <button onClick={() => setExpanded(seg.id)} className="text-emerald-500 hover:text-emerald-700 font-semibold">
                  Beállítás →
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add segment — picker */}
      {segments.length > 0 && (
        <div className="relative">
          {!showPicker ? (
            <button
              onClick={() => { setShowPicker(true); setCustomName(""); }}
              disabled={saving === "new"}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
            >
              {saving === "new" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Új szegmens hozzáadása
            </button>
          ) : (
            <div className="rounded-2xl border-2 border-emerald-200 bg-white shadow-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Melyik szegmenst adod hozzá?</p>
                <button onClick={() => setShowPicker(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Előre definiált szegmensek — kiszűrve a már meglévőket */}
              {(() => {
                const existingNames = new Set(segments.map(s => s.name.toLowerCase()));
                const available = DEFAULT_SEGMENTS.filter(d => !existingNames.has(d.name.toLowerCase()));
                return available.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Szokásos szegmensek</p>
                    <div className="flex flex-wrap gap-2">
                      {available.map(s => (
                        <button key={s.name}
                          onClick={async () => { setShowPicker(false); await addSegment(s); }}
                          disabled={saving === "new"}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ background: s.color }}>
                          <Plus size={13} /> {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Minden szokásos szegmens már hozzá van adva.</p>
                );
              })()}

              {/* Egyéni szegmens */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Vagy egyéni névvel</p>
                <form
                  onSubmit={async e => {
                    e.preventDefault();
                    const name = customName.trim();
                    if (!name) return;
                    setShowPicker(false);
                    await addSegment({
                      name,
                      color: SEGMENT_COLORS[segments.length % SEGMENT_COLORS.length],
                    });
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="pl. Kormányzati, Long-stay, …"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-400"
                  />
                  <button
                    type="submit"
                    disabled={!customName.trim() || saving === "new"}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                    style={{ background: "#35BD78" }}>
                    Hozzáadás
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary — éves átlag */}
      {segments.length > 0 && (
        <div className="bg-slate-800 rounded-2xl p-5 text-white">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Éves átlag összefoglaló</p>
          <div className="flex flex-wrap gap-4">
            {segments.map(seg => {
              const avgShare = Math.round(seg.monthShares.reduce((s, m) => s + m.sharePct, 0) / 12);
              const avgComm = effectiveCommission(seg, new Date().getMonth() + 1);
              return (
                <div key={seg.id} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
                  <span className="text-sm font-semibold">{seg.name}</span>
                  <span className="text-slate-400 text-sm">{avgShare}%</span>
                  {avgComm > 0 && (
                    <span className="text-amber-400 text-xs">({avgComm.toFixed(1)}% jut.)</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-6">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
              const total = segments.reduce((s, sg) => s + getMonthShare(sg, month), 0);
              const ok = Math.abs(total - 100) < 0.5;
              return (
                <div key={month} className="text-center">
                  <div className="text-xs text-slate-500">{HU_MONTHS[month - 1]}</div>
                  <div className={`text-xs font-bold ${ok ? "text-emerald-400" : total > 0 ? "text-red-400" : "text-slate-600"}`}>
                    {total > 0 ? `${Math.round(total)}%` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
