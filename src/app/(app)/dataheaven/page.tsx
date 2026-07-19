"use client";

import { useCallback, useEffect, useState } from "react";
import { useHotelChange } from "@/lib/hotel-context";
import Wordmark from "@/modules/dataheaven/Wordmark";
import Dashboard from "@/modules/dataheaven/Dashboard";
import NationalityView from "@/modules/dataheaven/NationalityView";
import ChannelPerformance from "@/modules/dataheaven/ChannelPerformance";
import ChannelTrend from "@/modules/dataheaven/ChannelTrend";
import type { MetricsBundle } from "@/modules/dataheaven/types";
import "@/modules/dataheaven/dh.css";

type Tab = "segments" | "sales_channels" | "nationality" | "channel";
type DhHotel = { id: string; name: string; pms: string; domains: string[] };

const TAB_LABEL: Record<Tab, string> = {
  segments: "Szegmensek",
  sales_channels: "Értékesítési csatornák",
  nationality: "Nemzetiség",
  channel: "Channel Manager",
};

export default function DataHeavenPage() {
  const [bundle, setBundle] = useState<MetricsBundle | null>(null);
  const [notPaired, setNotPaired] = useState(false);
  const [dhHotels, setDhHotels] = useState<DhHotel[]>([]);
  const [selectedDh, setSelectedDh] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("segments");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (y?: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dataheaven/metrics${y ? `?year=${y}` : ""}`);
      if (res.status === 412) {
        setNotPaired(true);
        setBundle(null);
        const hres = await fetch("/api/dataheaven/hotels");
        if (hres.ok) setDhHotels((await hres.json()).hotels ?? []);
        return;
      }
      if (!res.ok) throw new Error("Nem sikerült lekérni az adatokat.");
      const data: MetricsBundle = await res.json();
      setNotPaired(false);
      setBundle(data);
      setYear(data.year);
      const first: Tab | undefined = data.segments ? "segments" : data.salesChannels ? "sales_channels" : data.nationality ? "nationality" : data.channel ? "channel" : undefined;
      setTab((t) => {
        const has = (x: Tab) =>
          (x === "segments" && data.segments) || (x === "sales_channels" && data.salesChannels) ||
          (x === "nationality" && data.nationality) || (x === "channel" && data.channel);
        return has(t) ? t : first ?? "segments";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useHotelChange(() => { setBundle(null); setYear(null); load(); });

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
        <span style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {bundle && bundle.years.length > 0 && (
            <select
              value={year ?? bundle.year}
              onChange={(e) => { const y = Number(e.target.value); setYear(y); load(y); }}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13.5 }}
            >
              {bundle.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <a
            href="https://data.katonazoli.hu/admin"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
          >
            Kezelés: DataHeaven Admin →
          </a>
        </span>
      </div>

      {loading && <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Betöltés…</div>}
      {error && <div className="card" style={{ padding: 20, color: "var(--negative)" }}>{error}</div>}

      {!loading && notPaired && (
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

          {tab === "segments" && bundle.segments && <Dashboard data={bundle.segments} />}
          {tab === "sales_channels" && bundle.salesChannels && <Dashboard data={bundle.salesChannels} />}
          {tab === "nationality" && bundle.nationality && <NationalityView data={bundle.nationality} />}
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
