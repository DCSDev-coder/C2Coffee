-- Complete the inventory procurement workflow with supplier catalog metadata,
-- auditable purchase receipts, item barcodes, and multi-unit stock counts.

ALTER TABLE inventory_items
  ADD COLUMN barcode VARCHAR(120) NULL AFTER code,
  ADD UNIQUE KEY uq_inventory_item_barcode (tenant_id, barcode);

ALTER TABLE inventory_suppliers
  ADD COLUMN payment_terms VARCHAR(120) NULL AFTER phone,
  ADD COLUMN default_lead_time_days SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER payment_terms;

ALTER TABLE inventory_supplier_items
  ADD COLUMN supplier_barcode VARCHAR(120) NULL AFTER supplier_sku,
  ADD COLUMN lead_time_days SMALLINT UNSIGNED NULL AFTER minimum_order_quantity;

CREATE TABLE inventory_purchase_receipts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  receipt_ref VARCHAR(80) NOT NULL,
  delivery_order_ref VARCHAR(120) NULL,
  supplier_invoice_ref VARCHAR(120) NULL,
  received_at DATETIME NOT NULL,
  notes VARCHAR(500) NULL,
  received_by_admin_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_receipt_ref (tenant_id, receipt_ref),
  KEY idx_inventory_receipt_po_date (purchase_order_id, received_at),
  CONSTRAINT fk_inventory_receipt_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_receipt_po
    FOREIGN KEY (purchase_order_id) REFERENCES inventory_purchase_orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_receipt_admin
    FOREIGN KEY (received_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_purchase_receipt_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_id BIGINT UNSIGNED NOT NULL,
  purchase_order_line_id BIGINT UNSIGNED NOT NULL,
  delivered_purchase_units DECIMAL(14,3) NOT NULL,
  accepted_purchase_units DECIMAL(14,3) NOT NULL,
  rejected_purchase_units DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  rejection_reason VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_receipt_line (receipt_id, purchase_order_line_id),
  KEY idx_inventory_receipt_po_line (purchase_order_line_id),
  CONSTRAINT fk_inventory_receipt_line_receipt
    FOREIGN KEY (receipt_id) REFERENCES inventory_purchase_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_receipt_line_po
    FOREIGN KEY (purchase_order_line_id) REFERENCES inventory_purchase_order_lines(id) ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_receipt_line_quantities CHECK (
    delivered_purchase_units > 0
    AND accepted_purchase_units >= 0
    AND rejected_purchase_units >= 0
    AND accepted_purchase_units + rejected_purchase_units = delivered_purchase_units
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE inventory_stocktake_lines
  ADD COLUMN counted_purchase_units DECIMAL(14,3) NOT NULL DEFAULT 0.000 AFTER counted_quantity,
  ADD COLUMN counted_loose_units DECIMAL(14,3) NOT NULL DEFAULT 0.000 AFTER counted_purchase_units,
  ADD COLUMN purchase_unit_name_snapshot VARCHAR(80) NULL AFTER counted_loose_units,
  ADD COLUMN stock_units_per_purchase_unit_snapshot DECIMAL(14,3) NOT NULL DEFAULT 1.000 AFTER purchase_unit_name_snapshot;
