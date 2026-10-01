-- Keep the customer application on one active outlet today while preserving
-- a secure per-outlet routing model for future barista tablets.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE stores
  ADD COLUMN is_customer_facing TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD KEY idx_stores_customer_facing (tenant_id, is_customer_facing, status);

UPDATE stores s
JOIN admin_tenants t ON t.id = s.tenant_id
SET s.is_customer_facing = CASE WHEN s.code = 'C2-BROGA' THEN 1 ELSE 0 END
WHERE t.code = 'c2coffee';

CREATE TABLE admin_user_store_assignments (
  admin_user_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_user_id, store_id),
  KEY idx_admin_user_store_assignments_store (store_id),
  CONSTRAINT fk_admin_user_store_assignments_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_user_store_assignments_store
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The current single-outlet barista accounts operate Broga. Future outlets
-- require a deliberate assignment before their tablet can access orders.
INSERT IGNORE INTO admin_user_store_assignments (admin_user_id, store_id)
SELECT au.id, s.id
FROM admin_users au
JOIN admin_user_roles aur ON aur.admin_user_id = au.id
JOIN admin_roles ar ON ar.id = aur.admin_role_id AND ar.code = 'barista'
JOIN stores s ON s.tenant_id = au.tenant_id AND s.is_customer_facing = 1
WHERE s.status = 'active';

-- Legacy operational records were created before an outlet was required.
-- Bind them to Broga so they cannot become cross-outlet defaults later.
UPDATE outlet_integrations oi
JOIN admin_tenants t ON t.code = oi.tenant_code
JOIN stores s ON s.tenant_id = t.id AND s.is_customer_facing = 1
SET oi.store_id = s.id
WHERE oi.store_id IS NULL;

UPDATE printer_targets pt
JOIN admin_tenants t ON t.code = pt.tenant_code
JOIN stores s ON s.tenant_id = t.id AND s.is_customer_facing = 1
SET pt.store_id = s.id
WHERE pt.store_id IS NULL;

UPDATE barista_weekly_schedules bws
JOIN admin_tenants t ON t.code = bws.tenant_code
JOIN stores s ON s.tenant_id = t.id AND s.is_customer_facing = 1
SET bws.store_id = s.id
WHERE bws.store_id IS NULL;
