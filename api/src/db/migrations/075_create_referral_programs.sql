-- Referral campaigns are tenant-owned and snapshot their terms at claim time.
CREATE TABLE IF NOT EXISTS referral_programs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  status ENUM('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
  friend_reward_type ENUM('voucher','token') NOT NULL,
  friend_voucher_template_id BIGINT UNSIGNED NULL,
  friend_token_amount INT UNSIGNED NULL,
  referrer_reward_type ENUM('voucher','token') NOT NULL,
  referrer_voucher_template_id BIGINT UNSIGNED NULL,
  referrer_token_amount INT UNSIGNED NULL,
  qualification_days INT UNSIGNED NOT NULL DEFAULT 14,
  monthly_referrer_limit INT UNSIGNED NOT NULL DEFAULT 10,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_referral_programs_tenant_status (tenant_id, status),
  CONSTRAINT fk_referral_programs_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_referral_programs_friend_voucher FOREIGN KEY (friend_voucher_template_id) REFERENCES voucher_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_referral_programs_referrer_voucher FOREIGN KEY (referrer_voucher_template_id) REFERENCES voucher_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE referrals
  ADD COLUMN referral_program_id BIGINT UNSIGNED NULL AFTER id,
  ADD COLUMN program_snapshot_json JSON NULL AFTER referral_program_id,
  ADD COLUMN qualification_expires_at DATETIME NULL AFTER created_at,
  ADD KEY idx_referrals_program_status (referral_program_id, status),
  ADD CONSTRAINT fk_referrals_program FOREIGN KEY (referral_program_id) REFERENCES referral_programs(id) ON DELETE SET NULL;

ALTER TABLE token_ledger
  MODIFY source_type ENUM('topup_paid','order_spend','refund_return','expiry','admin_adjustment','promo_credit','voucher_subsidy','referral_reward') NOT NULL;
