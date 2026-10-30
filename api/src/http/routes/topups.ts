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
  createChipPurchase,
  getActiveChipMethods,
  getChipPurchase,
  verifyChipCallbackSignature,
  type ChipPaymentMethod
} from '../../payments/chip-client.js';
import { topUpRequestSchema } from '../../payments/topup-request.js';
import { settleChipTopUpPurchase } from '../../services/chip-topup-settlement.js';
import { settleChipMobilePurchase } from '../../services/chip-counter-settlement.js';
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
};

type TopUpPackageRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  token_amount: number;
  rm_amount: string;
};

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

      await connection.execute(
        `UPDATE token_wallet_cap_reservations
         SET status = 'released', release_reason = 'checkout_abandoned', released_at = UTC_TIMESTAMP()
         WHERE user_id = :userId AND status = 'active' AND expires_at <= UTC_TIMESTAMP()`,
        { userId: request.auth.userId }
      );

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
        `INSERT INTO payments (topup_id, provider, payment_method, provider_payment_ref, amount_rm, status, created_at)
         VALUES (:topupId, 'chip', :paymentMethod, :topupRef, :amount, 'pending', UTC_TIMESTAMP())`,
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

    await mysqlPool.execute(
      `UPDATE payments SET provider_bill_id = :purchaseId WHERE topup_id = :topupId AND provider = 'chip' AND status = 'pending'`,
      { purchaseId: purchase.id, topupId }
    );
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
    const [paymentRows] = await mysqlPool.query<Array<RowDataPacket & {
      order_id: number | null;
      topup_id: number | null;
    }>>(
      `SELECT order_id, topup_id FROM payments
       WHERE provider = 'chip' AND provider_bill_id = :purchaseId
       LIMIT 1`,
      { purchaseId: callback.id }
    );
    if (paymentRows[0]?.order_id != null) {
      return settleChipMobilePurchase(callback.id, purchase, 'customer_callback');
    }
    return settleChipTopUpPurchase(callback.id, purchase, { logger: request.log });
  });

  app.get('/v1/topups/:topupRef', { preHandler: authenticateRequest }, async (request) => {
    const params = z.object({ topupRef: z.string().trim().min(1).max(50) }).parse(request.params);
    const [rows] = await mysqlPool.execute<Array<CustomerTopUpRow>>(
      `SELECT tt.id, tt.topup_ref, tt.token_amount, CAST(tt.rm_amount AS CHAR) AS rm_amount, tt.status, tt.expires_at,
              p.provider_bill_id, p.status AS payment_status
       FROM token_topups tt
       JOIN payments p ON p.topup_id = tt.id
       WHERE tt.topup_ref = :topupRef AND tt.user_id = :userId
       LIMIT 1`,
      { topupRef: params.topupRef, userId: request.auth.userId }
    );
    const topup = rows[0];
    if (!topup) throw new ApiError(404, 'topup_not_found', 'Top-up was not found.');
    const status = topup.status === 'pending_payment' && topup.expires_at && topup.expires_at.getTime() <= Date.now()
      ? 'expired'
      : topup.status;
    return {
      topup_ref: topup.topup_ref,
      token_amount: topup.token_amount,
      amount_rm: topup.rm_amount,
      status,
      expires_at: topup.expires_at?.toISOString() ?? null
    };
  });
}
