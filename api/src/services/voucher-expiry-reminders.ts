import type { RowDataPacket } from 'mysql2/promise';

import { getUtcConnection, mysqlPool } from '../db/mysql.js';
import { createUserNotification } from '../http/notifications.js';
import { deliverPushToUser } from './push-delivery.js';

type ScheduledVoucherReminderRow = RowDataPacket & {
  user_id: number;
  voucher_id: number;
  voucher_name: string;
  issued_at: Date;
  expires_at: Date;
  eligible_scope_json: string | Record<string, unknown>;
  start_reminder_enabled: number;
  start_reminder_minutes_before: number;
  end_reminder_enabled: number;
  end_reminder_minutes_before: number;
};

function parseScope(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function localDateParts(value: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kuala_Lumpur'
  }).formatToParts(value);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value)
  };
}

function localDateTimeToUtc(date: { year: number; month: number; day: number }, time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hour, minute) - 8 * 60 * 60 * 1000);
}

function reminderWindowStart(row: ScheduledVoucherReminderRow): Date {
  const scope = parseScope(row.eligible_scope_json);
  const schedule = scope.schedule && typeof scope.schedule === 'object'
    ? scope.schedule as Record<string, unknown>
    : {};
  const mode = String(schedule.mode || 'always');
  const startTime = typeof schedule.startTime === 'string' ? schedule.startTime : '';

  if (!startTime || mode === 'always' || mode === 'birthday') return new Date(row.issued_at);

  return localDateTimeToUtc(localDateParts(new Date(row.expires_at)), startTime);
}

function minutesLabel(minutes: number): string {
  if (minutes <= 0) return 'now';
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
  return `${minutes} minutes`;
}

async function sendVoucherScheduleReminder(
  row: ScheduledVoucherReminderRow,
  kind: 'start' | 'end',
  now: Date
): Promise<void> {
  const enabled = kind === 'start' ? row.start_reminder_enabled === 1 : row.end_reminder_enabled === 1;
  if (!enabled) return;

  const minutesBefore = kind === 'start'
    ? Number(row.start_reminder_minutes_before || 0)
    : Number(row.end_reminder_minutes_before || 0);
  const eventAt = kind === 'start' ? reminderWindowStart(row) : new Date(row.expires_at);
  if (kind === 'start' && eventAt.getTime() >= new Date(row.expires_at).getTime()) return;
  const reminderAt = new Date(eventAt.getTime() - minutesBefore * 60 * 1000);
  const difference = now.getTime() - reminderAt.getTime();
  if (difference < 0 || difference > 2 * 60 * 1000) return;

  const isStart = kind === 'start';
  const title = isStart
    ? minutesBefore > 0
      ? `${row.voucher_name} starts soon`
      : `${row.voucher_name} is available`
    : minutesBefore > 0
      ? `${row.voucher_name} ends soon`
      : `${row.voucher_name} ends now`;
  const body = isStart
    ? minutesBefore > 0
      ? `${row.voucher_name} starts in ${minutesLabel(minutesBefore)}. Open My Rewards to use it.`
      : `${row.voucher_name} is now available. Open My Rewards to use it.`
    : minutesBefore > 0
      ? `${row.voucher_name} ends in ${minutesLabel(minutesBefore)}. Use it before the offer closes.`
      : `${row.voucher_name} ends now. Use it before the offer closes.`;
  const type = isStart ? 'voucher_start_reminder' : 'voucher_end_reminder';
  const deliveryKey = `voucher-${row.voucher_id}-${kind}-${eventAt.toISOString()}`;
  const connection = await getUtcConnection();
  let inserted = 0;
  try {
    await connection.beginTransaction();
    // Lock the issued voucher while deciding whether to notify. If checkout
    // redeemed it before this point, no reminder is created. If redemption
    // races this check, checkout waits until this short transaction finishes.
    const [currentRows] = await connection.query<Array<RowDataPacket & {
      id: number;
      status: string;
      redeemed_at: Date | null;
      revoked_at: Date | null;
    }>>(
      `
        SELECT id, status, redeemed_at, revoked_at
        FROM user_vouchers
        WHERE id = :voucherId
        FOR UPDATE
      `,
      { voucherId: row.voucher_id }
    );
    const current = currentRows[0];
    if (
      !current ||
      current.status !== 'active' ||
      current.redeemed_at !== null ||
      current.revoked_at !== null
    ) {
      await connection.rollback();
      return;
    }
    inserted = await createUserNotification(connection, {
      userId: Number(row.user_id),
      type,
      title,
      body,
      data: { type, voucher_id: row.voucher_id },
      deliveryKey
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  if (inserted === 0) return;

  try {
    await deliverPushToUser({
      userId: Number(row.user_id),
      title,
      body,
      data: { type, voucher_id: String(row.voucher_id) }
    });
  } catch (error) {
    console.warn('[voucher-schedule-reminders] push delivery failed', {
      voucherId: row.voucher_id,
      kind,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Evaluated frequently so administrators can choose exact campaign start/end
// reminders. The notification delivery key makes this safe across restarts.
export async function runVoucherScheduleReminderSweep(): Promise<void> {
  const [rows] = await mysqlPool.query<ScheduledVoucherReminderRow[]>(`
    SELECT uv.user_id, uv.id AS voucher_id, vt.name AS voucher_name,
           uv.issued_at, uv.expires_at, vt.eligible_scope_json,
           vt.start_reminder_enabled, vt.start_reminder_minutes_before,
           vt.end_reminder_enabled, vt.end_reminder_minutes_before
    FROM user_vouchers uv
    JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
    WHERE uv.status = 'active'
      AND uv.redeemed_at IS NULL
      AND uv.revoked_at IS NULL
      AND uv.expires_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE)
      AND (vt.start_reminder_enabled = 1 OR vt.end_reminder_enabled = 1)
  `);
  const now = new Date();
  for (const row of rows) {
    await sendVoucherScheduleReminder(row, 'start', now);
    await sendVoucherScheduleReminder(row, 'end', now);
  }
}
