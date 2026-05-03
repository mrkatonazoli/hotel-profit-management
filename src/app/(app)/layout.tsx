import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Resolve active hotel: cookie → first accessible hotel
  const cookieStore = await cookies();
  const cookieHotelId = cookieStore.get("selectedHotelId")?.value;

  let activeHotel: { id: string; name: string; isOnboarded: boolean } | null = null;

  if (cookieHotelId) {
    if (isSuperAdmin) {
      activeHotel = await prisma.hotel.findUnique({
        where: { id: cookieHotelId },
        select: { id: true, name: true, isOnboarded: true },
      });
    } else {
      const hu = await prisma.hotelUser.findUnique({
        where: { hotelId_userId: { hotelId: cookieHotelId, userId: session.user.id } },
        include: { hotel: { select: { id: true, name: true, isOnboarded: true } } },
      });
      activeHotel = hu?.hotel ?? null;
    }
  }

  if (!activeHotel) {
    // Fall back to first hotel
    if (isSuperAdmin) {
      activeHotel = await prisma.hotel.findFirst({ select: { id: true, name: true, isOnboarded: true }, orderBy: { name: "asc" } });
    } else {
      const hu = await prisma.hotelUser.findFirst({
        where: { userId: session.user.id },
        include: { hotel: { select: { id: true, name: true, isOnboarded: true } } },
        orderBy: { hotel: { name: "asc" } },
      });
      activeHotel = hu?.hotel ?? null;
    }
  }

  // Ha egyáltalán nincs hotel → select-hotel vagy no-hotel
  if (!activeHotel) {
    const hotelCount = isSuperAdmin
      ? await prisma.hotel.count()
      : await prisma.hotelUser.count({ where: { userId: session.user.id } });
    if (hotelCount === 0) redirect("/no-hotel");
    redirect("/select-hotel");
  }

  // Guard: if hotel not yet onboarded, send to wizard
  if (!activeHotel.isOnboarded) redirect("/onboarding");

  return (
    <AppShell
      isSuperAdmin={isSuperAdmin}
      hotelId={activeHotel.id}
      hotelName={activeHotel.name}
      userName={session.user?.name ?? undefined}
      userEmail={session.user?.email ?? undefined}
    >
      {children}
    </AppShell>
  );
}
