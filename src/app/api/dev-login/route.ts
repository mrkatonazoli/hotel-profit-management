import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import pg from "pg";

// IDEIGLENES dev bejelentkezés — éles környezetben törlendő!
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const dbUrl = process.env.DATABASE_URL ?? "(undefined)";
  const dbUrlSafe = dbUrl.replace(/:([^@]+)@/, ":***@");

  // 1. Direkt pg kapcsolat teszt (Prismától függetlenül)
  let pgTestResult: string;
  try {
    const pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    const client = await pool.connect();
    const res = await client.query("SELECT 1 AS ok");
    client.release();
    await pool.end();
    pgTestResult = `OK — row: ${JSON.stringify(res.rows[0])}`;
  } catch (pgErr: unknown) {
    const e = pgErr as Error & { code?: string; cause?: unknown };
    pgTestResult = `FAIL — ${e.message} | code: ${e.code} | cause: ${JSON.stringify(e.cause, Object.getOwnPropertyNames(e.cause ?? {}))}`;
  }

  // 2. Prisma teszt
  let user;
  try {
    user = await prisma.user.findFirst({ where: { email: "katonazoltanads@gmail.com" } });
  } catch (err: unknown) {
    const e = err as Error & { code?: string; cause?: unknown; meta?: unknown };
    return NextResponse.json({
      dbUrl: dbUrlSafe,
      pgTest: pgTestResult,
      prismaError: e.message,
      prismaCode: e.code,
      prismaMeta: e.meta,
      prismaCause: JSON.stringify(e.cause, Object.getOwnPropertyNames(e.cause ?? {})),
    }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.session.create({
    data: { sessionToken: token, userId: user.id, expires },
  });

  const res = NextResponse.redirect(new URL("/dashboard", "http://localhost:3000"));
  res.cookies.set("authjs.session-token", token, {
    httpOnly: true,
    expires,
    path: "/",
    sameSite: "lax",
  });

  return res;
}
