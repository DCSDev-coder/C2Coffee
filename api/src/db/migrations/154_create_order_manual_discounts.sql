-- Record barista-entered percentage discounts separately from customer
-- vouchers. The order keeps the calculated discount_total_rm while this table
-- preserves who applied the adjustment and why.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS order_manual_discounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL,
  discount_amount_rm DECIMAL(12,2) NOT NULL,
  remarks VARCHAR(500) NOT NULL,
  applied_by_admin_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_manual_discount_order (order_id),
  KEY idx_order_manual_discount_tenant_created (tenant_id, created_at),
  CONSTRAINT fk_order_manual_discount_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_manual_discount_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_manual_discount_admin
    FOREIGN KEY (applied_by_admin_user_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_order_manual_discount_percent
    CHECK (discount_percent > 0 AND discount_percent <= 100),
  CONSTRAINT chk_order_manual_discount_amount
    CHECK (discount_amount_rm >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
