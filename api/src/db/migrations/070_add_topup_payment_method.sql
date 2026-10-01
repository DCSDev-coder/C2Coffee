-- Preserve the customer's selected top-up route for finance reporting.
-- Existing payments intentionally remain NULL so reports do not infer history.
ALTER TABLE payments
  ADD COLUMN payment_method VARCHAR(32) NULL AFTER provider,
  ADD KEY idx_payments_topup_method_status (payment_method, status, created_at);
