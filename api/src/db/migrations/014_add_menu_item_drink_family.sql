-- Add a display-level drink family so admin can create new drink types
-- and the mobile app can group menu items beyond the broad category bucket.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE menu_items
  ADD COLUMN drink_family_name VARCHAR(255) NOT NULL DEFAULT '' AFTER is_qualifying_cup;

UPDATE menu_items
SET drink_family_name = CASE
  WHEN LOWER(name) IN ('mont broga', 'shakerato bianco', 'yuzukano', 'senja di broga', 'espresso bomb') THEN 'Barista Craft'
  WHEN LOWER(name) IN ('v60 brew') THEN 'Pour Over'
  WHEN LOWER(name) IN ('espresso', 'pocco locco', 'latte', 'flat white', 'cappuccino') THEN 'Coffee'
  WHEN LOWER(name) IN ('butterscotch latte', 'hazelnut latte', 'vanilla latte', 'blue cloud coconut coffee', 'mocha') THEN 'Flavoured Coffee'
  WHEN LOWER(name) IN ('matcha latte', 'monkey matcha', 'pinky promise matcha') THEN 'Matcha'
  WHEN LOWER(name) IN ('milk chocolate', 'nutty chocolate') THEN 'Chocolate'
  WHEN LOWER(name) IN ('pinky blush milkshake by syah', 'paddle pop') THEN 'Milkshake'
  WHEN LOWER(name) IN ('boijito', 'fuji fizz', 'spicy mimosa') THEN 'Mocktails'
  WHEN LOWER(name) IN ('bloody peach', 'onde2pop', 'solero fizz', 'cloudy jasmine') THEN 'Sparkling'
  ELSE CASE
    WHEN category_id IN (SELECT id FROM menu_categories WHERE code = 'coffee') THEN 'Coffee'
    WHEN category_id IN (SELECT id FROM menu_categories WHERE code = 'non_coffee') THEN 'Barista Craft'
    ELSE 'Other'
  END
END;

