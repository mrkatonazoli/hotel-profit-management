"use client";

import { useEffect, useRef } from "react";
import {
  Chart, BarController, BarElement, LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
  type ChartConfiguration,
} from "chart.js";
import type { ChannelMonthly } from "./types";

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const fHuf = (n: number) => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(n) + " Ft";
const fCompact = (v: number | string) => new Intl.NumberFormat("hu-HU", { notation: "compact" }).format(Number(v));

export default function ChannelTrend({ data, directName }: { data: ChannelMonthly; directName: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const config: ChartConfiguration = {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [
          { label: `Direkt (${directName})`, data: data.direct, backgroundColor: "#818CF8", stack: "cur", borderRadius: 4, order: 2 },
          { label: "OTA + partnerek", data: data.ota, backgroundColor: "#94A3B8", stack: "cur", borderRadius: 4, order: 2 },
          {
            type: "line",
            label: `${data.prevYear} összesen`,
            data: data.prevTotal,
            borderColor: "#FB7185",
            backgroundColor: "#FB7185",
            borderDash: [6, 5],
            tension: 0.3,
            pointRadius: 3,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fHuf(c.parsed.y ?? 0)}` } },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, ticks: { callback: (v) => fCompact(v as number) } },
        },
      },
    };
    const chart = new Chart(ref.current, config);
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Havi trend — teljes év</h3>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
        Beérkezett forgalom havonta: Direkt vs OTA, a szaggatott vonal a {data.prevYear}-ös azonos havi összforgalom.
      </p>
      <div style={{ height: 340 }}><canvas ref={ref} /></div>
    </div>
  );
}
