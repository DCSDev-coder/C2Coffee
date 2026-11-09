import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateRequest } from '../../auth/guard.js';
import { env } from '../../config/env.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { createUserNotification } from '../notifications.js';
import {
  isCustomerActiveOrderStatus,
  resolveOrderLifecycleStatus
} from '../order-lifecycle.js';
import {
  getKualaLumpurDateParts,
  getKualaLumpurDayEndUtc,
  getKualaLumpurOccurrenceEndUtc
} from '../../lib/kuala-lumpur-time.js';
import { getActiveLoyaltyTiers, getTierByCode, loadLoyaltyTiers, type LoyaltyTierConfig } from '../../services/loyalty-tiers.js';
import { issueFriendRewardAtClaim, type ReferralProgramSnapshot } from '../../services/referrals.js';
import { issueRefundReplacementVoucher } from '../../services/voucher-replacement.js';
import {
  cancelChipPurchase,
  createChipPurchase,
  getChipPurchase,
  isTrustedChipCheckoutUrl,
  type ChipPaymentMethod
} from '../../payments/chip-client.js';
import { settleChipMobilePurchase } from '../../services/chip-counter-settlement.js';
import { releaseInventoryForOrder } from '../../services/inventory.js';
import { restoreGiftCardForRefund } from '../../services/gift-cards.js';
import { calculatePersonalTokenRefund, getEmployeeSubsidyStatus, restoreEmployeeAllowanceForRefund, setEmployeeSubsidyEnabled } from '../../services/employee-token-allowance.js';
import {
  evaluateVoucherTopUpEligibility,
  getVoucherTopUpMinimum
} from '../../services/voucher-topup-eligibility.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

const subsidyStoreQuerySchema = z.object({
  store_id: z.coerce.number().int().positive().optional()
});

const subsidyPreferenceSchema = z.object({
  enabled: z.boolean(),
  store_id: z.coerce.number().int().positive().optional()
});

const rewardVoucherListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  // Voucher history is requested explicitly so checkout continues to receive
  // only vouchers that can still be redeemed.
  include_history: z.enum(['1', 'true']).optional().transform((value) => value !== undefined),
  // Retained for older app builds. New tier achievements are claimable
  // entitlements and only become ordinary vouchers after a successful claim.
  include_tier_rewards: z.enum(['1', 'true']).optional().transform((value) => value !== undefined)
});

const tierRewardClaimParamsSchema = z.object({
  entitlementId: z.coerce.number().int().positive()
});

const pushTokenSchema = z.object({
  device_fingerprint: z.string().trim().min(8).max(255),
  platform: z.enum(['android', 'ios']),
  push_token: z.string().trim().min(20).max(512),
  app_version: z.string().trim().min(1).max(50).optional()
});

const deactivatePushTokenSchema = z.object({
  push_token: z.string().trim().min(20).max(512)
});

type WalletTransactionRow = RowDataPacket & {
  id: number;
  direction: 'credit' | 'debit';
  source_type:
    | 'topup_paid'
    | 'order_spend'
    | 'refund_return'
    | 'expiry'
    | 'admin_adjustment'
    | 'promo_credit'
    | 'voucher_subsidy';
  source_id: number;
  amount: number;
  balance_after: number;
  remarks: string | null;
  created_at: Date;
};

type VoucherRow = RowDataPacket & {
  id: number;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  issued_by_type: 'system' | 'admin';
  issued_reason: string;
  issue_case_ref: string | null;
  tier_at_issue: string | null;
  issued_at: Date;
  expires_at: Date;
  template_valid_until: Date | null;
  redeemed_at: Date | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  template_id: number;
  template_code: string;
  template_name: string;
  template_image_url: string | null;
  voucher_type:
    | 'welcome'
    | 'tier_reward'
    | 'birthday_treat'
    | 'referral'
    | 'manual_recovery'
    | 'campaign_direct_pay'
    | 'campaign_token_equivalent';
  discount_mode: 'fixed_rm' | 'percent_rm' | 'fixed_token' | 'free_drink' | 'free_option';
  discount_value: string;
  token_value: number | null;
  min_spend_rm: string | null;
  requires_drink_in_cart: number;
  eligible_scope_json: string | Record<string, unknown> | null;
  exclude_scope_json: string | Record<string, unknown> | null;
};

type TierRewardEntitlementRow = RowDataPacket & {
  id: number;
  status: 'claimable' | 'claimed' | 'revoked';
  issue_case_ref: string;
  tier_code: string;
  unlocked_at: Date;
  template_id: number;
  template_code: string;
  template_name: string;
  template_image_url: string | null;
  voucher_type: VoucherRow['voucher_type'];
  discount_mode: VoucherRow['discount_mode'];
  discount_value: string;
  token_value: number | null;
  min_spend_rm: string | null;
  requires_drink_in_cart: number;
  eligible_scope_json: string | Record<string, unknown> | null;
  exclude_scope_json: string | Record<string, unknown> | null;
  total_quantity?: number | null;
  limit_per_user?: number | null;
};

type AutoSyncVoucherTemplateRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  // Legacy vouchers are retained only to avoid changing previously issued data.
  // New referral rewards are excluded below through referral_programs instead.
  is_referral_reward?: number;
  expires_in_days: number | null;
  valid_until: Date | null;
  total_quantity: number | null;
  limit_per_user: number | null;
  eligible_scope_json: string | Record<string, unknown> | null;
};

type LockedTopUpRewardRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  image_url: string | null;
  voucher_type: VoucherRow['voucher_type'];
  discount_mode: VoucherRow['discount_mode'];
  discount_value: string;
  token_value: number | null;
  min_spend_rm: string | null;
  requires_drink_in_cart: number;
  eligible_scope_json: string | Record<string, unknown> | null;
  exclude_scope_json: string | Record<string, unknown> | null;
  valid_until: Date | null;
  created_at: Date;
  is_employee: number;
};

type OrderSummaryRow = RowDataPacket & {
  id: number;
  order_ref: string;
  daily_order_number: number;
  status:
    | 'draft'
    | 'pending_payment'
    | 'payment_failed'
    | 'paid'
    | 'accepted'
    | 'preparing'
    | 'ready_for_pickup'
    | 'collected'
    | 'cancelled'
    | 'refunded';
  payment_mode: 'token' | 'direct';
  final_total_rm: string;
  token_amount_charged: number;
  pickup_slot_at: Date;
  paid_at: Date | null;
  accepted_at: Date | null;
  ready_at: Date | null;
  collected_at: Date | null;
  created_at: Date;
  updated_at: Date;
  payment_status: 'pending' | 'authorized' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | null;
  payment_method: string | null;
  payment_expires_at: Date | null;
  store_id: number;
  store_name: string;
  item_count: number;
  primary_item_name: string | null;
  barista_name: string | null;
  barista_username: string | null;
  cancellation_request_status: 'pending' | 'approved' | 'rejected' | 'refund_pending' | 'completed' | 'withdrawn' | null;
};

type OrderItemRow = RowDataPacket & {
  order_id: number;
  item_id: number;
  menu_item_id: number;
  item_name_snapshot: string;
  base_price_rm_snapshot: string;
  token_price_snapshot: number | null;
  quantity: number;
  line_subtotal_rm: string;
  line_token_amount: number | null;
  is_qualifying_cup: number;
};

type OrderItemModifierRow = RowDataPacket & {
  order_item_id: number;
  modifier_group_name_snapshot: string;
  modifier_option_name_snapshot: string;
  price_delta_rm_snapshot: string;
  token_price_delta_snapshot: number;
};

type OrderStatusHistoryRow = RowDataPacket & {
  order_id: number;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: Date;
};

type NotificationRow = RowDataPacket & {
  id: number;
  type: string;
  title: string;
  body: string;
  data_json: unknown;
  sent_at: Date | null;
  read_at: Date | null;
  created_at: Date;
};

type PaymentServiceNoticeRow = RowDataPacket & {
  id: number;
  title: string;
  message: string;
  payment_methods_json: string | string[];
  starts_at: Date;
  ends_at: Date;
  created_at: Date;
  is_popup_dismissed: number;
};

const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});

const notificationIdParamsSchema = z.object({
  notificationId: z.coerce.number().int().positive()
});

const paymentServiceNoticeParamsSchema = z.object({
  noticeId: z.coerce.number().int().positive()
});

const notificationPreferencesSchema = z.object({
  marketing_enabled: z.boolean()
});

function publicNotificationText(
  value: unknown,
  fallback: string,
  maximumLength: number
): string {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Notification copy must never expose serialized payloads, credentials,
  // transport details, or internal failure text to a customer device.
  if (
    !text ||
    text.startsWith('{') ||
    text.startsWith('[') ||
    /\b(sql|stack trace|exception|error code|bearer|authorization|token=|https?:\/\/)/i.test(text)
  ) {
    return fallback;
  }

  return text.slice(0, maximumLength);
}

function publicNotificationData(value: unknown): Record<string, string> {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const data = parsed as Record<string, unknown>;
    const safe: Record<string, string> = {};
    for (const key of ['type', 'order_ref', 'voucher_id', 'banner_id', 'topup_ref', 'status']) {
      const candidate = String(data[key] ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
      if (candidate) safe[key] = candidate;
    }
    return safe;
  } catch {
    return {};
  }
}

function parseVoucherScope(
  value: unknown
): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeVoucherTierScope(
  value: unknown,
  activeTiers: LoyaltyTierConfig[]
): string | null | undefined {
  const raw = String(value ?? '').trim().toLowerCase().replaceAll(/[_-]+/g, ' ').replaceAll(/\s+/g, ' ');
  if (!raw || raw === 'all' || raw === 'all tier' || raw === 'all tiers') return null;

  const tier = getTierByCode(activeTiers, raw) ?? activeTiers.find(
    (entry) => entry.name.trim().toLowerCase() === raw
  );
  return tier?.code;
}

function isAutoVisibleAudience(scope: Record<string, unknown>, isEmployee: boolean): boolean {
  const audience = String(scope['audience'] ?? '').trim();
  return audience === 'all_customers' || (audience === 'employee_only' && isEmployee);
}

function resolveAutoIssuedVoucherExpiry(
  template: AutoSyncVoucherTemplateRow
): Date {
  if (template.valid_until instanceof Date) {
    return template.valid_until;
  }

  if (typeof template.expires_in_days === 'number' && template.expires_in_days > 0) {
    return new Date(Date.now() + template.expires_in_days * 24 * 60 * 60 * 1000);
  }

  return new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000);
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

async function issueAutoVisibleVoucherAtomically(input: {
  userId: number;
  templateId: number;
  issueCaseRef: string;
  issuedReason: string;
  tierAtIssue: string | null;
  expiresAt: Date;
  recurring: boolean;
}): Promise<boolean> {
  const connection = await getUtcConnection();
  try {
    await connection.beginTransaction();

    // Lock the template as the allocation mutex. Every automatic/manual issue
    // path takes this lock before checking quantity, so the final allocation
    // cannot be oversubscribed by simultaneous customer requests.
    const [templateRows] = await connection.query<Array<RowDataPacket & {
      total_quantity: number | null;
      limit_per_user: number | null;
    }>>(
      `
        SELECT vt.total_quantity, vt.limit_per_user
        FROM voucher_templates vt
        JOIN customer_tenant_memberships ctm
          ON ctm.tenant_id = vt.tenant_id
         AND ctm.user_id = :userId
        WHERE vt.id = :templateId
          AND vt.is_active = 1
          AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
        LIMIT 1
        FOR UPDATE
      `,
      { userId: input.userId, templateId: input.templateId }
    );
    const lockedTemplate = templateRows[0];
    if (!lockedTemplate) {
      await connection.commit();
      return false;
    }

    const [issueCountRows] = await connection.query<Array<RowDataPacket & {
      total_count: number;
      user_count: number;
    }>>(
      `
        SELECT
          COALESCE(SUM(
            CASE
              WHEN :isRecurring = 0 OR issue_case_ref = :issueCaseRef
              THEN 1
              ELSE 0
            END
          ), 0) AS total_count,
          COALESCE(SUM(
            CASE
              WHEN user_id = :userId
                AND (:isRecurring = 0 OR issue_case_ref = :issueCaseRef)
              THEN 1
              ELSE 0
            END
          ), 0) AS user_count
        FROM user_vouchers
        WHERE voucher_template_id = :templateId
          AND status <> 'revoked'
      `,
      {
        userId: input.userId,
        templateId: input.templateId,
        issueCaseRef: input.issueCaseRef,
        isRecurring: input.recurring ? 1 : 0
      }
    );
    const counts = issueCountRows[0];
    if (
      (lockedTemplate.total_quantity != null && Number(counts?.total_count ?? 0) >= Number(lockedTemplate.total_quantity)) ||
      (lockedTemplate.limit_per_user != null && Number(counts?.user_count ?? 0) >= Number(lockedTemplate.limit_per_user))
    ) {
      await connection.commit();
      return false;
    }

    await connection.execute(
      `
        INSERT INTO user_vouchers (
          user_id, voucher_template_id, status, issued_by_type, issued_reason,
          issue_case_ref, tier_at_issue, issued_at, expires_at
        ) VALUES (
          :userId, :templateId, 'active', 'system', :issuedReason,
          :issueCaseRef, :tierAtIssue, UTC_TIMESTAMP(), :expiresAt
        )
      `,
      {
        userId: input.userId,
        templateId: input.templateId,
        issuedReason: input.issuedReason,
        issueCaseRef: input.issueCaseRef,
        tierAtIssue: input.tierAtIssue,
        expiresAt: input.expiresAt
      }
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    if (isDuplicateKeyError(error)) return false;
    throw error;
  } finally {
    connection.release();
  }
}

function getVoucherScheduleMode(scope: Record<string, unknown>): string {
  const rawSchedule =
    scope.schedule && typeof scope.schedule === 'object'
      ? (scope.schedule as Record<string, unknown>)
      : {};
  return String(rawSchedule.mode || 'always').trim();
}

function getVoucherSchedule(scope: Record<string, unknown>): Record<string, unknown> {
  return scope.schedule && typeof scope.schedule === 'object'
    ? (scope.schedule as Record<string, unknown>)
    : {};
}

function isScheduleActiveNow(
  schedule: Record<string, unknown>,
  birthdayMonthDay: string | null,
  now = new Date()
): boolean {
  const mode = String(schedule.mode || 'always').trim();
  if (mode === 'always') return true;

  const current = getKualaLumpurDateParts(now);
  const currentTime = `${current.hour}:${current.minute}`;
  const startTime = typeof schedule.startTime === 'string' ? schedule.startTime : '';
  const endTime = typeof schedule.endTime === 'string' ? schedule.endTime : '';
  const activeDays = Array.isArray(schedule.activeDays)
    ? schedule.activeDays.map((day) => String(day))
    : [];
  const annualDate = typeof schedule.annualDate === 'string' ? schedule.annualDate : '';
  const monthlyDay = Number(schedule.monthlyDay ?? 0);

  if (mode === 'birthday' && (!birthdayMonthDay || birthdayMonthDay.slice(0, 2) !== current.month)) return false;
  if (mode === 'weekly' && activeDays.length > 0 && !activeDays.includes(current.weekday)) return false;
  if (mode === 'annual' && annualDate && annualDate !== current.monthDay) return false;
  if (mode === 'monthly' && monthlyDay > 0 && monthlyDay !== Number(current.day)) return false;
  if (startTime && currentTime < startTime) return false;
  if (endTime && currentTime > endTime) return false;

  return true;
}

type UpcomingVoucherOccurrence = {
  expiresAt: Date;
  dateKey: string;
  year: string;
  month: string;
  monthDay: string;
};

function getUpcomingVoucherOccurrence(
  schedule: Record<string, unknown>,
  now = new Date()
): UpcomingVoucherOccurrence | null {
  const mode = String(schedule.mode || 'always').trim();
  if (mode === 'always' || mode === 'birthday') return null;

  const current = getKualaLumpurDateParts(now);
  const activeDays = Array.isArray(schedule.activeDays)
    ? schedule.activeDays.map((day) => String(day))
    : [];
  const annualDate = typeof schedule.annualDate === 'string' ? schedule.annualDate : '';
  const monthlyDay = Number(schedule.monthlyDay ?? 0);
  const endTime = typeof schedule.endTime === 'string' ? schedule.endTime : '';
  const [endHour, endMinute] = /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
    ? endTime.split(':').map(Number)
    : [23, 59];
  const weekdayFormatter = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    timeZone: 'UTC'
  });

  for (let offset = 0; offset <= 370; offset += 1) {
    const candidate = new Date(Date.UTC(
      Number(current.year),
      Number(current.month) - 1,
      Number(current.day) + offset
    ));
    const year = String(candidate.getUTCFullYear());
    const month = String(candidate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(candidate.getUTCDate()).padStart(2, '0');
    const monthDay = `${month}-${day}`;
    const dateKey = `${year}-${month}-${day}`;
    const weekday = weekdayFormatter.format(candidate);

    const matches = mode === 'daily' ||
      (mode === 'weekly' && activeDays.includes(weekday)) ||
      (mode === 'monthly' && monthlyDay === Number(day)) ||
      (mode === 'annual' && annualDate === monthDay);
    if (!matches) continue;

    const expiresAt = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), endHour, endMinute + 1) -
        8 * 60 * 60 * 1000 - 1
    );
    if (expiresAt.getTime() <= now.getTime()) continue;

    return { expiresAt, dateKey, year, month, monthDay };
  }

  return null;
}

function recurringIssueCaseRefForOccurrence(
  scheduleMode: string,
  occurrence: UpcomingVoucherOccurrence
): string | null {
  switch (scheduleMode) {
    case 'annual':
      return `annual:${occurrence.monthDay}:${occurrence.year}`;
    case 'monthly':
      return `monthly:${occurrence.year}-${occurrence.month}`;
    case 'weekly':
    case 'daily':
      return `${scheduleMode}:${occurrence.dateKey}`;
    default:
      return null;
  }
}

function recurringIssueCaseRef(
  scheduleMode: string,
  currentDate: ReturnType<typeof getKualaLumpurDateParts>
): string | null {
  switch (scheduleMode) {
    case 'birthday':
      return `birthday:${currentDate.year}`;
    case 'annual':
      return `annual:${currentDate.monthDay}:${currentDate.year}`;
    case 'monthly':
      return `monthly:${currentDate.year}-${currentDate.month}`;
    case 'weekly':
      return `weekly:${currentDate.dateKey}`;
    case 'daily':
      return `daily:${currentDate.dateKey}`;
    default:
      return null;
  }
}

function getKualaLumpurMonthEndUtc(now = new Date()): Date {
  const parts = getKualaLumpurDateParts(now);
  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month), 1) - 8 * 60 * 60 * 1000
  );
}

function earliestDate(first: Date, second: Date | null): Date {
  return second && second.getTime() < first.getTime() ? second : first;
}

function formatVoucherTime(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) return null;
  const [hourRaw, minute] = normalized.split(':');
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function formatVoucherDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur'
  }).format(value);
}

function buildCustomerVoucherValidityLabel(
  schedule: Record<string, unknown>,
  effectiveExpiresAt: Date,
  hasFixedExpiry: boolean,
  upcomingOccurrence: UpcomingVoucherOccurrence | null = null
): string {
  if (!hasFixedExpiry) return 'Valid while your current tier remains active';

  const mode = String(schedule.mode || 'always').trim();
  if (mode === 'daily' || mode === 'weekly' || mode === 'monthly' || mode === 'annual') {
    const start = formatVoucherTime(schedule.startTime);
    const end = formatVoucherTime(schedule.endTime);
    if (upcomingOccurrence) {
      const occurrenceDate = new Date(Date.UTC(
        Number(upcomingOccurrence.year),
        Number(upcomingOccurrence.month) - 1,
        Number(upcomingOccurrence.monthDay.slice(3)),
        12
      ));
      const dateLabel = new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(occurrenceDate);
      return start && end
        ? `Next: ${dateLabel}, ${start} - ${end}`
        : `Next: ${dateLabel}`;
    }
    return start && end ? `Today, ${start} - ${end}` : 'Available today';
  }

  if (mode === 'birthday') {
    return `Birthday reward · redeem by ${formatVoucherDate(effectiveExpiresAt)}`;
  }

  return `Redeem by ${formatVoucherDate(effectiveExpiresAt)}`;
}

async function syncCurrentTierAchievementRewards(
  userId: number,
  currentTier: string | null,
  qualifyingCups: number
): Promise<void> {
  if (!currentTier) return;

  const tiers = getActiveLoyaltyTiers(await loadLoyaltyTiers());
  const tier = getTierByCode(tiers, currentTier);
  const templateIds = tier?.rewardConfig?.voucherTemplateIds ?? [];

  // Tier rewards are current-tier benefits, not a cumulative catalogue. Keep
  // history, but make every previous-tier or superseded entitlement unusable.
  await mysqlPool.execute(
    `
      UPDATE user_tier_reward_entitlements
      SET status = 'revoked',
          revoked_reason = 'Superseded by the customer current tier',
          revoked_at = UTC_TIMESTAMP()
      WHERE user_id = :userId
        AND status = 'claimable'
        AND (
          tier_code <> :currentTier
          OR :currentTemplateIds = '[]'
          OR NOT JSON_CONTAINS(CAST(:currentTemplateIds AS JSON), CAST(voucher_template_id AS JSON))
        )
    `,
    {
      userId,
      currentTier,
      currentTemplateIds: JSON.stringify(templateIds)
    }
  );

  await mysqlPool.execute(
    `
      UPDATE user_vouchers
      SET status = 'revoked',
          revoked_reason = 'Superseded by the customer current tier',
          revoked_at = UTC_TIMESTAMP()
      WHERE user_id = :userId
        AND status = 'active'
        AND redeemed_at IS NULL
        AND revoked_at IS NULL
        AND (
          issue_case_ref LIKE 'tier_claim:%'
          OR issue_case_ref LIKE 'tier_unlock:%'
        )
        AND (tier_at_issue IS NULL OR tier_at_issue <> :currentTier)
    `,
    { userId, currentTier }
  );

  if (!tier || templateIds.length === 0) return;

  // Achievement rewards are normally unlocked when a collected order crosses
  // a threshold. This backfill creates a claimable entitlement when rewards are
  // configured after a member has already reached their current tier.
  const hasReachedTier = tier.minCups === 0
    ? qualifyingCups >= 1
    : qualifyingCups >= tier.minCups;
  if (!hasReachedTier) return;

  for (const voucherTemplateId of templateIds) {
    const [limitRows] = await mysqlPool.query<Array<RowDataPacket & { limit_per_user: number | null }>>(
      'SELECT limit_per_user FROM voucher_templates WHERE id = :voucherTemplateId LIMIT 1',
      { voucherTemplateId }
    );
    const claimCount = Math.max(1, Math.min(20, Number(limitRows[0]?.limit_per_user ?? 1) || 1));

    for (let claimNumber = 1; claimNumber <= claimCount; claimNumber += 1) {
      await mysqlPool.execute(
        `
          INSERT IGNORE INTO user_tier_reward_entitlements (
            user_id, tenant_id, voucher_template_id, tier_code, status,
            issue_case_ref, unlocked_at
          )
          SELECT
            :userId, vt.tenant_id, vt.id, :tierCode, 'claimable',
            :issueCaseRef, UTC_TIMESTAMP()
          FROM voucher_templates vt
          JOIN customer_tenant_memberships ctm
            ON ctm.tenant_id = vt.tenant_id
           AND ctm.user_id = :userId
          WHERE vt.id = :voucherTemplateId
            AND vt.is_active = 1
            AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
        `,
        {
          userId,
          voucherTemplateId,
          // First claim keeps the legacy reference so existing rows stay valid.
          issueCaseRef: claimNumber === 1
            ? `tier_unlock:${tier.code}:${voucherTemplateId}`
            : `tier_unlock:${tier.code}:${voucherTemplateId}:${claimNumber}`,
          tierCode: tier.code
        }
      );
    }
  }
}

async function syncTierBirthdayRewards(
  userId: number,
  currentTier: string | null,
  birthdayMonthDay: string | null,
  currentDateParts: ReturnType<typeof getKualaLumpurDateParts>
): Promise<void> {
  const isBirthdayMonth = Boolean(
    birthdayMonthDay && birthdayMonthDay.slice(0, 2) === currentDateParts.month
  );

  if (!isBirthdayMonth) {
    await mysqlPool.execute(
      `
        UPDATE user_vouchers uv
        JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
        SET uv.status = 'revoked',
            uv.revoked_reason = 'Birthday reward is only available during the birthday month',
            uv.revoked_at = UTC_TIMESTAMP()
        WHERE uv.user_id = :userId
          AND uv.status = 'active'
          AND (
            uv.issue_case_ref LIKE 'tier_birthday:%'
            OR uv.issue_case_ref LIKE 'birthday:%'
            OR vt.voucher_type = 'birthday_treat'
            OR JSON_UNQUOTE(JSON_EXTRACT(vt.eligible_scope_json, '$.schedule.mode')) = 'birthday'
            OR EXISTS (
              SELECT 1
              FROM loyalty_tiers lt
              WHERE JSON_CONTAINS(
                COALESCE(lt.reward_config_json, JSON_OBJECT()),
                JSON_ARRAY(uv.voucher_template_id),
                '$.birthdayVoucherTemplateIds'
              )
            )
          )
      `,
      { userId }
    );
  }

  if (!currentTier || !birthdayMonthDay || birthdayMonthDay.slice(0, 2) !== currentDateParts.month) {
    return;
  }

  const tiers = getActiveLoyaltyTiers(await loadLoyaltyTiers());
  const tier = getTierByCode(tiers, currentTier);
  if (!tier) return;
  const templateIds = (tier.rewardConfig?.birthdayVoucherTemplateIds ?? []).slice(0, 1);
  const configuredTemplateId = templateIds[0] ?? null;
  const expectedIssueCaseRef = configuredTemplateId == null
    ? `birthday:${currentDateParts.year}`
    : `tier_birthday:${currentDateParts.year}:${tier.code}:${configuredTemplateId}`;

  // Keep exactly one current-year birthday benefit. This also retires legacy,
  // manually extended, and previous-tier birthday grants that would otherwise
  // remain visible during the customer's birthday month.
  await mysqlPool.execute(
    `
      UPDATE user_vouchers uv
      JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
      SET uv.status = 'revoked',
          uv.revoked_reason = 'Superseded by the current birthday reward',
          uv.revoked_at = UTC_TIMESTAMP()
      WHERE uv.user_id = :userId
        AND uv.status = 'active'
        AND (
          uv.issue_case_ref LIKE 'tier_birthday:%'
          OR uv.issue_case_ref LIKE 'birthday:%'
          OR vt.voucher_type = 'birthday_treat'
          OR JSON_UNQUOTE(JSON_EXTRACT(vt.eligible_scope_json, '$.schedule.mode')) = 'birthday'
          OR EXISTS (
            SELECT 1
            FROM loyalty_tiers lt
            WHERE JSON_CONTAINS(
              COALESCE(lt.reward_config_json, JSON_OBJECT()),
              JSON_ARRAY(uv.voucher_template_id),
              '$.birthdayVoucherTemplateIds'
            )
          )
        )
        AND NOT (
          uv.issue_case_ref = :expectedIssueCaseRef
          AND (
            :configuredTemplateId IS NULL
            OR uv.voucher_template_id = :configuredTemplateId
          )
        )
    `,
    {
      userId,
      expectedIssueCaseRef,
      configuredTemplateId
    }
  );

  if (templateIds.length === 0) return;

  for (const voucherTemplateId of templateIds) {
    await issueAutoVisibleVoucherAtomically({
      userId,
      templateId: voucherTemplateId,
      issuedReason: `Birthday-month tier reward: ${tier.name}`,
      issueCaseRef: `tier_birthday:${currentDateParts.year}:${tier.code}:${voucherTemplateId}`,
      tierAtIssue: tier.code,
      expiresAt: getKualaLumpurMonthEndUtc(),
      recurring: true
    });
  }
}

async function syncAutoVisibleVoucherTemplates(
  userId: number
): Promise<void> {
  const activeTiers = getActiveLoyaltyTiers(await loadLoyaltyTiers());
  const [profileRows] = await mysqlPool.query<
    Array<RowDataPacket & { birthday_month_day: string | null }>
  >(
    `
      SELECT DATE_FORMAT(up.birthday, '%m-%d') AS birthday_month_day
      FROM user_profiles up
      WHERE up.user_id = :userId
      LIMIT 1
    `,
    { userId }
  );

  const [tierRows] = await mysqlPool.query<
    Array<RowDataPacket & { tier_code: string | null; qualifying_cups_last_180d: number }>
  >(
    `
      SELECT tier_code, qualifying_cups_last_180d
      FROM loyalty_tier_snapshots
      WHERE user_id = :userId
      ORDER BY effective_at DESC, id DESC
      LIMIT 1
    `,
    { userId }
  );

  const currentBirthdayMonthDay = profileRows[0]?.birthday_month_day ?? null;
  const snapshotTier = normalizeVoucherTierScope(tierRows[0]?.tier_code, activeTiers);
  const currentTier = snapshotTier ?? activeTiers[0]?.code ?? null;
  const currentDateParts = getKualaLumpurDateParts();

  await syncCurrentTierAchievementRewards(
    userId,
    currentTier,
    Number(tierRows[0]?.qualifying_cups_last_180d ?? 0)
  );
  await syncTierBirthdayRewards(userId, currentTier, currentBirthdayMonthDay, currentDateParts);

  const tierManagedTemplateIds = new Set(activeTiers.flatMap((tier) => [
    ...(tier.rewardConfig?.voucherTemplateIds ?? []),
    ...(tier.rewardConfig?.birthdayVoucherTemplateIds ?? [])
  ]));
  const hasTierBirthdayReward = activeTiers.some(
    (tier) => tier.code === currentTier &&
      (tier.rewardConfig?.birthdayVoucherTemplateIds?.length ?? 0) > 0
  );

  const [templates] = await mysqlPool.query<Array<AutoSyncVoucherTemplateRow & { is_employee: number }>>(
    `
      SELECT
        vt.id,
        vt.code,
        vt.name,
        vt.is_referral_reward,
        vt.expires_in_days,
        vt.valid_until,
        vt.total_quantity,
        vt.limit_per_user,
        vt.eligible_scope_json,
        ctm.is_employee
      FROM voucher_templates vt
      JOIN customer_tenant_memberships ctm
        ON ctm.tenant_id = vt.tenant_id AND ctm.user_id = :userId
      WHERE vt.is_active = 1
        AND vt.voucher_type <> 'tier_reward'
        AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
        AND NOT EXISTS (
          SELECT 1
          FROM referral_programs rp
          WHERE rp.tenant_id = vt.tenant_id
            AND (rp.friend_voucher_template_id = vt.id OR rp.referrer_voucher_template_id = vt.id)
        )
      ORDER BY vt.created_at DESC, vt.id DESC
    `,
    { userId }
  );

  const [existingRows] = await mysqlPool.query<
    Array<RowDataPacket & { voucher_template_id: number; issue_case_ref: string | null }>
  >(
    `
      SELECT DISTINCT voucher_template_id, issue_case_ref
      FROM user_vouchers
      WHERE user_id = :userId
    `,
    { userId }
  );

  const existingIssueKeys = new Set(
    existingRows.map((row) => `${Number(row.voucher_template_id)}::${row.issue_case_ref ?? ''}`)
  );
  const existingIssueRefs = new Set(
    existingRows.map((row) => row.issue_case_ref).filter((value): value is string => Boolean(value))
  );
  const existingTemplateIds = new Set(
    existingRows.map((row) => Number(row.voucher_template_id))
  );
  const [currentSystemRows] = await mysqlPool.query<Array<RowDataPacket & { voucher_template_id: number }>>(
    `
      SELECT DISTINCT voucher_template_id
      FROM user_vouchers
      WHERE user_id = :userId
        AND issued_by_type = 'system'
        AND status = 'active'
        AND revoked_at IS NULL
        AND expires_at > UTC_TIMESTAMP()
    `,
    { userId }
  );
  const currentSystemTemplateIds = new Set(
    currentSystemRows.map((row) => Number(row.voucher_template_id))
  );

  for (const template of templates) {
    // Do not auto-issue historical legacy referral vouchers.
    if (Number(template.is_referral_reward ?? 0) === 1) {
      continue;
    }
    // Tier-managed templates have their own controlled issuance paths. They
    // must never be picked up as public campaigns by this generic synchronizer.
    if (tierManagedTemplateIds.has(Number(template.id))) {
      continue;
    }

    const scope = parseVoucherScope(template.eligible_scope_json);
    // Top-up rewards are issued only by the paid top-up settlement path.
    // Treating them as ordinary campaigns would expose the reward before the
    // configured minimum top-up has been completed.
    if (getVoucherTopUpMinimum(scope) !== null) {
      continue;
    }
    const scheduleMode = getVoucherScheduleMode(scope);
    const schedule = getVoucherSchedule(scope);

    // A member receives either the configured tier birthday reward or one
    // generic birthday campaign, never both.
    if (scheduleMode === 'birthday' && hasTierBirthdayReward) {
      continue;
    }

    const scheduleActiveNow = isScheduleActiveNow(schedule, currentBirthdayMonthDay);
    const upcomingOccurrence = scheduleActiveNow
      ? null
      : getUpcomingVoucherOccurrence(schedule);
    if (!scheduleActiveNow && !upcomingOccurrence) {
      continue;
    }

    const recurringRef = upcomingOccurrence
      ? recurringIssueCaseRefForOccurrence(scheduleMode, upcomingOccurrence)
      : recurringIssueCaseRef(scheduleMode, currentDateParts);
    const issueCaseRef = recurringRef ?? `campaign:${template.id}`;

    // A customer should never receive a second still-valid automatic copy of
    // the same campaign. The issue-case key protects the same recurring
    // period; this guard also consolidates older duplicate automatic issues.
    if (recurringRef !== null && currentSystemTemplateIds.has(Number(template.id))) {
      continue;
    }

    if (
      (recurringRef === null
        ? existingTemplateIds.has(Number(template.id))
        : existingIssueKeys.has(`${template.id}::${issueCaseRef}`)) ||
      (scheduleMode === 'birthday' && existingIssueRefs.has(issueCaseRef))
    ) {
      continue;
    }

    if (!isAutoVisibleAudience(scope, Number(template.is_employee) === 1)) {
      continue;
    }

    const eligibleTier = normalizeVoucherTierScope(scope['tier'], activeTiers);
    // An unknown scope must fail closed. Treating a misspelled or retired tier
    // as an all-tier campaign would grant an unintended customer benefit.
    if (eligibleTier === undefined || (eligibleTier !== null && eligibleTier !== currentTier)) {
      continue;
    }

    const expiresAt = upcomingOccurrence
      ? earliestDate(upcomingOccurrence.expiresAt, template.valid_until)
      : scheduleMode === 'birthday'
      ? getKualaLumpurMonthEndUtc()
      : scheduleMode === 'annual' || scheduleMode === 'monthly' || scheduleMode === 'weekly' || scheduleMode === 'daily'
        ? earliestDate(
            getKualaLumpurOccurrenceEndUtc(
              typeof schedule.endTime === 'string' ? schedule.endTime : null
            ),
            template.valid_until
          )
        : resolveAutoIssuedVoucherExpiry(template);
    if (expiresAt.getTime() <= Date.now()) {
      continue;
    }

    const issued = await issueAutoVisibleVoucherAtomically({
      userId,
      templateId: Number(template.id),
      issuedReason:
        scheduleMode === 'birthday'
          ? `Birthday voucher: ${template.name}`
          : scheduleMode === 'annual'
            ? `Annual voucher: ${template.name}`
          : scheduleMode === 'monthly'
              ? `Monthly voucher: ${template.name}`
              : scheduleMode === 'daily'
                ? `Daily employee voucher: ${template.name}`
                : `Campaign voucher: ${template.name}`,
      expiresAt,
      issueCaseRef,
      tierAtIssue: currentTier,
      recurring: recurringRef !== null
    });

    if (issued) {
      existingIssueKeys.add(`${template.id}::${issueCaseRef}`);
      existingTemplateIds.add(Number(template.id));
      currentSystemTemplateIds.add(Number(template.id));
    }
  }
}

async function resolveEmployeeSubsidyTenant(
  userId: number,
  storeId?: number
): Promise<number | null> {
  if (storeId !== undefined) {
    const [rows] = await mysqlPool.query<Array<RowDataPacket & { tenant_id: number }>>(
      `SELECT ctm.tenant_id
         FROM customer_tenant_memberships ctm
         JOIN stores s ON s.tenant_id = ctm.tenant_id
        WHERE ctm.user_id = :userId
          AND ctm.subsidy_role <> 'none'
          AND s.id = :storeId
        LIMIT 1`,
      { userId, storeId }
    );
    return rows[0] ? Number(rows[0].tenant_id) : null;
  }

  const [rows] = await mysqlPool.query<Array<RowDataPacket & { tenant_id: number }>>(
    `SELECT tenant_id
       FROM customer_tenant_memberships
      WHERE user_id = :userId AND subsidy_role <> 'none'
      ORDER BY tenant_id
      LIMIT 2`,
    { userId }
  );
  return rows.length === 1 ? Number(rows[0].tenant_id) : null;
}

export async function registerCustomerDataRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post('/v1/devices/push-token', { preHandler: authenticateRequest }, async (request) => {
    const payload = pushTokenSchema.parse(request.body ?? {});

    const [deviceRows] = await mysqlPool.query<Array<RowDataPacket & { device_id: number }>>(
      `
        SELECT d.id AS device_id
        FROM sessions s
        JOIN devices d ON d.id = s.device_id
        WHERE s.id = :sessionId
          AND s.user_id = :userId
          AND s.revoked_at IS NULL
          AND d.user_id = :userId
          AND d.device_fingerprint = :deviceFingerprint
        LIMIT 1
      `,
      {
        sessionId: request.auth.sessionId,
        userId: request.auth.userId,
        deviceFingerprint: payload.device_fingerprint
      }
    );

    const device = deviceRows[0];
    if (!device) {
      throw new ApiError(409, 'device_session_mismatch', 'Register notifications from the device used to sign in.');
    }

    await mysqlPool.execute(
      `
        UPDATE devices
        SET platform = :platform,
            app_version = :appVersion,
            last_seen_at = UTC_TIMESTAMP()
        WHERE id = :deviceId
      `,
      {
        deviceId: device.device_id,
        platform: payload.platform,
        appVersion: payload.app_version ?? null
      }
    );

    // FCM tokens rotate, including when an iPhone moves between a development
    // install and TestFlight. Keep exactly one active token per physical device
    // so stale sandbox tokens are not counted as successful production sends.
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE push_tokens
         SET status = 'inactive', last_seen_at = UTC_TIMESTAMP()
         WHERE device_id = :deviceId
           AND push_token <> :pushToken
           AND status = 'active'`,
        {
          deviceId: device.device_id,
          pushToken: payload.push_token
        }
      );

      // A token can move to a different signed-in account on the same device.
      // The unique token key makes the registration safe to repeat after refresh.
      await connection.execute(
        `
          INSERT INTO push_tokens (
            user_id,
            device_id,
            platform,
            push_token,
            status,
            created_at,
            last_seen_at
          )
          VALUES (
            :userId,
            :deviceId,
            :platform,
            :pushToken,
            'active',
            UTC_TIMESTAMP(),
            UTC_TIMESTAMP()
          )
          ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            device_id = VALUES(device_id),
            platform = VALUES(platform),
            status = 'active',
            last_seen_at = UTC_TIMESTAMP()
        `,
        {
          userId: request.auth.userId,
          deviceId: device.device_id,
          platform: payload.platform,
          pushToken: payload.push_token
        }
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    request.log.info(
      {
        userId: request.auth.userId,
        deviceId: device.device_id,
        platform: payload.platform,
        appVersion: payload.app_version ?? null,
        tokenFingerprint: crypto.createHash('sha256').update(payload.push_token).digest('hex').slice(0, 12)
      },
      'Customer push token registered.'
    );

    return { registered: true };
  });

  app.post('/v1/devices/push-token/deactivate', { preHandler: authenticateRequest }, async (request) => {
    const payload = deactivatePushTokenSchema.parse(request.body ?? {});

    await mysqlPool.execute(
      `
        UPDATE push_tokens
        SET status = 'inactive',
            last_seen_at = UTC_TIMESTAMP()
        WHERE user_id = :userId
          AND push_token = :pushToken
      `,
      {
        userId: request.auth.userId,
        pushToken: payload.push_token
      }
    );

    return { deactivated: true };
  });

  app.get('/v1/notifications', { preHandler: authenticateRequest }, async (request) => {
    const { limit } = notificationListQuerySchema.parse(request.query);

    let rows: Array<NotificationRow> = [];
    try {
      const [result] = await mysqlPool.query<Array<NotificationRow>>(
        `
          SELECT
            id,
            type,
            title,
            body,
            data_json,
            sent_at,
            read_at,
            created_at
          FROM notifications
          WHERE user_id = :userId
            AND cleared_at IS NULL
          ORDER BY read_at IS NULL DESC, created_at DESC, id DESC
          LIMIT :limit
        `,
        {
          userId: request.auth.userId,
          limit
        }
      );
      rows = result;
    } catch (error) {
      const err = error as { code?: string; sqlMessage?: string };
      if (err.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }
      console.warn(
        `[notifications] skipped notification list because the table is missing: ${err.sqlMessage ?? 'unknown SQL error'}`
      );
    }

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: publicNotificationText(row.title, 'Account update', 120),
        body: publicNotificationText(
          row.body,
          'There is an update to your C2 Coffee account.',
          420
        ),
        data: publicNotificationData(row.data_json),
        is_read: row.read_at !== null,
        created_at: row.created_at.toISOString()
      }))
    };
  });

  app.get('/v1/payment-service-notices', { preHandler: authenticateRequest }, async (request) => {
    const [rows] = await mysqlPool.query<PaymentServiceNoticeRow[]>(
      `SELECT psn.id, psn.title, psn.message, psn.payment_methods_json,
              psn.starts_at, psn.ends_at, psn.created_at,
              CASE WHEN psnd.notice_id IS NULL THEN 0 ELSE 1 END AS is_popup_dismissed
       FROM payment_service_notices psn
       JOIN customer_tenant_memberships ctm
         ON ctm.tenant_id = psn.tenant_id AND ctm.user_id = :userId
       LEFT JOIN payment_service_notice_dismissals psnd
         ON psnd.notice_id = psn.id AND psnd.user_id = :userId
       WHERE psn.status = 'active'
         AND psn.ends_at > UTC_TIMESTAMP()
       ORDER BY psn.starts_at ASC, psn.id ASC
       LIMIT 20`,
      { userId: request.auth.userId }
    );

    return {
      notices: rows.map((row) => {
        let methods: unknown = row.payment_methods_json;
        if (typeof methods === 'string') {
          try {
            methods = JSON.parse(methods);
          } catch {
            methods = [];
          }
        }
        return {
          id: row.id,
          title: publicNotificationText(row.title, 'Payment service maintenance', 160),
          message: publicNotificationText(row.message, 'A payment service will be temporarily unavailable.', 600),
          payment_methods: Array.isArray(methods)
            ? methods.filter((method) => method === 'fpx' || method === 'duitnow_qr')
            : [],
          starts_at: row.starts_at.toISOString(),
          ends_at: row.ends_at.toISOString(),
          created_at: row.created_at.toISOString(),
          is_popup_dismissed: row.is_popup_dismissed === 1
        };
      })
    };
  });

  app.post('/v1/payment-service-notices/:noticeId/dismiss-popup', { preHandler: authenticateRequest }, async (request) => {
    const { noticeId } = paymentServiceNoticeParamsSchema.parse(request.params);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO payment_service_notice_dismissals (notice_id, user_id, dismissed_at)
       SELECT psn.id, :userId, UTC_TIMESTAMP()
       FROM payment_service_notices psn
       JOIN customer_tenant_memberships ctm
         ON ctm.tenant_id = psn.tenant_id AND ctm.user_id = :userId
       WHERE psn.id = :noticeId
         AND psn.status = 'active'
         AND psn.ends_at > UTC_TIMESTAMP()
       ON DUPLICATE KEY UPDATE dismissed_at = VALUES(dismissed_at)`,
      { noticeId, userId: request.auth.userId }
    );
    if (result.affectedRows === 0) {
      throw new ApiError(404, 'payment_service_notice_not_found', 'Payment service notice was not found.');
    }
    return { dismissed: true };
  });

  app.post('/v1/notifications/:notificationId/read', { preHandler: authenticateRequest }, async (request) => {
    const { notificationId } = notificationIdParamsSchema.parse(request.params);
    await mysqlPool.execute(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, UTC_TIMESTAMP())
       WHERE id = :notificationId AND user_id = :userId`,
      { notificationId, userId: request.auth.userId }
    );
    return { updated: true };
  });

  app.delete('/v1/notifications', { preHandler: authenticateRequest }, async (request) => {
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE notifications
       SET cleared_at = UTC_TIMESTAMP()
       WHERE user_id = :userId
         AND cleared_at IS NULL`,
      { userId: request.auth.userId }
    );

    return { cleared: result.affectedRows };
  });

  app.get('/v1/notification-preferences', { preHandler: authenticateRequest }, async (request) => {
    const [rows] = await mysqlPool.query<Array<RowDataPacket & { marketing_enabled: number }>>(
      `SELECT marketing_enabled FROM customer_notification_preferences WHERE user_id = :userId LIMIT 1`,
      { userId: request.auth.userId }
    );
    return { marketing_enabled: rows[0]?.marketing_enabled !== 0 };
  });

  app.put('/v1/notification-preferences', { preHandler: authenticateRequest }, async (request) => {
    const payload = notificationPreferencesSchema.parse(request.body);
    await mysqlPool.execute(
      `INSERT INTO customer_notification_preferences (user_id, marketing_enabled)
       VALUES (:userId, :marketingEnabled)
       ON DUPLICATE KEY UPDATE marketing_enabled = VALUES(marketing_enabled), updated_at = UTC_TIMESTAMP()`,
      { userId: request.auth.userId, marketingEnabled: payload.marketing_enabled ? 1 : 0 }
    );
    return { marketing_enabled: payload.marketing_enabled };
  });

  app.get('/v1/subsidy', { preHandler: authenticateRequest }, async (request) => {
    const query = subsidyStoreQuerySchema.parse(request.query);
    const tenantId = await resolveEmployeeSubsidyTenant(
      request.auth.userId,
      query.store_id
    );
    if (tenantId === null) {
      return { eligible: false, enabled: false, role: 'none', allowance_mode: 'none', remaining: 0, granted: 0, used: 0 };
    }
    return getEmployeeSubsidyStatus(request.auth.userId, tenantId);
  });

  app.put('/v1/subsidy', { preHandler: authenticateRequest }, async (request) => {
    const body = subsidyPreferenceSchema.parse(request.body ?? {});
    const tenantId = await resolveEmployeeSubsidyTenant(
      request.auth.userId,
      body.store_id
    );
    if (tenantId === null) {
      throw new ApiError(403, 'subsidy_unavailable', 'Subsidy is not available for this account.');
    }
    await setEmployeeSubsidyEnabled(request.auth.userId, tenantId, body.enabled);
    return getEmployeeSubsidyStatus(request.auth.userId, tenantId);
  });

  app.get('/v1/wallet/transactions', { preHandler: authenticateRequest }, async (request) => {
    const { limit } = listQuerySchema.parse(request.query);

    const [rows] = await mysqlPool.query<Array<WalletTransactionRow>>(
      `
        SELECT
          id,
          direction,
          source_type,
          source_id,
          amount,
          balance_after,
          remarks,
          created_at
        FROM token_ledger
        WHERE user_id = :userId
        ORDER BY created_at DESC, id DESC
        LIMIT :limit
      `,
      {
        userId: request.auth.userId,
        limit
      }
    );

    return {
      transactions: rows.map((row) => ({
        id: row.id,
        direction: row.direction,
        source_type: row.source_type,
        source_id: row.source_id,
        amount: row.amount,
        balance_after: row.balance_after,
        remarks: row.remarks,
        created_at: row.created_at.toISOString()
      }))
    };
  });

  app.get('/v1/rewards/vouchers', { preHandler: authenticateRequest }, async (request) => {
    const { limit, include_history: includeHistory, include_tier_rewards: includeTierRewards } = rewardVoucherListQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    const [welcomeRows] = await mysqlPool.query<
      Array<RowDataPacket & { id: number; expires_in_days: number }>
    >(
      `
        SELECT vt.id, vt.expires_in_days
        FROM voucher_templates vt
        JOIN customer_tenant_memberships ctm
          ON ctm.tenant_id = vt.tenant_id
         AND ctm.user_id = :userId
        WHERE vt.code = 'WELCOME10'
          AND vt.is_active = 1
          AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
          AND NOT EXISTS (
            SELECT 1
            FROM user_vouchers uv
            WHERE uv.user_id = :userId
              AND uv.voucher_template_id = vt.id
          )
      `,
      { userId }
    );

    for (const tpl of welcomeRows) {
      await issueAutoVisibleVoucherAtomically({
        userId,
        templateId: tpl.id,
        issuedReason: 'Welcome Gift Voucher',
        issueCaseRef: `welcome:${tpl.id}`,
        tierAtIssue: null,
        expiresAt: new Date(Date.now() + (tpl.expires_in_days || 30) * 24 * 60 * 60 * 1000),
        recurring: false
      });
    }

    await syncAutoVisibleVoucherTemplates(userId);

    const voucherVisibilityFilter = includeHistory
      ? 'uv.user_id = :userId'
      : `
          uv.user_id = :userId
          AND uv.status = 'active'
          AND uv.redeemed_at IS NULL
          AND uv.revoked_at IS NULL
          AND uv.expires_at > UTC_TIMESTAMP()
          AND vt.is_active = 1
          AND (
            vt.voucher_type = 'birthday_treat'
            OR vt.valid_until IS NULL
            OR vt.valid_until > UTC_TIMESTAMP()
          )
        `;

    const tierRewardFilter = includeTierRewards
      ? ''
      : "AND (uv.issue_case_ref IS NULL OR uv.issue_case_ref NOT LIKE 'tier_unlock:%')";

    const [rows] = await mysqlPool.query<Array<VoucherRow>>(
      `
      SELECT
          uv.id,
          uv.status,
          uv.issued_by_type,
          uv.issued_reason,
          uv.issue_case_ref,
          uv.tier_at_issue,
          uv.issued_at,
          uv.expires_at,
          vt.valid_until AS template_valid_until,
          uv.redeemed_at,
          uv.revoked_at,
          uv.revoked_reason,
          vt.id AS template_id,
          vt.code AS template_code,
          vt.name AS template_name,
          vt.image_url AS template_image_url,
          vt.voucher_type,
          vt.discount_mode,
          CAST(vt.discount_value AS CHAR) AS discount_value,
          vt.token_value,
          CAST(vt.min_spend_rm AS CHAR) AS min_spend_rm,
          vt.requires_drink_in_cart,
          vt.eligible_scope_json,
          vt.exclude_scope_json
        FROM user_vouchers uv
        JOIN voucher_templates vt
          ON vt.id = uv.voucher_template_id
        WHERE ${voucherVisibilityFilter}
          ${tierRewardFilter}
        ORDER BY uv.issued_at DESC, uv.id DESC
        LIMIT :limit
      `,
      {
        userId,
        limit
      }
    );

    const [claimableTierRewards] = await mysqlPool.query<Array<TierRewardEntitlementRow>>(
      `
        SELECT
          utre.id,
          utre.status,
          utre.issue_case_ref,
          utre.tier_code,
          utre.unlocked_at,
          vt.id AS template_id,
          vt.code AS template_code,
          vt.name AS template_name,
          vt.image_url AS template_image_url,
          vt.voucher_type,
          vt.discount_mode,
          CAST(vt.discount_value AS CHAR) AS discount_value,
          vt.token_value,
          CAST(vt.min_spend_rm AS CHAR) AS min_spend_rm,
          vt.requires_drink_in_cart,
          vt.eligible_scope_json,
          vt.exclude_scope_json
        FROM user_tier_reward_entitlements utre
        JOIN voucher_templates vt ON vt.id = utre.voucher_template_id
        JOIN loyalty_tiers lt
          ON lt.code = utre.tier_code
         AND lt.is_active = 1
         AND JSON_CONTAINS(COALESCE(JSON_EXTRACT(lt.reward_config_json, '$.voucherTemplateIds'), JSON_ARRAY()), CAST(utre.voucher_template_id AS JSON))
        JOIN loyalty_tier_snapshots current_tier
          ON current_tier.id = (
            SELECT latest.id
            FROM loyalty_tier_snapshots latest
            WHERE latest.user_id = utre.user_id
            ORDER BY latest.effective_at DESC, latest.id DESC
            LIMIT 1
          )
         AND current_tier.tier_code = utre.tier_code
        JOIN customer_tenant_memberships ctm
          ON ctm.user_id = utre.user_id
         AND ctm.tenant_id = utre.tenant_id
        WHERE utre.user_id = :userId
          AND utre.status = 'claimable'
          AND vt.is_active = 1
          AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
        ORDER BY utre.unlocked_at DESC, utre.id DESC
        LIMIT :limit
      `,
      { userId, limit }
    );

    // Active checkout/reward views show one usable benefit per template even
    // if legacy data contains multiple rows. History retains every record.
    const visibleVoucherRows = includeHistory
      ? rows
      : rows.filter((row, index, allRows) =>
          allRows.findIndex((candidate) => candidate.template_code === row.template_code) === index
        );

    const [lockedTopUpRows] = includeHistory
      ? [[] as LockedTopUpRewardRow[]]
      : await mysqlPool.query<Array<LockedTopUpRewardRow>>(
        `
          SELECT
            vt.id,
            vt.code,
            vt.name,
            vt.image_url,
            vt.voucher_type,
            vt.discount_mode,
            CAST(vt.discount_value AS CHAR) AS discount_value,
            vt.token_value,
            CAST(vt.min_spend_rm AS CHAR) AS min_spend_rm,
            vt.requires_drink_in_cart,
            vt.eligible_scope_json,
            vt.exclude_scope_json,
            vt.valid_until,
            vt.created_at,
            ctm.is_employee
          FROM voucher_templates vt
          JOIN customer_tenant_memberships ctm
            ON ctm.tenant_id = vt.tenant_id
           AND ctm.user_id = :userId
          WHERE vt.is_active = 1
            AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
            AND CAST(
              JSON_UNQUOTE(JSON_EXTRACT(vt.eligible_scope_json, '$.topup_reward.min_tokens'))
              AS UNSIGNED
            ) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM user_vouchers uv
              WHERE uv.user_id = :userId
                AND uv.voucher_template_id = vt.id
                AND uv.status = 'active'
                AND uv.revoked_at IS NULL
                AND uv.expires_at > UTC_TIMESTAMP()
                AND (
                  uv.issued_by_type = 'admin'
                  OR uv.issue_case_ref LIKE CONCAT('topup_reward:', vt.id, ':topup:%')
                )
            )
          ORDER BY vt.created_at DESC, vt.id DESC
          LIMIT :limit
        `,
        { userId, limit }
      );

    const activeTiers = getActiveLoyaltyTiers(await loadLoyaltyTiers());
    const [currentTierRows] = await mysqlPool.query<
      Array<RowDataPacket & { tier_code: string | null }>
    >(
      `SELECT tier_code
         FROM loyalty_tier_snapshots
        WHERE user_id = :userId
        ORDER BY effective_at DESC, id DESC
        LIMIT 1`,
      { userId }
    );
    const currentTier = normalizeVoucherTierScope(
      currentTierRows[0]?.tier_code,
      activeTiers
    ) ?? activeTiers[0]?.code ?? null;
    const lockedTopUpRewards = lockedTopUpRows
      .filter((row) => {
        const scope = parseVoucherScope(row.eligible_scope_json);
        if (!isAutoVisibleAudience(scope, Number(row.is_employee) === 1)) {
          return false;
        }
        const eligibleTier = normalizeVoucherTierScope(scope.tier, activeTiers);
        return eligibleTier !== undefined &&
          (eligibleTier === null || eligibleTier === currentTier);
      })
      .map((row) => {
        const scope = parseVoucherScope(row.eligible_scope_json);
        const minimumTokens = getVoucherTopUpMinimum(scope)!;
        const schedule = getVoucherSchedule(scope);
        const upcomingOccurrence = !isScheduleActiveNow(schedule, null)
          ? getUpcomingVoucherOccurrence(schedule)
          : null;
        const displayExpiry = row.valid_until ?? new Date('2099-12-31T15:59:59.999Z');
        return {
          // Locked previews are deliberately not real user-voucher IDs. Mobile
          // checkout accepts positive IDs only, providing another safety rail.
          id: -Number(row.id),
          status: 'active',
          issued_reason: 'Locked top-up reward',
          issue_case_ref: `locked_topup:${row.id}`,
          tier_at_issue: currentTier,
          issued_at: row.created_at.toISOString(),
          expires_at: displayExpiry.toISOString(),
          redeemed_at: null,
          revoked_at: null,
          revoked_reason: null,
          reward_kind: 'voucher',
          eligibility_status: 'unavailable',
          unavailable_reason: `Top up at least ${minimumTokens} C2 Tokens in one payment to unlock this voucher.`,
          has_fixed_expiry: row.valid_until !== null,
          validity_label: buildCustomerVoucherValidityLabel(
            schedule,
            displayExpiry,
            row.valid_until !== null,
            upcomingOccurrence
          ),
          template: {
            code: row.code,
            name: row.name,
            image_url: row.image_url,
            voucher_type: row.voucher_type,
            discount_mode: row.discount_mode,
            discount_value: row.discount_value,
            token_value: row.token_value,
            min_spend_rm: row.min_spend_rm,
            requires_drink_in_cart: row.requires_drink_in_cart === 1,
            usage_instructions: String(scope.usage_instructions ?? '').trim(),
            eligible_scope_json: row.eligible_scope_json,
            exclude_scope_json: row.exclude_scope_json
          }
        };
      });

    return {
      claimable_tier_rewards: claimableTierRewards.map((row) => ({
        id: row.id,
        status: row.status,
        issue_case_ref: row.issue_case_ref,
        tier_code: row.tier_code,
        unlocked_at: row.unlocked_at.toISOString(),
        reward_kind: 'tier_achievement',
        template: {
          id: row.template_id,
          code: row.template_code,
          name: row.template_name,
          image_url: row.template_image_url,
          voucher_type: row.voucher_type,
          discount_mode: row.discount_mode,
          discount_value: row.discount_value,
          token_value: row.token_value,
          min_spend_rm: row.min_spend_rm,
          requires_drink_in_cart: row.requires_drink_in_cart === 1,
          usage_instructions: String(
            parseVoucherScope(row.eligible_scope_json).usage_instructions ?? ''
          ).trim(),
          eligible_scope_json: row.eligible_scope_json,
          exclude_scope_json: row.exclude_scope_json
        }
      })),
      locked_topup_rewards: lockedTopUpRewards,
      vouchers: visibleVoucherRows.map((row) => {
        const effectiveExpiresAt = row.voucher_type !== 'birthday_treat'
          && row.template_valid_until !== null
          && row.template_valid_until < row.expires_at
          ? row.template_valid_until
          : row.expires_at;

        const scope = parseVoucherScope(row.eligible_scope_json);
        const topUpEligibility = evaluateVoucherTopUpEligibility({
          scope,
          templateId: Number(row.template_id),
          issueCaseRef: row.issue_case_ref,
          issuedByType: row.issued_by_type
        });
        const hasFixedExpiry = row.voucher_type !== 'tier_reward';
        const schedule = getVoucherSchedule(scope);
        const upcomingOccurrence = !isScheduleActiveNow(schedule, null)
          ? getUpcomingVoucherOccurrence(schedule)
          : null;

        return {
          id: row.id,
          status: row.redeemed_at !== null
            ? 'redeemed'
            : row.revoked_at !== null
              ? 'revoked'
              : effectiveExpiresAt <= new Date()
                ? 'expired'
                : row.status,
          issued_reason: row.issued_reason,
          issue_case_ref: row.issue_case_ref,
          tier_at_issue: row.tier_at_issue,
          issued_at: row.issued_at.toISOString(),
          expires_at: effectiveExpiresAt.toISOString(),
          redeemed_at: row.redeemed_at?.toISOString() ?? null,
          revoked_at: row.revoked_at?.toISOString() ?? null,
          revoked_reason: row.revoked_reason,
          reward_kind: row.issue_case_ref?.startsWith('tier_birthday:')
            ? 'tier_birthday'
            : row.issue_case_ref?.startsWith('tier_unlock:') || row.issue_case_ref?.startsWith('tier_claim:')
              ? 'tier_achievement'
              : 'voucher',
          eligibility_status: topUpEligibility.eligible ? 'eligible' : 'unavailable',
          unavailable_reason: topUpEligibility.unavailableReason,
          has_fixed_expiry: hasFixedExpiry,
          validity_label: buildCustomerVoucherValidityLabel(
            schedule,
            effectiveExpiresAt,
            hasFixedExpiry,
            upcomingOccurrence
          ),
          template: {
            code: row.template_code,
            name: row.template_name,
            image_url: row.template_image_url,
            voucher_type: row.voucher_type,
            discount_mode: row.discount_mode,
            discount_value: row.discount_value,
            token_value: row.token_value,
            min_spend_rm: row.min_spend_rm,
            requires_drink_in_cart: row.requires_drink_in_cart === 1,
            usage_instructions: String(scope.usage_instructions ?? '').trim(),
            eligible_scope_json: row.eligible_scope_json,
            exclude_scope_json: row.exclude_scope_json
          }
        };
      })
    };
  });

  app.post('/v1/rewards/tier-entitlements/:entitlementId/claim', {
    preHandler: authenticateRequest
  }, async (request) => {
    const { entitlementId } = tierRewardClaimParamsSchema.parse(request.params);
    const userId = request.auth.userId;
    const connection = await getUtcConnection();

    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<Array<TierRewardEntitlementRow>>(
        `
          SELECT
            utre.id,
            utre.status,
            utre.issue_case_ref,
            utre.tier_code,
            utre.unlocked_at,
            vt.id AS template_id,
            vt.code AS template_code,
            vt.name AS template_name,
            vt.image_url AS template_image_url,
            vt.voucher_type,
            vt.discount_mode,
            CAST(vt.discount_value AS CHAR) AS discount_value,
            vt.token_value,
            CAST(vt.min_spend_rm AS CHAR) AS min_spend_rm,
            vt.requires_drink_in_cart,
            vt.eligible_scope_json,
            vt.exclude_scope_json,
            vt.total_quantity,
            vt.limit_per_user
          FROM user_tier_reward_entitlements utre
          JOIN voucher_templates vt ON vt.id = utre.voucher_template_id
          JOIN loyalty_tiers lt
            ON lt.code = utre.tier_code
           AND lt.is_active = 1
           AND JSON_CONTAINS(COALESCE(JSON_EXTRACT(lt.reward_config_json, '$.voucherTemplateIds'), JSON_ARRAY()), CAST(utre.voucher_template_id AS JSON))
          JOIN loyalty_tier_snapshots current_tier
            ON current_tier.id = (
              SELECT latest.id
              FROM loyalty_tier_snapshots latest
              WHERE latest.user_id = utre.user_id
              ORDER BY latest.effective_at DESC, latest.id DESC
              LIMIT 1
            )
           AND current_tier.tier_code = utre.tier_code
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = utre.user_id
           AND ctm.tenant_id = utre.tenant_id
          WHERE utre.id = :entitlementId
            AND utre.user_id = :userId
            AND vt.is_active = 1
            AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
          LIMIT 1
          FOR UPDATE
        `,
        { entitlementId, userId }
      );
      const entitlement = rows[0];
      if (!entitlement) {
        throw new ApiError(404, 'tier_reward_not_found', 'This tier reward could not be found.');
      }
      if (entitlement.status !== 'claimable') {
        throw new ApiError(
          409,
          'tier_reward_not_claimable',
          entitlement.status === 'claimed'
            ? 'This tier reward has already been claimed.'
            : 'This tier reward is no longer available.'
        );
      }

      const [claimCountRows] = await connection.query<Array<RowDataPacket & {
        total_count: number;
        user_count: number;
      }>>(
        `
          SELECT COUNT(*) AS total_count,
                 COALESCE(SUM(CASE WHEN user_id = :userId THEN 1 ELSE 0 END), 0) AS user_count
          FROM user_vouchers
          WHERE voucher_template_id = :templateId
            AND status <> 'revoked'
        `,
        { userId, templateId: entitlement.template_id }
      );
      const claimCounts = claimCountRows[0];
      if (
        entitlement.total_quantity != null &&
        Number(claimCounts?.total_count ?? 0) >= Number(entitlement.total_quantity)
      ) {
        throw new ApiError(409, 'voucher_quantity_exhausted', 'This tier reward has reached its total claim limit.');
      }
      if (
        entitlement.limit_per_user != null &&
        Number(claimCounts?.user_count ?? 0) >= Number(entitlement.limit_per_user)
      ) {
        throw new ApiError(409, 'voucher_limit_per_user_reached', 'You have already claimed this tier reward.');
      }

      const [insertResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO user_vouchers (
            user_id, voucher_template_id, status, issued_by_type, issued_reason,
            issue_case_ref, tier_at_issue, issued_at, expires_at
          ) VALUES (
            :userId, :voucherTemplateId, 'active', 'system', :issuedReason,
            :issueCaseRef, :tierCode, UTC_TIMESTAMP(),
            '9999-12-31 23:59:59'
          )
        `,
        {
          userId,
          voucherTemplateId: entitlement.template_id,
          issuedReason: `Claimed tier reward: ${entitlement.template_name}`,
          issueCaseRef: `tier_claim:${entitlement.id}`,
          tierCode: entitlement.tier_code
        }
      );

      await connection.execute(
        `
          UPDATE user_tier_reward_entitlements
          SET status = 'claimed', user_voucher_id = :userVoucherId,
              claimed_at = UTC_TIMESTAMP()
          WHERE id = :entitlementId AND status = 'claimable'
        `,
        { entitlementId, userVoucherId: insertResult.insertId }
      );

      await connection.execute(
        `
          UPDATE loyalty_order_reward_issues
          SET user_voucher_id = :userVoucherId
          WHERE tier_reward_entitlement_id = :entitlementId
            AND user_id = :userId
        `,
        { entitlementId, userId, userVoucherId: insertResult.insertId }
      );

      await createUserNotification(connection, {
        userId,
        type: 'tier_reward',
        title: 'Tier reward claimed',
        body: `${entitlement.template_name} is ready to use at checkout.`,
        data: {
          tier_code: entitlement.tier_code,
          voucher_template_id: entitlement.template_id,
          user_voucher_id: insertResult.insertId
        }
      });

      await connection.commit();
      return {
        claimed: true,
        entitlement_id: entitlement.id,
        user_voucher_id: insertResult.insertId
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/orders/:orderId/cancellation-request', { preHandler: authenticateRequest }, async (request, reply) => {
    const params = z.object({ orderId: z.coerce.number().int().positive() }).parse(request.params);
    const payload = z.object({
      reason: z.string().trim().min(3).max(500).optional().default('Customer requested cancellation before preparation.')
    }).parse(request.body ?? {});
    const connection = await getUtcConnection();
    let committed = false;
    try {
      await connection.beginTransaction();
      const [orders] = await connection.execute<Array<RowDataPacket & {
        id: number;
        order_ref: string;
        user_id: number;
        status: string;
        payment_mode: 'token' | 'direct';
        payment_status: string | null;
      }>>(
        `SELECT o.id, o.order_ref, o.user_id, o.status, o.payment_mode,
                p.status AS payment_status
         FROM orders o
         LEFT JOIN payments p ON p.id = (
           SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id ORDER BY p2.id DESC LIMIT 1
         )
         WHERE o.id = :orderId AND o.user_id = :userId
         LIMIT 1 FOR UPDATE`,
        { orderId: params.orderId, userId: request.auth.userId }
      );
      const order = orders[0];
      if (!order) throw new ApiError(404, 'order_not_found', 'Order not found.');
      if (!['paid', 'accepted'].includes(order.status) ||
          (order.payment_mode === 'direct' && order.payment_status !== 'paid')) {
        throw new ApiError(409, 'cancellation_not_available', 'Cancellation requests are only available for paid orders before preparation starts.');
      }
      const [existing] = await connection.execute<Array<RowDataPacket & { id: number; status: string }>>(
        `SELECT id, status FROM order_cancellation_requests WHERE order_id = :orderId LIMIT 1 FOR UPDATE`,
        { orderId: order.id }
      );
      if (existing[0]) {
        throw new ApiError(409, 'cancellation_request_exists', 'This order already has a cancellation request. Please contact the store if you need help with the earlier decision.');
      }
      const [inserted] = await connection.execute<ResultSetHeader>(
        `INSERT INTO order_cancellation_requests (order_id, user_id, status, reason, requested_at, created_at, updated_at)
         VALUES (:orderId, :userId, 'pending', :reason, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        { orderId: order.id, userId: request.auth.userId, reason: payload.reason }
      );
      await createUserNotification(connection, {
        userId: request.auth.userId,
        type: 'order_cancellation_requested',
        title: 'Cancellation request sent',
        body: order.payment_mode === 'token'
          ? 'The barista will review your request before preparation starts. Your tokens remain reserved until a decision is made.'
          : 'The barista will review your request before preparation starts. Any direct-payment refund requires payment-provider processing.'
      });
      await connection.commit();
      committed = true;
      return reply.send({ status: 'pending', cancellation_request_id: inserted.insertId });
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/orders/:orderId/cancel', { preHandler: authenticateRequest }, async (request) => {
    const { orderId } = request.params as { orderId: string };

    // Reconcile the latest direct-payment attempt before opening the order
    // transaction. This prevents a customer from cancelling locally while
    // CHIP has already accepted the payment, and also closes an active CHIP
    // checkout before the order reservation is released.
    const [preflightRows] = await mysqlPool.query<Array<RowDataPacket & {
      id: number;
      status: string;
      payment_mode: 'token' | 'direct';
      payment_id: number | null;
      payment_status: string | null;
      provider_bill_id: string | null;
    }>>(
      `SELECT o.id, o.status, o.payment_mode,
              p.id AS payment_id, p.status AS payment_status, p.provider_bill_id
       FROM orders o
       LEFT JOIN payments p ON p.id = (
         SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id ORDER BY p2.id DESC LIMIT 1
       )
       WHERE o.id = :orderId AND o.user_id = :userId
       LIMIT 1`,
      { orderId, userId: request.auth.userId }
    );
    const preflight = preflightRows[0];
    if (!preflight) {
      throw new ApiError(404, 'order_not_found', 'Order not found.');
    }
    if (preflight.status === 'pending_payment' && preflight.payment_mode === 'direct') {
      if (preflight.provider_bill_id) {
        let purchase = await getChipPurchase(preflight.provider_bill_id);
        let providerStatus = typeof purchase.status === 'string'
          ? purchase.status.trim().toLowerCase()
          : 'unknown';
        if (providerStatus === 'paid') {
          await settleChipMobilePurchase(preflight.provider_bill_id, purchase, 'customer_cancel_paid_check');
          throw new ApiError(409, 'order_already_paid', 'This payment has already completed. Cancellation is not available here.');
        }
        if (!['failed', 'cancelled', 'error', 'payment_failure'].includes(providerStatus)) {
          purchase = await cancelChipPurchase(preflight.provider_bill_id);
          providerStatus = typeof purchase.status === 'string'
            ? purchase.status.trim().toLowerCase()
            : 'unknown';
          if (providerStatus === 'paid') {
            await settleChipMobilePurchase(preflight.provider_bill_id, purchase, 'customer_cancel_paid_race');
            throw new ApiError(409, 'order_already_paid', 'This payment completed while it was being cancelled. Cancellation is not available here.');
          }
        }
        if (!['failed', 'cancelled', 'error', 'payment_failure'].includes(providerStatus)) {
          throw new ApiError(409, 'payment_still_pending', 'The payment could not be closed safely yet. Please check its status again.');
        }
        await settleChipMobilePurchase(preflight.provider_bill_id, purchase, 'customer_cancel_reconcile');
      }
    }

    const connection = await getUtcConnection();
    let committed = false;

    try {
      await connection.beginTransaction();
      const [orders] = await connection.execute<Array<RowDataPacket & {
        id: number;
        order_ref: string;
        user_id: number;
        payment_mode: 'token' | 'direct';
        final_total_rm: string;
        token_amount_charged: number;
        status: string;
        payment_id: number | null;
        payment_status: string | null;
      }>>(
        `
          SELECT o.id, o.order_ref, o.user_id, o.payment_mode, o.final_total_rm,
                 o.token_amount_charged, o.status,
                 p.id AS payment_id, p.status AS payment_status
          FROM orders o
          LEFT JOIN payments p ON p.id = (
            SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id ORDER BY p2.id DESC LIMIT 1
          )
          WHERE o.id = :orderId AND o.user_id = :userId
          LIMIT 1
          FOR UPDATE
        `,
        { orderId, userId: request.auth.userId }
      );
      const order = orders[0];
      if (!order) {
        throw new ApiError(404, 'order_not_found', 'Order not found.');
      }
      if (order.status === 'pending_payment' && order.payment_mode === 'direct') {
        if (order.payment_id !== preflight.payment_id) {
          throw new ApiError(409, 'order_payment_changed', 'The payment attempt changed. Please refresh the order and try again.');
        }
        if (order.payment_status === 'paid') {
          throw new ApiError(409, 'order_already_paid', 'This payment has already completed. Cancellation is not available here.');
        }
        if (order.payment_id && ['pending', 'authorized'].includes(order.payment_status ?? '')) {
          await connection.execute(
            `UPDATE payments SET status = 'cancelled', failed_at = UTC_TIMESTAMP()
             WHERE id = :paymentId AND status IN ('pending', 'authorized')`,
            { paymentId: order.payment_id }
          );
        }
        await releaseInventoryForOrder(connection, order.id);
        await restoreGiftCardForRefund(
          connection,
          order.id,
          request.auth.userId,
          'Restored after customer cancelled unpaid order.'
        );
        await connection.execute(
          `UPDATE orders SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
           WHERE id = :orderId AND status = 'pending_payment'`,
          { orderId: order.id }
        );
        await connection.execute(
          `
            INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
            VALUES (:orderId, 'pending_payment', 'cancelled', 'customer', :userId,
                    'Cancelled by customer before direct payment completed', UTC_TIMESTAMP())
          `,
          { orderId: order.id, userId: request.auth.userId }
        );
        await createUserNotification(connection, {
          userId: request.auth.userId,
          type: 'order_cancelled',
          title: 'Unpaid order cancelled',
          body: 'Your payment attempt was closed and no payment was taken. You can place a new order when ready.'
        });
        await connection.commit();
        committed = true;
        return {
          status: 'cancelled',
          returned_tokens: 0,
          token_balance: null,
          payment_cancelled: true
        };
      }
      if (['paid', 'accepted'].includes(order.status)) {
        throw new ApiError(
          409,
          'cancellation_request_required',
          'Paid orders require a barista-approved cancellation request. Please use Request cancellation.'
        );
      }
      if (order.status !== 'paid') {
        throw new ApiError(
          409,
          'order_cannot_be_cancelled',
          'This order can no longer be cancelled because preparation may have started. Please contact support if you need help.'
        );
      }
      if (order.payment_mode !== 'token') {
        throw new ApiError(409, 'order_cannot_be_cancelled', 'This order cannot be cancelled in the app. Please contact support.');
      }

      // An order lock serializes self-cancellation and staff refund requests.
      // A completed cancellation must occupy the same refund ledger as a staff refund.
      const [existingRefunds] = await connection.execute<Array<RowDataPacket & { id: number }>>(
        `SELECT id FROM refunds WHERE order_id = :orderId AND status IN ('pending', 'approved', 'completed') LIMIT 1 FOR UPDATE`,
        { orderId: order.id }
      );
      if (existingRefunds[0]) {
        throw new ApiError(
          409,
          'refund_already_in_progress',
          'A token return is already being processed for this order. Please check your wallet shortly.'
        );
      }

      const allowanceRefund = await restoreEmployeeAllowanceForRefund(connection, Number(order.id));
      const tokenAmount = calculatePersonalTokenRefund(Number(order.token_amount_charged), allowanceRefund.allowanceUsed);
      const [accounts] = await connection.execute<Array<RowDataPacket & { balance_available: number }>>(
        `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
        { userId: request.auth.userId }
      );
      const account = accounts[0];
      if (!account) {
        throw new ApiError(409, 'token_account_not_found', 'Your token account was not found. Please contact support.');
      }
      const balanceAfter = Number(account.balance_available) + tokenAmount;
      if (tokenAmount > 0) {
        await connection.execute(
          `UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`,
          { balanceAfter, userId: request.auth.userId }
        );
        await connection.execute(
          `
            INSERT INTO token_ledger (
              user_id, token_lot_id, direction, source_type, source_id, amount,
              balance_after, remarks, created_at
            ) VALUES (
              :userId, NULL, 'credit', 'refund_return', :orderId, :amount,
              :balanceAfter, :remarks, UTC_TIMESTAMP()
            )
          `,
          {
            userId: request.auth.userId,
            orderId: order.id,
            amount: tokenAmount,
            balanceAfter,
            remarks: `Customer cancellation for order ${order.order_ref}`
          }
        );
      }
      const [payments] = await connection.execute<Array<RowDataPacket & { id: number }>>(
        `SELECT id FROM payments WHERE order_id = :orderId ORDER BY id DESC LIMIT 1`,
        { orderId: order.id }
      );
      const refundRef = `RFD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const replacementVoucherIssued = await issueRefundReplacementVoucher(connection, {
        orderId: order.id,
        userId: request.auth.userId,
        issueCaseRef: `refund:${refundRef}`,
        reason: `Replacement voucher for cancelled order ${order.order_ref}`
      });
      await connection.execute(
        `
          INSERT INTO refunds (
            order_id, payment_id, payment_mode, refund_ref, refund_amount_rm,
            refund_token_amount, status, reason, created_by_admin_id, created_at, completed_at
          ) VALUES (
            :orderId, :paymentId, 'token', :refundRef, :amountRm,
            :tokenAmount, 'completed', :reason, NULL, UTC_TIMESTAMP(), UTC_TIMESTAMP()
          )
        `,
        {
          orderId: order.id,
          paymentId: payments[0]?.id ?? null,
          refundRef,
          amountRm: order.final_total_rm,
          tokenAmount,
          reason: 'Customer cancellation before preparation'
        }
      );
      await connection.execute(
        `UPDATE orders SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :orderId`,
        { orderId: order.id }
      );
      await connection.execute(
        `
          INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
          VALUES (:orderId, 'paid', 'cancelled', 'customer', :userId, 'Cancelled by customer before preparation', UTC_TIMESTAMP())
        `,
        { orderId: order.id, userId: request.auth.userId }
      );
      await createUserNotification(connection, {
        userId: request.auth.userId,
        type: 'order_cancelled',
        title: 'Order cancelled',
        body: replacementVoucherIssued
          ? 'Your tokens were returned and an equivalent voucher was added back to your account.'
          : 'The applicable tokens have been returned to your C2 Coffee account.'
      });
      await connection.commit();
      committed = true;

      return {
        status: 'cancelled',
        returned_tokens: tokenAmount,
        token_balance: balanceAfter,
        replacement_voucher_issued: replacementVoucherIssued
      };
    } catch (error) {
      if (!committed) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/orders', { preHandler: authenticateRequest }, async (request) => {
    const { limit } = listQuerySchema.parse(request.query);

    const [rows] = await mysqlPool.query<Array<OrderSummaryRow>>(
      `
          SELECT
            o.id,
            o.order_ref,
            o.daily_order_number,
            o.status,
          o.payment_mode,
          CAST(o.final_total_rm AS CHAR) AS final_total_rm,
          o.token_amount_charged,
          o.pickup_slot_at,
          o.paid_at,
          o.accepted_at,
          o.ready_at,
          o.collected_at,
          o.created_at,
          o.updated_at,
          p.status AS payment_status,
          p.payment_method,
          p.expires_at AS payment_expires_at,
          ocr.status AS cancellation_request_status,
          s.id AS store_id,
          s.name AS store_name,
          NULL AS barista_name,
          NULL AS barista_username,
          COUNT(oi.id) AS item_count,
          MIN(oi.item_name_snapshot) AS primary_item_name
        FROM orders o
        JOIN stores s
          ON s.id = o.store_id
        LEFT JOIN payments p
          ON p.id = (
            SELECT p2.id
            FROM payments p2
            WHERE p2.order_id = o.id
            ORDER BY p2.id DESC
            LIMIT 1
          )
        LEFT JOIN order_cancellation_requests ocr
          ON ocr.order_id = o.id
        LEFT JOIN order_items oi
          ON oi.order_id = o.id
        WHERE o.user_id = :userId
        GROUP BY
          o.id,
          o.order_ref,
          o.daily_order_number,
          o.status,
          o.payment_mode,
          o.final_total_rm,
          o.token_amount_charged,
          o.pickup_slot_at,
          o.paid_at,
          o.accepted_at,
          o.ready_at,
          o.collected_at,
          o.created_at,
          o.updated_at,
          p.status,
          p.payment_method,
          p.expires_at,
          ocr.status,
          s.id,
          s.name
        ORDER BY o.id DESC
        LIMIT :limit
      `,
      {
        userId: request.auth.userId,
        limit
      }
    );

    if (rows.length === 0) {
      return {
        active_order: null,
        orders: []
      };
    }

    const orderIds = rows.map((row) => row.id);

    const [itemRows] = await mysqlPool.query<Array<OrderItemRow>>(
      `
        SELECT
          order_id,
          id AS item_id,
          menu_item_id,
          item_name_snapshot,
          CAST(base_price_rm_snapshot AS CHAR) AS base_price_rm_snapshot,
          token_price_snapshot,
          quantity,
          CAST(line_subtotal_rm AS CHAR) AS line_subtotal_rm,
          line_token_amount,
          is_qualifying_cup
        FROM order_items
        WHERE order_id IN (:orderIds)
        ORDER BY order_id ASC, id ASC
      `,
      { orderIds }
    );

    const [modifierRows] = await mysqlPool.query<Array<OrderItemModifierRow>>(
      `
        SELECT
          order_item_id,
          modifier_group_name_snapshot,
          modifier_option_name_snapshot,
          CAST(price_delta_rm_snapshot AS CHAR) AS price_delta_rm_snapshot,
          token_price_delta_snapshot
        FROM order_item_modifiers
        WHERE order_item_id IN (
          SELECT id
          FROM order_items
          WHERE order_id IN (:orderIds)
        )
        ORDER BY order_item_id ASC, id ASC
      `,
      { orderIds }
    );

    const [historyRows] = await mysqlPool.query<Array<OrderStatusHistoryRow>>(
      `
        SELECT
          order_id,
          from_status,
          to_status,
          reason,
          created_at
        FROM order_status_history
        WHERE order_id IN (:orderIds)
        ORDER BY order_id ASC, created_at ASC, id ASC
      `,
      { orderIds }
    );

    const itemsByOrder = new Map<number, Array<Record<string, unknown>>>();
    const modifiersByOrderItem = new Map<number, Array<Record<string, unknown>>>();
    for (const row of modifierRows) {
      const modifiers = modifiersByOrderItem.get(row.order_item_id) ?? [];
      modifiers.push({
        group_name: row.modifier_group_name_snapshot,
        option_name: row.modifier_option_name_snapshot,
        price_delta_rm: row.price_delta_rm_snapshot,
        token_price_delta: row.token_price_delta_snapshot
      });
      modifiersByOrderItem.set(row.order_item_id, modifiers);
    }

    for (const row of itemRows) {
      const items = itemsByOrder.get(row.order_id) ?? [];
      const itemModifiers =
        modifiersByOrderItem.get(row.item_id) ?? [];
      items.push({
        id: row.item_id,
        menu_item_id: row.menu_item_id,
        name: row.item_name_snapshot,
        base_price_rm: row.base_price_rm_snapshot,
        token_price: row.token_price_snapshot,
        quantity: row.quantity,
        line_subtotal_rm: row.line_subtotal_rm,
        line_token_amount: row.line_token_amount,
        is_qualifying_cup: row.is_qualifying_cup === 1,
        modifiers: itemModifiers
      });
      itemsByOrder.set(row.order_id, items);
    }

    const historyByOrder = new Map<number, Array<Record<string, unknown>>>();
    for (const row of historyRows) {
      const history = historyByOrder.get(row.order_id) ?? [];
      history.push({
        from_status: row.from_status,
        to_status: row.to_status,
        reason: row.reason,
        created_at: row.created_at.toISOString()
      });
      historyByOrder.set(row.order_id, history);
    }

    const orders = rows.map((row) => {
      const status = resolveOrderLifecycleStatus({
        status: row.status,
        createdAt: row.created_at,
        paidAt: row.paid_at,
        acceptedAt: row.accepted_at,
        readyAt: row.ready_at,
        collectedAt: row.collected_at
      });

      return {
        id: row.id,
        order_ref: row.order_ref,
        daily_order_number: row.daily_order_number,
        status,
        payment_mode: row.payment_mode,
        final_total_rm: row.final_total_rm,
        token_amount_charged: row.token_amount_charged,
        pickup_slot_at: row.pickup_slot_at.toISOString(),
        collected_at: row.collected_at?.toISOString() ?? null,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
        payment_status: row.payment_status,
        payment_method: row.payment_method,
        payment_expires_at: row.payment_expires_at?.toISOString() ?? null,
        cancellation_request_status: row.cancellation_request_status,
        store: {
          id: row.store_id,
          name: row.store_name
        },
        barista_name: row.barista_name,
        barista_username: row.barista_username,
        item_count: row.item_count,
        primary_item_name: row.primary_item_name,
        items: itemsByOrder.get(row.id) ?? [],
        status_history: historyByOrder.get(row.id) ?? []
      };
    });

    const activeOrder =
      orders.find((order) => isCustomerActiveOrderStatus(order.status)) ?? null;

    return {
      active_order: activeOrder,
      orders
    };
  });

  app.get('/v1/orders/:orderId/payment', { preHandler: authenticateRequest }, async (request) => {
    const params = z.object({ orderId: z.coerce.number().int().positive() }).parse(request.params);
    const [rows] = await mysqlPool.query<Array<RowDataPacket & {
      id: number;
      status: string;
      payment_status: string | null;
      payment_method: string | null;
      payment_expires_at: Date | null;
      provider_bill_id: string | null;
      final_total_rm: string;
    }>>(
      `SELECT o.id, o.status, CAST(o.final_total_rm AS CHAR) AS final_total_rm,
              p.status AS payment_status, p.payment_method, p.expires_at AS payment_expires_at,
              p.provider_bill_id
       FROM orders o
       LEFT JOIN payments p ON p.id = (
         SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id ORDER BY p2.id DESC LIMIT 1
       )
       WHERE o.id = :orderId AND o.user_id = :userId
       LIMIT 1`,
      { orderId: params.orderId, userId: request.auth.userId }
    );
    const row = rows[0];
    if (!row) throw new ApiError(404, 'order_not_found', 'Order was not found.');
    if (row.status !== 'pending_payment' || !row.provider_bill_id) {
      return {
        status: row.payment_status ?? row.status,
        checkout_url: null,
        payment_method: row.payment_method,
        amount_rm: row.final_total_rm,
        expires_at: row.payment_expires_at?.toISOString() ?? null
      };
    }

    const purchase = await getChipPurchase(row.provider_bill_id);
    const checkoutUrl = typeof purchase.checkout_url === 'string' && isTrustedChipCheckoutUrl(purchase.checkout_url)
      ? purchase.checkout_url
      : null;
    const providerStatus = typeof purchase.status === 'string' ? purchase.status.toLowerCase() : 'unknown';
    const providerTerminal = ['paid', 'failed', 'cancelled', 'error', 'payment_failure'].includes(providerStatus);
    if (providerTerminal) {
      await settleChipMobilePurchase(row.provider_bill_id, purchase, 'customer_status_check');
    }
    return {
      status: providerStatus === 'paid' ? 'paid' : providerStatus,
      checkout_url: providerTerminal ? null : checkoutUrl,
      payment_method: row.payment_method,
      amount_rm: row.final_total_rm,
      expires_at: row.payment_expires_at?.toISOString() ?? null
    };
  });

  app.post('/v1/orders/:orderId/payment/retry', { preHandler: authenticateRequest }, async (request) => {
    const params = z.object({ orderId: z.coerce.number().int().positive() }).parse(request.params);
    const payload = z.object({
      payment_method: z.enum(['fpx', 'duitnow_qr', 'card', 'ewallet'])
    }).parse(request.body);

    const [currentRows] = await mysqlPool.query<Array<RowDataPacket & {
      id: number;
      order_ref: string;
      status: string;
      final_total_rm: string;
      payment_id: number | null;
      payment_status: string | null;
      provider_bill_id: string | null;
      payment_expires_at: Date | null;
    }>>(
      `SELECT o.id, o.order_ref, o.status, CAST(o.final_total_rm AS CHAR) AS final_total_rm,
              p.id AS payment_id, p.status AS payment_status, p.provider_bill_id,
              p.expires_at AS payment_expires_at
       FROM orders o
       LEFT JOIN payments p ON p.id = (
         SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id ORDER BY p2.id DESC LIMIT 1
       )
       WHERE o.id = :orderId AND o.user_id = :userId
       LIMIT 1`,
      { orderId: params.orderId, userId: request.auth.userId }
    );
    const current = currentRows[0];
    if (!current) throw new ApiError(404, 'order_not_found', 'Order was not found.');
    if (current.status !== 'pending_payment') {
      throw new ApiError(409, 'order_payment_not_retryable', 'This order no longer needs payment.');
    }
    if (!current.payment_id) {
      throw new ApiError(409, 'order_payment_not_retryable', 'This order does not have a payment attempt to retry.');
    }

    let retryableStatus = current.payment_status ?? '';
    if (current.provider_bill_id) {
      let purchase = await getChipPurchase(current.provider_bill_id);
      let providerStatus = typeof purchase.status === 'string'
        ? purchase.status.trim().toLowerCase()
        : 'unknown';

      if (providerStatus === 'paid') {
        await settleChipMobilePurchase(current.provider_bill_id, purchase, 'customer_retry_check');
        throw new ApiError(409, 'order_payment_not_retryable', 'This payment has already been completed.');
      }

      if (!['failed', 'cancelled', 'error', 'payment_failure'].includes(providerStatus)) {
        const paymentExpired = current.payment_expires_at != null &&
          current.payment_expires_at.getTime() <= Date.now();
        if (!paymentExpired) {
          throw new ApiError(409, 'payment_still_pending', 'The current payment is still available. Retry it or wait for the final status before choosing another method.');
        }

        // The local checkout window has ended. Cancel the provider purchase
        // first so there can never be two payable CHIP gates for one order.
        purchase = await cancelChipPurchase(current.provider_bill_id);
        providerStatus = typeof purchase.status === 'string'
          ? purchase.status.trim().toLowerCase()
          : 'unknown';
        if (providerStatus === 'paid') {
          await settleChipMobilePurchase(current.provider_bill_id, purchase, 'customer_retry_cancel_race');
          throw new ApiError(409, 'order_payment_not_retryable', 'This payment was completed while its status was being checked.');
        }
        if (!['failed', 'cancelled', 'error', 'payment_failure'].includes(providerStatus)) {
          throw new ApiError(409, 'payment_still_pending', 'The previous payment could not be closed safely yet. Please check its status again.');
        }
      }

      await settleChipMobilePurchase(current.provider_bill_id, purchase, 'customer_retry_reconcile');
      retryableStatus = providerStatus === 'cancelled' ? 'cancelled' : 'failed';
    } else if (['pending', 'authorized'].includes(retryableStatus)) {
      const paymentExpired = current.payment_expires_at != null &&
        current.payment_expires_at.getTime() <= Date.now();
      if (!paymentExpired) {
        throw new ApiError(409, 'payment_still_pending', 'The current payment is still being prepared. Please try again shortly.');
      }
      await mysqlPool.execute(
        `UPDATE payments SET status = 'failed', failed_at = UTC_TIMESTAMP()
         WHERE id = :paymentId AND status IN ('pending', 'authorized')`,
        { paymentId: current.payment_id }
      );
      retryableStatus = 'failed';
    }

    if (!['failed', 'cancelled'].includes(retryableStatus)) {
      throw new ApiError(409, 'payment_still_pending', 'The previous payment has not reached a safe retry state.');
    }

    const retryReference = `${current.order_ref}-R-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const connection = await getUtcConnection();
    let paymentId = 0;
    let customerName = 'C2 Coffee customer';
    let customerEmail = '';
    try {
      await connection.beginTransaction();
      const [lockedRows] = await connection.execute<Array<RowDataPacket & {
        status: string;
        final_total_rm: string;
        payment_id: number | null;
        payment_status: string | null;
      }>>(
        `SELECT o.status, CAST(o.final_total_rm AS CHAR) AS final_total_rm,
                p.id AS payment_id, p.status AS payment_status
         FROM orders o
         LEFT JOIN payments p ON p.id = (
           SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id ORDER BY p2.id DESC LIMIT 1
         )
         WHERE o.id = :orderId AND o.user_id = :userId LIMIT 1 FOR UPDATE`,
        { orderId: params.orderId, userId: request.auth.userId }
      );
      if (lockedRows[0]?.status !== 'pending_payment' ||
          lockedRows[0].payment_id !== current.payment_id ||
          !['failed', 'cancelled'].includes(lockedRows[0].payment_status ?? '')) {
        throw new ApiError(409, 'order_payment_not_retryable', 'This order no longer needs payment.');
      }
      const [profiles] = await connection.execute<Array<RowDataPacket & {
        display_name: string | null;
        email: string | null;
      }>>(
        `SELECT display_name, email FROM user_profiles WHERE user_id = :userId LIMIT 1`,
        { userId: request.auth.userId }
      );
      if (!profiles[0]?.email?.trim()) {
        throw new ApiError(409, 'direct_payment_email_required', 'Add a verified email address before paying directly.');
      }
      customerName = profiles[0].display_name?.trim() || customerName;
      customerEmail = profiles[0].email.trim();
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO payments
           (order_id, provider, payment_method, provider_payment_ref, amount_rm, status, created_at, expires_at)
         VALUES (:orderId, 'chip', :paymentMethod, :paymentRef, :amountRm, 'pending', UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))`,
        {
          orderId: params.orderId,
          paymentMethod: payload.payment_method,
          paymentRef: retryReference,
          amountRm: lockedRows[0].final_total_rm
        }
      );
      paymentId = result.insertId;
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    try {
      const purchase = await createChipPurchase({
        reference: retryReference,
        customerEmail,
        customerName,
        amountCents: Math.round(Number(current.final_total_rm) * 100),
        description: `C2 Coffee order ${current.order_ref} payment retry`,
        method: payload.payment_method as ChipPaymentMethod,
        callbackUrl: `${env.PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/payments/chip/callback`
      });
      const [attachResult] = await mysqlPool.execute<ResultSetHeader>(
        `UPDATE payments SET provider_bill_id = :providerBillId
         WHERE id = :paymentId AND status = 'pending'`,
        { providerBillId: purchase.id, paymentId }
      );
      if (attachResult.affectedRows !== 1) {
        try {
          await cancelChipPurchase(purchase.id);
        } catch (cancelError) {
          request.log.error({ err: cancelError, providerPurchaseId: purchase.id }, 'Unable to cancel detached CHIP retry purchase');
        }
        throw new ApiError(409, 'payment_attempt_no_longer_active', 'The payment attempt changed before the payment page was ready. Please try again.');
      }
      return {
        order_id: current.id,
        status: 'pending',
        payment_method: payload.payment_method,
        checkout_url: purchase.checkoutUrl,
        amount_rm: current.final_total_rm,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };
    } catch (error) {
      await mysqlPool.execute(
        `UPDATE payments SET status = 'failed', failed_at = UTC_TIMESTAMP()
         WHERE id = :paymentId AND status = 'pending'`,
        { paymentId }
      );
      throw error;
    }
  });

  app.get('/v1/referrals', { preHandler: authenticateRequest }, async (request) => {
    const userId = request.auth.userId;

    const [programRows] = await mysqlPool.query<Array<RowDataPacket & {
      id: number; tenant_id: number; name: string; qualification_days: number; monthly_referrer_limit: number;
      friend_reward_type: 'voucher' | 'token'; friend_voucher_template_id: number | null; friend_token_amount: number | null;
      referrer_reward_type: 'voucher' | 'token'; referrer_voucher_template_id: number | null; referrer_token_amount: number | null;
      friend_reward_label: string; referrer_reward_label: string;
    }>>(
      `SELECT rp.*,
              CASE WHEN rp.friend_reward_type = 'token' THEN CONCAT(rp.friend_token_amount, ' free tokens')
                   ELSE COALESCE(fv.name, 'a voucher') END AS friend_reward_label,
              CASE WHEN rp.referrer_reward_type = 'token' THEN CONCAT(rp.referrer_token_amount, ' free tokens')
                   ELSE COALESCE(rv.name, 'a voucher') END AS referrer_reward_label
       FROM referral_programs rp
       JOIN referral_active_programs rap ON rap.program_id = rp.id AND rap.tenant_id = rp.tenant_id
       JOIN customer_tenant_memberships ctm ON ctm.tenant_id = rp.tenant_id
       LEFT JOIN voucher_templates fv ON fv.id = rp.friend_voucher_template_id
       LEFT JOIN voucher_templates rv ON rv.id = rp.referrer_voucher_template_id
       WHERE ctm.user_id = :userId AND rp.status = 'active'
       ORDER BY rp.updated_at DESC, rp.id DESC
       LIMIT 1`,
      { userId }
    );
    const activeProgram = programRows[0] ?? null;

    await mysqlPool.execute(
      `
        INSERT IGNORE INTO user_referral_codes (user_id, code)
        VALUES (:userId, CONCAT('C2-', LPAD(:userId, 8, '0')))
      `,
      { userId }
    );
    const [codeRows] = await mysqlPool.query<Array<RowDataPacket & { code: string }>>(
      'SELECT code FROM user_referral_codes WHERE user_id = :userId LIMIT 1',
      { userId }
    );
    const referralCode = codeRows[0]?.code;
    if (!referralCode) {
      throw new ApiError(500, 'referral_code_unavailable', 'Referral code is temporarily unavailable.');
    }

    const [referredRows] = await mysqlPool.query<
      Array<RowDataPacket & {
        id: number;
        status: 'pending' | 'qualified' | 'rewarded' | 'rejected';
        created_at: Date;
        rewarded_at: Date | null;
      }>
    >(
      `
        SELECT id, status, created_at, rewarded_at
        FROM referrals
        WHERE referrer_user_id = :userId
        ORDER BY created_at DESC
        LIMIT 50
      `,
      { userId }
    );

    const [claimedRows] = await mysqlPool.query<
      Array<RowDataPacket & { id: number; referral_code_snapshot: string }>
    >(
      `
        SELECT id, referral_code_snapshot
        FROM referrals
        WHERE referred_user_id = :userId
        LIMIT 1
      `,
      { userId }
    );

    const [pastOrders] = await mysqlPool.query<Array<RowDataPacket & { count: number }>>(
      `
        SELECT COUNT(*) AS count
        FROM orders
        WHERE user_id = :userId
          AND status IN ('paid', 'accepted', 'ready_for_pickup', 'collected')
      `,
      { userId }
    );

    const friendsInvited = referredRows.length;
    const rewardsClaimed = referredRows.filter(
      (r) => r.status === 'rewarded'
    ).length;
    const hasClaimedReferrer = claimedRows.length > 0;
    const claimedCode = claimedRows[0]?.referral_code_snapshot ?? null;
    const hasOrders = (pastOrders[0]?.count ?? 0) > 0;
    const isEligibleToClaim = !hasClaimedReferrer && !hasOrders && activeProgram !== null;

    return {
      referral_code: referralCode,
      share_url: `https://c2coffee.app/r/${referralCode}`,
      android_download_url:
        'https://play.google.com/store/apps/details?id=com.c2coffeeandcandle.customer',
      ios_download_url: 'https://apps.apple.com/my/app/c2-coffee/id6809305739',
      friends_invited: friendsInvited,
      rewards_claimed: rewardsClaimed,
      has_claimed_referrer: hasClaimedReferrer,
      is_eligible_to_claim: isEligibleToClaim,
      claimed_code: claimedCode,
      active_program: activeProgram ? {
        name: activeProgram.name,
        qualification_days: activeProgram.qualification_days,
        friend_reward_type: activeProgram.friend_reward_type,
        friend_token_amount: activeProgram.friend_token_amount,
        friend_reward_label: activeProgram.friend_reward_label,
        referrer_reward_label: activeProgram.referrer_reward_label
      } : null,
      referrals: referredRows.map((r) => ({
        id: r.id,
        status: r.status,
        created_at: r.created_at.toISOString(),
        rewarded_at: r.rewarded_at?.toISOString() ?? null
      }))
    };
  });

  const claimReferralSchema = z.object({
    code: z.string().trim().min(2).max(50)
  });

  app.post('/v1/referrals/claim', { preHandler: authenticateRequest }, async (request) => {
    const { code } = claimReferralSchema.parse(request.body ?? {});
    const userId = request.auth.userId;
    const cleanCode = code.trim().toUpperCase();

    const connection = await getUtcConnection();
    let committed = false;
    try {
      await connection.beginTransaction();
    const [programRows] = await connection.query<Array<RowDataPacket & {
      id: number; tenant_id: number; name: string; qualification_days: number; monthly_referrer_limit: number;
      friend_reward_type: 'voucher' | 'token'; friend_voucher_template_id: number | null; friend_token_amount: number | null;
      referrer_reward_type: 'voucher' | 'token'; referrer_voucher_template_id: number | null; referrer_token_amount: number | null;
    }>>(
      `
        SELECT rp.* FROM referral_programs rp
        JOIN referral_active_programs rap ON rap.program_id = rp.id AND rap.tenant_id = rp.tenant_id
        JOIN customer_tenant_memberships ctm ON ctm.tenant_id = rp.tenant_id
        WHERE ctm.user_id = :userId AND rp.status = 'active'
        ORDER BY rp.updated_at DESC, rp.id DESC
        LIMIT 1
      `,
      { userId }
    );
    const program = programRows[0];
    if (!program) {
      throw new ApiError(
        409,
        'referral_reward_unavailable',
        'Referrals are not available for this cafe right now.'
      );
    }

    const [pastOrders] = await connection.query<Array<RowDataPacket & { count: number }>>(
      `
        SELECT COUNT(*) AS count
        FROM orders
        WHERE user_id = :userId
          AND status IN ('paid', 'accepted', 'ready_for_pickup', 'collected')
      `,
      { userId }
    );

    if ((pastOrders[0]?.count ?? 0) > 0) {
      throw new ApiError(
        400,
        'referral_not_eligible',
        'Referral codes can only be claimed by new customers before placing their first order.'
      );
    }

    const [existingClaim] = await connection.query<Array<RowDataPacket & { id: number }>>(
      `
        SELECT id
        FROM referrals
        WHERE referred_user_id = :userId
        LIMIT 1
      `,
      { userId }
    );

    if (existingClaim.length > 0) {
      throw new ApiError(
        400,
        'referral_already_claimed',
        'You have already claimed a referral code.'
      );
    }

    const [referrerRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      `
        SELECT urc.user_id AS id
        FROM user_referral_codes urc
        JOIN customer_tenant_memberships referrer_membership
          ON referrer_membership.user_id = urc.user_id
        JOIN customer_tenant_memberships referred_membership
          ON referred_membership.tenant_id = referrer_membership.tenant_id
         AND referred_membership.user_id = :userId
        WHERE urc.code = :code
          AND referrer_membership.tenant_id = :tenantId
        LIMIT 1
      `,
      { code: cleanCode, userId, tenantId: program.tenant_id }
    );

    const referrer = referrerRows[0];
    if (!referrer) {
      throw new ApiError(
        404,
        'referral_code_not_found',
        'Invalid referral code. Please check and try again.'
      );
    }

    if (referrer.id === userId) {
      throw new ApiError(
        400,
        'cannot_refer_self',
        'You cannot claim your own referral code.'
      );
    }

    const snapshot: ReferralProgramSnapshot = {
      programId: program.id,
      name: program.name,
      qualificationDays: program.qualification_days,
      monthlyReferrerLimit: program.monthly_referrer_limit,
      friendReward: { type: program.friend_reward_type, voucherTemplateId: program.friend_voucher_template_id, tokenAmount: program.friend_token_amount },
      referrerReward: { type: program.referrer_reward_type, voucherTemplateId: program.referrer_voucher_template_id, tokenAmount: program.referrer_token_amount }
    };

    const [referralResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO referrals (
          referral_program_id,
          referrer_user_id,
          referred_user_id,
          referral_code_snapshot,
          status,
          program_snapshot_json,
          qualification_expires_at,
          created_at
        )
        VALUES (
          :programId,
          :referrerUserId,
          :referredUserId,
          :codeSnapshot,
          'pending',
          :programSnapshot,
          DATE_ADD(UTC_TIMESTAMP(), INTERVAL :qualificationDays DAY),
          UTC_TIMESTAMP()
        )
      `,
      {
        programId: program.id,
        referrerUserId: referrer.id,
        referredUserId: userId,
        codeSnapshot: cleanCode,
        programSnapshot: JSON.stringify(snapshot),
        qualificationDays: program.qualification_days
      }
    );

    const friendReward = await issueFriendRewardAtClaim(connection, {
      id: referralResult.insertId,
      referrer_user_id: referrer.id,
      referred_user_id: userId,
      tenant_id: program.tenant_id
    }, snapshot);

    await createUserNotification(connection, {
      userId,
      type: 'referral_claimed',
      title: 'Referral code applied',
      body: friendReward.issued
        ? 'Your referral code was applied and your friend reward is ready.'
        : 'Your referral code was applied. Your reward is being reviewed.',
      data: {
        referral_code: cleanCode
      }
    });

    await connection.commit();
    committed = true;

    return {
      success: true,
      message: friendReward.issued
        ? 'Referral code claimed and reward issued successfully!'
        : 'Referral code claimed. Reward issuance is pending review.'
    };
    } catch (error) {
      if (!committed) await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'referral_already_claimed', 'You have already claimed a referral code.');
      }
      throw error;
    } finally {
      connection.release();
    }
  });
}
