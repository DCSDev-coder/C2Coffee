import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

const TIME_ZONE = 'Asia/Kuala_Lumpur';

export type ShiftAccessState = {
  schedule_status: 'published' | 'unpublished' | 'closed';
  access_state: 'locked' | 'unlocked' | 'handover' | 'closing' | 'closed';
  can_prepare_orders: boolean;
  message: string;
  schedule_date: string;
  current_staff: Array<{ barista_id: number; barista_name: string; starts_at: string; ends_at: string }>;
  missing_staff: Array<{ barista_id: number; barista_name: string }>;
  active_attendance: Array<{ id: number; barista_id: number; barista_name: string; clocked_in_at: string }>;
  minutes_until_shift_end: number | null;
};

type ShiftWindow = {
  barista_id: number;
  barista_name: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  startMs: number;
  endMs: number;
};

function malaysiaParts(value: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}

function previousDate(date: string): string {
  const value = new Date(`${date}T12:00:00+08:00`);
  value.setUTCDate(value.getUTCDate() - 1);
  return malaysiaParts(value).date;
}

function shiftWindow(row: RowDataPacket): ShiftWindow {
  const date = String(row.shift_date);
  const startsAt = String(row.starts_at).slice(0, 5);
  const endsAt = String(row.ends_at).slice(0, 5);
  const startMs = new Date(`${date}T${startsAt}:00+08:00`).getTime();
  const endDate = endsAt < startsAt
    ? malaysiaParts(new Date(new Date(`${date}T12:00:00+08:00`).getTime() + 86400000)).date
    : date;
  return {
    barista_id: Number(row.barista_id),
    barista_name: String(row.barista_name),
    shift_date: date,
    starts_at: startsAt,
    ends_at: endsAt,
    startMs,
    endMs: new Date(`${endDate}T${endsAt}:00+08:00`).getTime()
  };
}

export async function resolveBaristaShiftAccess(
  connection: PoolConnection,
  input: { tenantId: number; tenantCode: string; storeId: number; now?: Date }
): Promise<ShiftAccessState> {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const { date: today } = malaysiaParts(now);
  const yesterday = previousDate(today);

  const [publicationRows, shiftRows, attendanceRows, attendanceHistoryRows] = await Promise.all([
    connection.query<RowDataPacket[]>(
      `SELECT schedule_date FROM barista_schedule_publications
       WHERE tenant_code = :tenantCode AND schedule_date = :today
         AND (store_id = :storeId OR store_id IS NULL)
       LIMIT 1`,
      { tenantCode: input.tenantCode, today, storeId: input.storeId }
    ),
    connection.query<RowDataPacket[]>(
      `SELECT s.barista_id, b.name AS barista_name,
              DATE_FORMAT(s.shift_date, '%Y-%m-%d') AS shift_date,
              TIME_FORMAT(s.starts_at, '%H:%i') AS starts_at,
              TIME_FORMAT(s.ends_at, '%H:%i') AS ends_at
       FROM barista_dated_shifts s
       JOIN baristas b ON b.id = s.barista_id
       WHERE s.tenant_code = :tenantCode
         AND s.shift_date IN (:yesterday, :today)
         AND (s.store_id = :storeId OR s.store_id IS NULL)
       ORDER BY s.shift_date, s.starts_at, b.name`,
      { tenantCode: input.tenantCode, yesterday, today, storeId: input.storeId }
    ),
    connection.query<RowDataPacket[]>(
      `SELECT a.id, a.barista_id, b.name AS barista_name, a.clocked_in_at
       FROM barista_attendance a
       JOIN baristas b ON b.id = a.barista_id
       WHERE a.tenant_id = :tenantId AND a.clocked_out_at IS NULL
         AND (a.store_id = :storeId OR a.store_id IS NULL)
       ORDER BY a.clocked_in_at`,
      { tenantId: input.tenantId, storeId: input.storeId }
    ),
    connection.query<RowDataPacket[]>(
      `SELECT DISTINCT a.barista_id
       FROM barista_attendance a
       WHERE a.tenant_id = :tenantId
         AND (a.store_id = :storeId OR a.store_id IS NULL)
         AND a.clocked_in_at >= CONVERT_TZ(CONCAT(:today, ' 00:00:00'), '+08:00', '+00:00')`,
      { tenantId: input.tenantId, storeId: input.storeId, today }
    )
  ]);

  const allShifts = shiftRows[0].map(shiftWindow);
  const todayShifts = allShifts.filter((shift) => shift.shift_date === today);
  const activeWindows = allShifts.filter((shift) => shift.startMs <= nowMs && nowMs < shift.endMs);
  const activeOvernightBaristaIds = new Set(
    activeWindows
      .filter((shift) => shift.shift_date === yesterday)
      .map((shift) => shift.barista_id)
  );
  const publicationExists = publicationRows[0].length > 0 || todayShifts.length > 0;
  const activeAttendance = attendanceRows[0]
    .filter((row) => {
      const clockInDate = malaysiaParts(new Date(row.clocked_in_at)).date;
      return clockInDate >= today || activeOvernightBaristaIds.has(Number(row.barista_id));
    })
    .map((row) => ({
      id: Number(row.id), barista_id: Number(row.barista_id), barista_name: String(row.barista_name),
      clocked_in_at: new Date(row.clocked_in_at).toISOString()
    }));

  if (!publicationExists) {
    return {
      schedule_status: 'unpublished', access_state: 'locked', can_prepare_orders: false,
      message: 'Today\'s timetable has not been published. Ask an administrator to publish the shift before preparing orders.',
      schedule_date: today, current_staff: [], missing_staff: [], active_attendance: activeAttendance,
      minutes_until_shift_end: null
    };
  }

  if (todayShifts.length === 0 && activeWindows.length === 0) {
    return {
      schedule_status: 'closed', access_state: 'closed', can_prepare_orders: false,
      message: 'No barista shift is scheduled for this outlet right now.', schedule_date: today,
      current_staff: [], missing_staff: [], active_attendance: activeAttendance, minutes_until_shift_end: null
    };
  }

  if (activeWindows.length === 0) {
    return {
      schedule_status: 'published', access_state: 'closed', can_prepare_orders: false,
      message: 'The next published barista shift has not started yet, or today\'s shifts have ended.', schedule_date: today,
      current_staff: [], missing_staff: [], active_attendance: activeAttendance, minutes_until_shift_end: null
    };
  }

  const activeIds = new Set(activeAttendance.map((item) => item.barista_id));
  const missingStaff = activeWindows
    .filter((shift, index, rows) => !activeIds.has(shift.barista_id) && rows.findIndex((item) => item.barista_id === shift.barista_id) === index)
    .map((shift) => ({ barista_id: shift.barista_id, barista_name: shift.barista_name }));

  const earliestStart = Math.min(...todayShifts.map((shift) => shift.startMs));
  const openingIds = new Set(todayShifts.filter((shift) => shift.startMs === earliestStart).map((shift) => shift.barista_id));
  const attendedTodayIds = new Set(attendanceHistoryRows[0].map((row) => Number(row.barista_id)));
  const openingStarted = [...openingIds].some((id) => attendedTodayIds.has(id) || activeIds.has(id));
  const overnightCoverage = activeWindows.some((shift) => shift.shift_date === yesterday && activeIds.has(shift.barista_id));

  if (!openingStarted && !overnightCoverage) {
    const openingMissing = todayShifts
      .filter((shift) => shift.startMs === earliestStart && !attendedTodayIds.has(shift.barista_id) && !activeIds.has(shift.barista_id))
      .map((shift) => ({ barista_id: shift.barista_id, barista_name: shift.barista_name }));
    return {
      schedule_status: 'published', access_state: 'locked', can_prepare_orders: false,
      message: 'An opening-shift barista must clock in before order preparation unlocks.', schedule_date: today,
      current_staff: activeWindows.map(({ barista_id, barista_name, starts_at, ends_at }) => ({ barista_id, barista_name, starts_at, ends_at })),
      missing_staff: openingMissing, active_attendance: activeAttendance, minutes_until_shift_end: null
    };
  }

  // Once opening is complete, any still-clocked-in scheduled worker preserves
  // service continuity during a late or edited handover. The incoming staff is
  // still surfaced as missing, but the counter is not abruptly locked.
  const scheduledTodayIds = new Set(allShifts.map((shift) => shift.barista_id));
  const hasContinuingCoverage = activeAttendance.some((item) => scheduledTodayIds.has(item.barista_id));
  if (!hasContinuingCoverage) {
    return {
      schedule_status: 'published', access_state: 'locked', can_prepare_orders: false,
      message: 'A scheduled barista must clock in before preparing orders.', schedule_date: today,
      current_staff: activeWindows.map(({ barista_id, barista_name, starts_at, ends_at }) => ({ barista_id, barista_name, starts_at, ends_at })),
      missing_staff: missingStaff, active_attendance: activeAttendance, minutes_until_shift_end: null
    };
  }

  const activeEndMs = Math.min(...activeWindows.filter((shift) => activeIds.has(shift.barista_id)).map((shift) => shift.endMs).concat(activeWindows.map((shift) => shift.endMs)));
  const minutesUntilEnd = Math.max(0, Math.ceil((activeEndMs - nowMs) / 60000));
  const isClosing = minutesUntilEnd <= 5;
  const isHandover = missingStaff.length > 0;
  return {
    schedule_status: 'published',
    access_state: isHandover ? 'handover' : isClosing ? 'closing' : 'unlocked',
    can_prepare_orders: true,
    message: isHandover
      ? `${missingStaff.map((staff) => staff.barista_name).join(', ')} must clock in for the current shift. Existing coverage remains active.`
      : isClosing
        ? `Shift ends in ${minutesUntilEnd} minute${minutesUntilEnd === 1 ? '' : 's'}. Complete the handover or clear active orders before clocking out.`
        : 'Shift access is active.',
    schedule_date: today,
    current_staff: activeWindows.map(({ barista_id, barista_name, starts_at, ends_at }) => ({ barista_id, barista_name, starts_at, ends_at })),
    missing_staff: missingStaff,
    active_attendance: activeAttendance,
    minutes_until_shift_end: minutesUntilEnd
  };
}
