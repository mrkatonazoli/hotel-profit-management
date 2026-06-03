import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ hotelId: string }> };

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  return user?.role === "SUPER_ADMIN" ? session : null;
}

// GET — list users for a hotel
export async function GET(_req: Request, { params }: Ctx) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { hotelId } = await params;

  const hotelUsers = await prisma.hotelUser.findMany({
    where: { hotelId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      modules: { select: { module: true } },
    },
    orderBy: { user: { email: "asc" } },
  });

  return NextResponse.json(hotelUsers.map(hu => ({
    userId: hu.userId,
    name: hu.user.name,
    email: hu.user.email,
    role: hu.role,
    modules: hu.modules.map(m => m.module),
  })));
}

// POST — add existing user to hotel (by email)
export async function POST(req: Request, { params }: Ctx) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { hotelId } = await params;
  const { email, role = "PROFESSIONAL", modules = [] } = await req.json();

  if (!email) return NextResponse.json({ error: "Email kötelező" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Nem található ilyen e-mail cím a rendszerben." }, { status: 404 });

  const existing = await prisma.hotelUser.findUnique({
    where: { hotelId_userId: { hotelId, userId: user.id } },
  });
  if (existing) return NextResponse.json({ error: "Ez a felhasználó már hozzá van rendelve ehhez a szállodához." }, { status: 409 });

  const hotelUser = await prisma.hotelUser.create({
    data: { hotelId, userId: user.id, role },
  });

  if (modules.length > 0) {
    await prisma.hotelUserModule.createMany({
      data: modules.map((m: string) => ({
        hotelUserId: hotelUser.id,
        module: m as Parameters<typeof prisma.hotelUserModule.create>[0]["data"]["module"],
      })),
    });
  }

  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role, modules } });
}

// DELETE — remove user from hotel
export async function DELETE(req: Request, { params }: Ctx) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { hotelId } = await params;
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId kötelező" }, { status: 400 });

  await prisma.hotelUser.deleteMany({ where: { hotelId, userId } });
  return NextResponse.json({ ok: true });
}

// PATCH — update user modules for a hotel
export async function PATCH(req: Request, { params }: Ctx) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { hotelId } = await params;
  const { userId, modules = [] } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId kötelező" }, { status: 400 });

  const hotelUser = await prisma.hotelUser.findUnique({
    where: { hotelId_userId: { hotelId, userId } },
  });
  if (!hotelUser) return NextResponse.json({ error: "Nem található" }, { status: 404 });

  await prisma.hotelUserModule.deleteMany({ where: { hotelUserId: hotelUser.id } });
  if (modules.length > 0) {
    await prisma.hotelUserModule.createMany({
      data: modules.map((m: string) => ({
        hotelUserId: hotelUser.id,
        module: m as Parameters<typeof prisma.hotelUserModule.create>[0]["data"]["module"],
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
