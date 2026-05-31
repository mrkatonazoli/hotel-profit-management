import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/anthropic";
import { logTokenUsage } from "@/lib/token-log";

type Params = { params: Promise<{ planId: string }> };

const HU_MONTHS = [
  "Január","Február","Március","Április","Május","Június",
  "Július","Augusztus","Szeptember","Október","November","December",
];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function fmt(n: number) { return Math.round(n).toLocaleString("hu-HU"); }

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { planId } = await params;

  const plan = await prisma.simplePlan.findUnique({
    where: { id: planId },
    include: {
      hotel: { select: { name: true, totalRooms: true } },
      months: { orderBy: { month: "asc" } },
    },
  });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch TFH settings
  const settings = await prisma.simplePlannerSettings.findUnique({
    where: { hotelId: plan.hotelId },
    include: { costBands: { orderBy: { sortOrder: "asc" } } },
  });

  const tfhEnabled = settings?.tfhEnabled ?? false;
  const tfhRate = settings?.tfhRate ?? 4;
  const costBands = settings?.costBands ?? [];
  const totalRooms = plan.hotel.totalRooms ?? 0;
  const year = plan.year;

  function getCostFromBands(occupancyPct: number): number | null {
    if (costBands.length === 0) return null;
    const band = costBands.find(b => occupancyPct >= b.fromOccPct && occupancyPct <= b.toOccPct);
    return band ? band.costPerRoom : null;
  }

  // Build monthly summary lines
  let monthLines = "";
  let annualRevenue = 0;
  let annualCost = 0;
  let annualTfh = 0;
  let filledMonths = 0;
  let totalOcc = 0;
  let bestMonth = "";
  let bestProfit = -Infinity;
  let worstMonth = "";
  let worstProfit = Infinity;

  for (const m of plan.months) {
    const days = getDaysInMonth(m.month, year);
    const availableNights = totalRooms * days;
    const roomNights = (m.occupancyPct / 100) * availableNights;
    const effectiveCost = m.monthlyCost > 0 ? m.monthlyCost : (getCostFromBands(m.occupancyPct) ?? 0);
    const revenue = m.roomRevenue > 0 ? m.roomRevenue * roomNights : roomNights * m.adr;
    const cost = effectiveCost * roomNights;
    const tfh = tfhEnabled ? revenue * (tfhRate / 100) : 0;
    const profit = revenue - cost - tfh;

    const hasData = m.adr > 0 || m.occupancyPct > 0 || m.roomRevenue > 0 || m.monthlyCost > 0;
    if (hasData) {
      filledMonths++;
      totalOcc += m.occupancyPct;
      if (profit > bestProfit) { bestProfit = profit; bestMonth = HU_MONTHS[m.month - 1]; }
      if (profit < worstProfit) { worstProfit = profit; worstMonth = HU_MONTHS[m.month - 1]; }
    }

    annualRevenue += revenue;
    annualCost += cost;
    annualTfh += tfh;

    const unitRate = m.roomRevenue > 0 ? m.roomRevenue : m.adr;
    monthLines += `  ${HU_MONTHS[m.month - 1]}: kihasználtság ${m.occupancyPct}%, ${
      m.roomRevenue > 0 ? `szobaárbevétel ${fmt(m.roomRevenue)} Ft/szoba/éj` : `ADR ${fmt(m.adr)} Ft`
    }, kiadás ${fmt(effectiveCost)} Ft/szoba/éj, bevétel ${fmt(revenue)} Ft, profit ${fmt(profit)} Ft${unitRate === 0 ? " (nincs adat)" : ""}\n`;
  }

  const annualProfit = annualRevenue - annualCost - annualTfh;
  const avgOcc = filledMonths > 0 ? totalOcc / filledMonths : 0;

  const prompt = `Te egy szállodai profit-tervező rendszer összefoglaló generátora vagy.

Az alábbi Simple Planner terv adatai alapján írj egy rövid, professzionális, ügyfél-barát összefoglalót.
Ez az összefoglaló a tervhez tartozó megosztott prezentáción fog megjelenni.

Hotel: ${plan.hotel.name}
Szobák: ${totalRooms}
Év: ${year}

Havi adatok:
${monthLines}
Éves összesítő:
- Összes bevétel: ${fmt(annualRevenue)} Ft
- Összes kiadás: ${fmt(annualCost)} Ft
${tfhEnabled ? `- TFH (${tfhRate}%): ${fmt(annualTfh)} Ft\n` : ""}- Profit: ${fmt(annualProfit)} Ft
- Átlag kihasználtság: ${Math.round(avgOcc)}%
${bestMonth ? `- Legjobb hónap: ${bestMonth} (${fmt(bestProfit)} Ft profit)` : ""}
${worstMonth && worstMonth !== bestMonth ? `- Leggyengébb hónap: ${worstMonth} (${fmt(worstProfit)} Ft profit)` : ""}

Írj 2-3 bekezdéses, tömör, pozitív hangvételű összefoglalót magyarul. Emeld ki a főbb eredményeket (éves bevétel, profit, kihasználtság). Megemlítheted a legjobb és leggyengébb hónapokat. Legyen professzionális, de olvasható egy nem szakember ügyfélnek is. Ne adj tanácsot, csak ismertesd a terv főbb számait és trendjeit.`;

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const msgStream = client.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const chunk of msgStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk.delta.text })}\n\n`));
          }
        }

        const finalMsg = await msgStream.finalMessage();
        logTokenUsage({
          feature: "share_summary",
          model: "claude-haiku-4-5",
          inputTokens: finalMsg.usage.input_tokens,
          outputTokens: finalMsg.usage.output_tokens,
          userId,
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
