-- Add barista role and order attribution for staff-prepared orders.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

INSERT INTO admin_roles (code, name, description)
VALUES
  ('barista', 'Barista', 'Barista app access for preparing customer orders')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

ALTER TABLE orders
  ADD COLUMN preparing_by_admin_user_id BIGINT UNSIGNED NULL AFTER accepted_at,
  ADD COLUMN ready_by_admin_user_id BIGINT UNSIGNED NULL AFTER ready_at,
  ADD KEY idx_orders_preparing_by_admin_user_id (preparing_by_admin_user_id),
  ADD KEY idx_orders_ready_by_admin_user_id (ready_by_admin_user_id),
  ADD CONSTRAINT fk_orders_preparing_by_admin_user
    FOREIGN KEY (preparing_by_admin_user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_orders_ready_by_admin_user
    FOREIGN KEY (ready_by_admin_user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL;
