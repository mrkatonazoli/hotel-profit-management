import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";

// GET — validate invite (public — no auth)
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { hotel: { select: { id: true, name: true, city: true } } },
  });
  if (!invite) return NextResponse.json({ error: "Érvénytelen meghívó" }, { status: 404 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "A meghívó lejárt" }, { status: 410 });

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    hotel: invite.hotel,
    expiresAt: invite.expiresAt.toISOString(),
  });
}

// POST — accept invite (user must be logged in)
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Érvénytelen meghívó" }, { status: 404 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "A meghívó lejárt" }, { status: 410 });

  // Verify logged-in user's email matches invite email
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
  if (user?.email?.toLowerCase() !== invite.email.toLowerCase())
    return NextResponse.json({ error: "Ez a meghívó más emailcímre szól" }, { status: 403 });

  // Add to hotel (upsert — avoid duplicate)
  await prisma.hotelUser.upsert({
    where: { hotelId_userId: { hotelId: invite.hotelId, userId: session.user.id } },
    create: { hotelId: invite.hotelId, userId: session.user.id, role: invite.role },
    update: { role: invite.role },
  });

  // Set module access from invite
  const inviteModules = invite.modules ? invite.modules.split(",").filter(Boolean) : [];
  if (inviteModules.length > 0) {
    const hu = await prisma.hotelUser.findUnique({
      where: { hotelId_userId: { hotelId: invite.hotelId, userId: session.user.id } },
    });
    if (hu) {
      await prisma.hotelUserModule.deleteMany({ where: { hotelUserId: hu.id } });
      await prisma.hotelUserModule.createMany({
        data: inviteModules.map(m => ({ hotelUserId: hu.id, module: m as Parameters<typeof prisma.hotelUserModule.create>[0]["data"]["module"] })),
      });
    }
  }

  // Delete invite
  await prisma.invite.delete({ where: { token } });

  // Set hotel cookie server-side — megbízható, nem kell külön API hívás
  const cookieStore = await cookies();
  cookieStore.set("selectedHotelId", invite.hotelId, {
    httpOnly: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  const modules = invite.modules ? invite.modules.split(",").filter(Boolean) : [];
  return NextResponse.json({ ok: true, hotelId: invite.hotelId, modules });
}

// DELETE — revoke invite (by token, manager only)
export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Nem található" }, { status: 404 });

  await prisma.invite.delete({ where: { token } });
  return NextResponse.json({ ok: true });
}
