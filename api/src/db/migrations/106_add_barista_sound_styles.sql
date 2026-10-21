SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE barista_sound_settings
  ADD COLUMN clock_in_style ENUM('short', 'long', 'two_tone') NOT NULL DEFAULT 'short' AFTER clock_in_beeps,
  ADD COLUMN clock_out_style ENUM('short', 'long', 'two_tone') NOT NULL DEFAULT 'long' AFTER clock_out_beeps,
  ADD COLUMN side_work_style ENUM('short', 'long', 'two_tone') NOT NULL DEFAULT 'two_tone' AFTER side_work_beeps;
