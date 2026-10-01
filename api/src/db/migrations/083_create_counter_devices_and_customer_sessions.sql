-- Counter devices are tenant/store-bound kiosks. Their opaque tokens are
-- stored only as hashes so a leaked database cannot authenticate a kiosk.

CREATE TABLE IF NOT EXISTS counter_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  status ENUM('active', 'inactive', 'revoked') NOT NULL DEFAULT 'active',
  last_seen_at DATETIME NULL,
  created_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_counter_devices_token_hash (token_hash),
  UNIQUE KEY uq_counter_devices_tenant_label (tenant_id, label),
  KEY idx_counter_devices_tenant_store_status (tenant_id, store_id, status),
  CONSTRAINT fk_counter_devices_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_counter_devices_store
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_counter_devices_creator
    FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS counter_customer_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  counter_device_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_counter_customer_sessions_token_hash (token_hash),
  KEY idx_counter_customer_sessions_device_expiry (counter_device_id, expires_at),
  KEY idx_counter_customer_sessions_user_expiry (user_id, expires_at),
  CONSTRAINT fk_counter_customer_sessions_device
    FOREIGN KEY (counter_device_id) REFERENCES counter_devices(id) ON DELETE CASCADE,
  CONSTRAINT fk_counter_customer_sessions_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_counter_customer_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
