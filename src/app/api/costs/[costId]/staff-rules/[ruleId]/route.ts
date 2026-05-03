import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ costId: string; ruleId: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ruleId } = await params;
  await prisma.staffRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ ok: true });
}
