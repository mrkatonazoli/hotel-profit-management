/**
 * seed-guests.mjs
 * Seeds realistic guest data (PlanDayBoardType + PlanDayBoardTypeChild) for 2026.
 * Run: cd app && node --env-file=.env scripts/seed-guests.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// ─── DB CLIENT ───────────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool, { schema: undefined });
const prisma = new PrismaClient({ adapter });

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getSeason(month) {
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'fall';
}

function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...5=Fri, 6=Sat
  return day === 5 || day === 6; // Fri or Sat
}

// Seasonal base board type distributions
const SEASON_BOARD_DIST = {
  winter: { HB: 0.35, FB: 0.30, BB: 0.20, AI: 0.10, RO: 0.05 },
  spring: { BB: 0.30, HB: 0.30, FB: 0.20, AI: 0.15, RO: 0.05 },
  summer: { AI: 0.35, BB: 0.25, HB: 0.20, FB: 0.15, RO: 0.05 },
  fall:   { BB: 0.30, HB: 0.30, FB: 0.20, AI: 0.15, RO: 0.05 },
};

// Room type adjustments relative to base distribution (delta on AI, FB, BB, RO)
// Standard: -5% AI, -5% FB, +10% BB/RO (split evenly)
// Deluxe:   +15% AI, +10% FB, -15% BB/RO (split evenly)
// Superior: no adjustment
function adjustDist(baseDist, roomTypeName) {
  const dist = { ...baseDist };
  const name = roomTypeName.toLowerCase();

  if (name.includes('standard')) {
    dist.AI = (dist.AI || 0) - 0.05;
    dist.FB = (dist.FB || 0) - 0.05;
    dist.BB = (dist.BB || 0) + 0.05;
    dist.RO = (dist.RO || 0) + 0.05;
  } else if (name.includes('deluxe') || name.includes('apart')) {
    dist.AI = (dist.AI || 0) + 0.15;
    dist.FB = (dist.FB || 0) + 0.10;
    dist.BB = (dist.BB || 0) - 0.10;
    dist.RO = (dist.RO || 0) - 0.05;
    // Clamp negatives
    for (const k of Object.keys(dist)) {
      if (dist[k] < 0) dist[k] = 0;
    }
  }

  // Normalize to sum = 1.0
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(dist)) {
    dist[k] = dist[k] / total;
  }
  return dist;
}

// Adults per room by room type category
function getAdultsPerRoom(roomTypeName) {
  const name = roomTypeName.toLowerCase();
  if (name.includes('standard')) return 1.7;
  if (name.includes('deluxe') || name.includes('apart')) return 2.1;
  return 1.9; // superior
}

// Children ratio by room type category and season
function getChildrenRatio(roomTypeName, season, weekend) {
  const name = roomTypeName.toLowerCase();
  let ratio;
  if (name.includes('standard')) {
    ratio = { winter: 0.03, spring: 0.10, summer: 0.20, fall: 0.08 }[season];
  } else if (name.includes('deluxe') || name.includes('apart')) {
    ratio = { winter: 0.08, spring: 0.18, summer: 0.35, fall: 0.15 }[season];
  } else {
    ratio = { winter: 0.05, spring: 0.12, summer: 0.25, fall: 0.10 }[season];
  }
  if (weekend) ratio = Math.min(ratio * 1.10, 0.60);
  return ratio;
}

// Child age group distribution (3 groups: youngest -> oldest by sortOrder)
// Baba 25%, Kisgyermek 40%, Junior 35%
const CHILD_GROUP_DIST = [0.25, 0.40, 0.35];

function distributeRooms(totalRooms, dist, boardTypes) {
  // Only distribute across board types that exist for the hotel
  const activeCodes = boardTypes.map(bt => bt.boardType);
  const filteredDist = {};
  let filteredTotal = 0;
  for (const code of activeCodes) {
    if (dist[code] !== undefined) {
      filteredDist[code] = dist[code];
      filteredTotal += dist[code];
    }
  }
  // Normalize
  if (filteredTotal === 0) return {};
  for (const k of Object.keys(filteredDist)) {
    filteredDist[k] = filteredDist[k] / filteredTotal;
  }

  // Distribute rooms, ensuring integer counts and using remainder logic
  const result = {};
  let remaining = totalRooms;
  const codes = Object.keys(filteredDist);

  for (let i = 0; i < codes.length - 1; i++) {
    const rooms = Math.round(filteredDist[codes[i]] * totalRooms);
    result[codes[i]] = rooms;
    remaining -= rooms;
  }
  // Last code gets the remainder to avoid rounding drift
  if (codes.length > 0) {
    result[codes[codes.length - 1]] = Math.max(0, remaining);
  }
  return result;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching reference data...');

  const roomTypes = await prisma.roomType.findMany({
    orderBy: { name: 'asc' },
  });
  console.log(`Found ${roomTypes.length} room types:`, roomTypes.map(r => `${r.name} (${r.count})`).join(', '));

  const baseScenario = await prisma.scenario.findFirst({
    where: { isBase: true, year: 2026 },
  });
  if (!baseScenario) {
    // Try any scenario for 2026
    const anyScenario = await prisma.scenario.findFirst({
      where: { year: 2026 },
    });
    if (!anyScenario) throw new Error('No 2026 scenario found in DB.');
    console.warn('No base scenario for 2026, using:', anyScenario.name);
  }
  const scenario = baseScenario ?? await prisma.scenario.findFirst({ where: { year: 2026 } });
  console.log(`Using scenario: "${scenario.name}" (id: ${scenario.id})`);

  const childAgeGroups = await prisma.childAgeGroup.findMany({
    where: { hotelId: scenario.hotelId },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`Found ${childAgeGroups.length} child age groups:`, childAgeGroups.map(g => g.name).join(', '));

  const hotelBoardTypes = await prisma.hotelBoardType.findMany({
    where: { hotelId: scenario.hotelId },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`Found ${hotelBoardTypes.length} board types:`, hotelBoardTypes.map(b => b.boardType).join(', '));

  const roomTypeWeights = await prisma.roomTypeWeight.findMany({
    where: { scenarioId: scenario.id },
  });
  const weightMap = {};
  for (const w of roomTypeWeights) {
    weightMap[w.roomTypeId] = w.occShareMult;
  }

  // Fetch all plan days for the scenario
  const planDays = await prisma.planDay.findMany({
    where: { scenarioId: scenario.id },
    orderBy: { date: 'asc' },
  });
  console.log(`Found ${planDays.length} plan days to process.`);

  if (planDays.length === 0) {
    console.log('No plan days found. Nothing to seed.');
    return;
  }

  // ─── CLEAR EXISTING DATA ─────────────────────────────────────────────────

  console.log('Clearing existing PlanDayBoardType data for these plan days...');
  const planDayIds = planDays.map(d => d.id);

  // Delete children first (cascade should handle it but being explicit)
  await prisma.planDayBoardTypeChild.deleteMany({
    where: {
      planDayBoardType: {
        planDayId: { in: planDayIds },
      },
    },
  });
  await prisma.planDayBoardType.deleteMany({
    where: { planDayId: { in: planDayIds } },
  });
  console.log('Existing board type rows cleared.');

  // ─── SEED ─────────────────────────────────────────────────────────────────

  let totalAdults = 0;
  let totalChildren = 0;
  let daysSeeded = 0;
  const roomTypeTotals = {};
  for (const rt of roomTypes) {
    roomTypeTotals[rt.id] = { name: rt.name, adults: 0, children: 0, rooms: 0 };
  }

  // Batch inserts for performance
  const BATCH_SIZE = 30;

  for (let batchStart = 0; batchStart < planDays.length; batchStart += BATCH_SIZE) {
    const batch = planDays.slice(batchStart, batchStart + BATCH_SIZE);

    for (const planDay of batch) {
      const date = new Date(planDay.date);
      const month = date.getMonth() + 1;
      const season = getSeason(month);
      const weekend = isWeekend(date);

      const boardTypeRowsToCreate = [];
      const childRowsToCreate = []; // { planDayBoardTypeId (placeholder), childAgeGroupId, count, boardTypeKey }

      let dayAdults = 0;
      let dayChildren = 0;

      // Track which planDayBoardType records we create, keyed by "roomTypeId-boardType"
      const createdBoardTypeMap = {};

      for (const roomType of roomTypes) {
        const occShareMult = weightMap[roomType.id] ?? 1.0;

        // Room nights for this room type on this day
        let roomNights = Math.round((planDay.occupancyPct / 100) * roomType.count * occShareMult);
        roomNights = Math.max(0, roomNights);

        if (roomNights === 0) continue;

        // Get board type distribution for this room type + season
        const baseDist = SEASON_BOARD_DIST[season];
        const adjustedDist = adjustDist(baseDist, roomType.name);

        // Distribute rooms across board types
        const roomsByBoardType = distributeRooms(roomNights, adjustedDist, hotelBoardTypes);

        const adultsPerRoom = getAdultsPerRoom(roomType.name);
        const childrenRatio = getChildrenRatio(roomType.name, season, weekend);

        for (const [boardCode, rooms] of Object.entries(roomsByBoardType)) {
          if (rooms <= 0) continue;

          const adults = Math.max(rooms, Math.round(rooms * adultsPerRoom));

          // Total guests (adults + children) based on children ratio
          // childrenRatio = children / (adults + children) => children = adults * childrenRatio / (1 - childrenRatio)
          const childrenTotal = Math.round(adults * childrenRatio / (1 - childrenRatio));

          dayAdults += adults;
          dayChildren += childrenTotal;
          roomTypeTotals[roomType.id].adults += adults;
          roomTypeTotals[roomType.id].children += childrenTotal;
          roomTypeTotals[roomType.id].rooms += rooms;

          boardTypeRowsToCreate.push({
            planDayId: planDay.id,
            roomTypeId: roomType.id,
            boardType: boardCode,
            roomCount: rooms,
            adultCount: adults,
            // childCounts created separately after we have the IDs
            _childrenTotal: childrenTotal,
            _key: `${roomType.id}-${boardCode}`,
          });
        }
      }

      // Insert all board type rows for this day
      for (const row of boardTypeRowsToCreate) {
        const childrenTotal = row._childrenTotal;
        const key = row._key;
        delete row._childrenTotal;
        delete row._key;

        const created = await prisma.planDayBoardType.create({ data: row });
        createdBoardTypeMap[key] = { id: created.id, childrenTotal };
      }

      // Insert children rows
      if (childAgeGroups.length > 0) {
        const childInserts = [];
        for (const [key, { id: planDayBoardTypeId, childrenTotal }] of Object.entries(createdBoardTypeMap)) {
          if (childrenTotal <= 0 || childAgeGroups.length === 0) continue;

          // Distribute children across age groups
          let remainingChildren = childrenTotal;
          for (let gi = 0; gi < childAgeGroups.length; gi++) {
            const group = childAgeGroups[gi];
            const pct = CHILD_GROUP_DIST[gi] ?? (1 / childAgeGroups.length);
            let count;
            if (gi === childAgeGroups.length - 1) {
              count = remainingChildren;
            } else {
              count = Math.round(childrenTotal * pct);
              remainingChildren -= count;
            }
            if (count < 0) count = 0;

            childInserts.push({
              planDayBoardTypeId,
              childAgeGroupId: group.id,
              count,
            });
          }
        }

        if (childInserts.length > 0) {
          await prisma.planDayBoardTypeChild.createMany({ data: childInserts });
        }
      }

      // Update PlanDay summary counts
      await prisma.planDay.update({
        where: { id: planDay.id },
        data: { adultCount: dayAdults, childCount: dayChildren },
      });

      totalAdults += dayAdults;
      totalChildren += dayChildren;
      daysSeeded++;
    }

    const progress = Math.min(batchStart + BATCH_SIZE, planDays.length);
    console.log(`  Progress: ${progress}/${planDays.length} days processed...`);
  }

  // ─── RESULTS ─────────────────────────────────────────────────────────────

  console.log('\n========== SEEDING COMPLETE ==========');
  console.log(`Days seeded:    ${daysSeeded}`);
  console.log(`Total adults:   ${totalAdults.toLocaleString()}`);
  console.log(`Total children: ${totalChildren.toLocaleString()}`);
  console.log('\nBreakdown by room type:');
  for (const [rtId, data] of Object.entries(roomTypeTotals)) {
    if (data.rooms === 0) continue;
    console.log(`  ${data.name}: ${data.rooms.toLocaleString()} room nights, ${data.adults.toLocaleString()} adults, ${data.children.toLocaleString()} children`);
  }
  console.log('======================================\n');
}

main()
  .catch(err => {
    console.error('Seed script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
