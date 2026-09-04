-- Evidence metadata for support cases. Media bytes remain in media_assets.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE customer_support_tickets
  ADD COLUMN attachments_json JSON NULL AFTER message;
