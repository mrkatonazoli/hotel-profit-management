import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { getScenariosByHotel, createScenario } from "@/modules/scenarios/scenario.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json([]);
  const scenarios = await getScenariosByHotel(hotel.id);
  return NextResponse.json(scenarios);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });
  const body = await req.json();
  const scenario = await createScenario(hotel.id, body);
  return NextResponse.json(scenario, { status: 201 });
}
