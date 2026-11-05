-- Grandfather every existing member into a full 12-month protected period
-- when the annual tier policy is deployed. This avoids an immediate downgrade.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

INSERT INTO user_loyalty_tier_status (
  user_id,
  tier_code,
  cycle_started_at,
  review_due_at,
  last_reviewed_at
)
SELECT
  latest.user_id,
  latest.tier_code,
  UTC_TIMESTAMP(),
  DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 YEAR),
  NULL
FROM (
  SELECT lts.user_id, lts.tier_code
  FROM loyalty_tier_snapshots lts
  JOIN (
    SELECT user_id, MAX(id) AS latest_id
    FROM loyalty_tier_snapshots
    GROUP BY user_id
  ) current_snapshot ON current_snapshot.latest_id = lts.id
) latest
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);
