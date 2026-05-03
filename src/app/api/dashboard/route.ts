import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

// ─── Cost helpers (same as analysis/route.ts) ────────────────────────────────

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "DAILY":       return amount * 30.44;
    case "WEEKLY":      return amount * (30.44 / 7);
    case "MONTHLY":     return amount;
    case "QUARTERLY":   return amount / 3;
    case "SEMI_ANNUAL": return amount / 6;
    case "ANNUAL":      return amount / 12;
    default:            return amount;
  }
}

type CostRow = {
  type: string; nature: string; amountType: string;
  recurringFrequency: string; recurringStartDate: Date | null;
  amount: number | null; percentage: number | null;
  percentageBase: string; isStaff: boolean;
  staffRules: { occupancyFrom: number; occupancyTo: number | null; extraStaffCount: number; dailyRate: number }[];
};
type LabChildAmountRow = { childAgeGroupId: string; amount: number };
type LabSettingRow = { validFrom: Date; validTo: Date; adultAmount: number; childAmounts: LabChildAmountRow[] };
type LabBoardTypeRow = { boardType: string; labSettings: LabSettingRow[] };
type DistRow = { commissionPct: number };

function aggregateBoardTypeRows(rows: {
  boardType: string; adultCount: number;
  childCounts: { childAgeGroupId: string; count: number }[];
}[]) {
  const map = new Map<string, { adultCount: number; childCounts: Map<string, number> }>();
  for (const row of rows) {
    if (!map.has(row.boardType)) map.set(row.boardType, { adultCount: 0, childCounts: new Map() });
    const e = map.get(row.boardType)!;
    e.adultCount += row.adultCount;
    for (const cc of row.childCounts) {
      e.childCounts.set(cc.childAgeGroupId, (e.childCounts.get(cc.childAgeGroupId) ?? 0) + cc.count);
    }
  }
  return Array.from(map.entries()).map(([boardType, e]) => ({
    boardType,
    adultCount: e.adultCount,
    childCounts: Array.from(e.childCounts.entries()).map(([childAgeGroupId, count]) => ({ childAgeGroupId, count })),
  }));
}

function calcDailyCosts(opts: {
  totalRevenue: number; roomRevenue: number; roomNights: number;
  occupancyPct: number; daysInMonth: number;
  costs: CostRow[]; labBoardTypes: LabBoardTypeRow[];
  dayBoardTypes: { boardType: string; adultCount: number; childCounts: { childAgeGroupId: string; count: number }[] }[];
  distributors: DistRow[]; day: Date;
}) {
  let fixed = 0, variable = 0, staff = 0, lab = 0, distributor = 0;
  for (const c of opts.costs) {
    if (c.isStaff) {
      staff += (c.amount ?? 0) / opts.daysInMonth;
      const rule = c.staffRules.find(r =>
        opts.occupancyPct >= r.occupancyFrom &&
        (r.occupancyTo === null || opts.occupancyPct <= r.occupancyTo));
      if (rule) staff += rule.extraStaffCount * rule.dailyRate;
    } else if (c.type === "FIXED") {
      if (c.nature === "RECURRING") {
        if (c.recurringStartDate && c.recurringStartDate > opts.day) continue;
        fixed += toMonthlyAmount(c.amount ?? 0, c.recurringFrequency ?? "MONTHLY") / opts.daysInMonth;
      }
    } else {
      if (c.amountType === "FIXED_AMOUNT") {
        variable += (c.amount ?? 0) / opts.daysInMonth;
      } else {
        const pct = (c.percentage ?? 0) / 100;
        if (c.percentageBase === "TOTAL_REVENUE") variable += opts.totalRevenue * pct;
        else if (c.percentageBase === "ROOM_REVENUE") variable += opts.roomRevenue * pct;
        else if (c.percentageBase === "PER_ROOM_NIGHT") variable += opts.roomNights * (c.amount ?? 0);
      }
    }
  }
  for (const dbt of opts.dayBoardTypes) {
    const labBt = opts.labBoardTypes.find(l => l.boardType === dbt.boardType);
    if (!labBt) continue;
    const ls = labBt.labSettings.find(s => s.validFrom <= opts.day && s.validTo >= opts.day);
    if (!ls) continue;
    lab += dbt.adultCount * ls.adultAmount;
    for (const cc of dbt.childCounts) {
      const childRate = ls.childAmounts.find(ca => ca.childAgeGroupId === cc.childAgeGroupId);
      if (childRate) lab += cc.count * childRate.amount;
    }
  }
  for (const d of opts.distributors)
    distributor += opts.roomRevenue * d.commissionPct / 100;

  return fixed + variable + staff + lab + distributor;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scenarioId = searchParams.get("scenarioId");

  const hotelBase = await getActiveHotel();
  if (!hotelBase) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelBase.id },
    include: {
      scenarios: { orderBy: [{ isBase: "desc" }, { year: "desc" }, { probability: "desc" }] },
      costs: { include: { staffRules: true } },
      boardTypes: { orderBy: { sortOrder: "asc" }, include: { labSettings: { include: { childAmounts: true } } } },
      distributors: true,
    },
  });
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  const scenario = scenarioId
    ? hotel.scenarios.find(s => s.id === scenarioId) ?? hotel.scenarios[0]
    : hotel.scenarios.find(s => s.isBase) ?? hotel.scenarios[0];

  if (!scenario) return NextResponse.json({ error: "No scenario" }, { status: 404 });

  const planDays = await prisma.planDay.findMany({
    where: { scenarioId: scenario.id },
    orderBy: { date: "asc" },
    include: {
      boardTypes: {
        include: {
          childCounts: true,
        },
      },
    },
  });

  const totalRooms = hotel.totalRooms ?? 0;

  // Aggregate by month + calculate costs per day
  const monthMap: Record<number, {
    roomNights: number; roomRevenue: number;
    fbRevenue: number; spaRevenue: number; otherRevenue: number;
    occSum: number; dayCount: number; totalCosts: number;
  }> = {};
  for (let m = 1; m <= 12; m++) {
    monthMap[m] = { roomNights: 0, roomRevenue: 0, fbRevenue: 0, spaRevenue: 0, otherRevenue: 0, occSum: 0, dayCount: 0, totalCosts: 0 };
  }

  for (const pd of planDays) {
    const m = pd.date.getUTCMonth() + 1;
    const daysInMonth = new Date(pd.date.getUTCFullYear(), m, 0).getDate();
    const roomNights = totalRooms > 0 ? Math.round(pd.occupancyPct / 100 * totalRooms) : 0;
    const totalRevenue = pd.roomRevenue + pd.fbRevenue + pd.spaRevenue + pd.otherRevenue;

    const dayCost = calcDailyCosts({
      totalRevenue,
      roomRevenue: pd.roomRevenue,
      roomNights,
      occupancyPct: pd.occupancyPct,
      daysInMonth,
      costs: hotel.costs as CostRow[],
      labBoardTypes: hotel.boardTypes as LabBoardTypeRow[],
      dayBoardTypes: aggregateBoardTypeRows(pd.boardTypes),
      distributors: hotel.distributors,
      day: pd.date,
    });

    monthMap[m].dayCount++;
    monthMap[m].occSum += pd.occupancyPct;
    monthMap[m].roomNights += roomNights;
    monthMap[m].roomRevenue += pd.roomRevenue;
    monthMap[m].fbRevenue += pd.fbRevenue;
    monthMap[m].spaRevenue += pd.spaRevenue;
    monthMap[m].otherRevenue += pd.otherRevenue;
    monthMap[m].totalCosts += dayCost;
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const d = monthMap[m];
    const avgOcc = d.dayCount > 0 ? Math.round(d.occSum / d.dayCount * 10) / 10 : 0;
    const avgAdr = d.roomNights > 0 ? Math.round(d.roomRevenue / d.roomNights) : 0;
    const daysInMonth = d.dayCount || new Date(scenario.year, m, 0).getDate();
    const revpar = totalRooms > 0 && daysInMonth > 0
      ? Math.round(d.roomRevenue / (totalRooms * daysInMonth)) : 0;
    const totalRevenue = d.roomRevenue + d.fbRevenue + d.spaRevenue + d.otherRevenue;
    const profit = totalRevenue - d.totalCosts;
    const profitPct = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 1000) / 10 : 0;
    return {
      month: m, dayCount: d.dayCount,
      roomNights: d.roomNights, roomRevenue: d.roomRevenue,
      fbRevenue: d.fbRevenue, spaRevenue: d.spaRevenue, otherRevenue: d.otherRevenue,
      totalRevenue, totalCosts: Math.round(d.totalCosts),
      profit: Math.round(profit), profitPct,
      avgOcc, avgAdr, revpar,
    };
  });

  const filledMonths = months.filter(m => m.dayCount > 0);
  const totalRoomRevenue  = months.reduce((a, m) => a + m.roomRevenue, 0);
  const totalFbRevenue    = months.reduce((a, m) => a + m.fbRevenue, 0);
  const totalSpaRevenue   = months.reduce((a, m) => a + m.spaRevenue, 0);
  const totalOtherRevenue = months.reduce((a, m) => a + m.otherRevenue, 0);
  const totalRevenue      = totalRoomRevenue + totalFbRevenue + totalSpaRevenue + totalOtherRevenue;
  const totalCosts        = months.reduce((a, m) => a + m.totalCosts, 0);
  const totalProfit       = totalRevenue - totalCosts;
  const totalRoomNights   = months.reduce((a, m) => a + m.roomNights, 0);
  const avgOccPct = filledMonths.length > 0
    ? Math.round(filledMonths.reduce((a, m) => a + m.avgOcc, 0) / filledMonths.length * 10) / 10 : 0;
  const avgAdr = totalRoomNights > 0 ? Math.round(totalRoomRevenue / totalRoomNights) : 0;
  const totalDays = filledMonths.reduce((a, m) => a + m.dayCount, 0);
  const revpar = totalRooms > 0 && totalDays > 0
    ? Math.round(totalRoomRevenue / (totalRooms * totalDays)) : 0;
  const profitPct = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0;

  // Current month
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentMonthData = months.find(m => m.month === currentMonth) ?? null;

  return NextResponse.json({
    hotel: { name: hotel.name, totalRooms: hotel.totalRooms, currency: hotel.baseCurrency },
    scenario: { id: scenario.id, name: scenario.name, year: scenario.year, probability: scenario.probability, isBase: scenario.isBase },
    scenarios: hotel.scenarios.map(s => ({ id: s.id, name: s.name, year: s.year, probability: s.probability, isBase: s.isBase })),
    hasData: planDays.length > 0,
    kpis: {
      totalRoomRevenue, totalFbRevenue, totalSpaRevenue, totalOtherRevenue,
      totalRevenue, totalCosts, totalProfit, profitPct,
      totalRoomNights, avgOccPct, avgAdr, revpar,
    },
    months,
    currentMonth,
    currentMonthData,
  });
}
