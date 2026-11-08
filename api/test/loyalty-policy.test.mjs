import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('one completed order earns one cup only when it contains a qualifying drink', async () => {
  const loyalty = await source('src/services/loyalty.ts');
  const maintenance = await source('src/services/loyalty-tier-maintenance.ts');
  const uniqueness = await source('src/db/migrations/133_enforce_one_loyalty_cup_per_order.sql');

  assert.match(loyalty, /MIN\(menu_item_id\) AS menu_item_id/);
  assert.match(loyalty, /is_qualifying_cup = 1/);
  assert.match(loyalty, /INSERT IGNORE INTO loyalty_cup_events/);
  assert.match(loyalty, /:menuItemId,\s*1,/);
  assert.match(maintenance, /COUNT\(DISTINCT order_id\)/);
  assert.match(uniqueness, /UNIQUE KEY uq_loyalty_cup_events_order \(order_id\)/);
});

test('tiers upgrade immediately but inactivity downgrades only at annual review', async () => {
  const maintenance = await source('src/services/loyalty-tier-maintenance.ts');
  const schema = await source('src/db/migrations/134_create_annual_loyalty_tier_status.sql');
  const backfill = await source('src/db/migrations/135_backfill_annual_loyalty_tier_status.sql');

  assert.match(maintenance, /LOYALTY_QUALIFICATION_DAYS = 365/);
  assert.match(maintenance, /if \(candidateIsHigher\)/);
  assert.match(maintenance, /review_due_at <= UTC_TIMESTAMP\(\)/);
  assert.match(maintenance, /annual_tier_protected/);
  assert.match(maintenance, /annual_tier_downgrade/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS user_loyalty_tier_status/);
  assert.match(schema, /review_due_at DATETIME NOT NULL/);
  assert.match(backfill, /DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 1 YEAR\)/);
});

test('annual loyalty review runs on bootstrap and in a daily server sweep', async () => {
  const auth = await source('src/http/routes/auth.ts');
  const catalog = await source('src/http/routes/catalog.ts');
  const server = await source('src/server.ts');

  assert.match(auth, /const tierRefresh = await refreshUserLoyaltyTier\(userId, connection\)/);
  assert.match(auth, /tier_review_due_at: tierRefresh\.reviewDueAt\.toISOString\(\)/);
  assert.match(catalog, /qualifying_orders_last_12_months/);
  assert.match(catalog, /tier_review_due_at/);
  assert.match(server, /runScheduledLoyaltyTierMaintenance/);
  assert.match(server, /24 \* 60 \* 60 \* 1000/);
});

test('refund reversals can correct a tier before the annual review', async () => {
  const loyalty = await source('src/services/loyalty.ts');
  assert.match(
    loyalty,
    /refreshUserLoyaltyTier\(userId, connection, \{ forceDowngrade: true \}\)/,
  );
});

test('employee allowance is monthly, auditable, refund-aware, and never earns a tier cup', async () => {
  const allowance = await source('src/services/employee-token-allowance.ts');
  const checkout = await source('src/http/routes/checkout.ts');
  const loyalty = await source('src/services/loyalty.ts');
  const schema = await source('src/db/migrations/136_create_employee_monthly_token_allowances.sql');
  const capSchema = await source('src/db/migrations/137_cap_employee_allowance_and_add_monthly_audit.sql');
  const policySchema = await source('src/db/migrations/140_create_subsidy_policy_history.sql');
  const roleChangeSchema = await source('src/db/migrations/141_add_subsidy_role_change_ledger_sources.sql');
  const admin = await source('src/http/routes/admin-loyalty.ts');
  const adminCustomers = await source('src/http/routes/admin-customers.ts');
  const customerData = await source('src/http/routes/customer-data.ts');
  const appMaintenance = await source('src/services/app-maintenance.ts');

  assert.match(allowance, /MONTHLY_EMPLOYEE_ALLOWANCE = 200/);
  assert.match(allowance, /topUpAmount = policy\.monthlyAmount - carriedForward/);
  assert.match(allowance, /role === 'boss'/);
  assert.match(allowance, /allowanceMode: 'unlimited'/);
  assert.match(allowance, /expiredAmount = Math\.max\(0, priorRemaining - carriedForward\)/);
  assert.match(allowance, /employee_allowance_issue/);
  assert.match(allowance, /employee_allowance_spend/);
  assert.match(allowance, /restoreEmployeeAllowanceForRefund/);
  assert.match(allowance, /revokeCurrentAllowanceForRoleChange/);
  assert.match(allowance, /restoreCurrentAllowanceForRoleChange/);
  assert.match(allowance, /await restoreCurrentAllowanceForRoleChange\([\s\S]{0,180}membershipRows\[0\]\.subsidy_role/);
  assert.match(allowance, /Unused company subsidy revoked when role changed to/);
  assert.match(allowance, /Unused company subsidy restored when role changed to/);
  assert.match(allowance, /row\.allowance_status === 'revoked'/);
  assert.match(allowance, /employee_allowance_tokens_used - o\.employee_allowance_tokens_refunded/);
  assert.match(checkout, /employee_allowance_tokens_used/);
  assert.match(checkout, /Math\.min\(tokenAmountCharged, drinkTokenAmount\)/);
  assert.match(checkout, /employee_allowance_remaining/);
  assert.match(loyalty, /employee_allowance_tokens_used[\s\S]*> 0\) return/);
  assert.match(schema, /'gift_card_purchase',[\s\S]*'gift_card_redemption'/);
  assert.match(schema, /UNIQUE KEY uq_employee_allowance_period/);
  assert.match(capSchema, /carried_forward_amount/);
  assert.match(capSchema, /employee_allowance_tokens_refunded/);
  assert.match(policySchema, /subsidy_role ENUM\('none', 'employee', 'intern', 'boss'\)/);
  assert.match(policySchema, /effective_period_start/);
  assert.match(policySchema, /INSERT IGNORE INTO tenant_subsidy_policies/);
  assert.match(policySchema, /employee_allowance_was_unlimited/);
  assert.match(roleChangeSchema, /employee_allowance_role_revoke/);
  assert.match(roleChangeSchema, /employee_allowance_role_restore/);
  assert.match(checkout, /employee_allowance_was_unlimited/);
  assert.match(admin, /employeePurchases/);
  assert.match(admin, /loyalty\/employee-allowances/);
  assert.match(admin, /loyalty\/subsidy-policies/);
  assert.match(admin, /effective_period_start/);
  assert.match(admin, /tierCupEarned: false/);
  assert.match(admin, /source_type NOT IN \('employee_allowance_role_revoke', 'employee_allowance_role_restore'\)/);
  assert.match(adminCustomers, /ensureEmployeeAllowance/);
  assert.match(adminCustomers, /resolveSubsidyRole\(payload\)/);
  assert.match(adminCustomers, /resolveSubsidyRole\(customer\)/);
  assert.match(adminCustomers, /revokeCurrentAllowanceForRoleChange/);
  assert.match(adminCustomers, /SELECT is_employee, subsidy_role[\s\S]{0,180}FOR UPDATE[\s\S]{0,500}revokeCurrentAllowanceForRoleChange/);
  assert.match(adminCustomers, /customer_subsidy_role_changed/);
  assert.match(customerData, /restoreEmployeeAllowanceForRefund\(connection, Number\(order\.id\)\)[\s\S]{0,500}SELECT balance_available FROM token_accounts/);
  assert.match(appMaintenance, /subsidyRole === 'intern'/);
  assert.match(appMaintenance, /subsidyRole === 'boss'/);
  assert.match(appMaintenance, /allowEmployeeBypass && hasCompanyBypass/);
});

test('checkout uses configured drink kinds and resolves subsidy for the selected outlet', async () => {
  const checkout = await source('src/http/routes/checkout.ts');
  const customerData = await source('src/http/routes/customer-data.ts');

  assert.match(
    checkout,
    /COALESCE\(NULLIF\(LOWER\(c\.product_kind_code\), ''\), CASE[\s\S]*END\) AS category_product_kind_code/,
  );
  assert.match(customerData, /subsidyStoreQuerySchema\.parse\(request\.query\)/);
  assert.match(customerData, /resolveEmployeeSubsidyTenant\([\s\S]*query\.store_id/);
  assert.match(customerData, /ORDER BY tenant_id[\s\S]*LIMIT 2/);
  assert.match(customerData, /rows\.length === 1/);
});
