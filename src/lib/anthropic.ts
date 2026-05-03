import fs from "fs";
import path from "path";

/**
 * Turbopack does not reliably inject all .env.local vars into API routes.
 * This helper reads the key directly from the file as a fallback.
 */
function resolveAnthropicKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^ANTHROPIC_API_KEY="?([^"\n\r]+)"?/m);
    if (match?.[1]) return match[1];
  } catch {}
  return "";
}

export const ANTHROPIC_API_KEY = resolveAnthropicKey();
