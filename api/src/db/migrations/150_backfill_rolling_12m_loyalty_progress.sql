-- Backfill the expand-contract column separately from the schema migration.
-- A subsequent live tier refresh recalculates the current value from cup events.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

UPDATE loyalty_tier_snapshots
SET qualifying_orders_rolling_12m = qualifying_cups_last_180d
WHERE qualifying_orders_rolling_12m IS NULL;
