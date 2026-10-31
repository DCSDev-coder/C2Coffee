ALTER TABLE inventory_movements
  ADD COLUMN supplier_id BIGINT UNSIGNED NULL AFTER inventory_item_id,
  ADD KEY idx_inventory_movements_supplier_item (tenant_id, supplier_id, inventory_item_id, created_at),
  ADD CONSTRAINT fk_inventory_movement_supplier
    FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id)
    ON DELETE RESTRICT;
