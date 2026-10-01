CREATE TABLE IF NOT EXISTS home_featured_category_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_home_featured_category_item (category_id, menu_item_id),
  KEY idx_home_featured_category_sort (category_id, sort_order),
  CONSTRAINT fk_home_featured_category_item_category
    FOREIGN KEY (category_id) REFERENCES menu_categories(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_home_featured_category_item_menu_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Keep all existing Home picks by placing each item in its actual menu category.
INSERT IGNORE INTO home_featured_category_items (category_id, menu_item_id, sort_order)
SELECT i.category_id, h.menu_item_id, h.sort_order
FROM home_featured_items h
JOIN menu_items i ON i.id = h.menu_item_id;
