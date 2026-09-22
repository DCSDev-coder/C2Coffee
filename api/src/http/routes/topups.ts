import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateRequest } from '../../auth/guard.js';
import { env } from '../../config/env.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { createUserNotification } from '../notifications.js';
import { deliverQueuedTopUpReceiptEmail, queueTopUpReceiptEmail } from '../../services/topup-receipt-email.js';

const topUpRequestSchema = z.object({
  package_id: z.coerce.number().int().positive(),
  payment_method: z.enum(['touch_n_go', 'card', 'bank_transfer']),
  bank_code: z.string().trim().min(1).max(64).optional()
}).superRefine((value, context) => {
  if (value.payment_method === 'bank_transfer' && !value.bank_code) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['bank_code'], message: 'Choose an online banking option.' });
  }
});

type CustomerTopUpRow = RowDataPacket & {
  id: number;
  topup_ref: string;
  token_amount: number;
  rm_amount: string;
  status: 'pending_payment' | 'paid' | 'failed' | 'cancelled';
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

type BillplzCallback = Record<string, string>;

type BillplzGateway = {
  code: string;
  active: boolean;
  category: string;
};

type BillplzBank = {
  name: string;
  active: boolean;
};

type BillplzCollectionPaymentMethod = {
  code: string;
  active: boolean;
};

function billplzBaseUrl(): string {
  return env.TOPUP_GATEWAY_BASE_URL.replace(/\/+$/, '');
}

function buildTopUpReference(): string {
  return `TOP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
}

function callbackUrl(): string {
  return `${env.PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/payments/billplz/callback`;
}

function billplzAuthorizationHeader(): string {
  return `Basic ${Buffer.from(`${env.TOPUP_GATEWAY_API_KEY}:`).toString('base64')}`;
}

async function getBillplzGateways(): Promise<BillplzGateway[]> {
  const response = await fetch(`${billplzBaseUrl()}/v4/payment_gateways`, {
    headers: { authorization: billplzAuthorizationHeader() },
    signal: AbortSignal.timeout(15_000)
  });
  const body = await response.json().catch(() => null) as { payment_gateways?: unknown } | null;
  if (!response.ok || !Array.isArray(body?.payment_gateways)) {
    throw new ApiError(502, 'topup_gateway_error', 'Payment options are temporarily unavailable. Please try again.');
  }
  return body.payment_gateways
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      code: typeof item.code === 'string' ? item.code : '',
      active: item.active === true,
      category: typeof item.category === 'string' ? item.category : ''
    }))
    .filter((item) => item.code.length > 0);
}

async function getBillplzFpxBanks(): Promise<BillplzBank[]> {
  const response = await fetch(`${billplzBaseUrl()}/v3/fpx_banks`, {
    headers: { authorization: billplzAuthorizationHeader() },
    signal: AbortSignal.timeout(15_000)
  });
  const body = await response.json().catch(() => null) as { banks?: unknown } | null;
  if (!response.ok || !Array.isArray(body?.banks)) {
    throw new ApiError(502, 'topup_gateway_error', 'Online banking is temporarily unavailable. Please try again.');
  }
  return body.banks
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({ name: typeof item.name === 'string' ? item.name : '', active: item.active === true }))
    .filter((item) => item.name.length > 0);
}

async function getBillplzCollectionPaymentMethods(): Promise<BillplzCollectionPaymentMethod[]> {
  const response = await fetch(
    `${billplzBaseUrl()}/v3/collections/${encodeURIComponent(env.TOPUP_GATEWAY_COLLECTION_ID)}/payment_methods`,
    {
      headers: { authorization: billplzAuthorizationHeader() },
      signal: AbortSignal.timeout(15_000)
    }
  );
  const body = await response.json().catch(() => null) as { payment_methods?: unknown } | null;
  if (!response.ok || !Array.isArray(body?.payment_methods)) {
    throw new ApiError(502, 'topup_gateway_error', 'Payment options are temporarily unavailable. Please try again.');
  }
  return body.payment_methods
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      code: typeof item.code === 'string' ? item.code : '',
      active: item.active === true
    }))
    .filter((item) => item.code.length > 0);
}

function collectionMethodCode(paymentMethod: 'touch_n_go' | 'card' | 'bank_transfer'): string {
  switch (paymentMethod) {
    case 'touch_n_go':
      return 'touchngo';
    case 'card':
      return 'billplz';
    case 'bank_transfer':
      return 'fpx';
  }
}

async function resolveGatewayCode(paymentMethod: 'touch_n_go' | 'card' | 'bank_transfer', bankCode?: string): Promise<string> {
  if (!env.TOPUP_GATEWAY_ALLOWED_METHODS.includes(paymentMethod)) {
    throw new ApiError(400, 'topup_method_unavailable', 'That payment method is not available.');
  }

  const collectionMethods = await getBillplzCollectionPaymentMethods();
  if (!collectionMethods.some((method) => method.active && method.code === collectionMethodCode(paymentMethod))) {
    throw new ApiError(503, 'topup_method_unavailable', 'That payment method is not active for C2 Coffee yet.');
  }

  if (paymentMethod === 'bank_transfer') {
    const banks = await getBillplzFpxBanks();
    const selectedCode = bankCode?.trim() ?? '';
    if (!banks.some((bank) => bank.active && bank.name === selectedCode)) {
      throw new ApiError(400, 'topup_bank_unavailable', 'That online banking option is not available.');
    }
    return selectedCode;
  }

  const requestedCode = paymentMethod === 'touch_n_go' ? 'BP-TNG01' : 'BP-BILLPLZ1';
  const gateways = await getBillplzGateways();
  if (!gateways.some((gateway) => gateway.active && gateway.code === requestedCode)) {
    throw new ApiError(503, 'topup_method_unavailable', 'That payment method is temporarily unavailable.');
  }
  return requestedCode;
}

function canonicalSignaturePayload(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .filter(([key]) => key !== 'x_signature')
    .map(([key, value]) => `${key}${String(value ?? '')}`)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'accent' }))
    .join('|');
}

function hasValidBillplzSignature(payload: BillplzCallback): boolean {
  const receivedSignature = payload.x_signature;
  if (!env.TOPUP_GATEWAY_WEBHOOK_SECRET || !receivedSignature || !/^[a-f0-9]{64}$/i.test(receivedSignature)) return false;

  const expectedSignature = crypto
    .createHmac('sha256', env.TOPUP_GATEWAY_WEBHOOK_SECRET)
    .update(canonicalSignaturePayload(payload), 'utf8')
    .digest('hex');

  const received = Buffer.from(receivedSignature, 'hex');
  const expected = Buffer.from(expectedSignature, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function parseFormBody(body: unknown): BillplzCallback {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'invalid_billplz_callback', 'Invalid Billplz callback payload.');
  }

  const parsed: BillplzCallback = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      throw new ApiError(400, 'invalid_billplz_callback', 'Invalid Billplz callback payload.');
    }
    parsed[key] = value;
  }
  return parsed;
}

function receiptPaymentMethod(callback: BillplzCallback): string {
  const gatewayCode = callback.reference_1?.trim();
  if (gatewayCode === 'BP-TNG01') return 'Touch n Go eWallet';
  if (gatewayCode === 'BP-BILLPLZ1') return 'Visa or Mastercard';
  return gatewayCode ? `Online banking (${gatewayCode})` : 'Billplz online payment';
}

export async function registerTopUpRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/topups/packages', { preHandler: authenticateRequest }, async () => {
    const [packages] = await mysqlPool.query<Array<TopUpPackageRow>>(
      `SELECT id, code, name, token_amount, CAST(rm_amount AS CHAR) AS rm_amount
       FROM token_topup_packages WHERE is_active = 1 ORDER BY sort_order, id`
    );
    return { packages: packages.map((item) => ({ id: Number(item.id), code: item.code, name: item.name, token_amount: Number(item.token_amount), amount_rm: item.rm_amount })) };
  });

  app.get('/v1/topups/billplz/payment-methods', { preHandler: authenticateRequest }, async () => {
    if (!env.TOPUP_GATEWAY_ENABLED || env.TOPUP_GATEWAY_PROVIDER !== 'billplz') {
      return { methods: [] };
    }

    const methods: Array<'touch_n_go' | 'card' | 'bank_transfer'> = [];
    const configuredMethods = env.TOPUP_GATEWAY_ALLOWED_METHODS;
    const collectionMethods = await getBillplzCollectionPaymentMethods();
    const isCollectionMethodActive = (code: string) =>
      collectionMethods.some((method) => method.active && method.code === code);

    if (configuredMethods.includes('bank_transfer') && isCollectionMethodActive('fpx')) {
      const banks = await getBillplzFpxBanks();
      if (banks.some((bank) => bank.active)) {
        methods.push('bank_transfer');
      }
    }

    if (configuredMethods.includes('touch_n_go') || configuredMethods.includes('card')) {
      const gateways = await getBillplzGateways();
      if (configuredMethods.includes('touch_n_go') && isCollectionMethodActive('touchngo') && gateways.some((gateway) => gateway.active && gateway.code === 'BP-TNG01')) {
        methods.push('touch_n_go');
      }
      if (configuredMethods.includes('card') && isCollectionMethodActive('billplz') && gateways.some((gateway) => gateway.active && gateway.code === 'BP-BILLPLZ1')) {
        methods.push('card');
      }
    }

    return { methods };
  });

  app.get('/v1/topups/billplz/banks', { preHandler: authenticateRequest }, async () => {
    if (!env.TOPUP_GATEWAY_ENABLED || env.TOPUP_GATEWAY_PROVIDER !== 'billplz') {
      throw new ApiError(503, 'topup_gateway_unavailable', 'Online top-up is not available yet.');
    }
    if (!env.TOPUP_GATEWAY_ALLOWED_METHODS.includes('bank_transfer')) {
      return { banks: [] };
    }
    const banks = await getBillplzFpxBanks();
    return { banks: banks.filter((bank) => bank.active).map((bank) => ({ code: bank.name })) };
  });

  app.post('/v1/topups/billplz', { preHandler: authenticateRequest }, async (request) => {
    if (!env.TOPUP_GATEWAY_ENABLED || env.TOPUP_GATEWAY_PROVIDER !== 'billplz') {
      throw new ApiError(503, 'topup_gateway_unavailable', 'Online top-up is not available yet.');
    }

    const { package_id: packageId, payment_method: paymentMethod, bank_code: bankCode } = topUpRequestSchema.parse(request.body);
    const gatewayCode = await resolveGatewayCode(paymentMethod, bankCode);
    const connection = await getUtcConnection();
    let committed = false;
    let topupId = 0;
    let topupRef = '';
    let customerName = '';
    let customerEmail = '';
    let tokenAmount = 0;
    let rmAmount = 0;

    try {
      await connection.beginTransaction();
      const [packageRows] = await connection.execute<Array<TopUpPackageRow>>(
        `SELECT id, code, name, token_amount, CAST(rm_amount AS CHAR) AS rm_amount
         FROM token_topup_packages WHERE id = :packageId AND is_active = 1 LIMIT 1 FOR UPDATE`,
        { packageId }
      );
      const topUpPackage = packageRows[0];
      if (!topUpPackage) throw new ApiError(400, 'topup_package_unavailable', 'That token package is no longer available.');
      tokenAmount = Number(topUpPackage.token_amount);
      rmAmount = Number(topUpPackage.rm_amount);
      const [accounts] = await connection.execute<Array<RowDataPacket & {
        balance_available: number;
        balance_cap: number;
      }>>(
        `SELECT balance_available, balance_cap FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
        { userId: request.auth.userId }
      );
      const account = accounts[0];
      if (!account) throw new ApiError(409, 'token_account_not_found', 'Your token account was not found.');

      const [pendingRows] = await connection.execute<Array<RowDataPacket & { pending_tokens: number }>>(
        `SELECT COALESCE(SUM(token_amount), 0) AS pending_tokens
         FROM token_topups
         WHERE user_id = :userId
           AND status = 'pending_payment'
           AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
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
         VALUES (:userId, :packageId, :topupRef, :tokenAmount, :rmAmount, 'pending_payment', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE), UTC_TIMESTAMP())`,
        { userId: request.auth.userId, packageId: topUpPackage.id, topupRef, tokenAmount, rmAmount: rmAmount.toFixed(2) }
      );
      topupId = topupResult.insertId;

      await connection.execute(
        `INSERT INTO payments (topup_id, provider, payment_method, provider_payment_ref, amount_rm, status, created_at)
         VALUES (:topupId, 'billplz', :paymentMethod, :topupRef, :amount, 'pending', UTC_TIMESTAMP())`,
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

    let billResponse: Response;
    try {
      const payload = new URLSearchParams({
        collection_id: env.TOPUP_GATEWAY_COLLECTION_ID,
        email: customerEmail,
        name: customerName,
        amount: String(Math.round(rmAmount * 100)),
        description: `C2 Token top-up ${topupRef}`,
        callback_url: callbackUrl(),
        reference_1_label: 'Bank Code',
        reference_1: gatewayCode
      });
      billResponse = await fetch(`${billplzBaseUrl()}/v3/bills`, {
        method: 'POST',
        headers: {
          authorization: billplzAuthorizationHeader(),
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: payload,
        signal: AbortSignal.timeout(15_000)
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
      request.log.error({ err: error, topupRef }, 'Billplz bill creation request failed');
      throw new ApiError(502, 'topup_gateway_error', 'Unable to start the payment. Please try again.');
    }

    const bill = await billResponse.json().catch(() => null) as { id?: unknown; url?: unknown; error?: unknown } | null;
    const billId = typeof bill?.id === 'string' ? bill.id : '';
    const billUrl = typeof bill?.url === 'string' ? bill.url : '';
    if (!billResponse.ok || !billId || !billUrl) {
      await mysqlPool.execute(`UPDATE token_topups SET status = 'failed' WHERE id = :topupId AND status = 'pending_payment'`, { topupId });
      await mysqlPool.execute(`UPDATE payments SET status = 'failed', failed_at = UTC_TIMESTAMP() WHERE topup_id = :topupId AND status = 'pending'`, { topupId });
      request.log.error({ topupRef, status: billResponse.status, bill }, 'Billplz rejected bill creation');
      throw new ApiError(502, 'topup_gateway_error', 'Unable to start the payment. Please try again.');
    }

    await mysqlPool.execute(
      `UPDATE payments SET provider_bill_id = :billId WHERE topup_id = :topupId AND provider = 'billplz' AND status = 'pending'`,
      { billId, topupId }
    );

    return {
      topup_ref: topupRef,
      token_amount: tokenAmount,
      amount_rm: rmAmount.toFixed(2),
      checkout_url: `${billUrl}${billUrl.includes('?') ? '&' : '?'}auto_submit=true`,
      payment_method: paymentMethod,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
  });

  app.post('/v1/payments/billplz/callback', async (request) => {
    if (!env.TOPUP_GATEWAY_ENABLED || env.TOPUP_GATEWAY_PROVIDER !== 'billplz') {
      throw new ApiError(503, 'topup_gateway_unavailable', 'Online top-up is not available yet.');
    }
    const callback = parseFormBody(request.body);
    if (!hasValidBillplzSignature(callback)) {
      throw new ApiError(400, 'invalid_billplz_signature', 'Invalid Billplz callback signature.');
    }

    const billId = callback.id?.trim();
    const collectionId = callback.collection_id?.trim();
    const amountCents = Number(callback.amount);
    const paidAmountCents = Number(callback.paid_amount);
    const isPaid = callback.paid === 'true' && callback.state === 'paid';
    if (!billId || collectionId !== env.TOPUP_GATEWAY_COLLECTION_ID || !Number.isInteger(amountCents) || amountCents <= 0) {
      throw new ApiError(400, 'invalid_billplz_callback', 'Invalid Billplz callback payload.');
    }

    const connection = await getUtcConnection();
    let committed = false;
    try {
      await connection.beginTransaction();
      const [paymentRows] = await connection.execute<Array<RowDataPacket & {
        payment_id: number;
        payment_status: CustomerTopUpRow['payment_status'];
        topup_id: number;
        user_id: number;
        topup_ref: string;
        token_amount: number;
        rm_amount: string;
        topup_status: CustomerTopUpRow['status'];
        provider_bill_id: string;
        customer_email: string | null;
      }>>(
        `SELECT p.id AS payment_id, p.status AS payment_status, p.provider_bill_id, tt.id AS topup_id, tt.user_id,
                tt.topup_ref, tt.token_amount, CAST(tt.rm_amount AS CHAR) AS rm_amount, tt.status AS topup_status,
                up.email AS customer_email
         FROM payments p
         JOIN token_topups tt ON tt.id = p.topup_id
         LEFT JOIN user_profiles up ON up.user_id = tt.user_id
         WHERE p.provider = 'billplz' AND p.provider_bill_id = :billId
         LIMIT 1 FOR UPDATE`,
        { billId }
      );
      const payment = paymentRows[0];
      if (!payment) throw new ApiError(404, 'billplz_payment_not_found', 'Payment was not found.');

      const eventRef = `bill:${billId}:${callback.transaction_id ?? callback.x_signature}`;
      const [existingEvents] = await connection.execute<Array<RowDataPacket & { id: number }>>(
        `SELECT id FROM payment_events WHERE provider_event_id = :eventRef LIMIT 1 FOR UPDATE`,
        { eventRef }
      );
      if (existingEvents[0]) {
        await connection.commit();
        committed = true;
        return { received: true, duplicate: true };
      }

      const expectedAmountCents = Math.round(Number(payment.rm_amount) * 100);
      const amountMatches = amountCents === expectedAmountCents && (!isPaid || paidAmountCents === expectedAmountCents);
      const eventPayloadHash = crypto.createHash('sha256').update(JSON.stringify(callback)).digest('hex');
      if (!isPaid || !amountMatches) {
        await connection.execute(
          `INSERT INTO payment_events (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
           VALUES (:paymentId, :eventRef, :eventType, :payloadHash, UTC_TIMESTAMP(), :result, UTC_TIMESTAMP())`,
          { paymentId: payment.payment_id, eventRef, eventType: isPaid ? 'amount_mismatch' : `bill_${callback.state ?? 'due'}`, payloadHash: eventPayloadHash, result: isPaid ? 'rejected' : 'not_paid' }
        );
        await connection.commit();
        committed = true;
        return { received: true, credited: false };
      }

      if (payment.payment_status === 'paid' || payment.topup_status === 'paid') {
        await connection.execute(
          `INSERT INTO payment_events (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
           VALUES (:paymentId, :eventRef, 'bill_paid', :payloadHash, UTC_TIMESTAMP(), 'duplicate', UTC_TIMESTAMP())`,
          { paymentId: payment.payment_id, eventRef, payloadHash: eventPayloadHash }
        );
        await connection.commit();
        committed = true;
        return { received: true, duplicate: true };
      }

      const [accounts] = await connection.execute<Array<RowDataPacket & { balance_available: number }>>(
        `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
        { userId: payment.user_id }
      );
      const account = accounts[0];
      if (!account) throw new ApiError(409, 'token_account_not_found', 'Token account was not found.');
      const balanceAfter = Number(account.balance_available) + Number(payment.token_amount);

      await connection.execute(`UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`, { balanceAfter, userId: payment.user_id });
      await connection.execute(`UPDATE token_topups SET status = 'paid', paid_at = UTC_TIMESTAMP() WHERE id = :topupId AND status = 'pending_payment'`, { topupId: payment.topup_id });
      await connection.execute(`UPDATE payments SET status = 'paid', paid_at = UTC_TIMESTAMP() WHERE id = :paymentId AND status = 'pending'`, { paymentId: payment.payment_id });
      const [lotResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO token_lots (user_id, source_topup_id, original_amount, remaining_amount, expires_at, status, created_at)
         VALUES (:userId, :topupId, :amount, :amount, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY), 'active', UTC_TIMESTAMP())`,
        { userId: payment.user_id, topupId: payment.topup_id, amount: payment.token_amount }
      );
      await connection.execute(
        `INSERT INTO token_ledger (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
         VALUES (:userId, :lotId, 'credit', 'topup_paid', :topupId, :amount, :balanceAfter, :remarks, UTC_TIMESTAMP())`,
        { userId: payment.user_id, lotId: lotResult.insertId, topupId: payment.topup_id, amount: payment.token_amount, balanceAfter, remarks: `Billplz top-up ${payment.topup_ref}` }
      );
      await connection.execute(
        `INSERT INTO payment_events (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
         VALUES (:paymentId, :eventRef, 'bill_paid', :payloadHash, UTC_TIMESTAMP(), 'credited', UTC_TIMESTAMP())`,
        { paymentId: payment.payment_id, eventRef, payloadHash: eventPayloadHash }
      );
      await createUserNotification(connection, {
        userId: payment.user_id,
        type: 'token_topup_paid',
        title: 'Tokens added',
        body: `${payment.token_amount} C2 Tokens have been added to your wallet.`
      });
      const receiptEmailQueued = await queueTopUpReceiptEmail(connection, {
        topupId: payment.topup_id,
        recipientEmail: payment.customer_email,
        paymentMethod: receiptPaymentMethod(callback),
        providerBillId: payment.provider_bill_id
      });
      await connection.commit();
      committed = true;
      if (receiptEmailQueued) {
        void deliverQueuedTopUpReceiptEmail(payment.topup_id).then((outcome) => {
          if (outcome === 'failed') {
            request.log.warn({ topupId: payment.topup_id }, 'Top-up receipt email delivery failed after payment.');
          }
        }).catch(() => {
          request.log.warn({ topupId: payment.topup_id }, 'Top-up receipt email delivery could not be started after payment.');
        });
      }
      return { received: true, credited: true, receipt_email: receiptEmailQueued ? 'queued' : 'unavailable' };
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
    return {
      topup_ref: topup.topup_ref,
      token_amount: topup.token_amount,
      amount_rm: topup.rm_amount,
      status: topup.status,
      expires_at: topup.expires_at?.toISOString() ?? null
    };
  });
}
