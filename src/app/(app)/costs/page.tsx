"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Loader2,
  DollarSign, Users, TrendingDown, Utensils, Globe,
  Check, X, Pencil,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CostType = "FIXED" | "VARIABLE";
type CostNature = "RECURRING" | "ONE_TIME";
type RecurringFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
type AmountType = "FIXED_AMOUNT" | "PERCENTAGE";
type PercentageBase = "TOTAL_REVENUE" | "ROOM_REVENUE" | "PER_ROOM_NIGHT";
type StaffRule = {
  id: string;
  occupancyFrom: number;
  occupancyTo: number | null;
  extraStaffCount: number;
  dailyRate: number;
};

type Cost = {
  id: string;
  name: string;
  type: CostType;
  nature: CostNature;
  recurringFrequency: RecurringFrequency;
  recurringStartDate: string | null;
  amountType: AmountType;
  amount: number | null;
  percentage: number | null;
  percentageBase: PercentageBase;
  currency: string;
  isStaff: boolean;
  note: string | null;
  staffRules: StaffRule[];
};

type HotelChildGroup = {
  id: string;
  name: string;
  minAge: number;
  maxAge: number;
};

type LabChildAmount = {
  id: string;
  childAgeGroupId: string;
  groupName: string;
  minAge: number;
  maxAge: number;
  amount: number;
};

type LabSetting = {
  id: string;
  validFrom: string;
  validTo: string;
  adultAmount: number;
  currency: string;
  childAmounts: LabChildAmount[];
};

type LabBoardType = {
  boardType: string;
  hotelBoardTypeId: string;
  labSettings: LabSetting[];
};

type Distributor = {
  id: string;
  name: string;
  isCommission: boolean;
  commissionPct: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "fixed",  label: "Fix kiadások",  icon: DollarSign },
  { key: "staff",  label: "Bérek",         icon: Users },
  { key: "var",    label: "Változó",        icon: TrendingDown },
  { key: "lab",    label: "LAB",            icon: Utensils },
  { key: "dist",   label: "Közvetítők",    icon: Globe },
] as const;
type Tab = typeof TABS[number]["key"];

const NATURE_LABELS: Record<CostNature, string> = {
  RECURRING: "Ismétlődő",
  ONE_TIME:  "Egyszeri",
};

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  DAILY:       "Napi",
  WEEKLY:      "Heti",
  MONTHLY:     "Havi",
  QUARTERLY:   "Negyedéves",
  SEMI_ANNUAL: "Féléves",
  ANNUAL:      "Éves",
};

const BOARD_META: Record<string, { label: string; bg: string; text: string }> = {
  RO: { label: "Csak szoba",      bg: "#F1F5F9", text: "#64748B" },
  BB: { label: "Reggeli",         bg: "#DBEAFE", text: "#1D4ED8" },
  HB: { label: "Félpanzió",       bg: "#D1FAE5", text: "#065F46" },
  FB: { label: "Teljes panzió",   bg: "rgba(53,189,120,0.12)", text: "#03915A" },
  AI: { label: "All Inclusive",   bg: "#FEF3C7", text: "#92400E" },
};
const PCT_BASE_LABELS: Record<PercentageBase, string> = {
  TOTAL_REVENUE:   "Teljes bevétel %",
  ROOM_REVENUE:    "Szobabevétel %",
  PER_ROOM_NIGHT:  "Ft / szobaéj",
};

function fmt(n: number) { return n.toLocaleString("hu-HU"); }
function fmtDate(s: string) { return s.slice(0, 10); }

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function Btn({
  children, onClick, variant = "primary", size = "sm", disabled, loading, danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "xs";
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
}) {
  const base = "inline-flex items-center gap-1.5 font-semibold rounded-xl transition-all cursor-pointer border-0";
  const sz = size === "xs" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  let style: React.CSSProperties = {};
  if (danger) {
    style = variant === "ghost"
      ? { color: "#EF4444", background: "transparent" }
      : { background: "#FEE2E2", color: "#DC2626" };
  } else if (variant === "primary") {
    style = { background: "#35BD78", color: "white" };
  } else if (variant === "ghost") {
    style = { color: "#64748B", background: "transparent" };
  } else {
    style = { background: "#F1F5F9", color: "#334155" };
  }
  if (disabled || loading) style.opacity = 0.5;

  return (
    <button className={`${base} ${sz}`} style={style}
      onClick={onClick} disabled={disabled || loading}>
      {loading && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = "text", className = "" }: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={`px-3 py-2 rounded-xl text-sm border-0 outline-none focus:ring-2 ${className}`}
      style={{ background: "#F8FAFC", color: "#0F172A", boxSizing: "border-box" }}
    />
  );
}

function Select({ value, onChange, children, className = "" }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; className?: string;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-3 py-2 rounded-xl text-sm border-0 outline-none cursor-pointer ${className}`}
      style={{ background: "#F8FAFC", color: "#0F172A" }}>
      {children}
    </select>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: "white", border: "1px solid #E2E8F0" }}>
      {children}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={99} className="text-center py-10 text-sm" style={{ color: "#94A3B8" }}>
        {label}
      </td>
    </tr>
  );
}

// ─── Fix kiadások tab ─────────────────────────────────────────────────────────

type FixForm = {
  name: string; nature: CostNature;
  recurringFrequency: RecurringFrequency; recurringStartDate: string;
  amountType: AmountType; amount: string; percentage: string;
  percentageBase: PercentageBase; currency: string; note: string;
};

const EMPTY_FIX: FixForm = {
  name: "", nature: "RECURRING",
  recurringFrequency: "MONTHLY", recurringStartDate: "",
  amountType: "FIXED_AMOUNT", amount: "", percentage: "",
  percentageBase: "TOTAL_REVENUE", currency: "HUF", note: "",
};

function FixTab({ costs, reload }: { costs: Cost[]; reload: () => void }) {
  const fixCosts = costs.filter(c => c.type === "FIXED" && !c.isStaff);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FixForm>(EMPTY_FIX);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FixForm>(EMPTY_FIX);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function setF(k: keyof FixForm, v: string) { setForm(p => ({ ...p, [k]: v })); }
  function setEF(k: keyof FixForm, v: string) { setEditForm(p => ({ ...p, [k]: v })); }

  function formPayload(f: FixForm, extra?: object) {
    return {
      name: f.name, type: "FIXED", nature: f.nature, isStaff: false,
      recurringFrequency: f.nature === "RECURRING" ? f.recurringFrequency : undefined,
      recurringStartDate: f.nature === "RECURRING" && f.recurringStartDate ? f.recurringStartDate : null,
      amountType: f.amountType, currency: f.currency, note: f.note || null,
      amount: f.amountType === "FIXED_AMOUNT" ? Number(f.amount) : null,
      percentage: f.amountType === "PERCENTAGE" ? Number(f.percentage) : null,
      percentageBase: f.amountType === "PERCENTAGE" ? f.percentageBase : undefined,
      ...extra,
    };
  }

  async function handleAdd() {
    setSaving(true);
    await fetch("/api/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formPayload(form)),
    });
    setAdding(false); setForm(EMPTY_FIX); setSaving(false);
    reload();
  }

  async function handleEdit(id: string) {
    setSaving(true);
    await fetch(`/api/costs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formPayload(editForm)),
    });
    setEditId(null); setSaving(false); reload();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/costs/${id}`, { method: "DELETE" });
    setDeletingId(null); reload();
  }

  function startEdit(c: Cost) {
    setEditId(c.id);
    setEditForm({
      name: c.name, nature: c.nature,
      recurringFrequency: c.recurringFrequency ?? "MONTHLY",
      recurringStartDate: c.recurringStartDate ? c.recurringStartDate.slice(0, 10) : "",
      amountType: c.amountType,
      amount: c.amount?.toString() ?? "", percentage: c.percentage?.toString() ?? "",
      percentageBase: c.percentageBase, currency: c.currency, note: c.note ?? "",
    });
  }

  function AmountFields({ f, setF2 }: { f: FixForm; setF2: (k: keyof FixForm, v: string) => void }) {
    return (
      <div className="flex gap-2">
        <Select value={f.amountType} onChange={v => setF2("amountType", v)} className="w-36">
          <option value="FIXED_AMOUNT">Fix összeg</option>
          <option value="PERCENTAGE">Arány</option>
        </Select>
        {f.amountType === "FIXED_AMOUNT" ? (
          <div className="flex gap-1.5">
            <Input value={f.amount} onChange={v => setF2("amount", v)} placeholder="0" type="number" className="w-32" />
            <Select value={f.currency} onChange={v => setF2("currency", v)} className="w-20">
              <option>HUF</option><option>EUR</option><option>USD</option>
            </Select>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <Input value={f.percentage} onChange={v => setF2("percentage", v)} placeholder="0.0" type="number" className="w-20" />
            <span className="self-center text-sm" style={{ color: "#64748B" }}>%</span>
            <Select value={f.percentageBase} onChange={v => setF2("percentageBase", v)} className="w-44">
              {(Object.keys(PCT_BASE_LABELS) as PercentageBase[]).map(k => (
                <option key={k} value={k}>{PCT_BASE_LABELS[k]}</option>
              ))}
            </Select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: "#64748B" }}>
          Bérleti díj, biztosítás, szoftverlicencek, rezsi és egyéb állandó kiadások.
        </p>
        <Btn onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={14} /> Hozzáadás
        </Btn>
      </div>

      <Card>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Megnevezés", "Összeg / Arány", "Típus", "Ismétlődés", "Megjegyzés", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#94A3B8" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fixCosts.length === 0 && !adding && <EmptyRow label="Nincs rögzített fix kiadás" />}
            {fixCosts.map(c => (
              editId === c.id ? (
                <tr key={c.id} style={{ background: "#FBFBFC", borderBottom: "1px solid #E2E8F0" }}>
                  <td className="px-4 py-2">
                    <Input value={editForm.name} onChange={v => setEF("name", v)} placeholder="Megnevezés" className="w-full" />
                  </td>
                  <td className="px-4 py-2">
                    <AmountFields f={editForm} setF2={setEF} />
                  </td>
                  <td className="px-4 py-2">
                    <Select value={editForm.nature} onChange={v => setEF("nature", v)}>
                      <option value="RECURRING">Ismétlődő</option>
                      <option value="ONE_TIME">Egyszeri</option>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    {editForm.nature === "RECURRING" ? (
                      <div className="flex flex-col gap-1.5">
                        <Select value={editForm.recurringFrequency} onChange={v => setEF("recurringFrequency", v)} className="w-36">
                          {(Object.keys(FREQ_LABELS) as RecurringFrequency[]).map(k => (
                            <option key={k} value={k}>{FREQ_LABELS[k]}</option>
                          ))}
                        </Select>
                        <Input value={editForm.recurringStartDate} onChange={v => setEF("recurringStartDate", v)}
                          type="date" placeholder="Kezdeti dátum" className="w-36" />
                      </div>
                    ) : <span className="text-xs" style={{ color: "#94A3B8" }}>—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <Input value={editForm.note} onChange={v => setEF("note", v)} placeholder="Megjegyzés" className="w-full" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <Btn onClick={() => handleEdit(c.id)} loading={saving} size="xs">
                        <Check size={12} />
                      </Btn>
                      <Btn onClick={() => setEditId(null)} variant="ghost" size="xs">
                        <X size={12} />
                      </Btn>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} style={{ borderBottom: "1px solid #F8FAFC" }}
                  className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium" style={{ color: "#0F172A" }}>{c.name}</td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {c.amountType === "FIXED_AMOUNT"
                      ? <span style={{ color: "#35BD78" }}>{fmt(c.amount ?? 0)} {c.currency}</span>
                      : <span style={{ color: "#35BD78" }}>{c.percentage}% · {PCT_BASE_LABELS[c.percentageBase]}</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: c.nature === "RECURRING" ? "rgba(53,189,120,0.12)" : "#FEF3C7",
                        color: c.nature === "RECURRING" ? "#35BD78" : "#D97706",
                      }}>
                      {NATURE_LABELS[c.nature]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.nature === "RECURRING" ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold" style={{ color: "#0F172A" }}>
                          {FREQ_LABELS[c.recurringFrequency ?? "MONTHLY"]}
                        </span>
                        <span className="text-xs" style={{ color: "#94A3B8" }}>
                          {c.recurringStartDate
                            ? <>Kezdés: {new Date(c.recurringStartDate).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}</>
                            : "Kezdés: megadatlan"}
                        </span>
                      </div>
                    ) : <span className="text-xs" style={{ color: "#94A3B8" }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "#64748B" }}>{c.note ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Btn onClick={() => startEdit(c)} variant="ghost" size="xs"><Pencil size={12} /></Btn>
                      <Btn onClick={() => handleDelete(c.id)} variant="ghost" size="xs" danger
                        loading={deletingId === c.id} disabled={deletingId === c.id}>
                        <Trash2 size={12} />
                      </Btn>
                    </div>
                  </td>
                </tr>
              )
            ))}

            {/* Add row */}
            {adding && (
              <tr style={{ background: "#FBFBFC", borderBottom: "1px solid #E2E8F0" }}>
                <td className="px-4 py-2">
                  <Input value={form.name} onChange={v => setF("name", v)} placeholder="pl. Bérleti díj" className="w-full" />
                </td>
                <td className="px-4 py-2">
                  <AmountFields f={form} setF2={setF} />
                </td>
                <td className="px-4 py-2">
                  <Select value={form.nature} onChange={v => setF("nature", v)}>
                    <option value="RECURRING">Ismétlődő</option>
                    <option value="ONE_TIME">Egyszeri</option>
                  </Select>
                </td>
                <td className="px-4 py-2">
                  {form.nature === "RECURRING" ? (
                    <div className="flex flex-col gap-1.5">
                      <Select value={form.recurringFrequency} onChange={v => setF("recurringFrequency", v)} className="w-36">
                        {(Object.keys(FREQ_LABELS) as RecurringFrequency[]).map(k => (
                          <option key={k} value={k}>{FREQ_LABELS[k]}</option>
                        ))}
                      </Select>
                      <Input value={form.recurringStartDate} onChange={v => setF("recurringStartDate", v)}
                        type="date" placeholder="Kezdeti dátum" className="w-36" />
                    </div>
                  ) : <span className="text-xs" style={{ color: "#94A3B8" }}>—</span>}
                </td>
                <td className="px-4 py-2">
                  <Input value={form.note} onChange={v => setF("note", v)} placeholder="Megjegyzés" className="w-full" />
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1.5">
                    <Btn onClick={handleAdd} loading={saving} size="xs" disabled={!form.name}>
                      <Check size={12} />
                    </Btn>
                    <Btn onClick={() => { setAdding(false); setForm(EMPTY_FIX); }} variant="ghost" size="xs">
                      <X size={12} />
                    </Btn>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Bérek tab ────────────────────────────────────────────────────────────────

type StaffForm = { name: string; amount: string; currency: string; note: string };
const EMPTY_STAFF: StaffForm = { name: "", amount: "", currency: "HUF", note: "" };

type RuleForm = { occupancyFrom: string; occupancyTo: string; extraStaffCount: string; dailyRate: string };
const EMPTY_RULE: RuleForm = { occupancyFrom: "0", occupancyTo: "", extraStaffCount: "1", dailyRate: "" };

function StaffTab({ costs, reload }: { costs: Cost[]; reload: () => void }) {
  const staffCosts = costs.filter(c => c.isStaff);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<StaffForm>(EMPTY_STAFF);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addingRule, setAddingRule] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm>(EMPTY_RULE);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  function setF(k: keyof StaffForm, v: string) { setForm(p => ({ ...p, [k]: v })); }
  function setRF(k: keyof RuleForm, v: string) { setRuleForm(p => ({ ...p, [k]: v })); }

  async function handleAdd() {
    setSaving(true);
    await fetch("/api/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, type: "FIXED", nature: "RECURRING", isStaff: true,
        amountType: "FIXED_AMOUNT", amount: Number(form.amount), currency: form.currency,
        note: form.note || null,
      }),
    });
    setAdding(false); setForm(EMPTY_STAFF); setSaving(false); reload();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/costs/${id}`, { method: "DELETE" });
    setDeletingId(null); reload();
  }

  async function handleAddRule(costId: string) {
    setSaving(true);
    await fetch(`/api/costs/${costId}/staff-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occupancyFrom: Number(ruleForm.occupancyFrom),
        occupancyTo: ruleForm.occupancyTo ? Number(ruleForm.occupancyTo) : null,
        extraStaffCount: Number(ruleForm.extraStaffCount),
        dailyRate: Number(ruleForm.dailyRate),
      }),
    });
    setAddingRule(null); setRuleForm(EMPTY_RULE); setSaving(false); reload();
  }

  async function handleDeleteRule(costId: string, ruleId: string) {
    setDeletingRuleId(ruleId);
    await fetch(`/api/costs/${costId}/staff-rules/${ruleId}`, { method: "DELETE" });
    setDeletingRuleId(null); reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: "#64748B" }}>
          Fix bérköltség + kihasználtság-alapú beugrós dolgozók. Minden pozícióhoz
          külön kihasználtság-küszöbök adhatók meg.
        </p>
        <Btn onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={14} /> Pozíció hozzáadása
        </Btn>
      </div>

      <div className="space-y-3">
        {staffCosts.length === 0 && !adding && (
          <Card>
            <p className="text-center py-10 text-sm" style={{ color: "#94A3B8" }}>
              Nincs rögzített bérköltség
            </p>
          </Card>
        )}

        {staffCosts.map(c => {
          const isExpanded = expanded === c.id;
          return (
            <Card key={c.id}>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                onClick={() => setExpanded(isExpanded ? null : c.id)}>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>{c.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    Alap: {fmt(c.amount ?? 0)} {c.currency}/hó
                    {c.staffRules.length > 0 && ` · ${c.staffRules.length} kihasználtság-sáv`}
                    {c.note && ` · ${c.note}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Btn onClick={() => handleDelete(c.id)}
                    variant="ghost" size="xs" danger loading={deletingId === c.id}
                    disabled={deletingId === c.id}>
                    <Trash2 size={12} />
                  </Btn>
                  {isExpanded ? <ChevronDown size={16} style={{ color: "#94A3B8" }} />
                    : <ChevronRight size={16} style={{ color: "#94A3B8" }} />}
                </div>
              </div>

              {/* Staff rules */}
              {isExpanded && (
                <div style={{ borderTop: "1px solid #F1F5F9" }}>
                  <div className="px-5 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                      style={{ color: "#94A3B8" }}>Kihasználtság-alapú extra staff</p>

                    {c.staffRules.length > 0 && (
                      <table className="w-full text-sm mb-3">
                        <thead>
                          <tr>
                            {["Kihas. tól", "Kihas. ig", "Extra fő", "Napi díj", ""].map(h => (
                              <th key={h} className="text-left pb-2 text-xs font-semibold"
                                style={{ color: "#94A3B8" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {c.staffRules.map(r => (
                            <tr key={r.id} style={{ borderTop: "1px solid #F8FAFC" }}>
                              <td className="py-2 pr-4 font-mono text-sm">{r.occupancyFrom}%</td>
                              <td className="py-2 pr-4 font-mono text-sm">
                                {r.occupancyTo != null ? `${r.occupancyTo}%` : "—"}
                              </td>
                              <td className="py-2 pr-4 font-semibold">{r.extraStaffCount} fő</td>
                              <td className="py-2 pr-4 font-mono" style={{ color: "#35BD78" }}>
                                {fmt(r.dailyRate)} Ft/nap
                              </td>
                              <td className="py-2">
                                <Btn onClick={() => handleDeleteRule(c.id, r.id)} variant="ghost"
                                  size="xs" danger loading={deletingRuleId === r.id}>
                                  <Trash2 size={11} />
                                </Btn>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Add rule form */}
                    {addingRule === c.id ? (
                      <div className="flex flex-wrap gap-2 items-end p-3 rounded-xl"
                        style={{ background: "#FBFBFC" }}>
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>
                            Kihas. tól (%)
                          </label>
                          <Input value={ruleForm.occupancyFrom} onChange={v => setRF("occupancyFrom", v)}
                            type="number" className="w-24" />
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>
                            Kihas. ig (%) – üresen = felső határ nélkül
                          </label>
                          <Input value={ruleForm.occupancyTo} onChange={v => setRF("occupancyTo", v)}
                            placeholder="pl. 100" type="number" className="w-24" />
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>Extra fő</label>
                          <Input value={ruleForm.extraStaffCount} onChange={v => setRF("extraStaffCount", v)}
                            type="number" className="w-20" />
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>
                            Napi díj (Ft)
                          </label>
                          <Input value={ruleForm.dailyRate} onChange={v => setRF("dailyRate", v)}
                            placeholder="0" type="number" className="w-28" />
                        </div>
                        <div className="flex gap-1.5 pb-0.5">
                          <Btn onClick={() => handleAddRule(c.id)} loading={saving} size="xs"
                            disabled={!ruleForm.dailyRate}>
                            <Check size={12} />
                          </Btn>
                          <Btn onClick={() => { setAddingRule(null); setRuleForm(EMPTY_RULE); }}
                            variant="ghost" size="xs"><X size={12} /></Btn>
                        </div>
                      </div>
                    ) : (
                      <Btn onClick={() => { setAddingRule(c.id); setRuleForm(EMPTY_RULE); }}
                        variant="outline" size="xs">
                        <Plus size={12} /> Sáv hozzáadása
                      </Btn>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        {/* Add staff form */}
        {adding && (
          <Card>
            <div className="flex flex-wrap gap-3 items-end px-5 py-4">
              <div className="flex-1 min-w-40">
                <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>Pozíció neve</label>
                <Input value={form.name} onChange={v => setF("name", v)} placeholder="pl. Recepciós" className="w-full" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>Alap havi bér (Ft)</label>
                <Input value={form.amount} onChange={v => setF("amount", v)} placeholder="0" type="number" className="w-36" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>Pénznem</label>
                <Select value={form.currency} onChange={v => setF("currency", v)} className="w-24">
                  <option>HUF</option><option>EUR</option>
                </Select>
              </div>
              <div className="flex-1 min-w-40">
                <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>Megjegyzés</label>
                <Input value={form.note} onChange={v => setF("note", v)} placeholder="opcionális" className="w-full" />
              </div>
              <div className="flex gap-1.5">
                <Btn onClick={handleAdd} loading={saving} disabled={!form.name} size="xs">
                  <Check size={12} /> Mentés
                </Btn>
                <Btn onClick={() => { setAdding(false); setForm(EMPTY_STAFF); }} variant="ghost" size="xs">
                  <X size={12} />
                </Btn>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Változó kiadások tab ─────────────────────────────────────────────────────

type VarForm = {
  name: string; amountType: AmountType; amount: string;
  percentage: string; percentageBase: PercentageBase; currency: string; note: string;
};
const EMPTY_VAR: VarForm = {
  name: "", amountType: "PERCENTAGE", amount: "", percentage: "",
  percentageBase: "TOTAL_REVENUE", currency: "HUF", note: "",
};

function VarTab({ costs, reload }: { costs: Cost[]; reload: () => void }) {
  const varCosts = costs.filter(c => c.type === "VARIABLE");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<VarForm>(EMPTY_VAR);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VarForm>(EMPTY_VAR);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function setF(k: keyof VarForm, v: string) { setForm(p => ({ ...p, [k]: v })); }
  function setEF(k: keyof VarForm, v: string) { setEditForm(p => ({ ...p, [k]: v })); }

  async function handleAdd() {
    setSaving(true);
    await fetch("/api/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, type: "VARIABLE", nature: "RECURRING", isStaff: false,
        amountType: form.amountType, currency: form.currency, note: form.note || null,
        amount: form.amountType === "FIXED_AMOUNT" ? Number(form.amount) : null,
        percentage: form.amountType === "PERCENTAGE" ? Number(form.percentage) : null,
        percentageBase: form.percentageBase,
      }),
    });
    setAdding(false); setForm(EMPTY_VAR); setSaving(false); reload();
  }

  async function handleEdit(id: string) {
    setSaving(true);
    await fetch(`/api/costs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name, amountType: editForm.amountType, currency: editForm.currency,
        note: editForm.note || null,
        amount: editForm.amountType === "FIXED_AMOUNT" ? Number(editForm.amount) : null,
        percentage: editForm.amountType === "PERCENTAGE" ? Number(editForm.percentage) : null,
        percentageBase: editForm.percentageBase,
      }),
    });
    setEditId(null); setSaving(false); reload();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/costs/${id}`, { method: "DELETE" });
    setDeletingId(null); reload();
  }

  function startEdit(c: Cost) {
    setEditId(c.id);
    setEditForm({
      name: c.name, amountType: c.amountType,
      amount: c.amount?.toString() ?? "", percentage: c.percentage?.toString() ?? "",
      percentageBase: c.percentageBase, currency: c.currency, note: c.note ?? "",
    });
  }

  function AmountFields({ f, setF2 }: { f: VarForm; setF2: (k: keyof VarForm, v: string) => void }) {
    return (
      <div className="flex gap-2 flex-wrap">
        <Select value={f.amountType} onChange={v => setF2("amountType", v)} className="w-36">
          <option value="PERCENTAGE">Százalék</option>
          <option value="FIXED_AMOUNT">Fix összeg</option>
        </Select>
        {f.amountType === "PERCENTAGE" ? (
          <div className="flex gap-1.5 items-center">
            <Input value={f.percentage} onChange={v => setF2("percentage", v)} placeholder="0.0" type="number" className="w-20" />
            <span className="text-sm" style={{ color: "#64748B" }}>%</span>
            <Select value={f.percentageBase} onChange={v => setF2("percentageBase", v)} className="w-44">
              {(Object.keys(PCT_BASE_LABELS) as PercentageBase[]).map(k => (
                <option key={k} value={k}>{PCT_BASE_LABELS[k]}</option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <Input value={f.amount} onChange={v => setF2("amount", v)} placeholder="0" type="number" className="w-32" />
            <Select value={f.currency} onChange={v => setF2("currency", v)} className="w-20">
              <option>HUF</option><option>EUR</option>
            </Select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: "#64748B" }}>
          Forgálomarányos kiadások: mosoda, takarítás, vendégellátás, értékesítési jutalékok.
        </p>
        <Btn onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={14} /> Hozzáadás
        </Btn>
      </div>
      <Card>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Megnevezés", "Számítás", "Megjegyzés", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#94A3B8" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {varCosts.length === 0 && !adding && <EmptyRow label="Nincs rögzített változó kiadás" />}
            {varCosts.map(c => (
              editId === c.id ? (
                <tr key={c.id} style={{ background: "#FBFBFC", borderBottom: "1px solid #E2E8F0" }}>
                  <td className="px-4 py-2">
                    <Input value={editForm.name} onChange={v => setEF("name", v)} placeholder="Megnevezés" className="w-full" />
                  </td>
                  <td className="px-4 py-2"><AmountFields f={editForm} setF2={setEF} /></td>
                  <td className="px-4 py-2">
                    <Input value={editForm.note} onChange={v => setEF("note", v)} placeholder="Megjegyzés" className="w-full" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <Btn onClick={() => handleEdit(c.id)} loading={saving} size="xs"><Check size={12} /></Btn>
                      <Btn onClick={() => setEditId(null)} variant="ghost" size="xs"><X size={12} /></Btn>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} style={{ borderBottom: "1px solid #F8FAFC" }}
                  className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium" style={{ color: "#0F172A" }}>{c.name}</td>
                  <td className="px-4 py-3 font-mono text-sm" style={{ color: "#35BD78" }}>
                    {c.amountType === "PERCENTAGE"
                      ? `${c.percentage}% · ${PCT_BASE_LABELS[c.percentageBase]}`
                      : `${fmt(c.amount ?? 0)} ${c.currency}`}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "#64748B" }}>{c.note ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Btn onClick={() => startEdit(c)} variant="ghost" size="xs"><Pencil size={12} /></Btn>
                      <Btn onClick={() => handleDelete(c.id)} variant="ghost" size="xs" danger
                        loading={deletingId === c.id} disabled={deletingId === c.id}>
                        <Trash2 size={12} />
                      </Btn>
                    </div>
                  </td>
                </tr>
              )
            ))}
            {adding && (
              <tr style={{ background: "#FBFBFC", borderBottom: "1px solid #E2E8F0" }}>
                <td className="px-4 py-2">
                  <Input value={form.name} onChange={v => setF("name", v)} placeholder="pl. Mosodai költség" className="w-full" />
                </td>
                <td className="px-4 py-2"><AmountFields f={form} setF2={setF} /></td>
                <td className="px-4 py-2">
                  <Input value={form.note} onChange={v => setF("note", v)} placeholder="Megjegyzés" className="w-full" />
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1.5">
                    <Btn onClick={handleAdd} loading={saving} disabled={!form.name} size="xs">
                      <Check size={12} />
                    </Btn>
                    <Btn onClick={() => { setAdding(false); setForm(EMPTY_VAR); }} variant="ghost" size="xs">
                      <X size={12} />
                    </Btn>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── LAB tab ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const YEAR_END = new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);

type LabRowForm = {
  validFrom: string; validTo: string; adultAmount: string; currency: string;
  childAmounts: Record<string, string>; // groupId → amount string
};

function emptyLabForm(childAmounts: LabChildAmount[]): LabRowForm {
  const ca: Record<string, string> = {};
  for (const c of childAmounts) ca[c.childAgeGroupId] = "";
  return { validFrom: TODAY, validTo: YEAR_END, adultAmount: "", currency: "HUF", childAmounts: ca };
}

function BoardLabSection({
  bt, reloadLab, hotelChildGroups,
}: { bt: LabBoardType; reloadLab: () => void; hotelChildGroups: HotelChildGroup[] }) {
  const meta = BOARD_META[bt.boardType] ?? { label: bt.boardType, bg: "#F1F5F9", text: "#64748B" };
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Build empty form using all hotel child groups
  function emptyForm(): LabRowForm {
    const ca: Record<string, string> = {};
    for (const g of hotelChildGroups) ca[g.id] = "";
    return { validFrom: TODAY, validTo: YEAR_END, adultAmount: "", currency: "HUF", childAmounts: ca };
  }

  const [form, setForm] = useState<LabRowForm>(emptyForm);
  const [editForm, setEditForm] = useState<LabRowForm>(emptyForm);

  // Reset form when hotelChildGroups changes
  useEffect(() => {
    setForm(emptyForm());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelChildGroups.length]);

  function buildChildAmounts(f: LabRowForm) {
    return Object.entries(f.childAmounts).map(([childAgeGroupId, amount]) => ({
      childAgeGroupId,
      amount: Number(amount) || 0,
    }));
  }

  async function handleAdd() {
    setSaving(true);
    await fetch("/api/lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelBoardTypeId: bt.hotelBoardTypeId,
        validFrom: form.validFrom,
        validTo: form.validTo,
        adultAmount: Number(form.adultAmount) || 0,
        currency: form.currency,
        childAmounts: buildChildAmounts(form),
      }),
    });
    setAdding(false); setForm(emptyForm()); setSaving(false); reloadLab();
  }

  async function handleEdit(id: string) {
    setSaving(true);
    await fetch(`/api/lab/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        validFrom: editForm.validFrom,
        validTo: editForm.validTo,
        adultAmount: Number(editForm.adultAmount) || 0,
        currency: editForm.currency,
        childAmounts: buildChildAmounts(editForm),
      }),
    });
    setEditId(null); setSaving(false); reloadLab();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/lab/${id}`, { method: "DELETE" });
    setDeletingId(null); reloadLab();
  }

  function startEdit(ls: LabSetting) {
    const ca: Record<string, string> = {};
    // Pre-fill with existing amounts; use 0 for missing groups
    for (const g of hotelChildGroups) {
      const existing = ls.childAmounts.find(c => c.childAgeGroupId === g.id);
      ca[g.id] = existing ? String(existing.amount) : "";
    }
    setEditId(ls.id);
    setEditForm({ validFrom: fmtDate(ls.validFrom), validTo: fmtDate(ls.validTo), adultAmount: String(ls.adultAmount), currency: ls.currency, childAmounts: ca });
  }

  const colSpan = 3 + hotelChildGroups.length + 1; // validFrom/validTo/adult + kids + actions

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold" style={{ background: meta.bg, color: meta.text }}>
            {bt.boardType}
          </span>
          <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>{meta.label}</span>
          <span className="text-xs" style={{ color: "#94A3B8" }}>— ellátási költség / fő / éj</span>
        </div>
        <Btn onClick={() => setAdding(a => !a)} size="xs">
          <Plus size={12} /> Időszak
        </Btn>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 500 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Érvényes tól</th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>Érvényes ig</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#0EA5E9" }}>Felnőtt / éj</th>
              {hotelChildGroups.map(g => (
                <th key={g.id} className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#F59E0B" }}>
                  {g.name} <span style={{ color: "#CBD5E1", fontWeight: 400 }}>({g.minAge}–{g.maxAge}é)</span>
                </th>
              ))}
              <th style={{ width: 72 }} />
            </tr>
          </thead>
          <tbody>
            {bt.labSettings.length === 0 && !adding && (
              <tr><td colSpan={colSpan} className="px-4 py-4 text-sm text-center" style={{ color: "#94A3B8" }}>
                Nincs rögzített időszak — adj hozzá egyet
              </td></tr>
            )}

            {bt.labSettings.map(ls => (
              editId === ls.id ? (
                <tr key={ls.id} style={{ background: "#FBFBFC", borderBottom: "1px solid #E2E8F0" }}>
                  <td className="px-3 py-2"><Input value={editForm.validFrom} onChange={v => setEditForm(p => ({ ...p, validFrom: v }))} type="date" className="w-32" /></td>
                  <td className="px-3 py-2"><Input value={editForm.validTo} onChange={v => setEditForm(p => ({ ...p, validTo: v }))} type="date" className="w-32" /></td>
                  <td className="px-3 py-2 text-right">
                    <Input value={editForm.adultAmount} onChange={v => setEditForm(p => ({ ...p, adultAmount: v }))} type="number" className="w-24 text-right" placeholder="0" />
                  </td>
                  {hotelChildGroups.map(g => (
                    <td key={g.id} className="px-3 py-2 text-right">
                      <Input
                        value={editForm.childAmounts[g.id] ?? ""}
                        onChange={v => setEditForm(p => ({ ...p, childAmounts: { ...p.childAmounts, [g.id]: v } }))}
                        type="number" className="w-24 text-right" placeholder="0" />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Btn onClick={() => handleEdit(ls.id)} loading={saving} size="xs"><Check size={12} /></Btn>
                      <Btn onClick={() => setEditId(null)} variant="ghost" size="xs"><X size={12} /></Btn>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={ls.id} style={{ borderBottom: "1px solid #F8FAFC" }} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "#334155" }}>{fmtDate(ls.validFrom)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "#334155" }}>{fmtDate(ls.validTo)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-xs" style={{ color: "#0EA5E9" }}>
                    {ls.adultAmount > 0 ? `${fmt(ls.adultAmount)} ${ls.currency}` : "—"}
                  </td>
                  {hotelChildGroups.map(g => {
                    const ca = ls.childAmounts.find(c => c.childAgeGroupId === g.id);
                    return (
                      <td key={g.id} className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: "#F59E0B" }}>
                        {ca && ca.amount > 0 ? `${fmt(ca.amount)} ${ls.currency}` : "—"}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Btn onClick={() => startEdit(ls)} variant="ghost" size="xs"><Pencil size={12} /></Btn>
                      <Btn onClick={() => handleDelete(ls.id)} variant="ghost" size="xs" danger loading={deletingId === ls.id}>
                        <Trash2 size={12} />
                      </Btn>
                    </div>
                  </td>
                </tr>
              )
            ))}

            {/* Add row */}
            {adding && (
              <tr style={{ background: "#F0FDF4", borderBottom: "1px solid #E2E8F0" }}>
                <td className="px-3 py-2"><Input value={form.validFrom} onChange={v => setForm(p => ({ ...p, validFrom: v }))} type="date" className="w-32" /></td>
                <td className="px-3 py-2"><Input value={form.validTo} onChange={v => setForm(p => ({ ...p, validTo: v }))} type="date" className="w-32" /></td>
                <td className="px-3 py-2 text-right">
                  <Input value={form.adultAmount} onChange={v => setForm(p => ({ ...p, adultAmount: v }))} type="number" className="w-24 text-right" placeholder="0" />
                </td>
                {hotelChildGroups.map(g => (
                  <td key={g.id} className="px-3 py-2 text-right">
                    <Input
                      value={form.childAmounts[g.id] ?? ""}
                      onChange={v => setForm(p => ({ ...p, childAmounts: { ...p.childAmounts, [g.id]: v } }))}
                      type="number" className="w-24 text-right" placeholder="0" />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Btn onClick={handleAdd} loading={saving} size="xs"><Check size={12} /></Btn>
                    <Btn onClick={() => { setAdding(false); setForm(emptyForm()); }} variant="ghost" size="xs"><X size={12} /></Btn>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LabTab({ labs, reloadLab, hotelChildGroups }: {
  labs: LabBoardType[];
  reloadLab: () => void;
  hotelChildGroups: HotelChildGroup[];
}) {
  if (labs.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
        <p className="font-semibold mb-1" style={{ color: "#92400E" }}>Nincs beállított ellátástípus</p>
        <p className="text-sm" style={{ color: "#B45309" }}>
          Menj a <strong>Hotel beállítások</strong> oldalra, és jelöld be, melyik ellátástípusokat kínálja a szállodád.
          Utána itt tudod beállítani az ellátási költségeket szezonálisan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: "#64748B" }}>
        Ellátási önköltség ellátástípusonként, szezonálisan — felnőtt és gyerekkorcsoportok szerint.
      </p>
      {labs.map(bt => (
        <BoardLabSection key={bt.boardType} bt={bt} reloadLab={reloadLab} hotelChildGroups={hotelChildGroups} />
      ))}
    </div>
  );
}

// ─── Distributors tab ─────────────────────────────────────────────────────────

type DistForm = { commissionPct: string };
const EMPTY_DIST: DistForm = { commissionPct: "" };

function DistTab({ distributors, reloadDist }: { distributors: Distributor[]; reloadDist: () => void }) {
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DistForm>(EMPTY_DIST);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function setEF(k: keyof DistForm, v: string) { setEditForm(p => ({ ...p, [k]: v })); }

  async function handleEdit(id: string) {
    setSaving(true);
    await fetch(`/api/distributors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionPct: Number(editForm.commissionPct) }),
    });
    setEditId(null); setSaving(false); reloadDist();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/distributors/${id}`, { method: "DELETE" });
    setDeletingId(null); reloadDist();
  }

  // Total commission impact estimate
  const avgCommission = distributors.length > 0
    ? distributors.reduce((a, d) => a + d.commissionPct, 0) / distributors.length : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <p className="text-sm" style={{ color: "#64748B" }}>
          A jutalékos értékesítési csatornák jutalékkulcsai. A profit számításnál az átlagos jutalék a szobabevételre vetítve kerül levonásra.
        </p>
        <a href="/hotel-config"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 transition-colors"
          style={{ background: "#EFF6FF", color: "#3B82F6" }}>
          ⚙ Csatornák kezelése
        </a>
      </div>

      {distributors.length > 0 && (
        <div className="flex gap-3">
          <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(53,189,120,0.12)" }}>
            <span className="font-semibold" style={{ color: "#35BD78" }}>{distributors.length} csatorna</span>
            <span style={{ color: "#94A3B8" }}> · átl. </span>
            <span className="font-bold" style={{ color: "#35BD78" }}>{avgCommission.toFixed(1)}% jutalék</span>
          </div>
        </div>
      )}

      <Card>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Csatorna neve", "Jutalék %", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#94A3B8" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {distributors.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-sm text-center" style={{ color: "#94A3B8" }}>
                  Nincs jutalékos csatorna — add hozzá a{" "}
                  <a href="/hotel-config" style={{ color: "#35BD78", fontWeight: 600 }}>Hotel beállításoknál</a>
                </td>
              </tr>
            )}
            {distributors.map(d => (
              editId === d.id ? (
                <tr key={d.id} style={{ background: "#FBFBFC", borderBottom: "1px solid #E2E8F0" }}>
                  <td className="px-4 py-2 font-medium" style={{ color: "#0F172A" }}>{d.name}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <Input value={editForm.commissionPct} onChange={v => setEF("commissionPct", v)}
                        type="number" className="w-20" />
                      <span className="text-sm" style={{ color: "#64748B" }}>%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <Btn onClick={() => handleEdit(d.id)} loading={saving} size="xs"><Check size={12} /></Btn>
                      <Btn onClick={() => setEditId(null)} variant="ghost" size="xs"><X size={12} /></Btn>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={d.id} style={{ borderBottom: "1px solid #F8FAFC" }}
                  className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium" style={{ color: "#0F172A" }}>{d.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 rounded-full overflow-hidden" style={{ width: 80, background: "#F1F5F9" }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${Math.min(d.commissionPct * 3, 100)}%`, background: "#35BD78" }} />
                      </div>
                      <span className="font-mono font-bold" style={{ color: "#35BD78" }}>
                        {d.commissionPct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Btn onClick={() => { setEditId(d.id); setEditForm({ commissionPct: d.commissionPct.toString() }); }}
                        variant="ghost" size="xs"><Pencil size={12} /></Btn>
                      <Btn onClick={() => handleDelete(d.id)} variant="ghost" size="xs" danger
                        loading={deletingId === d.id}>
                        <Trash2 size={12} />
                      </Btn>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostsPage() {
  const [tab, setTab] = useState<Tab>("fixed");
  const [costs, setCosts] = useState<Cost[]>([]);
  const [labs, setLabs] = useState<LabBoardType[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [hotelChildGroups, setHotelChildGroups] = useState<HotelChildGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, lRes, dRes, gRes] = await Promise.all([
        fetch("/api/costs"),
        fetch("/api/lab"),
        fetch("/api/distributors?commissionOnly=true"),
        fetch("/api/child-age-groups"),
      ]);
      const [c, l, d, g] = await Promise.all([cRes.json(), lRes.json(), dRes.json(), gRes.json()]);
      setCosts(Array.isArray(c) ? c : []);
      setLabs(Array.isArray(l) ? l : []);
      setDistributors(Array.isArray(d) ? d : []);
      setHotelChildGroups(Array.isArray(g) ? g.map((x: { id: string; name: string; minAge: number; maxAge: number }) => ({
        id: x.id, name: x.name, minAge: x.minAge, maxAge: x.maxAge,
      })) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadCosts = useCallback(async () => {
    const res = await fetch("/api/costs");
    const c = await res.json();
    setCosts(Array.isArray(c) ? c : []);
  }, []);

  const reloadLab = useCallback(async () => {
    const res = await fetch("/api/lab");
    const l = await res.json();
    setLabs(Array.isArray(l) ? l : []);
  }, []);

  const reloadDist = useCallback(async () => {
    const res = await fetch("/api/distributors?commissionOnly=true");
    const d = await res.json();
    setDistributors(Array.isArray(d) ? d : []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Summary stats
  const fixTotal = costs.filter(c => c.type === "FIXED" && !c.isStaff && c.amountType === "FIXED_AMOUNT")
    .reduce((a, c) => a + (c.amount ?? 0), 0);
  const staffTotal = costs.filter(c => c.isStaff && c.amountType === "FIXED_AMOUNT")
    .reduce((a, c) => a + (c.amount ?? 0), 0);
  const varPct = costs.filter(c => c.type === "VARIABLE" && c.amountType === "PERCENTAGE")
    .reduce((a, c) => a + (c.percentage ?? 0), 0);

  return (
    <div className="space-y-5" style={{ maxWidth: 1000 }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Kiadások</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
          Fix és változó kiadások, bérek, LAB normák és közvetítői jutalékok
        </p>
      </div>

      {/* Summary chips */}
      {!loading && (
        <div className="flex flex-wrap gap-3">
          <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <span style={{ color: "#94A3B8" }}>Fix / hó: </span>
            <span className="font-bold" style={{ color: "#35BD78" }}>{(fixTotal).toLocaleString("hu-HU")} Ft</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <span style={{ color: "#94A3B8" }}>Bérköltség / hó: </span>
            <span className="font-bold" style={{ color: "#3B82F6" }}>{(staffTotal).toLocaleString("hu-HU")} Ft</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <span style={{ color: "#94A3B8" }}>Változó kiadások: </span>
            <span className="font-bold" style={{ color: "#10B981" }}>{varPct.toFixed(1)}% a bevételből</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ background: "white", border: "1px solid #E2E8F0" }}>
            <span style={{ color: "#94A3B8" }}>Közvetítők: </span>
            <span className="font-bold" style={{ color: "#F59E0B" }}>{distributors.length} csatorna</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: "#F1F5F9" }}>
        {TABS.map(t => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: active ? "white" : "transparent",
                color: active ? "#35BD78" : "#64748B",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={22} className="animate-spin" style={{ color: "#35BD78" }} />
        </div>
      ) : (
        <>
          {tab === "fixed" && <FixTab costs={costs} reload={reloadCosts} />}
          {tab === "staff" && <StaffTab costs={costs} reload={reloadCosts} />}
          {tab === "var"   && <VarTab costs={costs} reload={reloadCosts} />}
          {tab === "lab"   && <LabTab labs={labs} reloadLab={reloadLab} hotelChildGroups={hotelChildGroups} />}
          {tab === "dist"  && <DistTab distributors={distributors} reloadDist={reloadDist} />}
        </>
      )}
    </div>
  );
}
