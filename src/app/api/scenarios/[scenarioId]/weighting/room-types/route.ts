import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** GET — returns all room types for this hotel with their popularity weights for the scenario */
export async function GET(_req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { hotelId: true },
  });
  if (!scenario) return NextResponse.json([], { status: 404 });

  const [roomTypes, weights] = await Promise.all([
    prisma.roomType.findMany({
      where: { hotelId: scenario.hotelId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.roomTypeWeight.findMany({ where: { scenarioId } }),
  ]);

  const result = roomTypes.map(rt => {
    const w = weights.find(w => w.roomTypeId === rt.id);
    return {
      id:            rt.id,
      name:          rt.name,
      count:         rt.count,
      occShareMult:  w?.occShareMult  ?? 1.0,
      adultsPerRoom: w?.adultsPerRoom ?? 1.7,
    };
  });

  return NextResponse.json(result);
}

/** PUT — upsert one room type weight */
export async function PUT(req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;
  const { roomTypeId, occShareMult, adultsPerRoom } = await req.json();

  const updateData: Record<string, number> = {};
  if (occShareMult  !== undefined) updateData.occShareMult  = Number(occShareMult);
  if (adultsPerRoom !== undefined) updateData.adultsPerRoom = Math.min(2, Math.max(1, Number(adultsPerRoom)));

  const row = await prisma.roomTypeWeight.upsert({
    where:  { scenarioId_roomTypeId: { scenarioId, roomTypeId } },
    update: updateData,
    create: {
      scenarioId,
      roomTypeId,
      occShareMult:  updateData.occShareMult  ?? 1.0,
      adultsPerRoom: updateData.adultsPerRoom ?? 1.7,
    },
  });

  return NextResponse.json(row);
}
