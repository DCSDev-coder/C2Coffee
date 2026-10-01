-- Direct Android printers must be linked to the same customer-facing outlet
-- used by checkout. Older setup screens created these rows without store_id,
-- which allowed a test receipt but prevented checkout from queuing print jobs.
-- Only repair tenants with exactly one active customer-facing outlet.

UPDATE printer_targets pt
JOIN admin_tenants t ON t.code = pt.tenant_code
JOIN (
  SELECT tenant_id, MIN(id) AS store_id
  FROM stores
  WHERE status = 'active' AND is_customer_facing = 1
  GROUP BY tenant_id
  HAVING COUNT(*) = 1
) customer_outlet ON customer_outlet.tenant_id = t.id
SET pt.store_id = customer_outlet.store_id,
    pt.updated_at = UTC_TIMESTAMP()
WHERE pt.delivery_mode = 'android_direct'
  AND pt.store_id IS NULL;
