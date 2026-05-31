import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

const include = {
  costBands: { orderBy: { fromOccPct: "asc" as const } },
  folderMonths: { orderBy: { month: "asc" as const } },
};

// GET — beállítások lekérése (ha nincs, null-t ad vissza)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json(null);

  const settings = await prisma.simplePlannerSettings.findUnique({
    where: { hotelId: hotel.id },
    include,
  });

  return NextResponse.json(settings);
}

// PUT — beállítások mentése (upsert) + cost bands + folder months
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const body = await req.json();
  const { optimalOccupancyPct, costBands, folderMonths, tfhEnabled, tfhRate } = body as {
    optimalOccupancyPct?: number;
    tfhEnabled?: boolean;
    tfhRate?: number;
    costBands?: { fromOccPct: number; toOccPct: number; costPerRoom: number; label?: string; sortOrder?: number }[];
    folderMonths?: { month: number; outOfOrderNights: number }[];
  };

  // Upsert alap rekord
  let settings = await prisma.simplePlannerSettings.upsert({
    where: { hotelId: hotel.id },
    create: {
      hotelId: hotel.id,
      optimalOccupancyPct: optimalOccupancyPct ?? 70,
      tfhEnabled: tfhEnabled ?? true,
      tfhRate: tfhRate ?? 4,
    },
    update: {
      ...(optimalOccupancyPct !== undefined && { optimalOccupancyPct }),
      ...(tfhEnabled !== undefined && { tfhEnabled }),
      ...(tfhRate !== undefined && { tfhRate }),
    },
    include,
  });

  // Ha jöttek cost band-ek → teljes csere
  if (Array.isArray(costBands)) {
    await prisma.simplePlannerCostBand.deleteMany({ where: { settingsId: settings.id } });
    if (costBands.length > 0) {
      await prisma.simplePlannerCostBand.createMany({
        data: costBands.map((b, i) => ({
          settingsId: settings.id,
          fromOccPct: b.fromOccPct,
          toOccPct: b.toOccPct,
          costPerRoom: b.costPerRoom,
          label: b.label ?? null,
          sortOrder: b.sortOrder ?? i,
        })),
      });
    }
  }

  // Ha jöttek folder months → findFirst + update/create (null-safe unique)
  if (Array.isArray(folderMonths)) {
    for (const fm of folderMonths) {
      const existing = await prisma.simplePlannerFolderMonth.findFirst({
        where: { settingsId: settings.id, month: fm.month },
      });
      if (existing) {
        await prisma.simplePlannerFolderMonth.update({
          where: { id: existing.id },
          data: { outOfOrderNights: fm.outOfOrderNights },
        });
      } else {
        await prisma.simplePlannerFolderMonth.create({
          data: { settingsId: settings.id, month: fm.month, outOfOrderNights: fm.outOfOrderNights },
        });
      }
    }
  }

  // Refetch friss adatokkal
  settings = await prisma.simplePlannerSettings.findUnique({
    where: { id: settings.id },
    include,
  }) as typeof settings;

  return NextResponse.json(settings);
}
