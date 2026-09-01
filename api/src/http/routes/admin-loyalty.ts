import type { FastifyInstance } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import {
  formatTierName,
  getActiveLoyaltyTiers,
  getTierProgress,
  loadLoyaltyTiers
} from '../../services/loyalty-tiers.js';

const overviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
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

const loyaltyTierUpsertSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  minCups: z.coerce.number().int().min(0),
  badgeColor: z.string().trim().max(32).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.coerce.boolean().optional().default(true)
});

const loyaltyTierPatchSchema = loyaltyTierUpsertSchema.partial().extend({
  code: z.string().trim().min(1).max(50).optional()
});

const tokenAdjustmentSchema = z.object({
  action: z.enum(['credit', 'debit']),
  amount: z.coerce.number().int().min(1).max(500),
  reason: z.string().trim().min(3).max(500)
});

export async function registerAdminLoyaltyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/loyalty/overview', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const { limit } = overviewQuerySchema.parse(request.query);
    const connection = await mysqlPool.getConnection();

    try {
      const tiers = await loadLoyaltyTiers(connection);

      const [summaryRows] = await connection.query<SummaryRow[]>(
        `
          SELECT
            COALESCE((SELECT COUNT(*) FROM users u WHERE u.deleted_at IS NULL), 0) AS total_members,
            COALESCE((
              SELECT SUM(ta.balance_available)
              FROM token_accounts ta
              JOIN users u ON u.id = ta.user_id
              WHERE u.deleted_at IS NULL
            ), 0) AS tokens_in_circulation,
            COALESCE((
              SELECT SUM(CASE WHEN tl.direction = 'credit' THEN tl.amount ELSE 0 END)
              FROM token_ledger tl
              JOIN users u ON u.id = tl.user_id
              WHERE u.deleted_at IS NULL
            ), 0) AS tokens_issued,
            COALESCE((
              SELECT SUM(CASE WHEN tl.direction = 'debit' THEN tl.amount ELSE 0 END)
              FROM token_ledger tl
              JOIN users u ON u.id = tl.user_id
              WHERE u.deleted_at IS NULL
            ), 0) AS tokens_redeemed
        `
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
              ), 'kawan') AS tier_code,
              COALESCE(ta.balance_available, 0) AS token_balance
            FROM users u
            LEFT JOIN token_accounts ta ON ta.user_id = u.id
            WHERE u.deleted_at IS NULL
          ) user_tiers ON user_tiers.tier_code = lt.code
          WHERE lt.is_active = 1
          GROUP BY lt.id, lt.code, lt.name, lt.min_cups, lt.sort_order
          ORDER BY lt.min_cups ASC, lt.sort_order ASC, lt.id ASC
        `
      );

      const [dailyRows] = await connection.query<DailyRow[]>(
        `
          SELECT
            DATE(tl.created_at) AS day,
            SUM(CASE WHEN tl.direction = 'credit' THEN tl.amount ELSE 0 END) AS issued,
            SUM(CASE WHEN tl.direction = 'debit' THEN tl.amount ELSE 0 END) AS redeemed
          FROM token_ledger tl
          JOIN users u ON u.id = tl.user_id
          WHERE u.deleted_at IS NULL
            AND tl.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
          GROUP BY DATE(tl.created_at)
          ORDER BY day ASC
        `
      );

      const [sourceRows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
            tl.source_type,
            SUM(tl.amount) AS total_amount,
            COUNT(*) AS txn_count
          FROM token_ledger tl
          JOIN users u ON u.id = tl.user_id
          WHERE u.deleted_at IS NULL
            AND tl.direction = 'credit'
          GROUP BY tl.source_type
          ORDER BY total_amount DESC, txn_count DESC
        `
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
          WHERE u.deleted_at IS NULL
          GROUP BY vt.id, vt.code, vt.name
          ORDER BY redemption_count DESC, vt.name ASC
          LIMIT 5
        `
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
            COALESCE((
              SELECT lts.tier_code
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ), 'kawan') AS tier_code,
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
          LEFT JOIN user_profiles up ON up.user_id = u.id
          LEFT JOIN (
            SELECT
              user_id,
              SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS lifetime_earned,
              SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) AS lifetime_redeemed
            FROM token_ledger
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
        { limit }
      );

      const [walletMemberRows] = await connection.query<WalletMemberRow[]>(
        `
          SELECT
            u.id AS user_id,
            up.display_name,
            up.email,
            u.phone_e164,
            ta.balance_available AS token_balance,
            COALESCE((
              SELECT lts.tier_code
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ), 'kawan') AS tier_code,
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
          JOIN token_accounts ta ON ta.user_id = u.id
          LEFT JOIN user_profiles up ON up.user_id = u.id
          LEFT JOIN (
            SELECT
              user_id,
              SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS lifetime_earned,
              SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) AS lifetime_redeemed
            FROM token_ledger
            GROUP BY user_id
          ) ledger_stats ON ledger_stats.user_id = u.id
          WHERE u.deleted_at IS NULL
          ORDER BY COALESCE(up.display_name, up.email, u.phone_e164) ASC, u.id ASC
        `
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
        const tierCode = String(row.tier_code ?? 'kawan').trim().toLowerCase();
        const tier = tierMap.get(tierCode);
        const memberCount = Number(row.member_count ?? 0);
        const avgTokens = Number(row.avg_tokens ?? 0);

        return {
          tierCode,
          tierName: tier?.name ?? formatTierName(tiers, tierCode),
          members: memberCount,
          percentage: Number(((memberCount / tierTotals) * 100).toFixed(1)),
          avgTokens: Number(avgTokens.toFixed(2)),
          minCups: tier?.minCups ?? 0,
          badgeColor: tier?.badgeColor ?? null,
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
        const tierCode = String(row.tier_code ?? 'kawan').trim().toLowerCase();
        const tier = tierMap.get(tierCode);
        const cups = Number(row.cups_last_180d ?? 0);
        const tierProgress = getTierProgress(cups, tiers);

        return {
          id: `TL-${row.ledger_id}`,
          date: formatDateLabel(row.created_at),
          time: formatTimeLabel(row.created_at),
          member: {
            name: row.display_name || row.email || row.phone_e164,
            email: row.email || '',
            phone: row.phone_e164,
            memberId: `C2-${String(row.user_id).padStart(3, '0')}`,
            tier: tier?.name ?? formatTierName(tiers, tierCode),
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
        const tierCode = String(row.tier_code ?? 'kawan').trim().toLowerCase();
        const tier = tierMap.get(tierCode);
        const cups = Number(row.cups_last_180d ?? 0);

        return {
          id: row.user_id,
          name: row.display_name || row.email || row.phone_e164,
          email: row.email || '',
          phone: row.phone_e164,
          memberId: `C2-${String(row.user_id).padStart(3, '0')}`,
          tier: tier?.name ?? formatTierName(tiers, tierCode),
          tierCode,
          tokensBalance: Number(row.token_balance ?? 0).toLocaleString('en-US'),
          lifetimeEarned: Number(row.lifetime_earned ?? 0).toLocaleString('en-US'),
          lifetimeRedeemed: Number(row.lifetime_redeemed ?? 0).toLocaleString('en-US'),
          tierProgress: getTierProgress(cups, tiers)
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
        lastUpdatedAt: new Date().toISOString()
      };
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/loyalty/tiers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
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

      const [customerRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
        `
          SELECT id
          FROM users
          WHERE id = :customerId
            AND deleted_at IS NULL
          LIMIT 1
          FOR UPDATE
        `,
        { customerId: params.customerId }
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
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO loyalty_tiers (
            code,
            name,
            min_cups,
            badge_color,
            sort_order,
            is_active
          )
          VALUES (
            :code,
            :name,
            :minCups,
            :badgeColor,
            :sortOrder,
            :isActive
          )
        `,
        {
          ...payload,
          code: normalizedCode
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
      const assignments = entries.map(([key]) => {
        if (key === 'code') {
          return 'code = :code';
        }
        switch (key) {
          case 'minCups':
            return 'min_cups = :minCups';
          case 'badgeColor':
            return 'badge_color = :badgeColor';
          case 'sortOrder':
            return 'sort_order = :sortOrder';
          case 'isActive':
            return 'is_active = :isActive';
          default:
            return `${key} = :${key}`;
        }
      });

      const values = {
        tierId,
        ...payload,
        code: payload.code?.trim().toLowerCase(),
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
