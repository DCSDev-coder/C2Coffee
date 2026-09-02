CREATE TABLE IF NOT EXISTS home_featured_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_code ENUM('featured_drinks', 'lifestyle_picks') NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_home_featured_section_slot (section_code, sort_order),
  UNIQUE KEY uq_home_featured_section_item (section_code, menu_item_id),
  CONSTRAINT fk_home_featured_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
