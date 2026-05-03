import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/anthropic";
import { logTokenUsage } from "@/lib/token-log";

export async function POST(req: Request, { params }: { params: Promise<{ scenarioId: string; variableId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId, variableId } = await params;

  const variable = await prisma.scenarioVariable.findUnique({ where: { id: variableId } });
  if (!variable) return NextResponse.json({ error: "Nem található" }, { status: 404 });

  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { hotel: true },
  });

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const prompt = `Te egy szállodai revenue management rendszer AI asszisztense vagy.

A felhasználó az alábbi információt szeretné rögzíteni a "${variable.name}" nevű súlyozási változóhoz egy ${scenario?.hotel.name ?? "szálloda"} (${scenario?.year ?? ""}) forgatókönyvéhez:

---
${variable.value}
---

Fogalmazd meg ezt tömören, pontosan és szakszerűen, 1-3 mondatban.
- Maradj a tényeknél, amit a felhasználó írt
- Ne találj ki extra információt
- Legyen közvetlen, revenue management szempontból hasznos megfogalmazás
- Magyar nyelven válaszolj
- Ne kezdd azzal, hogy "Az információ szerint" vagy hasonló bevezető fordulattal

Csak a megfogalmazott szöveget add vissza, semmi mást.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  // Log token usage
  logTokenUsage({
    feature: "refine_variable",
    model: "claude-haiku-4-5",
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    userId: session.user.id,
  });

  const refined = (message.content[0] as { type: string; text: string }).text?.trim() ?? variable.value;

  const updated = await prisma.scenarioVariable.update({
    where: { id: variableId },
    data: { value: refined },
  });

  return NextResponse.json(updated);
}
