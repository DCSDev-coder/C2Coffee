-- Attribute prepared orders to the selected Barista roster member, not the shared app login.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE orders
  ADD COLUMN preparing_by_barista_id INT NULL AFTER preparing_by_admin_user_id,
  ADD COLUMN ready_by_barista_id INT NULL AFTER ready_by_admin_user_id,
  ADD KEY idx_orders_preparing_by_barista_id (preparing_by_barista_id),
  ADD KEY idx_orders_ready_by_barista_id (ready_by_barista_id),
  ADD CONSTRAINT fk_orders_preparing_by_barista
    FOREIGN KEY (preparing_by_barista_id) REFERENCES baristas(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_orders_ready_by_barista
    FOREIGN KEY (ready_by_barista_id) REFERENCES baristas(id)
    ON DELETE SET NULL;
