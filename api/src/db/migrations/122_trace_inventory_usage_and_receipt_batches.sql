-- Preserve the exact product and option usage applied to every order, keep
-- auditable recipe revisions, and capture supplier batch/expiry details.

CREATE TABLE inventory_recipe_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  scope_type ENUM('menu_item', 'option') NOT NULL,
  scope_id BIGINT UNSIGNED NOT NULL,
  revision_no INT UNSIGNED NOT NULL,
  components_json JSON NOT NULL,
  created_by_admin_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_recipe_revision (tenant_id, scope_type, scope_id, revision_no),
  KEY idx_inventory_recipe_revision_scope (tenant_id, scope_type, scope_id, created_at),
  CONSTRAINT fk_inventory_recipe_revision_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_recipe_revision_admin
    FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_order_usage_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  source_type ENUM('base_recipe', 'option_delta') NOT NULL,
  source_key VARCHAR(100) NOT NULL,
  source_label VARCHAR(255) NOT NULL,
  quantity_per_menu_unit DECIMAL(14,3) NOT NULL,
  ordered_menu_quantity INT UNSIGNED NOT NULL,
  total_quantity DECIMAL(14,3) NOT NULL,
  recipe_revision INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_order_usage_source
    (order_id, order_item_id, inventory_item_id, source_key),
  KEY idx_inventory_order_usage_order (tenant_id, store_id, order_id),
  KEY idx_inventory_order_usage_item (tenant_id, inventory_item_id, created_at),
  CONSTRAINT fk_inventory_order_usage_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_order_usage_store
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_order_usage_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_order_usage_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_order_usage_menu_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_order_usage_inventory_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE inventory_purchase_receipt_lines
  ADD COLUMN lot_number VARCHAR(120) NULL AFTER rejection_reason,
  ADD COLUMN expiry_date DATE NULL AFTER lot_number,
  ADD KEY idx_inventory_receipt_batch_expiry (lot_number, expiry_date);
