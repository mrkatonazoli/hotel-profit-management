import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Resolves the active hotel for the current request.
 * Priority: selectedHotelId cookie → first accessible hotel.
 * SUPER_ADMIN can access any hotel.
 * Returns null if no hotel found or user is unauthorized.
 */
export async function getActiveHotel() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const cookieStore = await cookies();
  const cookieHotelId = cookieStore.get("selectedHotelId")?.value;

  if (user?.role === "SUPER_ADMIN") {
    // Super admin: cookie hotel or first hotel
    if (cookieHotelId) {
      const hotel = await prisma.hotel.findUnique({ where: { id: cookieHotelId } });
      if (hotel) return hotel;
    }
    return prisma.hotel.findFirst({ orderBy: { name: "asc" } });
  }

  // Regular user: must have access via HotelUser
  if (cookieHotelId) {
    const hu = await prisma.hotelUser.findUnique({
      where: { hotelId_userId: { hotelId: cookieHotelId, userId: session.user.id } },
      include: { hotel: true },
    });
    if (hu) return hu.hotel;
  }

  // Fallback: first hotel the user has access to
  const hu = await prisma.hotelUser.findFirst({
    where: { userId: session.user.id },
    include: { hotel: true },
    orderBy: { hotel: { name: "asc" } },
  });
  return hu?.hotel ?? null;
}
