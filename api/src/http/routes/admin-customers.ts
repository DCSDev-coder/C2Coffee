import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(250).optional().default(100)
});

const createCustomerSchema = z.object({
  phone: z.string().trim().min(3).max(20),
  displayName: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  status: z.enum(['active', 'blocked', 'closed']).optional().default('active')
});

const updateCustomerSchema = z.object({
  phone: z.string().trim().min(3).max(20).optional(),
  displayName: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  status: z.enum(['active', 'blocked', 'closed']).optional()
});

const customerListQueryRowSchema = z.object({
  id: z.number(),
  phone_e164: z.string(),
  user_status: z.string(),
  joined_at: z.union([z.string(), z.date()]),
  display_name: z.string().nullable(),
  email: z.string().nullable(),
  avatar_value: z.string().nullable(),
  token_balance: z.number().nullable(),
  token_reserved: z.number().nullable(),
  token_cap: z.number().nullable(),
  order_count: z.number().nullable(),
  total_spent_rm: z.union([z.string(), z.number()]).nullable(),
  total_spent_tokens: z.union([z.string(), z.number()]).nullable(),
  last_order_at: z.union([z.string(), z.date()]).nullable(),
  refund_count: z.number().nullable(),
  tier_code: z.string().nullable(),
  cups_last_180d: z.number().nullable()
});

type CustomerListRow = z.infer<typeof customerListQueryRowSchema>;

function formatDisplayDate(value: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function titleCaseTier(value: string | null): string {
  const tier = String(value ?? '').trim().toLowerCase();
  switch (tier) {
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

function mapCustomerRow(row: CustomerListRow) {
  const totalSpent = Number(row.total_spent_rm ?? 0);
  const totalSpentTokens = Number(row.total_spent_tokens ?? 0);
  const tokenBalance = Number(row.token_balance ?? 0);
  const orderCount = Number(row.order_count ?? 0);
  const refundCount = Number(row.refund_count ?? 0);
  const cupsLast180d = Number(row.cups_last_180d ?? 0);
  const joinedAt = row.joined_at instanceof Date ? row.joined_at : new Date(row.joined_at);
  const lastOrderAt = row.last_order_at ? (row.last_order_at instanceof Date ? row.last_order_at : new Date(row.last_order_at)) : null;

  return {
    id: row.id,
    username: row.display_name || `Customer #${row.id}`,
    displayName: row.display_name || `Customer #${row.id}`,
    email: row.email || '',
    phone: row.phone_e164,
    tier: titleCaseTier(row.tier_code),
    tokens: tokenBalance.toLocaleString('en-US'),
    tokenBalance,
    orders: String(orderCount),
    orderCount,
    spent: `RM ${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    spentTokens: `${totalSpentTokens.toLocaleString('en-US')} tokens`,
    totalSpentTokens,
    totalSpentRm: totalSpent,
    cupsLast180d,
    lastOrder: formatDisplayDate(lastOrderAt),
    joinedAt: formatDisplayDate(joinedAt),
    status: refundCount > 0 ? 'Refund' : 'Paid',
    avatar: row.avatar_value || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    userStatus: row.user_status,
    refundCount
  };
}

export async function registerAdminCustomersRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/customers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const { limit } = listQuerySchema.parse(request.query);
    const connection = await mysqlPool.getConnection();

    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
            u.id,
            u.phone_e164,
            u.status AS user_status,
            u.created_at AS joined_at,
            up.display_name,
            up.email,
            up.avatar_value,
            ta.balance_available AS token_balance,
            ta.balance_reserved AS token_reserved,
            ta.balance_cap AS token_cap,
            COALESCE(os.order_count, 0) AS order_count,
            COALESCE(os.total_spent_rm, 0) AS total_spent_rm,
            COALESCE(os.total_spent_tokens, 0) AS total_spent_tokens,
            os.last_order_at,
            COALESCE(os.refund_count, 0) AS refund_count,
            (
              SELECT lts.tier_code
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ) AS tier_code,
            (
              SELECT lts.qualifying_cups_last_180d
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ) AS cups_last_180d
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.id
          LEFT JOIN token_accounts ta ON ta.user_id = u.id
          LEFT JOIN (
            SELECT
              o.user_id,
              COUNT(*) AS order_count,
              COALESCE(SUM(GREATEST(0, o.subtotal_rm + o.modifier_total_rm - o.discount_total_rm)), 0) AS total_spent_rm,
              COALESCE(SUM(o.token_amount_charged), 0) AS total_spent_tokens,
              MAX(o.created_at) AS last_order_at,
              SUM(CASE WHEN o.status IN ('refunded', 'refund_requested') THEN 1 ELSE 0 END) AS refund_count
            FROM orders o
            GROUP BY o.user_id
          ) os ON os.user_id = u.id
          WHERE u.deleted_at IS NULL
          ORDER BY u.created_at DESC, u.id DESC
          LIMIT :limit
        `,
        { limit }
      );

      return {
        customers: rows.map((row) => mapCustomerRow(row as CustomerListRow))
      };
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/customers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = createCustomerSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();

    try {
      await connection.beginTransaction();

      const [userInsert] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO users (phone_e164, status)
          VALUES (:phone, :status)
        `,
        {
          phone: payload.phone,
          status: payload.status
        }
      );

      const userId = userInsert.insertId;
      const displayName = payload.displayName || 'C2 Member';
      const email = payload.email ? payload.email : null;

      await connection.execute(
        `
          INSERT INTO user_profiles (
            user_id,
            display_name,
            email,
            avatar_type,
            avatar_value
          )
          VALUES (
            :userId,
            :displayName,
            :email,
            'preset',
            NULL
          )
        `,
        {
          userId,
          displayName,
          email
        }
      );

      await connection.execute(
        `
          INSERT INTO token_accounts (
            user_id,
            balance_available,
            balance_reserved,
            balance_cap
          )
          VALUES (
            :userId,
            0,
            0,
            500
          )
        `,
        { userId }
      );

      await connection.execute(
        `
          INSERT INTO loyalty_tier_snapshots (
            user_id,
            tier_code,
            qualifying_cups_last_180d,
            effective_at,
            reason_code
          )
          VALUES (
            :userId,
            'kawan',
            0,
            UTC_TIMESTAMP(),
            'admin_customer_create'
          )
        `,
        { userId }
      );

      await connection.commit();

      const [createdRows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
            u.id,
            u.phone_e164,
            u.status AS user_status,
            u.created_at AS joined_at,
            up.display_name,
            up.email,
            up.avatar_value,
            ta.balance_available AS token_balance,
            ta.balance_reserved AS token_reserved,
            ta.balance_cap AS token_cap,
            0 AS order_count,
            0 AS total_spent_rm,
            0 AS total_spent_tokens,
            NULL AS last_order_at,
            0 AS refund_count,
            'kawan' AS tier_code,
            0 AS cups_last_180d
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.id
          LEFT JOIN token_accounts ta ON ta.user_id = u.id
          WHERE u.id = :userId
          LIMIT 1
        `,
        { userId }
      );

      return { customer: mapCustomerRow(createdRows[0] as CustomerListRow) };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.patch('/v1/admin/customers/:userId', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const userId = z.coerce.number().int().positive().parse((request.params as { userId?: string }).userId);
    const payload = updateCustomerSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();

    try {
      await connection.beginTransaction();

      const updates: string[] = [];
      const values: { userId: number; phone?: string; status?: string } = { userId };

      if (payload.phone) {
        updates.push('phone_e164 = :phone');
        values.phone = payload.phone;
      }

      if (payload.status) {
        updates.push('status = :status');
        values.status = payload.status;
      }

      if (updates.length > 0) {
        await connection.execute(
          `
            UPDATE users
            SET ${updates.join(', ')}
            WHERE id = :userId
          `,
          values as any
        );
      }

      const profileUpdates: string[] = [];
      const profileValues: { userId: number; displayName?: string; email?: string | null } = { userId };

      if (payload.displayName !== undefined) {
        profileUpdates.push('display_name = :displayName');
        profileValues.displayName = payload.displayName || 'C2 Member';
      }

      if (payload.email !== undefined) {
        profileUpdates.push('email = :email');
        profileValues.email = payload.email || null;
      }

      if (profileUpdates.length > 0) {
        const [profileResult] = await connection.execute<ResultSetHeader>(
          `
            UPDATE user_profiles
            SET ${profileUpdates.join(', ')}
            WHERE user_id = :userId
          `,
          profileValues as any
        );

        if (profileResult.affectedRows === 0) {
          await connection.execute(
            `
              INSERT INTO user_profiles (
                user_id,
                display_name,
                email,
                avatar_type,
                avatar_value
              )
              VALUES (
                :userId,
                :displayName,
                :email,
                'preset',
                NULL
              )
            `,
            {
              userId,
              displayName: profileValues.displayName || 'C2 Member',
              email: profileValues.email ?? null
            } as any
          );
        }
      }

      await connection.commit();

      const [rows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
            u.id,
            u.phone_e164,
            u.status AS user_status,
            u.created_at AS joined_at,
            up.display_name,
            up.email,
            up.avatar_value,
            ta.balance_available AS token_balance,
            ta.balance_reserved AS token_reserved,
            ta.balance_cap AS token_cap,
            COALESCE(os.order_count, 0) AS order_count,
            COALESCE(os.total_spent_rm, 0) AS total_spent_rm,
            COALESCE(os.total_spent_tokens, 0) AS total_spent_tokens,
            os.last_order_at,
            COALESCE(os.refund_count, 0) AS refund_count,
            (
              SELECT lts.tier_code
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ) AS tier_code,
            (
              SELECT lts.qualifying_cups_last_180d
              FROM loyalty_tier_snapshots lts
              WHERE lts.user_id = u.id
              ORDER BY lts.effective_at DESC, lts.id DESC
              LIMIT 1
            ) AS cups_last_180d
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.id
          LEFT JOIN token_accounts ta ON ta.user_id = u.id
          LEFT JOIN (
            SELECT
              o.user_id,
              COUNT(*) AS order_count,
              COALESCE(SUM(GREATEST(0, o.subtotal_rm + o.modifier_total_rm - o.discount_total_rm)), 0) AS total_spent_rm,
              COALESCE(SUM(o.token_amount_charged), 0) AS total_spent_tokens,
              MAX(o.created_at) AS last_order_at,
              SUM(CASE WHEN o.status IN ('refunded', 'refund_requested') THEN 1 ELSE 0 END) AS refund_count
            FROM orders o
            GROUP BY o.user_id
          ) os ON os.user_id = u.id
          WHERE u.id = :userId
          LIMIT 1
        `,
        { userId }
      );

      return { customer: mapCustomerRow(rows[0] as CustomerListRow) };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.delete('/v1/admin/customers/:userId', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const userId = z.coerce.number().int().positive().parse((request.params as { userId?: string }).userId);

    await mysqlPool.execute(
      `
        UPDATE users
        SET status = 'deleted',
            deleted_at = UTC_TIMESTAMP(),
            closed_at = COALESCE(closed_at, UTC_TIMESTAMP())
        WHERE id = :userId
      `,
      { userId }
    );

    return { ok: true };
  });
}
