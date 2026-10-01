-- Reusable customer-facing drink options with pricing and nutrition deltas.
ALTER TABLE menu_items
  ADD COLUMN base_calories_kcal INT UNSIGNED NOT NULL DEFAULT 0 AFTER base_price_token;

CREATE TABLE IF NOT EXISTS menu_option_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  applies_to ENUM('all_drinks', 'selected_items') NOT NULL DEFAULT 'selected_items',
  selection_type ENUM('single', 'multi') NOT NULL DEFAULT 'single',
  min_select INT UNSIGNED NOT NULL DEFAULT 0,
  max_select INT UNSIGNED NOT NULL DEFAULT 1,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_menu_option_groups_tenant (tenant_id, is_active, sort_order),
  CONSTRAINT fk_menu_option_groups_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_option_group_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  option_group_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  price_delta_rm DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  token_price_delta INT NOT NULL DEFAULT 0,
  calorie_delta_kcal INT NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_menu_option_group_options_group (option_group_id, is_active, sort_order),
  CONSTRAINT fk_menu_option_group_options_group FOREIGN KEY (option_group_id) REFERENCES menu_option_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_option_group_items (
  option_group_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (option_group_id, menu_item_id),
  KEY idx_menu_option_group_items_item (menu_item_id),
  CONSTRAINT fk_menu_option_group_items_group FOREIGN KEY (option_group_id) REFERENCES menu_option_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_option_group_items_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
