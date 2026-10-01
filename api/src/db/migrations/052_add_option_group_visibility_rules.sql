-- Admin-defined conditional visibility for reusable drink option groups.
CREATE TABLE IF NOT EXISTS menu_option_group_visibility_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  option_group_id BIGINT UNSIGNED NOT NULL,
  trigger_option_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_option_group_visibility_rule (option_group_id, trigger_option_id),
  KEY idx_menu_option_group_visibility_trigger (trigger_option_id),
  CONSTRAINT fk_menu_option_group_visibility_group
    FOREIGN KEY (option_group_id) REFERENCES menu_option_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_option_group_visibility_trigger
    FOREIGN KEY (trigger_option_id) REFERENCES menu_option_group_options(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
