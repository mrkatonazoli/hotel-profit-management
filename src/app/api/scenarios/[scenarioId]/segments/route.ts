import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ scenarioId: string }> };

// GET /api/scenarios/[scenarioId]/segments
export async function GET(_req: Request, { params }: Ctx) {
  const { scenarioId } = await params;

  const segments = await prisma.scenarioSegment.findMany({
    where: { scenarioId },
    orderBy: { sortOrder: "asc" },
    include: {
      monthShares: { orderBy: { month: "asc" } },
      channelMix: {
        include: { distributor: true },
        orderBy: { month: "asc" },
      },
    },
  });

  return NextResponse.json(segments);
}

// POST /api/scenarios/[scenarioId]/segments
export async function POST(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;
  const body = await req.json();
  const { name, color, sortOrder, channelMixMode } = body;

  const segment = await prisma.scenarioSegment.create({
    data: {
      scenarioId,
      name: String(name ?? "").trim(),
      color: String(color ?? "#35BD78"),
      sortOrder: Number(sortOrder ?? 0),
      channelMixMode: channelMixMode === "MONTHLY" ? "MONTHLY" : "ANNUAL",
      // Init all 12 months with 0%
      monthShares: {
        create: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sharePct: 0 })),
      },
    },
    include: {
      monthShares: { orderBy: { month: "asc" } },
      channelMix: { include: { distributor: true } },
    },
  });

  return NextResponse.json(segment, { status: 201 });
}
