-- Persist administrative review decisions without claiming payment settlement.

ALTER TABLE refunds
  MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  ADD COLUMN reviewed_by_admin_id BIGINT UNSIGNED NULL AFTER created_by_admin_id,
  ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by_admin_id,
  ADD KEY idx_refunds_status_created_at (status, created_at),
  ADD CONSTRAINT fk_refunds_reviewed_by_admin
    FOREIGN KEY (reviewed_by_admin_id) REFERENCES admin_users(id)
    ON DELETE SET NULL;
