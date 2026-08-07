-- C2 Coffee Phase 1 demo seed.
-- Apply only after all schema migrations succeed.
-- Do not run this in production without replacing demo admin users and password hashes.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

INSERT INTO admin_roles (code, name, description)
VALUES
  ('super_admin', 'Super Admin', 'Full administrative access'),
  ('marketing_admin', 'Marketing Admin', 'Campaign, voucher, and reward operations'),
  ('operations_admin', 'Operations Admin', 'Store, order, menu, refund, and operational support'),
  ('support_admin', 'Support Admin', 'Customer lookup and limited support actions')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT INTO admin_users (email, full_name, password_hash, mfa_enabled, status)
VALUES
  ('ops.manager@c2coffee.local', 'C2 Ops Manager', 'REPLACE_WITH_REAL_PASSWORD_HASH', 0, 'active'),
  ('support.lead@c2coffee.local', 'C2 Support Lead', 'REPLACE_WITH_REAL_PASSWORD_HASH', 0, 'active')
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  status = VALUES(status);

INSERT IGNORE INTO admin_user_roles (admin_user_id, admin_role_id)
SELECT au.id, ar.id
FROM admin_users au
JOIN admin_roles ar ON ar.code IN ('operations_admin', 'support_admin')
WHERE au.email = 'ops.manager@c2coffee.local';

INSERT IGNORE INTO admin_user_roles (admin_user_id, admin_role_id)
SELECT au.id, ar.id
FROM admin_users au
JOIN admin_roles ar ON ar.code = 'support_admin'
WHERE au.email = 'support.lead@c2coffee.local';

INSERT INTO stores (
  code, name, status, timezone, address_line_1, city, state, postcode,
  supports_pickup, pickup_lead_minutes
)
VALUES
  ('C2-BROGA', 'C2 Coffee Broga', 'active', 'Asia/Kuala_Lumpur', 'Main Street Broga', 'Broga', 'Selangor', '43500', 1, 15),
  ('C2-KAJANG', 'C2 Coffee Kajang', 'active', 'Asia/Kuala_Lumpur', 'Town Centre Kajang', 'Kajang', 'Selangor', '43000', 1, 15)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  status = VALUES(status),
  timezone = VALUES(timezone),
  address_line_1 = VALUES(address_line_1),
  city = VALUES(city),
  state = VALUES(state),
  postcode = VALUES(postcode),
  supports_pickup = VALUES(supports_pickup),
  pickup_lead_minutes = VALUES(pickup_lead_minutes);

INSERT INTO menu_categories (code, name, sort_order, is_active)
VALUES
  ('coffee', 'Coffee', 10, 1),
  ('non_coffee', 'Non Coffee', 20, 1),
  ('food', 'Food', 30, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);

INSERT INTO voucher_templates (
  code, name, voucher_type, discount_mode, discount_value, token_value,
  min_spend_rm, eligible_scope_json, exclude_scope_json, requires_drink_in_cart,
  stack_rule, expires_in_days, is_active
)
VALUES
  (
    'WELCOME10',
    'Welcome Drink Voucher',
    'welcome',
    'free_drink',
    0.00,
    10,
    NULL,
    JSON_OBJECT('category_codes', JSON_ARRAY('coffee', 'non_coffee')),
    NULL,
    1,
    'primary_only',
    14,
    1
  ),
  (
    'TIER2_DRINK',
    'Tier 2 Complimentary Drink',
    'tier_reward',
    'free_drink',
    0.00,
    12,
    NULL,
    JSON_OBJECT('category_codes', JSON_ARRAY('coffee', 'non_coffee')),
    NULL,
    1,
    'primary_only',
    30,
    1
  ),
  (
    'REFERRAL_DRINK',
    'Referral Reward Drink',
    'referral',
    'free_drink',
    0.00,
    12,
    NULL,
    JSON_OBJECT('category_codes', JSON_ARRAY('coffee', 'non_coffee')),
    NULL,
    1,
    'primary_only',
    30,
    1
  ),
  (
    'DIRECTPAY_RM5',
    'Weekend Direct Pay RM5 Off',
    'campaign_direct_pay',
    'fixed_rm',
    5.00,
    NULL,
    15.00,
    JSON_OBJECT('store_codes', JSON_ARRAY('C2-BROGA', 'C2-KAJANG')),
    NULL,
    0,
    'primary_only',
    7,
    1
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  voucher_type = VALUES(voucher_type),
  discount_mode = VALUES(discount_mode),
  discount_value = VALUES(discount_value),
  token_value = VALUES(token_value),
  min_spend_rm = VALUES(min_spend_rm),
  eligible_scope_json = VALUES(eligible_scope_json),
  exclude_scope_json = VALUES(exclude_scope_json),
  requires_drink_in_cart = VALUES(requires_drink_in_cart),
  stack_rule = VALUES(stack_rule),
  expires_in_days = VALUES(expires_in_days),
  is_active = VALUES(is_active);
