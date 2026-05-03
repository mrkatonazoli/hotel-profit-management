import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ distributorId: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { distributorId } = await params;
  const { name, commissionPct } = await req.json();

  const dist = await prisma.distributor.update({
    where: { id: distributorId },
    data: {
      ...(name !== undefined && { name: String(name) }),
      ...(commissionPct !== undefined && { commissionPct: Number(commissionPct) }),
    },
  });

  return NextResponse.json(dist);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { distributorId } = await params;
  await prisma.distributor.delete({ where: { id: distributorId } });
  return NextResponse.json({ ok: true });
}
