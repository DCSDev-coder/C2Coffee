-- Bind local top-up intents to the provider Bill that settles them.
-- The payment and ledger rows remain the source of truth for settlement.

ALTER TABLE token_topups
  ADD COLUMN expires_at DATETIME NULL AFTER cancelled_at,
  ADD KEY idx_token_topups_status_expires_at (status, expires_at);
