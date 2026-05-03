import { NextResponse } from "next/server";
import { createSeasonWeight, getSeasonWeights } from "@/modules/weighting/weighting.service";

export async function GET(_req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const seasons = await getSeasonWeights(scenarioId);
  return NextResponse.json(seasons);
}

export async function POST(req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const body = await req.json();
  const season = await createSeasonWeight(scenarioId, body);
  return NextResponse.json(season);
}
