import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Params = { params: Promise<{ planId: string }> };

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { planId } = await params;

  const plan = await prisma.simplePlan.findUnique({
    where: { id: planId },
    select: { shareToken: true, shareEnabled: true, shareSummary: true, shareExpiresAt: true },
  });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    shareToken: plan.shareToken,
    shareEnabled: plan.shareEnabled,
    shareSummary: plan.shareSummary ?? "",
    shareExpiresAt: plan.shareExpiresAt ? plan.shareExpiresAt.toISOString() : null,
  });
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { planId } = await params;

  const body = await req.json() as { enabled?: boolean; summary?: string; expiresAt?: string | null };

  const existing = await prisma.simplePlan.findUnique({
    where: { id: planId },
    select: { shareToken: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = existing.shareToken ?? generateToken();

  const updated = await prisma.simplePlan.update({
    where: { id: planId },
    data: {
      shareToken: token,
      shareEnabled: body.enabled ?? false,
      shareSummary: body.summary ?? "",
      shareExpiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
    select: { shareToken: true, shareEnabled: true, shareSummary: true, shareExpiresAt: true },
  });

  return NextResponse.json({
    shareToken: updated.shareToken,
    shareEnabled: updated.shareEnabled,
    shareSummary: updated.shareSummary ?? "",
    shareExpiresAt: updated.shareExpiresAt ? updated.shareExpiresAt.toISOString() : null,
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { planId } = await params;

  const updated = await prisma.simplePlan.update({
    where: { id: planId },
    data: {
      shareToken: generateToken(), // invalidate old link
      shareEnabled: false,
    },
    select: { shareToken: true, shareEnabled: true, shareSummary: true, shareExpiresAt: true },
  });

  return NextResponse.json({
    shareToken: updated.shareToken,
    shareEnabled: updated.shareEnabled,
    shareSummary: updated.shareSummary ?? "",
    shareExpiresAt: updated.shareExpiresAt ? updated.shareExpiresAt.toISOString() : null,
  });
}
