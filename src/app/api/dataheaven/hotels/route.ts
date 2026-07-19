import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dhFetch } from "@/lib/dataheaven";

/** DataHeaven hotel list for the pairing UI (proxied; key stays server-side). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await dhFetch("/api/v1/hotels", 60);
  if (!res.ok) return NextResponse.json({ error: "DataHeaven API hiba" }, { status: 502 });
  return NextResponse.json(await res.json());
}
