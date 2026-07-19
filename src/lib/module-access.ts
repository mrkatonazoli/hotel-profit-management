import { prisma } from "@/lib/prisma";

export type ModuleAccess = string[] | null; // null = full access, [] = no access

export const ALL_MODULES = [
  { id: "SIMPLE_PLANNER",    label: "Simple Planner" },
  { id: "DATAHEAVEN",        label: "DataHeaven" },
  { id: "REVENUE_PLANNER",   label: "Bevételtervező" },
  { id: "SCENARIOS",         label: "Szcenáriók" },
  { id: "WEIGHTING",         label: "Súlyozás" },
  { id: "COSTS",             label: "Kiadások" },
  { id: "REPORTING",         label: "Riportok" },
  { id: "ANALYSIS",          label: "Részletes elemzés" },
  { id: "HISTORICAL_IMPORT", label: "Pickup import" },
  { id: "HOTEL_CONFIG",      label: "Hotel beállítások" },
  { id: "TEAM",              label: "Csapat" },
] as const;

export async function getUserModuleAccess(userId: string, hotelId: string): Promise<ModuleAccess> {
  const callerUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (callerUser?.role === "SUPER_ADMIN") return null; // full access

  const hu = await prisma.hotelUser.findUnique({
    where: { hotelId_userId: { hotelId, userId } },
    include: { modules: true },
  });

  if (!hu) return []; // not a member
  if (hu.role === "MANAGER") return null; // full access
  if (hu.modules.length === 0) return null; // no restrictions = full access (backward compat)
  return hu.modules.map(m => m.module);
}
