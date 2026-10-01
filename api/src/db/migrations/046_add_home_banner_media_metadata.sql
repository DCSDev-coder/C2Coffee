-- Marketing posters can be static images or animated GIFs.
ALTER TABLE home_banners
  ADD COLUMN media_type ENUM('image', 'gif') NOT NULL DEFAULT 'image' AFTER image_source,
  ADD COLUMN animation_duration_ms INT UNSIGNED NOT NULL DEFAULT 0 AFTER media_type;
