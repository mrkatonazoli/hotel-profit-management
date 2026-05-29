"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, X, Loader2 } from "lucide-react";

type Hotel = {
  id: string;
  name: string;
  city?: string;
  baseCurrency: string;
  totalRooms?: number | null;
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

const defaultForm = {
  name: "",
  city: "",
  country: "HU",
  baseCurrency: "HUF",
  totalRooms: "",
};

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
          <p className="text-sm text-slate-500 mt-1">SUPER_ADMIN — összes szálloda kezelése</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(""); setForm(defaultForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: "#7C3AED" }}
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Szálloda neve *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="pl. Grand Hotel Budapest"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Város *
                </label>
                <input
                  type="text"
                  required
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="pl. Budapest"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Ország
                </label>
                <select
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500 bg-white"
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Alap pénznem
                </label>
                <select
                  value={form.baseCurrency}
                  onChange={e => setForm(f => ({ ...f, baseCurrency: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500 bg-white"
                >
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Szobaszám
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.totalRooms}
                  onChange={e => setForm(f => ({ ...f, totalRooms: e.target.value }))}
                  placeholder="pl. 42"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
                style={{ background: "#7C3AED" }}
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Mentés...</> : "Létrehozás"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg text-slate-600 text-sm font-semibold border border-slate-200 hover:bg-slate-50"
              >
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
            <div key={hotel.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EDE9FE" }}>
                  <Building2 size={18} style={{ color: "#7C3AED" }} />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{hotel.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {hotel.city && `${hotel.city} · `}{hotel.baseCurrency}
                    {hotel.totalRooms ? ` · ${hotel.totalRooms} szoba` : ""}
                  </div>
                </div>
              </div>
              <div className="text-xs font-mono text-slate-300">{hotel.id.slice(0, 8)}…</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
