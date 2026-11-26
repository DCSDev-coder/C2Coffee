-- StoreHub-style inventory additions: multi-unit conversions, stock alerts,
-- and tenant alert settings. Existing menu, option, and nutrition tables are
-- untouched.

CREATE TABLE IF NOT EXISTS inventory_item_units (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  unit_name VARCHAR(80) NOT NULL,
  factor_to_base DECIMAL(14,3) NOT NULL DEFAULT 1.000,
  allow_purchase TINYINT(1) NOT NULL DEFAULT 1,
  allow_count TINYINT(1) NOT NULL DEFAULT 1,
  allow_waste TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_inventory_item_unit (tenant_id, inventory_item_id, unit_name),
  KEY idx_inventory_item_units_item (inventory_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_alert_settings (
  tenant_id BIGINT UNSIGNED NOT NULL,
  email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  email_recipients_json JSON NULL,
  admin_web_enabled TINYINT(1) NOT NULL DEFAULT 1,
  barista_popup_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_by_admin_user_id BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_stock_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  alert_level ENUM('low', 'empty') NOT NULL,
  status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
  available_quantity_snapshot DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  reorder_level_snapshot DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  barista_action ENUM('pending', 'mark_out_of_stock', 'keep_available') NOT NULL DEFAULT 'pending',
  barista_responded_by_admin_user_id BIGINT UNSIGNED NULL,
  barista_responded_at DATETIME NULL,
  admin_acknowledged_by_admin_user_id BIGINT UNSIGNED NULL,
  admin_acknowledged_at DATETIME NULL,
  email_sent_at DATETIME NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_stock_alerts_open (tenant_id, store_id, status, alert_level),
  KEY idx_inventory_stock_alerts_item (store_id, inventory_item_id, status),
  KEY idx_inventory_stock_alerts_email (status, email_sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
