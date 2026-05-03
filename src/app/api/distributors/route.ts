import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function getHotel() {
  return prisma.hotel.findFirst();
}

export async function GET() {
  const hotel = await getHotel();
  if (!hotel) return NextResponse.json([]);

  const distributors = await prisma.distributor.findMany({
    where: { hotelId: hotel.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(distributors);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  const { name, commissionPct } = await req.json();

  const dist = await prisma.distributor.create({
    data: {
      hotelId: hotel.id,
      name: String(name ?? ""),
      commissionPct: Number(commissionPct ?? 0),
    },
  });

  return NextResponse.json(dist, { status: 201 });
}
