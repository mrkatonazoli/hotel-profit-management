import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — visszaadja az összes LAB beállítást ellátástípusonként (korcsoportokkal együtt)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const hotel = await prisma.hotel.findFirst();
    if (!hotel) return NextResponse.json([]);

    const boardTypes = await prisma.hotelBoardType.findMany({
      where: { hotelId: hotel.id },
      orderBy: { sortOrder: "asc" },
      include: {
        labSettings: {
          orderBy: { validFrom: "asc" },
          include: {
            childAmounts: {
              include: {
                childAgeGroup: { select: { id: true, name: true, minAge: true, maxAge: true, sortOrder: true } },
              },
              orderBy: { childAgeGroup: { sortOrder: "asc" } },
            },
          },
        },
      },
    });

    return NextResponse.json(boardTypes.map(bt => ({
      boardType: bt.boardType,
      hotelBoardTypeId: bt.id,
      labSettings: bt.labSettings.map(ls => ({
        id: ls.id,
        validFrom: ls.validFrom.toISOString().slice(0, 10),
        validTo: ls.validTo.toISOString().slice(0, 10),
        adultAmount: ls.adultAmount,
        currency: ls.currency,
        childAmounts: ls.childAmounts.map(ca => ({
          id: ca.id,
          childAgeGroupId: ca.childAgeGroupId,
          groupName: ca.childAgeGroup.name,
          minAge: ca.childAgeGroup.minAge,
          maxAge: ca.childAgeGroup.maxAge,
          amount: ca.amount,
        })),
      })),
    })));
  } catch (err) {
    console.error("[GET /api/lab]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — új LAB sor létrehozása egy ellátástípushoz
// Body: { hotelBoardTypeId, validFrom, validTo, adultAmount, currency, childAmounts: [{ childAgeGroupId, amount }] }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { hotelBoardTypeId, validFrom, validTo, adultAmount, currency, childAmounts } = body;

    if (!hotelBoardTypeId || !validFrom || !validTo) {
      return NextResponse.json({ error: "hotelBoardTypeId, validFrom, validTo megadása kötelező" }, { status: 400 });
    }

    const ls = await prisma.labSetting.create({
      data: {
        hotelBoardTypeId,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        adultAmount: Number(adultAmount ?? 0),
        currency: String(currency ?? "HUF"),
        childAmounts: {
          create: (childAmounts ?? []).map((ca: { childAgeGroupId: string; amount: number }) => ({
            childAgeGroupId: ca.childAgeGroupId,
            amount: Number(ca.amount ?? 0),
          })),
        },
      },
      include: { childAmounts: { include: { childAgeGroup: true } } },
    });

    return NextResponse.json({
      id: ls.id,
      validFrom: ls.validFrom.toISOString().slice(0, 10),
      validTo: ls.validTo.toISOString().slice(0, 10),
      adultAmount: ls.adultAmount,
      currency: ls.currency,
      childAmounts: ls.childAmounts.map(ca => ({
        id: ca.id,
        childAgeGroupId: ca.childAgeGroupId,
        groupName: ca.childAgeGroup.name,
        minAge: ca.childAgeGroup.minAge,
        maxAge: ca.childAgeGroup.maxAge,
        amount: ca.amount,
      })),
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/lab]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
