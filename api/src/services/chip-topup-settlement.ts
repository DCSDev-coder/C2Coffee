import crypto from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { env } from '../config/env.js';
import { getUtcConnection } from '../db/mysql.js';
import { ApiError } from '../http/errors.js';
import { createUserNotification } from '../http/notifications.js';
import type { ChipPurchase } from '../payments/chip-client.js';
import { deliverPushToUser } from './push-delivery.js';

type SettlementLogger = {
  warn: (context: Record<string, unknown>, message: string) => void;
};

type PaymentRow = RowDataPacket & {
  payment_id: number;
  payment_status: 'pending' | 'authorized' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  topup_id: number;
  user_id: number;
  topup_ref: string;
  token_amount: number;
  rm_amount: string;
  topup_status: 'pending_payment' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'refund_needs_review';
};

export type ChipSettlementResult = {
  received: true;
  credited?: boolean;
  topup_rewards_issued?: number;
  duplicate?: boolean;
  needs_review?: boolean;
  terminal?: boolean;
};

function deliverTopUpStatusPush(
  logger: SettlementLogger | undefined,
  input: { userId: number; title: string; body: string; type: string; topupRef: string; status: string }
): void {
  void deliverPushToUser({
    userId: input.userId,
    title: input.title,
    body: input.body,
    data: {
      type: input.type,
      topup_ref: input.topupRef,
      status: input.status
    }
  }).catch((error) => {
    logger?.warn(
      { topupRef: input.topupRef, status: input.status, error: error instanceof Error ? error.message : String(error) },
      'Top-up status push delivery failed after settlement.'
    );
  });
}

function normalizedStatus(purchase: ChipPurchase): string {
  return typeof purchase.status === 'string' ? purchase.status.trim().toLowerCase() : 'unknown';
}

export function chipTerminalFailure(status: unknown): 'failed' | 'cancelled' | null {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (normalized === 'cancelled') return 'cancelled';
  if (['error', 'failed', 'payment_failure'].includes(normalized)) return 'failed';
  return null;
}

function parseScope(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function issueTopUpRewardVouchers(
  connection: PoolConnection,
  input: { userId: number; topupId: number; tokenAmount: number }
): Promise<number> {
  const [templates] = await connection.query<Array<RowDataPacket & {
    id: number;
    name: string;
    eligible_scope_json: unknown;
    valid_until: Date | null;
    expires_in_days: number | null;
    total_quantity: number | null;
    limit_per_user: number | null;
    is_employee: number;
  }>>(
    `SELECT vt.id, vt.name, vt.eligible_scope_json, vt.valid_until, vt.expires_in_days,
            vt.total_quantity, vt.limit_per_user, ctm.is_employee
       FROM voucher_templates vt
       JOIN customer_tenant_memberships ctm
         ON ctm.tenant_id = vt.tenant_id AND ctm.user_id = :userId
      WHERE vt.is_active = 1
        AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
      FOR UPDATE`,
    { userId: input.userId }
  );

  let issued = 0;
  for (const template of templates) {
    const scope = parseScope(template.eligible_scope_json);
    const reward = scope.topup_reward;
    const minimum = reward && typeof reward === 'object'
      ? Number((reward as Record<string, unknown>).min_tokens)
      : 0;
    if (!Number.isInteger(minimum) || minimum < 1 || input.tokenAmount < minimum) continue;
    if (String(scope.audience ?? 'all_customers') === 'employee_only' && Number(template.is_employee) !== 1) continue;
    if (String(scope.audience ?? 'all_customers') === 'manual_issue_only') continue;

    const [counts] = await connection.query<Array<RowDataPacket & { total_count: number; user_count: number }>>(
      `SELECT COUNT(*) AS total_count,
              COALESCE(SUM(user_id = :userId), 0) AS user_count
         FROM user_vouchers
        WHERE voucher_template_id = :templateId AND status <> 'revoked'`,
      { userId: input.userId, templateId: template.id }
    );
    if (template.total_quantity != null && Number(counts[0]?.total_count ?? 0) >= Number(template.total_quantity)) continue;
    // Automatic top-up campaigns issue once per customer. A revoked reward
    // does not count, allowing a later legitimate top-up after a refund.
    if (Number(counts[0]?.user_count ?? 0) >= 1) continue;

    const expiresAt = template.valid_until
      ?? (template.expires_in_days && template.expires_in_days > 0
        ? new Date(Date.now() + template.expires_in_days * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000));
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO user_vouchers (
         user_id, voucher_template_id, status, issued_by_type, issued_reason,
         issue_case_ref, tier_at_issue, issued_at, expires_at
       ) VALUES (
         :userId, :templateId, 'active', 'system', :reason,
         :issueCaseRef, NULL, UTC_TIMESTAMP(), :expiresAt
       )`,
      {
        userId: input.userId,
        templateId: template.id,
        reason: `Qualifying top-up ${input.topupId}`,
        issueCaseRef: `topup_reward:${template.id}:topup:${input.topupId}`,
        expiresAt
      }
    );
    if (result.affectedRows !== 1) continue;
    issued += 1;
    await createUserNotification(connection, {
      userId: input.userId,
      type: 'topup_reward',
      title: 'Voucher unlocked',
      body: `${template.name} is now available in My Rewards.`,
      data: { topup_id: input.topupId, voucher_template_id: template.id },
      deliveryKey: `topup_reward:${input.userId}:${template.id}:topup:${input.topupId}`
    });
  }
  return issued;
}

async function revokeTopUpRewardVouchers(
  connection: PoolConnection,
  input: { userId: number; topupId: number }
): Promise<{ revoked: number; redeemed: number }> {
  const issuedReason = `Qualifying top-up ${input.topupId}`;
  const [rows] = await connection.query<Array<RowDataPacket & { status: string }>>(
    `SELECT status
       FROM user_vouchers
      WHERE user_id = :userId
        AND issued_by_type = 'system'
        AND issued_reason = :issuedReason
      FOR UPDATE`,
    { userId: input.userId, issuedReason }
  );
  const [result] = await connection.execute<ResultSetHeader>(
    `UPDATE user_vouchers
        SET status = 'revoked', revoked_at = UTC_TIMESTAMP()
      WHERE user_id = :userId
        AND issued_by_type = 'system'
        AND issued_reason = :issuedReason
        AND status = 'active'`,
    { userId: input.userId, issuedReason }
  );
  return {
    revoked: result.affectedRows,
    redeemed: rows.filter((row) => row.status === 'redeemed').length
  };
}

/**
 * Applies an authoritative CHIP purchase to the matching top-up exactly once.
 * Both signed callbacks and the reconciliation command use this function.
 */
export async function settleChipTopUpPurchase(
  purchaseId: string,
  purchase: ChipPurchase,
  { eventSource = 'callback', logger }: { eventSource?: string; logger?: SettlementLogger } = {}
): Promise<ChipSettlementResult> {
  const amountCents = Number(purchase.purchase?.total);
  const status = normalizedStatus(purchase);
  const isPaid = status === 'paid';
  const isRefunded = status === 'refunded';
  const isPartiallyRefunded = status === 'partially_refunded';
  if (purchase.id !== purchaseId ||
      purchase.brand_id !== env.TOPUP_GATEWAY_BRAND_ID ||
      purchase.purchase?.currency !== 'MYR' ||
      !Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ApiError(400, 'invalid_chip_callback', 'Invalid CHIP purchase data.');
  }

  const connection = await getUtcConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const [paymentRows] = await connection.execute<PaymentRow[]>(
      `SELECT p.id AS payment_id, p.status AS payment_status,
              tt.id AS topup_id, tt.user_id, tt.topup_ref, tt.token_amount,
              CAST(tt.rm_amount AS CHAR) AS rm_amount, tt.status AS topup_status
       FROM payments p
       JOIN token_topups tt ON tt.id = p.topup_id
       WHERE p.provider = 'chip' AND p.provider_bill_id = :purchaseId
       LIMIT 1 FOR UPDATE`,
      { purchaseId }
    );
    const payment = paymentRows[0];
    if (!payment) throw new ApiError(404, 'chip_payment_not_found', 'Payment was not found.');

    const eventRef = `chip:${eventSource}:${purchaseId}:${status}:${String(purchase.updated_on ?? '')}`;
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
    const amountMatches = amountCents === expectedAmountCents;
    const eventPayloadHash = crypto.createHash('sha256').update(JSON.stringify(purchase)).digest('hex');

    if (isRefunded || isPartiallyRefunded) {
      if (payment.payment_status === 'refunded' && payment.topup_status === 'refunded') {
        await connection.commit();
        committed = true;
        return { received: true, duplicate: true };
      }

      // CHIP's normal purchase payload does not expose a stable partial-refund
      // token amount. Never guess how many tokens to remove for a partial cash
      // refund; flag it for staff review instead.
      if (isPartiallyRefunded) {
        await connection.execute(
          `UPDATE payments SET status = 'partially_refunded' WHERE id = :paymentId`,
          { paymentId: payment.payment_id }
        );
        await connection.execute(
          `UPDATE token_topups SET status = 'refund_needs_review' WHERE id = :topupId`,
          { topupId: payment.topup_id }
        );
        await connection.execute(
          `INSERT INTO payment_events
             (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
           VALUES (:paymentId, :eventRef, 'chip_partially_refunded', :payloadHash, UTC_TIMESTAMP(), 'needs_review', UTC_TIMESTAMP())`,
          { paymentId: payment.payment_id, eventRef, payloadHash: eventPayloadHash }
        );
        await createUserNotification(connection, {
          userId: payment.user_id,
          type: 'token_topup_review',
          title: 'Refund under review',
          body: 'A partial refund was reported. Our team needs to verify the matching C2 Token adjustment.',
          data: { topup_ref: payment.topup_ref, status: 'refund_needs_review' },
          deliveryKey: `token_topup_review:${payment.topup_id}:partial_refund`
        });
        await connection.commit();
        committed = true;
        deliverTopUpStatusPush(logger, {
          userId: payment.user_id,
          title: 'Refund under review',
          body: 'A partial refund was reported. Our team needs to verify the matching C2 Token adjustment.',
          type: 'token_topup_review',
          topupRef: payment.topup_ref,
          status: 'refund_needs_review'
        });
        return { received: true, needs_review: true };
      }

      const topUpRewardRefund = await revokeTopUpRewardVouchers(connection, {
        userId: payment.user_id,
        topupId: payment.topup_id
      });

      const [ledgerRows] = await connection.execute<Array<RowDataPacket & {
        direction: 'credit' | 'debit';
        source_type: 'topup_paid' | 'topup_refund';
      }>>(
        `SELECT direction, source_type
         FROM token_ledger
         WHERE user_id = :userId AND source_id = :topupId
           AND source_type IN ('topup_paid', 'topup_refund')
         FOR UPDATE`,
        { userId: payment.user_id, topupId: payment.topup_id }
      );
      const wasCredited = ledgerRows.some((row) => row.direction === 'credit' && row.source_type === 'topup_paid') &&
        !ledgerRows.some((row) => row.direction === 'debit' && row.source_type === 'topup_refund');
      if (wasCredited) {
        const [accounts] = await connection.execute<Array<RowDataPacket & { balance_available: number }>>(
          `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
          { userId: payment.user_id }
        );
        const account = accounts[0];
        if (!account || Number(account.balance_available) < Number(payment.token_amount)) {
          await connection.execute(
            `UPDATE payments SET status = 'refunded' WHERE id = :paymentId`,
            { paymentId: payment.payment_id }
          );
          await connection.execute(
            `UPDATE token_topups SET status = 'refund_needs_review' WHERE id = :topupId`,
            { topupId: payment.topup_id }
          );
          await connection.execute(
            `INSERT INTO payment_events
               (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
             VALUES (:paymentId, :eventRef, 'chip_refunded', :payloadHash, UTC_TIMESTAMP(), 'needs_review_insufficient_tokens', UTC_TIMESTAMP())`,
            { paymentId: payment.payment_id, eventRef, payloadHash: eventPayloadHash }
          );
          await createUserNotification(connection, {
            userId: payment.user_id,
            type: 'token_topup_review',
            title: 'Refund under review',
            body: 'Your payment was refunded, but the wallet adjustment needs staff review.',
            data: { topup_ref: payment.topup_ref, status: 'refund_needs_review' },
            deliveryKey: `token_topup_review:${payment.topup_id}:refund_balance`
          });
          await connection.commit();
          committed = true;
          deliverTopUpStatusPush(logger, {
            userId: payment.user_id,
            title: 'Refund under review',
            body: 'Your payment was refunded, but the wallet adjustment needs staff review.',
            type: 'token_topup_review',
            topupRef: payment.topup_ref,
            status: 'refund_needs_review'
          });
          return { received: true, needs_review: true };
        }

        const balanceAfter = Number(account.balance_available) - Number(payment.token_amount);
        await connection.execute(
          `UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP()
           WHERE user_id = :userId`,
          { balanceAfter, userId: payment.user_id }
        );
        await connection.execute(
          `INSERT INTO token_ledger
             (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
           VALUES (:userId, NULL, 'debit', 'topup_refund', :topupId, :amount, :balanceAfter, :remarks, UTC_TIMESTAMP())`,
          {
            userId: payment.user_id,
            topupId: payment.topup_id,
            amount: payment.token_amount,
            balanceAfter,
            remarks: `CHIP refund ${payment.topup_ref}`
          }
        );
      }

      await connection.execute(
        `UPDATE payments SET status = 'refunded' WHERE id = :paymentId`,
        { paymentId: payment.payment_id }
      );
      await connection.execute(
        `UPDATE token_topups SET status = :topupStatus WHERE id = :topupId`,
        {
          topupId: payment.topup_id,
          topupStatus: topUpRewardRefund.redeemed > 0 ? 'refund_needs_review' : 'refunded'
        }
      );
      await connection.execute(
        `UPDATE token_wallet_cap_reservations
         SET status = 'released', release_reason = 'chip_refunded', released_at = UTC_TIMESTAMP()
         WHERE topup_id = :topupId AND status IN ('active', 'needs_review')`,
        { topupId: payment.topup_id }
      );
      await connection.execute(
        `INSERT INTO payment_events
           (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
         VALUES (:paymentId, :eventRef, 'chip_refunded', :payloadHash, UTC_TIMESTAMP(), :result, UTC_TIMESTAMP())`,
        {
          paymentId: payment.payment_id,
          eventRef,
          payloadHash: eventPayloadHash,
          result: topUpRewardRefund.redeemed > 0
            ? 'needs_review_redeemed_topup_reward'
            : wasCredited
              ? 'tokens_reversed'
              : 'no_credit_to_reverse'
        }
      );
      if (wasCredited) {
        const notificationBody = topUpRewardRefund.redeemed > 0
          ? `${payment.token_amount} C2 Tokens were removed because the payment was refunded. A redeemed top-up reward requires staff review.`
          : `${payment.token_amount} C2 Tokens were removed because the payment was refunded.`;
        await createUserNotification(connection, {
          userId: payment.user_id,
          type: topUpRewardRefund.redeemed > 0 ? 'token_topup_review' : 'token_topup_refunded',
          title: topUpRewardRefund.redeemed > 0 ? 'Refund under review' : 'Top-up refunded',
          body: notificationBody,
          data: {
            topup_ref: payment.topup_ref,
            status: topUpRewardRefund.redeemed > 0 ? 'refund_needs_review' : 'refunded'
          },
          deliveryKey: topUpRewardRefund.redeemed > 0
            ? `token_topup_review:${payment.topup_id}:redeemed_reward`
            : `token_topup_refunded:${payment.topup_id}`
        });
      }
      await connection.commit();
      committed = true;
      if (wasCredited) {
        deliverTopUpStatusPush(logger, {
          userId: payment.user_id,
          title: topUpRewardRefund.redeemed > 0 ? 'Refund under review' : 'Top-up refunded',
          body: topUpRewardRefund.redeemed > 0
            ? `${payment.token_amount} C2 Tokens were removed because the payment was refunded. A redeemed top-up reward requires staff review.`
            : `${payment.token_amount} C2 Tokens were removed because the payment was refunded.`,
          type: topUpRewardRefund.redeemed > 0 ? 'token_topup_review' : 'token_topup_refunded',
          topupRef: payment.topup_ref,
          status: topUpRewardRefund.redeemed > 0 ? 'refund_needs_review' : 'refunded'
        });
      }
      return {
        received: true,
        credited: false,
        terminal: true,
        ...(topUpRewardRefund.redeemed > 0 ? { needs_review: true } : {})
      };
    }

    if (payment.payment_status === 'paid' || payment.topup_status === 'paid') {
      await connection.commit();
      committed = true;
      return { received: true, duplicate: true };
    }

    if (!isPaid || !amountMatches) {
      const terminalFailure = chipTerminalFailure(status);
      await connection.execute(
        `INSERT INTO payment_events
           (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
         VALUES (:paymentId, :eventRef, :eventType, :payloadHash, UTC_TIMESTAMP(), :result, UTC_TIMESTAMP())`,
        {
          paymentId: payment.payment_id,
          eventRef,
          eventType: isPaid ? 'amount_mismatch' : `chip_${status}`,
          payloadHash: eventPayloadHash,
          result: isPaid ? 'rejected' : terminalFailure ?? 'not_paid'
        }
      );
      if (terminalFailure) {
        await connection.execute(
          `UPDATE payments
           SET status = :paymentStatus, failed_at = IF(:paymentStatus = 'failed', UTC_TIMESTAMP(), failed_at)
           WHERE id = :paymentId AND status IN ('pending', 'authorized')`,
          { paymentId: payment.payment_id, paymentStatus: terminalFailure }
        );
        await connection.execute(
          `UPDATE token_topups SET status = :topupStatus
           WHERE id = :topupId AND status = 'pending_payment'`,
          { topupId: payment.topup_id, topupStatus: terminalFailure }
        );
        await connection.execute(
          `UPDATE token_wallet_cap_reservations
           SET status = 'released', release_reason = :releaseReason, released_at = UTC_TIMESTAMP()
           WHERE topup_id = :topupId AND status IN ('active', 'needs_review')`,
          { topupId: payment.topup_id, releaseReason: `chip_${terminalFailure}` }
        );
        const title = terminalFailure === 'cancelled' ? 'Top-up cancelled' : 'Top-up unsuccessful';
        const body = terminalFailure === 'cancelled'
          ? 'Your top-up was cancelled. No C2 Tokens were added.'
          : 'Your top-up was unsuccessful. No C2 Tokens were added.';
        await createUserNotification(connection, {
          userId: payment.user_id,
          type: `token_topup_${terminalFailure}`,
          title,
          body,
          data: { topup_ref: payment.topup_ref, status: terminalFailure },
          deliveryKey: `token_topup_${terminalFailure}:${payment.topup_id}`
        });
      } else if (isPaid && !amountMatches) {
        await connection.execute(
          `UPDATE token_wallet_cap_reservations
           SET status = 'needs_review', release_reason = 'amount_mismatch'
           WHERE topup_id = :topupId AND status IN ('active', 'released')`,
          { topupId: payment.topup_id }
        );
        await createUserNotification(connection, {
          userId: payment.user_id,
          type: 'token_topup_review',
          title: 'Top-up under review',
          body: 'Your payment was received, but the amount needs verification before C2 Tokens can be added.',
          data: { topup_ref: payment.topup_ref, status: 'needs_review' },
          deliveryKey: `token_topup_review:${payment.topup_id}:amount`
        });
      }
      await connection.commit();
      committed = true;
      if (terminalFailure) {
        deliverTopUpStatusPush(logger, {
          userId: payment.user_id,
          title: terminalFailure === 'cancelled' ? 'Top-up cancelled' : 'Top-up unsuccessful',
          body: terminalFailure === 'cancelled'
            ? 'Your top-up was cancelled. No C2 Tokens were added.'
            : 'Your top-up was unsuccessful. No C2 Tokens were added.',
          type: `token_topup_${terminalFailure}`,
          topupRef: payment.topup_ref,
          status: terminalFailure
        });
      } else if (isPaid && !amountMatches) {
        deliverTopUpStatusPush(logger, {
          userId: payment.user_id,
          title: 'Top-up under review',
          body: 'Your payment was received, but the amount needs verification before C2 Tokens can be added.',
          type: 'token_topup_review',
          topupRef: payment.topup_ref,
          status: 'needs_review'
        });
      }
      return { received: true, credited: false, terminal: Boolean(terminalFailure) };
    }

    const [accounts] = await connection.execute<Array<RowDataPacket & { balance_available: number; balance_cap: number }>>(
      `SELECT balance_available, balance_cap FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
      { userId: payment.user_id }
    );
    const account = accounts[0];
    if (!account) throw new ApiError(409, 'token_account_not_found', 'Token account was not found.');
    const [reservationRows] = await connection.execute<Array<RowDataPacket & {
      id: number;
      token_amount: number;
      status: 'active' | 'consumed' | 'released' | 'needs_review';
    }>>(
      `SELECT id, token_amount, status FROM token_wallet_cap_reservations
       WHERE topup_id = :topupId LIMIT 1 FOR UPDATE`,
      { topupId: payment.topup_id }
    );
    const reservation = reservationRows[0];
    if (!reservation || !['active', 'released', 'needs_review'].includes(reservation.status) ||
        Number(reservation.token_amount) !== Number(payment.token_amount)) {
      if (reservation?.status === 'consumed') {
        await connection.commit();
        committed = true;
        return { received: true, duplicate: true };
      }
      throw new ApiError(409, 'wallet_capacity_reservation_unavailable', 'This paid top-up requires staff reconciliation.');
    }
    const [otherReservations] = await connection.execute<Array<RowDataPacket & { reserved_tokens: number }>>(
      `SELECT COALESCE(SUM(token_amount), 0) AS reserved_tokens
       FROM token_wallet_cap_reservations
       WHERE user_id = :userId AND status = 'active' AND id != :reservationId
         AND expires_at > UTC_TIMESTAMP()
       FOR UPDATE`,
      { userId: payment.user_id, reservationId: reservation.id }
    );
    const reservedTokens = Number(otherReservations[0]?.reserved_tokens ?? 0);
    if (Number(account.balance_available) + reservedTokens + Number(payment.token_amount) > Number(account.balance_cap)) {
      await connection.execute(
        `UPDATE token_wallet_cap_reservations
         SET status = 'needs_review', release_reason = 'wallet_cap_conflict'
         WHERE id = :reservationId`,
        { reservationId: reservation.id }
      );
      await connection.execute(
        `INSERT INTO payment_events
           (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
         VALUES (:paymentId, :eventRef, 'chip_paid', :payloadHash, UTC_TIMESTAMP(), 'needs_review', UTC_TIMESTAMP())`,
        { paymentId: payment.payment_id, eventRef, payloadHash: eventPayloadHash }
      );
      await createUserNotification(connection, {
        userId: payment.user_id,
        type: 'token_topup_review',
        title: 'Top-up under review',
        body: 'Your payment was received, but your wallet needs staff review before C2 Tokens can be added.',
        data: { topup_ref: payment.topup_ref, status: 'needs_review' },
        deliveryKey: `token_topup_review:${payment.topup_id}:wallet_cap`
      });
      await connection.commit();
      committed = true;
      deliverTopUpStatusPush(logger, {
        userId: payment.user_id,
        title: 'Top-up under review',
        body: 'Your payment was received, but your wallet needs staff review before C2 Tokens can be added.',
        type: 'token_topup_review',
        topupRef: payment.topup_ref,
        status: 'needs_review'
      });
      return { received: true, credited: false, needs_review: true };
    }

    const balanceAfter = Number(account.balance_available) + Number(payment.token_amount);
    await connection.execute(
      `UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP()
       WHERE user_id = :userId`,
      { balanceAfter, userId: payment.user_id }
    );
    await connection.execute(
      `UPDATE token_topups SET status = 'paid', paid_at = UTC_TIMESTAMP()
       WHERE id = :topupId AND status IN ('pending_payment', 'failed', 'cancelled')`,
      { topupId: payment.topup_id }
    );
    await connection.execute(
      `UPDATE payments SET status = 'paid', paid_at = UTC_TIMESTAMP(), failed_at = NULL
       WHERE id = :paymentId AND status IN ('pending', 'authorized', 'failed', 'cancelled')`,
      { paymentId: payment.payment_id }
    );
    await connection.execute(
      `INSERT INTO token_ledger
         (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
       VALUES (:userId, NULL, 'credit', 'topup_paid', :topupId, :amount, :balanceAfter, :remarks, UTC_TIMESTAMP())`,
      {
        userId: payment.user_id,
        topupId: payment.topup_id,
        amount: payment.token_amount,
        balanceAfter,
        remarks: `CHIP top-up ${payment.topup_ref}`
      }
    );
    await connection.execute(
      `UPDATE token_wallet_cap_reservations
       SET status = 'consumed', consumed_at = UTC_TIMESTAMP(), release_reason = NULL
       WHERE id = :reservationId AND status IN ('active', 'released', 'needs_review')`,
      { reservationId: reservation.id }
    );
    await connection.execute(
      `INSERT INTO payment_events
         (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
       VALUES (:paymentId, :eventRef, 'chip_paid', :payloadHash, UTC_TIMESTAMP(), 'credited', UTC_TIMESTAMP())`,
      { paymentId: payment.payment_id, eventRef, payloadHash: eventPayloadHash }
    );
    const issuedTopUpRewards = await issueTopUpRewardVouchers(connection, {
      userId: payment.user_id,
      topupId: payment.topup_id,
      tokenAmount: payment.token_amount
    });
    await createUserNotification(connection, {
      userId: payment.user_id,
      type: 'token_topup_paid',
      title: 'Tokens added',
      body: `${payment.token_amount} C2 Tokens have been added to your wallet.`,
      data: { topup_ref: payment.topup_ref, status: 'paid' },
      deliveryKey: `token_topup_paid:${payment.topup_id}`
    });
    await connection.commit();
    committed = true;
    deliverTopUpStatusPush(logger, {
      userId: payment.user_id,
      title: 'Tokens added',
      body: `${payment.token_amount} C2 Tokens have been added to your wallet.`,
      type: 'token_topup_paid',
      topupRef: payment.topup_ref,
      status: 'paid'
    });
    return { received: true, credited: true, ...(issuedTopUpRewards > 0 ? { topup_rewards_issued: issuedTopUpRewards } : {}) };
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
