import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

// GET /api/distributors?commissionOnly=true
export async function GET(req: Request) {
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const commissionOnly = searchParams.get("commissionOnly") === "true";

  const distributors = await prisma.distributor.findMany({
    where: {
      hotelId: hotel.id,
      ...(commissionOnly ? { isCommission: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(distributors);
}

// POST /api/distributors
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hotel = await getActiveHotel();
    if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

    const body = await req.json();
    const { name, isCommission, commissionPct, sortOrder } = body;

    const dist = await prisma.distributor.create({
      data: {
        hotelId: hotel.id,
        name: String(name ?? "").trim(),
        isCommission: Boolean(isCommission ?? true),
        commissionPct: Number(commissionPct ?? 0),
        sortOrder: Number(sortOrder ?? 0),
      },
    });

    return NextResponse.json(dist, { status: 201 });
  } catch (err) {
    console.error("[POST /api/distributors]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
