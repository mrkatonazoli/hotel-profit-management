import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/hotels/list
 * Returns all hotels the current user has access to.
 * SUPER_ADMIN sees all hotels.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role === "SUPER_ADMIN") {
    const hotels = await prisma.hotel.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, baseCurrency: true, totalRooms: true },
    });
    return NextResponse.json(hotels);
  }

  const hotelUsers = await prisma.hotelUser.findMany({
    where: { userId: session.user.id },
    include: {
      hotel: { select: { id: true, name: true, baseCurrency: true, totalRooms: true } },
    },
    orderBy: { hotel: { name: "asc" } },
  });

  return NextResponse.json(hotelUsers.map(hu => ({ ...hu.hotel, role: hu.role })));
}
