-- Allow marketing to publish posters that open an approved external social or
-- entertainment destination, without treating them as partnership campaigns.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE home_banners
  MODIFY COLUMN banner_type ENUM('voucher', 'event', 'new_item', 'general', 'partner', 'social')
    NOT NULL DEFAULT 'general';

