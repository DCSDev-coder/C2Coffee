-- Add menu subcategories so drinks/food/lifestyle items can share one
-- broad category while still being grouped precisely for vouchers and tiers.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS menu_subcategories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_menu_subcategories_code (code),
  KEY idx_menu_subcategories_category_sort (category_id, is_active, sort_order),
  CONSTRAINT fk_menu_subcategories_category
    FOREIGN KEY (category_id) REFERENCES menu_categories(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE menu_items
  ADD COLUMN subcategory_id BIGINT UNSIGNED NULL AFTER category_id,
  ADD KEY idx_menu_items_subcategory_sort (subcategory_id, sort_order),
  ADD CONSTRAINT fk_menu_items_subcategory
    FOREIGN KEY (subcategory_id) REFERENCES menu_subcategories(id)
    ON DELETE RESTRICT;

INSERT INTO menu_subcategories (category_id, code, name, sort_order, is_active)
SELECT c.id, seeded.code, seeded.name, seeded.sort_order, 1
FROM (
  SELECT 'coffee' AS category_code, 'barista_craft' AS code, 'Barista Craft' AS name, 10 AS sort_order
  UNION ALL SELECT 'coffee', 'coffee', 'Coffee', 20
  UNION ALL SELECT 'coffee', 'flavoured_coffee', 'Flavoured Coffee', 30
  UNION ALL SELECT 'coffee', 'pour_over', 'Pour Over', 40
  UNION ALL SELECT 'non_coffee', 'matcha', 'Matcha', 10
  UNION ALL SELECT 'non_coffee', 'chocolate', 'Chocolate', 20
  UNION ALL SELECT 'non_coffee', 'milkshake', 'Milkshake', 30
  UNION ALL SELECT 'non_coffee', 'sparkling', 'Sparkling', 40
  UNION ALL SELECT 'non_coffee', 'mocktails', 'Mocktails', 50
  UNION ALL SELECT 'food', 'pastries', 'Pastries', 10
  UNION ALL SELECT 'merchandise', 'merchandise', 'Merchandise', 10
  UNION ALL SELECT 'candles', 'candles', 'Candles', 10
) seeded
JOIN menu_categories c
  ON c.code = seeded.category_code
ON DUPLICATE KEY UPDATE
  category_id = VALUES(category_id),
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);

UPDATE menu_items i
JOIN menu_categories c ON c.id = i.category_id
LEFT JOIN menu_subcategories s ON s.id = i.subcategory_id
SET i.subcategory_id = (
  SELECT ms.id
  FROM menu_subcategories ms
  WHERE ms.code = CASE
    WHEN LOWER(i.name) IN ('mont broga', 'shakerato bianco', 'yuzukano', 'senja di broga', 'espresso bomb') THEN 'barista_craft'
    WHEN LOWER(i.name) IN ('v60 brew') THEN 'pour_over'
    WHEN LOWER(i.name) IN ('espresso', 'pocco locco', 'latte', 'flat white', 'cappuccino') THEN 'coffee'
    WHEN LOWER(i.name) IN ('butterscotch latte', 'hazelnut latte', 'vanilla latte', 'blue cloud coconut coffee', 'mocha') THEN 'flavoured_coffee'
    WHEN LOWER(i.name) IN ('matcha latte', 'monkey matcha', 'pinky promise matcha') THEN 'matcha'
    WHEN LOWER(i.name) IN ('milk chocolate', 'nutty chocolate') THEN 'chocolate'
    WHEN LOWER(i.name) IN ('pinky blush milkshake by syah', 'paddle pop') THEN 'milkshake'
    WHEN LOWER(i.name) IN ('boijito', 'fuji fizz', 'spicy mimosa') THEN 'mocktails'
    WHEN LOWER(i.name) IN ('bloody peach', 'onde2pop', 'solero fizz by syah', 'cloudy jasmine by ajim') THEN 'sparkling'
    WHEN c.code = 'food' THEN 'pastries'
    WHEN c.code = 'merchandise' THEN 'merchandise'
    WHEN c.code = 'candles' THEN 'candles'
    WHEN c.code = 'coffee' THEN 'coffee'
    WHEN c.code = 'non_coffee' THEN 'barista_craft'
    ELSE NULL
  END
  LIMIT 1
)
WHERE i.subcategory_id IS NULL;
