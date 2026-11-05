-- Employee subsidy preference. The default preserves the existing behaviour
-- for eligible employees while allowing each tenant membership to opt out.
ALTER TABLE customer_tenant_memberships
  ADD COLUMN subsidy_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER is_employee;
