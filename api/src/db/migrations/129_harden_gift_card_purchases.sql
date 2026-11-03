-- Make customer gift-card purchase retries safe without changing existing cards.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE gift_cards
  ADD COLUMN purchase_idempotency_key VARCHAR(64) NULL AFTER purchase_ref,
  ADD UNIQUE KEY uq_gift_cards_purchaser_idempotency (purchaser_user_id, purchase_idempotency_key);
