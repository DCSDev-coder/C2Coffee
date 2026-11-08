-- Tenant-scoped subsidy roles and effective-dated monthly policy values.
-- Policy changes are scheduled for a future period; existing allowance rows
-- remain immutable for audit and refund purposes.

ALTER TABLE customer_tenant_memberships
  ADD COLUMN subsidy_role ENUM('none', 'employee', 'intern', 'boss') NOT NULL DEFAULT 'none'
    AFTER is_employee,
  ADD KEY idx_customer_tenant_memberships_subsidy_role (tenant_id, subsidy_role, user_id);

UPDATE customer_tenant_memberships
   SET subsidy_role = 'employee'
 WHERE is_employee = 1;

ALTER TABLE orders
  ADD COLUMN employee_allowance_was_unlimited TINYINT(1) NOT NULL DEFAULT 0
    AFTER employee_allowance_tokens_used;

CREATE TABLE IF NOT EXISTS tenant_subsidy_policies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  subsidy_role ENUM('employee', 'intern') NOT NULL,
  monthly_amount INT UNSIGNED NOT NULL,
  effective_period_start DATE NOT NULL,
  created_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenant_subsidy_policy_period (tenant_id, subsidy_role, effective_period_start),
  KEY idx_tenant_subsidy_policy_lookup (tenant_id, subsidy_role, effective_period_start),
  CONSTRAINT fk_tenant_subsidy_policy_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_subsidy_policy_admin
    FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT chk_tenant_subsidy_policy_amount CHECK (monthly_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve the existing 200-token employee policy for the current period and
-- provide the initial 100-token intern policy without changing issued rows.
INSERT IGNORE INTO tenant_subsidy_policies
  (tenant_id, subsidy_role, monthly_amount, effective_period_start)
SELECT id, 'employee', 200,
       STR_TO_DATE(DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'), '%Y-%m-01'), '%Y-%m-%d')
  FROM admin_tenants;

INSERT IGNORE INTO tenant_subsidy_policies
  (tenant_id, subsidy_role, monthly_amount, effective_period_start)
SELECT id, 'intern', 100,
       STR_TO_DATE(DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'), '%Y-%m-01'), '%Y-%m-%d')
  FROM admin_tenants;
