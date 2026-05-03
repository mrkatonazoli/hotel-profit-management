import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hotelId } = await req.json();

  const res = NextResponse.json({ ok: true });
  res.cookies.set("selectedHotelId", hotelId, {
    httpOnly: false, // readable client-side too
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });
  return res;
}
