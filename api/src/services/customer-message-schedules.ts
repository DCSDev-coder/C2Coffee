import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getUtcConnection, mysqlPool } from '../db/mysql.js';
import { createUserNotification } from '../http/notifications.js';
import { deliverPushToCustomerTenant } from './push-delivery.js';

const TIME_ZONE = 'Asia/Kuala_Lumpur';
const UTC_OFFSET_HOURS = 8;

export type CustomerMessageSchedule = {
  mode: 'once' | 'daily' | 'weekly' | 'monthly';
  time: string;
  activeDays?: number[];
  monthlyDay?: number;
  endsAt?: string | null;
};

type ScheduleRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  title: string;
  body: string;
  schedule_json: string | CustomerMessageSchedule;
  next_run_at: Date | string;
  last_run_at: Date | string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: Date | string;
};

type LocalDate = { year: number; month: number; day: number };

function parseSchedule(value: string | CustomerMessageSchedule): CustomerMessageSchedule {
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value) as CustomerMessageSchedule;
  } catch {
    return { mode: 'once', time: '00:00' };
  }
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function iso(value: Date | string | null): string | null {
  return value ? asDate(value).toISOString() : null;
}

function localDateParts(value: Date): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE
  }).formatToParts(value);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value)
  };
}

function localDateKey(value: LocalDate): string {
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

function addLocalDays(value: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(value.year, value.month - 1, value.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function localDateTimeToUtc(date: LocalDate, time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hour, minute) - UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextRunAt(current: Date, schedule: CustomerMessageSchedule): Date | null {
  if (schedule.mode === 'once') return null;
  const currentLocal = localDateParts(current);
  let nextLocal: LocalDate;

  if (schedule.mode === 'daily') {
    nextLocal = addLocalDays(currentLocal, 1);
  } else if (schedule.mode === 'weekly') {
    const activeDays = [...new Set((schedule.activeDays || []).map(Number))].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
    if (activeDays.length === 0) return null;
    const currentWeekday = new Date(Date.UTC(currentLocal.year, currentLocal.month - 1, currentLocal.day)).getUTCDay() || 7;
    const nextDay = activeDays.find((day) => day > currentWeekday) ?? activeDays[0];
    const offset = nextDay > currentWeekday ? nextDay - currentWeekday : 7 - currentWeekday + nextDay;
    nextLocal = addLocalDays(currentLocal, offset || 7);
  } else {
    const nextMonth = currentLocal.month === 12 ? { year: currentLocal.year + 1, month: 1 } : { year: currentLocal.year, month: currentLocal.month + 1 };
    nextLocal = { year: nextMonth.year, month: nextMonth.month, day: Math.min(Number(schedule.monthlyDay || currentLocal.day), daysInMonth(nextMonth.year, nextMonth.month)) };
  }

  return localDateTimeToUtc(nextLocal, schedule.time);
}

function response(row: ScheduleRow) {
  return {
    id: Number(row.id),
    title: row.title,
    body: row.body,
    schedule: parseSchedule(row.schedule_json),
    next_run_at: iso(row.next_run_at),
    last_run_at: iso(row.last_run_at),
    status: row.status,
    created_at: iso(row.created_at)
  };
}

export async function runCustomerMessageScheduleSweep(): Promise<{ processed: number; completed: number; recipients: number }> {
  const [rows] = await mysqlPool.query<ScheduleRow[]>(`
    SELECT id, tenant_id, title, body, schedule_json, next_run_at, last_run_at, status, created_at
    FROM customer_message_schedules
    WHERE status = 'active' AND next_run_at <= UTC_TIMESTAMP()
    ORDER BY next_run_at ASC, id ASC
    LIMIT 50
  `);
  let processed = 0;
  let completed = 0;
  let recipients = 0;

  for (const candidate of rows) {
    const connection = await getUtcConnection();
    let delivery: { tenantId: number; title: string; body: string; data: Record<string, string>; recipients: number } | null = null;
    try {
      await connection.beginTransaction();
      const [lockedRows] = await connection.query<ScheduleRow[]>(
        `SELECT id, tenant_id, title, body, schedule_json, next_run_at, last_run_at, status, created_at
         FROM customer_message_schedules WHERE id = :id FOR UPDATE`,
        { id: candidate.id }
      );
      const row = lockedRows[0];
      if (!row || row.status !== 'active' || asDate(row.next_run_at).getTime() > Date.now()) {
        await connection.rollback();
        connection.release();
        continue;
      }

      const schedule = parseSchedule(row.schedule_json);
      const occurrenceKey = asDate(row.next_run_at).toISOString();
      const deliveryKey = `customer-message-schedule:${row.id}:${occurrenceKey}`;
      const data = {
        type: 'marketing_poster',
        message_kind: 'customer_message',
        source: 'admin_marketing_schedule',
        destination: 'notifications',
        schedule_id: String(row.id)
      };
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO notifications (
           user_id, type, title, body, data_json, delivery_key, sent_at, created_at
         )
         SELECT ctm.user_id, 'customer_message', :title, :body, :dataJson, :deliveryKey, UTC_TIMESTAMP(), UTC_TIMESTAMP()
         FROM customer_tenant_memberships ctm
         JOIN users u ON u.id = ctm.user_id
         LEFT JOIN customer_notification_preferences cnp ON cnp.user_id = ctm.user_id
         WHERE ctm.tenant_id = :tenantId
           AND u.status = 'active'
           AND COALESCE(cnp.marketing_enabled, 1) = 1
         ON DUPLICATE KEY UPDATE delivery_key = VALUES(delivery_key)`,
        { tenantId: row.tenant_id, title: row.title, body: row.body, dataJson: JSON.stringify(data), deliveryKey }
      );

      const next = nextRunAt(asDate(row.next_run_at), schedule);
      const endsAt = schedule.endsAt ? new Date(schedule.endsAt).getTime() : null;
      const shouldComplete = !next || (endsAt !== null && next.getTime() > endsAt);
      await connection.execute(
        `UPDATE customer_message_schedules
         SET last_run_at = :lastRunAt, next_run_at = :nextRunAt,
             status = :status, updated_at = UTC_TIMESTAMP()
         WHERE id = :id`,
        { id: row.id, lastRunAt: asDate(row.next_run_at), nextRunAt: shouldComplete ? asDate(row.next_run_at) : next, status: shouldComplete ? 'completed' : 'active' }
      );
      await connection.execute(
        `INSERT INTO admin_audit_logs (
           admin_user_id, effective_roles_json, action_code, target_type,
           after_json, ip_address, user_agent, created_at
         ) VALUES (NULL, '[]', 'customer_message_scheduled_delivery', 'customer_message_schedule', :afterJson, NULL, NULL, UTC_TIMESTAMP())`,
        { afterJson: JSON.stringify({ schedule_id: row.id, tenant_id: row.tenant_id, occurrence: occurrenceKey, recipients: insertResult.affectedRows }) }
      );
      await connection.commit();
      processed += 1;
      recipients += Number(insertResult.affectedRows || 0);
      if (shouldComplete) completed += 1;
      delivery = { tenantId: Number(row.tenant_id), title: row.title, body: row.body, data, recipients: Number(insertResult.affectedRows || 0) };
    } catch (error) {
      await connection.rollback();
      console.error('[customer-message-schedules] delivery failed', { scheduleId: candidate.id, error });
    } finally {
      connection.release();
    }

    if (delivery && delivery.recipients > 0) {
      try {
        await deliverPushToCustomerTenant({ tenantId: delivery.tenantId, title: delivery.title, body: delivery.body, data: delivery.data });
      } catch (error) {
        console.warn('[customer-message-schedules] push delivery failed', { scheduleId: candidate.id, error });
      }
    }
  }

  return { processed, completed, recipients };
}

export function customerMessageScheduleResponse(row: ScheduleRow) {
  return response(row);
}
