import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendHotelRequestEmail } from "@/lib/email";

// POST /api/request-hotel
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { hotelName } = await req.json();
  if (!hotelName || typeof hotelName !== "string" || !hotelName.trim()) {
    return NextResponse.json({ error: "A szálloda neve kötelező." }, { status: 400 });
  }

  // Értesítési e-mail cím: DB-ből, fallback env, fallback hardcoded
  const setting = await prisma.systemSetting.findUnique({ where: { key: "admin_notification_email" } });
  const adminEmail = setting?.value || process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || "katonazoltanads@gmail.com";

  await sendHotelRequestEmail({
    requesterName: session.user.name ?? null,
    requesterEmail: session.user.email,
    hotelName: hotelName.trim(),
    adminEmail,
  });

  return NextResponse.json({ ok: true });
}
