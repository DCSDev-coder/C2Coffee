ALTER TABLE referrals
  MODIFY status ENUM(
    'pending',
    'qualified',
    'rewarded',
    'rejected',
    'reversed',
    'reversal_review'
  ) NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS referral_reward_reversals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  referral_id BIGINT UNSIGNED NOT NULL,
  refunded_order_id BIGINT UNSIGNED NOT NULL,
  reward_side ENUM('friend','referrer') NOT NULL,
  status ENUM('reversed','needs_review','not_issued') NOT NULL,
  reason VARCHAR(255) NULL,
  reversed_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_referral_reward_reversal_side (referral_id, reward_side),
  KEY idx_referral_reward_reversals_status (status, created_at),
  CONSTRAINT fk_referral_reward_reversals_referral
    FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE CASCADE,
  CONSTRAINT fk_referral_reward_reversals_order
    FOREIGN KEY (refunded_order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_referral_reward_reversals_admin
    FOREIGN KEY (reversed_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
