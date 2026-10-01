-- C2 Coffee Phase 1 migration 006
-- Cup loyalty, tier snapshots, voucher templates, issued vouchers, redemptions, and referrals.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS loyalty_cup_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  cups_awarded INT UNSIGNED NOT NULL DEFAULT 1,
  effective_at DATETIME NOT NULL,
  reversed_at DATETIME NULL,
  reversal_reason VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_loyalty_cup_events_user_effective_at (user_id, effective_at),
  KEY idx_loyalty_cup_events_order_id (order_id),
  CONSTRAINT fk_loyalty_cup_events_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_loyalty_cup_events_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_loyalty_cup_events_menu_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_tier_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  tier_code ENUM('kawan', 'dilamun', 'ketagih', 'legend') NOT NULL,
  qualifying_cups_last_180d INT UNSIGNED NOT NULL,
  effective_at DATETIME NOT NULL,
  reason_code VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_loyalty_tier_snapshots_user_effective_at (user_id, effective_at),
  KEY idx_loyalty_tier_snapshots_user_tier (user_id, tier_code),
  CONSTRAINT fk_loyalty_tier_snapshots_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voucher_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  voucher_type ENUM(
    'welcome',
    'tier_reward',
    'birthday_treat',
    'referral',
    'manual_recovery',
    'campaign_direct_pay',
    'campaign_token_equivalent'
  ) NOT NULL,
  discount_mode ENUM('fixed_rm', 'percent_rm', 'fixed_token', 'free_drink') NOT NULL,
  discount_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  token_value INT UNSIGNED NULL,
  min_spend_rm DECIMAL(12,2) NULL,
  eligible_scope_json JSON NOT NULL,
  exclude_scope_json JSON NULL,
  requires_drink_in_cart TINYINT(1) NOT NULL DEFAULT 0,
  stack_rule ENUM('primary_only', 'disallow_stack') NOT NULL DEFAULT 'primary_only',
  expires_in_days INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_voucher_templates_code (code),
  KEY idx_voucher_templates_type_active (voucher_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_vouchers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  voucher_template_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'redeemed', 'expired', 'revoked') NOT NULL DEFAULT 'active',
  issued_by_type ENUM('system', 'admin') NOT NULL DEFAULT 'system',
  issued_by_admin_id BIGINT UNSIGNED NULL,
  issued_reason VARCHAR(100) NOT NULL,
  issue_case_ref VARCHAR(100) NULL,
  tier_at_issue ENUM('kawan', 'dilamun', 'ketagih', 'legend') NULL,
  issued_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  redeemed_at DATETIME NULL,
  revoked_by_admin_id BIGINT UNSIGNED NULL,
  revoked_reason VARCHAR(255) NULL,
  revoked_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_user_vouchers_user_status_expires_at (user_id, status, expires_at),
  KEY idx_user_vouchers_template_id (voucher_template_id),
  KEY idx_user_vouchers_issued_by_admin_id (issued_by_admin_id),
  CONSTRAINT fk_user_vouchers_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_user_vouchers_template
    FOREIGN KEY (voucher_template_id) REFERENCES voucher_templates(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_user_vouchers_issued_by_admin
    FOREIGN KEY (issued_by_admin_id) REFERENCES admin_users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_user_vouchers_revoked_by_admin
    FOREIGN KEY (revoked_by_admin_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_voucher_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  discount_rm DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_token_amount INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_voucher_redemptions_order_id (order_id),
  KEY idx_voucher_redemptions_user_voucher_id (user_voucher_id),
  CONSTRAINT fk_voucher_redemptions_user_voucher
    FOREIGN KEY (user_voucher_id) REFERENCES user_vouchers(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_voucher_redemptions_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referrals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  referrer_user_id BIGINT UNSIGNED NOT NULL,
  referred_user_id BIGINT UNSIGNED NOT NULL,
  referral_code_snapshot VARCHAR(100) NOT NULL,
  status ENUM('pending', 'qualified', 'rewarded', 'rejected') NOT NULL DEFAULT 'pending',
  qualified_order_id BIGINT UNSIGNED NULL,
  qualified_at DATETIME NULL,
  rewarded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_referrals_referrer_referred (referrer_user_id, referred_user_id),
  KEY idx_referrals_referrer_status (referrer_user_id, status),
  KEY idx_referrals_referred_status (referred_user_id, status),
  CONSTRAINT fk_referrals_referrer
    FOREIGN KEY (referrer_user_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_referrals_referred
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_referrals_qualified_order
    FOREIGN KEY (qualified_order_id) REFERENCES orders(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If strict FK protection is required for orders.voucher_id, add it in a
-- follow-up migration after deployment order and legacy data are verified.
