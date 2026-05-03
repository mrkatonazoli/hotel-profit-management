import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ variableId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { variableId } = await params;
  const data = await req.json();
  const variable = await prisma.scenarioVariable.update({
    where: { id: variableId },
    data: {
      ...(data.name  !== undefined && { name: data.name }),
      ...(data.value !== undefined && { value: data.value }),
    },
  });
  return NextResponse.json(variable);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ variableId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { variableId } = await params;
  await prisma.scenarioVariable.delete({ where: { id: variableId } });
  return NextResponse.json({ ok: true });
}
