-- Tenant-controlled customer payment method visibility.
-- NULL preserves the deployment allowlist until an administrator saves a choice.
ALTER TABLE admin_tenants
  ADD COLUMN customer_payment_methods_json JSON NULL AFTER text_color;
