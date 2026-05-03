import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ costId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { costId } = await params;
  const { occupancyFrom, occupancyTo, extraStaffCount, dailyRate } = await req.json();

  const rule = await prisma.staffRule.create({
    data: {
      costId,
      occupancyFrom: Number(occupancyFrom ?? 0),
      occupancyTo: occupancyTo != null ? Number(occupancyTo) : null,
      extraStaffCount: Number(extraStaffCount ?? 1),
      dailyRate: Number(dailyRate ?? 0),
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
