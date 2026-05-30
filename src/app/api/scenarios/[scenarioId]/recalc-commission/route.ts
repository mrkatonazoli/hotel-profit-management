import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";

// POST /api/scenarios/[scenarioId]/recalc-commission
// Újraszámolja a commissionCost-ot minden PlanDay-re a szegmens mix alapján
// (nem generál újra, csak a meglévő roomRevenue adatokat frissíti)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ scenarioId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;

  // Szegmensek betöltése csatorna mixszel
  const segments = await prisma.scenarioSegment.findMany({
    where: { scenarioId },
    include: {
      monthShares: true,
      channelMix: { include: { distributor: true } },
    },
  });

  if (segments.length === 0) {
    return NextResponse.json({ updated: 0, message: "Nincs szegmens beállítva" });
  }

  // Havi effektív komisszió ráta: Σ(segmentShare% × segmentCommission%)
  const monthlyCommissionRate: Record<number, number> = {};
  for (let month = 1; month <= 12; month++) {
    let rate = 0;
    for (const seg of segments) {
      const segShare = (seg.monthShares.find(m => m.month === month)?.sharePct ?? 0) / 100;
      if (segShare === 0) continue;

      let segCommPct = 0;
      if (seg.useChannelMix) {
        const annualChannels = seg.channelMix.filter(c => c.month === null);
        const monthChannels  = seg.channelMix.filter(c => c.month === month);
        const channels = monthChannels.length > 0 ? monthChannels : annualChannels;
        segCommPct = channels.reduce((sum, c) =>
          sum + (c.sharePct / 100) * (c.distributor.isCommission ? c.distributor.commissionPct : 0), 0,
        );
      } else {
        segCommPct = seg.commissionPct;
      }

      rate += segShare * segCommPct;
    }
    monthlyCommissionRate[month] = rate / 100; // → 0.0–1.0
  }

  // PlanDay-ek betöltése
  const planDays = await prisma.planDay.findMany({
    where: { scenarioId },
    select: { id: true, date: true, roomRevenue: true },
  });

  if (planDays.length === 0) {
    return NextResponse.json({ updated: 0, message: "Nincs generált napi adat" });
  }

  const updates = planDays.map(day => ({
    id:             day.id,
    commissionCost: Math.round(day.roomRevenue * (monthlyCommissionRate[new Date(day.date).getUTCMonth() + 1] ?? 0)),
  }));

  // Egyetlen bulk UPDATE
  await prisma.$executeRaw`
    UPDATE "PlanDay" p
    SET "commissionCost" = v.cost::int
    FROM (VALUES ${Prisma.join(
      updates.map(u => Prisma.sql`(${u.id}::text, ${u.commissionCost}::int)`)
    )}) AS v(id, cost)
    WHERE p.id = v.id
  `;

  const totalCommission = updates.reduce((s, u) => s + u.commissionCost, 0);

  return NextResponse.json({
    updated: planDays.length,
    totalCommission,
    message: `${planDays.length} nap kommissziója frissítve`,
  });
}
