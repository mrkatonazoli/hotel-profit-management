"use client";

import { useEffect, useRef } from "react";
import {
  Chart, BarController, BarElement, LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
  type ChartConfiguration,
} from "chart.js";
import type { ManagerData } from "./types";

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const fHuf = (n: number) => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(n) + " Ft";
const fCompact = (v: number | string) => new Intl.NumberFormat("hu-HU", { notation: "compact" }).format(Number(v));

export default function ManagerTrend({ trend, year, prevYear }: { trend: ManagerData["trend"]; year: number; prevYear: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const hasPrev = trend.prevRevenue.some((v) => v != null);
    const config: ChartConfiguration = {
      type: "bar",
      data: {
        labels: trend.labels,
        datasets: [
          { label: `${year} összes nettó forgalom`, data: trend.revenue, backgroundColor: "#818CF8", borderRadius: 4, order: 3, yAxisID: "y" },
          ...(hasPrev ? [{
            type: "line" as const,
            label: `${prevYear} összes nettó forgalom`,
            data: trend.prevRevenue,
            borderColor: "#FB7185",
            backgroundColor: "#FB7185",
            borderDash: [6, 5],
            tension: 0.3,
            pointRadius: 3,
            order: 1,
            yAxisID: "y" as const,
          }] : []),
          {
            type: "line",
            label: "Foglaltság % (kiadhatóra)",
            data: trend.occ,
            borderColor: "#34D399",
            backgroundColor: "#34D399",
            tension: 0.3,
            pointRadius: 3,
            order: 2,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (c) => c.dataset.yAxisID === "y1"
                ? `${c.dataset.label}: ${new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(c.parsed.y ?? 0)} %`
                : `${c.dataset.label}: ${fHuf(c.parsed.y ?? 0)}`,
            },
          },
        },
        scales: {
          y: { ticks: { callback: (v) => fCompact(v as number) } },
          y1: { position: "right", min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: (v) => `${v} %` } },
        },
      },
    };
    const chart = new Chart(ref.current, config);
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Havi trend — teljes év</h3>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
        Havi összes nettó forgalom és foglaltság; a szaggatott vonal a {prevYear}-ös azonos havi forgalom.
      </p>
      <div style={{ height: 340 }}><canvas ref={ref} /></div>
    </div>
  );
}
