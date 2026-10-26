import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ planId: string }> };

function cleanNote(n: unknown): string | null | undefined {
  if (n === undefined) return undefined;
  if (typeof n !== "string") return null;
  const t = n.trim().slice(0, 500);
  return t === "" ? null : t;
}

// GET — tényadatok lekérése
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const plan = await prisma.simplePlan.findUnique({ where: { id: planId }, select: { hotelId: true } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.hotelId !== hotel.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const plan = await prisma.simplePlan.findUnique({ where: { id: planId }, select: { hotelId: true } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.hotelId !== hotel.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { actuals } = await req.json() as {
    actuals: { month: number; occupancyPct: number; adr: number; totalRevenue: number; note?: string | null }[];
  };

  await Promise.all(actuals.map(a =>
    prisma.simplePlanActual.upsert({
      where: { planId_month: { planId, month: a.month } },
      create: { planId, month: a.month, occupancyPct: a.occupancyPct, adr: a.adr, totalRevenue: a.totalRevenue, note: cleanNote(a.note) ?? null },
      update: {
        occupancyPct: a.occupancyPct, adr: a.adr, totalRevenue: a.totalRevenue,
        ...(cleanNote(a.note) !== undefined && { note: cleanNote(a.note) }),
      },
    })
  ));

  return NextResponse.json({ ok: true });
}
