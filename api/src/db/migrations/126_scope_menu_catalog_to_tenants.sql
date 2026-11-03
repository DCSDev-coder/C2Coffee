-- Separate tenant catalogue ownership from outlet-specific availability.
-- An item may be configured once for a tenant and later enabled at any of
-- that tenant's outlets without duplicating option or nutrition setup.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS menu_item_tenants (
  tenant_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, menu_item_id),
  KEY idx_menu_item_tenants_item (menu_item_id),
  CONSTRAINT fk_menu_item_tenants_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_menu_item_tenants_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing outlet assignments are authoritative tenant ownership evidence.
INSERT IGNORE INTO menu_item_tenants (tenant_id, menu_item_id)
SELECT DISTINCT s.tenant_id, availability.menu_item_id
FROM menu_item_store_availability availability
JOIN stores s ON s.id = availability.store_id;

-- The catalogue predates tenant support. Legacy items without any outlet row
-- belong to the original C2 Coffee tenant created by migration 010.
INSERT IGNORE INTO menu_item_tenants (tenant_id, menu_item_id)
SELECT tenant.id, item.id
FROM admin_tenants tenant
JOIN menu_items item
LEFT JOIN menu_item_tenants tenant_item ON tenant_item.menu_item_id = item.id
WHERE tenant.code = 'c2coffee'
  AND tenant_item.menu_item_id IS NULL;
