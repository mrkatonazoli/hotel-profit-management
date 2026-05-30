import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json([]);

  const plans = await prisma.simplePlan.findMany({
    where: { hotelId: hotel.id },
    include: { months: { orderBy: { month: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(plans);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const name = body.name ?? `Terv ${new Date().getFullYear()}`;
  const year = body.year ?? 2026;

  const plan = await prisma.simplePlan.create({
    data: {
      hotelId: hotel.id,
      name,
      year,
      months: {
        create: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          adr: 0,
          occupancyPct: 0,
          monthlyCost: 0,
        })),
      },
    },
    include: { months: { orderBy: { month: "asc" } } },
  });

  return NextResponse.json(plan, { status: 201 });
}
