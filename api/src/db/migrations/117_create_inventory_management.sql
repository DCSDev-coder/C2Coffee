CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'ingredient',
  unit_code ENUM('piece', 'gram', 'millilitre') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_items_tenant_code (tenant_id, code),
  KEY idx_inventory_items_tenant_active_name (tenant_id, is_active, name),
  CONSTRAINT fk_inventory_items_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_store_stocks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  on_hand_quantity DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  reserved_quantity DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  reorder_level DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  average_unit_cost_rm DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_store_item (store_id, inventory_item_id),
  KEY idx_inventory_stock_tenant_store (tenant_id, store_id),
  KEY idx_inventory_stock_item (inventory_item_id),
  CONSTRAINT fk_inventory_stock_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_stock_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_stock_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_stock_nonnegative
    CHECK (on_hand_quantity >= 0 AND reserved_quantity >= 0 AND reserved_quantity <= on_hand_quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_menu_item_recipes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  quantity_per_menu_item DECIMAL(14,3) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_recipe_component (tenant_id, menu_item_id, inventory_item_id),
  KEY idx_inventory_recipe_menu_item (menu_item_id),
  KEY idx_inventory_recipe_inventory_item (inventory_item_id),
  CONSTRAINT fk_inventory_recipe_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_recipe_menu_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_inventory_recipe_inventory_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_recipe_positive CHECK (quantity_per_menu_item > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_order_allocations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  status ENUM('reserved', 'consumed', 'released', 'reversed') NOT NULL DEFAULT 'reserved',
  reserved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at DATETIME NULL,
  released_at DATETIME NULL,
  reversed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_allocation_order_item (order_id, inventory_item_id),
  KEY idx_inventory_allocation_tenant_store_status (tenant_id, store_id, status),
  KEY idx_inventory_allocation_item_status (inventory_item_id, status),
  CONSTRAINT fk_inventory_allocation_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_allocation_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_allocation_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_allocation_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_allocation_positive CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  movement_type ENUM('purchase', 'consumption', 'waste', 'adjustment', 'refund_reversal') NOT NULL,
  quantity_change DECIMAL(14,3) NOT NULL,
  unit_cost_rm DECIMAL(14,4) NULL,
  total_cost_rm DECIMAL(14,2) NULL,
  balance_after DECIMAL(14,3) NOT NULL,
  note VARCHAR(500) NULL,
  created_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_movement_order_type_item (order_id, movement_type, inventory_item_id),
  KEY idx_inventory_movements_tenant_store_date (tenant_id, store_id, created_at),
  KEY idx_inventory_movements_item_date (inventory_item_id, created_at),
  CONSTRAINT fk_inventory_movement_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movement_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movement_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movement_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movement_admin
    FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_inventory_movement_nonzero CHECK (quantity_change <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
