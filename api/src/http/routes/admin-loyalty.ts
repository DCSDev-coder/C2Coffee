import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import sharp from 'sharp';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole, requireAnyAdminRole } from '../../admin/guard.js';
import { requireAdminActionConfirmation } from '../../admin/action-confirmation.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { saveMediaAsset } from '../../lib/media-assets.js';
import {
  formatTierName,
  getActiveLoyaltyTiers,
  getTierByCode,
  getTierProgress,
  loadLoyaltyTiers
} from '../../services/loyalty-tiers.js';
import { currentEmployeeAllowancePeriod, nextEmployeeAllowancePeriod } from '../../services/employee-token-allowance.js';

const overviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});

const employeeAllowanceReportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  limit: z.coerce.number().int().min(1).max(500).optional().default(250)
});

const subsidyPolicyUpdateSchema = z.object({
  employee_amount: z.coerce.number().int().min(0).max(100000),
  intern_amount: z.coerce.number().int().min(0).max(100000),
  confirmation_password: z.string().trim().min(8).max(200)
});

type SummaryRow = RowDataPacket & {
  total_members: number | string | null;
  tokens_in_circulation: number | string | null;
  tokens_issued: number | string | null;
  tokens_redeemed: number | string | null;
};

type TierRow = RowDataPacket & {
  tier_code: string | null;
  member_count: number | string | null;
  avg_tokens: number | string | null;
};

type TransactionRow = RowDataPacket & {
  ledger_id: number;
  user_id: number;
  display_name: string | null;
  email: string | null;
  phone_e164: string;
  direction: 'credit' | 'debit';
  source_type: string;
  source_id: number;
  amount: number | string;
  balance_after: number | string;
  remarks: string | null;
  created_at: Date | string;
  tier_code: string | null;
  cups_last_180d: number | string | null;
  lifetime_earned: number | string | null;
  lifetime_redeemed: number | string | null;
  topup_ref: string | null;
  order_ref: string | null;
};

type RewardRow = RowDataPacket & {
  reward_code: string;
  reward_name: string;
  redemption_count: number | string | null;
};

type DailyRow = RowDataPacket & {
  day: Date | string;
  issued: number | string | null;
  redeemed: number | string | null;
};

type WalletMemberRow = RowDataPacket & {
  user_id: number;
  display_name: string | null;
  email: string | null;
  phone_e164: string;
  token_balance: number | string | null;
  tier_code: string | null;
  cups_last_180d: number | string | null;
  lifetime_earned: number | string | null;
  lifetime_redeemed: number | string | null;
};

function formatDateLabel(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kuala_Lumpur',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function formatTimeLabel(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function sourceLabel(sourceType: string, remarks: string | null, orderRef: string | null, topupRef: string | null): string {
  if (remarks && remarks.trim()) {
    return remarks.trim();
  }

  switch (sourceType) {
    case 'order_spend':
      return orderRef ? `Token checkout for order ${orderRef}` : 'Token checkout';
    case 'topup_paid':
      return topupRef ? `Token top up ${topupRef}` : 'Token top up';
    case 'refund_return':
      return 'Refund return';
    case 'expiry':
      return 'Token expiry';
    case 'admin_adjustment':
      return 'Manual adjustment';
    case 'promo_credit':
      return 'Promotion credit';
    case 'voucher_subsidy':
      return 'Voucher subsidy';
    default:
      return 'Token activity';
  }
}

function sourceDisplayLabel(sourceType: string): string {
  switch (sourceType) {
    case 'order_spend':
      return 'Purchases';
    case 'topup_paid':
      return 'Top ups';
    case 'refund_return':
      return 'Refunds';
    case 'expiry':
      return 'Expiry';
    case 'admin_adjustment':
      return 'Manual adjustments';
    case 'promo_credit':
      return 'Promotions';
    case 'voucher_subsidy':
      return 'Voucher subsidies';
    default:
      return 'Other';
  }
}

const tierRewardConfigSchema = z.union([
  z.object({
    voucherTemplateIds: z.array(z.coerce.number().int().positive()).max(20).optional().default([]),
    birthdayVoucherTemplateIds: z.array(z.coerce.number().int().positive()).max(1).optional().default([])
  }),
  // Accept the previous request shape while deployed admin clients update.
  z.object({
    voucherTemplateId: z.coerce.number().int().positive()
  })
]).transform((value) => ({
  voucherTemplateIds: [...new Set(
    'voucherTemplateIds' in value ? value.voucherTemplateIds : [value.voucherTemplateId]
  )],
  birthdayVoucherTemplateIds: 'birthdayVoucherTemplateIds' in value
    ? [...new Set(value.birthdayVoucherTemplateIds)]
    : []
})).refine(
  (value) => value.voucherTemplateIds.length > 0 || value.birthdayVoucherTemplateIds.length > 0,
  { message: 'Configure at least one tier achievement or birthday-month reward.' }
);

const loyaltyTierUpsertSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  minCups: z.coerce.number().int().min(0),
  imageUrl: z.string().trim().max(512).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.coerce.boolean().optional().default(true),
  rewardConfig: tierRewardConfigSchema.nullable().optional().default(null)
});

const tierImageUploadSchema = z.object({
  data_url: z.string().trim().min(1),
  file_name: z.string().trim().min(1).max(255)
});

const loyaltyTierPatchSchema = loyaltyTierUpsertSchema.partial().extend({
  code: z.string().trim().min(1).max(50).optional()
});

const tokenAdjustmentSchema = z.object({
  action: z.enum(['credit', 'debit']),
  amount: z.coerce.number().int().min(1).max(500),
  reason: z.string().trim().min(3).max(500),
  confirmation_password: z.string().trim().min(8).max(200)
});

async function validateTierRewardVoucher(
  connection: typeof mysqlPool | PoolConnection,
  tenantId: number,
  rewardConfig: { voucherTemplateIds: number[]; birthdayVoucherTemplateIds: number[] } | null | undefined
): Promise<void> {
  const voucherTemplateIds = [
    ...(rewardConfig?.voucherTemplateIds ?? []),
    ...(rewardConfig?.birthdayVoucherTemplateIds ?? [])
  ];
  if (voucherTemplateIds.length === 0) return;

  const bindings: Record<string, number> = { tenantId };
  const placeholders = voucherTemplateIds.map((voucherTemplateId, index) => {
    const key = `voucherTemplateId${index}`;
    bindings[key] = voucherTemplateId;
    return `:${key}`;
  });

  const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(
    `
      SELECT id
      FROM voucher_templates
      WHERE tenant_id = :tenantId
        AND is_active = 1
        AND id IN (${placeholders.join(', ')})
    `,
    bindings
  );

  if (rows.length !== voucherTemplateIds.length) {
    throw new ApiError(400, 'tier_reward_voucher_unavailable', 'Every tier unlock voucher must be active and belong to this tenant.');
  }
}

export async function registerAdminLoyaltyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/loyalty/subsidy-policies', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const current = currentEmployeeAllowancePeriod();
    const next = nextEmployeeAllowancePeriod();
    const [rows] = await mysqlPool.query<Array<RowDataPacket & {
      subsidy_role: 'employee' | 'intern';
      monthly_amount: number;
      effective_period_start: string | Date;
      created_at: Date;
    }>>(
      `SELECT subsidy_role, monthly_amount, effective_period_start, created_at
         FROM tenant_subsidy_policies
        WHERE tenant_id = :tenantId
          AND effective_period_start <= :nextPeriodStart
        ORDER BY subsidy_role, effective_period_start DESC, id DESC`,
      { tenantId: request.adminAuth.tenantId, nextPeriodStart: next.start }
    );
    const policyDate = (value: string | Date) => value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
    const latestFor = (role: 'employee' | 'intern', periodStart: string) => rows.find(
      (row) => row.subsidy_role === role && policyDate(row.effective_period_start) <= periodStart
    );
    const pendingFor = (role: 'employee' | 'intern') => rows.find(
      (row) => row.subsidy_role === role && policyDate(row.effective_period_start) === next.start
    );
    return {
      current_period: current,
      next_period: next,
      current: {
        employee_amount: Number(latestFor('employee', current.start)?.monthly_amount ?? 200),
        intern_amount: Number(latestFor('intern', current.start)?.monthly_amount ?? 100)
      },
      pending: {
        employee_amount: pendingFor('employee') ? Number(pendingFor('employee')?.monthly_amount) : null,
        intern_amount: pendingFor('intern') ? Number(pendingFor('intern')?.monthly_amount) : null
      }
    };
  });

  app.put('/v1/admin/loyalty/subsidy-policies', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = subsidyPolicyUpdateSchema.parse(request.body ?? {});
    const next = nextEmployeeAllowancePeriod();
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      const [beforeRows] = await connection.query<RowDataPacket[]>(
        `SELECT subsidy_role, monthly_amount
           FROM tenant_subsidy_policies
          WHERE tenant_id = :tenantId AND effective_period_start = :periodStart
          FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, periodStart: next.start }
      );
      for (const [role, amount] of [['employee', payload.employee_amount], ['intern', payload.intern_amount] as const]) {
        await connection.execute(
          `INSERT INTO tenant_subsidy_policies
             (tenant_id, subsidy_role, monthly_amount, effective_period_start, created_by_admin_user_id)
           VALUES (:tenantId, :subsidyRole, :monthlyAmount, :periodStart, :adminUserId)
           ON DUPLICATE KEY UPDATE monthly_amount = VALUES(monthly_amount), created_by_admin_user_id = VALUES(created_by_admin_user_id)`,
          {
            tenantId: request.adminAuth.tenantId,
            subsidyRole: role,
            monthlyAmount: amount,
            periodStart: next.start,
            adminUserId: request.adminAuth.adminUserId
          }
        );
      }
      await connection.execute(
        `INSERT INTO admin_audit_logs (
           admin_user_id, effective_roles_json, action_code, target_type, target_id,
           before_json, after_json, reason_code, ip_address, user_agent, created_at
         ) VALUES (
           :adminUserId, :roles, 'subsidy_policy_scheduled', 'tenant_subsidy_policy', :tenantId,
           :beforeJson, :afterJson, 'next_period_subsidy_values', :ipAddress, :userAgent, UTC_TIMESTAMP()
         )`,
        {
          adminUserId: request.adminAuth.adminUserId,
          roles: JSON.stringify(request.adminAuth.roles),
          tenantId: request.adminAuth.tenantId,
          beforeJson: JSON.stringify(beforeRows),
          afterJson: JSON.stringify({ effective_period_start: next.start, employee_amount: payload.employee_amount, intern_amount: payload.intern_amount }),
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] || null
        }
      );
      await connection.commit();
      return {
        effective_period_start: next.start,
        employee_amount: payload.employee_amount,
        intern_amount: payload.intern_amount
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/loyalty/tiers/uploads', {
    preHandler: [authenticateAdminRequest],
    bodyLimit: 12 * 1024 * 1024
  }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = tierImageUploadSchema.parse(request.body);
    const base64Payload = payload.data_url.includes('base64,')
      ? payload.data_url.split('base64,').pop() || ''
      : payload.data_url;
    const content = Buffer.from(base64Payload, 'base64');
    if (content.length === 0 || content.length > 8 * 1024 * 1024) {
      throw new ApiError(400, 'invalid_tier_image_upload', 'Tier images must be between 1 byte and 8 MB.');
    }

    let optimizedContent: Buffer;
    try {
      optimizedContent = await sharp(content, { limitInputPixels: 32_000_000 })
        .rotate()
        .resize({ width: 1086, height: 1448, fit: 'cover', position: 'attention' })
        .webp({ quality: 84, effort: 4 })
        .toBuffer();
    } catch {
      throw new ApiError(400, 'invalid_tier_image_upload', 'Upload a valid PNG, JPEG, or WebP tier image.');
    }

    const uploadName = `${Date.now()}-${randomUUID()}.webp`;
    const assetPath = `/assets/tiers/uploads/${uploadName}`;
    await saveMediaAsset({
      assetPath,
      fileName: uploadName,
      mimeType: 'image/webp',
      content: optimizedContent
    });
    return { image_url: assetPath };
  });

  app.get('/v1/admin/loyalty/overview', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const { limit } = overviewQuerySchema.parse(request.query);
    const connection = await mysqlPool.getConnection();

    try {
      const tiers = await loadLoyaltyTiers(connection);

      const activeTiers = getActiveLoyaltyTiers(tiers);
      const defaultBaseTierCode = activeTiers[0]?.code ?? 'sipper';

      const [summaryRows] = await connection.query<SummaryRow[]>(
        `
          SELECT
            COALESCE((
              SELECT COUNT(*)
              FROM users u
              JOIN customer_tenant_memberships ctm
                ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
              WHERE u.deleted_at IS NULL
            ), 0) AS total_members,
            COALESCE((
              SELECT SUM(ta.balance_available)
              FROM token_accounts ta
              JOIN users u ON u.id = ta.user_id
              JOIN customer_tenant_memberships ctm
                ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
              WHERE u.deleted_at IS NULL
            ), 0) AS tokens_in_circulation,
            COALESCE((
              SELECT SUM(CASE WHEN tl.direction = 'credit' THEN tl.amount ELSE 0 END)
              FROM token_ledger tl
              JOIN users u ON u.id = tl.user_id
              JOIN customer_tenant_memberships ctm
                ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
              WHERE u.deleted_at IS NULL
                AND tl.source_type NOT IN ('employee_allowance_role_revoke', 'employee_allowance_role_restore')
            ), 0) AS tokens_issued,
            COALESCE((
              SELECT SUM(CASE WHEN tl.direction = 'debit' THEN tl.amount ELSE 0 END)
              FROM token_ledger tl
              JOIN users u ON u.id = tl.user_id
              JOIN customer_tenant_memberships ctm
                ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
              WHERE u.deleted_at IS NULL
                AND tl.source_type NOT IN ('employee_allowance_role_revoke', 'employee_allowance_role_restore')
            ), 0) AS tokens_redeemed
        `,
        { tenantId: request.adminAuth.tenantId }
      );

      const [tierRows] = await connection.query<TierRow[]>(
        `
          SELECT
            lt.code AS tier_code,
            COUNT(user_tiers.user_id) AS member_count,
            AVG(user_tiers.token_balance) AS avg_tokens
          FROM loyalty_tiers lt
          LEFT JOIN (
            SELECT
              u.id AS user_id,
              COALESCE((
                SELECT lts.tier_code
                FROM loyalty_tier_snapshots lts
                WHERE lts.user_id = u.id
                ORDER BY lts.effective_at DESC, lts.id DESC
                LIMIT 1
              ), :defaultBaseTierCode) AS tier_code,
              COALESCE(ta.balance_available, 0) AS token_balance
            FROM users u
            JOIN customer_tenant_memberships ctm
              ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
            LEFT JOIN token_accounts ta ON ta.user_id = u.id
            WHERE u.deleted_at IS NULL
          ) user_tiers ON user_tiers.tier_code = lt.code
          WHERE lt.is_active = 1
          GROUP BY lt.id, lt.code, lt.name, lt.min_cups, lt.sort_order
          ORDER BY lt.min_cups ASC, lt.sort_order ASC, lt.id ASC
        `,
        { tenantId: request.adminAuth.tenantId, defaultBaseTierCode }
      );

      const [dailyRows] = await connection.query<DailyRow[]>(
        `
          SELECT
            DATE(tl.created_at) AS day,
            SUM(CASE WHEN tl.direction = 'credit' THEN tl.amount ELSE 0 END) AS issued,
            SUM(CASE WHEN tl.direction = 'debit' THEN tl.amount ELSE 0 END) AS redeemed
          FROM token_ledger tl
          JOIN users u ON u.id = tl.user_id
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
          WHERE u.deleted_at IS NULL
            AND tl.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
            AND tl.source_type NOT IN ('employee_allowance_role_revoke', 'employee_allowance_role_restore')
          GROUP BY DATE(tl.created_at)
          ORDER BY day ASC
        `,
        { tenantId: request.adminAuth.tenantId }
      );

      const [sourceRows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
            tl.source_type,
            SUM(tl.amount) AS total_amount,
            COUNT(*) AS txn_count
          FROM token_ledger tl
          JOIN users u ON u.id = tl.user_id
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
          WHERE u.deleted_at IS NULL
            AND tl.direction = 'credit'
            AND tl.source_type NOT IN ('employee_allowance_role_revoke', 'employee_allowance_role_restore')
          GROUP BY tl.source_type
          ORDER BY total_amount DESC, txn_count DESC
        `,
        { tenantId: request.adminAuth.tenantId }
      );

      const [rewardRows] = await connection.query<RewardRow[]>(
        `
          SELECT
            vt.code AS reward_code,
            vt.name AS reward_name,
            COUNT(vr.id) AS redemption_count
          FROM voucher_redemptions vr
          JOIN user_vouchers uv ON uv.id = vr.user_voucher_id
          JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
          JOIN users u ON u.id = uv.user_id
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
          WHERE u.deleted_at IS NULL
          GROUP BY vt.id, vt.code, vt.name
          ORDER BY redemption_count DESC, vt.name ASC
          LIMIT 5
        `,
        { tenantId: request.adminAuth.tenantId }
      );

      const [activityRows] = await connection.query<TransactionRow[]>(
        `
          SELECT
            tl.id AS ledger_id,
            tl.user_id,
            up.display_name,
            up.email,
            u.phone_e164,
            tl.direction,
            tl.source_type,
            tl.source_id,
            tl.amount,
            tl.balance_after,
            tl.remarks,
            tl.created_at,
            (
              SELECT lts.tier_code
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ) AS tier_code,
            COALESCE((
              SELECT lts.qualifying_cups_last_180d
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ), 0) AS cups_last_180d,
            COALESCE(ledger_stats.lifetime_earned, 0) AS lifetime_earned,
            COALESCE(ledger_stats.lifetime_redeemed, 0) AS lifetime_redeemed,
            tt.topup_ref,
            o.order_ref
          FROM token_ledger tl
          JOIN users u ON u.id = tl.user_id
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
          LEFT JOIN user_profiles up ON up.user_id = u.id
          LEFT JOIN (
            SELECT
              user_id,
              SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS lifetime_earned,
              SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) AS lifetime_redeemed
            FROM token_ledger
            WHERE source_type NOT IN ('employee_allowance_role_revoke', 'employee_allowance_role_restore')
            GROUP BY user_id
          ) ledger_stats ON ledger_stats.user_id = u.id
          LEFT JOIN token_topups tt
            ON tt.id = tl.source_id AND tl.source_type = 'topup_paid'
          LEFT JOIN orders o
            ON o.id = tl.source_id AND tl.source_type = 'order_spend'
          WHERE u.deleted_at IS NULL
          ORDER BY tl.created_at DESC, tl.id DESC
          LIMIT :limit
        `,
        { limit, tenantId: request.adminAuth.tenantId }
      );

      const [walletMemberRows] = await connection.query<WalletMemberRow[]>(
        `
          SELECT
            u.id AS user_id,
            up.display_name,
            up.email,
            u.phone_e164,
            ta.balance_available AS token_balance,
            (
              SELECT lts.tier_code
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ) AS tier_code,
            COALESCE((
              SELECT lts.qualifying_cups_last_180d
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ), 0) AS cups_last_180d,
            COALESCE(ledger_stats.lifetime_earned, 0) AS lifetime_earned,
            COALESCE(ledger_stats.lifetime_redeemed, 0) AS lifetime_redeemed
          FROM users u
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
          JOIN token_accounts ta ON ta.user_id = u.id
          LEFT JOIN user_profiles up ON up.user_id = u.id
          LEFT JOIN (
            SELECT
              user_id,
              SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS lifetime_earned,
              SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) AS lifetime_redeemed
            FROM token_ledger
            WHERE source_type NOT IN ('employee_allowance_role_revoke', 'employee_allowance_role_restore')
            GROUP BY user_id
          ) ledger_stats ON ledger_stats.user_id = u.id
          WHERE u.deleted_at IS NULL
          ORDER BY COALESCE(up.display_name, up.email, u.phone_e164) ASC, u.id ASC
        `,
        { tenantId: request.adminAuth.tenantId }
      );

      const [employeePurchaseRows] = await connection.query<RowDataPacket[]>(
        `SELECT
           o.id, o.order_ref, o.status, o.created_at,
           o.token_amount_charged,
           o.employee_allowance_tokens_used,
           GREATEST(o.token_amount_charged - o.employee_allowance_tokens_used, 0) AS personal_tokens_used,
           up.display_name, up.email, u.phone_e164,
           s.name AS outlet_name,
           GROUP_CONCAT(CONCAT(oi.quantity, 'x ', oi.item_name_snapshot) ORDER BY oi.id SEPARATOR ', ') AS items
         FROM orders o
         JOIN stores s ON s.id = o.store_id AND s.tenant_id = :tenantId
         JOIN users u ON u.id = o.user_id
         JOIN customer_tenant_memberships ctm
           ON ctm.user_id = u.id AND ctm.tenant_id = s.tenant_id AND ctm.is_employee = 1
         LEFT JOIN user_profiles up ON up.user_id = u.id
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.employee_allowance_tokens_used > 0
         GROUP BY o.id, o.order_ref, o.status, o.created_at, o.token_amount_charged,
                  o.employee_allowance_tokens_used, up.display_name, up.email, u.phone_e164, s.name
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT :limit`,
        { tenantId: request.adminAuth.tenantId, limit }
      );

      const [employeeAllowanceRows] = await connection.query<RowDataPacket[]>(
        `SELECT
           eta.user_id, eta.period_start, eta.period_end, eta.granted_amount,
           eta.remaining_amount, eta.status,
           up.display_name, up.email, u.phone_e164
         FROM employee_token_allowances eta
         JOIN users u ON u.id = eta.user_id
         LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE eta.tenant_id = :tenantId
         ORDER BY eta.period_start DESC, COALESCE(up.display_name, up.email, u.phone_e164) ASC
         LIMIT :limit`,
        { tenantId: request.adminAuth.tenantId, limit }
      );

      const summaryRow = summaryRows[0] ?? {
        total_members: 0,
        tokens_in_circulation: 0,
        tokens_issued: 0,
        tokens_redeemed: 0
      };

      const totalMembers = Number(summaryRow.total_members ?? 0);
      const tokensIssued = Number(summaryRow.tokens_issued ?? 0);
      const tokensRedeemed = Number(summaryRow.tokens_redeemed ?? 0);
      const redemptionRate = tokensIssued > 0 ? Number(((tokensRedeemed / tokensIssued) * 100).toFixed(1)) : 0;
      const totalRewardRedemptions = rewardRows.reduce((acc, row) => acc + Number(row.redemption_count ?? 0), 0);
      const tierTotals = tierRows.reduce((acc, row) => acc + Number(row.member_count ?? 0), 0) || totalMembers || 1;
      const tierMap = new Map(tiers.map((tier) => [tier.code, tier]));

      const tierBreakdown = tierRows.map((row) => {
        const rawTierCode = row.tier_code ? String(row.tier_code).trim().toLowerCase() : defaultBaseTierCode;
        const tier = tierMap.get(rawTierCode);
        const tierCode = tier?.code ?? defaultBaseTierCode;
        const memberCount = Number(row.member_count ?? 0);
        const avgTokens = Number(row.avg_tokens ?? 0);

        return {
          tierCode,
          tierName: tier?.name ?? formatTierName(tiers, tierCode),
          members: memberCount,
          percentage: Number(((memberCount / tierTotals) * 100).toFixed(1)),
          avgTokens: Number(avgTokens.toFixed(2)),
          minCups: tier?.minCups ?? 0,
          isActive: tier?.isActive ?? false
        };
      });

      const issuedVsRedeemed = dailyRows.map((row) => ({
        day: formatDateLabel(row.day),
        issued: Number(row.issued ?? 0),
        redeemed: Number(row.redeemed ?? 0)
      }));

      const sourceBreakdown = sourceRows.map((row, index) => {
        const totalAmount = Number(row.total_amount ?? 0);
        const colorPalette = ['#1F3A34', '#2E5E58', '#6F9F96', '#8AACA5', '#E07A5F', '#D4AF7A'];
        return {
          name: sourceDisplayLabel(String(row.source_type ?? 'other')),
          value: totalAmount,
          count: Number(row.txn_count ?? 0),
          percentage: tokensIssued > 0 ? Number(((totalAmount / tokensIssued) * 100).toFixed(1)) : 0,
          color: colorPalette[index % colorPalette.length]
        };
      });

      const topRedeemedRewards = rewardRows.map((row, index) => ({
        rank: index + 1,
        reward: row.reward_name,
        code: row.reward_code,
        redemptions: Number(row.redemption_count ?? 0),
        pct: totalRewardRedemptions > 0 ? Number(((Number(row.redemption_count ?? 0) / totalRewardRedemptions) * 100).toFixed(1)) : 0
      }));

      const recentActivity = activityRows.slice(0, 10).map((row) => ({
        id: `TL-${row.ledger_id}`,
        userId: row.user_id,
        user: row.display_name || row.email || row.phone_e164,
        action: row.direction === 'credit'
          ? `earned ${Number(row.amount ?? 0).toLocaleString('en-US')} tokens`
          : `redeemed ${Number(row.amount ?? 0).toLocaleString('en-US')} tokens`,
        desc: sourceLabel(String(row.source_type ?? 'other'), row.remarks, row.order_ref ?? null, row.topup_ref ?? null),
        time: formatDateLabel(row.created_at) + ' ' + formatTimeLabel(row.created_at),
        amount: Number(row.amount ?? 0),
        type: row.direction === 'credit' ? 'Earned' : 'Redeemed'
      }));

      const transactions = activityRows.map((row) => {
        const balance = Number(row.balance_after ?? 0);
        const amount = Number(row.amount ?? 0);
        const direction = row.direction === 'credit' ? 'Earned' : 'Redeemed';
        const tokenAmount = `${row.direction === 'credit' ? '+' : '-'}${amount.toLocaleString('en-US')}`;
        const cups = Number(row.cups_last_180d ?? 0);
        const tierProgress = getTierProgress(cups, tiers);
        const rawTierCode = row.tier_code ? String(row.tier_code).trim().toLowerCase() : null;
        const tierConfig = rawTierCode ? getTierByCode(tiers, rawTierCode) : null;
        const tierCode = tierConfig ? tierConfig.code : tierProgress.tierCode;
        const tierName = tierConfig ? tierConfig.name : tierProgress.tierName;

        return {
          id: `TL-${row.ledger_id}`,
          date: formatDateLabel(row.created_at),
          time: formatTimeLabel(row.created_at),
          member: {
            name: row.display_name || row.email || row.phone_e164,
            email: row.email || '',
            phone: row.phone_e164,
            memberId: `C2-${String(row.user_id).padStart(3, '0')}`,
            tier: tierName,
            tierCode,
            tokensBalance: Number(row.balance_after ?? 0).toLocaleString('en-US'),
            lifetimeEarned: Number(row.lifetime_earned ?? 0).toLocaleString('en-US'),
            lifetimeRedeemed: Number(row.lifetime_redeemed ?? 0).toLocaleString('en-US'),
            tierProgress,
            tokenHistory: recentActivity.filter((activity) => activity.userId === row.user_id).slice(0, 3)
          },
          description: sourceLabel(String(row.source_type ?? 'other'), row.remarks, row.order_ref ?? null, row.topup_ref ?? null),
          type: direction,
          tokens: tokenAmount,
          balance: balance.toLocaleString('en-US'),
          sourceType: row.source_type
        };
      });

      const members = walletMemberRows.map((row) => {
        const cups = Number(row.cups_last_180d ?? 0);
        const tierProgress = getTierProgress(cups, tiers);
        const rawTierCode = row.tier_code ? String(row.tier_code).trim().toLowerCase() : null;
        const tierConfig = rawTierCode ? getTierByCode(tiers, rawTierCode) : null;
        const tierCode = tierConfig ? tierConfig.code : tierProgress.tierCode;
        const tierName = tierConfig ? tierConfig.name : tierProgress.tierName;

        return {
          id: row.user_id,
          name: row.display_name || row.email || row.phone_e164,
          email: row.email || '',
          phone: row.phone_e164,
          memberId: `C2-${String(row.user_id).padStart(3, '0')}`,
          tier: tierName,
          tierCode,
          tokensBalance: Number(row.token_balance ?? 0).toLocaleString('en-US'),
          lifetimeEarned: Number(row.lifetime_earned ?? 0).toLocaleString('en-US'),
          lifetimeRedeemed: Number(row.lifetime_redeemed ?? 0).toLocaleString('en-US'),
          tierProgress
        };
      });

      return {
        summary: {
          totalMembers,
          tokensInCirculation: Number(summaryRow.tokens_in_circulation ?? 0),
          tokensIssued,
          tokensRedeemed,
          redemptionRate,
          totalRewardRedemptions
        },
        tiers,
        tierBreakdown,
        issuedVsRedeemed,
        sourceBreakdown,
        topRedeemedRewards,
        recentActivity,
        transactions,
        members,
        employeeAllowances: employeeAllowanceRows.map((row) => ({
          userId: Number(row.user_id),
          employee: row.display_name || row.email || row.phone_e164,
          email: row.email || '',
          phone: row.phone_e164,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          granted: Number(row.granted_amount ?? 0),
          remaining: Number(row.remaining_amount ?? 0),
          status: row.status
        })),
        employeePurchases: employeePurchaseRows.map((row) => ({
          id: Number(row.id),
          orderRef: row.order_ref,
          employee: row.display_name || row.email || row.phone_e164,
          email: row.email || '',
          outlet: row.outlet_name,
          items: row.items || '',
          totalTokens: Number(row.token_amount_charged ?? 0),
          allowanceTokens: Number(row.employee_allowance_tokens_used ?? 0),
          personalTokens: Number(row.personal_tokens_used ?? 0),
          status: row.status,
          tierCupEarned: false,
          createdAt: row.created_at
        })),
        lastUpdatedAt: new Date().toISOString()
      };
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/loyalty/employee-allowances', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAnyAdminRole(request, ['super_admin']);
    const { month, limit } = employeeAllowanceReportQuerySchema.parse(request.query);
    const periodStart = `${month}-01`;
    const [year, monthNumber] = month.split('-').map(Number);
    const toSqlUtc = (value: Date) => value.toISOString().slice(0, 19).replace('T', ' ');
    const periodStartUtc = toSqlUtc(new Date(Date.UTC(year, monthNumber - 1, 1) - 8 * 60 * 60 * 1000));
    const periodEndExclusiveUtc = toSqlUtc(new Date(Date.UTC(year, monthNumber, 1) - 8 * 60 * 60 * 1000));
    const connection = await mysqlPool.getConnection();
    try {
      const [allowanceRows] = await connection.query<RowDataPacket[]>(
        `SELECT employee_set.user_id, ctm.subsidy_role, eta.period_start, eta.period_end,
                eta.carried_forward_amount, eta.granted_amount,
                eta.refunded_amount, eta.remaining_amount, eta.status,
                up.display_name, up.email, u.phone_e164
           FROM (
             SELECT ctm.user_id
               FROM customer_tenant_memberships ctm
              WHERE ctm.tenant_id = :tenantId AND ctm.subsidy_role <> 'none'
             UNION
             SELECT history.user_id
               FROM employee_token_allowances history
              WHERE history.tenant_id = :tenantId AND history.period_start = :periodStart
           ) employee_set
           JOIN users u ON u.id = employee_set.user_id
           LEFT JOIN employee_token_allowances eta
             ON eta.tenant_id = :tenantId AND eta.user_id = employee_set.user_id
            AND eta.period_start = :periodStart
           JOIN customer_tenant_memberships ctm
             ON ctm.tenant_id = :tenantId AND ctm.user_id = employee_set.user_id
           LEFT JOIN user_profiles up ON up.user_id = u.id
          ORDER BY COALESCE(up.display_name, up.email, u.phone_e164) ASC
          LIMIT :limit`,
        { tenantId: request.adminAuth.tenantId, periodStart, limit }
      );
      const [purchaseRows] = await connection.query<RowDataPacket[]>(
        `SELECT o.id, o.order_ref, o.status, o.created_at, o.token_amount_charged,
                o.employee_allowance_tokens_used, o.employee_allowance_tokens_refunded,
                GREATEST(o.token_amount_charged - o.employee_allowance_tokens_used, 0) AS personal_tokens_used,
                up.display_name, up.email, u.phone_e164, s.name AS outlet_name,
                GROUP_CONCAT(CONCAT(oi.quantity, 'x ', oi.item_name_snapshot) ORDER BY oi.id SEPARATOR ', ') AS items,
                MAX(CASE WHEN oi.is_qualifying_cup = 1 THEN 1 ELSE 0 END) AS contains_drink
           FROM orders o
           JOIN stores s ON s.id = o.store_id AND s.tenant_id = :tenantId
           JOIN users u ON u.id = o.user_id
           LEFT JOIN user_profiles up ON up.user_id = u.id
           LEFT JOIN order_items oi ON oi.order_id = o.id
          WHERE o.employee_allowance_tokens_used > 0
            AND o.created_at >= :periodStartUtc AND o.created_at < :periodEndExclusiveUtc
          GROUP BY o.id, o.order_ref, o.status, o.created_at, o.token_amount_charged,
                   o.employee_allowance_tokens_used, o.employee_allowance_tokens_refunded,
                   up.display_name, up.email, u.phone_e164, s.name
          ORDER BY o.created_at DESC, o.id DESC
          LIMIT :limit`,
        { tenantId: request.adminAuth.tenantId, periodStartUtc, periodEndExclusiveUtc, limit }
      );
      const allowances = allowanceRows.map((row) => ({
        userId: Number(row.user_id),
        employee: row.display_name || row.email || row.phone_e164,
        email: row.email || '', phone: row.phone_e164,
        role: row.subsidy_role || 'employee',
        issued: Boolean(row.period_start) || row.subsidy_role === 'boss',
        periodStart: row.period_start || periodStart, periodEnd: row.period_end,
        carriedForward: Number(row.carried_forward_amount ?? 0),
        granted: row.subsidy_role === 'boss' ? null : Number(row.granted_amount ?? 0),
        refunded: Number(row.refunded_amount ?? 0),
        remaining: row.subsidy_role === 'boss' ? null : Number(row.remaining_amount ?? 0), status: row.subsidy_role === 'boss' ? 'unlimited' : row.status || 'not_issued'
      }));
      const purchases = purchaseRows.map((row) => ({
        id: Number(row.id), orderRef: row.order_ref,
        employee: row.display_name || row.email || row.phone_e164,
        email: row.email || '', outlet: row.outlet_name, items: row.items || '',
        totalTokens: Number(row.token_amount_charged ?? 0),
        allowanceTokens: Number(row.employee_allowance_tokens_used ?? 0),
        refundedAllowanceTokens: Number(row.employee_allowance_tokens_refunded ?? 0),
        personalTokens: Number(row.personal_tokens_used ?? 0),
        containsDrink: Number(row.contains_drink) === 1,
        status: row.status, tierCupEarned: false, createdAt: row.created_at
      }));
      return {
        month,
        summary: {
          employeesEligible: allowances.length,
          employeesIssued: allowances.filter((row) => row.issued).length,
          carriedForward: allowances.reduce((sum, row) => sum + row.carriedForward, 0),
          companyTopUp: allowances.reduce((sum, row) => sum + Number(row.granted ?? 0), 0),
          grossUsed: purchases.reduce((sum, row) => sum + row.allowanceTokens, 0),
          refunded: allowances.reduce((sum, row) => sum + row.refunded, 0),
          endingBalance: allowances.reduce((sum, row) => sum + Number(row.remaining ?? 0), 0),
          employeeOrders: purchases.length
        },
        allowances,
        purchases
      };
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/loyalty/tiers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'support_admin', 'marketing_admin', 'operations_admin']);
    const connection = await mysqlPool.getConnection();

    try {
      const tiers = await loadLoyaltyTiers(connection);
      return { tiers };
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/loyalty/customers/:customerId/adjustment', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');

    const params = z.object({ customerId: z.coerce.number().int().positive() }).parse(request.params);
    const payload = tokenAdjustmentSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    let committed = false;

    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(
        connection,
        request.adminAuth.adminUserId,
        payload.confirmation_password
      );

      const [customerRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
        `
          SELECT u.id
          FROM users u
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id
           AND ctm.tenant_id = :tenantId
          WHERE u.id = :customerId
            AND u.deleted_at IS NULL
          LIMIT 1
          FOR UPDATE
        `,
        { customerId: params.customerId, tenantId: request.adminAuth.tenantId }
      );

      if (!customerRows[0]) {
        throw new ApiError(404, 'customer_not_found', 'This customer account is no longer available.');
      }

      const [accountRows] = await connection.query<Array<RowDataPacket & {
        balance_available: number;
        balance_reserved: number;
        balance_cap: number;
      }>>(
        `
          SELECT balance_available, balance_reserved, balance_cap
          FROM token_accounts
          WHERE user_id = :customerId
          LIMIT 1
          FOR UPDATE
        `,
        { customerId: params.customerId }
      );

      const account = accountRows[0];
      if (!account) {
        throw new ApiError(400, 'token_account_missing', 'This customer does not have a token wallet.');
      }

      const previousBalance = Number(account.balance_available);
      const balanceCap = Number(account.balance_cap);
      const nextBalance = payload.action === 'credit'
        ? previousBalance + payload.amount
        : previousBalance - payload.amount;

      if (nextBalance < 0) {
        throw new ApiError(400, 'token_adjustment_exceeds_balance', 'You cannot deduct more tokens than the customer has available.');
      }

      if (payload.action === 'debit') {
        const allowancePeriod = currentEmployeeAllowancePeriod();
        const [allowanceRows] = await connection.query<Array<RowDataPacket & { remaining_amount: number }>>(
          `
            SELECT COALESCE(SUM(remaining_amount), 0) AS remaining_amount
            FROM employee_token_allowances
            WHERE user_id = :customerId
              AND period_start = :periodStart
              AND status = 'active'
          `,
          { customerId: params.customerId, periodStart: allowancePeriod.start }
        );
        const protectedAllowance = Number(allowanceRows[0]?.remaining_amount ?? 0);
        if (nextBalance < protectedAllowance) {
          throw new ApiError(
            400,
            'token_adjustment_exceeds_personal_balance',
            `Cannot deduct company Monthly Subsidy tokens via manual wallet adjustment. At most ${Math.max(0, previousBalance - protectedAllowance)} personal C2 Credit token(s) can be deducted.`
          );
        }
      }

      if (nextBalance > balanceCap) {
        throw new ApiError(
          400,
          'token_adjustment_exceeds_cap',
          `This adjustment exceeds the customer's ${balanceCap}-token wallet cap.`
        );
      }

      await connection.execute(
        `
          UPDATE token_accounts
          SET balance_available = :nextBalance,
              updated_at = UTC_TIMESTAMP()
          WHERE user_id = :customerId
        `,
        { nextBalance, customerId: params.customerId }
      );

      await connection.execute(
        `
          INSERT INTO token_ledger (
            user_id,
            token_lot_id,
            direction,
            source_type,
            source_id,
            amount,
            balance_after,
            remarks,
            created_by_admin_id,
            created_at
          )
          VALUES (
            :customerId,
            NULL,
            :direction,
            'admin_adjustment',
            :adminUserId,
            :amount,
            :nextBalance,
            :reason,
            :adminUserId,
            UTC_TIMESTAMP()
          )
        `,
        {
          customerId: params.customerId,
          direction: payload.action === 'credit' ? 'credit' : 'debit',
          adminUserId: request.adminAuth.adminUserId,
          amount: payload.amount,
          nextBalance,
          reason: payload.reason
        }
      );

      await connection.execute(
        `
          INSERT INTO admin_audit_logs (
            admin_user_id,
            effective_roles_json,
            action_code,
            target_type,
            target_id,
            before_json,
            after_json,
            reason_code,
            reason_note,
            ip_address,
            user_agent,
            created_at
          )
          VALUES (
            :adminUserId,
            :roles,
            :actionCode,
            'customer_token_wallet',
            :customerId,
            :beforeJson,
            :afterJson,
            'admin_token_adjustment',
            :reason,
            :ipAddress,
            :userAgent,
            UTC_TIMESTAMP()
          )
        `,
        {
          adminUserId: request.adminAuth.adminUserId,
          roles: JSON.stringify(request.adminAuth.roles),
          actionCode: payload.action === 'credit' ? 'token_credit' : 'token_debit',
          customerId: params.customerId,
          beforeJson: JSON.stringify({ balance_available: previousBalance }),
          afterJson: JSON.stringify({ balance_available: nextBalance, amount: payload.amount }),
          reason: payload.reason,
          ipAddress: request.ip,
          userAgent: String(request.headers['user-agent'] ?? '').slice(0, 512) || null
        }
      );

      await connection.commit();
      committed = true;

      return {
        success: true,
        action: payload.action,
        amount: payload.amount,
        token_balance: nextBalance,
        token_reserved: Number(account.balance_reserved),
        token_cap: balanceCap
      };
    } finally {
      if (!committed) {
        await connection.rollback();
      }
      connection.release();
    }
  });

  app.post('/v1/admin/loyalty/tiers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = loyaltyTierUpsertSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();

    try {
      const normalizedCode = payload.code.trim().toLowerCase();
      await validateTierRewardVoucher(connection, request.adminAuth.tenantId, payload.rewardConfig);
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO loyalty_tiers (
            code,
            name,
            min_cups,
            image_url,
            sort_order,
            is_active,
            reward_config_json
          )
          VALUES (
            :code,
            :name,
            :minCups,
            :imageUrl,
            :sortOrder,
            :isActive,
            :rewardConfig
          )
        `,
        {
          ...payload,
          code: normalizedCode,
          imageUrl: payload.imageUrl || null,
          rewardConfig: payload.rewardConfig ? JSON.stringify(payload.rewardConfig) : null
        }
      );

      const tiers = await loadLoyaltyTiers(connection);
      const tier = tiers.find((entry) => entry.id === insertResult.insertId) ?? null;

      return { id: insertResult.insertId, tier };
    } finally {
      connection.release();
    }
  });

  app.patch('/v1/admin/loyalty/tiers/:tierId', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const tierId = z.coerce.number().int().positive().parse((request.params as { tierId: string }).tierId);
    const payload = loyaltyTierPatchSchema.parse(request.body);
      const entries = Object.entries(payload).filter(([, value]) => value !== undefined);

      if (entries.length === 0) {
        return { updated: false };
      }

    const connection = await mysqlPool.getConnection();

    try {
      if (Object.prototype.hasOwnProperty.call(payload, 'rewardConfig')) {
        await validateTierRewardVoucher(connection, request.adminAuth.tenantId, payload.rewardConfig);
      }
      const assignments = entries.map(([key]) => {
        if (key === 'code') {
          return 'code = :code';
        }
        switch (key) {
          case 'minCups':
            return 'min_cups = :minCups';
          case 'imageUrl':
            return 'image_url = :imageUrl';
          case 'sortOrder':
            return 'sort_order = :sortOrder';
          case 'isActive':
            return 'is_active = :isActive';
          case 'rewardConfig':
            return 'reward_config_json = :rewardConfig';
          default:
            return `${key} = :${key}`;
        }
      });

      const values = {
        tierId,
        ...payload,
        code: payload.code?.trim().toLowerCase(),
        rewardConfig: payload.rewardConfig === undefined
          ? undefined
          : payload.rewardConfig ? JSON.stringify(payload.rewardConfig) : null,
      } as any;

      await connection.execute(
        `
          UPDATE loyalty_tiers
          SET ${assignments.join(', ')}
          WHERE id = :tierId
        `,
        values
      );

      const tiers = await loadLoyaltyTiers(connection);
      const tier = tiers.find((entry) => entry.id === tierId) ?? null;

      return { updated: true, tier };
    } finally {
      connection.release();
    }
  });

  app.delete('/v1/admin/loyalty/tiers/:tierId', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const tierId = z.coerce.number().int().positive().parse((request.params as { tierId: string }).tierId);
    const connection = await mysqlPool.getConnection();

    try {
      await connection.execute(
        `
          UPDATE loyalty_tiers
          SET is_active = 0
          WHERE id = :tierId
        `,
        { tierId }
      );

      return { archived: true };
    } finally {
      connection.release();
    }
  });
}
