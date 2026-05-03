import { prisma } from "@/lib/prisma";

export type HotelInput = {
  name: string;
  city: string;
  country: string;
  baseCurrency: string;
  totalRooms?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  billingName?: string | null;
  billingAddress?: string | null;
  billingTaxNumber?: string | null;
  isOnboarded?: boolean;
};

export async function getHotelByUser(userId: string) {
  const hotelUser = await prisma.hotelUser.findFirst({
    where: { userId },
    include: { hotel: { include: { roomTypes: { orderBy: { createdAt: "asc" } } } } },
  });
  return hotelUser?.hotel ?? null;
}

export async function createHotel(userId: string, data: HotelInput) {
  const hotel = await prisma.hotel.create({
    data: { ...data, hotelUsers: { create: { userId, role: "MANAGER" } } },
    include: { roomTypes: true },
  });
  return hotel;
}

export async function updateHotel(hotelId: string, data: HotelInput) {
  const { isOnboarded, ...rest } = data;
  return prisma.hotel.update({
    where: { id: hotelId },
    data: { ...rest, ...(isOnboarded !== undefined ? { isOnboarded } : {}) },
    include: { roomTypes: true },
  });
}

export async function createRoomType(hotelId: string, data: { name: string; count: number; maxOccupancy?: number | null }) {
  return prisma.roomType.create({ data: { hotelId, ...data } });
}

export async function updateRoomType(id: string, data: { name: string; count: number; maxOccupancy?: number | null }) {
  return prisma.roomType.update({ where: { id }, data });
}

export async function deleteRoomType(id: string) {
  return prisma.roomType.delete({ where: { id } });
}
