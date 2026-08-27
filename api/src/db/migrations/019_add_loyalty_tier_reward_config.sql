-- C2 Coffee Phase 1 migration 019
-- Add configurable tier reward payload so tier-specific promotions can be stored separately from the global voucher list.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE loyalty_tiers
  ADD COLUMN reward_config_json JSON NULL AFTER promotion_text;
