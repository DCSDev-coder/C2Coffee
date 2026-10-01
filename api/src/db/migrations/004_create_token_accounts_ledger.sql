-- C2 Coffee Phase 1 migration 004
-- Closed-loop token accounts, top-ups, token lots, and immutable ledger.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS token_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  balance_available INT UNSIGNED NOT NULL DEFAULT 0,
  balance_reserved INT UNSIGNED NOT NULL DEFAULT 0,
  balance_cap INT UNSIGNED NOT NULL DEFAULT 500,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_accounts_user_id (user_id),
  CONSTRAINT fk_token_accounts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS token_topups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  topup_ref VARCHAR(50) NOT NULL,
  token_amount INT UNSIGNED NOT NULL,
  rm_amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending_payment', 'paid', 'failed', 'cancelled') NOT NULL DEFAULT 'pending_payment',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_topups_ref (topup_ref),
  KEY idx_token_topups_user_created_at (user_id, created_at),
  KEY idx_token_topups_status_created_at (status, created_at),
  CONSTRAINT fk_token_topups_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS token_lots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  source_topup_id BIGINT UNSIGNED NOT NULL,
  original_amount INT UNSIGNED NOT NULL,
  remaining_amount INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  status ENUM('active', 'fully_spent', 'expired') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_token_lots_user_status_expires_at (user_id, status, expires_at),
  KEY idx_token_lots_source_topup_id (source_topup_id),
  CONSTRAINT fk_token_lots_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_token_lots_source_topup
    FOREIGN KEY (source_topup_id) REFERENCES token_topups(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS token_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_lot_id BIGINT UNSIGNED NULL,
  direction ENUM('credit', 'debit') NOT NULL,
  source_type ENUM(
    'topup_paid',
    'order_spend',
    'refund_return',
    'expiry',
    'admin_adjustment',
    'promo_credit',
    'voucher_subsidy'
  ) NOT NULL,
  source_id BIGINT UNSIGNED NOT NULL,
  amount INT UNSIGNED NOT NULL,
  balance_after INT UNSIGNED NOT NULL,
  remarks VARCHAR(500) NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_token_ledger_user_created_at (user_id, created_at),
  KEY idx_token_ledger_source (source_type, source_id),
  KEY idx_token_ledger_token_lot_id (token_lot_id),
  CONSTRAINT fk_token_ledger_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_token_ledger_token_lot
    FOREIGN KEY (token_lot_id) REFERENCES token_lots(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_token_ledger_created_by_admin
    FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
