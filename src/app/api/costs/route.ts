import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CostType, CostNature, AmountType, PercentageBase, RecurringFrequency } from "@prisma/client";
import { getActiveHotel } from "@/lib/get-hotel";

export async function GET() {
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json([], { status: 200 });

  const costs = await prisma.cost.findMany({
    where: { hotelId: hotel.id },
    include: { staffRules: { orderBy: { occupancyFrom: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(costs);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  const body = await req.json();
  const {
    name, type, nature, recurringFrequency, recurringStartDate,
    amountType, amount, percentage, percentageBase, currency, isStaff, note,
  } = body;

  const cost = await prisma.cost.create({
    data: {
      hotelId: hotel.id,
      name: String(name ?? ""),
      type: (type as CostType) ?? CostType.FIXED,
      nature: (nature as CostNature) ?? CostNature.RECURRING,
      recurringFrequency: (recurringFrequency as RecurringFrequency) ?? RecurringFrequency.MONTHLY,
      recurringStartDate: recurringStartDate ? new Date(recurringStartDate) : null,
      amountType: (amountType as AmountType) ?? AmountType.FIXED_AMOUNT,
      amount: amount != null ? Number(amount) : null,
      percentage: percentage != null ? Number(percentage) : null,
      percentageBase: (percentageBase as PercentageBase) ?? PercentageBase.TOTAL_REVENUE,
      currency: String(currency ?? "HUF"),
      isStaff: Boolean(isStaff ?? false),
      note: note ? String(note) : null,
    },
    include: { staffRules: true },
  });

  return NextResponse.json(cost, { status: 201 });
}
