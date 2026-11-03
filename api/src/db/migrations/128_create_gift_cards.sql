-- Stored-value gift cards are deliberately separate from vouchers and token wallets.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS gift_cards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(40) NOT NULL,
  currency ENUM('rm', 'token') NOT NULL,
  original_amount DECIMAL(12,2) NOT NULL,
  remaining_amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending_payment', 'active', 'suspended', 'depleted', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
  purchaser_user_id BIGINT UNSIGNED NULL,
  recipient_user_id BIGINT UNSIGNED NULL,
  recipient_phone VARCHAR(30) NULL,
  recipient_message VARCHAR(280) NULL,
  purchase_ref VARCHAR(60) NULL,
  expires_at DATETIME NULL,
  claimed_at DATETIME NULL,
  paid_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gift_cards_code (code),
  UNIQUE KEY uq_gift_cards_purchase_ref (purchase_ref),
  KEY idx_gift_cards_tenant_status (tenant_id, status, created_at),
  KEY idx_gift_cards_recipient (recipient_user_id, status, created_at),
  KEY idx_gift_cards_purchaser (purchaser_user_id, created_at),
  CONSTRAINT fk_gift_cards_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_gift_cards_purchaser FOREIGN KEY (purchaser_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gift_cards_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gift_cards_admin FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT chk_gift_cards_amounts CHECK (original_amount > 0 AND remaining_amount >= 0 AND remaining_amount <= original_amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  gift_card_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('issued', 'claimed', 'redeemed', 'reversed', 'adjusted', 'cancelled') NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  balance_after DECIMAL(12,2) NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_admin_id BIGINT UNSIGNED NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_gift_card_transactions_card (gift_card_id, created_at),
  KEY idx_gift_card_transactions_order (order_id),
  CONSTRAINT fk_gift_card_transactions_card FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id) ON DELETE RESTRICT,
  CONSTRAINT fk_gift_card_transactions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_gift_card_transactions_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gift_card_transactions_admin FOREIGN KEY (actor_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE payments
  ADD COLUMN gift_card_id BIGINT UNSIGNED NULL AFTER topup_id,
  ADD KEY idx_payments_gift_card_id (gift_card_id),
  ADD CONSTRAINT fk_payments_gift_card FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN gift_card_id BIGINT UNSIGNED NULL AFTER voucher_id,
  ADD COLUMN gift_card_amount_rm DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER gift_card_id,
  ADD COLUMN gift_card_token_amount INT UNSIGNED NOT NULL DEFAULT 0 AFTER gift_card_amount_rm,
  ADD KEY idx_orders_gift_card_id (gift_card_id),
  ADD CONSTRAINT fk_orders_gift_card FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id) ON DELETE SET NULL;

ALTER TABLE token_ledger
  MODIFY source_type ENUM(
    'topup_paid', 'topup_refund', 'order_spend', 'refund_return', 'expiry',
    'admin_adjustment', 'promo_credit', 'voucher_subsidy', 'referral_reward',
    'referral_reversal', 'gift_card_purchase'
  ) NOT NULL;
