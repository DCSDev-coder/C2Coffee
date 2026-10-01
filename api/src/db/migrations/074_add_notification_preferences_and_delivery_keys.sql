-- Customer notification preferences and idempotency for scheduled reminders.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS customer_notification_preferences (
  user_id BIGINT UNSIGNED NOT NULL,
  marketing_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_customer_notification_preferences_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE notifications
  ADD COLUMN delivery_key VARCHAR(191) NULL AFTER data_json,
  ADD UNIQUE KEY uq_notifications_user_type_delivery (user_id, type, delivery_key);
