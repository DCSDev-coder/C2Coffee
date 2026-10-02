ALTER TABLE stores
  ADD COLUMN weekly_hours_json JSON NULL AFTER longitude,
  ADD COLUMN temporarily_closed TINYINT(1) NOT NULL DEFAULT 0 AFTER weekly_hours_json;

