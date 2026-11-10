import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { isStoreTradingNow } from './store-availability.js';
import { isCurrentAttendance } from './attendance-duration.js';

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
  coverage_attendance: Array<{ id: number; barista_id: number; barista_name: string; clocked_in_at: string }>;
  minutes_until_shift_end: number | null;
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function zonedParts(value: Date, timezone = TIME_ZONE): { date: string; time: string; weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = DAY_KEYS.indexOf(String(map.weekday).toLowerCase().slice(0, 3) as typeof DAY_KEYS[number]);
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
    weekday: weekday < 0 ? 0 : weekday,
    minutes: Number(map.hour) * 60 + Number(map.minute),
  };
}

export function shouldBlockBaristaClockOut(input: {
  activeAttendanceCount: number;
  activeOrderCount: number;
}): boolean {
  return input.activeAttendanceCount === 1 && input.activeOrderCount > 0;
}

export async function resolveBaristaShiftAccess(
  connection: PoolConnection,
  input: { tenantId: number; tenantCode: string; storeId: number; now?: Date }
): Promise<ShiftAccessState> {
  const now = input.now ?? new Date();
  const [storeRows, attendanceRows] = await Promise.all([
    connection.query<RowDataPacket[]>(
      `SELECT status, temporarily_closed, timezone, weekly_hours_json
         FROM stores WHERE id = :storeId AND tenant_id = :tenantId LIMIT 1`,
      { storeId: input.storeId, tenantId: input.tenantId }
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
  ]);

  const store = storeRows[0][0];
  const timezone = String(store?.timezone || TIME_ZONE);
  const { date: today } = zonedParts(now, timezone);
  const withinOpeningHours = Boolean(store) && isStoreTradingNow({
    status: String(store.status),
    temporarily_closed: store.temporarily_closed,
    timezone: store.timezone,
    weekly_hours_json: store.weekly_hours_json
  }, now);
  const mapAttendance = (row: RowDataPacket) => ({
      id: Number(row.id), barista_id: Number(row.barista_id), barista_name: String(row.barista_name),
      clocked_in_at: new Date(row.clocked_in_at).toISOString()
    });
  const activeAttendance = attendanceRows[0]
    .filter((row) => isCurrentAttendance(row.clocked_in_at, now))
    .map(mapAttendance);
  const coverageAttendance = attendanceRows[0]
    .filter((row) => isCurrentAttendance(row.clocked_in_at, now))
    .map(mapAttendance);
  const storeCanTrade = Boolean(store) && String(store.status) === 'active' && !Boolean(store.temporarily_closed);
  const isOpen = storeCanTrade && activeAttendance.length > 0;
  return {
    schedule_status: withinOpeningHours ? 'published' : 'closed',
    access_state: isOpen ? 'unlocked' : storeCanTrade ? 'locked' : 'closed',
    can_prepare_orders: isOpen,
    message: !storeCanTrade
      ? 'The outlet is temporarily closed or unavailable.'
      : activeAttendance.length === 0
        ? 'Clock in a barista before preparing orders.'
        : 'Outlet is open and staffed.',
    schedule_date: today,
    current_staff: [],
    missing_staff: [],
    active_attendance: activeAttendance,
    coverage_attendance: coverageAttendance,
    minutes_until_shift_end: null
  };
}
