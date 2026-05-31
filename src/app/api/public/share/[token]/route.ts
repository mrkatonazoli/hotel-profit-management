import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;

  const plan = await prisma.simplePlan.findFirst({
    where: { shareToken: token, shareEnabled: true },
    include: {
      hotel: { select: { id: true, name: true, totalRooms: true } },
      months: { orderBy: { month: "asc" } },
    },
  });

  if (!plan) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (plan.shareExpiresAt && plan.shareExpiresAt < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  // Fetch settings for cost band calculation
  const settings = await prisma.simplePlannerSettings.findUnique({
    where: { hotelId: plan.hotelId },
    include: { costBands: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({
    plan: {
      id: plan.id,
      name: plan.name,
      year: plan.year,
      shareSummary: plan.shareSummary,
      shareExpiresAt: plan.shareExpiresAt ? plan.shareExpiresAt.toISOString() : null,
    },
    hotel: {
      name: plan.hotel.name,
      totalRooms: plan.hotel.totalRooms,
    },
    months: plan.months,
    settings: {
      tfhEnabled: settings?.tfhEnabled ?? false,
      tfhRate: settings?.tfhRate ?? 4,
      costBands: settings?.costBands?.map(b => ({
        fromOccPct: b.fromOccPct,
        toOccPct: b.toOccPct,
        costPerRoom: b.costPerRoom,
      })) ?? [],
    },
  });
}
