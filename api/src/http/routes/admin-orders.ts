import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import crypto from 'node:crypto';
import { authenticateAdminRequest } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { processOrderLoyalty } from '../../services/loyalty.js';
import { awardReferralForCollectedOrder } from '../../services/referrals.js';
import { ApiError } from '../errors.js';
import { createUserNotification } from '../notifications.js';
import { z } from 'zod';

function formatDisplayDate(dateObj: Date): string {
  if (!dateObj) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(dateObj);
}

function formatDisplayTime(dateObj: Date): string {
  if (!dateObj) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(dateObj);
}

function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function requireOrderAccess(request: { adminAuth?: { roles?: string[] } }): void {
  const roles = request.adminAuth?.roles ?? [];
  const allowedRoles = ['super_admin', 'operations_admin', 'barista'];
  if (!allowedRoles.some((role) => roles.includes(role))) {
    throw new ApiError(403, 'admin_forbidden', 'You do not have permission to manage orders.');
  }
}

function requireRefundReviewAccess(request: { adminAuth?: { roles?: string[] } }): void {
  const roles = request.adminAuth?.roles ?? [];
  if (!roles.some((role) => ['super_admin', 'operations_admin'].includes(role))) {
    throw new ApiError(403, 'admin_forbidden', 'You do not have permission to review refunds.');
  }
}

function requireFinanceAccess(request: { adminAuth?: { roles?: string[] } }): void {
  const roles = request.adminAuth?.roles ?? [];
  if (!roles.includes('super_admin')) {
    throw new ApiError(403, 'admin_forbidden', 'You do not have permission to view finance data.');
  }
}

const createRefundSchema = z.object({
  order_id: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(10).max(500)
});

const adminListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10000).optional().default(50)
});

export async function registerAdminOrdersRoutes(app: FastifyInstance) {
  app.post('/v1/admin/refunds', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireRefundReviewAccess(request);
    const payload = createRefundSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    let committed = false;

    try {
      await connection.beginTransaction();
      const [orders] = await connection.execute<Array<RowDataPacket & {
        id: number;
        order_ref: string;
        user_id: number;
        payment_mode: 'token' | 'direct';
        final_total_rm: string;
        token_amount_charged: number;
        status: string;
      }>>(
        `
          SELECT o.id, o.order_ref, o.user_id, o.payment_mode, o.final_total_rm,
                 o.token_amount_charged, o.status
          FROM orders o
          JOIN stores s ON s.id = o.store_id
          JOIN admin_tenants t ON t.id = s.tenant_id
          WHERE o.order_ref = :orderRef AND t.code = :tenantCode
          LIMIT 1
          FOR UPDATE
        `,
        { orderRef: payload.order_id, tenantCode: request.adminAuth.tenantCode }
      );
      const order = orders[0];
      if (!order) {
        throw new ApiError(404, 'order_not_found', 'Order not found for this tenant.');
      }
      if (order.payment_mode !== 'token' || order.token_amount_charged <= 0) {
        throw new ApiError(409, 'refund_not_supported', 'Only token-paid orders can be refunded in this workflow.');
      }
      if (['draft', 'pending_payment', 'payment_failed'].includes(order.status)) {
        throw new ApiError(409, 'refund_not_eligible', 'This order is not eligible for a refund request.');
      }
      const [existing] = await connection.execute<Array<RowDataPacket & { id: number }>>(
        `SELECT id FROM refunds WHERE order_id = :orderId AND status IN ('pending', 'approved', 'completed') LIMIT 1 FOR UPDATE`,
        { orderId: order.id }
      );
      if (existing[0]) {
        throw new ApiError(409, 'refund_already_requested', 'A refund request already exists for this order.');
      }
      const [payments] = await connection.execute<Array<RowDataPacket & { id: number }>>(
        `SELECT id FROM payments WHERE order_id = :orderId ORDER BY id DESC LIMIT 1`,
        { orderId: order.id }
      );
      const refundRef = `RFD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const [refundInsert] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO refunds (
            order_id, payment_id, payment_mode, refund_ref, refund_amount_rm,
            refund_token_amount, status, reason, created_by_admin_id, created_at
          ) VALUES (
            :orderId, :paymentId, 'token', :refundRef, :amountRm,
            :tokenAmount, 'pending', :reason, :adminUserId, UTC_TIMESTAMP()
          )
        `,
        {
          orderId: order.id,
          paymentId: payments[0]?.id ?? null,
          refundRef,
          amountRm: order.final_total_rm,
          tokenAmount: order.token_amount_charged,
          reason: payload.reason,
          adminUserId: request.adminAuth.adminUserId
        }
      );
      await connection.execute(
        `
          INSERT INTO admin_audit_logs (
            admin_user_id, effective_roles_json, action_code, target_type, target_id,
            ip_address, user_agent, created_at
          ) VALUES (
            :adminUserId, :roles, 'refund_requested_by_admin', 'refund', :refundId,
            :ipAddress, :userAgent, UTC_TIMESTAMP()
          )
        `,
        {
          adminUserId: request.adminAuth.adminUserId,
          roles: JSON.stringify(request.adminAuth.roles),
          refundId: refundInsert.insertId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null
        }
      );
      await connection.commit();
      committed = true;
      return reply.code(201).send({ refund_ref: refundRef, status: 'pending' });
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/orders', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireOrderAccess(request);
    const { limit } = adminListQuerySchema.parse(request.query);

    const connection = await mysqlPool.getConnection();
    try {
      // 1. Fetch Orders
      const [orderRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          o.id as internal_id,
          o.order_ref as id,
          up.display_name as customer,
          up.email,
          u.phone_e164 as phone,
          u.id as user_id,
          up.avatar_value as avatar,
          o.discount_total_rm as discount,
          o.final_total_rm as total,
          o.token_amount_charged as tokenAmountCharged,
          o.payment_mode as paymentMode,
          o.status as status,
          COALESCE((
            SELECT lts.tier_code
            FROM loyalty_tier_snapshots lts
            WHERE lts.user_id = u.id
            ORDER BY lts.effective_at DESC, lts.id DESC
            LIMIT 1
          ), 'kawan') AS tier_code,
          p.provider as paymentProvider,
          p.status as paymentStatus,
          p.provider_payment_ref as txnId,
          COALESCE(ready_barista.name, preparing_barista.name) as baristaName,
          o.created_at
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN user_profiles up ON u.id = up.user_id
        JOIN stores s ON s.id = o.store_id
        JOIN admin_tenants t ON t.id = s.tenant_id
        LEFT JOIN payments p ON o.id = p.order_id
        LEFT JOIN baristas preparing_barista ON preparing_barista.id = o.preparing_by_barista_id
        LEFT JOIN baristas ready_barista ON ready_barista.id = o.ready_by_barista_id
        WHERE t.code = :tenantCode
        ORDER BY o.created_at DESC
        LIMIT :limit
      `, { tenantCode: request.adminAuth.tenantCode, limit });

      if (orderRows.length === 0) {
        return reply.send({ orders: [] });
      }

      // 2. Fetch Order Items for these orders
      const orderIds = orderRows.map(o => o.internal_id);
      const [itemRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          oi.order_id,
          oi.id as order_item_id,
          oi.item_name_snapshot as name,
          oi.quantity as qty,
          oi.base_price_rm_snapshot as unitPrice,
          mi.image_url as img
        FROM order_items oi
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id IN (?)
      `, [orderIds]);

      const itemIds = itemRows.map(i => i.order_item_id);
      let modifiersByItemId: Record<number, any[]> = {};

      if (itemIds.length > 0) {
        const [modifierRows] = await connection.query<RowDataPacket[]>(`
          SELECT 
            order_item_id,
            modifier_group_name_snapshot as group_name,
            modifier_option_name_snapshot as option_name
          FROM order_item_modifiers
          WHERE order_item_id IN (?)
        `, [itemIds]);

        for (const mod of modifierRows) {
          if (!modifiersByItemId[mod.order_item_id]) {
            modifiersByItemId[mod.order_item_id] = [];
          }
          modifiersByItemId[mod.order_item_id].push({
            group: mod.group_name,
            option: mod.option_name
          });
        }
      }

      // Group items by order_id
      const itemsByOrderId: Record<number, any[]> = {};
      for (const item of itemRows) {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        
        // Map modifiers to specific fields for easy frontend rendering
        let bean, espressoShot, temperature, sparkling, milk, sweetness, iceLevel, remarks;
        const mods = modifiersByItemId[item.order_item_id] || [];
        
        for (const m of mods) {
          const g = m.group.toLowerCase();
          if (g.includes('bean') || g.includes('blend')) bean = m.option;
          else if (g.includes('shot') || g.includes('espresso')) espressoShot = m.option;
          else if (g.includes('temp')) temperature = m.option;
          else if (g.includes('sparkling')) sparkling = m.option;
          else if (g.includes('milk')) milk = m.option;
          else if (g.includes('sweet')) sweetness = m.option;
          else if (g.includes('ice')) iceLevel = m.option;
          else if (g.includes('remark')) remarks = m.option;
        }

        itemsByOrderId[item.order_id].push({
          name: item.name,
          qty: item.qty,
          unitPrice: Number(item.unitPrice || 0),
          img: item.img || '/BOIJITO.png',
          modifiers: mods,
          bean,
          espressoShot,
          temperature,
          sparkling,
          milk,
          sweetness,
          iceLevel,
          remarks
        });
      }

      const formattedOrders = orderRows.map(o => {
        const d = new Date(o.created_at);
        return {
          id: o.id,
          customer: o.customer || 'Unknown',
          email: o.email || '',
          phone: o.phone || '',
          tier: capitalizeWords(String(o.tier_code || 'kawan')),
          memberId: 'C2-' + String(o.user_id).padStart(3, '0'),
          avatar: o.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          items: itemsByOrderId[o.internal_id] || [],
          discount: Number(o.discount || 0),
          total: Number(o.total || 0),
          tokenAmountCharged: Number(o.tokenAmountCharged || 0),
          paymentMode: o.paymentMode || '',
          status: capitalizeWords(o.status),
          payment: o.paymentMode || '',
          paymentStatus: capitalizeWords(o.paymentStatus || ''),
          txnId: o.txnId || `TXN${o.internal_id}`,
          baristaName: o.baristaName || '',
          baristaUsername: '',
          createdAt: d.toISOString(),
          time: formatDisplayTime(d),
          date: formatDisplayDate(d)
        };
      });

      return reply.send({ orders: formattedOrders });
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/finance/overview', { preHandler: authenticateAdminRequest }, async (request) => {
    requireFinanceAccess(request);

    const tenantCode = request.adminAuth.tenantCode;
    const revenueStatusClause = "o.status NOT IN ('draft', 'pending_payment', 'payment_failed', 'cancelled')";
    const completedRefundStatusClause = "r.status NOT IN ('pending', 'failed', 'cancelled', 'rejected', 'under_review', 'reviewing')";
    const connection = await mysqlPool.getConnection();

    try {
      const [orderSummaryRows] = await connection.query<Array<RowDataPacket & {
        total_orders: number;
        active_orders: number;
        completed_orders: number;
        total_revenue_rm: string | number;
        total_tokens_charged: string | number;
      }>>(
        `SELECT
           COUNT(*) AS total_orders,
           COALESCE(SUM(o.status IN ('paid', 'accepted', 'preparing', 'ready_for_pickup')), 0) AS active_orders,
           COALESCE(SUM(o.status = 'collected'), 0) AS completed_orders,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.final_total_rm ELSE 0 END), 0) AS total_revenue_rm,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.token_amount_charged ELSE 0 END), 0) AS total_tokens_charged
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode`,
        { tenantCode }
      );
      const [refundSummaryRows] = await connection.query<Array<RowDataPacket & {
        refunded_orders: number;
        total_refund_rm: string | number;
        total_refund_tokens: string | number;
      }>>(
        `SELECT
           COALESCE(SUM(${completedRefundStatusClause}), 0) AS refunded_orders,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_amount_rm ELSE 0 END), 0) AS total_refund_rm,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_token_amount ELSE 0 END), 0) AS total_refund_tokens
         FROM refunds r
         JOIN orders o ON o.id = r.order_id
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode`,
        { tenantCode }
      );
      const [monthlyOrderRows] = await connection.query<Array<RowDataPacket & {
        month_key: string;
        revenue_rm: string | number;
        tokens_charged: string | number;
        orders: number;
      }>>(
        `SELECT
           DATE_FORMAT(CONVERT_TZ(o.created_at, '+00:00', '+08:00'), '%Y-%m') AS month_key,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.final_total_rm ELSE 0 END), 0) AS revenue_rm,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.token_amount_charged ELSE 0 END), 0) AS tokens_charged,
           COALESCE(SUM(${revenueStatusClause}), 0) AS orders
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
         GROUP BY month_key`,
        { tenantCode }
      );
      const [monthlyRefundRows] = await connection.query<Array<RowDataPacket & {
        month_key: string;
        refund_rm: string | number;
        refund_tokens: string | number;
      }>>(
        `SELECT
           DATE_FORMAT(CONVERT_TZ(r.created_at, '+00:00', '+08:00'), '%Y-%m') AS month_key,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_amount_rm ELSE 0 END), 0) AS refund_rm,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_token_amount ELSE 0 END), 0) AS refund_tokens
         FROM refunds r
         JOIN orders o ON o.id = r.order_id
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
         GROUP BY month_key`,
        { tenantCode }
      );
      const [statusRows] = await connection.query<Array<RowDataPacket & {
        status: string;
        value: number;
        amount_rm: string | number;
      }>>(
        `SELECT o.status, COUNT(*) AS value, COALESCE(SUM(o.final_total_rm), 0) AS amount_rm
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
         GROUP BY o.status
         ORDER BY value DESC, o.status ASC`,
        { tenantCode }
      );
      const [transactionRows] = await connection.query<Array<RowDataPacket & {
        id: string;
        created_at: Date;
        type: 'Order' | 'Refund';
        description: string;
        amount_rm: string | number;
        amount_tokens: string | number;
        status: string;
        payment_status: string;
        payment_mode: string | null;
        reference_id: string;
      }>>(
        `SELECT * FROM (
           SELECT
             CONCAT('ORDER-', o.order_ref) AS id,
             o.created_at,
             'Order' AS type,
             CONCAT('Order ', o.order_ref, CASE WHEN up.display_name IS NULL OR up.display_name = '' THEN '' ELSE CONCAT(' · ', up.display_name) END) AS description,
             o.final_total_rm AS amount_rm,
             o.token_amount_charged AS amount_tokens,
             o.status,
             COALESCE(p.status, '') AS payment_status,
             o.payment_mode,
             COALESCE(p.provider_payment_ref, o.order_ref) AS reference_id
           FROM orders o
           JOIN users u ON u.id = o.user_id
           JOIN user_profiles up ON up.user_id = u.id
           JOIN stores s ON s.id = o.store_id
           JOIN admin_tenants t ON t.id = s.tenant_id
           LEFT JOIN payments p ON p.order_id = o.id
           WHERE t.code = :tenantCode
           UNION ALL
           SELECT
             CONCAT('REFUND-', r.refund_ref) AS id,
             r.created_at,
             'Refund' AS type,
             CONCAT('Refund ', o.order_ref, CASE WHEN r.reason IS NULL OR r.reason = '' THEN '' ELSE CONCAT(' · ', r.reason) END) AS description,
             -r.refund_amount_rm AS amount_rm,
             -r.refund_token_amount AS amount_tokens,
             r.status,
             r.status AS payment_status,
             r.payment_mode,
             r.refund_ref AS reference_id
           FROM refunds r
           JOIN orders o ON o.id = r.order_id
           JOIN stores s ON s.id = o.store_id
           JOIN admin_tenants t ON t.id = s.tenant_id
           WHERE t.code = :tenantCode
         ) AS transactions
         ORDER BY created_at DESC
         LIMIT 50`,
        { tenantCode }
      );

      const monthMap = new Map<string, {
        month: string;
        revenueRm: number;
        refundRm: number;
        tokensCharged: number;
        refundTokens: number;
        orders: number;
      }>();
      const monthLabel = (monthKey: string) => new Intl.DateTimeFormat('en-US', {
        month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur'
      }).format(new Date(`${monthKey}-01T00:00:00+08:00`));
      for (const row of monthlyOrderRows) {
        monthMap.set(row.month_key, {
          month: monthLabel(row.month_key),
          revenueRm: Number(row.revenue_rm || 0),
          refundRm: 0,
          tokensCharged: Number(row.tokens_charged || 0),
          refundTokens: 0,
          orders: Number(row.orders || 0)
        });
      }
      for (const row of monthlyRefundRows) {
        const current = monthMap.get(row.month_key) ?? {
          month: monthLabel(row.month_key), revenueRm: 0, refundRm: 0, tokensCharged: 0, refundTokens: 0, orders: 0
        };
        current.refundRm += Number(row.refund_rm || 0);
        current.refundTokens += Number(row.refund_tokens || 0);
        monthMap.set(row.month_key, current);
      }

      const orders = orderSummaryRows[0] ?? {
        total_orders: 0, active_orders: 0, completed_orders: 0, total_revenue_rm: 0, total_tokens_charged: 0
      };
      const refunds = refundSummaryRows[0] ?? {
        refunded_orders: 0, total_refund_rm: 0, total_refund_tokens: 0
      };
      const totalRevenueRm = Number(orders.total_revenue_rm || 0);
      const totalTokensCharged = Number(orders.total_tokens_charged || 0);
      const totalRefundAmountRm = Number(refunds.total_refund_rm || 0);
      const totalRefundTokens = Number(refunds.total_refund_tokens || 0);

      return {
        summary: {
          totalRevenueRm,
          totalTokensCharged,
          totalRefundAmountRm,
          totalRefundTokens,
          netTokens: totalTokensCharged - totalRefundTokens,
          netRevenueRm: totalRevenueRm - totalRefundAmountRm,
          totalOrders: Number(orders.total_orders || 0),
          activeOrders: Number(orders.active_orders || 0),
          completedOrders: Number(orders.completed_orders || 0),
          refundedOrders: Number(refunds.refunded_orders || 0),
          averageOrderValueRm: Number(orders.total_orders || 0) > 0 ? totalRevenueRm / Number(orders.total_orders) : 0
        },
        monthlyRevenue: Array.from(monthMap.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([, entry]) => ({
            month: entry.month,
            revenueRm: entry.revenueRm,
            refundRm: entry.refundRm,
            netRm: entry.revenueRm - entry.refundRm,
            tokensCharged: entry.tokensCharged,
            refundTokens: entry.refundTokens,
            netTokens: entry.tokensCharged - entry.refundTokens,
            orders: entry.orders
          })),
        statusBreakdown: statusRows.map((row, index) => ({
          name: capitalizeWords(row.status || 'other'),
          value: Number(row.value || 0),
          amountRm: Number(row.amount_rm || 0),
          color: ['#1F3A34', '#2E5E58', '#6F9F96', '#8AACA5', '#E07A5F', '#D4AF7A'][index % 6]
        })),
        recentTransactions: transactionRows.map((row) => ({
          id: row.id,
          date: formatDisplayDate(new Date(row.created_at)),
          time: formatDisplayTime(new Date(row.created_at)),
          type: row.type,
          description: row.description,
          amountRm: Number(row.amount_rm || 0),
          amountTokens: Number(row.amount_tokens || 0),
          status: capitalizeWords(row.status || ''),
          paymentStatus: capitalizeWords(row.payment_status || ''),
          paymentMode: row.payment_mode || '',
          reference: row.reference_id
        }))
      };
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/refunds', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireRefundReviewAccess(request);
    const { limit } = adminListQuerySchema.parse(request.query);
    const connection = await mysqlPool.getConnection();
    try {
      const [refundRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          r.refund_ref as id,
          o.order_ref as orderId,
          up.display_name as customer,
          up.email,
          u.phone_e164 as phone,
          u.id as user_id,
          r.refund_amount_rm as amount_rm,
          r.refund_token_amount as token_amount,
          r.reason as reason,
          r.payment_mode as paymentMethod,
          r.status as status,
          r.created_at as requestedAt,
          r.reviewed_at as reviewedAt,
          o.created_at as orderDate,
          COALESCE((
            SELECT lts.tier_code
            FROM loyalty_tier_snapshots lts
            WHERE lts.user_id = u.id
            ORDER BY lts.effective_at DESC, lts.id DESC
            LIMIT 1
          ), 'kawan') AS tier_code,
          r.reason as customerNotes
        FROM refunds r
        JOIN orders o ON r.order_id = o.id
        JOIN users u ON o.user_id = u.id
        JOIN user_profiles up ON u.id = up.user_id
        JOIN stores s ON s.id = o.store_id
        JOIN admin_tenants t ON t.id = s.tenant_id
        WHERE t.code = :tenantCode
        ORDER BY r.created_at DESC
        LIMIT :limit
      `, { tenantCode: request.adminAuth.tenantCode, limit });

      if (refundRows.length === 0) {
        return reply.send({ refunds: [] });
      }

      const formattedRefunds = refundRows.map(r => {
        const reqDate = new Date(r.requestedAt);
        const ordDate = new Date(r.orderDate);
        
        return {
          id: r.id,
          orderId: r.orderId,
          customer: r.customer || 'Unknown',
          email: r.email || '',
          phone: r.phone || '',
          tier: capitalizeWords(String(r.tier_code || 'kawan')),
          memberId: 'C2-' + String(r.user_id).padStart(3, '0'),
          amountRm: Number(r.amount_rm || 0),
          tokenAmount: Number(r.token_amount || 0),
          reason: r.reason || 'Other',
          paymentMethod: r.paymentMethod || '',
          status: capitalizeWords(r.status),
          requestedAt: `${formatDisplayDate(reqDate)} ${formatDisplayTime(reqDate)}`,
          orderDate: `${formatDisplayDate(ordDate)} – ${formatDisplayTime(ordDate)}`,
          customerNotes: r.customerNotes || '',
          timeline: [
            { label: "Refund Requested", date: `${formatDisplayDate(reqDate)} ${formatDisplayTime(reqDate)}`, done: true },
            { label: "Refund Review", date: r.reviewedAt ? `${formatDisplayDate(new Date(r.reviewedAt))} ${formatDisplayTime(new Date(r.reviewedAt))}` : '', done: r.status !== 'pending' },
            { label: r.status === 'approved' ? "Refund Approved" : "Refund Rejected", date: r.reviewedAt ? `${formatDisplayDate(new Date(r.reviewedAt))} ${formatDisplayTime(new Date(r.reviewedAt))}` : '', done: ['approved', 'rejected'].includes(r.status) }
          ]
        };
      });

      return reply.send({ refunds: formattedRefunds });
    } finally {
      connection.release();
    }
  });

  app.patch('/v1/admin/refunds/:refundRef/review', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireRefundReviewAccess(request);

    const { refundRef } = request.params as { refundRef: string };
    const { decision } = z.object({
      decision: z.enum(['approved', 'rejected'])
    }).parse(request.body);

    const connection = await mysqlPool.getConnection();
    let committed = false;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<Array<RowDataPacket & {
        id: number;
        status: string;
        order_id: number;
        payment_mode: 'token' | 'direct';
        refund_token_amount: number | null;
        user_id: number;
        order_status: string;
        order_ref: string;
      }>>(
        `
          SELECT r.id, r.status, r.order_id, r.payment_mode, r.refund_token_amount,
                 o.user_id, o.status AS order_status, o.order_ref
          FROM refunds r
          JOIN orders o ON o.id = r.order_id
          JOIN stores s ON s.id = o.store_id
          JOIN admin_tenants t ON t.id = s.tenant_id
          WHERE r.refund_ref = :refundRef
            AND t.code = :tenantCode
          LIMIT 1
          FOR UPDATE
        `,
        { refundRef, tenantCode: request.adminAuth.tenantCode }
      );
      const refund = rows[0];
      if (!refund) {
        throw new ApiError(404, 'refund_not_found', 'Refund request not found.');
      }
      if (refund.status !== 'pending') {
        throw new ApiError(409, 'refund_already_reviewed', 'This refund request has already been reviewed.');
      }

      if (decision === 'approved' && refund.payment_mode === 'token') {
        const tokenAmount = Number(refund.refund_token_amount ?? 0);
        if (tokenAmount <= 0) {
          throw new ApiError(409, 'refund_amount_invalid', 'This refund does not have a token amount to return.');
        }
        const [accounts] = await connection.execute<Array<RowDataPacket & { balance_available: number }>>(
          `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
          { userId: refund.user_id }
        );
        const account = accounts[0];
        if (!account) {
          throw new ApiError(409, 'token_account_not_found', 'The customer token account was not found.');
        }
        const balanceAfter = Number(account.balance_available) + tokenAmount;
        await connection.execute(
          `UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`,
          { balanceAfter, userId: refund.user_id }
        );
        await connection.execute(
          `
            INSERT INTO token_ledger (
              user_id, token_lot_id, direction, source_type, source_id, amount,
              balance_after, remarks, created_by_admin_id, created_at
            ) VALUES (
              :userId, NULL, 'credit', 'refund_return', :refundId, :amount,
              :balanceAfter, :remarks, :adminUserId, UTC_TIMESTAMP()
            )
          `,
          {
            userId: refund.user_id,
            refundId: refund.id,
            amount: tokenAmount,
            balanceAfter,
            remarks: `Approved refund for ${refundRef}`,
            adminUserId: request.adminAuth.adminUserId
          }
        );
        await connection.execute(
          `UPDATE orders SET status = 'refunded', updated_at = UTC_TIMESTAMP() WHERE id = :orderId`,
          { orderId: refund.order_id }
        );
        await connection.execute(
          `
            INSERT INTO order_status_history (
              order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at
            )
            VALUES (
              :orderId, :fromStatus, 'refunded', 'admin', :adminUserId, :reason, UTC_TIMESTAMP()
            )
          `,
          {
            orderId: refund.order_id,
            fromStatus: refund.order_status,
            adminUserId: request.adminAuth.adminUserId,
            reason: `Approved refund ${refundRef}`
          }
        );
        await createUserNotification(connection, {
          userId: refund.user_id,
          type: 'refund_completed',
          title: 'Refund approved',
          body: `${tokenAmount} tokens have been returned for order ${refund.order_ref}.`,
          data: { order_ref: refund.order_ref, refund_ref: refundRef }
        });
      }

      await connection.execute(
        `
          UPDATE refunds
          SET status = :decision,
              reviewed_by_admin_id = :adminUserId,
              reviewed_at = UTC_TIMESTAMP(),
              completed_at = CASE WHEN :decision = 'approved' THEN UTC_TIMESTAMP() ELSE completed_at END
          WHERE id = :refundId
        `,
        { decision, adminUserId: request.adminAuth.adminUserId, refundId: refund.id }
      );
      await connection.execute(
        `
          INSERT INTO admin_audit_logs (
            admin_user_id, effective_roles_json, action_code, target_type, target_id,
            ip_address, user_agent, created_at
          ) VALUES (
            :adminUserId, :roles, :actionCode, 'refund', :refundId,
            :ipAddress, :userAgent, UTC_TIMESTAMP()
          )
        `,
        {
          adminUserId: request.adminAuth.adminUserId,
          roles: JSON.stringify(request.adminAuth.roles),
          actionCode: `refund_${decision}`,
          refundId: refund.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null
        }
      );
      await connection.commit();
      committed = true;

      return reply.send({ refund_ref: refundRef, status: decision });
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.patch('/v1/admin/orders/:orderId/status', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireOrderAccess(request);

    const { orderId } = request.params as { orderId: string };
    const { status, barista_id: baristaId } = z.object({
      status: z.string().trim(),
      barista_id: z.coerce.number().int().positive().optional()
    }).parse(request.body);

    if (!['preparing', 'ready_for_pickup', 'collected', 'completed'].includes(status)) {
      return reply.status(400).send({ error: { code: 'invalid_status', message: 'Invalid status' } });
    }

    const effectiveStatus = status === 'completed' ? 'collected' : status;

    if (['preparing', 'ready_for_pickup'].includes(effectiveStatus) && !baristaId) {
      throw new ApiError(400, 'barista_required', 'Select the Barista preparing this order.');
    }

    const connection = await mysqlPool.getConnection();
    let committed = false;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT o.id, o.user_id, o.status
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE o.order_ref = :orderId
           AND t.code = :tenantCode
         LIMIT 1
         FOR UPDATE`,
        { orderId, tenantCode: request.adminAuth.tenantCode }
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'Order not found' } });
      }

      const internalId = rows[0].id;
      const fromStatus = rows[0].status;

      if (fromStatus === effectiveStatus) {
        await connection.commit();
        committed = true;
        return reply.send({ success: true, status: effectiveStatus, unchanged: true });
      }

      const allowedPreviousStatuses: Record<string, string[]> = {
        preparing: ['paid', 'accepted'],
        ready_for_pickup: ['preparing'],
        collected: ['ready_for_pickup']
      };

      if (request.adminAuth.roles.includes('barista') && effectiveStatus === 'collected') {
        throw new ApiError(403, 'collection_customer_only', 'Customers confirm collection in the mobile app.');
      }

      if (!(allowedPreviousStatuses[effectiveStatus] ?? []).includes(fromStatus)) {
        throw new ApiError(
          409,
          'invalid_order_transition',
          `This order is already ${capitalizeWords(fromStatus)} and cannot be changed to ${capitalizeWords(effectiveStatus)}.`
        );
      }

      const timestampUpdates: string[] = [];
      let baristaName = '';

      if (baristaId) {
        const [baristaRows] = await connection.execute<RowDataPacket[]>(
          `SELECT id, name
           FROM baristas
           WHERE id = :baristaId
             AND tenant_code = :tenantCode
             AND is_active = true
           LIMIT 1`,
          { baristaId, tenantCode: request.adminAuth.tenantCode }
        );

        if (baristaRows.length === 0) {
          throw new ApiError(400, 'barista_unavailable', 'The selected Barista is no longer active.');
        }

        baristaName = baristaRows[0].name;
      }

      if (effectiveStatus === 'preparing') {
        timestampUpdates.push(
          'accepted_at = COALESCE(accepted_at, UTC_TIMESTAMP())',
          'preparing_by_admin_user_id = :adminUserId',
          'preparing_by_barista_id = :baristaId'
        );
      }

      if (effectiveStatus === 'ready_for_pickup') {
        timestampUpdates.push(
          'accepted_at = COALESCE(accepted_at, UTC_TIMESTAMP())',
          'preparing_by_admin_user_id = COALESCE(preparing_by_admin_user_id, :adminUserId)',
          'preparing_by_barista_id = COALESCE(preparing_by_barista_id, :baristaId)',
          'ready_at = COALESCE(ready_at, UTC_TIMESTAMP())',
          'ready_by_admin_user_id = :adminUserId',
          'ready_by_barista_id = :baristaId'
        );
      }

      if (effectiveStatus === 'collected') {
        timestampUpdates.push(
          'ready_at = COALESCE(ready_at, UTC_TIMESTAMP())',
          'ready_by_admin_user_id = COALESCE(ready_by_admin_user_id, :adminUserId)',
          'collected_at = COALESCE(collected_at, UTC_TIMESTAMP())'
        );
      }

      await connection.execute(
        `
          UPDATE orders
          SET status = :status
              ${timestampUpdates.length > 0 ? `, ${timestampUpdates.join(', ')}` : ''}
          WHERE id = :internalId
        `,
        { status: effectiveStatus, internalId, adminUserId: request.adminAuth.adminUserId, baristaId: baristaId ?? null }
      );

      // Insert into order_status_history
      await connection.execute(
        `
          INSERT INTO order_status_history (
            order_id,
            from_status,
            to_status,
            changed_by_type,
            changed_by_id,
            reason,
            created_at
          )
          VALUES (
            :internalId,
            :fromStatus,
            :status,
            'admin',
            :adminUserId,
            :reason,
            UTC_TIMESTAMP()
          )
        `,
        {
          internalId,
          fromStatus,
          status: effectiveStatus,
          adminUserId: request.adminAuth.adminUserId,
          reason: `Updated by ${baristaName || request.adminAuth.fullName || request.adminAuth.username}`
        }
      );

      // Super admins may record collection on behalf of a customer. Keep the
      // reward outcome identical to customer-confirmed collection.
      if (effectiveStatus === 'collected') {
        await processOrderLoyalty(internalId, Number(rows[0].user_id), connection);
        await awardReferralForCollectedOrder(connection, Number(rows[0].user_id), internalId);
      }

      await connection.commit();
      committed = true;
      return reply.send({
        success: true,
        status: effectiveStatus,
        barista: {
          id: baristaId ?? null,
          name: baristaName,
          username: ''
        }
      });
    } catch (error) {
      if (!committed) {
        await connection.rollback();
      }
      throw error;
    } finally {
      connection.release();
    }
  });
}
