import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateRequest } from '../../auth/guard.js';
import { env } from '../../config/env.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { normalizePhoneE164 } from '../../lib/phone.js';
import { createUserNotification } from '../notifications.js';
import { assertCustomerAccess } from '../../services/app-maintenance.js';
import { assertChipConfigured, cancelChipPurchase, createChipPurchase, getActiveChipMethods, getChipPurchase, isTrustedChipCheckoutUrl, type ChipPaymentMethod } from '../../payments/chip-client.js';
import { settleChipGiftCardPurchase } from '../../services/chip-gift-card-settlement.js';
import { currentEmployeeAllowancePeriod, ensureEmployeeAllowance } from '../../services/employee-token-allowance.js';
import { creditGiftCardToWallet } from '../../services/gift-cards.js';
import { deliverPushToUser } from '../../services/push-delivery.js';

const money = z.coerce.number().int().min(5).max(5000);
const tokenAmount = z.coerce.number().int().min(5).max(5000);
const paymentMethod = z.enum(['fpx', 'duitnow_qr', 'card', 'ewallet']);
const purchaseSchema = z.object({
  currency: z.enum(['rm', 'token']),
  amount: z.union([money, tokenAmount]),
  recipient_phone: z.string().trim().max(30).optional().nullable(),
  recipient_message: z.string().trim().max(280).optional().nullable(),
  payment_method: paymentMethod.optional()
}).superRefine((value, context) => {
  if (value.currency === 'token' && (!Number.isInteger(Number(value.amount)) || Number(value.amount) < 5)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Token gift cards must use a whole number of at least 5 tokens.' });
  }
  if (value.currency === 'rm' && !value.payment_method) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_method'], message: 'Choose an RM payment method.' });
  }
  if (value.currency === 'rm' && !Number.isInteger(Number(value.amount))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'RM gift cards must use a whole-ringgit amount because they are credited as C2 Tokens.' });
  }
});

const claimSchema = z.object({ code: z.string().trim().min(8).max(40) });
const listQuery = z.object({ include_history: z.enum(['1', 'true']).optional().transform((value) => value !== undefined) });

function buildCode(): string {
  return `C2G-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function buildPurchaseRef(): string {
  return `GFT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
}

function callbackUrl(): string {
  return `${env.PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/payments/chip/callback`;
}

async function tenantForUser(connection: typeof mysqlPool | Awaited<ReturnType<typeof getUtcConnection>>, userId: number): Promise<number> {
  const [rows] = await connection.query<Array<RowDataPacket & { tenant_id: number }>>(
    `SELECT ctm.tenant_id
       FROM customer_tenant_memberships ctm
       JOIN admin_tenants t ON t.id = ctm.tenant_id
      WHERE ctm.user_id = :userId AND t.status = 'active'
      ORDER BY ctm.created_at ASC LIMIT 1`,
    { userId }
  );
  if (rows[0]) return Number(rows[0].tenant_id);
  const [tenants] = await connection.query<Array<RowDataPacket & { id: number }>>(
    `SELECT id FROM admin_tenants WHERE status = 'active' ORDER BY id LIMIT 1`
  );
  if (!tenants[0]) throw new ApiError(409, 'gift_card_tenant_unavailable', 'Gift cards are not available until the café is configured.');
  return Number(tenants[0].id);
}

type ExistingPurchase = RowDataPacket & {
  id: number;
  code: string;
  currency: 'rm' | 'token';
  original_amount: string;
  status: string;
  purchase_ref: string;
  provider_bill_id: string | null;
  recipient_user_id: number | null;
  claimed_at: Date | null;
};

function readIdempotencyKey(value: string | string[] | undefined): string {
  const key = Array.isArray(value) ? value[0] : value;
  if (!key || !/^[A-Za-z0-9_-]{12,64}$/.test(key)) {
    throw new ApiError(400, 'invalid_idempotency_key', 'A valid Idempotency-Key header is required for gift-card purchases.');
  }
  return key;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}

async function findExistingPurchase(userId: number, idempotencyKey: string): Promise<ExistingPurchase | null> {
  const [rows] = await mysqlPool.query<ExistingPurchase[]>(
    `SELECT gc.id, gc.code, gc.currency, CAST(gc.original_amount AS CHAR) AS original_amount,
            gc.status, gc.purchase_ref, gc.recipient_user_id, gc.claimed_at, p.provider_bill_id
       FROM gift_cards gc
       LEFT JOIN payments p ON p.gift_card_id = gc.id
      WHERE gc.purchaser_user_id = :userId
        AND gc.purchase_idempotency_key = :idempotencyKey
      LIMIT 1`,
    { userId, idempotencyKey }
  );
  return rows[0] ?? null;
}

async function purchaseResponse(purchase: ExistingPurchase): Promise<Record<string, unknown>> {
  let checkoutUrl: string | undefined;
  if (purchase.status === 'pending_payment' && purchase.provider_bill_id) {
    try {
      const providerPurchase = await getChipPurchase(purchase.provider_bill_id);
      const candidate = typeof providerPurchase.checkout_url === 'string' ? providerPurchase.checkout_url : '';
      if (isTrustedChipCheckoutUrl(candidate)) checkoutUrl = candidate;
    } catch {
      // The status endpoint remains available even if CHIP is temporarily unavailable.
    }
  }
  return {
    id: Number(purchase.id),
    code: purchase.code,
    purchase_ref: purchase.purchase_ref,
    status: purchase.status === 'depleted' && purchase.recipient_user_id && purchase.claimed_at ? 'delivered' : purchase.status,
    currency: purchase.currency,
    amount: purchase.currency === 'rm' ? Number(purchase.original_amount).toFixed(2) : Number(purchase.original_amount),
    ...(checkoutUrl ? { checkout_url: checkoutUrl } : {})
  };
}

export async function registerGiftCardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/gift-cards/payment-methods', { preHandler: authenticateRequest }, async () => {
    if (!env.TOPUP_GATEWAY_ENABLED || env.TOPUP_GATEWAY_PROVIDER !== 'chip') return { methods: [] };
    const methods = await getActiveChipMethods();
    return { methods: [...methods.keys()] };
  });

  app.post('/v1/gift-cards', { preHandler: authenticateRequest, config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } }, async (request, reply) => {
    await assertCustomerAccess(request.auth.userId);
    const payload = purchaseSchema.parse(request.body);
    const idempotencyKey = readIdempotencyKey(request.headers['idempotency-key']);
    payload.recipient_phone = payload.recipient_phone?.trim() ? normalizePhoneE164(payload.recipient_phone) : null;
    const existingPurchase = await findExistingPurchase(request.auth.userId, idempotencyKey);
    if (existingPurchase) return reply.code(200).send(await purchaseResponse(existingPurchase));
    const amount = Number(payload.amount);
    const connection = await getUtcConnection();
    let committed = false;
    let cardId = 0;
    let code = '';
    let purchaseRef = '';
    let purchaserName = 'C2 Coffee customer';
    let purchaserEmail = '';
    let deliveredRecipientUserId: number | null = null;

    try {
      await connection.beginTransaction();
      const tenantId = await tenantForUser(connection, request.auth.userId);
      code = buildCode();
      purchaseRef = buildPurchaseRef();
      const isToken = payload.currency === 'token';
      const [recipientRows] = payload.recipient_phone ? await connection.execute<Array<RowDataPacket & { id: number }>>(`SELECT u.id FROM users u JOIN customer_tenant_memberships ctm ON ctm.user_id = u.id WHERE u.phone_e164 = :phone AND ctm.tenant_id = :tenantId LIMIT 1`, { phone: payload.recipient_phone, tenantId }) : [[]];
      const recipientUserId = recipientRows[0]?.id ?? null;
      if (payload.recipient_phone && !recipientUserId) throw new ApiError(404, 'gift_card_recipient_not_found', 'That phone number is not registered for this café. Leave the phone field blank to create a shareable gift-card code.');
      if (isToken) {
        // Employee allowance is held inside the token account balance, but it
        // is reserved for eligible drinks and must never fund a gift card.
        const period = currentEmployeeAllowancePeriod();
        const [membershipRows] = await connection.execute<Array<RowDataPacket & { is_employee: number; subsidy_role: string }>>(
          `SELECT is_employee, COALESCE(subsidy_role, 'none') AS subsidy_role FROM customer_tenant_memberships
             WHERE tenant_id = :tenantId AND user_id = :userId LIMIT 1 FOR UPDATE`,
          { tenantId, userId: request.auth.userId }
        );
        const membership = membershipRows[0];
        const effectiveSubsidyRole = membership
          ? (membership.subsidy_role && membership.subsidy_role !== 'none'
              ? membership.subsidy_role
              : Number(membership.is_employee) === 1 ? 'employee' : 'none')
          : 'none';
        if (effectiveSubsidyRole === 'employee' || effectiveSubsidyRole === 'intern') {
          await ensureEmployeeAllowance(connection, request.auth.userId, tenantId);
        }
        const [accounts] = await connection.execute<Array<RowDataPacket & { balance_available: number }>>(
          `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`, { userId: request.auth.userId }
        );
        const account = accounts[0];
        const [allowanceRows] = await connection.execute<Array<RowDataPacket & { remaining_amount: number }>>(
          `SELECT remaining_amount
             FROM employee_token_allowances
            WHERE tenant_id = :tenantId AND user_id = :userId
              AND period_start = :periodStart AND status = 'active'
            LIMIT 1 FOR UPDATE`,
          { tenantId, userId: request.auth.userId, periodStart: period.start }
        );
        const allowanceRemaining = Number(allowanceRows[0]?.remaining_amount ?? 0);
        const personalBalance = Number(account?.balance_available ?? 0) - allowanceRemaining;
        if (!account || personalBalance < amount) throw new ApiError(400, 'insufficient_personal_token_balance', 'Your personal C2 Credit is not enough for this gift card. Monthly Subsidy tokens cannot be used for gift cards.');
        const balanceAfter = Number(account.balance_available) - amount;
        await connection.execute(`UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`, { balanceAfter, userId: request.auth.userId });
        const [insert] = await connection.execute<ResultSetHeader>(
          `INSERT INTO gift_cards (tenant_id, code, currency, original_amount, remaining_amount, status, purchaser_user_id, recipient_user_id, recipient_phone, recipient_message, purchase_ref, purchase_idempotency_key, paid_at, created_at)
           VALUES (:tenantId, :code, 'token', :amount, :amount, 'active', :userId, :recipientUserId, :recipientPhone, :message, :purchaseRef, :idempotencyKey, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
          { tenantId, code, amount, userId: request.auth.userId, recipientUserId, recipientPhone: payload.recipient_phone, message: payload.recipient_message ?? null, purchaseRef, idempotencyKey }
        );
        cardId = insert.insertId;
        await connection.execute(
          `INSERT INTO token_ledger (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
           VALUES (:userId, NULL, 'debit', 'gift_card_purchase', :cardId, :amount, :balanceAfter, :remarks, UTC_TIMESTAMP())`,
          { userId: request.auth.userId, cardId, amount, balanceAfter, remarks: `Gift card ${code}` }
        );
        await connection.execute(
          `INSERT INTO gift_card_transactions (gift_card_id, transaction_type, amount, balance_after, actor_user_id, remarks, created_at)
           VALUES (:cardId, 'issued', :amount, :amount, :userId, :remarks, UTC_TIMESTAMP())`,
          { cardId, amount, userId: request.auth.userId, remarks: `Token gift card ${code}` }
        );
        if (recipientUserId) {
          await creditGiftCardToWallet(connection, cardId, Number(recipientUserId));
          deliveredRecipientUserId = Number(recipientUserId);
        }
      } else {
        assertChipConfigured();
        const [profileRows] = await connection.execute<Array<RowDataPacket & { display_name: string | null; email: string | null }>>(
          `SELECT up.display_name, up.email FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id WHERE u.id = :userId LIMIT 1`, { userId: request.auth.userId }
        );
        purchaserName = profileRows[0]?.display_name?.trim() || purchaserName;
        purchaserEmail = profileRows[0]?.email?.trim() || '';
        if (!purchaserEmail) throw new ApiError(409, 'gift_card_email_required', 'Add a verified email address in Settings before buying an RM gift card.');
        const [insert] = await connection.execute<ResultSetHeader>(
          `INSERT INTO gift_cards (tenant_id, code, currency, original_amount, remaining_amount, status, purchaser_user_id, recipient_user_id, recipient_phone, recipient_message, purchase_ref, purchase_idempotency_key, created_at)
           VALUES (:tenantId, :code, 'rm', :amount, :amount, 'pending_payment', :userId, :recipientUserId, :recipientPhone, :message, :purchaseRef, :idempotencyKey, UTC_TIMESTAMP())`,
          { tenantId, code, amount: amount.toFixed(2), userId: request.auth.userId, recipientUserId, recipientPhone: payload.recipient_phone, message: payload.recipient_message ?? null, purchaseRef, idempotencyKey }
        );
        cardId = insert.insertId;
        await connection.execute(
          `INSERT INTO payments (gift_card_id, provider, payment_method, provider_payment_ref, amount_rm, status, created_at, expires_at)
           VALUES (:cardId, 'chip', :method, :purchaseRef, :amount, 'pending', UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))`,
          { cardId, method: payload.payment_method!, purchaseRef, amount: amount.toFixed(2) }
        );
      }
      await connection.commit();
      committed = true;
    } catch (error) {
      if (!committed) await connection.rollback();
      if (isDuplicateKeyError(error)) {
        const duplicate = await findExistingPurchase(request.auth.userId, idempotencyKey);
        if (duplicate) return reply.code(200).send(await purchaseResponse(duplicate));
      }
      throw error;
    } finally {
      connection.release();
    }

    if (payload.currency === 'token') {
      if (deliveredRecipientUserId) {
        void deliverPushToUser({
          userId: deliveredRecipientUserId,
          title: 'Gift card added to your wallet',
          body: `${amount} C2 Tokens are ready in your wallet.`,
          data: { type: 'gift_card_received', gift_card_id: String(cardId) }
        }).catch((error) => request.log.warn({ err: error, giftCardId: cardId }, 'Gift-card push failed after wallet credit.'));
      }
      return reply.code(201).send({ id: cardId, code, purchase_ref: purchaseRef, status: deliveredRecipientUserId ? 'delivered' : 'active', currency: 'token', amount });
    }

    let providerPurchaseId = '';
    let providerAttached = false;
    try {
      const purchase = await createChipPurchase({ reference: purchaseRef, customerName: purchaserName, customerEmail: purchaserEmail, amountCents: Math.round(amount * 100), description: `C2 Coffee RM gift card ${code}`, method: payload.payment_method as ChipPaymentMethod, callbackUrl: callbackUrl() });
      providerPurchaseId = purchase.id;
      const [attachResult] = await mysqlPool.execute<ResultSetHeader>(
        `UPDATE payments SET provider_bill_id = :purchaseId WHERE gift_card_id = :cardId AND status = 'pending' AND provider_bill_id IS NULL`,
        { purchaseId: purchase.id, cardId }
      );
      if (attachResult.affectedRows !== 1) {
        throw new ApiError(409, 'gift_card_payment_attach_failed', 'The payment could not be attached safely. Please try again.');
      }
      providerAttached = true;
      return reply.code(201).send({ id: cardId, code, purchase_ref: purchaseRef, status: 'pending_payment', currency: 'rm', amount: amount.toFixed(2), checkout_url: purchase.checkoutUrl });
    } catch (error) {
      if (providerPurchaseId && !providerAttached) {
        try { await cancelChipPurchase(providerPurchaseId); } catch { /* readiness checks retain the failed local record for review */ }
      }
      await mysqlPool.execute(`UPDATE gift_cards SET status = 'cancelled' WHERE id = :cardId AND status = 'pending_payment'`, { cardId });
      await mysqlPool.execute(`UPDATE payments SET status = 'failed', failed_at = UTC_TIMESTAMP() WHERE gift_card_id = :cardId AND status = 'pending'`, { cardId });
      throw error;
    }
  });

  app.get('/v1/gift-cards', { preHandler: authenticateRequest }, async (request) => {
    const { include_history: includeHistory } = listQuery.parse(request.query);
    const [rows] = await mysqlPool.query<Array<RowDataPacket & { id: number; code: string; currency: 'rm' | 'token'; original_amount: string; remaining_amount: string; status: string; recipient_phone: string | null; recipient_message: string | null; purchase_ref: string | null; purchaser_user_id: number | null; recipient_user_id: number | null; claimed_at: Date | null; created_at: Date; expires_at: Date | null }>>(
      `SELECT id, code, currency, CAST(original_amount AS CHAR) AS original_amount, CAST(remaining_amount AS CHAR) AS remaining_amount,
              status, recipient_phone, recipient_message, purchase_ref, purchaser_user_id, recipient_user_id, claimed_at, created_at, expires_at
         FROM gift_cards
        WHERE (purchaser_user_id = :userId OR (recipient_user_id = :userId AND claimed_at IS NOT NULL))
          ${includeHistory ? '' : "AND status IN ('pending_payment', 'active', 'suspended')"}
        ORDER BY created_at DESC, id DESC`,
      { userId: request.auth.userId }
    );
    return {
      gift_cards: rows.map((row) => ({
        ...row,
        original_amount: row.original_amount,
        remaining_amount: row.remaining_amount,
        created_at: row.created_at.toISOString(),
        expires_at: row.expires_at?.toISOString() ?? null,
        ownership: Number(row.purchaser_user_id) === request.auth.userId ? 'purchased' : 'received',
        is_redeemable:
          Number(row.recipient_user_id) === request.auth.userId &&
          row.claimed_at != null &&
          row.status === 'active' &&
          Number(row.remaining_amount) > 0
      }))
    };
  });

  app.post('/v1/gift-cards/claim', { preHandler: authenticateRequest, config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request) => {
    const { code } = claimSchema.parse(request.body);
    const connection = await getUtcConnection();
    let committed = false;
    try {
      await connection.beginTransaction();
      const [users] = await connection.execute<Array<RowDataPacket & { phone_e164: string }>>(`SELECT phone_e164 FROM users WHERE id = :userId LIMIT 1`, { userId: request.auth.userId });
      const phone = users[0]?.phone_e164;
      const [cards] = await connection.execute<Array<RowDataPacket & { id: number; status: string; recipient_user_id: number | null; recipient_phone: string | null; remaining_amount: string; claimed_at: Date | null }>>(
        `SELECT id, status, recipient_user_id, recipient_phone, CAST(remaining_amount AS CHAR) AS remaining_amount, claimed_at FROM gift_cards WHERE code = :code LIMIT 1 FOR UPDATE`, { code: code.toUpperCase() }
      );
      const card = cards[0];
      if (!card || card.status !== 'active') throw new ApiError(404, 'gift_card_unavailable', 'This gift card is not available to claim.');
      if (card.recipient_user_id && Number(card.recipient_user_id) !== request.auth.userId) throw new ApiError(409, 'gift_card_claimed', 'This gift card has already been assigned to another customer.');
      if (card.recipient_phone && (!phone || card.recipient_phone !== phone)) throw new ApiError(403, 'gift_card_recipient_mismatch', 'Sign in using the recipient phone number to claim this card.');
      const balanceAfter = await creditGiftCardToWallet(connection, Number(card.id), request.auth.userId);
      await connection.execute(`UPDATE gift_cards SET recipient_user_id = :userId, claimed_at = COALESCE(claimed_at, UTC_TIMESTAMP()) WHERE id = :cardId`, { userId: request.auth.userId, cardId: card.id });
      await connection.commit();
      committed = true;
      return { claimed: true, gift_card_id: card.id, wallet_balance: balanceAfter };
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/gift-cards/purchases/:purchaseRef', { preHandler: authenticateRequest }, async (request) => {
    const { purchaseRef } = z.object({ purchaseRef: z.string().trim().min(1).max(60) }).parse(request.params);
    const [rows] = await mysqlPool.execute<Array<RowDataPacket & { id: number; status: string; purchase_ref: string; provider_bill_id: string | null }>>(
      `SELECT gc.id, gc.status, gc.purchase_ref, p.provider_bill_id
         FROM gift_cards gc LEFT JOIN payments p ON p.gift_card_id = gc.id
        WHERE gc.purchase_ref = :purchaseRef AND gc.purchaser_user_id = :userId LIMIT 1`, { purchaseRef, userId: request.auth.userId }
    );
    const card = rows[0];
    if (!card) throw new ApiError(404, 'gift_card_not_found', 'Gift card purchase was not found.');
    if (card.status === 'pending_payment' && card.provider_bill_id) {
      try { await settleChipGiftCardPurchase(card.provider_bill_id, await getChipPurchase(card.provider_bill_id)); } catch (_) { /* status remains safely pending */ }
    }
    const [fresh] = await mysqlPool.execute<Array<RowDataPacket & { status: string; recipient_user_id: number | null; claimed_at: Date | null }>>(`SELECT status, recipient_user_id, claimed_at FROM gift_cards WHERE id = :id`, { id: card.id });
    const current = fresh[0];
    const status = current?.status === 'depleted' && current.recipient_user_id && current.claimed_at
      ? 'delivered'
      : current?.status ?? card.status;
    return { purchase_ref: card.purchase_ref, status };
  });
}
