-- Durable receipt-delivery state. A completed checkout must not depend on SMTP.

CREATE TABLE IF NOT EXISTS order_receipt_email_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  status ENUM('queued', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'queued',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  provider_message_id VARCHAR(255) NULL,
  last_error_code VARCHAR(100) NULL,
  queued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_receipt_email_order (order_id),
  KEY idx_order_receipt_email_status (status, updated_at),
  CONSTRAINT fk_order_receipt_email_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
