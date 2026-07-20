"use client";

import { MANAGER_CATALOG, MANAGER_GROUPS, type ManagerDef } from "./managerCatalog";
import type { ManagerData, ManagerMetricVal } from "./types";

/**
 * Manager riport (FRO-501a) — copy of the DataHeaven view (dh-scope tokens).
 * KPI cards from the selected month's headline metrics, then the full catalog
 * grouped, with Havi + Éves halmozott columns. With compare on, deltas are vs
 * the same month of the previous year (pct metrics → percentage points).
 */

const KPI_KEYS = ["rev_total", "rooms_sold", "occ_ooo", "trevpar", "acc_adr", "total_nights"] as const;

const fInt = (n: number) => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(n);
const fDec = (n: number) => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(n);

function fmt(def: ManagerDef, n: number | null): string {
  if (n == null) return "—";
  if (def.kind === "money") return fInt(n) + " Ft";
  if (def.kind === "pct") return fDec(n) + " %";
  return fInt(n);
}

function delta(def: ManagerDef, cur: number | null, prev: number | null): { text: string; up: boolean } | null {
  if (cur == null || prev == null) return null;
  if (def.kind === "pct") {
    const d = cur - prev;
    return { text: (d >= 0 ? "+" : "") + fDec(d) + " pp", up: d >= 0 };
  }
  if (prev === 0) return null;
  const d = ((cur - prev) / Math.abs(prev)) * 100;
  return { text: (d >= 0 ? "+" : "") + fDec(d) + " %", up: d >= 0 };
}

const MONTHS_HU = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

export default function ManagerView({ data, compare }: { data: ManagerData; compare: boolean }) {
  const cmp = compare && data.prev ? data.prev : null;
  const val = (k: string): ManagerMetricVal | undefined => data.values[k];

  const present = MANAGER_CATALOG.filter((d) => data.values[d.key] != null);
  const groups = MANAGER_GROUPS.map((g) => ({ name: g, defs: present.filter((d) => d.group === g) })).filter((g) => g.defs.length);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {KPI_KEYS.map((k) => {
          const def = MANAGER_CATALOG.find((d) => d.key === k)!;
          const v = val(k);
          const d = cmp ? delta(def, v?.monthly ?? null, cmp[k]?.monthly ?? null) : null;
          return (
            <div key={k} className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{def.label}</div>
              <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.15 }}>{fmt(def, v?.monthly ?? null)}</div>
              {d && (
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 5, color: d.up ? "var(--positive)" : "var(--negative)" }}>
                  {d.text} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>vs {data.prevYear}. {MONTHS_HU[data.month - 1]}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>
          Manager jelentés — {data.year}. {MONTHS_HU[data.month - 1]}
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
          Havi halmozott érték a kiválasztott hónapra, éves halmozott január 1-től.
          {compare && !data.prev && ` Nincs ${data.prevYear}-es adat ehhez a hónaphoz.`}
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th style={thL}>Megnevezés</th>
                <th style={thR}>Havi halmozott</th>
                {cmp && <th style={thR}>Havi Δ</th>}
                <th style={thR}>Éves halmozott</th>
                {cmp && <th style={thR}>Éves Δ</th>}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.name}>
                <tr>
                  <td colSpan={cmp ? 5 : 3} style={{ padding: "14px 10px 6px", fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--accent)" }}>
                    {g.name}
                  </td>
                </tr>
                {g.defs.map((def) => {
                  const v = val(def.key)!;
                  const p = cmp?.[def.key];
                  const dm = cmp ? delta(def, v.monthly, p?.monthly ?? null) : null;
                  const dy = cmp ? delta(def, v.ytd, p?.ytd ?? null) : null;
                  return (
                    <tr key={def.key} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={tdL}>{def.label}</td>
                      <td style={tdR}>{fmt(def, v.monthly)}</td>
                      {cmp && <td style={{ ...tdR, fontWeight: 600, color: dm ? (dm.up ? "var(--positive)" : "var(--negative)") : "var(--text-muted)" }}>{dm?.text ?? "—"}</td>}
                      <td style={tdR}>{fmt(def, v.ytd)}</td>
                      {cmp && <td style={{ ...tdR, fontWeight: 600, color: dy ? (dy.up ? "var(--positive)" : "var(--negative)") : "var(--text-muted)" }}>{dy?.text ?? "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>
  );
}

const thL: React.CSSProperties = { padding: "6px 10px", textAlign: "left" };
const thR: React.CSSProperties = { padding: "6px 10px", textAlign: "right" };
const tdL: React.CSSProperties = { padding: "7px 10px", textAlign: "left" };
const tdR: React.CSSProperties = { padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" };
