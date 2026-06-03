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

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true },
    });

    return NextResponse.json({ exists: !!user });
  } catch {
    return NextResponse.json({ error: "Szerverhiba." }, { status: 500 });
  }
}
