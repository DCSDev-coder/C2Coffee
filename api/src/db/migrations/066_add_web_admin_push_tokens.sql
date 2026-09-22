-- Allow authenticated browser-based Barista Console registrations for FCM.

ALTER TABLE admin_push_tokens
  MODIFY COLUMN platform ENUM('android', 'ios', 'web') NOT NULL;
