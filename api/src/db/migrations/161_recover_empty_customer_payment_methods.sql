-- Repair the rollout state that allowed an empty admin selection to disable
-- every online payment method for all mobile app versions. NULL retains the
-- documented legacy behavior of following the deployment allowlist.
UPDATE admin_tenants
SET customer_payment_methods_json = NULL
WHERE customer_payment_methods_json IS NOT NULL
  AND JSON_TYPE(customer_payment_methods_json) = 'ARRAY'
  AND JSON_LENGTH(customer_payment_methods_json) = 0;
