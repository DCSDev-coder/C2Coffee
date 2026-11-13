-- Add one shared in-store price for both Counter and Barista order entry while
-- keeping the customer/mobile price unchanged.
ALTER TABLE menu_items
  ADD COLUMN counter_price_rm DECIMAL(12,2) NULL AFTER base_price_rm;

UPDATE menu_items
SET counter_price_rm = base_price_rm
WHERE counter_price_rm IS NULL;

ALTER TABLE menu_items
  MODIFY COLUMN counter_price_rm DECIMAL(12,2) NOT NULL;
