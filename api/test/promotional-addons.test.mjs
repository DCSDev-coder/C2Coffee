import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  choosePromotionalReward,
  isCampaignQualified,
} from '../dist/services/promotional-addons.js';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('promotion migration keeps gifts out of the normal catalogue and snapshots assignments', async () => {
  const migration = await source('src/db/migrations/157_create_promotional_addons.sql');
  assert.match(migration, /sale_visibility ENUM\('normal', 'promotion_only', 'hidden'\)/);
  assert.match(migration, /line_type ENUM\('sale', 'promotional_addon'\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS promotional_addon_campaigns/);
  assert.match(migration, /assignment_mode ENUM\('customer_choice', 'server_random'\)/);
  assert.match(migration, /legacy_fallback ENUM\('random', 'no_reward'\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS order_promotional_addons/);
  assert.match(migration, /campaign_name_snapshot/);
  assert.match(migration, /reward_name_snapshot/);
  assert.match(migration, /fulfilment_status ENUM/);
  assert.match(migration, /'promotional_return', 'promotional_retained'/);
  assert.match(migration, /UNIQUE KEY uq_order_promotional_addons_order/);
});

test('qualification requires the configured number of matching sale units', () => {
  const campaign = {
    minimum_quantity: 2,
    qualifying_product_kind_codes: ['drink'],
    qualifying_category_ids: [],
    qualifying_menu_item_ids: [],
  };
  assert.equal(isCampaignQualified(campaign, [
    { menu_item_id: 10, category_id: 4, product_kind_code: 'drink', quantity: 1, line_type: 'sale' },
    { menu_item_id: 11, category_id: 4, product_kind_code: 'drink', quantity: 1, line_type: 'sale' },
  ]), true);
  assert.equal(isCampaignQualified(campaign, [
    { menu_item_id: 10, category_id: 4, product_kind_code: 'drink', quantity: 1, line_type: 'sale' },
    { menu_item_id: 99, category_id: 8, product_kind_code: 'merchandise', quantity: 5, line_type: 'promotional_addon' },
  ]), false);
});

test('customer-choice rewards require an eligible explicit selection', () => {
  const rewards = [
    { menu_item_id: 20, available_quantity: 3 },
    { menu_item_id: 21, available_quantity: 0 },
  ];
  assert.equal(choosePromotionalReward({ assignmentMode: 'customer_choice', selectedMenuItemId: 20, rewards }), 20);
  assert.throws(
    () => choosePromotionalReward({ assignmentMode: 'customer_choice', selectedMenuItemId: 21, rewards }),
    (error) => error?.code === 'promotional_reward_unavailable',
  );
  assert.throws(
    () => choosePromotionalReward({ assignmentMode: 'customer_choice', selectedMenuItemId: null, rewards }),
    (error) => error?.code === 'promotional_reward_selection_required',
  );
});

test('server-random rewards use an injectable secure index and never select sold-out stock', () => {
  const rewards = [
    { menu_item_id: 30, available_quantity: 0 },
    { menu_item_id: 31, available_quantity: 4 },
    { menu_item_id: 32, available_quantity: 2 },
  ];
  assert.equal(choosePromotionalReward({
    assignmentMode: 'server_random',
    selectedMenuItemId: null,
    rewards,
    randomIndex: (upperExclusive) => {
      assert.equal(upperExclusive, 2);
      return 1;
    },
  }), 32);
});

test('reward stock is tenant scoped and paid rewards are never silently assigned to legacy clients', async () => {
  const service = await source('src/services/promotional-addons.ts');
  const admin = await source('src/http/routes/admin-promotional-addons.ts');
  assert.match(service, /recipe\.tenant_id = :tenantId/);
  assert.match(service, /campaign\.price_mode !== 'free'/);
  assert.match(service, /While stocks last/);
  assert.match(admin, /Paid add-ons require an updated app/);
});

test('checkout exposes capabilities and persists the selected reward before inventory reservation', async () => {
  const checkout = await source('src/http/routes/checkout.ts');
  assert.match(checkout, /client_capabilities/);
  assert.match(checkout, /promotion_addons_v1/);
  assert.match(checkout, /selected_promotional_reward_menu_item_id/);
  assert.match(checkout, /resolvePromotionalAddonForCheckout/);
  assert.match(checkout, /insertPromotionalAddonOrderLine/);
  assert.ok(
    checkout.lastIndexOf('insertPromotionalAddonOrderLine') < checkout.indexOf('reserveInventoryForOrder(connection, orderId)'),
    'the persisted gift line must exist before recipe inventory is reserved',
  );
});

test('catalog, reports, favourites, and reorder explicitly exclude promotional gift lines', async () => {
  const catalog = await source('src/http/routes/catalog.ts');
  const dashboard = await source('src/http/routes/admin-dashboard.ts');
  const customerData = await source('src/http/routes/customer-data.ts');
  const homeFeatured = await source('src/http/routes/home-featured.ts');
  assert.match(catalog, /sale_visibility = 'normal'/);
  assert.match(dashboard, /line_type = 'sale'/);
  assert.match(customerData, /line_type/);
  assert.match(homeFeatured, /sale_visibility = 'normal'/);
});

test('dashboard keeps the sale-line filter on the item query', async () => {
  const dashboard = await source('src/http/routes/admin-dashboard.ts');
  const timezoneQuery = dashboard.slice(
    dashboard.indexOf('SELECT MIN(s.timezone)'),
    dashboard.indexOf('const timeZone ='),
  );
  assert.doesNotMatch(timezoneQuery, /oi\.line_type/);
  assert.match(dashboard, /WHERE t\.code = :tenantCode[\s\S]*AND oi\.line_type = 'sale'/);
});

test('promotion routes are registered for customer quoting and tenant-scoped administration', async () => {
  const app = await source('src/app.ts');
  const customer = await source('src/http/routes/promotional-addons.ts');
  const admin = await source('src/http/routes/admin-promotional-addons.ts');
  assert.match(app, /registerPromotionalAddonRoutes/);
  assert.match(app, /registerAdminPromotionalAddonRoutes/);
  assert.match(customer, /\/v1\/promotional-addons\/quote/);
  assert.match(admin, /\/v1\/admin\/promotional-addons/);
  assert.match(admin, /tenant_id = :tenantId/);
  assert.match(admin, /admin_audit_logs/);
});

test('cancelled orders cancel only pending promotional assignments and record the event once', async () => {
  const service = await source('src/services/promotional-addons.ts');
  const checkout = await source('src/http/routes/checkout.ts');
  const customerData = await source('src/http/routes/customer-data.ts');
  const adminOrders = await source('src/http/routes/admin-orders.ts');
  const baristaStaff = await source('src/http/routes/barista-staff.ts');

  assert.match(service, /export async function cancelPromotionalAddonForOrder/);
  assert.match(service, /fulfilment_status = 'cancelled'/);
  assert.match(service, /fulfilment_status = 'pending'/);
  assert.match(service, /event\.event_type = 'cancelled'/);
  assert.match(checkout, /cancelPromotionalAddonForOrder/);
  assert.match(customerData, /cancelPromotionalAddonForOrder/);
  assert.match(adminOrders, /cancelPromotionalAddonForOrder/);
  assert.match(baristaStaff, /cancelPromotionalAddonForOrder/);
});

test('full refunds require an audited returned-or-retained gift disposition', async () => {
  const service = await source('src/services/promotional-addons.ts');
  const adminOrders = await source('src/http/routes/admin-orders.ts');
  const adminUi = await source('../admin_web/src/components/RefundDetails.jsx');
  assert.match(service, /recordPromotionalAddonRefundDisposition/);
  assert.match(service, /promotional_gift_disposition_required/);
  assert.match(service, /promotional_return/);
  assert.match(service, /promotional_retained/);
  assert.match(adminOrders, /promotional_gift_disposition/);
  assert.match(adminUi, /Gift was physically returned/);
  assert.match(adminUi, /Customer kept the gift/);
});
