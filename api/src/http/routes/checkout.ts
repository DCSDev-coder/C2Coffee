import type {
  FastifyInstance
} from 'fastify';
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket
} from 'mysql2/promise';
import { z } from 'zod';

import { authenticateRequest } from '../../auth/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { getBootstrapForUser } from './auth.js';
import { resolveOrderLifecycleStatus } from '../order-lifecycle.js';

const createOrderSchema = z.object({
  store_id: z.coerce.number().int().positive(),
  payment_mode: z.enum(['token', 'direct']),
  items: z
    .array(
      z.object({
        menu_item_id: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(20),
        remarks: z.string().trim().max(500).nullish(),
        modifiers: z
          .array(
            z.object({
              group_name: z.string().trim().min(1).max(255),
              option_name: z.string().trim().min(1).max(255),
              price_delta_rm: z
                .union([z.string(), z.number()])
                .transform((value) => Number(value)),
              token_price_delta: z.coerce.number().int().min(0).default(0)
            })
          )
          .max(20)
          .default([])
      })
    )
    .min(1)
    .max(20)
});

type StoreRow = RowDataPacket & {
  id: number;
  name: string;
  pickup_lead_minutes: number;
  supports_pickup: number;
  status: 'active' | 'inactive';
};

type MenuItemRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  base_price_rm: string;
  is_available: number;
  token_price: number | null;
};

type TokenAccountRow = RowDataPacket & {
  balance_available: number;
  balance_reserved: number;
  balance_cap: number;
};

type OrderResponseRow = RowDataPacket & {
  id: number;
  order_ref: string;
  daily_order_number: number;
  status: string;
  payment_mode: string;
  final_total_rm: string;
  token_amount_charged: number;
};

type PaymentResponseRow = RowDataPacket & {
  id: number;
  provider: string;
  provider_payment_ref: string;
  provider_bill_id: string | null;
  amount_rm: string;
  status: string;
  paid_at: Date | string | null;
};

type OrderCollectRow = RowDataPacket & {
  id: number;
  user_id: number;
  order_ref: string;
  daily_order_number: number;
  status: string;
  payment_mode: string;
  final_total_rm: string;
  token_amount_charged: number;
  created_at: Date;
  paid_at: Date | null;
  accepted_at: Date | null;
  ready_at: Date | null;
  collected_at: Date | null;
};

const DIRECT_PAYMENT_PROVIDER = 'direct_sandbox';
const DIRECT_PAYMENT_PENDING_REASON = 'Awaiting direct payment confirmation.';
const DIRECT_PAYMENT_CONFIRMED_REASON = 'Direct payment confirmed in sandbox.';

export async function registerCheckoutRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post('/v1/orders', { preHandler: authenticateRequest }, async (request) => {
    const payload = createOrderSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    let committed = false;

    try {
      await connection.beginTransaction();

      const store = await _loadStore(connection, payload.store_id);
      if (!store || store.status !== 'active' || store.supports_pickup !== 1) {
        throw new ApiError(404, 'store_not_found', 'Store was not found.');
      }

      const bootstrap = await getBootstrapForUser(request.auth.userId, connection);
      const menuItems = await _loadMenuItems(
        connection,
        payload.store_id,
        payload.items.map((item) => item.menu_item_id),
        bootstrap.tier
      );

      const itemsById = new Map(menuItems.map((item) => [item.id, item]));
      const pickupSlot = new Date(Date.now() + store.pickup_lead_minutes * 60 * 1000);
      const isTokenCheckout = payload.payment_mode === 'token';

      let subtotalRm = 0;
      let modifierTotalRm = 0;
      let tokenAmountCharged = 0;

      const normalizedItems = payload.items.map((item) => {
        const menuItem = itemsById.get(item.menu_item_id);
        if (!menuItem || menuItem.is_available !== 1) {
          throw new ApiError(
            400,
            'menu_item_not_available',
            'One or more selected menu items are not available.'
          );
        }

        const basePriceRm = Number(menuItem.base_price_rm);
        const tokenPrice = menuItem.token_price;
        if (tokenPrice === null) {
          throw new ApiError(
            400,
            'token_price_not_available',
            `${menuItem.name} is not available for token checkout.`
          );
        }

        const modifierRm = item.modifiers.reduce(
          (sum, modifier) => sum + _normalizeMoney(modifier.price_delta_rm),
          0
        );
        const modifierTokens = item.modifiers.reduce(
          (sum, modifier) => sum + modifier.token_price_delta,
          0
        );

        subtotalRm += basePriceRm * item.quantity;
        modifierTotalRm += modifierRm * item.quantity;
        if (isTokenCheckout) {
          tokenAmountCharged += (tokenPrice + modifierTokens) * item.quantity;
        }

        return {
          payload: item,
          menuItem,
          basePriceRm,
          tokenPrice,
          modifierRm,
          modifierTokens
        };
      });

      if (isTokenCheckout && bootstrap.token_balance < tokenAmountCharged) {
        throw new ApiError(
          400,
          'insufficient_token_balance',
          'Your wallet balance is not enough to complete this checkout.'
        );
      }

      const finalTotalRm = subtotalRm + modifierTotalRm;
      const dailyOrderNumber = await _allocateDailyOrderNumber(
        connection,
        payload.store_id
      );
      const orderRef = _generateOrderRef();
      const paymentRef = isTokenCheckout ? null : _generatePaymentRef(orderRef);

      const [orderResult] = await connection.execute<ResultSetHeader>(
        isTokenCheckout
          ? `
            INSERT INTO orders (
              order_ref,
              daily_order_number,
              user_id,
              store_id,
              status,
              payment_mode,
              subtotal_rm,
              modifier_total_rm,
              discount_total_rm,
              final_total_rm,
              token_amount_charged,
              pickup_slot_at,
              paid_at
            )
            VALUES (
              :orderRef,
              :dailyOrderNumber,
              :userId,
              :storeId,
              'paid',
              'token',
              :subtotalRm,
              :modifierTotalRm,
              0.00,
              :finalTotalRm,
              :tokenAmountCharged,
              :pickupSlotAt,
              UTC_TIMESTAMP()
            )
          `
          : `
            INSERT INTO orders (
              order_ref,
              daily_order_number,
              user_id,
              store_id,
              status,
              payment_mode,
              subtotal_rm,
              modifier_total_rm,
              discount_total_rm,
              final_total_rm,
              token_amount_charged,
              pickup_slot_at,
              paid_at
            )
            VALUES (
              :orderRef,
              :dailyOrderNumber,
              :userId,
              :storeId,
              'pending_payment',
              'direct',
              :subtotalRm,
              :modifierTotalRm,
              0.00,
              :finalTotalRm,
              0,
              :pickupSlotAt,
              NULL
            )
          `,
        {
          orderRef,
          dailyOrderNumber,
          userId: request.auth.userId,
          storeId: payload.store_id,
          subtotalRm: subtotalRm.toFixed(2),
          modifierTotalRm: modifierTotalRm.toFixed(2),
          finalTotalRm: finalTotalRm.toFixed(2),
          tokenAmountCharged,
          pickupSlotAt: _formatMySqlDateTime(pickupSlot)
        }
      );

      const orderId = orderResult.insertId;
      let paymentResponse: PaymentResponseRow | null = null;

      for (const item of normalizedItems) {
        const lineSubtotalRm = (item.basePriceRm + item.modifierRm) * item.payload.quantity;
        const lineTokenAmount = isTokenCheckout
          ? (item.tokenPrice + item.modifierTokens) * item.payload.quantity
          : null;

        const [itemResult] = await connection.execute<ResultSetHeader>(
          `
            INSERT INTO order_items (
              order_id,
              menu_item_id,
              item_name_snapshot,
              base_price_rm_snapshot,
              token_price_snapshot,
              quantity,
              line_subtotal_rm,
              line_token_amount,
              is_qualifying_cup
            )
            VALUES (
              :orderId,
              :menuItemId,
              :itemNameSnapshot,
              :basePriceSnapshot,
              :tokenPriceSnapshot,
              :quantity,
              :lineSubtotalRm,
              :lineTokenAmount,
              :isQualifyingCup
            )
          `,
          {
            orderId,
            menuItemId: item.menuItem.id,
            itemNameSnapshot: item.menuItem.name,
            basePriceSnapshot: item.basePriceRm.toFixed(2),
            tokenPriceSnapshot: item.tokenPrice,
            quantity: item.payload.quantity,
            lineSubtotalRm: lineSubtotalRm.toFixed(2),
            lineTokenAmount,
            isQualifyingCup: 0
          }
        );

        for (const modifier of item.payload.modifiers) {
          await connection.execute(
            `
              INSERT INTO order_item_modifiers (
                order_item_id,
                modifier_group_name_snapshot,
                modifier_option_name_snapshot,
                price_delta_rm_snapshot,
                token_price_delta_snapshot
              )
              VALUES (
                :orderItemId,
                :groupName,
                :optionName,
                :priceDeltaRm,
                :tokenPriceDelta
              )
            `,
            {
              orderItemId: itemResult.insertId,
              groupName: modifier.group_name,
              optionName: modifier.option_name,
              priceDeltaRm: _normalizeMoney(modifier.price_delta_rm).toFixed(2),
              tokenPriceDelta: modifier.token_price_delta
            }
          );
        }
      }

      await connection.execute(
        `
          INSERT INTO order_status_history (
            order_id,
            from_status,
            to_status,
            changed_by_type,
            changed_by_id,
            reason
          )
          VALUES (
            :orderId,
            NULL,
            :toStatus,
            'customer',
            :userId,
            :reason
          )
        `,
        {
          orderId,
          toStatus: isTokenCheckout ? 'paid' : 'pending_payment',
          userId: request.auth.userId,
          reason: isTokenCheckout
            ? 'Token checkout completed in app.'
            : DIRECT_PAYMENT_PENDING_REASON
        }
      );

      let accountBalanceAvailable = bootstrap.token_balance;
      let accountBalanceReserved = bootstrap.token_reserved;
      let accountBalanceCap = bootstrap.token_cap;

      if (isTokenCheckout) {
        const [accountRows] = await connection.query<Array<TokenAccountRow>>(
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
          throw new ApiError(400, 'token_account_missing', 'Wallet account was not found.');
        }

        const newAvailable = account.balance_available - tokenAmountCharged;
        if (newAvailable < 0) {
          throw new ApiError(
            400,
            'insufficient_token_balance',
            'Your wallet balance is not enough to complete this checkout.'
          );
        }

        await connection.execute(
          `
            UPDATE token_accounts
            SET balance_available = :balanceAvailable
            WHERE user_id = :userId
          `,
          {
            balanceAvailable: newAvailable,
            userId: request.auth.userId
          }
        );

        await connection.execute(
          `
            INSERT INTO token_reservations (
              user_id,
              order_id,
              amount_reserved,
              status,
              created_at,
              committed_at
            )
            VALUES (
              :userId,
              :orderId,
              :amountReserved,
              'committed',
              UTC_TIMESTAMP(),
              UTC_TIMESTAMP()
            )
          `,
          {
            userId: request.auth.userId,
            orderId,
            amountReserved: tokenAmountCharged
          }
        );

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
              remarks
            )
            VALUES (
              :userId,
              NULL,
              'debit',
              'order_spend',
              :orderId,
              :amount,
              :balanceAfter,
              :remarks
            )
          `,
          {
            userId: request.auth.userId,
            orderId,
            amount: tokenAmountCharged,
            balanceAfter: newAvailable,
            remarks: `Token checkout for order ${orderRef}`
          }
        );

        accountBalanceAvailable = newAvailable;
        accountBalanceReserved = account.balance_reserved;
        accountBalanceCap = account.balance_cap;
      } else {
        if (!paymentRef) {
          throw new ApiError(500, 'payment_reference_missing', 'Payment reference was not generated.');
        }

        const [paymentResult] = await connection.execute<ResultSetHeader>(
          `
            INSERT INTO payments (
              order_id,
              topup_id,
              provider,
              provider_payment_ref,
              provider_bill_id,
              amount_rm,
              status,
              created_at
            )
            VALUES (
              :orderId,
              NULL,
              :provider,
              :providerPaymentRef,
              NULL,
              :amountRm,
              'pending',
              UTC_TIMESTAMP()
            )
          `,
          {
            orderId,
            provider: DIRECT_PAYMENT_PROVIDER,
            providerPaymentRef: paymentRef,
            amountRm: finalTotalRm.toFixed(2)
          }
        );

        const [paymentRows] = await connection.query<Array<PaymentResponseRow>>(
          `
            SELECT
              id,
              provider,
              provider_payment_ref,
              provider_bill_id,
              CAST(amount_rm AS CHAR) AS amount_rm,
              status,
              paid_at
            FROM payments
            WHERE id = :paymentId
            LIMIT 1
          `,
          { paymentId: paymentResult.insertId }
        );

        paymentResponse = paymentRows[0] ?? null;
      }

      await connection.commit();
      committed = true;

      const [orderRows] = await mysqlPool.query<Array<OrderResponseRow>>(
        `
          SELECT
            id,
            order_ref,
            daily_order_number,
            status,
            payment_mode,
            CAST(final_total_rm AS CHAR) AS final_total_rm,
            token_amount_charged
          FROM orders
          WHERE id = :orderId
          LIMIT 1
        `,
        { orderId }
      );

      const response: Record<string, unknown> = {
        order: {
          id: orderRows[0].id,
          order_ref: orderRows[0].order_ref,
          daily_order_number: orderRows[0].daily_order_number,
          status: orderRows[0].status,
          payment_mode: orderRows[0].payment_mode,
          final_total_rm: orderRows[0].final_total_rm,
          token_amount_charged: orderRows[0].token_amount_charged
        },
        token_balance: accountBalanceAvailable,
        token_reserved: accountBalanceReserved,
        token_cap: accountBalanceCap
      };

      if (paymentResponse) {
        response.payment = {
          id: paymentResponse.id,
          provider: paymentResponse.provider,
          provider_payment_ref: paymentResponse.provider_payment_ref,
          provider_bill_id: paymentResponse.provider_bill_id,
          amount_rm: paymentResponse.amount_rm,
          status: paymentResponse.status,
          paid_at: _formatNullableIsoDate(paymentResponse.paid_at)
        };
      }

      return response;
    } catch (error) {
      if (!committed) {
        await connection.rollback();
      }
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/orders/:orderId/direct-payment/confirm', { preHandler: authenticateRequest }, async (request) => {
    const params = z.object({
      orderId: z.coerce.number().int().positive()
    }).parse(request.params);

    const connection = await mysqlPool.getConnection();
    let committed = false;

    try {
      await connection.beginTransaction();

      const [orderRows] = await connection.query<Array<RowDataPacket & OrderResponseRow & { user_id: number }>>(
        `
          SELECT
            id,
            user_id,
            order_ref,
            daily_order_number,
            status,
            payment_mode,
            CAST(final_total_rm AS CHAR) AS final_total_rm,
            token_amount_charged
          FROM orders
          WHERE id = :orderId
          LIMIT 1
          FOR UPDATE
        `,
        { orderId: params.orderId }
      );

      const order = orderRows[0];
      if (!order || order.user_id !== request.auth.userId) {
        throw new ApiError(404, 'order_not_found', 'Order was not found.');
      }

      if (order.payment_mode !== 'direct') {
        throw new ApiError(400, 'invalid_payment_mode', 'Only direct-pay orders can be confirmed here.');
      }

      if (order.status !== 'pending_payment') {
        throw new ApiError(400, 'invalid_order_status', 'This order is not waiting for payment confirmation.');
      }

      const [paymentRows] = await connection.query<Array<PaymentResponseRow & { order_id: number }>>(
        `
          SELECT
            id,
            order_id,
            provider,
            provider_payment_ref,
            provider_bill_id,
            CAST(amount_rm AS CHAR) AS amount_rm,
            status,
            paid_at
          FROM payments
          WHERE order_id = :orderId
            AND provider = :provider
          LIMIT 1
          FOR UPDATE
        `,
        {
          orderId: params.orderId,
          provider: DIRECT_PAYMENT_PROVIDER
        }
      );

      const payment = paymentRows[0];
      if (!payment) {
        throw new ApiError(404, 'payment_not_found', 'Direct payment record was not found.');
      }

      await connection.execute(
        `
          UPDATE payments
          SET status = 'paid',
              paid_at = UTC_TIMESTAMP()
          WHERE id = :paymentId
        `,
        { paymentId: payment.id }
      );

      await connection.execute(
        `
          UPDATE orders
          SET status = 'paid',
              paid_at = UTC_TIMESTAMP()
          WHERE id = :orderId
        `,
        { orderId: order.id }
      );

      await connection.execute(
        `
          INSERT INTO order_status_history (
            order_id,
            from_status,
            to_status,
            changed_by_type,
            changed_by_id,
            reason
          )
          VALUES (
            :orderId,
            'pending_payment',
            'paid',
            'customer',
            :userId,
            :reason
          )
        `,
        {
          orderId: order.id,
          userId: request.auth.userId,
          reason: DIRECT_PAYMENT_CONFIRMED_REASON
        }
      );

      await connection.commit();
      committed = true;

      return {
        order: {
          id: order.id,
          order_ref: order.order_ref,
          daily_order_number: order.daily_order_number,
          status: 'paid',
          payment_mode: order.payment_mode,
          final_total_rm: order.final_total_rm,
          token_amount_charged: order.token_amount_charged
        },
        payment: {
          id: payment.id,
          provider: payment.provider,
          provider_payment_ref: payment.provider_payment_ref,
          provider_bill_id: payment.provider_bill_id,
          amount_rm: payment.amount_rm,
          status: 'paid',
          paid_at: _formatNullableIsoDate(payment.paid_at) ?? new Date().toISOString()
        }
      };
    } catch (error) {
      if (!committed) {
        await connection.rollback();
      }
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/orders/:orderId/collect', { preHandler: authenticateRequest }, async (request) => {
    const params = z.object({
      orderId: z.coerce.number().int().positive()
    }).parse(request.params);

    const connection = await mysqlPool.getConnection();
    let committed = false;

    try {
      await connection.beginTransaction();

      const [orderRows] = await connection.query<Array<OrderCollectRow>>(
        `
          SELECT
            id,
            user_id,
            order_ref,
            daily_order_number,
            status,
            payment_mode,
            CAST(final_total_rm AS CHAR) AS final_total_rm,
            token_amount_charged,
            created_at,
            paid_at,
            accepted_at,
            ready_at,
            collected_at
          FROM orders
          WHERE id = :orderId
          LIMIT 1
          FOR UPDATE
        `,
        { orderId: params.orderId }
      );

      const order = orderRows[0];
      if (!order || order.user_id !== request.auth.userId) {
        throw new ApiError(404, 'order_not_found', 'Order was not found.');
      }

      const effectiveStatus = resolveOrderLifecycleStatus({
        status: order.status,
        createdAt: order.created_at,
        paidAt: order.paid_at,
        acceptedAt: order.accepted_at,
        readyAt: order.ready_at,
        collectedAt: order.collected_at
      });

      if (effectiveStatus === 'collected') {
        await connection.commit();
        committed = true;
        return {
          order: {
            id: order.id,
            order_ref: order.order_ref,
            daily_order_number: order.daily_order_number,
            status: 'collected',
            payment_mode: order.payment_mode,
            final_total_rm: order.final_total_rm,
            token_amount_charged: order.token_amount_charged
          }
        };
      }

      if (effectiveStatus !== 'ready_for_pickup') {
        throw new ApiError(
          409,
          'order_not_ready_for_collection',
          'This order is not ready to be collected yet.'
        );
      }

      await connection.execute(
        `
          UPDATE orders
          SET status = 'collected',
              collected_at = UTC_TIMESTAMP()
          WHERE id = :orderId
        `,
        { orderId: order.id }
      );

      await connection.execute(
        `
          INSERT INTO order_status_history (
            order_id,
            from_status,
            to_status,
            changed_by_type,
            changed_by_id,
            reason
          )
          VALUES (
            :orderId,
            :fromStatus,
            'collected',
            'customer',
            :userId,
            :reason
          )
        `,
        {
          orderId: order.id,
          fromStatus: effectiveStatus,
          userId: request.auth.userId,
          reason: 'Order collected in app.'
        }
      );

      await connection.commit();
      committed = true;

      return {
        order: {
          id: order.id,
          order_ref: order.order_ref,
          daily_order_number: order.daily_order_number,
          status: 'collected',
          payment_mode: order.payment_mode,
          final_total_rm: order.final_total_rm,
          token_amount_charged: order.token_amount_charged
        }
      };
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

async function _loadStore(
  connection: PoolConnection,
  storeId: number
): Promise<StoreRow | null> {
  const [rows] = await connection.query<Array<StoreRow>>(
    `
      SELECT
        id,
        name,
        pickup_lead_minutes,
        supports_pickup,
        status
      FROM stores
      WHERE id = :storeId
      LIMIT 1
    `,
    { storeId }
  );

  return rows[0] ?? null;
}

async function _loadMenuItems(
  connection: PoolConnection,
  storeId: number,
  menuItemIds: number[],
  tierCode: string
): Promise<Array<MenuItemRow>> {
  const [rows] = await connection.query<Array<MenuItemRow>>(
    `
      SELECT
        i.id,
        i.code,
        i.name,
        CAST(i.base_price_rm AS CHAR) AS base_price_rm,
        COALESCE(a.is_available, 1) AS is_available,
        tp.token_price
      FROM menu_items i
      LEFT JOIN menu_item_store_availability a
        ON a.store_id = :storeId
       AND a.menu_item_id = i.id
      LEFT JOIN menu_item_token_prices tp
        ON tp.menu_item_id = i.id
       AND tp.tier_code = :tierCode
       AND tp.is_enabled = 1
       AND tp.effective_from <= UTC_TIMESTAMP()
       AND (tp.effective_to IS NULL OR tp.effective_to > UTC_TIMESTAMP())
      WHERE i.id IN (:menuItemIds)
        AND i.is_active = 1
    `,
    {
      storeId,
      tierCode,
      menuItemIds
    }
  );

  return rows;
}

function _generateOrderRef(): string {
  const date = new Date();
  const year = String(date.getUTCFullYear()).slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `C2-${year}${month}${day}-${suffix}`;
}

function _generatePaymentRef(orderRef: string): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DP-${orderRef}-${suffix}`;
}

async function _allocateDailyOrderNumber(
  connection: PoolConnection,
  storeId: number
): Promise<number> {
  const [insertResult] = await connection.execute<ResultSetHeader>(
    `
      INSERT INTO store_daily_order_sequences (
        sequence_date,
        store_id,
        next_number
      )
      VALUES (
        UTC_DATE(),
        :storeId,
        1
      )
      ON DUPLICATE KEY UPDATE
        next_number = LAST_INSERT_ID(next_number + 1)
    `,
    { storeId }
  );

  if (insertResult.affectedRows === 1) {
    return 1;
  }

  const [rows] = await connection.query<Array<RowDataPacket & { allocated_number: number }>>(
    'SELECT LAST_INSERT_ID() AS allocated_number'
  );

  return rows[0]?.allocated_number ?? 0;
}

function _normalizeMoney(value: number): number {
  return Number(value.toFixed(2));
}

function _formatMySqlDateTime(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  const hours = String(value.getUTCHours()).padStart(2, '0');
  const minutes = String(value.getUTCMinutes()).padStart(2, '0');
  const seconds = String(value.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function _formatNullableIsoDate(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}
