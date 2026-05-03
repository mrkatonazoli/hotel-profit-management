import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;
  const { weightingNote } = await req.json();

  const updated = await prisma.scenario.update({
    where: { id: scenarioId },
    data: { weightingNote: weightingNote ?? null },
    select: { weightingNote: true },
  });

  return NextResponse.json(updated);
}
