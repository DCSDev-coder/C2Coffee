import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateCounterDevice } from '../../counter/guard.js';
import { env } from '../../config/env.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { hashSha256 } from '../../lib/crypto.js';
import { getKualaLumpurDateParts } from '../../lib/kuala-lumpur-time.js';
import {
  createChipPurchase,
  getChipPurchase,
  verifyChipCallbackSignature
} from '../../payments/chip-client.js';
import { settleChipCounterPurchase } from '../../services/chip-counter-settlement.js';
import { isStoreTradingNow } from '../../services/store-availability.js';
import { releaseInventoryForOrder, reserveInventoryForOrder } from '../../services/inventory.js';
import { evaluateVoucherTopUpEligibility } from '../../services/voucher-topup-eligibility.js';
import { ApiError } from '../errors.js';
import {
  collectMatchedUnits,
  assertTierVoucherStillEligible,
  isVoucherAvailableNow,
  loadCheckoutMenuItems,
  normalizeMoney,
  parsePromotionRule,
  parseVoucherScope,
  type AppliedVoucherRow,
  verifyCheckoutModifiers
} from './checkout.js';
import { getBootstrapForUser } from './auth.js';

const itemSchema = z.object({
  menu_item_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(20),
  remarks: z.string().trim().max(500).nullish(),
  modifiers: z.array(z.object({
    group_name: z.string().trim().min(1).max(255),
    option_name: z.string().trim().min(1).max(255),
    price_delta_rm: z.union([z.string(), z.number()]).transform(Number),
    token_price_delta: z.coerce.number().int().min(-999).max(999).default(0),
    calorie_delta_kcal: z.coerce.number().int().min(-5000).max(5000).default(0)
  })).max(20).default([])
});

const createPaymentSchema = z.object({
  payment_method: z.enum(['duitnow_qr', 'ewallet']).nullish(),
  fulfillment_type: z.enum(['dine_in', 'take_away']),
  applied_voucher_id: z.coerce.number().int().positive().nullish(),
  voucher_authorization_token: z.string().trim().min(20).max(500).nullish(),
  items: z.array(itemSchema).min(1).max(20)
});

type CounterSession = RowDataPacket & { id: number; user_id: number; tenant_id: number };
type CounterStore = RowDataPacket & {
  id: number;
  tenant_id: number;
  status: 'active' | 'inactive';
  pickup_lead_minutes: number;
  temporarily_closed: number;
  timezone: string;
  weekly_hours_json: unknown;
};

function basketHash(payload: z.infer<typeof createPaymentSchema>): string {
  return hashSha256(JSON.stringify({
    applied_voucher_id: payload.applied_voucher_id,
    items: payload.items.map((item) => ({
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      remarks: item.remarks ?? null,
      modifiers: item.modifiers
    }))
  }));
}

function sessionToken(request: FastifyRequest): string | null {
  const value = request.headers['x-counter-customer-session'];
  const token = Array.isArray(value) ? value[0] : value;
  return token?.trim() || null;
}

async function optionalCustomerSession(request: FastifyRequest): Promise<CounterSession | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const [rows] = await mysqlPool.query<CounterSession[]>(
    `SELECT ccs.id, ccs.user_id, ccs.tenant_id
     FROM counter_customer_sessions ccs
     JOIN users u ON u.id = ccs.user_id AND u.status = 'active' AND u.deleted_at IS NULL
     WHERE ccs.token_hash = :tokenHash AND ccs.counter_device_id = :deviceId
       AND ccs.tenant_id = :tenantId AND ccs.ended_at IS NULL
       AND ccs.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    {
      tokenHash: hashSha256(token),
      deviceId: request.counterAuth.deviceId,
      tenantId: request.counterAuth.tenantId
    }
  );
  if (!rows[0]) {
    throw new ApiError(401, 'counter_customer_session_expired', 'Customer selection has expired. Enter the phone number again or continue without points.');
  }
  return rows[0];
}

async function guestUserId(connection: PoolConnection, storeId: number): Promise<number> {
  const phone = `+6099${String(storeId).padStart(10, '0')}`;
  await connection.execute(
    `INSERT INTO users (phone_e164, status, created_at, updated_at)
     VALUES (:phone, 'blocked', UTC_TIMESTAMP(), UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    { phone }
  );
  const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(
    'SELECT id FROM users WHERE phone_e164 = :phone LIMIT 1 FOR UPDATE',
    { phone }
  );
  const id = Number(rows[0]?.id ?? 0);
  if (!id) throw new ApiError(500, 'counter_guest_unavailable', 'Walk-in checkout could not be prepared.');
  await connection.execute(
    `INSERT INTO user_profiles (user_id, display_name, created_at, updated_at)
     VALUES (:userId, 'Walk-in Guest', UTC_TIMESTAMP(), UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE display_name = 'Walk-in Guest'`,
    { userId: id }
  );
  return id;
}

function orderRef(): string {
  const now = new Date();
  const stamp = `${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `C2-${stamp}-${crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase()}`;
}

async function allocateDailyOrderNumber(connection: PoolConnection, storeId: number): Promise<number> {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO store_daily_order_sequences (sequence_date, store_id, next_number)
     VALUES (UTC_DATE(), :storeId, 1)
     ON DUPLICATE KEY UPDATE next_number = LAST_INSERT_ID(next_number + 1)`,
    { storeId }
  );
  if (result.affectedRows === 1) return 1;
  const [rows] = await connection.query<Array<RowDataPacket & { allocated_number: number }>>(
    'SELECT LAST_INSERT_ID() AS allocated_number'
  );
  return Number(rows[0]?.allocated_number ?? 0);
}

function mysqlDate(value: Date): string {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

function callbackUrl(): string {
  return `${env.PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/payments/chip/counter-callback`;
}

async function queueDefaultPrintJob(
  connection: PoolConnection,
  storeId: number,
  orderId: number
): Promise<void> {
  const [printers] = await connection.execute<RowDataPacket[]>(
    `SELECT pt.id, pt.tenant_code
     FROM printer_targets pt
     JOIN stores s ON s.id = :storeId
     JOIN admin_tenants t ON t.id = s.tenant_id
     WHERE pt.tenant_code = t.code AND pt.store_id = s.id
       AND pt.delivery_mode = 'android_direct' AND pt.status = 'connected'
       AND pt.is_default = 1 AND pt.network_host IS NOT NULL
       AND pt.network_port IS NOT NULL AND pt.direct_print_device_key IS NOT NULL
     LIMIT 1`,
    { storeId }
  );
  if (!printers[0]) return;
  await connection.execute(
    `INSERT INTO print_jobs
       (job_ref, tenant_code, order_id, printer_target_id, requested_by_admin_user_id, request_type)
     VALUES (:jobRef, :tenantCode, :orderId, :printerTargetId, NULL, 'original')`,
    {
      jobRef: crypto.randomUUID(),
      tenantCode: printers[0].tenant_code,
      orderId,
      printerTargetId: printers[0].id
    }
  );
}

export async function registerCounterPaymentRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/counter/orders/payment', { preHandler: authenticateCounterDevice }, async (request) => {
    const payload = createPaymentSchema.parse(request.body);
    const keyHeader = request.headers['idempotency-key'];
    const idempotencyKey = (Array.isArray(keyHeader) ? keyHeader[0] : keyHeader)?.trim();
    if (!idempotencyKey || idempotencyKey.length > 64) {
      throw new ApiError(400, 'missing_idempotency_key', 'A checkout idempotency key is required.');
    }
    const session = await optionalCustomerSession(request);
    const connection = await getUtcConnection();
    let orderId = 0;
    let newOrderRef = '';
    let totalRm = 0;
    let isComplimentary = false;
    let customerName = 'Walk-in Guest';
    let customerEmail = '';
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT o.id, o.order_ref, o.status, CAST(o.final_total_rm AS CHAR) AS final_total_rm,
                p.status AS payment_status, p.payment_method, p.provider_bill_id
         FROM orders o LEFT JOIN payments p ON p.order_id = o.id
         WHERE o.store_id = :storeId AND o.checkout_idempotency_key = :key
         LIMIT 1 FOR UPDATE`,
        { storeId: request.counterAuth.storeId, key: idempotencyKey }
      );
      if (existing[0]?.provider_bill_id) {
        await connection.commit();
        const purchase = await getChipPurchase(String(existing[0].provider_bill_id));
        return {
          order_ref: existing[0].order_ref,
          status: existing[0].status,
          amount_rm: existing[0].final_total_rm,
          checkout_url: purchase.checkout_url
        };
      }
      if (existing[0]?.status === 'paid' && existing[0]?.payment_status === 'paid') {
        await connection.commit();
        return {
          order_ref: existing[0].order_ref,
          status: 'paid',
          payment_status: 'paid',
          amount_rm: existing[0].final_total_rm,
          checkout_url: null,
          requires_payment: false
        };
      }

      const [stores] = await connection.query<CounterStore[]>(
        `SELECT id, tenant_id, status, pickup_lead_minutes, temporarily_closed,
                timezone, weekly_hours_json
         FROM stores WHERE id = :storeId AND tenant_id = :tenantId LIMIT 1 FOR UPDATE`,
        { storeId: request.counterAuth.storeId, tenantId: request.counterAuth.tenantId }
      );
      const store = stores[0];
      if (!store || store.status !== 'active' || !isStoreTradingNow(store)) {
        throw new ApiError(409, 'store_closed', 'This outlet is currently closed and cannot accept orders.');
      }

      const bootstrap = session ? await getBootstrapForUser(session.user_id, connection) : null;
      const menuItems = await loadCheckoutMenuItems(
        connection,
        request.counterAuth.storeId,
        payload.items.map((item) => item.menu_item_id),
        bootstrap?.tier ?? 'kawan'
      );
      const byId = new Map(menuItems.map((item) => [Number(item.id), item]));
      const normalized: Array<{
        payload: z.infer<typeof itemSchema>;
        menuItem: (typeof menuItems)[number];
        basePriceRm: number;
        tokenPrice: number;
        modifierRm: number;
        modifierTokens: number;
        modifiers: Awaited<ReturnType<typeof verifyCheckoutModifiers>>;
      }> = [];
      let subtotal = 0;
      let modifiersTotal = 0;
      for (const item of payload.items) {
        const menuItem = byId.get(item.menu_item_id);
        if (!menuItem || menuItem.is_available !== 1) {
          throw new ApiError(400, 'menu_item_not_available', 'One or more items are unavailable.');
        }
        const modifiers = await verifyCheckoutModifiers(connection, store.tenant_id, menuItem.id, item.modifiers);
        const modifierTotal = modifiers.reduce((sum, modifier) => sum + normalizeMoney(modifier.price_delta_rm), 0);
        const basePrice = Number(menuItem.base_price_rm);
        subtotal += basePrice * item.quantity;
        modifiersTotal += modifierTotal * item.quantity;
        normalized.push({
          payload: { ...item, modifiers },
          menuItem,
          basePriceRm: basePrice,
          tokenPrice: menuItem.token_price ?? menuItem.base_price_token,
          modifierRm: modifierTotal,
          modifierTokens: modifiers.reduce((sum, modifier) => sum + modifier.token_price_delta, 0),
          modifiers
        });
      }
      const totalBeforeDiscount = normalizeMoney(subtotal + modifiersTotal);
      let discountRm = 0;
      if (payload.applied_voucher_id) {
        if (!session || !payload.voucher_authorization_token) {
          throw new ApiError(401, 'voucher_authorization_required', 'Customer approval is required to use this voucher.');
        }
        const [authorizations] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM counter_voucher_authorizations
           WHERE counter_customer_session_id = :sessionId AND counter_device_id = :deviceId
             AND tenant_id = :tenantId AND store_id = :storeId AND user_id = :userId
             AND user_voucher_id = :voucherId AND basket_hash = :basketHash
             AND authorization_token_hash = :tokenHash AND status = 'verified'
             AND verified_expires_at > UTC_TIMESTAMP()
           LIMIT 1 FOR UPDATE`,
          {
            sessionId: session.id, deviceId: request.counterAuth.deviceId,
            tenantId: request.counterAuth.tenantId, storeId: request.counterAuth.storeId,
            userId: session.user_id, voucherId: payload.applied_voucher_id,
            basketHash: basketHash(payload), tokenHash: hashSha256(payload.voucher_authorization_token)
          }
        );
        if (!authorizations[0]) {
          throw new ApiError(401, 'voucher_authorization_invalid', 'Voucher approval has expired or does not match this basket.');
        }
        const [voucherRows] = await connection.query<AppliedVoucherRow[]>(
          `SELECT uv.id, uv.user_id, uv.status, uv.issued_by_type, uv.issue_case_ref, uv.tier_at_issue, uv.expires_at,
                  vt.id AS template_id, vt.tenant_id AS template_tenant_id,
                  vt.code AS template_code, vt.name AS template_name, vt.voucher_type,
                  vt.discount_mode, CAST(vt.discount_value AS CHAR) AS discount_value,
                  vt.token_value, CAST(vt.min_spend_rm AS CHAR) AS min_spend_rm,
                  vt.requires_drink_in_cart, vt.eligible_scope_json, vt.exclude_scope_json,
                  vt.is_active AS template_is_active, vt.valid_until AS template_valid_until
           FROM user_vouchers uv JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
           WHERE uv.id = :voucherId AND uv.user_id = :userId LIMIT 1 FOR UPDATE`,
          { voucherId: payload.applied_voucher_id, userId: session.user_id }
        );
        const voucher = voucherRows[0];
        if (!voucher || voucher.status !== 'active' || voucher.template_is_active !== 1 ||
            voucher.template_tenant_id !== store.tenant_id) {
          throw new ApiError(400, 'voucher_not_active', 'Selected voucher is no longer available.');
        }
        const [voucherOrders] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM orders
           WHERE voucher_id = :voucherId
             AND status NOT IN ('payment_failed', 'cancelled', 'refunded')
           LIMIT 1 FOR UPDATE`,
          { voucherId: payload.applied_voucher_id }
        );
        if (voucherOrders[0]) {
          throw new ApiError(409, 'voucher_checkout_in_progress', 'This voucher is already attached to another checkout.');
        }
        const scope = parseVoucherScope(voucher.eligible_scope_json);
        const topUpEligibility = evaluateVoucherTopUpEligibility({
          scope,
          templateId: Number(voucher.template_id),
          issueCaseRef: voucher.issue_case_ref,
          issuedByType: voucher.issued_by_type
        });
        if (!topUpEligibility.eligible) {
          throw new ApiError(
            400,
            'voucher_topup_not_qualified',
            topUpEligibility.unavailableReason ?? 'Complete the required top-up before using this voucher.'
          );
        }
        const rule = parsePromotionRule(scope);
        let birthdayMonthDay: string | null = null;
        const schedule = scope.schedule && typeof scope.schedule === 'object'
          ? scope.schedule as Record<string, unknown> : null;
        const isBirthdayVoucher = (voucher.issue_case_ref?.startsWith('tier_birthday:') ?? false) ||
          voucher.voucher_type === 'birthday_treat' || String(schedule?.mode ?? 'always') === 'birthday';
        if ((!isBirthdayVoucher && voucher.template_valid_until && new Date(voucher.template_valid_until).getTime() <= Date.now()) ||
            new Date(voucher.expires_at).getTime() <= Date.now()) {
          throw new ApiError(400, 'voucher_expired', 'Selected voucher has expired.');
        }
        await assertTierVoucherStillEligible(connection, voucher);
        if (isBirthdayVoucher) {
          const [birthdays] = await connection.query<Array<RowDataPacket & { birthday_month_day: string | null }>>(
            `SELECT DATE_FORMAT(birthday, '%m-%d') AS birthday_month_day FROM user_profiles WHERE user_id = :userId LIMIT 1`,
            { userId: session.user_id }
          );
          birthdayMonthDay = birthdays[0]?.birthday_month_day ?? null;
        }
        if ((isBirthdayVoucher && birthdayMonthDay?.slice(0, 2) !== getKualaLumpurDateParts().month) ||
            !isVoucherAvailableNow(scope, new Date(), birthdayMonthDay)) {
          throw new ApiError(400, 'voucher_not_available_now', 'Selected voucher is outside its active promotion time.');
        }
        const qualifying = collectMatchedUnits(rule.qualifying_scope, normalized);
        const rewards = collectMatchedUnits(rule.reward_scope, normalized);
        if (qualifying.length < rule.qualifying_quantity || rewards.length < rule.reward_quantity) {
          throw new ApiError(400, 'voucher_not_applicable_to_cart', 'Selected voucher does not match this basket.');
        }
        const minimum = voucher.min_spend_rm === null ? 0 : Number(voucher.min_spend_rm);
        if (minimum > 0 && totalBeforeDiscount < minimum) {
          throw new ApiError(400, 'voucher_min_spend_not_met', `Minimum spend of RM ${minimum.toFixed(2)} is required.`);
        }
        const rewardable = rewards.slice().sort(
          (a, b) => (b.basePriceRm + b.modifierRm) - (a.basePriceRm + a.modifierRm)
        ).slice(0, rule.reward_quantity);
        if (voucher.discount_mode === 'fixed_rm') discountRm = Math.min(totalBeforeDiscount, Number(voucher.discount_value));
        else if (voucher.discount_mode === 'percent_rm') discountRm = Math.min(totalBeforeDiscount, totalBeforeDiscount * Number(voucher.discount_value) / 100);
        else if (voucher.discount_mode === 'free_drink') discountRm = rewardable.reduce((sum, unit) => sum + unit.basePriceRm + unit.modifierRm, 0);
        else throw new ApiError(400, 'voucher_payment_mode_mismatch', 'This voucher cannot be used for an RM counter order.');
        discountRm = normalizeMoney(discountRm);
        await connection.execute(
          `UPDATE counter_voucher_authorizations SET status = 'consumed', consumed_at = UTC_TIMESTAMP() WHERE id = :id`,
          { id: authorizations[0].id }
        );
      }
      totalRm = Math.max(0, normalizeMoney(totalBeforeDiscount - discountRm));
      isComplimentary = totalRm === 0 && payload.applied_voucher_id != null;
      if (totalRm === 0 && !isComplimentary) {
        throw new ApiError(400, 'counter_total_invalid', 'A zero-value counter order requires an approved voucher.');
      }
      if (totalRm > 0 && !payload.payment_method) {
        throw new ApiError(400, 'counter_payment_method_required', 'Choose a payment method to continue.');
      }

      const userId = session?.user_id ?? await guestUserId(connection, request.counterAuth.storeId);
      if (session) {
        const [profiles] = await connection.query<RowDataPacket[]>(
          `SELECT up.display_name, up.email FROM user_profiles up WHERE up.user_id = :userId LIMIT 1`,
          { userId }
        );
        customerName = String(profiles[0]?.display_name || 'C2 Customer');
        customerEmail = String(profiles[0]?.email || '');
      }

      newOrderRef = orderRef();
      const dailyNumber = await allocateDailyOrderNumber(connection, request.counterAuth.storeId);
      const pickupAt = new Date(Date.now() + Number(store.pickup_lead_minutes || 15) * 60_000);
      const [orderResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO orders
           (order_ref, checkout_idempotency_key, daily_order_number, user_id, is_guest,
            order_channel, fulfillment_type, store_id, status, payment_mode, paid_at,
            subtotal_rm, modifier_total_rm, discount_total_rm, final_total_rm,
            token_amount_charged, voucher_id, pickup_slot_at, created_at)
         VALUES
           (:orderRef, :key, :dailyNumber, :userId, :isGuest, 'counter', :fulfillment,
            :storeId, :orderStatus, 'direct', :paidAt, :subtotal, :modifiers, :discount, :total,
            0, :voucherId, :pickupAt, UTC_TIMESTAMP())`,
        {
          orderRef: newOrderRef,
          key: idempotencyKey,
          dailyNumber,
          userId,
          isGuest: session ? 0 : 1,
          fulfillment: payload.fulfillment_type,
          storeId: request.counterAuth.storeId,
          orderStatus: isComplimentary ? 'paid' : 'pending_payment',
          paidAt: isComplimentary ? mysqlDate(new Date()) : null,
          subtotal: normalizeMoney(subtotal).toFixed(2),
          modifiers: normalizeMoney(modifiersTotal).toFixed(2),
          discount: discountRm.toFixed(2),
          total: totalRm.toFixed(2),
          voucherId: payload.applied_voucher_id ?? null,
          pickupAt: mysqlDate(pickupAt)
        }
      );
      orderId = orderResult.insertId;

      for (const item of normalized) {
        const [itemResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO order_items
             (order_id, menu_item_id, item_name_snapshot, base_price_rm_snapshot,
              token_price_snapshot, base_calories_kcal_snapshot, quantity,
              line_subtotal_rm, line_token_amount, is_qualifying_cup)
           VALUES (:orderId, :menuItemId, :name, :basePrice, NULL, :calories,
                   :quantity, :lineSubtotal, NULL, :qualifying)`,
          {
            orderId,
            menuItemId: item.menuItem.id,
            name: item.menuItem.name,
            basePrice: item.basePriceRm.toFixed(2),
            calories: item.menuItem.base_calories_kcal,
            quantity: item.payload.quantity,
            lineSubtotal: normalizeMoney((item.basePriceRm + item.modifierRm) * item.payload.quantity).toFixed(2),
            qualifying: item.menuItem.is_qualifying_cup
          }
        );
        for (const modifier of item.modifiers) {
          await connection.execute(
            `INSERT INTO order_item_modifiers
               (order_item_id, option_group_option_id, modifier_group_name_snapshot, modifier_option_name_snapshot,
                price_delta_rm_snapshot, token_price_delta_snapshot, calorie_delta_kcal_snapshot)
             VALUES (:itemId, :optionGroupOptionId, :groupName, :optionName, :price, 0, :calories)`,
            {
              itemId: itemResult.insertId,
              optionGroupOptionId: modifier.option_group_option_id ?? null,
              groupName: modifier.group_name,
              optionName: modifier.option_name,
              price: normalizeMoney(modifier.price_delta_rm).toFixed(2),
              calories: modifier.calorie_delta_kcal
            }
          );
        }
        if (item.payload.remarks) {
          await connection.execute(
            `INSERT INTO order_item_modifiers
               (order_item_id, modifier_group_name_snapshot, modifier_option_name_snapshot,
                price_delta_rm_snapshot, token_price_delta_snapshot, calorie_delta_kcal_snapshot)
             VALUES (:itemId, 'Remarks', :remarks, 0, 0, 0)`,
            { itemId: itemResult.insertId, remarks: item.payload.remarks }
          );
        }
      }

      await reserveInventoryForOrder(connection, orderId);

      await connection.execute(
        `INSERT INTO payments
           (order_id, provider, payment_method, provider_payment_ref, amount_rm, status, paid_at, created_at)
         VALUES (:orderId, :provider, :method, :reference, :amount, :paymentStatus, :paidAt, UTC_TIMESTAMP())`,
        {
          orderId,
          provider: isComplimentary ? 'complimentary' : 'chip',
          method: isComplimentary ? null : payload.payment_method ?? null,
          reference: `CP-${newOrderRef}`,
          amount: totalRm.toFixed(2),
          paymentStatus: isComplimentary ? 'paid' : 'pending',
          paidAt: isComplimentary ? mysqlDate(new Date()) : null
        }
      );
      await connection.execute(
        `INSERT INTO order_status_history
           (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
         VALUES (:orderId, NULL, :orderStatus, 'counter_device', :deviceId,
                 :reason, UTC_TIMESTAMP())`,
        {
          orderId,
          orderStatus: isComplimentary ? 'paid' : 'pending_payment',
          deviceId: request.counterAuth.deviceId,
          reason: isComplimentary
            ? 'Approved voucher covered the full counter order.'
            : 'Counter checkout started.'
        }
      );
      if (isComplimentary && payload.applied_voucher_id) {
        const [redeemed] = await connection.execute<ResultSetHeader>(
          `UPDATE user_vouchers SET status = 'redeemed', redeemed_at = UTC_TIMESTAMP()
           WHERE id = :voucherId AND status = 'active'`,
          { voucherId: payload.applied_voucher_id }
        );
        if (redeemed.affectedRows !== 1) {
          throw new ApiError(409, 'voucher_redemption_conflict', 'The selected voucher is no longer available.');
        }
        await connection.execute(
          `INSERT INTO voucher_redemptions
             (user_voucher_id, order_id, discount_rm, discount_token_amount, created_at)
           VALUES (:voucherId, :orderId, :discount, NULL, UTC_TIMESTAMP())`,
          { voucherId: payload.applied_voucher_id, orderId, discount: discountRm.toFixed(2) }
        );
        await queueDefaultPrintJob(connection, request.counterAuth.storeId, orderId);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (isComplimentary) {
      return {
        order_ref: newOrderRef,
        status: 'paid',
        payment_status: 'paid',
        amount_rm: totalRm.toFixed(2),
        checkout_url: null,
        payment_method: null,
        requires_payment: false
      };
    }

    let purchase: { id: string; checkoutUrl: string };
    try {
      purchase = await createChipPurchase({
        reference: `CP-${newOrderRef}`,
        customerName,
        customerEmail: customerEmail || `walkin+${newOrderRef.toLowerCase()}@c2coffeeandcandle.com`,
        amountCents: Math.round(totalRm * 100),
        description: `C2 Coffee counter order ${newOrderRef}`,
        method: payload.payment_method!,
        callbackUrl: callbackUrl()
      });
    } catch (error) {
      await mysqlPool.execute(
        `UPDATE payments SET status = 'failed', failed_at = UTC_TIMESTAMP()
         WHERE order_id = :orderId AND status = 'pending'`,
        { orderId }
      );
      await mysqlPool.execute(
        `UPDATE orders SET status = 'payment_failed'
         WHERE id = :orderId AND status = 'pending_payment'`,
        { orderId }
      );
      const inventoryConnection = await getUtcConnection();
      try {
        await inventoryConnection.beginTransaction();
        await releaseInventoryForOrder(inventoryConnection, orderId);
        await inventoryConnection.commit();
      } catch (inventoryError) {
        await inventoryConnection.rollback();
        request.log.error({ err: inventoryError, orderRef: newOrderRef }, 'Inventory reservation release failed after counter payment creation failure.');
      } finally {
        inventoryConnection.release();
      }
      throw error;
    }
    await mysqlPool.execute(
      `UPDATE payments SET provider_bill_id = :purchaseId
       WHERE order_id = :orderId AND provider = 'chip' AND status = 'pending'`,
      { purchaseId: purchase.id, orderId }
    );
    return {
      order_ref: newOrderRef,
      status: 'pending_payment',
      amount_rm: totalRm.toFixed(2),
      checkout_url: purchase.checkoutUrl,
      payment_method: payload.payment_method,
      requires_payment: true
    };
  });

  app.get('/v1/counter/orders/:orderRef/payment', { preHandler: authenticateCounterDevice }, async (request) => {
    const { orderRef } = z.object({ orderRef: z.string().trim().min(1).max(80) }).parse(request.params);
    let [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT o.order_ref, o.status, CAST(o.final_total_rm AS CHAR) AS amount_rm,
              p.status AS payment_status, p.payment_method, p.provider_bill_id
       FROM orders o JOIN payments p ON p.order_id = o.id
       WHERE o.order_ref = :orderRef AND o.store_id = :storeId
         AND o.order_channel = 'counter' LIMIT 1`,
      { orderRef, storeId: request.counterAuth.storeId }
    );
    if (!rows[0]) throw new ApiError(404, 'counter_order_not_found', 'Counter order was not found.');
    if (rows[0].payment_status === 'pending' && rows[0].provider_bill_id) {
      const purchaseId = String(rows[0].provider_bill_id);
      const purchase = await getChipPurchase(purchaseId);
      await settleChipCounterPurchase(purchaseId, purchase, 'counter_status_check');
      [rows] = await mysqlPool.query<RowDataPacket[]>(
        `SELECT o.order_ref, o.status, CAST(o.final_total_rm AS CHAR) AS amount_rm,
                p.status AS payment_status, p.payment_method
         FROM orders o JOIN payments p ON p.order_id = o.id
         WHERE o.order_ref = :orderRef AND o.store_id = :storeId
           AND o.order_channel = 'counter' LIMIT 1`,
        { orderRef, storeId: request.counterAuth.storeId }
      );
    }
    return rows[0];
  });

  app.post('/v1/payments/chip/counter-callback', { config: { rawBody: true } }, async (request) => {
    const signatureHeader = request.headers['x-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature || !Buffer.isBuffer(request.rawBody) ||
        !await verifyChipCallbackSignature(request.rawBody, signature)) {
      throw new ApiError(401, 'invalid_chip_signature', 'Invalid CHIP callback signature.');
    }
    const callback = z.object({ id: z.string().uuid() }).passthrough().parse(request.body);
    const purchase = await getChipPurchase(callback.id);
    return settleChipCounterPurchase(callback.id, purchase);
  });
}
