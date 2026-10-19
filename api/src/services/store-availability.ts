export type StoreDayHours = {
  closed: boolean;
  open: string;
  close: string;
};

export type StoreWeeklyHours = Record<string, StoreDayHours>;

const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const MOBILE_ORDER_CUTOFF_MINUTES = 10;

type StoreAvailabilityInput = {
  status: string;
  temporarily_closed?: number | boolean | null;
  timezone?: string | null;
  weekly_hours_json?: unknown;
};

function parseMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function normalizeWeeklyHours(value: unknown): StoreWeeklyHours | null {
  if (value == null || value === '') return null;
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return null; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const result: StoreWeeklyHours = {};
  for (const key of dayKeys) {
    const entry = (parsed as Record<string, unknown>)[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const candidate = entry as Record<string, unknown>;
    const closed = candidate.closed === true;
    const open = String(candidate.open ?? '');
    const close = String(candidate.close ?? '');
    if (!closed && (parseMinutes(open) == null || parseMinutes(close) == null || open === close)) return null;
    result[key] = { closed, open: closed ? '' : open, close: closed ? '' : close };
  }
  return result;
}

function zonedParts(now: Date, timezone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const weekdayText = parts.find((part) => part.type === 'weekday')?.value.toLowerCase().slice(0, 3) ?? 'sun';
  const weekday = dayKeys.indexOf(weekdayText as typeof dayKeys[number]);
  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const seconds = Number(parts.find((part) => part.type === 'second')?.value ?? 0);
  return {
    weekday: weekday < 0 ? 0 : weekday,
    minutes: hours * 60 + minutes + seconds / 60,
  };
}

type TradingWindow = {
  currentMinute: number;
  closingMinute: number;
};

function resolveCurrentTradingWindow(
  schedule: StoreWeeklyHours,
  now: Date,
  timezone: string,
): TradingWindow | null {
  const { weekday, minutes } = zonedParts(now, timezone);
  const today = schedule[dayKeys[weekday]];
  if (!today.closed) {
    const open = parseMinutes(today.open)!;
    const close = parseMinutes(today.close)!;
    if (close > open && minutes >= open && minutes < close) {
      return { currentMinute: minutes, closingMinute: close };
    }
    if (close < open && minutes >= open) {
      return { currentMinute: minutes, closingMinute: 24 * 60 + close };
    }
  }

  const previous = schedule[dayKeys[(weekday + 6) % 7]];
  if (!previous.closed) {
    const previousOpen = parseMinutes(previous.open)!;
    const previousClose = parseMinutes(previous.close)!;
    if (previousClose < previousOpen && minutes < previousClose) {
      return {
        currentMinute: 24 * 60 + minutes,
        closingMinute: 24 * 60 + previousClose,
      };
    }
  }
  return null;
}

function isStoreWithinTradingHours(
  input: StoreAvailabilityInput,
  now: Date,
  closingOffsetMinutes: number,
): boolean {
  if (input.status !== 'active' || Boolean(input.temporarily_closed)) return false;
  const schedule = normalizeWeeklyHours(input.weekly_hours_json);
  if (!schedule) return true;
  const window = resolveCurrentTradingWindow(
    schedule,
    now,
    input.timezone || 'Asia/Kuala_Lumpur',
  );
  return window !== null &&
    window.currentMinute < window.closingMinute - closingOffsetMinutes;
}

export function isStoreTradingNow(
  input: StoreAvailabilityInput,
  now = new Date(),
): boolean {
  return isStoreWithinTradingHours(input, now, 0);
}

export function isStoreOpenNow(input: {
  status: string;
  supports_pickup: number | boolean;
  temporarily_closed?: number | boolean | null;
  timezone?: string | null;
  weekly_hours_json?: unknown;
}, now = new Date()): boolean {
  return Boolean(input.supports_pickup) && isStoreTradingNow(input, now);
}

export function isStoreAcceptingMobileOrdersNow(input: {
  status: string;
  supports_pickup: number | boolean;
  temporarily_closed?: number | boolean | null;
  timezone?: string | null;
  weekly_hours_json?: unknown;
}, now = new Date()): boolean {
  return Boolean(input.supports_pickup) && isStoreWithinTradingHours(
    input,
    now,
    MOBILE_ORDER_CUTOFF_MINUTES,
  );
}

export type MobileOrderingStatus = {
  status: 'open' | 'closing_soon' | 'closed';
  cutoffAt: string | null;
};

export function getMobileOrderingStatus(input: {
  status: string;
  supports_pickup: number | boolean;
  temporarily_closed?: number | boolean | null;
  timezone?: string | null;
  weekly_hours_json?: unknown;
}, now = new Date()): MobileOrderingStatus {
  if (
    input.status !== 'active' ||
    !Boolean(input.supports_pickup) ||
    Boolean(input.temporarily_closed)
  ) {
    return { status: 'closed', cutoffAt: null };
  }

  const schedule = normalizeWeeklyHours(input.weekly_hours_json);
  if (!schedule) return { status: 'open', cutoffAt: null };

  const window = resolveCurrentTradingWindow(
    schedule,
    now,
    input.timezone || 'Asia/Kuala_Lumpur',
  );
  if (!window) return { status: 'closed', cutoffAt: null };

  const secondsUntilCutoff = Math.ceil(
    (window.closingMinute - MOBILE_ORDER_CUTOFF_MINUTES - window.currentMinute) * 60,
  );
  if (secondsUntilCutoff <= 0) {
    return { status: 'closed', cutoffAt: null };
  }

  return {
    status: secondsUntilCutoff <= 10 * 60 ? 'closing_soon' : 'open',
    cutoffAt: new Date(now.getTime() + secondsUntilCutoff * 1000).toISOString(),
  };
}
