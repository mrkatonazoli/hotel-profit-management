import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { prisma } from "@/lib/prisma";
import { dhFetch } from "@/lib/dataheaven";

/** Reporting bundle for the active hotel's paired DataHeaven hotel. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const isAdmin = user?.role === "SUPER_ADMIN";
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });
  if (!hotel.dataheavenHotelId) return NextResponse.json({ notPaired: true, isAdmin }, { status: 412 });

  const url = new URL(req.url);
  const qs = new URLSearchParams();
  for (const k of ["year", "mfrom", "mto", "cmp", "month"]) {
    const v = url.searchParams.get(k);
    if (v) qs.set(k, v);
  }
  const res = await dhFetch(`/api/v1/hotels/${hotel.dataheavenHotelId}/metrics?${qs.toString()}`, 300);
  if (!res.ok) return NextResponse.json({ error: "DataHeaven API hiba" }, { status: 502 });
  const bundle = await res.json();
  return NextResponse.json({ ...bundle, isAdmin });
}
