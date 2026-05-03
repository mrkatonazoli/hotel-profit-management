import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET — returns board type shares per room type for this scenario.
 * Only returns board types that are active for the hotel (HotelBoardType).
 * Response: { roomTypeId: string; shares: { boardType: string; sharePct: number }[] }[]
 */
export async function GET(_req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { hotelId: true },
  });
  if (!scenario) return NextResponse.json([], { status: 404 });

  const [roomTypes, hotelBoardTypes, existing] = await Promise.all([
    prisma.roomType.findMany({
      where: { hotelId: scenario.hotelId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, count: true },
    }),
    prisma.hotelBoardType.findMany({
      where: { hotelId: scenario.hotelId },
      orderBy: { sortOrder: "asc" },
      select: { boardType: true },
    }),
    prisma.roomTypeBoardTypeShare.findMany({
      where: { scenarioId },
    }),
  ]);

  const activeBoardTypes = hotelBoardTypes.map(bt => bt.boardType);

  // Default: equal distribution across all active board types
  const defaultPct = activeBoardTypes.length > 0
    ? Math.round(100 / activeBoardTypes.length * 10) / 10
    : 0;

  const result = roomTypes.map(rt => {
    const rtShares = existing.filter(s => s.roomTypeId === rt.id);

    const shares = activeBoardTypes.map(boardType => {
      const found = rtShares.find(s => s.boardType === boardType);
      // If no saved data yet → equal default
      return {
        boardType,
        sharePct: found ? found.sharePct : defaultPct,
      };
    });

    // Normalize if sum is 0 (unset)
    const total = shares.reduce((s, x) => s + x.sharePct, 0);
    const normalized = total === 0
      ? shares.map((s, i) => ({ ...s, sharePct: i === 0 ? 100 : 0 }))
      : shares;

    return { roomTypeId: rt.id, roomTypeName: rt.name, roomTypeCount: rt.count, shares: normalized };
  });

  return NextResponse.json({ activeBoardTypes, roomTypes: result });
}

/**
 * PUT — save shares for one room type.
 * Body: { roomTypeId: string; shares: { boardType: string; sharePct: number }[] }
 * Normalizes to sum=100 before saving.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;
  const { roomTypeId, shares } = await req.json() as {
    roomTypeId: string;
    shares: { boardType: string; sharePct: number }[];
  };

  if (!roomTypeId || !Array.isArray(shares)) {
    return NextResponse.json({ error: "roomTypeId and shares required" }, { status: 400 });
  }

  // Normalize to sum = 100
  const total = shares.reduce((s, x) => s + (x.sharePct ?? 0), 0);
  const normalized = total > 0
    ? shares.map(s => ({ ...s, sharePct: Math.round((s.sharePct / total) * 1000) / 10 }))
    : shares;

  // Upsert each board type share
  for (const { boardType, sharePct } of normalized) {
    await prisma.roomTypeBoardTypeShare.upsert({
      where: { scenarioId_roomTypeId_boardType: { scenarioId, roomTypeId, boardType } },
      update: { sharePct },
      create: { scenarioId, roomTypeId, boardType, sharePct },
    });
  }

  return NextResponse.json({ ok: true });
}
