import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scenarioId = searchParams.get("scenarioId");

  // Load hotel
  const hotel = await prisma.hotel.findFirst({
    include: { scenarios: { orderBy: [{ isBase: "desc" }, { year: "desc" }, { probability: "desc" }] } },
  });
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  // Pick scenario
  const scenario = scenarioId
    ? hotel.scenarios.find(s => s.id === scenarioId) ?? hotel.scenarios[0]
    : hotel.scenarios.find(s => s.isBase) ?? hotel.scenarios[0];

  if (!scenario) return NextResponse.json({ error: "No scenario" }, { status: 404 });

  // Load plan days for this scenario
  const planDays = await prisma.planDay.findMany({
    where: { scenarioId: scenario.id },
    orderBy: { date: "asc" },
  });

  const totalRooms = hotel.totalRooms ?? 0;

  // Aggregate by month
  const monthMap: Record<number, {
    roomNights: number; roomRevenue: number;
    fbRevenue: number; spaRevenue: number; otherRevenue: number;
    occSum: number; dayCount: number;
  }> = {};

  for (let m = 1; m <= 12; m++) {
    monthMap[m] = { roomNights: 0, roomRevenue: 0, fbRevenue: 0, spaRevenue: 0, otherRevenue: 0, occSum: 0, dayCount: 0 };
  }

  for (const pd of planDays) {
    const m = pd.date.getUTCMonth() + 1;
    monthMap[m].dayCount++;
    monthMap[m].occSum += pd.occupancyPct;
    monthMap[m].roomNights += totalRooms > 0 ? Math.round(pd.occupancyPct / 100 * totalRooms) : 0;
    monthMap[m].roomRevenue += pd.roomRevenue;
    monthMap[m].fbRevenue += pd.fbRevenue;
    monthMap[m].spaRevenue += pd.spaRevenue;
    monthMap[m].otherRevenue += pd.otherRevenue;
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const d = monthMap[m];
    const avgOcc = d.dayCount > 0 ? Math.round(d.occSum / d.dayCount * 10) / 10 : 0;
    const avgAdr = d.roomNights > 0 ? Math.round(d.roomRevenue / d.roomNights) : 0;
    const daysInMonth = d.dayCount || new Date(scenario.year, m, 0).getDate();
    const revpar = totalRooms > 0 && daysInMonth > 0
      ? Math.round(d.roomRevenue / (totalRooms * daysInMonth)) : 0;
    return {
      month: m, dayCount: d.dayCount,
      roomNights: d.roomNights, roomRevenue: d.roomRevenue,
      fbRevenue: d.fbRevenue, spaRevenue: d.spaRevenue, otherRevenue: d.otherRevenue,
      totalRevenue: d.roomRevenue + d.fbRevenue + d.spaRevenue + d.otherRevenue,
      avgOcc, avgAdr, revpar,
    };
  });

  const filledMonths = months.filter(m => m.dayCount > 0);
  const totalRoomRevenue  = months.reduce((a, m) => a + m.roomRevenue, 0);
  const totalFbRevenue    = months.reduce((a, m) => a + m.fbRevenue, 0);
  const totalSpaRevenue   = months.reduce((a, m) => a + m.spaRevenue, 0);
  const totalOtherRevenue = months.reduce((a, m) => a + m.otherRevenue, 0);
  const totalRevenue      = totalRoomRevenue + totalFbRevenue + totalSpaRevenue + totalOtherRevenue;
  const totalRoomNights   = months.reduce((a, m) => a + m.roomNights, 0);
  const avgOccPct = filledMonths.length > 0
    ? Math.round(filledMonths.reduce((a, m) => a + m.avgOcc, 0) / filledMonths.length * 10) / 10 : 0;
  const avgAdr = totalRoomNights > 0 ? Math.round(totalRoomRevenue / totalRoomNights) : 0;
  const totalDays = filledMonths.reduce((a, m) => a + m.dayCount, 0);
  const revpar = totalRooms > 0 && totalDays > 0
    ? Math.round(totalRoomRevenue / (totalRooms * totalDays)) : 0;

  return NextResponse.json({
    hotel: { name: hotel.name, totalRooms: hotel.totalRooms },
    scenario: { id: scenario.id, name: scenario.name, year: scenario.year, probability: scenario.probability, isBase: scenario.isBase },
    scenarios: hotel.scenarios.map(s => ({ id: s.id, name: s.name, year: s.year, probability: s.probability, isBase: s.isBase })),
    hasData: planDays.length > 0,
    kpis: { totalRoomRevenue, totalFbRevenue, totalSpaRevenue, totalOtherRevenue, totalRevenue, totalRoomNights, avgOccPct, avgAdr, revpar },
    months,
  });
}
