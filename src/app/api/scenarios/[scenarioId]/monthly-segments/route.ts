import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/scenarios/[scenarioId]/monthly-segments?month=6&year=2026
export async function GET(
  req: Request,
  { params }: { params: Promise<{ scenarioId: string }> },
) {
  const { scenarioId } = await params;
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "1");
  const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));

  // PlanDay-ek a hónapra
  const planDays = await prisma.planDay.findMany({
    where: {
      scenarioId,
      date: {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt:  new Date(Date.UTC(year, month, 1)),
      },
    },
    select: { roomRevenue: true, commissionCost: true },
  });

  const totalRoomRevenue  = planDays.reduce((s, d) => s + d.roomRevenue, 0);
  const totalCommission   = planDays.reduce((s, d) => s + d.commissionCost, 0);

  if (totalRoomRevenue === 0) {
    return NextResponse.json({ segments: [], totalRoomRevenue: 0, totalCommission: 0, hasData: false });
  }

  // Szegmensek betöltése
  const segments = await prisma.scenarioSegment.findMany({
    where: { scenarioId },
    include: {
      monthShares: { where: { month } },
      channelMix: {
        include: { distributor: true },
        where: { OR: [{ month: null }, { month }] },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  if (segments.length === 0) {
    return NextResponse.json({ segments: [], totalRoomRevenue, totalCommission, hasData: true });
  }

  const result = segments.map(seg => {
    const sharePct = seg.monthShares[0]?.sharePct ?? 0;
    const segRevenue = Math.round(totalRoomRevenue * sharePct / 100);

    // Effektív komisszió ráta
    let effectiveCommPct = 0;
    if (seg.useChannelMix) {
      const annualCh = seg.channelMix.filter(c => c.month === null);
      const monthCh  = seg.channelMix.filter(c => c.month === month);
      const channels = monthCh.length > 0 ? monthCh : annualCh;
      effectiveCommPct = channels.reduce((s: number, c: { sharePct: number; distributor: { isCommission: boolean; commissionPct: number } }) =>
        s + (c.sharePct / 100) * (c.distributor.isCommission ? c.distributor.commissionPct : 0), 0,
      );
    } else {
      effectiveCommPct = seg.commissionPct;
    }

    const segCommission = Math.round(segRevenue * effectiveCommPct / 100);

    return {
      id:               seg.id,
      name:             seg.name,
      sharePct,
      roomRevenue:      segRevenue,
      effectiveCommPct: Math.round(effectiveCommPct * 10) / 10,
      commission:       segCommission,
      useChannelMix:    seg.useChannelMix,
    };
  });

  return NextResponse.json({
    segments: result,
    totalRoomRevenue,
    totalCommission,
    hasData: true,
  });
}
