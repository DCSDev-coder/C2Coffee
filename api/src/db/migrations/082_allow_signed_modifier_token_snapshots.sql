-- Modifier token deltas may be negative for discounts or free options.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE order_item_modifiers
  MODIFY COLUMN token_price_delta_snapshot INT NOT NULL DEFAULT 0;
