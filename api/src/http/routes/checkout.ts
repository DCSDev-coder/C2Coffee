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

const createOrderSchema = z.object({
  store_id: z.coerce.number().int().positive(),
  payment_mode: z.literal('token'),
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
  status: string;
  payment_mode: string;
  final_total_rm: string;
  token_amount_charged: number;
};

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
        tokenAmountCharged += (tokenPrice + modifierTokens) * item.quantity;

        return {
          payload: item,
          menuItem,
          basePriceRm,
          tokenPrice,
          modifierRm,
          modifierTokens
        };
      });

      if (bootstrap.token_balance < tokenAmountCharged) {
        throw new ApiError(
          400,
          'insufficient_token_balance',
          'Your wallet balance is not enough to complete this checkout.'
        );
      }

      const finalTotalRm = subtotalRm + modifierTotalRm;
      const orderRef = _generateOrderRef();

      const [orderResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO orders (
            order_ref,
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
        `,
        {
          orderRef,
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

      for (const item of normalizedItems) {
        const lineSubtotalRm = (item.basePriceRm + item.modifierRm) * item.payload.quantity;
        const lineTokenAmount =
          (item.tokenPrice + item.modifierTokens) * item.payload.quantity;

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
            'paid',
            'customer',
            :userId,
            'Token checkout completed in app.'
          )
        `,
        {
          orderId,
          userId: request.auth.userId
        }
      );

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

      await connection.commit();
      committed = true;

      const [orderRows] = await mysqlPool.query<Array<OrderResponseRow>>(
        `
          SELECT
            id,
            order_ref,
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

      return {
        order: {
          id: orderRows[0].id,
          order_ref: orderRows[0].order_ref,
          status: orderRows[0].status,
          payment_mode: orderRows[0].payment_mode,
          final_total_rm: orderRows[0].final_total_rm,
          token_amount_charged: orderRows[0].token_amount_charged
        },
        token_balance: newAvailable,
        token_reserved: account.balance_reserved,
        token_cap: account.balance_cap
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
