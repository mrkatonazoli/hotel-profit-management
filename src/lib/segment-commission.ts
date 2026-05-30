/**
 * Szegmens effektív komisszió ráta számítás
 *
 * Prioritás:
 * 1. useChannelMix = true  → a szegmenshez rendelt csatornák mix alapján
 * 2. commissionPct > 0     → fix szegmens jutalék%
 * 3. fallback              → hotel-szintű csatornák átlaga (szegmens-tag szerint szűrve,
 *                            ha nincs tag egyezés → összes jutalékos csatorna átlaga)
 */

type SegmentChannelEntry = {
  month: number | null;
  sharePct: number;
  distributor: { isCommission: boolean; commissionPct: number };
};

type HotelDistributor = {
  isCommission: boolean;
  commissionPct: number;
  segmentTags: string; // vesszővel elválasztott szegmensnevek
};

export function calcEffectiveCommPct(
  seg: {
    name: string;
    useChannelMix: boolean;
    commissionPct: number;
    channelMix: SegmentChannelEntry[];
  },
  month: number,
  hotelDistributors: HotelDistributor[],
): number {
  // 1. Csatorna mix alapján
  if (seg.useChannelMix) {
    const annualCh = seg.channelMix.filter(c => c.month === null);
    const monthCh  = seg.channelMix.filter(c => c.month === month);
    const channels = monthCh.length > 0 ? monthCh : annualCh;
    if (channels.length > 0) {
      return channels.reduce((s, c) =>
        s + (c.sharePct / 100) * (c.distributor.isCommission ? c.distributor.commissionPct : 0), 0,
      );
    }
    // useChannelMix=true de nincs hozzárendelt csatorna → fallback-re esik
  }

  // 2. Fix szegmens jutalék%
  if (seg.commissionPct > 0) return seg.commissionPct;

  // 3. Fallback: hotel csatornák szegmens-tag szerinti szűrés
  const commDists = hotelDistributors.filter(d => d.isCommission && d.commissionPct > 0);
  if (commDists.length === 0) return 0;

  const tagged = commDists.filter(d =>
    d.segmentTags.split(",").map(t => t.trim().toLowerCase()).includes(seg.name.toLowerCase()),
  );
  const pool = tagged.length > 0 ? tagged : commDists;

  // Egyszerű átlag (nincs csatorna-mix adat → egyenlő súly)
  return pool.reduce((s, d) => s + d.commissionPct, 0) / pool.length;
}

/**
 * Havi effektív komisszió ráta számítás (0.0–1.0 arány)
 * Σ(szegmensArány × szegmensKomissziópct) / 100
 */
export function calcMonthlyCommissionRate(
  segments: Array<{
    name: string;
    useChannelMix: boolean;
    commissionPct: number;
    channelMix: SegmentChannelEntry[];
    monthShares: Array<{ month: number; sharePct: number }>;
  }>,
  month: number,
  hotelDistributors: HotelDistributor[],
): number {
  let rate = 0;
  for (const seg of segments) {
    const segShare = (seg.monthShares.find(m => m.month === month)?.sharePct ?? 0) / 100;
    if (segShare === 0) continue;
    const commPct = calcEffectiveCommPct(seg, month, hotelDistributors);
    rate += segShare * commPct;
  }
  return rate / 100; // → 0.0–1.0
}
