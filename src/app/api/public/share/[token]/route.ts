import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

type Params = { params: Promise<{ token: string }> };

function hashPassword(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export async function GET(req: Request, { params }: Params) {
  const { token } = await params;

  const plan = await prisma.simplePlan.findFirst({
    where: { shareToken: token, shareEnabled: true },
    include: {
      hotel: { select: { id: true, name: true, totalRooms: true } },
      months: { orderBy: { month: "asc" } },
    },
  });

  if (!plan) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (plan.shareExpiresAt && plan.shareExpiresAt < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  // ── Password check ─────────────────────────────────────────────────────────
  if (plan.sharePassword) {
    const provided = req.headers.get("X-Share-Password");
    if (!provided || hashPassword(provided) !== plan.sharePassword) {
      return NextResponse.json({ error: "password_required" }, { status: 401 });
    }
  }

  const settings = await prisma.simplePlannerSettings.findUnique({
    where: { hotelId: plan.hotelId },
    include: { fixedCosts: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({
    plan: {
      id: plan.id,
      name: plan.name,
      year: plan.year,
      shareSummary: plan.shareSummary,
      shareExpiresAt: plan.shareExpiresAt ? plan.shareExpiresAt.toISOString() : null,
    },
    hotel: {
      name: plan.hotel.name,
      totalRooms: plan.hotel.totalRooms,
    },
    months: plan.months,
    settings: {
      tfhEnabled: settings?.tfhEnabled ?? false,
      tfhRate: settings?.tfhRate ?? 4,
      fbEnabled: settings?.fbEnabled ?? false,
      breakfastPrice: settings?.breakfastPrice ?? 0,
      halfboardPrice: settings?.halfboardPrice ?? 0,
      avgPaxPerRoom: settings?.avgPaxPerRoom ?? 1.8,
      defaultBreakfastPct: settings?.defaultBreakfastPct ?? 0,
      defaultHalfboardPct: settings?.defaultHalfboardPct ?? 0,
      fbOtherEnabled: settings?.fbOtherEnabled ?? false,
      fbOtherPct: settings?.fbOtherPct ?? 0,
      spaEnabled: settings?.spaEnabled ?? false,
      spaPct: settings?.spaPct ?? 0,
      otherRevenueEnabled: settings?.otherRevenueEnabled ?? false,
      otherRevenuePct: settings?.otherRevenuePct ?? 0,
      annualFixedCost: (settings?.fixedCosts ?? []).reduce((s, fc) => s + fc.annualAmount, 0),
      breakfastCost: settings?.breakfastCost ?? 0,
      halfboardCost: settings?.halfboardCost ?? 0,
      laundryEnabled: settings?.laundryEnabled ?? false,
      laundryPerRoom: settings?.laundryPerRoom ?? 0,
      commissionEnabled: settings?.commissionEnabled ?? false,
      commissionPct: settings?.commissionPct ?? 0,
      commissionBookingsPct: settings?.commissionBookingsPct ?? 100,
    },
    // breakfastPct/halfboardPct most a months tömbben van havi szinten
  });
}
