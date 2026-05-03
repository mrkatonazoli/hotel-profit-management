import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateRoomType, deleteRoomType } from "@/modules/hotel-config/hotel.service";

export async function PUT(req: Request, { params }: { params: Promise<{ roomTypeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { roomTypeId } = await params;
  const body = await req.json();
  const rt = await updateRoomType(roomTypeId, body);
  return NextResponse.json(rt);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ roomTypeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { roomTypeId } = await params;
  await deleteRoomType(roomTypeId);
  return new NextResponse(null, { status: 204 });
}
