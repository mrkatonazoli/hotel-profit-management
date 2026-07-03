import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ planId: string }> };

// GET — tényadatok lekérése
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const plan = await prisma.simplePlan.findUnique({ where: { id: planId }, select: { hotelId: true } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const actuals = await prisma.simplePlanActual.findMany({
    where: { planId },
    orderBy: { month: "asc" },
  });

  return NextResponse.json(actuals);
}

// PUT — tényadatok mentése (upsert havonként)
export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const plan = await prisma.simplePlan.findUnique({ where: { id: planId }, select: { hotelId: true } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { actuals } = await req.json() as {
    actuals: { month: number; occupancyPct: number; adr: number; totalRevenue: number }[];
  };

  await Promise.all(actuals.map(a =>
    prisma.simplePlanActual.upsert({
      where: { planId_month: { planId, month: a.month } },
      create: { planId, month: a.month, occupancyPct: a.occupancyPct, adr: a.adr, totalRevenue: a.totalRevenue },
      update: { occupancyPct: a.occupancyPct, adr: a.adr, totalRevenue: a.totalRevenue },
    })
  ));

  return NextResponse.json({ ok: true });
}
