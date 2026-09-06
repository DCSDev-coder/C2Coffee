-- Campaign content is owned by a tenant. Existing single-tenant data belongs to c2coffee.
ALTER TABLE voucher_templates
  ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id,
  ADD KEY idx_voucher_templates_tenant_active (tenant_id, is_active);

UPDATE voucher_templates vt
JOIN admin_tenants t ON t.code = 'c2coffee'
SET vt.tenant_id = t.id
WHERE vt.tenant_id IS NULL;

ALTER TABLE voucher_templates
  MODIFY tenant_id BIGINT UNSIGNED NOT NULL,
  DROP INDEX uq_voucher_templates_code,
  ADD UNIQUE KEY uq_voucher_templates_tenant_code (tenant_id, code),
  ADD CONSTRAINT fk_voucher_templates_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE;

ALTER TABLE home_banners
  ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id,
  ADD KEY idx_home_banners_tenant_active_sort (tenant_id, is_active, sort_order);

UPDATE home_banners hb
JOIN admin_tenants t ON t.code = 'c2coffee'
SET hb.tenant_id = t.id
WHERE hb.tenant_id IS NULL;

ALTER TABLE home_banners
  MODIFY tenant_id BIGINT UNSIGNED NOT NULL,
  DROP INDEX uq_home_banners_code,
  ADD UNIQUE KEY uq_home_banners_tenant_code (tenant_id, code),
  ADD CONSTRAINT fk_home_banners_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE;
