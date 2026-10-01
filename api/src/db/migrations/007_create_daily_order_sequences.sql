-- C2 Coffee Phase 1 migration 007
-- Daily store order numbers for easy barista tracing.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE orders
  ADD COLUMN daily_order_number INT UNSIGNED NOT NULL DEFAULT 0 AFTER order_ref;

CREATE TABLE IF NOT EXISTS store_daily_order_sequences (
  sequence_date DATE NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  next_number INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sequence_date, store_id),
  KEY idx_store_daily_order_sequences_store_date (store_id, sequence_date),
  CONSTRAINT fk_store_daily_order_sequences_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
