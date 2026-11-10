SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE barista_sound_settings
  ADD COLUMN cancellation_alert_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER incoming_order_style,
  ADD COLUMN cancellation_alert_beeps TINYINT UNSIGNED NOT NULL DEFAULT 5 AFTER cancellation_alert_enabled,
  ADD COLUMN cancellation_alert_style ENUM('short', 'long', 'two_tone') NOT NULL DEFAULT 'two_tone' AFTER cancellation_alert_beeps,
  ADD COLUMN waiting_alert_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER cancellation_alert_style,
  ADD COLUMN waiting_alert_after_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 5 AFTER waiting_alert_enabled,
  ADD COLUMN waiting_alert_repeat_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 10 AFTER waiting_alert_after_minutes,
  ADD COLUMN preparing_alert_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER waiting_alert_repeat_minutes,
  ADD COLUMN preparing_alert_after_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 10 AFTER preparing_alert_enabled,
  ADD COLUMN waiting_alert_beeps TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER waiting_alert_repeat_minutes,
  ADD COLUMN waiting_alert_style ENUM('short', 'long', 'two_tone') NOT NULL DEFAULT 'short' AFTER waiting_alert_beeps,
  ADD COLUMN preparing_alert_repeat_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 10 AFTER preparing_alert_after_minutes,
  ADD COLUMN preparing_alert_beeps TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER preparing_alert_repeat_minutes,
  ADD COLUMN preparing_alert_style ENUM('short', 'long', 'two_tone') NOT NULL DEFAULT 'short' AFTER preparing_alert_beeps;
