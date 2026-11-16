SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE barista_sound_settings
  MODIFY COLUMN incoming_order_style ENUM('short', 'long', 'two_tone', 'new_order') NOT NULL DEFAULT 'new_order';

UPDATE barista_sound_settings
SET incoming_order_style = 'new_order'
WHERE incoming_order_style IN ('short', 'long', 'two_tone');
