/**
 * Server-side DataHeaven API client (data.katonazoli.hu). The API key lives
 * ONLY on the server (env) — the browser talks to our /api/dataheaven proxy
 * routes, never to DataHeaven directly.
 */
const BASE = process.env.DATAHEAVEN_API_URL ?? "https://data.katonazoli.hu";
const KEY = process.env.DATAHEAVEN_API_KEY;

export async function dhFetch(path: string, revalidateSeconds = 300): Promise<Response> {
  if (!KEY) throw new Error("DATAHEAVEN_API_KEY nincs beállítva");
  return fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    next: { revalidate: revalidateSeconds },
  });
}
