CREATE TABLE IF NOT EXISTS customer_tenant_memberships (
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, user_id),
  KEY idx_customer_tenant_memberships_user (user_id),
  CONSTRAINT fk_customer_tenant_memberships_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_customer_tenant_memberships_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO customer_tenant_memberships (tenant_id, user_id)
SELECT DISTINCT s.tenant_id, o.user_id
FROM orders o
JOIN stores s ON s.id = o.store_id
WHERE s.tenant_id IS NOT NULL;
