import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/anthropic";
import { logTokenUsage } from "@/lib/token-log";

const HU_MONTHS = [
  "Január","Február","Március","Április","Május","Június",
  "Július","Augusztus","Szeptember","Október","November","December",
];

function fmt(n: number) {
  return n.toLocaleString("hu-HU");
}

function buildReportPrompt(
  hotel: { name: string; totalRooms: number | null },
  scenario: { name: string; year: number; probability: number; weightingNote?: string | null },
  variables: { name: string; value: string }[],
  summaries: {
    month: number; days: number;
    targetOcc: number; targetAdr: number;
    roomNights: number; roomRevenue: number;
    fbRevenue: number; spaRevenue: number; otherRevenue: number;
    actualOccPct: number; actualAdr: number;
  }[],
  dayWeights: { dayOfWeek: number; occMult: number; adrMult: number; fbMult: number; spaMult: number; otherMult: number; note?: string | null }[],
  seasons: { name: string; monthFrom: number; dayFrom: number; monthTo: number; dayTo: number; occMult: number; adrMult: number; note?: string | null }[],
): string {
  const totalRoomNights = summaries.reduce((a, s) => a + s.roomNights, 0);
  const totalRoomRev    = summaries.reduce((a, s) => a + s.roomRevenue, 0);
  const totalFb         = summaries.reduce((a, s) => a + s.fbRevenue, 0);
  const totalSpa        = summaries.reduce((a, s) => a + s.spaRevenue, 0);
  const totalOther      = summaries.reduce((a, s) => a + s.otherRevenue, 0);
  const totalRev        = totalRoomRev + totalFb + totalSpa + totalOther;
  const avgOcc          = summaries.length > 0
    ? Math.round(summaries.reduce((a, s) => a + s.actualOccPct, 0) / summaries.length * 10) / 10
    : 0;

  const monthLines = summaries.map(s =>
    `  ${HU_MONTHS[s.month - 1]}: ${s.days} nap | Kihas.: ${s.actualOccPct}% | ADR: ${fmt(s.actualAdr)} Ft | ` +
    `Szobaéj: ${fmt(s.roomNights)} | Szobabev.: ${fmt(s.roomRevenue)} Ft | ` +
    `F&B: ${fmt(s.fbRevenue)} Ft | Spa: ${fmt(s.spaRevenue)} Ft | Egyéb: ${fmt(s.otherRevenue)} Ft`
  ).join("\n");

  const DOW_GROUPS = [
    { label: "Vasárnap–Csütörtök", dows: [0,1,2,3,4] },
    { label: "Péntek",             dows: [5] },
    { label: "Szombat",            dows: [6] },
  ];
  const dayWgtLines = DOW_GROUPS.map(g => {
    const rep = dayWeights.find(w => g.dows.includes(w.dayOfWeek));
    if (!rep) return null;
    const notePart = rep.note ? ` | Kontextus: "${rep.note}"` : "";
    return `  ${g.label}: Kihas.×${rep.occMult.toFixed(2)} | ADR×${rep.adrMult.toFixed(2)} | F&B ${(rep.fbMult*100).toFixed(0)}% | Spa ${(rep.spaMult*100).toFixed(0)}% | Egyéb ${(rep.otherMult*100).toFixed(0)}%${notePart}`;
  }).filter(Boolean).join("\n");

  const seasonLines = seasons.length > 0
    ? seasons.map(s => {
        const notePart = s.note ? `\n    Kontextus: "${s.note}"` : "";
        return `  ${s.name}: ${s.monthFrom}.${s.dayFrom}–${s.monthTo}.${s.dayTo} | Kihas.×${s.occMult.toFixed(2)} | ADR×${s.adrMult.toFixed(2)}${notePart}`;
      }).join("\n")
    : "  (nincs kiemelt időszak)";

  const variablesSection = variables.length > 0
    ? `\n## Felhasználó által megadott változók\nEzeket a tényeket, szabályokat és eseményeket vedd figyelembe a riportban:\n${variables.map(v => `  - **${v.name}**: ${v.value}`).join("\n")}\n`
    : "";

  const generalNoteSection = scenario.weightingNote
    ? `\n## Általános kontextus\n${scenario.weightingNote}\n`
    : "";

  return `Te egy szállodai revenue management rendszer automatikus riportgenerátora vagy.
${variablesSection}${generalNoteSection}

A következő szálloda éves forgatókönyvének generált napi tervéből készíts egy tömör, tényszerű összefoglalót riport formában. Kizárólag az adatokat ismertesd — ne fogalmazz meg javaslatokat, véleményt vagy ajánlást.

## Hotel adatok
- Szálloda: ${hotel.name}
- Szobák száma: ${hotel.totalRooms ?? "?"} szoba
- Szcenárió: ${scenario.name} (${scenario.year}, ${scenario.probability}% valószínűség)

## Éves összesítő
- Összes szobaéj: ${fmt(totalRoomNights)}
- Átlag kihasználtság: ${avgOcc}%
- Szobabevétel: ${fmt(totalRoomRev)} Ft
- F&B bevétel: ${fmt(totalFb)} Ft
- Spa bevétel: ${fmt(totalSpa)} Ft
- Egyéb bevétel: ${fmt(totalOther)} Ft
- Teljes bevétel: ${fmt(totalRev)} Ft

## Havi bontás
${monthLines}

## Naptípus súlyozás
${dayWgtLines}

## Kiemelt időszakok
${seasonLines}

---

Készíts egy 3-5 bekezdéses, tényszerű magyar nyelvű riportot, amely:
1. Bemutatja a szcenárió főbb adatait (éves szobabevétel, kihasználtság, ADR)
2. Összefoglalja a havi bontást (szezonalitás, csúcs- és völgyhónapok konkrét számokkal)
3. Ismerteti a bevételi szerkezetet (szoba, F&B, spa, egyéb arányokkal)
4. Leírja az alkalmazott súlyozási struktúrát (naptípusok, kiemelt időszakok)

Csak tényeket közölj, pontos számokkal. Ne ajánlj semmit, ne értékelj, ne fogalmazz meg véleményt.`;
}

export async function POST(_req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { scenarioId } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { hotel: true, months: true, dayTypeWeights: true, seasonWeights: true, variables: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });

  if (!scenario) {
    return new Response(JSON.stringify({ error: "Szcenárió nem található" }), { status: 404 });
  }

  const planDays = await prisma.planDay.findMany({
    where: { scenarioId },
    orderBy: { date: "asc" },
  });

  if (planDays.length === 0) {
    return new Response(
      JSON.stringify({ error: "Nincs generált napi terv. Előbb futtasd a generálást." }),
      { status: 400 },
    );
  }

  const monthMap: Record<number, {
    days: number; roomNights: number; roomRevenue: number;
    fbRevenue: number; spaRevenue: number; otherRevenue: number;
    occSum: number;
  }> = {};

  for (const pd of planDays) {
    const m = pd.date.getUTCMonth() + 1;
    if (!monthMap[m]) {
      monthMap[m] = { days: 0, roomNights: 0, roomRevenue: 0, fbRevenue: 0, spaRevenue: 0, otherRevenue: 0, occSum: 0 };
    }
    const totalRooms = scenario.hotel.totalRooms ?? 1;
    monthMap[m].days++;
    monthMap[m].occSum += pd.occupancyPct;
    monthMap[m].roomNights += Math.round(pd.occupancyPct / 100 * totalRooms);
    monthMap[m].roomRevenue += pd.roomRevenue;
    monthMap[m].fbRevenue += pd.fbRevenue;
    monthMap[m].spaRevenue += pd.spaRevenue;
    monthMap[m].otherRevenue += pd.otherRevenue;
  }

  const summaries = Object.entries(monthMap).map(([mStr, data]) => {
    const m = Number(mStr);
    const planMonth = scenario.months.find(x => x.month === m);
    const actualOccPct = data.days > 0 ? Math.round((data.occSum / data.days) * 10) / 10 : 0;
    const actualAdr = data.roomNights > 0 ? Math.round(data.roomRevenue / data.roomNights) : 0;
    return {
      month: m, days: data.days,
      targetOcc: planMonth?.occupancyPct ?? 0, targetAdr: planMonth?.adr ?? 0,
      roomNights: data.roomNights, roomRevenue: data.roomRevenue,
      fbRevenue: data.fbRevenue, spaRevenue: data.spaRevenue, otherRevenue: data.otherRevenue,
      actualOccPct, actualAdr,
    };
  }).sort((a, b) => a.month - b.month);

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const prompt = buildReportPrompt(
    { name: scenario.hotel.name, totalRooms: scenario.hotel.totalRooms },
    { name: scenario.name, year: scenario.year, probability: scenario.probability, weightingNote: scenario.weightingNote },
    (scenario.variables ?? []).filter(v => v.value.trim()),
    summaries,
    scenario.dayTypeWeights,
    scenario.seasonWeights,
  );

  const userId = session.user.id;
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk.delta.text })}\n\n`)
            );
          }
        }

        // Log token usage after stream completes
        const finalMsg = await stream.finalMessage();
        logTokenUsage({
          feature: "summary",
          model: "claude-haiku-4-5",
          inputTokens: finalMsg.usage.input_tokens,
          outputTokens: finalMsg.usage.output_tokens,
          userId,
        });
      } catch (err) {
        console.error("Claude stream error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "text", text: "\n\n_(Összefoglaló nem elérhető)_" })}\n\n`)
        );
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
