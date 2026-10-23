-- Central retention review queue. Destructive cleanup is deliberately limited
-- to temporary records and media that remains unreferenced after quarantine.

CREATE TABLE IF NOT EXISTS data_retention_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  record_type VARCHAR(80) NOT NULL,
  record_key VARCHAR(512) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  bytes_estimate BIGINT UNSIGNED NOT NULL DEFAULT 0,
  first_flagged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  review_due_at DATETIME NOT NULL,
  status ENUM('quarantined', 'kept', 'completed') NOT NULL DEFAULT 'quarantined',
  reviewed_by_admin_user_id BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  review_note VARCHAR(500) NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_data_retention_review_record (tenant_id, record_type, record_key),
  KEY idx_data_retention_review_due (tenant_id, status, review_due_at),
  CONSTRAINT fk_data_retention_review_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_data_retention_review_admin
    FOREIGN KEY (reviewed_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
