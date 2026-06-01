"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Zap, DollarSign, BarChart3, Activity, TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayEntry = {
  date: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  byFeature: Record<string, { calls: number; inputTokens: number; outputTokens: number }>;
};

type FeatureEntry = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

type StatsData = {
  from: string;
  to: string;
  totals: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  days: DayEntry[];
  features: Record<string, FeatureEntry>;
  models: Record<string, FeatureEntry>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  generate_constraints: "Generálás · változók elemzése",
  summary:             "Összefoglaló készítése",
  refine_variable:     "Változó AI formázás",
};

const FEATURE_COLORS: Record<string, string> = {
  generate_constraints: "#35BD78",
  summary:             "#3B82F6",
  refine_variable:     "#10B981",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  if (n === 0) return "—";
  if (n < 0.001) return "< $0.001";
  return `$${n.toFixed(4)}`;
}

function fmtUsdTotal(n: number): string {
  return `$${n.toFixed(4)}`;
}

// ─── SVG Chart ────────────────────────────────────────────────────────────────

function DailyChart({ days, metric }: {
  days: DayEntry[];
  metric: "calls" | "inputTokens" | "outputTokens" | "costUsd";
}) {
  const W = 900; const H = 180;
  const PAD = { t: 16, r: 16, b: 36, l: 56 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const n = days.length;
  if (n === 0) return null;

  const values = days.map(d => d[metric] as number);
  const max = Math.max(...values, 1);
  const gap = 3;
  const barW = Math.max(Math.floor(cW / n) - gap, 3);

  const fmtY = (v: number) => metric === "costUsd" ? `$${v.toFixed(3)}` : fmtTokens(v);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = n <= 7 ? 1 : n <= 14 ? 2 : n <= 31 ? 5 : 10;

  const barColor = metric === "costUsd" ? "#F59E0B"
    : metric === "calls" ? "#10B981"
    : metric === "outputTokens" ? "#3B82F6"
    : "#35BD78";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {ticks.map(f => {
        const cy = PAD.t + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={PAD.l} y1={cy} x2={PAD.l + cW} y2={cy}
              stroke="#E2E8F0" strokeWidth={f === 0 ? 1.5 : 1} />
            {f > 0 && (
              <text x={PAD.l - 8} y={cy + 4} textAnchor="end" fontSize={9} fill="#94A3B8"
                fontFamily="ui-monospace, monospace">
                {fmtY(Math.round(max * f * 100) / 100)}
              </text>
            )}
          </g>
        );
      })}

      {days.map((d, i) => {
        const v = d[metric] as number;
        const pct = v / max;
        const barH = pct > 0 ? Math.max(pct * cH, 2) : 0;
        const x = PAD.l + i * (cW / n) + (cW / n - barW) / 2;
        const y = PAD.t + cH - barH;

        return (
          <g key={d.date}>
            <rect x={x} y={PAD.t} width={barW} height={cH}
              fill="#E4E6EA" rx={2} />
            {barH > 0 && (
              <rect x={x} y={y} width={barW} height={barH}
                fill={barColor} rx={2}
                opacity={d.calls > 0 ? 0.85 : 0.2} />
            )}
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={PAD.t + cH + 18}
                textAnchor="middle" fontSize={8.5} fill="#94A3B8"
                fontFamily="ui-monospace, monospace">
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 bg-white"
      style={{ border: "1px solid #E2E8F0" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
          {label}
        </span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: accent + "18", color: accent }}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight font-mono" style={{ color: "#153251" }}>
        {value}
      </div>
      {sub && (
        <p className="text-xs" style={{ color: "#94A3B8" }}>{sub}</p>
      )}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg"
      style={{ background: color + "12", color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white"
      style={{ border: "1px solid #E2E8F0" }}>
      <div className="px-6 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <h2 className="text-sm font-semibold" style={{ color: "#64748B" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TokenStatsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyAgo);
  const [to, setTo]     = useState(today);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<"calls" | "inputTokens" | "outputTokens" | "costUsd">("inputTokens");

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/token-stats?from=${f}&to=${t}`);
      if (res.status === 403) { setError("Nincs admin jogosultságod."); return; }
      if (!res.ok) { setError(`API hiba (${res.status})`); return; }
      setData(await res.json());
    } catch {
      setError("Hálózati hiba.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(from, to); }, []); // eslint-disable-line

  const presets = [
    { label: "Ma",     f: today, t: today },
    { label: "7 nap",  f: new Date(Date.now() -  7*86400000).toISOString().slice(0,10), t: today },
    { label: "30 nap", f: thirtyAgo, t: today },
    { label: "90 nap", f: new Date(Date.now() - 90*86400000).toISOString().slice(0,10), t: today },
  ];

  const chartOptions: { key: typeof chartMetric; label: string; color: string }[] = [
    { key: "inputTokens",  label: "Input",    color: "#35BD78" },
    { key: "outputTokens", label: "Output",   color: "#3B82F6" },
    { key: "calls",        label: "Hívások",  color: "#10B981" },
    { key: "costUsd",      label: "Költség",  color: "#F59E0B" },
  ];

  const hasData = data && data.totals.calls > 0;

  return (
    <div className="space-y-6" style={{ maxWidth: 1080 }}>

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>
            Admin · Monitoring
          </p>
          <h1 className="text-2xl font-bold" style={{ color: "#153251" }}>
            AI Token statisztika
          </h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            Claude API fogyasztás · napi bontás · becsült USD költség
          </p>
        </div>

        {/* Date filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl bg-white" style={{ border: "1px solid #E2E8F0" }}>
            {presets.map(p => {
              const active = from === p.f && to === p.t;
              return (
                <button key={p.label}
                  onClick={() => { setFrom(p.f); setTo(p.t); load(p.f, p.t); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: active ? "#35BD78" : "transparent",
                    color: active ? "white" : "#64748B",
                  }}>
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white"
            style={{ border: "1px solid #E2E8F0" }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="text-xs font-mono border-0 outline-none bg-transparent"
              style={{ color: "#475569" }} />
            <span style={{ color: "#CBD5E1" }}>—</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="text-xs font-mono border-0 outline-none bg-transparent"
              style={{ color: "#475569" }} />
          </div>

          <button onClick={() => load(from, to)}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: "#35BD78", color: "white" }}>
            Lekérés
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#EF4444" }} />
          <p className="text-sm font-medium" style={{ color: "#B91C1C" }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <Loader2 size={24} className="animate-spin" style={{ color: "#35BD78" }} />
        </div>
      ) : data && (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label="API hívások"
              value={String(data.totals.calls)}
              sub={hasData ? `${from} – ${to}` : "Nincs adat ebben az időszakban"}
              icon={<Activity size={15} />}
              accent="#10B981"
            />
            <StatCard
              label="Input tokenek"
              value={fmtTokens(data.totals.inputTokens)}
              sub={`Output: ${fmtTokens(data.totals.outputTokens)}`}
              icon={<Zap size={15} />}
              accent="#35BD78"
            />
            <StatCard
              label="Összes token"
              value={fmtTokens(data.totals.inputTokens + data.totals.outputTokens)}
              sub={data.totals.calls > 0
                ? `Átl. ${fmtTokens(Math.round((data.totals.inputTokens + data.totals.outputTokens) / data.totals.calls))} / hívás`
                : undefined}
              icon={<BarChart3 size={15} />}
              accent="#3B82F6"
            />
            <StatCard
              label="Becsült költség"
              value={fmtUsdTotal(data.totals.costUsd)}
              sub="Haiku árszabás alapján"
              icon={<DollarSign size={15} />}
              accent="#F59E0B"
            />
          </div>

          {/* ── Chart ── */}
          <Section title="Napi fogyasztás">
            <div className="px-6 pt-4 pb-2">
              <div className="flex gap-1.5 mb-5">
                {chartOptions.map(o => (
                  <button key={o.key}
                    onClick={() => setChartMetric(o.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: chartMetric === o.key ? o.color + "15" : "transparent",
                      color: chartMetric === o.key ? o.color : "#94A3B8",
                      border: chartMetric === o.key ? `1px solid ${o.color}30` : "1px solid transparent",
                    }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: o.color }} />
                    {o.label}
                  </button>
                ))}
              </div>

              {data.days.every(d => (d[chartMetric] as number) === 0) ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <TrendingUp size={28} style={{ color: "#CBD5E1" }} />
                  <p className="text-sm" style={{ color: "#94A3B8" }}>Nincs adat ebben az időszakban</p>
                </div>
              ) : (
                <DailyChart days={data.days} metric={chartMetric} />
              )}
            </div>
          </Section>

          {/* ── Feature + Model breakdown ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Feature */}
            <Section title="Funkció szerint">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {["Funkció", "Hívás", "Input", "Output", "Ktg."].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "#94A3B8" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(data.features).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center px-5 py-10 text-sm" style={{ color: "#94A3B8" }}>
                        Nincs adat
                      </td>
                    </tr>
                  ) : (
                    Object.entries(data.features)
                      .sort((a, b) => b[1].inputTokens - a[1].inputTokens)
                      .map(([feat, s], i, arr) => {
                        const color = FEATURE_COLORS[feat] ?? "#64748B";
                        const label = FEATURE_LABELS[feat] ?? feat;
                        const isLast = i === arr.length - 1;
                        return (
                          <tr key={feat}
                            style={{ borderBottom: isLast ? "none" : "1px solid #F8FAFC" }}>
                            <td className="px-5 py-3.5">
                              <Badge color={color} label={label} />
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs font-semibold" style={{ color: "#64748B" }}>
                              {s.calls}×
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "#35BD78" }}>
                              {fmtTokens(s.inputTokens)}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "#3B82F6" }}>
                              {fmtTokens(s.outputTokens)}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs font-semibold" style={{ color: "#F59E0B" }}>
                              {fmtUsd(s.costUsd)}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </Section>

            {/* Model */}
            <Section title="Model szerint">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {["Model", "Hívás", "Input", "Output", "Ktg."].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "#94A3B8" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(data.models).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center px-5 py-10 text-sm" style={{ color: "#94A3B8" }}>
                        Nincs adat
                      </td>
                    </tr>
                  ) : (
                    Object.entries(data.models)
                      .sort((a, b) => b[1].calls - a[1].calls)
                      .map(([model, s], i, arr) => {
                        const isLast = i === arr.length - 1;
                        return (
                          <tr key={model}
                            style={{ borderBottom: isLast ? "none" : "1px solid #F8FAFC" }}>
                            <td className="px-5 py-3.5">
                              <span className="text-xs font-mono px-2.5 py-1 rounded-lg"
                                style={{ background: "rgba(53,189,120,0.12)", color: "#35BD78" }}>
                                {model}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs font-semibold" style={{ color: "#64748B" }}>
                              {s.calls}×
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "#35BD78" }}>
                              {fmtTokens(s.inputTokens)}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "#3B82F6" }}>
                              {fmtTokens(s.outputTokens)}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs font-semibold" style={{ color: "#F59E0B" }}>
                              {fmtUsd(s.costUsd)}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </Section>
          </div>

          {/* ── Daily table ── */}
          <Section title={`Napi bontás · ${data.from} – ${data.to}`}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: 680 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {["Dátum", "Hívások", "Input", "Output", "Összes", "Becsült ktg."].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "#94A3B8" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data.days].reverse().map((d, i, arr) => {
                    const total = d.inputTokens + d.outputTokens;
                    const active = d.calls > 0;
                    const isLast = i === arr.length - 1;
                    return (
                      <tr key={d.date}
                        className="transition-colors"
                        style={{
                          borderBottom: isLast ? "none" : "1px solid #F8FAFC",
                          opacity: active ? 1 : 0.45,
                        }}>
                        <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: active ? "#475569" : "#94A3B8" }}>
                          {d.date}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs">
                          {active
                            ? <span className="px-2 py-0.5 rounded-lg text-xs font-bold"
                                style={{ background: "#D1FAE5", color: "#059669" }}>
                                {d.calls}×
                              </span>
                            : <span style={{ color: "#CBD5E1" }}>—</span>}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs" style={{ color: active ? "#35BD78" : "#CBD5E1" }}>
                          {active ? fmtTokens(d.inputTokens) : "—"}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs" style={{ color: active ? "#3B82F6" : "#CBD5E1" }}>
                          {active ? fmtTokens(d.outputTokens) : "—"}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: active ? "#153251" : "#CBD5E1" }}>
                          {active ? fmtTokens(total) : "—"}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs" style={{ color: active ? "#D97706" : "#CBD5E1" }}>
                          {active ? fmtUsd(d.costUsd) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {hasData && (
                  <tfoot>
                    <tr style={{ borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                      <td className="px-5 py-3.5 text-xs font-bold uppercase tracking-widest" style={{ color: "#64748B" }}>
                        Összesen
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold" style={{ color: "#059669" }}>
                        {data.totals.calls}×
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold" style={{ color: "#35BD78" }}>
                        {fmtTokens(data.totals.inputTokens)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold" style={{ color: "#3B82F6" }}>
                        {fmtTokens(data.totals.outputTokens)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold" style={{ color: "#153251" }}>
                        {fmtTokens(data.totals.inputTokens + data.totals.outputTokens)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold" style={{ color: "#D97706" }}>
                        {fmtUsdTotal(data.totals.costUsd)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
