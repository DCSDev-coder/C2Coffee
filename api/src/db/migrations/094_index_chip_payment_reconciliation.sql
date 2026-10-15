-- Support the scheduled lookup of unresolved CHIP top-ups.
ALTER TABLE payments
  ADD KEY idx_payments_provider_status_created_at (provider, status, created_at);
