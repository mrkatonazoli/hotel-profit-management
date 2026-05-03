import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ labId: string }> };

// PUT — LAB sor frissítése (dátumok, összegek)
// Body: { validFrom?, validTo?, adultAmount?, currency?, childAmounts?: [{ childAgeGroupId, amount }] }
export async function PUT(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { labId } = await params;
    const { validFrom, validTo, adultAmount, currency, childAmounts } = await req.json();

    await prisma.labSetting.update({
      where: { id: labId },
      data: {
        ...(validFrom !== undefined && { validFrom: new Date(validFrom) }),
        ...(validTo !== undefined && { validTo: new Date(validTo) }),
        ...(adultAmount !== undefined && { adultAmount: Number(adultAmount) }),
        ...(currency !== undefined && { currency: String(currency) }),
      },
    });

    // Gyerekkorcsoport összegek frissítése (upsert)
    if (Array.isArray(childAmounts)) {
      for (const ca of childAmounts as { childAgeGroupId: string; amount: number }[]) {
        await prisma.labSettingChildAmount.upsert({
          where: { labSettingId_childAgeGroupId: { labSettingId: labId, childAgeGroupId: ca.childAgeGroupId } },
          create: { labSettingId: labId, childAgeGroupId: ca.childAgeGroupId, amount: Number(ca.amount ?? 0) },
          update: { amount: Number(ca.amount ?? 0) },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/lab/:id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { labId } = await params;
    await prisma.labSetting.delete({ where: { id: labId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/lab/:id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
