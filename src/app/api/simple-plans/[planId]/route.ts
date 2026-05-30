import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ planId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { planId } = await params;

  const plan = await prisma.simplePlan.findUnique({
    where: { id: planId },
    include: {
      months: { orderBy: { month: "asc" } },
      hotel: { select: { id: true, name: true, totalRooms: true } },
    },
  });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(plan);
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hotel = await getActiveHotel();
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 400 });

  const { planId } = await params;
  const body = await req.json();

  const plan = await prisma.simplePlan.update({
    where: { id: planId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.year !== undefined ? { year: Number(body.year) } : {}),
    },
    include: { months: { orderBy: { month: "asc" } } },
  });

  return NextResponse.json(plan);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { planId } = await params;

  await prisma.simplePlan.delete({ where: { id: planId } });
  return new NextResponse(null, { status: 204 });
}
