import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import sharp from 'sharp';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { saveMediaAsset } from '../../lib/media-assets.js';
import { getActiveLoyaltyTiers, getTierByCode, loadLoyaltyTiers } from '../../services/loyalty-tiers.js';

const voucherBenefitTypeSchema = z.enum([
  'Discount',
  'Free Drink',
  'Free Food',
  'Percentage Off',
  'Cash Voucher',
  'Token Discount',
  'Birthday Voucher'
]);

const voucherCreateUpdateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(100),
  benefitType: voucherBenefitTypeSchema,
  promotionKind: z.enum(['standard', 'bundle']).optional().default('standard'),
  topupRewardMinTokens: z.coerce.number().int().min(1).max(500).nullable().optional(),
  status: z.enum(['Active', 'Expired', 'Draft']).optional().default('Active'),
  tier: z.string(),
  reward: z.string().trim().max(255).optional(),
  discountValue: z.coerce.number().finite().min(0).max(1_000_000).optional(),
  productKinds: z.array(z.string()).optional().default([]),
  subcategoryCodes: z.array(z.string()).optional().default([]),
  categoryCodes: z.array(z.string()).optional().default([]),
  eligibleItems: z.array(z.string()),
  rewardProductKinds: z.array(z.string()).optional().default([]),
  rewardSubcategoryCodes: z.array(z.string()).optional().default([]),
  rewardCategoryCodes: z.array(z.string()).optional().default([]),
  rewardItems: z.array(z.string()).optional().default([]),
  qualifyingQuantity: z.number().int().min(1).max(20).optional().default(1),
  rewardQuantity: z.number().int().min(1).max(20).optional().default(1),
  expiry: z.string().trim().optional().nullable(),
  totalQty: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
  limitPerUser: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
  description: z.string().optional(),
  usageInstructions: z.string().trim().max(1000).optional().default(''),
  imageUrl: z.string().trim().max(512).nullable().optional(),
  audience: z
    .enum(['all_customers', 'employee_only', 'manual_issue_only'])
    .optional()
    .default('all_customers'),
  availabilityMode: z
    .enum(['always', 'daily', 'weekly', 'monthly', 'annual', 'birthday'])
    .optional()
    .default('always'),
  activeDays: z.array(z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])).optional().default([]),
  startTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  endTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  annualDate: z.string().trim().regex(/^(?:\d{4}-)?\d{2}-\d{2}$/).optional().nullable(),
  monthlyDay: z.coerce.number().int().min(1).max(28).optional().nullable()
}).superRefine((value, context) => {
  if (value.benefitType === 'Birthday Voucher' && value.availabilityMode !== 'birthday') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['availabilityMode'],
      message: 'Birthday vouchers must use birthday-month availability.'
    });
  }

  if (
    ['Discount', 'Percentage Off', 'Cash Voucher', 'Token Discount'].includes(value.benefitType) &&
    !(Number(value.discountValue) > 0)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Discount value must be greater than zero.'
    });
  }

  if (
    ['Discount', 'Percentage Off'].includes(value.benefitType) &&
    Number(value.discountValue) > 100
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Percentage discount cannot exceed 100%.'
    });
  }

  if (value.availabilityMode === 'weekly' && value.activeDays.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['activeDays'],
      message: 'Choose at least one day for a weekly voucher.'
    });
  }

  if (value.availabilityMode === 'annual' && !normalizeAnnualDate(value.annualDate)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['annualDate'],
      message: 'Choose a valid annual date.'
    });
  }

  if (Boolean(value.startTime) !== Boolean(value.endTime)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.startTime ? ['endTime'] : ['startTime'],
      message: 'Provide both a start and end time, or leave both empty.'
    });
  }

  if (value.startTime && value.endTime && value.startTime >= value.endTime) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endTime'],
      message: 'End time must be later than start time on the same day.'
    });
  }

  if (value.totalQty != null && value.limitPerUser != null && value.limitPerUser > value.totalQty) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['limitPerUser'],
      message: 'Per-customer limit cannot exceed the total voucher quantity.'
    });
  }

  if (value.audience !== 'manual_issue_only' && value.limitPerUser != null && value.limitPerUser > 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['limitPerUser'],
      message: 'Automatic vouchers support one voucher per customer per availability period. Use manual issuance for larger per-customer limits.'
    });
  }

  if (value.topupRewardMinTokens != null && value.audience === 'manual_issue_only') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['audience'],
      message: 'A top-up reward must be available to customers, not manual-issue only.'
    });
  }
});

const voucherExpiryUpdateSchema = z.object({
  expiry: z.string().trim().optional().nullable()
});

const customerSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(25).optional().default(10)
});

const voucherListQuerySchema = z.object({
  include_tier_rewards: z.enum(['1', 'true']).optional().transform((value) => value !== undefined)
});

const voucherIssueSchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  phone: z.string().trim().min(3).max(30).optional(),
  issuedReason: z.string().trim().min(1).max(100).optional(),
  issueCaseRef: z.string().trim().max(100).optional().nullable(),
  expiresAt: z.string().trim().optional().nullable()
}).refine((value) => value.userId || value.phone, {
  message: 'Either userId or phone is required.',
  path: ['userId']
});

const voucherIssuanceListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});

const revokeIssuedVoucherSchema = z.object({
  reason: z.string().trim().min(1).max(255)
});

type VoucherPayload = z.infer<typeof voucherCreateUpdateSchema>;

type ScopeSelection = {
  product_kind_codes: string[];
  subcategory_codes: string[];
  category_codes: string[];
  items: string[];
};

type PromotionRule = {
  kind: 'standard' | 'bundle';
  qualifying_quantity: number;
  reward_quantity: number;
  qualifying_scope: ScopeSelection;
  reward_scope: ScopeSelection;
};

const BENEFIT_TYPES = new Set([
  'Discount',
  'Free Drink',
  'Free Food',
  'Percentage Off',
  'Cash Voucher',
  'Token Discount',
  'Birthday Voucher'
]);
const ALL_MENU_PRODUCT_KINDS = ['drink', 'food', 'merchandise', 'candle'];

const DAY_NAME_MAP: Record<string, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday'
};

type VoucherTemplateRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  voucher_type: string;
  discount_mode: string;
  discount_value: string | number;
  token_value: number | null;
  min_spend_rm: string | number | null;
  eligible_scope_json: string | Record<string, unknown>;
  exclude_scope_json: string | null;
  requires_drink_in_cart: number;
  stack_rule: string;
  expires_in_days: number | null;
  valid_until?: string | Date | null;
  total_quantity?: number | null;
  limit_per_user?: number | null;
  is_active: number;
  created_at: string | Date;
  updated_at: string | Date;
  issued_count?: number;
  redeemed_count?: number;
  image_url?: string | null;
  usage_instructions?: string | null;
};

const voucherImageUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  data_url: z.string().trim().min(1)
});

type AdminVoucherCustomerRow = RowDataPacket & {
  id: number;
  phone_e164: string;
  status: string;
  is_employee: number;
  display_name: string | null;
  email: string | null;
  tier_code: string | null;
};

type AdminIssuedVoucherRow = RowDataPacket & {
  id: number;
  user_id: number;
  status: string;
  issued_reason: string;
  issue_case_ref: string | null;
  tier_at_issue: string | null;
  issued_at: Date;
  expires_at: Date;
  redeemed_at: Date | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  display_name: string | null;
  email: string | null;
  phone_e164: string;
};

type AdminVoucherAnalyticsSummaryRow = RowDataPacket & {
  total_vouchers: number;
  active_vouchers: number;
  issued_vouchers: number;
  redeemed_vouchers: number;
};

type AdminVoucherAnalyticsTopRow = RowDataPacket & {
  code: string;
  name: string;
  voucher_type: string;
  is_active: number;
  issued_count: number;
  redeemed_count: number;
};

type AdminVoucherAnalyticsRecentRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  status: string;
  issued_reason: string;
  issued_at: Date;
  redeemed_at: Date | null;
  revoked_at: Date | null;
  display_name: string | null;
  email: string | null;
  phone_e164: string;
};

let voucherTemplateColumnsPromise: Promise<Set<string>> | null = null;

async function getVoucherTemplateColumns(): Promise<Set<string>> {
  if (!voucherTemplateColumnsPromise) {
    voucherTemplateColumnsPromise = mysqlPool
      .query<Array<RowDataPacket>>('SHOW COLUMNS FROM voucher_templates')
      .then(([rows]) => new Set(rows.map((row) => String((row as { Field?: string }).Field ?? '').trim()).filter(Boolean)));
  }

  return voucherTemplateColumnsPromise;
}

function hasColumn(columns: Set<string>, column: string): boolean {
  return columns.has(column);
}

function parseScopeJson(value: unknown): Record<string, unknown> {
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

function canonicalJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, normalize(entry)])
      );
    }
    return input;
  };
  return JSON.stringify(normalize(parseScopeJson(value)));
}

function canonicalVoucherRules(value: unknown): string {
  const scope = parseScopeJson(value);
  const {
    expiry_string: _expiryString,
    description: _description,
    usage_instructions: _usageInstructions,
    ...rules
  } = scope;
  return canonicalJson(rules);
}

function sameNullableNumber(left: unknown, right: unknown): boolean {
  if (left == null && right == null) return true;
  return Number(left) === Number(right);
}

function sameNullableDate(left: unknown, right: unknown): boolean {
  const leftDate = parseDateValue(left);
  const rightDate = parseDateValue(right);
  if (!leftDate && !rightDate) return true;
  return leftDate?.getTime() === rightDate?.getTime();
}

function parseScopeSelection(value: unknown): ScopeSelection {
  const scope = parseScopeJson(value);
  const items = Array.isArray(scope.items)
    ? normalizeEligibleItems(scope.items.map((item) => String(item)))
    : [];
  return {
    product_kind_codes: Array.isArray(scope.product_kind_codes)
      ? normalizeScopeCodes(scope.product_kind_codes.map((item) => String(item)))
      : [],
    subcategory_codes: Array.isArray(scope.subcategory_codes)
      ? normalizeScopeCodes(scope.subcategory_codes.map((item) => String(item)))
      : [],
    category_codes: Array.isArray(scope.category_codes)
      ? normalizeScopeCodes(scope.category_codes.map((item) => String(item)))
      : Array.isArray(scope.categories)
        ? normalizeScopeCodes(scope.categories.map((item) => String(item)))
        : [],
    items: items.length === 1 && items[0] === 'All Items' ? [] : items
  };
}

function parsePromotionRule(scope: Record<string, unknown>): PromotionRule {
  const rawRule = scope.promotion_rule && typeof scope.promotion_rule === 'object'
    ? (scope.promotion_rule as Record<string, unknown>)
    : {};

  const qualifyingScope = parseScopeSelection(rawRule.qualifying_scope);
  const rewardScope = parseScopeSelection(rawRule.reward_scope);
  const kind = String(rawRule.kind || 'standard').trim() === 'bundle' ? 'bundle' : 'standard';
  const qualifyingQuantity = Number(rawRule.qualifying_quantity || 1);
  const rewardQuantity = Number(rawRule.reward_quantity || 1);

  const fallbackScope = parseScopeSelection(scope);

  return {
    kind,
    qualifying_quantity: Number.isFinite(qualifyingQuantity) && qualifyingQuantity > 0
      ? Math.floor(qualifyingQuantity)
      : 1,
    reward_quantity: Number.isFinite(rewardQuantity) && rewardQuantity > 0
      ? Math.floor(rewardQuantity)
      : 1,
    qualifying_scope: qualifyingScope.items.length > 0 ||
      qualifyingScope.product_kind_codes.length > 0 ||
      qualifyingScope.subcategory_codes.length > 0 ||
      qualifyingScope.category_codes.length > 0
      ? qualifyingScope
      : fallbackScope,
    reward_scope:
      kind === 'bundle' &&
      (rewardScope.items.length > 0 ||
        rewardScope.product_kind_codes.length > 0 ||
        rewardScope.subcategory_codes.length > 0 ||
        rewardScope.category_codes.length > 0)
        ? rewardScope
        : qualifyingScope.items.length > 0 ||
            qualifyingScope.product_kind_codes.length > 0 ||
            qualifyingScope.subcategory_codes.length > 0 ||
            qualifyingScope.category_codes.length > 0
          ? qualifyingScope
          : fallbackScope
  };
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseVoucherExpiry(value: unknown): Date | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const date = new Date(`${value.trim()}T23:59:59.999+08:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return parseDateValue(value);
}

function titleCaseTier(tierCode: string | null | undefined): string {
  switch (tierCode) {
    case 'kawan':
      return 'Kawan';
    case 'dilamun':
      return 'Dilamun';
    case 'ketagih':
      return 'Ketagih';
    case 'legend':
      return 'Legend';
    default:
      return 'Kawan';
  }
}

const ALL_TIER_SCOPE_VALUES = new Set(['', 'all', 'all tier', 'all tiers', 'all_tiers']);

async function normalizeVoucherTierScope(value: unknown): Promise<string> {
  const raw = String(value ?? '').trim();
  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, ' ').replaceAll(/\s+/g, ' ').trim();
  if (ALL_TIER_SCOPE_VALUES.has(normalized)) return 'all';

  const activeTiers = getActiveLoyaltyTiers(await loadLoyaltyTiers());
  const tier = activeTiers.find((entry) =>
    entry.code === normalized || entry.name.trim().toLowerCase() === normalized
  );
  if (!tier) {
    throw new ApiError(400, 'invalid_voucher_tier', 'Choose an active member tier or All Tiers.');
  }

  return tier.code;
}

async function voucherTierScopeLabel(value: unknown): Promise<string> {
  const raw = String(value ?? '').trim();
  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, ' ').replaceAll(/\s+/g, ' ').trim();
  if (ALL_TIER_SCOPE_VALUES.has(normalized)) return 'All Tiers';

  const tiers = await loadLoyaltyTiers();
  const tier = getTierByCode(tiers, normalized) ?? tiers.find(
    (entry) => entry.name.trim().toLowerCase() === normalized
  );
  return tier?.name ?? raw;
}

async function revokeUnusedVoucherIssuances(
  templateCode: string,
  tenantId: number,
  adminUserId: number,
  reason: string
): Promise<void> {
  await mysqlPool.execute(
    `
      UPDATE user_vouchers uv
      JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
      SET uv.status = 'revoked',
          uv.revoked_by_admin_id = :adminUserId,
          uv.revoked_reason = :reason,
          uv.revoked_at = UTC_TIMESTAMP()
      WHERE vt.code = :code
        AND vt.tenant_id = :tenantId
        AND uv.status = 'active'
        AND uv.redeemed_at IS NULL
        AND uv.revoked_at IS NULL
    `,
    { code: templateCode, tenantId, adminUserId, reason }
  );
}

function addDays(base: Date, days: number): Date {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function formatScopeLabel(value: string): string {
  return value
    .replaceAll(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function voucherScopeLabel(payload: VoucherPayload): string {
  const items = normalizeEligibleItems(payload.eligibleItems).filter((item) => item !== 'All Items');
  if (items.length === 1) return items[0];
  if (items.length > 1) return 'Selected items';

  const subcategories = normalizeScopeCodes(payload.subcategoryCodes);
  if (subcategories.length === 1) return formatScopeLabel(subcategories[0]);
  if (subcategories.length > 1) return 'Selected menu types';

  const categories = normalizeScopeCodes(payload.categoryCodes);
  if (categories.length === 1) return formatScopeLabel(categories[0]);
  if (categories.length > 1) return 'Selected categories';

  const productKinds = normalizeScopeCodes(payload.productKinds).map((value) => value.toLowerCase());
  const includesEveryCoreKind = ALL_MENU_PRODUCT_KINDS.every((kind) => productKinds.includes(kind));
  if (includesEveryCoreKind) return 'All menu items';

  if (productKinds.length === 1) return formatScopeLabel(productKinds[0]);
  if (productKinds.length > 1) return 'Selected menu types';
  return 'All menu items';
}

function deriveReward(payload: VoucherPayload): string {
  const explicitReward = payload.reward?.trim();
  if (explicitReward) return explicitReward;

  const scopeLabel = voucherScopeLabel(payload);
  const promoLabel = payload.benefitType === 'Free Food' ? 'Food' : 'Drink';

  if (payload.promotionKind === 'bundle') {
    const buyQty = payload.qualifyingQuantity || 1;
    const freeQty = payload.rewardQuantity || 1;
    return `Buy ${buyQty} Get ${freeQty} Free ${promoLabel}`;
  }

  if (payload.benefitType === 'Free Drink') {
    return `${scopeLabel === 'All menu items' ? 'Free item' : 'Free drink'} - ${scopeLabel}`;
  }

  if (payload.benefitType === 'Free Food') {
    return `${scopeLabel === 'All menu items' ? 'Free item' : 'Free food'} - ${scopeLabel}`;
  }

  if (payload.benefitType === 'Discount' || payload.benefitType === 'Percentage Off') {
    return `${Number(payload.discountValue) || 0}% Discount`;
  }

  if (payload.benefitType === 'Token Discount') {
    return `${Number(payload.discountValue) || 0} Tokens Off`;
  }

  if (payload.benefitType === 'Birthday Voucher') {
    return `Birthday treat - ${scopeLabel}`;
  }

  return payload.name;
}

function buildScopeSelection(
  items: string[],
  productKinds: string[],
  subcategoryCodes: string[],
  categoryCodes: string[]
): ScopeSelection {
  const normalizedItems = normalizeEligibleItems(items);
  return {
    product_kind_codes: normalizeScopeCodes(productKinds),
    subcategory_codes: normalizeScopeCodes(subcategoryCodes),
    category_codes: normalizeScopeCodes(categoryCodes),
    items: normalizedItems.length === 1 && normalizedItems[0] === 'All Items' ? [] : normalizedItems
  };
}

function applySafeBenefitScopeDefaults(payload: VoucherPayload): VoucherPayload {
  const hasExplicitQualifyingScope =
    normalizeEligibleItems(payload.eligibleItems).some((item) => item !== 'All Items') ||
    normalizeScopeCodes(payload.productKinds).length > 0 ||
    normalizeScopeCodes(payload.subcategoryCodes).length > 0 ||
    normalizeScopeCodes(payload.categoryCodes).length > 0;

  if (hasExplicitQualifyingScope) return payload;

  if (payload.benefitType === 'Free Drink' || payload.benefitType === 'Birthday Voucher') {
    return { ...payload, productKinds: ['drink'] };
  }

  if (payload.benefitType === 'Free Food') {
    return { ...payload, productKinds: ['food'] };
  }

  return payload;
}

function buildPromotionRule(payload: VoucherPayload): PromotionRule {
  const qualifyingScope = buildScopeSelection(
    payload.eligibleItems,
    payload.productKinds,
    payload.subcategoryCodes,
    payload.categoryCodes
  );

  const rewardScope = buildScopeSelection(
    payload.rewardItems.length > 0 ? payload.rewardItems : payload.eligibleItems,
    payload.rewardProductKinds.length > 0 ? payload.rewardProductKinds : payload.productKinds,
    payload.rewardSubcategoryCodes.length > 0 ? payload.rewardSubcategoryCodes : payload.subcategoryCodes,
    payload.rewardCategoryCodes.length > 0 ? payload.rewardCategoryCodes : payload.categoryCodes
  );

  return {
    kind: payload.promotionKind,
    qualifying_quantity: Math.max(1, payload.qualifyingQuantity || 1),
    reward_quantity: Math.max(1, payload.rewardQuantity || 1),
    qualifying_scope: qualifyingScope,
    reward_scope: payload.promotionKind === 'bundle' ? rewardScope : qualifyingScope
  };
}

function normalizeEligibleItems(items: string[]): string[] {
  const normalized = items
    .map((item) => item.trim())
    .filter(Boolean);

  if (normalized.length === 0 || normalized.includes('All Items')) {
    return ['All Items'];
  }

  return Array.from(new Set(normalized));
}

function normalizeScopeCodes(items: string[] | undefined): string[] {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeFrontendType(
  scope: Record<string, unknown>,
  row: VoucherTemplateRow
): string {
  const typeLabel = String(scope.type_label || '').trim();
  if (typeLabel) {
    return typeLabel;
  }

  const rawFrontendType = String(scope.frontend_type || '').trim();
  if (rawFrontendType) {
    return rawFrontendType;
  }

  if (row.discount_mode === 'fixed_token') {
    return 'Discount';
  }

  if (row.discount_mode === 'fixed_rm') {
    return 'Discount';
  }

  if (row.discount_mode === 'percent_rm') {
    return 'Discount';
  }

  if (row.voucher_type === 'birthday_treat') {
    return 'Birthday Voucher';
  }

  if (row.discount_mode === 'free_drink') {
    return 'Free Drink';
  }

  return String(row.voucher_type || 'Percentage Off');
}

function normalizeBenefitType(
  scope: Record<string, unknown>,
  row: VoucherTemplateRow
): string {
  const fromScope = String(scope.benefit_type || '').trim();
  if (fromScope === 'Token Discount' || fromScope === 'Cash Voucher' || fromScope === 'Percentage Off') {
    return 'Discount';
  }

  if (BENEFIT_TYPES.has(fromScope)) {
    return fromScope;
  }

  return normalizeFrontendType(scope, row);
}

function normalizeAudience(scope: Record<string, unknown>): 'all_customers' | 'employee_only' | 'manual_issue_only' {
  const raw = String(scope.audience || '').trim();
  if (raw === 'employee_only' || raw === 'manual_issue_only') {
    return raw;
  }

  return 'all_customers';
}

function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed) ? trimmed : null;
}

function normalizeActiveDays(days: string[] | undefined): string[] {
  if (!Array.isArray(days)) return [];

  const normalized = Array.from(
    new Set(
      days
        .map((day) => DAY_NAME_MAP[String(day).trim().toLowerCase()])
        .filter((day): day is string => Boolean(day))
    )
  );
  const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return normalized.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function normalizeAnnualDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const monthDay = /^\d{2}-\d{2}$/.test(trimmed)
    ? trimmed
    : /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? trimmed.slice(5)
      : null;
  if (!monthDay) return null;

  const [month, day] = monthDay.split('-').map(Number);
  const candidate = new Date(Date.UTC(2000, month - 1, day));
  return candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day
    ? monthDay
    : null;
}

type VoucherSchedule = {
  mode: 'always' | 'daily' | 'weekly' | 'monthly' | 'annual' | 'birthday';
  activeDays: string[];
  startTime: string | null;
  endTime: string | null;
  annualDate: string | null;
  monthlyDay: number | null;
  timezone: 'Asia/Kuala_Lumpur';
};

function buildScheduleFromPayload(payload: VoucherPayload): VoucherSchedule {
  return {
    mode: payload.availabilityMode,
    activeDays: payload.availabilityMode === 'weekly' ? normalizeActiveDays(payload.activeDays) : [],
    startTime: normalizeTimeValue(payload.startTime),
    endTime: normalizeTimeValue(payload.endTime),
    annualDate: payload.availabilityMode === 'annual' ? normalizeAnnualDate(payload.annualDate) : null,
    monthlyDay: payload.availabilityMode === 'monthly' ? payload.monthlyDay ?? null : null,
    timezone: 'Asia/Kuala_Lumpur'
  };
}

function getScheduleFromScope(scope: Record<string, unknown>): VoucherSchedule {
  const raw = scope.schedule && typeof scope.schedule === 'object' ? (scope.schedule as Record<string, unknown>) : {};
  const mode = String(raw.mode || 'always').trim();

  return {
    mode:
      mode === 'daily' || mode === 'weekly' || mode === 'monthly' || mode === 'annual' || mode === 'birthday'
        ? mode
        : 'always',
    activeDays: normalizeActiveDays(Array.isArray(raw.activeDays) ? raw.activeDays.map((day) => String(day)) : []),
    startTime: normalizeTimeValue(typeof raw.startTime === 'string' ? raw.startTime : null),
    endTime: normalizeTimeValue(typeof raw.endTime === 'string' ? raw.endTime : null),
    annualDate: normalizeAnnualDate(typeof raw.annualDate === 'string' ? raw.annualDate : null),
    monthlyDay:
      Number.isInteger(Number(raw.monthlyDay)) && Number(raw.monthlyDay) >= 1 && Number(raw.monthlyDay) <= 28
        ? Number(raw.monthlyDay)
        : null,
    timezone: 'Asia/Kuala_Lumpur'
  };
}

function formatTimeLabel(value: string | null): string | null {
  if (!value) return null;
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatAnnualDateLabel(value: string | null): string | null {
  if (!value) return null;
  const [monthRaw, dayRaw] = value.split('-');
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (Number.isNaN(month) || Number.isNaN(day)) return value;
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  });
  return formatter.format(new Date(Date.UTC(2026, month - 1, day)));
}

function buildAvailabilitySummary(schedule: VoucherSchedule, expiryDate: Date | null): string {
  const fromTime = formatTimeLabel(schedule.startTime);
  const toTime = formatTimeLabel(schedule.endTime);
  const timeLabel = fromTime && toTime ? `${fromTime} - ${toTime}` : fromTime || toTime;

  const withExpiry = (label: string) => {
    if (schedule.mode === 'birthday' || !expiryDate) return label;
    return `${label}; redeem until ${expiryDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kuala_Lumpur'
    })}`;
  };

  if (schedule.mode === 'daily') {
    return withExpiry(timeLabel ? `Every day, ${timeLabel}` : 'Every day');
  }

  if (schedule.mode === 'weekly') {
    const dayLabel = schedule.activeDays.length > 0 ? schedule.activeDays.join(', ') : 'selected days';
    return withExpiry(timeLabel ? `Every ${dayLabel}, ${timeLabel}` : `Every ${dayLabel}`);
  }

  if (schedule.mode === 'annual') {
    const annualDateLabel = formatAnnualDateLabel(schedule.annualDate) || 'selected date';
    return withExpiry(timeLabel ? `Every ${annualDateLabel}, ${timeLabel}` : `Every ${annualDateLabel}`);
  }

  if (schedule.mode === 'monthly') {
    const dayLabel = schedule.monthlyDay ?? 'selected day';
    return withExpiry(timeLabel ? `Every month on day ${dayLabel}, ${timeLabel}` : `Every month on day ${dayLabel}`);
  }

  if (schedule.mode === 'birthday') {
    return timeLabel ? `On customer birthday, ${timeLabel}` : 'On customer birthday';
  }

  return withExpiry('Always available');
}

function getVoucherExpiryDate(scope: Record<string, unknown>, row: VoucherTemplateRow): Date | null {
  const scopeExpiry = parseDateValue(scope.expiry_string);
  if (scopeExpiry) return scopeExpiry;

  const validUntil = parseDateValue(row.valid_until);
  if (validUntil) return validUntil;

  if (typeof row.expires_in_days === 'number' && row.created_at) {
    const createdAt = parseDateValue(row.created_at);
    if (createdAt) {
      return addDays(createdAt, row.expires_in_days);
    }
  }

  return null;
}

function getVoucherStatus(row: VoucherTemplateRow, expiryDate: Date | null): string {
  if (!row.is_active) return 'Draft';
  if (expiryDate && expiryDate.getTime() < Date.now()) return 'Expired';
  return 'Active';
}

function resolveVoucherExpiryForIssue(
  templateRow: VoucherTemplateRow,
  scope: Record<string, unknown>,
  overrideExpiresAt?: string | null
): Date {
  if (overrideExpiresAt) {
    const parsed = parseDateValue(overrideExpiresAt);
    if (!parsed) {
      throw new ApiError(400, 'invalid_expiry', 'Voucher expiry is invalid.');
    }
    return parsed;
  }

  const templateExpiry = getVoucherExpiryDate(scope, templateRow);
  if (templateExpiry) {
    return templateExpiry;
  }

  if (typeof templateRow.expires_in_days === 'number' && templateRow.expires_in_days > 0) {
    return addDays(new Date(), templateRow.expires_in_days);
  }

  return addDays(new Date(), 3650);
}

function buildVoucherWriteBindings(
  columns: Set<string>,
  payload: VoucherPayload,
  scopeJson: string,
  discountMode: string,
  voucherType: string,
  discountValue: number,
  tokenValue: number | null,
  isActive: number,
  validUntil: Date | null,
  voucherCode = payload.code
): { columns: string[]; placeholders: string[]; values: Record<string, unknown> } {
  const columnsToWrite = [
    'code',
    'name',
    'voucher_type',
    'discount_mode',
    'discount_value',
    'token_value',
    'eligible_scope_json',
    'is_active'
  ];
  const placeholders = [
    ':code',
    ':name',
    ':voucherType',
    ':discountMode',
    ':discountValue',
    ':tokenValue',
    ':scopeJson',
    ':isActive'
  ];

  const values: Record<string, unknown> = {
    code: voucherCode,
    name: payload.name,
    voucherType,
    discountMode,
    discountValue,
    tokenValue,
    scopeJson,
    isActive
  };

  if (hasColumn(columns, 'expires_in_days')) {
    columnsToWrite.push('expires_in_days');
    placeholders.push(':expiresInDays');
    values.expiresInDays = null;
  }

  if (hasColumn(columns, 'valid_until')) {
    columnsToWrite.push('valid_until');
    placeholders.push(':validUntil');
    values.validUntil = validUntil;
  }

  if (hasColumn(columns, 'total_quantity')) {
    columnsToWrite.push('total_quantity');
    placeholders.push(':totalQty');
    values.totalQty = payload.totalQty ?? null;
  }

  if (hasColumn(columns, 'limit_per_user')) {
    columnsToWrite.push('limit_per_user');
    placeholders.push(':limitPerUser');
    // A tier reward maps to one entitlement per customer and reward period.
    // Enforce that invariant even if a stale or custom client sends a larger
    // value.
    values.limitPerUser = voucherType === 'tier_reward' ? 1 : (payload.limitPerUser ?? 1);
  }

  if (hasColumn(columns, 'image_url')) {
    columnsToWrite.push('image_url');
    placeholders.push(':imageUrl');
    values.imageUrl = payload.imageUrl || null;
  }
  if (hasColumn(columns, 'usage_instructions')) {
    columnsToWrite.push('usage_instructions');
    placeholders.push(':usageInstructions');
    values.usageInstructions = payload.usageInstructions || null;
  }

  return { columns: columnsToWrite, placeholders, values };
}

async function nextVoucherCode(tenantId: number): Promise<string> {
  const [rows] = await mysqlPool.query<Array<RowDataPacket & { max_code_number: number | null }>>(
    `SELECT MAX(CAST(SUBSTRING(code, 5) AS UNSIGNED)) AS max_code_number
     FROM voucher_templates
     WHERE tenant_id = :tenantId AND code REGEXP '^VCH-[0-9]+$'`,
    { tenantId }
  );
  return `VCH-${Math.max(1000, Number(rows[0]?.max_code_number || 1000)) + 1}`;
}

function isVoucherCodeCollision(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

export async function registerAdminVoucherRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/admin/vouchers/uploads', {
    preHandler: [authenticateAdminRequest],
    bodyLimit: 12 * 1024 * 1024
  }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = voucherImageUploadSchema.parse(request.body);
    const base64Payload = payload.data_url.includes('base64,')
      ? payload.data_url.split('base64,').pop() || ''
      : payload.data_url;
    const content = Buffer.from(base64Payload, 'base64');
    if (content.length === 0 || content.length > 8 * 1024 * 1024) {
      throw new ApiError(400, 'invalid_voucher_image_upload', 'Voucher images must be between 1 byte and 8 MB.');
    }

    let optimizedContent: Buffer;
    try {
      optimizedContent = await sharp(content, { limitInputPixels: 32_000_000 })
        .rotate()
        .resize({ width: 1200, height: 600, fit: 'cover', position: 'attention' })
        .webp({ quality: 84, effort: 4 })
        .toBuffer();
    } catch {
      throw new ApiError(400, 'invalid_voucher_image_upload', 'Upload a valid PNG, JPEG, or WebP voucher image.');
    }

    const uploadName = `${Date.now()}-${randomUUID()}.webp`;
    const assetPath = `/assets/vouchers/uploads/${uploadName}`;
    await saveMediaAsset({
      assetPath,
      fileName: uploadName,
      mimeType: 'image/webp',
      content: optimizedContent
    });
    return { image_url: assetPath };
  });

  app.get('/v1/admin/customers/search', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const { q, limit } = customerSearchQuerySchema.parse(request.query);
    const like = `%${q}%`;

    const [rows] = await mysqlPool.query<Array<AdminVoucherCustomerRow>>(
      `
        SELECT
          u.id,
          u.phone_e164,
          u.status,
          up.display_name,
          up.email,
          (
            SELECT lts.tier_code
            FROM loyalty_tier_snapshots lts
            WHERE lts.user_id = u.id
            ORDER BY lts.effective_at DESC, lts.id DESC
            LIMIT 1
          ) AS tier_code
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.status = 'active'
          AND (
            CAST(u.id AS CHAR) LIKE :like
            OR u.phone_e164 LIKE :like
            OR COALESCE(up.display_name, '') LIKE :like
            OR COALESCE(up.email, '') LIKE :like
          )
        ORDER BY u.created_at DESC
        LIMIT :limit
      `,
      {
        like,
        limit
      }
    );

    return {
      customers: rows.map((row) => ({
        id: row.id,
        displayName: row.display_name || `Customer #${row.id}`,
        email: row.email,
        phone: row.phone_e164,
        status: row.status,
        tier: titleCaseTier(row.tier_code)
      }))
    };
  });

  // GET /v1/admin/vouchers
  app.get('/v1/admin/vouchers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const { include_tier_rewards: includeTierRewards } = voucherListQuerySchema.parse(request.query);
    const voucherColumns = await getVoucherTemplateColumns();
    const selectColumns = [
      'vt.id',
      'vt.code',
      'vt.name',
      'vt.voucher_type',
      'vt.discount_mode',
      'vt.discount_value',
      'vt.token_value',
      'vt.min_spend_rm',
      'vt.eligible_scope_json',
      'vt.expires_in_days',
      'vt.is_active',
      'vt.created_at'
    ];

    if (hasColumn(voucherColumns, 'image_url')) {
      selectColumns.push('vt.image_url');
    }
    if (hasColumn(voucherColumns, 'usage_instructions')) {
      selectColumns.push('vt.usage_instructions');
    }

    if (hasColumn(voucherColumns, 'valid_until')) {
      selectColumns.push('vt.valid_until');
    }
    if (hasColumn(voucherColumns, 'total_quantity')) {
      selectColumns.push('vt.total_quantity');
    }
    if (hasColumn(voucherColumns, 'limit_per_user')) {
      selectColumns.push('vt.limit_per_user');
    }

    const whereClauses = ['vt.tenant_id = :tenantId'];
    if (!includeTierRewards) {
      whereClauses.push("vt.voucher_type <> 'tier_reward'");
    }
    if (hasColumn(voucherColumns, 'deleted_at')) {
      whereClauses.push('vt.deleted_at IS NULL');
    }

    const [rows] = await mysqlPool.query<Array<RowDataPacket>>(
      `
        SELECT
          ${selectColumns.join(',\n          ')},
          (SELECT COUNT(*) FROM user_vouchers uv WHERE uv.voucher_template_id = vt.id) as issued_count,
          (SELECT COUNT(*) FROM user_vouchers uv WHERE uv.voucher_template_id = vt.id AND uv.status = 'redeemed') as redeemed_count
        FROM voucher_templates vt
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY vt.created_at DESC
      `,
      { tenantId: request.adminAuth.tenantId }
    );

    const vouchers = await Promise.all(rows.map(async (row) => {
      const templateRow = row as VoucherTemplateRow;
      const scope = parseScopeJson(templateRow.eligible_scope_json);
      const promotionRule = parsePromotionRule(scope);
      const type = normalizeFrontendType(scope, templateRow);
      const benefitType = normalizeBenefitType(scope, templateRow);
      const audience = normalizeAudience(scope);
      const schedule = getScheduleFromScope(scope);
      const expiryDate = schedule.mode === 'birthday' ? null : getVoucherExpiryDate(scope, templateRow);
      const availabilityLabel = buildAvailabilitySummary(schedule, expiryDate);
      const createdDate = parseDateValue(templateRow.created_at);
      const issuedCount = Number(templateRow.issued_count || 0);
      const redeemedCount = Number(templateRow.redeemed_count || 0);

      return {
        id: templateRow.code,
        db_id: templateRow.id,
        name: templateRow.name,
        type: type,
        benefitType,
        promotionKind: promotionRule.kind,
        topupRewardMinTokens: Number(
          scope.topup_reward && typeof scope.topup_reward === 'object'
            ? (scope.topup_reward as Record<string, unknown>).min_tokens
            : 0
        ) || null,
        audience,
        tier: await voucherTierScopeLabel(scope.tier),
        reward: String(scope.reward || templateRow.name || ''),
        discountValue: templateRow.discount_mode === 'fixed_token' ? templateRow.token_value : templateRow.discount_value,
        eligibleItems: promotionRule.qualifying_scope.items,
        productKinds: promotionRule.qualifying_scope.product_kind_codes,
        subcategoryCodes: promotionRule.qualifying_scope.subcategory_codes,
        categoryCodes: promotionRule.qualifying_scope.category_codes,
        rewardItems: promotionRule.reward_scope.items,
        rewardProductKinds: promotionRule.reward_scope.product_kind_codes,
        rewardSubcategoryCodes: promotionRule.reward_scope.subcategory_codes,
        rewardCategoryCodes: promotionRule.reward_scope.category_codes,
        qualifyingQuantity: promotionRule.qualifying_quantity,
        rewardQuantity: promotionRule.reward_quantity,
        expiry: expiryDate ? expiryDate.toISOString() : '',
        expiryFull: availabilityLabel,
        availabilityMode: schedule.mode,
        activeDays: schedule.activeDays,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        annualDate: schedule.annualDate,
        monthlyDay: schedule.monthlyDay,
        availabilityLabel,
        totalQty: hasColumn(voucherColumns, 'total_quantity') ? (templateRow.total_quantity ?? null) : null,
        limitPerUser: hasColumn(voucherColumns, 'limit_per_user') ? (templateRow.limit_per_user ?? 1) : 1,
        description: String(scope.description || ''),
        imageUrl: hasColumn(voucherColumns, 'image_url') ? (templateRow.image_url ?? null) : null,
        usageInstructions: hasColumn(voucherColumns, 'usage_instructions')
          ? String(templateRow.usage_instructions || '').trim()
          : String(scope.usage_instructions || '').trim(),
        status: getVoucherStatus(templateRow, expiryDate),
        issued: issuedCount,
        redeemed: redeemedCount,
        rate: issuedCount > 0 ? `${Math.round((redeemedCount / issuedCount) * 100)}%` : '0%',
        created: createdDate
          ? createdDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : ''
      };
    }));

    return { vouchers };
  });

  app.get('/v1/admin/vouchers/analytics', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const voucherColumns = await getVoucherTemplateColumns();
    const whereClauses = ['vt.tenant_id = :tenantId'];
    if (hasColumn(voucherColumns, 'deleted_at')) {
      whereClauses.push('vt.deleted_at IS NULL');
    }

    const [summaryRows] = await mysqlPool.query<Array<AdminVoucherAnalyticsSummaryRow>>(
      `
        SELECT
          (SELECT COUNT(*)
           FROM voucher_templates vt
           WHERE ${whereClauses.join(' AND ')}) AS total_vouchers,
          (SELECT COUNT(*)
           FROM voucher_templates vt
           WHERE ${whereClauses.join(' AND ')} AND vt.is_active = 1) AS active_vouchers,
          (SELECT COUNT(*)
           FROM user_vouchers uv
           JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
           WHERE ${whereClauses.join(' AND ')}) AS issued_vouchers,
          (SELECT COUNT(*)
           FROM user_vouchers uv
           JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
           WHERE ${whereClauses.join(' AND ')} AND uv.status = 'redeemed') AS redeemed_vouchers
      `,
      { tenantId: request.adminAuth.tenantId }
    );

    const [topRows] = await mysqlPool.query<Array<AdminVoucherAnalyticsTopRow>>(
      `,
      { tenantId: request.adminAuth.tenantId }
        SELECT
          vt.code,
          vt.name,
          vt.voucher_type,
          vt.is_active,
          COUNT(uv.id) AS issued_count,
          SUM(CASE WHEN uv.status = 'redeemed' THEN 1 ELSE 0 END) AS redeemed_count
        FROM voucher_templates vt
        LEFT JOIN user_vouchers uv
          ON uv.voucher_template_id = vt.id
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY vt.id, vt.code, vt.name, vt.voucher_type, vt.is_active
        ORDER BY redeemed_count DESC, issued_count DESC, vt.created_at DESC
        LIMIT 10
      `
    );

    const [recentRows] = await mysqlPool.query<Array<AdminVoucherAnalyticsRecentRow>>(
      `
        SELECT
          uv.id,
          vt.code,
          vt.name,
          uv.status,
          uv.issued_reason,
          uv.issued_at,
          uv.redeemed_at,
          uv.revoked_at,
          up.display_name,
          up.email,
          u.phone_e164
        FROM user_vouchers uv
        JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
        JOIN users u ON u.id = uv.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE vt.tenant_id = :tenantId
        ORDER BY COALESCE(uv.redeemed_at, uv.revoked_at, uv.issued_at) DESC, uv.id DESC
        LIMIT 10
      `,
      { tenantId: request.adminAuth.tenantId }
    );

    const summary = summaryRows[0] ?? {
      total_vouchers: 0,
      active_vouchers: 0,
      issued_vouchers: 0,
      redeemed_vouchers: 0
    };
    const issued = Number(summary.issued_vouchers || 0);
    const redeemed = Number(summary.redeemed_vouchers || 0);

    return {
      summary: {
        totalVouchers: Number(summary.total_vouchers || 0),
        activeVouchers: Number(summary.active_vouchers || 0),
        issuedVouchers: issued,
        redeemedVouchers: redeemed,
        redemptionRate: issued > 0 ? Number(((redeemed / issued) * 100).toFixed(1)) : 0
      },
      topVouchers: topRows.map((row) => {
        const issuedCount = Number(row.issued_count || 0);
        const redeemedCount = Number(row.redeemed_count || 0);
        return {
          id: row.code,
          name: row.name,
          type: row.voucher_type,
          status: row.is_active === 1 ? 'Active' : 'Draft',
          issued: issuedCount,
          redeemed: redeemedCount,
          rate: issuedCount > 0 ? Number(((redeemedCount / issuedCount) * 100).toFixed(1)) : 0
        };
      }),
      recentActivity: recentRows.map((row) => {
        const action = row.status === 'redeemed'
          ? 'Redeemed'
          : row.status === 'revoked'
            ? 'Revoked'
            : 'Issued';
        const eventAt = row.redeemed_at || row.revoked_at || row.issued_at;

        return {
          id: row.id,
          voucherCode: row.code,
          voucherName: row.name,
          action,
          customer: {
            displayName: row.display_name || `Customer #${row.id}`,
            email: row.email,
            phone: row.phone_e164
          },
          issuedReason: row.issued_reason,
          eventAt: eventAt.toISOString()
        };
      })
    };
  });

  // POST /v1/admin/vouchers
  app.post('/v1/admin/vouchers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = applySafeBenefitScopeDefaults(voucherCreateUpdateSchema.parse(request.body));
    const voucherColumns = await getVoucherTemplateColumns();
    const tierScope = await normalizeVoucherTierScope(payload.tier);
    
    let discountMode = 'percent_rm';
    let voucherType = 'campaign_direct_pay';
    let discountValue = 0;
    let tokenValue: number | null = null;

    if (payload.benefitType === 'Free Drink' || payload.benefitType === 'Free Food') {
      discountMode = 'free_drink';
      discountValue = 1;
      voucherType = 'campaign_token_equivalent';
    } else if (payload.benefitType === 'Discount' || payload.benefitType === 'Percentage Off') {
      discountMode = 'percent_rm';
      discountValue = Number(payload.discountValue) || 0;
      voucherType = 'campaign_token_equivalent';
    } else if (payload.benefitType === 'Cash Voucher') {
      discountMode = 'fixed_rm';
      discountValue = Number(payload.discountValue) || 0;
      voucherType = 'campaign_token_equivalent';
    } else if (payload.benefitType === 'Token Discount') {
      discountMode = 'fixed_token';
      voucherType = 'campaign_token_equivalent';
      tokenValue = Number(payload.discountValue) || 0;
    } else if (payload.benefitType === 'Birthday Voucher') {
      discountMode = 'free_drink';
      discountValue = 1;
      voucherType = 'birthday_treat';
    }
    if (payload.type === 'Tier Reward') {
      voucherType = 'tier_reward';
    }

    const eligibleItems = normalizeEligibleItems(payload.eligibleItems);
    const productKinds = normalizeScopeCodes(payload.productKinds);
    const subcategoryCodes = normalizeScopeCodes(payload.subcategoryCodes);
    const categoryCodes = normalizeScopeCodes(payload.categoryCodes);
    const promotionRule = buildPromotionRule(payload);
    const derivedReward = deriveReward(payload);
    const validUntil = parseVoucherExpiry(payload.expiry);
    const isActive = payload.status === 'Active' ? 1 : 0;
    const schedule = buildScheduleFromPayload(payload);
    const effectiveValidUntil =
      voucherType === 'tier_reward'
        ? null
        : payload.status === 'Expired'
        ? new Date(Date.now() - 60 * 1000)
        : schedule.mode === 'birthday'
          ? null
          : validUntil;
    const scopeJson = JSON.stringify({
      frontend_type: payload.benefitType,
      type_label: payload.type,
      benefit_type: payload.benefitType,
      tier: tierScope,
      reward: derivedReward,
      product_kind_codes: productKinds,
      subcategory_codes: subcategoryCodes,
      category_codes: categoryCodes,
      items: eligibleItems,
      promotion_rule: promotionRule,
      topup_reward: payload.topupRewardMinTokens == null ? null : {
        min_tokens: payload.topupRewardMinTokens,
        trigger: 'single_paid_topup'
      },
      description: payload.description,
      usage_instructions: payload.usageInstructions,
      expiry_string: effectiveValidUntil?.toISOString() ?? '',
      audience: payload.audience,
      schedule
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = await nextVoucherCode(request.adminAuth.tenantId);
      const writeBindings = buildVoucherWriteBindings(
        voucherColumns,
        payload,
        scopeJson,
        discountMode,
        voucherType,
        discountValue,
        tokenValue,
        isActive,
        effectiveValidUntil,
        code
      );
      try {
        const [result] = await mysqlPool.query<ResultSetHeader>(
          `
            INSERT INTO voucher_templates (
              tenant_id, ${writeBindings.columns.join(', ')}
            ) VALUES (
              :tenantId, ${writeBindings.placeholders.join(', ')}
            )
          `,
          { ...(writeBindings.values as Record<string, unknown>), tenantId: request.adminAuth.tenantId } as never
        );
        return { id: code, db_id: result.insertId };
      } catch (error) {
        if (!isVoucherCodeCollision(error) || attempt === 2) throw error;
      }
    }

    throw new ApiError(409, 'voucher_code_unavailable', 'Unable to allocate a unique voucher code. Please try again.');
  });

  // PUT /v1/admin/vouchers/:id
  app.put<{ Params: { id: string } }>('/v1/admin/vouchers/:id', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = applySafeBenefitScopeDefaults(voucherCreateUpdateSchema.parse(request.body));
    const voucherColumns = await getVoucherTemplateColumns();
    const code = request.params.id;
    const tierScope = await normalizeVoucherTierScope(payload.tier);
    
    let discountMode = 'percent_rm';
    let voucherType = 'campaign_direct_pay';
    let discountValue = 0;
    let tokenValue: number | null = null;

    if (payload.benefitType === 'Free Drink' || payload.benefitType === 'Free Food') {
      discountMode = 'free_drink';
      discountValue = 1;
      voucherType = 'campaign_token_equivalent';
    } else if (payload.benefitType === 'Discount' || payload.benefitType === 'Percentage Off') {
      discountMode = 'percent_rm';
      discountValue = Number(payload.discountValue) || 0;
      voucherType = 'campaign_token_equivalent';
    } else if (payload.benefitType === 'Cash Voucher') {
      discountMode = 'fixed_rm';
      discountValue = Number(payload.discountValue) || 0;
      voucherType = 'campaign_token_equivalent';
    } else if (payload.benefitType === 'Token Discount') {
      discountMode = 'fixed_token';
      voucherType = 'campaign_token_equivalent';
      tokenValue = Number(payload.discountValue) || 0;
    } else if (payload.benefitType === 'Birthday Voucher') {
      discountMode = 'free_drink';
      discountValue = 1;
      voucherType = 'birthday_treat';
    }
    if (payload.type === 'Tier Reward') {
      voucherType = 'tier_reward';
    }
    const limitPerUser = voucherType === 'tier_reward' ? 1 : (payload.limitPerUser ?? 1);

    const eligibleItems = normalizeEligibleItems(payload.eligibleItems);
    const productKinds = normalizeScopeCodes(payload.productKinds);
    const subcategoryCodes = normalizeScopeCodes(payload.subcategoryCodes);
    const categoryCodes = normalizeScopeCodes(payload.categoryCodes);
    const promotionRule = buildPromotionRule(payload);
    const derivedReward = deriveReward(payload);
    const validUntil = parseVoucherExpiry(payload.expiry);
    const isActive = payload.status === 'Active' ? 1 : 0;
    const schedule = buildScheduleFromPayload(payload);
    const effectiveValidUntil =
      voucherType === 'tier_reward'
        ? null
        : payload.status === 'Expired'
        ? new Date(Date.now() - 60 * 1000)
        : schedule.mode === 'birthday'
          ? null
          : validUntil;
    const scopeJson = JSON.stringify({
      frontend_type: payload.benefitType,
      type_label: payload.type,
      benefit_type: payload.benefitType,
      tier: tierScope,
      reward: derivedReward,
      product_kind_codes: productKinds,
      subcategory_codes: subcategoryCodes,
      category_codes: categoryCodes,
      items: eligibleItems,
      promotion_rule: promotionRule,
      topup_reward: payload.topupRewardMinTokens == null ? null : {
        min_tokens: payload.topupRewardMinTokens,
        trigger: 'single_paid_topup'
      },
      description: payload.description,
      usage_instructions: payload.usageInstructions,
      expiry_string: effectiveValidUntil?.toISOString() ?? '',
      audience: payload.audience,
      schedule
    });
    const updateAssignments = [
      'name = :name',
      'voucher_type = :voucherType',
      'discount_mode = :discountMode',
      'discount_value = :discountValue',
      'token_value = :tokenValue',
      'eligible_scope_json = :scopeJson',
      'is_active = :isActive'
    ];

    if (hasColumn(voucherColumns, 'valid_until')) {
      updateAssignments.push('valid_until = :validUntil');
    }
    if (hasColumn(voucherColumns, 'total_quantity')) {
      updateAssignments.push('total_quantity = :totalQty');
    }
    if (hasColumn(voucherColumns, 'limit_per_user')) {
      updateAssignments.push('limit_per_user = :limitPerUser');
    }
    if (hasColumn(voucherColumns, 'image_url')) {
      updateAssignments.push('image_url = :imageUrl');
    }
    if (hasColumn(voucherColumns, 'usage_instructions')) {
      updateAssignments.push('usage_instructions = :usageInstructions');
    }

    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      const [currentRows] = await connection.query<Array<VoucherTemplateRow & { issuance_count: number }>>(
        `
          SELECT vt.*,
                 (SELECT COUNT(*) FROM user_vouchers uv WHERE uv.voucher_template_id = vt.id) AS issuance_count
          FROM voucher_templates vt
          WHERE vt.code = :code AND vt.tenant_id = :tenantId
          LIMIT 1
          FOR UPDATE
        `,
        { code, tenantId: request.adminAuth.tenantId }
      );
      const current = currentRows[0];
      if (!current) {
        throw new ApiError(404, 'voucher_not_found', 'Voucher was not found.');
      }

      const protectedRuleChange =
        current.voucher_type !== voucherType ||
        current.discount_mode !== discountMode ||
        !sameNullableNumber(current.discount_value, discountValue) ||
        !sameNullableNumber(current.token_value, tokenValue) ||
        canonicalVoucherRules(current.eligible_scope_json) !== canonicalVoucherRules(scopeJson) ||
        (hasColumn(voucherColumns, 'total_quantity') && !sameNullableNumber(current.total_quantity, payload.totalQty ?? null)) ||
        (hasColumn(voucherColumns, 'limit_per_user') && !sameNullableNumber(current.limit_per_user, limitPerUser));
      const remainsUsable = isActive === 1 &&
        (!effectiveValidUntil || effectiveValidUntil.getTime() > Date.now());

      // Issued vouchers intentionally use the live template at checkout. To
      // prevent an administrator silently changing a customer's issued value,
      // reward, eligibility, schedule, and quantity changes require a new
      // campaign. The campaign redeem-until date remains editable so admins
      // can extend or shorten the redemption window. Disabling/expiring remains
      // allowed and revokes every unused issuance below.
      if (Number(current.issuance_count ?? 0) > 0 && remainsUsable && protectedRuleChange) {
        throw new ApiError(
          409,
          'voucher_has_issuances',
          'This voucher has already been issued. Create a new voucher for benefit, eligibility, schedule, or limit changes. You may still change its redeem-until date.'
        );
      }

      await connection.query(
        `
          UPDATE voucher_templates
          SET ${updateAssignments.join(', ')}
          WHERE code = :code AND tenant_id = :tenantId
        `,
        {
          code,
          tenantId: request.adminAuth.tenantId,
          name: payload.name,
          voucherType,
          discountMode,
          discountValue,
          tokenValue,
          scopeJson,
          isActive,
          validUntil: effectiveValidUntil,
          totalQty: payload.totalQty ?? null,
          limitPerUser,
          imageUrl: payload.imageUrl || null,
          usageInstructions: payload.usageInstructions || null
        }
      );

      if (!remainsUsable) {
        await connection.execute(
          `
            UPDATE user_vouchers uv
            JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
            SET uv.status = 'revoked',
                uv.revoked_by_admin_id = :adminUserId,
                uv.revoked_reason = 'Voucher campaign is no longer available.',
                uv.revoked_at = UTC_TIMESTAMP()
            WHERE vt.code = :code
              AND vt.tenant_id = :tenantId
              AND uv.status = 'active'
              AND uv.redeemed_at IS NULL
              AND uv.revoked_at IS NULL
          `,
          { code, tenantId: request.adminAuth.tenantId, adminUserId: request.adminAuth.adminUserId }
        );
      }

      const [updatedRows] = await connection.query<Array<RowDataPacket & { image_url: string | null }>>(
        `
          SELECT image_url
          FROM voucher_templates
          WHERE code = :code AND tenant_id = :tenantId
          LIMIT 1
        `,
        { code, tenantId: request.adminAuth.tenantId }
      );
      await connection.commit();
      return { success: true, imageUrl: updatedRows[0]?.image_url ?? null };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.patch<{ Params: { id: string } }>('/v1/admin/vouchers/:id/expiry', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const code = request.params.id;
    const payload = voucherExpiryUpdateSchema.parse(request.body);
    const validUntil = parseVoucherExpiry(payload.expiry);
    const voucherColumns = await getVoucherTemplateColumns();
    const connection = await getUtcConnection();

    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<Array<VoucherTemplateRow>>(
        `
          SELECT *
          FROM voucher_templates
          WHERE code = :code AND tenant_id = :tenantId
          LIMIT 1
          FOR UPDATE
        `,
        { code, tenantId: request.adminAuth.tenantId }
      );
      const current = rows[0];
      if (!current) {
        throw new ApiError(404, 'voucher_not_found', 'Voucher was not found.');
      }

      const scope = parseScopeJson(current.eligible_scope_json);
      const schedule = getScheduleFromScope(scope);
      if (schedule.mode === 'birthday' || current.voucher_type === 'birthday_treat') {
        throw new ApiError(400, 'birthday_voucher_expiry_not_allowed', 'Birthday vouchers are available during the customer birthday month and do not use a fixed redeem-until date.');
      }
      if (current.voucher_type === 'tier_reward') {
        throw new ApiError(400, 'tier_reward_expiry_not_allowed', 'Tier rewards follow the customer current cup-progress tier and do not use a fixed redeem-until date.');
      }

      scope.expiry_string = validUntil?.toISOString() ?? '';
      const assignments = ['eligible_scope_json = :scopeJson'];
      if (hasColumn(voucherColumns, 'valid_until')) assignments.push('valid_until = :validUntil');

      await connection.execute(
        `UPDATE voucher_templates SET ${assignments.join(', ')} WHERE code = :code AND tenant_id = :tenantId`,
        {
          code,
          tenantId: request.adminAuth.tenantId,
          scopeJson: JSON.stringify(scope),
          validUntil
        }
      );

      if (validUntil && validUntil.getTime() <= Date.now()) {
        await connection.execute(
          `
            UPDATE user_vouchers uv
            JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
            SET uv.status = 'revoked',
                uv.revoked_by_admin_id = :adminUserId,
                uv.revoked_reason = 'Voucher campaign redeem-until date has passed.',
                uv.revoked_at = UTC_TIMESTAMP()
            WHERE vt.code = :code
              AND vt.tenant_id = :tenantId
              AND uv.status = 'active'
              AND uv.redeemed_at IS NULL
              AND uv.revoked_at IS NULL
          `,
          { code, tenantId: request.adminAuth.tenantId, adminUserId: request.adminAuth.adminUserId }
        );
      }

      await connection.commit();
      return { success: true, expiry: validUntil?.toISOString() ?? '' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  // DELETE /v1/admin/vouchers/:id
  app.delete<{ Params: { id: string } }>('/v1/admin/vouchers/:id', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const code = request.params.id;
    const voucherColumns = await getVoucherTemplateColumns();
    
    const updates = ['is_active = 0'];
    if (hasColumn(voucherColumns, 'deleted_at')) {
      updates.push('deleted_at = UTC_TIMESTAMP()');
    }

    await mysqlPool.query(
      `
        UPDATE voucher_templates
        SET ${updates.join(', ')}
        WHERE code = :code AND tenant_id = :tenantId
      `,
      { code, tenantId: request.adminAuth.tenantId }
    );

    await revokeUnusedVoucherIssuances(
      code,
      request.adminAuth.tenantId,
      request.adminAuth.adminUserId,
      'Voucher campaign was deleted by the store.'
    );

    return { success: true };
  });

  app.get<{ Params: { id: string } }>(
    '/v1/admin/vouchers/:id/issuances',
    { preHandler: [authenticateAdminRequest] },
    async (request) => {
      requireAdminRole(request, 'super_admin');
      const { limit } = voucherIssuanceListQuerySchema.parse(request.query);

      const [rows] = await mysqlPool.query<Array<AdminIssuedVoucherRow>>(
        `
          SELECT
            uv.id,
            uv.user_id,
            uv.status,
            uv.issued_reason,
            uv.issue_case_ref,
            uv.tier_at_issue,
            uv.issued_at,
            uv.expires_at,
            uv.redeemed_at,
            uv.revoked_at,
            uv.revoked_reason,
            up.display_name,
            up.email,
            u.phone_e164
          FROM user_vouchers uv
          JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
          JOIN users u ON u.id = uv.user_id
          LEFT JOIN user_profiles up ON up.user_id = u.id
          WHERE vt.code = :code
            AND vt.tenant_id = :tenantId
          ORDER BY uv.issued_at DESC, uv.id DESC
          LIMIT :limit
        `,
        {
          code: request.params.id,
          tenantId: request.adminAuth.tenantId,
          limit
        }
      );

      return {
        issuances: rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          status: row.status,
          issuedReason: row.issued_reason,
          issueCaseRef: row.issue_case_ref,
          tierAtIssue: titleCaseTier(row.tier_at_issue),
          issuedAt: row.issued_at.toISOString(),
          expiresAt: row.expires_at.toISOString(),
          redeemedAt: row.redeemed_at?.toISOString() ?? null,
          revokedAt: row.revoked_at?.toISOString() ?? null,
          revokedReason: row.revoked_reason,
          customer: {
            displayName: row.display_name || `Customer #${row.user_id}`,
            email: row.email,
            phone: row.phone_e164
          }
        }))
      };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/vouchers/:id/issuances',
    { preHandler: [authenticateAdminRequest] },
    async (request) => {
      requireAdminRole(request, 'super_admin');
      const payload = voucherIssueSchema.parse(request.body);
      const voucherColumns = await getVoucherTemplateColumns();

      const selectColumns = [
        'vt.id',
        'vt.code',
        'vt.name',
        'vt.voucher_type',
        'vt.discount_mode',
        'vt.discount_value',
        'vt.token_value',
        'vt.min_spend_rm',
        'vt.eligible_scope_json',
        'vt.exclude_scope_json',
        'vt.requires_drink_in_cart',
        'vt.stack_rule',
        'vt.expires_in_days',
        'vt.is_active',
        'vt.created_at',
        'vt.updated_at'
      ];

      if (hasColumn(voucherColumns, 'valid_until')) {
        selectColumns.push('vt.valid_until');
      }
      if (hasColumn(voucherColumns, 'total_quantity')) {
        selectColumns.push('vt.total_quantity');
      }
      if (hasColumn(voucherColumns, 'limit_per_user')) {
        selectColumns.push('vt.limit_per_user');
      }

      const [templateRows] = await mysqlPool.query<Array<VoucherTemplateRow>>(
        `
          SELECT
            ${selectColumns.join(',\n            ')}
          FROM voucher_templates vt
          WHERE vt.code = :code
            AND vt.tenant_id = :tenantId
          LIMIT 1
        `,
        { code: request.params.id, tenantId: request.adminAuth.tenantId }
      );

      const template = templateRows[0];
      if (!template) {
        throw new ApiError(404, 'voucher_not_found', 'Voucher template was not found.');
      }

      const scope = parseScopeJson(template.eligible_scope_json);
      const expiryDate = getVoucherExpiryDate(scope, template);
      const status = getVoucherStatus(template, expiryDate);
      if (status !== 'Active') {
        throw new ApiError(400, 'voucher_not_active', 'Only active voucher templates can be issued.');
      }

      const [customerRows] = await mysqlPool.query<Array<AdminVoucherCustomerRow>>(
        `
          SELECT
            u.id,
            u.phone_e164,
            u.status,
            ctm.is_employee,
            up.display_name,
            up.email,
            (
              SELECT lts.tier_code
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ) AS tier_code
          FROM users u
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
          LEFT JOIN user_profiles up ON up.user_id = u.id
          WHERE (
            (:userId IS NOT NULL AND u.id = :userId)
            OR (:phone IS NOT NULL AND u.phone_e164 = :phone)
          )
          LIMIT 1
        `,
        {
          userId: payload.userId ?? null,
          phone: payload.phone ?? null,
          tenantId: request.adminAuth.tenantId
        }
      );

      const customer = customerRows[0];
      if (!customer || customer.status !== 'active') {
        throw new ApiError(404, 'customer_not_found', 'Customer was not found or is not active.');
      }

      if (normalizeAudience(scope) === 'employee_only' && Number(customer.is_employee) !== 1) {
        throw new ApiError(400, 'voucher_employee_only', 'This voucher can only be issued to customer accounts marked as employees.');
      }

      const voucherTierScope = await normalizeVoucherTierScope(scope.tier);
      const customerTier = String(customer.tier_code ?? '').trim().toLowerCase();
      if (voucherTierScope !== 'all' && voucherTierScope !== customerTier) {
        throw new ApiError(400, 'voucher_tier_not_eligible', 'This customer is not in the eligible member tier for this voucher.');
      }

      const resolvedExpiry = resolveVoucherExpiryForIssue(template, scope, payload.expiresAt);
      if (resolvedExpiry.getTime() <= Date.now()) {
        throw new ApiError(400, 'invalid_expiry', 'Issued voucher expiry must be in the future.');
      }

      const connection = await getUtcConnection();
      try {
        await connection.beginTransaction();

        const [lockedRows] = await connection.query<Array<RowDataPacket & {
          id: number;
          is_active: number;
          valid_until: Date | null;
          total_quantity: number | null;
          limit_per_user: number | null;
          updated_at: Date;
        }>>(
          `
            SELECT vt.id, vt.is_active, vt.valid_until, vt.total_quantity,
                   vt.limit_per_user, vt.updated_at
            FROM voucher_templates vt
            WHERE vt.id = :templateId
              AND vt.tenant_id = :tenantId
            LIMIT 1
            FOR UPDATE
          `,
          { templateId: template.id, tenantId: request.adminAuth.tenantId }
        );
        const lockedTemplate = lockedRows[0];
        if (!lockedTemplate) {
          throw new ApiError(404, 'voucher_not_found', 'Voucher template was not found.');
        }
        if (
          lockedTemplate.is_active !== 1 ||
          (lockedTemplate.valid_until && lockedTemplate.valid_until.getTime() <= Date.now())
        ) {
          throw new ApiError(400, 'voucher_not_active', 'Only active voucher templates can be issued.');
        }

        const originallyReadUpdatedAt = parseDateValue(template.updated_at)?.getTime();
        if (originallyReadUpdatedAt && lockedTemplate.updated_at.getTime() !== originallyReadUpdatedAt) {
          throw new ApiError(409, 'voucher_changed', 'Voucher settings changed. Refresh and try again.');
        }

        if (payload.issueCaseRef) {
          const [existingIssueRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
            `
              SELECT id
              FROM user_vouchers
              WHERE user_id = :userId
                AND voucher_template_id = :templateId
                AND issue_case_ref = :issueCaseRef
              LIMIT 1
            `,
            {
              userId: customer.id,
              templateId: lockedTemplate.id,
              issueCaseRef: payload.issueCaseRef
            }
          );
          if (existingIssueRows[0]) {
            await connection.commit();
            return {
              success: true,
              issuedVoucherId: existingIssueRows[0].id,
              idempotentReplay: true
            };
          }
        }

        const [countRows] = await connection.query<Array<RowDataPacket & {
          total_count: number;
          user_count: number;
        }>>(
          `
            SELECT
              COUNT(*) AS total_count,
              COALESCE(SUM(CASE WHEN user_id = :userId THEN 1 ELSE 0 END), 0) AS user_count
            FROM user_vouchers
            WHERE voucher_template_id = :templateId
              AND status <> 'revoked'
          `,
          { templateId: lockedTemplate.id, userId: customer.id }
        );
        const counts = countRows[0];
        if (
          lockedTemplate.total_quantity != null &&
          Number(counts?.total_count ?? 0) >= Number(lockedTemplate.total_quantity)
        ) {
          throw new ApiError(409, 'voucher_quantity_exhausted', 'Voucher allocation has been fully used.');
        }
        if (
          lockedTemplate.limit_per_user != null &&
          Number(counts?.user_count ?? 0) >= Number(lockedTemplate.limit_per_user)
        ) {
          throw new ApiError(409, 'voucher_limit_per_user_reached', 'This customer has already reached the issue limit for this voucher.');
        }

        const [result] = await connection.query<ResultSetHeader>(
          `
            INSERT INTO user_vouchers (
              user_id, voucher_template_id, status, issued_by_type,
              issued_by_admin_id, issued_reason, issue_case_ref, tier_at_issue,
              issued_at, expires_at
            ) VALUES (
              :userId, :templateId, 'active', 'admin', :adminUserId,
              :issuedReason, :issueCaseRef, :tierAtIssue, UTC_TIMESTAMP(), :expiresAt
            )
          `,
          {
            userId: customer.id,
            templateId: lockedTemplate.id,
            adminUserId: request.adminAuth.adminUserId,
            issuedReason: payload.issuedReason || `Admin issued ${template.name}`,
            issueCaseRef: payload.issueCaseRef || null,
            tierAtIssue: customerTier || null,
            expiresAt: resolvedExpiry
          }
        );

        await connection.commit();
        return { success: true, issuedVoucherId: result.insertId };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/user-vouchers/:id/revoke',
    { preHandler: [authenticateAdminRequest] },
    async (request) => {
      requireAdminRole(request, 'super_admin');
      const payload = revokeIssuedVoucherSchema.parse(request.body);
      const connection = await getUtcConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<Array<RowDataPacket & { id: number; status: string }>>(
          `
            SELECT uv.id, uv.status
            FROM user_vouchers uv
            JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
            WHERE uv.id = :id
              AND vt.tenant_id = :tenantId
            LIMIT 1
            FOR UPDATE
          `,
          { id: Number(request.params.id), tenantId: request.adminAuth.tenantId }
        );

        const issuedVoucher = rows[0];
        if (!issuedVoucher) {
          throw new ApiError(404, 'issued_voucher_not_found', 'Issued voucher was not found.');
        }
        if (issuedVoucher.status !== 'active') {
          throw new ApiError(400, 'issued_voucher_not_active', 'Only active issued vouchers can be revoked.');
        }

        await connection.query(
          `
            UPDATE user_vouchers
            SET status = 'revoked',
                revoked_by_admin_id = :adminUserId,
                revoked_reason = :reason,
                revoked_at = UTC_TIMESTAMP()
            WHERE id = :id
              AND status = 'active'
          `,
          {
            id: issuedVoucher.id,
            adminUserId: request.adminAuth.adminUserId,
            reason: payload.reason
          }
        );
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  );
}
