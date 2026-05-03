import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const hotel = await getActiveHotel();
    if (!hotel) return NextResponse.json([]);   // nincs hotel → üres lista, nem 404

    const groups = await prisma.childAgeGroup.findMany({
      where: { hotelId: hotel.id },
      orderBy: [{ sortOrder: "asc" }, { minAge: "asc" }],
    });

    return NextResponse.json(groups);
  } catch (err) {
    console.error("[GET /api/child-age-groups]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const hotel = await getActiveHotel();
    if (!hotel) return NextResponse.json({ error: "Nincs hotel konfigurálva" }, { status: 404 });

    const body = await req.json();
    const { name, minAge, maxAge, sortOrder } = body;

    if (!name || minAge === undefined || minAge === null || maxAge === undefined || maxAge === null) {
      return NextResponse.json({ error: "name, minAge, maxAge megadása kötelező" }, { status: 400 });
    }
    if (Number(minAge) > Number(maxAge)) {
      return NextResponse.json({ error: "A minimum kor nem lehet nagyobb mint a maximum" }, { status: 400 });
    }

    const group = await prisma.childAgeGroup.create({
      data: {
        hotelId: hotel.id,
        name: String(name),
        minAge: Number(minAge),
        maxAge: Number(maxAge),
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    console.error("[POST /api/child-age-groups]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
