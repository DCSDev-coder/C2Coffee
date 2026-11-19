-- Tenant-editable customer payment method descriptions.
-- NULL falls back to default descriptions until an administrator saves custom text.
ALTER TABLE admin_tenants
  ADD COLUMN customer_payment_method_descriptions_json JSON NULL AFTER customer_payment_methods_json;
