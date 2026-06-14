import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

const include = {
  fixedCosts: { orderBy: { sortOrder: "asc" as const } },
};

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

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const body = await req.json();
  const {
    fixedCosts,
    tfhEnabled, tfhRate,
    fbEnabled, breakfastPrice, halfboardPrice,
    breakfastCost, halfboardCost,
    avgPaxPerRoom,
    defaultBreakfastPct, defaultHalfboardPct,
    fbOtherEnabled, fbOtherPct, spaEnabled, spaPct, otherRevenueEnabled, otherRevenuePct,
    laundryEnabled, laundryPerRoom,
  } = body as {
    fixedCosts?: { label: string; annualAmount: number; sortOrder?: number }[];
    tfhEnabled?: boolean;
    tfhRate?: number;
    fbEnabled?: boolean;
    breakfastPrice?: number;
    halfboardPrice?: number;
    breakfastCost?: number;
    halfboardCost?: number;
    avgPaxPerRoom?: number;
    defaultBreakfastPct?: number;
    defaultHalfboardPct?: number;
    fbOtherEnabled?: boolean;
    fbOtherPct?: number;
    spaEnabled?: boolean;
    spaPct?: number;
    otherRevenueEnabled?: boolean;
    otherRevenuePct?: number;
    laundryEnabled?: boolean;
    laundryPerRoom?: number;
  };

  let settings = await prisma.simplePlannerSettings.upsert({
    where: { hotelId: hotel.id },
    create: {
      hotelId: hotel.id,
      tfhEnabled: tfhEnabled ?? true,
      tfhRate: tfhRate ?? 4,
      fbEnabled: fbEnabled ?? false,
      breakfastPrice: breakfastPrice ?? 0,
      halfboardPrice: halfboardPrice ?? 0,
      breakfastCost: breakfastCost ?? 0,
      halfboardCost: halfboardCost ?? 0,
      avgPaxPerRoom: avgPaxPerRoom ?? 1.8,
      defaultBreakfastPct: defaultBreakfastPct ?? 0,
      defaultHalfboardPct: defaultHalfboardPct ?? 0,
      fbOtherEnabled: fbOtherEnabled ?? false,
      fbOtherPct: fbOtherPct ?? 0,
      spaEnabled: spaEnabled ?? false,
      spaPct: spaPct ?? 0,
      otherRevenueEnabled: otherRevenueEnabled ?? false,
      otherRevenuePct: otherRevenuePct ?? 0,
      laundryEnabled: laundryEnabled ?? false,
      laundryPerRoom: laundryPerRoom ?? 0,
    },
    update: {
      ...(tfhEnabled !== undefined && { tfhEnabled }),
      ...(tfhRate !== undefined && { tfhRate }),
      ...(fbEnabled !== undefined && { fbEnabled }),
      ...(breakfastPrice !== undefined && { breakfastPrice }),
      ...(halfboardPrice !== undefined && { halfboardPrice }),
      ...(breakfastCost !== undefined && { breakfastCost }),
      ...(halfboardCost !== undefined && { halfboardCost }),
      ...(avgPaxPerRoom !== undefined && { avgPaxPerRoom }),
      ...(defaultBreakfastPct !== undefined && { defaultBreakfastPct }),
      ...(defaultHalfboardPct !== undefined && { defaultHalfboardPct }),
      ...(fbOtherEnabled !== undefined && { fbOtherEnabled }),
      ...(fbOtherPct !== undefined && { fbOtherPct }),
      ...(spaEnabled !== undefined && { spaEnabled }),
      ...(spaPct !== undefined && { spaPct }),
      ...(otherRevenueEnabled !== undefined && { otherRevenueEnabled }),
      ...(otherRevenuePct !== undefined && { otherRevenuePct }),
      ...(laundryEnabled !== undefined && { laundryEnabled }),
      ...(laundryPerRoom !== undefined && { laundryPerRoom }),
    },
    include,
  });

  if (Array.isArray(fixedCosts)) {
    await prisma.simplePlannerFixedCost.deleteMany({ where: { settingsId: settings.id } });
    if (fixedCosts.length > 0) {
      await prisma.simplePlannerFixedCost.createMany({
        data: fixedCosts.map((fc, i) => ({
          settingsId: settings.id,
          label: fc.label,
          annualAmount: fc.annualAmount,
          sortOrder: fc.sortOrder ?? i,
        })),
      });
    }
    settings = await prisma.simplePlannerSettings.findUnique({
      where: { id: settings.id },
      include,
    }) as typeof settings;
  }

  return NextResponse.json(settings);
}
