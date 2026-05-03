import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const variables = await prisma.scenarioVariable.findMany({
    where: { scenarioId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(variables);
}

export async function POST(req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;
  const { name, value } = await req.json();

  const count = await prisma.scenarioVariable.count({ where: { scenarioId } });
  const variable = await prisma.scenarioVariable.create({
    data: { scenarioId, name: name ?? "Új változó", value: value ?? "", sortOrder: count },
  });
  return NextResponse.json(variable);
}
