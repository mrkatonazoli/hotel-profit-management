import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CostType, CostNature, AmountType, PercentageBase, RecurringFrequency } from "@prisma/client";

type Ctx = { params: Promise<{ costId: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { costId } = await params;
  const body = await req.json();
  const {
    name, type, nature, recurringFrequency, recurringStartDate,
    amountType, amount, percentage, percentageBase, currency, isStaff, note,
  } = body;

  const cost = await prisma.cost.update({
    where: { id: costId },
    data: {
      ...(name !== undefined && { name: String(name) }),
      ...(type !== undefined && { type: type as CostType }),
      ...(nature !== undefined && { nature: nature as CostNature }),
      ...(recurringFrequency !== undefined && { recurringFrequency: recurringFrequency as RecurringFrequency }),
      ...(recurringStartDate !== undefined && { recurringStartDate: recurringStartDate ? new Date(recurringStartDate) : null }),
      ...(amountType !== undefined && { amountType: amountType as AmountType }),
      ...(amount !== undefined && { amount: amount != null ? Number(amount) : null }),
      ...(percentage !== undefined && { percentage: percentage != null ? Number(percentage) : null }),
      ...(percentageBase !== undefined && { percentageBase: percentageBase as PercentageBase }),
      ...(currency !== undefined && { currency: String(currency) }),
      ...(isStaff !== undefined && { isStaff: Boolean(isStaff) }),
      ...(note !== undefined && { note: note ? String(note) : null }),
    },
    include: { staffRules: { orderBy: { occupancyFrom: "asc" } } },
  });

  return NextResponse.json(cost);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { costId } = await params;
  await prisma.cost.delete({ where: { id: costId } });
  return NextResponse.json({ ok: true });
}
