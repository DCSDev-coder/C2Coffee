-- Data correction for the earned-entry-tier policy.
-- The first active tier requires at least one personally funded qualifying
-- drink order. Customers who genuinely earned it keep it permanently, even
-- after that order leaves the rolling 12-month upgrade window.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @base_tier_id := (
  SELECT id
  FROM loyalty_tiers
  WHERE is_active = 1
  ORDER BY min_cups ASC, sort_order ASC, id ASC
  LIMIT 1
);

UPDATE loyalty_tiers
SET min_cups = 1
WHERE id = @base_tier_id
  AND min_cups < 1;

INSERT INTO loyalty_tier_snapshots (
  user_id,
  tier_code,
  qualifying_cups_last_180d,
  qualifying_orders_rolling_12m,
  effective_at,
  reason_code
)
SELECT
  latest.user_id,
  'unqualified',
  0,
  0,
  UTC_TIMESTAMP(),
  'qualification_policy_correction'
FROM loyalty_tier_snapshots latest
JOIN (
  SELECT user_id, MAX(id) AS latest_id
  FROM loyalty_tier_snapshots
  GROUP BY user_id
) current_snapshot ON current_snapshot.latest_id = latest.id
JOIN (
  SELECT code
  FROM loyalty_tiers
  WHERE is_active = 1
  ORDER BY min_cups ASC, sort_order ASC, id ASC
  LIMIT 1
) base_tier ON base_tier.code = latest.tier_code
WHERE NOT EXISTS (
  SELECT 1
  FROM loyalty_cup_events lce
  WHERE lce.user_id = latest.user_id
    AND lce.reversed_at IS NULL
);

UPDATE user_loyalty_tier_status status
JOIN (
  SELECT code
  FROM loyalty_tiers
  WHERE is_active = 1
  ORDER BY min_cups ASC, sort_order ASC, id ASC
  LIMIT 1
) base_tier ON base_tier.code = status.tier_code
SET status.tier_code = 'unqualified',
    status.cycle_started_at = UTC_TIMESTAMP(),
    status.review_due_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 YEAR),
    status.last_reviewed_at = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM loyalty_cup_events lce
  WHERE lce.user_id = status.user_id
    AND lce.reversed_at IS NULL
);
