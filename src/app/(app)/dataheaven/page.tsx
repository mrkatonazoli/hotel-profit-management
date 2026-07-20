"use client";

import { useCallback, useEffect, useState } from "react";
import { useHotelChange } from "@/lib/hotel-context";
import Wordmark from "@/modules/dataheaven/Wordmark";
import Dashboard from "@/modules/dataheaven/Dashboard";
import ManagerView from "@/modules/dataheaven/ManagerView";
import ManagerTrend from "@/modules/dataheaven/ManagerTrend";
import NationalityView from "@/modules/dataheaven/NationalityView";
import ChannelPerformance from "@/modules/dataheaven/ChannelPerformance";
import ChannelTrend from "@/modules/dataheaven/ChannelTrend";
import type { MetricsBundle } from "@/modules/dataheaven/types";
import "@/modules/dataheaven/dh.css";

type Tab = "manager" | "segments" | "sales_channels" | "nationality" | "channel";
type DhHotel = { id: string; name: string; pms: string; domains: string[] };

const TAB_LABEL: Record<Tab, string> = {
  manager: "Manager riport",
  segments: "Szegmensek",
  sales_channels: "Értékesítési csatornák",
  nationality: "Nemzetiség",
  channel: "Channel Manager",
};

export default function DataHeavenPage() {
  const [bundle, setBundle] = useState<MetricsBundle | null>(null);
  const [notPaired, setNotPaired] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dhHotels, setDhHotels] = useState<DhHotel[]>([]);
  const [selectedDh, setSelectedDh] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [mFrom, setMFrom] = useState<number | null>(null);
  const [mTo, setMTo] = useState<number | null>(null);
  const [cmp, setCmp] = useState(false);
  const [month, setMonth] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("manager");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (y?: number | null, f?: number | null, t?: number | null, c?: boolean, m?: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (y) qs.set("year", String(y));
      if (f) qs.set("mfrom", String(f));
      if (t) qs.set("mto", String(t));
      if (c) qs.set("cmp", "1");
      if (m) qs.set("month", String(m));
      const res = await fetch(`/api/dataheaven/metrics${qs.size ? `?${qs.toString()}` : ""}`);
      if (res.status === 412) {
        const info = await res.json().catch(() => ({}));
        const admin = !!info.isAdmin;
        setIsAdmin(admin);
        setNotPaired(true);
        setBundle(null);
        if (admin) {
          const hres = await fetch("/api/dataheaven/hotels");
          const hdata = await hres.json().catch(() => ({}));
          if (hres.ok) setDhHotels(hdata.hotels ?? []);
          else setError(hdata.error ?? "Nem érhető el a DataHeaven hotel-lista.");
        }
        return;
      }
      if (!res.ok) throw new Error("Nem sikerült lekérni az adatokat.");
      const data: MetricsBundle = await res.json();
      setNotPaired(false);
      setIsAdmin(!!data.isAdmin);
      setBundle(data);
      setYear(data.year);
      const first: Tab | undefined = data.manager ? "manager" : data.segments ? "segments" : data.salesChannels ? "sales_channels" : data.nationality ? "nationality" : data.channel ? "channel" : undefined;
      setTab((t) => {
        const has = (x: Tab) =>
          (x === "manager" && data.manager) || (x === "segments" && data.segments) ||
          (x === "sales_channels" && data.salesChannels) ||
          (x === "nationality" && data.nationality) || (x === "channel" && data.channel);
        return has(t) ? t : first ?? "manager";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useHotelChange(() => { setBundle(null); setYear(null); setMFrom(null); setMTo(null); setMonth(null); setCmp(false); load(); });

  const monthsAvailable = (() => {
    if (!bundle) return [] as number[];
    const set = new Set<number>();
    bundle.segments?.months.forEach((m) => set.add(Number(m.slice(5))));
    bundle.salesChannels?.months.forEach((m) => set.add(Number(m.slice(5))));
    bundle.nationality?.months.forEach((m) => set.add(m));
    bundle.channel?.months.forEach((m) => set.add(m));
    return Array.from(set).sort((a, b) => a - b);
  })();
  const MONTH_NAMES = ["Jan", "Feb", "Már", "Ápr", "Máj", "Jún", "Júl", "Aug", "Szep", "Okt", "Nov", "Dec"];
  const selStyle: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13.5 };

  async function pair() {
    if (!selectedDh) return;
    await fetch("/api/dataheaven/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataheavenHotelId: selectedDh }),
    });
    load();
  }

  const tabs = bundle
    ? ([
        bundle.manager && "manager",
        bundle.segments && "segments",
        bundle.salesChannels && "sales_channels",
        bundle.nationality && "nationality",
        bundle.channel && "channel",
      ].filter(Boolean) as Tab[])
    : [];

  return (
    <div className="dh-scope" style={{ display: "grid", gap: 16, padding: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Wordmark size={26} />
        {bundle && <span style={{ fontSize: 15, fontWeight: 600 }}>· {bundle.hotel.name}</span>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {bundle && tab === "manager" && bundle.manager && (
            <>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Hónap:</span>
              <select
                value={month ?? bundle.manager.month}
                onChange={(e) => { const m = Number(e.target.value); setMonth(m); load(year, mFrom, mTo, cmp, m); }}
                style={selStyle}
              >
                {bundle.manager.months.map((m) => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
              </select>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
                <input type="checkbox" checked={cmp} onChange={(e) => { setCmp(e.target.checked); load(year, mFrom, mTo, e.target.checked, month); }} />
                vs előző év
              </label>
            </>
          )}
          {bundle && tab !== "manager" && monthsAvailable.length > 0 && (
            <>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Időszak:</span>
              <select
                value={mFrom ?? monthsAvailable[0]}
                onChange={(e) => { const f = Number(e.target.value); const t = Math.max(f, mTo ?? monthsAvailable[monthsAvailable.length - 1]); setMFrom(f); setMTo(t); load(year, f, t, cmp); }}
                style={selStyle}
              >
                {monthsAvailable.map((m) => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
              </select>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>–</span>
              <select
                value={mTo ?? monthsAvailable[monthsAvailable.length - 1]}
                onChange={(e) => { const t = Number(e.target.value); const f = Math.min(t, mFrom ?? monthsAvailable[0]); setMFrom(f); setMTo(t); load(year, f, t, cmp); }}
                style={selStyle}
              >
                {monthsAvailable.filter((m) => m >= (mFrom ?? monthsAvailable[0])).map((m) => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
              </select>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
                <input type="checkbox" checked={cmp} onChange={(e) => { setCmp(e.target.checked); load(year, mFrom, mTo, e.target.checked); }} />
                vs előző év
              </label>
            </>
          )}
          {bundle && bundle.years.length > 0 && (
            <select
              value={year ?? bundle.year}
              onChange={(e) => { const y = Number(e.target.value); setYear(y); setMFrom(null); setMTo(null); setMonth(null); load(y, null, null, cmp, null); }}
              style={selStyle}
            >
              {bundle.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {isAdmin && (
            <a
              href="https://data.katonazoli.hu/admin"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
            >
              Kezelés: DataHeaven Admin →
            </a>
          )}
        </span>
      </div>

      {loading && <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Betöltés…</div>}
      {error && <div className="card" style={{ padding: 20, color: "var(--negative)" }}>{error}</div>}

      {!loading && notPaired && !isAdmin && (
        <div className="card" style={{ padding: 28, display: "grid", gap: 10, maxWidth: 560 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Ez a hotel még nincs összekötve a DataHeavennel</h2>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>
            A párosítást a rendszergazda végzi el. Amint megtörtént, itt jelennek meg az élő PMS-riportok.
          </p>
        </div>
      )}

      {!loading && notPaired && isAdmin && (
        <div className="card" style={{ padding: 28, display: "grid", gap: 14, maxWidth: 560 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Hotel párosítása a DataHeavennel</h2>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>
            Válaszd ki, melyik DataHeaven-hotel adatai tartoznak ehhez a szállodához.
            A riportok ezután élőben érkeznek — a feltöltés és kezelés a DataHeaven Adminban történik.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              value={selectedDh}
              onChange={(e) => setSelectedDh(e.target.value)}
              style={{ flex: 1, minWidth: 240, padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14 }}
            >
              <option value="">— Válassz DataHeaven-hotelt —</option>
              {dhHotels.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.pms})</option>)}
            </select>
            <button
              onClick={pair}
              disabled={!selectedDh}
              style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: selectedDh ? "pointer" : "not-allowed", opacity: selectedDh ? 1 : 0.6 }}
            >
              Párosítás
            </button>
          </div>
        </div>
      )}

      {!loading && bundle && (
        <>
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
            {tabs.map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  border: "none", background: "none", cursor: "pointer",
                  padding: "9px 14px", fontSize: 14,
                  fontWeight: tab === k ? 700 : 500,
                  color: tab === k ? "var(--accent)" : "var(--text-muted)",
                  borderBottom: tab === k ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {TAB_LABEL[k]}
              </button>
            ))}
          </div>

          {tab === "manager" && bundle.manager && (
            <div style={{ display: "grid", gap: 14 }}>
              <ManagerView data={bundle.manager} compare={cmp} />
              {bundle.manager.trend.months.length > 1 && (
                <ManagerTrend trend={bundle.manager.trend} year={bundle.manager.year} prevYear={bundle.manager.prevYear} />
              )}
            </div>
          )}
          {tab === "segments" && bundle.segments && <Dashboard data={bundle.segments} compare={bundle.segmentsCompare} />}
          {tab === "sales_channels" && bundle.salesChannels && <Dashboard data={bundle.salesChannels} compare={bundle.salesChannelsCompare} />}
          {tab === "nationality" && bundle.nationality && <NationalityView data={bundle.nationality} compare={bundle.nationalityCompare} />}
          {tab === "channel" && bundle.channel && (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {bundle.channel.period.label} vs {bundle.channel.period.compareLabel} (YoY)
              </div>
              <ChannelPerformance period={bundle.channel.period} />
              {bundle.channel.monthly.months.length > 1 && (
                <ChannelTrend data={bundle.channel.monthly} directName={bundle.channel.period.directChannel} />
              )}
            </div>
          )}

          {tabs.length === 0 && (
            <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
              Még nincs feltöltött adat ehhez a hotelhez — tölts fel riportokat a DataHeaven Adminban.
            </div>
          )}
        </>
      )}
    </div>
  );
}
