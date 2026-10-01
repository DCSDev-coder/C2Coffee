-- C2 Coffee Phase 1 migration 010
-- Tenant support for reusing the admin shell across multiple coffee shops.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS admin_tenants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  logo_asset_path VARCHAR(512) NULL,
  primary_color VARCHAR(32) NULL,
  secondary_color VARCHAR(32) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_tenants_code (code),
  KEY idx_admin_tenants_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_tenants (
  code,
  name,
  display_name,
  status,
  logo_asset_path,
  primary_color,
  secondary_color
)
VALUES (
  'c2coffee',
  'C2 Coffee',
  'C2 Coffee & Candle',
  'active',
  '/c2_logo.png',
  '#2E5E58',
  '#D4AF7A'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  display_name = VALUES(display_name),
  status = VALUES(status),
  logo_asset_path = VALUES(logo_asset_path),
  primary_color = VALUES(primary_color),
  secondary_color = VALUES(secondary_color);

ALTER TABLE admin_users
  ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id;

ALTER TABLE stores
  ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id;

UPDATE admin_users au
JOIN admin_tenants t ON t.code = 'c2coffee'
SET au.tenant_id = t.id
WHERE au.tenant_id IS NULL;

UPDATE stores s
JOIN admin_tenants t ON t.code = 'c2coffee'
SET s.tenant_id = t.id
WHERE s.tenant_id IS NULL;

ALTER TABLE admin_users
  MODIFY tenant_id BIGINT UNSIGNED NOT NULL,
  DROP INDEX uq_admin_users_email,
  DROP INDEX uq_admin_users_username,
  ADD UNIQUE KEY uq_admin_users_tenant_username (tenant_id, username),
  ADD UNIQUE KEY uq_admin_users_tenant_email (tenant_id, email),
  ADD KEY idx_admin_users_tenant_status_created_at (tenant_id, status, created_at),
  ADD CONSTRAINT fk_admin_users_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE RESTRICT;

ALTER TABLE stores
  MODIFY tenant_id BIGINT UNSIGNED NOT NULL,
  DROP INDEX uq_stores_code,
  ADD UNIQUE KEY uq_stores_tenant_code (tenant_id, code),
  ADD KEY idx_stores_tenant_status (tenant_id, status),
  ADD CONSTRAINT fk_stores_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE RESTRICT;

ALTER TABLE admin_sessions
  ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER admin_user_id;

UPDATE admin_sessions s
JOIN admin_users u ON u.id = s.admin_user_id
SET s.tenant_id = u.tenant_id
WHERE s.tenant_id IS NULL;

ALTER TABLE admin_sessions
  MODIFY tenant_id BIGINT UNSIGNED NOT NULL,
  ADD KEY idx_admin_sessions_tenant_expires_at (tenant_id, expires_at),
  ADD CONSTRAINT fk_admin_sessions_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE RESTRICT;

UPDATE admin_users
SET tenant_id = (SELECT id FROM admin_tenants WHERE code = 'c2coffee' LIMIT 1)
WHERE username = 'Boss';
