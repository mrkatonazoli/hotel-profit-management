"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Plus, Loader2, ArrowRight, Calendar, Check, Pencil, X } from "lucide-react";

type SimplePlanMonth = {
  id: string;
  month: number;
  adr: number;
  occupancyPct: number;
  monthlyCost: number;
};

type SimplePlan = {
  id: string;
  name: string;
  year: number;
  createdAt: string;
  months: SimplePlanMonth[];
};

function fmt(n: number) {
  return n.toLocaleString("hu-HU");
}
function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString("hu-HU", { maximumFractionDigits: 0 })} E`;
  return fmt(n);
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function computeStats(plan: SimplePlan) {
  const filled = plan.months.filter(m => m.adr > 0 || m.occupancyPct > 0);
  if (filled.length === 0) return null;

  let totalRevenue = 0;
  let totalProfit = 0;
  let totalOcc = 0;

  for (const m of filled) {
    const days = daysInMonth(m.month, plan.year);
    // We don't know totalRooms here, use 1 as proxy so we get RevPAR-like numbers
    // Actually for the list we just show the averages
    totalOcc += m.occupancyPct;
  }

  // Return quick stats without totalRooms (we'll show avg occ and just a note)
  return {
    avgOcc: Math.round(totalOcc / filled.length),
    filledMonths: filled.length,
  };
}

export default function SimplePlannerListPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<SimplePlan[]>([]);
  const [loading, setLoading] = useState(true);

  // New plan form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);
  const newNameRef = useRef<HTMLInputElement>(null);

  // Inline rename state: planId → draft name
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/simple-plans");
      if (res.ok) setPlans(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function openNewForm() {
    setNewName(`Terv ${new Date().getFullYear()}`);
    setNewYear(new Date().getFullYear());
    setShowNewForm(true);
    setTimeout(() => { newNameRef.current?.focus(); newNameRef.current?.select(); }, 50);
  }

  async function createPlan() {
    const name = newName.trim() || `Gyors terv ${newYear}`;
    setCreating(true);
    try {
      const res = await fetch("/api/simple-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, year: newYear }),
      });
      if (res.ok) {
        const plan = await res.json();
        router.push(`/simple-planner/${plan.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  function startRename(plan: SimplePlan) {
    setRenamingId(plan.id);
    setRenameDraft(plan.name);
    setTimeout(() => { renameRef.current?.focus(); renameRef.current?.select(); }, 30);
  }

  async function commitRename(planId: string) {
    const name = renameDraft.trim();
    if (!name) { cancelRename(); return; }
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, name } : p));
    setRenamingId(null);
    await fetch(`/api/simple-plans/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameDraft("");
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Calculator size={18} color="#7C3AED" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>Simple Planner</h1>
          </div>
          <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>
            Gyors ADR + kihasználtság alapú profit kalkulátor
          </p>
        </div>

        <button
          onClick={openNewForm}
          disabled={creating}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#7C3AED", color: "white",
            border: "none", borderRadius: 12, padding: "10px 18px",
            fontSize: 14, fontWeight: 600, cursor: creating ? "not-allowed" : "pointer",
            opacity: creating ? 0.7 : 1,
          }}
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Új terv
        </button>
      </div>

      {/* ── New plan form ── */}
      {showNewForm && (
        <div style={{
          background: "white", border: "1px solid #DDD6FE", borderRadius: 16,
          padding: "20px 24px", marginBottom: 20,
          boxShadow: "0 4px 20px rgba(124,58,237,0.10)",
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Új terv létrehozása
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={newNameRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createPlan(); if (e.key === "Escape") setShowNewForm(false); }}
              placeholder="Terv neve..."
              style={{
                flex: 1, minWidth: 200,
                border: "1.5px solid #DDD6FE", borderRadius: 10,
                padding: "9px 14px", fontSize: 14, fontWeight: 600,
                color: "#0F172A", outline: "none", background: "#FAFAFA",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#7C3AED")}
              onBlur={e => (e.currentTarget.style.borderColor = "#DDD6FE")}
            />
            <select
              value={newYear}
              onChange={e => setNewYear(Number(e.target.value))}
              style={{
                border: "1.5px solid #E2E8F0", borderRadius: 10,
                padding: "9px 12px", fontSize: 14, fontWeight: 600,
                color: "#0F172A", background: "white", cursor: "pointer", outline: "none",
              }}
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={createPlan}
              disabled={creating || !newName.trim()}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: creating || !newName.trim() ? "#E2E8F0" : "#7C3AED",
                color: creating || !newName.trim() ? "#94A3B8" : "white",
                border: "none", borderRadius: 10, padding: "9px 18px",
                fontSize: 14, fontWeight: 600, cursor: creating || !newName.trim() ? "not-allowed" : "pointer",
              }}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Létrehozás
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "white", border: "1px solid #E2E8F0",
                borderRadius: 10, padding: "9px 14px",
                fontSize: 13, fontWeight: 600, color: "#64748B", cursor: "pointer",
              }}
            >
              <X size={14} /> Mégse
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
        </div>
      ) : plans.length === 0 ? (
        <div style={{
          background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "60px 24px", gap: 12,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Calculator size={28} color="#A78BFA" />
          </div>
          <p style={{ color: "#0F172A", fontWeight: 600, fontSize: 16, margin: 0 }}>Még nincs tervezett szcenárió</p>
          <p style={{ color: "#94A3B8", fontSize: 14, margin: 0 }}>Hozd létre az első Simple Plant az „Új terv" gombbal</p>
          <button
            onClick={createPlan}
            disabled={creating}
            style={{
              marginTop: 8,
              display: "flex", alignItems: "center", gap: 8,
              background: "#7C3AED", color: "white",
              border: "none", borderRadius: 12, padding: "10px 20px",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={16} /> Új terv létrehozása
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {plans.map(plan => {
            const stats = computeStats(plan);
            const createdDate = new Date(plan.createdAt).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
            return (
              <div
                key={plan.id}
                style={{
                  background: "white", border: "1px solid #E2E8F0", borderRadius: 20,
                  padding: "20px 20px 16px",
                  display: "flex", flexDirection: "column", gap: 12,
                }}
              >
                {/* Plan header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {renamingId === plan.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          ref={renameRef}
                          value={renameDraft}
                          onChange={e => setRenameDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") commitRename(plan.id);
                            if (e.key === "Escape") cancelRename();
                          }}
                          onBlur={() => commitRename(plan.id)}
                          style={{
                            flex: 1, minWidth: 0,
                            fontSize: 15, fontWeight: 700, color: "#0F172A",
                            border: "none", borderBottom: "2px solid #7C3AED",
                            outline: "none", background: "transparent",
                            padding: "0 2px",
                          }}
                        />
                        <button
                          onMouseDown={e => { e.preventDefault(); commitRename(plan.id); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#10B981", padding: 2, display: "flex" }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onMouseDown={e => { e.preventDefault(); cancelRename(); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2, display: "flex" }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", group: true } as React.CSSProperties}
                        onClick={() => startRename(plan)}
                        title="Kattints az átnevezéshez"
                      >
                        <p style={{
                          fontWeight: 700, fontSize: 16, color: "#0F172A", margin: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {plan.name}
                        </p>
                        <Pencil size={12} color="#CBD5E1" style={{ flexShrink: 0 }} />
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Calendar size={12} color="#94A3B8" />
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>{plan.year} · létrehozva: {createdDate}</span>
                    </div>
                  </div>
                  <div style={{
                    background: "#EDE9FE", borderRadius: 8, padding: "2px 8px",
                    fontSize: 12, fontWeight: 600, color: "#7C3AED", flexShrink: 0,
                  }}>
                    {plan.year}
                  </div>
                </div>

                {/* Stats */}
                {stats ? (
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1, background: "#F8FAFC", borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ fontSize: 11, color: "#94A3B8", margin: "0 0 2px", fontWeight: 500 }}>Átl. kihasználtság</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: "#7C3AED", margin: 0 }}>{stats.avgOcc}%</p>
                    </div>
                    <div style={{ flex: 1, background: "#F8FAFC", borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ fontSize: 11, color: "#94A3B8", margin: "0 0 2px", fontWeight: 500 }}>Kitöltött hónap</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>{stats.filledMonths}/12</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "8px 12px" }}>
                    <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>Nincs adat megadva — nyisd meg a szerkesztőt</p>
                  </div>
                )}

                {/* Open button */}
                <button
                  onClick={() => router.push(`/simple-planner/${plan.id}`)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: "#F5F3FF", color: "#7C3AED",
                    border: "none", borderRadius: 10, padding: "9px 16px",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    marginTop: 2,
                  }}
                >
                  Megnyitás <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
