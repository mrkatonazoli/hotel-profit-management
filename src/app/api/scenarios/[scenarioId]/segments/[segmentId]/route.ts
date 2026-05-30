import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ scenarioId: string; segmentId: string }> };

// PUT /api/scenarios/[scenarioId]/segments/[segmentId]
// Body can include: name, color, sortOrder, channelMixMode,
//   monthShares:    [{ month, sharePct }],
//   channelMix:     [{ distributorId, month (null=annual), sharePct }],
//   removeChannels: [{ distributorId, month (null=annual) }]  ← törli az adott channelt
export async function PUT(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { segmentId } = await params;
  const body = await req.json();
  const { name, color, sortOrder, channelMixMode, useChannelMix, commissionPct, monthShares, channelMix, removeChannels } = body;

  // Update base fields
  await prisma.scenarioSegment.update({
    where: { id: segmentId },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(color !== undefined && { color: String(color) }),
      ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      ...(useChannelMix !== undefined && { useChannelMix: Boolean(useChannelMix) }),
      ...(commissionPct !== undefined && { commissionPct: Number(commissionPct) }),
      ...(channelMixMode !== undefined && { channelMixMode: channelMixMode === "MONTHLY" ? "MONTHLY" : "ANNUAL" }),
    },
  });

  // Month shares — findFirst + update/create (upsert null-safe)
  if (Array.isArray(monthShares)) {
    for (const ms of monthShares) {
      const existing = await prisma.scenarioSegmentMonth.findFirst({
        where: { segmentId, month: Number(ms.month) },
      });
      if (existing) {
        await prisma.scenarioSegmentMonth.update({
          where: { id: existing.id },
          data: { sharePct: Number(ms.sharePct) },
        });
      } else {
        await prisma.scenarioSegmentMonth.create({
          data: { segmentId, month: Number(ms.month), sharePct: Number(ms.sharePct) },
        });
      }
    }
  }

  // Channel mix — findFirst + update/create (upsert megbízhatatlan month:null esetén)
  if (Array.isArray(channelMix)) {
    for (const cm of channelMix) {
      const month = cm.month ?? null;
      const existing = await prisma.scenarioSegmentChannel.findFirst({
        where: { segmentId, distributorId: cm.distributorId, month },
      });
      if (existing) {
        await prisma.scenarioSegmentChannel.update({
          where: { id: existing.id },
          data: { sharePct: Number(cm.sharePct) },
        });
      } else {
        await prisma.scenarioSegmentChannel.create({
          data: { segmentId, distributorId: cm.distributorId, month, sharePct: Number(cm.sharePct) },
        });
      }
    }
  }

  // Remove channels from mix
  if (Array.isArray(removeChannels)) {
    for (const rc of removeChannels) {
      const month = rc.month ?? null;
      await prisma.scenarioSegmentChannel.deleteMany({
        where: { segmentId, distributorId: rc.distributorId, month },
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
