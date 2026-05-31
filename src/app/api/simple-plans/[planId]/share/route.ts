import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createHash } from "crypto";

type Params = { params: Promise<{ planId: string }> };

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function hashPassword(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

function planToResponse(plan: {
  shareToken: string | null;
  shareEnabled: boolean;
  shareSummary: string | null;
  shareExpiresAt: Date | null;
  sharePassword: string | null;
}) {
  return {
    shareToken: plan.shareToken,
    shareEnabled: plan.shareEnabled,
    shareSummary: plan.shareSummary ?? "",
    shareExpiresAt: plan.shareExpiresAt ? plan.shareExpiresAt.toISOString() : null,
    sharePasswordSet: plan.sharePassword !== null,
  };
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { planId } = await params;

  const plan = await prisma.simplePlan.findUnique({
    where: { id: planId },
    select: { shareToken: true, shareEnabled: true, shareSummary: true, shareExpiresAt: true, sharePassword: true },
  });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(planToResponse(plan));
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { planId } = await params;

  const body = await req.json() as {
    enabled?: boolean;
    summary?: string;
    expiresAt?: string | null;
    password?: string | null; // undefined = don't change, "" = remove, string = set new
  };

  const existing = await prisma.simplePlan.findUnique({
    where: { id: planId },
    select: { shareToken: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = existing.shareToken ?? generateToken();

  // Resolve password update
  let passwordUpdate: { sharePassword: string | null } | Record<string, never> = {};
  if (body.password !== undefined) {
    passwordUpdate = {
      sharePassword: body.password === "" || body.password === null
        ? null
        : hashPassword(body.password),
    };
  }

  const updated = await prisma.simplePlan.update({
    where: { id: planId },
    data: {
      shareToken: token,
      shareEnabled: body.enabled ?? false,
      shareSummary: body.summary ?? "",
      shareExpiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      ...passwordUpdate,
    },
    select: { shareToken: true, shareEnabled: true, shareSummary: true, shareExpiresAt: true, sharePassword: true },
  });

  return NextResponse.json(planToResponse(updated));
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
      sharePassword: null,
    },
    select: { shareToken: true, shareEnabled: true, shareSummary: true, shareExpiresAt: true, sharePassword: true },
  });

  return NextResponse.json(planToResponse(updated));
}
