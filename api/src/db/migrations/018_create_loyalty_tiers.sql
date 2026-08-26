-- C2 Coffee Phase 1 migration 018
-- Tier configuration and tier-code column relaxation for live tier management.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  min_cups INT UNSIGNED NOT NULL DEFAULT 0,
  promotion_text VARCHAR(255) NOT NULL DEFAULT '',
  badge_color VARCHAR(32) NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_loyalty_tiers_code (code),
  KEY idx_loyalty_tiers_active_sort (is_active, min_cups, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO loyalty_tiers (code, name, min_cups, promotion_text, badge_color, sort_order, is_active)
SELECT 'kawan', 'Kawan', 0, 'Entry loyalty tier', '#3B82F6', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM loyalty_tiers WHERE code = 'kawan');

INSERT INTO loyalty_tiers (code, name, min_cups, promotion_text, badge_color, sort_order, is_active)
SELECT 'dilamun', 'Dilamun', 10, 'Progressing loyalty tier', '#E07A5F', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM loyalty_tiers WHERE code = 'dilamun');

INSERT INTO loyalty_tiers (code, name, min_cups, promotion_text, badge_color, sort_order, is_active)
SELECT 'ketagih', 'Ketagih', 30, 'High engagement loyalty tier', '#9333EA', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM loyalty_tiers WHERE code = 'ketagih');

INSERT INTO loyalty_tiers (code, name, min_cups, promotion_text, badge_color, sort_order, is_active)
SELECT 'legend', 'Legend', 50, 'Top loyalty tier', '#D4AF7A', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM loyalty_tiers WHERE code = 'legend');

ALTER TABLE loyalty_tier_snapshots
  MODIFY tier_code VARCHAR(50) NOT NULL;

ALTER TABLE user_vouchers
  MODIFY tier_at_issue VARCHAR(50) NULL;

ALTER TABLE menu_item_token_prices
  MODIFY tier_code VARCHAR(50) NOT NULL;

