import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { prisma } from "@/lib/prisma";

/** Pair (or unpair) the active HeyMax hotel with a DataHeaven hotel. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const dataheavenHotelId = typeof body.dataheavenHotelId === "string" && body.dataheavenHotelId ? body.dataheavenHotelId : null;
  await prisma.hotel.update({ where: { id: hotel.id }, data: { dataheavenHotelId } });
  return NextResponse.json({ ok: true, dataheavenHotelId });
}
