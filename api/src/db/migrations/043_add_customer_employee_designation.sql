-- Employee status belongs to a customer's membership of a tenant, not to the global user account.
ALTER TABLE customer_tenant_memberships
  ADD COLUMN is_employee TINYINT(1) NOT NULL DEFAULT 0 AFTER user_id,
  ADD KEY idx_customer_tenant_memberships_employee (tenant_id, is_employee, user_id);
