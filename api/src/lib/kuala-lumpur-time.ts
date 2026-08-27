const KUALA_LUMPUR_TIME_ZONE = 'Asia/Kuala_Lumpur';
const KUALA_LUMPUR_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export type KualaLumpurDateParts = {
  year: string;
  month: string;
  day: string;
  weekday: string;
  hour: string;
  minute: string;
  monthDay: string;
  dateKey: string;
};

export function getKualaLumpurDateParts(now = new Date()): KualaLumpurDateParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KUALA_LUMPUR_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);

  const lookup = (type: string): string => parts.find((part) => part.type === type)?.value || '';
  const year = lookup('year');
  const month = lookup('month');
  const day = lookup('day');
  const weekday = lookup('weekday');
  const hour = lookup('hour');
  const minute = lookup('minute');

  return {
    year,
    month,
    day,
    weekday,
    hour,
    minute,
    monthDay: `${month}-${day}`,
    dateKey: `${year}-${month}-${day}`
  };
}

export function isBirthdayMonthDay(
  birthdayMonthDay: string | null | undefined,
  now = new Date()
): boolean {
  const value = String(birthdayMonthDay ?? '').trim();
  if (!/^\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return value === getKualaLumpurDateParts(now).monthDay;
}

export function getKualaLumpurDayEndUtc(now = new Date()): Date {
  const parts = getKualaLumpurDateParts(now);
  const localMidnightNextDayUtcMs =
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) + 1,
      0,
      0,
      0,
      0
    ) - KUALA_LUMPUR_UTC_OFFSET_MS;

  return new Date(localMidnightNextDayUtcMs);
}
