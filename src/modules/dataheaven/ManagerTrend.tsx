"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart, BarController, BarElement, LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
  type ChartConfiguration, type ChartDataset,
} from "chart.js";
import { MANAGER_CATALOG, managerDefByKey } from "./managerCatalog";
import type { ManagerData } from "./types";

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

/** Metric-picker trend: chips toggle the headline metrics, any further catalog
 * metric can be added from the select. Money / count / % each get their own
 * axis; with compare on, the previous year is drawn dashed. */

const MAIN_KEYS = ["rev_total", "rooms_sold", "occ_ooo", "trevpar", "acc_adr", "total_nights"];
const PALETTE = ["#818CF8", "#34D399", "#FBBF24", "#22D3EE", "#C084FC", "#FB7185", "#F97316", "#A3E635", "#38BDF8", "#E879F9"];

const fNum = (n: number, frac = 0) => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: frac }).format(n);
const fCompact = (v: number | string) => new Intl.NumberFormat("hu-HU", { notation: "compact" }).format(Number(v));

function fmtVal(kind: string, n: number): string {
  if (kind === "money") return fNum(n) + " Ft";
  if (kind === "pct") return fNum(n, 1) + " %";
  return fNum(n);
}

export default function ManagerTrend({
  trend, year, prevYear, compare,
}: {
  trend: ManagerData["trend"]; year: number; prevYear: number; compare: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<string[]>(["rev_total"]);

  const available = useMemo(() => new Set(Object.keys(trend.series)), [trend]);
  const chips = MAIN_KEYS.filter((k) => available.has(k));
  const extraSelected = selected.filter((k) => !MAIN_KEYS.includes(k));
  const extraOptions = MANAGER_CATALOG.filter((d) => available.has(d.key) && !MAIN_KEYS.includes(d.key) && !selected.includes(d.key));

  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? (s.length > 1 ? s.filter((k) => k !== key) : s) : [...s, key]));
  }

  useEffect(() => {
    if (!ref.current) return;
    const axisOf = (kind: string) => (kind === "pct" ? "yPct" : kind === "count" ? "yCount" : "yMoney");
    const kinds = new Set(selected.map((k) => managerDefByKey.get(k)?.kind ?? "count"));

    const datasets: ChartDataset<"line">[] = [];
    const kindByDataset: string[] = [];
    selected.forEach((key, i) => {
      const def = managerDefByKey.get(key);
      if (!def) return;
      const color = PALETTE[i % PALETTE.length];
      kindByDataset.push(def.kind);
      datasets.push({
        label: `${year} · ${def.label}`,
        data: trend.series[key] ?? [],
        borderColor: color,
        backgroundColor: color,
        tension: 0.3,
        pointRadius: 3,
        yAxisID: axisOf(def.kind),
      });
      if (compare && trend.prevSeries[key]?.some((v) => v != null)) {
        kindByDataset.push(def.kind);
        datasets.push({
          label: `${prevYear} · ${def.label}`,
          data: trend.prevSeries[key],
          borderColor: color + "88",
          backgroundColor: color + "88",
          borderDash: [6, 5],
          tension: 0.3,
          pointRadius: 2,
          yAxisID: axisOf(def.kind),
        });
      }
    });

    const scales: NonNullable<ChartConfiguration<"line">["options"]>["scales"] = {};
    if (kinds.has("money")) scales.yMoney = { position: "left", ticks: { callback: (v) => fCompact(v as number) } };
    if (kinds.has("count")) scales.yCount = { position: kinds.has("money") ? "right" : "left", grid: { drawOnChartArea: !kinds.has("money") }, ticks: { callback: (v) => fCompact(v as number) } };
    if (kinds.has("pct")) scales.yPct = { position: "right", min: 0, max: 100, grid: { drawOnChartArea: kinds.size === 1 }, ticks: { callback: (v) => `${v} %` } };

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: { labels: trend.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (c) => `${c.dataset.label}: ${fmtVal(kindByDataset[c.datasetIndex] ?? "count", c.parsed.y ?? 0)}`,
            },
          },
        },
        scales,
      },
    };
    const chart = new Chart(ref.current, config);
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend, selected, compare]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Havi trend — teljes év</h3>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
        Jelöld be, mely mutatók kerüljenek a grafikonra{compare ? `; a szaggatott vonal a ${prevYear}-ös azonos havi érték` : ""}.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {chips.map((k) => {
          const on = selected.includes(k);
          return (
            <button
              key={k}
              onClick={() => toggle(k)}
              style={{
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                background: on ? "var(--accent)" : "var(--surface-2)",
                color: on ? "#fff" : "var(--text-muted)",
                padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              {managerDefByKey.get(k)?.label}
            </button>
          );
        })}
        {extraSelected.map((k) => (
          <button
            key={k}
            onClick={() => toggle(k)}
            title="Eltávolítás"
            style={{
              border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff",
              padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            {managerDefByKey.get(k)?.label} ✕
          </button>
        ))}
        {extraOptions.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && setSelected((s) => [...s, e.target.value])}
            style={{ padding: "6px 10px", borderRadius: 999, border: "1px dashed var(--border)", background: "var(--surface-2)", color: "var(--text-muted)", fontSize: 12.5 }}
          >
            <option value="">+ további mutató…</option>
            {extraOptions.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        )}
      </div>
      <div style={{ height: 340 }}><canvas ref={ref} /></div>
    </div>
  );
}
