-- Counter apps activate once with a short-lived code. The resulting device
-- credential is stored only as a hash and can be revoked independently.

ALTER TABLE counter_devices
  MODIFY token_hash CHAR(64) NULL,
  ADD COLUMN activation_code_hash CHAR(64) NULL AFTER token_hash,
  ADD COLUMN activation_expires_at DATETIME NULL AFTER activation_code_hash,
  ADD COLUMN activated_at DATETIME NULL AFTER activation_expires_at,
  ADD UNIQUE KEY uq_counter_devices_activation_code_hash (activation_code_hash),
  ADD KEY idx_counter_devices_activation_expiry (activation_expires_at);
