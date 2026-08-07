-- C2 Coffee Phase 1 migration 005
-- Orders, token reservations, payment records, webhooks, and refunds.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_ref VARCHAR(50) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  status ENUM(
    'draft',
    'pending_payment',
    'payment_failed',
    'paid',
    'accepted',
    'preparing',
    'ready_for_pickup',
    'collected',
    'cancelled',
    'refunded'
  ) NOT NULL DEFAULT 'draft',
  payment_mode ENUM('token', 'direct') NOT NULL,
  subtotal_rm DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  modifier_total_rm DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_total_rm DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  final_total_rm DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  token_amount_charged INT UNSIGNED NOT NULL DEFAULT 0,
  voucher_id BIGINT UNSIGNED NULL,
  pickup_slot_at DATETIME NOT NULL,
  paid_at DATETIME NULL,
  accepted_at DATETIME NULL,
  ready_at DATETIME NULL,
  collected_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  refunded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_ref (order_ref),
  KEY idx_orders_user_created_at (user_id, created_at),
  KEY idx_orders_store_status_pickup (store_id, status, pickup_slot_at),
  KEY idx_orders_status_created_at (status, created_at),
  KEY idx_orders_voucher_id (voucher_id),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS token_reservations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  amount_reserved INT UNSIGNED NOT NULL,
  status ENUM('active', 'released', 'committed') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at DATETIME NULL,
  committed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_reservations_order_id (order_id),
  KEY idx_token_reservations_user_status (user_id, status),
  CONSTRAINT fk_token_reservations_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_token_reservations_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  item_name_snapshot VARCHAR(255) NOT NULL,
  base_price_rm_snapshot DECIMAL(12,2) NOT NULL,
  token_price_snapshot INT UNSIGNED NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  line_subtotal_rm DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  line_token_amount INT UNSIGNED NULL,
  is_qualifying_cup TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_menu_item_id (menu_item_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_menu_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_item_id BIGINT UNSIGNED NOT NULL,
  modifier_group_name_snapshot VARCHAR(255) NOT NULL,
  modifier_option_name_snapshot VARCHAR(255) NOT NULL,
  price_delta_rm_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  token_price_delta_snapshot INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_order_item_modifiers_order_item_id (order_item_id),
  CONSTRAINT fk_order_item_modifiers_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  from_status ENUM(
    'draft',
    'pending_payment',
    'payment_failed',
    'paid',
    'accepted',
    'preparing',
    'ready_for_pickup',
    'collected',
    'cancelled',
    'refunded'
  ) NULL,
  to_status ENUM(
    'draft',
    'pending_payment',
    'payment_failed',
    'paid',
    'accepted',
    'preparing',
    'ready_for_pickup',
    'collected',
    'cancelled',
    'refunded'
  ) NOT NULL,
  changed_by_type VARCHAR(50) NOT NULL,
  changed_by_id BIGINT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_status_history_order_created_at (order_id, created_at),
  CONSTRAINT fk_order_status_history_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NULL,
  topup_id BIGINT UNSIGNED NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'billplz',
  provider_payment_ref VARCHAR(255) NOT NULL,
  provider_bill_id VARCHAR(255) NULL,
  amount_rm DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'authorized', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  failed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_provider_payment_ref (provider, provider_payment_ref),
  UNIQUE KEY uq_payments_provider_bill_id (provider, provider_bill_id),
  KEY idx_payments_order_id (order_id),
  KEY idx_payments_topup_id (topup_id),
  KEY idx_payments_status_created_at (status, created_at),
  CONSTRAINT fk_payments_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_payments_topup
    FOREIGN KEY (topup_id) REFERENCES token_topups(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id BIGINT UNSIGNED NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_payload_hash CHAR(64) NOT NULL,
  processed_at DATETIME NOT NULL,
  process_result VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_events_provider_event_id (provider_event_id),
  KEY idx_payment_events_payment_id (payment_id),
  CONSTRAINT fk_payment_events_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refunds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NULL,
  payment_mode ENUM('token', 'direct') NOT NULL,
  refund_ref VARCHAR(50) NOT NULL,
  refund_amount_rm DECIMAL(12,2) NULL,
  refund_token_amount INT UNSIGNED NULL,
  status ENUM('pending', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  reason VARCHAR(500) NOT NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refunds_refund_ref (refund_ref),
  KEY idx_refunds_order_created_at (order_id, created_at),
  KEY idx_refunds_payment_id (payment_id),
  CONSTRAINT fk_refunds_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_refunds_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_refunds_created_by_admin
    FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
