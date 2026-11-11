-- Audited repair path for token orders created with a historical price that
-- differs from the configured menu base token price. The original amount is
-- retained here while orders.token_amount_charged becomes the corrected net
-- amount used by operational and finance reporting.

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
    'employee_allowance_expiry',
    'employee_allowance_role_revoke',
    'employee_allowance_role_restore',
    'order_price_correction'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS order_price_corrections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  original_token_amount INT UNSIGNED NOT NULL,
  corrected_token_amount INT UNSIGNED NOT NULL,
  correction_token_amount INT UNSIGNED NOT NULL,
  subsidy_token_amount INT UNSIGNED NOT NULL DEFAULT 0,
  personal_token_amount INT UNSIGNED NOT NULL DEFAULT 0,
  wallet_credit_amount INT UNSIGNED NOT NULL DEFAULT 0,
  historical_gross_token_amount INT UNSIGNED NOT NULL,
  corrected_gross_token_amount INT UNSIGNED NOT NULL,
  preserved_deduction_token_amount INT UNSIGNED NOT NULL DEFAULT 0,
  calculation_json JSON NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_price_correction_order (order_id),
  KEY idx_order_price_correction_tenant_created (tenant_id, created_at),
  CONSTRAINT fk_order_price_correction_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_price_correction_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_price_correction_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
