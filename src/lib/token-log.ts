import { prisma } from "@/lib/prisma";

/**
 * Aszinkron token fogyasztás logolás – tűz és felejtsd mód, nem blokkolja a választ.
 */
export function logTokenUsage({
  feature,
  model,
  inputTokens,
  outputTokens,
  userId,
}: {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  userId?: string | null;
}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  prisma.aiTokenLog
    .create({
      data: {
        date: today,
        feature,
        model,
        inputTokens,
        outputTokens,
        userId: userId ?? null,
      },
    })
    .catch(err => console.error("[token-log] DB error:", err));
}
