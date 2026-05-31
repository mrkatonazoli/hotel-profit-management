import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { getUserModuleAccess } from "@/lib/module-access";
import { prisma } from "@/lib/prisma";

// GET — returns the current user's allowed modules for the active hotel
// null  = full access (MANAGER / SUPER_ADMIN)
// string[] = restricted list (PROFESSIONAL with module restrictions)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role === "SUPER_ADMIN")
    return NextResponse.json({ allowedModules: null });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ allowedModules: null });

  const allowedModules = await getUserModuleAccess(session.user.id, hotel.id);
  return NextResponse.json({ allowedModules });
}
