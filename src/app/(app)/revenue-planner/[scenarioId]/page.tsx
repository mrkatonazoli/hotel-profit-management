"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, ArrowLeft,
  Star, Loader2, TrendingUp, Bed, DollarSign,
  Sparkles, Building2, Users, ChevronDown, ChevronUp, Check, Pin,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoomType = { id: string; name: string; count: number; occShareMult?: number };

type Scenario = {
  id: string; name: string; description: string | null;
  probability: number; isBase: boolean; year: number;
  hotel: { id: string; totalRooms: number | null; baseCurrency: string; roomTypes: RoomType[] };
};

type PlanDay = {
  id: string; date: string;
  occupancyPct: number; adr: number;
  roomRevenue: number; fbRevenue: number; spaRevenue: number; otherRevenue: number;
};

type ChildAgeGroup = { id: string; name: string; minAge: number; maxAge: number };

type BoardTypeInput = {
  boardType: string;
  roomCount: number;
  adultCount: number;
  childCounts: { groupId: string; count: number }[];
};

type GuestDay = {
  date: string;
  adultCount: number;
  childCount: number;
  boardTypes: BoardTypeInput[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BOARD_TYPES = [
  { code: "RO", label: "Csak szoba", short: "RO" },
  { code: "BB", label: "Reggeli",    short: "BB" },
  { code: "HB", label: "Félpanzió",  short: "HB" },
  { code: "FB", label: "Teljes panzió", short: "FB" },
  { code: "AI", label: "All Inclusive", short: "AI" },
];

const BOARD_COLORS: Record<string, { bg: string; text: string }> = {
  RO: { bg: "#F1F5F9", text: "#64748B" },
  BB: { bg: "#DBEAFE", text: "#1D4ED8" },
  HB: { bg: "#D1FAE5", text: "#065F46" },
  FB: { bg: "#EDE9FE", text: "#5B21B6" },
  AI: { bg: "#FEF3C7", text: "#92400E" },
};

function boardColor(code: string) {
  return BOARD_COLORS[code] ?? { bg: "#F1F5F9", text: "#64748B" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HU_MONTHS = [
  "Január","Február","Március","Április","Május","Június",
  "Július","Augusztus","Szeptember","Október","November","December",
];
const HU_DAYS_SHORT = ["V","H","K","Sze","Cs","P","Szo"];

function daysOfMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(Date.UTC(year, month - 1, 1));
  while (d.getUTCMonth() === month - 1) {
    days.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function fmt(n: number) { return n.toLocaleString("hu-HU"); }

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

function scalePd(pd: PlanDay, rt: RoomType, totalRooms: number): PlanDay {
  if (totalRooms === 0) return pd;
  const occShareMult = rt.occShareMult ?? 1.0;
  const rtOccPct = Math.min(pd.occupancyPct * occShareMult, 100);
  const hotelRoomNights = Math.round(pd.occupancyPct / 100 * totalRooms);
  const rtRoomNights = Math.round(rtOccPct / 100 * rt.count);
  const revenueRatio = hotelRoomNights > 0 ? rtRoomNights / hotelRoomNights : rt.count / totalRooms;
  return {
    ...pd,
    occupancyPct: Math.round(rtOccPct * 10) / 10,
    roomRevenue:  Math.round(pd.roomRevenue  * revenueRatio),
    fbRevenue:    Math.round(pd.fbRevenue    * revenueRatio),
    spaRevenue:   Math.round(pd.spaRevenue   * revenueRatio),
    otherRevenue: Math.round(pd.otherRevenue * revenueRatio),
  };
}

// ─── Board type badge ─────────────────────────────────────────────────────────

function BoardBadge({ code }: { code: string }) {
  const c = boardColor(code);
  const bt = BOARD_TYPES.find(b => b.code === code);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold"
      style={{ background: c.bg, color: c.text }}>
      {bt?.short ?? code}
    </span>
  );
}

// ─── Board type selector ───────────────────────────────────────────────────────

function BoardSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {BOARD_TYPES.map(bt => {
        const active = value === bt.code;
        const c = boardColor(bt.code);
        return (
          <button key={bt.code}
            onClick={() => onChange(bt.code)}
            className="px-2 py-1 rounded-lg text-xs font-bold transition-all border"
            style={{
              background: active ? c.bg : "white",
              color: active ? c.text : "#94A3B8",
              borderColor: active ? c.text : "#E2E8F0",
            }}
            title={bt.label}>
            {active && <Check size={9} className="inline mr-0.5" />}
            {bt.short}
          </button>
        );
      })}
    </div>
  );
}

// ─── Number input ─────────────────────────────────────────────────────────────

function NumInput({
  value, onChange, color, placeholder,
}: { value: number; onChange: (v: number) => void; color: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value > 0 ? String(value) : ""); }, [value]);

  const commit = () => {
    const n = Math.max(0, parseInt(draft) || 0);
    setDraft(n > 0 ? String(n) : "");
    onChange(n);
  };

  return (
    <input
      ref={ref}
      type="number"
      min={0}
      value={draft}
      placeholder={placeholder ?? "0"}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") { commit(); ref.current?.blur(); } }}
      className="w-16 text-right font-mono text-sm rounded-lg px-2 py-1.5 outline-none transition-colors"
      style={{
        border: `1.5px solid #E2E8F0`,
        color,
        background: "#FAFBFF",
      }}
      onFocus={e => { e.target.style.borderColor = color; e.target.select(); }}
    />
  );
}

// ─── Guest read-only (szobatípus nézethez) ───────────────────────────────────

function GuestReadOnly({ guestDay, ageGroups }: { guestDay: GuestDay | undefined; ageGroups: ChildAgeGroup[] }) {
  if (!guestDay) return null;
  const activeBts = guestDay.boardTypes.filter(bt => bt.roomCount > 0 || bt.adultCount > 0);
  if (activeBts.length === 0) return null;

  const CHILD_COLORS = ["#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#3B82F6"];
  const totalAdults   = activeBts.reduce((s, bt) => s + bt.adultCount, 0);
  const totalChildren = activeBts.reduce((s, bt) => s + bt.childCounts.reduce((cs, c) => cs + c.count, 0), 0);
  const totalRooms    = activeBts.reduce((s, bt) => s + bt.roomCount, 0);

  return (
    <div className="px-4 py-3" style={{ background: "#FAFBFF" }}>
      <div className="overflow-x-auto">
        <table className="text-xs w-full" style={{ minWidth: ageGroups.length > 0 ? 520 : 340 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              <th className="text-left py-1.5 pr-3 font-semibold" style={{ color: "#64748B", width: 120 }}>Ellátás</th>
              <th className="text-right py-1.5 pr-3 font-semibold" style={{ color: "#64748B", width: 64 }}>Szobák</th>
              <th className="text-right py-1.5 pr-3 font-semibold" style={{ color: "#0EA5E9", width: 64 }}>Felnőtt</th>
              <th className="text-right py-1.5 pr-3 font-semibold" style={{ color: "#10B981", width: 72 }}>F/szoba</th>
              {ageGroups.map((g, i) => (
                <th key={g.id} className="text-right py-1.5 pr-3 font-semibold"
                  style={{ color: CHILD_COLORS[i % 5], width: 72 }}>{g.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeBts.map(bt => {
              const c = boardColor(bt.boardType);
              const btDef = BOARD_TYPES.find(b => b.code === bt.boardType);
              const adultsPerRoom = bt.roomCount > 0
                ? Math.round(bt.adultCount / bt.roomCount * 10) / 10
                : 0;
              return (
                <tr key={bt.boardType} style={{ borderBottom: "1px solid #F8FAFC" }}>
                  <td className="py-1.5 pr-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold"
                      style={{ background: c.bg, color: c.text }}>
                      {bt.boardType}
                    </span>
                    <span className="ml-1.5 text-xs" style={{ color: "#94A3B8" }}>
                      {btDef?.label ?? bt.boardType}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono font-semibold" style={{ color: "#475569" }}>
                    {bt.roomCount}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono font-semibold" style={{ color: "#0EA5E9" }}>
                    {bt.adultCount}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono" style={{ color: "#10B981" }}>
                    {adultsPerRoom > 0 ? `${adultsPerRoom}` : "—"}
                  </td>
                  {ageGroups.map((g, gi) => {
                    const cc = bt.childCounts.find(c => c.groupId === g.id);
                    return (
                      <td key={g.id} className="py-1.5 pr-3 text-right font-mono"
                        style={{ color: (cc?.count ?? 0) > 0 ? CHILD_COLORS[gi % 5] : "#CBD5E1" }}>
                        {(cc?.count ?? 0) > 0 ? cc!.count : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {activeBts.length > 1 && (
            <tfoot>
              <tr style={{ borderTop: "1px solid #E2E8F0" }}>
                <td className="py-1.5 pr-3 font-semibold text-xs" style={{ color: "#64748B" }}>Összesen</td>
                <td className="py-1.5 pr-3 text-right font-bold font-mono" style={{ color: "#475569" }}>{totalRooms}</td>
                <td className="py-1.5 pr-3 text-right font-bold font-mono" style={{ color: "#0EA5E9" }}>{totalAdults}</td>
                <td className="py-1.5 pr-3 text-right font-bold font-mono" style={{ color: "#10B981" }}>
                  {totalRooms > 0 ? `${Math.round(totalAdults / totalRooms * 10) / 10}` : "—"}
                </td>
                {ageGroups.map((g, gi) => {
                  const total = activeBts.reduce((s, bt) => s + (bt.childCounts.find(c => c.groupId === g.id)?.count ?? 0), 0);
                  return (
                    <td key={g.id} className="py-1.5 pr-3 text-right font-bold font-mono"
                      style={{ color: total > 0 ? CHILD_COLORS[gi % 5] : "#CBD5E1" }}>
                      {total > 0 ? total : "—"}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>
        Összesen: <span style={{ color: "#0EA5E9" }}>{totalAdults}F</span>
        {totalChildren > 0 && <span style={{ color: "#F59E0B" }}> + {totalChildren}Gy</span>}
        {totalRooms > 0 && <span style={{ color: "#10B981" }}> · {Math.round(totalAdults / totalRooms * 10) / 10} F/szoba</span>}
        {" · "}<span style={{ color: "#475569" }}>{totalRooms} szoba (hotel szintű adat)</span>
      </p>
    </div>
  );
}

// ─── Guest panel (expandable per-day form) ────────────────────────────────────
// Táblázatos forma: sorok = ellátástípusok, oszlopok = Szobák | Felnőtt | [korcsoportok]

function emptyBoardRow(boardType: string, ageGroups: ChildAgeGroup[]): BoardTypeInput {
  return {
    boardType,
    roomCount: 0,
    adultCount: 0,
    childCounts: ageGroups.map(g => ({ groupId: g.id, count: 0 })),
  };
}

function initRows(guestDay: GuestDay | undefined, ageGroups: ChildAgeGroup[]): BoardTypeInput[] {
  if (!guestDay || guestDay.boardTypes.length === 0) {
    return [emptyBoardRow("BB", ageGroups)];
  }
  // Ensure each boardType row has entries for all age groups
  return guestDay.boardTypes.map(bt => ({
    boardType: bt.boardType,
    roomCount: bt.roomCount,
    adultCount: bt.adultCount,
    childCounts: ageGroups.map(g => {
      const existing = bt.childCounts.find(c => c.groupId === g.id);
      return { groupId: g.id, count: existing?.count ?? 0 };
    }),
  }));
}

function GuestPanel({
  date,
  guestDay,
  ageGroups,
  activeBoardTypes,
  onSave,
  saving,
}: {
  date: string;
  guestDay: GuestDay | undefined;
  ageGroups: ChildAgeGroup[];
  activeBoardTypes: string[];
  onSave: (boardTypes: BoardTypeInput[]) => Promise<void>;
  saving: boolean;
}) {
  // Only the hotel-configured board types (in canonical order)
  const allowedBoardTypes = BOARD_TYPES.filter(bt =>
    activeBoardTypes.length === 0 || activeBoardTypes.includes(bt.code)
  );
  const defaultBoardType = allowedBoardTypes[0]?.code ?? "BB";

  const initRowsFiltered = (gd: GuestDay | undefined): BoardTypeInput[] => {
    if (!gd || gd.boardTypes.length === 0) return [emptyBoardRow(defaultBoardType, ageGroups)];
    // Keep only rows whose board type is still active
    const filtered = gd.boardTypes.filter(bt => allowedBoardTypes.some(a => a.code === bt.boardType));
    if (filtered.length === 0) return [emptyBoardRow(defaultBoardType, ageGroups)];
    return filtered.map(bt => ({
      boardType: bt.boardType,
      roomCount: bt.roomCount,
      adultCount: bt.adultCount,
      childCounts: ageGroups.map(g => {
        const existing = bt.childCounts.find(c => c.groupId === g.id);
        return { groupId: g.id, count: existing?.count ?? 0 };
      }),
    }));
  };

  const [rows, setRows] = useState<BoardTypeInput[]>(() => initRowsFiltered(guestDay));

  useEffect(() => {
    setRows(initRowsFiltered(guestDay));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, guestDay]);

  const usedTypes = rows.map(r => r.boardType);
  const availableToAdd = allowedBoardTypes.filter(bt => !usedTypes.includes(bt.code));

  const updateRow = (idx: number, field: "roomCount" | "adultCount", val: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const updateChild = (rowIdx: number, groupId: string, count: number) => {
    setRows(prev => prev.map((r, i) =>
      i === rowIdx
        ? { ...r, childCounts: r.childCounts.map(c => c.groupId === groupId ? { ...c, count } : c) }
        : r
    ));
  };

  const changeBoardType = (idx: number, newBt: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, boardType: newBt } : r));
  };

  const addRow = (boardType: string) => {
    setRows(prev => [...prev, emptyBoardRow(boardType, ageGroups)]);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const totalAdults   = rows.reduce((s, r) => s + r.adultCount, 0);
  const totalChildren = rows.reduce((s, r) => s + r.childCounts.reduce((cs, c) => cs + c.count, 0), 0);
  const totalRooms    = rows.reduce((s, r) => s + r.roomCount, 0);
  // Validáció: minden sorban legalább 1 felnőtt / szoba kell
  const violations = rows.filter(r => r.roomCount > 0 && r.adultCount < r.roomCount);

  const CHILD_COLORS = ["#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#3B82F6"];

  return (
    <div className="px-4 py-3 space-y-3" style={{ background: "#FAFBFF" }}>
      {violations.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
          ⚠️ Szabálysértés: {violations.map(v =>
            `${v.boardType} — ${v.roomCount} szobához minimum ${v.roomCount} felnőtt kell (most: ${v.adultCount})`
          ).join(", ")}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="text-xs w-full" style={{ minWidth: ageGroups.length > 0 ? 500 : 320 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              <th className="text-left py-1.5 pr-3 font-semibold" style={{ color: "#64748B", width: 110 }}>Ellátás</th>
              <th className="text-right py-1.5 pr-3 font-semibold" style={{ color: "#64748B", width: 72 }}>Szobák</th>
              <th className="text-right py-1.5 pr-3 font-semibold" style={{ color: "#0EA5E9", width: 72 }}>Felnőtt</th>
              <th className="text-right py-1.5 pr-3 font-semibold" style={{ color: "#10B981", width: 72 }}>F/szoba</th>
              {ageGroups.map((g, i) => (
                <th key={g.id} className="text-right py-1.5 pr-3 font-semibold" style={{ color: CHILD_COLORS[i % 5], width: 72 }}>
                  {g.name}
                </th>
              ))}
              <th style={{ width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const c = boardColor(row.boardType);
              const usedInOtherRows = rows.filter((_, i) => i !== idx).map(r => r.boardType);
              const availableForRow = allowedBoardTypes.filter(bt => !usedInOtherRows.includes(bt.code));
              const rowViolation = row.roomCount > 0 && row.adultCount < row.roomCount;
              const adultsPerRoomRow = row.roomCount > 0
                ? Math.round(row.adultCount / row.roomCount * 10) / 10
                : 0;
              return (
                <tr key={idx} style={{ borderBottom: "1px solid #F8FAFC", background: rowViolation ? "#FFF5F5" : undefined }}>
                  {/* Board type selector */}
                  <td className="py-1.5 pr-3">
                    <select
                      value={row.boardType}
                      onChange={e => changeBoardType(idx, e.target.value)}
                      className="rounded-lg px-2 py-1 text-xs font-bold outline-none"
                      style={{ background: c.bg, color: c.text, border: "none", cursor: "pointer" }}>
                      {availableForRow.map(bt => (
                        <option key={bt.code} value={bt.code}>{bt.short} — {bt.label}</option>
                      ))}
                    </select>
                  </td>
                  {/* Room count */}
                  <td className="py-1.5 pr-3 text-right">
                    <NumInput value={row.roomCount} onChange={v => updateRow(idx, "roomCount", v)} color={rowViolation ? "#DC2626" : "#475569"} />
                  </td>
                  {/* Adult count */}
                  <td className="py-1.5 pr-3 text-right">
                    <NumInput value={row.adultCount} onChange={v => updateRow(idx, "adultCount", v)} color={rowViolation ? "#DC2626" : "#0EA5E9"} />
                  </td>
                  {/* F/szoba — read-only computed */}
                  <td className="py-1.5 pr-3 text-right font-mono text-xs"
                    style={{ color: rowViolation ? "#DC2626" : "#10B981" }}>
                    {row.roomCount > 0 ? adultsPerRoomRow : "—"}
                    {rowViolation && <span className="ml-1">⚠</span>}
                  </td>
                  {/* Per-age-group child counts */}
                  {ageGroups.map((g, gi) => {
                    const cc = row.childCounts.find(c => c.groupId === g.id);
                    return (
                      <td key={g.id} className="py-1.5 pr-3 text-right">
                        <NumInput
                          value={cc?.count ?? 0}
                          onChange={v => updateChild(idx, g.id, v)}
                          color={CHILD_COLORS[gi % 5]}
                        />
                      </td>
                    );
                  })}
                  {/* Remove row */}
                  <td className="py-1.5">
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(idx)}
                        className="text-xs rounded px-1 py-0.5 hover:bg-red-100 transition-colors"
                        style={{ color: "#EF4444" }} title="Sor törlése">
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr style={{ borderTop: "1px solid #E2E8F0" }}>
                <td className="py-1.5 pr-3 font-semibold" style={{ color: "#64748B" }}>Összesen</td>
                <td className="py-1.5 pr-3 text-right font-bold font-mono" style={{ color: "#475569" }}>{totalRooms}</td>
                <td className="py-1.5 pr-3 text-right font-bold font-mono" style={{ color: violations.length > 0 ? "#DC2626" : "#0EA5E9" }}>{totalAdults}</td>
                {/* fő/szoba oszlop a tfoot-ban */}
                <td className="py-1.5 pr-3 text-right font-bold font-mono" style={{ color: violations.length > 0 ? "#DC2626" : "#10B981" }}>
                  {totalRooms > 0 ? `${Math.round(totalAdults / totalRooms * 10) / 10}` : "—"}
                </td>
                {ageGroups.map((g, gi) => {
                  const total = rows.reduce((s, r) => s + (r.childCounts.find(c => c.groupId === g.id)?.count ?? 0), 0);
                  return (
                    <td key={g.id} className="py-1.5 pr-3 text-right font-bold font-mono" style={{ color: CHILD_COLORS[gi % 5] }}>
                      {total > 0 ? total : "—"}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add row */}
      {availableToAdd.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs self-center" style={{ color: "#94A3B8" }}>+ ellátás:</span>
          {availableToAdd.map(bt => {
            const c = boardColor(bt.code);
            return (
              <button key={bt.code}
                onClick={() => addRow(bt.code)}
                className="px-2 py-0.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: c.bg, color: c.text, border: `1px solid ${c.text}30` }}
                title={bt.label}>
                {bt.short}
              </button>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid #E2E8F0" }}>
        <span className="text-xs font-semibold" style={{ color: "#64748B" }}>
          Összesen:{" "}
          <span style={{ color: "#1E293B" }}>{totalAdults + totalChildren} fő</span>
          {" · "}
          <span style={{ color: "#0EA5E9" }}>{totalAdults} F</span>
          {totalChildren > 0 && <span style={{ color: "#F59E0B" }}> + {totalChildren} Gy</span>}
          {" · "}
          <span style={{ color: "#475569" }}>{totalRooms} szoba</span>
          {totalRooms > 0 && (
            <span style={{ color: violations.length > 0 ? "#DC2626" : "#10B981" }}>
              {" · "}{Math.round(totalAdults / totalRooms * 10) / 10} F/szoba
            </span>
          )}
        </span>
        <button
          onClick={() => onSave(rows)}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: "#7C3AED", color: "white", opacity: saving ? 0.6 : 1 }}>
          {saving
            ? <><Loader2 size={11} className="animate-spin" /> Mentés…</>
            : <><Check size={11} /> Mentés</>}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlannerPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = use(params);
  const searchParams   = useSearchParams();

  // Generálás utáni rögzített / tartomány napok visszajelzése
  const pinnedFromUrl: { month: number; day: number; occPct: number }[] = (() => {
    try { return JSON.parse(decodeURIComponent(searchParams.get("pinned") ?? "[]")); }
    catch { return []; }
  })();
  const rangesFromUrl: { month: number; day: number; occPctFrom: number; occPctTo: number }[] = (() => {
    try { return JSON.parse(decodeURIComponent(searchParams.get("ranges") ?? "[]")); }
    catch { return []; }
  })();
  const HU_MONTHS_SHORT = ["jan","feb","már","ápr","máj","jún","júl","aug","sze","okt","nov","dec"];

  const [scenario, setScenario]         = useState<Scenario | null>(null);
  const [loading, setLoading]           = useState(true);
  const [month, setMonth]               = useState(1);
  const [year, setYear]                 = useState(new Date().getFullYear());
  const [activeRtId, setActiveRtId]     = useState<string | null>(null);
  const [dayMap, setDayMap]             = useState<Record<string, PlanDay>>({});
  const [guestMap, setGuestMap]         = useState<Record<string, GuestDay>>({});
  const [ageGroups, setAgeGroups]       = useState<ChildAgeGroup[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [hasData, setHasData]           = useState(false);
  const [expandedDay, setExpandedDay]     = useState<string | null>(null);
  const [savingDay, setSavingDay]         = useState<string | null>(null);
  const [activeBoardTypes, setActiveBoardTypes] = useState<string[]>([]);
  // Szobatípusonkénti vendégtérkép: roomTypeId → { date → GuestDay }
  const [rtGuestMap, setRtGuestMap]       = useState<Record<string, Record<string, GuestDay>>>({});
  const [rtGuestLoading, setRtGuestLoading] = useState(false);

  const loadMonth = useCallback(async (scId: string, y: number, m: number) => {
    setMonthLoading(true);
    const [planRes, guestRes] = await Promise.all([
      fetch(`/api/scenarios/${scId}/plan?year=${y}&month=${m}`),
      fetch(`/api/scenarios/${scId}/guests?year=${y}&month=${m}`),
    ]);
    const planDays: PlanDay[] = await planRes.json();
    const map: Record<string, PlanDay> = {};
    for (const pd of Array.isArray(planDays) ? planDays : []) {
      map[pd.date.slice(0, 10)] = pd;
    }
    setDayMap(map);
    setHasData(Array.isArray(planDays) && planDays.length > 0);

    if (guestRes.ok) {
      const guestDays: GuestDay[] = await guestRes.json();
      const gm: Record<string, GuestDay> = {};
      for (const g of Array.isArray(guestDays) ? guestDays : []) gm[g.date] = g;
      setGuestMap(gm);
    }
    setMonthLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const [scRes, rtWRes, groupsRes, btRes] = await Promise.all([
        fetch(`/api/scenarios/${scenarioId}`),
        fetch(`/api/scenarios/${scenarioId}/weighting/room-types`),
        fetch(`/api/child-age-groups`),
        fetch(`/api/hotel-board-types`),
      ]);
      const sc: Scenario = await scRes.json();
      if (!sc?.id) return;
      if (rtWRes.ok) {
        const rtWeights: { id: string; occShareMult: number }[] = await rtWRes.json();
        sc.hotel.roomTypes = sc.hotel.roomTypes.map(rt => ({
          ...rt,
          occShareMult: rtWeights.find(w => w.id === rt.id)?.occShareMult ?? 1.0,
        }));
      }
      if (groupsRes.ok) {
        const groups: ChildAgeGroup[] = await groupsRes.json();
        setAgeGroups(groups);
      }
      if (btRes.ok) {
        const bts: string[] = await btRes.json();
        setActiveBoardTypes(bts);
      }
      setScenario(sc);
      const now = new Date();
      const initMonth = sc.year === now.getFullYear() ? now.getMonth() + 1 : 1;
      setYear(sc.year);
      setMonth(initMonth);
      await loadMonth(sc.id, sc.year, initMonth);
      setLoading(false);
    }
    init();
  }, [scenarioId, loadMonth]);

  async function changeMonth(delta: number) {
    if (!scenario) return;
    const next = month + delta;
    if (next < 1 || next > 12) return;
    setMonth(next);
    setDayMap({});
    setGuestMap({});
    setRtGuestMap({});  // szobatípus adatokat is töröljük — újratöltjük menet közben
    setExpandedDay(null);
    await loadMonth(scenario.id, year, next);
    // Ha épp egy szobatípus van aktív, töltsük be annak adatait is
    if (activeRtId) {
      await loadRtGuests(scenario.id, activeRtId, year, next);
    }
  }

  // Szobatípus vendégadatainak betöltése
  const loadRtGuests = useCallback(async (scId: string, rtId: string, y: number, m: number) => {
    setRtGuestLoading(true);
    try {
      const res = await fetch(`/api/scenarios/${scId}/guests?year=${y}&month=${m}&roomTypeId=${rtId}`);
      if (!res.ok) return;
      const days: GuestDay[] = await res.json();
      const map: Record<string, GuestDay> = {};
      for (const g of days) map[g.date] = g;
      setRtGuestMap(prev => ({ ...prev, [rtId]: map }));
    } finally {
      setRtGuestLoading(false);
    }
  }, []);

  const handleSaveGuest = useCallback(async (
    date: string,
    boardTypes: BoardTypeInput[],
    roomTypeId: string,
  ) => {
    if (!scenario) return;
    setSavingDay(date);
    try {
      await fetch(`/api/scenarios/${scenario.id}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, roomTypeId, boardTypes }),
      });
      const totalAdults   = boardTypes.reduce((s, bt) => s + bt.adultCount, 0);
      const totalChildren = boardTypes.reduce((s, bt) =>
        s + bt.childCounts.reduce((cs, c) => cs + c.count, 0), 0);
      const gd: GuestDay = { date, adultCount: totalAdults, childCount: totalChildren, boardTypes };
      // Szobatípus guestMap frissítése + hotel szintű delta számítás
      setRtGuestMap(prev => {
        const prevDay     = prev[roomTypeId]?.[date];
        const deltaAdults   = totalAdults   - (prevDay?.adultCount  ?? 0);
        const deltaChildren = totalChildren - (prevDay?.childCount   ?? 0);
        // Hotel szintű összesítőt a deltával frissítjük (nem felülírjuk)
        setGuestMap(hotelPrev => {
          const hd = hotelPrev[date];
          return {
            ...hotelPrev,
            [date]: {
              date,
              adultCount:  Math.max(0, (hd?.adultCount  ?? 0) + deltaAdults),
              childCount:  Math.max(0, (hd?.childCount   ?? 0) + deltaChildren),
              boardTypes:  hd?.boardTypes ?? [],
            },
          };
        });
        return { ...prev, [roomTypeId]: { ...(prev[roomTypeId] ?? {}), [date]: gd } };
      });
      setExpandedDay(null);
    } finally {
      setSavingDay(null);
    }
  }, [scenario]);

  // ─── Derived ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );
  if (!scenario) return <p style={{ color: "#94A3B8" }}>Nem található a forgatókönyv.</p>;

  const totalRooms = scenario.hotel.totalRooms ?? 0;
  const roomTypes  = scenario.hotel.roomTypes ?? [];
  const days       = daysOfMonth(year, month);
  const pc         = probColor(scenario.probability);

  const activeRt  = activeRtId ? roomTypes.find(r => r.id === activeRtId) ?? null : null;
  const viewRooms = activeRt ? activeRt.count : totalRooms;
  const showGuests = true;
  const isHotelView = activeRtId === null;

  function getViewPd(key: string): PlanDay | undefined {
    const pd = dayMap[key];
    if (!pd) return undefined;
    if (!activeRt || totalRooms === 0) return pd;
    return scalePd(pd, activeRt, totalRooms);
  }

  let mRoomNights = 0, mRoomRev = 0, mFb = 0, mSpa = 0, mOther = 0, mOccSum = 0, mFilledDays = 0;
  let mAdults = 0, mChildren = 0;
  for (const day of days) {
    const key = day.toISOString().slice(0, 10);
    const pd  = getViewPd(key);
    if (!pd) continue;
    mRoomNights += viewRooms > 0 ? Math.round(pd.occupancyPct / 100 * viewRooms) : 0;
    mRoomRev    += pd.roomRevenue;
    mFb         += pd.fbRevenue;
    mSpa        += pd.spaRevenue;
    mOther      += pd.otherRevenue;
    mOccSum     += pd.occupancyPct;
    mFilledDays++;
    // Szobatípus nézetben a szobatípus saját vendégadatait összesítjük
    const gd = isHotelView ? guestMap[key] : (activeRtId ? rtGuestMap[activeRtId]?.[key] : undefined);
    if (gd) { mAdults += gd.adultCount; mChildren += gd.childCount; }
  }
  // Fő/szoba átlag a hónapra (összes vendég / összes szobaéj)
  const mGuestsPerRoom = mRoomNights > 0
    ? Math.round((mAdults + mChildren) / mRoomNights * 10) / 10
    : 0;
  const mAdultsPerRoom = mRoomNights > 0
    ? Math.round(mAdults / mRoomNights * 10) / 10
    : 0;
  const mAvgOcc = mFilledDays > 0 ? Math.round(mOccSum / mFilledDays * 10) / 10 : 0;
  const mAvgAdr = mRoomNights > 0 ? Math.round(mRoomRev / mRoomNights) : 0;
  const mTotal  = mRoomRev + mFb + mSpa + mOther;
  const mRevPar = viewRooms > 0 && days.length > 0
    ? Math.round(mRoomRev / (viewRooms * days.length)) : 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5" style={{ maxWidth: 1200 }}>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/revenue-planner"
          className="flex items-center gap-1.5 font-medium hover:opacity-70 transition-opacity"
          style={{ color: "#64748B" }}>
          <ArrowLeft size={15} /> Bevételtervező
        </Link>
        <span style={{ color: "#CBD5E1" }}>/</span>
        <span className="font-medium" style={{ color: "#0F172A" }}>{scenario.name}</span>
      </div>

      {/* AI rögzített / tartomány napok banner */}
      {(pinnedFromUrl.length > 0 || rangesFromUrl.length > 0) && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm"
          style={{ background: "#EDE9FE", border: "1px solid #DDD6FE" }}>
          <Pin size={15} style={{ color: "#7C3AED", marginTop: 2, flexShrink: 0 }} />
          <div className="space-y-0.5">
            {pinnedFromUrl.length > 0 && (
              <div>
                <span className="font-semibold" style={{ color: "#5B21B6" }}>Pontos napok: </span>
                <span style={{ color: "#6D28D9" }}>
                  {pinnedFromUrl.map((p, i) => (
                    <span key={i}>{i > 0 && ", "}{HU_MONTHS_SHORT[p.month - 1]}. {p.day}. ({p.occPct}%)</span>
                  ))}
                </span>
              </div>
            )}
            {rangesFromUrl.length > 0 && (
              <div>
                <span className="font-semibold" style={{ color: "#5B21B6" }}>Tartomány napok: </span>
                <span style={{ color: "#6D28D9" }}>
                  {rangesFromUrl.map((p, i) => (
                    <span key={i}>{i > 0 && ", "}{HU_MONTHS_SHORT[p.month - 1]}. {p.day}. ({p.occPctFrom}–{p.occPctTo}%)</span>
                  ))}
                </span>
              </div>
            )}
            <div className="text-xs" style={{ color: "#7C3AED", opacity: 0.7 }}>
              Az AI ezeket a napokat a szabad szöveges változók alapján rögzítette
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>{scenario.name}</h1>
            {scenario.isBase && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                <Star size={10} /> Alap
              </span>
            )}
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: pc.bg, color: pc.text }}>
              {probLabel(scenario.probability)} · {scenario.probability}%
            </span>
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#EDE9FE", color: "#7C3AED" }}>
              <Sparkles size={10} /> AI generált
            </span>
          </div>
          {scenario.description && (
            <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>{scenario.description}</p>
          )}
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} disabled={month === 1 || monthLoading}
            className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30"
            style={{ background: "#F1F5F9", color: "#334155" }}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold w-44 text-center" style={{ color: "#0F172A" }}>
            {monthLoading
              ? <Loader2 size={16} className="animate-spin inline" style={{ color: "#7C3AED" }} />
              : `${HU_MONTHS[month - 1]} ${year}`}
          </span>
          <button onClick={() => changeMonth(1)} disabled={month === 12 || monthLoading}
            className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30"
            style={{ background: "#F1F5F9", color: "#334155" }}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<DollarSign size={16} />} iconBg="#EDE9FE" iconColor="#7C3AED"
          label="Szobabevétel" value={`${fmt(mRoomRev)} Ft`} sub={`RevPAR: ${fmt(mRevPar)} Ft`} />
        <KpiCard icon={<TrendingUp size={16} />} iconBg="#D1FAE5" iconColor="#10B981"
          label="F&B + Spa + Egyéb" value={`${fmt(mFb + mSpa + mOther)} Ft`}
          sub={`Összes: ${fmt(mTotal)} Ft`} />
        <KpiCard icon={<Bed size={16} />} iconBg="#DBEAFE" iconColor="#3B82F6"
          label="Átl. kihasználtság" value={`${mAvgOcc}%`}
          sub={`${fmt(mRoomNights)} szobaéj`} />
        <KpiCard icon={<Users size={16} />} iconBg="#FEF3C7" iconColor="#F59E0B"
          label={isHotelView ? "Havi vendégek" : `Vendégek – ${activeRt?.name}`}
          value={mAdults + mChildren > 0 ? `${fmt(mAdults + mChildren)} fő` : "—"}
          sub={mAdults + mChildren > 0
            ? `${fmt(mAdults)}F · ${fmt(mChildren)}Gy · ${mAdultsPerRoom} F/szoba`
            : "Szobatípus fülön rögzíthető"} />
      </div>

      {/* No data */}
      {!hasData && !monthLoading && (
        <div className="rounded-2xl p-8 text-center"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <Sparkles size={28} className="mx-auto mb-3" style={{ color: "#F59E0B" }} />
          <p className="font-semibold mb-1" style={{ color: "#92400E" }}>
            Erre a hónapra nincs generált napi terv
          </p>
          <p className="text-sm" style={{ color: "#B45309" }}>
            Menj a Szcenáriókhoz, és nyomj <strong>AI generálás</strong> gombot a teljes év legenerálásához.
          </p>
        </div>
      )}

      {/* Table card */}
      {(hasData || monthLoading) && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>

          {/* Room type tabs */}
          <div className="flex items-center gap-0 overflow-x-auto"
            style={{ borderBottom: "1px solid #E2E8F0" }}>
            <button onClick={() => setActiveRtId(null)}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                color: activeRtId === null ? "#7C3AED" : "#64748B",
                borderBottom: activeRtId === null ? "2px solid #7C3AED" : "2px solid transparent",
                background: "none",
              }}>
              <Building2 size={13} /> Hotel összesen
              {totalRooms > 0 && <span className="text-xs ml-0.5" style={{ color: "#94A3B8" }}>{totalRooms} szoba</span>}
            </button>
            {roomTypes.map(rt => (
              <button key={rt.id} onClick={() => {
                setActiveRtId(rt.id);
                setExpandedDay(null);
                // Betöltjük a szobatípus vendégadatait, ha még nem töltöttük be
                if (scenario && !rtGuestMap[rt.id]) {
                  loadRtGuests(scenario.id, rt.id, year, month);
                }
              }}
                className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors"
                style={{
                  color: activeRtId === rt.id ? "#7C3AED" : "#64748B",
                  borderBottom: activeRtId === rt.id ? "2px solid #7C3AED" : "2px solid transparent",
                  background: "none",
                }}>
                {rt.name}
                <span className="text-xs" style={{ color: "#94A3B8" }}>{rt.count} szoba</span>
              </button>
            ))}
            <div className="ml-auto px-4 py-3 text-xs flex-shrink-0" style={{ color: "#94A3B8" }}>
              {activeRt ? `${activeRt.count} szoba · arányos bontás` : `${viewRooms} szoba összesen`}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: showGuests ? 960 : 820 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <Th left style={{ width: 80 }}>Dátum</Th>
                  <Th style={{ width: 90 }}>Kihas. %</Th>
                  <Th style={{ width: 80 }}>Szobaéj</Th>
                  <Th style={{ width: 100 }}>ADR (Ft)</Th>
                  <Th style={{ width: 120 }}>Szobabev.</Th>
                  <Th style={{ width: 100 }}>F&amp;B (Ft)</Th>
                  <Th style={{ width: 100 }}>Spa (Ft)</Th>
                  <Th style={{ width: 100 }}>Egyéb (Ft)</Th>
                  {showGuests && <Th style={{ width: 160 }}>Vendégek</Th>}
                  <Th style={{ width: 120 }}>Napi összes</Th>
                </tr>
              </thead>

              <tbody>
                {days.map((day) => {
                  const key    = day.toISOString().slice(0, 10);
                  const pd     = getViewPd(key);
                  // Szobatípus nézetben az adott szobatípus vendégadatait mutatjuk
                  const gd     = isHotelView
                    ? guestMap[key]
                    : (activeRtId ? rtGuestMap[activeRtId]?.[key] : undefined);
                  const dow    = day.getUTCDay();
                  const isWknd = dow === 0 || dow === 6;
                  const rowBg  = isWknd ? "#FDFCF5" : "white";
                  const nights = pd && viewRooms > 0 ? Math.round(pd.occupancyPct / 100 * viewRooms) : 0;
                  const total  = pd ? pd.roomRevenue + pd.fbRevenue + pd.spaRevenue + pd.otherRevenue : 0;
                  const isExpanded = expandedDay === key;
                  const hasSomeGuests = gd && (gd.adultCount > 0 || gd.childCount > 0);

                  return (
                    <>
                      <tr key={key}
                        style={{
                          background: isExpanded ? "#F5F3FF" : rowBg,
                          borderBottom: isExpanded ? "none" : "1px solid #F1F5F9",
                        }}>
                        {/* Date */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold w-6 text-center"
                              style={{ color: isWknd ? "#F59E0B" : "#CBD5E1" }}>
                              {HU_DAYS_SHORT[dow]}
                            </span>
                            <span className="font-semibold" style={{ color: "#0F172A" }}>
                              {day.getUTCDate()}.
                            </span>
                          </div>
                        </td>

                        {/* Occupancy */}
                        <td className="px-3 py-2 text-right font-mono text-sm">
                          {pd
                            ? <span style={{ color: occColor(pd.occupancyPct) }}>
                                {pd.occupancyPct.toFixed(1)}%
                              </span>
                            : <Dash />}
                        </td>

                        {/* Room nights */}
                        <td className="px-3 py-2 text-right font-mono text-sm" style={{ color: "#334155" }}>
                          {nights > 0 ? fmt(nights) : <Dash />}
                        </td>

                        {/* ADR */}
                        <td className="px-3 py-2 text-right font-mono text-sm" style={{ color: "#334155" }}>
                          {pd?.adr ? fmt(pd.adr) : <Dash />}
                        </td>

                        {/* Room revenue */}
                        <td className="px-3 py-2 text-right font-mono text-sm font-semibold"
                          style={{ color: pd?.roomRevenue ? "#0F172A" : "#E2E8F0" }}>
                          {pd?.roomRevenue ? fmt(pd.roomRevenue) : <Dash />}
                        </td>

                        {/* F&B */}
                        <td className="px-3 py-2 text-right font-mono text-sm"
                          style={{ color: pd?.fbRevenue ? "#334155" : "#E2E8F0" }}>
                          {pd?.fbRevenue ? fmt(pd.fbRevenue) : <Dash />}
                        </td>

                        {/* Spa */}
                        <td className="px-3 py-2 text-right font-mono text-sm"
                          style={{ color: pd?.spaRevenue ? "#334155" : "#E2E8F0" }}>
                          {pd?.spaRevenue ? fmt(pd.spaRevenue) : <Dash />}
                        </td>

                        {/* Other */}
                        <td className="px-3 py-2 text-right font-mono text-sm"
                          style={{ color: pd?.otherRevenue ? "#334155" : "#E2E8F0" }}>
                          {pd?.otherRevenue ? fmt(pd.otherRevenue) : <Dash />}
                        </td>

                        {/* Guests summary + toggle */}
                        {showGuests && (
                          <td className="px-3 py-2">
                            {pd ? (
                              <button
                                onClick={() => setExpandedDay(isExpanded ? null : key)}
                                className="flex items-center gap-1.5 w-full rounded-lg px-2 py-1 transition-colors hover:bg-white"
                                style={{ color: hasSomeGuests ? "#1E293B" : "#94A3B8" }}>
                                <Users size={12} style={{ color: "#0EA5E9", flexShrink: 0 }} />
                                {hasSomeGuests ? (
                                  <span className="text-xs font-semibold flex-1 text-left flex items-center gap-1">
                                    <span style={{ color: "#0EA5E9" }}>{gd.adultCount}F</span>
                                    {gd.childCount > 0 && <span style={{ color: "#F59E0B" }}>+{gd.childCount}Gy</span>}
                                  </span>
                                ) : isHotelView ? (
                                  <span className="text-xs flex-1 text-left" style={{ color: "#94A3B8" }}>összesítő nézet</span>
                                ) : (
                                  <span className="text-xs flex-1 text-left" style={{ color: "#94A3B8" }}>+ rögzít</span>
                                )}
                                {(hasSomeGuests || !isHotelView) && (isExpanded
                                  ? <ChevronUp size={12} style={{ color: "#7C3AED", flexShrink: 0 }} />
                                  : <ChevronDown size={12} style={{ color: "#94A3B8", flexShrink: 0 }} />)}
                              </button>
                            ) : <Dash />}
                          </td>
                        )}

                        {/* Total */}
                        <td className="px-3 py-2 text-right font-mono text-sm font-bold"
                          style={{ color: total > 0 ? "#7C3AED" : "#E2E8F0" }}>
                          {total > 0 ? fmt(total) : <Dash />}
                        </td>
                      </tr>

                      {/* Expanded guest panel — hotel nézetben ÉS szobatípus nézetben is szerkeszthető */}
                      {showGuests && isExpanded && pd && !isHotelView && activeRtId && (
                        <tr key={`${key}-guest`}
                          style={{ borderBottom: "1px solid #E2E8F0", background: "#F5F3FF" }}>
                          <td colSpan={10}>
                            {rtGuestLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 size={16} className="animate-spin" style={{ color: "#7C3AED" }} />
                              </div>
                            ) : (
                              <GuestPanel
                                date={key}
                                guestDay={rtGuestMap[activeRtId]?.[key]}
                                ageGroups={ageGroups}
                                activeBoardTypes={activeBoardTypes}
                                onSave={boardTypes => handleSaveGuest(key, boardTypes, activeRtId)}
                                saving={savingDay === key}
                              />
                            )}
                          </td>
                        </tr>
                      )}
                      {showGuests && isExpanded && pd && isHotelView && (
                        <tr key={`${key}-guest-hotel`}
                          style={{ borderBottom: "1px solid #E2E8F0", background: "#FFF8F0" }}>
                          <td colSpan={10}>
                            <div className="px-4 py-3 text-xs" style={{ color: "#94A3B8" }}>
                              A vendégadatokat szobatípusonként add meg — válassz egy szobatípus fület fent.
                              {hasSomeGuests && <GuestReadOnly guestDay={guestMap[key]} ageGroups={ageGroups} />}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>

              {/* Monthly footer */}
              <tfoot>
                <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                  <td className="px-3 py-3 text-xs font-bold uppercase tracking-wide"
                    style={{ color: "#64748B" }}>
                    {activeRt ? `${activeRt.name} összesen` : "Hónap összesen"}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-sm" style={{ color: "#0F172A" }}>
                    {mAvgOcc > 0 ? `${mAvgOcc}%` : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-sm" style={{ color: "#0F172A" }}>
                    {mRoomNights > 0 ? fmt(mRoomNights) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm" style={{ color: "#94A3B8" }}>
                    {mAvgAdr > 0 ? fmt(mAvgAdr) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-sm" style={{ color: "#0F172A" }}>
                    {mRoomRev > 0 ? fmt(mRoomRev) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-sm" style={{ color: "#0F172A" }}>
                    {mFb > 0 ? fmt(mFb) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-sm" style={{ color: "#0F172A" }}>
                    {mSpa > 0 ? fmt(mSpa) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-sm" style={{ color: "#0F172A" }}>
                    {mOther > 0 ? fmt(mOther) : "—"}
                  </td>
                  {showGuests && (
                    <td className="px-3 py-3 text-xs font-semibold" style={{ color: "#0F172A" }}>
                      {mAdults + mChildren > 0
                        ? <span>
                            <span style={{ color: "#0EA5E9" }}>{fmt(mAdults)}F</span>
                            {mChildren > 0 && <span style={{ color: "#F59E0B" }}> + {fmt(mChildren)}Gy</span>}
                          </span>
                        : <span style={{ color: "#94A3B8" }}>—</span>}
                    </td>
                  )}
                  <td className="px-3 py-3 text-right font-mono font-bold"
                    style={{ color: mTotal > 0 ? "#7C3AED" : "#94A3B8", fontSize: 15 }}>
                    {mTotal > 0 ? fmt(mTotal) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Th({ children, left, style }: {
  children?: React.ReactNode; left?: boolean; style?: React.CSSProperties;
}) {
  return (
    <th className={`px-3 py-3 text-xs font-semibold uppercase tracking-wide${left ? " text-left" : " text-right"}`}
      style={{ color: "#94A3B8", background: "#F8FAFC", ...style }}>
      {children}
    </th>
  );
}

function Dash() { return <span style={{ color: "#E2E8F0" }}>—</span>; }

function occColor(occ: number) {
  if (occ >= 85) return "#059669";
  if (occ >= 60) return "#0F172A";
  if (occ >= 40) return "#D97706";
  return "#EF4444";
}

function KpiCard({ icon, iconBg, iconColor, label, value, sub }: {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  label: string; value: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: iconBg, color: iconColor }}>{icon}</div>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>
          {label}
        </span>
      </div>
      <div className="text-lg font-bold font-mono" style={{ color: "#0F172A" }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{sub}</div>}
    </div>
  );
}
