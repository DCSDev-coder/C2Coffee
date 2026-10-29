SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE voucher_templates
  ADD COLUMN usage_instructions TEXT NULL;
