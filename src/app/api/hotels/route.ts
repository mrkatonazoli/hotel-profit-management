import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHotelByUser, createHotel } from "@/modules/hotel-config/hotel.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getHotelByUser(session.user.id);
  return NextResponse.json(hotel);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const hotel = await createHotel(session.user.id, body);
  return NextResponse.json(hotel, { status: 201 });
}
