import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateRequest } from '../../auth/guard.js';
import { mysqlPool } from '../../db/mysql.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

type WalletTransactionRow = RowDataPacket & {
  id: number;
  direction: 'credit' | 'debit';
  source_type:
    | 'topup_paid'
    | 'order_spend'
    | 'refund_return'
    | 'expiry'
    | 'admin_adjustment'
    | 'promo_credit'
    | 'voucher_subsidy';
  source_id: number;
  amount: number;
  balance_after: number;
  remarks: string | null;
  created_at: Date;
};

type VoucherRow = RowDataPacket & {
  id: number;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  issued_reason: string;
  issue_case_ref: string | null;
  tier_at_issue: 'kawan' | 'dilamun' | 'ketagih' | 'legend' | null;
  issued_at: Date;
  expires_at: Date;
  redeemed_at: Date | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  template_code: string;
  template_name: string;
  voucher_type:
    | 'welcome'
    | 'tier_reward'
    | 'birthday_treat'
    | 'referral'
    | 'manual_recovery'
    | 'campaign_direct_pay'
    | 'campaign_token_equivalent';
  discount_mode: 'fixed_rm' | 'percent_rm' | 'fixed_token' | 'free_drink';
  discount_value: string;
  token_value: number | null;
  min_spend_rm: string | null;
  requires_drink_in_cart: number;
};

type OrderSummaryRow = RowDataPacket & {
  id: number;
  order_ref: string;
  status:
    | 'draft'
    | 'pending_payment'
    | 'payment_failed'
    | 'paid'
    | 'accepted'
    | 'preparing'
    | 'ready_for_pickup'
    | 'collected'
    | 'cancelled'
    | 'refunded';
  payment_mode: 'token' | 'direct';
  final_total_rm: string;
  token_amount_charged: number;
  pickup_slot_at: Date;
  created_at: Date;
  store_id: number;
  store_name: string;
  item_count: number;
  primary_item_name: string | null;
};

type OrderItemRow = RowDataPacket & {
  order_id: number;
  item_id: number;
  item_name_snapshot: string;
  base_price_rm_snapshot: string;
  token_price_snapshot: number | null;
  quantity: number;
  line_subtotal_rm: string;
  line_token_amount: number | null;
  is_qualifying_cup: number;
};

type OrderStatusHistoryRow = RowDataPacket & {
  order_id: number;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: Date;
};

export async function registerCustomerDataRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get('/v1/wallet/transactions', { preHandler: authenticateRequest }, async (request) => {
    const { limit } = listQuerySchema.parse(request.query);

    const [rows] = await mysqlPool.query<Array<WalletTransactionRow>>(
      `
        SELECT
          id,
          direction,
          source_type,
          source_id,
          amount,
          balance_after,
          remarks,
          created_at
        FROM token_ledger
        WHERE user_id = :userId
        ORDER BY created_at DESC, id DESC
        LIMIT :limit
      `,
      {
        userId: request.auth.userId,
        limit
      }
    );

    return {
      transactions: rows.map((row) => ({
        id: row.id,
        direction: row.direction,
        source_type: row.source_type,
        source_id: row.source_id,
        amount: row.amount,
        balance_after: row.balance_after,
        remarks: row.remarks,
        created_at: row.created_at.toISOString()
      }))
    };
  });

  app.get('/v1/rewards/vouchers', { preHandler: authenticateRequest }, async (request) => {
    const { limit } = listQuerySchema.parse(request.query);

    const [rows] = await mysqlPool.query<Array<VoucherRow>>(
      `
        SELECT
          uv.id,
          uv.status,
          uv.issued_reason,
          uv.issue_case_ref,
          uv.tier_at_issue,
          uv.issued_at,
          uv.expires_at,
          uv.redeemed_at,
          uv.revoked_at,
          uv.revoked_reason,
          vt.code AS template_code,
          vt.name AS template_name,
          vt.voucher_type,
          vt.discount_mode,
          CAST(vt.discount_value AS CHAR) AS discount_value,
          vt.token_value,
          CAST(vt.min_spend_rm AS CHAR) AS min_spend_rm,
          vt.requires_drink_in_cart
        FROM user_vouchers uv
        JOIN voucher_templates vt
          ON vt.id = uv.voucher_template_id
        WHERE uv.user_id = :userId
        ORDER BY uv.issued_at DESC, uv.id DESC
        LIMIT :limit
      `,
      {
        userId: request.auth.userId,
        limit
      }
    );

    return {
      vouchers: rows.map((row) => ({
        id: row.id,
        status: row.status,
        issued_reason: row.issued_reason,
        issue_case_ref: row.issue_case_ref,
        tier_at_issue: row.tier_at_issue,
        issued_at: row.issued_at.toISOString(),
        expires_at: row.expires_at.toISOString(),
        redeemed_at: row.redeemed_at?.toISOString() ?? null,
        revoked_at: row.revoked_at?.toISOString() ?? null,
        revoked_reason: row.revoked_reason,
        template: {
          code: row.template_code,
          name: row.template_name,
          voucher_type: row.voucher_type,
          discount_mode: row.discount_mode,
          discount_value: row.discount_value,
          token_value: row.token_value,
          min_spend_rm: row.min_spend_rm,
          requires_drink_in_cart: row.requires_drink_in_cart === 1
        }
      }))
    };
  });

  app.get('/v1/orders', { preHandler: authenticateRequest }, async (request) => {
    const { limit } = listQuerySchema.parse(request.query);

    const [rows] = await mysqlPool.query<Array<OrderSummaryRow>>(
      `
        SELECT
          o.id,
          o.order_ref,
          o.status,
          o.payment_mode,
          CAST(o.final_total_rm AS CHAR) AS final_total_rm,
          o.token_amount_charged,
          o.pickup_slot_at,
          o.created_at,
          s.id AS store_id,
          s.name AS store_name,
          COUNT(oi.id) AS item_count,
          MIN(oi.item_name_snapshot) AS primary_item_name
        FROM orders o
        JOIN stores s
          ON s.id = o.store_id
        LEFT JOIN order_items oi
          ON oi.order_id = o.id
        WHERE o.user_id = :userId
        GROUP BY
          o.id,
          o.order_ref,
          o.status,
          o.payment_mode,
          o.final_total_rm,
          o.token_amount_charged,
          o.pickup_slot_at,
          o.created_at,
          s.id,
          s.name
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT :limit
      `,
      {
        userId: request.auth.userId,
        limit
      }
    );

    if (rows.length === 0) {
      return {
        active_order: null,
        orders: []
      };
    }

    const orderIds = rows.map((row) => row.id);

    const [itemRows] = await mysqlPool.query<Array<OrderItemRow>>(
      `
        SELECT
          order_id,
          id AS item_id,
          item_name_snapshot,
          CAST(base_price_rm_snapshot AS CHAR) AS base_price_rm_snapshot,
          token_price_snapshot,
          quantity,
          CAST(line_subtotal_rm AS CHAR) AS line_subtotal_rm,
          line_token_amount,
          is_qualifying_cup
        FROM order_items
        WHERE order_id IN (:orderIds)
        ORDER BY order_id ASC, id ASC
      `,
      { orderIds }
    );

    const [historyRows] = await mysqlPool.query<Array<OrderStatusHistoryRow>>(
      `
        SELECT
          order_id,
          from_status,
          to_status,
          reason,
          created_at
        FROM order_status_history
        WHERE order_id IN (:orderIds)
        ORDER BY order_id ASC, created_at ASC, id ASC
      `,
      { orderIds }
    );

    const itemsByOrder = new Map<number, Array<Record<string, unknown>>>();
    for (const row of itemRows) {
      const items = itemsByOrder.get(row.order_id) ?? [];
      items.push({
        id: row.item_id,
        name: row.item_name_snapshot,
        base_price_rm: row.base_price_rm_snapshot,
        token_price: row.token_price_snapshot,
        quantity: row.quantity,
        line_subtotal_rm: row.line_subtotal_rm,
        line_token_amount: row.line_token_amount,
        is_qualifying_cup: row.is_qualifying_cup === 1
      });
      itemsByOrder.set(row.order_id, items);
    }

    const historyByOrder = new Map<number, Array<Record<string, unknown>>>();
    for (const row of historyRows) {
      const history = historyByOrder.get(row.order_id) ?? [];
      history.push({
        from_status: row.from_status,
        to_status: row.to_status,
        reason: row.reason,
        created_at: row.created_at.toISOString()
      });
      historyByOrder.set(row.order_id, history);
    }

    const orders = rows.map((row) => ({
      id: row.id,
      order_ref: row.order_ref,
      status: row.status,
      payment_mode: row.payment_mode,
      final_total_rm: row.final_total_rm,
      token_amount_charged: row.token_amount_charged,
      pickup_slot_at: row.pickup_slot_at.toISOString(),
      created_at: row.created_at.toISOString(),
      store: {
        id: row.store_id,
        name: row.store_name
      },
      item_count: row.item_count,
      primary_item_name: row.primary_item_name,
      items: itemsByOrder.get(row.id) ?? [],
      status_history: historyByOrder.get(row.id) ?? []
    }));

    const activeOrder =
      orders.find((order) => _isActiveOrderStatus(order.status)) ?? null;

    return {
      active_order: activeOrder,
      orders
    };
  });
}

function _isActiveOrderStatus(status: string): boolean {
  switch (status) {
    case 'pending_payment':
    case 'paid':
    case 'accepted':
    case 'preparing':
    case 'ready_for_pickup':
      return true;
    default:
      return false;
  }
}
