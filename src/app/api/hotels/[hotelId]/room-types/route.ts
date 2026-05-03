import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createRoomType } from "@/modules/hotel-config/hotel.service";

export async function POST(req: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { hotelId } = await params;
  const body = await req.json();
  const rt = await createRoomType(hotelId, body);
  return NextResponse.json(rt, { status: 201 });
}
