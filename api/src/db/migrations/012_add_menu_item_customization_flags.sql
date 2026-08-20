-- Add drink customization toggles so admin can enable or disable options per menu item.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE menu_items
  ADD COLUMN allow_choice_of_beans TINYINT(1) NOT NULL DEFAULT 0 AFTER is_qualifying_cup,
  ADD COLUMN allow_espresso_shot TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_choice_of_beans,
  ADD COLUMN allow_choice_of_milk TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_espresso_shot,
  ADD COLUMN allow_choice_of_sweetness TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_choice_of_milk,
  ADD COLUMN allow_ice_level TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_choice_of_sweetness,
  ADD COLUMN allow_temperature TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_ice_level,
  ADD COLUMN allow_sparkling_mixer TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_temperature,
  ADD COLUMN allow_order_type TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_sparkling_mixer,
  ADD COLUMN allow_remarks TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_order_type;

UPDATE menu_items
SET
  allow_choice_of_beans = is_handcrafted_drink,
  allow_espresso_shot = is_handcrafted_drink,
  allow_choice_of_milk = is_handcrafted_drink,
  allow_choice_of_sweetness = is_handcrafted_drink,
  allow_ice_level = is_handcrafted_drink,
  allow_temperature = is_handcrafted_drink,
  allow_sparkling_mixer = is_handcrafted_drink,
  allow_order_type = is_handcrafted_drink,
  allow_remarks = is_handcrafted_drink;
