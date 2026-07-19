"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  type ChartConfiguration,
} from "chart.js";
import type { Dataset, DatasetCompare } from "./types";
import { formatHuf, formatPct } from "./types";

Chart.register(
  LineController, LineElement, PointElement,
  BarController, BarElement,
  DoughnutController, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
);

// Theme-neutral chart chrome (readable in both dark and light).
Chart.defaults.color = "#8B90A3";
Chart.defaults.borderColor = "rgba(140,146,166,0.20)";
Chart.defaults.font.family = "'Inter', ui-sans-serif, system-ui, sans-serif";

const sumN = (a: (number | null)[]) => a.reduce<number>((s, v) => s + (v ?? 0), 0);

function useChart(makeConfig: () => ChartConfiguration, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, makeConfig());
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

const dPct = (cur: number | null, prev: number | null | undefined): number | null =>
  cur == null || prev == null || prev === 0 ? null : ((cur - prev) / prev) * 100;
const fDelta = (d: number | null) =>
  d == null ? null : (d >= 0 ? "+" : "") + new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(d) + " %";

export default function Dashboard({ data, compare }: { data: Dataset; compare?: DatasetCompare | null }) {
  const totalRev = sumN(data.totalRevenue);
  const totalRooms = sumN(data.totalRooms);
  const avgOcc = data.occ.length ? sumN(data.occ) / data.occ.length : null;
  const revPerSold = totalRooms ? totalRev / totalRooms : null;
  const cmpRevPerSold = compare && compare.totalRooms ? compare.totalRevenue / compare.totalRooms : null;
  const revpar = data.availableRoomNights ? totalRev / data.availableRoomNights : null;
  const cmpRevpar = compare?.availableRoomNights ? compare.totalRevenue / compare.availableRoomNights : null;
  const occPp = compare && avgOcc != null && compare.avgOcc != null ? (avgOcc - compare.avgOcc) * 100 : null;

  const labels = data.months;

  const revenueRef = useChart(
    () => ({
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Árbevétel",
            data: data.totalRevenue,
            borderColor: "#818CF8",
            backgroundColor: "rgba(129,140,248,0.14)",
            pointBackgroundColor: "#818CF8",
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: baseOpts(),
    }),
    [data],
  );

  const stackedRef = useChart(
    () => ({
      type: "bar",
      data: {
        labels,
        datasets: data.segments.map((s) => ({
          label: s.name,
          data: s.revenue,
          backgroundColor: s.color,
        })),
      },
      options: { ...baseOpts(), scales: stackedScales() },
    }),
    [data],
  );

  const donutRef = useChart(
    () => ({
      type: "doughnut",
      data: {
        labels: data.segments.map((s) => s.name),
        datasets: [
          {
            data: data.segments.map((s) => sumN(s.revenue)),
            backgroundColor: data.segments.map((s) => s.color),
            borderWidth: 0,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
    }),
    [data],
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
        <Kpi label="Összes árbevétel" value={formatHuf(totalRev)} delta={compare ? dPct(totalRev, compare.totalRevenue) : null} />
        <Kpi label="Eladott szobaéj" value={new Intl.NumberFormat("hu-HU").format(totalRooms)} delta={compare ? dPct(totalRooms, compare.totalRooms) : null} />
        <Kpi label="Átlag kihasználtság" value={formatPct(avgOcc)} deltaText={occPp == null ? null : (occPp >= 0 ? "▲ +" : "▼ ") + new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(occPp) + " pp YoY"} deltaPositive={occPp != null ? occPp >= 0 : undefined} />
        <Kpi label="Bevétel / kiadott szobaéj" value={formatHuf(revPerSold)} delta={compare ? dPct(revPerSold, cmpRevPerSold) : null} />
        {revpar != null && (
          <Kpi
            label="RevPAR (idősz.)"
            value={formatHuf(revpar)}
            delta={compare ? dPct(revpar, cmpRevpar) : null}
            sub={data.availSource === "rooms" ? "szobaszám × napok · teljes FO forgalom" : "kihasználtságból becsült kiadható · teljes FO forgalom"}
          />
        )}
      </div>

      <Panel title="Árbevétel trend">
        <div style={{ height: 320 }}><canvas ref={revenueRef} /></div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Panel title="Szegmensek havi árbevétele">
          <div style={{ height: 360 }}><canvas ref={stackedRef} /></div>
        </Panel>
        <Panel title="Szegmens mix (időszak)">
          <div style={{ height: 360 }}><canvas ref={donutRef} /></div>
        </Panel>
      </div>

      <Panel title="Szegmens bontás">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "right", color: "var(--text-muted)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Szegmens</th>
                <th style={{ padding: "8px 12px" }}>Árbevétel</th>
                <th style={{ padding: "8px 12px" }}>Szobaéj</th>
                <th style={{ padding: "8px 12px" }}>Részesedés</th>
                {compare && <th style={{ padding: "8px 12px" }}>Δ árbevétel (YoY)</th>}
              </tr>
            </thead>
            <tbody>
              {data.segments.map((s) => {
                const rev = sumN(s.revenue);
                return (
                  <tr key={s.code} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: s.color, marginRight: 8 }} />
                      {s.name}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px 12px" }}>{formatHuf(rev)}</td>
                    <td style={{ textAlign: "right", padding: "8px 12px" }}>
                      {new Intl.NumberFormat("hu-HU").format(sumN(s.rooms))}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px 12px" }}>{formatPct(totalRev ? rev / totalRev : null)}</td>
                    {compare && (() => { const d = dPct(rev, compare.revenueByCode[s.code]); return (
                      <td style={{ textAlign: "right", padding: "8px 12px", fontVariantNumeric: "tabular-nums", color: d == null ? "var(--text-muted)" : d >= 0 ? "var(--positive)" : "var(--negative)" }}>{fDelta(d) ?? "új"}</td>
                    ); })()}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Kpi({ label, value, delta, deltaText, deltaPositive, sub }: {
  label: string; value: string; delta?: number | null; deltaText?: string | null; deltaPositive?: boolean; sub?: string;
}) {
  const show = deltaText != null || delta != null;
  const positive = deltaText != null ? !!deltaPositive : (delta ?? 0) >= 0;
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{sub}</div>}
      {show && (
        <div style={{ fontSize: 12.5, marginTop: 3, color: positive ? "var(--positive)" : "var(--negative)" }}>
          {deltaText ?? `${(delta ?? 0) >= 0 ? "▲" : "▼"} ${fDelta(delta ?? 0)} YoY`}
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{title}</h3>
      {children}
    </div>
  );
}

function baseOpts(): ChartConfiguration["options"] {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: "bottom" } },
    scales: {
      y: {
        ticks: {
          callback: (v) => new Intl.NumberFormat("hu-HU", { notation: "compact" }).format(Number(v)),
        },
      },
    },
  };
}

function stackedScales(): NonNullable<ChartConfiguration["options"]>["scales"] {
  return {
    x: { stacked: true },
    y: {
      stacked: true,
      ticks: { callback: (v) => new Intl.NumberFormat("hu-HU", { notation: "compact" }).format(Number(v)) },
    },
  };
}
