-- Add marketing poster targeting and event scheduling metadata.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE home_banners
  ADD COLUMN banner_type ENUM('voucher', 'event', 'new_item', 'general') NOT NULL DEFAULT 'general' AFTER image_source,
  ADD COLUMN destination_type ENUM('reward_section', 'menu', 'calendar') NOT NULL DEFAULT 'menu' AFTER banner_type,
  ADD COLUMN secondary_destination_type ENUM('reward_section', 'menu', 'calendar') NULL AFTER destination_type,
  ADD COLUMN target_value VARCHAR(120) NULL AFTER secondary_destination_type,
  ADD COLUMN starts_at DATETIME NULL AFTER target_value,
  ADD COLUMN ends_at DATETIME NULL AFTER starts_at,
  ADD KEY idx_home_banners_type_active_sort (banner_type, is_active, placement, sort_order),
  ADD KEY idx_home_banners_target_value (target_value);
