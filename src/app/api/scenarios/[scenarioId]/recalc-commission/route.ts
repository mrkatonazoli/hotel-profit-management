import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { calcMonthlyCommissionRate } from "@/lib/segment-commission";

// POST /api/scenarios/[scenarioId]/recalc-commission
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ scenarioId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;

  // Szegmensek + hotel csatornák párhuzamos betöltése
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { hotel: { select: { distributors: true } } },
  });

  const [segments] = await Promise.all([
    prisma.scenarioSegment.findMany({
      where: { scenarioId },
      include: {
        monthShares: true,
        channelMix: { include: { distributor: true } },
      },
    }),
  ]);

  const hotelDistributors = scenario?.hotel.distributors ?? [];

  if (segments.length === 0) {
    return NextResponse.json({ updated: 0, message: "Nincs szegmens beállítva" });
  }

  // Havi effektív komisszió ráta
  const monthlyCommissionRate: Record<number, number> = {};
  for (let month = 1; month <= 12; month++) {
    monthlyCommissionRate[month] = calcMonthlyCommissionRate(segments, month, hotelDistributors);
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
