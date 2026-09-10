-- A drink can use a shared option group while hiding choices that do not apply,
-- for example, keeping only Cold in the shared Temperature group.
CREATE TABLE IF NOT EXISTS menu_item_option_exclusions (
  menu_item_id BIGINT UNSIGNED NOT NULL,
  option_group_option_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (menu_item_id, option_group_option_id),
  KEY idx_menu_item_option_exclusions_option (option_group_option_id),
  CONSTRAINT fk_menu_item_option_exclusions_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_item_option_exclusions_option
    FOREIGN KEY (option_group_option_id) REFERENCES menu_option_group_options(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
