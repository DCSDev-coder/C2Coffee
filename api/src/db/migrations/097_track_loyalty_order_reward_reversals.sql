-- Keep tier-unlock vouchers tied to the order that earned them so a later
-- order refund can revoke an unused reward without relying on timestamps.
CREATE TABLE IF NOT EXISTS loyalty_order_reward_issues (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  user_voucher_id BIGINT UNSIGNED NOT NULL,
  tier_code VARCHAR(50) NOT NULL,
  reversal_status ENUM('active','reversed','needs_review') NOT NULL DEFAULT 'active',
  reversal_reason VARCHAR(255) NULL,
  reversed_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reversed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_loyalty_order_reward_voucher (user_voucher_id),
  KEY idx_loyalty_order_reward_order (order_id, reversal_status),
  CONSTRAINT fk_loyalty_order_reward_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_loyalty_order_reward_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_loyalty_order_reward_voucher
    FOREIGN KEY (user_voucher_id) REFERENCES user_vouchers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_loyalty_order_reward_admin
    FOREIGN KEY (reversed_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
