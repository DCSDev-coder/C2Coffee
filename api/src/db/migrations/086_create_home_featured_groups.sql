CREATE TABLE IF NOT EXISTS home_featured_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  selection_mode ENUM('automatic', 'manual', 'mixed') NOT NULL DEFAULT 'automatic',
  category_ids_json JSON NOT NULL,
  item_ids_json JSON NOT NULL,
  display_limit TINYINT UNSIGNED NOT NULL DEFAULT 6,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_home_featured_groups_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
