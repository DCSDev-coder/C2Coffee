ALTER TABLE home_banners
  MODIFY COLUMN banner_type ENUM('voucher', 'event', 'new_item', 'general', 'partner') NOT NULL DEFAULT 'general';
