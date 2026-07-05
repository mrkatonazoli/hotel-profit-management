export type MonthData = {
  id?: string;
  month: number;
  adr: number;
  occupancyPct: number;
  roomRevenue: number;
  monthlyCost: number;
  breakfastPct: number;
  halfboardPct: number;
};

export type FbParams = {
  enabled: boolean;
  breakfastPrice: number;
  halfboardPrice: number;
  avgPaxPerRoom: number;
  fbOtherEnabled: boolean;
  fbOtherPct: number;
  spaEnabled: boolean;
  spaPct: number;
  otherRevenueEnabled: boolean;
  otherRevenuePct: number;
};

export type CostParams = {
  annualFixedCost: number;
  breakfastCost: number;
  halfboardCost: number;
  avgPaxPerRoom: number;
  laundryEnabled: boolean;
  laundryPerRoom: number;
  commissionEnabled: boolean;
  commissionPct: number;
  commissionBookingsPct: number;
};

export type MonthCalc = {
  month: number;
  daysInMonth: number;
  roomNights: number;
  revenue: number;
  cost: number;
  tfh: number;
  profit: number;
  margin: number | null;
  breakeven: number | null;
  hasData: boolean;
};

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export function computeMonthCalc(
  m: MonthData,
  totalRooms: number,
  year: number,
  tfhRate = 0,
  fb?: FbParams,
  costs?: CostParams,
): MonthCalc {
  const days = getDaysInMonth(m.month, year);
  const availableNights = totalRooms * days;
  const hasData = m.adr > 0 || m.occupancyPct > 0 || m.roomRevenue > 0;
  const roomNights = (m.occupancyPct / 100) * availableNights;

  let boardPerRoomNight = 0;
  if (fb?.enabled && m.roomRevenue === 0) {
    boardPerRoomNight = fb.avgPaxPerRoom * (
      (m.breakfastPct / 100) * fb.breakfastPrice +
      (m.halfboardPct / 100) * fb.halfboardPrice
    );
  }
  let extraRevPerRoomNight = 0;
  if (m.roomRevenue === 0 && fb) {
    const extraPct =
      (fb.fbOtherEnabled ? fb.fbOtherPct : 0) +
      (fb.spaEnabled ? fb.spaPct : 0) +
      (fb.otherRevenueEnabled ? fb.otherRevenuePct : 0);
    extraRevPerRoomNight = m.adr * (extraPct / 100);
  }

  // Jutalék alapja: ADR + ellátás ára — egyéb bevételek (spa, parkoló stb.) nem jutalékosak
  const commissionableRevPerRoomNight = m.roomRevenue > 0
    ? m.roomRevenue
    : m.adr + boardPerRoomNight;

  const revenuePerRoomNight = m.roomRevenue > 0
    ? m.roomRevenue
    : m.adr + boardPerRoomNight + extraRevPerRoomNight;
  const revenue = revenuePerRoomNight * roomNights;

  let cost = 0;
  if (costs) {
    const fixedPerMonth = costs.annualFixedCost / 12;
    const fbCostPerRoomNight = costs.avgPaxPerRoom * (
      (m.breakfastPct / 100) * costs.breakfastCost +
      (m.halfboardPct / 100) * costs.halfboardCost
    );
    const laundryCostPerRoomNight = costs.laundryEnabled ? costs.laundryPerRoom : 0;
    const commissionCostPerRoomNight = costs.commissionEnabled
      ? commissionableRevPerRoomNight * (costs.commissionPct / 100) * (costs.commissionBookingsPct / 100)
      : 0;
    const variablePerRoomNight = fbCostPerRoomNight + laundryCostPerRoomNight + commissionCostPerRoomNight;
    cost = fixedPerMonth + variablePerRoomNight * roomNights;
  }

  const tfh = revenue * (tfhRate / 100);
  const profit = revenue - cost - tfh;
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;
  const netRevenue = revenue - tfh;
  const breakeven = netRevenue > 0 && cost > 0 && m.occupancyPct > 0
    ? (cost / netRevenue) * m.occupancyPct
    : null;

  return { month: m.month, daysInMonth: days, roomNights, revenue, cost, tfh, profit, margin, breakeven, hasData };
}
