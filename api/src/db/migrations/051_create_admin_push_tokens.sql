-- Push notification registrations for authenticated staff devices.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS admin_push_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  platform ENUM('android', 'ios') NOT NULL,
  push_token VARCHAR(512) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_push_tokens_push_token (push_token),
  KEY idx_admin_push_tokens_tenant_status (tenant_id, status),
  KEY idx_admin_push_tokens_user_status (admin_user_id, status),
  CONSTRAINT fk_admin_push_tokens_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_admin_push_tokens_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
