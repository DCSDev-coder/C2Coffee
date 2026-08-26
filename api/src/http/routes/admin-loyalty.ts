import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';

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

function formatTierName(value: string | null): string {
  const tier = String(value ?? 'kawan').trim().toLowerCase();
  switch (tier) {
    case 'legend':
      return 'Legend';
    case 'ketagih':
      return 'Ketagih';
    case 'dilamun':
      return 'Dilamun';
    default:
      return 'Kawan';
  }
}

function tierTarget(value: string | null): number {
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'kawan':
      return 10;
    case 'dilamun':
      return 30;
    case 'ketagih':
      return 50;
    default:
      return 50;
  }
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

export async function registerAdminLoyaltyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/loyalty/overview', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const { limit } = overviewQuerySchema.parse(request.query);
    const connection = await mysqlPool.getConnection();

    try {
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
            tier_code,
            COUNT(*) AS member_count,
            AVG(token_balance) AS avg_tokens
          FROM (
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
          ) user_tiers
          GROUP BY tier_code
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

      const tierBreakdown = tierRows
        .map((row) => {
          const tierCode = String(row.tier_code ?? 'kawan');
          const memberCount = Number(row.member_count ?? 0);
          const avgTokens = Number(row.avg_tokens ?? 0);
          return {
            tierCode,
            tierName: formatTierName(tierCode),
            members: memberCount,
            percentage: Number(((memberCount / tierTotals) * 100).toFixed(1)),
            avgTokens: Number(avgTokens.toFixed(2))
          };
        })
        .sort((a, b) => {
          const order = ['Legend', 'Ketagih', 'Dilamun', 'Kawan'];
          return order.indexOf(a.tierName) - order.indexOf(b.tierName);
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
        const tierCode = String(row.tier_code ?? 'kawan');
        const cups = Number(row.cups_last_180d ?? 0);
        const target = tierTarget(tierCode);
        const tierProgress = {
          current: cups,
          target,
          remaining: Math.max(0, target - cups),
          label: 'Rolling 180-day window'
        };

        return {
          id: `TL-${row.ledger_id}`,
          date: formatDateLabel(row.created_at),
          time: formatTimeLabel(row.created_at),
          member: {
            name: row.display_name || row.email || row.phone_e164,
            email: row.email || '',
            phone: row.phone_e164,
            memberId: `C2-${String(row.user_id).padStart(3, '0')}`,
            tier: formatTierName(tierCode),
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

      return {
        summary: {
          totalMembers,
          tokensInCirculation: Number(summaryRow.tokens_in_circulation ?? 0),
          tokensIssued,
          tokensRedeemed,
          redemptionRate,
          totalRewardRedemptions
        },
        tierBreakdown,
        issuedVsRedeemed,
        sourceBreakdown,
        topRedeemedRewards,
        recentActivity,
        transactions,
        lastUpdatedAt: new Date().toISOString()
      };
    } finally {
      connection.release();
    }
  });
}
