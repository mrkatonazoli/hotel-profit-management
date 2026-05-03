import { prisma } from "@/lib/prisma";

export type ScenarioInput = {
  name: string;
  description?: string | null;
  probability: number;
  isBase: boolean;
  year: number;
};

export async function getScenariosByHotel(hotelId: string) {
  return prisma.scenario.findMany({
    where: { hotelId },
    include: { months: { orderBy: { month: "asc" } } },
    orderBy: [{ year: "desc" }, { isBase: "desc" }, { createdAt: "asc" }],
  });
}

export async function createScenario(hotelId: string, data: ScenarioInput) {
  // Ha isBase=true, a többi ugyanolyan évű scenario-t állítsuk false-ra
  if (data.isBase) {
    await prisma.scenario.updateMany({
      where: { hotelId, year: data.year, isBase: true },
      data: { isBase: false },
    });
  }
  return prisma.scenario.create({ data: { hotelId, ...data } });
}

export async function updateScenario(id: string, hotelId: string, data: ScenarioInput) {
  if (data.isBase) {
    await prisma.scenario.updateMany({
      where: { hotelId, year: data.year, isBase: true, NOT: { id } },
      data: { isBase: false },
    });
  }
  return prisma.scenario.update({ where: { id }, data });
}

export async function deleteScenario(id: string) {
  return prisma.scenario.delete({ where: { id } });
}
