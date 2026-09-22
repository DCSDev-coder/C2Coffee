-- Send one durable customer reminder for orders left ready for collection.

ALTER TABLE orders
  ADD COLUMN pickup_reminder_sent_at DATETIME NULL AFTER ready_at,
  ADD KEY idx_orders_pickup_reminder (status, pickup_reminder_sent_at, ready_at);
