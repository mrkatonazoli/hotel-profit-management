import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { getDayTypeWeights, getSeasonWeights, upsertDayTypeWeight } from "@/modules/weighting/weighting.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ dayWeights: [], seasons: [] });
  const [dayWeights, seasons] = await Promise.all([
    getDayTypeWeights(hotel.id),
    getSeasonWeights(hotel.id),
  ]);
  return NextResponse.json({ dayWeights, seasons });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });
  const { dayOfWeek, ...data } = await req.json();
  const row = await upsertDayTypeWeight(hotel.id, dayOfWeek, data);
  return NextResponse.json(row);
}
