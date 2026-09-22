-- Recipe nutrition is tenant-scoped and versioned so historic orders retain
-- their checkout snapshots while a cafe can safely revise a drink recipe.
CREATE TABLE IF NOT EXISTS nutrition_ingredients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255) NULL,
  unit ENUM('g', 'ml') NOT NULL,
  calories_per_100_units DECIMAL(10,2) NOT NULL DEFAULT 0,
  protein_g_per_100_units DECIMAL(10,2) NOT NULL DEFAULT 0,
  carbs_g_per_100_units DECIMAL(10,2) NOT NULL DEFAULT 0,
  fat_g_per_100_units DECIMAL(10,2) NOT NULL DEFAULT 0,
  source_reference VARCHAR(512) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_nutrition_ingredient_name (tenant_id, name, brand),
  KEY idx_nutrition_ingredient_tenant_active (tenant_id, is_active),
  CONSTRAINT fk_nutrition_ingredients_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_item_recipe_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'draft',
  notes VARCHAR(1000) NULL,
  created_by_admin_user_id BIGINT UNSIGNED NULL,
  activated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_recipe_version (menu_item_id, version_no),
  KEY idx_menu_recipe_active (menu_item_id, status),
  CONSTRAINT fk_menu_recipe_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_recipe_creator FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_item_recipe_components (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipe_version_id BIGINT UNSIGNED NOT NULL,
  ingredient_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_recipe_component_recipe (recipe_version_id, sort_order),
  CONSTRAINT fk_recipe_component_recipe FOREIGN KEY (recipe_version_id) REFERENCES menu_item_recipe_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_recipe_component_ingredient FOREIGN KEY (ingredient_id) REFERENCES nutrition_ingredients(id) ON DELETE RESTRICT,
  CONSTRAINT chk_recipe_component_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A milk (or any customer option) can have a different nutrition amount per
-- drink without changing the shared option's price or default nutrition.
CREATE TABLE IF NOT EXISTS menu_item_option_nutrition_overrides (
  menu_item_id BIGINT UNSIGNED NOT NULL,
  option_group_option_id BIGINT UNSIGNED NOT NULL,
  calorie_delta_kcal INT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (menu_item_id, option_group_option_id),
  CONSTRAINT fk_option_nutrition_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_option_nutrition_option FOREIGN KEY (option_group_option_id) REFERENCES menu_option_group_options(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
