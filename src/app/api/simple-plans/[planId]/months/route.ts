import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ planId: string }> };

type MonthInput = {
  month: number;
  adr: number;
  occupancyPct: number;
  roomRevenue: number;
  monthlyCost: number;
  breakfastPct: number;
  halfboardPct: number;
};

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const body = await req.json();
  const months: MonthInput[] = body.months ?? [];

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const plan = await prisma.simplePlan.findUnique({ where: { id: planId }, select: { hotelId: true } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.hotelId !== hotel.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$transaction(
    months.map(m =>
      prisma.simplePlanMonth.upsert({
        where: { planId_month: { planId, month: m.month } },
        create: {
          planId,
          month: m.month,
          adr: m.adr,
          occupancyPct: m.occupancyPct,
          roomRevenue: m.roomRevenue,
          monthlyCost: m.monthlyCost,
          breakfastPct: m.breakfastPct ?? 0,
          halfboardPct: m.halfboardPct ?? 0,
        },
        update: {
          adr: m.adr,
          occupancyPct: m.occupancyPct,
          roomRevenue: m.roomRevenue,
          monthlyCost: m.monthlyCost,
          breakfastPct: m.breakfastPct ?? 0,
          halfboardPct: m.halfboardPct ?? 0,
        },
      })
    )
  );

  const updated = await prisma.simplePlan.findUnique({
    where: { id: planId },
    include: { months: { orderBy: { month: "asc" } } },
  });

  return NextResponse.json(updated);
}
