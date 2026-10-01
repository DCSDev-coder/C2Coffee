-- Each loyalty tier can present its own customer-app palette. NULL values keep
-- using the tenant-wide appearance so existing outlets remain unchanged.

ALTER TABLE loyalty_tiers
  ADD COLUMN primary_color VARCHAR(32) NULL AFTER badge_color,
  ADD COLUMN secondary_color VARCHAR(32) NULL AFTER primary_color,
  ADD COLUMN text_color VARCHAR(32) NULL AFTER secondary_color,
  ADD COLUMN background_color VARCHAR(32) NULL AFTER text_color,
  ADD COLUMN muted_text_color VARCHAR(32) NULL AFTER background_color;
