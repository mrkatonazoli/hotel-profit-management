import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { upsertScenarioMonth } from "@/modules/revenue-planner/planner.service";

export async function GET(req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { scenarioId } = await params;
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const planDays = await prisma.planDay.findMany({
    where: { scenarioId, date: { gte: from, lt: to } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(planDays);
}

export async function PUT(req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { scenarioId } = await params;
  const body = await req.json();
  const month = await upsertScenarioMonth(scenarioId, body);
  return NextResponse.json(month);
}
