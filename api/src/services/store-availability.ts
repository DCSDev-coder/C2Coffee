export type StoreDayHours = {
  closed: boolean;
  open: string;
  close: string;
};

export type StoreWeeklyHours = Record<string, StoreDayHours>;

const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

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
    hourCycle: 'h23'
  }).formatToParts(now);
  const weekdayText = parts.find((part) => part.type === 'weekday')?.value.toLowerCase().slice(0, 3) ?? 'sun';
  const weekday = dayKeys.indexOf(weekdayText as typeof dayKeys[number]);
  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return { weekday: weekday < 0 ? 0 : weekday, minutes: hours * 60 + minutes };
}

export function isStoreTradingNow(input: {
  status: string;
  temporarily_closed?: number | boolean | null;
  timezone?: string | null;
  weekly_hours_json?: unknown;
}, now = new Date()): boolean {
  if (input.status !== 'active' || Boolean(input.temporarily_closed)) return false;
  const schedule = normalizeWeeklyHours(input.weekly_hours_json);
  if (!schedule) return true;

  const { weekday, minutes } = zonedParts(now, input.timezone || 'Asia/Kuala_Lumpur');
  const today = schedule[dayKeys[weekday]];
  if (!today.closed) {
    const open = parseMinutes(today.open)!;
    const close = parseMinutes(today.close)!;
    if (close > open && minutes >= open && minutes < close) return true;
    if (close < open && minutes >= open) return true;
  }

  const previous = schedule[dayKeys[(weekday + 6) % 7]];
  if (!previous.closed) {
    const previousOpen = parseMinutes(previous.open)!;
    const previousClose = parseMinutes(previous.close)!;
    if (previousClose < previousOpen && minutes < previousClose) return true;
  }
  return false;
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
