-- Add a stored base token price for menu items alongside RM pricing.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE menu_items
  ADD COLUMN base_price_token INT UNSIGNED NOT NULL DEFAULT 0 AFTER base_price_rm;

UPDATE menu_items
SET base_price_token = FLOOR(base_price_rm)
WHERE base_price_token = 0;
