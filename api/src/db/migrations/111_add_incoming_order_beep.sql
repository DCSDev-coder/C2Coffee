SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE barista_sound_settings
  ADD COLUMN incoming_order_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER volume_percent,
  ADD COLUMN incoming_order_beeps TINYINT UNSIGNED NOT NULL DEFAULT 4 AFTER side_work_beeps,
  ADD COLUMN incoming_order_style ENUM('short', 'long', 'two_tone') NOT NULL DEFAULT 'two_tone' AFTER incoming_order_beeps;

ALTER TABLE barista_sound_settings
  DROP CHECK chk_barista_sound_patterns_unique,
  ADD CONSTRAINT chk_barista_sound_patterns_unique CHECK (
    clock_in_beeps <> clock_out_beeps
    AND clock_in_beeps <> side_work_beeps
    AND clock_in_beeps <> incoming_order_beeps
    AND clock_out_beeps <> side_work_beeps
    AND clock_out_beeps <> incoming_order_beeps
    AND side_work_beeps <> incoming_order_beeps
  );
