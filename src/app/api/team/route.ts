import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { sendInviteEmail } from "@/lib/email";

// GET — list team members + pending invites
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  const [members, invites] = await Promise.all([
    prisma.hotelUser.findMany({
      where: { hotelId: hotel.id },
      include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.invite.findMany({
      where: { hotelId: hotel.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    members: members.map(m => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      isSuperAdmin: m.user.role === "SUPER_ADMIN",
    })),
    invites: invites.map(i => ({
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token,
      expiresAt: i.expiresAt.toISOString(),
    })),
    currentUserId: session.user.id,
  });
}

// POST — invite user (by email) or add directly if exists
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  // Check caller is manager/admin
  const caller = await prisma.hotelUser.findUnique({
    where: { hotelId_userId: { hotelId: hotel.id, userId: session.user.id } },
  });
  const callerUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const canInvite = callerUser?.role === "SUPER_ADMIN" || caller?.role === "MANAGER";
  if (!canInvite) return NextResponse.json({ error: "Nincs jogosultságod meghívóhoz" }, { status: 403 });

  const { email, role } = await req.json() as { email: string; role: "MANAGER" | "VIEWER" };
  if (!email) return NextResponse.json({ error: "Email kötelező" }, { status: 400 });

  const normalizedEmail = email.toLowerCase().trim();

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    const alreadyMember = await prisma.hotelUser.findUnique({
      where: { hotelId_userId: { hotelId: hotel.id, userId: existingUser.id } },
    });
    if (alreadyMember) {
      return NextResponse.json({ error: "Ez a felhasználó már tagja a csapatnak" }, { status: 409 });
    }
    // Add directly
    await prisma.hotelUser.create({
      data: { hotelId: hotel.id, userId: existingUser.id, role },
    });
    // Clean up any pending invite for this email
    await prisma.invite.deleteMany({ where: { hotelId: hotel.id, email: normalizedEmail } });
    return NextResponse.json({ type: "added", name: existingUser.name ?? normalizedEmail });
  }

  // User doesn't exist — create/refresh invite link
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const invite = await prisma.invite.upsert({
    where: { hotelId_email: { hotelId: hotel.id, email: normalizedEmail } },
    create: { hotelId: hotel.id, email: normalizedEmail, role, expiresAt },
    update: { role, expiresAt, token: undefined }, // refresh expiry, keep token
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/${invite.token}`;

  // Send invite email (non-blocking — don't fail if email fails)
  try {
    await sendInviteEmail({
      to: normalizedEmail,
      hotelName: hotel.name,
      hotelCity: hotel.city,
      role,
      inviteUrl,
      expiresInDays: 7,
    });
  } catch (err) {
    console.error("[invite email]", err);
  }

  return NextResponse.json({ type: "invited", inviteUrl, email: normalizedEmail });
}
