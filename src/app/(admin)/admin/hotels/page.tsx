"use client";

import { useEffect, useState } from "react";
import {
  Building2, Plus, X, Loader2, ChevronDown, ChevronUp,
  UserPlus, Trash2, Users, Check,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Hotel = {
  id: string;
  name: string;
  city?: string;
  baseCurrency: string;
  totalRooms?: number | null;
};

type HotelUser = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  modules: string[];
};

const CURRENCIES = ["HUF", "EUR", "USD", "GBP", "CZK", "RON", "PLN"];
const COUNTRIES = [
  { code: "HU", label: "Magyarország" },
  { code: "AT", label: "Ausztria" },
  { code: "CZ", label: "Csehország" },
  { code: "SK", label: "Szlovákia" },
  { code: "RO", label: "Románia" },
  { code: "DE", label: "Németország" },
  { code: "HR", label: "Horvátország" },
  { code: "OTHER", label: "Egyéb" },
];

const ALL_MODULES = [
  { id: "SIMPLE_PLANNER",    label: "Simple Planner" },
  { id: "DATAHEAVEN",        label: "DataHeaven" },
  { id: "REVENUE_PLANNER",   label: "Bevételtervező" },
  { id: "SCENARIOS",         label: "Szcenáriók" },
  { id: "WEIGHTING",         label: "Súlyozás" },
  { id: "COSTS",             label: "Kiadások" },
  { id: "REPORTING",         label: "Riportok" },
  { id: "ANALYSIS",          label: "Részletes elemzés" },
  { id: "HISTORICAL_IMPORT", label: "Pickup import" },
  { id: "HOTEL_CONFIG",      label: "Hotel beállítások" },
  { id: "TEAM",              label: "Csapat" },
] as const;

const defaultForm = { name: "", city: "", country: "HU", baseCurrency: "HUF", totalRooms: "" };

function initials(name: string | null, email: string) {
  if (name) return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

// ─── Module pill ─────────────────────────────────────────────────────────────

function ModulePill({ label }: { label: string }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 600,
      background: "rgba(53,189,120,0.1)", color: "#03915A",
      border: "1px solid rgba(53,189,120,0.25)",
      padding: "2px 7px", borderRadius: 6,
    }}>{label}</span>
  );
}

// ─── Add user panel ───────────────────────────────────────────────────────────

function AddUserPanel({ hotelId, onAdded }: { hotelId: string; onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [modules, setModules] = useState<string[]>(["SIMPLE_PLANNER"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleModule(id: string) {
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/hotels/${hotelId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: "PROFESSIONAL", modules }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Hiba történt"); return; }
      setEmail("");
      setModules(["SIMPLE_PLANNER"]);
      onAdded();
    } catch { setError("Hiba történt"); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleAdd} style={{
      background: "#F8FAFC", border: "1.5px dashed #CBD5E1",
      borderRadius: 12, padding: "16px 18px", marginTop: 12,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Felhasználó hozzáadása
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 }}>
          E-mail cím (már regisztrált felhasználó)
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="kolega@szalloda.hu"
          style={{
            width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0",
            borderRadius: 8, fontSize: 13, fontFamily: "inherit",
            outline: "none", boxSizing: "border-box",
          }}
          onFocus={e => { e.target.style.borderColor = "#35BD78"; }}
          onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 6 }}>
          Modulok
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_MODULES.map(m => {
            const on = modules.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModule(m.id)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7,
                  border: `1.5px solid ${on ? "rgba(53,189,120,0.5)" : "#E2E8F0"}`,
                  background: on ? "rgba(53,189,120,0.1)" : "white",
                  color: on ? "#03915A" : "#64748B",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {on && <Check size={10} />}
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: "#EF4444", marginBottom: 10 }}>{error}</p>}

      <button
        type="submit"
        disabled={saving || !email.trim()}
        style={{
          padding: "8px 18px", background: "#35BD78", color: "white",
          border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: saving || !email.trim() ? "not-allowed" : "pointer",
          opacity: saving || !email.trim() ? 0.6 : 1,
          display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
        }}
      >
        {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <UserPlus size={13} />}
        Hozzáadás
      </button>
    </form>
  );
}

// ─── Hotel user row ───────────────────────────────────────────────────────────

function UserRow({ user, hotelId, onRemoved, onModulesChanged }: {
  user: HotelUser;
  hotelId: string;
  onRemoved: () => void;
  onModulesChanged: (modules: string[]) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [editingModules, setEditingModules] = useState(false);
  const [modules, setModules] = useState<string[]>(user.modules);
  const [saving, setSaving] = useState(false);

  async function handleRemove() {
    if (!confirm(`Biztosan eltávolítod ${user.email} hozzáférését?`)) return;
    setRemoving(true);
    await fetch(`/api/admin/hotels/${hotelId}/users`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.userId }),
    });
    onRemoved();
  }

  async function saveModules() {
    setSaving(true);
    await fetch(`/api/admin/hotels/${hotelId}/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.userId, modules }),
    });
    setSaving(false);
    setEditingModules(false);
    onModulesChanged(modules);
  }

  function toggleModule(id: string) {
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  }

  const moduleLabel = (id: string) => ALL_MODULES.find(m => m.id === id)?.label ?? id;

  return (
    <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        {/* Avatar + info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "#E2E8F0", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#475569",
          }}>
            {initials(user.name, user.email)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.name ?? user.email}
            </div>
            {user.name && <div style={{ fontSize: 11, color: "#94A3B8" }}>{user.email}</div>}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => { setEditingModules(e => !e); setModules(user.modules); }}
            style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7,
              border: "1.5px solid #E2E8F0", background: "white",
              color: "#475569", cursor: "pointer",
            }}
          >
            Modulok
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            style={{
              width: 28, height: 28, borderRadius: 7, border: "1.5px solid #FCA5A5",
              background: "white", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
          >
            {removing ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite", color: "#EF4444" }} /> : <Trash2 size={12} color="#EF4444" />}
          </button>
        </div>
      </div>

      {/* Modules display */}
      {!editingModules && user.modules.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, marginLeft: 42 }}>
          {user.modules.map(m => <ModulePill key={m} label={moduleLabel(m)} />)}
        </div>
      )}
      {!editingModules && user.modules.length === 0 && (
        <div style={{ marginTop: 6, marginLeft: 42, fontSize: 11, color: "#94A3B8" }}>Nincs modul hozzárendelve</div>
      )}

      {/* Module editor */}
      {editingModules && (
        <div style={{ marginTop: 10, marginLeft: 42, padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {ALL_MODULES.map(m => {
              const on = modules.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleModule(m.id)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                    border: `1.5px solid ${on ? "rgba(53,189,120,0.5)" : "#E2E8F0"}`,
                    background: on ? "rgba(53,189,120,0.1)" : "white",
                    color: on ? "#03915A" : "#64748B",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  {on && <Check size={9} />}
                  {m.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={saveModules}
              disabled={saving}
              style={{
                padding: "5px 14px", background: "#35BD78", color: "white",
                border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {saving ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={11} />}
              Mentés
            </button>
            <button
              onClick={() => setEditingModules(false)}
              style={{
                padding: "5px 14px", background: "white", color: "#64748B",
                border: "1.5px solid #E2E8F0", borderRadius: 7, fontSize: 12,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Mégse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hotel card (expandable) ──────────────────────────────────────────────────

function HotelCard({ hotel }: { hotel: Hotel }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<HotelUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  async function loadUsers() {
    setLoadingUsers(true);
    const res = await fetch(`/api/admin/hotels/${hotel.id}/users`);
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoadingUsers(false);
  }

  function handleToggle() {
    if (!open) loadUsers();
    setOpen(o => !o);
    setShowAddUser(false);
  }

  return (
    <div style={{
      background: "white", borderRadius: 14,
      border: open ? "1.5px solid rgba(53,189,120,0.4)" : "1px solid #E2E8F0",
      boxShadow: open ? "0 4px 16px rgba(53,189,120,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
      transition: "all 0.15s", overflow: "hidden",
    }}>
      {/* Header row */}
      <button
        onClick={handleToggle}
        style={{
          width: "100%", padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: open ? "rgba(53,189,120,0.15)" : "rgba(53,189,120,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Building2 size={17} color="#35BD78" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{hotel.name}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
              {hotel.city && `${hotel.city} · `}{hotel.baseCurrency}
              {hotel.totalRooms ? ` · ${hotel.totalRooms} szoba` : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94A3B8" }}>
          <span style={{ fontSize: 11, fontFamily: "monospace" }}>{hotel.id.slice(0, 8)}…</span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded panel */}
      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid #F1F5F9" }}>

          {/* Users section header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={14} color="#64748B" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Hozzárendelt felhasználók
              </span>
            </div>
            <button
              onClick={() => setShowAddUser(a => !a)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 8,
                background: showAddUser ? "#F1F5F9" : "#35BD78",
                color: showAddUser ? "#64748B" : "white",
                border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              }}
            >
              {showAddUser ? <X size={12} /> : <UserPlus size={12} />}
              {showAddUser ? "Mégse" : "Hozzáadás"}
            </button>
          </div>

          {/* User list */}
          {loadingUsers ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <Loader2 size={18} color="#35BD78" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : users.length === 0 && !showAddUser ? (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#94A3B8", fontSize: 13 }}>
              Még nincs hozzárendelt felhasználó.
            </div>
          ) : (
            <div style={{ marginTop: 4 }}>
              {users.map(user => (
                <UserRow
                  key={user.userId}
                  user={user}
                  hotelId={hotel.id}
                  onRemoved={loadUsers}
                  onModulesChanged={newMods => setUsers(prev =>
                    prev.map(u => u.userId === user.userId ? { ...u, modules: newMods } : u)
                  )}
                />
              ))}
            </div>
          )}

          {/* Add user panel */}
          {showAddUser && (
            <AddUserPanel
              hotelId={hotel.id}
              onAdded={() => { loadUsers(); setShowAddUser(false); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminHotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadHotels() {
    setLoading(true);
    const res = await fetch("/api/hotels/list");
    const data = await res.json();
    setHotels(data);
    setLoading(false);
  }

  useEffect(() => { loadHotels(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          city: form.city.trim(),
          country: form.country,
          baseCurrency: form.baseCurrency,
          totalRooms: form.totalRooms ? Number(form.totalRooms) : null,
          isOnboarded: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Hiba történt");
      }
      setForm(defaultForm);
      setShowForm(false);
      await loadHotels();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Szállodák</h1>
          <p className="text-sm text-slate-500 mt-1">⚡ God Mode — szállodák és hozzáférések kezelése</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(""); setForm(defaultForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: "#35BD78" }}
        >
          <Plus size={16} /> Új szálloda
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800">Új szálloda létrehozása</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Szálloda neve *</label>
                <input type="text" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="pl. Grand Hotel Budapest"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Város *</label>
                <input type="text" required value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="pl. Budapest"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Ország</label>
                <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-white">
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Alap pénznem</label>
                <select value={form.baseCurrency} onChange={e => setForm(f => ({ ...f, baseCurrency: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-white">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Szobaszám</label>
                <input type="number" min={1} value={form.totalRooms}
                  onChange={e => setForm(f => ({ ...f, totalRooms: e.target.value }))}
                  placeholder="pl. 42"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
                style={{ background: "#35BD78" }}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Mentés...</> : "Létrehozás"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg text-slate-600 text-sm font-semibold border border-slate-200 hover:bg-slate-50">
                Mégse
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hotels list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : hotels.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Még nincs szálloda. Hozz létre egyet!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hotels.map(hotel => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
