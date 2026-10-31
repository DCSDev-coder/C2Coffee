-- Inventory operations expansion: replenishment, suppliers, transfers,
-- controlled stock counts, wastage/returns, modifier recipes, and cost history.

ALTER TABLE inventory_store_stocks
  ADD COLUMN ideal_stock_level DECIMAL(14,3) NOT NULL DEFAULT 0.000 AFTER reorder_level;

ALTER TABLE inventory_items
  ADD COLUMN purchase_unit_name VARCHAR(80) NULL AFTER unit_code,
  ADD COLUMN purchase_to_stock_factor DECIMAL(14,3) NOT NULL DEFAULT 1.000 AFTER purchase_unit_name;

ALTER TABLE order_item_modifiers
  ADD COLUMN option_group_option_id BIGINT UNSIGNED NULL AFTER order_item_id,
  ADD KEY idx_order_item_modifier_option (option_group_option_id),
  ADD CONSTRAINT fk_order_item_modifier_option
    FOREIGN KEY (option_group_option_id) REFERENCES menu_option_group_options(id)
    ON DELETE SET NULL;

ALTER TABLE inventory_movements
  MODIFY COLUMN movement_type ENUM(
    'purchase', 'purchase_receive', 'consumption', 'waste', 'adjustment',
    'refund_reversal', 'transfer_out', 'transfer_in',
    'stocktake_adjustment', 'supplier_return'
  ) NOT NULL;

CREATE TABLE inventory_suppliers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(80) NULL,
  notes VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_supplier_code (tenant_id, code),
  KEY idx_inventory_supplier_tenant_active (tenant_id, is_active, name),
  CONSTRAINT fk_inventory_supplier_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_supplier_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  supplier_sku VARCHAR(120) NULL,
  purchase_unit_name VARCHAR(80) NOT NULL,
  stock_units_per_purchase_unit DECIMAL(14,3) NOT NULL DEFAULT 1.000,
  latest_purchase_unit_cost_rm DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  minimum_order_quantity DECIMAL(14,3) NOT NULL DEFAULT 1.000,
  is_preferred TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_supplier_item (supplier_id, inventory_item_id),
  KEY idx_inventory_supplier_item_tenant (tenant_id, inventory_item_id),
  CONSTRAINT fk_inventory_supplier_item_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_supplier_item_supplier
    FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_supplier_item_inventory
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_supplier_conversion
    CHECK (stock_units_per_purchase_unit > 0 AND minimum_order_quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_purchase_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  purchase_order_ref VARCHAR(80) NOT NULL,
  status ENUM('draft', 'submitted', 'partially_received', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
  expected_at DATETIME NULL,
  submitted_at DATETIME NULL,
  received_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  notes VARCHAR(500) NULL,
  created_by_admin_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_po_ref (tenant_id, purchase_order_ref),
  KEY idx_inventory_po_store_status (tenant_id, store_id, status, created_at),
  CONSTRAINT fk_inventory_po_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_po_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_po_supplier FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_po_admin FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_purchase_order_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  ordered_purchase_units DECIMAL(14,3) NOT NULL,
  received_purchase_units DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  stock_units_per_purchase_unit DECIMAL(14,3) NOT NULL,
  purchase_unit_name VARCHAR(80) NOT NULL,
  purchase_unit_cost_rm DECIMAL(14,4) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_po_line_item (purchase_order_id, inventory_item_id),
  KEY idx_inventory_po_line_item (inventory_item_id),
  CONSTRAINT fk_inventory_po_line_order FOREIGN KEY (purchase_order_id) REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_po_line_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_po_line_quantities CHECK (
    ordered_purchase_units > 0 AND received_purchase_units >= 0
    AND received_purchase_units <= ordered_purchase_units
    AND stock_units_per_purchase_unit > 0 AND purchase_unit_cost_rm >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_supplier_cost_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  purchase_order_line_id BIGINT UNSIGNED NULL,
  purchase_unit_name VARCHAR(80) NOT NULL,
  stock_units_per_purchase_unit DECIMAL(14,3) NOT NULL,
  purchase_unit_cost_rm DECIMAL(14,4) NOT NULL,
  effective_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_cost_item_date (tenant_id, inventory_item_id, effective_at),
  KEY idx_inventory_cost_supplier_date (supplier_id, effective_at),
  CONSTRAINT fk_inventory_cost_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_cost_supplier FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_cost_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_cost_po_line FOREIGN KEY (purchase_order_line_id) REFERENCES inventory_purchase_order_lines(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_stock_transfers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  from_store_id BIGINT UNSIGNED NOT NULL,
  to_store_id BIGINT UNSIGNED NOT NULL,
  transfer_ref VARCHAR(80) NOT NULL,
  status ENUM('draft', 'submitted', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
  notes VARCHAR(500) NULL,
  submitted_at DATETIME NULL,
  received_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_by_admin_user_id BIGINT UNSIGNED NOT NULL,
  received_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_transfer_ref (tenant_id, transfer_ref),
  KEY idx_inventory_transfer_status (tenant_id, status, created_at),
  CONSTRAINT fk_inventory_transfer_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_transfer_from FOREIGN KEY (from_store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_transfer_to FOREIGN KEY (to_store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_transfer_admin FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_transfer_receiver FOREIGN KEY (received_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT chk_inventory_transfer_stores CHECK (from_store_id <> to_store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_stock_transfer_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transfer_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit_cost_rm_snapshot DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_transfer_line (transfer_id, inventory_item_id),
  CONSTRAINT fk_inventory_transfer_line_header FOREIGN KEY (transfer_id) REFERENCES inventory_stock_transfers(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_transfer_line_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_transfer_line_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_stocktakes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  stocktake_ref VARCHAR(80) NOT NULL,
  status ENUM('draft', 'submitted', 'approved', 'cancelled') NOT NULL DEFAULT 'draft',
  notes VARCHAR(500) NULL,
  submitted_at DATETIME NULL,
  approved_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_by_admin_user_id BIGINT UNSIGNED NOT NULL,
  approved_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_stocktake_ref (tenant_id, stocktake_ref),
  KEY idx_inventory_stocktake_status (tenant_id, store_id, status, created_at),
  CONSTRAINT fk_inventory_stocktake_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_stocktake_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_stocktake_admin FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_stocktake_approver FOREIGN KEY (approved_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_stocktake_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stocktake_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  expected_quantity DECIMAL(14,3) NOT NULL,
  counted_quantity DECIMAL(14,3) NOT NULL,
  variance_quantity DECIMAL(14,3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_stocktake_line (stocktake_id, inventory_item_id),
  CONSTRAINT fk_inventory_stocktake_line_header FOREIGN KEY (stocktake_id) REFERENCES inventory_stocktakes(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_stocktake_line_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_stocktake_count CHECK (expected_quantity >= 0 AND counted_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_wastage_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  reason_code ENUM('expired', 'damaged', 'spillage', 'quality', 'staff_use', 'other') NOT NULL,
  note VARCHAR(500) NULL,
  movement_id BIGINT UNSIGNED NOT NULL,
  created_by_admin_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_wastage_date (tenant_id, store_id, created_at),
  CONSTRAINT fk_inventory_wastage_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_wastage_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_wastage_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_wastage_movement FOREIGN KEY (movement_id) REFERENCES inventory_movements(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_wastage_admin FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_wastage_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_supplier_returns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  return_ref VARCHAR(80) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  movement_id BIGINT UNSIGNED NOT NULL,
  created_by_admin_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_supplier_return_ref (tenant_id, return_ref),
  KEY idx_inventory_supplier_return_date (tenant_id, store_id, created_at),
  CONSTRAINT fk_inventory_return_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_return_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_return_supplier FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_return_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_return_movement FOREIGN KEY (movement_id) REFERENCES inventory_movements(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_return_admin FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_return_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_option_recipes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  option_group_option_id BIGINT UNSIGNED NOT NULL,
  inventory_item_id BIGINT UNSIGNED NOT NULL,
  quantity_delta DECIMAL(14,3) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_option_recipe (tenant_id, option_group_option_id, inventory_item_id),
  KEY idx_inventory_option_recipe_item (inventory_item_id),
  CONSTRAINT fk_inventory_option_recipe_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_option_recipe_option FOREIGN KEY (option_group_option_id) REFERENCES menu_option_group_options(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_option_recipe_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_option_recipe_nonzero CHECK (quantity_delta <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
