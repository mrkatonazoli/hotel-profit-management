import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHotelByUser } from "@/modules/hotel-config/hotel.service";
import { createSeasonWeight } from "@/modules/weighting/weighting.service";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getHotelByUser(session.user.id);
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });
  const body = await req.json();
  const season = await createSeasonWeight(hotel.id, body);
  return NextResponse.json(season, { status: 201 });
}
