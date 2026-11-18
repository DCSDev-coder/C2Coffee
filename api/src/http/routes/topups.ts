import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateRequest } from '../../auth/guard.js';
import { env } from '../../config/env.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import {
  assertChipConfigured,
  cancelChipPurchase,
  createChipPurchase,
  getActiveChipMethods,
  getChipPurchase,
  verifyChipCallbackSignature,
  type ChipPaymentMethod
} from '../../payments/chip-client.js';
import { topUpRequestSchema } from '../../payments/topup-request.js';
import { chipTerminalFailure, settleChipTopUpPurchase } from '../../services/chip-topup-settlement.js';
import { settleChipMobilePurchase } from '../../services/chip-counter-settlement.js';
import { settleChipGiftCardPurchase } from '../../services/chip-gift-card-settlement.js';
import { assertCustomerAccess } from '../../services/app-maintenance.js';

type CustomerTopUpRow = RowDataPacket & {
  id: number;
  topup_ref: string;
  token_amount: number;
  rm_amount: string;
  status: 'pending_payment' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'refund_needs_review';
  expires_at: Date | null;
  provider_bill_id: string | null;
  payment_status: 'pending' | 'authorized' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  payment_method: string;
};

type TopUpPackageRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  token_amount: number;
  rm_amount: string;
};

type PendingCustomerTopUpRow = RowDataPacket & {
  topup_ref: string;
  provider_bill_id: string | null;
  local_status: CustomerTopUpRow['status'];
  created_at: Date;
};

async function loadCustomerTopUp(topupRef: string, userId: number): Promise<CustomerTopUpRow | undefined> {
  const [rows] = await mysqlPool.execute<Array<CustomerTopUpRow>>(
    `SELECT tt.id, tt.topup_ref, tt.token_amount, CAST(tt.rm_amount AS CHAR) AS rm_amount, tt.status, tt.expires_at,
            p.provider_bill_id, p.status AS payment_status, p.payment_method
     FROM token_topups tt
     JOIN payments p ON p.topup_id = tt.id
     WHERE tt.topup_ref = :topupRef AND tt.user_id = :userId
     LIMIT 1`,
    { topupRef, userId }
  );
  return rows[0];
}

function shouldSettlePurchaseStatus(status: unknown): boolean {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return ['paid', 'refunded', 'partially_refunded'].includes(normalized) || chipTerminalFailure(normalized) !== null;
}

async function failStaleProviderlessTopUp(topupRef: string, userId: number): Promise<void> {
  const connection = await getUtcConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<RowDataPacket & { id: number; provider_bill_id: string | null }>>(
      `SELECT tt.id, p.provider_bill_id
       FROM token_topups tt
       JOIN payments p ON p.topup_id = tt.id AND p.provider = 'chip'
       WHERE tt.topup_ref = :topupRef AND tt.user_id = :userId
         AND tt.status = 'pending_payment' AND p.status IN ('pending', 'authorized')
       LIMIT 1 FOR UPDATE`,
      { topupRef, userId }
    );
    const row = rows[0];
    if (row && !row.provider_bill_id) {
      await connection.execute(
        `UPDATE token_topups SET status = 'failed' WHERE id = :topupId AND status = 'pending_payment'`,
        { topupId: row.id }
      );
      await connection.execute(
        `UPDATE payments SET status = 'failed', failed_at = UTC_TIMESTAMP()
         WHERE topup_id = :topupId AND provider_bill_id IS NULL AND status IN ('pending', 'authorized')`,
        { topupId: row.id }
      );
      await connection.execute(
        `UPDATE token_wallet_cap_reservations
         SET status = 'released', release_reason = 'provider_id_missing', released_at = UTC_TIMESTAMP()
         WHERE topup_id = :topupId AND status = 'active'`,
        { topupId: row.id }
      );
    }
    await connection.commit();
    committed = true;
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function reconcileCustomerTopUpsBeforeCreate(
  userId: number,
  logger: { warn: (context: Record<string, unknown>, message: string) => void }
): Promise<void> {
  const [rows] = await mysqlPool.execute<PendingCustomerTopUpRow[]>(
    `SELECT tt.topup_ref, p.provider_bill_id, tt.status AS local_status, tt.created_at
     FROM token_topups tt
     JOIN payments p ON p.topup_id = tt.id AND p.provider = 'chip'
     WHERE tt.user_id = :userId AND (
       (tt.status = 'pending_payment' AND p.status IN ('pending', 'authorized'))
       OR (tt.status = 'paid' AND p.status = 'paid'
           AND tt.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR))
     )
     ORDER BY CASE WHEN tt.status = 'pending_payment' THEN 0 ELSE 1 END, tt.id DESC
     LIMIT 10`,
    { userId }
  );

  for (const row of rows) {
    if (!row.provider_bill_id) {
      // Fastify does not return the checkout URL until provider_bill_id has
      // been saved below. A row still missing that ID after this grace period
      // came from an interrupted request, so the customer never received a
      // payable link. A late signed paid callback can still reconnect it by
      // topup_ref and settle the released reservation idempotently.
      if (row.created_at.getTime() > Date.now() - 60_000) {
        throw new ApiError(409, 'topup_payment_still_pending', 'We are still checking your previous payment. Please try again shortly.');
      }
      await failStaleProviderlessTopUp(row.topup_ref, userId);
      continue;
    }
    let purchase = await getChipPurchase(row.provider_bill_id);
    if (row.local_status === 'pending_payment' && !shouldSettlePurchaseStatus(purchase.status)) {
      purchase = await cancelChipPurchase(row.provider_bill_id);
    }
    if (!shouldSettlePurchaseStatus(purchase.status)) {
      throw new ApiError(409, 'topup_payment_still_pending', 'We are still checking your previous payment. Please try again shortly.');
    }
    await settleChipTopUpPurchase(row.provider_bill_id, purchase, {
      eventSource: 'customer_new_topup',
      logger
    });
    const [currentRows] = await mysqlPool.execute<Array<RowDataPacket & { status: string }>>(
      `SELECT status FROM token_topups WHERE topup_ref = :topupRef AND user_id = :userId LIMIT 1`,
      { topupRef: row.topup_ref, userId }
    );
    if (row.local_status === 'pending_payment' && currentRows[0]?.status === 'paid') {
      throw new ApiError(409, 'topup_already_paid', 'Your previous payment was successful. Your C2 Tokens are being updated.');
    }
  }
}

function buildTopUpReference(): string {
  return `TOP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
}

function callbackUrl(): string {
  return `${env.PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/payments/chip/callback`;
}

export async function registerTopUpRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/topups/packages', { preHandler: authenticateRequest }, async () => {
    const [packages] = await mysqlPool.query<Array<TopUpPackageRow>>(
      `SELECT id, code, name, token_amount, CAST(rm_amount AS CHAR) AS rm_amount
       FROM token_topup_packages WHERE is_active = 1 ORDER BY sort_order, id`
    );
    return { packages: packages.map((item) => ({ id: Number(item.id), code: item.code, name: item.name, token_amount: Number(item.token_amount), amount_rm: item.rm_amount })) };
  });

  app.get('/v1/topups/payment-methods', { preHandler: authenticateRequest }, async () => {
    if (!env.TOPUP_GATEWAY_ENABLED || env.TOPUP_GATEWAY_PROVIDER !== 'chip') {
      return { methods: [] };
    }
    const activeMethods = await getActiveChipMethods();
    return { methods: [...activeMethods.keys()] };
  });

  app.post('/v1/topups', { preHandler: authenticateRequest }, async (request) => {
    await assertCustomerAccess(request.auth.userId);
    assertChipConfigured();

    const {
      package_id: requestedPackageId,
      amount_rm: requestedAmountRm,
      payment_method: paymentMethod
    } = topUpRequestSchema.parse(request.body);
    await reconcileCustomerTopUpsBeforeCreate(request.auth.userId, request.log);
    const connection = await getUtcConnection();
    let committed = false;
    let topupId = 0;
    let topupRef = '';
    let customerName = '';
    let customerEmail = '';
    let tokenAmount = 0;
    let rmAmount = 0;
    let packageId: number | null = null;

    try {
      await connection.beginTransaction();
      if (requestedPackageId !== undefined) {
        const [packageRows] = await connection.execute<Array<TopUpPackageRow>>(
          `SELECT id, code, name, token_amount, CAST(rm_amount AS CHAR) AS rm_amount
           FROM token_topup_packages WHERE id = :packageId AND is_active = 1 LIMIT 1 FOR UPDATE`,
          { packageId: requestedPackageId }
        );
        const topUpPackage = packageRows[0];
        if (!topUpPackage) {
          throw new ApiError(400, 'topup_package_unavailable', 'That token package is no longer available.');
        }
        packageId = Number(topUpPackage.id);
        tokenAmount = Number(topUpPackage.token_amount);
        rmAmount = Number(topUpPackage.rm_amount);
      } else {
        packageId = null;
        tokenAmount = requestedAmountRm!;
        rmAmount = requestedAmountRm!;
      }
      const [accounts] = await connection.execute<Array<RowDataPacket & {
        balance_available: number;
        balance_cap: number;
      }>>(
        `SELECT balance_available, balance_cap FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
        { userId: request.auth.userId }
      );
      const account = accounts[0];
      if (!account) throw new ApiError(409, 'token_account_not_found', 'Your token account was not found.');

      const [unresolvedRows] = await connection.execute<Array<RowDataPacket & { topup_ref: string }>>(
        `SELECT tt.topup_ref
         FROM token_topups tt
         JOIN payments p ON p.topup_id = tt.id AND p.provider = 'chip'
         WHERE tt.user_id = :userId AND tt.status = 'pending_payment'
           AND p.status IN ('pending', 'authorized')
         LIMIT 1 FOR UPDATE`,
        { userId: request.auth.userId }
      );
      if (unresolvedRows[0]) {
        throw new ApiError(409, 'topup_payment_in_progress', 'We are still checking your previous payment. Please try again shortly.');
      }

      const [pendingRows] = await connection.execute<Array<RowDataPacket & { pending_tokens: number }>>(
        `SELECT COALESCE(SUM(token_amount), 0) AS pending_tokens
         FROM token_wallet_cap_reservations
         WHERE user_id = :userId AND status = 'active'
         FOR UPDATE`,
        { userId: request.auth.userId }
      );
      const pendingTokens = Number(pendingRows[0]?.pending_tokens ?? 0);
      if (Number(account.balance_available) + pendingTokens + tokenAmount > Number(account.balance_cap)) {
        throw new ApiError(409, 'token_balance_cap_exceeded', 'This top-up would exceed your C2 Token balance cap.');
      }

      const [profiles] = await connection.execute<Array<RowDataPacket & { display_name: string; email: string | null }>>(
        `SELECT display_name, email FROM user_profiles WHERE user_id = :userId LIMIT 1`,
        { userId: request.auth.userId }
      );
      const profile = profiles[0];
      if (!profile?.email?.trim()) {
        throw new ApiError(409, 'topup_email_required', 'Add a verified email address in Settings before topping up online.');
      }
      customerName = profile.display_name.trim();
      customerEmail = profile.email.trim();
      topupRef = buildTopUpReference();

      const [topupResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO token_topups (user_id, topup_package_id, topup_ref, token_amount, rm_amount, status, expires_at, created_at)
         VALUES (:userId, :packageId, :topupRef, :tokenAmount, :rmAmount, 'pending_payment', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), UTC_TIMESTAMP())`,
        { userId: request.auth.userId, packageId, topupRef, tokenAmount, rmAmount: rmAmount.toFixed(2) }
      );
      topupId = topupResult.insertId;

      await connection.execute(
        `INSERT INTO token_wallet_cap_reservations (user_id, topup_id, token_amount, status, expires_at, created_at)
         VALUES (:userId, :topupId, :tokenAmount, 'active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), UTC_TIMESTAMP())`,
        { userId: request.auth.userId, topupId, tokenAmount }
      );

      await connection.execute(
        `INSERT INTO payments (topup_id, provider, payment_method, provider_payment_ref, amount_rm, status, created_at, expires_at)
         VALUES (:topupId, 'chip', :paymentMethod, :topupRef, :amount, 'pending', UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))`,
        { topupId, topupRef, paymentMethod, amount: rmAmount.toFixed(2) }
      );
      await connection.commit();
      committed = true;
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    let purchase: { id: string; checkoutUrl: string };
    try {
      purchase = await createChipPurchase({
        reference: topupRef,
        customerEmail,
        customerName,
        amountCents: Math.round(rmAmount * 100),
        description: `C2 Token top-up ${topupRef}`,
        method: paymentMethod as ChipPaymentMethod,
        callbackUrl: callbackUrl()
      });
    } catch (error) {
      await mysqlPool.execute(
        `UPDATE token_topups SET status = 'failed' WHERE id = :topupId AND status = 'pending_payment'`,
        { topupId }
      );
      await mysqlPool.execute(
        `UPDATE payments SET status = 'failed', failed_at = UTC_TIMESTAMP() WHERE topup_id = :topupId AND status = 'pending'`,
        { topupId }
      );
      await mysqlPool.execute(
        `UPDATE token_wallet_cap_reservations
         SET status = 'released', release_reason = 'bill_creation_failed', released_at = UTC_TIMESTAMP()
         WHERE topup_id = :topupId AND status = 'active'`,
        { topupId }
      );
      request.log.error({ err: error, topupRef }, 'CHIP purchase creation request failed');
      throw new ApiError(502, 'topup_gateway_error', 'Unable to start the payment. Please try again.');
    }

    const [providerMappingResult] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE payments SET provider_bill_id = :purchaseId WHERE topup_id = :topupId AND provider = 'chip' AND status = 'pending'`,
      { purchaseId: purchase.id, topupId }
    );
    if (providerMappingResult.affectedRows !== 1) {
      try {
        await cancelChipPurchase(purchase.id);
      } catch (error) {
        request.log.error(
          { err: error, topupRef, purchaseId: purchase.id },
          'Unable to close CHIP purchase after provider mapping was not saved.'
        );
      }
      await failStaleProviderlessTopUp(topupRef, request.auth.userId);
      throw new ApiError(
        409,
        'topup_payment_setup_interrupted',
        'We could not finish opening the payment page. Please try again.'
      );
    }
    await mysqlPool.execute(
      `UPDATE token_wallet_cap_reservations SET provider_bill_id = :purchaseId
       WHERE topup_id = :topupId AND status = 'active'`,
      { purchaseId: purchase.id, topupId }
    );

    return {
      topup_ref: topupRef,
      token_amount: tokenAmount,
      amount_rm: rmAmount.toFixed(2),
      checkout_url: purchase.checkoutUrl,
      payment_method: paymentMethod,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  });

  app.post('/v1/payments/chip/callback', {
    config: { rawBody: true }
  }, async (request) => {
    assertChipConfigured();
    const signatureHeader = request.headers['x-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature || !Buffer.isBuffer(request.rawBody) ||
        !await verifyChipCallbackSignature(request.rawBody, signature)) {
      throw new ApiError(401, 'invalid_chip_signature', 'Invalid CHIP callback signature.');
    }
    const callback = z.object({ id: z.string().uuid() }).passthrough().parse(request.body);
    // Do not trust the callback body for payment state. Retrieve the purchase
    // from CHIP using the server-only API key and verify the authoritative data.
    const purchase = await getChipPurchase(callback.id);
    let [paymentRows] = await mysqlPool.query<Array<RowDataPacket & {
      order_id: number | null;
      topup_id: number | null;
      gift_card_id: number | null;
    }>>(
      `SELECT order_id, topup_id, gift_card_id FROM payments
       WHERE provider = 'chip' AND provider_bill_id = :purchaseId
       LIMIT 1`,
      { purchaseId: callback.id }
    );
    if (!paymentRows[0] && purchase.brand_id === env.TOPUP_GATEWAY_BRAND_ID &&
        typeof purchase.reference === 'string' && purchase.reference.startsWith('TOP-')) {
      await mysqlPool.execute(
        `UPDATE payments p
         JOIN token_topups tt ON tt.id = p.topup_id
         JOIN token_wallet_cap_reservations r ON r.topup_id = tt.id
         SET p.provider_bill_id = :purchaseId
         WHERE p.provider = 'chip' AND p.provider_bill_id IS NULL
           AND (
             (p.status IN ('pending', 'authorized') AND tt.status = 'pending_payment')
             OR (p.status = 'failed' AND tt.status = 'failed' AND r.release_reason = 'provider_id_missing')
           )
           AND tt.topup_ref = :topupRef`,
        { purchaseId: callback.id, topupRef: purchase.reference }
      );
      [paymentRows] = await mysqlPool.query<Array<RowDataPacket & {
        order_id: number | null;
        topup_id: number | null;
        gift_card_id: number | null;
      }>>(
        `SELECT order_id, topup_id, gift_card_id FROM payments
         WHERE provider = 'chip' AND provider_bill_id = :purchaseId
         LIMIT 1`,
        { purchaseId: callback.id }
      );
    }
    if (paymentRows[0]?.order_id != null) {
      return settleChipMobilePurchase(callback.id, purchase, 'customer_callback');
    }
    if (paymentRows[0]?.gift_card_id != null) {
      return settleChipGiftCardPurchase(callback.id, purchase);
    }
    return settleChipTopUpPurchase(callback.id, purchase, { logger: request.log });
  });

  app.get('/v1/topups/:topupRef', { preHandler: authenticateRequest }, async (request) => {
    const params = z.object({ topupRef: z.string().trim().min(1).max(50) }).parse(request.params);
    let topup = await loadCustomerTopUp(params.topupRef, request.auth.userId);
    if (!topup) throw new ApiError(404, 'topup_not_found', 'Top-up was not found.');

    let checkoutUrl: string | null = null;
    if (topup.provider_bill_id && topup.status === 'pending_payment') {
      try {
        const purchase = await getChipPurchase(topup.provider_bill_id);
        if (!shouldSettlePurchaseStatus(purchase.status) &&
            topup.expires_at && topup.expires_at.getTime() <= Date.now()) {
          const closedPurchase = await cancelChipPurchase(topup.provider_bill_id);
          if (shouldSettlePurchaseStatus(closedPurchase.status)) {
            await settleChipTopUpPurchase(topup.provider_bill_id, closedPurchase, {
              eventSource: 'customer_expired_payment',
              logger: request.log
            });
            const refreshed = await loadCustomerTopUp(params.topupRef, request.auth.userId);
            if (refreshed) topup = refreshed;
          }
        } else if (shouldSettlePurchaseStatus(purchase.status)) {
          await settleChipTopUpPurchase(topup.provider_bill_id, purchase, {
            eventSource: 'customer_status_refresh',
            logger: request.log
          });
          const refreshed = await loadCustomerTopUp(params.topupRef, request.auth.userId);
          if (refreshed) topup = refreshed;
        } else {
          const candidate = typeof purchase.checkout_url === 'string' ? purchase.checkout_url : '';
          if (candidate) checkoutUrl = candidate;
        }
      } catch (error) {
        request.log.warn(
          { topupRef: params.topupRef, error: error instanceof Error ? error.message : String(error) },
          'Unable to reconcile CHIP top-up during customer status refresh.'
        );
        // The local status remains useful while CHIP is temporarily unavailable.
      }
    }

    return {
      topup_ref: topup.topup_ref,
      token_amount: topup.token_amount,
      amount_rm: topup.rm_amount,
      status: topup.status,
      payment_method: topup.payment_method,
      checkout_url: checkoutUrl,
      expires_at: topup.expires_at?.toISOString() ?? null
    };
  });

  app.post('/v1/topups/:topupRef/prepare-new-payment', { preHandler: authenticateRequest }, async (request) => {
    await assertCustomerAccess(request.auth.userId);
    const params = z.object({ topupRef: z.string().trim().min(1).max(50) }).parse(request.params);
    let topup = await loadCustomerTopUp(params.topupRef, request.auth.userId);
    if (!topup) throw new ApiError(404, 'topup_not_found', 'Top-up was not found.');
    if (!topup.provider_bill_id) {
      throw new ApiError(409, 'topup_payment_unavailable', 'We could not verify your previous payment. Please try again shortly.');
    }

    let purchase = await getChipPurchase(topup.provider_bill_id);
    if (!shouldSettlePurchaseStatus(purchase.status)) {
      purchase = await cancelChipPurchase(topup.provider_bill_id);
    }
    if (!shouldSettlePurchaseStatus(purchase.status)) {
      throw new ApiError(409, 'topup_payment_still_pending', 'We are still checking your previous payment. Please try again shortly.');
    }

    await settleChipTopUpPurchase(topup.provider_bill_id, purchase, {
      eventSource: 'customer_new_payment',
      logger: request.log
    });
    topup = await loadCustomerTopUp(params.topupRef, request.auth.userId);
    if (!topup) throw new ApiError(404, 'topup_not_found', 'Top-up was not found.');
    return {
      topup_ref: topup.topup_ref,
      status: topup.status,
      can_start_new_topup: ['failed', 'cancelled', 'refunded'].includes(topup.status)
    };
  });
}
