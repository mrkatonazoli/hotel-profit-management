import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ planId: string }> };

type MonthInput = {
  month: number;
  adr: number;
  occupancyPct: number;
  monthlyCost: number;
};

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const body = await req.json();
  const months: MonthInput[] = body.months ?? [];

  // Verify plan exists
  const plan = await prisma.simplePlan.findUnique({ where: { id: planId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Use findFirst + update/create pattern (avoid prisma upsert with unique constraints)
  for (const m of months) {
    const existing = await prisma.simplePlanMonth.findFirst({
      where: { planId, month: m.month },
    });

    if (existing) {
      await prisma.simplePlanMonth.update({
        where: { id: existing.id },
        data: {
          adr: m.adr,
          occupancyPct: m.occupancyPct,
          monthlyCost: m.monthlyCost,
        },
      });
    } else {
      await prisma.simplePlanMonth.create({
        data: {
          planId,
          month: m.month,
          adr: m.adr,
          occupancyPct: m.occupancyPct,
          monthlyCost: m.monthlyCost,
        },
      });
    }
  }

  const updated = await prisma.simplePlan.findUnique({
    where: { id: planId },
    include: { months: { orderBy: { month: "asc" } } },
  });

  return NextResponse.json(updated);
}
