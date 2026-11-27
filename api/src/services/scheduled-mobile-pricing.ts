import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

/** One local-time pricing window. Days use ISO weekday numbers (Monday = 1). */
export type MobilePriceWindow = {
  days: readonly number[];
  startMinute: number;
  endMinute: number;
  startDate?: string | null;
  endDate?: string | null;
};

export function weekdayMaskToDays(mask: number): number[] {
  return Array.from({ length: 7 }, (_, index) => index + 1)
    .filter((day) => (mask & (1 << (day - 1))) !== 0);
}

export type ScheduledMobilePrice = {
  scheduleId: number;
  menuItemId: number;
  priceRm: string;
  priceTokens: number;
};

/** Resolves all active prices at one instant; never silently picks an overlap. */
export async function loadScheduledMobilePrices(
  connection: Pick<PoolConnection, 'query'>,
  storeId: number,
  now: Date
): Promise<Map<number, ScheduledMobilePrice>> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT p.id, p.menu_item_id, p.weekday_mask, p.start_minute, p.end_minute,
            DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(p.end_date, '%Y-%m-%d') AS end_date,
            CAST(p.price_rm AS CHAR) AS price_rm, p.price_tokens, s.timezone
       FROM mobile_price_schedules p
       JOIN stores s ON s.id = p.store_id AND s.tenant_id = p.tenant_id
       JOIN menu_item_tenants mt ON mt.menu_item_id = p.menu_item_id AND mt.tenant_id = p.tenant_id
      WHERE p.store_id = :storeId AND p.is_active = 1`,
    { storeId }
  );
  const prices = new Map<number, ScheduledMobilePrice>();
  for (const row of rows) {
    if (!isMobilePriceWindowActive({
      days: weekdayMaskToDays(Number(row.weekday_mask)),
      startMinute: Number(row.start_minute), endMinute: Number(row.end_minute),
      startDate: row.start_date, endDate: row.end_date
    }, now, String(row.timezone || 'Asia/Kuala_Lumpur'))) continue;
    const menuItemId = Number(row.menu_item_id);
    if (prices.has(menuItemId)) throw new Error('Overlapping mobile price schedules');
    prices.set(menuItemId, { scheduleId: Number(row.id), menuItemId,
      priceRm: String(row.price_rm), priceTokens: Number(row.price_tokens) });
  }
  return prices;
}

/** Detect recurring overlap, including overnight windows and finite date ranges. */
export function mobilePriceWindowsOverlap(a: MobilePriceWindow, b: MobilePriceWindow): boolean {
  type Segment = { day: number; start: number; end: number; first: number; last: number };
  const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
  const intervals = (window: MobilePriceWindow): Segment[] => {
    const result: Segment[] = [];
    if (window.startMinute === window.endMinute) return result;
    const first = window.startDate ? dayNumber(window.startDate) : -100000000;
    const last = window.endDate ? dayNumber(window.endDate) : 100000000;
    for (const day of window.days) {
      if (window.endMinute > window.startMinute) {
        result.push({ day, start: window.startMinute, end: window.endMinute, first, last });
      } else {
        result.push({ day, start: window.startMinute, end: 1440, first, last });
        if (window.endMinute > 0) result.push({ day: day === 7 ? 1 : day + 1,
          start: 0, end: window.endMinute, first: first + 1, last: last + 1 });
      }
    }
    return result;
  };
  return intervals(a).some((left) => intervals(b).some((right) => {
    if (left.day !== right.day || left.start >= right.end || right.start >= left.end) return false;
    const first = Math.max(left.first, right.first);
    const last = Math.min(left.last, right.last);
    // 1970-01-01 (day zero) was Thursday, ISO weekday 4.
    const firstWeekday = ((first + 3) % 7 + 7) % 7 + 1;
    const matchingDay = first + ((left.day - firstWeekday + 7) % 7);
    return matchingDay <= last;
  }));
}

type LocalTime = { date: string; weekday: number; minute: number };

function localTimeAt(now: Date, timeZone: string): LocalTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  return { date, weekday, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Start inclusive, end exclusive. Overnight windows belong to their start day. */
export function isMobilePriceWindowActive(window: MobilePriceWindow, now: Date, timeZone: string): boolean {
  const local = localTimeAt(now, timeZone);
  let date = local.date;
  let weekday = local.weekday;
  if (window.startMinute === window.endMinute) return false;
  if (window.endMinute < window.startMinute && local.minute < window.endMinute) {
    const previous = new Date(`${date}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    date = previous.toISOString().slice(0, 10);
    weekday = weekday === 1 ? 7 : weekday - 1;
  } else if (local.minute < window.startMinute ||
      (window.endMinute > window.startMinute && local.minute >= window.endMinute)) {
    return false;
  }
  return window.days.includes(weekday) &&
    (!window.startDate || date >= window.startDate) &&
    (!window.endDate || date <= window.endDate);
}

export type VoucherPriceLine = {
  specialPriceActive: boolean;
  quantity: number;
  basePriceRm: number;
  modifierRm: number;
  tokenPrice: number;
  modifierTokens: number;
};

/** Only ordinary-priced lines contribute to the voucher's discountable amount. */
export function voucherEligibleTotals(lines: readonly VoucherPriceLine[]): { rm: number; tokens: number } {
  let cents = 0;
  let tokens = 0;
  for (const line of lines) {
    if (line.specialPriceActive) continue;
    cents += Math.round((line.basePriceRm + line.modifierRm) * 100) * line.quantity;
    tokens += Math.max(0, line.tokenPrice + line.modifierTokens) * line.quantity;
  }
  return { rm: Math.max(0, cents) / 100, tokens };
}

export function scheduledPriceVoucherDiscount(
  eligible: { rm: number; tokens: number },
  mode: 'fixed_rm' | 'percent_rm' | 'fixed_token',
  value: number,
  tokenCheckout: boolean
): { rm: number; tokens: number } {
  const safeValue = Math.max(0, value);
  if (mode === 'fixed_token') {
    return { rm: 0, tokens: Math.min(eligible.tokens, Math.floor(safeValue)) };
  }
  const rawRm = mode === 'fixed_rm' ? safeValue : eligible.rm * Math.min(100, safeValue) / 100;
  const rm = Math.min(eligible.rm, rawRm);
  const tokens = tokenCheckout && eligible.rm > 0
    ? Math.min(eligible.tokens, Math.round(eligible.tokens * rm / eligible.rm))
    : 0;
  return { rm, tokens };
}
