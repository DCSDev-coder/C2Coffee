import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { customerMessageScheduleResponse, type CustomerMessageSchedule } from '../../services/customer-message-schedules.js';

const scheduleSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(420),
  mode: z.enum(['once', 'daily', 'weekly', 'monthly']),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  active_days: z.array(z.number().int().min(1).max(7)).max(7).optional().default([]),
  monthly_day: z.number().int().min(1).max(31).nullable().optional()
}).superRefine((value, context) => {
  const startsAt = new Date(value.starts_at).getTime();
  const endsAt = value.ends_at ? new Date(value.ends_at).getTime() : null;
  if (!Number.isFinite(startsAt) || startsAt <= Date.now()) context.addIssue({ code: z.ZodIssueCode.custom, message: 'The first send time must be in the future.', path: ['starts_at'] });
  if (value.mode === 'once' && value.ends_at) context.addIssue({ code: z.ZodIssueCode.custom, message: 'One-time broadcasts do not use an end time.', path: ['ends_at'] });
  if (value.mode !== 'once' && endsAt !== null && endsAt <= startsAt) context.addIssue({ code: z.ZodIssueCode.custom, message: 'The end time must be after the first send time.', path: ['ends_at'] });
  if (value.mode === 'weekly' && (!value.active_days || value.active_days.length === 0)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose at least one weekday.', path: ['active_days'] });
  if (value.mode === 'monthly' && !value.monthly_day) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a day of the month.', path: ['monthly_day'] });
});

type ScheduleRow = RowDataPacket & {
  id: number; tenant_id: number; title: string; body: string;
  schedule_json: string | CustomerMessageSchedule; next_run_at: Date;
  last_run_at: Date | null; status: 'active' | 'completed' | 'cancelled'; created_at: Date;
};

function localParts(value: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' }).formatToParts(value);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

export async function registerAdminCustomerMessageScheduleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/marketing/customer-message-schedules', { preHandler: authenticateAdminRequest }, async (request) => {
    const [rows] = await mysqlPool.query<ScheduleRow[]>(
      `SELECT id, tenant_id, title, body, schedule_json, next_run_at, last_run_at, status, created_at
       FROM customer_message_schedules WHERE tenant_id = :tenantId
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END, next_run_at ASC, id DESC`,
      { tenantId: request.adminAuth.tenantId }
    );
    return { schedules: rows.map(customerMessageScheduleResponse) };
  });

  app.post('/v1/admin/marketing/customer-message-schedules', { preHandler: authenticateAdminRequest }, async (request) => {
    const payload = scheduleSchema.parse(request.body);
    const startsAt = new Date(payload.starts_at);
    const local = localParts(startsAt);
    const schedule: CustomerMessageSchedule = {
      mode: payload.mode,
      time: local.time,
      activeDays: payload.mode === 'weekly' ? [...new Set(payload.active_days)].sort((a, b) => a - b) : undefined,
      monthlyDay: payload.mode === 'monthly' ? payload.monthly_day || Number(local.date.slice(-2)) : undefined,
      endsAt: payload.ends_at || null
    };
    const [result] = await mysqlPool.execute(
      `INSERT INTO customer_message_schedules
       (tenant_id, title, body, schedule_json, next_run_at, created_by_admin_id)
       VALUES (:tenantId, :title, :body, :scheduleJson, :nextRunAt, :adminUserId)`,
      { tenantId: request.adminAuth.tenantId, title: payload.title, body: payload.body, scheduleJson: JSON.stringify(schedule), nextRunAt: startsAt, adminUserId: request.adminAuth.adminUserId }
    );
    return { schedule_id: Number((result as { insertId: number }).insertId), next_run_at: startsAt.toISOString() };
  });

  app.post('/v1/admin/marketing/customer-message-schedules/:id/cancel', { preHandler: authenticateAdminRequest }, async (request) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const [result] = await mysqlPool.execute(
      `UPDATE customer_message_schedules
       SET status = 'cancelled', cancelled_by_admin_id = :adminUserId, cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
       WHERE id = :id AND tenant_id = :tenantId AND status = 'active'`,
      { id: params.id, tenantId: request.adminAuth.tenantId, adminUserId: request.adminAuth.adminUserId }
    );
    if ((result as { affectedRows: number }).affectedRows === 0) throw new ApiError(404, 'customer_message_schedule_not_active', 'This scheduled broadcast is no longer active.');
    return { cancelled: true };
  });
}
