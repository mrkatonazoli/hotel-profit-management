import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveHotel } from "@/lib/get-hotel";

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

type Ctx = { params: Promise<{ scenarioId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scenarioId } = await params;

  const hotelBase = await getActiveHotel();
  if (!hotelBase) return NextResponse.json({ error: "No hotel" }, { status: 404 });

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelBase.id },
    select: { totalRooms: true },
  });

  const [scenario, segments] = await Promise.all([
    prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: { months: true },
    }),
    prisma.scenarioSegment.findMany({
      where: { scenarioId },
      include: {
        monthShares: true,
        channelMix: { include: { distributor: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalRooms = hotel?.totalRooms ?? 0;
  const hasChannels = segments.some(s => s.channelMix.length > 0);

  // ─── Havi csatorna bontás számítása ─────────────────────────────────────────

  const months = Array.from({ length: 12 }, (_, mi) => {
    const m = mi + 1;
    const sm = scenario.months.find(x => x.month === m);
    if (!sm || (sm.occupancyPct === 0 && sm.adr === 0)) {
      return { month: m, roomRevenue: 0, roomNights: 0, occupancyPct: 0, adr: 0, channels: [], segments: [], totalCommission: 0, netRevenue: 0 };
    }

    const days = DAYS_IN_MONTH[mi];
    const roomNights = totalRooms > 0 ? Math.round((sm.occupancyPct / 100) * totalRooms * days) : 0;
    const roomRevenue = roomNights * sm.adr;

    // Szegmens bontás (nem csatorna szintű)
    const segBreakdown: { id: string; name: string; color: string; sharePct: number; revenue: number; commission: number }[] = [];

    // Csatorna aggregáció (minden szegmensből összesítve)
    const channelMap = new Map<string, {
      name: string; isCommission: boolean; commissionPct: number;
      revenue: number; commission: number;
    }>();

    for (const seg of segments) {
      const segSharePct = seg.monthShares.find(ms => ms.month === m)?.sharePct ?? 0;
      if (segSharePct === 0) continue;

      const segRev = roomRevenue * (segSharePct / 100);

      // Csatorna mix: havi bontás ha van, egyébként éves
      const annualChannels = seg.channelMix.filter(c => c.month === null);
      const monthChannels  = seg.channelMix.filter(c => c.month === m);
      const channels       = monthChannels.length > 0 ? monthChannels : annualChannels;

      let segComm = 0;

      if (channels.length > 0 && seg.useChannelMix) {
        for (const ch of channels) {
          const chRev  = segRev * (ch.sharePct / 100);
          const chComm = ch.distributor.isCommission ? chRev * (ch.distributor.commissionPct / 100) : 0;
          segComm += chComm;

          const existing = channelMap.get(ch.distributorId);
          if (existing) {
            existing.revenue   += chRev;
            existing.commission += chComm;
          } else {
            channelMap.set(ch.distributorId, {
              name:          ch.distributor.name,
              isCommission:  ch.distributor.isCommission,
              commissionPct: ch.distributor.commissionPct,
              revenue:       chRev,
              commission:    chComm,
            });
          }
        }
      } else if (!seg.useChannelMix && seg.commissionPct > 0) {
        // Fix jutalék — csatorna mix nélkül
        segComm = segRev * (seg.commissionPct / 100);
        const key = `__fixed__${seg.id}`;
        const existing = channelMap.get(key);
        if (existing) {
          existing.revenue   += segRev;
          existing.commission += segComm;
        } else {
          channelMap.set(key, {
            name:          `${seg.name} (fix jut.)`,
            isCommission:  true,
            commissionPct: seg.commissionPct,
            revenue:       segRev,
            commission:    segComm,
          });
        }
      }

      segBreakdown.push({
        id:        seg.id,
        name:      seg.name,
        color:     seg.color,
        sharePct:  segSharePct,
        revenue:   Math.round(segRev),
        commission: Math.round(segComm),
      });
    }

    const channelList = Array.from(channelMap.entries())
      .map(([id, v]) => ({
        id,
        name:          v.name,
        isCommission:  v.isCommission,
        commissionPct: v.commissionPct,
        revenue:       Math.round(v.revenue),
        commission:    Math.round(v.commission),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalCommission = channelList.reduce((s, c) => s + c.commission, 0);

    return {
      month: m,
      roomRevenue,
      roomNights,
      occupancyPct: sm.occupancyPct,
      adr:          sm.adr,
      channels:     channelList,
      segments:     segBreakdown,
      totalCommission,
      netRevenue: roomRevenue - totalCommission,
    };
  });

  // ─── Egyedi csatornák listája (header-hez) ───────────────────────────────────

  const allChannels = new Map<string, { name: string; isCommission: boolean; commissionPct: number }>();
  for (const m of months) {
    for (const c of m.channels) {
      if (!allChannels.has(c.id)) {
        allChannels.set(c.id, { name: c.name, isCommission: c.isCommission, commissionPct: c.commissionPct });
      }
    }
  }

  return NextResponse.json({
    months,
    channels: Array.from(allChannels.entries()).map(([id, v]) => ({ id, ...v })),
    hasSegments: segments.length > 0,
    hasChannels,
  });
}
