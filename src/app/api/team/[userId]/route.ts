import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

async function canManage(hotelId: string, callerId: string) {
  const callerUser = await prisma.user.findUnique({ where: { id: callerId }, select: { role: true } });
  if (callerUser?.role === "SUPER_ADMIN") return true;
  const hu = await prisma.hotelUser.findUnique({
    where: { hotelId_userId: { hotelId, userId: callerId } },
  });
  return hu?.role === "MANAGER";
}

// PATCH — change role
export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  if (!await canManage(hotel.id, session.user.id))
    return NextResponse.json({ error: "Nincs jogosultságod" }, { status: 403 });

  const { userId } = await params;
  const { role, modules } = await req.json() as { role?: "MANAGER" | "VIEWER"; modules?: string[] };

  const updated = await prisma.hotelUser.update({
    where: { hotelId_userId: { hotelId: hotel.id, userId } },
    data: role !== undefined ? { role } : {},
  });

  if (modules !== undefined) {
    const hu = await prisma.hotelUser.findUnique({
      where: { hotelId_userId: { hotelId: hotel.id, userId } },
    });
    if (hu) {
      await prisma.hotelUserModule.deleteMany({ where: { hotelUserId: hu.id } });
      if (modules.length > 0) {
        await prisma.hotelUserModule.createMany({
          data: modules.map(m => ({ hotelUserId: hu.id, module: m as Parameters<typeof prisma.hotelUserModule.create>[0]["data"]["module"] })),
        });
      }
    }
  }

  return NextResponse.json(updated);
}

// DELETE — remove member
export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  const { userId } = await params;

  // Allow self-removal OR manager action
  if (userId !== session.user.id && !await canManage(hotel.id, session.user.id))
    return NextResponse.json({ error: "Nincs jogosultságod" }, { status: 403 });

  await prisma.hotelUser.delete({
    where: { hotelId_userId: { hotelId: hotel.id, userId } },
  });
  return NextResponse.json({ ok: true });
}
