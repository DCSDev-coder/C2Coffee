-- Keep customer cancellation requests separate from the order lifecycle so
-- every request and decision remains auditable without mutating a paid order
-- before the store has reviewed it.
CREATE TABLE order_cancellation_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'refund_pending', 'completed', 'withdrawn') NOT NULL DEFAULT 'pending',
  reason VARCHAR(500) NOT NULL,
  review_reason VARCHAR(500) NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewed_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_cancellation_request (order_id),
  KEY idx_order_cancellation_request_queue (status, requested_at),
  KEY idx_order_cancellation_request_user (user_id, created_at),
  CONSTRAINT fk_order_cancellation_request_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_cancellation_request_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_cancellation_request_admin
    FOREIGN KEY (reviewed_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
