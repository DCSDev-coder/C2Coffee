-- Expand-only migration for item-level refund accounting. Existing full
-- refunds remain valid because they have no rows in this table.
-- Production rollback is forward-only: deploy code that stops reading this
-- table, then remove it in a later migration after preserving audit history.
CREATE TABLE IF NOT EXISTS refund_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  refund_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  refund_amount_rm DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  refund_token_amount INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refund_items_refund_order_item (refund_id, order_item_id),
  KEY idx_refund_items_order_item (order_item_id),
  CONSTRAINT fk_refund_items_refund
    FOREIGN KEY (refund_id) REFERENCES refunds(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_refund_items_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_refund_items_quantity_positive CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
