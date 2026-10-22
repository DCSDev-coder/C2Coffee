-- Allow the Counter workspace to distinguish walk-in sales from member sales.
-- A stable internal walk-in user is used per outlet because the original orders
-- schema requires user_id. The is_guest flag prevents loyalty/referral awards.

ALTER TABLE orders
  ADD COLUMN is_guest TINYINT(1) NOT NULL DEFAULT 0 AFTER user_id,
  ADD COLUMN order_channel ENUM('mobile', 'counter') NOT NULL DEFAULT 'mobile' AFTER is_guest,
  ADD COLUMN fulfillment_type ENUM('pickup', 'dine_in', 'take_away') NOT NULL DEFAULT 'pickup' AFTER order_channel,
  ADD KEY idx_orders_store_channel_created (store_id, order_channel, created_at);

