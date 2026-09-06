import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';

const dashboardQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period: z.enum(['today', 'this_month', 'last_month', '3m', '6m', '1y', 'custom']).optional().default('this_month')
}).superRefine((value, context) => {
  if (value.start_date && value.end_date && value.start_date > value.end_date) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'start_date must be on or before end_date',
      path: ['end_date']
    });
  }
});

const revenueStatuses = new Set(['paid', 'accepted', 'preparing', 'ready_for_pickup', 'collected']);

type DashboardOrderRow = RowDataPacket & {
  id: number;
  order_ref: string;
  user_id: number;
  customer_name: string | null;
  city: string | null;
  status: string;
  payment_mode: string;
  final_total_rm: string | number;
  token_amount_charged: number;
  created_at: Date;
};

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedTimestamp = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return zonedTimestamp - date.getTime();
}

function businessDayBounds(dateKey: string, timeZone: string): { start: Date; end: Date } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const startGuess = new Date(Date.UTC(year, month - 1, day));
  const endGuess = new Date(Date.UTC(year, month - 1, day + 1));

  return {
    start: new Date(startGuess.getTime() - timeZoneOffsetMs(startGuess, timeZone)),
    end: new Date(endGuess.getTime() - timeZoneOffsetMs(endGuess, timeZone))
  };
}

function shiftDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, targetDay)).toISOString().slice(0, 10);
}

function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function startOfMonthDateKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

function previousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

function formatTrendDateKey(dateKey: string, timeZone: string, includeYear: boolean): string {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone,
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {})
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function toMysqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function titleCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatDisplayTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function getSafeTimeZone(value: string | null | undefined): string {
  const candidate = value?.trim() || 'Asia/Kuala_Lumpur';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format();
    return candidate;
  } catch {
    return 'Asia/Kuala_Lumpur';
  }
}

export async function registerAdminDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/dashboard', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin', 'marketing_admin', 'support_admin']);
    const { date, start_date: startDate, end_date: endDate, period } = dashboardQuerySchema.parse(request.query);
    const tenantCode = request.adminAuth.tenantCode;

    const [storeRows] = await mysqlPool.query<Array<RowDataPacket & { timezone: string | null }>>(
      `
        SELECT MIN(s.timezone) AS timezone
        FROM stores s
        JOIN admin_tenants t ON t.id = s.tenant_id
        WHERE t.code = :tenantCode
      `,
      { tenantCode }
    );

    const timeZone = getSafeTimeZone(storeRows[0]?.timezone);
    const businessDate = endDate || startDate || date || formatDateInTimeZone(new Date(), timeZone);
    const currentMonthStart = startOfMonthDateKey(businessDate);
    const periodMonths = period === '3m' ? 3 : period === '6m' ? 6 : period === '1y' ? 12 : 0;
    const rangeStartDate = startDate
      || (period === 'last_month' ? shiftDateKey(currentMonthStart, -1) : period === 'this_month' ? currentMonthStart : period === 'today' ? businessDate : shiftDateKey(businessDate, -periodMonths));
    const rangeEndDate = endDate || startDate || (period === 'last_month' ? previousDateKey(currentMonthStart) : businessDate);
    const { start } = businessDayBounds(rangeStartDate, timeZone);
    const { end } = businessDayBounds(rangeEndDate, timeZone);
    const isSingleDay = rangeStartDate === rangeEndDate;
    const trendIncludesYear = rangeStartDate.slice(0, 4) !== rangeEndDate.slice(0, 4);
    const queryParams = {
      tenantCode,
      start: toMysqlDateTime(start),
      end: toMysqlDateTime(end)
    };

    const [rangeOrders] = await mysqlPool.query<DashboardOrderRow[]>(
      `
        SELECT
          o.id,
          o.order_ref,
          o.user_id,
          up.display_name AS customer_name,
          up.city,
          o.status,
          o.payment_mode,
          o.final_total_rm,
          o.token_amount_charged,
          o.created_at
        FROM orders o
        JOIN stores s ON s.id = o.store_id
        JOIN admin_tenants t ON t.id = s.tenant_id
        LEFT JOIN user_profiles up ON up.user_id = o.user_id
        WHERE t.code = :tenantCode
          AND o.created_at >= :start
          AND o.created_at < :end
        ORDER BY o.created_at DESC, o.id DESC
      `,
      queryParams
    );

    const [customerRows] = await mysqlPool.query<Array<RowDataPacket & { customer_count: number }>>(
      `
        SELECT COUNT(DISTINCT o.user_id) AS customer_count
        FROM orders o
        JOIN stores s ON s.id = o.store_id
        JOIN admin_tenants t ON t.id = s.tenant_id
        WHERE t.code = :tenantCode
          AND o.status IN ('paid', 'accepted', 'preparing', 'ready_for_pickup', 'collected')
          AND o.created_at >= :start
          AND o.created_at < :end
      `,
      queryParams
    );

    const [refundRows] = await mysqlPool.query<Array<RowDataPacket & { pending_refunds: number }>>(
      `
        SELECT COUNT(*) AS pending_refunds
        FROM refunds r
        JOIN orders o ON o.id = r.order_id
        JOIN stores s ON s.id = o.store_id
        JOIN admin_tenants t ON t.id = s.tenant_id
        WHERE t.code = :tenantCode
          AND r.status = 'pending'
          AND r.created_at >= :start
          AND r.created_at < :end
      `,
      queryParams
    );

    const [activityRows] = await mysqlPool.query<Array<RowDataPacket & {
      order_ref: string;
      to_status: string;
      changed_by_type: string;
      created_at: Date;
    }>>(
      `
        SELECT
          o.order_ref,
          osh.to_status,
          osh.changed_by_type,
          osh.created_at
        FROM order_status_history osh
        JOIN orders o ON o.id = osh.order_id
        JOIN stores s ON s.id = o.store_id
        JOIN admin_tenants t ON t.id = s.tenant_id
        WHERE t.code = :tenantCode
          AND osh.created_at >= :start
          AND osh.created_at < :end
        ORDER BY osh.created_at DESC, osh.id DESC
        LIMIT 5
      `,
      queryParams
    );

    const [topItemRows] = await mysqlPool.query<Array<RowDataPacket & {
      name: string;
      units_sold: number;
      revenue_rm: string | number;
    }>>(
      `
        SELECT
          oi.item_name_snapshot AS name,
          SUM(oi.quantity) AS units_sold,
          COALESCE(SUM(oi.line_subtotal_rm), 0) AS revenue_rm
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN stores s ON s.id = o.store_id
        JOIN admin_tenants t ON t.id = s.tenant_id
        WHERE t.code = :tenantCode
          AND o.created_at >= :start
          AND o.created_at < :end
          AND o.status IN ('paid', 'accepted', 'preparing', 'ready_for_pickup', 'collected')
        GROUP BY oi.item_name_snapshot
        ORDER BY units_sold DESC, revenue_rm DESC, name ASC
        LIMIT 5
      `,
      queryParams
    );

    const hourly = Array.from({ length: 12 }, (_, index) => ({
      hour: index * 2,
      label: `${String(index * 2).padStart(2, '0')}:00`,
      revenue: 0,
      orders: 0
    }));

    let salesToday = 0;
    let ordersToday = 0;
    let awaitingPreparation = 0;
    let preparing = 0;
    const daily = new Map<string, { label: string; revenue: number; orders: number }>();
    if (!isSingleDay) {
      for (let dateKey = rangeStartDate; dateKey <= rangeEndDate; dateKey = nextDateKey(dateKey)) {
        daily.set(dateKey, {
          label: formatTrendDateKey(dateKey, timeZone, trendIncludesYear),
          revenue: 0,
          orders: 0
        });
      }
    }

    for (const order of rangeOrders) {
      const status = String(order.status || '').toLowerCase();
      const isRevenueOrder = revenueStatuses.has(status);
      if (isRevenueOrder) {
        salesToday += Number(order.final_total_rm || 0);
        ordersToday += 1;
        if (isSingleDay) {
          const localHour = Number(new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: '2-digit',
            hourCycle: 'h23'
          }).format(new Date(order.created_at)));
          const bucket = hourly[Math.min(Math.floor(localHour / 2), hourly.length - 1)];
          bucket.revenue += Number(order.final_total_rm || 0);
          bucket.orders += 1;
        } else {
          const orderDate = new Date(order.created_at);
          const key = formatDateInTimeZone(orderDate, timeZone);
          const bucket = daily.get(key) ?? {
            label: formatTrendDateKey(key, timeZone, trendIncludesYear),
            revenue: 0,
            orders: 0
          };
          bucket.revenue += Number(order.final_total_rm || 0);
          bucket.orders += 1;
          daily.set(key, bucket);
        }
      }
      if (status === 'paid' || status === 'accepted') awaitingPreparation += 1;
      if (status === 'preparing') preparing += 1;
    }

    return {
      businessDate,
      period,
      rangeStartDate,
      rangeEndDate,
      isSingleDay,
      timeZone,
      generatedAt: new Date().toISOString(),
      summary: {
        salesToday,
        ordersToday,
        awaitingPreparation,
        preparing,
        customersServed: Number(customerRows[0]?.customer_count || 0),
        pendingRefunds: Number(refundRows[0]?.pending_refunds || 0)
      },
      trends: (isSingleDay ? hourly : Array.from(daily.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, bucket]) => bucket)).map((bucket) => ({
        time: bucket.label,
        revenue: Number(bucket.revenue.toFixed(2)),
        orders: bucket.orders
      })),
      recentOrders: rangeOrders.slice(0, 5).map((order) => ({
        id: order.order_ref,
        customer: order.customer_name || 'Customer',
        city: order.city || '-',
        total: Number(order.final_total_rm || 0),
        tokenAmount: Number(order.token_amount_charged || 0),
        status: titleCase(String(order.status || '')),
        paymentMode: titleCase(String(order.payment_mode || '')),
        time: formatDisplayTime(new Date(order.created_at), timeZone),
        createdAt: new Date(order.created_at).toISOString()
      })),
      recentActivity: activityRows.map((activity) => ({
        title: `Order ${activity.order_ref} moved to ${titleCase(activity.to_status)}`,
        detail: `Updated by ${titleCase(activity.changed_by_type || 'system')}`,
        time: formatDisplayTime(new Date(activity.created_at), timeZone),
        status: activity.to_status
      })),
      topItems: topItemRows.map((item) => ({
        name: item.name,
        unitsSold: Number(item.units_sold || 0),
        revenue: Number(item.revenue_rm || 0)
      }))
    };
  });
}
