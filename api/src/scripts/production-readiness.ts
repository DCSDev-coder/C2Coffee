import nodemailer from 'nodemailer';
import type { RowDataPacket } from 'mysql2/promise';

import { env } from '../config/env.js';
import { mysqlPool } from '../db/mysql.js';
import { getActiveChipMethods } from '../payments/chip-client.js';
import { expireStaleUserVouchers } from '../services/voucher-expiry-maintenance.js';

type Check = {
  name: string;
  detail: string;
  run: () => Promise<void> | void;
};

function requireValue(name: string, value: string): void {
  if (!value || value.includes('REPLACE_WITH')) {
    throw new Error(`${name} is not configured.`);
  }
}

async function requireHealthy(url: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
}

async function requireChipApprovedMethods(): Promise<void> {
  const active = await getActiveChipMethods();
  for (const method of env.TOPUP_GATEWAY_ALLOWED_METHODS) {
    if (!active.has(method as 'fpx' | 'duitnow_qr' | 'card' | 'ewallet')) {
      throw new Error(`CHIP method ${method} is allowed by the API but is not active for this brand.`);
    }
  }
}

async function requireNoFinancialReviewBacklog(): Promise<void> {
  const [rows] = await mysqlPool.query<Array<RowDataPacket & {
    topup_reviews: number;
    referral_reviews: number;
    loyalty_reviews: number;
  }>>(
    `SELECT
       (SELECT COUNT(*) FROM token_topups WHERE status = 'refund_needs_review') AS topup_reviews,
       (SELECT COUNT(*) FROM referral_reward_reversals WHERE status = 'needs_review') AS referral_reviews,
       (SELECT COUNT(*) FROM loyalty_order_reward_issues WHERE reversal_status = 'needs_review') AS loyalty_reviews`
  );
  const topUpReviews = Number(rows[0]?.topup_reviews ?? 0);
  const referralReviews = Number(rows[0]?.referral_reviews ?? 0);
  const loyaltyReviews = Number(rows[0]?.loyalty_reviews ?? 0);
  if (topUpReviews > 0 || referralReviews > 0 || loyaltyReviews > 0) {
    throw new Error(
      `Unresolved financial review queue: ${topUpReviews} top-up refund(s), ` +
      `${referralReviews} referral reversal(s), ${loyaltyReviews} loyalty reward reversal(s).`
    );
  }
}

async function requireVoucherIntegrity(): Promise<void> {
  await expireStaleUserVouchers();
  const [migrationRows] = await mysqlPool.query<Array<RowDataPacket & { migration_count: number }>>(
    `SELECT COUNT(*) AS migration_count
       FROM schema_migrations
      WHERE filename = '100_index_voucher_allocation_checks.sql'`
  );
  if (Number(migrationRows[0]?.migration_count ?? 0) !== 1) {
    throw new Error('Voucher allocation migration 100 has not been applied.');
  }

  const [rows] = await mysqlPool.query<Array<RowDataPacket & {
    invalid_templates: number;
    duplicate_campaigns: number;
    duplicate_claimable_tiers: number;
    stale_active_vouchers: number;
  }>>(
    `SELECT
       (
         SELECT COUNT(*)
         FROM voucher_templates vt
         WHERE (vt.total_quantity IS NOT NULL AND vt.total_quantity < 1)
            OR (vt.limit_per_user IS NOT NULL AND vt.limit_per_user < 1)
            OR (vt.total_quantity IS NOT NULL AND vt.limit_per_user > vt.total_quantity)
            OR (
              COALESCE(JSON_UNQUOTE(JSON_EXTRACT(vt.eligible_scope_json, '$.audience')), 'all_customers') <> 'manual_issue_only'
              AND COALESCE(vt.limit_per_user, 1) > 1
            )
       ) AS invalid_templates,
       (
         SELECT COUNT(*)
         FROM (
           SELECT uv.user_id, uv.voucher_template_id
           FROM user_vouchers uv
           JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
           WHERE uv.status = 'active'
             AND uv.redeemed_at IS NULL
             AND uv.revoked_at IS NULL
             AND uv.expires_at > UTC_TIMESTAMP()
             AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(vt.eligible_scope_json, '$.schedule.mode')), 'always') = 'always'
             AND uv.issue_case_ref LIKE 'campaign:%'
           GROUP BY uv.user_id, uv.voucher_template_id
           HAVING COUNT(*) > 1
         ) duplicate_campaign_rows
       ) AS duplicate_campaigns,
       (
         SELECT COUNT(*)
         FROM (
           SELECT user_id, tier_code
           FROM user_tier_reward_entitlements
           WHERE status = 'claimable'
           GROUP BY user_id, tier_code
           HAVING COUNT(*) > 1
         ) duplicate_tier_rows
       ) AS duplicate_claimable_tiers,
       (
         SELECT COUNT(*)
         FROM user_vouchers
         WHERE status = 'active'
           AND expires_at <= UTC_TIMESTAMP()
       ) AS stale_active_vouchers`
  );
  const result = rows[0];
  const invalidTemplates = Number(result?.invalid_templates ?? 0);
  const duplicateCampaigns = Number(result?.duplicate_campaigns ?? 0);
  const duplicateTiers = Number(result?.duplicate_claimable_tiers ?? 0);
  const staleActive = Number(result?.stale_active_vouchers ?? 0);
  if (invalidTemplates || duplicateCampaigns || duplicateTiers || staleActive) {
    throw new Error(
      `Voucher integrity failure: ${invalidTemplates} invalid template(s), ` +
      `${duplicateCampaigns} duplicate campaign allocation(s), ` +
      `${duplicateTiers} duplicate claimable tier reward(s), ` +
      `${staleActive} expired voucher(s) still active.`
    );
  }
}

async function requirePaymentServiceNoticeIntegrity(): Promise<void> {
  const [migrationRows] = await mysqlPool.query<Array<RowDataPacket & { migration_count: number }>>(
    `SELECT COUNT(*) AS migration_count
       FROM schema_migrations
      WHERE filename = '103_create_payment_service_notices.sql'`
  );
  if (Number(migrationRows[0]?.migration_count ?? 0) !== 1) {
    throw new Error('Payment-service notice migration 103 has not been applied.');
  }

  const [rows] = await mysqlPool.query<Array<RowDataPacket & {
    invalid_windows: number;
    invalid_cancellations: number;
  }>>(
    `SELECT
       (SELECT COUNT(*)
          FROM payment_service_notices
         WHERE ends_at <= starts_at) AS invalid_windows,
       (SELECT COUNT(*)
          FROM payment_service_notices
         WHERE status = 'cancelled' AND cancelled_at IS NULL) AS invalid_cancellations`
  );
  const invalidWindows = Number(rows[0]?.invalid_windows ?? 0);
  const invalidCancellations = Number(rows[0]?.invalid_cancellations ?? 0);
  if (invalidWindows || invalidCancellations) {
    throw new Error(
      `Payment-service notice integrity failure: ${invalidWindows} invalid window(s), ` +
      `${invalidCancellations} incomplete cancellation(s).`
    );
  }
}

async function requireLatestSchema(): Promise<void> {
  const required = [
    '108_remove_fixed_expiry_from_tier_rewards.sql',
    '109_add_menu_item_archive_retention.sql',
    '110_create_data_retention_reviews.sql',
    '111_add_incoming_order_beep.sql',
    '112_add_schedule_revision_guard.sql',
    '113_add_voucher_usage_instructions.sql',
    '114_add_home_banner_surface_orders.sql',
    '115_expand_option_groups_to_all_menu_items.sql',
    '115_add_social_entertainment_banner_type.sql',
    '116_add_voucher_reminder_settings.sql',
    '117_create_inventory_management.sql'
  ];
  const [rows] = await mysqlPool.query<Array<RowDataPacket & { filename: string }>>(
    `SELECT filename FROM schema_migrations WHERE filename IN (:required)`,
    { required }
  );
  const applied = new Set(rows.map((row) => row.filename));
  const missing = required.filter((filename) => !applied.has(filename));
  if (missing.length > 0) {
    throw new Error(`Latest schema migrations are missing: ${missing.join(', ')}.`);
  }
}

async function requireInventoryIntegrity(): Promise<void> {
  const [rows] = await mysqlPool.query<Array<RowDataPacket & {
    invalid_balances: number;
    reservation_mismatches: number;
    collected_reservations: number;
  }>>(
    `SELECT
       (SELECT COUNT(*) FROM inventory_store_stocks
         WHERE on_hand_quantity < 0 OR reserved_quantity < 0 OR reserved_quantity > on_hand_quantity) AS invalid_balances,
       (SELECT COUNT(*)
          FROM inventory_store_stocks ss
          LEFT JOIN (
            SELECT store_id, inventory_item_id, SUM(quantity) AS allocated
              FROM inventory_order_allocations
             WHERE status = 'reserved'
             GROUP BY store_id, inventory_item_id
          ) a ON a.store_id = ss.store_id AND a.inventory_item_id = ss.inventory_item_id
         WHERE ABS(ss.reserved_quantity - COALESCE(a.allocated, 0)) > 0.001) AS reservation_mismatches,
       (SELECT COUNT(*)
          FROM inventory_order_allocations a
          JOIN orders o ON o.id = a.order_id
         WHERE a.status = 'reserved' AND o.status IN ('collected', 'cancelled', 'payment_failed', 'refunded')) AS collected_reservations`
  );
  const row = rows[0];
  if (Number(row?.invalid_balances ?? 0) || Number(row?.reservation_mismatches ?? 0) || Number(row?.collected_reservations ?? 0)) {
    throw new Error(
      `Inventory integrity failure: ${Number(row?.invalid_balances ?? 0)} invalid balance(s), ` +
      `${Number(row?.reservation_mismatches ?? 0)} reservation mismatch(es), ` +
      `${Number(row?.collected_reservations ?? 0)} terminal order reservation(s).`
    );
  }
}

async function main(): Promise<void> {
  const publicOrigin = env.PUBLIC_API_BASE_URL.replace(/\/v1\/?$/, '');
  const fcmReadinessDetail = env.FCM_DELIVERY_ENABLED
    ? 'FCM delivery is enabled and the service-account secret has the required fields; a physical device test remains required.'
    : 'FCM delivery is disabled. Set FCM_DELIVERY_ENABLED=true and install the service-account secret before testing notifications.';
  const topUpReadinessDetail = env.TOPUP_GATEWAY_ENABLED
    ? `Top-up gateway ${env.TOPUP_GATEWAY_PROVIDER} allowlist is ${env.TOPUP_GATEWAY_ALLOWED_METHODS.join(', ')}. Brand-level activation is verified for every allowed method.`
    : 'Online token top-up is intentionally disabled. Counter/admin token credits remain the only available top-up route.';
  const checks: Check[] = [
    {
      name: 'Latest schema migrations',
      detail: 'All current release migrations through inventory management must be applied.',
      run: requireLatestSchema
    },
    {
      name: 'Inventory integrity',
      detail: 'Outlet stock balances, active order reservations, and terminal order allocations must reconcile.',
      run: requireInventoryIntegrity
    },
    {
      name: 'Production environment',
      detail: 'Production mode, secure OTP configuration, and non-placeholder session secrets are required.',
      run: () => {
        if (env.NODE_ENV !== 'production') {
          throw new Error('NODE_ENV must be production.');
        }
        if (env.OTP_DELIVERY_MODE !== 'email' || env.OTP_DEBUG_EXPOSE_CODE) {
          throw new Error('Production OTP must use email with debug codes disabled.');
        }
        requireValue('ACCESS_TOKEN_SECRET', env.ACCESS_TOKEN_SECRET);
        requireValue('REFRESH_TOKEN_SECRET', env.REFRESH_TOKEN_SECRET);
      }
    },
    {
      name: 'Public HTTPS endpoint',
      detail: `${publicOrigin}/health and ${env.PUBLIC_API_BASE_URL}/health must be reachable through IIS.`,
      run: async () => {
        if (new URL(env.PUBLIC_API_BASE_URL).protocol !== 'https:') {
          throw new Error('PUBLIC_API_BASE_URL must use HTTPS.');
        }
        await requireHealthy(`${publicOrigin}/health`);
        await requireHealthy(`${env.PUBLIC_API_BASE_URL}/health`);
      }
    },
    {
      name: 'Local API and database',
      detail: 'The container health endpoint must confirm database connectivity.',
      run: () => requireHealthy('http://127.0.0.1:8080/v1/health')
    },
    {
      name: 'SMTP transport',
      detail: 'The live OTP mail transport must authenticate successfully; no message is sent.',
      run: async () => {
        requireValue('EMAIL_SMTP_HOST', env.EMAIL_SMTP_HOST);
        requireValue('EMAIL_SMTP_USER', env.EMAIL_SMTP_USER);
        requireValue('EMAIL_SMTP_PASSWORD', env.EMAIL_SMTP_PASSWORD);
        requireValue('EMAIL_FROM_ADDRESS', env.EMAIL_FROM_ADDRESS);
        const transport = nodemailer.createTransport({
          host: env.EMAIL_SMTP_HOST,
          port: env.EMAIL_SMTP_PORT,
          secure: env.EMAIL_SMTP_SECURE,
          auth: { user: env.EMAIL_SMTP_USER, pass: env.EMAIL_SMTP_PASSWORD }
        });
        await transport.verify();
      }
    },
    {
      name: 'Admin browser origin',
      detail: 'At least one HTTPS CORS origin is required for the admin session cookie flow.',
      run: () => {
        if (!env.CORS_ALLOWED_ORIGINS.some((origin) => origin.startsWith('https://'))) {
          throw new Error('CORS_ALLOWED_ORIGINS must include the Admin Web HTTPS origin.');
        }
      }
    },
    {
      name: 'FCM configuration',
      detail: fcmReadinessDetail,
      run: () => {
        if (!env.FCM_DELIVERY_ENABLED) return;
        const serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON) as Record<string, unknown>;
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
          throw new Error('The FCM service-account secret is incomplete.');
        }
      }
    },
    {
      name: 'Top-up gateway policy',
      detail: topUpReadinessDetail,
      run: () => {
        if (!env.TOPUP_GATEWAY_ENABLED) return;
        requireValue('TOPUP_GATEWAY_PROVIDER', env.TOPUP_GATEWAY_PROVIDER);
        requireValue('TOPUP_GATEWAY_BASE_URL', env.TOPUP_GATEWAY_BASE_URL);
        requireValue('TOPUP_GATEWAY_API_KEY', env.TOPUP_GATEWAY_API_KEY);
        requireValue('TOPUP_GATEWAY_BRAND_ID', env.TOPUP_GATEWAY_BRAND_ID);
        if (env.TOPUP_GATEWAY_PROVIDER !== 'chip') {
          throw new Error('Only CHIP is approved for online C2 Token top-up.');
        }
        if (env.TOPUP_GATEWAY_ALLOWED_METHODS.includes('atome')) {
          throw new Error('Atome must not be enabled for token top-up.');
        }
        return requireChipApprovedMethods();
      }
    },
    {
      name: 'Financial reconciliation queue',
      detail: 'No top-up refund or referral reversal may remain in the manual-review queue before release.',
      run: requireNoFinancialReviewBacklog
    },
    {
      name: 'Voucher allocation integrity',
      detail: 'Voucher concurrency migration, active allocations, and claimable tier rewards must be internally consistent.',
      run: requireVoucherIntegrity
    },
    {
      name: 'Payment-service notice integrity',
      detail: 'The scheduled-maintenance notice schema and stored windows must be internally consistent.',
      run: requirePaymentServiceNoticeIntegrity
    }
  ];

  let failed = false;
  for (const check of checks) {
    try {
      await check.run();
      console.log(`PASS  ${check.name} - ${check.detail}`);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : 'Unknown error.';
      console.error(`FAIL  ${check.name} - ${message}`);
    }
  }

  console.log('MANUAL  Verify one OTP email, Admin Web login/refresh/logout, and a real device notification.');
  if (env.PRINT_CONNECTOR_SHARED_SECRET) {
    console.log('MANUAL  A print connector is configured; verify one physical receipt using the connected printer hardware.');
  } else {
    console.log('INFO    Receipt printing is not configured in this deployment; no physical-printer test is required.');
  }
  if (env.TOPUP_GATEWAY_ENABLED) {
    console.log(`MANUAL  Complete one end-to-end ${env.TOPUP_GATEWAY_ALLOWED_METHODS.join('/')} payment and verified callback in CHIP before customer launch.`);
  }
  if (failed) process.exitCode = 1;
}

void main().finally(async () => {
  await mysqlPool.end();
});
