-- Monthly company-funded employee token allowance.
-- Allowance value is kept separate from customer-paid token lots through an
-- issuance/spend ledger while the customer-facing account remains one balance.

ALTER TABLE token_ledger
  MODIFY source_type ENUM(
    'topup_paid',
    'topup_refund',
    'order_spend',
    'refund_return',
    'expiry',
    'admin_adjustment',
    'promo_credit',
    'voucher_subsidy',
    'referral_reward',
    'referral_reversal',
    'gift_card_purchase',
    'gift_card_redemption',
    'employee_allowance_issue',
    'employee_allowance_spend',
    'employee_allowance_expiry'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS employee_token_allowances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  granted_amount INT UNSIGNED NOT NULL DEFAULT 200,
  remaining_amount INT UNSIGNED NOT NULL DEFAULT 200,
  status ENUM('active', 'fully_spent', 'expired', 'revoked') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_allowance_period (tenant_id, user_id, period_start),
  KEY idx_employee_allowance_active (tenant_id, user_id, status, period_end),
  CONSTRAINT fk_employee_allowance_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_employee_allowance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders
  ADD COLUMN employee_allowance_tokens_used INT UNSIGNED NOT NULL DEFAULT 0 AFTER token_amount_charged;
