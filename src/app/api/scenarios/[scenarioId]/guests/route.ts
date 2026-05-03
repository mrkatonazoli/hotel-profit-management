import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type BoardTypeEntry = {
  boardType: string;
  roomCount: number;
  adultCount: number;
  childCounts: { groupId: string; count: number }[];
};

// ─── GET /api/scenarios/[scenarioId]/guests?year=&month=&roomTypeId= ──────────
// roomTypeId nélkül: hotel-szintű összesítés (minden szobatípus összege)
// roomTypeId-vel: az adott szobatípus adatai

export async function GET(
  req: Request,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;
  const { searchParams } = new URL(req.url);
  const year       = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));
  const month      = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const roomTypeId = searchParams.get("roomTypeId");

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month - 1, new Date(year, month, 0).getDate()));

  const planDays = await prisma.planDay.findMany({
    where: { scenarioId, date: { gte: monthStart, lte: monthEnd } },
    include: {
      boardTypes: {
        where: roomTypeId ? { roomTypeId } : undefined,
        include: {
          childCounts: {
            include: { childAgeGroup: true },
          },
        },
        orderBy: { boardType: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(planDays.map(pd => {
    // Ha roomTypeId szűrő van: csak annak a szobatípusnak az adatai
    // Ha nincs: összesítjük az összes szobatípus sorait boardType szerint
    const boardTypes = roomTypeId
      ? pd.boardTypes.map(bt => ({
          boardType: bt.boardType,
          roomCount: bt.roomCount,
          adultCount: bt.adultCount,
          childCounts: bt.childCounts.map(cc => ({
            groupId: cc.childAgeGroupId,
            groupName: cc.childAgeGroup.name,
            minAge: cc.childAgeGroup.minAge,
            maxAge: cc.childAgeGroup.maxAge,
            count: cc.count,
          })),
        }))
      : aggregateBoardTypes(pd.boardTypes);

    // Összesítők
    const adultCount  = boardTypes.reduce((s, bt) => s + bt.adultCount, 0);
    const childCount  = boardTypes.reduce((s, bt) =>
      s + bt.childCounts.reduce((cs, cc) => cs + cc.count, 0), 0);

    return {
      id: pd.id,
      date: pd.date.toISOString().slice(0, 10),
      adultCount,
      childCount,
      boardTypes,
    };
  }));
}

// ─── POST /api/scenarios/[scenarioId]/guests ──────────────────────────────────
// Body: { date, roomTypeId, boardTypes: [{ boardType, roomCount, adultCount, childCounts }] }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;
  const body = await req.json() as { date: string; roomTypeId: string; boardTypes: BoardTypeEntry[] };
  const { date, roomTypeId, boardTypes } = body;

  if (!roomTypeId) {
    return NextResponse.json({ error: "roomTypeId kötelező" }, { status: 400 });
  }

  const dateUTC = new Date(date + "T00:00:00Z");
  const planDay = await prisma.planDay.findUnique({
    where: { scenarioId_date: { scenarioId, date: dateUTC } },
  });
  if (!planDay) {
    return NextResponse.json({ error: "PlanDay not found" }, { status: 404 });
  }

  await upsertRoomTypeBoardTypes(planDay.id, roomTypeId, boardTypes);
  await recomputePlanDayAggregates(planDay.id);

  return NextResponse.json({ ok: true });
}

// ─── PUT /api/scenarios/[scenarioId]/guests — batch ──────────────────────────
// Body: { entries: [{ date, roomTypeId, boardTypes }] }

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;
  const { entries } = await req.json() as {
    entries: { date: string; roomTypeId: string; boardTypes: BoardTypeEntry[] }[];
  };

  for (const entry of entries) {
    if (!entry.roomTypeId) continue;
    const dateUTC = new Date(entry.date + "T00:00:00Z");
    const planDay = await prisma.planDay.findUnique({
      where: { scenarioId_date: { scenarioId, date: dateUTC } },
    });
    if (!planDay) continue;
    await upsertRoomTypeBoardTypes(planDay.id, entry.roomTypeId, entry.boardTypes);
    await recomputePlanDayAggregates(planDay.id);
  }

  return NextResponse.json({ ok: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Aggregálja az összes szobatípus sorát boardType szerint (hotel összesítő nézethez)
function aggregateBoardTypes(rows: {
  boardType: string;
  roomCount: number;
  adultCount: number;
  childCounts: {
    childAgeGroupId: string;
    count: number;
    childAgeGroup: { name: string; minAge: number; maxAge: number };
  }[];
}[]) {
  const map = new Map<string, {
    boardType: string; roomCount: number; adultCount: number;
    childCounts: Map<string, { groupId: string; groupName: string; minAge: number; maxAge: number; count: number }>;
  }>();

  for (const row of rows) {
    if (!map.has(row.boardType)) {
      map.set(row.boardType, { boardType: row.boardType, roomCount: 0, adultCount: 0, childCounts: new Map() });
    }
    const entry = map.get(row.boardType)!;
    entry.roomCount  += row.roomCount;
    entry.adultCount += row.adultCount;
    for (const cc of row.childCounts) {
      const existing = entry.childCounts.get(cc.childAgeGroupId);
      if (existing) {
        existing.count += cc.count;
      } else {
        entry.childCounts.set(cc.childAgeGroupId, {
          groupId: cc.childAgeGroupId,
          groupName: cc.childAgeGroup.name,
          minAge: cc.childAgeGroup.minAge,
          maxAge: cc.childAgeGroup.maxAge,
          count: cc.count,
        });
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => a.boardType.localeCompare(b.boardType))
    .map(e => ({
      boardType: e.boardType,
      roomCount: e.roomCount,
      adultCount: e.adultCount,
      childCounts: Array.from(e.childCounts.values()),
    }));
}

async function upsertRoomTypeBoardTypes(
  planDayId: string,
  roomTypeId: string,
  boardTypes: BoardTypeEntry[]
) {
  // Töröljük az adott szobatípus azon ellátástípusait, amik már nem szerepelnek
  const incomingTypes = boardTypes.map(bt => bt.boardType);
  await prisma.planDayBoardType.deleteMany({
    where: { planDayId, roomTypeId, boardType: { notIn: incomingTypes } },
  });

  for (const bt of boardTypes) {
    const btRow = await prisma.planDayBoardType.upsert({
      where: { planDayId_roomTypeId_boardType: { planDayId, roomTypeId, boardType: bt.boardType } },
      create: {
        planDayId,
        roomTypeId,
        boardType: bt.boardType,
        roomCount: bt.roomCount || 0,
        adultCount: bt.adultCount || 0,
      },
      update: {
        roomCount: bt.roomCount || 0,
        adultCount: bt.adultCount || 0,
      },
    });

    for (const cc of bt.childCounts) {
      await prisma.planDayBoardTypeChild.upsert({
        where: {
          planDayBoardTypeId_childAgeGroupId: {
            planDayBoardTypeId: btRow.id,
            childAgeGroupId: cc.groupId,
          },
        },
        create: { planDayBoardTypeId: btRow.id, childAgeGroupId: cc.groupId, count: cc.count || 0 },
        update: { count: cc.count || 0 },
      });
    }
  }
}

// PlanDay adultCount/childCount frissítése az összes szobatípus összege alapján
async function recomputePlanDayAggregates(planDayId: string) {
  const allRows = await prisma.planDayBoardType.findMany({
    where: { planDayId },
    include: { childCounts: true },
  });
  const totalAdults   = allRows.reduce((s, bt) => s + bt.adultCount, 0);
  const totalChildren = allRows.reduce((s, bt) =>
    s + bt.childCounts.reduce((cs, cc) => cs + cc.count, 0), 0);
  await prisma.planDay.update({
    where: { id: planDayId },
    data: { adultCount: totalAdults, childCount: totalChildren },
  });
}
