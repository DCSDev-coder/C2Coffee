import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { requireAdminActionConfirmation } from '../../admin/action-confirmation.js';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { env } from '../../config/env.js';
import { getUtcConnection } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const cleanupSchema = z.object({
  action: z.enum(['temporary_records', 'old_notifications', 'orphan_media']),
  dry_run: z.boolean().default(true),
  confirmation_password: z.string().trim().min(8).max(200).optional()
});

type CountRow = RowDataPacket & { count: number | string };
type MediaRow = RowDataPacket & {
  asset_path: string;
  file_name: string;
  bytes_estimate: number | string;
};

const MEDIA_ORPHAN_FILTER = `
  NOT EXISTS (SELECT 1 FROM admin_tenants t WHERE t.logo_asset_path = ma.asset_path)
  AND NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.avatar_value = ma.asset_path)
  AND NOT EXISTS (SELECT 1 FROM menu_items mi WHERE mi.image_url = ma.asset_path)
  AND NOT EXISTS (SELECT 1 FROM menu_option_group_options mogo WHERE mogo.image_url = ma.asset_path)
  AND NOT EXISTS (SELECT 1 FROM voucher_templates vt WHERE vt.image_url = ma.asset_path)
  AND NOT EXISTS (SELECT 1 FROM loyalty_tiers lt WHERE lt.image_url = ma.asset_path)
  AND NOT EXISTS (SELECT 1 FROM home_banners hb WHERE hb.image_source = ma.asset_path)
  AND NOT EXISTS (SELECT 1 FROM barista_sop_guides bsg WHERE bsg.image_url = ma.asset_path)
  AND NOT EXISTS (
    SELECT 1
    FROM customer_support_tickets cst
    WHERE CAST(cst.attachments_json AS CHAR) LIKE CONCAT('%', ma.asset_path, '%')
  )
`;

function numberValue(value: number | string | null | undefined): number {
  return Number(value || 0);
}

async function count(connection: PoolConnection, sql: string, params: Record<string, unknown> = {}): Promise<number> {
  const [rows] = await connection.query<CountRow[]>(sql, params as never);
  return numberValue(rows[0]?.count);
}

async function listOrphanMedia(connection: PoolConnection, limit = 5000): Promise<MediaRow[]> {
  const [rows] = await connection.query<MediaRow[]>(
    `
      SELECT ma.asset_path, ma.file_name, OCTET_LENGTH(ma.content) AS bytes_estimate
      FROM media_assets ma
      WHERE ${MEDIA_ORPHAN_FILTER}
      ORDER BY ma.id ASC
      LIMIT :limit
    `,
    { limit }
  );
  return rows;
}

async function temporaryCounts(connection: PoolConnection, tenantId: number) {
  const [
    expiredCustomerSessions,
    eligibleCustomerSessions,
    expiredAdminSessions,
    eligibleAdminSessions,
    expiredCounterSessions,
    eligibleCounterSessions,
    expiredAuthOtps,
    eligibleAuthOtps,
    eligibleEmailOtps,
    eligibleAdminPasswordOtps,
    eligibleOtpRequestLogs
  ] = await Promise.all([
    count(connection, 'SELECT COUNT(*) AS count FROM sessions WHERE expires_at <= UTC_TIMESTAMP()'),
    count(connection, "SELECT COUNT(*) AS count FROM sessions WHERE expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)"),
    count(connection, 'SELECT COUNT(*) AS count FROM admin_sessions WHERE tenant_id = :tenantId AND expires_at <= UTC_TIMESTAMP()', { tenantId }),
    count(connection, 'SELECT COUNT(*) AS count FROM admin_sessions WHERE tenant_id = :tenantId AND expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)', { tenantId }),
    count(connection, 'SELECT COUNT(*) AS count FROM counter_customer_sessions WHERE tenant_id = :tenantId AND expires_at <= UTC_TIMESTAMP()', { tenantId }),
    count(connection, 'SELECT COUNT(*) AS count FROM counter_customer_sessions WHERE tenant_id = :tenantId AND expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)', { tenantId }),
    count(connection, 'SELECT COUNT(*) AS count FROM auth_otps WHERE expires_at <= UTC_TIMESTAMP()'),
    count(connection, 'SELECT COUNT(*) AS count FROM auth_otps WHERE expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)'),
    count(connection, 'SELECT COUNT(*) AS count FROM customer_email_change_otps WHERE expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)'),
    count(connection, `SELECT COUNT(*) AS count
      FROM admin_password_change_otps apco
      JOIN admin_users au ON au.id = apco.admin_user_id
      WHERE au.tenant_id = :tenantId
        AND apco.expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)`, { tenantId }),
    count(connection, 'SELECT COUNT(*) AS count FROM otp_request_logs WHERE created_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)')
  ]);

  return {
    expired_now: expiredCustomerSessions + expiredAdminSessions + expiredCounterSessions + expiredAuthOtps,
    eligible_now: eligibleCustomerSessions + eligibleAdminSessions + eligibleCounterSessions + eligibleAuthOtps + eligibleEmailOtps + eligibleAdminPasswordOtps + eligibleOtpRequestLogs,
    groups: [
      { key: 'customer_sessions', label: 'Customer sessions', expired_now: expiredCustomerSessions, eligible_now: eligibleCustomerSessions },
      { key: 'admin_sessions', label: 'Admin sessions', expired_now: expiredAdminSessions, eligible_now: eligibleAdminSessions },
      { key: 'counter_sessions', label: 'Counter customer sessions', expired_now: expiredCounterSessions, eligible_now: eligibleCounterSessions },
      { key: 'authentication_records', label: 'OTP and authentication diagnostics', expired_now: expiredAuthOtps, eligible_now: eligibleAuthOtps + eligibleEmailOtps + eligibleAdminPasswordOtps + eligibleOtpRequestLogs }
    ]
  };
}

async function deleteTemporaryRecords(connection: PoolConnection, tenantId: number): Promise<Record<string, number>> {
  const statements: Array<[string, string, Record<string, unknown>?]> = [
    ['customer_sessions', 'DELETE FROM sessions WHERE expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY) LIMIT 500', undefined],
    ['admin_sessions', 'DELETE FROM admin_sessions WHERE tenant_id = :tenantId AND expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY) LIMIT 500', { tenantId }],
    ['counter_sessions', 'DELETE FROM counter_customer_sessions WHERE tenant_id = :tenantId AND expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY) LIMIT 500', { tenantId }],
    ['auth_otps', 'DELETE FROM auth_otps WHERE expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY) LIMIT 500', undefined],
    ['email_change_otps', 'DELETE FROM customer_email_change_otps WHERE expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY) LIMIT 500', undefined],
    ['admin_password_otps', `DELETE FROM admin_password_change_otps
      WHERE id IN (
        SELECT id FROM (
          SELECT apco.id
          FROM admin_password_change_otps apco
          JOIN admin_users au ON au.id = apco.admin_user_id
          WHERE au.tenant_id = :tenantId
            AND apco.expires_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)
          ORDER BY apco.id ASC
          LIMIT 500
        ) eligible_admin_password_otps
      )`, { tenantId }],
    ['otp_request_logs', 'DELETE FROM otp_request_logs WHERE created_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY) LIMIT 500', undefined]
  ];
  const deleted: Record<string, number> = {};
  for (const [key, sql, params] of statements) {
    const [result] = await connection.execute(sql, (params || {}) as never);
    deleted[key] = 'affectedRows' in result ? result.affectedRows : 0;
  }
  return deleted;
}

async function writeCleanupAudit(
  connection: PoolConnection,
  request: FastifyRequest,
  action: string,
  result: Record<string, unknown>
): Promise<void> {
  await connection.execute(
    `INSERT INTO admin_audit_logs (
      admin_user_id, effective_roles_json, action_code, target_type, target_id,
      after_json, reason_code, reason_note, ip_address, user_agent, created_at
    ) VALUES (
      :adminUserId, :roles, 'data_retention_cleanup', 'data_retention', NULL,
      :afterJson, :reasonCode, :reasonNote, :ipAddress, :userAgent, UTC_TIMESTAMP()
    )`,
    {
      adminUserId: request.adminAuth.adminUserId,
      roles: JSON.stringify(request.adminAuth.roles),
      afterJson: JSON.stringify(result),
      reasonCode: action,
      reasonNote: `Administrator executed the ${action} retention cleanup policy.`,
      ipAddress: request.ip,
      userAgent: String(request.headers['user-agent'] || '').slice(0, 512)
    }
  );
}

export async function registerAdminDataRetentionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/data-retention/summary', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const connection = await getUtcConnection();
    try {
      const tenantId = request.adminAuth.tenantId;
      const [databaseRows] = await connection.query<Array<RowDataPacket & { bytes_used: number | string }>>(
        `SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes_used
         FROM information_schema.tables WHERE table_schema = DATABASE()`
      );
      const [mediaRows] = await connection.query<Array<RowDataPacket & { asset_count: number | string; bytes_used: number | string }>>(
        'SELECT COUNT(*) AS asset_count, COALESCE(SUM(OCTET_LENGTH(content)), 0) AS bytes_used FROM media_assets'
      );
      const [archiveRows] = await connection.query<Array<RowDataPacket & {
        record_type: string; label: string; archived_count: number | string; due_count: number | string;
      }>>(
        `SELECT 'menu_items' AS record_type, 'Menu items' AS label, COUNT(*) AS archived_count,
            SUM(CASE WHEN archived_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 YEAR) THEN 1 ELSE 0 END) AS due_count
         FROM menu_items WHERE is_active = 0
         UNION ALL
         SELECT 'voucher_templates', 'Voucher templates', COUNT(*),
            SUM(CASE WHEN deleted_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 YEAR) THEN 1 ELSE 0 END)
         FROM voucher_templates WHERE tenant_id = :tenantId AND deleted_at IS NOT NULL
         UNION ALL
         SELECT 'loyalty_tiers', 'Tier definitions', COUNT(*),
            SUM(CASE WHEN updated_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 YEAR) THEN 1 ELSE 0 END)
         FROM loyalty_tiers WHERE is_active = 0
         UNION ALL
         SELECT 'referral_programs', 'Referral programs', COUNT(*),
            SUM(CASE WHEN updated_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 YEAR) THEN 1 ELSE 0 END)
         FROM referral_programs WHERE tenant_id = :tenantId AND status = 'archived'
         UNION ALL
         SELECT 'home_banners', 'Marketing banners', COUNT(*),
            SUM(CASE WHEN updated_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 YEAR) THEN 1 ELSE 0 END)
         FROM home_banners WHERE tenant_id = :tenantId AND is_active = 0`,
        { tenantId }
      );
      const protectedCounts = {
        orders: await count(connection, 'SELECT COUNT(*) AS count FROM orders'),
        payments: await count(connection, 'SELECT COUNT(*) AS count FROM payments'),
        refunds: await count(connection, 'SELECT COUNT(*) AS count FROM refunds'),
        token_ledger: await count(connection, 'SELECT COUNT(*) AS count FROM token_ledger'),
        voucher_redemptions: await count(connection, 'SELECT COUNT(*) AS count FROM voucher_redemptions'),
        loyalty_events: await count(connection, 'SELECT COUNT(*) AS count FROM loyalty_cup_events'),
        referral_outcomes: await count(connection, 'SELECT COUNT(*) AS count FROM referral_reward_outcomes'),
        audit_logs: await count(connection, 'SELECT COUNT(*) AS count FROM admin_audit_logs')
      };
      const customerRetention = {
        due_now: await count(connection, "SELECT COUNT(*) AS count FROM users WHERE status IN ('closed','deletion_requested','deleted') AND retention_until IS NOT NULL AND retention_until <= UTC_TIMESTAMP()"),
        due_within_90_days: await count(connection, "SELECT COUNT(*) AS count FROM users WHERE status IN ('closed','deletion_requested','deleted') AND retention_until > UTC_TIMESTAMP() AND retention_until <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY)")
      };
      const temporary = await temporaryCounts(connection, tenantId);
      const oldNotifications = await count(connection, 'SELECT COUNT(*) AS count FROM notifications WHERE created_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 MONTH)');
      const orphanMedia = await listOrphanMedia(connection);
      const orphanPaths = new Set(orphanMedia.map((row) => row.asset_path));
      const [reviewRows] = await connection.query<Array<RowDataPacket & {
        record_key: string; status: string; review_due_at: Date;
      }>>(
        `SELECT record_key, status, review_due_at
         FROM data_retention_reviews
         WHERE tenant_id = :tenantId AND record_type = 'orphan_media' AND status = 'quarantined'`,
        { tenantId }
      );
      const activeReviews = reviewRows.filter((row) => orphanPaths.has(row.record_key));
      const eligibleMedia = activeReviews.filter((row) => new Date(row.review_due_at).getTime() <= Date.now());

      return {
        generated_at: new Date().toISOString(),
        policy: {
          archive_review_years: 5,
          account_retention_years: env.ACCOUNT_RETENTION_YEARS,
          temporary_record_grace_days: 90,
          notification_retention_months: 24,
          orphan_media_quarantine_days: 30
        },
        storage: {
          database_bytes: numberValue(databaseRows[0]?.bytes_used),
          media_assets: numberValue(mediaRows[0]?.asset_count),
          media_bytes: numberValue(mediaRows[0]?.bytes_used)
        },
        protected_records: protectedCounts,
        archive_review: {
          due_now: archiveRows.reduce((sum, row) => sum + numberValue(row.due_count), 0),
          groups: archiveRows.map((row) => ({
            key: row.record_type,
            label: row.label,
            archived_count: numberValue(row.archived_count),
            due_count: numberValue(row.due_count)
          }))
        },
        customer_retention: customerRetention,
        cleanup_candidates: {
          temporary,
          old_notifications: oldNotifications
        },
        orphan_media: {
          count: orphanMedia.length,
          bytes: orphanMedia.reduce((sum, row) => sum + numberValue(row.bytes_estimate), 0),
          quarantined_count: activeReviews.length,
          eligible_count: eligibleMedia.length
        }
      };
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/data-retention/media-review', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const connection = await getUtcConnection();
    try {
      const candidates = await listOrphanMedia(connection);
      const candidatePaths = new Set(candidates.map((candidate) => candidate.asset_path));
      await connection.beginTransaction();
      const [existingReviews] = await connection.query<Array<RowDataPacket & { id: number; record_key: string }>>(
        `SELECT id, record_key
         FROM data_retention_reviews
         WHERE tenant_id = :tenantId AND record_type = 'orphan_media' AND status = 'quarantined'
         FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId }
      );
      for (const review of existingReviews) {
        if (!candidatePaths.has(review.record_key)) {
          await connection.execute(
            `UPDATE data_retention_reviews
             SET status = 'kept', reviewed_at = UTC_TIMESTAMP(),
                 review_note = 'Asset became referenced during quarantine.', updated_at = UTC_TIMESTAMP()
             WHERE id = :id`,
            { id: review.id }
          );
        }
      }
      for (const candidate of candidates) {
        await connection.execute(
          `INSERT INTO data_retention_reviews (
            tenant_id, record_type, record_key, display_name, bytes_estimate,
            first_flagged_at, review_due_at, status, created_at, updated_at
          ) VALUES (
            :tenantId, 'orphan_media', :recordKey, :displayName, :bytesEstimate,
            UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY), 'quarantined', UTC_TIMESTAMP(), UTC_TIMESTAMP()
          ) ON DUPLICATE KEY UPDATE
            display_name = VALUES(display_name),
            bytes_estimate = VALUES(bytes_estimate),
            first_flagged_at = IF(status IN ('kept', 'completed'), UTC_TIMESTAMP(), first_flagged_at),
            review_due_at = IF(status IN ('kept', 'completed'), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY), review_due_at),
            status = IF(status IN ('kept', 'completed'), 'quarantined', status),
            reviewed_by_admin_user_id = IF(status = 'quarantined', NULL, reviewed_by_admin_user_id),
            reviewed_at = IF(status = 'quarantined', NULL, reviewed_at),
            review_note = IF(status = 'quarantined', NULL, review_note),
            completed_at = IF(status = 'quarantined', NULL, completed_at),
            updated_at = UTC_TIMESTAMP()`,
          {
            tenantId: request.adminAuth.tenantId,
            recordKey: candidate.asset_path,
            displayName: candidate.file_name,
            bytesEstimate: numberValue(candidate.bytes_estimate)
          }
        );
      }
      await connection.commit();
      return { quarantined_count: candidates.length, quarantine_days: 30 };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/data-retention/cleanup', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = cleanupSchema.parse(request.body);
    const connection = await getUtcConnection();
    try {
      const tenantId = request.adminAuth.tenantId;
      if (payload.dry_run) {
        if (payload.action === 'temporary_records') {
          return { dry_run: true, action: payload.action, candidates: (await temporaryCounts(connection, tenantId)).eligible_now };
        }
        if (payload.action === 'old_notifications') {
          return { dry_run: true, action: payload.action, candidates: await count(connection, 'SELECT COUNT(*) AS count FROM notifications WHERE created_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 MONTH)') };
        }
        const orphanPaths = new Set((await listOrphanMedia(connection)).map((row) => row.asset_path));
        const [eligibleRows] = await connection.query<Array<RowDataPacket & { record_key: string }>>(
          `SELECT record_key FROM data_retention_reviews
           WHERE tenant_id = :tenantId AND record_type = 'orphan_media'
             AND status = 'quarantined' AND review_due_at <= UTC_TIMESTAMP()
           LIMIT 500`,
          { tenantId }
        );
        return { dry_run: true, action: payload.action, candidates: eligibleRows.filter((row) => orphanPaths.has(row.record_key)).length };
      }

      if (!payload.confirmation_password) {
        throw new ApiError(400, 'confirmation_password_required', 'Enter your current administrator password to run cleanup.');
      }
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      let result: Record<string, unknown>;
      if (payload.action === 'temporary_records') {
        result = { deleted: await deleteTemporaryRecords(connection, tenantId) };
      } else if (payload.action === 'old_notifications') {
        const [deleteResult] = await connection.execute(
          'DELETE FROM notifications WHERE created_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 MONTH) LIMIT 500'
        );
        result = { deleted: 'affectedRows' in deleteResult ? deleteResult.affectedRows : 0 };
      } else {
        const orphanPaths = new Set((await listOrphanMedia(connection)).map((row) => row.asset_path));
        const [eligibleRows] = await connection.query<Array<RowDataPacket & { id: number; record_key: string }>>(
          `SELECT id, record_key FROM data_retention_reviews
           WHERE tenant_id = :tenantId AND record_type = 'orphan_media'
             AND status = 'quarantined' AND review_due_at <= UTC_TIMESTAMP()
           ORDER BY review_due_at ASC LIMIT 500 FOR UPDATE`,
          { tenantId }
        );
        let deleted = 0;
        for (const row of eligibleRows) {
          if (!orphanPaths.has(row.record_key)) continue;
          const [deleteResult] = await connection.execute('DELETE FROM media_assets WHERE asset_path = :assetPath LIMIT 1', { assetPath: row.record_key });
          const affected = 'affectedRows' in deleteResult ? deleteResult.affectedRows : 0;
          if (affected > 0) {
            deleted += affected;
            await connection.execute(
              `UPDATE data_retention_reviews SET status = 'completed', completed_at = UTC_TIMESTAMP(),
                 reviewed_at = UTC_TIMESTAMP(), reviewed_by_admin_user_id = :adminUserId,
                 review_note = 'Deleted after 30-day orphan-media quarantine.' WHERE id = :id`,
              { adminUserId: request.adminAuth.adminUserId, id: row.id }
            );
          }
        }
        result = { deleted };
      }
      await writeCleanupAudit(connection, request, payload.action, result);
      await connection.commit();
      return { dry_run: false, action: payload.action, ...result };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
