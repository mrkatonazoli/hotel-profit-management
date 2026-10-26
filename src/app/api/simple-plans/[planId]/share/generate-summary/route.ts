import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { computeMonthCalc } from "@/lib/simple-planner-calc";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/anthropic";
import { logTokenUsage } from "@/lib/token-log";

type Params = { params: Promise<{ planId: string }> };

const HU_MONTHS = [
  "Január","Február","Március","Április","Május","Június",
  "Július","Augusztus","Szeptember","Október","November","December",
];

function fmt(n: number) { return Math.round(n).toLocaleString("hu-HU"); }

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { planId } = await params;
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const plan = await prisma.simplePlan.findUnique({
    where: { id: planId },
    include: {
      hotel: { select: { name: true, totalRooms: true } },
      months: { orderBy: { month: "asc" } },
      actuals: { orderBy: { month: "asc" } },
    },
  });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.hotelId !== hotel.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.simplePlannerSettings.findUnique({
    where: { hotelId: plan.hotelId },
    include: { fixedCosts: { orderBy: { sortOrder: "asc" } } },
  });

  const costsEnabled = settings?.costsEnabled ?? true;
  const tfhEnabled = costsEnabled && (settings?.tfhEnabled ?? false);
  const tfhRate = settings?.tfhRate ?? 4;
  const fbEnabled = settings?.fbEnabled ?? false;
  const totalRooms = plan.hotel.totalRooms ?? 0;
  const year = plan.year;
  const annualFixedCost = (settings?.fixedCosts ?? []).reduce((s, fc) => s + fc.annualAmount, 0);
  const avgPaxPerRoom = settings?.avgPaxPerRoom ?? 1.8;
  const breakfastPrice = settings?.breakfastPrice ?? 0;
  const halfboardPrice = settings?.halfboardPrice ?? 0;
  const breakfastCost = settings?.breakfastCost ?? 0;
  const halfboardCost = settings?.halfboardCost ?? 0;
  const laundryEnabled = settings?.laundryEnabled ?? false;
  const laundryPerRoom = settings?.laundryPerRoom ?? 0;
  const commissionEnabled = settings?.commissionEnabled ?? false;
  const commissionPct = settings?.commissionPct ?? 0;
  const commissionBookingsPct = settings?.commissionBookingsPct ?? 100;

  const fb = {
    enabled: fbEnabled,
    breakfastPrice,
    halfboardPrice,
    avgPaxPerRoom,
    fbOtherEnabled: false,
    fbOtherPct: 0,
    spaEnabled: false,
    spaPct: 0,
    otherRevenueEnabled: false,
    otherRevenuePct: 0,
  };
  const costs = {
    annualFixedCost,
    breakfastCost,
    halfboardCost,
    avgPaxPerRoom,
    laundryEnabled,
    laundryPerRoom,
    commissionEnabled,
    commissionPct,
    commissionBookingsPct,
  };

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
  const planRevByMonth = new Map<number, { revenue: number; hasData: boolean }>();

  for (const rawMonth of plan.months) {
    const m = costsEnabled ? rawMonth : { ...rawMonth, roomRevenue: 0 };
    const c = computeMonthCalc(
      { ...m, breakfastPct: m.breakfastPct ?? 0, halfboardPct: m.halfboardPct ?? 0 },
      totalRooms, year, tfhEnabled ? tfhRate : 0, fb, costsEnabled ? costs : undefined
    );
    const effectiveCostPerRoom = c.roomNights > 0 ? c.cost / c.roomNights : 0;

    if (c.hasData) {
      filledMonths++;
      totalOcc += m.occupancyPct;
      const score = costsEnabled ? c.profit : c.revenue;
      if (score > bestProfit) { bestProfit = score; bestMonth = HU_MONTHS[m.month - 1]; }
      if (score < worstProfit) { worstProfit = score; worstMonth = HU_MONTHS[m.month - 1]; }
    }

    planRevByMonth.set(m.month, { revenue: c.revenue, hasData: c.hasData });
    annualRevenue += c.revenue;
    annualCost += c.cost;
    annualTfh += c.tfh;

    const unitRate = m.roomRevenue > 0 ? m.roomRevenue : m.adr;
    monthLines += `  ${HU_MONTHS[m.month - 1]}: kihasználtság ${m.occupancyPct}%, ${
      m.roomRevenue > 0 ? `szobaárbevétel ${fmt(m.roomRevenue)} Ft/szoba/éj` : `ADR ${fmt(m.adr)} Ft`
    }${costsEnabled ? `, kiadás ${fmt(effectiveCostPerRoom)} Ft/szoba/éj` : ""}, bevétel ${fmt(c.revenue)} Ft${costsEnabled ? `, profit ${fmt(c.profit)} Ft` : ""}${unitRate === 0 ? " (nincs adat)" : ""}${m.note ? ` — megjegyzés: ${m.note}` : ""}\n`;
  }

  const annualProfit = annualRevenue - annualCost - annualTfh;
  const avgOcc = filledMonths > 0 ? totalOcc / filledMonths : 0;

  const metric = costsEnabled ? "profit" : "bevétel";
  const annualLines = costsEnabled
    ? `- Összes bevétel: ${fmt(annualRevenue)} Ft
- Összes kiadás: ${fmt(annualCost)} Ft
${tfhEnabled ? `- TFH (${tfhRate}%): ${fmt(annualTfh)} Ft\n` : ""}- Profit: ${fmt(annualProfit)} Ft`
    : `- Összes bevétel: ${fmt(annualRevenue)} Ft`;

  const prevYear = year - 1;
  const prevActuals = plan.actuals.filter(a => a.totalRevenue > 0 || a.occupancyPct > 0 || a.adr > 0);
  let prevBlock = "";
  if (prevActuals.length > 0) {
    let prevTotal = 0;
    let planTotal = 0;
    const lines = prevActuals.map(a => {
      const p = planRevByMonth.get(a.month);
      const prevRev = a.totalRevenue > 0
        ? a.totalRevenue
        : a.adr * totalRooms * new Date(prevYear, a.month, 0).getDate() * (a.occupancyPct / 100);
      prevTotal += prevRev;
      planTotal += p?.revenue ?? 0;
      return `  ${HU_MONTHS[a.month - 1]}: ${prevYear} tény — kihasználtság ${a.occupancyPct}%, ADR ${fmt(a.adr)} Ft, bevétel ${fmt(prevRev)} Ft; ${year} terv bevétel ${p?.hasData ? `${fmt(p.revenue)} Ft` : "nincs megadva"}${a.note ? ` — tény megjegyzés: ${a.note}` : ""}`;
    });
    const diff = planTotal - prevTotal;
    const diffPct = prevTotal > 0 ? (diff / prevTotal) * 100 : 0;
    prevBlock = `
Előző év (${prevYear}) tényadatai az összevethető hónapokra:
${lines.join("\n")}
- Összevetett hónapok: ${prevActuals.length}; ${prevYear} tény összesen ${fmt(prevTotal)} Ft, ${year} terv ugyanerre ${fmt(planTotal)} Ft; eltérés (terv − tény): ${diff >= 0 ? "+" : ""}${fmt(diff)} Ft (${diff >= 0 ? "+" : ""}${diffPct.toFixed(1)}%)
`;
  }

  const prompt = `Te egy szállodai ${costsEnabled ? "profit" : "bevétel"}-tervező rendszer összefoglaló generátora vagy.

Az alábbi Simple Planner terv adatai alapján írj egy rövid, professzionális, ügyfél-barát összefoglalót.
Ez az összefoglaló a tervhez tartozó megosztott prezentáción fog megjelenni.

Hotel: ${plan.hotel.name}
Szobák: ${totalRooms}
Év: ${year}

Havi adatok:
${monthLines}
Éves összesítő:
${annualLines}
- Átlag kihasználtság: ${Math.round(avgOcc)}%
${bestMonth ? `- Legjobb hónap: ${bestMonth} (${fmt(bestProfit)} Ft ${metric})` : ""}
${worstMonth && worstMonth !== bestMonth ? `- Leggyengébb hónap: ${worstMonth} (${fmt(worstProfit)} Ft ${metric})` : ""}
${prevBlock}${prevBlock ? `
Az előző évi tényadatokkal való összevetést is írd bele egy külön bekezdésben: mennyivel tervez többet vagy kevesebbet a(z) ${year}. évi terv a(z) ${prevYear}. évi tényhez képest az összevethető hónapokban, és ez inkább a kihasználtság vagy az átlagár (ADR) változásából adódik. Ha valamelyik hónapra nincs terv, azt ne értékeld. Ha a hónapoknál megjegyzés szerepel, azt felhasználhatod az eltérések magyarázatára, de ne idézd szó szerint.
` : ""}
Írj 2-4 bekezdéses, tömör, pozitív hangvételű összefoglalót magyarul. Emeld ki a főbb eredményeket (${costsEnabled ? "éves bevétel, profit, kihasználtság" : "éves bevétel, ADR, kihasználtság — ez a terv csak a bevételi oldalt tartalmazza, költségekről és profitról ne írj"}). Megemlítheted a legjobb és leggyengébb hónapokat. Legyen professzionális, de olvasható egy nem szakember ügyfélnek is. Ne adj tanácsot, csak ismertesd a terv főbb számait és trendjeit.`;

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
