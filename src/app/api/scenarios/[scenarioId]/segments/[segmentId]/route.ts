import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ scenarioId: string; segmentId: string }> };

// PUT /api/scenarios/[scenarioId]/segments/[segmentId]
// Body can include: name, color, sortOrder, channelMixMode,
//   monthShares: [{ month, sharePct }],
//   channelMix:  [{ distributorId, month (null=annual), sharePct }]
export async function PUT(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { segmentId } = await params;
  const body = await req.json();
  const { name, color, sortOrder, channelMixMode, monthShares, channelMix } = body;

  // Update base fields
  await prisma.scenarioSegment.update({
    where: { id: segmentId },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(color !== undefined && { color: String(color) }),
      ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      ...(channelMixMode !== undefined && { channelMixMode: channelMixMode === "MONTHLY" ? "MONTHLY" : "ANNUAL" }),
    },
  });

  // Upsert month shares
  if (Array.isArray(monthShares)) {
    for (const ms of monthShares) {
      await prisma.scenarioSegmentMonth.upsert({
        where: { segmentId_month: { segmentId, month: ms.month } },
        create: { segmentId, month: ms.month, sharePct: Number(ms.sharePct) },
        update: { sharePct: Number(ms.sharePct) },
      });
    }
  }

  // Upsert channel mix
  if (Array.isArray(channelMix)) {
    for (const cm of channelMix) {
      const month = cm.month ?? null;
      await prisma.scenarioSegmentChannel.upsert({
        where: { segmentId_distributorId_month: { segmentId, distributorId: cm.distributorId, month } },
        create: { segmentId, distributorId: cm.distributorId, month, sharePct: Number(cm.sharePct) },
        update: { sharePct: Number(cm.sharePct) },
      });
    }
  }

  const updated = await prisma.scenarioSegment.findUnique({
    where: { id: segmentId },
    include: {
      monthShares: { orderBy: { month: "asc" } },
      channelMix: { include: { distributor: true }, orderBy: { month: "asc" } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/scenarios/[scenarioId]/segments/[segmentId]
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { segmentId } = await params;
  await prisma.scenarioSegment.delete({ where: { id: segmentId } });
  return NextResponse.json({ ok: true });
}
