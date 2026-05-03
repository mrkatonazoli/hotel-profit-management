import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const cookieStore = await cookies();
  const cookieHotelId = cookieStore.get("selectedHotelId")?.value;

  if (user?.role === "SUPER_ADMIN") {
    const hotelCount = await prisma.hotel.count();
    if (hotelCount > 1) {
      // If the selected hotel isn't onboarded, go to onboarding
      if (cookieHotelId) {
        const hotel = await prisma.hotel.findUnique({ where: { id: cookieHotelId }, select: { isOnboarded: true } });
        if (hotel && !hotel.isOnboarded) redirect("/onboarding");
      }
      redirect("/select-hotel");
    }
    // Only one hotel — check onboarding
    const hotel = await prisma.hotel.findFirst({ select: { isOnboarded: true } });
    if (hotel && !hotel.isOnboarded) redirect("/onboarding");
    redirect("/dashboard");
  }

  const hotelUsers = await prisma.hotelUser.findMany({
    where: { userId: session.user.id },
    include: { hotel: { select: { id: true, isOnboarded: true } } },
    orderBy: { hotel: { name: "asc" } },
  });

  if (hotelUsers.length === 0) redirect("/no-hotel");

  // Determine active hotel
  let activeHotel = hotelUsers.find(hu => hu.hotel.id === cookieHotelId)?.hotel
    ?? hotelUsers[0]?.hotel;

  if (activeHotel && !activeHotel.isOnboarded) redirect("/onboarding");

  if (hotelUsers.length > 1) redirect("/select-hotel");
  redirect("/dashboard");
}
