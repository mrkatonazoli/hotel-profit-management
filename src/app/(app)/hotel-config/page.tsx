"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Building2, Bed, Loader2, Pencil, X, Check, Phone, Mail, Receipt, Users, Baby } from "lucide-react";

type RoomType = { id: string; name: string; count: number; maxOccupancy: number | null };
type ChildAgeGroup = { id: string; name: string; minAge: number; maxAge: number; sortOrder: number };
type Hotel = {
  id: string; name: string; city: string; country: string; baseCurrency: string;
  totalRooms: number | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null;
  billingName: string | null; billingAddress: string | null; billingTaxNumber: string | null;
  roomTypes: RoomType[];
};

type HotelForm = {
  name: string; city: string; country: string; baseCurrency: string;
  totalRooms: string; contactName: string; contactEmail: string; contactPhone: string;
  billingName: string; billingAddress: string; billingTaxNumber: string;
};

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

const emptyForm: HotelForm = {
  name: "", city: "", country: "HU", baseCurrency: "HUF",
  totalRooms: "", contactName: "", contactEmail: "", contactPhone: "",
  billingName: "", billingAddress: "", billingTaxNumber: "",
};

export default function HotelConfigPage() {
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HotelForm>(emptyForm);
  const [saved, setSaved] = useState(false);

  const [newRt, setNewRt] = useState({ name: "", count: "", maxOccupancy: "" });
  const [addingRt, setAddingRt] = useState(false);
  const [editingRtId, setEditingRtId] = useState<string | null>(null);
  const [editRt, setEditRt] = useState({ name: "", count: "", maxOccupancy: "" });
  const [rtLoading, setRtLoading] = useState<string | null>(null);

  // Child age groups
  const [childGroups, setChildGroups] = useState<ChildAgeGroup[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", minAge: "", maxAge: "" });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroup, setEditGroup] = useState({ name: "", minAge: "", maxAge: "" });
  const [groupLoading, setGroupLoading] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Board types
  const [activeBoardTypes, setActiveBoardTypes] = useState<string[]>([]);
  const [boardTypeSaving, setBoardTypeSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/hotels");
        if (res.ok) {
          const data = await res.json();
          if (data?.id) {
            setHotel(data);
            setForm({
              name: data.name ?? "", city: data.city ?? "", country: data.country ?? "HU",
              baseCurrency: data.baseCurrency ?? "HUF", totalRooms: data.totalRooms ? String(data.totalRooms) : "",
              contactName: data.contactName ?? "", contactEmail: data.contactEmail ?? "", contactPhone: data.contactPhone ?? "",
              billingName: data.billingName ?? "", billingAddress: data.billingAddress ?? "",
              billingTaxNumber: data.billingTaxNumber ?? "",
            });
          }
        }
      } catch {
        // network error — oldal betölt üres állapotban
      } finally {
        setLoading(false);
      }

      try {
        const res = await fetch("/api/child-age-groups");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setChildGroups(data);
        }
      } catch {
        // silent
      }

      try {
        const res = await fetch("/api/hotel-board-types");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setActiveBoardTypes(data);
        }
      } catch {
        // silent
      }
    }
    load();
  }, []);

  async function handleAddGroup() {
    const name = newGroup.name.trim();
    const minAge = newGroup.minAge === "" ? null : Number(newGroup.minAge);
    const maxAge = newGroup.maxAge === "" ? null : Number(newGroup.maxAge);
    if (!name) { setGroupError("A megnevezés megadása kötelező."); return; }
    if (minAge === null) { setGroupError("A minimum kor megadása kötelező."); return; }
    if (maxAge === null) { setGroupError("A maximum kor megadása kötelező."); return; }
    if (minAge > maxAge) { setGroupError("A minimum kor nem lehet nagyobb mint a maximum."); return; }
    setGroupError(null);
    setGroupLoading("new");
    try {
      const res = await fetch("/api/child-age-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, minAge, maxAge, sortOrder: childGroups.length }),
      });
      let g: Record<string, unknown> | null = null;
      try { g = await res.json(); } catch { /* nem JSON body */ }
      if (!res.ok) {
        setGroupError((g as { error?: string } | null)?.error ?? `Szerverhiba (${res.status})`);
        return;
      }
      if (g && typeof g === "object" && "id" in g) {
        setChildGroups(prev => [...prev, g as unknown as ChildAgeGroup]);
        setNewGroup({ name: "", minAge: "", maxAge: "" });
        setAddingGroup(false);
      } else {
        setGroupError("Váratlan szerver válasz. Töltsd újra az oldalt.");
      }
    } catch {
      setGroupError("Hálózati hiba — ellenőrizd az internetkapcsolatot.");
    } finally {
      setGroupLoading(null);
    }
  }

  async function handleUpdateGroup(id: string) {
    const name = editGroup.name.trim();
    const minAge = editGroup.minAge === "" ? null : Number(editGroup.minAge);
    const maxAge = editGroup.maxAge === "" ? null : Number(editGroup.maxAge);
    if (!name || minAge === null || maxAge === null) return;
    setGroupLoading(id);
    setGroupError(null);
    try {
      const res = await fetch(`/api/child-age-groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, minAge, maxAge }),
      });
      let g: Record<string, unknown> | null = null;
      try { g = await res.json(); } catch { /* nem JSON body */ }
      if (!res.ok) {
        setGroupError((g as { error?: string } | null)?.error ?? `Szerverhiba (${res.status})`);
        return;
      }
      if (g && "id" in g) {
        setChildGroups(prev => prev.map(x => x.id === id ? g as unknown as ChildAgeGroup : x));
        setEditingGroupId(null);
      }
    } catch {
      setGroupError("Hálózati hiba — ellenőrizd az internetkapcsolatot.");
    } finally {
      setGroupLoading(null);
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("Biztosan törlöd ezt a korcsoportot? Az összes kapcsolódó létszámadat törlődik.")) return;
    setGroupLoading(id);
    try {
      await fetch(`/api/child-age-groups/${id}`, { method: "DELETE" });
      setChildGroups(prev => prev.filter(x => x.id !== id));
    } finally {
      setGroupLoading(null);
    }
  }

  async function handleSaveHotel(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      totalRooms: form.totalRooms ? Number(form.totalRooms) : null,
      contactName: form.contactName || null,
      contactEmail: form.contactEmail || null,
      contactPhone: form.contactPhone || null,
      billingName: form.billingName || null,
      billingAddress: form.billingAddress || null,
      billingTaxNumber: form.billingTaxNumber || null,
    };
    const url = hotel ? `/api/hotels/${hotel.id}` : "/api/hotels";
    const method = hotel ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    setHotel(data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Szobaszám validáció
  function usedRooms(excludeId?: string) {
    if (!hotel) return 0;
    return hotel.roomTypes
      .filter(r => r.id !== excludeId)
      .reduce((s, r) => s + r.count, 0);
  }

  function roomsLeft(excludeId?: string) {
    if (!hotel?.totalRooms) return null;
    return hotel.totalRooms - usedRooms(excludeId);
  }

  function roomCountError(count: string, excludeId?: string) {
    const limit = roomsLeft(excludeId);
    if (limit === null || !count) return null;
    if (Number(count) > limit) return `Maximum ${limit} szoba adható hozzá (összes: ${hotel!.totalRooms})`;
    return null;
  }

  async function handleAddRoomType(e: React.FormEvent) {
    e.preventDefault();
    if (!hotel || !newRt.name || !newRt.count) return;
    if (roomCountError(newRt.count)) return;
    setRtLoading("new");
    const res = await fetch(`/api/hotels/${hotel.id}/room-types`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRt.name, count: Number(newRt.count), maxOccupancy: newRt.maxOccupancy ? Number(newRt.maxOccupancy) : null }),
    });
    const rt = await res.json();
    setHotel(h => h ? { ...h, roomTypes: [...h.roomTypes, rt] } : h);
    setNewRt({ name: "", count: "", maxOccupancy: "" });
    setAddingRt(false);
    setRtLoading(null);
  }

  async function handleUpdateRoomType(id: string) {
    if (!hotel) return;
    if (roomCountError(editRt.count, id)) return;
    setRtLoading(id);
    const res = await fetch(`/api/hotels/${hotel.id}/room-types/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editRt.name, count: Number(editRt.count), maxOccupancy: editRt.maxOccupancy ? Number(editRt.maxOccupancy) : null }),
    });
    const rt = await res.json();
    setHotel(h => h ? { ...h, roomTypes: h.roomTypes.map(r => r.id === id ? rt : r) } : h);
    setEditingRtId(null);
    setRtLoading(null);
  }

  async function handleDeleteRoomType(id: string) {
    if (!hotel || !confirm("Biztosan törlöd ezt a szobatípust?")) return;
    setRtLoading(id);
    await fetch(`/api/hotels/${hotel.id}/room-types/${id}`, { method: "DELETE" });
    setHotel(h => h ? { ...h, roomTypes: h.roomTypes.filter(r => r.id !== id) } : h);
    setRtLoading(null);
  }

  const f = (k: keyof HotelForm) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Hotel beállítások</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>Alapadatok, elérhetőségek és szobatípusok</p>
      </div>

      <form onSubmit={handleSaveHotel} className="space-y-4">

        {/* ── ALAPADATOK ── */}
        <Section icon={<Building2 size={18} style={{ color: "#7C3AED" }} />} iconBg="#EDE9FE" title="Alapadatok">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Szálloda neve" required>
              <input type="text" required placeholder="pl. Hotel Panoráma" className="hp-input" {...f("name")} />
            </Field>
            <Field label="Város" required>
              <input type="text" required placeholder="pl. Budapest" className="hp-input" {...f("city")} />
            </Field>
            <Field label="Ország">
              <select className="hp-input" {...f("country")}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Alap pénznem">
              <select className="hp-input" {...f("baseCurrency")}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Teljes szobaszám">
              <input type="number" min={1} placeholder="pl. 42" className="hp-input" {...f("totalRooms")} />
            </Field>
          </div>
        </Section>

        {/* ── KAPCSOLAT ── */}
        <Section icon={<Phone size={18} style={{ color: "#3B82F6" }} />} iconBg="#DBEAFE" title="Kapcsolattartó">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Kapcsolattartó neve">
              <input type="text" placeholder="pl. Nagy János" className="hp-input" {...f("contactName")} />
            </Field>
            <Field label="E-mail cím">
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                <input type="email" placeholder="info@szalloda.hu" className="hp-input pl-9" {...f("contactEmail")} />
              </div>
            </Field>
            <Field label="Telefonszám">
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                <input type="tel" placeholder="+36 1 234 5678" className="hp-input pl-9" {...f("contactPhone")} />
              </div>
            </Field>
          </div>
        </Section>

        {/* ── SZÁMLÁZÁS ── */}
        <Section icon={<Receipt size={18} style={{ color: "#F59E0B" }} />} iconBg="#FEF3C7" title="Számlázási adatok">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Számlázási név">
              <input type="text" placeholder="pl. Panoráma Hotel Kft." className="hp-input" {...f("billingName")} />
            </Field>
            <Field label="Adószám">
              <input type="text" placeholder="12345678-2-41" className="hp-input" {...f("billingTaxNumber")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Számlázási cím">
                <input type="text" placeholder="1052 Budapest, Váci utca 10." className="hp-input" {...f("billingAddress")} />
              </Field>
            </div>
          </div>
        </Section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: saved ? "#10B981" : "#7C3AED", color: "white" }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
            {saving ? "Mentés..." : saved ? "Mentve!" : "Mentés"}
          </button>
        </div>
      </form>

      {/* ── SZOBATÍPUSOK ── */}
      <div className="rounded-2xl p-6" style={{ background: "white", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#D1FAE5" }}>
              <Bed size={18} style={{ color: "#10B981" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Szobatípusok</h2>
              {hotel && hotel.totalRooms && (
                <p className="text-xs" style={{ color: usedRooms() > hotel.totalRooms ? "#EF4444" : "#94A3B8" }}>
                  {hotel.roomTypes.reduce((s, r) => s + r.count, 0)} / {hotel.totalRooms} szoba
                </p>
              )}
              {hotel && !hotel.totalRooms && hotel.roomTypes.length > 0 && (
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  Összesen: {hotel.roomTypes.reduce((s, r) => s + r.count, 0)} szoba
                </p>
              )}
            </div>
          </div>
          {hotel && !addingRt && (
            <button
              onClick={() => setAddingRt(true)}
              disabled={hotel.totalRooms != null && usedRooms() >= hotel.totalRooms}
              title={hotel.totalRooms != null && usedRooms() >= hotel.totalRooms ? `Elérted a maximumot (${hotel.totalRooms} szoba)` : undefined}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#F1F5F9", color: "#334155" }}>
              <Plus size={14} /> Új szobatípus
            </button>
          )}
        </div>

        {!hotel && (
          <p className="text-sm text-center py-6" style={{ color: "#94A3B8" }}>
            Előbb mentsd el az alapadatokat, majd adj hozzá szobatípusokat.
          </p>
        )}

        {hotel && (
          <div className="space-y-2">
            {hotel.roomTypes.length > 0 && (
              <div className="grid grid-cols-12 gap-3 px-3 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>
                <div className="col-span-5">Megnevezés</div>
                <div className="col-span-2 text-right">Szobák</div>
                <div className="col-span-3 text-right">Max férőhely</div>
                <div className="col-span-2" />
              </div>
            )}

            {hotel.roomTypes.map(rt => (
              <div key={rt.id} className="grid grid-cols-12 gap-3 items-center px-3 py-2.5 rounded-xl" style={{ background: "#F8FAFC" }}>
                {editingRtId === rt.id ? (
                  <>
                    <div className="col-span-5"><input value={editRt.name} onChange={e => setEditRt(r => ({ ...r, name: e.target.value }))} className="hp-input py-1.5 text-sm" /></div>
                    <div className="col-span-2">
                      <input type="number" value={editRt.count} onChange={e => setEditRt(r => ({ ...r, count: e.target.value }))}
                        className="hp-input py-1.5 text-sm text-right"
                        style={roomCountError(editRt.count, rt.id) ? { borderColor: "#EF4444" } : {}} />
                      {roomCountError(editRt.count, rt.id) && (
                        <p className="text-xs mt-0.5 text-right" style={{ color: "#EF4444" }}>
                          Max: {roomsLeft(rt.id)} db
                        </p>
                      )}
                    </div>
                    <div className="col-span-3"><input type="number" value={editRt.maxOccupancy} onChange={e => setEditRt(r => ({ ...r, maxOccupancy: e.target.value }))} className="hp-input py-1.5 text-sm text-right" placeholder="—" /></div>
                    <div className="col-span-2 flex gap-1 justify-end">
                      <button onClick={() => handleUpdateRoomType(rt.id)}
                        disabled={!!roomCountError(editRt.count, rt.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-40"
                        style={{ background: "#D1FAE5", color: "#10B981" }}>
                        {rtLoading === rt.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button onClick={() => setEditingRtId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#F1F5F9", color: "#64748B" }}>
                        <X size={13} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-5 text-sm font-medium" style={{ color: "#0F172A" }}>{rt.name}</div>
                    <div className="col-span-2 text-sm text-right font-mono" style={{ color: "#334155" }}>{rt.count} db</div>
                    <div className="col-span-3 text-sm text-right font-mono" style={{ color: "#64748B" }}>
                      {rt.maxOccupancy ? (
                        <span className="flex items-center justify-end gap-1">
                          <Users size={11} style={{ color: "#94A3B8" }} />
                          {rt.maxOccupancy} fő
                        </span>
                      ) : "—"}
                    </div>
                    <div className="col-span-2 flex gap-1 justify-end">
                      <button onClick={() => { setEditingRtId(rt.id); setEditRt({ name: rt.name, count: String(rt.count), maxOccupancy: rt.maxOccupancy ? String(rt.maxOccupancy) : "" }); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#F1F5F9", color: "#64748B" }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDeleteRoomType(rt.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#FEE2E2", color: "#EF4444" }}>
                        {rtLoading === rt.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {hotel.roomTypes.length === 0 && !addingRt && (
              <p className="text-sm text-center py-6" style={{ color: "#94A3B8" }}>
                Még nincs szobatípus. Adj hozzá egyet a „+ Új szobatípus" gombbal.
              </p>
            )}

            {addingRt && (
              <form onSubmit={handleAddRoomType} className="grid grid-cols-12 gap-3 items-start px-3 py-2.5 rounded-xl" style={{ background: "#EDE9FE" }}>
                <div className="col-span-5">
                  <input autoFocus required value={newRt.name} onChange={e => setNewRt(r => ({ ...r, name: e.target.value }))}
                    placeholder="pl. Superior kétágyas" className="hp-input py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  <input type="number" required min={1} value={newRt.count} onChange={e => setNewRt(r => ({ ...r, count: e.target.value }))}
                    placeholder="db" className="hp-input py-1.5 text-sm text-right"
                    style={roomCountError(newRt.count) ? { borderColor: "#EF4444" } : {}} />
                  {roomCountError(newRt.count) && (
                    <p className="text-xs mt-0.5 text-right" style={{ color: "#EF4444" }}>
                      Max: {roomsLeft()} db
                    </p>
                  )}
                </div>
                <div className="col-span-3">
                  <input type="number" min={1} value={newRt.maxOccupancy} onChange={e => setNewRt(r => ({ ...r, maxOccupancy: e.target.value }))}
                    placeholder="fő" className="hp-input py-1.5 text-sm text-right" />
                </div>
                <div className="col-span-2 flex gap-1 justify-end pt-0.5">
                  <button type="submit" disabled={!!roomCountError(newRt.count)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-40"
                    style={{ background: "#7C3AED", color: "white" }}>
                    {rtLoading === "new" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </button>
                  <button type="button" onClick={() => { setAddingRt(false); setNewRt({ name: "", count: "", maxOccupancy: "" }); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#F1F5F9", color: "#64748B" }}>
                    <X size={13} />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ── GYEREKKORCSOPORTOK ── */}
      <div className="rounded-2xl p-6" style={{ background: "white", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#FEF3C7" }}>
              <Baby size={18} style={{ color: "#F59E0B" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Gyerekkorcsoportok</h2>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                Létszámriportokban használt korhatárok — pl. 0–2 év, 3–6 év, 7–14 év
              </p>
            </div>
          </div>
          {!addingGroup && (
            <button onClick={() => setAddingGroup(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
              style={{ background: "#F1F5F9", color: "#334155" }}>
              <Plus size={14} /> Új korcsoport
            </button>
          )}
        </div>

        <div className="space-y-2">
          {childGroups.length > 0 && (
            <div className="grid grid-cols-12 gap-3 px-3 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>
              <div className="col-span-5">Megnevezés</div>
              <div className="col-span-2 text-right">Min. kor</div>
              <div className="col-span-3 text-right">Max. kor</div>
              <div className="col-span-2" />
            </div>
          )}

          {childGroups.map(g => (
            <div key={g.id} className="grid grid-cols-12 gap-3 items-center px-3 py-2.5 rounded-xl" style={{ background: "#F8FAFC" }}>
              {editingGroupId === g.id ? (
                <>
                  <div className="col-span-5">
                    <input autoFocus value={editGroup.name}
                      onChange={e => setEditGroup(x => ({ ...x, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") handleUpdateGroup(g.id); if (e.key === "Escape") setEditingGroupId(null); }}
                      className="hp-input py-1.5 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min={0} max={99} value={editGroup.minAge}
                      onChange={e => setEditGroup(x => ({ ...x, minAge: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") handleUpdateGroup(g.id); }}
                      className="hp-input py-1.5 text-sm text-right" placeholder="év" />
                  </div>
                  <div className="col-span-3">
                    <input type="number" min={0} max={99} value={editGroup.maxAge}
                      onChange={e => setEditGroup(x => ({ ...x, maxAge: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") handleUpdateGroup(g.id); }}
                      className="hp-input py-1.5 text-sm text-right" placeholder="év" />
                  </div>
                  <div className="col-span-2 flex gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => handleUpdateGroup(g.id)}
                      disabled={groupLoading === g.id}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-60"
                      style={{ background: "#D1FAE5", color: "#10B981" }}>
                      {groupLoading === g.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingGroupId(null); setGroupError(null); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "#F1F5F9", color: "#64748B" }}>
                      <X size={13} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-5 flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: "#0F172A" }}>{g.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#FEF3C7", color: "#D97706" }}>
                      {g.minAge}–{g.maxAge} év
                    </span>
                  </div>
                  <div className="col-span-2 text-sm text-right font-mono" style={{ color: "#334155" }}>{g.minAge} év</div>
                  <div className="col-span-3 text-sm text-right font-mono" style={{ color: "#334155" }}>{g.maxAge} év</div>
                  <div className="col-span-2 flex gap-1 justify-end">
                    <button onClick={() => { setEditingGroupId(g.id); setEditGroup({ name: g.name, minAge: String(g.minAge), maxAge: String(g.maxAge) }); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#F1F5F9", color: "#64748B" }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDeleteGroup(g.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#FEE2E2", color: "#EF4444" }}>
                      {groupLoading === g.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {childGroups.length === 0 && !addingGroup && (
            <p className="text-sm text-center py-6" style={{ color: "#94A3B8" }}>
              Még nincs korcsoport beállítva. Adj hozzá egyet a „+ Új korcsoport" gombbal.
            </p>
          )}

          {groupError && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#FEE2E2", color: "#DC2626" }}>
              {groupError}
            </p>
          )}

          {addingGroup && (
            <div className="grid grid-cols-12 gap-3 items-start px-3 py-2.5 rounded-xl" style={{ background: "#FEF9EC" }}>
              <div className="col-span-5">
                <input
                  autoFocus
                  value={newGroup.name}
                  onChange={e => setNewGroup(x => ({ ...x, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") handleAddGroup(); if (e.key === "Escape") { setAddingGroup(false); setGroupError(null); } }}
                  placeholder="pl. Kisgyermek"
                  className="hp-input py-1.5 text-sm"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={newGroup.minAge}
                  onChange={e => setNewGroup(x => ({ ...x, minAge: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") handleAddGroup(); }}
                  placeholder="Min. év"
                  className="hp-input py-1.5 text-sm text-right"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={newGroup.maxAge}
                  onChange={e => setNewGroup(x => ({ ...x, maxAge: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") handleAddGroup(); }}
                  placeholder="Max. év"
                  className="hp-input py-1.5 text-sm text-right"
                />
              </div>
              <div className="col-span-2 flex gap-1 justify-end pt-0.5">
                <button
                  type="button"
                  onClick={handleAddGroup}
                  disabled={groupLoading === "new"}
                  className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-60"
                  style={{ background: "#F59E0B", color: "white" }}>
                  {groupLoading === "new" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingGroup(false); setNewGroup({ name: "", minAge: "", maxAge: "" }); setGroupError(null); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "#F1F5F9", color: "#64748B" }}>
                  <X size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Ellátástípusok ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6" style={{ background: "white", border: "1px solid #E2E8F0" }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#EDE9FE" }}>
            <span style={{ fontSize: 18 }}>🍽️</span>
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>Ellátástípusok</h2>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Jelöld be, melyik ellátástípusokat kínálja a szállodád</p>
          </div>
        </div>

        <div className="space-y-2">
          {([
            { code: "RO", label: "Room Only", hu: "Csak szoba" },
            { code: "BB", label: "Bed & Breakfast", hu: "Reggeli" },
            { code: "HB", label: "Half Board", hu: "Félpanzió" },
            { code: "FB", label: "Full Board", hu: "Teljes panzió" },
            { code: "AI", label: "All Inclusive", hu: "All Inclusive" },
          ] as const).map(bt => {
            const active = activeBoardTypes.includes(bt.code);
            const COLOR: Record<string, { bg: string; text: string }> = {
              RO: { bg: "#F1F5F9", text: "#64748B" },
              BB: { bg: "#DBEAFE", text: "#1D4ED8" },
              HB: { bg: "#D1FAE5", text: "#065F46" },
              FB: { bg: "#EDE9FE", text: "#5B21B6" },
              AI: { bg: "#FEF3C7", text: "#92400E" },
            };
            const c = COLOR[bt.code];
            return (
              <label key={bt.code}
                className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
                style={{
                  border: `1.5px solid ${active ? c.text + "50" : "#E2E8F0"}`,
                  background: active ? c.bg : "white",
                }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...activeBoardTypes, bt.code]
                      : activeBoardTypes.filter(x => x !== bt.code);
                    setActiveBoardTypes(next);
                  }}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: c.text }}
                />
                <span className="font-bold text-sm px-2 py-0.5 rounded-lg"
                  style={{ background: active ? "white" : c.bg, color: c.text }}>
                  {bt.code}
                </span>
                <span className="text-sm font-semibold" style={{ color: active ? "#0F172A" : "#94A3B8" }}>
                  {bt.hu}
                </span>
                <span className="text-xs ml-auto" style={{ color: "#CBD5E1" }}>{bt.label}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={boardTypeSaving}
            onClick={async () => {
              setBoardTypeSaving(true);
              try {
                await fetch("/api/hotel-board-types", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ boardTypes: activeBoardTypes }),
                });
              } finally {
                setBoardTypeSaving(false);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "#7C3AED", color: "white", opacity: boardTypeSaving ? 0.6 : 1 }}>
            {boardTypeSaving
              ? <><Loader2 size={14} className="animate-spin" /> Mentés…</>
              : <><Check size={14} /> Ellátástípusok mentése</>}
          </button>
        </div>
      </div>

      <style>{`
        .hp-input {
          width: 100%; padding: 10px 12px; border: 1.5px solid #E2E8F0;
          border-radius: 10px; font-size: 14px; font-family: inherit;
          color: #0F172A; background: white; outline: none;
          transition: border-color .15s, box-shadow .15s; box-sizing: border-box;
        }
        .hp-input:focus { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
        .hp-input.pl-9 { padding-left: 2.25rem; }
      `}</style>
    </div>
  );
}

function Section({ icon, iconBg, title, children }: { icon: React.ReactNode; iconBg: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "white", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>{icon}</div>
        <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#334155", letterSpacing: "0.06em" }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
