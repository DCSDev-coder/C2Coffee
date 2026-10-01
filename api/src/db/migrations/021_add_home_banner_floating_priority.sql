SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE home_banners
  ADD COLUMN floating_priority TINYINT(1) NOT NULL DEFAULT 0 AFTER sort_order,
  ADD KEY idx_home_banners_active_floating (is_active, floating_priority, placement, sort_order);
