import { prisma } from "@/lib/prisma";

export type MonthInput = {
  month: number; // 1–12
  occupancyPct: number;
  adr: number;
  fbRevenue: number;
  spaRevenue: number;
  otherRevenue: number;
};

export async function getScenarioWithHotel(scenarioId: string) {
  return prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: {
      hotel: {
        include: {
          roomTypes: { orderBy: { createdAt: "asc" } },
        },
      },
      months: { orderBy: { month: "asc" } },
    },
  });
}

export async function upsertScenarioMonth(scenarioId: string, data: MonthInput) {
  return prisma.scenarioMonth.upsert({
    where: { scenarioId_month: { scenarioId, month: data.month } },
    update: {
      occupancyPct: data.occupancyPct,
      adr: data.adr,
      fbRevenue: data.fbRevenue,
      spaRevenue: data.spaRevenue,
      otherRevenue: data.otherRevenue,
    },
    create: {
      scenarioId,
      month: data.month,
      occupancyPct: data.occupancyPct,
      adr: data.adr,
      fbRevenue: data.fbRevenue,
      spaRevenue: data.spaRevenue,
      otherRevenue: data.otherRevenue,
    },
  });
}
