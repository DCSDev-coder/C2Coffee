SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @product_kind_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'menu_categories'
    AND column_name = 'product_kind_code'
);

SET @sql := IF(
  @product_kind_column_exists = 0,
  'ALTER TABLE menu_categories ADD COLUMN product_kind_code VARCHAR(50) NOT NULL DEFAULT ''drink'' AFTER name',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE menu_categories
SET product_kind_code = CASE
  WHEN LOWER(code) IN ('coffee', 'non_coffee') THEN 'drink'
  WHEN LOWER(code) = 'food' THEN 'food'
  WHEN LOWER(code) = 'merchandise' THEN 'merchandise'
  WHEN LOWER(code) = 'candles' THEN 'candle'
  ELSE COALESCE(NULLIF(product_kind_code, ''), 'other')
END;

CREATE INDEX idx_menu_categories_product_kind
  ON menu_categories (product_kind_code, is_active, sort_order);
