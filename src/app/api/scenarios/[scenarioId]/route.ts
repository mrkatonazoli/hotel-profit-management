import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHotelByUser } from "@/modules/hotel-config/hotel.service";
import { updateScenario, deleteScenario } from "@/modules/scenarios/scenario.service";
import { getScenarioWithHotel } from "@/modules/revenue-planner/planner.service";

export async function GET(_req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { scenarioId } = await params;
  const scenario = await getScenarioWithHotel(scenarioId);
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(scenario);
}

export async function PUT(req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getHotelByUser(session.user.id);
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });
  const { scenarioId } = await params;
  const body = await req.json();
  const scenario = await updateScenario(scenarioId, hotel.id, body);
  return NextResponse.json(scenario);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { scenarioId } = await params;
  await deleteScenario(scenarioId);
  return new NextResponse(null, { status: 204 });
}
