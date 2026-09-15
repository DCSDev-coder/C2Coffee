-- Make a retried mobile checkout resolve to its original committed order.
ALTER TABLE orders
  ADD COLUMN checkout_idempotency_key VARCHAR(64) NULL AFTER order_ref,
  ADD UNIQUE KEY uq_orders_user_checkout_idempotency (user_id, checkout_idempotency_key);
