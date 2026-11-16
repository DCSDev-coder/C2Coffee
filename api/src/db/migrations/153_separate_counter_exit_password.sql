-- Separate Counter App workspace-exit access from privileged administrator passwords.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS tenant_counter_security (
  tenant_id BIGINT UNSIGNED NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  requires_rotation TINYINT(1) NOT NULL DEFAULT 1,
  rotated_by_admin_user_id BIGINT UNSIGNED NULL,
  rotated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id),
  CONSTRAINT fk_tenant_counter_security_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tenant_counter_security_rotated_by
    FOREIGN KEY (rotated_by_admin_user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve access during rollout by copying one current privileged password
-- hash into the new, independent credential. The Admin Web marks this seeded
-- value for immediate rotation; later admin password changes no longer affect it.
INSERT INTO tenant_counter_security (
  tenant_id,
  password_hash,
  requires_rotation,
  rotated_by_admin_user_id,
  rotated_at
)
SELECT seeded.tenant_id, seeded.password_hash, 1, seeded.admin_user_id, NULL
FROM (
  SELECT
    tenant.id AS tenant_id,
    (
      SELECT au.password_hash
      FROM admin_users au
      JOIN admin_user_roles aur ON aur.admin_user_id = au.id
      JOIN admin_roles ar ON ar.id = aur.admin_role_id
      WHERE au.tenant_id = tenant.id
        AND au.status = 'active'
        AND au.password_hash IS NOT NULL
        AND ar.code IN ('super_admin', 'operations_admin', 'support_admin')
      ORDER BY FIELD(ar.code, 'super_admin', 'operations_admin', 'support_admin'), au.id
      LIMIT 1
    ) AS password_hash,
    (
      SELECT au.id
      FROM admin_users au
      JOIN admin_user_roles aur ON aur.admin_user_id = au.id
      JOIN admin_roles ar ON ar.id = aur.admin_role_id
      WHERE au.tenant_id = tenant.id
        AND au.status = 'active'
        AND au.password_hash IS NOT NULL
        AND ar.code IN ('super_admin', 'operations_admin', 'support_admin')
      ORDER BY FIELD(ar.code, 'super_admin', 'operations_admin', 'support_admin'), au.id
      LIMIT 1
    ) AS admin_user_id
  FROM admin_tenants tenant
) seeded
WHERE seeded.password_hash IS NOT NULL
ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id);
