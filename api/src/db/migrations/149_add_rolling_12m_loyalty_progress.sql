-- Expand the loyalty snapshot schema with an accurately named qualification field.
-- The legacy qualifying_cups_last_180d column remains during the compatibility window.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE loyalty_tier_snapshots
  ADD COLUMN qualifying_orders_rolling_12m INT UNSIGNED NULL
    AFTER qualifying_cups_last_180d;
