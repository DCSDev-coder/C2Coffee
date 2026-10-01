-- Existing customer accounts created before tenant membership was assigned at signup
-- belong to the current single-tenant C2 Coffee deployment.
INSERT IGNORE INTO customer_tenant_memberships (tenant_id, user_id)
SELECT t.id, u.id
FROM admin_tenants t
JOIN users u ON u.deleted_at IS NULL
WHERE t.code = 'c2coffee';
