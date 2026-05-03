import { NextResponse } from "next/server";
import { updateSeasonWeight, deleteSeasonWeight } from "@/modules/weighting/weighting.service";

export async function PUT(req: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params;
  const body = await req.json();
  const season = await updateSeasonWeight(seasonId, body);
  return NextResponse.json(season);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params;
  await deleteSeasonWeight(seasonId);
  return NextResponse.json({ ok: true });
}
