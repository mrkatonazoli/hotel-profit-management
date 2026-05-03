import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const session = await auth();
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map(c => ({ name: c.name, valueLength: c.value.length }));

  let hotelUsers: unknown[] = [];
  if (session?.user?.id) {
    hotelUsers = await prisma.hotelUser.findMany({
      where: { userId: session.user.id },
      include: { hotel: { select: { name: true } } },
    });
  }

  return NextResponse.json({
    session: session ? { userId: session.user?.id, email: session.user?.email } : null,
    cookies: allCookies,
    hotelUsers,
  });
}
