-- Let customers clear their inbox without deleting operational notification history.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE notifications
  ADD COLUMN cleared_at DATETIME NULL AFTER read_at,
  ADD KEY idx_notifications_user_cleared_created (user_id, cleared_at, created_at);
