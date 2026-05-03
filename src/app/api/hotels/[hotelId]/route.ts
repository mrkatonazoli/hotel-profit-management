import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateHotel } from "@/modules/hotel-config/hotel.service";

export async function PUT(req: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { hotelId } = await params;
  const body = await req.json();
  const hotel = await updateHotel(hotelId, body);
  return NextResponse.json(hotel);
}
