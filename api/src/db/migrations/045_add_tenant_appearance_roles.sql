-- Additional role-based customer app colours. Defaults are supplied by the API
-- until each tenant chooses custom values.
ALTER TABLE admin_tenants
  ADD COLUMN background_color VARCHAR(32) NULL AFTER text_color,
  ADD COLUMN muted_text_color VARCHAR(32) NULL AFTER background_color;
