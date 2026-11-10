export const MAX_ACTIVE_SHIFT_MINUTES = 18 * 60;

type AttendanceRow = {
  barista_id: number | string;
  barista_name: string;
  clocked_in_at: Date | string;
  clocked_out_at: Date | string | null;
};

type MonthlyAttendance = {
  barista_id: number;
  barista_name: string;
  month: string;
  hours: number;
};

function monthBounds(month: string): { start: number; end: number } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: Date.UTC(year, monthNumber - 1, 1) - 8 * 60 * 60 * 1000,
    end: Date.UTC(year, monthNumber, 1) - 8 * 60 * 60 * 1000,
  };
}

export function isCurrentAttendance(clockedInAt: Date | string, now = new Date()): boolean {
  const elapsedMinutes = (now.getTime() - new Date(clockedInAt).getTime()) / 60_000;
  return elapsedMinutes >= 0 && elapsedMinutes <= MAX_ACTIVE_SHIFT_MINUTES;
}

export function summarizeMonthlyAttendance(
  rows: AttendanceRow[],
  input: { now?: Date; monthKeys: string[] },
): MonthlyAttendance[] {
  const now = input.now ?? new Date();
  const totals = new Map<string, MonthlyAttendance & { minutes: number }>();

  for (const row of rows) {
    const start = new Date(row.clocked_in_at).getTime();
    if (!Number.isFinite(start)) continue;
    const end = row.clocked_out_at
      ? new Date(row.clocked_out_at).getTime()
      : isCurrentAttendance(row.clocked_in_at, now)
        ? now.getTime()
        : null;
    if (end === null || !Number.isFinite(end) || end <= start) continue;
    if ((end - start) / 60_000 > MAX_ACTIVE_SHIFT_MINUTES) continue;

    for (const month of input.monthKeys) {
      const bounds = monthBounds(month);
      const overlap = Math.max(0, Math.min(end, bounds.end) - Math.max(start, bounds.start));
      if (overlap <= 0) continue;
      const key = `${row.barista_id}:${month}`;
      const existing = totals.get(key) ?? {
        barista_id: Number(row.barista_id),
        barista_name: String(row.barista_name),
        month,
        hours: 0,
        minutes: 0,
      };
      existing.minutes += overlap / 60_000;
      totals.set(key, existing);
    }
  }

  return [...totals.values()]
    .map(({ minutes, ...row }) => ({ ...row, hours: Math.round((minutes / 60) * 100) / 100 }))
    .sort((a, b) => a.barista_name.localeCompare(b.barista_name) || input.monthKeys.indexOf(a.month) - input.monthKeys.indexOf(b.month));
}
