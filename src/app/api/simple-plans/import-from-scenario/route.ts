import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

// GET /api/simple-plans/import-from-scenario?scenarioId=XXX
// Returns monthly avg ADR + avg occupancy from the scenario's generated PlanDays.
// Only the 12 calendar months are returned; months with no PlanDay rows get 0.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const scenarioId = searchParams.get("scenarioId");
  if (!scenarioId) return NextResponse.json({ error: "scenarioId required" }, { status: 400 });

  // Verify the scenario belongs to this hotel
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { id: true, name: true, year: true, hotelId: true },
  });
  if (!scenario || scenario.hotelId !== hotel.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch all plan days for the scenario
  const planDays = await prisma.planDay.findMany({
    where: { scenarioId },
    select: { date: true, adr: true, occupancyPct: true },
  });

  if (planDays.length === 0) {
    return NextResponse.json({
      scenario: { id: scenario.id, name: scenario.name, year: scenario.year },
      months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, avgAdr: 0, avgOcc: 0 })),
      hasData: false,
    });
  }

  // Group by calendar month and compute averages
  const byMonth: Record<number, { adrSum: number; occSum: number; count: number }> = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { adrSum: 0, occSum: 0, count: 0 };

  for (const day of planDays) {
    const m = new Date(day.date).getMonth() + 1; // 1-based
    byMonth[m].adrSum += day.adr;
    byMonth[m].occSum += day.occupancyPct;
    byMonth[m].count += 1;
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const { adrSum, occSum, count } = byMonth[m];
    return {
      month: m,
      avgAdr: count > 0 ? Math.round(adrSum / count) : 0,
      avgOcc: count > 0 ? Math.round((occSum / count) * 10) / 10 : 0,
    };
  });

  return NextResponse.json({
    scenario: { id: scenario.id, name: scenario.name, year: scenario.year },
    months,
    hasData: true,
  });
}
