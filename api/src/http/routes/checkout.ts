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
import { env } from '../../config/env.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { createUserNotification } from '../notifications.js';
import { processOrderLoyalty } from '../../services/loyalty.js';
import { ApiError } from '../errors.js';
import { getBootstrapForUser } from './auth.js';
import { resolveOrderLifecycleStatus } from '../order-lifecycle.js';

const createOrderSchema = z.object({
  store_id: z.coerce.number().int().positive(),
  payment_mode: z.literal('token'),
  applied_voucher_id: z.coerce.number().int().positive().nullish(),
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
  is_qualifying_cup: number;
  category_code: string;
  category_name: string;
  category_product_kind_code: string;
  subcategory_code: string | null;
  subcategory_name: string | null;
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

type AppliedVoucherRow = RowDataPacket & {
  id: number;
  user_id: number;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  expires_at: Date;
  template_id: number;
  template_code: string;
  template_name: string;
  voucher_type: string;
  discount_mode: 'fixed_rm' | 'percent_rm' | 'fixed_token' | 'free_drink';
  discount_value: string;
  token_value: number | null;
  min_spend_rm: string | null;
  requires_drink_in_cart: number;
  eligible_scope_json: unknown;
  exclude_scope_json: unknown;
  template_is_active: number;
};

function calculateTokenEquivalentDiscount(
  totalBeforeDiscountRm: number,
  tokenAmountCharged: number,
  discountRm: number
): number {
  if (totalBeforeDiscountRm <= 0 || tokenAmountCharged <= 0 || discountRm <= 0) {
    return 0;
  }

  return Math.min(
    tokenAmountCharged,
    Math.round(tokenAmountCharged * (discountRm / totalBeforeDiscountRm))
  );
}

type VoucherScopeSelection = {
  product_kind_codes: string[];
  subcategory_codes: string[];
  category_codes: string[];
  items: string[];
};

type VoucherPromotionRule = {
  kind: 'standard' | 'bundle';
  qualifying_quantity: number;
  reward_quantity: number;
  qualifying_scope: VoucherScopeSelection;
  reward_scope: VoucherScopeSelection;
};

function _parseVoucherScope(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  return {};
}

function _isVoucherAvailableNow(scope: Record<string, unknown>, now = new Date()): boolean {
  const schedule =
    scope.schedule && typeof scope.schedule === 'object'
      ? (scope.schedule as Record<string, unknown>)
      : null;

  if (!schedule) {
    return true;
  }

  const mode = String(schedule.mode || 'always').trim();
  if (mode === 'always') {
    return true;
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    weekday: 'long',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);

  const lookup = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const currentDay = lookup('weekday');
  const currentTime = `${lookup('hour')}:${lookup('minute')}`;
  const currentMonthDay = `${lookup('month')}-${lookup('day')}`;
  const activeDays = Array.isArray(schedule.activeDays)
    ? schedule.activeDays.map((day) => String(day))
    : [];
  const startTime = typeof schedule.startTime === 'string' ? schedule.startTime : '';
  const endTime = typeof schedule.endTime === 'string' ? schedule.endTime : '';
  const annualDate = typeof schedule.annualDate === 'string' ? schedule.annualDate : '';

  if (mode === 'weekly' && activeDays.length > 0 && !activeDays.includes(currentDay)) {
    return false;
  }

  if (mode === 'annual' && annualDate && annualDate !== currentMonthDay) {
    return false;
  }

  if (startTime && currentTime < startTime) {
    return false;
  }

  if (endTime && currentTime > endTime) {
    return false;
  }

  return true;
}

function _stringScopeList(scope: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const raw = scope[key];
    if (!Array.isArray(raw)) continue;
    return raw
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
  }

  return [];
}

function _normalizeValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function _resolveProductKindForCategory(productKindCode: string | null | undefined, categoryCode: string): string {
  const normalizedKind = _normalizeValue(String(productKindCode ?? ''));
  if (normalizedKind) {
    return normalizedKind;
  }

  switch (_normalizeValue(categoryCode)) {
    case 'coffee':
    case 'non coffee':
      return 'drink';
    case 'food':
      return 'food';
    case 'merchandise':
      return 'merchandise';
    case 'candles':
      return 'candle';
    default:
      return 'other';
  }
}

function _scopeSelectionFromScope(scope: Record<string, unknown>): VoucherScopeSelection {
  const items = _stringScopeList(scope, ['item_codes', 'items']).map(_normalizeValue);
  return {
    product_kind_codes: _stringScopeList(scope, ['product_kind_codes', 'product_kinds']).map(_normalizeValue),
    subcategory_codes: _stringScopeList(scope, ['subcategory_codes']).map(_normalizeValue),
    category_codes: _stringScopeList(scope, ['category_codes', 'categories']).map(_normalizeValue),
    items: items.length === 1 && items[0] === _normalizeValue('All Items') ? [] : items
  };
}

function _scopeSelectionFromRaw(value: unknown): VoucherScopeSelection {
  if (!value || typeof value !== 'object') {
    return {
      product_kind_codes: [],
      subcategory_codes: [],
      category_codes: [],
      items: []
    };
  }

  const scope = value as Record<string, unknown>;
  const items = _stringScopeList(scope, ['item_codes', 'items']).map(_normalizeValue);
  return {
    product_kind_codes: _stringScopeList(scope, ['product_kind_codes', 'product_kinds']).map(_normalizeValue),
    subcategory_codes: _stringScopeList(scope, ['subcategory_codes']).map(_normalizeValue),
    category_codes: _stringScopeList(scope, ['category_codes', 'categories']).map(_normalizeValue),
    items: items.length === 1 && items[0] === _normalizeValue('All Items') ? [] : items
  };
}

function _parsePromotionRule(scope: Record<string, unknown>): VoucherPromotionRule {
  const rawRule =
    scope.promotion_rule && typeof scope.promotion_rule === 'object'
      ? (scope.promotion_rule as Record<string, unknown>)
      : {};
  const kind = String(rawRule.kind || 'standard').trim() === 'bundle' ? 'bundle' : 'standard';
  const qualifyingQuantity = Math.max(1, Number(rawRule.qualifying_quantity || 1) || 1);
  const rewardQuantity = Math.max(1, Number(rawRule.reward_quantity || 1) || 1);
  const fallbackScope = _scopeSelectionFromScope(scope);
  const qualifyingScope = _scopeSelectionFromRaw(rawRule.qualifying_scope);
  const rewardScope = _scopeSelectionFromRaw(rawRule.reward_scope);

  const hasQualifyingScope =
    qualifyingScope.product_kind_codes.length > 0 ||
    qualifyingScope.subcategory_codes.length > 0 ||
    qualifyingScope.category_codes.length > 0 ||
    qualifyingScope.items.length > 0;
  const hasRewardScope =
    rewardScope.product_kind_codes.length > 0 ||
    rewardScope.subcategory_codes.length > 0 ||
    rewardScope.category_codes.length > 0 ||
    rewardScope.items.length > 0;

  return {
    kind,
    qualifying_quantity: qualifyingQuantity,
    reward_quantity: rewardQuantity,
    qualifying_scope: hasQualifyingScope ? qualifyingScope : fallbackScope,
    reward_scope: kind === 'bundle' && hasRewardScope ? rewardScope : hasQualifyingScope ? qualifyingScope : fallbackScope
  };
}

function _scopeMatchesMenuItem(scope: VoucherScopeSelection, menuItem: MenuItemRow): boolean {
  const menuItemCode = _normalizeValue(menuItem.code);
  const subcategoryCode = _normalizeValue(menuItem.subcategory_code ?? '');
  const categoryCode = _normalizeValue(menuItem.category_code);
  const productKindCode = _resolveProductKindForCategory(
    menuItem.category_product_kind_code,
    menuItem.category_code
  );

  const itemCodes = new Set(scope.items.map(_normalizeValue));
  const subcategoryCodes = new Set(scope.subcategory_codes.map(_normalizeValue));
  const categoryCodes = new Set(scope.category_codes.map(_normalizeValue));
  const productKindCodes = new Set(scope.product_kind_codes.map(_normalizeValue));

  const hasExplicitScope =
    itemCodes.size > 0 ||
    subcategoryCodes.size > 0 ||
    categoryCodes.size > 0 ||
    productKindCodes.size > 0;

  if (!hasExplicitScope) {
    return true;
  }

  return (
    itemCodes.has(menuItemCode) ||
    subcategoryCodes.has(subcategoryCode) ||
    categoryCodes.has(categoryCode) ||
    productKindCodes.has(productKindCode)
  );
}

function _collectMatchedUnits(
  scope: VoucherScopeSelection,
  normalizedItems: Array<{
    payload: z.infer<typeof createOrderSchema>['items'][number];
    menuItem: MenuItemRow;
    basePriceRm: number;
    tokenPrice: number;
    modifierRm: number;
    modifierTokens: number;
  }>
) {
  const units: Array<{
    payload: z.infer<typeof createOrderSchema>['items'][number];
    menuItem: MenuItemRow;
    basePriceRm: number;
    tokenPrice: number;
    modifierRm: number;
    modifierTokens: number;
  }> = [];

  for (const item of normalizedItems) {
    if (!_scopeMatchesMenuItem(scope, item.menuItem)) {
      continue;
    }

    for (let index = 0; index < item.payload.quantity; index += 1) {
      units.push(item);
    }
  }

  return units;
}

export async function registerCheckoutRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post('/v1/orders', { preHandler: authenticateRequest }, async (request) => {
    const payload = createOrderSchema.parse(request.body);
    const connection = await getUtcConnection();
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
      const isTokenCheckout = true;

      let subtotalRm = 0;
      let modifierTotalRm = 0;
      let tokenAmountCharged = 0;

      const normalizedItems = payload.items.map((item) => {
        const menuItem = itemsById.get(item.menu_item_id);
        if (!menuItem || menuItem.is_available !== 1) {
          throw new ApiError(
            400,
            'menu_item_not_available',
            'This item is unavailable.'
          );
        }

        const basePriceRm = Number(menuItem.base_price_rm);
        const tokenPrice = menuItem.token_price;
        if (tokenPrice === null) {
          throw new ApiError(
            400,
            'token_price_not_available',
            'This item is unavailable.'
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

      let appliedVoucher: AppliedVoucherRow | null = null;
      let discountRm = 0;
      let discountTokens = 0;

      if (payload.applied_voucher_id) {
        const [voucherRows] = await connection.query<Array<AppliedVoucherRow>>(
          `
            SELECT
              uv.id,
              uv.user_id,
              uv.status,
              uv.expires_at,
              vt.id AS template_id,
              vt.code AS template_code,
              vt.name AS template_name,
              vt.voucher_type,
              vt.discount_mode,
              CAST(vt.discount_value AS CHAR) AS discount_value,
              vt.token_value,
              CAST(vt.min_spend_rm AS CHAR) AS min_spend_rm,
              vt.requires_drink_in_cart,
              vt.eligible_scope_json,
              vt.exclude_scope_json,
              vt.is_active AS template_is_active
            FROM user_vouchers uv
            JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
            WHERE uv.id = :voucherId AND uv.user_id = :userId
            LIMIT 1
            FOR UPDATE
          `,
          {
            voucherId: payload.applied_voucher_id,
            userId: request.auth.userId
          }
        );

        appliedVoucher = voucherRows[0] ?? null;
        if (!appliedVoucher || appliedVoucher.status !== 'active') {
          throw new ApiError(
            400,
            'voucher_not_active',
            'Selected voucher is not active or has already been used.'
          );
        }

        if (appliedVoucher.template_is_active !== 1) {
          throw new ApiError(
            400,
            'voucher_not_active',
            'Selected voucher is no longer available.'
          );
        }

        if (new Date(appliedVoucher.expires_at).getTime() < Date.now()) {
          throw new ApiError(
            400,
            'voucher_expired',
            'Selected voucher has expired.'
          );
        }

        const voucherScope = _parseVoucherScope(appliedVoucher.eligible_scope_json);
        const promotionRule = _parsePromotionRule(voucherScope);
        if (!_isVoucherAvailableNow(voucherScope)) {
          throw new ApiError(
            400,
            'voucher_not_available_now',
            'Selected voucher is outside of its active promotion time.'
          );
        }

        if (
          isTokenCheckout &&
          appliedVoucher.voucher_type === 'campaign_direct_pay'
        ) {
          throw new ApiError(
            400,
            'voucher_not_supported_for_token_checkout',
            'Selected voucher cannot be used right now.'
          );
        }

        const qualifyingUnits = _collectMatchedUnits(promotionRule.qualifying_scope, normalizedItems);
        const rewardUnits = _collectMatchedUnits(promotionRule.reward_scope, normalizedItems);

        if (qualifyingUnits.length < promotionRule.qualifying_quantity || rewardUnits.length === 0) {
          throw new ApiError(
            400,
            'voucher_not_applicable_to_cart',
            'Selected voucher does not match the current cart items.'
          );
        }

        const totalBeforeDiscountRm = subtotalRm + modifierTotalRm;
        if (appliedVoucher.min_spend_rm !== null) {
          const minSpend = Number(appliedVoucher.min_spend_rm);
          if (!isNaN(minSpend) && minSpend > 0 && totalBeforeDiscountRm < minSpend) {
            throw new ApiError(
              400,
              'voucher_min_spend_not_met',
              `Minimum spend requirement of RM ${minSpend.toFixed(2)} is not met.`
            );
          }
        }

        const rewardableUnits = rewardUnits
          .slice()
          .sort(
            (a, b) =>
              (b.basePriceRm + b.modifierRm) - (a.basePriceRm + a.modifierRm) ||
              (b.tokenPrice + b.modifierTokens) - (a.tokenPrice + a.modifierTokens)
          )
          .slice(0, promotionRule.reward_quantity);

        if (rewardableUnits.length < promotionRule.reward_quantity) {
          throw new ApiError(
            400,
            'voucher_not_applicable_to_cart',
            'Selected voucher does not match the current cart items.'
          );
        }

        if (appliedVoucher.discount_mode === 'fixed_rm') {
          discountRm = Math.min(totalBeforeDiscountRm, Number(appliedVoucher.discount_value));
          if (isTokenCheckout) {
            discountTokens = calculateTokenEquivalentDiscount(
              totalBeforeDiscountRm,
              tokenAmountCharged,
              discountRm
            );
          }
        } else if (appliedVoucher.discount_mode === 'percent_rm') {
          const pct = Number(appliedVoucher.discount_value) / 100;
          discountRm = Math.min(totalBeforeDiscountRm, totalBeforeDiscountRm * pct);
          if (isTokenCheckout) {
            discountTokens = calculateTokenEquivalentDiscount(
              totalBeforeDiscountRm,
              tokenAmountCharged,
              discountRm
            );
          }
        } else if (appliedVoucher.discount_mode === 'fixed_token') {
          const tokenDiscountVal = appliedVoucher.token_value ?? Math.round(Number(appliedVoucher.discount_value));
          discountTokens = Math.min(tokenAmountCharged, tokenDiscountVal);
        } else if (appliedVoucher.discount_mode === 'free_drink') {
          if (isTokenCheckout) {
            discountTokens = rewardableUnits.reduce(
              (sum, unit) => sum + unit.tokenPrice + unit.modifierTokens,
              0
            );
          } else {
            discountRm = rewardableUnits.reduce(
              (sum, unit) => sum + unit.basePriceRm + unit.modifierRm,
              0
            );
          }
        }
      }

      if (isTokenCheckout) {
        tokenAmountCharged = Math.max(0, tokenAmountCharged - discountTokens);
      }

      if (isTokenCheckout && bootstrap.token_balance < tokenAmountCharged) {
        throw new ApiError(
          400,
          'insufficient_token_balance',
          'Your wallet balance is not enough to complete this checkout.'
        );
      }

      const finalTotalRm = 0.00;

      const dailyOrderNumber = await _allocateDailyOrderNumber(
        connection,
        payload.store_id
      );
      const orderRef = _generateOrderRef();

      const [orderResult] = await connection.execute<ResultSetHeader>(
        `
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
            voucher_id,
            pickup_slot_at,
            paid_at,
            created_at
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
            :discountTotalRm,
            :finalTotalRm,
            :tokenAmountCharged,
            :voucherId,
            :pickupSlotAt,
            UTC_TIMESTAMP(),
            UTC_TIMESTAMP()
          )
        `,
        {
          orderRef,
          dailyOrderNumber,
          userId: request.auth.userId,
          storeId: payload.store_id,
          subtotalRm: subtotalRm.toFixed(2),
          modifierTotalRm: modifierTotalRm.toFixed(2),
          discountTotalRm: discountRm.toFixed(2),
          finalTotalRm: finalTotalRm.toFixed(2),
          tokenAmountCharged,
          voucherId: appliedVoucher ? appliedVoucher.id : null,
          pickupSlotAt: _formatMySqlDateTime(pickupSlot)
        }
      );

      const orderId = orderResult.insertId;

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
            isQualifyingCup: item.menuItem.is_qualifying_cup
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
            reason,
            created_at
          )
          VALUES (
            :orderId,
            NULL,
            :toStatus,
            'customer',
            :userId,
            :reason,
            UTC_TIMESTAMP()
          )
        `,
        {
          orderId,
          toStatus: isTokenCheckout ? 'paid' : 'pending_payment',
          userId: request.auth.userId,
          reason: 'Token checkout completed in app.'
        }
      );

      if (appliedVoucher) {
        await connection.execute(
          `
            INSERT INTO voucher_redemptions (
              user_voucher_id,
              order_id,
              discount_rm,
              discount_token_amount,
              created_at
            )
            VALUES (
              :userVoucherId,
              :orderId,
              :discountRm,
              :discountTokenAmount,
              UTC_TIMESTAMP()
            )
          `,
          {
            userVoucherId: appliedVoucher.id,
            orderId,
            discountRm: discountRm.toFixed(2),
            discountTokenAmount: discountTokens > 0 ? discountTokens : null
          }
        );

        await connection.execute(
          `
            UPDATE user_vouchers
            SET status = 'redeemed',
                redeemed_at = UTC_TIMESTAMP()
            WHERE id = :voucherId
          `,
          {
            voucherId: appliedVoucher.id
          }
        );
      }

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
      }

      // Automatically qualify and reward pending referral when referred user completes their first order
      const [pendingReferralRows] = await connection.query<
        Array<RowDataPacket & { id: number; referrer_user_id: number }>
      >(
        `
          SELECT id, referrer_user_id
          FROM referrals
          WHERE referred_user_id = :userId
            AND status = 'pending'
          LIMIT 1
          FOR UPDATE
        `,
        { userId: request.auth.userId }
      );

      if (pendingReferralRows.length > 0) {
        const referral = pendingReferralRows[0]!;
        await connection.execute(
          `
            UPDATE referrals
            SET status = 'rewarded',
                qualified_order_id = :orderId,
                qualified_at = UTC_TIMESTAMP(),
                rewarded_at = UTC_TIMESTAMP()
            WHERE id = :referralId
          `,
          {
            referralId: referral.id,
            orderId
          }
        );

        // Check how many rewarded referrals the referrer now has
        const [rewardedCountRows] = await connection.query<Array<RowDataPacket & { count: number }>>(
          `
            SELECT COUNT(*) AS count
            FROM referrals
            WHERE referrer_user_id = :referrerUserId
              AND status = 'rewarded'
          `,
          { referrerUserId: referral.referrer_user_id }
        );
        const rewardedCount = rewardedCountRows[0]?.count ?? 0;

        // Issue 1 Free Drink reward voucher to the referrer for every 10 successful referrals
        if (rewardedCount > 0 && rewardedCount % 10 === 0) {
          const [rewardTemplates] = await connection.query<
            Array<RowDataPacket & { id: number; expires_in_days: number }>
          >(
            `
              SELECT id, expires_in_days
              FROM voucher_templates
              WHERE code = 'WELCOME10'
                 OR discount_mode = 'free_drink'
              ORDER BY id ASC
              LIMIT 1
            `
          );

          if (rewardTemplates.length > 0) {
            const tpl = rewardTemplates[0]!;
            await connection.execute(
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
                  :referrerUserId,
                  :templateId,
                  'active',
                  'system',
                  'Referral Friend 1st Order Reward',
                  UTC_TIMESTAMP(),
                  DATE_ADD(UTC_TIMESTAMP(), INTERVAL :days DAY)
                )
              `,
              {
                referrerUserId: referral.referrer_user_id,
                templateId: tpl.id,
                days: tpl.expires_in_days || 30
              }
            );

            await createUserNotification(connection, {
              userId: referral.referrer_user_id,
              type: 'referral_reward',
              title: 'Referral reward unlocked',
              body: 'You have qualified for a referral reward voucher.',
              data: {
                referral_user_id: request.auth.userId,
                referral_order_id: orderId
              }
            });
          }
        }
      }
      await processOrderLoyalty(orderId, request.auth.userId, connection);

      await createUserNotification(connection, {
        userId: request.auth.userId,
        type: 'order_created',
        title: 'Order placed',
        body: `Your order ${orderRef} has been placed successfully. We will notify you when it is ready for pickup.`,
        data: {
          order_id: orderId,
          order_ref: orderRef,
          store_id: payload.store_id,
          pickup_slot_at: _formatMySqlDateTime(pickupSlot)
        }
      });

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

    if (!env.LEGACY_DIRECT_PAYMENT_BYPASS) {
      throw new ApiError(
        410,
        'legacy_route_disabled',
        'Legacy direct payment is disabled. Drink checkout is token-only.'
      );
    }

    const connection = await getUtcConnection();

    try {
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
        `,
        { orderId: params.orderId }
      );

      const order = orderRows[0];
      if (!order || order.user_id !== request.auth.userId) {
        throw new ApiError(404, 'order_not_found', 'Order was not found.');
      }

      return {
        bypass: true,
        message: 'Legacy direct payment bypassed during testing.',
        order: {
          id: order.id,
          order_ref: order.order_ref,
          daily_order_number: order.daily_order_number,
          status: order.status,
          payment_mode: order.payment_mode,
          final_total_rm: order.final_total_rm,
          token_amount_charged: order.token_amount_charged
        }
      };
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/orders/:orderId/collect', { preHandler: authenticateRequest }, async (request) => {
    const params = z.object({
      orderId: z.coerce.number().int().positive()
    }).parse(request.params);

    const connection = await getUtcConnection();
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
            reason,
            created_at
          )
          VALUES (
            :orderId,
            :fromStatus,
            'collected',
            'customer',
            :userId,
            :reason,
            UTC_TIMESTAMP()
          )
        `,
        {
          orderId: order.id,
          fromStatus: effectiveStatus,
          userId: request.auth.userId,
          reason: 'Order collected in app.'
        }
      );

      await createUserNotification(connection, {
        userId: request.auth.userId,
        type: 'order_collected',
        title: 'Order collected',
        body: `Your order ${order.order_ref} has been marked as collected.`,
        data: {
          order_id: order.id,
          order_ref: order.order_ref
        }
      });

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
        tp.token_price,
        i.is_qualifying_cup,
        c.code AS category_code,
        c.name AS category_name,
        CASE
          WHEN LOWER(c.code) IN ('coffee', 'non_coffee') THEN 'drink'
          WHEN LOWER(c.code) = 'food' THEN 'food'
          WHEN LOWER(c.code) = 'merchandise' THEN 'merchandise'
          WHEN LOWER(c.code) = 'candles' THEN 'candle'
          ELSE 'other'
        END AS category_product_kind_code,
        sc.code AS subcategory_code,
        sc.name AS subcategory_name
      FROM menu_items i
      JOIN menu_categories c ON c.id = i.category_id
      LEFT JOIN menu_subcategories sc ON sc.id = i.subcategory_id
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
