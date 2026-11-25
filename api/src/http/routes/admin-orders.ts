import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import crypto from 'node:crypto';
import { authenticateAdminRequest } from '../../admin/guard.js';
import { requireAdminActionConfirmation } from '../../admin/action-confirmation.js';
import { mysqlPool } from '../../db/mysql.js';
import { splitOrderPriceCorrection } from '../../services/order-price-correction.js';
import { processOrderLoyalty, reverseOrderLoyalty } from '../../services/loyalty.js';
import { calculatePersonalTokenRefund, restoreEmployeeAllowanceForRefund } from '../../services/employee-token-allowance.js';
import { awardReferralForCollectedOrder, reverseReferralForRefundedOrder } from '../../services/referrals.js';
import { issueRefundReplacementVoucher } from '../../services/voucher-replacement.js';
import { deliverPushToUser } from '../../services/push-delivery.js';
import { ApiError } from '../errors.js';
import { createUserNotification } from '../notifications.js';
import { z } from 'zod';
import { resolveBaristaShiftAccess } from '../../services/barista-shift-access.js';
import { consumeInventoryForOrder, releaseInventoryForOrder, reverseInventoryForOrder } from '../../services/inventory.js';
import { restoreGiftCardForRefund } from '../../services/gift-cards.js';
import { isComplimentaryOrder, restoreVoucherForCancelledOrder } from '../../services/order-voucher.js';
import { deliverQueuedOrderReceiptEmail, queueOrderReceiptEmail } from '../../services/order-receipt-email.js';
import { allocateIntegerTotal, incrementalQuantityAllocation } from '../../services/partial-refund.js';
import { formatTierName, loadLoyaltyTiers } from '../../services/loyalty-tiers.js';
import {
  cancelPromotionalAddonForOrder,
  fulfilPromotionalAddonForOrder,
  recordPromotionalAddonRefundDisposition,
} from '../../services/promotional-addons.js';
import {
  collectMatchedUnits,
  parsePromotionRule,
  parseVoucherScope,
} from './checkout.js';

export function formatDisplayDate(dateObj: Date, timeZone = 'Asia/Kuala_Lumpur'): string {
  if (!dateObj) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone
  }).format(dateObj);
}

export function formatDisplayTime(dateObj: Date, timeZone = 'Asia/Kuala_Lumpur'): string {
  if (!dateObj) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone
  }).format(dateObj);
}

function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function requireOrderAccess(request: { adminAuth?: { roles?: string[] } }): void {
  const roles = request.adminAuth?.roles ?? [];
  const allowedRoles = ['super_admin', 'admin', 'barista'];
  if (!allowedRoles.some((role) => roles.includes(role))) {
    throw new ApiError(403, 'admin_forbidden', 'You do not have permission to manage orders.');
  }
}

function requireRefundRequestAccess(
  request: { adminAuth?: { roles?: string[] } },
  isPartialItemRefund = false
): void {
  const roles = request.adminAuth?.roles ?? [];
  const allowedRoles = isPartialItemRefund
    ? ['super_admin', 'admin', 'support_admin', 'barista']
    : ['super_admin', 'admin', 'support_admin'];
  if (!roles.some((role) => allowedRoles.includes(role))) {
    throw new ApiError(403, 'admin_forbidden', 'You do not have permission to manage refund requests.');
  }
}

function requireRefundApprovalAccess(request: { adminAuth?: { roles?: string[] } }): void {
  if (!(request.adminAuth?.roles ?? []).includes('super_admin')) {
    throw new ApiError(403, 'admin_forbidden', 'Only a Super Admin can approve or reject refunds.');
  }
}

function requireFinanceAccess(request: { adminAuth?: { roles?: string[] } }): void {
  const roles = request.adminAuth?.roles ?? [];
  if (!roles.includes('super_admin') && !roles.includes('admin')) {
    throw new ApiError(403, 'admin_forbidden', 'You do not have permission to view finance data.');
  }
}

function requirePriceCorrectionAccess(request: { adminAuth?: { roles?: string[] } }): void {
  if (!(request.adminAuth?.roles ?? []).includes('super_admin')) {
    throw new ApiError(403, 'admin_forbidden', 'Only a Super Admin can correct historical order pricing.');
  }
}

function queueCustomerPush(request: { log: { warn: (payload: unknown, message: string) => void } }, userId: number, title: string, body: string, type: string): void {
  void deliverPushToUser({ userId, title, body, data: { type } }).catch((error) => {
    request.log.warn({ err: error, userId, type }, 'Customer notification push delivery failed after transaction commit.');
  });
}

async function restorePartialAllowance(
  connection: import('mysql2/promise').PoolConnection,
  orderId: number,
  refundId: number,
  refundTokenAmount: number,
  adminUserId: number
): Promise<{ allowancePortion: number; restored: number }> {
  const [rows] = await connection.execute<Array<RowDataPacket & {
    user_id: number; order_ref: string;
    token_amount_charged: number; allowance_used: number; allowance_refunded: number;
    allowance_id: number | null; period_end: Date | null; status: string | null;
  }>>(`
    SELECT o.user_id, o.order_ref, o.token_amount_charged, o.employee_allowance_tokens_used AS allowance_used,
           o.employee_allowance_tokens_refunded AS allowance_refunded,
           eta.id AS allowance_id, eta.period_end, eta.status
      FROM orders o
      JOIN stores s ON s.id = o.store_id
      LEFT JOIN employee_token_allowances eta
        ON eta.tenant_id = s.tenant_id AND eta.user_id = o.user_id
       AND DATE(o.created_at) BETWEEN eta.period_start AND eta.period_end
     WHERE o.id = :orderId LIMIT 1 FOR UPDATE`, { orderId });
  const row = rows[0];
  if (!row) return { allowancePortion: 0, restored: 0 };
  const charged = Number(row.token_amount_charged);
  const allowanceUsed = Number(row.allowance_used);
  const already = Number(row.allowance_refunded);
  const [priorRows] = await connection.execute<Array<RowDataPacket & { refunded_tokens: number }>>(
    `SELECT COALESCE(SUM(refund_token_amount), 0) AS refunded_tokens
       FROM refunds
      WHERE order_id = :orderId AND id <> :refundId AND status IN ('approved', 'completed')`,
    { orderId, refundId }
  );
  const cumulativeRefund = Number(priorRows[0]?.refunded_tokens ?? 0) + refundTokenAmount;
  const split = splitOrderPriceCorrection({
    originalTokenAmount: charged,
    correctedTokenAmount: Math.max(0, charged - cumulativeRefund),
    originalSubsidyTokenAmount: allowanceUsed
  });
  const target = split.subsidyCorrectionTokenAmount;
  const allowancePortion = Math.max(0, target - already);
  if (allowancePortion <= 0) return { allowancePortion: 0, restored: 0 };
  if (!row.allowance_id || !row.period_end || row.status === 'revoked') {
    return { allowancePortion, restored: 0 };
  }
  const periodEnd = new Date(row.period_end);
  periodEnd.setUTCHours(23, 59, 59, 999);
  if (periodEnd < new Date()) return { allowancePortion, restored: 0 };
  const restore = allowancePortion;
  await connection.execute(`UPDATE employee_token_allowances SET remaining_amount = remaining_amount + :restore, refunded_amount = refunded_amount + :restore, status = 'active', updated_at = UTC_TIMESTAMP() WHERE id = :allowanceId`, { restore, allowanceId: row.allowance_id });
  await connection.execute(`UPDATE orders SET employee_allowance_tokens_refunded = employee_allowance_tokens_refunded + :restore WHERE id = :orderId`, { restore, orderId });
  const [accountRows] = await connection.execute<Array<RowDataPacket & { balance_available: number }>>(
    `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
    { userId: row.user_id }
  );
  if (accountRows[0]) {
    const balanceAfter = Number(accountRows[0].balance_available) + restore;
    await connection.execute(
      `UPDATE token_accounts SET balance_available = :balanceAfter, balance_cap = GREATEST(balance_cap, :balanceAfter), updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`,
      { balanceAfter, userId: row.user_id }
    );
    await connection.execute(
      `INSERT INTO token_ledger (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_by_admin_id, created_at)
       VALUES (:userId, NULL, 'credit', 'refund_return', :refundId, :amount, :balanceAfter, :remarks, :adminUserId, UTC_TIMESTAMP())`,
      { userId: row.user_id, refundId, amount: restore, balanceAfter, remarks: `Company subsidy restored for partial refund on ${row.order_ref}`, adminUserId }
    );
  }
  return { allowancePortion, restored: restore };
}

async function reverseLoyaltyWhenNoQualifyingItemsRemain(
  connection: import('mysql2/promise').PoolConnection,
  orderId: number,
  refundId: number,
  userId: number,
  adminUserId: number
): Promise<void> {
  const [rows] = await connection.execute<Array<RowDataPacket & { remaining_quantity: number }>>(
    `SELECT COALESCE(SUM(GREATEST(oi.quantity - COALESCE(refunded.quantity, 0), 0)), 0) AS remaining_quantity
       FROM order_items oi
       LEFT JOIN (
         SELECT ri.order_item_id, SUM(ri.quantity) AS quantity
           FROM refund_items ri
           JOIN refunds r ON r.id = ri.refund_id
          WHERE r.order_id = :orderId
            AND (r.status IN ('approved', 'completed') OR r.id = :refundId)
          GROUP BY ri.order_item_id
       ) refunded ON refunded.order_item_id = oi.id
      WHERE oi.order_id = :orderId AND oi.is_qualifying_cup = 1`,
    { orderId, refundId }
  );
  if (Number(rows[0]?.remaining_quantity ?? 0) > 0) return;
  await reverseOrderLoyalty(orderId, userId, connection, adminUserId);
  await reverseReferralForRefundedOrder(connection, orderId, adminUserId);
}

const createRefundSchema = z.object({
  order_id: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(10).max(500),
  confirmation_password: z.string().trim().min(8).max(200),
  items: z.array(z.object({
    order_item_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive()
  })).min(1).optional()
}).superRefine((value, context) => {
  if (!value.items) return;
  const ids = value.items.map((item) => item.order_item_id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'Each order item may only appear once in a refund request.' });
  }
});

const adminListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10000).optional().default(50),
  store_id: z.coerce.number().int().positive().optional(),
  view: z.enum(['all', 'barista_workspace']).optional().default('all')
});

const financeQuerySchema = z.object({
  store_id: z.coerce.number().int().positive().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

const financeAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  store_id: z.coerce.number().int().positive().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

const priceCorrectionSchema = z.object({
  corrected_token_amount: z.coerce.number().int().min(0),
  reason: z.string().trim().min(10).max(500),
  confirmation_password: z.string().trim().min(8).max(200)
});

type PriceCorrectionPreview = {
  orderId: number;
  orderRef: string;
  userId: number;
  tenantId: number;
  status: string;
  originalTokenAmount: number;
  historicalGrossTokenAmount: number;
  correctedGrossTokenAmount: number;
  preservedDeductionTokenAmount: number;
  suggestedCorrectedTokenAmount: number;
  originalSubsidyTokenAmount: number;
  originalPersonalTokenAmount: number;
  allowanceWasUnlimited: boolean;
  existingCorrectionId: number | null;
  items: Array<{
    name: string;
    quantity: number;
    historicalUnitTokens: number;
    configuredBaseUnitTokens: number;
    modifierUnitTokens: number;
    historicalLineTokens: number;
    correctedLineTokens: number;
  }>;
};

async function loadPriceCorrectionPreview(
  connection: Awaited<ReturnType<typeof mysqlPool.getConnection>>,
  tenantCode: string,
  orderRef: string,
  lock = false
): Promise<PriceCorrectionPreview> {
  const [orders] = await connection.query<Array<RowDataPacket & {
    id: number;
    order_ref: string;
    user_id: number;
    tenant_id: number;
    status: string;
    payment_mode: string;
    token_amount_charged: number;
    employee_allowance_tokens_used: number;
    employee_allowance_was_unlimited: number;
  }>>(
    `SELECT o.id, o.order_ref, o.user_id, s.tenant_id, o.status, o.payment_mode,
            o.token_amount_charged, o.employee_allowance_tokens_used,
            o.employee_allowance_was_unlimited
       FROM orders o
       JOIN stores s ON s.id = o.store_id
       JOIN admin_tenants t ON t.id = s.tenant_id
      WHERE o.order_ref = :orderRef AND t.code = :tenantCode
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    { orderRef, tenantCode }
  );
  const order = orders[0];
  if (!order) throw new ApiError(404, 'order_not_found', 'Order not found for this tenant.');
  if (order.payment_mode !== 'token') {
    throw new ApiError(409, 'price_correction_not_supported', 'Only token-paid orders can use token price correction.');
  }
  if (['draft', 'pending_payment', 'payment_failed', 'cancelled', 'refunded'].includes(order.status)) {
    throw new ApiError(409, 'price_correction_not_eligible', 'This order is not eligible for a token price correction.');
  }

  const [correctionRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
    `SELECT id FROM order_price_corrections WHERE order_id = :orderId LIMIT 1`,
    { orderId: order.id }
  );

  const [itemRows] = await connection.query<Array<RowDataPacket & {
    id: number;
    name: string;
    quantity: number;
    historical_unit_tokens: number;
    historical_line_tokens: number;
    configured_base_tokens: number;
    modifier_tokens: number;
  }>>(
    `SELECT oi.id, oi.item_name_snapshot AS name, oi.quantity,
            COALESCE(oi.token_price_snapshot, 0) AS historical_unit_tokens,
            COALESCE(oi.line_token_amount, 0) AS historical_line_tokens,
            mi.base_price_token AS configured_base_tokens,
            COALESCE(SUM(oim.token_price_delta_snapshot), 0) AS modifier_tokens
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN order_item_modifiers oim ON oim.order_item_id = oi.id
      WHERE oi.order_id = :orderId
      GROUP BY oi.id, oi.item_name_snapshot, oi.quantity, oi.token_price_snapshot,
               oi.line_token_amount, mi.base_price_token
      ORDER BY oi.id`,
    { orderId: order.id }
  );
  if (itemRows.length === 0 || itemRows.some((row) => row.configured_base_tokens == null)) {
    throw new ApiError(409, 'price_correction_requires_manual_review', 'One or more original menu items no longer has a configured base token price.');
  }

  const items = itemRows.map((row) => {
    const quantity = Number(row.quantity);
    const configuredBaseUnitTokens = Number(row.configured_base_tokens);
    const modifierUnitTokens = Number(row.modifier_tokens);
    return {
      name: String(row.name),
      quantity,
      historicalUnitTokens: Number(row.historical_unit_tokens),
      configuredBaseUnitTokens,
      modifierUnitTokens,
      historicalLineTokens: Number(row.historical_line_tokens),
      correctedLineTokens: Math.max(0, configuredBaseUnitTokens + modifierUnitTokens) * quantity
    };
  });
  const historicalGrossTokenAmount = items.reduce((sum, item) => sum + item.historicalLineTokens, 0);
  const correctedGrossTokenAmount = items.reduce((sum, item) => sum + item.correctedLineTokens, 0);
  const originalTokenAmount = Number(order.token_amount_charged);
  const preservedDeductionTokenAmount = Math.max(0, historicalGrossTokenAmount - originalTokenAmount);
  const suggestedCorrectedTokenAmount = Math.max(0, correctedGrossTokenAmount - preservedDeductionTokenAmount);
  const originalSubsidyTokenAmount = Math.min(originalTokenAmount, Number(order.employee_allowance_tokens_used));

  return {
    orderId: Number(order.id),
    orderRef: order.order_ref,
    userId: Number(order.user_id),
    tenantId: Number(order.tenant_id),
    status: order.status,
    originalTokenAmount,
    historicalGrossTokenAmount,
    correctedGrossTokenAmount,
    preservedDeductionTokenAmount,
    suggestedCorrectedTokenAmount,
    originalSubsidyTokenAmount,
    originalPersonalTokenAmount: Math.max(0, originalTokenAmount - originalSubsidyTokenAmount),
    allowanceWasUnlimited: Number(order.employee_allowance_was_unlimited) === 1,
    existingCorrectionId: correctionRows[0]?.id == null ? null : Number(correctionRows[0].id),
    items
  };
}

export async function registerAdminOrdersRoutes(app: FastifyInstance) {
  app.get('/v1/admin/orders/:orderRef/price-correction-preview', { preHandler: authenticateAdminRequest }, async (request) => {
    requirePriceCorrectionAccess(request);
    const orderRef = z.string().trim().min(1).max(80).parse((request.params as { orderRef?: string }).orderRef);
    const connection = await mysqlPool.getConnection();
    try {
      const preview = await loadPriceCorrectionPreview(connection, request.adminAuth.tenantCode, orderRef);
      return { preview };
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/orders/:orderRef/price-correction', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requirePriceCorrectionAccess(request);
    const orderRef = z.string().trim().min(1).max(80).parse((request.params as { orderRef?: string }).orderRef);
    const payload = priceCorrectionSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      const preview = await loadPriceCorrectionPreview(connection, request.adminAuth.tenantCode, orderRef, true);
      if (preview.existingCorrectionId) {
        throw new ApiError(409, 'price_correction_already_applied', 'This order already has a price correction.');
      }
      if (payload.corrected_token_amount >= preview.originalTokenAmount) {
        throw new ApiError(409, 'price_correction_invalid', 'The corrected amount must be lower than the original token charge.');
      }
      if (payload.corrected_token_amount > preview.correctedGrossTokenAmount) {
        throw new ApiError(409, 'price_correction_invalid', 'The corrected amount cannot exceed the configured base-price total.');
      }

      const split = splitOrderPriceCorrection({
        originalTokenAmount: preview.originalTokenAmount,
        correctedTokenAmount: payload.corrected_token_amount,
        originalSubsidyTokenAmount: preview.originalSubsidyTokenAmount
      });
      const correctionTokenAmount = split.correctionTokenAmount;
      const subsidyTokenAmount = split.subsidyCorrectionTokenAmount;
      const personalTokenAmount = split.personalCorrectionTokenAmount;
      let subsidyRestored = 0;

      if (subsidyTokenAmount > 0 && !preview.allowanceWasUnlimited) {
        const [allowanceRows] = await connection.query<Array<RowDataPacket & {
          id: number;
          remaining_amount: number;
          granted_amount: number;
          carried_forward_amount: number;
          status: string;
          period_end: Date | string;
        }>>(
          `SELECT eta.id, eta.remaining_amount, eta.granted_amount, eta.carried_forward_amount,
                  eta.status, eta.period_end
             FROM employee_token_allowances eta
             JOIN orders o ON o.user_id = eta.user_id
            WHERE o.id = :orderId
              AND DATE(o.created_at) BETWEEN eta.period_start AND eta.period_end
            LIMIT 1 FOR UPDATE`,
          { orderId: preview.orderId }
        );
        const allowance = allowanceRows[0];
        if (!allowance) {
          throw new ApiError(409, 'price_correction_allowance_missing', 'The original company allowance record could not be found.');
        }
        const periodEnd = allowance.period_end instanceof Date
          ? allowance.period_end
          : new Date(`${allowance.period_end}T23:59:59Z`);
        if (allowance.status === 'revoked' || periodEnd.getTime() < Date.now()) {
          throw new ApiError(409, 'price_correction_allowance_closed', 'The original company allowance period is closed. Finance must review this order before credit is returned.');
        }
        const allowanceCap = Number(allowance.granted_amount) + Number(allowance.carried_forward_amount);
        subsidyRestored = Math.min(subsidyTokenAmount, Math.max(0, allowanceCap - Number(allowance.remaining_amount)));
        if (subsidyRestored !== subsidyTokenAmount) {
          throw new ApiError(409, 'price_correction_allowance_mismatch', 'The company allowance no longer has enough capacity for this correction. Review the allowance before continuing.');
        }
        await connection.execute(
          `UPDATE employee_token_allowances
              SET remaining_amount = remaining_amount + :amount,
                  updated_at = UTC_TIMESTAMP()
            WHERE id = :allowanceId`,
          { amount: subsidyRestored, allowanceId: allowance.id }
        );
      }

      const walletCreditAmount = personalTokenAmount + (preview.allowanceWasUnlimited ? 0 : subsidyRestored);
      let balanceAfter = 0;
      if (walletCreditAmount > 0) {
        const [accounts] = await connection.query<Array<RowDataPacket & { balance_available: number }>>(
          `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
          { userId: preview.userId }
        );
        if (!accounts[0]) throw new ApiError(409, 'token_account_missing', 'The customer token account was not found.');
        balanceAfter = Number(accounts[0].balance_available) + walletCreditAmount;
        await connection.execute(
          `UPDATE token_accounts
              SET balance_available = :balanceAfter,
                  balance_cap = GREATEST(balance_cap, :balanceAfter),
                  updated_at = UTC_TIMESTAMP()
            WHERE user_id = :userId`,
          { balanceAfter, userId: preview.userId }
        );
      }

      const [correctionResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO order_price_corrections
          (tenant_id, order_id, original_token_amount, corrected_token_amount,
           correction_token_amount, subsidy_token_amount, personal_token_amount,
           wallet_credit_amount, historical_gross_token_amount, corrected_gross_token_amount,
           preserved_deduction_token_amount, calculation_json, reason, created_by_admin_id, created_at)
         VALUES
          (:tenantId, :orderId, :originalAmount, :correctedAmount, :correctionAmount,
           :subsidyAmount, :personalAmount, :walletCreditAmount, :historicalGross,
           :correctedGross, :preservedDeduction, :calculationJson, :reason, :adminId, UTC_TIMESTAMP())`,
        {
          tenantId: preview.tenantId,
          orderId: preview.orderId,
          originalAmount: preview.originalTokenAmount,
          correctedAmount: payload.corrected_token_amount,
          correctionAmount: correctionTokenAmount,
          subsidyAmount: subsidyTokenAmount,
          personalAmount: personalTokenAmount,
          walletCreditAmount,
          historicalGross: preview.historicalGrossTokenAmount,
          correctedGross: preview.correctedGrossTokenAmount,
          preservedDeduction: preview.preservedDeductionTokenAmount,
          calculationJson: JSON.stringify({ ...preview, fundingSplit: split }),
          reason: payload.reason,
          adminId: request.adminAuth.adminUserId
        }
      );

      await connection.execute(
        `UPDATE orders
            SET token_amount_charged = :correctedAmount,
                employee_allowance_tokens_used = GREATEST(0, employee_allowance_tokens_used - :subsidyAmount)
          WHERE id = :orderId`,
        {
          correctedAmount: payload.corrected_token_amount,
          subsidyAmount: subsidyTokenAmount,
          orderId: preview.orderId
        }
      );

      if (walletCreditAmount > 0) {
        await connection.execute(
          `INSERT INTO token_ledger
            (user_id, token_lot_id, direction, source_type, source_id, amount,
             balance_after, remarks, created_by_admin_id, created_at)
           VALUES
            (:userId, NULL, 'credit', 'order_price_correction', :correctionId, :amount,
             :balanceAfter, :remarks, :adminId, UTC_TIMESTAMP())`,
          {
            userId: preview.userId,
            correctionId: correctionResult.insertId,
            amount: walletCreditAmount,
            balanceAfter,
            remarks: `Token price correction for order ${preview.orderRef}`,
            adminId: request.adminAuth.adminUserId
          }
        );
      }

      await connection.execute(
        `INSERT INTO admin_audit_logs
          (admin_user_id, effective_roles_json, action_code, target_type, target_id,
           ip_address, user_agent, created_at)
         VALUES
          (:adminId, :roles, 'order_token_price_corrected', 'order_price_correction', :correctionId,
           :ipAddress, :userAgent, UTC_TIMESTAMP())`,
        {
          adminId: request.adminAuth.adminUserId,
          roles: JSON.stringify(request.adminAuth.roles),
          correctionId: correctionResult.insertId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null
        }
      );

      await connection.commit();
      return reply.code(201).send({
        correction: {
          id: correctionResult.insertId,
          order_ref: preview.orderRef,
          original_token_amount: preview.originalTokenAmount,
          corrected_token_amount: payload.corrected_token_amount,
          credited_token_amount: walletCreditAmount,
          subsidy_token_amount: subsidyTokenAmount,
          personal_token_amount: personalTokenAmount
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/refunds', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    const payload = createRefundSchema.parse(request.body);
    requireRefundRequestAccess(request, Boolean(payload.items));
    const connection = await mysqlPool.getConnection();
    let committed = false;

    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      const [orders] = await connection.execute<Array<RowDataPacket & {
        id: number;
        order_ref: string;
        user_id: number;
        payment_mode: 'token' | 'direct';
        final_total_rm: string;
        token_amount_charged: number;
        gift_card_token_amount: number;
        status: string;
        payment_id: number | null;
        payment_status: string | null;
      }>>(
        `
          SELECT o.id, o.order_ref, o.user_id, o.payment_mode, o.final_total_rm,
                 o.token_amount_charged, o.gift_card_token_amount, o.status,
                 p.id AS payment_id, p.status AS payment_status
          FROM orders o
          JOIN stores s ON s.id = o.store_id
          JOIN admin_tenants t ON t.id = s.tenant_id
          LEFT JOIN payments p ON p.id = (
            SELECT MAX(p2.id) FROM payments p2
             WHERE p2.order_id = o.id
               AND p2.status IN ('paid', 'partially_refunded', 'refunded')
          )
          WHERE o.order_ref = :orderRef AND t.code = :tenantCode
            AND (:isBaristaOnly = 0 OR EXISTS (
              SELECT 1 FROM admin_user_store_assignments aus
               WHERE aus.admin_user_id = :adminUserId AND aus.store_id = o.store_id
            ))
          LIMIT 1
          FOR UPDATE
        `,
        {
          orderRef: payload.order_id,
          tenantCode: request.adminAuth.tenantCode,
          isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0,
          adminUserId: request.adminAuth.adminUserId
        }
      );
      const order = orders[0];
      if (!order) {
        throw new ApiError(404, 'order_not_found', 'Order not found for this tenant.');
      }
      if (order.payment_mode === 'token' && order.token_amount_charged <= 0) {
        throw new ApiError(409, 'refund_not_supported', 'This order has no refundable C2 Credit charge.');
      }
      if (order.payment_mode === 'direct' && !['paid', 'partially_refunded'].includes(order.payment_status ?? '')) {
        throw new ApiError(409, 'payment_not_refundable', 'The direct payment is not in a refundable state.');
      }
      if (['draft', 'pending_payment', 'payment_failed', 'cancelled', 'refunded'].includes(order.status)) {
        throw new ApiError(409, 'refund_not_eligible', 'This order is not eligible for a refund request.');
      }
      const requestedItems = payload.items ?? null;
      let refundItems: Array<{ orderItemId: number; quantity: number; amountRm: number; tokenAmount: number }> = [];
      if (requestedItems) {
        if (Number(order.gift_card_token_amount ?? 0) > 0) {
          throw new ApiError(409, 'partial_refund_gift_card_not_supported', 'This order used a token gift card. Use the full refund workflow so the gift-card value can be restored safely.');
        }
        const [orderItems] = await connection.execute<Array<RowDataPacket & {
          id: number; quantity: number; line_subtotal_rm: string; line_token_amount: number | null;
        }>>(`SELECT id, quantity, line_subtotal_rm, line_token_amount FROM order_items WHERE order_id = :orderId FOR UPDATE`, { orderId: order.id });
        const byId = new Map(orderItems.map((item) => [Number(item.id), item]));
        const [alreadyRows] = await connection.execute<Array<RowDataPacket & { order_item_id: number; quantity: number }>>(
          `SELECT ri.order_item_id, SUM(ri.quantity) AS quantity
             FROM refund_items ri JOIN refunds r ON r.id = ri.refund_id
            WHERE r.order_id = :orderId AND r.status IN ('pending','approved','completed')
            GROUP BY ri.order_item_id`, { orderId: order.id });
        const already = new Map(alreadyRows.map((item) => [Number(item.order_item_id), Number(item.quantity)]));
        const tokenAllocations = order.payment_mode === 'token'
          ? allocateIntegerTotal(
              Number(order.token_amount_charged),
              orderItems.map((item) => ({ id: Number(item.id), weight: Number(item.line_token_amount ?? 0) }))
            )
          : new Map<number, number>();
        const rmAllocations = allocateIntegerTotal(
          Math.round(Number(order.final_total_rm) * 100),
          orderItems.map((item) => ({ id: Number(item.id), weight: Math.round(Number(item.line_subtotal_rm) * 100) }))
        );
        for (const item of requestedItems) {
          const source = byId.get(item.order_item_id);
          if (!source) throw new ApiError(400, 'refund_item_not_found', 'One of the selected order items was not found.');
          const alreadyQuantity = already.get(item.order_item_id) ?? 0;
          const remaining = Number(source.quantity) - alreadyQuantity;
          if (item.quantity > remaining) throw new ApiError(409, 'refund_quantity_exceeded', 'The requested refund quantity exceeds the remaining quantity for an order item.');
          const tokenAmount = incrementalQuantityAllocation(tokenAllocations.get(item.order_item_id) ?? 0, Number(source.quantity), alreadyQuantity, item.quantity);
          const amountRm = incrementalQuantityAllocation(rmAllocations.get(item.order_item_id) ?? 0, Number(source.quantity), alreadyQuantity, item.quantity) / 100;
          refundItems.push({
            orderItemId: item.order_item_id,
            quantity: item.quantity,
            amountRm,
            tokenAmount
          });
        }
        const requestedTokenAmount = refundItems.reduce((sum, item) => sum + item.tokenAmount, 0);
        const requestedAmountRm = refundItems.reduce((sum, item) => sum + item.amountRm, 0);
        if (order.payment_mode === 'token' && requestedTokenAmount <= 0) {
          throw new ApiError(400, 'refund_amount_zero', 'The selected items have no refundable token value.');
        }
        if (order.payment_mode === 'direct' && requestedAmountRm <= 0) {
          throw new ApiError(400, 'refund_amount_zero', 'The selected items have no refundable payment value.');
        }
      }
      const [existing] = await connection.execute<Array<RowDataPacket & { id: number; is_partial: number }>>(
        `SELECT r.id, EXISTS (SELECT 1 FROM refund_items ri WHERE ri.refund_id = r.id) AS is_partial
           FROM refunds r WHERE r.order_id = :orderId AND r.status IN ('pending', 'approved', 'completed')
          ORDER BY r.id LIMIT 1 FOR UPDATE`,
        { orderId: order.id }
      );
      if (existing[0] && (!requestedItems || Number(existing[0].is_partial) === 0)) {
        throw new ApiError(409, 'refund_already_requested', 'A refund request already exists for this order.');
      }
      const refundRef = `RFD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const [refundInsert] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO refunds (
            order_id, payment_id, payment_mode, refund_ref, refund_amount_rm,
            refund_token_amount, status, reason, created_by_admin_id, created_at
          ) VALUES (
            :orderId, :paymentId, :paymentMode, :refundRef, :amountRm,
            :tokenAmount, 'pending', :reason, :adminUserId, UTC_TIMESTAMP()
          )
        `,
        {
          orderId: order.id,
          paymentId: order.payment_id,
          paymentMode: order.payment_mode,
          refundRef,
          amountRm: requestedItems ? refundItems.reduce((sum, item) => sum + item.amountRm, 0).toFixed(2) : order.final_total_rm,
          tokenAmount: order.payment_mode === 'token'
            ? (requestedItems ? refundItems.reduce((sum, item) => sum + item.tokenAmount, 0) : order.token_amount_charged)
            : null,
          reason: payload.reason,
          adminUserId: request.adminAuth.adminUserId
        }
      );
      if (requestedItems) {
        for (const item of refundItems) {
          await connection.execute(
            `INSERT INTO refund_items (refund_id, order_item_id, quantity, refund_amount_rm, refund_token_amount, created_at)
             VALUES (:refundId, :orderItemId, :quantity, :amountRm, :tokenAmount, UTC_TIMESTAMP())`,
            { refundId: refundInsert.insertId, ...item }
          );
        }
      }
      await connection.execute(
        `
          INSERT INTO admin_audit_logs (
            admin_user_id, effective_roles_json, action_code, target_type, target_id,
            after_json, ip_address, user_agent, created_at
          ) VALUES (
            :adminUserId, :roles, 'refund_requested_by_admin', 'refund', :refundId,
            :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP()
          )
        `,
        {
          adminUserId: request.adminAuth.adminUserId,
          roles: JSON.stringify(request.adminAuth.roles),
          refundId: refundInsert.insertId,
          afterJson: JSON.stringify({
            payment_mode: order.payment_mode,
            partial_item_refund: Boolean(requestedItems),
            items: refundItems.map((item) => ({
              order_item_id: item.orderItemId,
              quantity: item.quantity,
              refund_amount_rm: item.amountRm,
              refund_token_amount: item.tokenAmount
            }))
          }),
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null
        }
      );
      if (requestedItems) {
        await createUserNotification(connection, {
          userId: order.user_id,
          type: 'refund_requested',
          title: 'Partial refund under review',
          body: order.payment_mode === 'direct'
            ? `Your RM ${refundItems.reduce((sum, item) => sum + item.amountRm, 0).toFixed(2)} item refund is awaiting payment-provider confirmation.`
            : `Your ${refundItems.reduce((sum, item) => sum + item.tokenAmount, 0)} token item refund is awaiting approval.`
        });
      }
      await connection.commit();
      committed = true;
      if (requestedItems) {
        queueCustomerPush(
          request,
          order.user_id,
          'Partial refund under review',
          order.payment_mode === 'direct'
            ? 'Your item refund request is awaiting payment-provider confirmation.'
            : 'Your item refund request is awaiting approval.',
          'refund_requested'
        );
      }
      return reply.code(201).send({ refund_ref: refundRef, status: 'pending' });
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/orders', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireOrderAccess(request);
    const { limit, store_id: storeId, view } = adminListQuerySchema.parse(request.query);

    const connection = await mysqlPool.getConnection();
    try {
      const tiers = await loadLoyaltyTiers(connection);
      // 1. Fetch Orders
      const [orderRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          o.id as internal_id,
          o.order_ref as id,
          COALESCE(o.is_guest, 0) as is_guest,
          up.display_name as customer,
          up.email,
          u.phone_e164 as phone,
          u.id as user_id,
          COALESCE(ctm.is_employee, 0) as isEmployee,
          COALESCE(ctm.subsidy_role, 'none') as subsidyRole,
          up.avatar_type as avatar_type,
          up.avatar_value as avatar,
          o.discount_total_rm as discount,
          o.voucher_discount_tokens as voucherDiscountTokens,
          o.voucher_reward_summary as voucherRewardSummary,
          COALESCE(o.voucher_name_snapshot, vt.name) as voucherName,
          COALESCE(o.voucher_type_snapshot, vt.voucher_type) as voucherType,
          COALESCE(o.voucher_code_snapshot, vt.code) as voucherCode,
          COALESCE(o.voucher_discount_mode_snapshot, vt.discount_mode) as voucherDiscountMode,
          vt.eligible_scope_json as voucherEligibleScope,
          o.final_total_rm as total,
          o.token_amount_charged as tokenAmountCharged,
          o.gift_card_token_amount as giftCardTokenAmount,
          o.employee_allowance_tokens_used as subsidyTokenAmount,
          opc.original_token_amount as originalTokenAmount,
          opc.correction_token_amount as priceCorrectionAmount,
          opc.subsidy_token_amount as priceCorrectionSubsidyAmount,
          opc.personal_token_amount as priceCorrectionPersonalAmount,
          opc.created_at as priceCorrectedAt,
          o.payment_mode as paymentMode,
          COALESCE(o.order_channel, 'mobile') as orderChannel,
          COALESCE(o.fulfillment_type, 'pickup') as fulfillmentType,
          o.status as status,
          CASE WHEN COALESCE(o.is_guest, 0) = 1 THEN NULL ELSE (
            SELECT lts.tier_code
            FROM loyalty_tier_snapshots lts
            WHERE lts.user_id = u.id
            ORDER BY lts.effective_at DESC, lts.id DESC
            LIMIT 1
          ) END AS tier_code,
          p.provider as paymentProvider,
          p.payment_method as paymentMethod,
          p.status as paymentStatus,
          p.provider_payment_ref as txnId,
          p.expires_at as paymentExpiresAt,
          p.status = 'cancelled' AND EXISTS (
            SELECT 1
            FROM payment_events recovery_event
            WHERE recovery_event.payment_id = p.id
              AND recovery_event.event_type = 'chip_customer_recovery_detach'
              AND recovery_event.process_result = 'detached_pending_provider_review'
              AND recovery_event.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
          ) AS paymentRecoveryReviewRequired,
          ocr.status as cancellationRequestStatus,
          ocr.reason as cancellationRequestReason,
          ocr.requested_at as cancellationRequestedAt,
          NULL as baristaName,
          o.ready_at,
          (
            SELECT MAX(osh.created_at)
            FROM order_status_history osh
            WHERE osh.order_id = o.id AND osh.to_status = 'preparing'
          ) AS preparing_at,
          o.created_at,
          s.id as storeId,
          s.name as storeName,
          s.timezone as storeTimezone
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN user_profiles up ON u.id = up.user_id
        JOIN stores s ON s.id = o.store_id
        JOIN admin_tenants t ON t.id = s.tenant_id
        LEFT JOIN customer_tenant_memberships ctm ON ctm.user_id = u.id AND ctm.tenant_id = t.id
        LEFT JOIN payments p ON o.id = p.order_id
        LEFT JOIN user_vouchers uv ON uv.id = o.voucher_id
        LEFT JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
        LEFT JOIN order_cancellation_requests ocr ON ocr.order_id = o.id
        LEFT JOIN order_price_corrections opc ON opc.order_id = o.id
        WHERE t.code = :tenantCode
          AND (:storeId IS NULL OR s.id = :storeId)
          AND (
            (:view = 'all' AND :isBaristaOnly = 0)
            OR (
              o.status IN ('pending_payment', 'paid', 'accepted', 'preparing', 'ready_for_pickup', 'collected')
              AND (
                o.payment_mode = 'token'
                OR (
                  o.status = 'pending_payment'
                  AND EXISTS (
                    SELECT 1
                    FROM payments manual_gate
                    WHERE manual_gate.order_id = o.id
                      AND manual_gate.status = 'pending'
                      AND manual_gate.payment_method LIKE 'manual%'
                  )
                )
                OR EXISTS (
                  SELECT 1
                  FROM payments payment_gate
                  WHERE payment_gate.order_id = o.id
                    AND payment_gate.status IN ('paid', 'partially_refunded')
                )
                OR COALESCE(o.final_total_rm, 0) = 0
              )
              AND DATE(DATE_ADD(o.created_at, INTERVAL 8 HOUR)) =
                  DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))
            )
          )
          AND (
            :isBaristaOnly = 0
            OR EXISTS (
              SELECT 1
              FROM admin_user_store_assignments aus
              WHERE aus.admin_user_id = :adminUserId AND aus.store_id = o.store_id
            )
          )
        ORDER BY o.created_at DESC
        LIMIT :limit
      `, {
        tenantCode: request.adminAuth.tenantCode,
        storeId: storeId ?? null,
        adminUserId: request.adminAuth.adminUserId,
        isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0,
        view,
        limit
      });

      if (orderRows.length === 0) {
        return reply.send({ orders: [] });
      }

      // 2. Fetch Order Items for these orders
      const orderIds = orderRows.map(o => o.internal_id);
      const [itemRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          oi.order_id,
          oi.id as order_item_id,
          oi.menu_item_id,
          oi.line_type,
          oi.item_name_snapshot as name,
          oi.quantity as qty,
          oi.base_price_rm_snapshot as unitPrice,
          oi.line_subtotal_rm as lineSubtotalRm,
          oi.line_token_amount as lineTokenAmount,
          mi.code as menuItemCode,
          mi.is_handcrafted_drink as isHandcraftedDrink,
          mi.is_qualifying_cup as isQualifyingCup,
          category.id as categoryId,
          category.code as categoryCode,
          category.name as categoryName,
          category.product_kind_code as productKindCode,
          subcategory.code as subcategoryCode,
          subcategory.name as subcategoryName,
          mi.image_url as img,
          promotion.campaign_name_snapshot AS campaign_name,
          promotion.assignment_mode_snapshot AS assignment_mode,
          promotion.fulfilment_status AS promotional_fulfilment_status
        FROM order_items oi
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        LEFT JOIN menu_categories category ON category.id = mi.category_id
        LEFT JOIN menu_subcategories subcategory ON subcategory.id = mi.subcategory_id
        LEFT JOIN order_promotional_addons promotion ON promotion.order_item_id = oi.id
        WHERE oi.order_id IN (?)
      `, [orderIds]);

      const itemIds = itemRows.map(i => i.order_item_id);
      let modifiersByItemId: Record<number, any[]> = {};

      if (itemIds.length > 0) {
        const [modifierRows] = await connection.query<RowDataPacket[]>(`
          SELECT 
            order_item_id,
            modifier_group_name_snapshot as group_name,
            modifier_option_name_snapshot as option_name,
            price_delta_rm_snapshot as price_delta_rm,
            token_price_delta_snapshot as token_price_delta
          FROM order_item_modifiers
          WHERE order_item_id IN (?)
        `, [itemIds]);

        for (const mod of modifierRows) {
          if (!modifiersByItemId[mod.order_item_id]) {
            modifiersByItemId[mod.order_item_id] = [];
          }
          modifiersByItemId[mod.order_item_id].push({
            group: mod.group_name,
            option: mod.option_name,
            priceDeltaRm: Number(mod.price_delta_rm || 0),
            tokenDelta: Number(mod.token_price_delta || 0)
          });
        }
      }

      const rawItemsByOrderId: Record<number, any[]> = {};
      for (const item of itemRows) {
        (rawItemsByOrderId[item.order_id] ??= []).push(item);
      }

      const inferVoucherRewardSummary = (order: any): string | null => {
        if (order.voucherDiscountMode !== 'free_drink') return null;
        const rawItems = (rawItemsByOrderId[order.internal_id] || [])
          .filter((item) => (item.line_type || 'sale') === 'sale');
        if (rawItems.length === 0) return null;

        const normalized = rawItems.map((item) => {
          const quantity = Math.max(1, Number(item.qty || 1));
          const modifiers = modifiersByItemId[item.order_item_id] || [];
          const modifierRm = modifiers.reduce((sum, modifier) => sum + Number(modifier.priceDeltaRm || 0), 0);
          const modifierTokens = modifiers.reduce((sum, modifier) => sum + Number(modifier.tokenDelta || 0), 0);
          return {
            payload: { menu_item_id: Number(item.menu_item_id), quantity, remarks: null, modifiers: [] },
            menuItem: {
              id: Number(item.menu_item_id),
              category_id: Number(item.categoryId || 0),
              code: item.menuItemCode || '',
              name: item.name || 'Item',
              base_price_rm: String(item.unitPrice || 0),
              base_price_token: Math.max(0, Math.round(Number(item.lineTokenAmount || 0) / quantity) - modifierTokens),
              base_calories_kcal: 0,
              is_available: 1,
              is_handcrafted_drink: Number(item.isHandcraftedDrink || 0),
              is_qualifying_cup: Number(item.isQualifyingCup || 0),
              category_code: item.categoryCode || '',
              category_name: item.categoryName || '',
              category_product_kind_code: item.productKindCode || '',
              subcategory_code: item.subcategoryCode || null,
              subcategory_name: item.subcategoryName || null,
            },
            basePriceRm: Math.max(0, Number(item.lineSubtotalRm || 0) / quantity - modifierRm),
            tokenPrice: Math.max(0, Math.round(Number(item.lineTokenAmount || 0) / quantity) - modifierTokens),
            modifierRm,
            modifierTokens,
          };
        });
        const rule = parsePromotionRule(parseVoucherScope(order.voucherEligibleScope));
        const rewardable = collectMatchedUnits(rule.reward_scope, normalized as any[])
          .slice()
          .sort((a, b) =>
            (b.basePriceRm + b.modifierRm) - (a.basePriceRm + a.modifierRm) ||
            Math.max(0, b.tokenPrice + b.modifierTokens) - Math.max(0, a.tokenPrice + a.modifierTokens)
          )
          .slice(0, rule.reward_quantity);
        const counts = new Map<string, number>();
        for (const unit of rewardable) {
          counts.set(unit.menuItem.name, (counts.get(unit.menuItem.name) ?? 0) + 1);
        }
        return Array.from(counts.entries())
          .map(([name, quantity]) => `${quantity}x ${name}`)
          .join(', ') || null;
      };

      // Group items by order_id
      const itemsByOrderId: Record<number, any[]> = {};
      for (const item of itemRows) {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        
        // Map modifiers to specific fields for easy frontend rendering
        let bean, espressoShot, temperature, sparkling, milk, sweetness, iceLevel, orderType, remarks;
        const mods = modifiersByItemId[item.order_item_id] || [];
        
        for (const m of mods) {
          const g = m.group.toLowerCase();
          if (g.includes('bean') || g.includes('blend')) bean = m.option;
          else if (g.includes('shot') || g.includes('espresso')) espressoShot = m.option;
          else if (g.includes('temp')) temperature = m.option;
          else if (g.includes('sparkling')) sparkling = m.option;
          else if (g.includes('milk')) milk = m.option;
          else if (g.includes('sweet')) sweetness = m.option;
          else if (g.includes('ice')) iceLevel = m.option;
          else if (g.includes('order type') || g === 'order') orderType = m.option;
          else if ((g.includes('remark') || g.includes('note')) && !remarks) remarks = m.option;
        }

        itemsByOrderId[item.order_id].push({
          orderItemId: Number(item.order_item_id),
          menuItemId: item.menu_item_id == null ? null : Number(item.menu_item_id),
          line_type: item.line_type || 'sale',
          campaign_name: item.campaign_name || null,
          assignment_mode: item.assignment_mode || null,
          promotional_fulfilment_status: item.promotional_fulfilment_status || null,
          name: item.name,
          qty: item.qty,
          unitPrice: Number(item.unitPrice || 0),
          img: item.img || '/BOIJITO.png',
          modifiers: mods,
          bean,
          espressoShot,
          temperature,
          sparkling,
          milk,
          sweetness,
          iceLevel,
          orderType,
          remarks
        });
      }

      const formattedOrders = orderRows.map(o => {
        const d = new Date(o.created_at);
        const rawItems = rawItemsByOrderId[o.internal_id] || [];
        const lineTokenTotal = rawItems.reduce(
          (sum, item) => sum + Number(item.lineTokenAmount || 0),
          0
        );
        const inferredVoucherDiscountTokens = Math.max(
          0,
          lineTokenTotal - Number(
            o.originalTokenAmount == null
              ? o.tokenAmountCharged || 0
              : o.originalTokenAmount
          ) - Number(o.giftCardTokenAmount || 0)
        );
        const inferredVoucherRewardSummary = o.voucherRewardSummary
          ? null
          : inferVoucherRewardSummary(o);
        const isGuest = Number(o.is_guest || 0) === 1;
        return {
          id: o.id,
          customer: o.customer || 'Unknown',
          email: o.email || '',
          phone: o.phone || '',
          isGuest,
          tier: isGuest ? null : formatTierName(tiers, o.tier_code),
          tierCode: isGuest || !o.tier_code ? null : String(o.tier_code).trim().toLowerCase(),
          memberId: isGuest ? null : 'C2-' + String(o.user_id).padStart(3, '0'),
          avatarType: o.avatar_type || 'preset',
          avatar: o.avatar || null,
          items: itemsByOrderId[o.internal_id] || [],
          discount: Number(o.discount || 0),
          voucherDiscountTokens: Math.max(
            Number(o.voucherDiscountTokens || 0),
            inferredVoucherDiscountTokens
          ),
          voucherRewardSummary: o.voucherRewardSummary || inferredVoucherRewardSummary,
          voucherRewardSummaryInferred: Boolean(inferredVoucherRewardSummary),
          voucherName: o.voucherName || null,
          voucherType: o.voucherType || null,
          voucherCode: o.voucherCode || null,
          total: Number(o.total || 0),
          tokenAmountCharged: Number(o.tokenAmountCharged || 0),
          subsidyTokenAmount: Math.min(Number(o.tokenAmountCharged || 0), Number(o.subsidyTokenAmount || 0)),
          originalTokenAmount: o.originalTokenAmount == null ? null : Number(o.originalTokenAmount),
          priceCorrectionAmount: Number(o.priceCorrectionAmount || 0),
          priceCorrectionSubsidyAmount: Number(o.priceCorrectionSubsidyAmount || 0),
          priceCorrectionPersonalAmount: Number(o.priceCorrectionPersonalAmount || 0),
          priceCorrectedAt: o.priceCorrectedAt ? new Date(o.priceCorrectedAt).toISOString() : null,
          paymentMode: o.paymentMode || '',
          orderChannel: o.orderChannel || 'mobile',
          fulfillmentType: o.fulfillmentType || 'pickup',
          isEmployee: Number(o.isEmployee || 0) === 1,
          subsidyRole: o.subsidyRole || 'none',
          status: capitalizeWords(o.status),
          payment: o.paymentMode || '',
          paymentMethod: o.paymentMethod || '',
          paymentStatus: capitalizeWords(o.paymentStatus || ''),
          cancellationRequestStatus: o.cancellationRequestStatus || null,
          cancellationRequestReason: o.cancellationRequestReason || null,
          cancellationRequestedAt: o.cancellationRequestedAt ? new Date(o.cancellationRequestedAt).toISOString() : null,
          txnId: o.txnId || `TXN${o.internal_id}`,
          paymentExpiresAt: o.paymentExpiresAt ? new Date(o.paymentExpiresAt).toISOString() : null,
          paymentReviewRequired: o.status === 'pending_payment' &&
            o.paymentMode === 'direct' &&
            ['pending', 'authorized'].includes(String(o.paymentStatus || '').toLowerCase()) &&
            o.paymentExpiresAt != null &&
            new Date(o.paymentExpiresAt).getTime() <= Date.now(),
          paymentRecoveryReviewRequired: Number(o.paymentRecoveryReviewRequired || 0) === 1,
          baristaName: o.baristaName || '',
          baristaUsername: '',
          createdAt: d.toISOString(),
          statusStartedAt: o.preparing_at ? new Date(o.preparing_at).toISOString() : null,
          readyAt: o.ready_at ? new Date(o.ready_at).toISOString() : null,
          time: formatDisplayTime(d, String(o.storeTimezone || 'Asia/Kuala_Lumpur')),
          date: formatDisplayDate(d, String(o.storeTimezone || 'Asia/Kuala_Lumpur'))
          ,storeId: Number(o.storeId)
          ,storeName: o.storeName
        };
      });

      return reply.send({ orders: formattedOrders });
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/finance/overview', { preHandler: authenticateAdminRequest }, async (request) => {
    requireFinanceAccess(request);

    const tenantCode = request.adminAuth.tenantCode;
    const { store_id: storeId, month } = financeQuerySchema.parse(request.query);
    const queryParams = { tenantCode, storeId: storeId ?? null, month: month ?? null };
    const monthFilter = (col: string) => `(:month IS NULL OR DATE_FORMAT(CONVERT_TZ(${col}, '+00:00', '+08:00'), '%Y-%m') = :month)`;
    const revenueStatusClause = "o.status NOT IN ('draft', 'pending_payment', 'payment_failed', 'cancelled')";
    const completedRefundStatusClause = "r.status NOT IN ('pending', 'failed', 'cancelled', 'rejected', 'under_review', 'reviewing')";
    const connection = await mysqlPool.getConnection();

    try {
      const [orderSummaryRows] = await connection.query<Array<RowDataPacket & {
        total_orders: number;
        qualifying_orders: number;
        active_orders: number;
        completed_orders: number;
        total_revenue_rm: string | number;
        total_tokens_charged: string | number;
        direct_orders: number;
        direct_payment_order_value_rm: string | number;
        token_orders: number;
        personal_token_orders: number;
        personal_tokens_used: string | number;
        personal_token_order_value_rm: string | number;
        allowance_orders: number;
        allowance_tokens_used: string | number;
        allowance_order_value_rm: string | number;
      }>>(
        `SELECT
           COUNT(*) AS total_orders,
           COALESCE(SUM(${revenueStatusClause}), 0) AS qualifying_orders,
           COALESCE(SUM(o.status IN ('paid', 'accepted', 'preparing', 'ready_for_pickup')), 0) AS active_orders,
           COALESCE(SUM(o.status = 'collected'), 0) AS completed_orders,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.final_total_rm ELSE 0 END), 0) AS total_revenue_rm,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.token_amount_charged ELSE 0 END), 0) AS total_tokens_charged,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} AND o.payment_mode = 'direct' THEN 1 ELSE 0 END), 0) AS direct_orders,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} AND o.payment_mode = 'direct' THEN o.final_total_rm ELSE 0 END), 0) AS direct_payment_order_value_rm,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} AND o.payment_mode = 'token' THEN 1 ELSE 0 END), 0) AS token_orders,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} AND o.payment_mode = 'token' AND o.token_amount_charged > LEAST(o.token_amount_charged, o.employee_allowance_tokens_used) THEN 1 ELSE 0 END), 0) AS personal_token_orders,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} AND o.payment_mode = 'token' THEN GREATEST(0, o.token_amount_charged - LEAST(o.token_amount_charged, o.employee_allowance_tokens_used)) ELSE 0 END), 0) AS personal_tokens_used,
           COALESCE(SUM(CASE
             WHEN ${revenueStatusClause} AND o.payment_mode = 'token' AND o.token_amount_charged > 0
               THEN o.final_total_rm * (GREATEST(0, o.token_amount_charged - LEAST(o.token_amount_charged, o.employee_allowance_tokens_used)) / o.token_amount_charged)
             ELSE 0
           END), 0) AS personal_token_order_value_rm,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} AND o.employee_allowance_tokens_used > 0 THEN 1 ELSE 0 END), 0) AS allowance_orders,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN LEAST(o.token_amount_charged, o.employee_allowance_tokens_used) ELSE 0 END), 0) AS allowance_tokens_used,
           COALESCE(SUM(CASE
             WHEN ${revenueStatusClause} AND o.token_amount_charged > 0
               THEN o.final_total_rm * (LEAST(o.token_amount_charged, o.employee_allowance_tokens_used) / o.token_amount_charged)
             ELSE 0
           END), 0) AS allowance_order_value_rm
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
           AND (:storeId IS NULL OR s.id = :storeId)
           AND ${monthFilter('o.created_at')}`,
        queryParams
      );
      const [refundSummaryRows] = await connection.query<Array<RowDataPacket & {
        refunded_orders: number;
        total_refund_rm: string | number;
        total_refund_tokens: string | number;
      }>>(
        `SELECT
           COALESCE(SUM(${completedRefundStatusClause}), 0) AS refunded_orders,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_amount_rm ELSE 0 END), 0) AS total_refund_rm,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_token_amount ELSE 0 END), 0) AS total_refund_tokens
         FROM refunds r
         JOIN orders o ON o.id = r.order_id
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
           AND (:storeId IS NULL OR s.id = :storeId)
           AND ${monthFilter('r.created_at')}`,
        queryParams
      );
      const [monthlyOrderRows] = await connection.query<Array<RowDataPacket & {
        month_key: string;
        revenue_rm: string | number;
        tokens_charged: string | number;
        orders: number;
      }>>(
        `SELECT
           DATE_FORMAT(CONVERT_TZ(o.created_at, '+00:00', '+08:00'), '%Y-%m') AS month_key,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.final_total_rm ELSE 0 END), 0) AS revenue_rm,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.token_amount_charged ELSE 0 END), 0) AS tokens_charged,
           COALESCE(SUM(${revenueStatusClause}), 0) AS orders
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
           AND (:storeId IS NULL OR s.id = :storeId)
         GROUP BY month_key`,
        queryParams
      );
      const [monthlyRefundRows] = await connection.query<Array<RowDataPacket & {
        month_key: string;
        refund_rm: string | number;
        refund_tokens: string | number;
      }>>(
        `SELECT
           DATE_FORMAT(CONVERT_TZ(r.created_at, '+00:00', '+08:00'), '%Y-%m') AS month_key,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_amount_rm ELSE 0 END), 0) AS refund_rm,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_token_amount ELSE 0 END), 0) AS refund_tokens
         FROM refunds r
         JOIN orders o ON o.id = r.order_id
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
           AND (:storeId IS NULL OR s.id = :storeId)
         GROUP BY month_key`,
        queryParams
      );
      const [dailyOrderRows] = await connection.query<Array<RowDataPacket & {
        day_key: string;
        revenue_rm: string | number;
        direct_revenue_rm: string | number;
        tokens_charged: string | number;
        orders: number;
      }>>(
        `SELECT
           DATE_FORMAT(CONVERT_TZ(o.created_at, '+00:00', '+08:00'), '%Y-%m-%d') AS day_key,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.final_total_rm ELSE 0 END), 0) AS revenue_rm,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} AND o.payment_mode = 'direct' THEN o.final_total_rm ELSE 0 END), 0) AS direct_revenue_rm,
           COALESCE(SUM(CASE WHEN ${revenueStatusClause} THEN o.token_amount_charged ELSE 0 END), 0) AS tokens_charged,
           COALESCE(SUM(${revenueStatusClause}), 0) AS orders
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
           AND (:storeId IS NULL OR s.id = :storeId)
           AND (
             (:month IS NOT NULL AND DATE_FORMAT(CONVERT_TZ(o.created_at, '+00:00', '+08:00'), '%Y-%m') = :month)
             OR (:month IS NULL AND DATE(CONVERT_TZ(o.created_at, '+00:00', '+08:00')) >= DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')) - INTERVAL 13 DAY)
           )
         GROUP BY day_key
         ORDER BY day_key ASC`,
        queryParams
      );
      const [dailyRefundRows] = await connection.query<Array<RowDataPacket & {
        day_key: string;
        refund_rm: string | number;
        refund_tokens: string | number;
      }>>(
        `SELECT
           DATE_FORMAT(CONVERT_TZ(r.created_at, '+00:00', '+08:00'), '%Y-%m-%d') AS day_key,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_amount_rm ELSE 0 END), 0) AS refund_rm,
           COALESCE(SUM(CASE WHEN ${completedRefundStatusClause} THEN r.refund_token_amount ELSE 0 END), 0) AS refund_tokens
         FROM refunds r
         JOIN orders o ON o.id = r.order_id
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
           AND (:storeId IS NULL OR s.id = :storeId)
           AND (
             (:month IS NOT NULL AND DATE_FORMAT(CONVERT_TZ(r.created_at, '+00:00', '+08:00'), '%Y-%m') = :month)
             OR (:month IS NULL AND DATE(CONVERT_TZ(r.created_at, '+00:00', '+08:00')) >= DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')) - INTERVAL 13 DAY)
           )
         GROUP BY day_key
         ORDER BY day_key ASC`,
        queryParams
      );
      const [statusRows] = await connection.query<Array<RowDataPacket & {
        status: string;
        value: number;
        amount_rm: string | number;
      }>>(
        `SELECT o.status, COUNT(*) AS value, COALESCE(SUM(o.final_total_rm), 0) AS amount_rm
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE t.code = :tenantCode
           AND (:storeId IS NULL OR s.id = :storeId)
           AND ${monthFilter('o.created_at')}
         GROUP BY o.status
         ORDER BY value DESC, o.status ASC`,
        queryParams
      );
      const [topUpMethodRows] = await connection.query<Array<RowDataPacket & {
        payment_method: string | null;
        topup_count: number;
        amount_rm: string | number;
        token_amount: string | number;
      }>>(
        `SELECT
           NULLIF(p.payment_method, '') AS payment_method,
           COUNT(*) AS topup_count,
           COALESCE(SUM(p.amount_rm), 0) AS amount_rm,
           COALESCE(SUM(tt.token_amount), 0) AS token_amount
         FROM payments p
         JOIN token_topups tt ON tt.id = p.topup_id
         JOIN customer_tenant_memberships ctm ON ctm.user_id = tt.user_id
         JOIN admin_tenants t ON t.id = ctm.tenant_id
         WHERE t.code = :tenantCode
           AND p.status = 'paid'
           AND tt.status = 'paid'
           AND ${monthFilter('p.created_at')}
         GROUP BY NULLIF(p.payment_method, '')
         ORDER BY topup_count DESC, amount_rm DESC, payment_method ASC`,
        { tenantCode, month: month ?? null }
      );
      const [tokenMovementRows] = await connection.query<Array<RowDataPacket & {
        source_type: string;
        direction: 'credit' | 'debit';
        movement_count: number;
        token_amount: string | number;
      }>>(
        `SELECT tl.source_type, tl.direction, COUNT(*) AS movement_count,
                COALESCE(SUM(tl.amount), 0) AS token_amount
           FROM token_ledger tl
           JOIN customer_tenant_memberships ctm ON ctm.user_id = tl.user_id
           JOIN admin_tenants t ON t.id = ctm.tenant_id
          WHERE t.code = :tenantCode
            AND ${monthFilter('tl.created_at')}
          GROUP BY tl.source_type, tl.direction
          ORDER BY tl.source_type ASC, tl.direction ASC`,
        { tenantCode, month: month ?? null }
      );
      const [allowanceBalanceRows] = await connection.query<Array<RowDataPacket & { remaining: string | number }>>(
        `SELECT COALESCE(SUM(a.remaining_amount), 0) AS remaining
           FROM employee_token_allowances a
           JOIN admin_tenants t ON t.id = a.tenant_id
          WHERE t.code = :tenantCode AND a.status = 'active'`,
        { tenantCode }
      );
      const [paymentMethodRows] = await connection.query<Array<RowDataPacket & {
        payment_method: string | null;
        payment_mode: string | null;
        payment_count: number;
        amount_rm: string | number;
      }>>(
        `SELECT NULLIF(p.payment_method, '') AS payment_method,
                o.payment_mode,
                COUNT(*) AS payment_count,
                COALESCE(SUM(p.amount_rm), 0) AS amount_rm
           FROM payments p
           JOIN orders o ON o.id = p.order_id
           JOIN stores s ON s.id = o.store_id
           JOIN admin_tenants t ON t.id = s.tenant_id
          WHERE t.code = :tenantCode
            AND (:storeId IS NULL OR s.id = :storeId)
            AND p.status = 'paid'
            AND ${monthFilter('p.created_at')}
          GROUP BY NULLIF(p.payment_method, ''), o.payment_mode
          ORDER BY payment_count DESC, amount_rm DESC`,
        queryParams
      );
      const [transactionRows] = await connection.query<Array<RowDataPacket & {
        id: string;
        created_at: Date;
        type: 'Order' | 'Refund';
        description: string;
        amount_rm: string | number;
        amount_tokens: string | number;
        status: string;
        payment_status: string;
        payment_mode: string | null;
        reference_id: string;
        store_name: string;
      }>>(
        `SELECT * FROM (
           SELECT
             CONCAT('ORDER-', o.order_ref) AS id,
             o.created_at,
             'Order' AS type,
             CONCAT('Order ', o.order_ref, CASE WHEN up.display_name IS NULL OR up.display_name = '' THEN '' ELSE CONCAT(' · ', up.display_name) END) AS description,
             o.final_total_rm AS amount_rm,
             o.token_amount_charged AS amount_tokens,
             o.status,
             COALESCE(p.status, '') AS payment_status,
             o.payment_mode,
             COALESCE(p.provider_payment_ref, o.order_ref) AS reference_id,
             s.name AS store_name
           FROM orders o
           JOIN users u ON u.id = o.user_id
           JOIN user_profiles up ON up.user_id = u.id
           JOIN stores s ON s.id = o.store_id
           JOIN admin_tenants t ON t.id = s.tenant_id
           LEFT JOIN payments p ON p.order_id = o.id
           WHERE t.code = :tenantCode
             AND (:storeId IS NULL OR s.id = :storeId)
             AND ${monthFilter('o.created_at')}
           UNION ALL
           SELECT
             CONCAT('REFUND-', r.refund_ref) AS id,
             r.created_at,
             'Refund' AS type,
             CONCAT('Refund ', o.order_ref, CASE WHEN r.reason IS NULL OR r.reason = '' THEN '' ELSE CONCAT(' · ', r.reason) END) AS description,
             -r.refund_amount_rm AS amount_rm,
             -r.refund_token_amount AS amount_tokens,
             r.status,
             r.status AS payment_status,
             r.payment_mode,
             r.refund_ref AS reference_id,
             s.name AS store_name
           FROM refunds r
           JOIN orders o ON o.id = r.order_id
           JOIN stores s ON s.id = o.store_id
           JOIN admin_tenants t ON t.id = s.tenant_id
           WHERE t.code = :tenantCode
             AND (:storeId IS NULL OR s.id = :storeId)
             AND ${monthFilter('r.created_at')}
         ) AS transactions
         ORDER BY created_at DESC
         LIMIT 50`,
        queryParams
      );

      const monthMap = new Map<string, {
        month: string;
        revenueRm: number;
        refundRm: number;
        tokensCharged: number;
        refundTokens: number;
        orders: number;
      }>();
      const dayMap = new Map<string, {
        date: string;
        revenueRm: number;
        refundRm: number;
        directRevenueRm: number;
        tokensCharged: number;
        refundTokens: number;
        orders: number;
      }>();
      const monthLabel = (monthKey: string) => new Intl.DateTimeFormat('en-US', {
        month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur'
      }).format(new Date(`${monthKey}-01T00:00:00+08:00`));
      for (const row of monthlyOrderRows) {
        monthMap.set(row.month_key, {
          month: monthLabel(row.month_key),
          revenueRm: Number(row.revenue_rm || 0),
          refundRm: 0,
          tokensCharged: Number(row.tokens_charged || 0),
          refundTokens: 0,
          orders: Number(row.orders || 0)
        });
      }
      for (const row of monthlyRefundRows) {
        const current = monthMap.get(row.month_key) ?? {
          month: monthLabel(row.month_key), revenueRm: 0, refundRm: 0, tokensCharged: 0, refundTokens: 0, orders: 0
        };
        current.refundRm += Number(row.refund_rm || 0);
        current.refundTokens += Number(row.refund_tokens || 0);
        monthMap.set(row.month_key, current);
      }
      const dayLabel = (dayKey: string) => new Intl.DateTimeFormat('en-MY', {
        day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur'
      }).format(new Date(`${dayKey}T00:00:00+08:00`));
      for (const row of dailyOrderRows) {
        dayMap.set(row.day_key, {
          date: dayLabel(row.day_key),
          revenueRm: Number(row.revenue_rm || 0),
          refundRm: 0,
          directRevenueRm: Number(row.direct_revenue_rm || 0),
          tokensCharged: Number(row.tokens_charged || 0),
          refundTokens: 0,
          orders: Number(row.orders || 0)
        });
      }
      for (const row of dailyRefundRows) {
        const current = dayMap.get(row.day_key) ?? {
          date: dayLabel(row.day_key), revenueRm: 0, refundRm: 0, directRevenueRm: 0,
          tokensCharged: 0, refundTokens: 0, orders: 0
        };
        current.refundRm += Number(row.refund_rm || 0);
        current.refundTokens += Number(row.refund_tokens || 0);
        dayMap.set(row.day_key, current);
      }

      const orders = orderSummaryRows[0] ?? {
        total_orders: 0,
        qualifying_orders: 0,
        active_orders: 0,
        completed_orders: 0,
        total_revenue_rm: 0,
        total_tokens_charged: 0,
        direct_orders: 0,
        direct_payment_order_value_rm: 0,
        token_orders: 0,
        personal_token_orders: 0,
        personal_tokens_used: 0,
        personal_token_order_value_rm: 0,
        allowance_orders: 0,
        allowance_tokens_used: 0,
        allowance_order_value_rm: 0
      };
      const refunds = refundSummaryRows[0] ?? {
        refunded_orders: 0, total_refund_rm: 0, total_refund_tokens: 0
      };
      const totalRevenueRm = Number(orders.total_revenue_rm || 0);
      const totalTokensCharged = Number(orders.total_tokens_charged || 0);
      const totalRefundAmountRm = Number(refunds.total_refund_rm || 0);
      const totalRefundTokens = Number(refunds.total_refund_tokens || 0);
      const directPaymentOrderValueRm = Number(orders.direct_payment_order_value_rm || 0);
      const directOrders = Number(orders.direct_orders || 0);
      const tokenOrders = Number(orders.token_orders || 0);
      const personalTokenOrders = Number(orders.personal_token_orders || 0);
      const personalTokensUsed = Number(orders.personal_tokens_used || 0);
      const personalTokenOrderValueRm = Number(orders.personal_token_order_value_rm || 0);
      const allowanceOrders = Number(orders.allowance_orders || 0);
      const allowanceTokensUsed = Number(orders.allowance_tokens_used || 0);
      const allowanceOrderValueRm = Number(orders.allowance_order_value_rm || 0);
      const qualifyingOrders = Number(orders.qualifying_orders || 0);
      const salesExcludingAllowanceRm = directPaymentOrderValueRm + personalTokenOrderValueRm;
      const subsidyMovement = tokenMovementRows
        .filter((row) => ['employee_allowance_issue', 'employee_allowance_spend', 'employee_allowance_expiry', 'employee_allowance_role_revoke'].includes(row.source_type))
        .reduce((acc, row) => {
          const amount = Number(row.token_amount || 0);
          if (row.direction === 'credit') acc.issued += amount;
          else acc.consumed += amount;
          acc.movements += Number(row.movement_count || 0);
          return acc;
        }, { issued: 0, consumed: 0, movements: 0 });

      return {
        selectedStoreId: storeId ?? null,
        selectedMonth: month ?? null,
        availableMonths: Array.from(monthMap.keys()).sort((left, right) => right.localeCompare(left)),
        topUpScope: 'tenant',
        summary: {
          totalRevenueRm,
          directPaymentOrderValueRm,
          directOrders,
          tokenOrders,
          tokenOrderValueRm: Math.max(0, totalRevenueRm - directPaymentOrderValueRm),
          personalTokenOrders,
          personalTokensUsed,
          personalTokenOrderValueRm,
          allowanceOrders,
          allowanceTokensUsed,
          allowanceOrderValueRm,
          salesExcludingAllowanceRm,
          totalTokensCharged,
          totalRefundAmountRm,
          totalRefundTokens,
          netTokens: totalTokensCharged - totalRefundTokens,
          netRevenueRm: totalRevenueRm - totalRefundAmountRm,
          totalOrders: Number(orders.total_orders || 0),
          qualifyingOrders,
          activeOrders: Number(orders.active_orders || 0),
          completedOrders: Number(orders.completed_orders || 0),
          refundedOrders: Number(refunds.refunded_orders || 0),
          averageOrderValueRm: qualifyingOrders > 0 ? totalRevenueRm / qualifyingOrders : 0,
          accountingNote: 'RM order value is not cash revenue for token-funded orders.'
        },
        monthlyRevenue: Array.from(monthMap.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([, entry]) => ({
            month: entry.month,
            revenueRm: entry.revenueRm,
            refundRm: entry.refundRm,
            netRm: entry.revenueRm - entry.refundRm,
            tokensCharged: entry.tokensCharged,
            refundTokens: entry.refundTokens,
            netTokens: entry.tokensCharged - entry.refundTokens,
            orders: entry.orders
          })),
        dailySales: Array.from(dayMap.entries()).map(([dayKey, entry]) => ({
          date: entry.date,
          dayKey,
          grossRevenueRm: entry.revenueRm,
          refundRm: entry.refundRm,
          netRevenueRm: entry.revenueRm - entry.refundRm,
          directRevenueRm: entry.directRevenueRm,
          tokenValueRm: Math.max(0, entry.revenueRm - entry.directRevenueRm),
          tokensCharged: entry.tokensCharged,
          refundTokens: entry.refundTokens,
          netTokens: entry.tokensCharged - entry.refundTokens,
          orders: entry.orders
        })),
        statusBreakdown: statusRows.map((row, index) => ({
          name: capitalizeWords(row.status || 'other'),
          value: Number(row.value || 0),
          amountRm: Number(row.amount_rm || 0),
          color: ['#1F3A34', '#2E5E58', '#6F9F96', '#8AACA5', '#E07A5F', '#D4AF7A'][index % 6]
        })),
        topUpMethodBreakdown: topUpMethodRows.map((row) => ({
          method: row.payment_method || 'not_recorded',
          count: Number(row.topup_count || 0),
          amountRm: Number(row.amount_rm || 0),
          tokenAmount: Number(row.token_amount || 0)
        })),
        paymentMethodBreakdown: paymentMethodRows.map((row) => ({
          method: row.payment_method || 'not_recorded',
          paymentMode: row.payment_mode || 'unknown',
          count: Number(row.payment_count || 0),
          amountRm: Number(row.amount_rm || 0)
        })),
        tokenMovementBreakdown: tokenMovementRows.map((row) => ({
          sourceType: row.source_type,
          direction: row.direction,
          count: Number(row.movement_count || 0),
          tokenAmount: Number(row.token_amount || 0)
        })),
        subsidySummary: {
          issuedTokens: subsidyMovement.issued,
          consumedTokens: subsidyMovement.consumed,
          movementCount: subsidyMovement.movements,
          remainingIssuedTokens: Math.max(0, subsidyMovement.issued - subsidyMovement.consumed),
          recordedActiveBalanceTokens: Number(allowanceBalanceRows[0]?.remaining || 0)
        },
        recentTransactions: transactionRows.map((row) => ({
          id: row.id,
          date: formatDisplayDate(new Date(row.created_at)),
          time: formatDisplayTime(new Date(row.created_at)),
          type: row.type,
          description: row.description,
          amountRm: Number(row.amount_rm || 0),
          amountTokens: Number(row.amount_tokens || 0),
          status: capitalizeWords(row.status || ''),
          paymentStatus: capitalizeWords(row.payment_status || ''),
          paymentMode: row.payment_mode || '',
          reference: row.reference_id
          ,storeName: row.store_name
        }))
      };
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/finance/audit-ledger', { preHandler: authenticateAdminRequest }, async (request) => {
    requireFinanceAccess(request);
    const { limit, store_id: storeId, month } = financeAuditQuerySchema.parse(request.query);
    const monthFilter = (col: string) => `(:month IS NULL OR DATE_FORMAT(CONVERT_TZ(${col}, '+00:00', '+08:00'), '%Y-%m') = :month)`;
    const connection = await mysqlPool.getConnection();
    try {
      const [rows] = await connection.query<Array<RowDataPacket & {
        id: string; created_at: Date; entry_type: string; source_type: string;
        description: string; customer: string | null; reference_id: string | null;
        store_name: string | null; payment_method: string | null; payment_mode: string | null;
        amount_rm: string | number; amount_tokens: string | number; status: string;
      }>>(
        `SELECT * FROM (
           SELECT CONCAT('TOKEN-', tl.id) AS id, tl.created_at,
                  'Token movement' AS entry_type, tl.source_type,
                  COALESCE(tl.remarks, tl.source_type) AS description,
                  COALESCE(up.display_name, u.phone_e164) AS customer,
                  CAST(tl.source_id AS CHAR) AS reference_id,
                  NULL AS store_name, NULL AS payment_method, NULL AS payment_mode,
                  0 AS amount_rm,
                  CASE WHEN tl.direction = 'credit' THEN tl.amount ELSE -tl.amount END AS amount_tokens,
                  tl.direction AS status
             FROM token_ledger tl
             JOIN users u ON u.id = tl.user_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             JOIN customer_tenant_memberships ctm ON ctm.user_id = tl.user_id
             JOIN admin_tenants t ON t.id = ctm.tenant_id
            WHERE t.code = :tenantCode
              AND ${monthFilter('tl.created_at')}
           UNION ALL
           SELECT CONCAT('PAYMENT-', p.id), p.created_at,
                'Payment', COALESCE(p.payment_method, o.payment_mode, 'not_recorded'),
                  CONCAT('Paid order ', o.order_ref),
                  COALESCE(up.display_name, u.phone_e164), o.order_ref, s.name,
                  p.payment_method, o.payment_mode, p.amount_rm, 0, p.status
             FROM payments p
             JOIN orders o ON o.id = p.order_id
             JOIN users u ON u.id = o.user_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             JOIN stores s ON s.id = o.store_id
             JOIN admin_tenants t ON t.id = s.tenant_id
            WHERE t.code = :tenantCode AND (:storeId IS NULL OR s.id = :storeId)
              AND ${monthFilter('p.created_at')}
           UNION ALL
           SELECT CONCAT('REFUND-', r.id), r.created_at,
                  'Refund', r.payment_mode,
                  CONCAT('Refund ', o.order_ref, CASE WHEN r.reason IS NULL OR r.reason = '' THEN '' ELSE CONCAT(' · ', r.reason) END),
                  COALESCE(up.display_name, u.phone_e164), r.refund_ref, s.name,
                  r.payment_mode, r.payment_mode, -r.refund_amount_rm, -r.refund_token_amount, r.status
             FROM refunds r
             JOIN orders o ON o.id = r.order_id
             JOIN users u ON u.id = o.user_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             JOIN stores s ON s.id = o.store_id
             JOIN admin_tenants t ON t.id = s.tenant_id
            WHERE t.code = :tenantCode AND (:storeId IS NULL OR s.id = :storeId)
              AND ${monthFilter('r.created_at')}
         ) audit_entries
         ORDER BY created_at DESC
         LIMIT :limit`,
        { tenantCode: request.adminAuth.tenantCode, storeId: storeId ?? null, month: month ?? null, limit }
      );
      return {
        selectedStoreId: storeId ?? null,
        entries: rows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          type: row.entry_type,
          source: row.source_type,
          description: row.description,
          customer: row.customer || 'Unknown',
          reference: row.reference_id || '',
          storeName: row.store_name || '',
          paymentMethod: row.payment_method || '',
          paymentMode: row.payment_mode || '',
          amountRm: Number(row.amount_rm || 0),
          amountTokens: Number(row.amount_tokens || 0),
          status: row.status || ''
        }))
      };
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/refunds', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireRefundRequestAccess(request);
    const { limit, store_id: storeId } = adminListQuerySchema.parse(request.query);
    const connection = await mysqlPool.getConnection();
    try {
      const tiers = await loadLoyaltyTiers(connection);
      const [refundRows] = await connection.query<RowDataPacket[]>(`
        SELECT 
          r.refund_ref as id,
          o.order_ref as orderId,
          up.display_name as customer,
          up.email,
          up.avatar_type as avatar_type,
          up.avatar_value as avatar,
          u.phone_e164 as phone,
          u.id as user_id,
          r.refund_amount_rm as amount_rm,
          r.refund_token_amount as token_amount,
          r.reason as reason,
          r.payment_mode as paymentMethod,
          r.provider_refund_ref as providerRefundRef,
          r.status as status,
          r.created_at as requestedAt,
          r.reviewed_at as reviewedAt,
          o.created_at as orderDate,
          (
            SELECT lts.tier_code
            FROM loyalty_tier_snapshots lts
            WHERE lts.user_id = u.id
            ORDER BY lts.effective_at DESC, lts.id DESC
            LIMIT 1
          ) AS tier_code,
          r.reason as customerNotes
          ,s.id as storeId
          ,s.name as storeName
          ,(SELECT opa.reward_name_snapshot FROM order_promotional_addons opa WHERE opa.order_id = o.id LIMIT 1) as promotionalGiftName
          ,(SELECT opa.fulfilment_status FROM order_promotional_addons opa WHERE opa.order_id = o.id LIMIT 1) as promotionalGiftStatus
        FROM refunds r
        JOIN orders o ON r.order_id = o.id
        JOIN users u ON o.user_id = u.id
        JOIN user_profiles up ON u.id = up.user_id
        JOIN stores s ON s.id = o.store_id
        JOIN admin_tenants t ON t.id = s.tenant_id
        WHERE t.code = :tenantCode
          AND (:storeId IS NULL OR s.id = :storeId)
        ORDER BY r.created_at DESC
        LIMIT :limit
      `, { tenantCode: request.adminAuth.tenantCode, storeId: storeId ?? null, limit });

      if (refundRows.length === 0) {
        return reply.send({ refunds: [] });
      }

      const [refundItemRows] = await connection.query<RowDataPacket[]>(
        `SELECT r.refund_ref, oi.item_name_snapshot AS name, ri.quantity,
                ri.refund_amount_rm, ri.refund_token_amount
           FROM refund_items ri
           JOIN refunds r ON r.id = ri.refund_id
           JOIN order_items oi ON oi.id = ri.order_item_id
          WHERE r.refund_ref IN (?)
          ORDER BY ri.id`,
        [refundRows.map((row) => row.id)]
      );
      const refundItemsByRef = new Map<string, Array<Record<string, unknown>>>();
      for (const item of refundItemRows) {
        const refundRef = String(item.refund_ref);
        const items = refundItemsByRef.get(refundRef) ?? [];
        items.push({
          name: String(item.name),
          quantity: Number(item.quantity),
          amountRm: Number(item.refund_amount_rm),
          tokenAmount: Number(item.refund_token_amount)
        });
        refundItemsByRef.set(refundRef, items);
      }

      const formattedRefunds = refundRows.map(r => {
        const reqDate = new Date(r.requestedAt);
        const ordDate = new Date(r.orderDate);
        
        return {
          id: r.id,
          orderId: r.orderId,
          customer: r.customer || 'Unknown',
          email: r.email || '',
          phone: r.phone || '',
          avatarType: r.avatar_type || 'preset',
          avatar: r.avatar || null,
          tier: formatTierName(tiers, r.tier_code),
          tierCode: r.tier_code ? String(r.tier_code).trim().toLowerCase() : null,
          memberId: 'C2-' + String(r.user_id).padStart(3, '0'),
          amountRm: Number(r.amount_rm || 0),
          tokenAmount: Number(r.token_amount || 0),
          reason: r.reason || 'Other',
          paymentMethod: r.paymentMethod || '',
          providerRefundRef: r.providerRefundRef || '',
          isPartial: refundItemsByRef.has(String(r.id)),
          items: refundItemsByRef.get(String(r.id)) ?? [],
          status: capitalizeWords(r.status),
          requestedAt: `${formatDisplayDate(reqDate)} ${formatDisplayTime(reqDate)}`,
          orderDate: `${formatDisplayDate(ordDate)} – ${formatDisplayTime(ordDate)}`,
          customerNotes: r.customerNotes || '',
          storeId: Number(r.storeId),
          storeName: r.storeName,
          promotionalGiftName: r.promotionalGiftName || '',
          promotionalGiftStatus: r.promotionalGiftStatus || '',
          timeline: [
            { label: "Refund Requested", date: `${formatDisplayDate(reqDate)} ${formatDisplayTime(reqDate)}`, done: true },
            { label: "Refund Review", date: r.reviewedAt ? `${formatDisplayDate(new Date(r.reviewedAt))} ${formatDisplayTime(new Date(r.reviewedAt))}` : '', done: r.status !== 'pending' },
            {
              label: r.status === 'rejected'
                ? 'Refund Rejected'
                : r.status === 'completed'
                  ? 'Refund Completed'
                  : 'Refund Approved',
              date: r.reviewedAt ? `${formatDisplayDate(new Date(r.reviewedAt))} ${formatDisplayTime(new Date(r.reviewedAt))}` : '',
              done: ['approved', 'completed', 'rejected'].includes(r.status)
            }
          ]
        };
      });

      return reply.send({ refunds: formattedRefunds });
    } finally {
      connection.release();
    }
  });

  app.patch('/v1/admin/refunds/:refundRef/review', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireRefundApprovalAccess(request);

    const { refundRef } = request.params as { refundRef: string };
    const { decision, confirmation_password: confirmationPassword, provider_refund_ref: providerRefundRef, promotional_gift_disposition: promotionalGiftDisposition } = z.object({
      decision: z.enum(['approved', 'rejected']),
      confirmation_password: z.string().trim().min(8).max(200),
      provider_refund_ref: z.string().trim().min(3).max(255).optional(),
      promotional_gift_disposition: z.enum(['returned', 'retained']).optional(),
    }).parse(request.body);

    const connection = await mysqlPool.getConnection();
    let committed = false;
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, confirmationPassword);
      const [rows] = await connection.execute<Array<RowDataPacket & {
        id: number;
        status: string;
        order_id: number;
        payment_mode: 'token' | 'direct';
        payment_id: number | null;
        payment_status: string | null;
        payment_amount_rm: string | null;
        refund_token_amount: number | null;
        refund_amount_rm: string;
        provider_refund_ref: string | null;
        user_id: number;
        order_status: string;
        order_ref: string;
        created_by_admin_id: number | null;
        is_partial: number;
        cancellation_request_id: number | null;
        cancellation_request_status: string | null;
      }>>(
        `
          SELECT r.id, r.status, r.order_id, r.payment_id, r.payment_mode,
                 r.refund_token_amount, r.refund_amount_rm,
                 EXISTS (SELECT 1 FROM refund_items ri WHERE ri.refund_id = r.id) AS is_partial,
                 r.provider_refund_ref, r.created_by_admin_id,
                 o.user_id, o.status AS order_status, o.order_ref,
                 p.status AS payment_status, p.amount_rm AS payment_amount_rm,
                 ocr.id AS cancellation_request_id, ocr.status AS cancellation_request_status
          FROM refunds r
          JOIN orders o ON o.id = r.order_id
          LEFT JOIN order_cancellation_requests ocr ON ocr.order_id = o.id
          LEFT JOIN payments p ON p.id = r.payment_id
          JOIN stores s ON s.id = o.store_id
          JOIN admin_tenants t ON t.id = s.tenant_id
          WHERE r.refund_ref = :refundRef
            AND t.code = :tenantCode
          LIMIT 1
          FOR UPDATE
        `,
        { refundRef, tenantCode: request.adminAuth.tenantCode }
      );
      const refund = rows[0];
      if (!refund) {
        throw new ApiError(404, 'refund_not_found', 'Refund request not found.');
      }
      if (refund.status !== 'pending') {
        throw new ApiError(409, 'refund_already_reviewed', 'This refund request has already been reviewed.');
      }
      if (refund.created_by_admin_id === request.adminAuth.adminUserId) {
        throw new ApiError(403, 'refund_self_approval_forbidden', 'The admin who requested this refund cannot review it.');
      }

      if (decision === 'approved' && ['cancelled', 'refunded'].includes(refund.order_status)) {
        throw new ApiError(409, 'refund_already_settled', 'This order has already been cancelled or refunded. No second refund is allowed.');
      }

      if (refund.payment_mode === 'direct') {
        if (decision === 'approved' && !['paid', 'partially_refunded'].includes(refund.payment_status ?? '')) {
          throw new ApiError(409, 'payment_not_refundable', 'The direct payment is not in a refundable state. Confirm the provider payment status first.');
        }
        if (decision === 'approved' && !providerRefundRef) {
          throw new ApiError(400, 'provider_refund_reference_required', 'Enter the payment provider refund reference before completing this direct refund.');
        }
        const isPartialRefund = Number(refund.is_partial) === 1;
        if (decision === 'rejected' && !isPartialRefund) {
          await connection.execute(
            `UPDATE order_cancellation_requests
             SET status = 'rejected', review_reason = 'The payment-provider refund was not completed.', reviewed_at = UTC_TIMESTAMP(), reviewed_by_admin_user_id = :adminUserId
             WHERE id = :requestId AND status = 'refund_pending'`,
            { requestId: refund.cancellation_request_id, adminUserId: request.adminAuth.adminUserId }
          );
          await createUserNotification(connection, {
            userId: refund.user_id,
            type: 'order_cancellation_rejected',
            title: 'Cancellation refund not completed',
            body: 'The direct-payment refund could not be completed. Please contact the store if you need help.'
          });
        } else if (decision === 'approved' && isPartialRefund) {
          const [completedRows] = await connection.execute<Array<RowDataPacket & { refunded_amount_rm: string }>>(
            `SELECT COALESCE(SUM(refund_amount_rm), 0) AS refunded_amount_rm
               FROM refunds
              WHERE payment_id = :paymentId AND id <> :refundId
                AND status IN ('approved', 'completed')`,
            { paymentId: refund.payment_id, refundId: refund.id }
          );
          const cumulativeRefund = Number(completedRows[0]?.refunded_amount_rm ?? 0) + Number(refund.refund_amount_rm);
          const paymentAmount = Number(refund.payment_amount_rm ?? 0);
          await connection.execute(
            `UPDATE payments SET status = :paymentStatus
              WHERE id = :paymentId AND status IN ('paid', 'partially_refunded')`,
            {
              paymentId: refund.payment_id,
              paymentStatus: paymentAmount > 0 && cumulativeRefund >= paymentAmount ? 'refunded' : 'partially_refunded'
            }
          );
          await reverseLoyaltyWhenNoQualifyingItemsRemain(
            connection,
            refund.order_id,
            refund.id,
            refund.user_id,
            request.adminAuth.adminUserId
          );
          await createUserNotification(connection, {
            userId: refund.user_id,
            type: 'refund_completed',
            title: 'Partial refund completed',
            body: `RM ${Number(refund.refund_amount_rm).toFixed(2)} for the unavailable item has been refunded through your payment provider.`
          });
        } else if (decision === 'approved') {
          await connection.execute(
            `UPDATE payments SET status = 'refunded'
             WHERE id = :paymentId AND status IN ('paid', 'partially_refunded')`,
            { paymentId: refund.payment_id }
          );
          await releaseInventoryForOrder(connection, refund.order_id);
          await cancelPromotionalAddonForOrder(connection, Number(refund.order_id));
          await recordPromotionalAddonRefundDisposition(
            connection,
            Number(refund.order_id),
            promotionalGiftDisposition,
            false,
          );
          await restoreGiftCardForRefund(
            connection,
            refund.order_id,
            refund.user_id,
            `Returned after direct-payment refund ${refundRef}`
          );
          const loyaltyReversal = await reverseOrderLoyalty(
            refund.order_id,
            refund.user_id,
            connection,
            request.adminAuth.adminUserId
          );
          const referralReversal = await reverseReferralForRefundedOrder(
            connection,
            refund.order_id,
            request.adminAuth.adminUserId
          );
          const replacementVoucherIssued = await issueRefundReplacementVoucher(connection, {
            orderId: refund.order_id,
            userId: refund.user_id,
            issueCaseRef: `refund:${refundRef}`,
            reason: `Replacement voucher for refunded order ${refund.order_ref}`
          });
          await connection.execute(
            `UPDATE orders SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
             WHERE id = :orderId AND status IN ('paid', 'accepted')`,
            { orderId: refund.order_id }
          );
          await connection.execute(
            `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
             VALUES (:orderId, :fromStatus, 'cancelled', 'admin', :adminUserId, :reason, UTC_TIMESTAMP())`,
            {
              orderId: refund.order_id,
              fromStatus: refund.order_status,
              adminUserId: request.adminAuth.adminUserId,
              reason: `Completed direct-payment cancellation refund ${refundRef}`
            }
          );
          await connection.execute(
            `UPDATE order_cancellation_requests
             SET status = 'completed', review_reason = 'Payment-provider refund confirmed.', reviewed_at = UTC_TIMESTAMP(), reviewed_by_admin_user_id = :adminUserId
             WHERE id = :requestId AND status = 'refund_pending'`,
            { requestId: refund.cancellation_request_id, adminUserId: request.adminAuth.adminUserId }
          );
          await createUserNotification(connection, {
            userId: refund.user_id,
            type: 'refund_completed',
            title: 'Refund completed',
            body: loyaltyReversal.rewardNeedsReview || referralReversal.needsReview
              ? 'Your direct payment refund is complete. A reward linked to this order requires staff review.'
              : replacementVoucherIssued
                ? 'Your direct payment refund is complete and an equivalent voucher was added back to your account.'
                : 'Your direct payment refund is complete.'
          });
        }
      }

      if (decision === 'approved' && refund.payment_mode === 'token') {
        const [partialRows] = await connection.execute<Array<RowDataPacket & { item_count: number }>>(
          `SELECT COUNT(*) AS item_count FROM refund_items WHERE refund_id = :refundId`,
          { refundId: refund.id }
        );
        const isPartialRefund = Number(partialRows[0]?.item_count ?? 0) > 0;
        const partialAllowance = isPartialRefund
          ? await restorePartialAllowance(
              connection,
              Number(refund.order_id),
              Number(refund.id),
              Number(refund.refund_token_amount ?? 0),
              request.adminAuth.adminUserId
            )
          : { allowancePortion: 0, restored: 0 };
        const allowanceRefund = isPartialRefund
          ? { allowanceUsed: partialAllowance.allowancePortion, restored: partialAllowance.restored }
          : await restoreEmployeeAllowanceForRefund(connection, Number(refund.order_id));
        const tokenAmount = isPartialRefund
          ? Math.max(0, Number(refund.refund_token_amount ?? 0) - allowanceRefund.allowanceUsed)
          : calculatePersonalTokenRefund(Number(refund.refund_token_amount ?? 0), allowanceRefund.allowanceUsed);
        const [accounts] = await connection.execute<Array<RowDataPacket & { balance_available: number }>>(
          `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
          { userId: refund.user_id }
        );
        const account = accounts[0];
        if (!account) {
          throw new ApiError(409, 'token_account_not_found', 'The customer token account was not found.');
        }
        const balanceAfter = Number(account.balance_available) + tokenAmount;
        if (tokenAmount > 0) {
          await connection.execute(
            `UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`,
            { balanceAfter, userId: refund.user_id }
          );
          await connection.execute(
            `
              INSERT INTO token_ledger (
                user_id, token_lot_id, direction, source_type, source_id, amount,
                balance_after, remarks, created_by_admin_id, created_at
              ) VALUES (
                :userId, NULL, 'credit', 'refund_return', :refundId, :amount,
                :balanceAfter, :remarks, :adminUserId, UTC_TIMESTAMP()
              )
            `,
            {
              userId: refund.user_id,
              refundId: refund.id,
              amount: tokenAmount,
              balanceAfter,
              remarks: `Approved refund for ${refundRef}`,
              adminUserId: request.adminAuth.adminUserId
            }
          );
        }
        if (isPartialRefund) {
          const refundedTokens = Number(refund.refund_token_amount ?? 0);
          await createUserNotification(connection, {
            userId: refund.user_id,
            type: 'refund_completed',
            title: 'Partial refund completed',
            body: `${refundedTokens} token${refundedTokens === 1 ? '' : 's'} for the unavailable item${refundedTokens === 1 ? '' : 's'} have been returned to your C2 Coffee account.`
          });
          await reverseLoyaltyWhenNoQualifyingItemsRemain(
            connection,
            refund.order_id,
            refund.id,
            refund.user_id,
            request.adminAuth.adminUserId
          );
        } else {
          await connection.execute(
            `UPDATE orders SET status = 'refunded', updated_at = UTC_TIMESTAMP() WHERE id = :orderId`,
            { orderId: refund.order_id }
          );
        await reverseInventoryForOrder(connection, refund.order_id);
        await recordPromotionalAddonRefundDisposition(
          connection,
          Number(refund.order_id),
          promotionalGiftDisposition,
          true,
        );
        await restoreGiftCardForRefund(
          connection,
          refund.order_id,
          refund.user_id,
          `Returned after token refund ${refundRef}`
        );
        const loyaltyReversal = await reverseOrderLoyalty(
          refund.order_id,
          refund.user_id,
          connection,
          request.adminAuth.adminUserId
        );
        const referralReversal = await reverseReferralForRefundedOrder(
          connection,
          refund.order_id,
          request.adminAuth.adminUserId
        );
        const replacementVoucherIssued = await issueRefundReplacementVoucher(connection, {
          orderId: refund.order_id,
          userId: refund.user_id,
          issueCaseRef: `refund:${refundRef}`,
          reason: `Replacement voucher for refunded order ${refund.order_ref}`
        });
        await connection.execute(
          `
            INSERT INTO order_status_history (
              order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at
            )
            VALUES (
              :orderId, :fromStatus, 'refunded', 'admin', :adminUserId, :reason, UTC_TIMESTAMP()
            )
          `,
          {
            orderId: refund.order_id,
            fromStatus: refund.order_status,
            adminUserId: request.adminAuth.adminUserId,
            reason: `Approved refund ${refundRef}`
          }
        );
        await createUserNotification(connection, {
          userId: refund.user_id,
          type: 'refund_completed',
          title: 'Refund approved',
          body: referralReversal.needsReview || loyaltyReversal.rewardNeedsReview
            ? 'Your order refund is complete. A reward linked to this order requires staff review.'
            : replacementVoucherIssued
              ? 'Your tokens were returned and an equivalent voucher was added back to your account.'
              : 'The applicable tokens have been returned to your C2 Coffee account.'
        });
        }
      }

      if (decision === 'rejected' && Number(refund.is_partial) === 1) {
        await createUserNotification(connection, {
          userId: refund.user_id,
          type: 'refund_rejected',
          title: 'Partial refund not approved',
          body: 'Your partial item refund request was reviewed but could not be approved. Please contact the outlet if you need help.'
        });
      }

      await connection.execute(
        `
          UPDATE refunds
          SET status = CASE WHEN :decision = 'approved' AND :paymentMode = 'direct' THEN 'completed' ELSE :decision END,
              provider_refund_ref = COALESCE(:providerRefundRef, provider_refund_ref),
              reviewed_by_admin_id = :adminUserId,
              reviewed_at = UTC_TIMESTAMP(),
              completed_at = CASE WHEN :decision = 'approved' THEN UTC_TIMESTAMP() ELSE completed_at END
          WHERE id = :refundId
        `,
        {
          decision,
          paymentMode: refund.payment_mode,
          providerRefundRef: providerRefundRef ?? null,
          adminUserId: request.adminAuth.adminUserId,
          refundId: refund.id
        }
      );
      await connection.execute(
        `
          INSERT INTO admin_audit_logs (
            admin_user_id, effective_roles_json, action_code, target_type, target_id,
            ip_address, user_agent, created_at
          ) VALUES (
            :adminUserId, :roles, :actionCode, 'refund', :refundId,
            :ipAddress, :userAgent, UTC_TIMESTAMP()
          )
        `,
        {
          adminUserId: request.adminAuth.adminUserId,
          roles: JSON.stringify(request.adminAuth.roles),
          actionCode: `refund_${decision}`,
          refundId: refund.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null
        }
      );
      await connection.commit();
      committed = true;

      if (decision === 'approved' && refund.payment_mode === 'direct') {
        queueCustomerPush(request, refund.user_id, 'Refund completed', 'Your direct payment refund has been completed.', 'refund_completed');
      } else if (decision === 'approved' && refund.payment_mode === 'token') {
        queueCustomerPush(
          request,
          refund.user_id,
          refund.is_partial ? 'Partial refund approved' : 'Refund approved',
          refund.is_partial
            ? 'Tokens for the unavailable item have been returned to your C2 Credit account.'
            : 'Your C2 Credit tokens have been returned to your account.',
          'refund_completed'
        );
      } else if (decision === 'rejected' && Number(refund.is_partial) === 1) {
        queueCustomerPush(
          request,
          refund.user_id,
          'Partial refund not approved',
          'Your partial item refund request was not approved. Contact the outlet if you need help.',
          'refund_rejected'
        );
      }

      return reply.send({
        refund_ref: refundRef,
        status: decision === 'approved' && refund.payment_mode === 'direct' ? 'completed' : decision
      });
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.patch('/v1/admin/orders/:orderId/cancellation-request', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireOrderAccess(request);
    const { orderId } = request.params as { orderId: string };
    const payload = z.object({
      decision: z.enum(['approved', 'rejected']),
      review_reason: z.string().trim().min(3).max(500).optional()
    }).parse(request.body);
    const connection = await mysqlPool.getConnection();
    let committed = false;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<Array<RowDataPacket & {
        id: number;
        order_ref: string;
        user_id: number;
        store_id: number;
        status: string;
        payment_mode: 'token' | 'direct';
        token_amount_charged: number;
        final_total_rm: string;
        voucher_id: number | null;
        payment_id: number | null;
        payment_status: string | null;
        request_id: number | null;
        request_status: string | null;
        request_reason: string | null;
      }>>(
        `SELECT o.id, o.order_ref, o.user_id, o.store_id, o.status, o.payment_mode,
                o.token_amount_charged, o.final_total_rm, o.voucher_id,
                p.id AS payment_id, p.status AS payment_status,
                ocr.id AS request_id, ocr.status AS request_status, ocr.reason AS request_reason
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         LEFT JOIN payments p ON p.id = (
           SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id ORDER BY p2.id DESC LIMIT 1
         )
         LEFT JOIN order_cancellation_requests ocr ON ocr.order_id = o.id
         WHERE o.order_ref = :orderId AND t.code = :tenantCode
           AND (:isBaristaOnly = 0 OR EXISTS (
             SELECT 1 FROM admin_user_store_assignments aus
             WHERE aus.admin_user_id = :adminUserId AND aus.store_id = o.store_id
           ))
         LIMIT 1 FOR UPDATE`,
        {
          orderId,
          tenantCode: request.adminAuth.tenantCode,
          adminUserId: request.adminAuth.adminUserId,
          isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0
        }
      );
      const order = rows[0];
      if (!order) return reply.status(404).send({ error: { code: 'not_found', message: 'Order not found' } });
      if (request.adminAuth.roles.includes('barista')) {
        const access = await resolveBaristaShiftAccess(connection, {
          tenantId: request.adminAuth.tenantId,
          tenantCode: request.adminAuth.tenantCode,
          storeId: Number(order.store_id)
        });
        if (!access.can_prepare_orders) throw new ApiError(409, 'shift_access_locked', access.message);
      }
      if (order.request_id == null || order.request_status !== 'pending') {
        throw new ApiError(409, 'cancellation_request_not_pending', 'There is no pending cancellation request for this order.');
      }

      const isComplimentary = isComplimentaryOrder({
        final_total_rm: order.final_total_rm,
        token_amount_charged: order.token_amount_charged,
        payment_mode: order.payment_mode,
        voucher_id: order.voucher_id
      });
      if (!['paid', 'accepted'].includes(order.status)) {
        await connection.execute(
          `UPDATE order_cancellation_requests
           SET status = 'rejected', review_reason = 'Preparation has already started.', reviewed_at = UTC_TIMESTAMP(), reviewed_by_admin_user_id = :adminUserId
           WHERE id = :requestId AND status = 'pending'`,
          { requestId: order.request_id, adminUserId: request.adminAuth.adminUserId }
        );
        await connection.commit();
        committed = true;
        queueCustomerPush(request, Number(order.user_id), 'Cancellation request declined', 'Preparation has already started, so the order will continue.', 'order_cancellation_rejected');
        throw new ApiError(409, 'cancellation_too_late', 'Preparation has already started, so this request was declined.');
      }

      if (payload.decision === 'rejected') {
        await connection.execute(
          `UPDATE order_cancellation_requests
           SET status = 'rejected', review_reason = :reviewReason, reviewed_at = UTC_TIMESTAMP(), reviewed_by_admin_user_id = :adminUserId
           WHERE id = :requestId AND status = 'pending'`,
          {
            requestId: order.request_id,
            reviewReason: payload.review_reason ?? 'The store could not approve this request before preparation.',
            adminUserId: request.adminAuth.adminUserId
          }
        );
        await createUserNotification(connection, {
          userId: Number(order.user_id),
          type: 'order_cancellation_rejected',
          title: 'Cancellation request declined',
          body: payload.review_reason ?? 'Your order will continue as planned because preparation has not been cancelled.'
        });
        await connection.commit();
        committed = true;
        queueCustomerPush(request, Number(order.user_id), 'Cancellation request declined', payload.review_reason ?? 'Your order will continue as planned because preparation has not been cancelled.', 'order_cancellation_rejected');
        return reply.send({ status: 'rejected' });
      }

      if (order.payment_mode === 'direct' && !isComplimentary) {
        const refundRef = `RFD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
        await connection.execute(
          `INSERT INTO refunds (order_id, payment_id, payment_mode, refund_ref, refund_amount_rm, refund_token_amount, status, reason, created_by_admin_id, created_at)
           VALUES (:orderId, :paymentId, 'direct', :refundRef, :amountRm, NULL, 'pending', :reason, :adminUserId, UTC_TIMESTAMP())`,
          {
            orderId: order.id,
            paymentId: order.payment_id,
            refundRef,
            amountRm: order.final_total_rm,
            reason: 'Barista-approved direct-payment cancellation before preparation',
            adminUserId: request.adminAuth.adminUserId
          }
        );
        await connection.execute(
          `UPDATE order_cancellation_requests
           SET status = 'refund_pending', review_reason = :reviewReason, reviewed_at = UTC_TIMESTAMP(), reviewed_by_admin_user_id = :adminUserId
           WHERE id = :requestId AND status = 'pending'`,
          {
            requestId: order.request_id,
            reviewReason: payload.review_reason ?? 'Approved by barista; payment-provider refund still required.',
            adminUserId: request.adminAuth.adminUserId
          }
        );
        await createUserNotification(connection, {
          userId: Number(order.user_id),
          type: 'order_cancellation_approved',
          title: 'Cancellation approved; refund pending',
          body: 'The store approved your request. Your direct payment must now be refunded through the payment provider; the order remains protected until that is confirmed.'
        });
        await connection.commit();
        committed = true;
        queueCustomerPush(request, Number(order.user_id), 'Cancellation approved; refund pending', 'Your cancellation was approved. Your direct payment refund is being processed.', 'order_cancellation_approved');
        return reply.send({ status: 'refund_pending', payment_refund_required: true });
      }

      const allowanceRefund = await restoreEmployeeAllowanceForRefund(connection, Number(order.id));
      const tokenAmount = calculatePersonalTokenRefund(Number(order.token_amount_charged), allowanceRefund.allowanceUsed);
      // Token checkouts are settled from the token ledger and normally have no
      // provider payment row. The direct-payment branch above handles the
      // provider-paid requirement separately.
      const [existingRefunds] = await connection.execute<Array<RowDataPacket & { id: number }>>(
        `SELECT id FROM refunds
         WHERE order_id = :orderId AND status IN ('pending', 'approved', 'completed')
         LIMIT 1 FOR UPDATE`,
        { orderId: order.id }
      );
      if (existingRefunds[0]) {
        throw new ApiError(409, 'refund_already_in_progress', 'A refund has already been created for this order. No second token return is allowed.');
      }
      const [accounts] = await connection.execute<Array<RowDataPacket & { balance_available: number }>>(
        `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
        { userId: order.user_id }
      );
      if (!accounts[0]) throw new ApiError(409, 'token_account_not_found', 'The customer token account was not found.');
      const balanceAfter = Number(accounts[0].balance_available) + tokenAmount;
      if (tokenAmount > 0) {
        await connection.execute(
          `UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`,
          { balanceAfter, userId: order.user_id }
        );
      }
      const refundRef = `RFD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const replacementVoucherIssued = isComplimentary
        ? false
        : await issueRefundReplacementVoucher(connection, {
            orderId: order.id,
            userId: order.user_id,
            issueCaseRef: `refund:${refundRef}`,
            reason: `Replacement voucher for cancelled order ${order.order_ref}`
          });
      if (isComplimentary) {
        await restoreVoucherForCancelledOrder(connection, Number(order.id));
      }
      if (tokenAmount > 0) {
        await connection.execute(
          `INSERT INTO token_ledger (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
           VALUES (:userId, NULL, 'credit', 'refund_return', :orderId, :amount, :balanceAfter, :remarks, UTC_TIMESTAMP())`,
          { userId: order.user_id, orderId: order.id, amount: tokenAmount, balanceAfter, remarks: `Approved cancellation for order ${order.order_ref}` }
        );
      }
      await connection.execute(
        `INSERT INTO refunds (order_id, payment_id, payment_mode, refund_ref, refund_amount_rm, refund_token_amount, status, reason, created_by_admin_id, created_at, completed_at)
         VALUES (:orderId, :paymentId, 'token', :refundRef, :amountRm, :tokenAmount, 'completed', :reason, :adminUserId, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        {
          orderId: order.id,
          paymentId: order.payment_id,
          refundRef,
          amountRm: order.final_total_rm,
          tokenAmount,
          reason: 'Barista-approved customer cancellation before preparation',
          adminUserId: request.adminAuth.adminUserId
        }
      );
      await releaseInventoryForOrder(connection, order.id);
      await cancelPromotionalAddonForOrder(connection, Number(order.id));
      await restoreGiftCardForRefund(
        connection,
        order.id,
        Number(order.user_id),
        `Returned after cancelled order ${order.order_ref}`
      );
      await connection.execute(
        `UPDATE orders SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
         WHERE id = :orderId AND status IN ('paid', 'accepted')`,
        { orderId: order.id }
      );
      await connection.execute(
        `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
         VALUES (:orderId, :fromStatus, 'cancelled', 'admin', :adminUserId, :reason, UTC_TIMESTAMP())`,
        {
          orderId: order.id,
          fromStatus: order.status,
          adminUserId: request.adminAuth.adminUserId,
          reason: 'Cancellation approved by barista before preparation'
        }
      );
      await connection.execute(
        `UPDATE order_cancellation_requests
         SET status = 'completed', review_reason = :reviewReason, reviewed_at = UTC_TIMESTAMP(), reviewed_by_admin_user_id = :adminUserId
         WHERE id = :requestId AND status = 'pending'`,
        { requestId: order.request_id, reviewReason: payload.review_reason ?? 'Approved before preparation.', adminUserId: request.adminAuth.adminUserId }
      );
      await createUserNotification(connection, {
        userId: Number(order.user_id),
        type: 'order_cancelled',
        title: 'Cancellation approved',
        body: replacementVoucherIssued
          ? `${tokenAmount} tokens were returned and an equivalent voucher was added to your account.`
          : `${tokenAmount} tokens were returned to your C2 Coffee account.`
      });
      await connection.commit();
      committed = true;
      queueCustomerPush(request, Number(order.user_id), 'Cancellation approved', `${tokenAmount} C2 Credit token(s) were returned to your account.`, 'order_cancelled');
      return reply.send({ status: 'completed', returned_tokens: tokenAmount, token_balance: balanceAfter, replacement_voucher_issued: replacementVoucherIssued });
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.patch('/v1/admin/orders/:orderId/status', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireOrderAccess(request);

    const { orderId } = request.params as { orderId: string };
    const { status } = z.object({
      status: z.string().trim()
    }).parse(request.body);

    if (!['preparing', 'ready_for_pickup', 'collected', 'completed'].includes(status)) {
      return reply.status(400).send({ error: { code: 'invalid_status', message: 'Invalid status' } });
    }

    const effectiveStatus = status === 'completed' ? 'collected' : status;

    const connection = await mysqlPool.getConnection();
    let committed = false;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT o.id, o.user_id, o.status, o.store_id,
                COALESCE(o.is_guest, 0) AS is_guest,
                COALESCE(o.order_channel, 'mobile') AS order_channel,
                up.email AS customer_email,
                ocr.status AS cancellation_request_status
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         LEFT JOIN user_profiles up ON up.user_id = o.user_id
         LEFT JOIN order_cancellation_requests ocr ON ocr.order_id = o.id
         WHERE o.order_ref = :orderId
           AND t.code = :tenantCode
           AND (
             :isBaristaOnly = 0
             OR EXISTS (
               SELECT 1
               FROM admin_user_store_assignments aus
               WHERE aus.admin_user_id = :adminUserId AND aus.store_id = o.store_id
             )
           )
         LIMIT 1
         FOR UPDATE`,
        {
          orderId,
          tenantCode: request.adminAuth.tenantCode,
          adminUserId: request.adminAuth.adminUserId,
          isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0
        }
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'Order not found' } });
      }

      const internalId = rows[0].id;
      const fromStatus = rows[0].status;
      let receiptEmailQueued = false;

      const workstationKey = request.headers['x-c2-workstation-key'];
      const isWorkstationRequest = typeof workstationKey === 'string' && /^C2-[A-Z0-9]{12}$/.test(workstationKey.trim().toUpperCase());
      if (request.adminAuth.roles.includes('barista') || isWorkstationRequest) {
        const access = await resolveBaristaShiftAccess(connection, {
          tenantId: request.adminAuth.tenantId,
          tenantCode: request.adminAuth.tenantCode,
          storeId: Number(rows[0].store_id)
        });
        if (!access.can_prepare_orders) {
          throw new ApiError(409, 'shift_access_locked', access.message);
        }
      }

      if (effectiveStatus === 'preparing' &&
          ['pending', 'refund_pending'].includes(rows[0].cancellation_request_status ?? '')) {
        throw new ApiError(
          409,
          'cancellation_request_pending',
          'Review or resolve the customer cancellation request before preparation starts.'
        );
      }

      if (fromStatus === effectiveStatus) {
        await connection.commit();
        committed = true;
        return reply.send({ success: true, status: effectiveStatus, unchanged: true });
      }

      const allowedPreviousStatuses: Record<string, string[]> = {
        preparing: ['paid', 'accepted'],
        ready_for_pickup: ['preparing'],
        collected: ['ready_for_pickup']
      };

      if (request.adminAuth.roles.includes('barista') && effectiveStatus === 'collected' &&
          rows[0].order_channel !== 'counter') {
        throw new ApiError(403, 'collection_customer_only', 'Customers confirm collection in the mobile app.');
      }

      if (!(allowedPreviousStatuses[effectiveStatus] ?? []).includes(fromStatus)) {
        throw new ApiError(
          409,
          'invalid_order_transition',
          `This order is already ${capitalizeWords(fromStatus)} and cannot be changed to ${capitalizeWords(effectiveStatus)}.`
        );
      }

      const timestampUpdates: string[] = [];
      if (effectiveStatus === 'preparing') {
        timestampUpdates.push(
          'accepted_at = COALESCE(accepted_at, UTC_TIMESTAMP())'
        );
      }

      if (effectiveStatus === 'ready_for_pickup') {
        timestampUpdates.push(
          'accepted_at = COALESCE(accepted_at, UTC_TIMESTAMP())',
          'ready_at = COALESCE(ready_at, UTC_TIMESTAMP())'
        );
      }

      if (effectiveStatus === 'collected') {
        timestampUpdates.push(
          'ready_at = COALESCE(ready_at, UTC_TIMESTAMP())',
          'ready_by_admin_user_id = COALESCE(ready_by_admin_user_id, :adminUserId)',
          'collected_at = COALESCE(collected_at, UTC_TIMESTAMP())'
        );
      }

      await connection.execute(
        `
          UPDATE orders
          SET status = :status
              ${timestampUpdates.length > 0 ? `, ${timestampUpdates.join(', ')}` : ''}
          WHERE id = :internalId
        `,
        { status: effectiveStatus, internalId, adminUserId: request.adminAuth.adminUserId }
      );

      // Insert into order_status_history
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
            :internalId,
            :fromStatus,
            :status,
            'admin',
            :adminUserId,
            :reason,
            UTC_TIMESTAMP()
          )
        `,
        {
          internalId,
          fromStatus,
          status: effectiveStatus,
          adminUserId: request.adminAuth.adminUserId,
          reason: `Updated by ${request.adminAuth.fullName || request.adminAuth.username}`
        }
      );

      if (effectiveStatus === 'ready_for_pickup' && Number(rows[0].is_guest) !== 1) {
        await createUserNotification(connection, {
          userId: Number(rows[0].user_id),
          type: 'order_ready',
          title: 'Your order is ready',
          body: 'Your order is ready for collection. Please collect it at the counter when convenient.'
        });
        receiptEmailQueued = await queueOrderReceiptEmail(connection, {
          orderId: Number(internalId),
          recipientEmail: rows[0].customer_email ?? null
        });
      }

      // Super admins may record collection on behalf of a customer. Keep the
      // reward outcome identical to customer-confirmed collection.
      if (effectiveStatus === 'collected') {
        await consumeInventoryForOrder(connection, internalId);
        await fulfilPromotionalAddonForOrder(connection, internalId);
      }
      if (effectiveStatus === 'collected' && Number(rows[0].is_guest) !== 1) {
        await processOrderLoyalty(internalId, Number(rows[0].user_id), connection);
        await awardReferralForCollectedOrder(connection, Number(rows[0].user_id), internalId);
      }

      await connection.commit();
      committed = true;

      if (effectiveStatus === 'ready_for_pickup' && Number(rows[0].is_guest) !== 1) {
        try {
          await deliverPushToUser({
            userId: Number(rows[0].user_id),
            title: 'Your order is ready',
            body: 'Your order is ready for collection. Please collect it at the counter when convenient.',
            data: { type: 'order_ready' }
          });
        } catch (error) {
          // The in-app record is already committed. Log only safe metadata so
          // a provider outage cannot affect the order lifecycle.
          request.log.warn({ err: error, orderRef: orderId }, 'Push delivery failed after order update.');
        }
      }

      if (receiptEmailQueued) {
        void deliverQueuedOrderReceiptEmail(Number(internalId)).then((outcome) => {
          if (outcome === 'failed') {
            request.log.warn({ orderRef: orderId }, 'Order receipt email delivery failed after order became ready.');
          }
        }).catch(() => {
          request.log.warn({ orderRef: orderId }, 'Order receipt email delivery could not be started after order became ready.');
        });
      }

      return reply.send({
        success: true,
        status: effectiveStatus,
        barista: null
      });
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
