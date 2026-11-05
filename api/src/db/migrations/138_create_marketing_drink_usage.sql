-- Auditable complimentary/marketing drink usage recorded by an active barista.
-- These records are deliberately separate from customer orders, vouchers,
-- loyalty cups, and employee token allowances.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE marketing_drink_usages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usage_ref VARCHAR(40) NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  barista_id INT NOT NULL,
  recorded_by_admin_user_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  purpose_code ENUM('sampling', 'campaign', 'content_production', 'influencer', 'goodwill', 'other') NOT NULL,
  campaign_name VARCHAR(160) NULL,
  reason_note VARCHAR(500) NOT NULL,
  status ENUM('posted', 'reversed') NOT NULL DEFAULT 'posted',
  posted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reversed_at DATETIME NULL,
  reversed_by_admin_user_id BIGINT UNSIGNED NULL,
  reversal_reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marketing_drink_usage_ref (usage_ref),
  UNIQUE KEY uq_marketing_drink_usage_idempotency (tenant_id, idempotency_key),
  KEY idx_marketing_drink_usage_report (tenant_id, posted_at, store_id, purpose_code),
  CONSTRAINT fk_marketing_drink_usage_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_marketing_drink_usage_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_marketing_drink_usage_barista FOREIGN KEY (barista_id) REFERENCES baristas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_marketing_drink_usage_recorder FOREIGN KEY (recorded_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_marketing_drink_usage_reverser FOREIGN KEY (reversed_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE marketing_drink_usage_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usage_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  menu_item_name_snapshot VARCHAR(255) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price_rm_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marketing_drink_usage_item (usage_id, menu_item_id),
  CONSTRAINT fk_marketing_drink_item_usage FOREIGN KEY (usage_id) REFERENCES marketing_drink_usages(id) ON DELETE RESTRICT,
  CONSTRAINT fk_marketing_drink_item_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_marketing_drink_item_quantity CHECK (quantity BETWEEN 1 AND 99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE marketing_drink_inventory_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usage_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit_cost_rm DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  total_cost_rm DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status ENUM('consumed', 'reversed') NOT NULL DEFAULT 'consumed',
  reversed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marketing_drink_inventory_item (usage_id, inventory_item_id),
  CONSTRAINT fk_marketing_drink_inventory_usage FOREIGN KEY (usage_id) REFERENCES marketing_drink_usages(id) ON DELETE RESTRICT,
  CONSTRAINT fk_marketing_drink_inventory_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_marketing_drink_inventory_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE inventory_movements
  ADD COLUMN marketing_drink_usage_id BIGINT UNSIGNED NULL AFTER order_id,
  ADD KEY idx_inventory_movement_marketing_usage (marketing_drink_usage_id),
  ADD CONSTRAINT fk_inventory_movement_marketing_usage
    FOREIGN KEY (marketing_drink_usage_id) REFERENCES marketing_drink_usages(id) ON DELETE RESTRICT,
  MODIFY COLUMN movement_type ENUM(
    'purchase', 'purchase_receive', 'consumption', 'waste', 'adjustment',
    'refund_reversal', 'transfer_out', 'transfer_in',
    'stocktake_adjustment', 'supplier_return',
    'marketing_consumption', 'marketing_reversal'
  ) NOT NULL,
  ADD UNIQUE KEY uq_inventory_movement_marketing_type_item
    (marketing_drink_usage_id, movement_type, inventory_item_id);
