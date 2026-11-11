-- Restore empty token wallets for active, fully registered customers retained
-- through a pre-launch operational-data cleanup.
INSERT IGNORE INTO token_accounts
  (user_id, balance_available, balance_reserved, balance_cap, created_at, updated_at)
SELECT DISTINCT
  u.id,
  0,
  0,
  500,
  UTC_TIMESTAMP(),
  UTC_TIMESTAMP()
FROM users u
JOIN customer_tenant_memberships ctm ON ctm.user_id = u.id
WHERE u.status = 'active'
  AND u.deleted_at IS NULL
  AND ctm.registration_status = 'registered';
