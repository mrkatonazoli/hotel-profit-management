import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/auth/check-email
// Ellenőrzi, hogy az adott e-mail cím regisztrált felhasználóhoz tartozik-e.
// Visszaadja: { exists: boolean }
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Hiányzó e-mail cím." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [user, invite] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
      prisma.invite.findFirst({
        where: { email: normalizedEmail, expiresAt: { gt: new Date() } },
        select: { id: true },
      }),
    ]);

    return NextResponse.json({ exists: !!(user || invite) });
  } catch {
    return NextResponse.json({ error: "Szerverhiba." }, { status: 500 });
  }
}
