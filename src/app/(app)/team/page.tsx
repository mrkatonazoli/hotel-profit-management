"use client";

import { useEffect, useState } from "react";
import {
  Users, UserPlus, Trash2, Loader2, Check, Copy,
  Mail, ShieldCheck, Eye, Crown, X, RefreshCw,
  AlertTriangle, Pencil,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Member = {
  userId: string; name: string | null; email: string;
  image: string | null; role: "MANAGER" | "PROFESSIONAL"; isSuperAdmin: boolean;
  modules: string[];
};
type PendingInvite = {
  id: string; email: string; role: "MANAGER" | "PROFESSIONAL";
  token: string; expiresAt: string;
};
type TeamData = {
  members: Member[]; invites: PendingInvite[]; currentUserId: string;
};

const ALL_MODULES = [
  { id: "SIMPLE_PLANNER",    label: "Simple Planner" },
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

type ModuleId = typeof ALL_MODULES[number]["id"];

const ROLE_META = {
  MANAGER: { label: "Manager", icon: Crown,      color: "#35BD78", bg: "rgba(53,189,120,0.12)" },
  PROFESSIONAL:  { label: "Professional",  icon: Eye,         color: "#3B82F6", bg: "#DBEAFE" },
};

function initials(name: string | null, email: string) {
  if (name) return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function avatarColor(str: string) {
  const colors = ["#35BD78","#3B82F6","#10B981","#F59E0B","#EC4899","#14B8A6"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function moduleLabel(id: string) {
  return ALL_MODULES.find(m => m.id === id)?.label ?? id;
}

// ─── Module selector component ────────────────────────────────────────────────

function ModuleSelector({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (modules: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(m => m !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 8,
      marginTop: 8,
    }}>
      {ALL_MODULES.map(m => {
        const checked = selected.includes(m.id);
        return (
          <label
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 8,
              background: checked ? "rgba(53,189,120,0.12)" : "#F8FAFC",
              border: `1px solid ${checked ? "rgba(53,189,120,0.4)" : "#E2E8F0"}`,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(m.id)}
              disabled={disabled}
              style={{ accentColor: "#35BD78", width: 14, height: 14, cursor: disabled ? "not-allowed" : "pointer" }}
            />
            <span style={{ fontSize: 12, color: checked ? "#03915A" : "#334155", fontWeight: checked ? 600 : 400 }}>
              {m.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type HotelOption = { id: string; name: string };

export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MANAGER" | "PROFESSIONAL">("PROFESSIONAL");
  const [moduleRestrict, setModuleRestrict] = useState(false);
  const [inviteModules, setInviteModules] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ type: "added"; name: string } | { type: "invited"; inviteUrl: string; email: string } | { type: "error"; msg: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [editingModulesFor, setEditingModulesFor] = useState<string | null>(null);
  const [editModulesDraft, setEditModulesDraft] = useState<string[]>([]);
  const [savingModules, setSavingModules] = useState(false);
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [inviteHotelId, setInviteHotelId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [teamRes, hotelsRes] = await Promise.all([
        fetch("/api/team"),
        fetch("/api/hotels/list"),
      ]);
      if (teamRes.ok) setData(await teamRes.json());
      if (hotelsRes.ok) {
        const list: HotelOption[] = await hotelsRes.json();
        setHotels(list);
        if (list.length > 0) setInviteHotelId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteHotelId) return;
    setInviting(true); setInviteResult(null);
    try {
      const modules = (moduleRestrict && inviteRole !== "MANAGER") ? inviteModules : [];
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, modules, hotelId: inviteHotelId }),
      });
      const json = await res.json();
      if (!res.ok) { setInviteResult({ type: "error", msg: json.error }); return; }
      setInviteResult(json);
      setInviteEmail("");
      setModuleRestrict(false);
      setInviteModules([]);
      await load();
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingId(userId);
    try {
      await fetch(`/api/team/${userId}`, { method: "DELETE" });
      await load();
    } finally {
      setRemovingId(null);
    }
  }

  async function handleChangeRole(userId: string, role: "MANAGER" | "PROFESSIONAL") {
    setChangingRoleId(userId);
    try {
      await fetch(`/api/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      await load();
    } finally {
      setChangingRoleId(null);
    }
  }

  function startEditModules(member: Member) {
    setEditingModulesFor(member.userId);
    setEditModulesDraft([...member.modules]);
  }

  async function saveModules(userId: string) {
    setSavingModules(true);
    try {
      await fetch(`/api/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: editModulesDraft }),
      });
      setEditingModulesFor(null);
      await load();
    } finally {
      setSavingModules(false);
    }
  }

  async function handleRevokeInvite(token: string) {
    await fetch(`/api/invites/${token}`, { method: "DELETE" });
    await load();
  }

  async function copyLink(url: string, token: string) {
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: "#35BD78" }} />
    </div>
  );

  const isManager = data?.members.find(m => m.userId === data.currentUserId)?.role === "MANAGER"
    || data?.members.find(m => m.userId === data.currentUserId)?.isSuperAdmin;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6" style={{ maxWidth: 720 }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Csapatkezelés</h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Tagok meghívása és jogosultságok kezelése
        </p>
      </div>

      {/* ── Invite form ── */}
      {isManager && (
        <div className="rounded-2xl p-6" style={{ background: "white", border: "1px solid #E2E8F0" }}>
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={18} style={{ color: "#35BD78" }} />
            <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Új tag meghívása</h2>
          </div>

          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            {/* Szálloda választó */}
            {hotels.length > 1 && (
              <select
                value={inviteHotelId}
                onChange={e => setInviteHotelId(e.target.value)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#334155", outline: "none", width: "100%" }}>
                {hotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email" required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="nev@email.com"
                className="flex-1 rounded-xl px-4 py-2.5 text-sm"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", outline: "none", color: "#0F172A" }}
              />
              <select
                value={inviteRole}
                onChange={e => { setInviteRole(e.target.value as "MANAGER" | "PROFESSIONAL"); if (e.target.value === "MANAGER") setModuleRestrict(false); }}
                className="rounded-xl px-3 py-2.5 text-sm font-medium"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#334155", outline: "none" }}>
                <option value="PROFESSIONAL">Professional</option>
                <option value="MANAGER">Manager</option>
              </select>
              <button type="submit" disabled={inviting || !inviteHotelId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "#35BD78", color: "white", border: "none", cursor: "pointer" }}>
                {inviting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                Meghívás
              </button>
            </div>

            {/* Module restriction toggle — only for Professional */}
            {inviteRole !== "MANAGER" && (
              <div>
                <label style={{
                  display: "flex", alignItems: "center", gap: 8,
                  cursor: "pointer", userSelect: "none",
                }}>
                  <input
                    type="checkbox"
                    checked={moduleRestrict}
                    onChange={e => setModuleRestrict(e.target.checked)}
                    style={{ accentColor: "#35BD78", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
                    Modul-korlátozás
                  </span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>
                    (csak bizonyos modulokhoz férjen hozzá)
                  </span>
                </label>

                {moduleRestrict && (
                  <div style={{
                    marginTop: 10, padding: 12,
                    background: "#F8FAFC", borderRadius: 12,
                    border: "1px solid #E2E8F0",
                  }}>
                    <p style={{ fontSize: 11, color: "#64748B", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Elérhető modulok
                    </p>
                    <ModuleSelector
                      selected={inviteModules}
                      onChange={setInviteModules}
                    />
                    {inviteModules.length === 0 && (
                      <p style={{ fontSize: 11, color: "#F59E0B", marginTop: 8 }}>
                        Figyelem: ha nincs modul kiválasztva, a tag teljes hozzáférést kap.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Role description */}
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#64748B" }}>
              <Crown size={12} style={{ color: "#35BD78" }} />
              <span><strong>Manager</strong> — teljes hozzáférés, tagok kezelése</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#64748B" }}>
              <Eye size={12} style={{ color: "#3B82F6" }} />
              <span><strong>Professional</strong> — csak olvasás</span>
            </div>
          </div>

          {/* Invite result */}
          {inviteResult && (
            <div className="mt-4 rounded-xl p-4"
              style={{
                background: inviteResult.type === "error" ? "#FEF2F2" : inviteResult.type === "added" ? "#F0FDF4" : "#FBFBFC",
                border: `1px solid ${inviteResult.type === "error" ? "#FECACA" : inviteResult.type === "added" ? "#BBF7D0" : "#DDD6FE"}`,
              }}>
              {inviteResult.type === "added" && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "#166534" }}>
                  <Check size={16} />
                  <span><strong>{inviteResult.name}</strong> sikeresen hozzáadva a csapathoz!</span>
                </div>
              )}
              {inviteResult.type === "invited" && (
                <div>
                  <p className="text-sm font-semibold mb-2" style={{ color: "#03915A" }}>
                    ✉️ Meghívó link generálva
                  </p>
                  <p className="text-xs mb-3" style={{ color: "#03915A" }}>
                    <strong>{inviteResult.email}</strong> még nem rendelkezik fiókkal. Küldd el ezt a linket:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs px-3 py-2 rounded-lg truncate"
                      style={{ background: "rgba(53,189,120,0.12)", color: "#03915A" }}>
                      {inviteResult.inviteUrl}
                    </code>
                    <button
                      onClick={() => copyLink((inviteResult as { type: "invited"; inviteUrl: string; email: string }).inviteUrl, "result")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                      style={{ background: "#35BD78", color: "white", border: "none", cursor: "pointer" }}>
                      {copiedToken === "result" ? <Check size={13} /> : <Copy size={13} />}
                      {copiedToken === "result" ? "Másolva!" : "Másolás"}
                    </button>
                  </div>
                </div>
              )}
              {inviteResult.type === "error" && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "#991B1B" }}>
                  <AlertTriangle size={15} />
                  {inviteResult.msg}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Members list ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
        <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <Users size={16} style={{ color: "#64748B" }} />
          <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>
            Csapattagok <span className="text-sm font-normal" style={{ color: "#94A3B8" }}>({data?.members.length ?? 0})</span>
          </h2>
        </div>

        {data?.members.map(m => {
          const rm = ROLE_META[m.role];
          const RoleIcon = rm.icon;
          const isSelf = m.userId === data.currentUserId;
          const isRemoving = removingId === m.userId;
          const isChanging = changingRoleId === m.userId;
          const color = avatarColor(m.email);
          const isEditingModules = editingModulesFor === m.userId;
          const hasModuleRestriction = m.role === "PROFESSIONAL" && m.modules.length > 0;

          return (
            <div key={m.userId}
              style={{ borderBottom: "1px solid #F8FAFC" }}>
              <div className="flex items-center gap-4 px-6 py-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: color + "22", color }}>
                  {initials(m.name, m.email)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>
                      {m.name ?? m.email}
                    </span>
                    {isSelf && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: "#F1F5F9", color: "#64748B" }}>te</span>
                    )}
                    {m.isSuperAdmin && (
                      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: "#FEF3C7", color: "#92400E" }}>
                        <ShieldCheck size={11} /> Admin
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Mail size={11} style={{ color: "#94A3B8" }} />
                    <span className="text-xs truncate" style={{ color: "#94A3B8" }}>{m.email}</span>
                  </div>

                  {/* Module badges */}
                  {m.role === "PROFESSIONAL" && !m.isSuperAdmin && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {hasModuleRestriction ? (
                        m.modules.map(mod => (
                          <span key={mod} style={{
                            fontSize: 11,
                            background: "rgba(53,189,120,0.12)",
                            color: "#03915A",
                            borderRadius: 8,
                            padding: "2px 8px",
                            fontWeight: 500,
                          }}>
                            {moduleLabel(mod)}
                          </span>
                        ))
                      ) : (
                        <span style={{
                          fontSize: 11,
                          background: "#F1F5F9",
                          color: "#64748B",
                          borderRadius: 8,
                          padding: "2px 8px",
                        }}>
                          Teljes hozzáférés
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit modules button (Professional only, manager action) */}
                {isManager && !isSelf && !m.isSuperAdmin && m.role === "PROFESSIONAL" && (
                  <button
                    onClick={() => {
                      if (isEditingModules) {
                        setEditingModulesFor(null);
                      } else {
                        startEditModules(m);
                      }
                    }}
                    style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: isEditingModules ? "rgba(53,189,120,0.12)" : "#F8FAFC",
                      border: `1px solid ${isEditingModules ? "rgba(53,189,120,0.4)" : "#E2E8F0"}`,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title="Modul-hozzáférés szerkesztése">
                    <Pencil size={13} style={{ color: isEditingModules ? "#35BD78" : "#64748B" }} />
                  </button>
                )}

                {/* Role */}
                {isManager && !isSelf && !m.isSuperAdmin ? (
                  <select
                    value={m.role}
                    onChange={e => handleChangeRole(m.userId, e.target.value as "MANAGER" | "PROFESSIONAL")}
                    disabled={isChanging}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{ background: rm.bg, color: rm.color, border: "none", outline: "none", cursor: "pointer" }}>
                    <option value="MANAGER">Manager</option>
                    <option value="PROFESSIONAL">Professional</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: rm.bg, color: rm.color }}>
                    <RoleIcon size={12} />
                    {rm.label}
                  </div>
                )}

                {/* Remove */}
                {isManager && !m.isSuperAdmin && (
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    disabled={isRemoving}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    style={{ background: "#FEF2F2", border: "none", cursor: "pointer" }}
                    title={isSelf ? "Kilépés a csapatból" : "Eltávolítás"}>
                    {isRemoving
                      ? <Loader2 size={14} className="animate-spin" style={{ color: "#EF4444" }} />
                      : <Trash2 size={14} style={{ color: "#EF4444" }} />
                    }
                  </button>
                )}
              </div>

              {/* Inline module editor */}
              {isEditingModules && (
                <div style={{
                  margin: "0 24px 16px",
                  padding: 16,
                  background: "#F8FAFC",
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Modul-hozzáférés szerkesztése
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setEditingModulesFor(null)}
                        style={{
                          fontSize: 12, padding: "4px 12px", borderRadius: 8,
                          background: "#F1F5F9", border: "1px solid #E2E8F0",
                          color: "#64748B", cursor: "pointer",
                        }}>
                        Mégse
                      </button>
                      <button
                        onClick={() => saveModules(m.userId)}
                        disabled={savingModules}
                        style={{
                          fontSize: 12, padding: "4px 12px", borderRadius: 8,
                          background: "#35BD78", border: "none",
                          color: "white", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                        {savingModules ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Mentés
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8 }}>
                    Ha nincs bejelölve modul, a tag teljes hozzáférést kap.
                  </p>
                  <ModuleSelector
                    selected={editModulesDraft}
                    onChange={setEditModulesDraft}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pending invites ── */}
      {data?.invites && data.invites.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
          <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid #E2E8F0" }}>
            <Mail size={16} style={{ color: "#64748B" }} />
            <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>
              Függőben lévő meghívók
              <span className="text-sm font-normal ml-2" style={{ color: "#94A3B8" }}>({data.invites.length})</span>
            </h2>
          </div>

          {data.invites.map(inv => {
            const rm = ROLE_META[inv.role];
            const RoleIcon = rm.icon;
            const inviteUrl = `${baseUrl}/invite/${inv.token}`;
            const isCopied = copiedToken === inv.token;
            const days = daysLeft(inv.expiresAt);

            return (
              <div key={inv.id} className="flex items-center gap-4 px-6 py-4"
                style={{ borderBottom: "1px solid #F8FAFC" }}>
                {/* Avatar placeholder */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#F1F5F9", border: "2px dashed #CBD5E1" }}>
                  <Mail size={16} style={{ color: "#94A3B8" }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{inv.email}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    Meghívó lejár: {days} nap múlva
                  </p>
                </div>

                {/* Role badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                  style={{ background: rm.bg, color: rm.color }}>
                  <RoleIcon size={12} />
                  {rm.label}
                </div>

                {/* Copy link */}
                <button
                  onClick={() => copyLink(inviteUrl, inv.token)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                  style={{ background: isCopied ? "#D1FAE5" : "rgba(53,189,120,0.12)", color: isCopied ? "#059669" : "#35BD78", border: "none", cursor: "pointer" }}>
                  {isCopied ? <Check size={13} /> : <Copy size={13} />}
                  {isCopied ? "Másolva!" : "Link"}
                </button>

                {/* Refresh (re-invite) */}
                <button
                  onClick={async () => {
                    await fetch("/api/team", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: inv.email, role: inv.role }),
                    });
                    await load();
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", cursor: "pointer" }}
                  title="Meghívó megújítása (7 nap)">
                  <RefreshCw size={13} style={{ color: "#64748B" }} />
                </button>

                {/* Revoke */}
                {isManager && (
                  <button
                    onClick={() => handleRevokeInvite(inv.token)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "#FEF2F2", border: "none", cursor: "pointer" }}
                    title="Meghívó visszavonása">
                    <X size={14} style={{ color: "#EF4444" }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
