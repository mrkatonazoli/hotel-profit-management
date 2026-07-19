"use client";

import { useEffect, useRef } from "react";
import {
  Chart, DoughnutController, ArcElement, Tooltip, Legend,
  type ChartConfiguration,
} from "chart.js";
import type { NationalityYear, NationalityCompare } from "./types";

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

const PALETTE = ["#818CF8", "#22D3EE", "#34D399", "#FBBF24", "#C084FC", "#FB7185", "#94A3B8", "#F97316", "#38BDF8"];
const fInt = (n: number) => new Intl.NumberFormat("hu-HU").format(n);
const fPct = (r: number) => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(r * 100) + " %";

const dPct = (cur: number, prev: number | null | undefined): number | null =>
  prev == null || prev === 0 ? null : ((cur - prev) / prev) * 100;
const fDelta = (d: number | null) =>
  d == null ? null : (d >= 0 ? "+" : "") + new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(d) + " %";

export default function NationalityView({ data, compare }: { data: NationalityYear; compare?: NationalityCompare | null }) {
  const donutRef = useRef<HTMLCanvasElement>(null);

  const top = data.countries.slice(0, 8);
  const otherNights = data.countries.slice(8).reduce((s, c) => s + c.nights, 0);

  useEffect(() => {
    if (!donutRef.current) return;
    const config: ChartConfiguration<"doughnut"> = {
      type: "doughnut",
      data: {
        labels: [...top.map((c) => c.name), ...(otherNights ? ["Egyéb"] : [])],
        datasets: [{
          data: [...top.map((c) => c.nights), ...(otherNights ? [otherNights] : [])],
          backgroundColor: [...top.map((_, i) => PALETTE[i % PALETTE.length]), "#52525B"],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "58%",
        plugins: { legend: { position: "right", labels: { color: "#8B90A3", font: { family: "'Inter', sans-serif" } } } },
      },
    };
    const chart = new Chart(donutRef.current, config);
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
        <Kpi label="Összes vendégéjszaka" value={fInt(data.totalNights)} delta={compare ? dPct(data.totalNights, compare.totalNights) : null} />
        <Kpi label="Belföldi" value={fPct(data.totalNights ? data.domesticNights / data.totalNights : 0)} sub={`${fInt(data.domesticNights)} éj`} delta={compare ? dPct(data.domesticNights, compare.domesticNights) : null} />
        <Kpi label="Külföldi" value={fPct(data.totalNights ? data.foreignNights / data.totalNights : 0)} sub={`${fInt(data.foreignNights)} éj`} delta={compare ? dPct(data.foreignNights, compare.foreignNights) : null} />
        <Kpi label="Küldő országok" value={String(data.countries.length)} sub={`${data.months.length} hónap adata`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Vendégéjszakák megoszlása</h3>
          <div style={{ height: 320 }}><canvas ref={donutRef} /></div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Országok</h3>
          <div style={{ overflowX: "auto", maxHeight: 340, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: "right", color: "var(--text-muted)" }}>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>Ország</th>
                  <th style={{ padding: "6px 10px" }}>Vendégéjszaka</th>
                  <th style={{ padding: "6px 10px" }}>Vendég</th>
                  <th style={{ padding: "6px 10px" }}>Részesedés</th>
                  {compare && <th style={{ padding: "6px 10px" }}>Δ éj (YoY)</th>}
                </tr>
              </thead>
              <tbody>
                {data.countries.map((c, i) => (
                  <tr key={c.code} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 10px" }}>
                      <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: i < 8 ? PALETTE[i % PALETTE.length] : "#52525B", marginRight: 8 }} />
                      {c.name}
                    </td>
                    <td style={{ textAlign: "right", padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{fInt(c.nights)}</td>
                    <td style={{ textAlign: "right", padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{fInt(c.guests)}</td>
                    <td style={{ textAlign: "right", padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{fPct(data.totalNights ? c.nights / data.totalNights : 0)}</td>
                    {compare && (() => { const d = dPct(c.nights, compare.nightsByCode[c.code]); return (
                      <td style={{ textAlign: "right", padding: "6px 10px", fontVariantNumeric: "tabular-nums", color: d == null ? "var(--text-muted)" : d >= 0 ? "var(--positive)" : "var(--negative)" }}>{fDelta(d) ?? "új"}</td>
                    ); })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number | null }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{sub}</div>}
      {delta != null && (
        <div style={{ fontSize: 12.5, marginTop: 3, color: delta >= 0 ? "var(--positive)" : "var(--negative)" }}>
          {delta >= 0 ? "▲" : "▼"} {fDelta(delta)} YoY
        </div>
      )}
    </div>
  );
}
