-- Per-voucher customer reminder settings. These are campaign controls, not
-- marketing broadcasts, and are evaluated against each issued voucher window.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE voucher_templates
  ADD COLUMN start_reminder_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER usage_instructions,
  ADD COLUMN start_reminder_minutes_before SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER start_reminder_enabled,
  ADD COLUMN end_reminder_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER start_reminder_minutes_before,
  ADD COLUMN end_reminder_minutes_before SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER end_reminder_enabled;
