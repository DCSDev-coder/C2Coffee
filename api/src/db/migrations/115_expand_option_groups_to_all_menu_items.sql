-- Allow reusable option groups to target food, merchandise, and candle items.
ALTER TABLE menu_option_groups
  MODIFY COLUMN applies_to ENUM('all_drinks', 'all_items', 'selected_items')
  NOT NULL DEFAULT 'selected_items';
