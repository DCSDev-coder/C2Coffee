import type { FastifyInstance } from 'fastify';
import type { FieldPacket, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole, requireAnyAdminRole } from '../../admin/guard.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { requireAdminActionConfirmation } from '../../admin/action-confirmation.js';
import { retryReferralRewardJob } from '../../services/referrals.js';

const rewardSchema = z.object({
  type: z.enum(['voucher', 'token']),
  voucherTemplateId: z.number().int().positive().nullable().optional(),
  tokenAmount: z.number().int().min(1).max(1000).nullable().optional()
}).superRefine((value, context) => {
  if (value.type === 'voucher' && !value.voucherTemplateId) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a voucher.', path: ['voucherTemplateId'] });
  if (value.type === 'token' && !value.tokenAmount) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter token amount.', path: ['tokenAmount'] });
});

const programSchema = z.object({
  name: z.string().trim().min(2).max(120),
  status: z.enum(['draft', 'active', 'paused', 'archived']).default('draft'),
  friendReward: rewardSchema,
  referrerReward: rewardSchema,
  qualificationDays: z.number().int().min(1).max(90).default(14),
  monthlyReferrerLimit: z.number().int().min(1).max(100).default(10)
});

type ReferralQueryResult = RowDataPacket[] | ResultSetHeader;
type ReferralQueryValues = Record<string, string | number | null>;

/**
 * Referral administration must never leave the browser waiting forever when a
 * database statement is blocked. mysql2 cancels statements at this boundary.
 */
async function runReferralQuery<T extends ReferralQueryResult>(
  sql: string,
  values: ReferralQueryValues
): Promise<[T, FieldPacket[]]> {
  return mysqlPool.query<T>({ sql, values, timeout: 5_000 });
}

async function validateVoucher(tenantId: number, id: number | null | undefined) {
  if (!id) return;
  const [rows] = await runReferralQuery<Array<RowDataPacket & { id: number }>>(
    'SELECT id FROM voucher_templates WHERE id = :id AND tenant_id = :tenantId AND is_active = 1 LIMIT 1',
    { id, tenantId }
  );
  if (!rows[0]) throw new ApiError(400, 'invalid_referral_voucher', 'Selected voucher is not active for this tenant.');
}

function bindings(payload: z.infer<typeof programSchema>) {
  return {
    name: payload.name,
    status: payload.status,
    friendType: payload.friendReward.type,
    friendVoucher: (payload.friendReward.type === 'voucher' ? payload.friendReward.voucherTemplateId : null) ?? null,
    friendTokens: (payload.friendReward.type === 'token' ? payload.friendReward.tokenAmount : null) ?? null,
    referrerType: payload.referrerReward.type,
    referrerVoucher: (payload.referrerReward.type === 'voucher' ? payload.referrerReward.voucherTemplateId : null) ?? null,
    referrerTokens: (payload.referrerReward.type === 'token' ? payload.referrerReward.tokenAmount : null) ?? null,
    qualificationDays: payload.qualificationDays,
    monthlyLimit: payload.monthlyReferrerLimit
  };
}

async function syncActiveProgram(
  connection: PoolConnection,
  tenantId: number,
  programId: number,
  status: z.infer<typeof programSchema>['status']
): Promise<void> {
  if (status === 'active') {
    await connection.execute(
      "UPDATE referral_programs SET status = 'paused' WHERE tenant_id = :tenantId AND status = 'active' AND id != :programId",
      { tenantId, programId }
    );
    await connection.execute(
      `INSERT INTO referral_active_programs (tenant_id, program_id)
       VALUES (:tenantId, :programId)
       ON DUPLICATE KEY UPDATE program_id = VALUES(program_id), updated_at = UTC_TIMESTAMP()`,
      { tenantId, programId }
    );
    return;
  }

  await connection.execute(
    'DELETE FROM referral_active_programs WHERE tenant_id = :tenantId AND program_id = :programId',
    { tenantId, programId }
  );
}

export async function registerAdminReferralRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/referral-reward-jobs', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin']);
    const [rows] = await runReferralQuery<Array<RowDataPacket>>(
      `SELECT j.id, j.referral_id, j.reward_side, j.status, j.attempt_count,
              j.next_attempt_at, j.last_failure_reason, j.last_error_message,
              j.resolution_note, j.created_at, j.updated_at,
              rp.name AS program_name, referrer_profile.display_name AS referrer_name,
              friend_profile.display_name AS friend_name
       FROM referral_reward_jobs j
       JOIN referrals r ON r.id = j.referral_id
       LEFT JOIN referral_programs rp ON rp.id = r.referral_program_id
       LEFT JOIN user_profiles referrer_profile ON referrer_profile.user_id = r.referrer_user_id
       LEFT JOIN user_profiles friend_profile ON friend_profile.user_id = r.referred_user_id
       WHERE j.tenant_id = :tenantId AND j.status IN ('pending','retrying','needs_review')
       ORDER BY (j.status = 'needs_review') DESC, j.created_at ASC`,
      { tenantId: request.adminAuth.tenantId }
    );
    return reply.send({ jobs: rows });
  });

  app.post('/v1/admin/referral-reward-jobs/:id/retry', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin']);
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      const outcome = await retryReferralRewardJob(connection, id, request.adminAuth.tenantId);
      await connection.commit();
      return reply.send(outcome);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/referral-reward-jobs/:id/waive', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAdminRole(request, 'super_admin');
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const payload = z.object({ confirmation_password: z.string().min(8).max(200), note: z.string().trim().min(10).max(500) }).parse(request.body);
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE referral_reward_jobs
         SET status = 'waived', resolved_by_admin_id = :adminUserId,
             resolution_note = :note, resolved_at = UTC_TIMESTAMP(), next_attempt_at = NULL
         WHERE id = :id AND tenant_id = :tenantId AND status IN ('pending','retrying','needs_review')`,
        { id, tenantId: request.adminAuth.tenantId, adminUserId: request.adminAuth.adminUserId, note: payload.note }
      );
      if (!result.affectedRows) throw new ApiError(404, 'referral_reward_job_not_found', 'Unresolved referral reward was not found.');
      await connection.execute(
        `INSERT INTO admin_audit_logs (admin_user_id, effective_roles_json, action_code, target_type, target_id, ip_address, user_agent, created_at)
         VALUES (:adminUserId, :roles, 'referral_reward_waived', 'referral_reward_job', :id, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), id, ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null }
      );
      await connection.commit();
      return reply.send({ success: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/referral-programs', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin']);
    request.log.info({ tenantId: request.adminAuth.tenantId }, 'Listing referral programs');
    const [rows] = await runReferralQuery<Array<RowDataPacket>>(
      `SELECT id, tenant_id, name, status,
              friend_reward_type, friend_voucher_template_id, friend_token_amount,
              referrer_reward_type, referrer_voucher_template_id, referrer_token_amount,
              qualification_days, monthly_referrer_limit, created_at, updated_at
       FROM referral_programs
       WHERE tenant_id = :tenantId
       ORDER BY updated_at DESC, id DESC`,
      { tenantId: request.adminAuth.tenantId }
    );
    request.log.info({ tenantId: request.adminAuth.tenantId, count: rows.length }, 'Listed referral programs');
    return reply.code(200).send({ programs: rows });
  });

  app.post('/v1/admin/referral-programs', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin']);
    const payload = programSchema.parse(request.body);
    request.log.info({ tenantId: request.adminAuth.tenantId, status: payload.status }, 'Creating referral program');
    await validateVoucher(request.adminAuth.tenantId, payload.friendReward.voucherTemplateId);
    await validateVoucher(request.adminAuth.tenantId, payload.referrerReward.voucherTemplateId);
    const value = bindings(payload);

    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO referral_programs (
        tenant_id, name, status,
        friend_reward_type, friend_voucher_template_id, friend_token_amount,
        referrer_reward_type, referrer_voucher_template_id, referrer_token_amount,
        qualification_days, monthly_referrer_limit
      ) VALUES (
        :tenantId, :name, :status,
        :friendType, :friendVoucher, :friendTokens,
        :referrerType, :referrerVoucher, :referrerTokens,
        :qualificationDays, :monthlyLimit
        )`,
        { tenantId: request.adminAuth.tenantId, ...value }
      );
      await syncActiveProgram(connection, request.adminAuth.tenantId, result.insertId, payload.status);
      await connection.commit();

      request.log.info({ tenantId: request.adminAuth.tenantId, programId: result.insertId }, 'Created referral program');
      return reply.code(201).send({ id: result.insertId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.patch('/v1/admin/referral-programs/:id', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin']);
    const payload = programSchema.parse(request.body);
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    await validateVoucher(request.adminAuth.tenantId, payload.friendReward.voucherTemplateId);
    await validateVoucher(request.adminAuth.tenantId, payload.referrerReward.voucherTemplateId);
    const value = bindings(payload);

    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE referral_programs SET
        name = :name,
        status = :status,
        friend_reward_type = :friendType,
        friend_voucher_template_id = :friendVoucher,
        friend_token_amount = :friendTokens,
        referrer_reward_type = :referrerType,
        referrer_voucher_template_id = :referrerVoucher,
        referrer_token_amount = :referrerTokens,
        qualification_days = :qualificationDays,
        monthly_referrer_limit = :monthlyLimit
        WHERE id = :id AND tenant_id = :tenantId`,
        { id, tenantId: request.adminAuth.tenantId, ...value }
      );

      if (!result.affectedRows) {
        throw new ApiError(404, 'referral_program_not_found', 'Referral program not found.');
      }
      await syncActiveProgram(connection, request.adminAuth.tenantId, id, payload.status);
      await connection.commit();
      return reply.code(200).send({ success: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.delete('/v1/admin/referral-programs/:id', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAdminRole(request, 'super_admin');
    const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const [result] = await runReferralQuery<ResultSetHeader>(
      'DELETE FROM referral_programs WHERE id = :id AND tenant_id = :tenantId AND NOT EXISTS (SELECT 1 FROM referrals WHERE referral_program_id = :id)',
      { id, tenantId: request.adminAuth.tenantId }
    );
    if (!result.affectedRows) {
      throw new ApiError(409, 'referral_program_in_use', 'Only unused referral programs can be deleted.');
    }
    return reply.code(200).send({ success: true });
  });
}
