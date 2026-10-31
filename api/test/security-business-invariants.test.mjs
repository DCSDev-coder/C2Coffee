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

test('counter checkout settles fully discounted vouchers without trusting a manual paid action', async () => {
  const counterPayments = await source('src/http/routes/counter-payments.ts');
  assert.match(counterPayments, /isComplimentary = totalRm === 0 && payload\.applied_voucher_id != null/);
  assert.match(counterPayments, /provider: isComplimentary \? 'complimentary' : 'chip'/);
  assert.match(counterPayments, /UPDATE user_vouchers SET status = 'redeemed'/);
  assert.match(counterPayments, /await queueDefaultPrintJob\(connection, request\.counterAuth\.storeId, orderId\)/);
  assert.match(counterPayments, /requires_payment: false/);
  assert.match(counterPayments, /if \(totalRm > 0 && !payload\.payment_method\)/);

  const settlement = await source('src/services/chip-counter-settlement.ts');
  assert.match(settlement, /status === 'paid' && amountMatches/);
  assert.match(settlement, /UPDATE orders SET status = 'paid'/);
});

test('counter receipts retain server-verified drink option snapshots', async () => {
  const checkout = await source('src/http/routes/checkout.ts');
  assert.match(checkout, /LegacyCustomizationRow/);
  assert.match(checkout, /addLegacy\('Choice of Milk'/);
  assert.match(checkout, /'oat milk': \{ name: 'Oat Milk', price: 3, tokens: 3 \}/);
  assert.doesNotMatch(checkout, /if \(rows\.length === 0\) return modifiers/);

  const counterPayments = await source('src/http/routes/counter-payments.ts');
  assert.match(counterPayments, /modifier_group_name_snapshot/);
  assert.match(counterPayments, /groupName: modifier\.group_name/);

  const printing = await source('src/http/routes/operational-integrations.ts');
  assert.match(printing, /details\.push\(`\$\{modifier\.modifier_group_name_snapshot\}: \$\{modifier\.modifier_option_name_snapshot\}`\)/);
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

test('top-up history is informational while qualifying vouchers are issued by settlement', async () => {
  const auth = await source('src/http/routes/auth.ts');
  assert.match(auth, /FROM token_topups/);
  assert.match(auth, /status = 'paid'/);
  assert.match(auth, /has_completed_topup/);

  const catalog = await source('src/http/routes/catalog.ts');
  assert.match(catalog, /can_place_order: true/);

  const checkout = await source('src/http/routes/checkout.ts');
  assert.doesNotMatch(checkout, /!bootstrap\.has_completed_topup/);
  assert.doesNotMatch(checkout, /['"]top_up_required['"]/);

  const vouchers = await source('src/http/routes/admin-vouchers.ts');
  assert.match(vouchers, /topup_reward/);
  assert.match(vouchers, /single_paid_topup/);
  assert.match(vouchers, /paymentMode/);
  assert.match(vouchers, /payment_modes/);

  const checkoutPaymentRules = checkout.match(/voucher_payment_mode_not_supported/);
  assert.ok(checkoutPaymentRules, 'voucher payment mode must be enforced at checkout');

  const settlement = await source('src/services/chip-topup-settlement.ts');
  assert.match(settlement, /issueTopUpRewardVouchers/);
  assert.match(settlement, /input\.tokenAmount < minimum/);
  assert.match(settlement, /const issueCaseRef = `topup_reward:\$\{template\.id\}:topup:\$\{input\.topupId\}`/);
  assert.match(settlement, /revokeTopUpRewardVouchers/);
  assert.match(settlement, /needs_review_redeemed_topup_reward/);

  const customerData = await source('src/http/routes/customer-data.ts');
  assert.match(customerData, /getVoucherTopUpMinimum\(scope\) !== null/);
  assert.match(customerData, /eligibility_status: topUpEligibility\.eligible/);
  assert.match(customerData, /locked_topup_rewards: lockedTopUpRewards/);
  assert.match(customerData, /id: -Number\(row\.id\)/);
  assert.match(checkout, /voucher_topup_not_qualified/);

  const counterPayments = await source('src/http/routes/counter-payments.ts');
  assert.match(counterPayments, /voucher_topup_not_qualified/);
});

test('customer direct checkout uses RM pricing and trusted CHIP settlement', async () => {
  const checkout = await source('src/http/routes/checkout.ts');
  const topups = await source('src/http/routes/topups.ts');
  const settlement = await source('src/services/chip-counter-settlement.ts');
  assert.match(checkout, /payment_mode: z\.enum\(\['token', 'direct'\]\)/);
  assert.match(checkout, /payment_method: z\.enum/);
  assert.match(checkout, /createChipPurchase/);
  assert.match(checkout, /directPaymentRequired/);
  assert.match(checkout, /'pending_payment'/);
  assert.match(checkout, /finalTotalRm/);
  assert.match(topups, /settleChipMobilePurchase/);
  assert.match(settlement, /orderChannel: 'counter' \| 'mobile'/);
  assert.match(settlement, /o\.order_channel = :orderChannel/);
});

test('poster surface ordering is role guarded, tenant scoped, and uses fixed columns', async () => {
  const marketing = await source('src/http/routes/admin-marketing.ts');
  assert.match(marketing, /banners\/reorder-surface/);
  assert.match(marketing, /requireMarketingAccess\(request\)/);
  assert.match(marketing, /tenant_id = :tenantId AND \$\{filter\}/);
  assert.match(marketing, /home: "home_sort_order"/);
  assert.match(marketing, /floating: "floating_sort_order"/);
  assert.match(marketing, /partnership: "partnership_sort_order"/);
  assert.match(marketing, /assertVoucherTargetExists/);
  assert.match(marketing, /FROM voucher_templates[\s\S]{0,200}tenant_id = :tenantId/);
});

test('option groups can target all menu item kinds without weakening tenant checks', async () => {
  const optionLibrary = await source('src/http/routes/admin-option-library.ts');
  const catalog = await source('src/http/routes/catalog.ts');
  const checkout = await source('src/http/routes/checkout.ts');
  const migration = await source('src/db/migrations/115_expand_option_groups_to_all_menu_items.sql');
  assert.match(optionLibrary, /all_drinks', 'all_items', 'selected_items/);
  assert.match(optionLibrary, /g\.applies_to IN \('all_drinks', 'all_items'\)/);
  assert.match(catalog, /row\.applies_to === "all_items"/);
  assert.match(checkout, /g\.applies_to IN \('all_drinks', 'all_items'\)/);
  assert.match(migration, /ENUM\('all_drinks', 'all_items', 'selected_items'\)/);
  assert.match(optionLibrary, /stores s ON s\.id = availability\.store_id AND s\.tenant_id = :tenantId/);
});

test('voucher expiry maintenance closes stale active rows without deleting history', async () => {
  const maintenance = await source('src/services/voucher-expiry-maintenance.ts');
  const server = await source('src/server.ts');
  const readiness = await source('src/scripts/production-readiness.ts');
  assert.match(maintenance, /UPDATE user_vouchers/);
  assert.match(maintenance, /WHEN revoked_at IS NOT NULL THEN 'revoked'/);
  assert.match(maintenance, /WHEN redeemed_at IS NOT NULL THEN 'redeemed'/);
  assert.match(maintenance, /ELSE 'expired'/);
  assert.match(maintenance, /status = 'active'/);
  assert.match(server, /await expireStaleUserVouchers\(\)/);
  assert.match(readiness, /await expireStaleUserVouchers\(\)/);
  assert.doesNotMatch(maintenance, /DELETE FROM user_vouchers/);
});

test('voucher notifications are admin controlled and skip used or revoked vouchers', async () => {
  const reminders = await source('src/services/voucher-expiry-reminders.ts');
  const adminVouchers = await source('src/http/routes/admin-vouchers.ts');
  const migration = await source('src/db/migrations/116_add_voucher_reminder_settings.sql');
  const server = await source('src/server.ts');

  assert.match(migration, /start_reminder_enabled/);
  assert.match(migration, /end_reminder_enabled/);
  assert.match(adminVouchers, /\/v1\/admin\/vouchers\/:id\/reminders/);
  assert.match(adminVouchers, /WHERE code = :code AND tenant_id = :tenantId/);
  assert.match(reminders, /vt\.start_reminder_enabled = 1 OR vt\.end_reminder_enabled = 1/);
  assert.match(reminders, /uv\.redeemed_at IS NULL/);
  assert.match(reminders, /uv\.revoked_at IS NULL/);
  assert.doesNotMatch(reminders, /voucher_expiring/);
  assert.doesNotMatch(server, /runVoucherExpiryReminderSweep/);
});

test('production callback origins and mobile payment redirects require HTTPS', async () => {
  const envConfig = await source('src/config/env.ts');
  const mobileCheckout = await readFile(
    new URL('../../mobile_app/lib/screens/order_confirmation_page.dart', import.meta.url),
    'utf8'
  );
  assert.match(envConfig, /Production requires PUBLIC_API_BASE_URL to use HTTPS/);
  assert.match(mobileCheckout, /isTrustedPaymentCheckoutUrl\(checkoutUrl\)/);
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

test('referral sharing exposes both mobile store links', async () => {
  const customerData = await source('src/http/routes/customer-data.ts');
  assert.match(customerData, /android_download_url/);
  assert.match(
    customerData,
    /play\.google\.com\/store\/apps\/details\?id=com\.c2coffeeandcandle\.customer/,
  );
  assert.match(customerData, /ios_download_url/);
  assert.match(customerData, /apps\.apple\.com\/my\/app\/c2-coffee\/id6809305739/);
});

test('expanded inventory operations are tenant scoped and preserve non-negative stock', async () => {
  const operations = await source('src/http/routes/admin-inventory-operations.ts');
  assert.match(operations, /requireAnyAdminRole\(request, \['super_admin', 'operations_admin'\]\)/);
  assert.match(operations, /tenant_id = :tenantId/);
  assert.match(operations, /inventory_transfer_insufficient_stock/);
  assert.match(operations, /inventory_stocktake_below_reserved/);
  assert.match(operations, /inventory_wastage_insufficient_stock/);
  assert.match(operations, /inventory_po_over_received/);
  assert.match(operations, /inventory_po_supplier_item_missing/);
  assert.match(operations, /inventory_receipt_rejection_reason_required/);
  assert.match(operations, /inventory_purchase_receipts/);
  assert.match(operations, /canViewCosts/);
  assert.match(operations, /status IN \('submitted', 'partially_received'\)/);

  const inventory = await source('src/http/routes/admin-inventory.ts');
  assert.match(inventory, /inventory_negative_stock_blocked/);

  const migration = await source('src/db/migrations/119_expand_inventory_operations.sql');
  assert.match(migration, /inventory_purchase_orders/);
  assert.match(migration, /inventory_stock_transfers/);
  assert.match(migration, /inventory_stocktakes/);
  assert.match(migration, /inventory_supplier_cost_history/);

  const procurementMigration = await source('src/db/migrations/120_complete_inventory_procurement.sql');
  assert.match(procurementMigration, /inventory_purchase_receipts/);
  assert.match(procurementMigration, /inventory_purchase_receipt_lines/);
  assert.match(procurementMigration, /accepted_purchase_units \+ rejected_purchase_units = delivered_purchase_units/);
  assert.match(procurementMigration, /counted_purchase_units/);
  assert.match(procurementMigration, /barcode/);
});

test('manual inventory receipts retain the supplying vendor', async () => {
  const route = await source('src/http/routes/admin-inventory.ts');
  const migration = await source('src/db/migrations/121_link_inventory_movements_to_supplier.sql');
  assert.match(route, /inventory_supplier_required/);
  assert.match(route, /inventory_supplier_item_missing/);
  assert.match(route, /supplier_id/);
  assert.match(migration, /inventory_movements/);
  assert.match(migration, /fk_inventory_movement_supplier/);
});

test('menu option inventory uses stable verified option ids and order snapshots', async () => {
  const checkout = await source('src/http/routes/checkout.ts');
  assert.match(checkout, /option_group_option_id: option\.option_id/);
  assert.match(checkout, /optionGroupOptionId: modifier\.option_group_option_id \?\? null/);

  const counter = await source('src/http/routes/counter-payments.ts');
  assert.match(counter, /optionGroupOptionId: modifier\.option_group_option_id \?\? null/);

  const inventory = await source('src/services/inventory.ts');
  assert.match(inventory, /JOIN inventory_option_recipes r/);
  assert.match(inventory, /r\.option_group_option_id = oim\.option_group_option_id/);
  assert.match(inventory, /GREATEST\(SUM\(requirements\.required_quantity\), 0\)/);
});
