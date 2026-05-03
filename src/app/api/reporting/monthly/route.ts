import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

// ─── Cost calculation ─────────────────────────────────────────────────────────

function aggregateBoardTypeRows(rows: {
  boardType: string; adultCount: number;
  childCounts: { childAgeGroupId: string; count: number }[];
}[]): { boardType: string; adultCount: number; childCounts: { childAgeGroupId: string; count: number }[] }[] {
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

type CostRow = {
  id: string; name: string; type: string; nature: string;
  amountType: string; amount: number | null; percentage: number | null;
  percentageBase: string; isStaff: boolean;
  staffRules: { occupancyFrom: number; occupancyTo: number | null; extraStaffCount: number; dailyRate: number }[];
};

type LabChildAmountRow = { childAgeGroupId: string; amount: number };
type LabSettingRow = { validFrom: Date; validTo: Date; adultAmount: number; childAmounts: LabChildAmountRow[] };
type LabBoardTypeRow = { boardType: string; labSettings: LabSettingRow[] };
type DayBoardTypeRow = {
  boardType: string;
  adultCount: number;
  childCounts: { childAgeGroupId: string; count: number }[];
};
type DistRow = { commissionPct: number };

function calcMonthlyCosts(opts: {
  totalRevenue: number;
  roomRevenue: number;
  roomNights: number;
  avgOccPct: number;
  daysInMonth: number;
  costs: CostRow[];
  labBoardTypes: LabBoardTypeRow[];
  dayBoardTypesByDay: { day: Date; boardTypes: DayBoardTypeRow[] }[];
  distributors: DistRow[];
}) {
  let fixedCosts = 0;
  let variableCosts = 0;
  let staffCosts = 0;
  let labCosts = 0;
  let distributorCosts = 0;

  for (const c of opts.costs) {
    if (c.isStaff) {
      // Base monthly staff cost
      staffCosts += c.amount ?? 0;
      // Find applicable occupancy rule
      const rule = c.staffRules.find(r =>
        opts.avgOccPct >= r.occupancyFrom &&
        (r.occupancyTo === null || opts.avgOccPct <= r.occupancyTo)
      );
      if (rule) {
        staffCosts += rule.extraStaffCount * rule.dailyRate * opts.daysInMonth;
      }
    } else if (c.type === "FIXED") {
      if (c.nature === "RECURRING") fixedCosts += c.amount ?? 0;
      // ONE_TIME skipped from monthly amortization
    } else {
      // VARIABLE
      if (c.amountType === "FIXED_AMOUNT") {
        variableCosts += c.amount ?? 0;
      } else {
        const pct = (c.percentage ?? 0) / 100;
        if (c.percentageBase === "TOTAL_REVENUE") variableCosts += opts.totalRevenue * pct;
        else if (c.percentageBase === "ROOM_REVENUE") variableCosts += opts.roomRevenue * pct;
        else if (c.percentageBase === "PER_ROOM_NIGHT") variableCosts += opts.roomNights * (c.amount ?? 0);
      }
    }
  }

  // LAB — per-day board type × guest count calculation
  for (const { day, boardTypes } of opts.dayBoardTypesByDay) {
    for (const dbt of boardTypes) {
      const labBt = opts.labBoardTypes.find(l => l.boardType === dbt.boardType);
      if (!labBt) continue;
      const ls = labBt.labSettings.find(s => s.validFrom <= day && s.validTo >= day);
      if (!ls) continue;
      labCosts += dbt.adultCount * ls.adultAmount;
      for (const cc of dbt.childCounts) {
        const childRate = ls.childAmounts.find(ca => ca.childAgeGroupId === cc.childAgeGroupId);
        if (childRate) labCosts += cc.count * childRate.amount;
      }
    }
  }

  // Distributors
  for (const d of opts.distributors) {
    distributorCosts += opts.roomRevenue * d.commissionPct / 100;
  }

  const totalCosts = fixedCosts + variableCosts + staffCosts + labCosts + distributorCosts;
  return { fixedCosts, variableCosts, staffCosts, labCosts, distributorCosts, totalCosts };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scenarioId = searchParams.get("scenarioId");

  // Load hotel
  const hotelBase = await getActiveHotel();
  if (!hotelBase) return NextResponse.json({ error: "No hotel" }, { status: 404 });
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelBase.id },
    include: {
      scenarios: { orderBy: [{ isBase: "desc" }, { year: "desc" }, { probability: "desc" }] },
      costs: { include: { staffRules: true } },
      boardTypes: {
        orderBy: { sortOrder: "asc" },
        include: {
          labSettings: {
            include: { childAmounts: true },
          },
        },
      },
      distributors: true,
    },
  });
  if (!hotel) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  const scenario = scenarioId
    ? hotel.scenarios.find(s => s.id === scenarioId) ?? hotel.scenarios[0]
    : hotel.scenarios.find(s => s.isBase) ?? hotel.scenarios[0];
  if (!scenario) return NextResponse.json({ error: "No scenario" }, { status: 404 });

  const totalRooms = hotel.totalRooms ?? 0;

  // Load all plan days for this scenario (with board types for LAB calculation)
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
  // Child age groups for this hotel
  const childAgeGroups = await prisma.childAgeGroup.findMany({
    where: { hotelId: hotel.id },
    orderBy: [{ sortOrder: "asc" }, { minAge: "asc" }],
  });

  // Aggregate by month
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const daysThisMonth = planDays.filter(pd => pd.date.getUTCMonth() + 1 === m);
    const daysInMonth = new Date(scenario.year, m, 0).getDate();

    const roomNights = daysThisMonth.reduce((a, pd) =>
      a + (totalRooms > 0 ? Math.round(pd.occupancyPct / 100 * totalRooms) : 0), 0);
    const roomRevenue = daysThisMonth.reduce((a, pd) => a + pd.roomRevenue, 0);
    const fbRevenue = daysThisMonth.reduce((a, pd) => a + pd.fbRevenue, 0);
    const spaRevenue = daysThisMonth.reduce((a, pd) => a + pd.spaRevenue, 0);
    const otherRevenue = daysThisMonth.reduce((a, pd) => a + pd.otherRevenue, 0);
    const totalRevenue = roomRevenue + fbRevenue + spaRevenue + otherRevenue;
    const adultCount = daysThisMonth.reduce((a, pd) => a + pd.adultCount, 0);
    const childCount = daysThisMonth.reduce((a, pd) => a + pd.childCount, 0);
    const totalGuests = adultCount + childCount;

    const avgOcc = daysThisMonth.length > 0
      ? daysThisMonth.reduce((a, pd) => a + pd.occupancyPct, 0) / daysThisMonth.length : 0;
    const avgAdr = roomNights > 0 ? Math.round(roomRevenue / roomNights) : 0;
    const revpar = totalRooms > 0 && daysInMonth > 0
      ? Math.round(roomRevenue / (totalRooms * daysInMonth)) : 0;

    const monthStart = new Date(Date.UTC(scenario.year, m - 1, 1));
    const monthEnd = new Date(Date.UTC(scenario.year, m - 1, daysInMonth));

    const costs = calcMonthlyCosts({
      totalRevenue, roomRevenue, roomNights,
      avgOccPct: avgOcc,
      daysInMonth,
      costs: hotel.costs as CostRow[],
      labBoardTypes: hotel.boardTypes as LabBoardTypeRow[],
      dayBoardTypesByDay: daysThisMonth.map(pd => ({
        day: pd.date,
        boardTypes: aggregateBoardTypeRows(pd.boardTypes),
      })),
      distributors: hotel.distributors,
    });

    const profit = totalRevenue - costs.totalCosts;
    const profitPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      month: m,
      hasData: daysThisMonth.length > 0,
      daysInMonth,
      daysPlanned: daysThisMonth.length,
      roomNights,
      avgOcc: Math.round(avgOcc * 10) / 10,
      avgAdr,
      revpar,
      roomRevenue,
      fbRevenue,
      spaRevenue,
      otherRevenue,
      totalRevenue,
      ...costs,
      profit,
      profitPct: Math.round(profitPct * 10) / 10,
      adultCount,
      childCount,
      totalGuests,
    };
  });

  // Annual totals
  const annual = months.reduce((acc, m) => ({
    roomNights: acc.roomNights + m.roomNights,
    roomRevenue: acc.roomRevenue + m.roomRevenue,
    fbRevenue: acc.fbRevenue + m.fbRevenue,
    spaRevenue: acc.spaRevenue + m.spaRevenue,
    otherRevenue: acc.otherRevenue + m.otherRevenue,
    totalRevenue: acc.totalRevenue + m.totalRevenue,
    fixedCosts: acc.fixedCosts + m.fixedCosts,
    variableCosts: acc.variableCosts + m.variableCosts,
    staffCosts: acc.staffCosts + m.staffCosts,
    labCosts: acc.labCosts + m.labCosts,
    distributorCosts: acc.distributorCosts + m.distributorCosts,
    totalCosts: acc.totalCosts + m.totalCosts,
    profit: acc.profit + m.profit,
  }), {
    roomNights: 0, roomRevenue: 0, fbRevenue: 0, spaRevenue: 0, otherRevenue: 0,
    totalRevenue: 0, fixedCosts: 0, variableCosts: 0, staffCosts: 0,
    labCosts: 0, distributorCosts: 0, totalCosts: 0, profit: 0,
  });

  const annualProfitPct = annual.totalRevenue > 0
    ? Math.round((annual.profit / annual.totalRevenue) * 1000) / 10 : 0;

  return NextResponse.json({
    hotel: { name: hotel.name, totalRooms, currency: hotel.baseCurrency },
    childAgeGroups: childAgeGroups.map(g => ({ id: g.id, name: g.name, minAge: g.minAge, maxAge: g.maxAge })),
    scenario: {
      id: scenario.id, name: scenario.name, year: scenario.year,
      probability: scenario.probability, isBase: scenario.isBase,
    },
    scenarios: hotel.scenarios.map(s => ({
      id: s.id, name: s.name, year: s.year,
      probability: s.probability, isBase: s.isBase,
    })),
    months,
    annual: { ...annual, profitPct: annualProfitPct },
  });
}
