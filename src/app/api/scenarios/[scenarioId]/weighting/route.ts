import { NextResponse } from "next/server";
import { getDayTypeWeights, upsertDayTypeWeight } from "@/modules/weighting/weighting.service";
import type { Mults } from "@/modules/weighting/weighting.service";

export async function GET(_req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const dayWeights = await getDayTypeWeights(scenarioId);
  return NextResponse.json({ dayWeights });
}

export async function PUT(req: Request, { params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const body = await req.json();
  const { dayOfWeek, ...mults } = body as { dayOfWeek: number } & Mults;
  const row = await upsertDayTypeWeight(scenarioId, dayOfWeek, mults);
  return NextResponse.json(row);
}
