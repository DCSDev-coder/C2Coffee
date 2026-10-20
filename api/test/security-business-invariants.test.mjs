import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('customer OTP limits are identity-backed rather than shared proxy-IP limits', async () => {
  const auth = await source('src/http/routes/auth.ts');
  assert.match(auth, /otp_phone_rate_limit/);
  assert.match(auth, /otp_device_rate_limit/);
  assert.doesNotMatch(auth, /app\.post\('\/v1\/auth\/request-otp',\s*\{\s*config:\s*\{\s*rateLimit/);
  assert.doesNotMatch(auth, /app\.post\('\/v1\/auth\/verify-otp',\s*\{\s*config:\s*\{\s*rateLimit/);
});

test('admin login rejects malformed and incorrect credentials identically', async () => {
  const adminAuth = await source('src/http/routes/admin-auth.ts');
  assert.match(adminAuth, /adminLoginSchema\.safeParse\(request\.body\)/);
  assert.match(
    adminAuth,
    /if \(!parsedPayload\.success\)[\s\S]{0,300}invalid_admin_credentials/,
  );
  assert.doesNotMatch(adminAuth, /adminLoginSchema\.parse\(request\.body\)/);
});

test('manual wallet changes require password confirmation and tenant membership', async () => {
  const loyalty = await source('src/http/routes/admin-loyalty.ts');
  assert.match(loyalty, /confirmation_password/);
  assert.match(loyalty, /requireAdminActionConfirmation/);
  assert.match(loyalty, /JOIN customer_tenant_memberships ctm/);
  assert.match(loyalty, /ctm\.tenant_id = :tenantId/);
});

test('CHIP refunds reverse credited tokens or enter an explicit review state', async () => {
  const settlement = await source('src/services/chip-topup-settlement.ts');
  assert.match(settlement, /['"]topup_refund['"]/);
  assert.match(settlement, /refund_needs_review/);
  assert.match(settlement, /needs_review_insufficient_tokens/);
  const reconciliation = await source('src/scripts/reconcile-chip-topups.ts');
  assert.match(reconciliation, /p\.status = 'paid' AND tt\.status = 'paid'/);
  assert.match(reconciliation, /'refunded', 'partially_refunded'/);
});

test('CHIP is the only automatic top-up receipt sender and all terminal states notify the app', async () => {
  const settlement = await source('src/services/chip-topup-settlement.ts');
  assert.doesNotMatch(settlement, /queueTopUpReceiptEmail/);
  assert.doesNotMatch(settlement, /deliverQueuedTopUpReceiptEmail/);
  assert.match(settlement, /token_topup_paid/);
  assert.match(settlement, /token_topup_\$\{terminalFailure\}/);
  assert.match(settlement, /terminalFailure === 'cancelled'/);
  assert.match(settlement, /token_topup_refunded/);
  assert.match(settlement, /token_topup_review/);
  assert.match(settlement, /deliverTopUpStatusPush/);
});

test('payment maintenance notices are tenant scoped, operational, dismissible, and time bounded', async () => {
  const migration = await source('src/db/migrations/103_create_payment_service_notices.sql');
  assert.match(migration, /payment_service_notices/);
  assert.match(migration, /payment_service_notice_dismissals/);
  assert.match(migration, /ends_at > starts_at/);

  const adminMarketing = await source('src/http/routes/admin-marketing.ts');
  assert.match(adminMarketing, /payment-service-notices/);
  assert.match(adminMarketing, /respectMarketingPreference: false/);
  assert.match(adminMarketing, /tenant_id = :tenantId/);

  const customerData = await source('src/http/routes/customer-data.ts');
  assert.match(customerData, /JOIN customer_tenant_memberships ctm/);
  assert.match(customerData, /psn\.ends_at > UTC_TIMESTAMP\(\)/);
  assert.match(customerData, /dismiss-popup/);
});

test('approved order refunds reverse loyalty and referral qualification', async () => {
  const refunds = await source('src/http/routes/admin-orders.ts');
  assert.match(refunds, /reverseOrderLoyalty/);
  assert.match(refunds, /reverseReferralForRefundedOrder/);
  const referrals = await source('src/services/referrals.ts');
  assert.match(referrals, /referral_reward_reversals/);
  assert.match(referrals, /referral_reversal/);
  const loyalty = await source('src/services/loyalty.ts');
  assert.match(loyalty, /loyalty_order_reward_issues/);
  assert.match(loyalty, /Tier reward voucher was already redeemed/);
});

test('direct printer jobs can be claimed only by the activated outlet device', async () => {
  const guard = await source('src/counter/guard.ts');
  assert.match(guard, /tenant\.code AS tenantCode/);

  const counter = await source('src/http/routes/counter.ts');
  assert.match(counter, /\/v1\/counter\/direct-printer\/configure/);
  assert.match(counter, /\/v1\/counter\/direct-printer\/remove/);
  assert.match(counter, /\/v1\/counter\/direct-print-jobs\/claim/);
  assert.match(counter, /\/v1\/counter\/direct-print-jobs\/acknowledge/);
  assert.match(counter, /preHandler: authenticateCounterDevice/);
  assert.match(counter, /store_id = :storeId/);
  assert.match(counter, /tenant_code = :tenantCode/);
  assert.match(counter, /direct_print_device_key = :workstationKey/);
  assert.match(counter, /printerReference = `counter-device-\$\{request\.counterAuth\.deviceId\}`/);
  assert.match(counter, /o\.store_id = :storeId/);
});

test('side-work completion is due-time, attendance, tenant, and PIN guarded', async () => {
  const baristaStaff = await source('src/http/routes/barista-staff.ts');
  assert.match(baristaStaff, /\/v1\/barista\/side-work\/complete/);
  assert.match(baristaStaff, /verifyPassword\(payload\.pin/);
  assert.match(baristaStaff, /clocked_out_at IS NULL/);
  assert.match(baristaStaff, /tenant_id = :tenantId/);
  assert.match(baristaStaff, /TIMESTAMP\(scheduled_date, scheduled_time\) <= CONVERT_TZ/);
  assert.match(baristaStaff, /AS is_due/);
  assert.match(baristaStaff, /INSERT IGNORE INTO barista_side_work_completions/);
});

test('tier rewards require an explicit claim before checkout use', async () => {
  const rewards = await source('src/http/routes/customer-data.ts');
  assert.match(rewards, /user_tier_reward_entitlements/);
  assert.match(rewards, /tier-entitlements\/:entitlementId\/claim/);
  assert.match(rewards, /status = 'claimed', user_voucher_id = :userVoucherId/);
  assert.match(rewards, /issueCaseRef: `tier_claim:\$\{entitlement\.id\}`/);
  assert.match(rewards, /current_tier\.tier_code = utre\.tier_code/);
  assert.match(rewards, /LIMIT 1/);

  const loyalty = await source('src/services/loyalty.ts');
  assert.match(loyalty, /'claimable'/);
  assert.match(loyalty, /ready to claim in My Rewards/);
  assert.match(loyalty, /resulting\/current tier/);
  assert.match(loyalty, /Superseded by the customer current tier/);
  assert.doesNotMatch(
    loyalty,
    /INSERT IGNORE INTO user_vouchers[\s\S]{0,800}tier_unlock:/,
  );
});

test('birthday cleanup recognizes templates configured by tier management', async () => {
  const rewards = await source('src/http/routes/customer-data.ts');
  assert.match(rewards, /\$\.birthdayVoucherTemplateIds/);
  assert.match(rewards, /JSON_ARRAY\(uv\.voucher_template_id\)/);

  const migration = await source('src/db/migrations/098_add_claimable_tier_rewards.sql');
  assert.match(migration, /Duplicate birthday reward retired/);
  assert.match(migration, /\$\.birthdayVoucherTemplateIds/);
});

test('reward visibility hardening retires legacy duplicates and malformed schedules', async () => {
  const rewards = await source('src/http/routes/customer-data.ts');
  assert.match(rewards, /case 'weekly':/);
  assert.match(rewards, /weekly:\$\{currentDate\.dateKey\}/);
  assert.match(rewards, /vt\.voucher_type <> 'tier_reward'/);
  assert.match(rewards, /existingTemplateIds\.has/);
  assert.match(rewards, /visibleVoucherRows/);

  const migration = await source('src/db/migrations/099_harden_current_tier_and_voucher_visibility.sql');
  assert.match(migration, /Duplicate campaign voucher retired/);
  assert.match(migration, /Legacy birthday reward retired/);
  assert.match(migration, /uq_tier_reward_one_claimable_per_tier/);
  assert.match(migration, /Replaced by day-scoped recurring voucher policy/);

  const loyaltyTiers = await source('src/services/loyalty-tiers.ts');
  assert.match(loyaltyTiers, /filter\(\(value\) => Number\.isInteger\(value\) && value > 0\)\)\]\.slice\(0, 1\)/);
});

test('voucher allocation is serialized and manual limits use the resolved customer', async () => {
  const rewards = await source('src/http/routes/customer-data.ts');
  assert.match(rewards, /issueAutoVisibleVoucherAtomically/);
  assert.match(rewards, /Lock the template as the allocation mutex/);
  assert.match(rewards, /FROM voucher_templates vt[\s\S]{0,500}FOR UPDATE/);
  assert.match(rewards, /recurring: recurringRef !== null/);

  const adminVouchers = await source('src/http/routes/admin-vouchers.ts');
  assert.match(adminVouchers, /userId: customer\.id/);
  assert.match(adminVouchers, /voucher_quantity_exhausted/);
  assert.match(adminVouchers, /voucher_limit_per_user_reached/);
  assert.match(adminVouchers, /voucherType === 'tier_reward' \? 1/);

  const tierLimitMigration = await source('src/db/migrations/101_enforce_single_use_tier_rewards.sql');
  assert.match(tierLimitMigration, /WHERE voucher_type = 'tier_reward'/);
  assert.match(tierLimitMigration, /limit_per_user = 1/);

  const referrals = await source('src/services/referrals.ts');
  assert.match(referrals, /SELECT name, total_quantity, limit_per_user/);
  assert.match(referrals, /FOR UPDATE/);
});

test('voucher administration is tenant scoped and retry safe', async () => {
  const adminVouchers = await source('src/http/routes/admin-vouchers.ts');
  assert.match(
    adminVouchers,
    /JOIN voucher_templates vt ON vt\.id = uv\.voucher_template_id[\s\S]{0,180}vt\.tenant_id = :tenantId/,
  );
  assert.match(
    adminVouchers,
    /WHERE vt\.code = :code[\s\S]{0,100}AND vt\.tenant_id = :tenantId[\s\S]{0,180}ORDER BY uv\.issued_at DESC/,
  );
  assert.match(adminVouchers, /idempotentReplay: true/);
  assert.match(adminVouchers, /voucher_has_issuances/);

  const auth = await source('src/http/routes/auth.ts');
  assert.match(auth, /tenant\.code = :tenantCode/);
  assert.match(auth, /SELECT vt\.id, vt\.expires_in_days, vt\.total_quantity/);
});

test('voucher configuration rejects unsafe values and unsafe free-item defaults', async () => {
  const adminVouchers = await source('src/http/routes/admin-vouchers.ts');
  assert.match(adminVouchers, /const voucherBenefitTypeSchema = z\.enum/);
  assert.match(adminVouchers, /Percentage discount cannot exceed 100%/);
  assert.match(adminVouchers, /Choose at least one day for a weekly voucher/);
  assert.match(adminVouchers, /Per-customer limit cannot exceed the total voucher quantity/);
  assert.match(adminVouchers, /Automatic vouchers support one voucher per customer per availability period/);
  assert.match(adminVouchers, /applySafeBenefitScopeDefaults/);
  assert.match(adminVouchers, /productKinds: \['drink'\]/);
  assert.match(adminVouchers, /productKinds: \['food'\]/);

  const migration = await source('src/db/migrations/100_index_voucher_allocation_checks.sql');
  assert.match(migration, /idx_user_vouchers_allocation/);

  const readiness = await source('src/scripts/production-readiness.ts');
  assert.match(readiness, /Voucher allocation integrity/);
  assert.match(readiness, /duplicate_claimable_tiers/);
  assert.match(readiness, /stale_active_vouchers/);
});

test('verified legacy refund reconciliation is guarded and does not debit the wallet twice', async () => {
  const migration = await source('src/db/migrations/102_reconcile_verified_legacy_refunds.sql');
  assert.match(migration, /verified_legacy_topup_refund_users/);
  assert.match(migration, /SUM\(tt\.token_amount\) = 5/);
  assert.match(migration, /adjustment\.source_type = 'admin_adjustment'/);
  assert.match(migration, /adjustment\.balance_after = 0/);
  assert.match(migration, /p\.status = 'refunded'/);
  assert.match(migration, /manual_refund_reconciled/);
  assert.match(migration, /SET tt\.status = 'refunded'/);
  assert.doesNotMatch(migration, /SET balance_available/);
  assert.doesNotMatch(migration, /'topup_refund'/);
});
