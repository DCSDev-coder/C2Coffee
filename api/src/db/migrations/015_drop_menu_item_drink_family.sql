-- Remove the legacy display-level drink family field.
-- Menu grouping now relies on category only, with drink-level customization handled separately.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE menu_items
  DROP COLUMN drink_family_name;
