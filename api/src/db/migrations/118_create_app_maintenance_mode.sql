CREATE TABLE IF NOT EXISTS app_maintenance_mode (
  tenant_id BIGINT UNSIGNED NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  allow_employee_bypass TINYINT(1) NOT NULL DEFAULT 1,
  title VARCHAR(160) NOT NULL DEFAULT 'C2 Coffee is under maintenance',
  message VARCHAR(600) NOT NULL DEFAULT 'We are making improvements. Please check back soon.',
  expected_end_at DATETIME NULL,
  updated_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id),
  KEY idx_app_maintenance_updated_by (updated_by_admin_user_id),
  CONSTRAINT fk_app_maintenance_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_app_maintenance_admin FOREIGN KEY (updated_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
