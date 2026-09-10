-- Keep customer-facing text separate from primary actions and supporting surfaces.
ALTER TABLE admin_tenants
  ADD COLUMN text_color VARCHAR(32) NULL AFTER secondary_color;
