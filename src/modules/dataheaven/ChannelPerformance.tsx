import type { ChannelPeriod, ChannelRow } from "./types";
import { avgBasket, prevOf } from "./types";

const fmtInt = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("hu-HU").format(Math.round(n)));
const fmtNum = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(n));
const fmtPct = (d: number | null | undefined) =>
  d == null ? "—" : (d >= 0 ? "+" : "") + new Intl.NumberFormat("hu-HU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(d) + " %";

/** Conditional cell background: emerald for gains, rose for losses, by magnitude. */
function deltaBg(d: number | null): string {
  if (d == null || d === 0) return "transparent";
  const a = Math.abs(d);
  if (d > 0) return a >= 50 ? "rgba(52,211,153,0.30)" : a >= 15 ? "rgba(52,211,153,0.18)" : "rgba(52,211,153,0.09)";
  return a >= 50 ? "rgba(251,113,133,0.28)" : a >= 15 ? "rgba(251,113,133,0.17)" : "rgba(251,113,133,0.09)";
}

/** Fallback summary when the loader didn't supply one (demo/sample data):
 * deltas are computed only over rows whose previous value is reconstructible,
 * so unknown baselines can't fabricate NaN or fake-flat results. */
function fallbackSummary(rows: ChannelRow[]) {
  const sum = (f: (r: ChannelRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const paired = <K extends keyof ChannelRow>(valueKey: K, deltaKey: K) =>
    rows.reduce(
      (acc, r) => {
        const cur = (r[valueKey] as number | null) ?? null;
        const prev = cur == null ? null : prevOf(cur, r[deltaKey] as number | null);
        if (cur != null && prev != null) { acc.cur += cur; acc.prev += prev; }
        return acc;
      },
      { cur: 0, prev: 0 },
    );
  const d = (c: number, p: number): number | null => (p > 0 ? ((c - p) / p) * 100 : null);
  const b = paired("booking", "bookingDelta");
  const r = paired("revenue", "revenueDelta");
  const n = paired("roomNights", "roomNightsDelta");
  const booking = sum((x) => x.booking);
  const revenue = sum((x) => x.revenue);
  const basket = booking ? revenue / booking : null;
  const prevBasket = b.prev > 0 && r.prev > 0 ? r.prev / b.prev : null;
  return {
    booking,
    bookingDelta: d(b.cur, b.prev),
    revenue,
    revenueDelta: d(r.cur, r.prev),
    avgBasket: basket,
    avgBasketDelta: basket != null && prevBasket != null && prevBasket > 0 ? ((basket - prevBasket) / prevBasket) * 100 : null,
    roomNights: sum((x) => x.roomNights ?? 0),
    roomNightsDelta: d(n.cur, n.prev),
    roomRevenue: sum((x) => x.roomRevenue ?? 0),
  };
}

export default function ChannelPerformance({ period }: { period: ChannelPeriod }) {
  const rows = [...period.rows].sort((a, b) => b.booking - a.booking);

  // Prefer the loader-computed summary (exact: includes channels that existed
  // only in the previous year); fall back to per-row reconstruction otherwise.
  const s = period.summary ?? fallbackSummary(rows);

  const direct = rows.find((r) => r.isDirect);
  const directShare = s.revenue && direct ? (direct.revenue / s.revenue) * 100 : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
        <Kpi label="Összes foglalás" value={fmtInt(s.booking) + " db"} delta={s.bookingDelta} />
        <Kpi label="Összes forgalom" value={fmtInt(s.revenue) + " Ft"} delta={s.revenueDelta} />
        <Kpi label="Átlag kosárérték" value={fmtInt(s.avgBasket) + " Ft"} delta={s.avgBasketDelta} />
        <Kpi label={`Direkt részesedés (${period.directChannel})`} value={fmtNum(directShare) + " %"} />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
                <Th left>Csatorna</Th>
                <Th>Foglalás<br />(most)</Th><Th>Foglalás<br />(Δ)</Th>
                <Th>Forgalom<br />(most)</Th><Th>Forgalom<br />(Δ)</Th>
                <Th>Átl. kosár<br />(most)</Th><Th>Átl. kosár<br />(Δ)</Th>
                <Th>Szobaéj<br />(most)</Th><Th>Szobaéj<br />(Δ)</Th>
                <Th>Szoba-forgalom<br />(most)</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channel} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 12px", textAlign: "left" }}>
                    {r.channel}
                    {r.isDirect && <Badge>direkt</Badge>}
                  </td>
                  <Num>{fmtInt(r.booking)}</Num><Delta d={r.bookingDelta} />
                  <Num>{fmtInt(r.revenue)}</Num><Delta d={r.revenueDelta} />
                  <Num>{fmtInt(avgBasket(r))}</Num><Delta d={r.avgBasketDelta} />
                  <Num>{fmtInt(r.roomNights)}</Num><Delta d={r.roomNightsDelta} />
                  <Num>{fmtInt(r.roomRevenue)}</Num>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                <td style={{ padding: "10px 12px", textAlign: "left" }}>Összesen</td>
                <Num>{fmtInt(s.booking)}</Num><Delta d={s.bookingDelta} />
                <Num>{fmtInt(s.revenue)}</Num><Delta d={s.revenueDelta} />
                <Num>{fmtInt(s.avgBasket)}</Num><Delta d={s.avgBasketDelta} />
                <Num>{fmtInt(s.roomNights)}</Num><Delta d={s.roomNightsDelta} />
                <Num>{fmtInt(s.roomRevenue)}</Num>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 5 }}>{value}</div>
      {delta != null && (
        <div style={{ fontSize: 12.5, marginTop: 3, color: delta >= 0 ? "var(--positive)" : "var(--negative)" }}>
          {delta >= 0 ? "▲" : "▼"} {fmtPct(delta)} YoY
        </div>
      )}
    </div>
  );
}

function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <th style={{ padding: "10px 12px", textAlign: left ? "left" : "right", fontWeight: 600, verticalAlign: "bottom" }}>{children}</th>;
}
function Num({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{children}</td>;
}
function Delta({ d }: { d: number | null }) {
  const color = d == null || d === 0 ? "var(--text-muted)" : d > 0 ? "var(--positive)" : "var(--negative)";
  return (
    <td style={{ padding: "9px 12px", textAlign: "right", background: deltaBg(d), color, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
      {fmtPct(d)}
    </td>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "var(--accent)", background: "rgba(129,140,248,0.16)", padding: "2px 7px", borderRadius: 5 }}>{children}</span>;
}
