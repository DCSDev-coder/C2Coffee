-- Reservations may exceed on-hand stock, and collection may record a shortfall.
ALTER TABLE inventory_store_stocks
  DROP CHECK chk_inventory_stock_nonnegative,
  ADD CONSTRAINT chk_inventory_stock_reserved_nonnegative CHECK (reserved_quantity >= 0);

-- A physical count remains nonnegative, but its recorded expected balance can
-- be negative after a shortfall.
ALTER TABLE inventory_stocktake_lines
  DROP CHECK chk_inventory_stocktake_count,
  ADD CONSTRAINT chk_inventory_stocktake_count CHECK (counted_quantity >= 0);
