import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateRequest } from '../../auth/guard.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { createUserNotification } from '../notifications.js';
import {
  isCustomerActiveOrderStatus,
  resolveOrderLifecycleStatus
} from '../order-lifecycle.js';

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

type AutoSyncVoucherTemplateRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  expires_in_days: number | null;
  valid_until: Date | null;
  eligible_scope_json: string | Record<string, unknown> | null;
};

type OrderSummaryRow = RowDataPacket & {
  id: number;
  order_ref: string;
  daily_order_number: number;
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
  paid_at: Date | null;
  accepted_at: Date | null;
  ready_at: Date | null;
  collected_at: Date | null;
  created_at: Date;
  updated_at: Date;
  store_id: number;
  store_name: string;
  item_count: number;
  primary_item_name: string | null;
};

type OrderItemRow = RowDataPacket & {
  order_id: number;
  item_id: number;
  menu_item_id: number;
  item_name_snapshot: string;
  base_price_rm_snapshot: string;
  token_price_snapshot: number | null;
  quantity: number;
  line_subtotal_rm: string;
  line_token_amount: number | null;
  is_qualifying_cup: number;
};

type OrderItemModifierRow = RowDataPacket & {
  order_item_id: number;
  modifier_group_name_snapshot: string;
  modifier_option_name_snapshot: string;
  price_delta_rm_snapshot: string;
  token_price_delta_snapshot: number;
};

type OrderStatusHistoryRow = RowDataPacket & {
  order_id: number;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: Date;
};

type NotificationRow = RowDataPacket & {
  id: number;
  type: string;
  title: string;
  body: string;
  data_json: string | null;
  sent_at: Date | null;
  read_at: Date | null;
  created_at: Date;
};

const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});

function parseVoucherScope(
  value: unknown
): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeTierLabel(value: unknown): string | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw === 'all tiers') return null;
  if (raw === 'legend' || raw === 'kawan' || raw === 'dilamun' || raw === 'ketagih') {
    return raw;
  }
  return null;
}

function isAutoVisibleAudience(scope: Record<string, unknown>): boolean {
  return String(scope['audience'] ?? '').trim() === 'all_customers';
}

function resolveAutoIssuedVoucherExpiry(
  template: AutoSyncVoucherTemplateRow
): Date {
  if (template.valid_until instanceof Date) {
    return template.valid_until;
  }

  if (typeof template.expires_in_days === 'number' && template.expires_in_days > 0) {
    return new Date(Date.now() + template.expires_in_days * 24 * 60 * 60 * 1000);
  }

  return new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000);
}

async function syncAutoVisibleVoucherTemplates(
  userId: number
): Promise<void> {
  const [tierRows] = await mysqlPool.query<
    Array<RowDataPacket & { tier_code: string | null }>
  >(
    `
      SELECT tier_code
      FROM loyalty_tier_snapshots
      WHERE user_id = :userId
      ORDER BY effective_at DESC, id DESC
      LIMIT 1
    `,
    { userId }
  );

  const currentTier = tierRows[0]?.tier_code ?? 'kawan';

  const [templates] = await mysqlPool.query<Array<AutoSyncVoucherTemplateRow>>(
    `
      SELECT
        id,
        code,
        name,
        expires_in_days,
        valid_until,
        eligible_scope_json
      FROM voucher_templates
      WHERE is_active = 1
      ORDER BY created_at DESC, id DESC
    `
  );

  const [existingRows] = await mysqlPool.query<
    Array<RowDataPacket & { voucher_template_id: number }>
  >(
    `
      SELECT DISTINCT voucher_template_id
      FROM user_vouchers
      WHERE user_id = :userId
    `,
    { userId }
  );

  const existingTemplateIds = new Set(
    existingRows.map((row) => Number(row.voucher_template_id))
  );

  for (const template of templates) {
    if (existingTemplateIds.has(template.id)) {
      continue;
    }

    const scope = parseVoucherScope(template.eligible_scope_json);
    if (!isAutoVisibleAudience(scope)) {
      continue;
    }

    const eligibleTier = normalizeTierLabel(scope['tier']);
    if (eligibleTier != null && eligibleTier !== currentTier) {
      continue;
    }

    const expiresAt = resolveAutoIssuedVoucherExpiry(template);
    if (expiresAt.getTime() <= Date.now()) {
      continue;
    }

    await mysqlPool.execute(
      `
        INSERT INTO user_vouchers (
          user_id,
          voucher_template_id,
          status,
          issued_by_type,
          issued_reason,
          issued_at,
          expires_at
        )
        VALUES (
          :userId,
          :templateId,
          'active',
          'system',
          :issuedReason,
          UTC_TIMESTAMP(),
          :expiresAt
        )
      `,
      {
        userId,
        templateId: template.id,
        issuedReason: `Campaign voucher: ${template.name}`,
        expiresAt
      }
    );

    existingTemplateIds.add(template.id);
  }
}

export async function registerCustomerDataRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get('/v1/notifications', { preHandler: authenticateRequest }, async (request) => {
    const { limit } = notificationListQuerySchema.parse(request.query);

    let rows: Array<NotificationRow> = [];
    try {
      const [result] = await mysqlPool.query<Array<NotificationRow>>(
        `
          SELECT
            id,
            type,
            title,
            body,
            data_json,
            sent_at,
            read_at,
            created_at
          FROM notifications
          WHERE user_id = :userId
          ORDER BY read_at IS NULL DESC, created_at DESC, id DESC
          LIMIT :limit
        `,
        {
          userId: request.auth.userId,
          limit
        }
      );
      rows = result;
    } catch (error) {
      const err = error as { code?: string; sqlMessage?: string };
      if (err.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }
      console.warn(
        `[notifications] skipped notification list because the table is missing: ${err.sqlMessage ?? 'unknown SQL error'}`
      );
    }

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        data:
          row.data_json == null
            ? null
            : typeof row.data_json === 'string'
              ? JSON.parse(row.data_json)
              : row.data_json,
        is_read: row.read_at !== null,
        created_at: row.created_at.toISOString()
      }))
    };
  });

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
    const userId = request.auth.userId;

    const [welcomeRows] = await mysqlPool.query<
      Array<RowDataPacket & { id: number; expires_in_days: number }>
    >(
      `
        SELECT vt.id, vt.expires_in_days
        FROM voucher_templates vt
        WHERE vt.code = 'WELCOME10'
          AND vt.is_active = 1
          AND NOT EXISTS (
            SELECT 1
            FROM user_vouchers uv
            WHERE uv.user_id = :userId
              AND uv.voucher_template_id = vt.id
          )
      `,
      { userId }
    );

    for (const tpl of welcomeRows) {
      await mysqlPool.execute(
        `
          INSERT INTO user_vouchers (
            user_id,
            voucher_template_id,
            status,
            issued_by_type,
            issued_reason,
            issued_at,
            expires_at
          )
          VALUES (
            :userId,
            :templateId,
            'active',
            'system',
            'Welcome Gift Voucher',
            UTC_TIMESTAMP(),
            DATE_ADD(UTC_TIMESTAMP(), INTERVAL :days DAY)
          )
        `,
        {
          userId,
          templateId: tpl.id,
          days: tpl.expires_in_days || 30
        }
      );
    }

    await syncAutoVisibleVoucherTemplates(userId);

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
          vt.requires_drink_in_cart,
          vt.eligible_scope_json,
          vt.exclude_scope_json
        FROM user_vouchers uv
        JOIN voucher_templates vt
          ON vt.id = uv.voucher_template_id
        WHERE uv.user_id = :userId
          AND uv.status = 'active'
          AND uv.redeemed_at IS NULL
          AND uv.revoked_at IS NULL
          AND vt.is_active = 1
        ORDER BY uv.issued_at DESC, uv.id DESC
        LIMIT :limit
      `,
      {
        userId,
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
          requires_drink_in_cart: row.requires_drink_in_cart === 1,
          eligible_scope_json: row.eligible_scope_json,
          exclude_scope_json: row.exclude_scope_json
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
            o.daily_order_number,
            o.status,
          o.payment_mode,
          CAST(o.final_total_rm AS CHAR) AS final_total_rm,
          o.token_amount_charged,
          o.pickup_slot_at,
          o.paid_at,
          o.accepted_at,
          o.ready_at,
          o.collected_at,
          o.created_at,
          o.updated_at,
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
          o.daily_order_number,
          o.status,
          o.payment_mode,
          o.final_total_rm,
          o.token_amount_charged,
          o.pickup_slot_at,
          o.paid_at,
          o.accepted_at,
          o.ready_at,
          o.collected_at,
          o.created_at,
          o.updated_at,
          s.id,
          s.name
        ORDER BY o.id DESC
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
          menu_item_id,
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

    const [modifierRows] = await mysqlPool.query<Array<OrderItemModifierRow>>(
      `
        SELECT
          order_item_id,
          modifier_group_name_snapshot,
          modifier_option_name_snapshot,
          CAST(price_delta_rm_snapshot AS CHAR) AS price_delta_rm_snapshot,
          token_price_delta_snapshot
        FROM order_item_modifiers
        WHERE order_item_id IN (
          SELECT id
          FROM order_items
          WHERE order_id IN (:orderIds)
        )
        ORDER BY order_item_id ASC, id ASC
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
    const modifiersByOrderItem = new Map<number, Array<Record<string, unknown>>>();
    for (const row of modifierRows) {
      const modifiers = modifiersByOrderItem.get(row.order_item_id) ?? [];
      modifiers.push({
        group_name: row.modifier_group_name_snapshot,
        option_name: row.modifier_option_name_snapshot,
        price_delta_rm: row.price_delta_rm_snapshot,
        token_price_delta: row.token_price_delta_snapshot
      });
      modifiersByOrderItem.set(row.order_item_id, modifiers);
    }

    for (const row of itemRows) {
      const items = itemsByOrder.get(row.order_id) ?? [];
      const itemModifiers =
        modifiersByOrderItem.get(row.item_id) ?? [];
      items.push({
        id: row.item_id,
        menu_item_id: row.menu_item_id,
        name: row.item_name_snapshot,
        base_price_rm: row.base_price_rm_snapshot,
        token_price: row.token_price_snapshot,
        quantity: row.quantity,
        line_subtotal_rm: row.line_subtotal_rm,
        line_token_amount: row.line_token_amount,
        is_qualifying_cup: row.is_qualifying_cup === 1,
        modifiers: itemModifiers
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

    const orders = rows.map((row) => {
      const status = resolveOrderLifecycleStatus({
        status: row.status,
        createdAt: row.created_at,
        paidAt: row.paid_at,
        acceptedAt: row.accepted_at,
        readyAt: row.ready_at,
        collectedAt: row.collected_at
      });

      return {
        id: row.id,
        order_ref: row.order_ref,
        daily_order_number: row.daily_order_number,
        status,
        payment_mode: row.payment_mode,
        final_total_rm: row.final_total_rm,
        token_amount_charged: row.token_amount_charged,
        pickup_slot_at: row.pickup_slot_at.toISOString(),
        collected_at: row.collected_at?.toISOString() ?? null,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
        store: {
          id: row.store_id,
          name: row.store_name
        },
        item_count: row.item_count,
        primary_item_name: row.primary_item_name,
        items: itemsByOrder.get(row.id) ?? [],
        status_history: historyByOrder.get(row.id) ?? []
      };
    });

    const activeOrder =
      orders.find((order) => isCustomerActiveOrderStatus(order.status)) ?? null;

    return {
      active_order: activeOrder,
      orders
    };
  });

  const topupSchema = z.object({
    token_amount: z.coerce.number().int().min(1).max(500),
    provider: z.literal('touch_n_go_sandbox').default('touch_n_go_sandbox')
  });

  app.post('/v1/wallet/topup', { preHandler: authenticateRequest }, async (request) => {
    const payload = topupSchema.parse(request.body ?? {});
    const connection = await getUtcConnection();
    let committed = false;

    try {
      await connection.beginTransaction();

      const [accountRows] = await connection.query<
        Array<RowDataPacket & {
          balance_available: number;
          balance_reserved: number;
          balance_cap: number;
        }>
      >(
        `
          SELECT balance_available, balance_reserved, balance_cap
          FROM token_accounts
          WHERE user_id = :userId
          LIMIT 1
          FOR UPDATE
        `,
        { userId: request.auth.userId }
      );

      const account = accountRows[0];
      if (!account) {
        throw new ApiError(404, 'token_account_missing', 'Wallet account was not found.');
      }

      const newBalance = account.balance_available + payload.token_amount;
      if (newBalance > account.balance_cap) {
        throw new ApiError(
          400,
          'token_cap_exceeded',
          `Top-up would exceed maximum wallet balance cap of ${account.balance_cap} tokens.`
        );
      }

      const topupRef = `TOP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const rmAmount = (payload.token_amount * 1.0).toFixed(2);

      const [topupResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO token_topups (
            user_id,
            topup_ref,
            token_amount,
            rm_amount,
            status,
            created_at,
            paid_at
          )
          VALUES (
            :userId,
            :topupRef,
            :tokenAmount,
            :rmAmount,
            'paid',
            UTC_TIMESTAMP(),
            UTC_TIMESTAMP()
          )
        `,
        {
          userId: request.auth.userId,
          topupRef,
          tokenAmount: payload.token_amount,
          rmAmount
        }
      );

      const topupId = topupResult.insertId;

      const [lotResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO token_lots (
            user_id,
            source_topup_id,
            original_amount,
            remaining_amount,
            expires_at,
            status,
            created_at
          )
          VALUES (
            :userId,
            :topupId,
            :tokenAmount,
            :tokenAmount,
            DATE_ADD(UTC_TIMESTAMP(), INTERVAL 180 DAY),
            'active',
            UTC_TIMESTAMP()
          )
        `,
        {
          userId: request.auth.userId,
          topupId,
          tokenAmount: payload.token_amount
        }
      );

      const lotId = lotResult.insertId;

      await connection.execute(
        `
          INSERT INTO token_ledger (
            user_id,
            token_lot_id,
            direction,
            source_type,
            source_id,
            amount,
            balance_after,
            remarks,
            created_at
          )
          VALUES (
            :userId,
            :lotId,
            'credit',
            'topup_paid',
            :topupId,
            :tokenAmount,
            :balanceAfter,
            :remarks,
            UTC_TIMESTAMP()
          )
        `,
        {
          userId: request.auth.userId,
          lotId,
          topupId,
          tokenAmount: payload.token_amount,
          balanceAfter: newBalance,
          remarks: `Top up ${payload.token_amount} tokens via Touch 'n Go sandbox payment`
        }
      );

      await connection.execute(
        `
          UPDATE token_accounts
          SET balance_available = :newBalance,
              updated_at = UTC_TIMESTAMP()
          WHERE user_id = :userId
        `,
        {
          newBalance,
          userId: request.auth.userId
        }
      );

      const paymentRef = `PAY-${topupRef}`;
      await connection.execute(
        `
          INSERT INTO payments (
            order_id,
            topup_id,
            provider,
            provider_payment_ref,
            provider_bill_id,
            amount_rm,
            status,
            paid_at,
            created_at
          )
          VALUES (
            NULL,
            :topupId,
            :provider,
            :paymentRef,
            NULL,
            :amountRm,
            'paid',
            UTC_TIMESTAMP(),
            UTC_TIMESTAMP()
          )
        `,
        {
          topupId,
          provider: payload.provider,
          paymentRef,
          amountRm: rmAmount
        }
      );

      await createUserNotification(connection, {
        userId: request.auth.userId,
        type: 'topup_paid',
        title: 'Token top-up successful',
        body: `Your C2 Token balance has been topped up with ${payload.token_amount} tokens.`,
        data: {
          topup_ref: topupRef,
          token_amount: payload.token_amount,
          balance_after: newBalance
        }
      });

      await connection.commit();
      committed = true;

      return {
        success: true,
        topup_ref: topupRef,
        token_amount_added: payload.token_amount,
        token_balance: newBalance,
        token_reserved: account.balance_reserved,
        token_cap: account.balance_cap
      };
    } finally {
      if (!committed) {
        await connection.rollback();
      }
      connection.release();
    }
  });

  app.get('/v1/referrals', { preHandler: authenticateRequest }, async (request) => {
    const userId = request.auth.userId;

    const [userRows] = await mysqlPool.query<
      Array<RowDataPacket & { id: number; phone_e164: string }>
    >(
      `
        SELECT id, phone_e164
        FROM users
        WHERE id = :userId
        LIMIT 1
      `,
      { userId }
    );

    const user = userRows[0];
    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found.');
    }

    const phoneDigits = user.phone_e164.replace(/[^0-9]/g, '');
    const phoneSuffix = phoneDigits.slice(-4);
    const referralCode = `C2-${phoneSuffix || user.id.toString().padStart(4, '0')}`.toUpperCase();

    const [referredRows] = await mysqlPool.query<
      Array<RowDataPacket & {
        id: number;
        status: 'pending' | 'qualified' | 'rewarded' | 'rejected';
        created_at: Date;
        rewarded_at: Date | null;
      }>
    >(
      `
        SELECT id, status, created_at, rewarded_at
        FROM referrals
        WHERE referrer_user_id = :userId
        ORDER BY created_at DESC
        LIMIT 50
      `,
      { userId }
    );

    const [claimedRows] = await mysqlPool.query<
      Array<RowDataPacket & { id: number; referral_code_snapshot: string }>
    >(
      `
        SELECT id, referral_code_snapshot
        FROM referrals
        WHERE referred_user_id = :userId
        LIMIT 1
      `,
      { userId }
    );

    const [pastOrders] = await mysqlPool.query<Array<RowDataPacket & { count: number }>>(
      `
        SELECT COUNT(*) AS count
        FROM orders
        WHERE user_id = :userId
          AND status IN ('paid', 'accepted', 'ready_for_pickup', 'collected')
      `,
      { userId }
    );

    const friendsInvited = referredRows.length;
    const rewardsClaimed = referredRows.filter(
      (r) => r.status === 'rewarded' || r.status === 'qualified'
    ).length;
    const hasClaimedReferrer = claimedRows.length > 0;
    const claimedCode = claimedRows[0]?.referral_code_snapshot ?? null;
    const hasOrders = (pastOrders[0]?.count ?? 0) > 0;
    const isEligibleToClaim = !hasClaimedReferrer && !hasOrders;

    return {
      referral_code: referralCode,
      share_url: `https://c2coffee.app/r/${referralCode}`,
      friends_invited: friendsInvited,
      rewards_claimed: rewardsClaimed,
      has_claimed_referrer: hasClaimedReferrer,
      is_eligible_to_claim: isEligibleToClaim,
      claimed_code: claimedCode,
      referrals: referredRows.map((r) => ({
        id: r.id,
        status: r.status,
        created_at: r.created_at.toISOString(),
        rewarded_at: r.rewarded_at?.toISOString() ?? null
      }))
    };
  });

  const claimReferralSchema = z.object({
    code: z.string().trim().min(2).max(50)
  });

  app.post('/v1/referrals/claim', { preHandler: authenticateRequest }, async (request) => {
    const { code } = claimReferralSchema.parse(request.body ?? {});
    const userId = request.auth.userId;
    const cleanCode = code.trim().toUpperCase();

    const [pastOrders] = await mysqlPool.query<Array<RowDataPacket & { count: number }>>(
      `
        SELECT COUNT(*) AS count
        FROM orders
        WHERE user_id = :userId
          AND status IN ('paid', 'accepted', 'ready_for_pickup', 'collected')
      `,
      { userId }
    );

    if ((pastOrders[0]?.count ?? 0) > 0) {
      throw new ApiError(
        400,
        'referral_not_eligible',
        'Referral codes can only be claimed by new customers before placing their first order.'
      );
    }

    const [existingClaim] = await mysqlPool.query<Array<RowDataPacket & { id: number }>>(
      `
        SELECT id
        FROM referrals
        WHERE referred_user_id = :userId
        LIMIT 1
      `,
      { userId }
    );

    if (existingClaim.length > 0) {
      throw new ApiError(
        400,
        'referral_already_claimed',
        'You have already claimed a referral code.'
      );
    }

    const codeSuffix = cleanCode.replace(/^C2-?/, '');
    const [referrerRows] = await mysqlPool.query<
      Array<RowDataPacket & { id: number; phone_e164: string }>
    >(
      `
        SELECT id, phone_e164
        FROM users
        WHERE id != :userId
          AND (
            phone_e164 LIKE :phonePattern
            OR id = :possibleId
          )
        LIMIT 1
      `,
      {
        userId,
        phonePattern: `%${codeSuffix}`,
        possibleId: isNaN(Number(codeSuffix)) ? -1 : Number(codeSuffix)
      }
    );

    const referrer = referrerRows[0];
    if (!referrer) {
      throw new ApiError(
        404,
        'referral_code_not_found',
        'Invalid referral code. Please check and try again.'
      );
    }

    if (referrer.id === userId) {
      throw new ApiError(
        400,
        'cannot_refer_self',
        'You cannot claim your own referral code.'
      );
    }

    await mysqlPool.execute(
      `
        INSERT INTO referrals (
          referrer_user_id,
          referred_user_id,
          referral_code_snapshot,
          status,
          created_at
        )
        VALUES (
          :referrerUserId,
          :referredUserId,
          :codeSnapshot,
          'pending',
          UTC_TIMESTAMP()
        )
      `,
      {
        referrerUserId: referrer.id,
        referredUserId: userId,
        codeSnapshot: cleanCode
      }
    );

    await createUserNotification(mysqlPool, {
      userId,
      type: 'referral_claimed',
      title: 'Referral code applied',
      body: 'Your referral code has been saved. Place your first order to unlock the welcome reward.',
      data: {
        referral_code: cleanCode
      }
    });

    // Also grant new user a welcome voucher if they don't have one
    const [templates] = await mysqlPool.query<Array<RowDataPacket & { id: number; expires_in_days: number }>>(
      `SELECT id, expires_in_days FROM voucher_templates WHERE code = 'WELCOME10' AND is_active = 1`
    );

    for (const tpl of templates) {
      await mysqlPool.execute(
        `
          INSERT IGNORE INTO user_vouchers (
            user_id,
            voucher_template_id,
            status,
            issued_by_type,
            issued_reason,
            issued_at,
            expires_at
          )
          VALUES (
            :userId,
            :templateId,
            'active',
            'system',
            'Referral Welcome Voucher',
            UTC_TIMESTAMP(),
            DATE_ADD(UTC_TIMESTAMP(), INTERVAL :days DAY)
          )
        `,
        {
          userId,
          templateId: tpl.id,
          days: tpl.expires_in_days || 30
        }
      );
    }

    return {
      success: true,
      message: 'Referral code claimed successfully!'
    };
  });
}
