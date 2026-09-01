-- C2 Coffee Phase 1 migration 023
-- Move OTP delivery tracking from chat-app channels to email.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE auth_otps
  MODIFY channel ENUM('email', 'whatsapp', 'sms') NOT NULL;

ALTER TABLE otp_request_logs
  MODIFY channel_requested ENUM('email', 'whatsapp', 'sms') NOT NULL;
