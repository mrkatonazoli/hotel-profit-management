import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

const ALL_BOARD_TYPES = [
  { code: "RO", sortOrder: 0 },
  { code: "BB", sortOrder: 1 },
  { code: "HB", sortOrder: 2 },
  { code: "FB", sortOrder: 3 },
  { code: "AI", sortOrder: 4 },
];

// GET — visszaadja, melyik ellátástípusok aktívak a szállodánál
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const hotel = await getActiveHotel();
    if (!hotel) return NextResponse.json([]);

    const active = await prisma.hotelBoardType.findMany({
      where: { hotelId: hotel.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(active.map(b => b.boardType));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT — felülírja a teljes listát (checkbox-based)
// Body: { boardTypes: ["BB", "HB", "FB"] }
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const hotel = await getActiveHotel();
    if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

    const { boardTypes } = await req.json() as { boardTypes: string[] };

    // Töröljük a nem kívánt ellátástípusokat (és cascadeban a LAB beállításaikat)
    await prisma.hotelBoardType.deleteMany({
      where: { hotelId: hotel.id, boardType: { notIn: boardTypes } },
    });

    // Hozzáadjuk az újakat (ha még nincs)
    for (const code of boardTypes) {
      const meta = ALL_BOARD_TYPES.find(b => b.code === code);
      await prisma.hotelBoardType.upsert({
        where: { hotelId_boardType: { hotelId: hotel.id, boardType: code } },
        create: { hotelId: hotel.id, boardType: code, sortOrder: meta?.sortOrder ?? 99 },
        update: {},
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
