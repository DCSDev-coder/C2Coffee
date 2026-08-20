-- Migration 007: Add valid_until, total_quantity, and limit_per_user to voucher_templates

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE voucher_templates
ADD COLUMN valid_until DATETIME NULL AFTER expires_in_days,
ADD COLUMN total_quantity INT UNSIGNED NULL AFTER valid_until,
ADD COLUMN limit_per_user INT UNSIGNED NULL DEFAULT 1 AFTER total_quantity;
