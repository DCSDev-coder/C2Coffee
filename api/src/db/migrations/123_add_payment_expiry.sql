-- Keep a server-authoritative payment window for direct orders as well as top-ups.
-- The API uses this only for recovery UX; CHIP remains authoritative for settlement.
ALTER TABLE payments
  ADD COLUMN expires_at DATETIME NULL AFTER created_at,
  ADD KEY idx_payments_expiry (status, expires_at);

UPDATE payments
SET expires_at = DATE_ADD(created_at, INTERVAL 15 MINUTE)
WHERE expires_at IS NULL
  AND status IN ('pending', 'authorized');
