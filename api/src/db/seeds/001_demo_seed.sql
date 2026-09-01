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
  ('support_admin', 'Support Admin', 'Customer lookup and limited support actions'),
  ('barista', 'Barista', 'Barista app access for preparing customer orders')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT INTO admin_users (username, email, full_name, password_hash, mfa_enabled, status, must_change_password, must_set_email)
VALUES
  ('ops_manager', 'ops.manager@c2coffee.local', 'C2 Ops Manager', 'REPLACE_WITH_REAL_PASSWORD_HASH', 0, 'active', 0, 0),
  ('support_lead', 'support.lead@c2coffee.local', 'C2 Support Lead', 'REPLACE_WITH_REAL_PASSWORD_HASH', 0, 'active', 0, 0)
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  email = VALUES(email),
  full_name = VALUES(full_name),
  status = VALUES(status),
  must_change_password = VALUES(must_change_password),
  must_set_email = VALUES(must_set_email);

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

INSERT INTO users (phone_e164, status)
VALUES
  ('+601200000101', 'active'),
  ('+601200000102', 'active')
ON DUPLICATE KEY UPDATE
  status = VALUES(status);

INSERT INTO user_profiles (
  user_id,
  display_name,
  email,
  avatar_type,
  created_at,
  updated_at
)
SELECT
  u.id,
  seeded_users.display_name,
  seeded_users.email,
  'preset',
  UTC_TIMESTAMP(),
  UTC_TIMESTAMP()
FROM (
  SELECT '+601200000101' AS phone_e164, 'QA Tester One' AS display_name, 'qa.one@c2coffee.local' AS email
  UNION ALL
  SELECT '+601200000102', 'QA Tester Two', 'qa.two@c2coffee.local'
) seeded_users
JOIN users u
  ON u.phone_e164 = seeded_users.phone_e164
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  email = VALUES(email),
  avatar_type = VALUES(avatar_type),
  updated_at = VALUES(updated_at);

INSERT INTO token_accounts (
  user_id,
  balance_available,
  balance_reserved,
  balance_cap,
  created_at,
  updated_at
)
SELECT
  u.id,
  1000,
  0,
  1000,
  UTC_TIMESTAMP(),
  UTC_TIMESTAMP()
FROM (
  SELECT '+601200000101' AS phone_e164
  UNION ALL
  SELECT '+601200000102'
) seeded_users
JOIN users u
  ON u.phone_e164 = seeded_users.phone_e164
ON DUPLICATE KEY UPDATE
  balance_available = VALUES(balance_available),
  balance_reserved = VALUES(balance_reserved),
  balance_cap = VALUES(balance_cap),
  updated_at = VALUES(updated_at);

INSERT INTO token_ledger (
  user_id,
  token_lot_id,
  direction,
  source_type,
  source_id,
  amount,
  balance_after,
  remarks,
  created_by_admin_id,
  created_at
)
SELECT
  u.id,
  NULL,
  'credit',
  'admin_adjustment',
  seeded_wallets.source_id,
  1000,
  1000,
  seeded_wallets.remarks,
  admin_user.id,
  UTC_TIMESTAMP()
FROM (
  SELECT '+601200000101' AS phone_e164, 910101 AS source_id, 'QA seed wallet credit' AS remarks
  UNION ALL
  SELECT '+601200000102', 910102, 'QA seed wallet credit'
) seeded_wallets
JOIN users u
  ON u.phone_e164 = seeded_wallets.phone_e164
LEFT JOIN admin_users admin_user
  ON admin_user.email = 'ops.manager@c2coffee.local'
WHERE NOT EXISTS (
  SELECT 1
  FROM token_ledger tl
  WHERE tl.user_id = u.id
    AND tl.source_type = 'admin_adjustment'
    AND tl.source_id = seeded_wallets.source_id
);

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

INSERT INTO home_banners (
  code,
  title,
  subtitle,
  image_source,
  placement,
  sort_order,
  floating_priority,
  is_active
)
VALUES
  (
    'operation_hours',
    'Operation Hours',
    'Open daily with updated store hours and pickup coverage.',
    'assets/images/operationhour.jpeg',
    'both',
    10,
    1,
    1
  ),
  (
    'happy_hour',
    'Happy Hour',
    'Limited-time rewards and extra reasons to stop by.',
    'assets/images/happyhour.jpeg',
    'both',
    20,
    0,
    1
  ),
  (
    'emergency_notice',
    'Emergency Notice',
    'Important store advisories and service updates from the team.',
    'assets/images/incaseofemergency.jpeg',
    'both',
    30,
    0,
    1
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  image_source = VALUES(image_source),
  placement = VALUES(placement),
  sort_order = VALUES(sort_order),
  floating_priority = VALUES(floating_priority),
  is_active = VALUES(is_active);

INSERT INTO menu_categories (code, name, sort_order, is_active)
VALUES
  ('coffee', 'Coffee', 10, 1),
  ('non_coffee', 'Barista Craft', 20, 1),
  ('food', 'Food', 30, 1),
  ('merchandise', 'Merchandise', 40, 1),
  ('candles', 'Candles', 50, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);

INSERT INTO menu_items (
  category_id,
  code,
  name,
  description,
  base_price_rm,
  is_handcrafted_drink,
  is_qualifying_cup,
  is_active,
  image_url,
  sort_order
)
SELECT
  c.id,
  seeded_items.item_code,
  seeded_items.item_name,
  seeded_items.item_description,
  seeded_items.base_price_rm,
  seeded_items.is_handcrafted_drink,
  seeded_items.is_qualifying_cup,
  1,
  seeded_items.image_url,
  seeded_items.sort_order
FROM (
  SELECT
    'coffee' AS category_code,
    'MONT_BROGA' AS item_code,
    'Mont Broga' AS item_name,
    'Black coffee layered with orangey cold foam and orange zest.' AS item_description,
    16.90 AS base_price_rm,
    1 AS is_handcrafted_drink,
    1 AS is_qualifying_cup,
    '/assets/menu/drinks/MONT%20BROGA.png' AS image_url,
    10 AS sort_order
  UNION ALL SELECT 'coffee', 'SHAKERATO_BIANCO', 'Shakerato Bianco', 'Chilled, shaken espresso with sweet silky and refreshing cream.', 16.90, 1, 1, '/assets/menu/drinks/SHAKERATO%20BIANCO.png', 20
  UNION ALL SELECT 'coffee', 'YUZUKANO', 'Yuzukano', 'Aerated espresso topping the chilled yuzu puree.', 17.90, 1, 1, '/assets/menu/drinks/YUZUKANO.png', 30
  UNION ALL SELECT 'coffee', 'SENJA_DI_BROGA', 'Senja Di Broga', 'Sweet sparkling orange juice topped with espresso.', 17.90, 1, 1, '/assets/menu/drinks/SENJA%20DI%20BROGA.png', 40
  UNION ALL SELECT 'coffee', 'ESPRESSO_BOMB', 'Espresso Bomb', 'The trendy espresso bomb is here. Choice of sparkling ginger ade or tonic water.', 18.90, 1, 1, '/assets/menu/drinks/ESPRESSO%20BOMB.png', 50
  UNION ALL SELECT 'coffee', 'V60_BREW', 'V60 Brew', 'Hand-poured coffee revealing delicate aroma and clarity.', 15.90, 1, 1, '/assets/menu/drinks/V60%20BREW.png', 60
  UNION ALL SELECT 'coffee', 'ESPRESSO', 'Espresso', 'Pure, concentrated coffee with bold taste notes.', 9.90, 1, 1, '/assets/menu/drinks/ESPRESSO.png', 70
  UNION ALL SELECT 'coffee', 'POCCO_LOCCO', 'Pocco Locco', 'An espresso and oatmilk, small in size and rich in flavour.', 12.90, 1, 1, '/assets/menu/drinks/POCCO%20LOCCO.png', 80
  UNION ALL SELECT 'coffee', 'LATTE', 'Latte', 'Espresso topped with milk with layers of smooth foam.', 14.90, 1, 1, '/assets/menu/drinks/LATTE.png', 90
  UNION ALL SELECT 'coffee', 'FLAT_WHITE', 'Flat White', 'Espresso topped with hot milk and a thin layer of smooth foam.', 14.90, 1, 1, '/assets/menu/drinks/FLAT%20WHITE.png', 100
  UNION ALL SELECT 'coffee', 'CAPPUCCINO', 'Cappuccino', 'Espresso topped with light thick foam and delicate milk.', 14.90, 1, 1, '/assets/menu/drinks/CAPPUCCINO.png', 110
  UNION ALL SELECT 'coffee', 'BUTTERSCOTCH_LATTE', 'Butterscotch Latte', 'Smooth espresso and milk mixed with butterscotch flavour.', 16.90, 1, 1, '/assets/menu/drinks/BUTTERSCOTH%20LATTE.png', 120
  UNION ALL SELECT 'coffee', 'HAZELNUT_LATTE', 'Hazelnut Latte', 'Espresso and milk mixed with hazelnut flavour.', 16.90, 1, 1, '/assets/menu/drinks/HAZELNUT%20LATTE.png', 130
  UNION ALL SELECT 'coffee', 'VANILLA_LATTE', 'Vanilla Latte', 'Gentle vanilla sweetness lifting smooth espresso.', 16.90, 1, 1, '/assets/menu/drinks/VANILLA%20LATTE.png', 140
  UNION ALL SELECT 'coffee', 'BLUE_CLOUD_COCONUT_COFFEE', 'Blue Cloud Coconut Coffee', 'Black coffee with coconut flavour topped with creamy light blue cold foam.', 17.90, 1, 1, '/assets/menu/drinks/BLUE%20CLOUD%20COCONUT%20COFFEE.png', 150
  UNION ALL SELECT 'coffee', 'MOCHA', 'Mocha', 'Chocolate and espresso mixed with milk.', 17.90, 1, 1, '/assets/menu/drinks/MOCHA.png', 160
  UNION ALL SELECT 'non_coffee', 'BOIJITO', 'Boijito', 'Sparkling mojito with hand-picked mint and calamansi flavour.', 16.90, 1, 1, '/assets/menu/drinks/BOIJITO.png', 10
  UNION ALL SELECT 'non_coffee', 'BLOODY_PEACH', 'Bloody Peach', 'Sparkling jasmine tea with peach flavour and topped with grenadine syrup.', 16.90, 1, 1, '/assets/menu/drinks/BLOODY%20PEACH.png', 20
  UNION ALL SELECT 'non_coffee', 'FUJI_FIZZ', 'Fuji Fizz', 'Ginger, apple and cinnamon come together in a fizzy drink.', 16.90, 1, 1, '/assets/menu/drinks/FUJI%20FIZZ.png', 30
  UNION ALL SELECT 'non_coffee', 'SPICY_MIMOSA', 'Spicy Mimosa', 'Hot and spicy orange juice topped with ginger ade and grenadine syrup.', 16.90, 1, 1, '/assets/menu/drinks/SPICY%20MIMOSA.png', 40
  UNION ALL SELECT 'non_coffee', 'ONDE2POP', 'Onde2Pop', 'Green apple and coconut shaken together and topped with sparkling soda.', 16.90, 1, 1, '/assets/menu/drinks/ONDE-ONDE%20SODA.png', 50
  UNION ALL SELECT 'non_coffee', 'MATCHA_LATTE', 'Matcha Latte', 'Ceremonial grade matcha with smooth creamy milk.', 16.90, 1, 1, '/assets/menu/drinks/MATCHA%20LATTE.png', 60
  UNION ALL SELECT 'non_coffee', 'MONKEY_MATCHA', 'Monkey Matcha', 'Ceremonial grade matcha with ripe banana puree.', 17.90, 1, 1, '/assets/menu/drinks/MONKEY%20MATCHA.png', 70
  UNION ALL SELECT 'non_coffee', 'PINKY_PROMISE_MATCHA', 'Pinky Promise Matcha', 'Ceremonial grade matcha with strawberry puree sweetness.', 17.90, 1, 1, '/assets/menu/drinks/PINKY%20PROMISE%20MATCHA.png', 80
  UNION ALL SELECT 'non_coffee', 'MILK_CHOCOLATE', 'Milk Chocolate', 'Rich and smooth chocolate milk drink topped with marshmallows.', 15.90, 1, 1, '/assets/menu/drinks/MILK%20CHOCOLATE.png', 90
  UNION ALL SELECT 'non_coffee', 'NUTTY_CHOCOLATE', 'Nutty Chocolate', 'Chocolate drink mixed with crunchy peanut butter.', 16.90, 1, 1, '/assets/menu/drinks/NUTTY%20CHOCOLATE.png', 100
  UNION ALL SELECT 'non_coffee', 'PINKY_BLUSH', 'Pinky Blush Milkshake by Syah', 'Creamy strawberry, delicate banana puree, mixed and shaken with milk.', 18.90, 1, 1, '/assets/menu/drinks/PINKY%20BLUSH%20MILKSHAKE%20BY%20SYAH.png', 110
  UNION ALL SELECT 'non_coffee', 'PADDLE_POP', 'Paddle Pop', 'Creamy strawberry, delicate banana puree, mixed and shaken with milk.', 18.90, 1, 1, '/assets/menu/drinks/PADDLE%20POP.png', 120
  UNION ALL SELECT 'non_coffee', 'SOLERO_FIZZ', 'Solero Fizz', 'Bright citrus notes with sparkling soda and creamy silky cold foam.', 16.90, 1, 1, '/assets/menu/drinks/SOLERO%20FIZZ.png', 130
  UNION ALL SELECT 'non_coffee', 'CLOUDY_JASMINE', 'Cloudy Jasmine', 'Refreshing jasmine tea soda with silky butterscotch cream foam.', 16.90, 1, 1, '/assets/menu/drinks/CLOUDY%20JASMINE.png', 140
  UNION ALL SELECT 'food', 'LAMB_CURRY_PUFF', 'Lamb Curry Puff', 'Crispy golden pastry crust packed with savory spiced minced lamb filling.', 8.90, 0, 0, '/assets/menu/pastries/curry%20puff.png', 10
  UNION ALL SELECT 'food', 'SHIO_PAN', 'Shio Pan', 'Japanese salted bread with soft chewy centre and buttery finish.', 7.90, 0, 0, '/assets/menu/pastries/shio%20pan.png', 20
  UNION ALL SELECT 'food', 'BROWNIE', 'Brownie', 'Rich fudgy brownie with deep cocoa flavour.', 9.90, 0, 0, '/assets/menu/pastries/brownie.png', 30
  UNION ALL SELECT 'food', 'CHEESECAKE_BISCOFF', 'Cheesecake Biscoff', 'Creamy cheesecake finished with Biscoff crumble.', 15.90, 0, 0, '/assets/menu/pastries/ck%20biscoff.png', 40
  UNION ALL SELECT 'food', 'CHEESECAKE_OVOMALTINE', 'Cheesecake Ovomaltine', 'Creamy cheesecake topped with crunchy Ovomaltine.', 15.90, 0, 0, '/assets/menu/pastries/ck%20ovomaltine.png', 50
  UNION ALL SELECT 'food', 'CHEESECAKE_RED_VELVET', 'Cheesecake Red Velvet', 'Velvety cheesecake with classic red velvet finish.', 15.90, 0, 0, '/assets/menu/pastries/ck%20red%20velvet.png', 60
  UNION ALL SELECT 'merchandise', 'C2_CUP_CREAM', 'C2 Cup Cream', 'Premium durable tumbler designed for daily coffee rituals.', 49.90, 0, 0, '/assets/menu/merchandies/cream.png', 10
  UNION ALL SELECT 'merchandise', 'C2_CUP_DARK_BLUE', 'C2 Cup Dark Blue', 'Premium durable tumbler designed for daily coffee rituals.', 49.90, 0, 0, '/assets/menu/merchandies/dark%20blue.png', 20
  UNION ALL SELECT 'merchandise', 'C2_CUP_GREEN', 'C2 Cup Green', 'Premium durable tumbler designed for daily coffee rituals.', 49.90, 0, 0, '/assets/menu/merchandies/green.png', 30
  UNION ALL SELECT 'merchandise', 'C2_CUP_LIGHT_BLUE', 'C2 Cup Light Blue', 'Premium durable tumbler designed for daily coffee rituals.', 49.90, 0, 0, '/assets/menu/merchandies/light%20blue.png', 40
  UNION ALL SELECT 'merchandise', 'C2_CUP_LIGHT_PURPLE', 'C2 Cup Light Purple', 'Premium durable tumbler designed for daily coffee rituals.', 49.90, 0, 0, '/assets/menu/merchandies/light%20purple.png', 50
  UNION ALL SELECT 'candles', 'GUNUNG_CANDLE', 'Gunung Candle', 'Earthy cedar and forest pine notes inspired by the misty Broga peaks.', 59.90, 0, 0, '/assets/menu/candles/gunung.png', 10
  UNION ALL SELECT 'candles', 'CRUSHED_LIME_SEASALT_CANDLE', 'Crushed Lime Seasalt Candle', 'Zesty citrus lime blended with crisp sea salt minerals.', 59.90, 0, 0, '/assets/menu/candles/crushed%20lime%20and%20seasalt.png', 20
  UNION ALL SELECT 'candles', 'FRESH_SAGE_DRIFTWOOD_CANDLE', 'Fresh Sage Driftwood Candle', 'Calming herbal sage paired with coastal driftwood notes.', 59.90, 0, 0, '/assets/menu/candles/fresh%20sage%20and%20driftwood.png', 30
  UNION ALL SELECT 'candles', 'TOBACCO_VANILLA_CANDLE', 'Tobacco Vanilla Candle', 'Warm aromatic tobacco leaf layered with creamy vanilla and subtle spices.', 59.90, 0, 0, '/assets/menu/candles/tobacco%20vanilla.png', 40
) seeded_items
JOIN menu_categories c
  ON c.code = seeded_items.category_code
ON DUPLICATE KEY UPDATE
  category_id = VALUES(category_id),
  name = VALUES(name),
  description = VALUES(description),
  base_price_rm = VALUES(base_price_rm),
  is_handcrafted_drink = VALUES(is_handcrafted_drink),
  is_qualifying_cup = VALUES(is_qualifying_cup),
  is_active = VALUES(is_active),
  image_url = VALUES(image_url),
  sort_order = VALUES(sort_order);

INSERT INTO menu_item_store_availability (store_id, menu_item_id, is_available, unavailable_reason)
SELECT
  s.id,
  mi.id,
  1,
  NULL
FROM stores s
JOIN menu_items mi
  ON mi.is_active = 1
WHERE s.code IN ('C2-BROGA', 'C2-KAJANG')
ON DUPLICATE KEY UPDATE
  is_available = VALUES(is_available),
  unavailable_reason = VALUES(unavailable_reason);

INSERT INTO menu_item_token_prices (
  menu_item_id,
  tier_code,
  token_price,
  is_enabled,
  effective_from,
  effective_to
)
SELECT
  mi.id,
  seeded_prices.tier_code,
  seeded_prices.token_price,
  1,
  '2026-01-01 00:00:00',
  NULL
FROM (
  SELECT 'MONT_BROGA' AS item_code, 'kawan' AS tier_code, 15 AS token_price
  UNION ALL SELECT 'MONT_BROGA', 'dilamun', 14
  UNION ALL SELECT 'MONT_BROGA', 'ketagih', 13
  UNION ALL SELECT 'MONT_BROGA', 'legend', 12
  UNION ALL SELECT 'SHAKERATO_BIANCO', 'kawan', 15
  UNION ALL SELECT 'SHAKERATO_BIANCO', 'dilamun', 14
  UNION ALL SELECT 'SHAKERATO_BIANCO', 'ketagih', 13
  UNION ALL SELECT 'SHAKERATO_BIANCO', 'legend', 12
  UNION ALL SELECT 'YUZUKANO', 'kawan', 16
  UNION ALL SELECT 'YUZUKANO', 'dilamun', 15
  UNION ALL SELECT 'YUZUKANO', 'ketagih', 14
  UNION ALL SELECT 'YUZUKANO', 'legend', 13
  UNION ALL SELECT 'SENJA_DI_BROGA', 'kawan', 16
  UNION ALL SELECT 'SENJA_DI_BROGA', 'dilamun', 15
  UNION ALL SELECT 'SENJA_DI_BROGA', 'ketagih', 14
  UNION ALL SELECT 'SENJA_DI_BROGA', 'legend', 13
  UNION ALL SELECT 'ESPRESSO_BOMB', 'kawan', 17
  UNION ALL SELECT 'ESPRESSO_BOMB', 'dilamun', 16
  UNION ALL SELECT 'ESPRESSO_BOMB', 'ketagih', 15
  UNION ALL SELECT 'ESPRESSO_BOMB', 'legend', 14
  UNION ALL SELECT 'V60_BREW', 'kawan', 14
  UNION ALL SELECT 'V60_BREW', 'dilamun', 13
  UNION ALL SELECT 'V60_BREW', 'ketagih', 12
  UNION ALL SELECT 'V60_BREW', 'legend', 11
  UNION ALL SELECT 'ESPRESSO', 'kawan', 9
  UNION ALL SELECT 'ESPRESSO', 'dilamun', 8
  UNION ALL SELECT 'ESPRESSO', 'ketagih', 8
  UNION ALL SELECT 'ESPRESSO', 'legend', 7
  UNION ALL SELECT 'POCCO_LOCCO', 'kawan', 12
  UNION ALL SELECT 'POCCO_LOCCO', 'dilamun', 11
  UNION ALL SELECT 'POCCO_LOCCO', 'ketagih', 10
  UNION ALL SELECT 'POCCO_LOCCO', 'legend', 9
  UNION ALL SELECT 'LATTE', 'kawan', 13
  UNION ALL SELECT 'LATTE', 'dilamun', 12
  UNION ALL SELECT 'LATTE', 'ketagih', 11
  UNION ALL SELECT 'LATTE', 'legend', 10
  UNION ALL SELECT 'FLAT_WHITE', 'kawan', 13
  UNION ALL SELECT 'FLAT_WHITE', 'dilamun', 12
  UNION ALL SELECT 'FLAT_WHITE', 'ketagih', 11
  UNION ALL SELECT 'FLAT_WHITE', 'legend', 10
  UNION ALL SELECT 'CAPPUCCINO', 'kawan', 13
  UNION ALL SELECT 'CAPPUCCINO', 'dilamun', 12
  UNION ALL SELECT 'CAPPUCCINO', 'ketagih', 11
  UNION ALL SELECT 'CAPPUCCINO', 'legend', 10
  UNION ALL SELECT 'BUTTERSCOTCH_LATTE', 'kawan', 15
  UNION ALL SELECT 'BUTTERSCOTCH_LATTE', 'dilamun', 14
  UNION ALL SELECT 'BUTTERSCOTCH_LATTE', 'ketagih', 13
  UNION ALL SELECT 'BUTTERSCOTCH_LATTE', 'legend', 12
  UNION ALL SELECT 'HAZELNUT_LATTE', 'kawan', 15
  UNION ALL SELECT 'HAZELNUT_LATTE', 'dilamun', 14
  UNION ALL SELECT 'HAZELNUT_LATTE', 'ketagih', 13
  UNION ALL SELECT 'HAZELNUT_LATTE', 'legend', 12
  UNION ALL SELECT 'VANILLA_LATTE', 'kawan', 15
  UNION ALL SELECT 'VANILLA_LATTE', 'dilamun', 14
  UNION ALL SELECT 'VANILLA_LATTE', 'ketagih', 13
  UNION ALL SELECT 'VANILLA_LATTE', 'legend', 12
  UNION ALL SELECT 'BLUE_CLOUD_COCONUT_COFFEE', 'kawan', 16
  UNION ALL SELECT 'BLUE_CLOUD_COCONUT_COFFEE', 'dilamun', 15
  UNION ALL SELECT 'BLUE_CLOUD_COCONUT_COFFEE', 'ketagih', 14
  UNION ALL SELECT 'BLUE_CLOUD_COCONUT_COFFEE', 'legend', 13
  UNION ALL SELECT 'MOCHA', 'kawan', 16
  UNION ALL SELECT 'MOCHA', 'dilamun', 15
  UNION ALL SELECT 'MOCHA', 'ketagih', 14
  UNION ALL SELECT 'MOCHA', 'legend', 13
  UNION ALL SELECT 'BOIJITO', 'kawan', 15
  UNION ALL SELECT 'BOIJITO', 'dilamun', 14
  UNION ALL SELECT 'BOIJITO', 'ketagih', 13
  UNION ALL SELECT 'BOIJITO', 'legend', 12
  UNION ALL SELECT 'BLOODY_PEACH', 'kawan', 15
  UNION ALL SELECT 'BLOODY_PEACH', 'dilamun', 14
  UNION ALL SELECT 'BLOODY_PEACH', 'ketagih', 13
  UNION ALL SELECT 'BLOODY_PEACH', 'legend', 12
  UNION ALL SELECT 'FUJI_FIZZ', 'kawan', 15
  UNION ALL SELECT 'FUJI_FIZZ', 'dilamun', 14
  UNION ALL SELECT 'FUJI_FIZZ', 'ketagih', 13
  UNION ALL SELECT 'FUJI_FIZZ', 'legend', 12
  UNION ALL SELECT 'SPICY_MIMOSA', 'kawan', 15
  UNION ALL SELECT 'SPICY_MIMOSA', 'dilamun', 14
  UNION ALL SELECT 'SPICY_MIMOSA', 'ketagih', 13
  UNION ALL SELECT 'SPICY_MIMOSA', 'legend', 12
  UNION ALL SELECT 'ONDE2POP', 'kawan', 15
  UNION ALL SELECT 'ONDE2POP', 'dilamun', 14
  UNION ALL SELECT 'ONDE2POP', 'ketagih', 13
  UNION ALL SELECT 'ONDE2POP', 'legend', 12
  UNION ALL SELECT 'MATCHA_LATTE', 'kawan', 15
  UNION ALL SELECT 'MATCHA_LATTE', 'dilamun', 14
  UNION ALL SELECT 'MATCHA_LATTE', 'ketagih', 13
  UNION ALL SELECT 'MATCHA_LATTE', 'legend', 12
  UNION ALL SELECT 'MONKEY_MATCHA', 'kawan', 16
  UNION ALL SELECT 'MONKEY_MATCHA', 'dilamun', 15
  UNION ALL SELECT 'MONKEY_MATCHA', 'ketagih', 14
  UNION ALL SELECT 'MONKEY_MATCHA', 'legend', 13
  UNION ALL SELECT 'PINKY_PROMISE_MATCHA', 'kawan', 16
  UNION ALL SELECT 'PINKY_PROMISE_MATCHA', 'dilamun', 15
  UNION ALL SELECT 'PINKY_PROMISE_MATCHA', 'ketagih', 14
  UNION ALL SELECT 'PINKY_PROMISE_MATCHA', 'legend', 13
  UNION ALL SELECT 'MILK_CHOCOLATE', 'kawan', 14
  UNION ALL SELECT 'MILK_CHOCOLATE', 'dilamun', 13
  UNION ALL SELECT 'MILK_CHOCOLATE', 'ketagih', 12
  UNION ALL SELECT 'MILK_CHOCOLATE', 'legend', 11
  UNION ALL SELECT 'NUTTY_CHOCOLATE', 'kawan', 15
  UNION ALL SELECT 'NUTTY_CHOCOLATE', 'dilamun', 14
  UNION ALL SELECT 'NUTTY_CHOCOLATE', 'ketagih', 13
  UNION ALL SELECT 'NUTTY_CHOCOLATE', 'legend', 12
  UNION ALL SELECT 'PINKY_BLUSH', 'kawan', 17
  UNION ALL SELECT 'PINKY_BLUSH', 'dilamun', 16
  UNION ALL SELECT 'PINKY_BLUSH', 'ketagih', 15
  UNION ALL SELECT 'PINKY_BLUSH', 'legend', 14
  UNION ALL SELECT 'PADDLE_POP', 'kawan', 17
  UNION ALL SELECT 'PADDLE_POP', 'dilamun', 16
  UNION ALL SELECT 'PADDLE_POP', 'ketagih', 15
  UNION ALL SELECT 'PADDLE_POP', 'legend', 14
  UNION ALL SELECT 'SOLERO_FIZZ', 'kawan', 15
  UNION ALL SELECT 'SOLERO_FIZZ', 'dilamun', 14
  UNION ALL SELECT 'SOLERO_FIZZ', 'ketagih', 13
  UNION ALL SELECT 'SOLERO_FIZZ', 'legend', 12
  UNION ALL SELECT 'CLOUDY_JASMINE', 'kawan', 15
  UNION ALL SELECT 'CLOUDY_JASMINE', 'dilamun', 14
  UNION ALL SELECT 'CLOUDY_JASMINE', 'ketagih', 13
  UNION ALL SELECT 'CLOUDY_JASMINE', 'legend', 12
  UNION ALL SELECT 'LAMB_CURRY_PUFF', 'kawan', 9
  UNION ALL SELECT 'LAMB_CURRY_PUFF', 'dilamun', 8
  UNION ALL SELECT 'LAMB_CURRY_PUFF', 'ketagih', 8
  UNION ALL SELECT 'LAMB_CURRY_PUFF', 'legend', 7
  UNION ALL SELECT 'SHIO_PAN', 'kawan', 8
  UNION ALL SELECT 'SHIO_PAN', 'dilamun', 7
  UNION ALL SELECT 'SHIO_PAN', 'ketagih', 7
  UNION ALL SELECT 'SHIO_PAN', 'legend', 6
  UNION ALL SELECT 'BROWNIE', 'kawan', 10
  UNION ALL SELECT 'BROWNIE', 'dilamun', 9
  UNION ALL SELECT 'BROWNIE', 'ketagih', 8
  UNION ALL SELECT 'BROWNIE', 'legend', 8
  UNION ALL SELECT 'CHEESECAKE_BISCOFF', 'kawan', 16
  UNION ALL SELECT 'CHEESECAKE_BISCOFF', 'dilamun', 15
  UNION ALL SELECT 'CHEESECAKE_BISCOFF', 'ketagih', 14
  UNION ALL SELECT 'CHEESECAKE_BISCOFF', 'legend', 13
  UNION ALL SELECT 'CHEESECAKE_OVOMALTINE', 'kawan', 16
  UNION ALL SELECT 'CHEESECAKE_OVOMALTINE', 'dilamun', 15
  UNION ALL SELECT 'CHEESECAKE_OVOMALTINE', 'ketagih', 14
  UNION ALL SELECT 'CHEESECAKE_OVOMALTINE', 'legend', 13
  UNION ALL SELECT 'CHEESECAKE_RED_VELVET', 'kawan', 16
  UNION ALL SELECT 'CHEESECAKE_RED_VELVET', 'dilamun', 15
  UNION ALL SELECT 'CHEESECAKE_RED_VELVET', 'ketagih', 14
  UNION ALL SELECT 'CHEESECAKE_RED_VELVET', 'legend', 13
  UNION ALL SELECT 'C2_CUP_CREAM', 'kawan', 50
  UNION ALL SELECT 'C2_CUP_CREAM', 'dilamun', 49
  UNION ALL SELECT 'C2_CUP_CREAM', 'ketagih', 48
  UNION ALL SELECT 'C2_CUP_CREAM', 'legend', 47
  UNION ALL SELECT 'C2_CUP_DARK_BLUE', 'kawan', 50
  UNION ALL SELECT 'C2_CUP_DARK_BLUE', 'dilamun', 49
  UNION ALL SELECT 'C2_CUP_DARK_BLUE', 'ketagih', 48
  UNION ALL SELECT 'C2_CUP_DARK_BLUE', 'legend', 47
  UNION ALL SELECT 'C2_CUP_GREEN', 'kawan', 50
  UNION ALL SELECT 'C2_CUP_GREEN', 'dilamun', 49
  UNION ALL SELECT 'C2_CUP_GREEN', 'ketagih', 48
  UNION ALL SELECT 'C2_CUP_GREEN', 'legend', 47
  UNION ALL SELECT 'C2_CUP_LIGHT_BLUE', 'kawan', 50
  UNION ALL SELECT 'C2_CUP_LIGHT_BLUE', 'dilamun', 49
  UNION ALL SELECT 'C2_CUP_LIGHT_BLUE', 'ketagih', 48
  UNION ALL SELECT 'C2_CUP_LIGHT_BLUE', 'legend', 47
  UNION ALL SELECT 'C2_CUP_LIGHT_PURPLE', 'kawan', 50
  UNION ALL SELECT 'C2_CUP_LIGHT_PURPLE', 'dilamun', 49
  UNION ALL SELECT 'C2_CUP_LIGHT_PURPLE', 'ketagih', 48
  UNION ALL SELECT 'C2_CUP_LIGHT_PURPLE', 'legend', 47
  UNION ALL SELECT 'GUNUNG_CANDLE', 'kawan', 60
  UNION ALL SELECT 'GUNUNG_CANDLE', 'dilamun', 59
  UNION ALL SELECT 'GUNUNG_CANDLE', 'ketagih', 58
  UNION ALL SELECT 'GUNUNG_CANDLE', 'legend', 57
  UNION ALL SELECT 'CRUSHED_LIME_SEASALT_CANDLE', 'kawan', 60
  UNION ALL SELECT 'CRUSHED_LIME_SEASALT_CANDLE', 'dilamun', 59
  UNION ALL SELECT 'CRUSHED_LIME_SEASALT_CANDLE', 'ketagih', 58
  UNION ALL SELECT 'CRUSHED_LIME_SEASALT_CANDLE', 'legend', 57
  UNION ALL SELECT 'FRESH_SAGE_DRIFTWOOD_CANDLE', 'kawan', 60
  UNION ALL SELECT 'FRESH_SAGE_DRIFTWOOD_CANDLE', 'dilamun', 59
  UNION ALL SELECT 'FRESH_SAGE_DRIFTWOOD_CANDLE', 'ketagih', 58
  UNION ALL SELECT 'FRESH_SAGE_DRIFTWOOD_CANDLE', 'legend', 57
  UNION ALL SELECT 'TOBACCO_VANILLA_CANDLE', 'kawan', 60
  UNION ALL SELECT 'TOBACCO_VANILLA_CANDLE', 'dilamun', 59
  UNION ALL SELECT 'TOBACCO_VANILLA_CANDLE', 'ketagih', 58
  UNION ALL SELECT 'TOBACCO_VANILLA_CANDLE', 'legend', 57
) seeded_prices
JOIN menu_items mi
  ON mi.code = seeded_prices.item_code
ON DUPLICATE KEY UPDATE
  token_price = VALUES(token_price),
  is_enabled = VALUES(is_enabled),
  effective_from = VALUES(effective_from),
  effective_to = VALUES(effective_to);

INSERT INTO item_modifier_groups (
  menu_item_id,
  code,
  name,
  selection_type,
  min_select,
  max_select,
  is_required,
  sort_order
)
SELECT
  mi.id,
  seeded_groups.group_code,
  seeded_groups.group_name,
  'single',
  seeded_groups.min_select,
  seeded_groups.max_select,
  seeded_groups.is_required,
  seeded_groups.sort_order
FROM (
  SELECT 'MONT_BROGA' AS item_code, 'beans' AS group_code, 'Choice of Beans' AS group_name, 1 AS min_select, 1 AS max_select, 1 AS is_required, 10 AS sort_order
  UNION ALL SELECT 'MONT_BROGA', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 20
  UNION ALL SELECT 'MONT_BROGA', 'ice', 'Ice Level', 1, 1, 1, 30
  UNION ALL SELECT 'SHAKERATO_BIANCO', 'beans', 'Choice of Beans', 1, 1, 1, 10
  UNION ALL SELECT 'SHAKERATO_BIANCO', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 20
  UNION ALL SELECT 'SHAKERATO_BIANCO', 'ice', 'Ice Level', 1, 1, 1, 30
  UNION ALL SELECT 'YUZUKANO', 'beans', 'Choice of Beans', 1, 1, 1, 10
  UNION ALL SELECT 'YUZUKANO', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 20
  UNION ALL SELECT 'YUZUKANO', 'ice', 'Ice Level', 1, 1, 1, 30
  UNION ALL SELECT 'SENJA_DI_BROGA', 'beans', 'Choice of Beans', 1, 1, 1, 10
  UNION ALL SELECT 'SENJA_DI_BROGA', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 20
  UNION ALL SELECT 'SENJA_DI_BROGA', 'ice', 'Ice Level', 1, 1, 1, 30
  UNION ALL SELECT 'ESPRESSO_BOMB', 'sparkling', 'Choice of Sparkling', 1, 1, 1, 10
  UNION ALL SELECT 'ESPRESSO_BOMB', 'beans', 'Choice of Beans', 1, 1, 1, 20
  UNION ALL SELECT 'ESPRESSO_BOMB', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'ESPRESSO_BOMB', 'ice', 'Ice Level', 1, 1, 1, 40
  UNION ALL SELECT 'V60_BREW', 'beans', 'Choice of Beans', 1, 1, 1, 10
  UNION ALL SELECT 'LATTE', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'LATTE', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'LATTE', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'LATTE', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'FLAT_WHITE', 'milk', 'Choice of Milk', 1, 1, 1, 10
  UNION ALL SELECT 'CAPPUCCINO', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'CAPPUCCINO', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'CAPPUCCINO', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'CAPPUCCINO', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'BUTTERSCOTCH_LATTE', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'BUTTERSCOTCH_LATTE', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'BUTTERSCOTCH_LATTE', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'BUTTERSCOTCH_LATTE', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'HAZELNUT_LATTE', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'HAZELNUT_LATTE', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'HAZELNUT_LATTE', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'HAZELNUT_LATTE', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'VANILLA_LATTE', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'VANILLA_LATTE', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'VANILLA_LATTE', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'VANILLA_LATTE', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'MOCHA', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'MOCHA', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'MOCHA', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'MOCHA', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'MATCHA_LATTE', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'MATCHA_LATTE', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'MATCHA_LATTE', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'MATCHA_LATTE', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'MONKEY_MATCHA', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'MONKEY_MATCHA', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'MONKEY_MATCHA', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'MONKEY_MATCHA', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'PINKY_PROMISE_MATCHA', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'PINKY_PROMISE_MATCHA', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'PINKY_PROMISE_MATCHA', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'PINKY_PROMISE_MATCHA', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'MILK_CHOCOLATE', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'MILK_CHOCOLATE', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'MILK_CHOCOLATE', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'MILK_CHOCOLATE', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'NUTTY_CHOCOLATE', 'temperature', 'Choice of Temperature', 1, 1, 1, 10
  UNION ALL SELECT 'NUTTY_CHOCOLATE', 'milk', 'Choice of Milk', 1, 1, 1, 20
  UNION ALL SELECT 'NUTTY_CHOCOLATE', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 30
  UNION ALL SELECT 'NUTTY_CHOCOLATE', 'ice', 'Ice Level', 0, 1, 0, 40
  UNION ALL SELECT 'PINKY_BLUSH', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 10
  UNION ALL SELECT 'PADDLE_POP', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 10
  UNION ALL SELECT 'SOLERO_FIZZ', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 10
  UNION ALL SELECT 'SOLERO_FIZZ', 'ice', 'Ice Level', 1, 1, 1, 20
  UNION ALL SELECT 'CLOUDY_JASMINE', 'sweetness', 'Choice of Sweetness', 1, 1, 1, 10
  UNION ALL SELECT 'CLOUDY_JASMINE', 'ice', 'Ice Level', 1, 1, 1, 20
) seeded_groups
JOIN menu_items mi
  ON mi.code = seeded_groups.item_code
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  selection_type = VALUES(selection_type),
  min_select = VALUES(min_select),
  max_select = VALUES(max_select),
  is_required = VALUES(is_required),
  sort_order = VALUES(sort_order);

INSERT INTO item_modifier_options (
  modifier_group_id,
  code,
  name,
  price_delta_rm,
  token_price_delta,
  sort_order,
  is_active
)
SELECT
  img.id,
  seeded_options.option_code,
  seeded_options.option_name,
  seeded_options.price_delta_rm,
  seeded_options.token_price_delta,
  seeded_options.sort_order,
  1
FROM (
  SELECT 'beans' AS group_code, 'dato_blend' AS option_code, 'Dato Blend' AS option_name, 0.00 AS price_delta_rm, 0 AS token_price_delta, 10 AS sort_order
  UNION ALL SELECT 'beans', 'datin_blend', 'Datin Blend', 0.00, 0, 20
  UNION ALL SELECT 'temperature', 'hot', 'Hot', 0.00, 0, 10
  UNION ALL SELECT 'temperature', 'cold', 'Cold', 0.00, 0, 20
  UNION ALL SELECT 'milk', 'fresh_milk', 'Fresh Milk', 0.00, 0, 10
  UNION ALL SELECT 'milk', 'oat_milk', 'Oat Milk', 3.00, 3, 20
  UNION ALL SELECT 'sweetness', 'no_sugar', 'No Sugar', 0.00, 0, 10
  UNION ALL SELECT 'sweetness', 'less_sweet', 'Less Sweet', 0.00, 0, 20
  UNION ALL SELECT 'sweetness', 'regular_sweet', 'Regular Sweet', 0.00, 0, 30
  UNION ALL SELECT 'ice', 'less_ice', 'Less Ice', 0.00, 0, 10
  UNION ALL SELECT 'ice', 'regular_ice', 'Regular Ice', 0.00, 0, 20
  UNION ALL SELECT 'sparkling', 'ginger_ade', 'Ginger Ade', 0.00, 0, 10
  UNION ALL SELECT 'sparkling', 'tonic_water', 'Tonic Water', 0.00, 0, 20
) seeded_options
JOIN item_modifier_groups img
  ON img.code = seeded_options.group_code
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  price_delta_rm = VALUES(price_delta_rm),
  token_price_delta = VALUES(token_price_delta),
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
    'Welcome New User Voucher',
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
