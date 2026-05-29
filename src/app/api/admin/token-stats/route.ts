import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Haiku pricing (USD per million tokens, approximate)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5":    { input: 0.80,  output: 4.00  },
  "claude-haiku-3-5":    { input: 0.80,  output: 4.00  },
  "claude-sonnet-4-5":   { input: 3.00,  output: 15.00 },
  "claude-opus-4-5":     { input: 15.00, output: 75.00 },
  default:               { input: 1.00,  output: 5.00  },
};

function calcCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? PRICING.default;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

async function assertSuperAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "SUPER_ADMIN";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = await assertSuperAdmin(session.user.id);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to   = searchParams.get("to");   // YYYY-MM-DD

  // Default: last 30 days
  const toDate   = to   ? new Date(to)   : new Date();
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  toDate.setUTCHours(23, 59, 59, 999);
  fromDate.setUTCHours(0, 0, 0, 0);

  const logs = await prisma.aiTokenLog.findMany({
    where: { date: { gte: fromDate, lte: toDate } },
    orderBy: { date: "asc" },
  });

  // ── Daily aggregation ──────────────────────────────────────────────────────
  const dayMap: Record<string, {
    inputTokens: number; outputTokens: number; calls: number; costUsd: number;
    byFeature: Record<string, { calls: number; inputTokens: number; outputTokens: number }>;
  }> = {};

  for (const log of logs) {
    const day = log.date.toISOString().slice(0, 10);
    if (!dayMap[day]) {
      dayMap[day] = { inputTokens: 0, outputTokens: 0, calls: 0, costUsd: 0, byFeature: {} };
    }
    dayMap[day].inputTokens  += log.inputTokens;
    dayMap[day].outputTokens += log.outputTokens;
    dayMap[day].calls++;
    dayMap[day].costUsd += calcCostUsd(log.model, log.inputTokens, log.outputTokens);

    if (!dayMap[day].byFeature[log.feature]) {
      dayMap[day].byFeature[log.feature] = { calls: 0, inputTokens: 0, outputTokens: 0 };
    }
    dayMap[day].byFeature[log.feature].calls++;
    dayMap[day].byFeature[log.feature].inputTokens  += log.inputTokens;
    dayMap[day].byFeature[log.feature].outputTokens += log.outputTokens;
  }

  // ── Fill missing days ──────────────────────────────────────────────────────
  type DayEntry = {
    date: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number;
    byFeature: Record<string, { calls: number; inputTokens: number; outputTokens: number }>;
  };
  const days: DayEntry[] = [];
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({
      date: key,
      ...(dayMap[key] ?? { inputTokens: 0, outputTokens: 0, calls: 0, costUsd: 0, byFeature: {} }),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // ── Feature totals ─────────────────────────────────────────────────────────
  const featureMap: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
  for (const log of logs) {
    if (!featureMap[log.feature]) {
      featureMap[log.feature] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    }
    featureMap[log.feature].calls++;
    featureMap[log.feature].inputTokens  += log.inputTokens;
    featureMap[log.feature].outputTokens += log.outputTokens;
    featureMap[log.feature].costUsd += calcCostUsd(log.model, log.inputTokens, log.outputTokens);
  }

  // ── Model totals ───────────────────────────────────────────────────────────
  const modelMap: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
  for (const log of logs) {
    if (!modelMap[log.model]) {
      modelMap[log.model] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    }
    modelMap[log.model].calls++;
    modelMap[log.model].inputTokens  += log.inputTokens;
    modelMap[log.model].outputTokens += log.outputTokens;
    modelMap[log.model].costUsd += calcCostUsd(log.model, log.inputTokens, log.outputTokens);
  }

  // ── Grand totals ───────────────────────────────────────────────────────────
  const totals = {
    calls: logs.length,
    inputTokens:  logs.reduce((a: number, l) => a + l.inputTokens, 0),
    outputTokens: logs.reduce((a: number, l) => a + l.outputTokens, 0),
    costUsd: logs.reduce((a: number, l) => a + calcCostUsd(l.model, l.inputTokens, l.outputTokens), 0),
  };

  return NextResponse.json({
    from: fromDate.toISOString().slice(0, 10),
    to:   toDate.toISOString().slice(0, 10),
    totals,
    days,
    features: featureMap,
    models: modelMap,
  });
}
