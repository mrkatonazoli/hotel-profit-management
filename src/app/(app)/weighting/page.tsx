"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, ChevronRight, Loader2 } from "lucide-react";

type Scenario = {
  id: string;
  name: string;
  year: number;
  probability: number;
  isBase: boolean;
};

export default function WeightingIndexPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scenarios")
      .then(r => r.json())
      .then((data: Scenario[]) => {
        setScenarios(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  // Group by year
  const byYear: Record<number, Scenario[]> = {};
  for (const s of scenarios) {
    if (!byYear[s.year]) byYear[s.year] = [];
    byYear[s.year].push(s);
  }
  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: "#7C3AED" }} />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Súlyozás</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
          Válassz egy szcenáriót a naptípus és kiemelt időszak szorzók beállításához
        </p>
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-2xl py-12 text-center" style={{ background: "white", border: "1px solid #E2E8F0" }}>
          <Scale size={32} className="mx-auto mb-3" style={{ color: "#CBD5E1" }} />
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Még nincs szcenárió. Hozz létre egyet a Szcenáriók menüpontban.
          </p>
        </div>
      ) : (
        years.map(year => (
          <div key={year}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: "#94A3B8" }}>
              {year}
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E2E8F0" }}>
              <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
                {byYear[year].map(s => (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/weighting/${s.id}`)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#EDE9FE" }}>
                      <Scale size={16} style={{ color: "#7C3AED" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>{s.name}</span>
                        {s.isBase && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "#D1FAE5", color: "#059669" }}>
                            Alap
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "#F1F5F9", color: "#64748B" }}>
                          {s.probability}%
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                        Súlyozás beállítása ehhez a szcenárióhoz
                      </p>
                    </div>
                    <ChevronRight size={16} style={{ color: "#CBD5E1" }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
