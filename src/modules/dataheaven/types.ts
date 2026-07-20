/** DataHeaven view-model types + formatters (mirrors data.katonazoli.hu). */

export type SegmentSeries = {
  code: string;
  name: string;
  color: string;
  revenue: (number | null)[];
  rooms: (number | null)[];
};

export type Dataset = {
  hotelName: string;
  months: string[];
  totalRevenue: (number | null)[];
  totalRooms: (number | null)[];
  occ: (number | null)[];
  segments: SegmentSeries[];
  availableRoomNights?: number | null;
  availSource?: "rooms" | "occ" | null;
};

export type DatasetCompare = {
  year: number;
  months: number[];
  totalRevenue: number;
  totalRooms: number;
  avgOcc: number | null;
  availableRoomNights: number | null;
  revenueByCode: Record<string, number>;
};

export type NationalityYear = {
  hotelName: string;
  year: number;
  months: number[];
  totalNights: number;
  domesticNights: number;
  foreignNights: number;
  countries: { code: string; name: string; isDomestic: boolean; nights: number; guests: number; arrivals: number }[];
};

export type NationalityCompare = {
  year: number;
  months: number[];
  totalNights: number;
  domesticNights: number;
  foreignNights: number;
  nightsByCode: Record<string, number>;
};

export type ChannelRow = {
  channel: string;
  isDirect: boolean;
  booking: number;
  bookingDelta: number | null;
  revenue: number;
  revenueDelta: number | null;
  roomNights: number | null;
  roomNightsDelta: number | null;
  roomRevenue: number | null;
  avgBasketDelta: number | null;
};

export type ChannelSummary = {
  booking: number;
  bookingDelta: number | null;
  revenue: number;
  revenueDelta: number | null;
  avgBasket: number | null;
  avgBasketDelta: number | null;
  roomNights: number;
  roomNightsDelta: number | null;
  roomRevenue: number;
};

export type ChannelPeriod = {
  hotelName: string;
  label: string;
  compareLabel: string;
  directChannel: string;
  rows: ChannelRow[];
  summary?: ChannelSummary;
};

export type ChannelMonthly = {
  months: number[];
  labels: string[];
  direct: number[];
  ota: number[];
  prevTotal: (number | null)[];
  prevYear: number;
};

export type ChannelData = {
  months: number[];
  mFrom: number;
  mTo: number;
  period: ChannelPeriod;
  monthly: ChannelMonthly;
};

export type ManagerMetricVal = { monthly: number | null; ytd: number | null };

export type ManagerData = {
  hotelName: string;
  year: number;
  months: number[];
  mFrom: number;
  mTo: number;
  ytdMonth: number;
  values: Record<string, ManagerMetricVal>;
  prev: Record<string, ManagerMetricVal> | null;
  prevMonths: number[];
  prevYear: number;
  trend: {
    months: number[];
    labels: string[];
    series: Record<string, (number | null)[]>;
    prevSeries: Record<string, (number | null)[]>;
  };
};

export type MetricsBundle = {
  hotel: { id: string; name: string; pms: string; roomCount: number | null };
  years: number[];
  year: number;
  manager?: ManagerData | null;
  segments: Dataset | null;
  salesChannels: Dataset | null;
  nationality: NationalityYear | null;
  channel: ChannelData | null;
  segmentsCompare?: DatasetCompare | null;
  salesChannelsCompare?: DatasetCompare | null;
  nationalityCompare?: NationalityCompare | null;
  isAdmin?: boolean;
};

export const avgBasket = (r: ChannelRow) => (r.booking ? r.revenue / r.booking : 0);

export const prevOf = (current: number, deltaPct: number | null): number | null => {
  if (deltaPct == null) return null;
  const f = 1 + deltaPct / 100;
  return f > 0 ? current / f : null;
};

export function formatHuf(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(n) + " Ft";
}

export function formatPct(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(ratio * 100) + " %";
}
