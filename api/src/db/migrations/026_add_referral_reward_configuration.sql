-- Durable referral codes and one explicit voucher template for referral rewards.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE voucher_templates
  ADD COLUMN is_referral_reward TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
  ADD KEY idx_voucher_templates_referral_reward (is_referral_reward, is_active);

CREATE TABLE IF NOT EXISTS user_referral_codes (
  user_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_referral_codes_code (code),
  CONSTRAINT fk_user_referral_codes_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill a stable, unique code for every existing customer.
INSERT IGNORE INTO user_referral_codes (user_id, code)
SELECT id, CONCAT('C2-', LPAD(id, 8, '0'))
FROM users;
