import type { FastifyInstance } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { verifyPassword } from '../../lib/password.js';
import { formatTierName, getTierByCode, getTierProgress, loadLoyaltyTiers } from '../../services/loyalty-tiers.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(250).optional().default(100)
});

const createCustomerSchema = z.object({
  phone: z.string().trim().min(3).max(20),
  displayName: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  status: z.enum(['active', 'blocked', 'closed']).optional().default('active'),
  isEmployee: z.boolean().optional().default(false),
  confirmation_password: z.string().trim().min(8).max(200)
});

const updateCustomerSchema = z.object({
  phone: z.string().trim().min(3).max(20).optional(),
  displayName: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  status: z.enum(['active', 'blocked', 'closed']).optional(),
  isEmployee: z.boolean().optional(),
  confirmation_password: z.string().trim().min(8).max(200)
});

const deleteCustomerSchema = z.object({
  confirmation_password: z.string().trim().min(8).max(200)
});

const importCustomerRowSchema = z.object({
  phone: z.string().trim().min(3).max(20),
  displayName: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  isEmployee: z.boolean().optional().default(false)
});

const importCustomersSchema = z.object({
  customers: z.array(importCustomerRowSchema).min(1).max(500),
  confirmation_password: z.string().trim().min(8).max(200)
}).superRefine((payload, context) => {
  const seenPhones = new Set<string>();
  payload.customers.forEach((customer, index) => {
    const phone = customer.phone.replace(/\s+/g, '');
    if (seenPhones.has(phone)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customers', index, 'phone'],
        message: 'Each phone number may appear only once in an import.'
      });
    }
    seenPhones.add(phone);
  });
});

const customerListQueryRowSchema = z.object({
  id: z.number(),
  phone_e164: z.string(),
  user_status: z.string(),
  is_employee: z.number(),
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

function mapCustomerRow(row: CustomerListRow, tiers: Awaited<ReturnType<typeof loadLoyaltyTiers>>) {
  const totalSpent = Number(row.total_spent_rm ?? 0);
  const totalSpentTokens = Number(row.total_spent_tokens ?? 0);
  const tokenBalance = Number(row.token_balance ?? 0);
  const orderCount = Number(row.order_count ?? 0);
  const refundCount = Number(row.refund_count ?? 0);
  const cupsLast180d = Number(row.cups_last_180d ?? 0);
  const tierProgress = getTierProgress(cupsLast180d, tiers);
  const rawTierCode = row.tier_code ? String(row.tier_code).trim().toLowerCase() : null;
  const tierConfig = rawTierCode ? getTierByCode(tiers, rawTierCode) : null;
  const tierCode = tierConfig ? tierConfig.code : tierProgress.tierCode;
  const tier = tierConfig ? tierConfig.name : tierProgress.tierName;
  const joinedAt = row.joined_at instanceof Date ? row.joined_at : new Date(row.joined_at);
  const lastOrderAt = row.last_order_at ? (row.last_order_at instanceof Date ? row.last_order_at : new Date(row.last_order_at)) : null;

  return {
    id: row.id,
    username: row.display_name || `Customer #${row.id}`,
    displayName: row.display_name || `Customer #${row.id}`,
    email: row.email || '',
    phone: row.phone_e164,
    tier,
    tierCode,
    tierProgress,
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
    status: row.user_status === 'active' ? 'Active' : 'Inactive',
    avatar: row.avatar_value || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    userStatus: row.user_status,
    isEmployee: Number(row.is_employee) === 1,
    refundCount
  };
}

async function assertCustomerMembership(connection: PoolConnection, tenantId: number, userId: number): Promise<void> {
  const [rows] = await connection.execute<Array<RowDataPacket & { user_id: number }>>(
    `
      SELECT user_id
      FROM customer_tenant_memberships
      WHERE tenant_id = :tenantId AND user_id = :userId
      LIMIT 1
    `,
    { tenantId, userId }
  );
  if (!rows[0]) {
    throw new Error('Customer is not available for this tenant.');
  }
}

async function requireAdminActionConfirmation(
  connection: PoolConnection,
  adminUserId: number,
  confirmationPassword: string
): Promise<void> {
  const [rows] = await connection.query<Array<RowDataPacket & { password_hash: string | null }>>(
    `SELECT password_hash FROM admin_users WHERE id = :adminUserId LIMIT 1 FOR UPDATE`,
    { adminUserId }
  );
  const admin = rows[0];
  if (!admin?.password_hash || !(await verifyPassword(confirmationPassword, admin.password_hash))) {
    throw new ApiError(401, 'admin_action_confirmation_failed', 'Current password confirmation is incorrect.');
  }
}

export async function registerAdminCustomersRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/customers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'support_admin']);
    const { limit } = listQuerySchema.parse(request.query);
    const connection = await mysqlPool.getConnection();

  try {
      const tiers = await loadLoyaltyTiers(connection);
      const [rows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
            u.id,
            u.phone_e164,
            u.status AS user_status,
            ctm.is_employee,
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
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
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
            JOIN stores os_store ON os_store.id = o.store_id AND os_store.tenant_id = :tenantId
            GROUP BY o.user_id
          ) os ON os.user_id = u.id
          WHERE u.deleted_at IS NULL
          ORDER BY u.created_at DESC, u.id DESC
          LIMIT :limit
        `,
        { limit, tenantId: request.adminAuth.tenantId }
      );

      return {
        customers: rows.map((row) => mapCustomerRow(row as CustomerListRow, tiers))
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
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);

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
          INSERT INTO customer_tenant_memberships (tenant_id, user_id, is_employee)
          VALUES (:tenantId, :userId, :isEmployee)
        `,
        { tenantId: request.adminAuth.tenantId, userId, isEmployee: payload.isEmployee ? 1 : 0 }
      );

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
            ctm.is_employee,
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
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
          LEFT JOIN user_profiles up ON up.user_id = u.id
          LEFT JOIN token_accounts ta ON ta.user_id = u.id
          WHERE u.id = :userId
          LIMIT 1
        `,
        { userId, tenantId: request.adminAuth.tenantId }
      );

      const tiers = await loadLoyaltyTiers(connection);

      return { customer: mapCustomerRow(createdRows[0] as CustomerListRow, tiers) };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/customers/import', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = importCustomersSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();

    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);

      let created = 0;
      let linkedExisting = 0;
      let skippedExisting = 0;

      for (const customer of payload.customers) {
        const phone = customer.phone.replace(/\s+/g, '');
        const [existingUsers] = await connection.execute<Array<RowDataPacket & { id: number }>>(
          `SELECT id FROM users WHERE phone_e164 = :phone LIMIT 1 FOR UPDATE`,
          { phone }
        );

        const existingUser = existingUsers[0];
        if (existingUser) {
          const [memberships] = await connection.execute<Array<RowDataPacket & { user_id: number }>>(
            `
              SELECT user_id
              FROM customer_tenant_memberships
              WHERE tenant_id = :tenantId AND user_id = :userId
              LIMIT 1
            `,
            { tenantId: request.adminAuth.tenantId, userId: existingUser.id }
          );

          if (memberships[0]) {
            skippedExisting += 1;
            continue;
          }

          await connection.execute(
            `
              INSERT INTO customer_tenant_memberships (tenant_id, user_id, is_employee)
              VALUES (:tenantId, :userId, :isEmployee)
            `,
            {
              tenantId: request.adminAuth.tenantId,
              userId: existingUser.id,
              isEmployee: customer.isEmployee ? 1 : 0
            }
          );
          linkedExisting += 1;
          continue;
        }

        const [userInsert] = await connection.execute<ResultSetHeader>(
          `INSERT INTO users (phone_e164, status) VALUES (:phone, 'active')`,
          { phone }
        );
        const userId = userInsert.insertId;

        await connection.execute(
          `
            INSERT INTO customer_tenant_memberships (tenant_id, user_id, is_employee)
            VALUES (:tenantId, :userId, :isEmployee)
          `,
          { tenantId: request.adminAuth.tenantId, userId, isEmployee: customer.isEmployee ? 1 : 0 }
        );
        await connection.execute(
          `
            INSERT INTO user_profiles (user_id, display_name, email, avatar_type, avatar_value)
            VALUES (:userId, :displayName, :email, 'preset', NULL)
          `,
          {
            userId,
            displayName: customer.displayName || 'C2 Member',
            email: customer.email || null
          }
        );
        await connection.execute(
          `
            INSERT INTO token_accounts (user_id, balance_available, balance_reserved, balance_cap)
            VALUES (:userId, 0, 0, 500)
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
            VALUES (:userId, 'kawan', 0, UTC_TIMESTAMP(), 'admin_customer_import')
          `,
          { userId }
        );
        created += 1;
      }

      await connection.commit();
      return {
        created,
        linked_existing: linkedExisting,
        skipped_existing: skippedExisting,
        total: payload.customers.length
      };
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
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      await assertCustomerMembership(connection, request.adminAuth.tenantId, userId);

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

      if (payload.isEmployee !== undefined) {
        await connection.execute(
          `
            UPDATE customer_tenant_memberships
            SET is_employee = :isEmployee
            WHERE tenant_id = :tenantId AND user_id = :userId
          `,
          { tenantId: request.adminAuth.tenantId, userId, isEmployee: payload.isEmployee ? 1 : 0 }
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
            ctm.is_employee,
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
          JOIN customer_tenant_memberships ctm
            ON ctm.user_id = u.id AND ctm.tenant_id = :tenantId
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
        { userId, tenantId: request.adminAuth.tenantId }
      );

      const tiers = await loadLoyaltyTiers(connection);

      return { customer: mapCustomerRow(rows[0] as CustomerListRow, tiers) };
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
    const payload = deleteCustomerSchema.parse(request.body);

    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      await assertCustomerMembership(connection, request.adminAuth.tenantId, userId);
      await connection.execute(
        `DELETE FROM customer_tenant_memberships WHERE tenant_id = :tenantId AND user_id = :userId`,
        { tenantId: request.adminAuth.tenantId, userId }
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return { ok: true };
  });
}
