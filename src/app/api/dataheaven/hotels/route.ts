import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dhFetch } from "@/lib/dataheaven";

/** DataHeaven hotel list for the pairing UI (proxied; key stays server-side). Super admin only. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "A párosítást csak szuperadmin végezheti el." }, { status: 403 });
  }
  if (!process.env.DATAHEAVEN_API_KEY) {
    return NextResponse.json({ error: "A DATAHEAVEN_API_KEY környezeti változó nincs beállítva (Vercel → Environment Variables), vagy a beállítás után nem futott redeploy." }, { status: 500 });
  }
  try {
    const res = await dhFetch("/api/v1/hotels", 60);
    if (res.status === 401) {
      return NextResponse.json({ error: "A DataHeaven API-kulcs érvénytelen vagy visszavont — ellenőrizd a DataHeaven Adminban." }, { status: 502 });
    }
    if (!res.ok) return NextResponse.json({ error: `DataHeaven API hiba (${res.status})` }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DataHeaven API nem elérhető" }, { status: 502 });
  }
}
