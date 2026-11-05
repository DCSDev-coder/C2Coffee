-- Track the annual protection and review date for each customer's loyalty tier.
-- Tier upgrades may happen immediately; inactivity downgrades happen only at review.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS user_loyalty_tier_status (
  user_id BIGINT UNSIGNED NOT NULL,
  tier_code VARCHAR(50) NOT NULL,
  cycle_started_at DATETIME NOT NULL,
  review_due_at DATETIME NOT NULL,
  last_reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_user_loyalty_tier_status_review_due (review_due_at, user_id),
  KEY idx_user_loyalty_tier_status_tier (tier_code),
  CONSTRAINT fk_user_loyalty_tier_status_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
