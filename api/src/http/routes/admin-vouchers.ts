import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const voucherCreateUpdateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(100),
  benefitType: z.string().trim().min(1).max(50),
  status: z.enum(['Active', 'Expired', 'Draft']).optional().default('Active'),
  tier: z.string(),
  reward: z.string().trim().max(255).optional(),
  discountValue: z.union([z.string(), z.number()]).optional(),
  productKinds: z.array(z.string()).optional().default([]),
  subcategoryCodes: z.array(z.string()).optional().default([]),
  eligibleItems: z.array(z.string()),
  expiry: z.string().trim().optional().nullable(),
  totalQty: z.number().int().nullable().optional(),
  limitPerUser: z.number().int().nullable().optional(),
  description: z.string().optional(),
  audience: z
    .enum(['all_customers', 'employee_only', 'manual_issue_only'])
    .optional()
    .default('all_customers'),
  availabilityMode: z
    .enum(['always', 'daily', 'weekly', 'annual'])
    .optional()
    .default('always'),
  activeDays: z.array(z.string()).optional().default([]),
  startTime: z.string().trim().optional().nullable(),
  endTime: z.string().trim().optional().nullable(),
  annualDate: z.string().trim().optional().nullable()
});

const customerSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(25).optional().default(10)
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

const BENEFIT_TYPES = new Set([
  'Free Drink',
  'Free Food',
  'Percentage Off',
  'Cash Voucher',
  'Token Discount',
  'Birthday Voucher'
]);

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
};

type AdminVoucherCustomerRow = RowDataPacket & {
  id: number;
  phone_e164: string;
  status: string;
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

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
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

function addDays(base: Date, days: number): Date {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function deriveReward(payload: VoucherPayload): string {
  const explicitReward = payload.reward?.trim();
  if (explicitReward) return explicitReward;

  const firstItem = payload.eligibleItems[0]?.trim();

  if (payload.benefitType === 'Free Drink') {
    return firstItem ? `Free ${firstItem}` : 'Free Drink';
  }

  if (payload.benefitType === 'Free Food') {
    return firstItem ? `Free ${firstItem}` : 'Free Food';
  }

  if (payload.benefitType === 'Percentage Off') {
    return `${Number(payload.discountValue) || 0}% Discount`;
  }

  if (payload.benefitType === 'Token Discount') {
    return `${Number(payload.discountValue) || 0} Tokens Off`;
  }

  if (payload.benefitType === 'Birthday Voucher') {
    return 'Birthday Treat';
  }

  return payload.name;
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
    return 'Token Discount';
  }

  if (row.discount_mode === 'fixed_rm') {
    return 'Cash Voucher';
  }

  if (row.discount_mode === 'percent_rm') {
    return 'Percentage Off';
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

  return Array.from(
    new Set(
      days
        .map((day) => DAY_NAME_MAP[String(day).trim().toLowerCase()])
        .filter((day): day is string => Boolean(day))
    )
  );
}

function normalizeAnnualDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed.slice(5);
  }

  return null;
}

type VoucherSchedule = {
  mode: 'always' | 'daily' | 'weekly' | 'annual';
  activeDays: string[];
  startTime: string | null;
  endTime: string | null;
  annualDate: string | null;
  timezone: 'Asia/Kuala_Lumpur';
};

function buildScheduleFromPayload(payload: VoucherPayload): VoucherSchedule {
  return {
    mode: payload.availabilityMode,
    activeDays: payload.availabilityMode === 'weekly' ? normalizeActiveDays(payload.activeDays) : [],
    startTime: normalizeTimeValue(payload.startTime),
    endTime: normalizeTimeValue(payload.endTime),
    annualDate: payload.availabilityMode === 'annual' ? normalizeAnnualDate(payload.annualDate) : null,
    timezone: 'Asia/Kuala_Lumpur'
  };
}

function getScheduleFromScope(scope: Record<string, unknown>): VoucherSchedule {
  const raw = scope.schedule && typeof scope.schedule === 'object' ? (scope.schedule as Record<string, unknown>) : {};
  const mode = String(raw.mode || 'always').trim();

  return {
    mode:
      mode === 'daily' || mode === 'weekly' || mode === 'annual'
        ? mode
        : 'always',
    activeDays: normalizeActiveDays(Array.isArray(raw.activeDays) ? raw.activeDays.map((day) => String(day)) : []),
    startTime: normalizeTimeValue(typeof raw.startTime === 'string' ? raw.startTime : null),
    endTime: normalizeTimeValue(typeof raw.endTime === 'string' ? raw.endTime : null),
    annualDate: normalizeAnnualDate(typeof raw.annualDate === 'string' ? raw.annualDate : null),
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

  if (schedule.mode === 'daily') {
    return timeLabel ? `Every day, ${timeLabel}` : 'Every day';
  }

  if (schedule.mode === 'weekly') {
    const dayLabel = schedule.activeDays.length > 0 ? schedule.activeDays.join(', ') : 'selected days';
    return timeLabel ? `Every ${dayLabel}, ${timeLabel}` : `Every ${dayLabel}`;
  }

  if (schedule.mode === 'annual') {
    const annualDateLabel = formatAnnualDateLabel(schedule.annualDate) || 'selected date';
    return timeLabel ? `Every ${annualDateLabel}, ${timeLabel}` : `Every ${annualDateLabel}`;
  }

  if (expiryDate) {
    return expiryDate.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  }

  return 'Always available';
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
  validUntil: Date | null
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
    code: payload.code,
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
    values.limitPerUser = payload.limitPerUser ?? 1;
  }

  return { columns: columnsToWrite, placeholders, values };
}

export async function registerAdminVoucherRoutes(app: FastifyInstance): Promise<void> {
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

    if (hasColumn(voucherColumns, 'valid_until')) {
      selectColumns.push('vt.valid_until');
    }
    if (hasColumn(voucherColumns, 'total_quantity')) {
      selectColumns.push('vt.total_quantity');
    }
    if (hasColumn(voucherColumns, 'limit_per_user')) {
      selectColumns.push('vt.limit_per_user');
    }

    const whereClauses = ['1 = 1'];
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
      `
    );

    const vouchers = rows.map((row) => {
      const templateRow = row as VoucherTemplateRow;
      const scope = parseScopeJson(templateRow.eligible_scope_json);
      const type = normalizeFrontendType(scope, templateRow);
      const benefitType = normalizeBenefitType(scope, templateRow);
      const audience = normalizeAudience(scope);
      const expiryDate = getVoucherExpiryDate(scope, templateRow);
      const schedule = getScheduleFromScope(scope);
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
        audience,
        tier: String(scope.tier || 'All Tiers'),
        reward: String(scope.reward || templateRow.name || ''),
        discountValue: templateRow.discount_mode === 'fixed_token' ? templateRow.token_value : templateRow.discount_value,
        eligibleItems:
          Array.isArray(scope.items) && scope.items.length > 0
            ? normalizeEligibleItems(scope.items.map((item) => String(item)))
            : ['All Items'],
        productKinds: normalizeScopeCodes(
          Array.isArray(scope.product_kind_codes) ? scope.product_kind_codes.map((item) => String(item)) : []
        ),
        subcategoryCodes: normalizeScopeCodes(
          Array.isArray(scope.subcategory_codes) ? scope.subcategory_codes.map((item) => String(item)) : []
        ),
        expiry: expiryDate ? expiryDate.toISOString() : String(scope.expiry_string || ''),
        expiryFull: availabilityLabel,
        availabilityMode: schedule.mode,
        activeDays: schedule.activeDays,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        annualDate: schedule.annualDate,
        availabilityLabel,
        totalQty: hasColumn(voucherColumns, 'total_quantity') ? (templateRow.total_quantity ?? null) : null,
        limitPerUser: hasColumn(voucherColumns, 'limit_per_user') ? (templateRow.limit_per_user ?? 1) : 1,
        description: String(scope.description || ''),
        status: getVoucherStatus(templateRow, expiryDate),
        issued: issuedCount,
        redeemed: redeemedCount,
        rate: issuedCount > 0 ? `${Math.round((redeemedCount / issuedCount) * 100)}%` : '0%',
        created: createdDate
          ? createdDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : ''
      };
    });

    return { vouchers };
  });

  // POST /v1/admin/vouchers
  app.post('/v1/admin/vouchers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = voucherCreateUpdateSchema.parse(request.body);
    const voucherColumns = await getVoucherTemplateColumns();
    
    let discountMode = 'percent_rm';
    let voucherType = 'campaign_direct_pay';
    let discountValue = 0;
    let tokenValue: number | null = null;

    if (payload.benefitType === 'Free Drink' || payload.benefitType === 'Free Food') {
      discountMode = 'free_drink';
      discountValue = 1;
      voucherType = 'campaign_token_equivalent';
    } else if (payload.benefitType === 'Percentage Off') {
      discountMode = 'percent_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.benefitType === 'Cash Voucher') {
      discountMode = 'fixed_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.benefitType === 'Token Discount') {
      discountMode = 'fixed_token';
      voucherType = 'campaign_token_equivalent';
      tokenValue = Number(payload.discountValue) || 0;
    } else if (payload.benefitType === 'Birthday Voucher') {
      discountMode = 'free_drink';
      discountValue = 1;
      voucherType = 'birthday_treat';
    }

    const eligibleItems = normalizeEligibleItems(payload.eligibleItems);
    const productKinds = normalizeScopeCodes(payload.productKinds);
    const subcategoryCodes = normalizeScopeCodes(payload.subcategoryCodes);
    const derivedReward = deriveReward(payload);
    const validUntil = parseDateValue(payload.expiry);
    const isActive = payload.status === 'Draft' ? 0 : 1;
    const schedule = buildScheduleFromPayload(payload);
    const effectiveValidUntil =
      payload.status === 'Expired'
        ? new Date(Date.now() - 60 * 1000)
        : validUntil;
    const scopeJson = JSON.stringify({
      frontend_type: payload.benefitType,
      type_label: payload.type,
      benefit_type: payload.benefitType,
      tier: payload.tier,
      reward: derivedReward,
      product_kind_codes: productKinds,
      subcategory_codes: subcategoryCodes,
      items: eligibleItems,
      description: payload.description,
      expiry_string: effectiveValidUntil?.toISOString() ?? '',
      audience: payload.audience,
      schedule
    });
    const writeBindings = buildVoucherWriteBindings(
      voucherColumns,
      payload,
      scopeJson,
      discountMode,
      voucherType,
      discountValue,
      tokenValue,
      isActive,
      effectiveValidUntil
    );

    const [result] = await mysqlPool.query<ResultSetHeader>(
      `
        INSERT INTO voucher_templates (
          ${writeBindings.columns.join(', ')}
        ) VALUES (
          ${writeBindings.placeholders.join(', ')}
        )
      `,
      writeBindings.values as never
    );

    return { id: payload.code, db_id: result.insertId };
  });

  // PUT /v1/admin/vouchers/:id
  app.put<{ Params: { id: string } }>('/v1/admin/vouchers/:id', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = voucherCreateUpdateSchema.parse(request.body);
    const voucherColumns = await getVoucherTemplateColumns();
    const code = request.params.id;
    
    let discountMode = 'percent_rm';
    let voucherType = 'campaign_direct_pay';
    let discountValue = 0;
    let tokenValue: number | null = null;

    if (payload.benefitType === 'Free Drink' || payload.benefitType === 'Free Food') {
      discountMode = 'free_drink';
      discountValue = 1;
      voucherType = 'campaign_token_equivalent';
    } else if (payload.benefitType === 'Percentage Off') {
      discountMode = 'percent_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.benefitType === 'Cash Voucher') {
      discountMode = 'fixed_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.benefitType === 'Token Discount') {
      discountMode = 'fixed_token';
      voucherType = 'campaign_token_equivalent';
      tokenValue = Number(payload.discountValue) || 0;
    } else if (payload.benefitType === 'Birthday Voucher') {
      discountMode = 'free_drink';
      discountValue = 1;
      voucherType = 'birthday_treat';
    }

    const eligibleItems = normalizeEligibleItems(payload.eligibleItems);
    const productKinds = normalizeScopeCodes(payload.productKinds);
    const subcategoryCodes = normalizeScopeCodes(payload.subcategoryCodes);
    const derivedReward = deriveReward(payload);
    const validUntil = parseDateValue(payload.expiry);
    const isActive = payload.status === 'Draft' ? 0 : 1;
    const schedule = buildScheduleFromPayload(payload);
    const effectiveValidUntil =
      payload.status === 'Expired'
        ? new Date(Date.now() - 60 * 1000)
        : validUntil;
    const scopeJson = JSON.stringify({
      frontend_type: payload.benefitType,
      type_label: payload.type,
      benefit_type: payload.benefitType,
      tier: payload.tier,
      reward: derivedReward,
      product_kind_codes: productKinds,
      subcategory_codes: subcategoryCodes,
      items: eligibleItems,
      description: payload.description,
      expiry_string: effectiveValidUntil?.toISOString() ?? '',
      audience: payload.audience,
      schedule
    });
    const writeBindings = buildVoucherWriteBindings(
      voucherColumns,
      payload,
      scopeJson,
      discountMode,
      voucherType,
      discountValue,
      tokenValue,
      isActive,
      effectiveValidUntil
    );

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

    await mysqlPool.query(
      `
        UPDATE voucher_templates
        SET ${updateAssignments.join(', ')}
        WHERE code = :code
      `,
      {
        code,
        name: payload.name,
        voucherType,
        discountMode,
        discountValue,
        tokenValue,
        scopeJson,
        isActive,
        validUntil: effectiveValidUntil,
        totalQty: payload.totalQty ?? null,
        limitPerUser: payload.limitPerUser ?? 1
      }
    );

    return { success: true };
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
        WHERE code = :code
      `,
      { code }
    );

    return { success: true };
  });

  app.delete<{ Params: { id: string } }>('/v1/admin/vouchers/:id/permanent', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const code = request.params.id;

    const [templateRows] = await mysqlPool.query<Array<RowDataPacket & { id: number }>>(
      `
        SELECT id
        FROM voucher_templates
        WHERE code = :code
        LIMIT 1
      `,
      { code }
    );

    const template = templateRows[0];
    if (!template) {
      throw new ApiError(404, 'voucher_not_found', 'Voucher template was not found.');
    }

    const [usageRows] = await mysqlPool.query<Array<RowDataPacket & { usage_count: number }>>(
      `
        SELECT COUNT(*) AS usage_count
        FROM user_vouchers
        WHERE voucher_template_id = :templateId
      `,
      { templateId: template.id }
    );

    if (Number(usageRows[0]?.usage_count || 0) > 0) {
      throw new ApiError(
        409,
        'voucher_has_usage_history',
        'This voucher already has issued or redeemed history. Archive it instead of deleting permanently.'
      );
    }

    await mysqlPool.query(
      `
        DELETE FROM voucher_templates
        WHERE id = :templateId
      `,
      { templateId: template.id }
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
          ORDER BY uv.issued_at DESC, uv.id DESC
          LIMIT :limit
        `,
        {
          code: request.params.id,
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
          LIMIT 1
        `,
        { code: request.params.id }
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
          WHERE (
            (:userId IS NOT NULL AND u.id = :userId)
            OR (:phone IS NOT NULL AND u.phone_e164 = :phone)
          )
          LIMIT 1
        `,
        {
          userId: payload.userId ?? null,
          phone: payload.phone ?? null
        }
      );

      const customer = customerRows[0];
      if (!customer || customer.status !== 'active') {
        throw new ApiError(404, 'customer_not_found', 'Customer was not found or is not active.');
      }

      if (hasColumn(voucherColumns, 'total_quantity') && template.total_quantity !== null && template.total_quantity !== undefined) {
        const [quantityRows] = await mysqlPool.query<Array<RowDataPacket & { count: number }>>(
          `
            SELECT COUNT(*) AS count
            FROM user_vouchers
            WHERE voucher_template_id = :templateId
              AND status <> 'revoked'
          `,
          { templateId: template.id }
        );

        if ((quantityRows[0]?.count ?? 0) >= template.total_quantity) {
          throw new ApiError(400, 'voucher_quantity_exhausted', 'Voucher allocation has been fully used.');
        }
      }

      if (hasColumn(voucherColumns, 'limit_per_user') && template.limit_per_user !== null && template.limit_per_user !== undefined) {
        const [limitRows] = await mysqlPool.query<Array<RowDataPacket & { count: number }>>(
          `
            SELECT COUNT(*) AS count
            FROM user_vouchers
            WHERE voucher_template_id = :templateId
              AND user_id = :userId
              AND status <> 'revoked'
          `,
          {
            templateId: template.id,
            userId: payload.userId
          }
        );

        if ((limitRows[0]?.count ?? 0) >= template.limit_per_user) {
          throw new ApiError(400, 'voucher_limit_per_user_reached', 'This customer has already reached the issue limit for this voucher.');
        }
      }

      const resolvedExpiry = resolveVoucherExpiryForIssue(template, scope, payload.expiresAt);
      if (resolvedExpiry.getTime() <= Date.now()) {
        throw new ApiError(400, 'invalid_expiry', 'Issued voucher expiry must be in the future.');
      }

      const [result] = await mysqlPool.query<ResultSetHeader>(
        `
          INSERT INTO user_vouchers (
            user_id,
            voucher_template_id,
            status,
            issued_by_type,
            issued_by_admin_id,
            issued_reason,
            issue_case_ref,
            tier_at_issue,
            issued_at,
            expires_at
          )
          VALUES (
            :userId,
            :templateId,
            'active',
            'admin',
            :adminUserId,
            :issuedReason,
            :issueCaseRef,
            :tierAtIssue,
            UTC_TIMESTAMP(),
            :expiresAt
          )
        `,
        {
          userId: payload.userId,
          templateId: template.id,
          adminUserId: request.adminAuth.adminUserId,
          issuedReason: payload.issuedReason || `Admin issued ${template.name}`,
          issueCaseRef: payload.issueCaseRef || null,
          tierAtIssue: (customer.tier_code as string | null) ?? 'kawan',
          expiresAt: resolvedExpiry
        }
      );

      return {
        success: true,
        issuedVoucherId: result.insertId
      };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/user-vouchers/:id/revoke',
    { preHandler: [authenticateAdminRequest] },
    async (request) => {
      requireAdminRole(request, 'super_admin');
      const payload = revokeIssuedVoucherSchema.parse(request.body);

      const [rows] = await mysqlPool.query<Array<RowDataPacket & { id: number; status: string }>>(
        `
          SELECT id, status
          FROM user_vouchers
          WHERE id = :id
          LIMIT 1
          FOR UPDATE
        `,
        { id: Number(request.params.id) }
      );

      const issuedVoucher = rows[0];
      if (!issuedVoucher) {
        throw new ApiError(404, 'issued_voucher_not_found', 'Issued voucher was not found.');
      }

      if (issuedVoucher.status !== 'active') {
        throw new ApiError(400, 'issued_voucher_not_active', 'Only active issued vouchers can be revoked.');
      }

      await mysqlPool.query(
        `
          UPDATE user_vouchers
          SET status = 'revoked',
              revoked_by_admin_id = :adminUserId,
              revoked_reason = :reason,
              revoked_at = UTC_TIMESTAMP()
          WHERE id = :id
        `,
        {
          id: issuedVoucher.id,
          adminUserId: request.adminAuth.adminUserId,
          reason: payload.reason
        }
      );

      return { success: true };
    }
  );
}
