import { auth } from "@/lib/auth";
import { generatePlanDays, EMPTY_CONSTRAINTS } from "@/modules/weighting/weighting.service";
import type { VariableConstraints } from "@/modules/weighting/weighting.service";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/anthropic";
import { logTokenUsage } from "@/lib/token-log";

// ─── Parse variables → structured constraints via Claude ──────────────────────

async function parseVariablesToConstraints(
  variables: { name: string; value: string }[],
  year: number,
  userId?: string | null,
): Promise<VariableConstraints> {
  if (!variables.length) return EMPTY_CONSTRAINTS;

  const varText = variables
    .filter(v => v.value.trim())
    .map(v => `- ${v.name}: ${v.value}`)
    .join("\n");

  if (!varText) return EMPTY_CONSTRAINTS;

  const prompt = `Szállodai AI generáláshoz elemezd a változókat és adj vissza egy JSON constraints objektumot.

KRITIKUS SZABÁLYOK — olvasd el figyelmesen:

1. ABSZOLÚT kihasználtság — egyetlen konkrét érték → occPctAbsolute:
   - "teltház", "100%", "soldout", "megtelt", "50% körül", "low season ~30%"
   - NE használj occMult-ot ha van konkrét %

2. TARTOMÁNY kihasználtság — tól-ig kifejezés → occPctFrom + occPctTo:
   - "90–95% közötti", "85 és 90% között", "valahol 70–80%"
   - Mindkét mezőt add meg: occPctFrom és occPctTo
   - A rendszer majd seeded random értéket választ a tartományból

3. NEGÁCIÓ — "ne legyen X%", "nem éri el X%", "alatt marad" → tartomány:
   - "ne legyen 100%-os" → occPctFrom: 88, occPctTo: 95
   - "ne legyen teltház" → occPctFrom: 88, occPctTo: 95
   - "nem lesz tele" → occPctFrom: 75, occPctTo: 88
   - "50% alatt marad" → occPctFrom: 38, occPctTo: 48
   - Szabály: határérték alatti ~10%-os tartomány

4. RELATÍV hatás konkrét % nélkül → occMult:
   - "kiemelt nap", "nagyobb kereslet", "30%-kal több vendég" → occMult: 1.3

5. GLOBÁLIS korlát — egész évre vonatkozó maximum → maxOccPctByDow MINDEN napra (0–6):
   - "soha ne legyen 100%", "minden nap alatt marad a 100%-nak", "nem lehet teltház", "sosem lehet kerek 100", "mindig maradjon szabad kapacitás", "rugalmasság a last-minute foglalásokhoz" → minden napra 99
   - "max 90% az egész évre" → minden napra 90
   - Globális korlát esetén MINDIG mind a 7 napot (0–6) állítsd be

6. DÁTUMTARTOMÁNY ("május 15–16.") → minden napra külön override objektum

7. ESEMÉNY → dátum becslés az év alapján (${year})

8. maxOccPctByDow: nap-szerinti felső korlát (0=Vas … 6=Szo) — egyes napokra explicit korlátozásnál

Változók:
${varText}

Példák:
- "május 28-án teltház" → { month:5, day:28, occPctAbsolute:100 }
- "május 28-án ne legyen 100%-os" → { month:5, day:28, occPctFrom:88, occPctTo:95 }
- "május 10. 90–95% közötti" → { month:5, day:10, occPctFrom:90, occPctTo:95 }
- "május 15-16. körülbelül 50%-os" → [{ month:5, day:15, occPctAbsolute:50 }, { month:5, day:16, occPctAbsolute:50 }]
- "augusztus fesztiválon 30%-kal drágább" → adrMult:1.3 az adott napokra
- "hétköznapokon max 60%" → maxOccPctByDow: { 1:60, 2:60, 3:60, 4:60 }
- "kiemelt hétvége" (nincs %) → occMult:1.2
- "minden nap alatt marad a 100%-nak" → maxOccPctByDow: { 0:99, 1:99, 2:99, 3:99, 4:99, 5:99, 6:99 }
- "soha ne legyen teltház" → maxOccPctByDow: { 0:99, 1:99, 2:99, 3:99, 4:99, 5:99, 6:99 }
- "sosem lehet kerek 100" → maxOccPctByDow: { 0:99, 1:99, 2:99, 3:99, 4:99, 5:99, 6:99 }

Visszaadandó JSON (semmi más, csak ez):
{
  "maxOccPctByDow": {},
  "dateOverrides": [
    {
      "month": 5,
      "day": 28,
      "occPctAbsolute": 100
    }
  ]
}`;

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    // Log token usage
    logTokenUsage({
      feature: "generate_constraints",
      model: "claude-haiku-4-5",
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      userId,
    });

    const raw = (msg.content[0] as { type: string; text: string }).text?.trim() ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return EMPTY_CONSTRAINTS;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<VariableConstraints>;
    return {
      maxOccPctByDow: parsed.maxOccPctByDow ?? {},
      dateOverrides: (parsed.dateOverrides ?? []).map(o => {
        const hasAbsolute = o.occPctAbsolute !== undefined;
        const hasRange    = o.occPctFrom !== undefined && o.occPctTo !== undefined;
        const hasPinned   = hasAbsolute || hasRange;
        return {
          month:          Number(o.month),
          day:            Number(o.day),
          occPctAbsolute: hasAbsolute
            ? Math.min(100, Math.max(0, Number(o.occPctAbsolute)))
            : undefined,
          occPctFrom:     hasRange && !hasAbsolute
            ? Math.min(100, Math.max(0, Number(o.occPctFrom)))
            : undefined,
          occPctTo:       hasRange && !hasAbsolute
            ? Math.min(100, Math.max(0, Number(o.occPctTo)))
            : undefined,
          occMult:        o.occMult !== undefined && !hasPinned
            ? Math.min(3, Math.max(0.1, Number(o.occMult)))
            : undefined,
          adrAbsolute:    o.adrAbsolute !== undefined ? Number(o.adrAbsolute) : undefined,
          adrMult:        o.adrMult !== undefined && o.adrAbsolute === undefined
            ? Number(o.adrMult)
            : undefined,
        };
      }),
    };
  } catch (err) {
    console.error("Variable constraint parse error:", err);
    return EMPTY_CONSTRAINTS;
  }
}

// ─── Komisszió számítás szegmens mix alapján ──────────────────────────────────

async function applySegmentCommissions(scenarioId: string) {
  // Szegmensek betöltése csatorna mixszel
  const segments = await prisma.scenarioSegment.findMany({
    where: { scenarioId },
    include: {
      monthShares: true,
      channelMix: { include: { distributor: true } },
    },
  });

  if (segments.length === 0) return;

  // Havi effektív komisszió ráta: Σ(segmentShare% × segmentCommission%)
  const monthlyCommissionRate: Record<number, number> = {};
  for (let month = 1; month <= 12; month++) {
    let rate = 0;
    for (const seg of segments) {
      const segShare = (seg.monthShares.find(m => m.month === month)?.sharePct ?? 0) / 100;
      if (segShare === 0) continue;

      let segCommPct = 0;
      if (seg.useChannelMix) {
        // Csatorna mix alapján számolt komisszió
        const annualChannels = seg.channelMix.filter(c => c.month === null);
        const monthChannels  = seg.channelMix.filter(c => c.month === month);
        const channels = monthChannels.length > 0 ? monthChannels : annualChannels;
        segCommPct = channels.reduce((sum, c) => {
          return sum + (c.sharePct / 100) * (c.distributor.isCommission ? c.distributor.commissionPct : 0);
        }, 0);
      } else {
        segCommPct = seg.commissionPct;
      }

      rate += segShare * segCommPct;
    }
    monthlyCommissionRate[month] = rate / 100; // → 0.0–1.0
  }

  // PlanDay-ek frissítése hónaponként
  const planDays = await prisma.planDay.findMany({
    where: { scenarioId },
    select: { id: true, date: true, roomRevenue: true },
  });

  // Batch update
  await Promise.all(planDays.map(day => {
    const month = new Date(day.date).getUTCMonth() + 1;
    const rate  = monthlyCommissionRate[month] ?? 0;
    const commissionCost = Math.round(day.roomRevenue * rate);
    return prisma.planDay.update({
      where: { id: day.id },
      data: { commissionCost },
    });
  }));
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(_req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { scenarioId } = await params;

    const scenarioMeta = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { year: true, variables: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });

    const variables = (scenarioMeta?.variables ?? []).filter(v => v.value.trim());
    const constraints = await parseVariablesToConstraints(
      variables,
      scenarioMeta?.year ?? new Date().getFullYear(),
      session.user.id,
    );

    const { count } = await generatePlanDays(scenarioId, constraints);

    if (count === 0) {
      return new Response(
        JSON.stringify({ error: "Nem sikerült generálni. Ellenőrizd a havi adatokat és a szobaszámot." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Komisszió számítás szegmens mix alapján ──────────────────────────────
    await applySegmentCommissions(scenarioId);

    // Visszaadjuk az értelmezett constraint-eket is, hogy a UI megmutassa mit értett meg
    const pinnedDays = constraints.dateOverrides.filter(o => o.occPctAbsolute !== undefined);
    const rangeDays  = constraints.dateOverrides.filter(o => o.occPctFrom !== undefined && o.occPctTo !== undefined);
    const relDays    = constraints.dateOverrides.filter(o => !o.occPctAbsolute && !o.occPctFrom && (o.occMult !== undefined || o.adrMult !== undefined));

    return new Response(JSON.stringify({
      generated: count,
      constraintsSummary: {
        pinnedDays:   pinnedDays.map(o => ({ month: o.month, day: o.day, occPct: o.occPctAbsolute })),
        rangeDays:    rangeDays.map(o => ({ month: o.month, day: o.day, occPctFrom: o.occPctFrom, occPctTo: o.occPctTo })),
        relativedays: relDays.map(o => ({ month: o.month, day: o.day, occMult: o.occMult, adrMult: o.adrMult })),
        maxOccByDow:  constraints.maxOccPctByDow,
      },
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate] Unhandled error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Generálási hiba: ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
