import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Aggregálja a szobatípusonkénti boardType sorokat → egyetlen boardType-összesítő lista
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

function calcDailyCosts(opts: {
  totalRevenue: number;
  roomRevenue: number;
  roomNights: number;
  occupancyPct: number;
  daysInMonth: number;
  costs: CostRow[];
  labBoardTypes: LabBoardTypeRow[];
  dayBoardTypes: DayBoardTypeRow[];
  distributors: DistRow[];
  day: Date;
}) {
  let fixedCosts = 0;
  let variableCosts = 0;
  let staffCosts = 0;
  let labCosts = 0;
  let distributorCosts = 0;

  for (const c of opts.costs) {
    if (c.isStaff) {
      staffCosts += (c.amount ?? 0) / opts.daysInMonth;
      const rule = c.staffRules.find(r =>
        opts.occupancyPct >= r.occupancyFrom &&
        (r.occupancyTo === null || opts.occupancyPct <= r.occupancyTo)
      );
      if (rule) staffCosts += rule.extraStaffCount * rule.dailyRate;
    } else if (c.type === "FIXED") {
      if (c.nature === "RECURRING") fixedCosts += (c.amount ?? 0) / opts.daysInMonth;
    } else {
      if (c.amountType === "FIXED_AMOUNT") {
        variableCosts += (c.amount ?? 0) / opts.daysInMonth;
      } else {
        const pct = (c.percentage ?? 0) / 100;
        if (c.percentageBase === "TOTAL_REVENUE") variableCosts += opts.totalRevenue * pct;
        else if (c.percentageBase === "ROOM_REVENUE") variableCosts += opts.roomRevenue * pct;
        else if (c.percentageBase === "PER_ROOM_NIGHT") variableCosts += opts.roomNights * (c.amount ?? 0);
      }
    }
  }

  // LAB — ellátástípus × vendégszám alapú számítás
  for (const dbt of opts.dayBoardTypes) {
    const labBt = opts.labBoardTypes.find(l => l.boardType === dbt.boardType);
    if (!labBt) continue;
    const ls = labBt.labSettings.find(s => s.validFrom <= opts.day && s.validTo >= opts.day);
    if (!ls) continue;
    // Felnőttek LAB költsége
    labCosts += dbt.adultCount * ls.adultAmount;
    // Gyerekek LAB költsége korcsoportonként
    for (const cc of dbt.childCounts) {
      const childRate = ls.childAmounts.find(ca => ca.childAgeGroupId === cc.childAgeGroupId);
      if (childRate) labCosts += cc.count * childRate.amount;
    }
  }

  // Distributors
  for (const d of opts.distributors) {
    distributorCosts += opts.roomRevenue * d.commissionPct / 100;
  }

  const totalCosts = fixedCosts + variableCosts + staffCosts + labCosts + distributorCosts;
  return { fixedCosts, variableCosts, staffCosts, labCosts, distributorCosts, totalCosts };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scenarioId = searchParams.get("scenarioId");
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  const hotel = await prisma.hotel.findFirst({
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

  const year = yearParam ? parseInt(yearParam) : scenario.year;
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month - 1, daysInMonth));

  const planDays = await prisma.planDay.findMany({
    where: {
      scenarioId: scenario.id,
      date: { gte: monthStart, lte: monthEnd },
    },
    include: {
      boardTypes: {
        include: {
          childCounts: {
            include: { childAgeGroup: { select: { id: true, name: true, minAge: true, maxAge: true } } },
          },
        },
        orderBy: { boardType: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  const totalRooms = hotel.totalRooms ?? 0;

  const HU_DAYS = ["Vas", "Hét", "Kedd", "Sze", "Csüt", "Pén", "Szo"];

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const date = new Date(Date.UTC(year, month - 1, dayNum));
    const dateStr = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getUTCDay();
    const pd = planDays.find(p => p.date.toISOString().slice(0, 10) === dateStr);

    if (!pd) {
      return {
        date: dateStr,
        dayOfWeek,
        dayName: HU_DAYS[dayOfWeek],
        hasData: false,
        occupancyPct: 0, adr: 0, roomNights: 0,
        roomRevenue: 0, fbRevenue: 0, spaRevenue: 0, otherRevenue: 0, totalRevenue: 0,
        fixedCosts: 0, variableCosts: 0, staffCosts: 0, labCosts: 0, distributorCosts: 0, totalCosts: 0,
        profit: 0, profitPct: 0,
      };
    }

    const roomNights = totalRooms > 0 ? Math.round(pd.occupancyPct / 100 * totalRooms) : 0;
    const totalRevenue = pd.roomRevenue + pd.fbRevenue + pd.spaRevenue + pd.otherRevenue;

    const costs = calcDailyCosts({
      totalRevenue,
      roomRevenue: pd.roomRevenue,
      roomNights,
      occupancyPct: pd.occupancyPct,
      daysInMonth,
      costs: hotel.costs as CostRow[],
      labBoardTypes: hotel.boardTypes as LabBoardTypeRow[],
      dayBoardTypes: aggregateBoardTypeRows(pd.boardTypes),
      distributors: hotel.distributors,
      day: date,
    });

    const profit = totalRevenue - costs.totalCosts;
    const profitPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      date: dateStr,
      dayOfWeek,
      dayName: HU_DAYS[dayOfWeek],
      hasData: true,
      occupancyPct: Math.round(pd.occupancyPct * 10) / 10,
      adr: pd.adr,
      roomNights,
      roomRevenue: pd.roomRevenue,
      fbRevenue: pd.fbRevenue,
      spaRevenue: pd.spaRevenue,
      otherRevenue: pd.otherRevenue,
      totalRevenue,
      ...costs,
      profit: Math.round(profit),
      profitPct: Math.round(profitPct * 10) / 10,
      adultCount: pd.adultCount,
      childCount: pd.childCount,
      totalGuests: pd.adultCount + pd.childCount,
      boardTypes: (() => {
        // Aggregálunk roomTypeId szerint → hotel-szintű boardType bontás a riporthoz
        const btMap = new Map<string, { roomCount: number; adultCount: number; childMap: Map<string, { groupId: string; groupName: string; minAge: number; maxAge: number; count: number }> }>();
        for (const bt of pd.boardTypes) {
          if (!btMap.has(bt.boardType)) btMap.set(bt.boardType, { roomCount: 0, adultCount: 0, childMap: new Map() });
          const e = btMap.get(bt.boardType)!;
          e.roomCount  += bt.roomCount;
          e.adultCount += bt.adultCount;
          for (const cc of bt.childCounts) {
            const ex = e.childMap.get(cc.childAgeGroupId);
            if (ex) ex.count += cc.count;
            else e.childMap.set(cc.childAgeGroupId, { groupId: cc.childAgeGroupId, groupName: cc.childAgeGroup.name, minAge: cc.childAgeGroup.minAge, maxAge: cc.childAgeGroup.maxAge, count: cc.count });
          }
        }
        return Array.from(btMap.entries()).map(([boardType, e]) => ({
          boardType,
          roomCount: e.roomCount,
          adultCount: e.adultCount,
          childCounts: Array.from(e.childMap.values()),
        }));
      })(),
    };
  });

  // Month totals
  const activeDays = days.filter(d => d.hasData);
  const totals = activeDays.reduce((acc, d) => ({
    roomNights: acc.roomNights + d.roomNights,
    roomRevenue: acc.roomRevenue + d.roomRevenue,
    fbRevenue: acc.fbRevenue + d.fbRevenue,
    spaRevenue: acc.spaRevenue + d.spaRevenue,
    otherRevenue: acc.otherRevenue + d.otherRevenue,
    totalRevenue: acc.totalRevenue + d.totalRevenue,
    totalCosts: acc.totalCosts + d.totalCosts,
    profit: acc.profit + d.profit,
  }), {
    roomNights: 0, roomRevenue: 0, fbRevenue: 0, spaRevenue: 0,
    otherRevenue: 0, totalRevenue: 0, totalCosts: 0, profit: 0,
  });

  const avgOcc = activeDays.length > 0
    ? Math.round(activeDays.reduce((a, d) => a + d.occupancyPct, 0) / activeDays.length * 10) / 10 : 0;
  const avgAdr = totals.roomNights > 0 ? Math.round(totals.roomRevenue / totals.roomNights) : 0;
  const revpar = totalRooms > 0 && daysInMonth > 0
    ? Math.round(totals.roomRevenue / (totalRooms * daysInMonth)) : 0;
  const profitPct = totals.totalRevenue > 0
    ? Math.round((totals.profit / totals.totalRevenue) * 1000) / 10 : 0;

  return NextResponse.json({
    hotel: { name: hotel.name, totalRooms, currency: hotel.baseCurrency },
    scenario: { id: scenario.id, name: scenario.name, year: scenario.year, probability: scenario.probability, isBase: scenario.isBase },
    scenarios: hotel.scenarios.map(s => ({ id: s.id, name: s.name, year: s.year, probability: s.probability, isBase: s.isBase })),
    year, month, daysInMonth,
    days,
    totals: { ...totals, avgOcc, avgAdr, revpar, profitPct },
  });
}
