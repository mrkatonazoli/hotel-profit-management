"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ArrowRight, Loader2, Star, TrendingUp, AlertTriangle } from "lucide-react";

type Scenario = {
  id: string; name: string; description: string | null;
  probability: number; isBase: boolean; year: number;
};

function probColor(p: number) {
  if (p >= 70) return { bg: "#D1FAE5", text: "#059669" };
  if (p >= 40) return { bg: "#FEF3C7", text: "#D97706" };
  return { bg: "#FEE2E2", text: "#DC2626" };
}

function probLabel(p: number) {
  if (p >= 70) return "Optimista";
  if (p >= 40) return "Reális";
  return "Pesszimista";
}

export default function RevenuePlannerIndexPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scenarios").then(r => r.json()).then(data => {
      setScenarios(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const byYear = scenarios.reduce<Record<number, Scenario[]>>((acc, s) => {
    (acc[s.year] ??= []).push(s);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Bevételtervező</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
          Válassz forgatókönyvet a tervezéshez
        </p>
      </div>

      {scenarios.length === 0 && (
        <div className="rounded-2xl p-12 text-center" style={{ background: "white", border: "1px solid #E2E8F0" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#EDE9FE" }}>
            <GitBranch size={24} style={{ color: "#7C3AED" }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: "#0F172A" }}>Nincs forgatókönyv</p>
          <p className="text-sm mb-5" style={{ color: "#94A3B8" }}>Előbb hozz létre forgatókönyvet a Szcenáriók menüben.</p>
          <button onClick={() => router.push("/scenarios")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#7C3AED", color: "white" }}>
            Szcenáriók →
          </button>
        </div>
      )}

      {years.map(year => (
        <div key={year} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold" style={{ color: "#0F172A" }}>{year}</span>
            <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
          </div>
          {byYear[year].map(s => {
            const pc = probColor(s.probability);
            return (
              <button key={s.id} onClick={() => router.push(`/revenue-planner/${s.id}`)}
                className="w-full text-left rounded-2xl p-4 flex items-center gap-4 transition-all hover:shadow-md"
                style={{ background: "white", border: `1px solid ${s.isBase ? "#C4B5FD" : "#E2E8F0"}` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.isBase ? "#EDE9FE" : "#F1F5F9" }}>
                  {s.isBase ? <Star size={18} style={{ color: "#7C3AED" }} />
                    : s.probability >= 70 ? <TrendingUp size={18} style={{ color: "#10B981" }} />
                    : s.probability < 40 ? <AlertTriangle size={18} style={{ color: "#EF4444" }} />
                    : <GitBranch size={18} style={{ color: "#64748B" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: "#0F172A" }}>{s.name}</span>
                    {s.isBase && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#EDE9FE", color: "#7C3AED" }}>Alap</span>
                    )}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: pc.bg, color: pc.text }}>
                      {probLabel(s.probability)} · {s.probability}%
                    </span>
                  </div>
                  {s.description && (
                    <p className="text-sm mt-0.5 truncate" style={{ color: "#64748B" }}>{s.description}</p>
                  )}
                </div>
                <ArrowRight size={18} style={{ color: "#94A3B8" }} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
