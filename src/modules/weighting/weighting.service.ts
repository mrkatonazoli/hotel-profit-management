import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Mults = {
  occMult:   number;
  adrMult:   number;
  fbMult:    number;
  spaMult:   number;
  otherMult: number;
  note?:     string | null;
};

export const DEFAULT_MULTS: Mults = {
  occMult: 1.0, adrMult: 1.0, fbMult: 0.0, spaMult: 0.0, otherMult: 0.0,
};

export const DAY_GROUPS = [
  { label: "Vasárnap – Csütörtök", dows: [0, 1, 2, 3, 4], key: "vcs" },
  { label: "Péntek",               dows: [5],              key: "pen" },
  { label: "Szombat",              dows: [6],              key: "szo" },
];

// ─── DayTypeWeights ───────────────────────────────────────────────────────────

export async function getDayTypeWeights(scenarioId: string) {
  const rows = await prisma.dayTypeWeight.findMany({ where: { scenarioId } });
  return Array.from({ length: 7 }, (_, dow) => {
    const found = rows.find(r => r.dayOfWeek === dow);
    return found ?? { id: null, scenarioId, dayOfWeek: dow, ...DEFAULT_MULTS };
  });
}

export async function upsertDayTypeWeight(scenarioId: string, dayOfWeek: number, data: Mults) {
  const { note, ...mults } = data;
  const payload = { ...mults, ...(note !== undefined ? { note: note ?? null } : {}) };
  return prisma.dayTypeWeight.upsert({
    where: { scenarioId_dayOfWeek: { scenarioId, dayOfWeek } },
    update: payload,
    create: { scenarioId, dayOfWeek, ...payload },
  });
}

// ─── SeasonWeights ────────────────────────────────────────────────────────────

export async function getSeasonWeights(scenarioId: string) {
  return prisma.seasonWeight.findMany({
    where: { scenarioId },
    orderBy: [{ monthFrom: "asc" }, { dayFrom: "asc" }],
  });
}

export async function createSeasonWeight(scenarioId: string, data: {
  name: string; monthFrom: number; dayFrom: number; monthTo: number; dayTo: number; note?: string | null;
} & Mults) {
  return prisma.seasonWeight.create({ data: { scenarioId, ...data } });
}

export async function updateSeasonWeight(id: string, data: {
  name: string; monthFrom: number; dayFrom: number; monthTo: number; dayTo: number; note?: string | null;
} & Mults) {
  return prisma.seasonWeight.update({ where: { id }, data });
}

export async function deleteSeasonWeight(id: string) {
  return prisma.seasonWeight.delete({ where: { id } });
}

// ─── Generation helpers ───────────────────────────────────────────────────────

type SeasonRow = { monthFrom: number; dayFrom: number; monthTo: number; dayTo: number } & Mults;

function isInSeason(date: Date, s: SeasonRow): boolean {
  const m    = date.getUTCMonth() + 1;
  const d    = date.getUTCDate();
  const from = s.monthFrom * 100 + s.dayFrom;
  const to   = s.monthTo   * 100 + s.dayTo;
  const cur  = m * 100 + d;
  if (from <= to) return cur >= from && cur <= to;
  return cur >= from || cur <= to;
}

function getMultsForDay(date: Date, dayWeights: Mults[], seasons: SeasonRow[]): Mults {
  for (const s of seasons) if (isInSeason(date, s)) return s;
  return dayWeights[date.getUTCDay()];
}

/**
 * Deterministic pseudo-random [0, 1) based on a string seed.
 * Same scenario + date always produces the same number (reproducible generation).
 */
function seededRand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = h >>> 0;
  // second mix for better distribution
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

/**
 * Add natural ±noise to an array of weights.
 * noiseFactor 0.20 = ±20% random variation per slot.
 * The weights are RELATIVE — the total doesn't matter; distributeExact handles that.
 */
function addNoise(weights: number[], noiseFactor: number, seeds: string[]): number[] {
  return weights.map((w, i) => {
    const r    = seededRand(seeds[i]);          // [0, 1)
    const mult = 1 + (r - 0.5) * 2 * noiseFactor; // [1-nf, 1+nf]
    return Math.max(0.01, w * mult);
  });
}

/**
 * Distribute `total` integer across slots proportional to `weights`,
 * guaranteeing sum(result) === total exactly (largest-remainder method).
 */
function distributeExact(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0 || total === 0) {
    const base = Math.floor(total / weights.length);
    const rem  = total - base * weights.length;
    return weights.map((_, i) => base + (i < rem ? 1 : 0));
  }
  const raw    = weights.map(w => (w / sum) * total);
  const floors = raw.map(v => Math.floor(v));
  let remaining = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ frac: v - Math.floor(v), i }))
    .sort((a, b) => b.frac - a.frac);
  for (let j = 0; j < remaining; j++) floors[order[j].i]++;
  return floors;
}

// ─── Variable Constraints ─────────────────────────────────────────────────────

/**
 * Structured constraints parsed from AI variables.
 * Applied on top of the base weighting math.
 */
export type VariableConstraints = {
  /** Per day-of-week max occupancy % (0–100). 0=Sun … 6=Sat */
  maxOccPctByDow: Partial<Record<number, number>>;
  /** Month/day-specific overrides (year-independent, all occurrences of that date) */
  dateOverrides: {
    month: number;             // 1–12
    day:   number;             // 1–31
    /** ABSZOLÚT kihasználtság % — ha meg van adva, ez felülír mindent (pl. "teltház" = 100, "50% körül" = 50) */
    occPctAbsolute?: number;   // 0–100
    /** TARTOMÁNY — generáláskor seeded random értéket választ from–to között (pl. "90–95%" → 90–95) */
    occPctFrom?: number;       // 0–100, csak ha occPctAbsolute nincs
    occPctTo?: number;         // 0–100, csak ha occPctAbsolute nincs
    /** RELATÍV szorzó az alap fölé — csak ha nincs occPctAbsolute és nincs tartomány */
    occMult?: number;
    /** Abszolút ADR (pl. "30 000 Ft ADR ezen a napon") */
    adrAbsolute?: number;
    /** Relatív ADR szorzó */
    adrMult?: number;
  }[];
};

export const EMPTY_CONSTRAINTS: VariableConstraints = {
  maxOccPctByDow: {},
  dateOverrides:  [],
};

// ─── Guest generation ────────────────────────────────────────────────────────

/**
 * Generates PlanDayBoardType (+ children) records for each plan day.
 * Called automatically after generatePlanDays creates the occupancy rows.
 *
 * Logic per day × room type:
 *  - rooms: proportional split of hotel-level rooms across RTs (occShareMult weighted)
 *  - adults: rooms × adultsPerRoom (rounded with seeded rand for fractional part)
 *  - children: adults × 0.10 ratio (only if hotel has ChildAgeGroups configured)
 *  - board type: hotel's first HotelBoardType (sorted by sortOrder)
 */
async function generateGuestsForPlanDays(
  scenarioId: string,
  hotelId: string,
  dayRoomsMap: Map<string, number>,    // dateKey ("YYYY-MM-DD") → total hotel rooms that day
): Promise<void> {
  if (dayRoomsMap.size === 0) {
    console.log("[generateGuests] SKIP: dayRoomsMap is empty");
    return;
  }
  console.log(`[generateGuests] START: dayRoomsMap.size=${dayRoomsMap.size}, hotelId=${hotelId}`);

  // ── 1. Fetch created PlanDay IDs ──────────────────────────────────────────
  const createdDays = await prisma.planDay.findMany({
    where: { scenarioId },
    select: { id: true, date: true },
  });
  console.log(`[generateGuests] createdDays fetched: ${createdDays.length}`);

  // Use getUTCFullYear/Month/Date to avoid timezone issues
  const toDateKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  const dayIdMap = new Map(createdDays.map(d => [toDateKey(d.date), d.id]));
  // Log first few entries to verify matching
  const sampleRoom = [...dayRoomsMap.keys()].slice(0, 2);
  const sampleDay  = [...dayIdMap.keys()].slice(0, 2);
  console.log(`[generateGuests] sample dayRoomsMap keys: ${JSON.stringify(sampleRoom)}`);
  console.log(`[generateGuests] sample dayIdMap keys:    ${JSON.stringify(sampleDay)}`);

  // ── 2. Room types + weights ───────────────────────────────────────────────
  const roomTypes = await prisma.roomType.findMany({
    where: { hotelId },
    select: { id: true, count: true },
  });
  if (roomTypes.length === 0) return;

  const rtWeights = await prisma.roomTypeWeight.findMany({
    where: { scenarioId },
    select: { roomTypeId: true, occShareMult: true, adultsPerRoom: true },
  });
  const rtWeightMap = new Map(rtWeights.map(w => [w.roomTypeId, w]));

  // ── 3. Active board types + saved shares ─────────────────────────────────
  const hotelBoardTypes = await prisma.hotelBoardType.findMany({
    where: { hotelId },
    orderBy: { sortOrder: "asc" },
    select: { boardType: true },
  });
  const activeBoardTypes = hotelBoardTypes.map(bt => bt.boardType);
  const primaryBoardType = activeBoardTypes[0] ?? "BB"; // fallback if no shares

  // Per-RT board type shares (only active board types)
  const savedShares = await prisma.roomTypeBoardTypeShare.findMany({
    where: { scenarioId, boardType: { in: activeBoardTypes.length > 0 ? activeBoardTypes : ["BB"] } },
    select: { roomTypeId: true, boardType: true, sharePct: true },
  });
  // Map: roomTypeId → { boardType → sharePct }
  const sharesMap = new Map<string, Map<string, number>>();
  for (const s of savedShares) {
    if (!sharesMap.has(s.roomTypeId)) sharesMap.set(s.roomTypeId, new Map());
    sharesMap.get(s.roomTypeId)!.set(s.boardType, s.sharePct);
  }

  // Helper: get normalized shares for a room type → [{ boardType, weight }]
  function getBtWeights(roomTypeId: string): { boardType: string; weight: number }[] {
    const btMap = sharesMap.get(roomTypeId);
    const bts = activeBoardTypes.length > 0 ? activeBoardTypes : [primaryBoardType];
    const weights = bts.map(bt => ({
      boardType: bt,
      weight: btMap?.get(bt) ?? (100 / bts.length), // default: equal
    }));
    const total = weights.reduce((s, w) => s + w.weight, 0);
    return total > 0
      ? weights.map(w => ({ ...w, weight: w.weight / total })) // normalize to [0,1]
      : weights.map((w, i) => ({ ...w, weight: i === 0 ? 1 : 0 }));
  }

  // ── 4. Child age groups ───────────────────────────────────────────────────
  const ageGroups = await prisma.childAgeGroup.findMany({
    where: { hotelId },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  const CHILD_RATIO = 0.10;

  // ── 5. Build board type rows in memory ───────────────────────────────────
  const boardTypeRows: {
    planDayId: string;
    roomTypeId: string;
    boardType: string;
    roomCount: number;
    adultCount: number;
  }[] = [];

  // Track: which (planDayId, roomTypeId) → children count (for age-group child inserts)
  const childMap = new Map<string, number>();  // key = `${planDayId}:${roomTypeId}`
  const dayAggregates = new Map<string, { adults: number; children: number }>();

  for (const [dateKey, roomsToday] of dayRoomsMap) {
    const planDayId = dayIdMap.get(dateKey);
    if (!planDayId || roomsToday === 0) continue;

    // Proportional RT weights for room distribution
    const rtWeightsArr = roomTypes.map(rt => {
      const w = rtWeightMap.get(rt.id);
      return rt.count * (w?.occShareMult ?? 1.0);
    });
    const rtRoomCounts = distributeExact(roomsToday, rtWeightsArr);

    let dayAdults = 0;
    let dayChildren = 0;

    for (let j = 0; j < roomTypes.length; j++) {
      const rt      = roomTypes[j];
      const rtRooms = rtRoomCounts[j];
      if (rtRooms === 0) continue;

      const w             = rtWeightMap.get(rt.id);
      const adultsPerRoom = w?.adultsPerRoom ?? 1.7;

      // Round adults probabilistically (seeded → reproducible)
      const exactAdults = rtRooms * adultsPerRoom;
      const baseAdults  = Math.floor(exactAdults);
      const adults      = baseAdults +
        (seededRand(`${scenarioId}:${dateKey}:${rt.id}:adults`) < (exactAdults - baseAdults) ? 1 : 0);

      // Children: only if hotel has age groups configured
      let children = 0;
      if (ageGroups.length > 0) {
        const exactChildren = adults * CHILD_RATIO;
        const baseChildren  = Math.floor(exactChildren);
        children = baseChildren +
          (seededRand(`${scenarioId}:${dateKey}:${rt.id}:children`) < (exactChildren - baseChildren) ? 1 : 0);
      }

      dayAdults   += adults;
      dayChildren += children;

      // Distribute rooms + adults + children across board types
      const btWeights = getBtWeights(rt.id);
      const btRoomCounts  = distributeExact(rtRooms,  btWeights.map(w => w.weight));
      const btAdultCounts = distributeExact(adults,   btWeights.map(w => w.weight));
      const btChildCounts = children > 0
        ? distributeExact(children, btWeights.map(w => w.weight))
        : btWeights.map(() => 0);

      for (let k = 0; k < btWeights.length; k++) {
        const { boardType } = btWeights[k];
        const btRooms  = btRoomCounts[k];
        const btAdults = btAdultCounts[k];
        const btChild  = btChildCounts[k];
        if (btRooms === 0 && btAdults === 0) continue;
        boardTypeRows.push({ planDayId, roomTypeId: rt.id, boardType, roomCount: btRooms, adultCount: btAdults });
        if (btChild > 0) childMap.set(`${planDayId}:${rt.id}:${boardType}`, btChild);
      }
    }

    dayAggregates.set(planDayId, { adults: dayAdults, children: dayChildren });
  }

  console.log(`[generateGuests] boardTypeRows built: ${boardTypeRows.length}, dayAggregates: ${dayAggregates.size}`);
  if (boardTypeRows.length === 0) {
    console.log("[generateGuests] SKIP: no boardTypeRows to insert");
    return;
  }

  // ── 6. Bulk insert PlanDayBoardType ─────────────────────────────────────
  await prisma.planDayBoardType.createMany({ data: boardTypeRows });
  console.log(`[generateGuests] PlanDayBoardType inserted: ${boardTypeRows.length}`);

  // ── 7. Bulk insert PlanDayBoardTypeChild (if any) ────────────────────────
  if (ageGroups.length > 0 && childMap.size > 0) {
    // Fetch back the inserted rows to get their IDs
    const planDayIds = [...new Set(boardTypeRows.map(r => r.planDayId))];
    const created = await prisma.planDayBoardType.findMany({
      where: { planDayId: { in: planDayIds } },
      select: { id: true, planDayId: true, roomTypeId: true, boardType: true },
    });
    const btIdMap = new Map(created.map(c => [`${c.planDayId}:${c.roomTypeId}:${c.boardType}`, c.id]));

    const childInserts: { planDayBoardTypeId: string; childAgeGroupId: string; count: number }[] = [];
    for (const [key, totalChildren] of childMap) {
      const btId = btIdMap.get(key);
      if (!btId) continue;
      const perGroup = distributeExact(totalChildren, ageGroups.map(() => 1));
      for (let k = 0; k < ageGroups.length; k++) {
        if (perGroup[k] > 0) {
          childInserts.push({ planDayBoardTypeId: btId, childAgeGroupId: ageGroups[k].id, count: perGroup[k] });
        }
      }
    }
    if (childInserts.length > 0) {
      await prisma.planDayBoardTypeChild.createMany({ data: childInserts });
    }
  }

  // ── 8. Update PlanDay adultCount / childCount aggregates ─────────────────
  for (const [planDayId, { adults, children }] of dayAggregates) {
    await prisma.planDay.update({
      where: { id: planDayId },
      data: { adultCount: adults, childCount: children },
    });
  }
}

// ─── Generation ───────────────────────────────────────────────────────────────

export type GeneratedMonthSummary = {
  month: number;
  days: number;
  targetOcc: number;
  targetAdr: number;
  roomNights: number;
  roomRevenue: number;
  fbRevenue: number;
  spaRevenue: number;
  otherRevenue: number;
  actualOccPct: number;
  actualAdr: number;
};

export async function generatePlanDays(
  scenarioId: string,
  constraints: VariableConstraints = EMPTY_CONSTRAINTS,
): Promise<{ count: number; summaries: GeneratedMonthSummary[] }> {
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { months: true, hotel: true },
  });
  if (!scenario?.hotel.totalRooms) return { count: 0, summaries: [] };

  const totalRooms    = scenario.hotel.totalRooms;
  const rawDayWeights = await getDayTypeWeights(scenarioId);
  const dayWeights: Mults[] = rawDayWeights.map(r => ({
    occMult: r.occMult, adrMult: r.adrMult,
    fbMult: r.fbMult, spaMult: r.spaMult, otherMult: r.otherMult,
  }));
  const seasons = await getSeasonWeights(scenarioId);

  await prisma.planDay.deleteMany({ where: { scenarioId } });

  const planDays: {
    scenarioId: string; date: Date;
    occupancyPct: number; adr: number; roomRevenue: number;
    fbRevenue: number; spaRevenue: number; otherRevenue: number;
  }[] = [];

  const summaries: GeneratedMonthSummary[] = [];
  // Collect per-day hotel-level room counts for guest generation
  const allDayRooms = new Map<string, number>(); // dateKey → rooms

  for (const month of scenario.months) {
    if (month.occupancyPct === 0 && month.adr === 0) continue;

    // Build day list
    const days: Date[] = [];
    const d = new Date(Date.UTC(scenario.year, month.month - 1, 1));
    while (d.getUTCMonth() === month.month - 1) {
      days.push(new Date(d));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const N = days.length;

    // Base mults — apply RELATIVE date overrides on top (absolute ones handled separately)
    const multsList = days.map(day => {
      const base = getMultsForDay(day, dayWeights, seasons);
      const m = day.getUTCMonth() + 1;
      const d = day.getUTCDate();
      const override = constraints.dateOverrides.find(o => o.month === m && o.day === d);
      if (!override) return base;
      // occPctAbsolute → nem szorzójuk, azt külön kezeljük; relatív mult-ot csak ha nincs abszolút
      const hasPinnedOcc = override.occPctAbsolute !== undefined || override.occPctFrom !== undefined;
      const relOccMult = hasPinnedOcc ? 1 : (override.occMult ?? 1);
      const relAdrMult = override.adrAbsolute    !== undefined ? 1 : (override.adrMult ?? 1);
      return {
        ...base,
        occMult: base.occMult * relOccMult,
        adrMult: base.adrMult * relAdrMult,
      };
    });

    // ── Pinned days: occPctAbsolute / tartomány → exact room count ───────────
    const pinnedRooms: (number | null)[] = days.map(day => {
      const m = day.getUTCMonth() + 1;
      const d = day.getUTCDate();
      const override = constraints.dateOverrides.find(o => o.month === m && o.day === d);
      if (!override) return null;

      // Abszolút %
      if (override.occPctAbsolute !== undefined) {
        return Math.min(totalRooms, Math.round(override.occPctAbsolute / 100 * totalRooms));
      }

      // Tartomány: seeded random a from–to között (reproducible)
      if (override.occPctFrom !== undefined && override.occPctTo !== undefined) {
        const from = Math.min(override.occPctFrom, override.occPctTo);
        const to   = Math.max(override.occPctFrom, override.occPctTo);
        const ds   = day.toISOString().slice(0, 10);
        const r    = seededRand(`${scenarioId}:${ds}:range`);
        const pct  = from + r * (to - from);
        return Math.min(totalRooms, Math.round(pct / 100 * totalRooms));
      }

      return null;
    });

    // Per-day max room cap (from variable constraints: maxOccPctByDow)
    const maxRoomsPerDay = days.map(day => {
      const dow = day.getUTCDay();
      const maxPct = constraints.maxOccPctByDow[dow];
      return maxPct !== undefined ? Math.floor(totalRooms * maxPct / 100) : totalRooms;
    });

    // ── Seeds for reproducible noise (scenarioId + date string) ──────────────
    const dateKeys = days.map(day => {
      const ds = day.toISOString().slice(0, 10);
      return `${scenarioId}:${ds}`;
    });

    // Target room nights for the whole month
    const targetRoomNights = Math.round(month.occupancyPct / 100 * totalRooms * N);

    // Subtract pinned rooms from target; only free days participate in distribution
    const pinnedTotal = pinnedRooms.reduce<number>((a, r) => a + (r ?? 0), 0);
    const freeTargetRoomNights = Math.max(0, targetRoomNights - pinnedTotal);

    // ── Occ weights + natural noise (±20%) — only for free days ─────────────
    const rawOccWeights = multsList.map((m, i) =>
      pinnedRooms[i] !== null ? 0 : Math.max(0, m.occMult),
    );
    const noisedOccWeights = addNoise(rawOccWeights, 0.20, dateKeys.map(k => k + ":occ"));

    // Distribute remaining rooms across free days
    const freeRoomsPerDay = distributeExact(freeTargetRoomNights, noisedOccWeights);

    // Merge pinned + free, then cap free days (pinned bypass the cap — they're intentional)
    let roomsPerDay = days.map((_, i) =>
      pinnedRooms[i] !== null
        ? Math.min(pinnedRooms[i]!, totalRooms)
        : Math.min(freeRoomsPerDay[i], maxRoomsPerDay[i]),
    );

    // If capping reduced free-day total, redistribute the remainder to uncapped free days
    const actualFreeTotal = roomsPerDay.reduce((a, r, i) => a + (pinnedRooms[i] === null ? r : 0), 0);
    let deficit = freeTargetRoomNights - actualFreeTotal;
    if (deficit > 0) {
      const freeCandidates = roomsPerDay
        .map((r, i) => ({ i, slack: pinnedRooms[i] === null ? maxRoomsPerDay[i] - r : 0 }))
        .filter(x => x.slack > 0)
        .sort((a, b) => b.slack - a.slack);
      for (const { i, slack } of freeCandidates) {
        if (deficit <= 0) break;
        const add = Math.min(deficit, slack);
        roomsPerDay[i] += add;
        deficit -= add;
      }
    }

    // ── ADR: pinned absolute ADR napok + weight-based elosztás a többire ────
    // Először meghatározzuk, melyik napnak van abszolút ADR-je
    const pinnedAdr: (number | null)[] = days.map(day => {
      const m = day.getUTCMonth() + 1;
      const d = day.getUTCDate();
      const override = constraints.dateOverrides.find(o => o.month === m && o.day === d);
      return override?.adrAbsolute !== undefined ? override.adrAbsolute : null;
    });

    const pinnedRevenue = pinnedAdr.reduce<number>((a, adr, i) => a + (adr !== null ? adr * roomsPerDay[i] : 0), 0);
    const freeTargetRevenue = Math.max(0, targetRoomNights * month.adr - pinnedRevenue);

    const rawAdrWeights = multsList.map((m, i) =>
      pinnedAdr[i] !== null ? 0 : roomsPerDay[i] * Math.max(0, m.adrMult),
    );
    const noisedAdrWeights = addNoise(rawAdrWeights, 0.10, dateKeys.map(k => k + ":adr"));
    const freeRevenuePerDay = distributeExact(freeTargetRevenue, noisedAdrWeights);

    const adrPerDay = roomsPerDay.map((r, i) => {
      if (pinnedAdr[i] !== null) return pinnedAdr[i]!;
      return r > 0 ? Math.round(freeRevenuePerDay[i] / r) : 0;
    });

    const roundedRevenues = roomsPerDay.map((r, i) => r * adrPerDay[i]);
    // Absorb rounding error into highest free-day
    const targetRevenue = targetRoomNights * month.adr;
    const revError = targetRevenue - roundedRevenues.reduce((a, b) => a + b, 0);
    if (revError !== 0) {
      const maxFreeIdx = roomsPerDay.reduce(
        (best, r, i) => (pinnedAdr[i] === null && r > (roomsPerDay[best] ?? 0)) ? i : best,
        roomsPerDay.findIndex((_, i) => pinnedAdr[i] === null),
      );
      if (maxFreeIdx >= 0 && roomsPerDay[maxFreeIdx] > 0) {
        roundedRevenues[maxFreeIdx] += revError;
        adrPerDay[maxFreeIdx] = Math.round(roundedRevenues[maxFreeIdx] / roomsPerDay[maxFreeIdx]);
        roundedRevenues[maxFreeIdx] = roomsPerDay[maxFreeIdx] * adrPerDay[maxFreeIdx];
      }
    }

    // ── F&B / Spa / Egyéb = ratio of daily room revenue ──────────────────────
    let sumFb = 0, sumSpa = 0, sumOther = 0;

    for (let i = 0; i < N; i++) {
      const m       = multsList[i];
      const rooms   = roomsPerDay[i];
      const roomRev = roundedRevenues[i];
      // occupancyPct stored as 1-decimal float derived from actual room count
      const occPct  = Math.round((rooms / totalRooms) * 1000) / 10;

      const fb    = Math.round(roomRev * m.fbMult);
      const spa   = Math.round(roomRev * m.spaMult);
      const other = Math.round(roomRev * m.otherMult);

      sumFb    += fb;
      sumSpa   += spa;
      sumOther += other;

      const d2 = days[i];
      const dateKey = `${d2.getUTCFullYear()}-${String(d2.getUTCMonth() + 1).padStart(2, "0")}-${String(d2.getUTCDate()).padStart(2, "0")}`;
      allDayRooms.set(dateKey, rooms);

      planDays.push({
        scenarioId,
        date:         days[i],
        occupancyPct: occPct,
        adr:          adrPerDay[i],
        roomRevenue:  roomRev,
        fbRevenue:    fb,
        spaRevenue:   spa,
        otherRevenue: other,
      });
    }

    // ── Month summary ─────────────────────────────────────────────────────────
    const actualRoomNights = roomsPerDay.reduce((a, b) => a + b, 0);
    const actualRevenue    = roundedRevenues.reduce((a, b) => a + b, 0);
    summaries.push({
      month:        month.month,
      days:         N,
      targetOcc:    month.occupancyPct,
      targetAdr:    month.adr,
      roomNights:   actualRoomNights,
      roomRevenue:  actualRevenue,
      fbRevenue:    sumFb,
      spaRevenue:   sumSpa,
      otherRevenue: sumOther,
      actualOccPct: Math.round((actualRoomNights / (totalRooms * N)) * 1000) / 10,
      actualAdr:    actualRoomNights > 0 ? Math.round(actualRevenue / actualRoomNights) : 0,
    });
  }

  if (!planDays.length) return { count: 0, summaries: [] };
  await prisma.planDay.createMany({ data: planDays });

  // Generate guest data (adults, children per room type per day)
  // NOTE: errors here propagate intentionally so we see them in the route response
  await generateGuestsForPlanDays(scenarioId, scenario.hotel.id, allDayRooms);

  return { count: planDays.length, summaries };
}
