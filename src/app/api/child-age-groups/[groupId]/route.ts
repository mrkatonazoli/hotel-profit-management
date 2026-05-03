import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  const body = await req.json();

  const group = await prisma.childAgeGroup.update({
    where: { id: groupId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.minAge !== undefined && { minAge: body.minAge }),
      ...(body.maxAge !== undefined && { maxAge: body.maxAge }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  return NextResponse.json(group);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  await prisma.childAgeGroup.delete({ where: { id: groupId } });
  return NextResponse.json({ ok: true });
}
