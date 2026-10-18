-- Tier rewards are represented by one entitlement per customer and reward
-- period. Legacy Admin Web forms allowed larger per-user limits, which could
-- expose the same tier benefit more than once and fail production readiness.
UPDATE voucher_templates
SET limit_per_user = 1,
    updated_at = UTC_TIMESTAMP()
WHERE voucher_type = 'tier_reward'
  AND COALESCE(limit_per_user, 1) <> 1;
