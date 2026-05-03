import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// ─── Cost helpers ─────────────────────────────────────────────────────────────

// Converts recurring cost amount to monthly equivalent based on frequency
function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "DAILY":       return amount * 30.44; // avg days/month
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
  totalRevenue: number; roomRevenue: number; roomNights: number;
  occupancyPct: number; daysInMonth: number;
  costs: CostRow[]; labBoardTypes: LabBoardTypeRow[];
  dayBoardTypes: DayBoardTypeRow[];
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
        // Skip if cost hasn't started yet
        if (c.recurringStartDate && c.recurringStartDate > opts.day) continue;
        const monthlyAmt = toMonthlyAmount(c.amount ?? 0, c.recurringFrequency ?? "MONTHLY");
        fixed += monthlyAmt / opts.daysInMonth;
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
  // LAB — board type × guest count based
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

  return { fixed, variable, staff, lab, distributor, total: fixed + variable + staff + lab + distributor };
}

// ─── Calendar month data ──────────────────────────────────────────────────────

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scenarioId = searchParams.get("scenarioId");
  const yearParam  = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const dateParam  = searchParams.get("date"); // "YYYY-MM-DD" — for day detail

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

  const year  = yearParam  ? parseInt(yearParam)  : scenario.year;
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalRooms  = hotel.totalRooms ?? 0;

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month - 1, daysInMonth));

  const planDays = await prisma.planDay.findMany({
    where: { scenarioId: scenario.id, date: { gte: monthStart, lte: monthEnd } },
    orderBy: { date: "asc" },
    include: {
      boardTypes: {
        include: {
          childCounts: {
            include: { childAgeGroup: { select: { id: true, name: true, minAge: true, maxAge: true, sortOrder: true } } },
          },
          roomType: { select: { id: true, name: true, count: true } },
        },
      },
    },
  });

  // Room types for capacity lookup
  const roomTypes = await prisma.roomType.findMany({
    where: { hotelId: hotel.id },
    select: { id: true, name: true, count: true },
  });

  const HU_DAYS = ["Vasárnap", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat"];
  const HU_DAYS_SHORT = ["V", "H", "K", "Sze", "Cs", "P", "Szo"];

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const date = new Date(Date.UTC(year, month - 1, dayNum));
    const dateStr = date.toISOString().slice(0, 10);
    const dow = date.getUTCDay();
    const pd = planDays.find(p => p.date.toISOString().slice(0, 10) === dateStr);

    if (!pd) return { date: dateStr, dayOfWeek: dow, dayName: HU_DAYS[dow], dayNameShort: HU_DAYS_SHORT[dow], hasData: false };

    const roomNights = totalRooms > 0 ? Math.round(pd.occupancyPct / 100 * totalRooms) : 0;
    const totalRevenue = pd.roomRevenue + pd.fbRevenue + pd.spaRevenue + pd.otherRevenue;
    const costs = calcDailyCosts({
      totalRevenue, roomRevenue: pd.roomRevenue, roomNights,
      occupancyPct: pd.occupancyPct, daysInMonth,
      costs: hotel.costs as CostRow[],
      labBoardTypes: hotel.boardTypes as LabBoardTypeRow[],
      dayBoardTypes: aggregateBoardTypeRows(pd.boardTypes),
      distributors: hotel.distributors,
      day: date,
    });
    const profit = totalRevenue - costs.total;

    return {
      date: dateStr, dayOfWeek: dow, dayName: HU_DAYS[dow], dayNameShort: HU_DAYS_SHORT[dow],
      hasData: true,
      occupancyPct: Math.round(pd.occupancyPct * 10) / 10,
      adr: pd.adr,
      roomNights,
      freeRooms: Math.max(totalRooms - roomNights, 0),
      roomRevenue: pd.roomRevenue,
      fbRevenue: pd.fbRevenue,
      spaRevenue: pd.spaRevenue,
      otherRevenue: pd.otherRevenue,
      totalRevenue,
      costs,
      profit: Math.round(profit),
      profitPct: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 1000) / 10 : 0,
    };
  });

  // ── Day detail if requested ────────────────────────────────────────────────
  let dayDetail = null;
  if (dateParam) {
    const d = days.find(x => x.date === dateParam);
    if (d && d.hasData) {
      // Break-even calculation
      const fixedPerDay = d.costs!.fixed + d.costs!.staff;
      const varPerRoom  = totalRooms > 0 && d.roomNights! > 0
        ? (d.costs!.variable + d.costs!.lab + d.costs!.distributor) / d.roomNights!
        : 0;
      const netPerRoom  = d.adr! - varPerRoom;
      const breakEvenRooms = netPerRoom > 0 ? fixedPerDay / netPerRoom : totalRooms;
      const breakEvenOcc   = totalRooms > 0
        ? Math.min(Math.round((breakEvenRooms / totalRooms) * 1000) / 10, 100)
        : 0;

      // Historical pickup if available
      const historicalPickup = await prisma.historicalPickup.findMany({
        where: { hotelId: hotel.id, arrivalDate: new Date(dateParam) },
        orderBy: { snapshotDate: "asc" },
        take: 20,
      });

      // ── Room type breakdown ──────────────────────────────────────────────
      const pd = planDays.find(p => p.date.toISOString().slice(0, 10) === dateParam);
      const btRows = pd?.boardTypes ?? [];

      // Per room type: aggregate across board types
      const rtBreakdownMap = new Map<string, {
        roomTypeId: string; roomTypeName: string; totalCapacity: number;
        roomsOccupied: number; adultCount: number; childCount: number;
        boardTypes: { boardType: string; roomCount: number; adultCount: number; childCount: number }[];
      }>();
      for (const row of btRows) {
        const rtId = row.roomType.id;
        if (!rtBreakdownMap.has(rtId)) {
          rtBreakdownMap.set(rtId, {
            roomTypeId: rtId,
            roomTypeName: row.roomType.name,
            totalCapacity: row.roomType.count,
            roomsOccupied: 0, adultCount: 0, childCount: 0,
            boardTypes: [],
          });
        }
        const e = rtBreakdownMap.get(rtId)!;
        const childCount = row.childCounts.reduce((s, c) => s + c.count, 0);
        e.roomsOccupied += row.roomCount;
        e.adultCount    += row.adultCount;
        e.childCount    += childCount;
        e.boardTypes.push({ boardType: row.boardType, roomCount: row.roomCount, adultCount: row.adultCount, childCount });
      }
      const roomTypeBreakdown = Array.from(rtBreakdownMap.values()).map(rt => ({
        ...rt,
        occupancyPct: rt.totalCapacity > 0 ? Math.round((rt.roomsOccupied / rt.totalCapacity) * 1000) / 10 : 0,
      }));

      // ── Board type breakdown by age group ───────────────────────────────────
      const btBreakdownMap = new Map<string, { boardType: string; adultCount: number; childCounts: Map<string, { name: string; minAge: number; maxAge: number; count: number }> }>();
      for (const row of btRows) {
        if (!btBreakdownMap.has(row.boardType)) {
          btBreakdownMap.set(row.boardType, { boardType: row.boardType, adultCount: 0, childCounts: new Map() });
        }
        const e = btBreakdownMap.get(row.boardType)!;
        e.adultCount += row.adultCount;
        for (const cc of row.childCounts) {
          const ag = cc.childAgeGroup;
          if (!e.childCounts.has(ag.id)) {
            e.childCounts.set(ag.id, { name: ag.name, minAge: ag.minAge, maxAge: ag.maxAge, count: 0 });
          }
          e.childCounts.get(ag.id)!.count += cc.count;
        }
      }
      const boardTypeBreakdown = Array.from(btBreakdownMap.values()).map(bt => ({
        boardType: bt.boardType,
        adultCount: bt.adultCount,
        childCounts: Array.from(bt.childCounts.entries())
          .map(([id, v]) => ({ ageGroupId: id, name: v.name, minAge: v.minAge, maxAge: v.maxAge, count: v.count }))
          .sort((a, b) => a.minAge - b.minAge),
        totalGuests: bt.adultCount + Array.from(bt.childCounts.values()).reduce((s, v) => s + v.count, 0),
      }));

      dayDetail = {
        ...d,
        breakEvenOccupancy: breakEvenOcc,
        breakEvenRooms: Math.round(breakEvenRooms),
        variableCostPerRoom: Math.round(varPerRoom),
        fixedCostPerDay: Math.round(fixedPerDay),
        aboveBreakEven: d.occupancyPct! - breakEvenOcc,
        historicalPickup: historicalPickup.map(h => ({
          snapshotDate: h.snapshotDate.toISOString().slice(0, 10),
          roomsSold: h.roomsSold,
          adr: h.adr,
        })),
        roomTypeBreakdown,
        boardTypeBreakdown,
      };
    }
  }

  // Month first day of week offset (Mon=0 … Sun=6 European)
  const firstDow = monthStart.getUTCDay(); // 0=Sun
  const offset   = firstDow === 0 ? 6 : firstDow - 1; // EU: Mon=0

  return NextResponse.json({
    hotel: { name: hotel.name, totalRooms, currency: hotel.baseCurrency },
    scenario: { id: scenario.id, name: scenario.name, year: scenario.year, probability: scenario.probability, isBase: scenario.isBase },
    scenarios: hotel.scenarios.map(s => ({ id: s.id, name: s.name, year: s.year, probability: s.probability, isBase: s.isBase })),
    year, month, daysInMonth, offset,
    days,
    dayDetail,
  });
}
