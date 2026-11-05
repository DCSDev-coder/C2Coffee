-- Prevent retries or duplicate settlement callbacks from awarding an order twice.

ALTER TABLE loyalty_cup_events
  ADD UNIQUE KEY uq_loyalty_cup_events_order (order_id);
