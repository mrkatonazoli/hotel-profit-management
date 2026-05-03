import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateSeasonWeight, deleteSeasonWeight } from "@/modules/weighting/weighting.service";

export async function PUT(req: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { seasonId } = await params;
  const body = await req.json();
  const season = await updateSeasonWeight(seasonId, body);
  return NextResponse.json(season);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { seasonId } = await params;
  await deleteSeasonWeight(seasonId);
  return new NextResponse(null, { status: 204 });
}
